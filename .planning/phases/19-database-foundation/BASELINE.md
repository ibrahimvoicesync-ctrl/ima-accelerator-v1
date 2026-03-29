# Phase 19: Database Foundation — Performance Baseline

**Captured:** 2026-03-30
**Database:** Supabase Postgres 17
**Migration applied:** 00009_database_foundation.sql

## RLS Initplan Verification (DB-03)

### Source Audit

All 34 RLS policies in `00001_create_tables.sql` verified to use `(select get_user_role())` and/or `(select get_user_id())` initplan wrappers. No bare `auth.uid()` calls found in any policy definition.

Source audit results (programmatic grep on `supabase/migrations/00001_create_tables.sql`):
- `(select get_user_role())` occurrences in policy definitions: **49** (multiple per policy for USING + WITH CHECK)
- `(select get_user_id())` occurrences in policy definitions: **32**
- `auth.uid()` occurrences: **2** — both inside helper function body definitions (lines 150 and 160) only, zero in CREATE POLICY statements

Policy count: 34 CREATE POLICY statements across 6 tables (users: 6, invites: 5, magic_links: 6, work_sessions: 6, roadmap_progress: 5, daily_reports: 6).

Helper functions confirmed:
- `get_user_id()`: LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public
- `get_user_role()`: LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public

### EXPLAIN Verification

RLS initplan optimization is verified via source audit above. Live EXPLAIN with `SET LOCAL role = authenticated` cannot be executed via RPC (Postgres prevents `SET role` inside SECURITY DEFINER functions). The source audit confirms all 34 policies use `(select ...)` initplan wrappers with STABLE helper functions — Postgres evaluates these as InitPlan nodes (once per query) rather than SubPlan (once per row). This is a well-documented PostgreSQL optimization for STABLE scalar subqueries in RLS policies.

## Before Migration (DB-04)

### pg_stat_statements — Top 10 Queries by Execution Time

Captured via `supabase inspect db outliers` and `supabase inspect db calls` before migration 00009 was applied.

**Database stats:** 13 MB total, 100% index hit rate, 100% table hit rate (25+ days since stats reset).

| # | Query Snippet | Calls | Total Exec Time | Proportion |
|---|---------------|-------|-----------------|------------|
| 1 | `with f as (... pg_proc ... pg_available_extensions ...)` (Dashboard introspection) | 109 | 13.21s | 19.4% |
| 2 | `DO $$ ... INSERT INTO users ... work_sessions ... daily_reports ...` (seed script) | 1 | 10.38s | 15.3% |
| 3 | `SELECT e.name ... FROM pg_available_extensions()` (extension listing) | 126 | 7.76s | 11.4% |
| 4 | `UPDATE public.work_sessions SET duration_minutes = CASE ...` (seed diversification) | 1 | 4.16s | 6.1% |
| 5 | `UPDATE public.work_sessions SET duration_minutes = CASE ... WHERE status ...` (seed cap) | 1 | 3.68s | 5.4% |
| 6 | `UPDATE public.work_sessions SET duration_minutes = 45 ...` (seed normalization) | 1 | 3.09s | 4.5% |
| 7 | `UPDATE public.daily_reports SET hours_worked = CASE ...` (seed diversification) | 1 | 2.94s | 4.3% |
| 8 | `UPDATE public.roadmap_progress SET status = ...` (seed reset) | 1 | 2.92s | 4.3% |
| 9 | `SELECT tbl.schemaname ... pg_catalog.pg_class ...` (Dashboard table listing) | 109 | 2.54s | 3.7% |
| 10 | `SELECT public.get_platform_stats() limit 1` | 2 | 1.23s | 1.8% |

**Top application queries by call volume:**

| # | Query Snippet | Calls | Total Exec Time | Sync IO |
|---|---------------|-------|-----------------|---------|
| 1 | `select set_config('search_path', ..., 'role', ..., 'request.jwt.claims', ...)` (PostgREST setup) | 49,649 | 2.67s | 0 |
| 2 | `SELECT users.* FROM users WHERE instance_id = $1 and id = $2` (auth lookup) | 18,881 | 1.37s | 0 |
| 3 | `SELECT identities.* FROM identities WHERE user_id = $1` | 18,879 | 0.69s | 0 |
| 4 | `SELECT sessions.* FROM sessions WHERE id = $1` | 18,833 | 1.22s | 0 |
| 5 | `WITH pgrst_source AS (SELECT "public"."users"."role" ... WHERE auth_id = $1)` (role lookup) | 5,298 | 0.44s | 0 |

### Index Usage Before Migration

Captured via `supabase inspect db index-stats`:

| Index | Size | Usage % | Index Scans | Seq Scans | Unused |
|-------|------|---------|-------------|-----------|--------|
| idx_work_sessions_student_date_cycle | 16 kB | 100% | 526 | 0 | false |
| idx_work_sessions_student | 16 kB | 100% | 128 | 0 | false |
| idx_work_sessions_student_date | 16 kB | 0% | 0 | 0 | **true** |
| idx_work_sessions_student_date_completed | 16 kB | 100% | 30 | 0 | false |
| idx_daily_reports_date | 16 kB | 100% | 759 | 0 | false |
| idx_daily_reports_student | 16 kB | 100% | 250 | 0 | false |
| idx_daily_reports_student_date | 16 kB | 100% | 308 | 0 | false |
| idx_roadmap_progress_student_step | 16 kB | 100% | 293 | 0 | false |
| idx_roadmap_progress_student | 16 kB | 100% | 122 | 0 | false |
| idx_users_auth_id | 16 kB | 100% | 3,541 | 0 | false |

## After Migration (DB-04)

### Migration Applied

Applied via `supabase db push --linked` on 2026-03-30:

```
Applying migration 00009_database_foundation.sql...
NOTICE (42P07): relation "idx_roadmap_progress_student" already exists, skipping
NOTICE (42710): extension "pg_stat_statements" already exists, skipping
Finished supabase db push.
```

- `idx_work_sessions_student_date_status` — **CREATED** (new composite index)
- `idx_roadmap_progress_student` — already existed (idempotent no-op as designed)
- `pg_stat_statements` — already enabled (idempotent no-op as designed)

### pg_stat_statements — Top 10 After Migration

Captured via temporary RPC function querying `extensions.pg_stat_statements` directly:

| # | Query Snippet | Calls | Mean (ms) | Total (ms) | Cache Hit % |
|---|---------------|-------|-----------|------------|-------------|
| 1 | `get_coach_performance_summary()` | 167 | 289.38 | 48,326.97 | 100.0% |
| 2 | `SELECT name FROM pg_timezone_names` | 99 | 468.61 | 46,391.96 | — |
| 3 | PostgREST RPC call (p_per...) | 40 | 879.60 | 35,184.03 | 100.0% |
| 4 | `roadmap_progress` SELECT | 370 | 46.35 | 17,149.07 | 100.0% |
| 5 | PostgREST RPC call (p_coa...) | 21 | 751.08 | 15,772.66 | 100.0% |
| 6 | `work_sessions` SELECT (duration_minutes) | 1,930 | 7.26 | 14,003.63 | 100.0% |
| 7 | Dashboard introspection (pg_proc CTE) | 110 | 121.37 | 13,351.21 | 100.0% |
| 8 | `get_platform_stats()` | 31 | 350.56 | 10,867.25 | 100.0% |
| 9 | `roadmap_progress` SELECT (variant) | 2,771 | 3.58 | 9,932.71 | 100.0% |
| 10 | `pg_available_extensions()` | 127 | 63.43 | 8,055.30 | 99.9% |

**Key observations:**
- All application queries have 100% cache hit rate
- `get_coach_performance_summary()` is the slowest app function (289ms mean) — Phase 20 optimization target
- `work_sessions` queries average 7.26ms across 1,930 calls — healthy
- `roadmap_progress` queries average 3.58-46.35ms — healthy

### New Index Verified

Captured via `supabase inspect db index-stats` immediately after migration:

| Index | Size | Usage % | Index Scans | Unused |
|-------|------|---------|-------------|--------|
| **idx_work_sessions_student_date_status** | **16 kB** | **0%** | **0** | **true (new)** |

The new index had 0 scans in index-stats because it was just created. However, EXPLAIN ANALYZE (below) confirms it IS used by the query planner for 3-column status filter queries.

### Table Stats After Migration

| Table | Table Size | Index Size | Total Size | Est. Rows | Seq Scans |
|-------|------------|------------|------------|-----------|-----------|
| users | 48 kB | 144 kB | 192 kB | 12 | 4,107 |
| work_sessions | 48 kB | 96 kB | 144 kB | 22 | 634 |
| daily_reports | 48 kB | 80 kB | 128 kB | 13 | 1,184 |
| roadmap_progress | 56 kB | 48 kB | 104 kB | 105 | 364 |
| deals | 16 kB | 80 kB | 96 kB | 10 | 13 |

## Index Verification (DB-01)

EXPLAIN ANALYZE captured via temporary RPC functions deployed to Supabase, called via REST API, then dropped.
Test student: `54a1cbab-7616-4b5a-ba09-09a3ce912166`

### EXPLAIN ANALYZE — work_sessions Hot Path

```
Index Scan using idx_work_sessions_student_date_cycle on work_sessions
  (cost=0.14..2.10 rows=1 width=90) (actual time=0.668..0.668 rows=0 loops=1)
  Index Cond: ((student_id = '54a1cbab-...'::uuid) AND (date = CURRENT_DATE))
  Buffers: shared hit=1
Planning:
  Buffers: shared hit=169
Planning Time: 0.475 ms
Execution Time: 0.685 ms
```

**Result:** Index Scan using `idx_work_sessions_student_date_cycle`. Executes in 0.685ms with 1 shared buffer hit.

### EXPLAIN ANALYZE — daily_reports Hot Path

```
Seq Scan on daily_reports
  (cost=0.00..2.21 rows=1 width=16) (actual time=0.017..0.017 rows=0 loops=1)
  Filter: ((student_id = '54a1cbab-...'::uuid) AND (date = CURRENT_DATE))
  Rows Removed by Filter: 13
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=95
Planning Time: 0.290 ms
Execution Time: 0.032 ms
```

**Result:** Seq Scan (only 13 rows in table — expected). Index exists but Postgres optimizer correctly chooses seq scan at this scale. Executes in 0.032ms.

### EXPLAIN ANALYZE — work_sessions Status Filter (NEW composite index)

```
Index Scan using idx_work_sessions_student_date_status on work_sessions
  (cost=0.14..2.10 rows=1 width=90) (actual time=0.007..0.008 rows=0 loops=1)
  Index Cond: ((student_id = '54a1cbab-...'::uuid) AND (date = CURRENT_DATE) AND ((status)::text = 'in_progress'::text))
  Buffers: shared hit=1
Planning Time: 0.131 ms
Execution Time: 0.021 ms
```

**Result: Index Scan using `idx_work_sessions_student_date_status`** — the NEW composite index from migration 00009 IS being used by the Postgres query planner for the 3-column status filter pattern. All three columns (`student_id`, `date`, `status`) appear in the Index Cond. Executes in 0.021ms.

### Summary

| Query Path | Plan | Index Used | Time |
|------------|------|-----------|------|
| work_sessions (student+date) | Index Scan | idx_work_sessions_student_date_cycle | 0.685ms |
| daily_reports (student+date) | Seq Scan | n/a (13 rows, expected) | 0.032ms |
| **work_sessions (student+date+status)** | **Index Scan** | **idx_work_sessions_student_date_status** | **0.021ms** |

### Notes

- All indexes use IF NOT EXISTS — safe for repeated application
- The new composite index is actively used by the query planner even at small scale
- `daily_reports` will switch to index scan at production scale (~70,000 rows)
- Phase 20 will reference this baseline for query optimization targets
- `get_coach_performance_summary()` (289ms mean) is the top optimization target for Phase 20
