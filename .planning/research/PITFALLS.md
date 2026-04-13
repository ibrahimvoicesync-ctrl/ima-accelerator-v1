# Pitfalls Research — Milestone v1.5

**Domain:** Analytics Pages, Coach Dashboard Stats, Full Coach Analytics, Coach-Logged Deals, Milestone Notifications
**Researched:** 2026-04-13
**Confidence:** HIGH (grounded in existing v1.0–v1.4 patterns: v1.2 Phase 19 RLS, Phase 20 caching, Phase 22 rate limiting, Phase 23 ownership leak fix, 260401-cwd notification pattern, v1.4 Phase 30 role CHECK expansion, Phase 42–43 deals infrastructure)

Pitfalls below are tied to v1.5 Active requirements only. Each one maps to the Feature it lives in (Feat 1 Student Analytics, Feat 2 Coach Dashboard, Feat 3 Full Coach Analytics, Feat 4 Coach-Logged Deals, Feat 5 Milestone Notifications). Phase numbers assume sequential build order (v1.5 D-10) starting at Phase 44.

---

## Critical Pitfalls

### Pitfall 1: Client-side row pulls on analytics pages (Feat 1, Feat 3)

**What goes wrong:**
Analytics page hits `/api/daily-reports?student_id=X` or `.from("work_sessions").select("*")` and ships 200–2000 rows per student to the browser to group/aggregate in JavaScript. At 5k concurrent students (D-05) this saturates Pro Small egress and blows the P95 <1s envelope set in v1.2 Phase 24.

**Why it happens:**
Reach for `select("*")` + `Array.reduce()` feels faster than writing a Postgres function. Old habits from non-RLS projects where egress was free. recharts tutorials all show client-side aggregation.

**How to avoid:**
All aggregation goes in a Postgres RPC (locked by D-01). Each analytics panel = one RPC call returning already-grouped rows (`date_bucket, count, sum_minutes` shape). Follow v1.2 Phase 20 `get_owner_overview` / `get_student_detail` consolidation pattern. Enforce via code review: no `.select("*").from("daily_reports")` in any analytics server component.

**Warning signs:**
- `.then(rows => rows.reduce(...))` in a server component or RSC
- JSON response payload > 50KB for an analytics panel
- `useMemo` grouping 500+ rows in a chart component
- Missing `student_id` filter on any `.from()` call (RLS is not a substitute per CLAUDE.md rule #4)

**Phase to address:** Phase 44 (Analytics RPC Foundation — MUST land before any page that uses it).

---

### Pitfall 2: Chart library hydration mismatch under React 19 RSC (Feat 1, Feat 2, Feat 3)

**What goes wrong:**
recharts (D-11 candidate) renders different SVG widths on server vs. client because it measures `ResponsiveContainer` from `window`. React 19 throws a hydration error, the chart disappears, and the server logs fill with `Hydration failed` noise — hiding real errors.

**Why it happens:**
recharts uses `ResponsiveContainer` which reads DOM size at mount. In RSC-first Next.js 16, an eagerly imported chart renders on the server with a different default width. React 19 is stricter about hydration mismatches than React 18.

**How to avoid:**
Put every chart inside a dedicated `"use client"` component and either (a) render inside `useEffect`-gated state so the chart only mounts after hydration, or (b) lazy-load with `next/dynamic({ ssr: false })`. Keep the server component responsible for the RPC fetch and pass already-serialized data as props — the client chart wrapper only receives plain arrays. Document this pattern in the first analytics phase so subsequent phases copy it.

**Warning signs:**
- "Hydration failed because the server rendered HTML didn't match the client" in dev console
- Chart is visible for 50ms then vanishes
- Snapshot tests pass but E2E screenshots show blank canvas
- SSR HTML contains `<svg width="0" height="0">`

**Phase to address:** Phase 45 (Student Analytics Page) establishes the pattern; Phase 47 (Coach Analytics) and Phase 46 (Coach Dashboard) reuse it.

---

### Pitfall 3: Timezone drift in week/day bucketing (Feat 1, Feat 2, Feat 3)

**What goes wrong:**
Top-3 hours leaderboard (D-13, Mon–Sun ISO week) shows Saturday night sessions in the next week because the RPC uses `date_trunc('week', completed_at)` on a `timestamptz` without timezone-casting. Students in UTC+3 see stats shift at 21:00 local. Skip tracker (v1.4 D-01) and leaderboard disagree on where week boundaries are.

**Why it happens:**
Postgres `date_trunc('week', ...)` uses the session timezone, which on Supabase defaults to UTC. Client-side code uses `new Date().getDay()` which is local. The mismatch is invisible until a student works on Sunday at 23:30 local and the session "belongs" to the wrong week.

**How to avoid:**
Pass `p_today date` as an explicit argument to every time-series RPC (same rule the codebase already applies to skip tracker per STATE.md accumulated context). Compute `p_today` in the server component via `getTodayUTC()` (already in config per Phase 13). Use `date_trunc('week', p_today)` + fixed `INTERVAL '6 days'` for Mon–Sun windows. Never use `CURRENT_DATE` or `now()` inside the function body. Unit test: assert same week-start for 2026-04-12T23:30Z and 2026-04-13T00:30Z.

**Warning signs:**
- Leaderboard top-3 changes when you reload at midnight
- Skip tracker and top-3 disagree on the same week
- Different answers from local `npm run dev` vs. Vercel deploy
- Any `now()` or `CURRENT_DATE` grep hit inside a function body in a new migration

**Phase to address:** Phase 44 (Analytics RPC Foundation) — timezone-safe helpers must be the first RPCs written; all subsequent analytics phases consume them.

---

### Pitfall 4: Coach logs deal for an unassigned student (Feat 4) — authorization bypass

**What goes wrong:**
New endpoint `POST /api/deals` (coach path) checks role (`coach`) but not assignment. A coach with 3 assigned students could insert a deal `{ student_id: <any_student> }` and RLS lets it through because the current `deals` RLS was written for students inserting their own deals and for coach/owner read-only (Phase 43). Cross-coach data pollution; incorrect revenue attribution; worse: a malicious insider can inflate a competitor coach's deal count.

**Why it happens:**
The 260328-level security audit (v1.2 Phase 23) caught the reports/review leak but `deals` INSERT policy was written pre-coach-logging (Phase 41 only handled student self-insert). Repeating the exact same class of bug: trusting role without ownership scoping.

**How to avoid:**
Two-layer defense mirroring the Phase 34 report_comments pattern (STATE.md "two-step ownership check"):
1. **Route handler:** fetch `users.coach_id` where `id = body.student_id`; if `profile.role = coach` assert `coach_id === profile.id`; owners bypass; students cannot reach this branch.
2. **RLS INSERT policy on `deals`:** WITH CHECK clause asserting `auth.uid()` matches the student's auth_id OR matches the student's coach_id OR matches an owner — using the `(SELECT auth.uid())` initplan pattern (D-03) so it evaluates once per query, not per row.

Write an E2E test: coach A logs deal for student assigned to coach B → expect 403/404, not 201. Add to Phase 48 UAT.

**Warning signs:**
- `deals` RLS INSERT policy does not reference `users.coach_id` or `coach_id`
- Route handler checks `role === 'coach'` but not assignment
- Test fixture has only one coach → assignment gap not exercised
- `logged_by` is set but never validated against `student.coach_id`

**Phase to address:** Phase 48 (Coach-Logged Deals — RLS & Route). MUST precede Phase 49 (Add Deal UI) to avoid shipping the button before authorization lands.

---

### Pitfall 5: Milestone notification double-fires (Feat 5) — idempotency bug

**What goes wrong:**
Student hits 5 closed influencers (Step 11 completion) → notification A fires. Coach is unassigned + reassigned → `coach_id` changes. Nightly recomputation sees the same "5 influencers closed" state for the new coach → notification B fires. Or: backfill migration marks 20 pre-existing students as "already hit milestone," coach dashboard shows 20 fresh badges they never earned. Coaches stop trusting the badge.

**Why it happens:**
Copying the 260401-cwd pattern naïvely. That pattern uses `alert_dismissals` with a key like `100h_milestone:{student_id}` and recomputes from sessions — which is safe because "sum ≥ 6000 min" is monotonic and dismiss-scoped-to-coach. New milestones like "5 Influencers Closed" or "First Brand Response" are roadmap step transitions, which are also monotonic but the fire boundary is different: firing per coach_id when coach changes causes re-fires.

**How to avoid:**
Three rules:
1. **Key scoped to (student, milestone)** not (student, milestone, coach): `milestone:{type}:{student_id}`. Coach reassignment does NOT re-fire. The coach who currently owns the student sees the badge; the old coach's badge goes away because the base query filters by current `coach_id`. No `alert_dismissals` row is re-created.
2. **One-way transitions only.** A milestone row is "achieved" when the monotonic condition first becomes true. Never re-evaluate against downgrade (e.g., deal deleted → don't un-fire "Closed Deal"; use `alert_dismissals` to mute).
3. **Backfill policy decision (D-required):** at migration time, seed every currently-qualifying student with a `dismissed_at = <migration timestamp>` row so historical matches are pre-dismissed, NOT newly-notifying. Add this to the migration that ships Feat 5.

Unit test: run the notification-compute function twice in a row with no state change → second run returns zero new notifications.

**Warning signs:**
- Same milestone appears twice in the coach alerts list
- Reassigning a student triggers new notifications
- Dismissed milestone returns after a data backfill
- Migration does NOT insert pre-dismissal rows for existing qualifying students

**Phase to address:** Phase 51 (Milestone Notifications — Compute & Migration). The backfill seed MUST ship in the same migration as the notification compute function.

---

### Pitfall 6: "Closed Deal every deal" fires 50 times for high performers (Feat 5) — notification noise

**What goes wrong:**
D-07 locked "Closed Deal" to fire on every deal. A student closes 30 deals in a month → coach sees 30 alert badges. Badge count drifts, coach dismisses all 30 in one go, real alerts hide in the noise. The 100hr milestone alert (260401-cwd) never had this problem because it's a one-shot threshold.

**Why it happens:**
"Every deal" without a dedup key means each `deals` row generates a distinct notification. The existing alert_dismissals key scheme (`100h_milestone:{student_id}`) collapses multiple notifications into one.

**How to avoid:**
Key each Closed Deal notification by `deal_id`: `closed_deal:{deal_id}`. This lets coaches dismiss individual ones. Add a coach-level "Dismiss all closed-deal alerts for this student" bulk action in Phase 52 (Coach Alerts UI). For the sidebar badge count, display `min(count, 9)` with `9+` convention — standard mobile UX. Document in D-07 companion note.

If noise proves problematic in UAT, fallback: digest mode = one notification per (student, day) aggregating that day's deals ("Closed 3 deals today"). Keep this as a Phase 52 tune-knob, not a launch blocker.

**Warning signs:**
- Coach dismisses 10+ badges in a single session
- Sidebar badge shows "47"
- UAT feedback: "I stopped clicking the bell"

**Phase to address:** Phase 51 for per-deal key design; Phase 52 (Coach Alerts UI) for bulk-dismiss + 9+ badge cap.

---

### Pitfall 7: deal_number race condition on concurrent coach + student insert (Feat 4)

**What goes wrong:**
If `deal_number` is generated via `MAX(deal_number) + 1` subquery in a trigger or in application code, two concurrent inserts for the same student (coach logging + student logging at the same moment) can both read `MAX = 5` and both insert `6`. Unique index (if it exists) throws 23505 on the second; if no unique index, you get two deals with `deal_number = 6`.

**Why it happens:**
Existing deals infrastructure (Phase 40–43) assumed single-writer: the student. `logged_by` (D-09) introduces a second writer path. `deal_number` wasn't designed for concurrent writers. The race is narrow but real given 5k concurrent students (D-05).

**How to avoid:**
One of:
1. **Trigger-based with `FOR UPDATE` lock** on the student row: `SELECT ... FROM deals WHERE student_id = NEW.student_id FOR UPDATE; NEW.deal_number := COALESCE(MAX(...), 0) + 1;` — serializes per-student inserts.
2. **Per-student sequence** (less clean in Postgres but rock-solid): `CREATE SEQUENCE deals_student_<id>_seq` — dynamic sequences are fragile, not recommended.
3. **Composite unique index** `(student_id, deal_number)` + retry on 23505 in the route handler (simple, battle-tested; already a pattern in Phase 28 daily_plans idempotent 23505 handling per STATE.md).

Recommend option 3 paired with existing trigger. Ship the unique index in the same migration as `logged_by`. Wrap the route handler insert in a retry loop (max 3 attempts) that handles `23505` specifically for `deals_student_id_deal_number_key`.

**Warning signs:**
- Two deals with the same (student_id, deal_number) appear in the `deals` table
- Occasional 500 errors on high-volume deal insert
- `deal_number` jumps (7, 8, 10) — trigger skipped a value due to failed insert (acceptable)

**Phase to address:** Phase 48 (Coach-Logged Deals — RLS & Route) must include the unique index migration and retry logic.

---

### Pitfall 8: Stat-card fan-out (Feat 2) — N RPC calls for N cards

**What goes wrong:**
Coach dashboard has ~4 stat cards (deals closed, revenue, avg roadmap step, total emails) + 3 recent reports + top-3 leaderboard. Naïve implementation = 7+ parallel RPC calls. At 5k concurrent coaches hitting their dashboards, that's 35k+ RPC invocations. `unstable_cache` (D-02) helps but the thundering-herd on cold cache misses spikes Pro Small.

**Why it happens:**
It feels cleaner to have one RPC per card. Easier to reason about. Easier to test. Easier to cache-invalidate selectively.

**How to avoid:**
Follow v1.2 Phase 20 consolidation pattern: single RPC `get_coach_dashboard(p_coach_id, p_today)` returns JSONB with all 7 sub-results. Wrap the whole thing in `unstable_cache({ tags: ['coach-dashboard-' + coach_id], revalidate: 60 })` per D-02. Per-card caches are strictly worse because they multiply cache misses.

On the write side: revalidate the consolidated tag from `POST /api/deals`, `POST /api/daily-reports`, `POST /api/roadmap-progress` — everything that could shift any of the 7 sub-results. Exactly as v1.2 Phase 20 did for `owner-overview`.

**Warning signs:**
- Dashboard page has >3 `await Promise.all([...])` RPCs
- Each card has its own `unstable_cache` wrapper
- Page waterfall in DevTools shows sequential RPCs (not parallel — but parallel of 7 is still bad)

**Phase to address:** Phase 46 (Coach Dashboard Homepage Stats).

---

### Pitfall 9: Cache stale after mutation (Feat 1, Feat 2, Feat 3)

**What goes wrong:**
Student submits a daily report or closes a deal. Student analytics page (cached 60s per D-02) still shows pre-submission numbers. Coach dashboard shows stale stats for 60s. Worse: coach logs a deal → Student's dashboard shows it only after 60s.

**Why it happens:**
`unstable_cache` is keyed by args but TTL-only invalidation means writes don't proactively invalidate. The existing project already solves this pattern with `revalidateTag` (see Phase 20/21 writeups), but it's easy to forget to add the right tag from the right route.

**How to avoid:**
Every mutation route that touches deals, sessions, reports, or roadmap_progress MUST call `revalidateTag` for:
- `student-analytics-${student_id}` (Feat 1)
- `coach-dashboard-${coach_id}` (Feat 2) — look up the student's `coach_id` from `users`
- `coach-analytics-${coach_id}` (Feat 3)

Follow the pattern already in `/api/deals/[id]/route.ts` line 126: `revalidateTag(\`deals-${profile.id}\`, "default")`. Extend to the 3 new tags above in Phase 45/46/47.

Make this a hard review criterion: any new mutation route without `revalidateTag` fails phase UAT.

**Warning signs:**
- "I just submitted this, why doesn't it show?" in UAT
- Cache tags in route handlers don't match tags in server components
- Revalidate calls missing from `POST /api/deals` once coach logging lands

**Phase to address:** Phase 45, 46, 47, 48 — each analytics phase owns its tags; each mutation phase owns its revalidate calls.

---

### Pitfall 10: Sort/pagination parameter injection (Feat 3)

**What goes wrong:**
Full coach analytics has paginated tables (D-04: >25 items). Naïve implementation accepts `?sort=name&order=asc` and interpolates: `.order(searchParams.sort, { ascending: searchParams.order === 'asc' })`. An attacker passes `?sort=email` (not in allowlist) — leaks data in sort order that wasn't meant to be visible. Worse with RPC: raw string concat into `ORDER BY` causes SQL injection.

**Why it happens:**
Supabase JS client's `.order()` only protects against column-doesn't-exist, not against "you shouldn't sort by that." Zod schemas often validate body but not query params.

**How to avoid:**
Define an enum of valid sort keys in config.ts: `COACH_ANALYTICS_SORT_KEYS = ['name', 'deals', 'revenue', 'last_active']` and validate `searchParams.sort` with `z.enum(COACH_ANALYTICS_SORT_KEYS)`. Default to `'name'` on parse failure. Apply same to `order` (`z.enum(['asc', 'desc'])`), `page` (`z.coerce.number().int().min(1).max(1000)`), and `page_size` (fixed or capped). Same pattern already used in owner routes — verify and replicate.

**Warning signs:**
- `.order(searchParams.get('sort'))` without validation
- No Zod schema for query params
- RPC with string concat building `ORDER BY`

**Phase to address:** Phase 47 (Coach Analytics Full).

---

### Pitfall 11: "Active vs inactive" definition drift (Feat 3)

**What goes wrong:**
Coach analytics shows "Active: 12 / Inactive: 8". Student analytics calls them "active" based on last session. Skip tracker (v1.4 D-01) uses reports. Owner alerts use another threshold. Four definitions for the same concept; coaches ask "which is right?" No answer.

**Why it happens:**
Each feature defines its own threshold ad-hoc. `daysSinceLastReport > 7` in one place, `daysSinceLastSession > 5` in another. No shared constant.

**How to avoid:**
Add `ACTIVITY = { inactiveAfterDays: 7, signals: ['reports', 'sessions'] as const }` to config.ts before Phase 47 ships. Single RPC helper `student_activity_status(student_id, p_today)` returns `'active' | 'inactive' | 'at_risk'` used by all surfaces. Document the definition in a short inline comment on the config block so future phases don't diverge.

**Warning signs:**
- Two different "active/inactive" counts on two pages for the same coach
- Activity threshold number hardcoded in >1 file
- UAT feedback: "Owner says I have 10 active students, coach dashboard says 12"

**Phase to address:** Phase 44 (Analytics RPC Foundation) — define `student_activity_status` alongside timezone helpers.

---

### Pitfall 12: Accessibility failures in charts (Feat 1, Feat 2, Feat 3)

**What goes wrong:**
recharts default output: decorative SVG with color-only distinctions (green vs red for up/down trend), no `aria-label`, no keyboard navigation, no tabular fallback. Platform claims accessibility (CLAUDE.md hard rule #3) but charts are black holes for screen readers. Red/green line chart fails WCAG for colorblind users.

**Why it happens:**
recharts and all chart libs default to pure visual output. Accessibility is a library-consumer responsibility.

**How to avoid:**
For every chart component:
1. Wrapping `<div role="img" aria-label="Outreach trend: 45 emails this week, up from 30 last week">` with a prose summary of the data.
2. Below the chart, render a `<details><summary>View data table</summary><table>...</table></details>` with the same raw data. Screen reader users and colorblind users both get equivalent content.
3. Never rely on color alone — use shape (dashed vs solid) or direct labels.
4. Chart container is focusable (`tabIndex={0}`) with a focus ring.
5. Combine with the CLAUDE.md hard rules: `motion-safe:` on any entrance animation (rule #1), `aria-hidden="true"` on decorative icons, ima-* tokens only.

Add this to Phase 45 as a pattern template so Phases 46/47 copy it.

**Warning signs:**
- `<ResponsiveContainer>` with no wrapping `aria-label`
- Tooltip content not announced (no `aria-live`)
- Chart has no tabular fallback
- Red-up / green-down without a second visual cue

**Phase to address:** Phase 45 (Student Analytics Page) establishes the pattern; Phase 46/47 reuse.

---

### Pitfall 13: Milestone compute in the page render (Feat 5) — page blows up

**What goes wrong:**
Coach dashboard loads → server component runs `for (student of assignedStudents) { computeMilestones(student) }` = 4 milestone checks × 50 students = 200 queries per page load. At 100 concurrent coaches refreshing their dashboard = 20k queries. Pro Small connection pool saturates.

**Why it happens:**
Logical place to "just check milestones on load." The 260401-cwd pattern worked because it was a single threshold (100h total) per student, and the compute was cheap.

**How to avoid:**
Move milestone computation to the nightly `pg_cron` job that already runs for `student_kpi_summaries` (Phase 21). Output: a `notifications` table (or extend `alert_dismissals` if keys are orthogonal — decide in Phase 51). Page render does one cheap SELECT instead of N computed checks. Cross-reference D-08: "reuse 260401-cwd pattern" — that pattern is already compute-at-render but for a smaller domain (1 milestone, window of 45 days). For 4 milestones, scale changes; pre-compute.

If real-time badge is required (e.g., coach wants to see the alert within seconds of the student's 5th influencer close), add an INSERT-triggered compute on the affected milestone only, keyed by student_id. Don't recompute the whole world.

**Warning signs:**
- Coach dashboard load time > 500ms
- `EXPLAIN ANALYZE` shows N+1 in milestone path
- Pro Small CPU spikes at morning peak

**Phase to address:** Phase 51 (Milestone Compute). Nightly pg_cron block appended to the migration; event-triggered block appended to `/api/deals POST` and `/api/roadmap-progress POST`.

---

### Pitfall 14: Broadcasting stat-card recomputes to all assigned students (Feat 2)

**What goes wrong:**
Coach has 50 students. Dashboard stats card "deals closed this week" aggregates across all 50. Implementation: `.from("deals").select("*").in("student_id", [50 ids])` — pulls all deals rows to JS. Or worse: loops per student. At 5k concurrent coaches = 250k deal rows streamed. This is Pitfall 1 applied to stat cards specifically.

**Why it happens:**
Stat cards feel trivial ("just count deals") so devs skip the RPC discipline.

**How to avoid:**
`get_coach_dashboard(p_coach_id, p_today)` RPC (see Pitfall 8) returns all 7 stat values pre-aggregated. No row-pulls at the page layer. RPC uses indexed queries: `SUM(revenue)` from `deals` joined on `users.coach_id = p_coach_id` — evaluates in Postgres, returns one scalar per stat.

Ensure index on `users.coach_id` exists (Phase 19 should have covered this — verify). If not, add in Phase 46 migration.

**Warning signs:**
- `.in("student_id", [...])` with array of >10 ids in any dashboard code
- Stat card page waterfall shows multiple RPC calls
- Index on `users.coach_id` missing (check `supabase/migrations/00009_database_foundation.sql`)

**Phase to address:** Phase 46 (Coach Dashboard Homepage Stats) + verify Phase 19 index exists during Phase 44.

---

### Pitfall 15: Mon–Sun boundary ambiguity on leaderboards (Feat 2)

**What goes wrong:**
Top-3 leaderboard (D-13) resets Mon–Sun. Sunday 23:59 Michael has 20h, is #1. Monday 00:01 leaderboard shows empty — correct but jarring. Worse: session started Sunday 23:45, completed Monday 00:15 → which week owns the 30 minutes? Sessions logged in the wrong bucket → leaderboard controversy ("I was #1 on Sunday, how am I #4 on Monday?").

**Why it happens:**
`date_trunc('week', completed_at)` buckets by session END time by default. Sessions that span midnight are ambiguous.

**How to avoid:**
1. Lock session attribution to `started_at` (not `completed_at`). A session started Sunday belongs to last week's leaderboard even if it ends Monday. Document this in the RPC comment and in config.ts.
2. Add a "Week ending YYYY-MM-DD" caption above the leaderboard component so the boundary is visible.
3. On Monday morning, show a "Last week's winner: Michael (20h)" banner for the first 48 hours — softens the reset psychologically.
4. Ensure skip tracker (v1.4 D-01) and this leaderboard use the SAME `week_start(p_today)` helper function.

**Warning signs:**
- Leaderboard RPC uses `completed_at` instead of `started_at`
- Skip tracker and leaderboard code define `weekStart` separately
- UAT feedback: "My hours disappeared after midnight Sunday"

**Phase to address:** Phase 44 (Analytics RPC Foundation) for the shared `week_start` helper; Phase 46 for the Mon-morning banner.

---

### Pitfall 16: `logged_by` NULL interpretation drift (Feat 4)

**What goes wrong:**
D-09 locks: null = student self-logged, set = coach/owner logged. But the `deals` table already has rows from Phase 41/42/43 where `logged_by` column didn't exist — after migration those rows will have `NULL`. Code that says "if (logged_by === null) show student as logger" is technically correct but misleading for pre-migration rows. Then a coach edits an old deal post-migration — should `logged_by` update? If it does, history rewrites. If it doesn't, UI is inconsistent.

**Why it happens:**
Retroactive schema change. NULL has no temporal anchor.

**How to avoid:**
1. In the migration that adds `logged_by`, backfill explicitly: `UPDATE deals SET logged_by = student_id WHERE logged_by IS NULL;` — now NULL means "unknown" (forbidden going forward) and every row has a real UUID.
2. Add `NOT NULL` constraint after backfill.
3. Edits do NOT update `logged_by` (edits update `revenue` / `profit` only — existing `/api/deals/[id]` PATCH already scopes to these two fields per line 26-33).
4. Consider adding `edited_by` + `edited_at` in Phase 48 if audit trail is needed — ask Abu Lahya; default NO for v1.5.
5. UI display: when `logged_by !== student_id`, show "Logged by Coach [name]" subtitle. When equal, no subtitle.

**Warning signs:**
- `logged_by` column nullable after migration
- Code branches on `logged_by === null`
- Editing a deal changes `logged_by`
- UAT: "Why does it say Logged by Me on a deal my coach created?"

**Phase to address:** Phase 48 (Coach-Logged Deals) — migration must backfill + NOT NULL in a single transaction.

---

### Pitfall 17: UI attribution privacy (Feat 4)

**What goes wrong:**
Student sees their own deals list. Each deal shows "Logged by Coach Ibrahim." Student says "I logged this one, not Coach Ibrahim." Or a coach dashboard shows deals but the attribution column leaks which coach logged for which student — cross-coach visibility concern if later an owner scopes access differently.

**Why it happens:**
Attribution indicator (from requirements) is visible by default. No role-gated display.

**How to avoid:**
1. Student's own view: show "Logged by you" when `logged_by === student_id`, "Logged by your coach" (no name) when `logged_by === coach_id`. Never expose owner/other-coach names.
2. Coach's view of own assigned students: show "Logged by {coach_name}" or "Logged by student" — full transparency within scope.
3. Owner view: full name visible (owner has visibility to everything).
4. Encapsulate in a single helper `formatDealLoggedBy(deal, viewerRole, viewerId)` and reuse.

**Warning signs:**
- Student page shows any coach's full name or email
- Different attribution strings in different components — prone to drift

**Phase to address:** Phase 49 (Coach Deals UI Logging — Add Button + Attribution).

---

### Pitfall 18: Config drift for milestones across 3 role views (Feat 5)

**What goes wrong:**
Add milestone "5 Influencers Closed" → coach sees it, owner doesn't, admin tools don't know about it. Or: add a 5th milestone later, half the UI shows 5, the other half still shows 4.

**Why it happens:**
Three dashboards (owner / coach / student_detail), each written separately, each has its own copy of milestone labels/icons.

**How to avoid:**
Add `MILESTONES` to config.ts as the single source of truth (CLAUDE.md rule #1) with entries keyed by milestone type, each carrying `label`, `icon`, `stepRef`, and (for closed_deal) an `everyDeal: true` flag. All 3 role views import from this constant. Adding a milestone later = one config edit.

Also note D-06 blocker (STATE.md): Tech/Email Setup step is TBC pending Monday stakeholder meeting — wire the config entry with a `TODO:` comment and gate the feature behind a flag until Abu Lahya confirms.

**Warning signs:**
- Milestone label appears as a string literal in any component
- Adding a milestone requires editing >1 file beyond config.ts and the migration
- Owner view has 4 milestones, coach view has 3

**Phase to address:** Phase 50 (Milestone Config — pre-work before Phase 51 compute).

---

### Pitfall 19: RLS policy drift — new policies silently contradict existing (Feat 4, Feat 5)

**What goes wrong:**
Phase 48 migration adds INSERT policy on `deals` for coaches. Existing Phase 39/40 SELECT policy on `deals` is stricter (e.g., coach can only select where `student.coach_id = coach.id`). New policy accidentally broader: `USING (auth.uid() IS NOT NULL)` — any authenticated user can insert deals for any student. No query returns rows proving the leak because SELECT policy still restricts reads — but the write path is open.

**Why it happens:**
Supabase RLS policies are additive: multiple policies for the same operation compose via OR. New policy that says "coaches can INSERT" without asserting coach-student relationship becomes a bypass.

**How to avoid:**
1. Every new RLS migration must include a checklist comment: "Policies added: X. Policies not modified: Y. Checked OR composition: Z."
2. Use the `(SELECT auth.uid())` initplan pattern (D-03) — faster AND clearer intent than raw `auth.uid()` per row.
3. Run `pg_policies` diff after migration: `SELECT * FROM pg_policies WHERE tablename = 'deals';` before and after, pasted into the phase verification doc.
4. Add a concrete RLS test in the phase UAT: "Coach A cannot insert deal for student assigned to Coach B" — same as Pitfall 4.

**Warning signs:**
- New RLS policy uses `USING (true)` or `USING (auth.uid() IS NOT NULL)` without additional `WITH CHECK`
- Migration doesn't paste `pg_policies` diff in the verification doc
- No negative-case test in UAT

**Phase to address:** Phase 48 (coach deal INSERT) and Phase 51 (notification RLS).

---

### Pitfall 20: Breaking `student_kpi_summaries` schema (Integration)

**What goes wrong:**
v1.5 adds milestone computation. It's tempting to add `milestone_tech_setup_at`, `milestone_5_influencers_at`, etc. columns to `student_kpi_summaries` (Phase 21) to piggyback on the nightly pg_cron refresh. Any column added without updating the refresh function silently fails to populate; worse: adding columns that the refresh overwrites to NULL wipes other features' pre-aggregations.

**Why it happens:**
Pre-aggregation tables accrue fields over time. The refresh function is already ~100 lines; adding columns safely requires reading and updating the function body.

**How to avoid:**
1. Milestones go in a **separate** table (`milestone_achievements` or extend `alert_dismissals`). Do not modify `student_kpi_summaries` schema.
2. If modification is truly necessary, the migration MUST update `refresh_student_kpi_summaries()` in the same commit. Leave a comment at the top of the function: "Adding columns here without updating this function will silently fail."
3. Phase verification checklist item: "No schema change to `student_kpi_summaries`" OR "refresh function updated in the same migration."

**Warning signs:**
- Migration alters `student_kpi_summaries` without touching refresh function
- New column on `student_kpi_summaries` shows NULL for all rows after nightly cron
- Phase 21 helpers break because expected column is missing

**Phase to address:** Phase 51 (Milestone Compute) — explicit "do not touch student_kpi_summaries" decision.

---

### Pitfall 21: Notification count badge drift (computed vs stored) (Feat 5)

**What goes wrong:**
Sidebar badge count uses `get_sidebar_badges` RPC (existing from Phase 20). Coach alerts page uses a different query. Two sources of truth diverge: badge says 3, page shows 5. Coach loses trust.

**Why it happens:**
`get_sidebar_badges` was designed for lightweight badge-only response. The full alerts page fetches with more fields. Easy to compute count differently in the two places.

**How to avoid:**
Derive both the sidebar count and the page list from the SAME RPC (or same base query). Page calls `get_coach_alerts_full(p_coach_id, p_today)` → response includes `{ alerts: [...], total_count: N }`. Sidebar calls `get_sidebar_badges(p_user_id)` which internally calls (or duplicates the same WHERE clause as) `get_coach_alerts_full` and returns just `N`. Refactor `get_sidebar_badges` in Phase 51 so its coach block points to the same source.

Unit test: for a known fixture, assert sidebar N equals page list length.

**Warning signs:**
- Badge says one number, page shows different count
- Two different WHERE clauses in two different RPCs for the same concept
- UAT "the 3 in the badge doesn't match the 5 alerts on the page"

**Phase to address:** Phase 51 (Milestone Compute) — refactor `get_sidebar_badges` coach block to single source.

---

### Pitfall 22: Student deletion leaves orphan notifications (Feat 5)

**What goes wrong:**
Owner removes a student (e.g., dropped out). `alert_dismissals` rows with `key = 'milestone:closed_deal:{deleted_student_id}:{deal_id}'` persist. Sidebar badge count keeps them, but the student no longer exists — clicking the alert 404s.

**Why it happens:**
No ON DELETE CASCADE on `alert_dismissals.owner_id` or equivalent student FK in the notification table.

**How to avoid:**
1. Add `ON DELETE CASCADE` to any new notification table FK pointing to `users`. Check `alert_dismissals` current setup in Phase 26 migration — extend if missing.
2. Defensive query: page load filters out alerts where the referenced student no longer exists (JOIN + IS NOT NULL check).
3. Nightly pg_cron cleanup job: delete notification rows orphaned by student removal.

**Warning signs:**
- Sidebar count includes alerts for deleted students
- Clicking an alert leads to 404
- No CASCADE on the notification table migration

**Phase to address:** Phase 51 migration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Client-side aggregation in a chart component | Faster dev, no RPC to write | Breaks at 5k students (Pitfall 1, contradicts D-01) | Never in v1.5 |
| Per-card RPC for the coach dashboard | Easy to reason about, easy to test | Fan-out latency; cache misses multiply (Pitfall 8) | Only if consolidation RPC exceeds 200ms p95 — unlikely |
| Nullable `logged_by` without backfill | Skip data migration | Ongoing NULL interpretation ambiguity (Pitfall 16) | Never |
| "Just check milestones on page load" | Ship Feat 5 faster | Query storm at 100 concurrent coaches (Pitfall 13) | Never for v1.5 scale |
| Hardcode milestone labels in components | Shipping UI first | Adding a 5th milestone = edits in 3+ files (Pitfall 18) | Never — violates CLAUDE.md rule #1 |
| Skip unique index on (student_id, deal_number) | Migration simpler | Concurrent insert race (Pitfall 7) | Never |
| One milestone notification key across coach reassignment | Fewer alert_dismissals rows | Re-fires on reassignment (Pitfall 5) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS INSERT policy | `USING (true)` or role-only check | Use `(SELECT auth.uid())` initplan + explicit student-coach relationship check (Pitfall 4, 19) |
| Postgres `date_trunc('week')` | Session timezone used, defaults to UTC on Supabase | Pass `p_today` from app layer, never use `now()` inside function (Pitfall 3) |
| recharts + RSC | SSR renders wrong SVG size | Wrap chart in `"use client"` component, lazy-load with `next/dynamic ssr:false` (Pitfall 2) |
| `unstable_cache` + mutations | TTL-only invalidation | Explicit `revalidateTag(...)` in every mutation route that touches the cached data (Pitfall 9) |
| Supabase query params | `.order(searchParams.sort)` without validation | Zod enum of valid sort keys; default on parse failure (Pitfall 10) |
| pg_cron nightly refresh | Add column without updating refresh function | Update function body in same migration, or use separate table (Pitfall 20) |
| Supabase `.from()` in server code | Rely on RLS alone | Filter by user ID AND rely on RLS (defense in depth — CLAUDE.md "Filter by user ID in queries") |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Row-pull analytics | High egress, slow server components | RPC-only aggregation (D-01) | ~500 concurrent students |
| Stat-card fan-out | Many small RPC calls | Single consolidated RPC (Pitfall 8) | ~1k concurrent coaches |
| Milestone compute at page load | Load time > 500ms | Pre-compute via pg_cron or event trigger (Pitfall 13) | ~100 concurrent coaches |
| Missing `coach_id` index | Sequential scan on `users` | Verify Phase 19 covers; add if missing (Pitfall 14) | ~1k students |
| Missing `(student_id, completed_at)` composite index on `work_sessions` | Analytics RPC slow | Add in Phase 44 migration alongside RPCs | ~500 students × 30 days |
| N+1 in per-student trend | Loop over students inside server code | Single RPC returns grouped result (Pitfall 1) | ~50 students per coach |
| Chart hydration retry | Dev console flooded, client CPU spike | Client-only chart mount (Pitfall 2) | Always, post-launch |
| Stale cache after write | 60s of visual lag | revalidateTag from every mutation route (Pitfall 9) | Always — UX issue not perf |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Coach inserts deal for non-assigned student | Revenue attribution pollution; privileged escalation within coach role | Dual-layer check: route handler + RLS WITH CHECK (Pitfall 4) |
| Sort param injection on analytics | Information leak through sort ordering; SQL injection if raw | Zod enum validation on sort/order/page (Pitfall 10) |
| Student sees other coach names via logged_by | PII leak within platform | Role-gated attribution formatter (Pitfall 17) |
| RLS policy composition accident | Silent broadening of write access | pg_policies diff in verification doc (Pitfall 19) |
| Rate limit per-student when coach logs | One coach can spam 30 req/min for each of N students | Ensure `checkRateLimit(profile.id, endpoint)` keys on coach's profile.id, not student — already the pattern in existing routes (verify in Phase 48) |
| Missing CSRF on new mutation routes | Cross-site deal insert | `verifyOrigin()` on every new POST (Phase 48, 49) — existing pattern |
| Orphan notifications after student deletion | Stale UI state, minor info leak via coach alert history | ON DELETE CASCADE (Pitfall 22) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chart with color-only distinction | Colorblind users excluded; fails WCAG | Shape + label + data table fallback (Pitfall 12) |
| Leaderboard resets Mon midnight with no warning | "Where did my hours go?" confusion (Pitfall 15) | "Last week's winner" banner; visible week range caption |
| 50 closed-deal badges flood sidebar (Pitfall 6) | Coach stops trusting badge | Bulk-dismiss + 9+ cap; optional digest mode |
| Stat card not tappable (CLAUDE.md rule #2) | Mobile users can't drill into details | `min-h-[44px] min-w-[44px]` on each card; href or onClick |
| Empty state for coach with 0 students | Coaches in onboarding see scary blank page | EmptyState component with "Invite your first student" CTA — use existing component |
| Stale dashboard for 60s post-report-submit (Pitfall 9) | "I just submitted this!" | revalidateTag on mutation |
| Chart entrance animation without motion-safe wrapper | Vestibular disorder trigger | `motion-safe:animate-*` per CLAUDE.md rule #1 |
| Pagination state only in client (non-shareable URL) | Coach can't bookmark a specific page | URL-based page=N param |
| Over-aggregating daily data into weekly only | Lost signal, can't see day-of-week patterns | Default day granularity, toggle to week |

## "Looks Done But Isn't" Checklist

- [ ] **Student analytics page:** Charts exist, but without `aria-label`, tabular fallback, and `motion-safe:` wrappers — verify all three per chart (Pitfall 12).
- [ ] **Coach dashboard stats:** Stat cards render, but without `min-h-[44px] min-w-[44px]` and without `revalidateTag` hook from `/api/deals` — verify both.
- [ ] **Full coach analytics:** Pagination works, but sort param not Zod-validated — verify enum exists in config.ts (Pitfall 10).
- [ ] **Coach-logged deals:** Add Deal button works, but RLS INSERT policy not asserting coach-student assignment — write negative-case E2E test (Pitfall 4).
- [ ] **Coach-logged deals:** Migration adds `logged_by` column but nullable without backfill — verify `NOT NULL` constraint after backfill (Pitfall 16).
- [ ] **deal_number:** Column exists but no unique index on `(student_id, deal_number)` — verify migration creates index (Pitfall 7).
- [ ] **Milestone notifications:** Alerts appear, but re-fire when student reassigned OR historical backfill double-counts — verify key scheme + pre-dismissal seed (Pitfall 5).
- [ ] **Closed-deal milestone:** Fires every deal per D-07, but sidebar cap missing — verify `9+` render and bulk-dismiss (Pitfall 6).
- [ ] **Milestone config:** MILESTONES constant in config.ts — verify all 3 role views import from it, none hardcode labels (Pitfall 18).
- [ ] **Timezone helper:** `week_start(p_today)` RPC helper exists — verify skip tracker AND leaderboard both use it (Pitfall 3, 15).
- [ ] **Active/inactive:** Single definition in config.ts — verify coach analytics, student analytics, and skip tracker agree (Pitfall 11).
- [ ] **Cache invalidation:** `revalidateTag` call present in `/api/deals` POST for all 3 analytics tags — verify grep (Pitfall 9).
- [ ] **pg_policies diff:** Every migration with new RLS policy has before/after pg_policies output in verification doc (Pitfall 19).
- [ ] **Chart hydration:** Every chart inside `"use client"` + `next/dynamic ssr:false` — verify no SSR errors in dev console (Pitfall 2).
- [ ] **`student_kpi_summaries` untouched:** Migrations for v1.5 do not alter this table's schema (or, if they do, refresh function is updated in same migration) (Pitfall 20).
- [ ] **Tech/Email Setup step:** D-06 resolved and stepRef in MILESTONES config is NOT a TODO placeholder before Feat 5 ships.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Client row-pull shipped (Pitfall 1) | MEDIUM | Add RPC, swap server component; keep client chart code |
| Chart hydration mismatch (Pitfall 2) | LOW | Wrap in client component with `next/dynamic ssr:false`; redeploy |
| Timezone bucketing wrong (Pitfall 3) | LOW | Fix helper, re-run affected analytics queries; no data loss |
| Coach logged unassigned deal (Pitfall 4) | HIGH | Audit `deals` rows where `logged_by`'s coach is not `student.coach_id`, null out or delete; tighten RLS; notify affected coaches |
| Milestone double-fire (Pitfall 5) | MEDIUM | DELETE duplicate alert_dismissals rows; seed dismissals for over-counted students; add key-uniqueness constraint |
| deal_number race (Pitfall 7) | MEDIUM | Add unique index; renumber rows with duplicates by updated_at order; re-test |
| Milestone compute storm (Pitfall 13) | MEDIUM | Move to pg_cron; event-trigger just the affected milestone per write |
| RLS drift silent bypass (Pitfall 19) | HIGH | Audit all writes since drift; tighten policy; notify of any leaked data |
| student_kpi_summaries schema broken (Pitfall 20) | HIGH | Rollback migration; redesign in separate table; re-run nightly cron |
| Orphan notifications (Pitfall 22) | LOW | Add CASCADE, run cleanup migration once |

## Pitfall-to-Phase Mapping

Assumes sequential phase order per D-10: Phase 44 (RPC foundation) → 45 (Student Analytics) → 46 (Coach Dashboard) → 47 (Coach Full Analytics) → 48 (Coach Deals RLS + Route) → 49 (Coach Deals UI) → 50 (Milestone Config) → 51 (Milestone Compute + migration) → 52 (Coach Alerts UI).

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Client row-pulls | Phase 44 (RPC Foundation) | Grep `.from(` in analytics pages returns 0 hits |
| 2. Chart hydration | Phase 45 (Student Analytics) | `next/dynamic ssr:false` in every chart wrapper; dev console clean |
| 3. Timezone drift | Phase 44 (RPC Foundation) | `week_start()` helper RPC defined; no `now()`/`CURRENT_DATE` in function bodies |
| 4. Coach unassigned deal | Phase 48 (Coach Deals RLS) | E2E test: Coach A cannot insert for Coach B's student |
| 5. Notification double-fire | Phase 51 (Milestone Compute) | Unit test: compute runs twice, zero new notifications |
| 6. Closed-deal noise | Phase 51 + 52 | Per-deal key in Phase 51; 9+ cap and bulk-dismiss in Phase 52 |
| 7. deal_number race | Phase 48 migration | Unique index on (student_id, deal_number); retry test |
| 8. Stat-card fan-out | Phase 46 | Single `get_coach_dashboard` RPC; consolidated `unstable_cache` tag |
| 9. Stale cache | Phase 45/46/47/48 mutation routes | `revalidateTag` grep finds call in every POST that touches analytics data |
| 10. Sort param injection | Phase 47 | Zod enum for sort/order in config.ts; safeParse before RPC |
| 11. Active/inactive drift | Phase 44 | `ACTIVITY` config constant + `student_activity_status` RPC |
| 12. Chart a11y | Phase 45 pattern, 46/47 reuse | aria-label + data-table fallback on every chart |
| 13. Milestone compute storm | Phase 51 | pg_cron or event-trigger; no N+1 at page load |
| 14. Stat broadcast row-pull | Phase 46 + verify Phase 19 | `users.coach_id` index confirmed; RPC returns pre-aggregated |
| 15. Mon-Sun boundary | Phase 44 + Phase 46 | Shared `week_start` helper; "Last week's winner" banner |
| 16. logged_by NULL | Phase 48 migration | Backfill + NOT NULL in same transaction |
| 17. UI attribution privacy | Phase 49 | Role-gated `formatDealLoggedBy` helper |
| 18. Milestone config drift | Phase 50 | `MILESTONES` constant in config.ts; grep for hardcoded labels = 0 |
| 19. RLS policy drift | Phase 48, 51 | pg_policies diff pasted into each phase's verification doc |
| 20. KPI summaries schema break | Phase 51 | Decision: separate table for milestones; `student_kpi_summaries` untouched |
| 21. Badge count drift | Phase 51 | Single source for both sidebar and page; fixture test |
| 22. Orphan notifications | Phase 51 migration | ON DELETE CASCADE + cleanup job |

## Sources

- `.planning/PROJECT.md` (v1.5 decisions D-01 through D-13) — HIGH
- `.planning/STATE.md` (accumulated context: Phase 23 ownership leak fix, skip tracker timezone pattern, chat polling rate limit exemption, 260401-cwd coach milestone precedent) — HIGH
- `.planning/quick/260401-cwd-add-coach-notification-for-100-hours-in-/260401-cwd-SUMMARY.md` — HIGH (existing notification pattern to reuse/extend)
- `supabase/migrations/00009–00015` — HIGH (RLS patterns, indexes, v1.4 schema)
- `src/app/api/deals/[id]/route.ts` (existing ownership-scoped update pattern, lines 104–126) — HIGH
- `src/lib/types.ts` lines 662–695 (existing `deals` Row/Insert shape with `deal_number`) — HIGH
- v1.2 Phase 23 Security Audit pattern (CSRF + two-step ownership check) — HIGH
- v1.2 Phase 19 RLS initplan pattern `(SELECT auth.uid())` — HIGH
- v1.2 Phase 20 RPC consolidation pattern — HIGH
- v1.2 Phase 21 pg_cron nightly refresh pattern — HIGH
- CLAUDE.md hard rules (44px, motion-safe, aria-label, admin client, response.ok, Zod import, ima-* tokens) — HIGH

---
*Pitfalls research for: IMA Accelerator v1.5 — Analytics Pages, Coach Dashboard & Deal Logging*
*Researched: 2026-04-13*
