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

RLS initplan optimization is verified via source audit above. EXPLAIN ANALYZE for RLS behavior requires an authenticated session context (`SET LOCAL role = authenticated`) which cannot be set through the Supabase CLI. The source audit confirms all 34 policies use `(select ...)` initplan wrappers — Postgres will evaluate these as InitPlan nodes at execution time.

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

### New Index Verified

Captured via `supabase inspect db index-stats` immediately after migration:

| Index | Size | Usage % | Index Scans | Unused |
|-------|------|---------|-------------|--------|
| **idx_work_sessions_student_date_status** | **16 kB** | **0%** | **0** | **true (new)** |

The new index has 0 scans because it was just created. At current data volume (~22 rows in work_sessions), Postgres optimizer correctly prefers sequential scans. The index will activate at production scale (100+ rows per student).

### Table Stats After Migration

| Table | Table Size | Index Size | Total Size | Est. Rows | Seq Scans |
|-------|------------|------------|------------|-----------|-----------|
| users | 48 kB | 144 kB | 192 kB | 12 | 4,107 |
| work_sessions | 48 kB | 96 kB | 144 kB | 22 | 634 |
| daily_reports | 48 kB | 80 kB | 128 kB | 13 | 1,184 |
| roadmap_progress | 56 kB | 48 kB | 104 kB | 105 | 364 |
| deals | 16 kB | 80 kB | 96 kB | 10 | 13 |

## Index Verification (DB-01)

### Analysis

EXPLAIN ANALYZE requires direct psql/SQL Editor access which the Supabase CLI `inspect` commands don't support for arbitrary queries. However, index verification is confirmed through two complementary methods:

**1. Index existence confirmed** — `supabase inspect db index-stats` shows `idx_work_sessions_student_date_status` was created successfully on `public.work_sessions(student_id, date, status)`.

**2. Seq scan expected at current scale** — With only 22 rows in `work_sessions`, Postgres cost-based optimizer will correctly choose sequential scans over index scans. This is optimal behavior — index overhead exceeds benefit below ~100-200 rows. The composite index exists and will be used automatically once data grows to production scale (~5,000 students × 14 days = ~70,000 rows).

**3. Hot path indexes are active** — The `idx_work_sessions_student_date_cycle` index (526 scans) and `idx_daily_reports_student_date` (308 scans) confirm Postgres IS using indexes on these tables when cost-beneficial. The new 3-column composite adds `status` coverage for the work tracker's `in_progress` filter pattern.

### Notes

- All indexes use IF NOT EXISTS — safe for repeated application
- Phase 20 will reference this baseline for query optimization targets
- At production scale, run `EXPLAIN (ANALYZE, BUFFERS)` to confirm index scan activation on the 3-column status filter path
