# Phase 21: Write Path & Pre-Aggregation - Research

**Researched:** 2026-03-30
**Domain:** pg_cron pre-aggregation, React 19 useOptimistic, write path audit
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Summary Table Schema (WRITE-01)**
- D-01: Create `student_kpi_summaries` table with columns: `student_id` (PK, FK → users), `total_brands_contacted`, `total_influencers_contacted`, `total_hours_worked`, `total_calls_joined`, `total_reports`, `last_active_date`, `current_streak`, `last_report_date`, `updated_at`
- D-02: `current_streak` = consecutive calendar days with a daily_reports row, counting backward from the most recent report. Resets to 0 if gap detected.
- D-03: `total_reports` included for coach analytics "report rate" (reports / days in program)

**Aggregation Strategy (WRITE-01)**
- D-04: Incremental aggregation — only recompute students where `daily_reports.date >= student_kpi_summaries.last_report_date`
- D-05: Bootstrap detection — full compute for students with no summary row yet; incremental after
- D-06: pg_cron job at 2 AM UTC (6 AM UAE); `refresh_student_kpi_summaries()` uses `pg_try_advisory_lock()`; idempotent upsert via `INSERT ... ON CONFLICT (student_id) DO UPDATE`

**Dashboard Switchover**
- D-07: Phase 20 RPCs (`get_owner_dashboard_stats`, `get_student_detail`, `get_sidebar_badges`) updated to read from `student_kpi_summaries` for aggregate KPI data
- D-08: Coach analytics page reads from summary table for report rate and outreach totals

**Optimistic UI (WRITE-02)**
- D-09: Keep existing fetch-based pattern at `/api/reports`. Add `useOptimistic` from React 19 on top — wrap fetch in `startTransition`, show optimistic state immediately, `router.refresh()` after success. On failure, optimistic state rolls back automatically and submit button re-enables.
- D-10: Show "Report submitted for today" banner optimistically before API responds; success toast on confirmation; error toast + rollback on failure

**Write Path Audit (WRITE-03)**
- D-11: Markdown document in the phase directory recording exact DB call count for `POST /api/reports` and the work session complete path (`PATCH /api/work-sessions/[id]`). Confirms no unnecessary round trips.

**Migration Strategy**
- D-12: Single migration file `00011_write_path.sql` for all Phase 21 SQL

### Claude's Discretion
- Exact column types and constraints on student_kpi_summaries (numeric precision, NOT NULL vs nullable)
- How refresh_student_kpi_summaries() computes streak (window function vs loop)
- Whether RPC updates go in the same migration or a separate one
- useOptimistic + startTransition wiring details in ReportForm
- Write path audit document format and level of detail

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRITE-01 | pg_cron nightly aggregation job pre-computes KPI summaries into a summary table after the 11 PM submission window (UTC-aware scheduling, advisory lock protected, idempotent upsert) | pg_cron patterns, advisory lock pattern, incremental aggregation with `last_report_date` sentinel, streak window function |
| WRITE-02 | Student daily report submission uses optimistic UI via React 19 useOptimistic for instant feedback | `useOptimistic` + `startTransition` wiring in ReportForm.tsx, rollback on API failure, `router.refresh()` for server ground truth |
| WRITE-03 | Write path audit documents report/session API call counts and confirms no unnecessary round trips | Exact DB call counts enumerated from reading route.ts files; audit document format defined |
</phase_requirements>

---

## Summary

Phase 21 adds three distinct deliverables to the existing Next.js 16 + Supabase platform: a nightly pg_cron pre-aggregation job feeding a `student_kpi_summaries` table, optimistic UI for report submission using React 19's `useOptimistic` hook, and a write path audit document. The database work is the most complex — it requires a carefully structured SQL migration with a `VOLATILE` (not `STABLE`) aggregate function that computes streak via window functions rather than a row-by-row loop, scheduled at 2 AM UTC.

The React optimistic UI work is straightforward given the existing ReportForm architecture: `useOptimistic` lifts from `ReportForm` to `ReportFormWrapper` (or stays in `ReportForm` with a new prop), `startTransition` wraps the fetch, and the page server component holds the "submitted" banner state which gets refreshed via `router.refresh()` after API success. The key pitfall is that `useOptimistic` state is local to the client — the "Report submitted for today" banner on `page.tsx` is a server-rendered element fed from server data, so optimistic display of that banner requires lifting state or duplicating the banner as a client-side element.

The write path audit is a pure documentation task after reading the two route files: `POST /api/reports` currently makes 3 DB calls (auth check + profile lookup + existing check + upsert = actually 4), and `PATCH /api/work-sessions/[id]` makes 3 DB calls (auth + profile + fetch session + update). Both paths are already optimal — no unnecessary round trips exist to remove.

**Primary recommendation:** Build the SQL migration first (table + function + cron), then wire useOptimistic into ReportForm, then write the audit doc. Treat dashboard switchover (D-07/D-08) as Wave 2 work after the summary table is verified to have correct data.

---

## Standard Stack

### Core (all already in project — no new npm installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | `useOptimistic`, `startTransition` | Built-in React 19 hooks — no new package |
| Next.js | 16.1.6 | `router.refresh()`, `revalidateTag()` | Already installed |
| Supabase JS | current | Admin client RPC calls | Already installed singleton at `src/lib/supabase/admin.ts` |
| react-hook-form | 7.71.2 | Existing form state in ReportForm | Already installed — keep, add useOptimistic alongside |
| pg_cron | 1.6.4 (Supabase platform) | Nightly aggregation scheduling | Supabase Pro platform extension — no npm package |

### No New Dependencies
This phase requires zero new npm packages. All capabilities are either React 19 built-ins, Next.js built-ins, or Supabase platform features.

**Verification:**
```bash
# These are already installed:
node -e "require('react'); console.log(require('react').version)"  # 19.2.3
# pg_cron: enable via Supabase Dashboard → Database → Extensions → pg_cron
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 21 additions)

```
supabase/
└── migrations/
    └── 00011_write_path.sql     # NEW — student_kpi_summaries, refresh function, cron job, RPC updates

src/components/student/
├── ReportForm.tsx               # MODIFIED — add useOptimistic + startTransition
└── ReportFormWrapper.tsx        # MODIFIED — pass optimistic handler or lift state

.planning/phases/21-write-path-pre-aggregation/
└── WRITE-PATH-AUDIT.md          # NEW — DB call count documentation (WRITE-03)
```

### Pattern 1: student_kpi_summaries Table Design

**Schema (Claude's Discretion for exact types):**
```sql
CREATE TABLE public.student_kpi_summaries (
  student_id             uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_brands_contacted integer      NOT NULL DEFAULT 0,
  total_influencers_contacted integer NOT NULL DEFAULT 0,
  total_hours_worked     numeric(8,2) NOT NULL DEFAULT 0,
  total_calls_joined     integer      NOT NULL DEFAULT 0,
  total_reports          integer      NOT NULL DEFAULT 0,
  last_active_date       date,                          -- NULL = never submitted
  current_streak         integer      NOT NULL DEFAULT 0,
  last_report_date       date,                          -- sentinel for incremental agg
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

-- No RLS needed — service_role (admin client) reads this table from RPCs
-- The table is populated by a SECURITY DEFINER function (pg_cron context)
ALTER TABLE public.student_kpi_summaries ENABLE ROW LEVEL SECURITY;

-- Owners and coaches can read summaries via RPCs (SECURITY DEFINER bypasses RLS)
-- Students have no direct access to this table
```

**Why `last_report_date` as sentinel:** On the next cron run, the function only needs to look at `daily_reports` where `date >= student_kpi_summaries.last_report_date - 1` (minus 1 day buffer for streak recalculation edge cases). This keeps the incremental query small even at 5k students.

### Pattern 2: refresh_student_kpi_summaries() Function

The aggregation function must be `VOLATILE` (not `STABLE`) because it modifies data. This is the established Phase 20 pattern inverted — Phase 20 RPCs are `STABLE` (read-only); the cron function is `VOLATILE` (writes).

**Streak computation — window function approach (Claude's Discretion: recommended over loop):**

Use a Postgres window function / date arithmetic approach rather than a PL/pgSQL loop. A loop over every student's report history is O(n reports per student) and holds locks longer. The window approach uses a single aggregating query per student batch:

```sql
-- Streak logic using date gaps
-- For a given student's reports ordered by date DESC:
-- streak = count of consecutive rows where date = LAG(date) - 1
WITH ranked AS (
  SELECT
    student_id,
    date,
    date - LAG(date) OVER (PARTITION BY student_id ORDER BY date ASC) AS gap
  FROM daily_reports
  WHERE student_id = p_student_id
    AND submitted_at IS NOT NULL
  ORDER BY date DESC
),
streak_groups AS (
  SELECT
    student_id,
    date,
    SUM(CASE WHEN gap > 1 OR gap IS NULL THEN 1 ELSE 0 END)
      OVER (PARTITION BY student_id ORDER BY date ASC) AS grp
  FROM ranked
)
-- Take size of the most recent unbroken group
SELECT COUNT(*) FROM streak_groups
WHERE grp = (SELECT MAX(grp) FROM streak_groups)
```

For implementation simplicity, a PL/pgSQL approach that iterates dates backward from `MAX(date)` is also acceptable — the advisory lock ensures only one run at a time, so lock contention is not a concern.

**Full function skeleton:**
```sql
CREATE OR REPLACE FUNCTION public.refresh_student_kpi_summaries()
RETURNS void
LANGUAGE plpgsql
VOLATILE                    -- writes data, must be VOLATILE not STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key  bigint := 2100210021;  -- stable integer key for this job
  v_student   RECORD;
  v_streak    integer;
  v_total_brands   bigint;
  v_total_influencers bigint;
  v_total_hours    numeric;
  v_total_calls    bigint;
  v_total_reports  bigint;
  v_last_active    date;
  v_last_report    date;
BEGIN
  -- Advisory lock: skip if already running (prevents overlap)
  IF NOT pg_try_advisory_lock(v_lock_key) THEN
    RAISE NOTICE 'refresh_student_kpi_summaries: already running, skipping';
    RETURN;
  END IF;

  BEGIN  -- inner block so EXCEPTION releases the lock
    FOR v_student IN
      SELECT
        u.id AS student_id,
        s.last_report_date AS existing_last_report_date
      FROM users u
      LEFT JOIN student_kpi_summaries s ON s.student_id = u.id
      WHERE u.role = 'student' AND u.status = 'active'
    LOOP
      -- Compute aggregates (full scan on bootstrap, incremental on subsequent runs)
      SELECT
        COALESCE(SUM(brands_contacted), 0),
        COALESCE(SUM(influencers_contacted), 0),
        COALESCE(SUM(hours_worked), 0),
        COALESCE(SUM(calls_joined), 0),
        COUNT(*),
        MAX(date)
      INTO
        v_total_brands, v_total_influencers, v_total_hours,
        v_total_calls, v_total_reports, v_last_active
      FROM daily_reports
      WHERE student_id = v_student.student_id
        AND submitted_at IS NOT NULL;
        -- Incremental: on bootstrap v_existing_last_report_date is NULL
        -- so no WHERE date >= filter needed on first run (full compute)
        -- For incremental, totals are re-summed from scratch for correctness
        -- (safer than delta arithmetic given edge cases like report updates)

      -- Compute streak
      -- [streak computation via PL/pgSQL date walk or window query]
      SELECT compute_streak_for_student(v_student.student_id)
      INTO v_streak;

      v_last_report := v_last_active;  -- track latest report date as sentinel

      -- Idempotent upsert
      INSERT INTO student_kpi_summaries (
        student_id, total_brands_contacted, total_influencers_contacted,
        total_hours_worked, total_calls_joined, total_reports,
        last_active_date, current_streak, last_report_date, updated_at
      ) VALUES (
        v_student.student_id, v_total_brands, v_total_influencers,
        v_total_hours, v_total_calls, v_total_reports,
        v_last_active, v_streak, v_last_report, now()
      )
      ON CONFLICT (student_id) DO UPDATE SET
        total_brands_contacted      = EXCLUDED.total_brands_contacted,
        total_influencers_contacted = EXCLUDED.total_influencers_contacted,
        total_hours_worked          = EXCLUDED.total_hours_worked,
        total_calls_joined          = EXCLUDED.total_calls_joined,
        total_reports               = EXCLUDED.total_reports,
        last_active_date            = EXCLUDED.last_active_date,
        current_streak              = EXCLUDED.current_streak,
        last_report_date            = EXCLUDED.last_report_date,
        updated_at                  = now();

    END LOOP;

    PERFORM pg_advisory_unlock(v_lock_key);

  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_advisory_unlock(v_lock_key);
    RAISE;
  END;
END;
$$;
```

**Important note on incremental vs. full re-sum:** D-04 specifies incremental aggregation. However, for correctness (report updates modify existing rows, not just insert new ones), the safest implementation re-sums ALL rows for each student each run rather than applying a delta. At 5k students with 180 days average history, the `daily_reports` table has ~900k rows. With the composite index `(student_id, date)` from Phase 19, a per-student SUM is an index range scan — very fast. The advisory lock ensures no overlap so the job duration stays predictable. The `last_report_date` sentinel can be used to skip students who have no new reports since last run (as an optimization), but the SUM itself should always be total lifetime, not incremental delta.

### Pattern 3: pg_cron Job Registration

```sql
-- Schedule: 0 2 * * * = 2:00 AM UTC = 6:00 AM UAE (UTC+4, GST)
-- Runs after all students have submitted (11 PM UAE = 19:00 UTC deadline)
-- Verified: pg_cron is UTC-only (see PITFALLS.md Pitfall 5)
SELECT cron.schedule(
  'refresh-student-kpi-summaries',   -- job name (must be unique)
  '0 2 * * *',                        -- 2 AM UTC = 6 AM UAE
  $$SELECT public.refresh_student_kpi_summaries()$$
);

COMMENT ON TABLE public.student_kpi_summaries IS
  'Pre-aggregated KPI summaries per student. Refreshed nightly at 2 AM UTC (6 AM UAE) by pg_cron job ''refresh-student-kpi-summaries''. Advisory lock key: 2100210021.';
```

**Idempotency for migration re-runs:** pg_cron schedule names must be unique. Use `SELECT cron.unschedule('refresh-student-kpi-summaries') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-student-kpi-summaries')` before scheduling in the migration to make it re-runnable.

### Pattern 4: React 19 useOptimistic in ReportForm

**Current architecture:**
- `page.tsx` (server) — fetches `report` and `autoMinutes`, renders "Report submitted for today" banner based on `report?.submitted_at`
- `ReportFormWrapper.tsx` (client) — holds `router.refresh()` in `onSuccess` callback
- `ReportForm.tsx` (client) — form state, fetch call, toast notifications

**The challenge:** The "Report submitted for today" banner lives in the server component (`page.tsx`). `useOptimistic` can only control client-side state. To show the banner optimistically, the banner must move to a client component or a new client wrapper must gate its display.

**Recommended approach (minimal disruption):**
Move the "submitted" banner render into `ReportFormWrapper.tsx` as a client-side optimistic state. Pass `existingReport` to the wrapper. The wrapper tracks `optimisticSubmitted` state via `useOptimistic`. On form success, the optimistic banner appears immediately; `router.refresh()` then syncs the server state so subsequent navigations show the correct banner from the server.

```typescript
// ReportFormWrapper.tsx (updated)
"use client";
import { useOptimistic, startTransition } from "react";
import { useRouter } from "next/navigation";
import { ReportForm } from "./ReportForm";
import type { Database } from "@/lib/types";

type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];

interface ReportFormWrapperProps {
  date: string;
  existingReport: DailyReport | null;
  autoMinutes: number;
}

export function ReportFormWrapper({
  date,
  existingReport,
  autoMinutes,
}: ReportFormWrapperProps) {
  const router = useRouter();
  // Optimistic state: null = use server state, "submitted" = show banner immediately
  const [optimisticReport, addOptimistic] = useOptimistic(
    existingReport,
    (_current, optimisticValue: DailyReport | null) => optimisticValue
  );

  const handleSuccess = (submittedReport: DailyReport) => {
    startTransition(() => {
      addOptimistic(submittedReport);
    });
    // router.refresh() fetches server ground truth after API succeeds
    router.refresh();
  };

  return (
    <>
      {/* Optimistic submitted banner — shown immediately on success */}
      {optimisticReport?.submitted_at && (
        <SubmittedBanner />
      )}
      <ReportForm
        date={date}
        existingReport={existingReport}
        autoMinutes={autoMinutes}
        onSuccess={handleSuccess}
      />
    </>
  );
}
```

**ReportForm change:** `onSuccess` prop changes from `() => void` to `(report: DailyReport) => void` so the wrapper can receive the submitted report to feed into `addOptimistic`. The API route already returns `{ data: report }` — extract and pass up.

**Rollback:** `useOptimistic` automatically reverts to the base state (`existingReport`) when the component re-renders with new server data from `router.refresh()` if the API call failed. The `setSubmitting(false)` call in the `finally` block of `ReportForm.onSubmit` re-enables the button on failure — this is already wired.

**startTransition requirement:** `addOptimistic` must be called inside `startTransition`. This marks the update as non-urgent and allows React to interrupt it if needed.

**Constraint from CLAUDE.md:** The wrapper is a client component. The banner must use `ima-*` color tokens (not hardcoded hex). The existing banner in `page.tsx` already uses `text-ima-success`, `bg-ima-success/10`, `border-l-ima-success` — copy those tokens exactly.

### Pattern 5: Dashboard Switchover RPCs (D-07/D-08)

The Phase 20 RPC functions currently compute aggregates live from `daily_reports`. After the summary table is populated, they should read from `student_kpi_summaries` instead.

**`get_owner_dashboard_stats`** — currently uses COUNT(*) from daily_reports for `reports_today`. This is a today-scoped query, not a lifetime aggregate, so it should NOT use the summary table. The summary table stores lifetime totals, not daily counts. Keep `reports_today` as a live query.

**`get_student_detail`** — currently computes `lifetime_outreach` as `SUM(brands_contacted + influencers_contacted)` from all daily_reports for the student. This is a direct candidate for summary table lookup:
```sql
-- Before (live query)
SELECT COALESCE(SUM(brands_contacted + influencers_contacted), 0)
INTO v_lifetime_outreach FROM daily_reports WHERE student_id = p_student_id;

-- After (summary table lookup)
SELECT COALESCE(total_brands_contacted + total_influencers_contacted, 0)
INTO v_lifetime_outreach FROM student_kpi_summaries WHERE student_id = p_student_id;
```

**Coach analytics page (D-08)** — currently fetches all daily_reports for the coach's students over 7 days and computes aggregates in TypeScript. The summary table `total_reports` enables a server-side pre-computed report rate. However, the 7-day window metric is NOT what the summary table stores (it stores lifetime totals). The coach analytics page's `submissionRate` is 7-day-window scoped, so it still needs a live `daily_reports` query. The summary table CAN replace the lifetime outreach calculation if it were added, but coach analytics currently does NOT show lifetime outreach — it shows 7-day averages. D-08 is partially applicable; the planner should scope this carefully.

### Anti-Patterns to Avoid

- **`STABLE` on a write function:** The aggregation function modifies data — it must be `VOLATILE`. Using `STABLE` on a write function causes undefined behavior in Postgres.
- **Delta arithmetic for incremental aggregation:** Storing and applying deltas (e.g., `total_brands += new_brands_today`) is fragile when reports can be updated (not just inserted). Always re-SUM from the base data for correctness.
- **`DELETE + INSERT` instead of `UPSERT`:** A partial run interrupted mid-delete would leave a student with no summary row. Use `INSERT ... ON CONFLICT DO UPDATE` exclusively.
- **`useOptimistic` outside `startTransition`:** Calling `addOptimistic` outside `startTransition` throws a React warning and may not work correctly in concurrent mode.
- **Forgetting `router.refresh()` after API success:** Without `router.refresh()`, the server component `page.tsx` keeps showing its initial server-rendered state (not submitted). The banner would stay shown by `useOptimistic` but the form would still show "Update Report" rather than the correct server state.
- **Scheduling pg_cron in local time:** pg_cron interprets ALL schedules as UTC. `'0 6 * * *'` means 6 AM UTC (10 AM UAE), not 6 AM UAE. Always calculate UTC equivalent explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overlap prevention in cron jobs | Custom "is_running" flag table | `pg_try_advisory_lock()` | Advisory locks are session-scoped (auto-release on crash), atomic, and don't require a separate table or cleanup job |
| Optimistic state management | Custom `useState` + `isPending` boolean | `useOptimistic` from React 19 | Built-in React hook with automatic rollback on re-render — no manual rollback logic needed |
| Report submission feedback | Polling `router.refresh()` in a loop | `useOptimistic` + single `router.refresh()` after success | One refresh after API success is sufficient; polling is wasteful |
| Streak calculation in application code | Computing streak in TypeScript from a list of report dates | SQL window function in the aggregation function | Computing in SQL avoids a DB round trip; data is already in Postgres |

**Key insight:** The advisory lock pattern is the standard Postgres idiom for single-instance cron jobs. Any custom "distributed lock" built on top of the application table will have edge cases that `pg_try_advisory_lock` handles by design (crash recovery, session cleanup).

---

## Write Path Audit (WRITE-03 Pre-Research)

The audit document must enumerate exact DB calls. Based on reading the current route files:

### POST /api/reports (report submission)

| Call # | Operation | Query | Necessary? |
|--------|-----------|-------|-----------|
| 1 | Auth check | `supabase.auth.getUser()` — user client | Yes — JWT validation |
| 2 | Profile lookup | `admin.from("users").select("id, role").eq("auth_id", ...).single()` | Yes — need `profile.id` for student_id, role check |
| 3 | Existing report check | `admin.from("daily_reports").select("id").eq("student_id",...).eq("date",...).maybeSingle()` | Yes — determines INSERT vs UPDATE |
| 4 | Report upsert | `admin.from("daily_reports").insert(...)` or `.update(...)` | Yes — the mutation |

**Total: 4 DB calls.** No unnecessary round trips. The existing check (call 3) is required because the route supports both creation and update (idempotent by design for the student's daily report).

**Note:** `revalidateTag("badges", "default")` is NOT a DB call — it invalidates the Next.js cache only.

### PATCH /api/work-sessions/[id] (session complete)

| Call # | Operation | Query | Necessary? |
|--------|-----------|-------|-----------|
| 1 | Auth check | `supabase.auth.getUser()` — user client | Yes — JWT validation |
| 2 | Profile lookup | `admin.from("users").select("id, role").eq("auth_id", ...).single()` | Yes — need profile.id for student_id filter |
| 3 | Session fetch | `admin.from("work_sessions").select("*").eq("id",...).eq("student_id",...).single()` | Yes — need current status for transition validation and timing calculations |
| 4 | Session update | `admin.from("work_sessions").update(...).eq("id",...).select().single()` | Yes — the mutation |

**Total: 4 DB calls.** No unnecessary round trips. The session fetch (call 3) is required to validate the state transition and to compute `newStartedAt` on resume from pause.

**Conclusion:** Both write paths are already optimal. The audit document confirms this — no refactoring is needed for WRITE-03, only documentation.

---

## Common Pitfalls

### Pitfall 1: pg_cron UTC-Only Scheduling
**What goes wrong:** Scheduling `'0 6 * * *'` intending "6 AM UAE" runs at 6 AM UTC = 10 AM UAE. The aggregation runs 4 hours late.
**Why it happens:** pg_cron ignores session timezone settings. All cron expressions are UTC.
**How to avoid:** Always compute the UTC equivalent explicitly. UAE is UTC+4 (GST). 6 AM UAE = 2 AM UTC. Use `'0 2 * * *'` and add a SQL comment: `-- 2 AM UTC = 6 AM UAE (GST, UTC+4)`.
**Warning signs:** `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5` shows runs at unexpected UTC hours.

### Pitfall 2: pg_cron Job Overlap Without Advisory Lock
**What goes wrong:** If the nightly job takes longer than its interval (unlikely but possible under high student count), two instances run simultaneously and double-count aggregates.
**Why it happens:** pg_cron fires new instances regardless of previous run status.
**How to avoid:** `pg_try_advisory_lock()` at the top of `refresh_student_kpi_summaries()` with `EXCEPTION WHEN OTHERS THEN pg_advisory_unlock()` in the error handler.
**Warning signs:** `student_kpi_summaries.total_reports` is double the count in `daily_reports` for the same student.

### Pitfall 3: Migration Doesn't Handle pg_cron Job Idempotency
**What goes wrong:** Re-running the migration creates a second pg_cron job with the same name, resulting in the function running twice per night.
**Why it happens:** `cron.schedule()` inserts a new row in `cron.job` each call without checking for existing entries.
**How to avoid:** Wrap with `SELECT cron.unschedule('refresh-student-kpi-summaries') FROM cron.job WHERE jobname = 'refresh-student-kpi-summaries'` before the `cron.schedule()` call. Use a DO block:
```sql
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-student-kpi-summaries');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule('refresh-student-kpi-summaries', '0 2 * * *', $$...$$);
```
**Warning signs:** `SELECT * FROM cron.job WHERE jobname = 'refresh-student-kpi-summaries'` returns more than 1 row.

### Pitfall 4: useOptimistic Outside startTransition
**What goes wrong:** Calling `addOptimistic()` outside `startTransition` throws a React warning in development and may not apply the update in concurrent rendering mode.
**Why it happens:** `useOptimistic` is designed for use with React's concurrent features — it requires `startTransition` to mark the update as interruptible.
**How to avoid:** Always wrap `addOptimistic()` in `startTransition(() => { addOptimistic(value) })`.
**Warning signs:** React console warning: "An optimistic update was triggered outside of a transition".

### Pitfall 5: Banner Lives in Server Component — Optimistic State Can't Reach It
**What goes wrong:** `page.tsx` renders the "Report submitted for today" banner based on `report?.submitted_at`. This is server-rendered. `useOptimistic` in `ReportFormWrapper` cannot make the server component re-render.
**Why it happens:** Server components render on the server — client-side state changes don't affect them until `router.refresh()` triggers a new server fetch.
**How to avoid:** Move the submitted/not-submitted banner render into the client component (`ReportFormWrapper`). Pass `existingReport` as a prop. The wrapper shows the banner based on `optimisticReport?.submitted_at` (optimistic state). The server component's banner becomes the fallback for non-JS environments or can be removed.
**Warning signs:** Submit button succeeds but "Report submitted" banner doesn't appear until the page hard-refreshes.

### Pitfall 6: STABLE vs VOLATILE on Write Functions
**What goes wrong:** Marking `refresh_student_kpi_summaries()` as `STABLE` (like the Phase 20 RPCs) causes Postgres to refuse to run it from pg_cron because `STABLE` functions cannot modify data. Or it silently caches the result and doesn't write anything.
**Why it happens:** Phase 20 established `SECURITY DEFINER STABLE` as the RPC pattern. The aggregation function is structurally similar but semantically different — it writes.
**How to avoid:** `VOLATILE` is the correct volatility marker for any function that modifies data. Only use `STABLE` for pure reads.

### Pitfall 7: RPC Updates Failing Because student_kpi_summaries is Empty on First Run
**What goes wrong:** D-07 updates the Phase 20 RPCs to read from `student_kpi_summaries`. If the migration deploys but the cron job has not run yet (up to 24 hours), the table is empty. Dashboards show all zeros for student KPIs.
**Why it happens:** The table is populated by pg_cron. Between migration deployment and first cron run, no rows exist.
**How to avoid:** After creating the table in the migration, immediately call `SELECT public.refresh_student_kpi_summaries()` to bootstrap the data synchronously. This takes a few seconds but ensures the table is populated on deploy.
**Warning signs:** Owner dashboard shows 0 total outreach for all students immediately after migration deployment.

---

## Code Examples

### pg_cron Advisory Lock Pattern (from PITFALLS.md)
```sql
-- Source: .planning/research/PITFALLS.md Pitfall 6
CREATE OR REPLACE FUNCTION aggregate_daily_kpis()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT pg_try_advisory_lock(12345) THEN
    RAISE NOTICE 'aggregate_daily_kpis: already running, skipping';
    RETURN;
  END IF;
  -- ... do aggregation work ...
  PERFORM pg_advisory_unlock(12345);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(12345);
  RAISE;
END;
$$;
```

### pg_cron Scheduling with UTC Comment
```sql
-- Source: .planning/research/PITFALLS.md Pitfall 5
-- Always document UTC → local time conversion in comments
SELECT cron.schedule('job-name', '0 2 * * *',
  $$SELECT public.refresh_student_kpi_summaries()$$);
-- 0 2 * * * = 2:00 AM UTC = 6:00 AM UAE (GST, UTC+4)
```

### React 19 useOptimistic Basic Pattern
```typescript
// Source: React 19 official docs — https://react.dev/reference/react/useOptimistic
import { useOptimistic, startTransition } from "react";

function Component({ serverState }) {
  const [optimisticState, addOptimistic] = useOptimistic(
    serverState,
    (current, newValue) => newValue  // updater function
  );

  const handleAction = async () => {
    // Show optimistic update immediately
    startTransition(() => {
      addOptimistic(optimisticValue);
    });

    // Make API call
    const result = await fetch("/api/action", { method: "POST" });
    if (!result.ok) {
      // useOptimistic auto-reverts when component re-renders with original serverState
      return;
    }
    // On success: router.refresh() fetches new server state, which replaces optimistic
    router.refresh();
  };
}
```

### INSERT ... ON CONFLICT DO UPDATE (Idempotent Upsert)
```sql
-- Source: PostgreSQL docs — standard upsert pattern for summary tables
INSERT INTO student_kpi_summaries (student_id, total_reports, updated_at)
VALUES (p_student_id, v_total, now())
ON CONFLICT (student_id) DO UPDATE SET
  total_reports = EXCLUDED.total_reports,
  updated_at    = now();
```

### Migrating pg_cron Job Idempotently
```sql
-- Source: .planning/research/PITFALLS.md Pitfall pattern (pg_cron unschedule)
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-student-kpi-summaries');
EXCEPTION WHEN OTHERS THEN NULL;  -- OK if job doesn't exist yet
END;
$$;

SELECT cron.schedule(
  'refresh-student-kpi-summaries',
  '0 2 * * *',  -- 2:00 AM UTC = 6:00 AM UAE (GST, UTC+4)
  $$SELECT public.refresh_student_kpi_summaries()$$
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React `useState` + manual pending flag | `useOptimistic` + `startTransition` | React 18.3+ (stable in React 19) | Automatic rollback on re-render; no manual reset code needed |
| Nightly pg_cron full recompute | Incremental with `last_report_date` sentinel | This project decision (D-04) | Keeps cron job under advisory lock window at scale |
| Phase 20 RPCs compute live SUM/COUNT | RPCs read from `student_kpi_summaries` | Phase 21 (this phase) | Eliminates repeated aggregation queries on dashboard load |

**Note on `useOptimistic` stability:** As of React 19.2.3 (confirmed installed), `useOptimistic` is a stable API (not experimental). It was introduced in React 18 as experimental and stabilized in React 19. Source: https://react.dev/reference/react/useOptimistic

---

## Open Questions

1. **Streak computation precision**
   - What we know: D-02 specifies "consecutive calendar days counting backward from most recent report; resets to 0 if gap detected"
   - What's unclear: Should a report submitted for a past date (e.g., student submits Monday's report on Tuesday) count toward the streak? The `date` field is the report's date, not `submitted_at`. This is an edge case for the streak window query.
   - Recommendation: Count by `date` field (the day the work was done), not `submitted_at` (the timestamp of submission). This is the more meaningful metric and what D-02 implies.

2. **Bootstrap call in migration**
   - What we know: Pitfall 7 above shows that RPCs reading an empty `student_kpi_summaries` will return zeros on the day of deployment
   - What's unclear: Can `SELECT public.refresh_student_kpi_summaries()` be called inline in a Supabase migration? In Supabase, migrations run as Postgres superuser — calling the function should work. But if there are 5k students at deploy time, this synchronous call may take 30+ seconds.
   - Recommendation: Include the bootstrap call in the migration as the last statement. If the platform has few students at deploy time (likely), it's instant. Document the caveat.

3. **Coach analytics page scope for D-08**
   - What we know: D-08 says "Coach analytics page reads from summary table for report rate and outreach totals." The current analytics page computes 7-day window metrics in TypeScript from live query results. The summary table stores lifetime totals, not 7-day windows.
   - What's unclear: Does D-08 mean add lifetime outreach totals to the coach analytics page (new feature), or replace an existing query that happens to match summary table data?
   - Recommendation: The planner should scope D-08 as "read `total_reports` from summary table to compute coach-level report rate (reports / days in program)" — a single RPC call replaces the current multi-query approach only where the data shapes align. The 7-day window metrics remain live queries.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | Yes | v24.13.0 | — |
| React 19 `useOptimistic` | WRITE-02 | Yes | 19.2.3 | — |
| Next.js App Router | All routes | Yes | 16.1.6 | — |
| pg_cron extension | WRITE-01 | Verify in Supabase Dashboard | 1.6.4 on Pro plan | Cannot schedule cron without it — must enable before migration |
| pg_stat_statements | Monitoring | Enabled in Phase 19 | — | — |
| Supabase Pro plan | pg_cron availability | Assumed (Phase 19 confirmed Pro) | — | — |

**Missing dependencies with no fallback:**
- pg_cron must be enabled in Supabase Dashboard → Database → Extensions before the migration runs. The migration's `SELECT cron.schedule(...)` call will fail with `ERROR: function cron.schedule(...) does not exist` if the extension is not enabled. This is a manual prerequisite step — the planner must include it as Wave 0.

**Missing dependencies with fallback:**
- None.

---

## Project Constraints (from CLAUDE.md)

These directives apply to all code produced in this phase:

| Constraint | Impact on Phase 21 |
|------------|-------------------|
| `motion-safe:` on all `animate-*` classes | Optimistic UI state changes must not use animation without `motion-safe:` prefix |
| 44px touch targets on all interactive elements | Submit button in ReportForm already uses `h-11` — verify banner dismiss buttons if any are added |
| Accessible labels on all inputs | No new inputs added in this phase — existing form untouched |
| Admin client only in API routes / server code | `refresh_student_kpi_summaries()` is called from pg_cron (Postgres internal) — no client exposure. RPC updates go through existing `createAdminClient()` singleton. |
| Never swallow errors — every `catch` block must toast or `console.error` | `ReportForm.onSubmit` catch block already calls `toast({ type: "error" })` — verify after useOptimistic integration |
| `check response.ok` before parsing JSON | `ReportForm.onSubmit` already checks `if (!res.ok)` — verify after refactor |
| `import { z } from "zod"` (never "zod/v4") | No new Zod usage in this phase — existing route schemas unchanged |
| `ima-*` tokens only — no hardcoded hex/gray | Optimistic banner must copy tokens from existing banner: `text-ima-success`, `bg-ima-success/10`, `border-l-ima-success` |
| `px-4` on all page wrappers | No new pages added in this phase |
| Stable `useCallback` deps — use refs for toast/router | `router.refresh()` in `handleSuccess` should use a ref if added to `useCallback` dependencies |
| Config is truth — import from `src/lib/config.ts` | KPI summary table column names must align with config constants (KPI_TARGETS, etc.) |
| Admin client only in server code — never in client components | `student_kpi_summaries` is read exclusively through RPC functions — never directly from client |
| `SECURITY DEFINER` with `SET search_path = public` on all RPC functions | `refresh_student_kpi_summaries()` must include `SET search_path = public` |
| Single migration file per phase (D-12) | All Phase 21 SQL in `00011_write_path.sql` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Next.js built-in (no separate test runner detected in project) |
| Config file | None found — project uses manual UAT via GSD verifier |
| Quick run command | `npm run build && npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run build && npm run lint && npx tsc --noEmit` |

**Note:** No automated test files detected in this project. Validation is performed via UAT checklists in the GSD verifier phase. The build + lint + tsc pipeline is the automated gate.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRITE-01 | `student_kpi_summaries` table exists with correct schema | manual (DB inspection) | `npx tsc --noEmit` for TypeScript types | N/A — DB table |
| WRITE-01 | `refresh_student_kpi_summaries()` function exists and produces correct rows | manual (SQL query in Supabase Studio) | — | N/A — DB function |
| WRITE-01 | pg_cron job `refresh-student-kpi-summaries` registered at `0 2 * * *` | manual (`SELECT * FROM cron.job`) | — | N/A — DB cron |
| WRITE-01 | Phase 20 RPCs updated to read from summary table | manual (run RPC, compare output) | `npm run build` catches type errors | N/A — DB function |
| WRITE-02 | Optimistic "submitted" banner appears before API returns | manual (browser DevTools: throttle network to Slow 3G, submit form) | `npm run build` (no TypeScript errors) | N/A — manual |
| WRITE-02 | API failure rolls back optimistic state and re-enables submit button | manual (mock API failure in DevTools or block /api/reports) | `npm run build` | N/A — manual |
| WRITE-03 | Audit document exists with correct DB call counts | manual (read the document, compare against route.ts) | — | ❌ Wave 0: create `.planning/phases/21-write-path-pre-aggregation/WRITE-PATH-AUDIT.md` |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual UAT checklist before `/gsd:verify-work`

### Wave 0 Gaps
- No new test files needed. Existing build pipeline is sufficient for automated validation.
- Manual UAT steps for WRITE-02 must be documented in the verifier checklist.
- pg_cron extension must be enabled in Supabase Dashboard **before** the migration runs (Wave 0 prerequisite step).

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis — `src/app/api/reports/route.ts` — DB call audit for WRITE-03
- Codebase analysis — `src/app/api/work-sessions/[id]/route.ts` — DB call audit for WRITE-03
- Codebase analysis — `src/components/student/ReportForm.tsx` — useOptimistic integration target
- Codebase analysis — `supabase/migrations/00010_query_consolidation.sql` — Phase 20 RPC patterns
- `.planning/research/PITFALLS.md` — pg_cron UTC-only pitfall (Pitfall 5), advisory lock pattern (Pitfall 6)
- `.planning/research/STACK.md` — pg_cron platform version, `useOptimistic` as React 19 built-in
- `.planning/phases/21-write-path-pre-aggregation/21-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- React 19 `useOptimistic` API — stable hook confirmed in React 19.2.3 (installed): https://react.dev/reference/react/useOptimistic
- pg_cron Supabase documentation — UTC-only scheduling confirmed by PITFALLS.md which references Supabase community discussions

### Tertiary (LOW confidence)
- Streak computation via window function — standard SQL pattern, verified as applicable to date-series problems; exact implementation left to Claude's Discretion per CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified installed (React 19.2.3, Next.js 16.1.6)
- Architecture patterns: HIGH — based on reading actual target files (ReportForm.tsx, route.ts, migration 00010)
- DB function design: HIGH — follows established Phase 20 pattern; volatility and advisory lock patterns from verified PITFALLS.md
- useOptimistic wiring: HIGH — React 19 stable API; code skeleton derived from reading ReportFormWrapper architecture
- Pitfalls: HIGH — primary sources (PITFALLS.md written from Supabase official docs + PostgREST docs)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — React 19 and pg_cron patterns are not fast-moving)
