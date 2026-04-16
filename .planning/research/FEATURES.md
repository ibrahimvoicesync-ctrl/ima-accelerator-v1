# Feature Landscape — v1.8 Analytics Expansion, Notification Pruning & DIY Parity

**Domain:** Student performance & coaching platform (Next.js 16 + Supabase + RLS, 4 roles: owner / coach / student / student_diy)
**Researched:** 2026-04-16
**Scope:** Six surgical feature blocks added on top of shipped v1.0–v1.7 — no net-new domains, all additive or targeted breaking changes
**Overall confidence:** HIGH — six blocks each sit adjacent to shipped code paths (Phase 46, 50, 51, 52, 54) which constrain every decision to a narrow design envelope

---

## How to Read This File

Each of the 6 feature blocks in `.planning/PROJECT.md` "Active" list is scored across:

- **Table stakes** — what users *expect* once the feature name is spoken. Omitting any of these makes the feature feel broken.
- **Differentiators** — not expected, but cheap/obvious add-ons that meaningfully improve UX. Build when cost-to-value is clear.
- **Anti-features** — explicit NOT-doing list to prevent scope creep back in. Each anti-feature has a "what to do instead."
- **Complexity** — Low (<½ day code) / Medium (~1 day) / High (>1 day + migration + cache wiring).
- **Dependencies on shipped code** — the concrete files/RPCs/config keys v1.8 must touch.

Opinionated recommendations (F2 zero-student coaches, F3 persistence, F4 tombstone, F6 render strategy) are answered in the "Open UX Questions" section at the end — the feature sections call out the recommendation inline but the rationale lives there.

---

## F1 — Student Analytics: Outreach KPI Relabel + Re-Split

### What it is

Currently the student analytics KPI strip shows "Total Emails" and "Total Influencers", both driven by `data.totals.total_emails` / `total_influencers` from `get_student_analytics`. The DB-side math is wrong: `total_emails = SUM(brands_contacted + influencers_contacted)` and `total_influencers = SUM(influencers_contacted)`, so "Total Emails" double-counts influencer outreach. v1.8 fixes this by:

1. Renaming the cards to "Total Brand Outreach" / "Total Influencer Outreach".
2. Re-splitting the underlying data — brand-outreach is `SUM(brands_contacted)` only (not combined); influencer-outreach stays `SUM(influencers_contacted)`.
3. Shipping a **breaking RPC change** (new migration 00032) that renames `total_emails` → `total_brand_outreach` and `total_influencers` → `total_influencer_outreach` in the JSON payload.
4. Bumping the `unstable_cache` key for `getStudentAnalyticsCached` — stale SSR cache with old shape would crash the page.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Labels match what they count | "Emails" that include non-email outreach is misleading — table stakes of any analytics product | Low | UI-only change in `AnalyticsClient.tsx` line 202–210 |
| Brand outreach and influencer outreach as independent totals | Every outreach dashboard in the IM space (Mailshake, Apollo, Lemlist) separates by outreach type | Low | SQL-level — `SUM(brands_contacted)` and `SUM(influencers_contacted)` already exist as aggregate columns in `work_sessions` + `daily_reports`; just stop adding them together |
| `/student_diy/analytics` renders the NEW KPI cards too | DIY shares the same route file suffix (already the case for viewerRole gating) — different RPC shape would visibly diverge the two pages | Low | `AnalyticsClient.tsx` already hides brand/influencer cards for `viewerRole === "student_diy"` (line 198); v1.8 needs to confirm DIY keeps that hide behavior or shows the renamed cards per stakeholder. **Flag for `/gsd-discuss-phase`.** |
| Breaking RPC change ships with all consumers updated in same migration | Half-shipped renames cause SSR crashes on 60s-cache stale reads | Medium | Migration 00032 must DROP + CREATE FUNCTION in one transaction so no window of mismatched shape; consumers: `student-analytics.ts` fetch + `student-analytics-types.ts` type + `AnalyticsClient.tsx` KPI strip |
| `unstable_cache` key bump | Old cache entries with `total_emails` key still live at TTL rollover — bumping the key forces a miss on first request after deploy | Low | Change key array from `["student-analytics", studentId, range, page]` → `["student-analytics-v2", ...]` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tooltip on each KPI card explaining what's counted | Prevents future "why doesn't this match my report?" support burden that caused the current bug | Low | Add `title="Brands sent this week from daily reports + work sessions"` attribute to card or subtitle below value |
| Backfill validation query in migration that confirms old `total_emails` ≈ `total_brand_outreach + total_influencer_outreach` on rollout | Proves no data loss during the rename | Low | Attach as a comment in the migration with a `SELECT … FROM` query, run manually once |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Keeping the old `total_emails` key as a "compat alias" pointing to the new split | Prolongs the wrong label in the API surface; next developer confuses which is authoritative | Hard cutover in one migration. All consumers in this milestone. |
| Adding a third combined "Total Outreach" card | Was implicitly the point of the old combined number; stakeholder has rejected this framing by requesting the split | Two cards, period. Sum can be computed client-side if ever needed (rare). |
| Changing the trend charts' brand/influencer split | Already correctly split since Phase 46 (line 286–300 of `AnalyticsClient.tsx` — `dataKey="brands"` and `dataKey="influencers"` as separate `<Line>` series) | Leave `outreach_trend` untouched |

### Dependencies on Shipped Code

- `supabase/migrations/0003X_get_student_analytics.sql` (latest version — find via `ls supabase/migrations/` and grep for `get_student_analytics`)
- `src/lib/rpc/student-analytics.ts` (server fetch — contains `unstable_cache` wrapper)
- `src/lib/rpc/student-analytics-types.ts:20-27` (`StudentAnalyticsTotals` type)
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:202-210` (KPI cards)
- `src/app/(dashboard)/student/analytics/page.tsx` + `src/app/(dashboard)/student_diy/analytics/page.tsx` (SSR pages)

**Complexity:** Medium (breaking SQL + type + UI + cache invalidation, but narrow blast radius — single RPC, two pages).

---

## F2 — Owner Analytics: Coach Performance Leaderboards

### What it is

Add three new top-3 coach leaderboards beneath the existing three student leaderboards at `/owner/analytics`:

1. **Total revenue** — sum of `deals.revenue` across all students assigned to this coach.
2. **Avg brand outreach per student per day** — (sum of `brands_contacted` across coach's students over window) ÷ (assigned-student-count × days-in-window). Reconfirmation of metric #2 semantics is a flagged ambiguity in PROJECT.md.
3. **Total deals** — count of deals across all students assigned to this coach.

Only active coaches with ≥1 assigned student are eligible. Tie-break pattern matches Phase 54: `metric DESC, LOWER(name) ASC, id::text ASC`.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Same visual shape as existing student leaderboards | Six leaderboards in a grid should be visually indistinguishable except for content | Low | Reuse `LeaderboardCard` component verbatim; just pass `hrefPrefix="/owner/coaches/"` … except coach detail page doesn't exist (see Anti-Features). **`hrefPrefix` for coach rows = `null` — rows render as non-link static rank+name+metric** |
| Metric is "per student per day" not raw totals for #2 | Absolute brand-outreach counts penalize coaches with fewer students; normalizing is the only fair comparison | Medium | SQL: `SUM(brands) / (count_assigned_students * days_in_window)` — must avoid divide-by-zero |
| Active coaches only, exclude coaches with zero assigned students | Zero-student coaches on the leaderboard are literal noise (see Open UX Question F2) | Low | `WHERE role='coach' AND status='active' AND EXISTS (SELECT 1 FROM users WHERE coach_id = coaches.id AND role='student' AND status='active')` |
| Same tie-break as Phase 54 | Deterministic order across refreshes — stakeholder noticed if tie-break differs between sections | Low | `ORDER BY metric DESC, LOWER(name) ASC, id::text ASC` |
| Ship in single `get_owner_analytics` RPC | Already exists, already cached — splitting into two RPCs doubles cache coordination and mutations | Medium | Expand `OwnerAnalyticsPayload` with `coach_leaderboards: { revenue: [], avg_outreach: [], deals: [] }` — mirror the `leaderboards: { hours_alltime, profit_alltime, deals_alltime }` shape |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coach leaderboard subheadings explain how assignment is determined | Owner may forget students can be reassigned; subheading "Based on currently-assigned students" sets expectation | Low | Pass to `LeaderboardCard.subheading` prop |
| Zero-coach empty state distinct from no-deals empty state | "No coaches with assigned students yet" is different from "no deals logged yet" — gives owner actionable hint ("go assign students to coaches") | Low | Conditional `EmptyState` body in the new section wrapper |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Linking coach rows to `/owner/coaches/[id]` | Coach detail page does NOT exist in v1.0–v1.7 and is explicitly out of scope in PROJECT.md | Render rows as non-interactive `<li>` with rank + name + metric. No `<Link>`. |
| Including coaches with zero assigned students "with N/A" | Clutters the top-3 ranking, invites "what does N/A mean?" questions | Exclude at SQL level (`EXISTS` clause) |
| Promoting coach leaderboards to the owner homepage teaser | PROJECT.md explicitly says "Owner homepage teaser stays student-only" | Leave `/owner` dashboard homepage untouched |
| Deriving "assigned students" from a snapshot at deal-close time | Leaderboard should reflect CURRENT assignments; historical snapshot is a V2+ feature | Join `users u ON u.id = deals.student_id` then `WHERE u.coach_id = coach.id` at query time |
| Separate `get_owner_coach_analytics` RPC | Two RPCs = two cache tags = easier to let them drift. Existing `ownerAnalyticsTag()` already invalidates on deal/work-session mutations | Expand the existing RPC |

### Dependencies on Shipped Code

- `supabase/migrations/00028_get_owner_analytics.sql` (existing RPC — needs breaking expansion)
- `src/lib/rpc/owner-analytics.ts` + `src/lib/rpc/owner-analytics-types.ts` (add coach leaderboard types)
- `src/app/(dashboard)/owner/analytics/page.tsx` (add 3 new `LeaderboardCard` instances)
- `src/components/analytics/LeaderboardCard.tsx` (likely needs optional `hrefPrefix: string | null` to skip the `<Link>` wrap)
- `ownerAnalyticsTag()` cache key — already invalidated by deal mutations; need to confirm work-session mutations also invalidate (they do, per Phase 54 wiring)

**Complexity:** Medium-High (new SQL aggregation with `EXISTS` exclusion + per-student-per-day normalization + expanding RPC payload shape + cache key unchanged since same RPC).

---

## F3 — Per-Leaderboard Weekly/Monthly/Yearly/All-Time Window Selector

### What it is

Each of the 6 leaderboards (3 student + 3 coach) gets an independent client-side window toggle: **Weekly** (7d) / **Monthly** (30d) / **Yearly** (365d) / **All Time**. The single `get_owner_analytics` RPC pre-computes all 24 slots (6 leaderboards × 4 windows) in one batch query; the client just flips between pre-computed lists without re-fetching. Default is "All Time" (matches today's behavior).

Trailing N-day semantics (recommended per PROJECT.md Ambiguity §2): "Weekly" = last 7 days ending today, not ISO calendar week. Keeps the SQL `WHERE date >= CURRENT_DATE - INTERVAL '7 days'` simple.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Four-window toggle: Weekly / Monthly / Yearly / All Time | Standard analytics vocabulary — users expect at least this granularity. Shipped student analytics uses 7d/30d/90d/all (see `STUDENT_ANALYTICS_RANGES` in `student-analytics-types.ts:13`) | Low | Mirror existing `RangeSelector` accessibility pattern: `role="group" aria-label="Select time range"`, `aria-pressed`, `min-h-[44px] min-w-[60px]` buttons |
| Single RPC returns all 24 slots | Phase 54 established "cache the whole page, invalidate on mutations" — re-fetching on each toggle would break that model and hit the DB 6× per interaction | High (SQL) | RPC returns `{ student_leaderboards: { hours: { weekly:[], monthly:[], yearly:[], alltime:[] }, profit: {...}, deals: {...} }, coach_leaderboards: {...} }` — 24 lists total, each top-3 |
| Toggle is pure client state | No URL param, no refetch — PROJECT.md calls this out explicitly. Matches Phase 46's `useTransition` + URL navigation pattern for student analytics but v1.8 is simpler because no new data is fetched | Low | `useState<Window>('alltime')` per leaderboard; switch statement maps window → which pre-computed slot to render |
| Default "All Time" | Matches current behavior; users' first landing impression stays stable | Low | `useState<Window>('alltime')` — not `useState<Window>('weekly')` |
| Accessibility: `role="radiogroup"` OR `<fieldset><legend>` | Four mutually-exclusive choices is a radio group, not a button group. Screen readers announce "1 of 4 selected" instead of individual toggle states | Low | Existing `RangeSelector` in `AnalyticsClient.tsx:601` uses `role="group"` with `aria-pressed` — acceptable but PROJECT.md constraints explicitly suggest `role="radiogroup"` |
| 44px touch targets | CLAUDE.md Hard Rule #2; existing `RangeSelector` already complies (`min-h-[44px] min-w-[60px]`) | Low | Reuse pattern |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Persist selection across navigation via URL query params | `?hours=weekly&profit=yearly` survives reload, shareable links | Medium | Breaks "pure client state" constraint — **not recommended** for v1.8 given the scope of the milestone. Reconsider if user feedback complains. |
| Visual dash-indicator showing data recency ("last updated 42s ago") | Users quickly notice stale cache after a mutation if the indicator drifts | Low | Pull `new Date()` at RPC time, render client-side with `Intl.RelativeTimeFormat`. Nice-to-have, not table stakes. |
| Window-specific empty-state copy | "No hours logged this week" vs "No hours logged yet" — tiny but delightful | Low | Switch in `LeaderboardCard.emptyBody` |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| localStorage persistence | **Opinionated NO.** See Open UX Question F3 — violates "pure client state" PROJECT.md constraint, complicates SSR hydration, and the recovery cost of a reset-on-reload is ~1 click. Each page load is a fresh analytical session — "all time" is a sensible default | Let it reset to default on each visit. If user demands persistence, URL query params are the better tool |
| Per-leaderboard refetch on toggle | Breaks `unstable_cache` model, hits DB 6× more than needed | Pre-compute all 24 slots server-side |
| Arbitrary custom date range picker | Scope creep; 4 windows cover 95% of use cases; custom ranges need a date picker, a backend validator, and a whole new empty-state taxonomy | Hard 4-option toggle |
| Calendar-aligned weeks/months/years (ISO week, calendar month, calendar year) | Edge-case semantics: "Why did my weekly count drop on Monday morning?" 90% of users mean "last 7 days" when they say "weekly" | **Trailing N-days per PROJECT.md Ambiguity §2** |
| Different default per leaderboard (e.g. hours=weekly, profit=alltime) | Inconsistency is worse than any individual default; causes "why did this one reset and that one didn't?" confusion | Same default ("all time") across all 6 |

### Dependencies on Shipped Code

- `get_owner_analytics` SQL RPC (breaking shape change — 24× the data volume per call, still small since each list is top-3 = ≤72 rows across all 24 slots)
- `src/lib/rpc/owner-analytics-types.ts` (new `OwnerAnalyticsWindow = "weekly" | "monthly" | "yearly" | "alltime"` type + expanded `leaderboards` shape)
- `src/app/(dashboard)/owner/analytics/page.tsx` must become a client boundary for the 6 window-state hooks OR split into a new client component `OwnerAnalyticsClient.tsx` (recommended — keeps `page.tsx` as pure server component fetching the RPC once)
- `ownerAnalyticsTag()` cache — unchanged; all 24 slots invalidate together

**Complexity:** High (SQL aggregation × 24 slots with 4 different window filters + new client component + cache shape change). Biggest engineering block in v1.8.

---

## F4 — Owner Alerts: Prune to `deal_closed` Only

### What it is

Today `/owner/alerts` shows 4 alert types: `student_inactive`, `student_dropoff`, `unreviewed_reports`, `coach_underperforming`. v1.8 removes all four and replaces them with a single new type: `deal_closed` — one info alert per closed deal. Title = student name. Message = "Closed a $X,XXX deal." Severity = `info` or `success` (recommend `success` to visually distinguish from today's warning/critical-dominant feed). Key = `deal_closed:${deal_id}`. Clicking the row links to `/owner/students/${student_id}`.

Dismissals reuse the `alert_dismissals` table and `/api/alerts/dismiss` verbatim. Orphaned dismissal rows from old alert types are preserved for history (anti-feature — no DELETE).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Alerts genuinely disappear when pruned | If old alerts still show up intermittently due to cache, trust in the feature collapses | Low | Remove the alert-generation code from `src/app/(dashboard)/owner/alerts/page.tsx:50-206`; nothing in the code path will produce them. Dismissal rows in DB are preserved but no alert with those keys ever renders again. |
| New `deal_closed` alerts fire on deal POST | Same latency expectation as coach `closed_deal` milestone (already built in Phase 52) | Low | Either query `deals` directly in `owner/alerts/page.tsx` (server component, runs on every request) OR add to the owner alerts generation logic. No new table, no new RPC. |
| Key per deal (not per student) | Every deal is its own alert; dismissing deal #1 doesn't dismiss deal #2. Mirrors Phase 52's `closed_deal` key shape `milestone_closed_deal:{student_id}:{deal_id}` | Low | Key = `deal_closed:${deal_id}` (simpler than coach's — owner doesn't need student_id in key because deal_id is globally unique) |
| Clicking deal-closed row opens owner student detail | Consistent with every other alert link pattern | Low | `subjectId: deal.student_id`, render as `Link` to `/owner/students/${deal.student_id}` |
| Cache invalidation after deal POST | If `/owner/alerts` is behind `unstable_cache` or route-revalidation, new deals won't show up until TTL expires | Medium | Check — today `owner/alerts/page.tsx` has no cache wrapper (re-renders on each request). Safe to leave as-is. BUT if deal mutation sets any `revalidateTag()` shared with owner alerts, verify. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sort deal_closed alerts by recency (newest first) | Standard feed behavior | Low | `ORDER BY deals.created_at DESC` |
| Badge chip showing deal count per student ("3 deals this week") | Would compress the feed when one student closes many deals | Medium | Out of scope for v1.8 — adds a grouping primitive not elsewhere in the codebase |
| Revenue summary at top of feed ("12 deals closed this month, $48k total") | Owner-level metric display; complements per-deal feed | Low | Nice-to-have; could be a single line above the alert list |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Tombstone alert "4 alert types were removed in v1.8" | **Opinionated NO.** See Open UX Question F4 — this is an internal dev-team event, not a user event. User doesn't care *why* their old alerts vanished, only *whether the feed still helps them now*. Tombstones age badly ("when can I dismiss this permanently?") | Silent removal. Changelog/announcement goes in the Announcements feature instead (v1.6 Phase 56) if desired |
| Migration to delete orphaned `alert_dismissals` rows | Deleting history prevents forensic analysis ("did this coach ever dismiss a dropoff alert?"); PROJECT.md explicitly says preserve | Leave the rows. New alert keys won't collide with old ones. |
| Rolling the coach-underperforming / student-inactive logic into a monthly digest | Out of scope for v1.8; if owner wants these back, that's a v1.9+ ask | Hard delete from the owner alerts UI |
| Extending `alert_dismissals.alert_key` uniqueness to prevent re-dismissal of same deal | Already unique per (owner_id, alert_key) — no migration needed | Leave the table alone |
| New alert type for "high-value deal" (deals > $X) | Feature creep; `deal_closed` firing for every deal is the scope | Every deal, info severity, flat feed |

### Dependencies on Shipped Code

- `src/app/(dashboard)/owner/alerts/page.tsx:50-206` (remove ~150 lines of alert-generation logic)
- `src/components/owner/OwnerAlertsClient.tsx` + `AlertItem` type (add `"deal_closed"` to the union, remove the 4 old types)
- `src/app/api/deals/route.ts` (POST) and `src/app/api/deals/[id]/route.ts` (PATCH/DELETE) — confirm whether they need a `revalidateTag` for owner alerts. Today `owner/alerts/page.tsx` does not use `unstable_cache`, so **no invalidation wiring needed.** But PROJECT.md Constraints calls this out explicitly — DO double-check the route-level revalidation behavior.
- `alert_dismissals` table — unchanged
- `src/app/api/alerts/dismiss/route.ts` — unchanged (generic alert_key acceptor)

**Complexity:** Low-Medium (mostly deletion + one new small query against `deals` table + updated client type).

---

## F5 — Coach Alerts: `tech_setup` Activation as "Set Up Your Agency" (Step 4)

### What it is

Today `tech_setup` milestone type is a live code path but dormant:
- `MILESTONE_CONFIG.techSetupStep: null` (config.ts:390)
- `MILESTONE_FEATURE_FLAGS.techSetupEnabled: false` (config.ts:412)
- `MILESTONE_META["tech_setup"].label: "Setup Complete"` (alerts-types.ts:120)
- RPC short-circuits on the feature flag (coach-milestones.ts:38-52)

v1.8 activates it:
- `MILESTONE_CONFIG.techSetupStep: 4` (roadmap step 4 "Set Up Your Agency" — already exists per PROJECT.md non-goals)
- `MILESTONE_FEATURE_FLAGS.techSetupEnabled: true`
- `MILESTONE_META["tech_setup"].label: "Set Up Your Agency"` (UI label only)

**Internal type key `tech_setup` PRESERVED** — the internal string is referenced in the RPC, in dismissal keys (`milestone_tech_setup:%`), and possibly in already-stored `alert_dismissals` rows. Renaming would cascade. PROJECT.md explicitly forbids the rename.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Flipping the flag fires real alerts | Coaches see "Set Up Your Agency" cards in `/coach/alerts` when their students complete step 4 | Low | The Phase 51 RPC already has the full code path; just needs the flag flipped |
| Label "Set Up Your Agency" (not "Setup Complete") | Stakeholder-provided copy from PROJECT.md Active requirements | Low | UI-only string change in `MILESTONE_META["tech_setup"].label` |
| Step 4 matches current roadmap step 4 "Set Up Your Agency" | Milestone fires when student completes step 4 — labels should match | Low | Confirm `ROADMAP_STEPS[3].title` is actually "Set Up Your Agency" before flipping. **Flag for phase execution — grep `ROADMAP_STEPS` in `src/lib/config.ts`.** |
| Sidebar badge increments when new tech_setup alert fires | `get_sidebar_badges` already counts all active milestone types; flipping the flag means it starts counting tech_setup rows | Low | No code change needed — RPC already counts tech_setup when flag is true (per Phase 52 wiring) |
| Bulk-dismiss works for tech_setup same as other types | Coaches can batch-dismiss via existing `/coach/alerts` UI | Low | No code change — `CoachAlertsClient` treats all milestone types uniformly |
| Dismissal key pattern `milestone_tech_setup:{student_id}` already wired | Per `MILESTONES.techSetup()` composer in config.ts:428 | Low | No code change |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Icon tint/background update to match "agency setup" semantics | Today `tech_setup` uses `CheckCircle` with `ima-primary` tint (alerts-types.ts:119-125) — still reasonable for "Set Up Your Agency" | Low | Leave icon choice as-is unless stakeholder has a strong preference. `CheckCircle` + primary tint is fine for "step 4 complete." |
| Announcement post on flip | Users ("coaches") notice the new alert category and understand it's intentional (not a bug) | Low | Post via the Announcements feature (v1.6 Phase 56) — free, optional, outside this feature's code scope |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Renaming `tech_setup` → `agency_setup` internal key | PROJECT.md explicitly forbids. Would require RPC rewrite, migration to rename `alert_dismissals.alert_key LIKE 'milestone_tech_setup:%'` rows, and coordination across type unions | Label-only change. Internal key stays `tech_setup`. |
| Different dismissal window for tech_setup (e.g. "re-fires after 30 days") | Existing milestone types are one-shot per student; consistency matters. And a student only completes step 4 once | Leave idempotency contract unchanged (one-shot per student) |
| Adding tech_setup to owner alerts | v1.8 is pruning owner alerts to `deal_closed` only (F4) — adding another type contradicts the other feature | Coach-only for tech_setup |
| Migrating existing `alert_dismissals` rows with `milestone_tech_setup:*` keys | No such rows exist today (flag is off, RPC never wrote any) | No migration needed; sanity-check via `SELECT COUNT(*) FROM alert_dismissals WHERE alert_key LIKE 'milestone_tech_setup:%'` (expect 0) |
| Re-firing for students who already completed step 4 before the flag was flipped | Backfilling would be surprising — a coach suddenly sees 20 "Set Up Your Agency" alerts for students from months ago | **Important edge case.** Phase 51 RPC needs to check: only fire for students whose step-4 `completed_at` is ≥ `(flag_enabled_at OR coach-visible-window)`. OR: explicit decision = fire for all, with a stakeholder-approved "catch-up" announcement. **Flag for `/gsd-discuss-phase`.** |

### Dependencies on Shipped Code

- `src/lib/config.ts:385-413` (three constants to edit — `techSetupStep`, `techSetupEnabled`, and the label in alerts-types.ts)
- `src/components/coach/alerts-types.ts:119-125` (`MILESTONE_META["tech_setup"].label`)
- `supabase/migrations/00030_*.sql` (the RPC that reads the flag — NO migration needed since behavior is flag-driven; verify the RPC treats `p_tech_setup_enabled=true` correctly)
- `src/lib/rpc/coach-milestones.ts:52` (`p_tech_setup_enabled: MILESTONE_FEATURE_FLAGS.techSetupEnabled` — flips automatically when flag flips)
- `alert_dismissals` — unchanged

**Complexity:** Low (3 constants to edit + one existing RPC behavior check + one edge-case decision about backfill).

---

## F6 — student_diy Owner Detail Page

### What it is

Today `/owner/students/[studentId]/page.tsx:35` hard-codes `.eq("role", "student")`, so clicking a `student_diy` row in any list 404s. v1.8 extends the existing route (not a parallel `/owner/students_diy/[id]` tree per PROJECT.md non-goals) to handle both roles:

1. Query: `.in("role", ["student", "student_diy"])`.
2. DIY detail view hides the Reports tab (DIY has no daily reports — PROJECT.md v1.4 D-05).
3. Calendar renders hours-worked badges only, no daily-report indicator dots.
4. Owner student list page (`src/app/(dashboard)/owner/students/page.tsx`) includes DIY rows with a visible "DIY" badge.
5. Coach route NOT touched (owner-only per PROJECT.md Ambiguity §3).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `/owner/students/[studentId]` renders for both roles | The URL should not care about role; role is data | Low | Change `.eq("role", "student")` to `.in("role", ["student", "student_diy"])` in `page.tsx:35` |
| Reports tab hidden for DIY | DIY has no reports — rendering an empty Reports tab is a visible bug | Low | The existing tabs shown in `StudentDetailTabs.tsx:13-17` are already `calendar | roadmap | deals` — **NO top-level Reports tab exists today.** v1.8's "hide Reports tab" requirement likely refers to Reports content *within Calendar day-detail*, not a separate top-level tab. **Flag for `/gsd-discuss-phase`.** |
| Calendar shows hours-only for DIY | No reports → no report indicator dots on calendar; only session-hour badges | Medium | `CalendarTab.tsx:78-84` `getActivity()` function returns "full" when both sessions AND report exist. For DIY, collapse to binary: "has sessions" or "none" |
| DIY badge on owner student list | Owner needs to distinguish at a glance which students are self-paced vs coached | Low | `page.tsx` for owner students list — add badge based on `role` |
| Coach assignment dropdown hidden for DIY | DIY students have NO coach assignment per v1.4 D-04; rendering the dropdown implies they can be assigned | Low | `OwnerStudentDetailClient.tsx:180-208` — conditional render based on role prop |
| "Skip tracker" badge behavior for DIY | DIY students don't submit reports, so skip-tracker semantics need confirmation. If it counts "days without a work session" — works fine. If it requires reports — broken for DIY. | Low | Verify `get_weekly_skip_counts` RPC behavior for DIY; it already supports them per v1.4 Phase 31 |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role badge on student detail header | Reinforces at-a-glance that this is a DIY student | Low | Add `<Badge>DIY</Badge>` to header when `role === "student_diy"` |
| DIY-specific empty state in Calendar when month has no sessions | "No sessions this month" (no mention of reports) vs generic text | Low | Parametrize `CalendarTab` empty state by role |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Parallel `/owner/students_diy/[studentId]` route tree | PROJECT.md explicitly forbids. Duplication of 200+ lines of code; two places to fix bugs | Extend existing route |
| Per-role sub-component (`OwnerStudentDetailClientDIY.tsx`) | **Opinionated NO.** See Open UX Question F6 — adds 200 LOC of duplicate JSX for a feature that's 90% identical; conditional-render-in-parent is the right call when 3 of ~10 UI blocks differ | Conditional render in parent (`OwnerStudentDetailClient.tsx`) gated on `role` prop |
| Fetching DIY data from a different RPC | `get_student_detail` already accepts any student ID; the RLS and admin-client access model treats roles uniformly | Same RPC, role-branched UI |
| Showing coach assignment as "N/A" for DIY | "N/A" invites "why? can I assign?" confusion | Hide the entire dropdown block for DIY |
| Touching `/coach/students/[studentId]` to also handle DIY | PROJECT.md Ambiguity §3: owner-only this milestone. Coaches don't have DIY students assigned (v1.4 D-04) | Coach route stays `eq("role", "student")` |
| Reports-tab-click sending DIY users to 404 | No top-level Reports tab exists today in `StudentDetailTabs.tsx` — already a non-problem. **Verify this claim during phase execution.** | If a Reports tab is discovered, gate in `StudentDetailTabs.tsx` by role |

### Dependencies on Shipped Code

- `src/app/(dashboard)/owner/students/[studentId]/page.tsx:35` (role filter)
- `src/components/owner/OwnerStudentDetailClient.tsx:180-208` (coach assignment dropdown — hide for DIY)
- `src/components/coach/CalendarTab.tsx:78-84` (`getActivity()` — DIY path)
- `src/components/coach/StudentDetailTabs.tsx:13-17` (verify — no Reports tab exists today in the `TabKey` union `"calendar" | "roadmap" | "deals"`)
- `src/app/(dashboard)/owner/students/page.tsx` (owner list — add DIY rows + badge)
- `src/lib/rpc/get_student_detail.sql` (RPC — confirm it works for `role='student_diy'`, likely yes since RPC just takes student_id)

**Complexity:** Medium (routing + conditional renders across 4-5 files + list-page integration, but no new SQL, no migration).

---

## Feature Dependencies

```
F1 (KPI rename) ─── standalone; prerequisite for ZERO other features
F2 (Coach leaderboards) ──┐
                          ├──> F3 (Window selector) ─── F3 builds on F2's RPC shape
F2 (Coach leaderboards) ──┘
F4 (Owner alerts prune) ─── standalone; no dep on F2/F3 but touches /owner route adjacent to F2
F5 (tech_setup activation) ─── standalone; coach-side only, no overlap
F6 (DIY owner detail) ─── standalone; no dep on any other feature in v1.8
```

**Recommended build order** (mirrors PROJECT.md numbering 1→6 but with explicit dependency rationale):

1. **F1 first** (low-risk warm-up; breaking RPC forces cache-bust discipline that F2/F3 also need)
2. **F2 second** (defines the coach leaderboard RPC shape that F3 inherits)
3. **F3 third** (expands F2's RPC with 4× windows; F3 alone is wasted work if F2 coach leaderboards don't exist yet)
4. **F5 fourth** (independent, low-risk — flag flip; can slot anywhere but near end keeps v1.8 "active" pile smaller during F2+F3)
5. **F4 fifth** (independent — owner alerts prune; do after F2 to avoid double-touching `/owner/*` pages in close succession)
6. **F6 last** (independent, medium complexity; most visible-to-owner change; ship last so owner has a complete picture)

---

## MVP Recommendation

All 6 blocks are scoped as MVP for v1.8 per PROJECT.md — there's no "maybe ship" tier. Priorities if time compresses:

**Must-ship:**
1. **F1** — fixes a wrong label that's actively lying to students. Low complexity, high integrity win.
2. **F4** — prunes noise; unambiguous user-requested cleanup.
3. **F5** — one flag flip; <½ day of work; unlocks coach visibility into student setup progress.

**Should-ship:**
4. **F6** — DIY users currently 404 when owner clicks them. User-facing bug fix. Medium complexity but scoped.
5. **F2** — new leaderboards. High-value but largest SQL unknown.

**Could-defer (to v1.9):**
6. **F3** — window selector. Depends on F2 shipping first. Complex SQL. Strongest candidate for "defer if F2 blows up."

**Do not defer F1 even if it's small** — the current mislabeled "Total Emails" is actively misleading and fixing it is close to free.

---

## Open UX Questions — Opinionated Recommendations

These were explicitly flagged in the research prompt. Answers below are recommendations with reasoning, not "depends on user."

### F2: Coaches with zero assigned students — exclude or show N/A?

**Recommendation: EXCLUDE ENTIRELY. Filter at SQL level.**

Rationale:
- A top-3 leaderboard is a ranked list. Zero-metric entries at the bottom of a ranked list add cognitive load without signal — the owner already knows which coaches have no assignments (they're the ones whose dropdown shows "0 students" in `OwnerStudentDetailClient.tsx:200`).
- "N/A" with a zero metric is visually confusable with "coach with 5 students and $0 revenue" — the latter is a real problem, the former is not. Mixing them obscures both.
- Phase 54 student leaderboards already implicitly exclude students with zero metrics (they don't appear in `top_3_by_X` RPC output). Coach leaderboards should follow the same convention — silent exclusion, not placeholder rendering.
- SQL: `WHERE EXISTS (SELECT 1 FROM users s WHERE s.coach_id = c.id AND s.role = 'student' AND s.status = 'active')` — cheap, auditable, matches the "active coaches only" requirement in PROJECT.md.

**Dissenting case (weak):** If the list frequently shows <3 coaches (e.g., only 1 or 2 coaches platform-wide exist), an empty-state hint in the card body ("2 of 3 coaches ranked — one coach has no assigned students") would reduce "is the widget broken?" confusion. Add this only if the platform has <5 coaches total.

### F3: Weekly/Monthly/Yearly toggle persistence across reloads — localStorage or reset?

**Recommendation: RESET ON EACH VISIT. Default to "All Time" every page load. No localStorage.**

Rationale:
- PROJECT.md explicitly calls out "Toggles are pure client state (no re-fetch)." localStorage would require hydration-safe reads (SSR doesn't have localStorage), adding meaningful complexity for little gain.
- "Each visit is a fresh analytical session" is the correct mental model for dashboards that exist to give a status snapshot. If the owner wanted persistence, they'd bookmark or use URL params.
- The recovery cost of a reset is 1 click per leaderboard. For 6 leaderboards, that's 6 clicks at the absolute worst. If the user consistently wants a non-default view, they're a candidate for a URL-query-param upgrade in v1.9+ — **not a localStorage upgrade** (URL params are shareable, localStorage is not).
- General dashboard UX convention (observed across CloudWatch, AgencyAnalytics, Azure DevOps Analytics): dashboard-level filters override widget-level; per-widget persistence is a specialized feature in mature products (LogScale, Langfuse) — not a v1.8 scope. See [Widget Time Selector](https://library.humio.com/data-analysis/dashboards-time-widget-time-selector.html) and [Time Range management (Langfuse)](https://github.com/orgs/langfuse/discussions/11696).
- Existing student analytics `RangeSelector` at `AnalyticsClient.tsx:601-627` uses URL-param persistence (via `router.push` on change) — which works there because range changes ALSO trigger a refetch. For v1.8 F3, the toggle DOES NOT refetch — so URL params would still have to wire through server-side but not produce different data, which is confusing plumbing.

**Dissenting case (weak):** If the owner visits `/owner/analytics` daily and always wants "weekly" for deals, a sessionStorage (not localStorage) hint would survive within a session but not bleed across devices. Still recommend NO for v1.8 — revisit if usage data shows a consistent override pattern.

### F4: Pruning owner alerts — tombstone message or silent removal?

**Recommendation: SILENT REMOVAL. No tombstone, no "4 alerts removed" footer.**

Rationale:
- Tombstones are developer-centric communication masquerading as user-centric. The owner doesn't care *why* alerts disappeared — they care whether the feed currently helps them.
- Tombstones age badly: "When can I dismiss this permanently?" / "Is this still relevant after 6 months?" / "What was here before?" — all questions a tombstone CREATES without ANSWERING.
- If communication is needed, the Announcements feature (v1.6 Phase 56) is the right channel: one-time, persistent, dismissable, explicitly-authored by owner themselves. Not the alerts feed.
- Orphaned `alert_dismissals` rows preserved (per PROJECT.md non-goal) means forensic queries can still reconstruct what was dismissed — no data is lost.
- User trust is built by the feed *showing what's actionable right now*, not by apologizing for changes. The feed will rebuild itself quickly once deal_closed alerts start flowing.

**Dissenting case (strong-ish):** If the owner is an active user who had just dismissed 30 old alerts yesterday and sees them "re-disappear" today, they may wonder if dismissal is working. Mitigation: a single Announcement post at the time of flip explaining the pruning. This is NOT a tombstone in the feed — it's a separate, ephemeral channel that's already built.

### F6: Hiding feature-specific UI for a sub-role — conditional render in parent or per-role sub-component?

**Recommendation: CONDITIONAL RENDER IN PARENT. Do NOT build a per-role sub-component.**

Rationale:
- The DIY vs student view is ~90% identical: same header, same KPI strip (minus reports-derived metrics), same tabs (minus Reports content if it existed), same Roadmap tab, same Deals tab, same 100h milestone card. Duplicating `OwnerStudentDetailClient.tsx` into `OwnerStudentDetailClientDIY.tsx` would copy 200+ lines of nearly-identical JSX with 3-5 lines of difference.
- Duplicate components drift: a bug fix or style tweak in one won't reach the other until someone notices. The CalendarTab's `role="owner"` prop (line 258 of OwnerStudentDetailClient.tsx) already proves the pattern works — one component, role-conditional behavior.
- Conditional-render-in-parent becomes the WRONG call when the two UIs diverge past ~40%. At that point, the shared component becomes a maze of `{role === "student_diy" ? <A /> : <B />}` and extraction into sub-components is overdue. v1.8 DIY parity is nowhere near 40% divergence.
- Concretely, the conditional-render changes for F6 are:
  1. Hide coach-assignment dropdown block (lines 180-208 of OwnerStudentDetailClient.tsx) when `role === "student_diy"`.
  2. Pass a new prop to CalendarTab like `showReportIndicators={role !== "student_diy"}` — single-line branch inside `getActivity()`.
  3. Maybe a DIY role badge next to the name.
  That's 3 branches. Not a sub-component's worth of divergence.
- The codebase convention is role-branching inline (see CalendarTab, RoadmapTab, DealsTab all take `role`/`viewerRole` props already). Staying consistent is its own value.

**Dissenting case (weak):** If v1.9+ adds substantial DIY-only features (DIY referral analytics? DIY-specific progress metric?) that would justify a per-role component, the refactor cost is low — extract then. For v1.8 scope, conditional render is cheaper and safer.

---

## Sources

Primary sources — existing codebase (read directly, HIGH confidence):
- `.planning/PROJECT.md` (v1.8 requirements, build constraints, ambiguities)
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` (KPI strip, RangeSelector, `viewerRole === "student_diy"` guard)
- `src/app/(dashboard)/owner/analytics/page.tsx` (Phase 54 pattern for leaderboards)
- `src/app/(dashboard)/owner/alerts/page.tsx` (current 4-type alert logic)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` (`.eq("role", "student")` filter)
- `src/components/owner/OwnerStudentDetailClient.tsx` (tabs, coach-assign dropdown)
- `src/components/coach/StudentDetailTabs.tsx` (no Reports tab exists — calendar/roadmap/deals only)
- `src/components/coach/CalendarTab.tsx` (`getActivity()` combining sessions + reports)
- `src/components/coach/alerts-types.ts` (MILESTONE_META)
- `src/lib/config.ts:370-450` (MILESTONE_CONFIG, MILESTONE_FEATURE_FLAGS, MILESTONES)
- `src/lib/rpc/owner-analytics.ts` (`getOwnerAnalyticsCached`, `ownerAnalyticsTag`)
- `src/lib/rpc/student-analytics-types.ts` (`StudentAnalyticsTotals` shape)

Secondary sources — UX conventions (MEDIUM confidence, single-source web search):
- [Widget Time Selector — LogScale docs](https://library.humio.com/data-analysis/dashboards-time-widget-time-selector.html)
- [Time Range management (widget vs. dashboard) — Langfuse discussion](https://github.com/orgs/langfuse/discussions/11696)
- [Set a date range — AgencyAnalytics KB](https://help.agencyanalytics.com/en/articles/2040614-set-a-date-range)
- [How to set different time per widget in a cloud-watch dashboard — AWS re:Post](https://repost.aws/questions/QUL5DezornQ-WeG8zk5dvGww/how-to-set-different-time-per-widget-in-a-cloud-watch-dashboard)

Gaps (LOW confidence, flagged for phase discussion):
- F1 DIY KPI behavior (show new cards or keep hiding? — PROJECT.md ambiguity)
- F2 metric #2 semantics ("avg email count" interpretation — PROJECT.md Ambiguity §1)
- F5 backfill decision for pre-existing step-4 completions (edge case not flagged in PROJECT.md)
- F6 "hide Reports tab" — no top-level Reports tab exists in current `StudentDetailTabs.tsx:13-17`; language in PROJECT.md may refer to Calendar day-detail Report rendering rather than a top-level tab
