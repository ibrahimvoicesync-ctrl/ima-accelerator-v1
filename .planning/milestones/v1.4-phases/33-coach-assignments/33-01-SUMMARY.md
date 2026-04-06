---
phase: 33-coach-assignments
plan: 01
subsystem: api
tags: [config, navigation, role-guard, assignments, coach]

# Dependency graph
requires:
  - phase: 22-spike-protection-rate-limiting
    provides: checkRateLimit helper used by assignments route
  - phase: 23-security-audit
    provides: verifyOrigin CSRF helper used by assignments route
provides:
  - Coach sidebar "Assignments" nav entry pointing to /coach/assignments
  - ROUTES.coach.assignments registered in config
  - PATCH /api/assignments accepts coach role in addition to owner

affects:
  - 33-02 (coach assignments page depends on this nav/route/API foundation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Expanding role guard from single-role to multi-role with && conditions

key-files:
  created: []
  modified:
    - src/lib/config.ts
    - src/app/api/assignments/route.ts

key-decisions:
  - "D-04: Reuse existing /api/assignments route — expand role check to owner+coach, no separate endpoint"
  - "ArrowLeftRight icon for Assignments nav entry — consistent with owner sidebar"
  - "Assignments entry positioned after Invite Students (separator group) and before Analytics"

patterns-established:
  - "Role guard expansion: use && condition — profile.role !== 'owner' && profile.role !== 'coach'"

requirements-completed:
  - ASSIGN-05
  - ASSIGN-06

# Metrics
duration: 1min
completed: 2026-04-03
---

# Phase 33 Plan 01: Coach Assignments Foundation Summary

**Coach role expanded to PATCH /api/assignments and Assignments nav entry registered in config for /coach/assignments**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-03T20:16:03Z
- **Completed:** 2026-04-03T20:17:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Registered `assignments: "/coach/assignments"` in `ROUTES.coach` (config.ts)
- Added Assignments nav entry with ArrowLeftRight icon between Invite Students and Analytics in NAVIGATION.coach
- Expanded `/api/assignments` PATCH role guard from owner-only to owner+coach, preserving CSRF, rate limiting, and Zod validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Register coach assignments route and nav entry in config** - `d34e6bc` (feat)
2. **Task 2: Expand assignments API role guard to allow coach role** - `5bcd533` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/config.ts` - Added `assignments: "/coach/assignments"` to ROUTES.coach; added Assignments NavItem to NAVIGATION.coach
- `src/app/api/assignments/route.ts` - Changed role guard from `!== "owner"` to `!== "owner" && !== "coach"`

## Decisions Made
- Reused existing `/api/assignments` endpoint (D-04 from CONTEXT.md) — no separate coach endpoint needed
- ArrowLeftRight icon matches owner sidebar Assignments entry for visual consistency
- Assignments positioned after "Invite Students" separator group (index 4) — grouped with management actions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing lint errors in unrelated files (load-tests scripts, coach/owner student detail pages, CalendarTab, WorkTrackerClient) — out of scope, not caused by this plan's changes. TypeScript check passes with 0 errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 33-02 can now implement the /coach/assignments page — API accepts coach requests and sidebar link is registered
- No blockers for plan 33-02

## Self-Check: PASSED

- FOUND: src/lib/config.ts
- FOUND: src/app/api/assignments/route.ts
- FOUND: 33-01-SUMMARY.md
- FOUND: d34e6bc (Task 1 commit)
- FOUND: 5bcd533 (Task 2 commit)
- FOUND: ROUTES.coach.assignments in config.ts
- FOUND: Assignments nav entry in config.ts
- FOUND: expanded role guard in route.ts

---
*Phase: 33-coach-assignments*
*Completed: 2026-04-03*
