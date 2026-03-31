---
phase: 28-daily-session-planner-api
plan: 03
subsystem: ui
tags: [react, toast, error-handling, worktrackclient]

# Dependency graph
requires:
  - phase: 28-daily-session-planner-api
    provides: Plan-cap enforcement in POST /api/work-sessions returning 400 errors students must see
provides:
  - Toast-based error display for all 5 WorkTrackerClient mutation handlers (start, complete, pause, resume, abandon)
  - Proper parse-error logging when JSON parsing server error body fails
affects: [student-work-tracker, phase-29-planner-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [useRef(useToast()) stable ref pattern — consistent with routerRef, avoids adding toast to useCallback deps]

key-files:
  created: []
  modified:
    - src/components/student/WorkTrackerClient.tsx

key-decisions:
  - "Use toastRef.current.toast() not toast() directly — keeps useCallback deps stable per CLAUDE.md convention"
  - "Keep all existing console.error calls — toast is added on top, not replacing logging"
  - "Cannot transition race condition in handleComplete still silently handled with router.refresh — it is not a user error"

patterns-established:
  - "useRef(useHook()) for hooks that should not be in useCallback deps — matches existing routerRef pattern"

requirements-completed: [PLAN-09]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 28 Plan 03: WorkTrackerClient Error Handling Summary

**useToast added to WorkTrackerClient via stable ref pattern — all 5 mutation handlers now surface server error messages (e.g., "You must create a daily plan") and network failures as toast notifications instead of silently logging to console**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-31T09:29:00Z
- **Completed:** 2026-03-31T09:31:32Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `import { useToast }` and `const toastRef = useRef(useToast())` to WorkTrackerClient using the stable ref pattern consistent with existing routerRef convention
- All 5 mutation handlers (handleStart, handleComplete, handlePause, handleResume, handleAbandon) now show server error message via `toastRef.current.toast({ type: "error", title: err.error || "Fallback" })`
- All 5 outer catch blocks now show generic "Something went wrong" toast for network/unexpected errors
- Replaced all 5 `.catch(() => ({}))` with `.catch(parseErr => { console.error(...); return { error: null }; })` — parse failures are logged, not silently swallowed
- handleComplete "Cannot transition" race condition correctly left as silent router.refresh (not a user error)
- TypeScript compiles cleanly, build succeeds

## Task Commits

1. **Task 1: Add useToast and fix error handling in all 5 mutation handlers** - `4c047ef` (fix)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/components/student/WorkTrackerClient.tsx` - Added useToast import + toastRef initialization; fixed all 5 mutation handlers and outer catch blocks to show toast on errors

## Decisions Made
- Used `useRef(useToast())` to hold the toast function — keeps it out of `useCallback` dependency arrays, consistent with the `routerRef` pattern already in this file per CLAUDE.md "Stable useCallback deps - use refs for toast/router"
- Kept all existing `console.error` logging — toast is supplemental, not a replacement for console output
- Left the "Cannot transition" race condition handling unchanged in `handleComplete` — silently triggering `router.refresh()` is the correct behavior for that specific edge case

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled cleanly on first attempt, all verification checks passed immediately.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT Test 1 gap is now closed: when the server returns 400 with "You must create a daily plan before starting a work session", students will see that error message as a toast notification
- WorkTrackerClient is ready for Phase 29 planner UI integration
- No blockers

---
*Phase: 28-daily-session-planner-api*
*Completed: 2026-03-31*

## Self-Check: PASSED
- FOUND: src/components/student/WorkTrackerClient.tsx
- FOUND: commit 4c047ef
