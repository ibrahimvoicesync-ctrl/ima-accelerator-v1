---
phase: 14-flexible-work-sessions
plan: "03"
subsystem: ui
tags: [student-dashboard, work-sessions, progress-bar, hours-based, formatHoursMinutes]
dependency_graph:
  requires:
    - phase: 14-01
      provides: formatHoursMinutes utility, WORK_TRACKER.dailyGoalHours config
  provides:
    - student-dashboard-hours-progress
    - session-count-display
    - hours-based-cta-logic
  affects: [src/app/(dashboard)/student/page.tsx]
tech_stack:
  added: []
  patterns: [hours-based-progress-calculation, Math.min-progress-cap, stored-value-progress]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/student/page.tsx
decisions:
  - "Progress bar uses totalMinutesWorked / dailyGoalMinutes for percentage (not cycles), capped at 100% via Math.min"
  - "Session count shown as secondary line instead of hours string — more actionable for students tracking work"
  - "CTA logic gates on totalMinutesWorked >= dailyGoalHours * 60 (not completedCount >= cyclesPerDay)"
requirements-completed:
  - WORK-07
  - WORK-08
duration: 5min
completed: 2026-03-27
---

# Phase 14 Plan 03: Student Dashboard Hours Migration Summary

**Student dashboard work progress card migrated from cycle-count display to hours-based progress bar showing "Xh Ym / 4h" with session count, capped at 100% when 4+ hours worked.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T18:50:00Z
- **Completed:** 2026-03-27T18:55:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced `{completedCount}/{WORK_TRACKER.cyclesPerDay}` header with `{formatHoursMinutes(totalMinutesWorked)} / {WORK_TRACKER.dailyGoalHours}h`
- Progress percentage now calculated from minutes worked vs. 240-minute daily goal (capped at 100%)
- CTA labels changed from "Cycle" to "Session" terminology ("Start Session N", "Continue Session", "Resume Session")
- Session count displayed as `{N} session(s) completed` below the header
- ARIA attributes updated: `aria-valuenow={totalMinutesWorked}`, `aria-valuemax={dailyGoalMinutes}`, descriptive `aria-label`
- All 4 `cyclesPerDay` references removed from executable code

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate student dashboard from cycle-based to hours-based progress** - `c935000` (feat)

## Files Created/Modified

- `src/app/(dashboard)/student/page.tsx` - Hours-based work progress card with session count, updated CTA logic, fixed ARIA

## Decisions Made

- Progress percentage is `Math.min(100, Math.round((totalMinutesWorked / dailyGoalMinutes) * 100))` — hard-caps at 100% so bar never overflows when students exceed the 4-hour goal
- `getNextAction` gates on `totalMinutesWorked < WORK_TRACKER.dailyGoalHours * 60` (minutes) to decide whether to show "Start Session N" or "Submit Report", matching the hours-based model
- `formatHours` import removed since it was only used for the "worked today" line, which was replaced by session count

## Deviations from Plan

None — plan executed exactly as written. All 6 specified changes applied in order (import, function signature, progressPercent, header display, subtitle text, ARIA).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all progress data flows from real Supabase queries (work_sessions filtered by student_id and date). The `totalMinutesWorked` is computed from `duration_minutes` on completed sessions, which is now set from `session.session_minutes` (Plan 01).

## Next Phase Readiness

- All 3 plans in Phase 14 are now complete: data layer (14-01), work tracker UI (14-02), student dashboard (14-03)
- No cyclesPerDay remains in any consumer of the student-facing UI layer
- Phase 14 can be closed and Phase 15 (Outreach KPI Banner) can begin

## Self-Check: PASSED

Files verified:
- src/app/(dashboard)/student/page.tsx: FOUND — formatHoursMinutes on lines 4, 84, 96
- src/app/(dashboard)/student/page.tsx: FOUND — WORK_TRACKER.dailyGoalHours on lines 19, 84, 96
- src/app/(dashboard)/student/page.tsx: FOUND — dailyGoalMinutes on lines 60, 61, 95
- src/app/(dashboard)/student/page.tsx: FOUND — Math.min(100, on line 61
- src/app/(dashboard)/student/page.tsx: FOUND — session on line 88 (session count display)
- src/app/(dashboard)/student/page.tsx: FOUND — aria-valuenow={totalMinutesWorked} on line 93
- src/app/(dashboard)/student/page.tsx: NOT FOUND cyclesPerDay — confirmed removed

Commits verified:
- c935000: feat(14-03): migrate student dashboard to hours-based progress

---
*Phase: 14-flexible-work-sessions*
*Completed: 2026-03-27*
