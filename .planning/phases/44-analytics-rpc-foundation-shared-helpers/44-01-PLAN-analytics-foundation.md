---
phase: 44-analytics-rpc-foundation-shared-helpers
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00021_analytics_foundation.sql
  - src/lib/config.ts
autonomous: true
requirements:
  - PERF-01
  - PERF-03
  - PERF-04
  - PERF-07
  - PERF-08

must_haves:
  truths:
    - "Calling week_start('2026-04-12'::date) (a Sunday) returns 2026-04-06 (the prior Monday)"
    - "Calling week_start('2026-04-13'::date) (a Monday) returns 2026-04-13"
    - "Calling week_start('2026-04-15'::date) (a Wednesday) returns 2026-04-13"
    - "Calling student_activity_status(<student>, CURRENT_DATE) returns 'inactive' when the student has zero completed work_sessions and zero submitted daily_reports in the last 7 days"
    - "Calling student_activity_status(<student>, CURRENT_DATE) returns 'active' when the student has at least one completed work_session OR one submitted daily_report with date >= CURRENT_DATE - 6"
    - "TypeScript consumer can import ACTIVITY from '@/lib/config' and read ACTIVITY.inactiveAfterDays === 7"
    - "EXPLAIN ANALYZE on `SELECT * FROM deals WHERE student_id = $1 ORDER BY created_at DESC LIMIT 25` shows an index scan of idx_deals_student_created (or empty-table equivalent)"
    - "EXPLAIN ANALYZE on `SELECT sum(duration_minutes) FROM work_sessions WHERE student_id = $1 AND date >= $2 AND status = 'completed'` shows an index scan of idx_work_sessions_completed_student_date"
    - "EXPLAIN ANALYZE on `SELECT status, count(*) FROM roadmap_progress WHERE student_id = $1 GROUP BY status` shows an index scan of idx_roadmap_progress_student_status"
    - "npm run lint && npx tsc --noEmit && npm run build exits 0 after all changes"
  artifacts:
    - supabase/migrations/00021_analytics_foundation.sql
    - src/lib/config.ts  # ACTIVITY const added
  key_links:
    - "config.ts ACTIVITY.inactiveAfterDays literal matches the hard-coded 7-day threshold inside student_activity_status (SYNC comment in both files)"
    - "week_start is called by downstream skip tracker, leaderboard, and trend-bucket RPCs in Phases 46-51"
    - "All three new indexes sit on tables referenced by v1.5 analytics RPCs — they are the only indexes Phase 44 owns"
---

<objective>
Lay the SQL + shared-TypeScript foundation that every v1.5 analytics consumer will reuse: a `week_start()` ISO-Monday helper, a `student_activity_status()` 7-day activity rule (D-14), the `ACTIVITY` config block mirroring that rule, and three hot-path indexes. After this plan, downstream phases (45-52) can assume the building blocks already exist.

Purpose: Backend-only foundation. No feature RPC, no UI, no API routes. Owns PERF-01 (hot-path indexes), PERF-03 (initplan convention), PERF-04 (SECURITY DEFINER STABLE pattern) for v1.5.
Output: One new migration file + one edited config.ts section.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/44-analytics-rpc-foundation-shared-helpers/44-CONTEXT.md
@.planning/phases/44-analytics-rpc-foundation-shared-helpers/44-RESEARCH.md
@CLAUDE.md
@supabase/migrations/00016_skip_tracker.sql
@supabase/migrations/00001_create_tables.sql
@src/lib/config.ts

<interfaces>
Relevant existing exports — executor must NOT break these:

From src/lib/config.ts (lines 1-367):
- export const APP_CONFIG, ROLES, ROUTES, AUTH_CONFIG, WORK_TRACKER, KPI_TARGETS,
  ROADMAP_STEPS, DAILY_REPORT, COACH_CONFIG, OWNER_CONFIG, AI_CONFIG, INVITE_CONFIG,
  THEME, NAVIGATION, VALIDATION
- The default export aggregate `config` (line ~348) includes every named export as a
  keyed field (app, auth, roles, routes, ... validation). A new ACTIVITY export MUST
  also be added to the default aggregate as `activity`.

Existing table shapes (confirmed in src/lib/types.ts + 00001_create_tables.sql):
- public.work_sessions(student_id uuid, date date, status varchar CHECK IN ('in_progress','completed','abandoned'), ...)
- public.daily_reports(student_id uuid, date date, submitted_at timestamptz NULL, ...)
- public.roadmap_progress(student_id uuid, step_number int, status varchar CHECK IN ('locked','active','completed'), ...)
- public.deals(student_id uuid, deal_number int, revenue numeric, profit numeric, created_at timestamptz, updated_at timestamptz, ...)

Existing convention from 00016_skip_tracker.sql line 25:
  v_week_start date := date_trunc('week', p_today)::date;
This confirms `date_trunc('week', ...)` returns ISO Monday in this codebase. Reuse exactly.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 00021_analytics_foundation.sql — helpers + indexes + asserts</name>
  <read_first>
    - supabase/migrations/00001_create_tables.sql (table shapes, existing index style)
    - supabase/migrations/00016_skip_tracker.sql (date_trunc('week', ...) pattern + SECURITY DEFINER STABLE style)
    - supabase/migrations/00009_database_foundation.sql (IF NOT EXISTS index idiom)
    - .planning/phases/44-analytics-rpc-foundation-shared-helpers/44-RESEARCH.md (full rationale)
    - .planning/REQUIREMENTS.md (PERF-01, PERF-03, PERF-04 exact wording)
    - CLAUDE.md (critical rules — especially rule 4 admin client and section "Hard Rules")
  </read_first>
  <files>supabase/migrations/00021_analytics_foundation.sql</files>
  <action>
Create the new migration file `supabase/migrations/00021_analytics_foundation.sql` with EXACT content below. Before writing, run `ls supabase/migrations/ | grep -E '^0002[1-9]'` — if `00021_*.sql` already exists (e.g., from an uncommitted worktree), bump to the next free number (`00022_...`, `00023_...`) and update all references accordingly; otherwise use `00021`.

Content to write (VERBATIM — do NOT simplify, do NOT remove asserts):

```sql
-- ============================================================================
-- Phase 44: Analytics RPC Foundation & Shared Helpers
-- Migration: 00021_analytics_foundation.sql
--
-- Establishes shared SQL building blocks for v1.5 analytics consumers:
--   1. week_start(date)               — ISO Monday of a given date (IMMUTABLE)
--   2. student_activity_status(uuid,date) — 'active' | 'inactive' per D-14
--   3. idx_deals_student_created      — per-student deal history pagination
--   4. idx_work_sessions_completed_student_date (partial, status='completed')
--   5. idx_roadmap_progress_student_status
--
-- RLS: no new policies here (deals RLS is Phase 45). All new DEFINER functions
--      use (SELECT auth.uid()) pattern where applicable (PERF-03). This file
--      MUST NOT contain any bare `auth.uid()` reference.
--
-- Pattern: SECURITY DEFINER + STABLE for aggregates (PERF-04). All functions
--          SET search_path = public for safety.
--
-- SYNC: student_activity_status inactive threshold (7 days) mirrors
--       ACTIVITY.inactiveAfterDays in src/lib/config.ts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. week_start(p_today date) -> date   (IMMUTABLE, SQL, no side effects)
--    Returns the ISO Monday of the week containing p_today.
--    Sunday input => previous Monday (per ISO 8601 / PG convention).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.week_start(p_today date)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT date_trunc('week', p_today)::date;
$$;

COMMENT ON FUNCTION public.week_start(date) IS
  'ISO Monday (week start) of p_today. SYNC: used by skip tracker, leaderboard, trend buckets across v1.5.';

-- ---------------------------------------------------------------------------
-- 2. student_activity_status(p_student_id uuid, p_today date) -> text
--    Returns 'active' if the student has >= 1 completed work_session OR
--    >= 1 submitted daily_report in the window [p_today - 6, p_today]
--    (i.e. last 7 days inclusive). Otherwise 'inactive'. (D-14)
--
--    STABLE: reads tables, no writes. SECURITY DEFINER so it can be called
--    from RLS-limited contexts (e.g. later analytics RPCs).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.student_activity_status(
  p_student_id uuid,
  p_today      date
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff date := p_today - 6;  -- last 7 days INCLUSIVE of today
BEGIN
  IF EXISTS (
    SELECT 1 FROM work_sessions ws
    WHERE ws.student_id = p_student_id
      AND ws.status = 'completed'
      AND ws.date BETWEEN v_cutoff AND p_today
  ) THEN
    RETURN 'active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM daily_reports dr
    WHERE dr.student_id = p_student_id
      AND dr.submitted_at IS NOT NULL
      AND dr.date BETWEEN v_cutoff AND p_today
  ) THEN
    RETURN 'active';
  END IF;

  RETURN 'inactive';
END;
$$;

COMMENT ON FUNCTION public.student_activity_status(uuid, date) IS
  'D-14: inactive = no completed work_session AND no submitted daily_report in last 7 days (inclusive of p_today). SYNC: threshold mirrors ACTIVITY.inactiveAfterDays in src/lib/config.ts.';

-- ---------------------------------------------------------------------------
-- 3. Hot-path indexes (PERF-01). All IF NOT EXISTS for idempotency.
-- ---------------------------------------------------------------------------

-- Per-student deal history, newest first (analytics pages + coach deals tab).
CREATE INDEX IF NOT EXISTS idx_deals_student_created
  ON public.deals(student_id, created_at DESC);

-- Hours-worked aggregates + activity checks: only completed sessions are ever
-- counted, so a partial index on status='completed' is both smaller and faster.
CREATE INDEX IF NOT EXISTS idx_work_sessions_completed_student_date
  ON public.work_sessions(student_id, date)
  WHERE status = 'completed';

-- Current active step lookups + aggregate step-by-status counts.
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_student_status
  ON public.roadmap_progress(student_id, status);

-- ---------------------------------------------------------------------------
-- 4. Grants (so anon + authenticated + service_role can call the helpers;
--    helper bodies still enforce correctness — these are pure/STABLE funcs).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.week_start(date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_activity_status(uuid, date) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Embedded correctness asserts. These run at migration time; a failure
--    aborts `supabase db push` and prevents a broken helper from shipping.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_mon date := '2026-04-13'::date; -- Monday
  v_wed date := '2026-04-15'::date; -- Wednesday
  v_sun date := '2026-04-12'::date; -- Sunday (should map to prior Monday 2026-04-06)
BEGIN
  ASSERT public.week_start(v_mon) = '2026-04-13'::date,
    format('week_start(Monday) expected 2026-04-13, got %s', public.week_start(v_mon));
  ASSERT public.week_start(v_wed) = '2026-04-13'::date,
    format('week_start(Wednesday) expected 2026-04-13, got %s', public.week_start(v_wed));
  ASSERT public.week_start(v_sun) = '2026-04-06'::date,
    format('week_start(Sunday) expected 2026-04-06, got %s', public.week_start(v_sun));
END $$;

-- student_activity_status shape check: must return exactly 'active' or 'inactive'
-- for any student uuid (empty tables => 'inactive'). Uses a random uuid that
-- will not match any real row, proving the 'inactive' branch.
DO $$
DECLARE
  v_fake uuid := '00000000-0000-0000-0000-000000000000';
  v_out  text;
BEGIN
  v_out := public.student_activity_status(v_fake, CURRENT_DATE);
  ASSERT v_out = 'inactive',
    format('student_activity_status(non-existent student) expected inactive, got %s', v_out);
END $$;
```

After writing, verify the file contains NO bare `auth.uid()` reference (the file should contain zero occurrences of `auth.uid(` — it doesn't use auth at all). Also verify migration numbering is still free.
  </action>
  <verify>
    <automated>test -f supabase/migrations/00021_analytics_foundation.sql || test -f supabase/migrations/00022_analytics_foundation.sql</automated>
    <automated>grep -cE "CREATE OR REPLACE FUNCTION public\.week_start" supabase/migrations/0002[1-9]_analytics_foundation.sql | grep -qE "^[1-9]"</automated>
    <automated>grep -cE "CREATE OR REPLACE FUNCTION public\.student_activity_status" supabase/migrations/0002[1-9]_analytics_foundation.sql | grep -qE "^[1-9]"</automated>
    <automated>grep -cE "idx_deals_student_created|idx_work_sessions_completed_student_date|idx_roadmap_progress_student_status" supabase/migrations/0002[1-9]_analytics_foundation.sql | grep -qE "^[3-9]"</automated>
    <automated>! grep -nE "(^|[^T])auth\.uid\(\)" supabase/migrations/0002[1-9]_analytics_foundation.sql</automated>
    <automated>grep -q "SECURITY DEFINER" supabase/migrations/0002[1-9]_analytics_foundation.sql && grep -q "STABLE" supabase/migrations/0002[1-9]_analytics_foundation.sql</automated>
  </verify>
  <done>
Migration file exists at the first free 0002x slot (0021 preferred). Contains both helper functions with the exact signatures in the spec, all three `CREATE INDEX IF NOT EXISTS` statements (including the partial one with `WHERE status = 'completed'`), GRANT EXECUTE blocks, and two DO-block assert stanzas. Zero bare `auth.uid()` references. File compiles (psql parse) — to be run by the schema push task.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add ACTIVITY config block to src/lib/config.ts with SYNC comment</name>
  <read_first>
    - src/lib/config.ts (lines 1-367 — full file; pay attention to section numbering 1-15 and the default `config` aggregate on lines 348-366)
    - supabase/migrations/0002[1-9]_analytics_foundation.sql (written in Task 1 — confirm 7-day threshold)
    - CLAUDE.md (rule 1: Config is truth; rule 7: Zod import; rule 8: ima-* tokens)
    - .planning/REQUIREMENTS.md (cross-cutting PERF-07 build gate)
  </read_first>
  <files>src/lib/config.ts</files>
  <action>
Edit `src/lib/config.ts`. Insert a new `ACTIVITY` config block immediately BEFORE the existing `// 15. DEFAULT EXPORT` comment line (currently at line 346), so it becomes the new section 15 and the existing DEFAULT EXPORT gets renumbered to 16.

Exact insertion (add these lines before `// 15. DEFAULT EXPORT — aggregate all V1 configs`):

```ts
// ---------------------------------------------------------------------------
// 15. ACTIVITY — student active/inactive threshold (D-14)
//     SYNC: mirrors public.student_activity_status in
//           supabase/migrations/00021_analytics_foundation.sql
//           (or whichever 0002x slot the Phase 44 migration landed in).
//           Changing inactiveAfterDays REQUIRES updating the SQL helper's
//           `v_cutoff := p_today - (inactiveAfterDays - 1)` expression and
//           creating a new migration to redefine student_activity_status.
// ---------------------------------------------------------------------------
export const ACTIVITY = {
  inactiveAfterDays: 7, // D-14 locked: inactive = no completed work_session AND no submitted report in last 7 days
} as const;

```

Then renumber the existing section header from:

```
// 15. DEFAULT EXPORT — aggregate all V1 configs
```
to:
```
// 16. DEFAULT EXPORT — aggregate all V1 configs
```

Inside the `const config = { ... }` aggregate (currently at lines 348-366), add `activity: ACTIVITY,` as a new keyed field. Place it alphabetically-reasonable between `ai: AI_CONFIG,` and `invites: INVITE_CONFIG,` (insert right after `ai: AI_CONFIG,`).

If the migration filename landed in a slot other than `00021`, update the SYNC comment to reference that exact filename.

Do NOT touch any other section. Do NOT rename or remove existing exports. Do NOT add any new imports.
  </action>
  <verify>
    <automated>grep -q "export const ACTIVITY" src/lib/config.ts</automated>
    <automated>grep -q "inactiveAfterDays: 7" src/lib/config.ts</automated>
    <automated>grep -q "activity: ACTIVITY" src/lib/config.ts</automated>
    <automated>grep -qE "// 15\. ACTIVITY" src/lib/config.ts</automated>
    <automated>grep -qE "// 16\. DEFAULT EXPORT" src/lib/config.ts</automated>
    <automated>grep -qE "SYNC.*student_activity_status|SYNC.*0002[1-9]_analytics_foundation" src/lib/config.ts</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
`ACTIVITY` is exported, contains exactly `inactiveAfterDays: 7`, has a SYNC comment pointing at the SQL migration, is included in the default `config` aggregate as `activity`, and the section header renumbering (15 -> 16 for DEFAULT EXPORT) is applied. `npx tsc --noEmit` exits 0. No other exports modified.
  </done>
</task>

<task type="auto">
  <name>Task 3: [BLOCKING] Schema push + index verification + post-phase build gate</name>
  <read_first>
    - supabase/migrations/0002[1-9]_analytics_foundation.sql (the new migration)
    - supabase/config.toml (if present — project_id / local DB settings)
    - CLAUDE.md (commands section)
  </read_first>
  <files>
    (no source edits — this task verifies the database, indexes, and post-phase build gate)
  </files>
  <action>
Run the schema push and verification chain. This task is BLOCKING — the phase cannot pass verification without it.

1. Push schema to the connected Supabase project:
   `supabase db push`
   If the CLI is non-interactive and the environment has `SUPABASE_ACCESS_TOKEN` set, the push is non-TTY-safe. If push prompts for confirmation in a non-TTY shell, export `SUPABASE_ACCESS_TOKEN` (user_setup) and retry. If push fails, STOP — do not mark complete.

2. Prove the embedded DO asserts executed successfully by confirming push exit code = 0 (asserts raise ERROR on failure, aborting the push).

3. Confirm all three indexes now exist in `pg_indexes`. From the Supabase SQL editor (or via `supabase db remote commit`-equivalent psql), run and capture:
   ```sql
   SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
     'idx_deals_student_created',
     'idx_work_sessions_completed_student_date',
     'idx_roadmap_progress_student_status'
   ) ORDER BY indexname;
   ```
   Expect exactly three rows. Record output in the SUMMARY.

4. Prove index scans on representative queries. Run EXPLAIN (ANALYZE, BUFFERS) on:
   (a) `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.deals WHERE student_id = <any-real-student-uuid> ORDER BY created_at DESC LIMIT 25;`
   (b) `EXPLAIN (ANALYZE, BUFFERS) SELECT sum(duration_minutes) FROM public.work_sessions WHERE student_id = <uuid> AND date >= CURRENT_DATE - 30 AND status = 'completed';`
   (c) `EXPLAIN (ANALYZE, BUFFERS) SELECT status, count(*) FROM public.roadmap_progress WHERE student_id = <uuid> GROUP BY status;`

   Expected plan nodes contain `Index Scan using idx_...` (or `Bitmap Index Scan on idx_...`). If any table is empty for the chosen uuid, document "N/A — empty result set" and run against any seed student (pick the first row from `SELECT id FROM users WHERE role = 'student' LIMIT 1`). Capture plan fragments in the SUMMARY.

5. Post-phase build gate (PERF-07):
   `npm run lint && npx tsc --noEmit && npm run build`
   All three must exit 0. If lint or type-check fails, fix and re-run. Capture final exit codes in the SUMMARY.

6. SYNC grep (final safety): confirm `ACTIVITY.inactiveAfterDays` literal and the SQL `p_today - 6` cutoff agree.
   ```sh
   grep -n "inactiveAfterDays: 7" src/lib/config.ts
   grep -n "v_cutoff date := p_today - 6" supabase/migrations/0002[1-9]_analytics_foundation.sql
   ```
   Both must match. If the SQL uses a different offset, the SYNC is broken — fix the migration (not the config).
  </action>
  <verify>
    <automated>npm run lint</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run build</automated>
    <automated>grep -n "inactiveAfterDays: 7" src/lib/config.ts</automated>
    <automated>grep -n "v_cutoff date := p_today - 6" supabase/migrations/0002[1-9]_analytics_foundation.sql</automated>
  </verify>
  <done>
`supabase db push` exited 0 (embedded asserts passed). All three indexes listed in `pg_indexes`. EXPLAIN (ANALYZE, BUFFERS) plan fragments captured showing `Index Scan using idx_...` (or Bitmap Index Scan) on all three representative queries. `npm run lint && npx tsc --noEmit && npm run build` exited 0. SYNC grep confirmed — `ACTIVITY.inactiveAfterDays: 7` in config.ts matches `v_cutoff := p_today - 6` (7 inclusive days) in the migration.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| app code -> Postgres | Phase 44 introduces two DEFINER functions and three indexes. No user-supplied SQL is executed; helpers take strongly-typed (uuid, date) arguments — not strings. No RLS policies added here. |
| config file -> all runtime callers | `ACTIVITY.inactiveAfterDays` is a compile-time const; no runtime mutation surface. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-44-01 | I (Information disclosure) | `student_activity_status(uuid, date)` — SECURITY DEFINER reads any student's sessions/reports | mitigate | Phase 44 does not expose this helper to clients directly. Phase 46-48 will call it only inside already-scoped analytics RPCs that first enforce `(SELECT auth.uid())` / assignment checks. Helper returns only a literal 'active' | 'inactive', never row data — information disclosure surface is 1 bit per call. |
| T-44-02 | T (Tampering) | Migration file — wrong ISO week semantics could corrupt every downstream leaderboard | mitigate | Embedded DO-block asserts with three canonical dates (Sunday/Monday/Wednesday) fail `supabase db push` if `date_trunc('week', ...)` ever changes behavior. |
| T-44-03 | D (Denial of service) | Missing indexes at 5k concurrent students | mitigate | Three targeted indexes added (PERF-01). Partial index on work_sessions skips non-completed rows, reducing write amplification. EXPLAIN ANALYZE verification proves index scans. |
| T-44-04 | E (Elevation of privilege) | `search_path` hijack inside DEFINER helper | mitigate | Both functions set `SET search_path = public` explicitly — prevents `search_path` poisoning from calling role. |
| T-44-05 | R (Repudiation) | Config/SQL drift (ACTIVITY.inactiveAfterDays != SQL cutoff) | mitigate | SYNC comments in both files. Verification grep in Task 3 confirms the literals agree. Any change in one must be mirrored in the other via a new migration. |
| T-44-06 | S (Spoofing) | auth.uid() bypass | accept | Helper takes `p_student_id uuid` as a required argument — caller (future analytics RPC) is responsible for authenticating identity before passing it. Phase 44 does not own auth flow. |
</threat_model>

<verification>
Phase-level checks (run after all three tasks complete):

1. File presence:
   - `test -f supabase/migrations/0002[1-9]_analytics_foundation.sql` (exactly one match)
   - `test -f src/lib/config.ts` (preserved)

2. SQL helper signatures (grep):
   - `grep -q "CREATE OR REPLACE FUNCTION public.week_start(p_today date)" supabase/migrations/0002[1-9]_analytics_foundation.sql`
   - `grep -q "CREATE OR REPLACE FUNCTION public.student_activity_status" supabase/migrations/0002[1-9]_analytics_foundation.sql`

3. Indexes (grep):
   - `grep -q "idx_deals_student_created" supabase/migrations/0002[1-9]_analytics_foundation.sql`
   - `grep -q "idx_work_sessions_completed_student_date" supabase/migrations/0002[1-9]_analytics_foundation.sql`
   - `grep -q "WHERE status = 'completed'" supabase/migrations/0002[1-9]_analytics_foundation.sql`
   - `grep -q "idx_roadmap_progress_student_status" supabase/migrations/0002[1-9]_analytics_foundation.sql`

4. No bare `auth.uid()` (PERF-03 convention):
   - `! grep -nE "(^|[^T])auth\.uid\(\)" supabase/migrations/0002[1-9]_analytics_foundation.sql`
     (The migration contains zero auth.uid references at all — the stricter form.)

5. Config block:
   - `grep -q "export const ACTIVITY" src/lib/config.ts`
   - `grep -q "inactiveAfterDays: 7" src/lib/config.ts`
   - `grep -q "activity: ACTIVITY" src/lib/config.ts`

6. Post-phase build gate (PERF-07):
   - `npm run lint` exits 0
   - `npx tsc --noEmit` exits 0
   - `npm run build` exits 0

7. DB verification (manual capture into SUMMARY):
   - 3 indexes present in `pg_indexes`
   - 3 EXPLAIN ANALYZE plans show Index Scan / Bitmap Index Scan on the new indexes
   - DO-block asserts executed (implied by `supabase db push` exit 0)
</verification>

<success_criteria>
All six roadmap success criteria for Phase 44 hold:

1. `week_start(date)` returns the ISO Monday for Sunday/Monday/Wednesday inputs — asserted in the migration's DO block.
2. `student_activity_status(uuid, date)` returns `'active' | 'inactive'` with the 7-day inclusive rule (D-14) — asserted for the empty-table `'inactive'` branch; `'active'` branch exercised by downstream phases' tests.
3. `ACTIVITY.inactiveAfterDays: 7` exists in `src/lib/config.ts` with a SYNC comment pointing at the SQL helper.
4. Migration `0002[1-9]_analytics_foundation.sql` creates all three indexes; EXPLAIN ANALYZE on representative queries proves index scans (or empty-table N/A).
5. `(SELECT auth.uid())` initplan convention is owned by Phase 44 (no bare `auth.uid()` anywhere in the new migration — verified by grep).
6. `npm run lint && npx tsc --noEmit && npm run build` exits 0.
</success_criteria>

<output>
After completion, create `.planning/phases/44-analytics-rpc-foundation-shared-helpers/44-01-SUMMARY.md` with:
  - Migration filename actually used (00021 or 00022…)
  - Output of the `SELECT indexname FROM pg_indexes ...` check
  - EXPLAIN ANALYZE plan fragments (one per representative query)
  - Build gate exit codes
  - Any deviations from the plan (e.g., migration number bumped, seed student used for EXPLAIN)
</output>
