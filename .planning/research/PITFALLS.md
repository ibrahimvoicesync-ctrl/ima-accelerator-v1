# Pitfalls Research

**Domain:** Adding flexible work sessions, granular outreach KPIs, calendar view, and roadmap deadlines to existing Next.js 16 + Supabase coaching platform (v1.1)
**Researched:** 2026-03-27
**Confidence:** HIGH — based on direct codebase analysis of all affected files

> **Scope:** This document covers pitfalls specific to the v1.1 feature additions. For v1.0 foundation pitfalls (OAuth, RLS setup, cookie handler), see git history. These are integration pitfalls — mistakes that arise from adding features to an existing system, not building from scratch.

---

## Critical Pitfalls

### Pitfall 1: Break Timer Invalidates the "Resume Shifts started_at" Invariant

**What goes wrong:**
The existing WorkTimer reads `Date.now() - new Date(startedAt).getTime()` to compute elapsed time. This works because the resume handler in the PATCH route shifts `started_at` forward so elapsed always equals active work time. Adding a break timer introduces a second "pause" state — but break pause is automatic and temporary. If break pause reuses the existing `paused_at` column, the resume-shift logic will incorrectly subtract break time as if it were user-pause time. The timer jumps forward when the break ends, shortening the remaining cycle duration by the length of the break.

**Why it happens:**
The PATCH route (`src/app/api/work-sessions/[id]/route.ts`, lines 91-97) computes:
```
elapsedBeforePause = pausedAt - startedAt
newStartedAt = Date.now() - elapsedBeforePause
```
This was designed for one type of pause. A break that writes to `paused_at` will cause resume to eat the break duration as if it were active work time.

**How to avoid:**
Track break state client-side only. A break is between cycles, not within a cycle — it does not need to survive page refresh. Use a separate React state variable (`breakEndsAt: number | null`) in WorkTrackerClient and keep it entirely in the browser. Never write break state to the database. If a break must survive refresh, add a separate `break_started_at` column to `work_sessions` so the existing `paused_at` column remains exclusively for user-initiated pause.

**Warning signs:**
- Timer shows less remaining time after a break ends than expected
- Completed sessions have `duration_minutes` less than the selected session length
- `started_at` timestamps that are in the future (break logic shifted them past now)

**Phase to address:** Flexible work sessions phase — design break timer state model before writing any component code.

---

### Pitfall 2: Removing cyclesPerDay Cap Breaks Five Hardcoded References

**What goes wrong:**
`WORK_TRACKER.cyclesPerDay` (value: 4) appears in five places. Removing the cap without touching all five causes cascading failures: the POST route rejects cycle numbers above 4 (Zod `max(WORK_TRACKER.cyclesPerDay)` on line 9 of `work-sessions/route.ts`), WorkTrackerClient's `allComplete` fires at 4 regardless of user goal, the student dashboard progress bar denominator stays at 4 (showing 125% if 5 cycles complete), WorkTimer announces "Cycle N of 4" for screen readers, and the student dashboard's `getNextAction` returns "Submit Report" after 4 cycles even if the student has more to do.

**Why it happens:**
`cyclesPerDay: 4` looks like a display constant but is also a validation bound and a business logic gate. Developers update the display without realizing the API schema and state machine logic also depend on it.

**How to avoid:**
Audit all references before changing config: `grep -r "cyclesPerDay" src/`. Separate the concepts: (a) a daily goal (can be unlimited/user-set), (b) an abuse guard for the API (should remain as a generous maximum like 20), and (c) display strings. Update all five locations atomically in the same plan. The DB constraint `cycle_number BETWEEN 1 AND 4` (migration line 89) is a sixth reference that requires its own migration.

**Warning signs:**
- HTTP 400 from POST when `cycle_number` exceeds 4
- Progress bar shows more than 100% for a productive student
- `allComplete` fires early, showing "submit report" before student is done
- TypeScript type errors if the DB constraint check changes without a migration

**Phase to address:** Flexible work sessions phase — run `grep -r "cyclesPerDay"` and update all references before the first commit.

---

### Pitfall 3: NOT NULL Column on Live Table Fails Without Backfill Step

**What goes wrong:**
Adding `ALTER TABLE work_sessions ADD COLUMN duration_target_minutes integer NOT NULL` to a migration fails on the live database with `ERROR: column "duration_target_minutes" contains null values` because existing rows have no value for the new column. Even `ADD COLUMN ... NOT NULL DEFAULT 45` is safe on Postgres 15 (Supabase's version) for constant defaults — but developers may misapply this and use a function like `now()` as the default, which forces a full table rewrite.

**Why it happens:**
The local development database has no existing data — `supabase db reset` runs migrations against a clean slate. Migrations that would fail on a live populated table pass locally, creating false confidence before deployment.

**How to avoid:**
Always use the three-step pattern for adding non-null columns to tables with existing data:
1. `ALTER TABLE work_sessions ADD COLUMN duration_target_minutes integer;`
2. `UPDATE work_sessions SET duration_target_minutes = 45 WHERE duration_target_minutes IS NULL;`
3. `ALTER TABLE work_sessions ALTER COLUMN duration_target_minutes SET NOT NULL;`

All three steps belong in a single migration file. Test the migration against a database seeded with representative data (not just a clean reset).

**Warning signs:**
- Migration passes locally (`supabase db reset` = clean slate) but fails on Supabase dashboard push
- New column has `DEFAULT now()` or any other volatile function
- Migration was written without first checking if live rows exist in the target table

**Phase to address:** Database schema migration phase — use the three-step pattern and add a "tested against seeded DB" checkbox to the phase plan.

---

### Pitfall 4: Unique Index on (student_id, date, cycle_number) Blocks Flexible Session Patterns

**What goes wrong:**
`idx_work_sessions_student_date_cycle` is a UNIQUE constraint on `(student_id, date, cycle_number)` (migration line 97). The current design assigns each cycle a fixed number 1-4 and deletes abandoned sessions. With flexible sessions, if the UX changes to soft-delete abandoned rows (keeping them for calendar history), a student who abandons cycle 2 and starts a new cycle 2 on the same day will hit a unique constraint violation (HTTP 409, code "23505" in the POST route error handler at line 80).

**Why it happens:**
The unique constraint was designed for the fixed-slot model. Flexible sessions may want to record all attempts, including abandoned ones, for the calendar view. These two requirements conflict if the same column tracks both "slot identity" and "attempt sequence."

**How to avoid:**
Decide the semantics of `cycle_number` for v1.1 before writing migrations. If cycles remain sequentially numbered (1, 2, 3... as a simple counter of sessions started today), keep the current delete-on-abandon behavior — the constraint still works. If the UX switches to soft-delete (keeping abandoned rows for calendar history), replace the unique constraint with a partial unique index: `CREATE UNIQUE INDEX ... WHERE status != 'abandoned'`. Document this decision in the phase plan before touching the schema.

**Warning signs:**
- HTTP 409 when a student starts a second session after abandoning one on the same day
- `insertError.code === "23505"` in the POST route triggered by non-duplicate reasons
- Calendar view shows gaps where abandoned sessions should appear

**Phase to address:** Database schema migration phase — decide cycle_number semantics before writing any migration.

---

### Pitfall 5: N+1 Aggregate for Lifetime Outreach via JavaScript reduce()

**What goes wrong:**
The KPI banner needs lifetime outreach total (sum of all `outreach_count` across `daily_reports`) and today's daily total. The naive implementation fetches all reports and sums in JavaScript. The coach/owner student detail page already fetches reports with `.limit(20)` — insufficient for lifetime totals. A student active for 6 months has 180+ daily reports. Fetching all of them to sum client-side returns a large JSON payload and a slow page load.

**Why it happens:**
Supabase's TypeScript client doesn't surface SQL aggregates obviously, so developers write `.select("outreach_count").eq("student_id", id)` and sum in JavaScript. This pattern is visible in the student dashboard where `totalMinutesWorked` is computed with `.reduce()` over today's sessions — fine for a handful of records, but it scales to all reports for the lifetime total.

**How to avoid:**
Use a Postgres aggregate. Supabase JS v2 supports `select("outreach_count.sum()")` for simple aggregates. For the combined lifetime+daily query, use an RPC:
```sql
CREATE OR REPLACE FUNCTION get_outreach_kpis(p_student_id uuid, p_today date)
RETURNS TABLE(lifetime_total bigint, today_total bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(outreach_count), 0) AS lifetime_total,
    COALESCE(SUM(CASE WHEN date = p_today THEN outreach_count ELSE 0 END), 0) AS today_total
  FROM daily_reports
  WHERE student_id = p_student_id;
$$;
```
Never fetch all rows to sum in application code.

**Warning signs:**
- Network response for the KPI banner contains full report rows (wins/improvements text included)
- Page load time exceeds 400ms on the student dashboard for students with 100+ reports
- The aggregate query uses `.select("*")` or `.select("outreach_count")` without `.limit()` or aggregate syntax

**Phase to address:** Progress KPI / outreach tracking phase — write the aggregate function before building the banner component.

---

### Pitfall 6: Calendar View Over-fetches Due to Missing Month Date Bounds

**What goes wrong:**
The existing coach student detail page fetches `.limit(120)` for sessions (lines 40-43 of `coach/students/[studentId]/page.tsx`). A calendar month view needs all sessions and reports for the visible month. If the calendar derives its data from this same prop, a student active for 4+ months will have 120+ sessions total — the limit is hit and months beyond the most recent ~4 are silently empty. The calendar appears to show no activity for older months, which is misleading.

**Why it happens:**
Server components fetch all data upfront with a catch-all limit. The calendar component then filters client-side to the visible month. This works until the limit is hit. Month navigation is client-side, so there is no mechanism to fetch different data when navigating to a different month.

**How to avoid:**
Pass `?month=YYYY-MM` as a URL search parameter. Read it in the server component and scope queries:
```typescript
const { month } = await searchParams; // e.g., "2026-02"
const firstDay = `${month}-01`;
const lastDay = new Date(new Date(firstDay).getFullYear(), new Date(firstDay).getMonth() + 1, 0).toISOString().split("T")[0];
// Then: .gte("date", firstDay).lte("date", lastDay)
```
Next.js App Router triggers a server re-render when search params change, so month navigation via `router.push("?month=YYYY-MM")` fetches fresh bounded data automatically. Do not adapt the existing sessions prop for calendar rendering.

**Warning signs:**
- Calendar shows no sessions for months older than ~4 months
- Month navigation causes noticeable delay (re-fetching) but no loading state
- Sessions prop has more than 100 items (limit being hit is likely)

**Phase to address:** Calendar view phase — scope all queries with `month` search param from day one.

---

### Pitfall 7: Sticky KPI Banner Conflicts With Sidebar Z-Index and Mobile Layout

**What goes wrong:**
The sidebar is `fixed inset-y-0 left-0 z-50` (Sidebar.tsx line 168). The mobile menu toggle button is `fixed top-4 left-4 z-50`. The `<main>` element has `pt-16 md:pt-0 md:ml-60` (layout.tsx line 188). A sticky KPI banner placed with `position: fixed` will overlap the sidebar on desktop (it has no left offset), and will be covered by or overlap the mobile hamburger button at the top. A banner with `sticky top-0` used inside a `<div>` that has `overflow: hidden` (a common card pattern) will not stick at all.

**Why it happens:**
Sticky banners in top-nav layouts use `sticky top-[64px]` to sit below the nav bar. This codebase has no top nav bar — the sidebar is vertical. Developers copy the sticky-banner pattern without adapting the offset logic.

**How to avoid:**
Use `sticky top-0` within the main content flow (inside `<main>`), not `position: fixed`. The banner pins to the top of the scrollable content area, not the viewport — no z-index conflict with the sidebar is possible. If `position: fixed` is required for any reason: apply `left-0 md:left-60 right-0 top-16 md:top-0` to account for both the mobile hamburger height and the desktop sidebar width. Set the banner's z-index to `z-30` (below the sidebar's `z-50`). Never use `z-50` on content elements.

**Warning signs:**
- Banner is invisible on desktop (hidden behind sidebar)
- Banner overlaps the mobile hamburger button (top-left corner)
- Banner does not stick when inside a card container with `overflow: hidden`

**Phase to address:** Progress KPI / sticky banner phase — verify layout on 375px mobile viewport with sidebar open before marking complete.

---

### Pitfall 8: outreach_count Rename Breaks the Coach Report Update Trigger

**What goes wrong:**
The `restrict_coach_report_update()` trigger (migration lines 411-428) explicitly resets `NEW.outreach_count := OLD.outreach_count` to prevent coaches from modifying student outreach data. If `outreach_count` is renamed to add granularity (e.g., `email_outreach_count`), the trigger references a column that no longer exists. Every coach attempt to mark a report as reviewed will fail with `ERROR: column "outreach_count" of relation "daily_reports" does not exist`. Coaches will be silently blocked from reviewing reports — the core accountability loop breaks.

**Why it happens:**
Trigger functions are defined in migration SQL and are easy to forget during feature work on application code. The trigger function body is not visible when reading component or API route code. The failure only surfaces at runtime when a coach tries to mark a report reviewed, not at migration time.

**How to avoid:**
When modifying `daily_reports` columns, update `restrict_coach_report_update` in the same migration that changes the column. The migration order must be: (1) add new columns, (2) update trigger function to reference new column names, (3) backfill data if needed, (4) drop old columns only after verifying no application code references them. Search `src/` for `outreach_count` before removing it from any migration.

**Warning signs:**
- Coaches receive 500 errors when clicking "Mark Reviewed"
- `/api/reports/[id]/review` route succeeds (200) but database update silently fails
- `supabase db push` migration succeeds but coach review functionality is broken post-deploy

**Phase to address:** Daily report / outreach schema migration phase — include trigger update in the same migration as any `daily_reports` column change.

---

### Pitfall 9: Timezone Mismatch in joined_at + target_days Deadline Computation

**What goes wrong:**
`users.joined_at` is stored as `timestamptz NOT NULL DEFAULT now()` — a UTC timestamp. Computing "Step 3 must complete within 30 days of joining" by doing `new Date(joined_at).getTime() + 30 * 86400000` gives the correct UTC moment, but comparing that to `getToday()` (which returns a local-time date string, see `utils.ts` lines 8-15) creates an off-by-one bug for users in UTC+ timezones. A student in UTC+5 late at night will see a step marked "overdue" hours before a UTC student with the same deadline. The existing codebase uses mixed timezone approaches: `getToday()` returns local date, but `joined_at` is UTC.

**Why it happens:**
`getToday()` in `utils.ts` uses `new Date()` local date methods (not `.toISOString()` which is UTC). `joined_at` is UTC. When server-computed deadline strings are compared against client-rendered "today" strings, the timezone mismatch causes boundary-day errors.

**How to avoid:**
Compute deadlines entirely on the server (Next.js server components run in the Node.js process timezone, which on Vercel is UTC). Pass deadline date strings as ISO dates from server to client. Add a `getTodayUTC()` utility: `new Date().toISOString().split("T")[0]` and use it exclusively for all deadline comparisons. Never compare a UTC-derived deadline against a local-time "today" string.

**Warning signs:**
- Students in UTC+5 see "overdue" one day before UTC students with the same deadline
- Deadline status changes at midnight UTC, not midnight local time
- Unit tests for deadline logic pass in UTC CI but fail in developer local timezone

**Phase to address:** Roadmap date KPIs phase — add `getTodayUTC()` to utils.ts before writing any deadline comparison logic.

---

### Pitfall 10: New Tables Added Without All Three Role RLS Policies

**What goes wrong:**
If v1.1 adds a new table (e.g., `outreach_events` for per-type tracking), running `ALTER TABLE outreach_events ENABLE ROW LEVEL SECURITY` without writing policies causes all queries from authenticated users to return empty arrays silently. No error is thrown — Postgres default-deny with RLS enabled filters all rows when no policy matches. The feature appears broken with an empty state, and the root cause is non-obvious because the admin client (service role key, bypasses RLS) works fine in testing.

**Why it happens:**
Developers write the student SELECT and INSERT policies but forget the coach SELECT policy (needed for coach/owner KPI visibility) and the owner SELECT policy. Or they test exclusively with the admin client which bypasses RLS entirely.

**How to avoid:**
For any new table, write all role policies in the same migration:
- `owner_select_[table]` — `(select get_user_role()) = 'owner'`
- `coach_select_[table]` — `(select get_user_role()) = 'coach' AND student_id IN (SELECT id FROM users WHERE coach_id = (select get_user_id()))`
- `student_select_[table]` — `(select get_user_role()) = 'student' AND student_id = (select get_user_id())`
- `student_insert_[table]` — matching student INSERT policy

Use the existing `(select get_user_role())` initplan wrapper pattern (not inline function calls) for performance — this is established in migration line 183+.

**Warning signs:**
- Admin client query succeeds; authenticated client query returns `[]` with no error
- Supabase Studio table editor shows rows; app shows empty state
- New table migration has `ENABLE ROW LEVEL SECURITY` with no following `CREATE POLICY` statements

**Phase to address:** Any phase adding a new table — include all four role policies in the same CREATE TABLE migration block.

---

### Pitfall 11: Config.ts Changes Without TypeScript Audit Break API Route Validation

**What goes wrong:**
`WORK_TRACKER.cyclesPerDay` is used in the work-sessions POST route Zod schema as `max(WORK_TRACKER.cyclesPerDay)` (line 9 of `work-sessions/route.ts`). Removing or renaming `cyclesPerDay` from config.ts causes a TypeScript compilation error, but `npm run dev` (Next.js dev server) transpiles without full type checking and may not surface this immediately. The production build (`npm run build`) will catch it, but only after wasted development time. Additionally, if the field is removed but the API validation is forgotten, cycle numbers above 4 will be accepted without validation, allowing arbitrary large values.

**Why it happens:**
Config is the single source of truth per CLAUDE.md rule 1, but consumers are spread across API routes, components, and pages. The Zod schema reference is easy to miss because it is not a display string — it's a runtime validation bound.

**How to avoid:**
Before removing or renaming any config field, run: `grep -r "WORK_TRACKER\." src/ --include="*.ts" --include="*.tsx"`. Run `npx tsc --noEmit` immediately after every config change, before writing any feature code. When deprecating a field, keep it as a computed re-export first rather than deleting it immediately.

**Warning signs:**
- Config change merged without a `npx tsc --noEmit` pass
- API routes accept unexpectedly high `cycle_number` values
- TypeScript errors surfaced only at build time, not dev time

**Phase to address:** Flexible work sessions phase — `npx tsc --noEmit` as part of every sub-task completion before the next task starts.

---

### Pitfall 12: Roadmap Seeding Sets Step 1 completed_at to First Page Visit, Not Join Date

**What goes wrong:**
`roadmap_progress` already has a `completed_at timestamptz` column (migration line 107). The roadmap page's lazy-seeding code sets `completed_at: step.step === 1 ? now : null` (roadmap/page.tsx lines 43-51). `now` here is the moment the student first visits the roadmap page, not their actual join date. The v1.1 "roadmap completion date logging" feature will display `completed_at` for each step — for Step 1 ("Join the Course"), this will show the roadmap page visit date rather than the join date, which is semantically wrong and potentially days off.

**Why it happens:**
The seed was written before completion dates were a visible feature. Using `now()` was acceptable when the field wasn't displayed. Now that it becomes a user-visible data point, the wrong value surfaces.

**How to avoid:**
Fix the seed to use `user.joined_at` for Step 1's `completed_at`. The `requireRole("student")` call at the top of the roadmap page already returns the user object with `joined_at`. This is a one-line fix in the seeding block. Apply it before v1.1 ships — existing rows may also need a one-time backfill migration:
```sql
UPDATE roadmap_progress rp
SET completed_at = u.joined_at
FROM users u
WHERE rp.student_id = u.id
  AND rp.step_number = 1
  AND rp.status = 'completed';
```

**Warning signs:**
- Step 1 "completed" date differs from user's join date shown elsewhere in the UI
- Students who joined but didn't visit roadmap for 2 weeks show Step 1 completed 2 weeks after join
- Inconsistency between the "Member since X" display and Step 1 completion timestamp

**Phase to address:** Roadmap date KPIs phase — run the backfill migration AND fix the seed before adding the completed_at display.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Track break state client-only (no DB write) | No schema change, no API round-trip | Break timer resets on page refresh mid-break | Acceptable — break is between cycles; a page refresh mid-break is a recoverable edge case |
| Compute lifetime outreach via JS reduce over fetched rows | No stored function needed | Slow and large payloads at 100+ reports | Never — use Postgres SUM from day one |
| Derive calendar data from existing sessions prop (no date param) | No URL change, simpler component | Shows empty data for months beyond the 120-row limit | Never — correctness is compromised |
| Keep cyclesPerDay = 4 in config but ignore it in UI logic | No schema migration | Config lies about behavior; confuses future developers | Only as a transient state during the same plan that updates all consumers |
| Use getToday() (local time) for deadline comparisons | Works correctly in UTC and UTC- timezones | Off-by-one for UTC+ users late at night | Never — use getTodayUTC() for deadline logic |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase aggregate queries | `.select("outreach_count").then(rows => rows.reduce(...))` | `.rpc("get_outreach_kpis", {...})` or `.select("outreach_count.sum()")` |
| Supabase migrations on live data | `ADD COLUMN x integer NOT NULL` without DEFAULT | `ADD COLUMN x integer`, backfill, `SET NOT NULL` in same migration |
| Supabase RLS on new tables | Create table + enable RLS, but no policies | Write all role policies in the same migration |
| Next.js search params for month navigation | Using client state for selected month | Pass `?month=YYYY-MM` as URL search param; server component reads it for data fetching |
| Supabase trigger functions after column rename | Trigger references old column name post-rename | Update trigger function in same migration as column rename |
| Supabase admin client in coach/owner KPI views | Fetching student KPI data via RLS-bound client in server component | Always use `createAdminClient()` in server components, then filter by coach_id in application code |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| JS-side lifetime outreach sum | 400ms+ page load; large JSON payload | Postgres SUM via RPC or `.select("outreach_count.sum()")` | ~50+ daily reports (~2 months of activity) |
| Calendar fetch without date bounds (120-row limit) | Old months show empty calendar; no error | `?month` search param + `gte`/`lte` date filter | Student with 120+ total sessions (~4 months active) |
| Layout.tsx badge count queries — adding sequential awaits | Owner/coach layout slow to load | All badge queries are in existing `Promise.all`; do not add more sequential awaits above the parallel block | Immediate if a new `await` is added before the `Promise.all` |
| Daily reports SELECT * for KPI computation | Large payload; wins/improvements text wastes bandwidth | Select only `outreach_count, date` for aggregates | ~30+ reports (text fields inflate payload significantly) |
| Calendar tab re-fetching same month on every tab switch | Double network round-trip when user switches away and back | Cache month data in React state keyed by `"YYYY-MM"` string | Every tab switch without caching |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New outreach columns added without updating `restrict_coach_report_update` trigger | Coaches can modify student outreach data by accident via the review PATCH path | Add new outreach columns to trigger's explicit reset list in same migration |
| KPI data for coach/owner views fetched with RLS-bound authenticated client | Coach sees data for their own students only if RLS works; empty results if policy has edge case | Always use `createAdminClient()` in server components for coach/owner data reads, then filter by `coach_id` in application code |
| `duration_target_minutes` accepted from client without server validation | Client sends 999 to inflate tracked time stats | Validate against exact allowed values in Zod: `z.union([z.literal(30), z.literal(45), z.literal(60)])` |
| Lifetime outreach RPC callable by any authenticated user for any student_id | Coach queries KPI for a student not assigned to them | Add `p_student_id IN (SELECT id FROM users WHERE coach_id = get_user_id())` guard inside the function, or enforce in the calling server component |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sticky banner with `position: fixed` on mobile | Banner overlaps content; main nav toggle (top-left) may be covered | Use `sticky top-0` in normal document flow inside `<main>` |
| Calendar month navigation full page reload | Jarring; full spinner on every month change | Soft navigation with `router.push("?month=YYYY-MM")` — Next.js handles as partial re-render |
| Break timer in a modal or separate overlay | Student closes modal, loses break awareness | Break state shown inline in the work tracker card, same visual hierarchy as the cycle timer |
| Roadmap deadline "overdue" in red on the day it is due | Students feel penalized for same-day completion | "Overdue" triggers only the day AFTER the deadline; "due today" is a distinct warning state |
| KPI banner visible on every page including the work tracker | Anxiety about targets during focused work | Show sticky banner on dashboard only; on work tracker page, show a compact inline stat |

---

## "Looks Done But Isn't" Checklist

- [ ] **Flexible sessions:** Cycle number cap removed in BOTH the Zod schema (POST route) AND the DB `CHECK` constraint — verify both independently
- [ ] **Break timer:** Complete a session with a break and verify `duration_minutes` matches the selected session duration exactly (break time not subtracted)
- [ ] **Outreach KPIs:** Verify lifetime total uses Postgres SUM, not JS reduce — check network payload contains only aggregate values, not full report rows
- [ ] **Sticky banner:** Test on 375px Chrome DevTools mobile with sidebar open — banner must not overlap sidebar or the hamburger toggle
- [ ] **Roadmap dates:** Step 1 `completed_at` matches `joined_at`, not first roadmap page visit — verify in DB for a student who joined before visiting roadmap
- [ ] **Coach KPI view:** A coach can see their own student's KPI data, but cannot see data for a student assigned to a different coach
- [ ] **Calendar view:** Navigate to a month 5+ months ago for an active student — correct sessions displayed (not empty due to row limit)
- [ ] **outreach_count trigger:** If any `daily_reports` column is renamed, verify coaches can still mark reports reviewed after migration (no 500 error)
- [ ] **New RLS tables:** Any new table has all role SELECT policies — verify by querying as an authenticated student role, not service role
- [ ] **TypeScript:** `npx tsc --noEmit` passes after every `config.ts` change — confirmed before moving to the next plan

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Break timer corrupted `started_at` for active sessions | MEDIUM | Migration: recalculate affected sessions using `completed_at - duration_minutes`; mark sessions with impossible timestamps as abandoned |
| NOT NULL migration failed midway on live data | HIGH | Roll back migration; add column as nullable; backfill in separate step; add constraint last |
| `outreach_count` rename broke `restrict_coach_report_update` trigger | LOW | Hotfix migration updating trigger function to reference new column name; no data loss |
| Calendar showing empty data due to 120-row limit | LOW | Add `?month` param and date-bounded queries; no data migration needed |
| Step 1 `completed_at` shows wrong date for all existing students | LOW | One-time backfill: `UPDATE roadmap_progress SET completed_at = users.joined_at WHERE step_number = 1` |
| Lifetime outreach sum causing timeouts | MEDIUM | Add Postgres RPC function; update server component query; no data migration needed |
| New table has RLS enabled but no policies (empty results) | LOW | Add missing policies via migration; no data loss; no schema change |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Break timer invalidates resume math | Flexible work sessions | Manual test: start session, take break, resume, complete — `duration_minutes` matches selected duration |
| `cyclesPerDay` cap breaks 5+ references | Flexible work sessions | `grep -r "cyclesPerDay"` shows 0 un-updated references; `npx tsc --noEmit` passes |
| NOT NULL column migration fails on live data | DB schema migration | Test migration against a DB seeded with existing work_sessions rows |
| Unique index blocks flexible sessions | DB schema migration | Start, abandon, restart same cycle slot on same day — no 409 error |
| N+1 outreach aggregate | Progress KPI / outreach tracking | Network payload for KPI banner is under 200 bytes even for students with 200+ reports |
| Calendar over-fetch (120-row limit) | Calendar view | Navigate to 6-month-old month — correct data shown, no empty-due-to-limit |
| Sticky banner z-index conflict | Progress KPI / sticky banner | Mobile test with sidebar open — no overlap with sidebar or hamburger |
| `outreach_count` deprecation breaks trigger | Daily report schema migration | Coach marks report reviewed after migration — HTTP 200, no 500 error |
| Timezone mismatch in deadline computation | Roadmap date KPIs | Deadline status same for UTC+5 and UTC-5 test accounts on same calendar day |
| RLS missing on new tables | Any phase adding a new table | Authenticated student query returns owned data; non-owned student data blocked |
| Config.ts change breaks TypeScript | Flexible work sessions | `npx tsc --noEmit` passes before each plan is marked complete |
| Seed sets wrong Step 1 `completed_at` | Roadmap date KPIs | Step 1 `completed_at` in DB matches `users.joined_at` for all students |

---

## Sources

- Direct codebase analysis: `src/app/api/work-sessions/route.ts` (Zod `max(cyclesPerDay)` bound)
- Direct codebase analysis: `src/app/api/work-sessions/[id]/route.ts` (resume shift logic lines 91-97, abandon delete lines 99-110)
- Direct codebase analysis: `src/components/student/WorkTrackerClient.tsx` (allComplete logic, cyclesPerDay references)
- Direct codebase analysis: `src/components/student/WorkTimer.tsx` (startedAt-based elapsed computation)
- Direct codebase analysis: `supabase/migrations/00001_create_tables.sql` (unique index line 97, NOT NULL constraints, trigger functions lines 391-432, RLS policies)
- Direct codebase analysis: `src/app/(dashboard)/layout.tsx` (sidebar z-50, main pt-16/ml-60 offsets)
- Direct codebase analysis: `src/components/layout/Sidebar.tsx` (z-50 usage, mobile overlay)
- Direct codebase analysis: `src/app/(dashboard)/coach/students/[studentId]/page.tsx` (120-row sessions limit, 20-row reports limit)
- Direct codebase analysis: `src/app/(dashboard)/student/roadmap/page.tsx` (lazy seed sets completed_at = now() for step 1)
- Direct codebase analysis: `src/lib/config.ts` (cyclesPerDay: 4, all WORK_TRACKER references)
- Direct codebase analysis: `src/lib/utils.ts` (getToday local-time behavior)
- Postgres documentation: `ADD COLUMN NOT NULL` behavior in Postgres 11+ (metadata-only for constant DEFAULTs, Postgres 15 on Supabase)
- Supabase documentation: RLS policy behavior (default-deny; silent empty result when no policy matches)

---
*Pitfalls research for: IMA Accelerator v1.1 — flexible sessions, outreach KPIs, calendar view, roadmap deadlines added to existing platform*
*Researched: 2026-03-27*
