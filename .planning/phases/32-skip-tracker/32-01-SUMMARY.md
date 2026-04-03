---
phase: 32-skip-tracker
plan: 01
subsystem: database, coach-dashboard
tags: [rpc, skip-tracking, badge, supabase, coach]

# Dependency graph
requires:
  - phase: 26-database-schema-foundation
    provides: work_sessions and daily_reports tables
provides:
  - get_weekly_skip_counts RPC function (migration 00016)
  - skippedDays prop on StudentCard
  - skip count fetch in coach dashboard
affects: [32-02, coach-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Postgres RPC with caller-provided date/hour params — never uses CURRENT_DATE or now()
    - Batch RPC call pattern — single call for all student IDs, returns JSONB map
    - Badge stacking — flex-col with gap-1 for multiple badges on same card

key-files:
  created:
    - supabase/migrations/00016_skip_tracker.sql
  modified:
    - src/components/coach/StudentCard.tsx
    - src/app/(dashboard)/coach/page.tsx

key-decisions:
  - "RPC accepts p_today DATE and p_current_hour INT — deterministic, testable, no server-time dependency"
  - "Today counted as skip only after 23:00 UTC — matches DAILY_REPORT.deadlineHour"
  - "Skip badge uses variant='warning' and renders above existing New/At Risk badge"
  - "Skip count added as 4th parallel fetch in coach dashboard Promise.all"
  - "Early exit returns 0 for all students when no countable days exist (Monday before 23:00)"

patterns-established:
  - "Pattern: RPC returns JSONB map keyed by student_id::text — consistent with batch lookup pattern"
  - "Pattern: Badge stacking with flex-col items-end gap-1 for multiple status indicators"

requirements-completed: [SKIP-01, SKIP-02, SKIP-03, SKIP-05]

# Metrics
duration: ~7min
completed: 2026-04-03
---

# Phase 32 Plan 01: Skip Tracker RPC & Coach Dashboard Summary

**Created get_weekly_skip_counts RPC function and integrated skip count warning badges into coach dashboard StudentCards — coaches see "X skipped" at a glance for proactive intervention**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- Migration 00016 creates `get_weekly_skip_counts` RPC — accepts student IDs, date, and hour; returns JSONB map of skip counts per student
- RPC correctly excludes future days, gates today at 23:00 UTC, resets on Monday (ISO week), filters only completed sessions and submitted reports
- Coach dashboard fetches skip counts as 4th parallel query alongside sessions/reports/roadmap
- StudentCard renders "X skipped" warning badge (only when > 0) stacked above existing New/At Risk badge

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00016 with get_weekly_skip_counts RPC** - `1bc11b2` (feat)
2. **Task 2: Integrate skip counts into coach dashboard and StudentCard** - `2a105c1` (feat)

## Files Created/Modified
- `supabase/migrations/00016_skip_tracker.sql` - New RPC function with SECURITY DEFINER, STABLE, parameterized date/hour
- `src/components/coach/StudentCard.tsx` - Added skippedDays prop, warning badge rendering with flex-col stacking
- `src/app/(dashboard)/coach/page.tsx` - Added 4th parallel RPC fetch, skipCountMap lookup, skippedDays enrichment

## Decisions Made
- RPC never uses CURRENT_DATE or now() — caller provides p_today and p_current_hour for deterministic behavior
- Early exit path returns 0 for all students when v_count_through < v_week_start (e.g., Monday before 23:00)
- Skip badge and status badge can both appear simultaneously (e.g., new student who skipped days)

## Deviations from Plan
None.

## Issues Encountered
None.

## User Setup Required
None - migration needs to be applied to Supabase when deploying.

## Next Phase Readiness
- Plan 01 complete: RPC exists, coach dashboard integrated
- Plan 02 can proceed: owner student views can call the same RPC
- No blockers

## Self-Check: PASSED

- FOUND: supabase/migrations/00016_skip_tracker.sql
- FOUND: src/components/coach/StudentCard.tsx (skippedDays prop)
- FOUND: src/app/(dashboard)/coach/page.tsx (get_weekly_skip_counts call)
- FOUND: 1bc11b2 (Task 1 commit)
- FOUND: 2a105c1 (Task 2 commit)

---
*Phase: 32-skip-tracker*
*Completed: 2026-04-03*
