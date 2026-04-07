---
phase: 31-student-diy-role
plan: "03"
subsystem: api
tags: [zod, invites, magic-links, student_diy, role-expansion]

# Dependency graph
requires:
  - phase: 31-01-student-diy-role
    provides: "student_diy role in DB schema, types.ts Role union, proxy route guard"
provides:
  - "Invite API accepts student_diy role via Zod validation"
  - "Magic link API accepts student_diy role via Zod validation"
  - "Coach guard updated to allow student_diy invites in both APIs"
  - "coach_id is null for student_diy invites (per ROLE-06, DIY = no coach)"
  - "Owner invite form has Student DIY as selectable role option"
  - "Coach invite form has Student DIY as selectable role option with role selector dropdown"
affects: [invite-creation, coach-invites, owner-invites, registration-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod enum expansion pattern: add new role values to existing enum without breaking defaults"
    - "Coach guard pattern: whitelist approach (block anything not in allowed set) rather than blacklist"
    - "student_diy coach_id null rule: coach_id only set when coach inviting student (not student_diy)"

key-files:
  created: []
  modified:
    - src/app/api/invites/route.ts
    - src/app/api/magic-links/route.ts
    - src/components/owner/OwnerInvitesClient.tsx
    - src/components/coach/CoachInvitesClient.tsx

key-decisions:
  - "student_diy invites created by coaches get coach_id = null (per D-04: DIY = fully independent)"
  - "Coach role selector limited to student|student_diy only (cannot create coach invites)"
  - "Owner role selector expanded to all 3 non-owner roles: student, coach, student_diy"

patterns-established:
  - "Coach guard: allow student AND student_diy, block all others — so adding new student-like roles only needs guard update, not full rework"
  - "coach_id assignment: explicit AND condition (coach AND role=student) rather than ternary on role alone"

requirements-completed: [ROLE-06, ROLE-07]

# Metrics
duration: 3min
completed: "2026-04-03"
---

# Phase 31 Plan 03: Invite Surface Expansion for student_diy Summary

**student_diy role added to Zod enums, coach guards, and UI dropdowns in both invite and magic-link APIs, with coach_id nulled out for DIY invites per ROLE-06**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T15:25:04Z
- **Completed:** 2026-04-03T15:28:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Invite and magic-link APIs now accept `student_diy` as a valid role value (Zod enum expanded)
- Coach guard updated in both APIs: coaches can create `student` or `student_diy` invites, blocked from `coach`
- `coach_id` correctly set to `null` for `student_diy` invites even when created by a coach (per ROLE-06/D-04)
- Owner invite form gains a third dropdown option: Student DIY
- Coach invite form gains a new role selector (Student / Student DIY) with label, aria, and 44px min-height compliance
- Dynamic description text in coach invite tabs updates based on selected role

## Task Commits

Each task was committed atomically:

1. **Task 1: Update invite and magic-link API routes for student_diy** - `17e319d` (feat)
2. **Task 2: Add Student DIY option to owner and coach invite forms** - `a18f91e` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/app/api/invites/route.ts` - Expanded Zod enum, updated coach guard, updated coach_id assignment
- `src/app/api/magic-links/route.ts` - Expanded magicRole type, Zod enum, and coach guard
- `src/components/owner/OwnerInvitesClient.tsx` - Expanded selectedRole type, added student_diy option, updated onChange cast
- `src/components/coach/CoachInvitesClient.tsx` - Added selectedRole state + dropdown + dynamic descriptions, role passed in fetch bodies

## Decisions Made

- `coach_id` uses explicit AND condition: `profile.role === "coach" && parsed.data.role === "student"` — ensures student_diy invites created by coaches always get null, regardless of future role additions
- Coach UI dropdown limited to `student | student_diy` only (coaches cannot create coach invites, consistent with existing auth guard)
- Owner UI dropdown allows all three invitable roles: student, coach, student_diy

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript, build, and lint all passed on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both invite creation surfaces now offer Student DIY as an option
- APIs accept and correctly process student_diy invites
- Registration flow (auth callback) was already updated in Phase 30 to handle student_diy role
- Ready for Phase 31-02 (student_diy dashboard) if not already complete in parallel wave

---
*Phase: 31-student-diy-role*
*Completed: 2026-04-03*
