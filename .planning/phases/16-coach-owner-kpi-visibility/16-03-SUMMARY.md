---
phase: 16-coach-owner-kpi-visibility
plan: 03
subsystem: database
tags: [postgres, supabase, migration, seed, roadmap]

# Dependency graph
requires:
  - phase: 16-coach-owner-kpi-visibility
    provides: ROADMAP_STEPS config expanded to 15 steps
provides:
  - roadmap_progress CHECK constraint expanded from BETWEEN 1 AND 15
  - Backfill INSERT for steps 11-15 for existing students
  - Step names for steps 1-10 updated to match config titles
  - seed.sql updated with 75-row roadmap section (5 students x 15 steps)
affects: [student-roadmap, coach-kpi-visibility, owner-kpi-visibility, seed-data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ON CONFLICT (student_id, step_number) DO NOTHING for idempotent backfill"
    - "CROSS JOIN with VALUES list pattern for bulk backfill across students"

key-files:
  created:
    - supabase/migrations/00008_expand_roadmap_to_15_steps.sql
  modified:
    - supabase/seed.sql

key-decisions:
  - "UPDATE-only approach for step names 1-10 to preserve status/completed_at during migration"
  - "Backfill targets students with step 10 but NOT step 11 to detect old 10-step data"

patterns-established:
  - "Migration idempotency: DROP CONSTRAINT IF EXISTS + ON CONFLICT DO NOTHING"

requirements-completed: [VIS-03]

# Metrics
duration: 7min
completed: 2026-03-28
---

# Phase 16 Plan 03: DB Migration — Expand Roadmap to 15 Steps Summary

**Migration 00008 expands roadmap_progress CHECK constraint to BETWEEN 1 AND 15, backfills steps 11-15 for existing students, and updates seed.sql to 75 rows matching ROADMAP_STEPS config titles**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-28T09:43:08Z
- **Completed:** 2026-03-28T09:50:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Migration 00008 drops the old `BETWEEN 1 AND 10` CHECK constraint and adds `BETWEEN 1 AND 15`
- Backfills steps 11-15 for all existing students who have step 10 but not step 11 (idempotent via ON CONFLICT DO NOTHING)
- Updates step names 1-10 to match ROADMAP_STEPS config titles exactly without touching status or completed_at
- seed.sql roadmap section expanded from 50 rows to 75 rows (5 students x 15 steps each) with correct UUIDs and config-matching step names

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00008** - `d4eb8cd` (feat)
2. **Task 2: Update seed.sql to 15-step roadmap** - `434f61b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/00008_expand_roadmap_to_15_steps.sql` - Expands CHECK constraint, backfills steps 11-15, updates step names 1-10
- `supabase/seed.sql` - Roadmap section expanded from 50 to 75 rows with correct 15-step titles

## Decisions Made

- UPDATE-only for steps 1-10 step names — preserves status and completed_at during migration, only fixes display names
- Backfill trigger condition: `has step 10 AND NOT step 11` — correctly identifies old 10-step records without affecting already-migrated data
- UUID range 0a0-0c4 for new steps 11-15 per student — avoids collision with daily_reports range (090-099)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Migration will apply automatically when Supabase is reset or deployed.

## Next Phase Readiness

- DB now supports 15-step roadmap — all INSERT attempts for steps 11-15 will succeed
- Existing student progress records unaffected (status/completed_at preserved)
- seed.sql ready for fresh `supabase db reset` runs
- Plan 16-04 (if any) can rely on steps 11-15 being queryable

---
*Phase: 16-coach-owner-kpi-visibility*
*Completed: 2026-03-28*

## Self-Check: PASSED

- `supabase/migrations/00008_expand_roadmap_to_15_steps.sql` - FOUND
- `supabase/seed.sql` (75 roadmap rows) - FOUND
- Commit `d4eb8cd` - FOUND
- Commit `434f61b` - FOUND
