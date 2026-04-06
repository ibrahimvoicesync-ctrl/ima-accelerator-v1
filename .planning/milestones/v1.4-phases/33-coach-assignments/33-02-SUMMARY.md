---
phase: 33-coach-assignments
plan: 02
subsystem: ui
tags: [react, nextjs, supabase, coach, assignments, optimistic-ui]

# Dependency graph
requires:
  - phase: 33-01
    provides: ROUTES.coach.assignments config entry and API coach role guard
  - phase: 33-coach-assignments
    provides: PATCH /api/assignments endpoint with coach role support

provides:
  - Coach assignments page at /coach/assignments (server component)
  - CoachAssignmentsClient with search, filter, optimistic dropdown assignment UI

affects:
  - coach-role feature development
  - any future coach management UI work

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Adapter pattern — CoachAssignmentsClient is a stripped-down adaptation of OwnerAssignmentsClient (no capacity cards or stats per D-03)
    - Optimistic UI via localAssignments Record state with per-row savingRows loading
    - Stable ref pattern (routerRef + toastRef) for zero-dep useCallback

key-files:
  created:
    - src/components/coach/CoachAssignmentsClient.tsx
    - src/app/(dashboard)/coach/assignments/page.tsx
  modified: []

key-decisions:
  - "D-01: All role='student' active users visible — no coach_id filter on students query"
  - "D-02: student_diy excluded by .eq('role','student') alone — not included in .in() call"
  - "D-03: No capacity cards or stats grid on coach view — simplified to match coach scope"

patterns-established:
  - "Coach assignment page mirrors owner page structure but omits stat row and capacity cards"

requirements-completed: [ASSIGN-01, ASSIGN-02, ASSIGN-03, ASSIGN-04]

# Metrics
duration: 15min
completed: 2026-04-03
---

# Phase 33 Plan 02: Coach Assignments UI Summary

**Coach assignments page with optimistic dropdown UI at /coach/assignments — all active students visible, no capacity cards, search + filter tabs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-03T20:21:08Z
- **Completed:** 2026-04-03T20:36:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `CoachAssignmentsClient` — searchable, filterable student list with coach dropdown selectors and instant optimistic assignment updates
- Created `/coach/assignments` server page — fetches all role='student' active users and all active coaches, renders client component
- Full production build passes with `/coach/assignments` route compiling cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CoachAssignmentsClient component** - `1f5fe20` (feat)
2. **Task 2: Create coach assignments server page** - `ee04c61` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/coach/CoachAssignmentsClient.tsx` - Client component with All/Assigned/Unassigned filter tabs, name/email search, per-student coach select with optimistic UI
- `src/app/(dashboard)/coach/assignments/page.tsx` - Server page with requireRole("coach"), admin client queries for all active students + coaches, no stat cards

## Decisions Made

- D-01: Students query uses `.eq("role", "student")` with no `coach_id` filter — all students visible to coach regardless of current assignment
- D-02: `student_diy` role excluded by the `role='student'` constraint alone (no `in()` needed)
- D-03: No capacity cards, no stat row — coach view is simplified from owner view per context decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/coach/assignments` is fully functional and linked in the nav (wave 1 added the nav entry)
- Coaches can now assign, reassign, and unassign students with optimistic feedback
- Phase 33 is complete — both waves executed

---
*Phase: 33-coach-assignments*
*Completed: 2026-04-03*
