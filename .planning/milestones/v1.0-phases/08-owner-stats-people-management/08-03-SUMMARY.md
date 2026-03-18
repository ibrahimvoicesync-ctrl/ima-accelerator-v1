---
phase: 08-owner-stats-people-management
plan: 03
subsystem: ui
tags: [next.js, react, dashboard, owner, coaches]

# Dependency graph
requires:
  - phase: 08-01
    provides: StudentCard basePath prop, owner dashboard patterns
  - phase: 06-coach-dashboard-student-views
    provides: Coach dashboard enrichment pattern (lookup maps, at-risk logic)
provides:
  - /owner/coaches page with per-coach student count and avg 7-day rating
  - CoachCard component with initials avatar, student/rating counts, min-h-[44px]
  - /owner/coaches/[coachId] detail page with 4 stat cards and assigned student grid
affects:
  - Phase 09 (owner alerts) — coach detail page provides the per-coach view foundation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CoachCard as presentational component wrapping Link+Card for interactive coach list items
    - Promise.all 3-query parallel fetch for coaches list enrichment (coaches, students, reports)
    - Per-coach lookup Maps (studentsByCoach, studentCoachMap, coachRatings) for O(n) enrichment
    - Identical enrichment pattern to coach dashboard — lookup Maps + at-risk logic reused verbatim
    - reviewRate division-by-zero guard with submittedCount > 0 check

key-files:
  created:
    - src/components/owner/CoachCard.tsx
    - src/app/(dashboard)/owner/coaches/page.tsx
    - src/app/(dashboard)/owner/coaches/[coachId]/page.tsx
  modified: []

key-decisions:
  - "CoachCard uses aria-label={coach.name} on Link (not Card) — Link is the interactive element"
  - "avg rating uses toFixed(1) with null fallback dash — consistent with plan spec"
  - "Coach detail reuses EnrichedStudent type inline — no shared type import needed for single-file server component"
  - "StudentCard basePath='/owner/students' — student links go to /owner/students/[id] not /coach/students/[id]"
  - "reviewRate computation counts submitted_at !== null as submitted, reviewed_by !== null as reviewed"

requirements-completed:
  - OWNER-04
  - OWNER-05

# Metrics
duration: 2 min
completed: 2026-03-17
---

# Phase 8 Plan 3: Owner Coaches List and Coach Detail Summary

**Owner /owner/coaches list with CoachCard grid (student count + avg 7-day rating) and /owner/coaches/[coachId] detail with 4 stat cards (Student Count, Avg Rating, Review Rate, At-Risk) and StudentCard grid pointing to /owner/students**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T17:01:24Z
- **Completed:** 2026-03-17T17:04:22Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Owner can see all coaches in a 2-col (desktop) / 1-col (mobile) card grid at /owner/coaches
- Each CoachCard shows initials avatar, name, email, student count, avg 7-day rating
- CoachCard links to /owner/coaches/[coachId] with min-h-[44px] and aria-label
- Coach detail page shows header (initials avatar, name, email) with back link to /owner/coaches
- 4 stat cards in grid-cols-2 lg:grid-cols-4: Student Count, Avg Rating, Review Rate, At-Risk
- Review Rate has division-by-zero guard (submittedCount > 0)
- At-Risk count shows text-ima-error when > 0
- Assigned students grid uses StudentCard with basePath="/owner/students" for correct navigation
- Empty states for no coaches and no assigned students
- Build passes, all routes confirmed in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Coach list page with CoachCard component** - `96374ad` (feat)
2. **Task 2: Coach detail page with stats and student grid** - `14b2041` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/owner/CoachCard.tsx` - Presentational coach card with initials, student count, avg rating, Link wrapper
- `src/app/(dashboard)/owner/coaches/page.tsx` - Owner coaches list page with Promise.all 3-query enrichment
- `src/app/(dashboard)/owner/coaches/[coachId]/page.tsx` - Coach detail page with 4 stat cards and StudentCard grid

## Decisions Made

- CoachCard wraps the entire card in a Link with `aria-label={coach.name}` and `min-h-[44px] block` class — the Link is the interactive element per 44px touch target rule
- The coach detail page derives `nowMs` from `getToday()` string (not `Date.now()`) to satisfy the react-hooks/purity lint pattern established in Phase 6
- `studentList.length` used for Student Count stat card (not enrichedStudents.length) since enrichedStudents could exclude students with edge-case logic
- StudentCard `basePath="/owner/students"` so clicking a student from the owner's coach detail page navigates to the owner's student view, not the coach's student view

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 9 (Owner Alerts) can build on the coach detail page pattern for per-coach alert views
- All owner people-management views (students, coaches) are now complete and live

---
*Phase: 08-owner-stats-people-management*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: src/components/owner/CoachCard.tsx
- FOUND: src/app/(dashboard)/owner/coaches/page.tsx
- FOUND: src/app/(dashboard)/owner/coaches/[coachId]/page.tsx
- FOUND: 96374ad (Task 1 commit)
- FOUND: 14b2041 (Task 2 commit)
