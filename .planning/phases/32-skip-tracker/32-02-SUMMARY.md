---
phase: 32-skip-tracker
plan: 02
subsystem: owner-dashboard, ui
tags: [rpc, skip-tracking, badge, supabase, owner]

# Dependency graph
requires:
  - phase: 32-skip-tracker
    plan: 01
    provides: get_weekly_skip_counts RPC function and batch call pattern
  - phase: 26-database-schema-foundation
    provides: work_sessions and daily_reports tables
provides:
  - Skip count badge on owner student list cards
  - Skip count badge in owner student detail page header
  - skippedDays prop on OwnerStudentDetailClient
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Batch RPC call for paginated list — single get_weekly_skip_counts call for current page student IDs
    - Single-element RPC call for detail page — [student.id] array for individual student
    - eslint-disable-next-line placement inside ternary — comment on the line directly before (admin as any)

key-files:
  created: []
  modified:
    - src/app/(dashboard)/owner/students/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx

key-decisions:
  - "Owner student list reuses same batch RPC pattern as coach dashboard — getTodayUTC() and getUTCHours() for determinism"
  - "Detail page passes [student.id] as single-element array to RPC — consistent interface, avoids special-case code path"
  - "Skip badge placed above at-risk badge in detail header — both can coexist on same student"
  - "eslint-disable-next-line must be on line immediately before (admin as any); extracted ternary to skipResult variable to enable proper placement"

patterns-established:
  - "Pattern: eslint-disable-next-line for (admin as any) RPC calls must be on the line directly above the cast, not above a multi-line ternary"

requirements-completed: [SKIP-04]

# Metrics
duration: ~10min
completed: 2026-04-03
---

# Phase 32 Plan 02: Owner Skip Tracker Display Summary

**Owner student list and detail views now show 'X skipped' warning badges using the same get_weekly_skip_counts RPC as coach dashboard — giving owners platform-wide skip visibility**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-03
- **Completed:** 2026-04-03
- **Tasks:** 2
- **Files created:** 0
- **Files modified:** 3

## Accomplishments
- Owner students list page fetches skip counts via single batch RPC for the current page, renders "X skipped" warning badge above status badge using flex-col stacking
- Owner student detail page fetches skip count for the individual student, passes as `skippedDays` prop to `OwnerStudentDetailClient`
- `OwnerStudentDetailClient` renders "X skipped this week" warning badge in the header (near at-risk badge) only when `skippedDays > 0`
- Student_DIY users automatically excluded — both pages filter `.eq("role", "student")`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skip count badge to owner students list page** - `ce59882` (feat)
2. **Task 2: Add skip count to owner student detail page and client** - `be2a40c` (feat)
3. **Fix: eslint-disable placement in owner students list page** - `4fe7193` (fix)

## Files Created/Modified
- `src/app/(dashboard)/owner/students/page.tsx` - Added getTodayUTC import, batch RPC call, skipCountMap, and flex-col badge stack
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` - Added single-student RPC call, skippedDays computation, skippedDays prop passed to client
- `src/components/owner/OwnerStudentDetailClient.tsx` - Added skippedDays to interface, destructured prop, warning badge in header

## Decisions Made
- Owner student list uses same batch pattern as coach dashboard — getTodayUTC() and getUTCHours() ensure deterministic behavior
- Detail page uses single-element array `[student.id]` for RPC consistency rather than a different code path
- Skip badge and at-risk badge both rendered independently in detail header — same student can be both at-risk and have skipped days

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed eslint-disable-next-line placement for ternary RPC call**
- **Found during:** Task 1 (linting after commit)
- **Issue:** `eslint-disable-next-line` comment placed above the ternary operator line, but `(admin as any)` appeared two lines later — lint error reported on actual any usage line
- **Fix:** Extracted the ternary to a `skipResult` variable so the eslint-disable comment could be placed directly above the `(admin as any)` line
- **Files modified:** src/app/(dashboard)/owner/students/page.tsx
- **Verification:** `npm run lint` — no errors on owner/students files
- **Committed in:** 4fe7193 (fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug — eslint-disable placement)
**Impact on plan:** Necessary for lint compliance. No scope creep.

## Issues Encountered
- Pre-existing lint errors in `load-tests/scripts/gen-tokens.js` (require-style imports) and `OwnerStudentDetailPage` (react-hooks/purity) — out of scope, logged but not fixed

## User Setup Required
None - migration 00016 (created in Plan 01) contains the RPC used here.

## Next Phase Readiness
- Phase 32 complete: get_weekly_skip_counts RPC integrated into coach dashboard (Plan 01) and both owner student views (Plan 02)
- SKIP-01 through SKIP-05 requirements fulfilled
- No blockers

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/owner/students/page.tsx (getTodayUTC, get_weekly_skip_counts, skipCountMap, flex-col items-end gap-1)
- FOUND: src/app/(dashboard)/owner/students/[studentId]/page.tsx (get_weekly_skip_counts, p_student_ids: [student.id], skippedDays={skippedDays})
- FOUND: src/components/owner/OwnerStudentDetailClient.tsx (skippedDays: number in interface, skippedDays in destructure, "skipped this week" badge)
- FOUND: ce59882 (Task 1 commit)
- FOUND: be2a40c (Task 2 commit)
- FOUND: 4fe7193 (fix commit)

---
*Phase: 32-skip-tracker*
*Completed: 2026-04-03*
