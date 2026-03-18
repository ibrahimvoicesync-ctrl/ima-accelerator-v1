---
phase: 11-fix-invite-registration-url
plan: 01
subsystem: api

tags: [invite, registration, url, routing]

# Dependency graph
requires:
  - phase: 07-coach-report-review-invites-analytics
    provides: POST /api/invites invite creation endpoint
  - phase: 02-authentication-access
    provides: /register/[code]/page.tsx path-segment routing for invite registration
provides:
  - Corrected POST /api/invites returning registerUrl as /register/{code} path-segment format
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/app/api/invites/route.ts

key-decisions:
  - "registerUrl uses path-segment format /register/${code} (not query-param ?code=) because the invite registration page is a dynamic route at /register/[code]"

patterns-established: []

requirements-completed: [COACH-05, OWNER-06]

# Metrics
duration: 1min
completed: 2026-03-18
---

# Phase 11 Plan 01: Fix Invite Registration URL Summary

**One-line fix in POST /api/invites changing registerUrl from query-param `/register?code={code}` to path-segment `/register/{code}` so copied invite links route to RegisterCard instead of MagicLinkCard**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T14:57:20Z
- **Completed:** 2026-03-18T14:58:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed broken invite registration URL format that caused invite links to land on the wrong page
- Invite links now route to `/register/[code]/page.tsx` (RegisterCard) as intended
- Magic link URL format `/register?magic={code}` unchanged and still routes to `/register/page.tsx`
- TypeScript, lint, and production build all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix registerUrl format in POST /api/invites** - `f141975` (fix)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/app/api/invites/route.ts` - Changed line 92: `/register?code=${code}` -> `/register/${code}`

## Decisions Made
- registerUrl uses path-segment format `/register/${code}` because `/register/[code]/page.tsx` reads code from `params` (path segment), not `searchParams` (query param). Query-param format `/register?code=X` incorrectly routes to `/register/page.tsx` which reads `?magic=` only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COACH-05 and OWNER-06 requirements are now closed
- Coach-generated and owner-generated invite links will correctly land on the RegisterCard page when copied and visited
- No further work needed for this phase

---
*Phase: 11-fix-invite-registration-url*
*Completed: 2026-03-18*
