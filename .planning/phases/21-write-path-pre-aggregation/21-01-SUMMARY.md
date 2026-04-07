---
phase: 21-write-path-pre-aggregation
plan: 01
subsystem: database
tags: [postgres, plpgsql, pg_cron, supabase, aggregation, rpc]

requires:
  - phase: 20-query-consolidation-caching
    provides: get_student_detail RPC, database foundation indexes
provides:
  - student_kpi_summaries table with lifetime KPI aggregates
  - refresh_student_kpi_summaries() nightly aggregation function with advisory lock
  - pg_cron job at 2 AM UTC for automatic refresh
  - get_student_detail RPC reads lifetime_outreach from summary table
affects: [coach-analytics, owner-dashboard, future-lifetime-metrics]

tech-stack:
  added: [pg_cron]
  patterns: [advisory-lock-singleton, incremental-skip-aggregation, date-walk-streak]

key-files:
  created:
    - supabase/migrations/00011_write_path.sql
  modified: []

key-decisions:
  - "D-08 scope: coach analytics uses 7-day windowed metrics, not lifetime totals — summary table does not apply to current coach analytics"
  - "Advisory lock key 2100210021 prevents concurrent cron runs"
  - "Incremental skip via last_report_date sentinel avoids reprocessing unchanged students"
  - "Streak uses PL/pgSQL date walk backward from MAX(date), not window functions"
  - "get_student_detail falls back to live daily_reports query if no summary row exists (bootstrap safety)"

patterns-established:
  - "Advisory lock pattern: pg_try_advisory_lock() with unlock in both success and EXCEPTION paths"
  - "Incremental aggregation: sentinel column tracks last processed state, skip if no new data"
  - "Idempotent cron: unschedule before schedule prevents duplicate jobs on migration re-run"

requirements-completed: [WRITE-01]

duration: 4min
completed: 2026-03-30
---

# Plan 21-01: SQL Migration Summary

**student_kpi_summaries table with nightly advisory-locked refresh function, pg_cron job at 2 AM UTC, and get_student_detail RPC switchover with fallback**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-03-30
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created student_kpi_summaries table with all 10 columns per D-01
- Built refresh_student_kpi_summaries() with advisory lock, incremental skip, streak computation, and idempotent upsert
- Registered pg_cron job with idempotent unschedule/schedule pattern
- Updated get_student_detail to read lifetime_outreach from summary table with live-query fallback

## Task Commits

1. **Task 1: Create migration 00011_write_path.sql** - `eb91a6a` (feat)

## Files Created/Modified
- `supabase/migrations/00011_write_path.sql` - Complete Phase 21 SQL: table DDL, aggregation function, cron job, RPC update

## Decisions Made
- D-08 documented as SQL header comment — coach analytics 7-day windows don't match lifetime totals
- VOLATILE (not STABLE) for the refresh function since it writes data
- Full lifetime re-SUM on each run for correctness (not delta arithmetic)
- Fallback query in get_student_detail for bootstrap period before first cron run

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
**External services require manual configuration:**
- pg_cron extension must be enabled in Supabase Dashboard -> Database -> Extensions -> search 'pg_cron' -> Enable
- Migration must be applied after pg_cron is enabled

## Next Phase Readiness
- Summary table ready for nightly aggregation once pg_cron is enabled and migration is applied
- get_student_detail immediately benefits from summary table after first cron run
- Fallback ensures zero downtime during bootstrap period

---
*Phase: 21-write-path-pre-aggregation*
*Completed: 2026-03-30*
