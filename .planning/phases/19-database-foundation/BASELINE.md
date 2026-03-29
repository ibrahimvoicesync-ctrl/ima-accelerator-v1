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

[TO BE FILLED — Run the following in Supabase SQL Editor after migration:]

```sql
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<auth-uuid>"}';
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT * FROM public.work_sessions LIMIT 5;
```

Expected: Output contains "InitPlan" nodes for get_user_role/get_user_id calls.

Result: [PASTE EXPLAIN OUTPUT HERE]

## Before Migration (DB-04)

### pg_stat_statements — Top 10 Slowest Queries

[TO BE FILLED — Run before applying migration 00009 (or immediately after enabling pg_stat_statements and resetting counters):]

```sql
SELECT pg_stat_statements_reset();
-- Wait for some app activity, then run:
SELECT
  LEFT(query, 120)                              AS query_snippet,
  calls,
  ROUND(mean_exec_time::numeric, 2)             AS mean_ms,
  ROUND(total_exec_time::numeric, 2)            AS total_ms,
  rows,
  ROUND(100.0 * shared_blks_hit /
    NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
FROM extensions.pg_stat_statements
WHERE calls > 5
  AND query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

| # | Query Snippet | Calls | Mean (ms) | Total (ms) | Rows | Cache Hit % |
|---|---------------|-------|-----------|------------|------|-------------|
| 1 | | | | | | |
| 2 | | | | | | |

## After Migration (DB-04)

### pg_stat_statements — Top 10 Slowest Queries

[TO BE FILLED — Run after applying migration 00009 and letting the app run for some activity:]

```sql
SELECT pg_stat_statements_reset();
-- Wait for some app activity, then run:
SELECT
  LEFT(query, 120)                              AS query_snippet,
  calls,
  ROUND(mean_exec_time::numeric, 2)             AS mean_ms,
  ROUND(total_exec_time::numeric, 2)            AS total_ms,
  rows,
  ROUND(100.0 * shared_blks_hit /
    NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
FROM extensions.pg_stat_statements
WHERE calls > 5
  AND query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

| # | Query Snippet | Calls | Mean (ms) | Total (ms) | Rows | Cache Hit % |
|---|---------------|-------|-----------|------------|------|-------------|
| 1 | | | | | | |
| 2 | | | | | | |

## Index Verification (DB-01)

### EXPLAIN ANALYZE — work_sessions Hot Path

Run in SQL Editor with a real student UUID:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.work_sessions
WHERE student_id = '<test-uuid>'
  AND date = CURRENT_DATE
ORDER BY cycle_number;
```

Result: [PASTE EXPLAIN OUTPUT HERE]
Expected: Index Scan using idx_work_sessions_student_date (or idx_work_sessions_student_date_status)

### EXPLAIN ANALYZE — daily_reports Hot Path

Run in SQL Editor with a real student UUID:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT submitted_at, brands_contacted, influencers_contacted
FROM public.daily_reports
WHERE student_id = '<test-uuid>'
  AND date = CURRENT_DATE;
```

Result: [PASTE EXPLAIN OUTPUT HERE]
Expected: Index Scan using idx_daily_reports_student_date

### EXPLAIN ANALYZE — work_sessions Status Filter

Run in SQL Editor with a real student UUID:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.work_sessions
WHERE student_id = '<test-uuid>'
  AND date = CURRENT_DATE
  AND status = 'in_progress';
```

Result: [PASTE EXPLAIN OUTPUT HERE]
Expected: Index Scan using idx_work_sessions_student_date_status

### Notes

- If EXPLAIN shows Seq Scan instead of Index Scan, this may be correct behavior for small tables (Postgres optimizer prefers seq scan below ~100-200 rows). Document this finding — the index exists and will be used at production scale.
- Phase 20 will reference this baseline for query optimization targets.

## Applying Migration 00009

### Steps for human operator

1. **Enable pg_stat_statements** via Supabase Dashboard:
   - Go to: Dashboard -> Database -> Extensions -> search "pg_stat_statements" -> Enable

2. **Reset counters before capturing baseline:**
   ```sql
   SELECT pg_stat_statements_reset();
   ```

3. **Browse the app** for at least 5 minutes to generate query activity.

4. **Run Before Migration** pg_stat_statements query above, paste results into table.

5. **Apply migration 00009** — copy contents of `supabase/migrations/00009_database_foundation.sql` and run in SQL Editor:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_work_sessions_student_date_status
     ON public.work_sessions(student_id, date, status);

   CREATE INDEX IF NOT EXISTS idx_roadmap_progress_student
     ON public.roadmap_progress(student_id);

   CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;
   ```
   Verify: output shows `CREATE INDEX` and `CREATE EXTENSION` success.

6. **Reset counters after migration:**
   ```sql
   SELECT pg_stat_statements_reset();
   ```

7. **Browse the app** for at least 5 more minutes.

8. **Run After Migration** pg_stat_statements query, paste results into table.

9. **Run each EXPLAIN ANALYZE query** (3 total) using a real student UUID from:
   ```sql
   SELECT id FROM public.users WHERE role = 'student' LIMIT 1;
   ```
   Paste each output into the corresponding section above.

10. **Run RLS EXPLAIN query** with a real auth UUID from:
    ```sql
    SELECT auth_id FROM public.users WHERE role = 'student' LIMIT 1;
    ```
    Confirm "InitPlan" appears in output, paste into EXPLAIN Verification section above.

11. Commit updated BASELINE.md.
