---
phase: 18-roadmap-date-kpis-completion-logging
plan: 02
subsystem: ui
tags: [roadmap, deadline, badge, coach, owner, progress-bar]

# Dependency graph
requires:
  - phase: 18-01
    provides: getDeadlineStatus() utility and DeadlineStatus discriminated union from roadmap-utils.ts

provides:
  - RoadmapTab.tsx upgraded with deadline status chips for coach and owner views
  - completed_at in roadmap data pipeline (server query -> client prop -> RoadmapTab)
  - joinedAt prop threading from StudentDetailClient and OwnerStudentDetailClient to RoadmapTab
  - Progress bar fixed from /10 to /15 (ROADMAP_STEPS.length) with correct aria

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getDeadlineStatus() reused across student/coach/owner roadmap views
    - rowMap pattern: Map of full row objects (vs statusMap of just status strings)

key-files:
  created: []
  modified:
    - src/components/coach/RoadmapTab.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx

key-decisions:
  - "RoadmapTab is read-only — no Mark Complete button on coach/owner views"
  - "rowMap replaces statusMap to carry completed_at alongside status for deadline calculation"
  - "Progress denominator uses ROADMAP_STEPS.length (15) not hardcoded 10"

requirements-completed: [ROAD-05]

# Metrics
duration: 10min
completed: 2026-03-28
---

# Phase 18 Plan 02: Coach/Owner Roadmap Deadline Chips Summary

**Coach and owner RoadmapTab upgraded with getDeadlineStatus() chips (on-track/due-soon/overdue/completed), completed_at threading through full data pipeline, and progress bar fixed from /10 to /15 steps**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-28T17:53:00Z
- **Completed:** 2026-03-28T18:03:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Updated coach and owner server pages to include `completed_at` in `roadmap_progress` query select
- Updated `roadmap` prop type in `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` to include `completed_at: string | null`
- Threaded `joinedAt={student.joined_at}` from both client components to `RoadmapTab`
- Upgraded `RoadmapTab.tsx`: replaced `statusMap` with `rowMap`, imports `getDeadlineStatus`, renders deadline Badge chips (completed green with date/late suffix, on-track green, due-soon amber, overdue red)
- Fixed progress bar denominator from hardcoded `/10` to `ROADMAP_STEPS.length` (15) including aria-valuemax and aria-label
- All toLocaleDateString calls use `timeZone: "UTC"` per the UTC pitfall rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread completed_at through data pipeline** - `88aa811` (feat)
2. **Task 2: Upgrade RoadmapTab with deadline chips and fix /15 denominator** - `8b9c125` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/coach/RoadmapTab.tsx` - Full upgrade: new imports (getDeadlineStatus, Calendar, Badge), updated types, rowMap, deadline chips, ROADMAP_STEPS.length denominator
- `src/components/coach/StudentDetailClient.tsx` - Added `completed_at: string | null` to roadmap prop type; passes `joinedAt={student.joined_at}` to RoadmapTab
- `src/components/owner/OwnerStudentDetailClient.tsx` - Same two changes as StudentDetailClient
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` - Added `completed_at` to roadmap query select string
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` - Added `completed_at` to roadmap query select string

## Decisions Made

- RoadmapTab is coach/owner read-only — no "Mark Complete" button (students mark steps complete via their own view)
- `rowMap` pattern stores the full `RoadmapProgressRow` object keyed by step_number, allowing both `status` and `completed_at` access in a single lookup
- `ds.kind === "none"` renders no chip — steps with `target_days: null` show no deadline indicator per D-01
- Completed steps always render green Badge regardless of lateness; `daysLate` suffix is the only late indicator per D-05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing build failure in `src/app/api/reports/route.ts` and `src/components/student/ReportForm.tsx` (property `outreachBrands`/`outreachInfluencers` not found on VALIDATION config). This is unrelated to Plan 18-02 and was present before any changes in this plan. Confirmed by verifying the error exists without any modifications staged. This must have been introduced by a schema rename between phase 15 config and the route implementation, and requires a separate fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 18 is complete: Plans 01 and 02 both done
- ROAD-02 through ROAD-05 requirements fulfilled
- Pre-existing `outreachBrands`/`outreachInfluencers` build error should be addressed before v1.1 ships

---
*Phase: 18-roadmap-date-kpis-completion-logging*
*Completed: 2026-03-28*
