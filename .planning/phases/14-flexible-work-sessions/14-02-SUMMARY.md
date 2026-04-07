---
phase: 14-flexible-work-sessions
plan: "02"
subsystem: student-ui
tags: [work-tracker, state-machine, flexible-sessions, break-countdown, session-list]
dependency_graph:
  requires: [14-01]
  provides: [flexible-work-tracker-ui, break-countdown, duration-picker, hours-progress-bar]
  affects:
    - src/components/student/WorkTrackerClient.tsx
    - src/components/student/WorkTimer.tsx
    - src/components/student/CycleCard.tsx
    - src/app/(dashboard)/student/work/page.tsx
tech_stack:
  added: []
  patterns: [discriminated-union-state-machine, useCallback-stable-handlers, client-only-break-timer]
key_files:
  created: []
  modified:
    - src/components/student/WorkTrackerClient.tsx
    - src/components/student/WorkTimer.tsx
    - src/components/student/CycleCard.tsx
    - src/app/(dashboard)/student/work/page.tsx
decisions:
  - "TrackerPhase discriminated union (idle/setup/working/break) replaces boolean-derived state for explicit phase transitions"
  - "Break countdown is React state only — never touches DB or paused_at field"
  - "First session skips break prompt entirely; completedCount >= 2 triggers break after completion"
  - "Session list filters abandoned sessions and sorts newest-first with show-more at 4 default"
  - "Hours progress bar caps at 100% at 4h but students can keep starting sessions (no cap on nextCycleNumber)"
metrics:
  duration: "3m 30s"
  completed: "2026-03-27"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 14 Plan 02: Flexible Work Tracker UI Summary

**One-liner:** Rewrote WorkTrackerClient with idle/setup/working/break state machine, duration picker (30/45/60 min), break countdown with skip, hours progress bar, and dynamic session list replacing the fixed 4-cycle grid.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Refactor WorkTrackerClient with state machine, duration picker, break countdown, session list, and hours bar | d38cfe9 | src/components/student/WorkTrackerClient.tsx |
| 2 | Update WorkTimer, CycleCard, and Work page for flexible sessions | 9ff0f18 | src/components/student/WorkTimer.tsx, src/components/student/CycleCard.tsx, src/app/(dashboard)/student/work/page.tsx |

## What Was Built

### src/components/student/WorkTrackerClient.tsx (near-complete rewrite)

**State machine** — `TrackerPhase` discriminated union drives all render decisions:
- `idle`: shows "Ready for Session N" + "Set Up Session" button
- `setup`: shows duration picker (30/45/60) and break selection (only if completedCount > 0)
- `working`: shows active timer or paused state (unchanged mutation handlers)
- `break`: shows countdown timer with skip button; ticks via client-only `setInterval`

**Duration picker** — Three buttons (30/45/60) from `WORK_TRACKER.sessionDurationOptions`. Selected value sent as `session_minutes` in POST body. Default is `WORK_TRACKER.defaultSessionMinutes` (45).

**Break countdown** — `useEffect` ticks break seconds down in React state only. Triggered after completing session 2+ (`completedCount >= 2`). Break type/duration pre-selected in setup phase. `handleSkipBreak` resets phase to idle instantly.

**Hours progress bar** — Replaces "X of 4 cycles done" text. Uses `formatHoursMinutes(totalMinutesWorked)` / `WORK_TRACKER.dailyGoalHours`h. Has `role="progressbar"` with aria-valuenow/min/max. Caps at 100% visually but sessions are unbounded.

**Session list** — Dynamic list filters abandoned sessions, sorts newest-first, shows max 4 by default with "Show N more sessions" / "Show less" toggle. Each card passes `sessionMinutes` prop.

**Removed** — `allComplete` variable, "All 4 cycles complete!" celebration banner, `Array.from({ length: cyclesPerDay })` grid, `!allComplete` guard, `formatHours` import.

### src/components/student/WorkTimer.tsx

Removed `WORK_TRACKER` import entirely. Changed all three `cyclesPerDay` references:
- Screen reader announce text: `"Session ${cycleNumber}"` (no `of 4`)
- `aria-label`: `"Session ${cycleNumber}"` (no `of 4`)
- Visible centered text: `Session {cycleNumber}` (no `of {WORK_TRACKER.cyclesPerDay}`)

### src/components/student/CycleCard.tsx

Added `sessionMinutes?: number` to `CycleCardProps` interface and component destructuring. Updated display from `"Cycle {cycleNumber}"` to `"Session {cycleNumber} — X min"` when `sessionMinutes` is provided (em dash `\u2014` separator). Resume button aria-label updated from "cycle" to "session".

### src/app/(dashboard)/student/work/page.tsx

Subtitle changed from `"Track your daily 45-minute work cycles"` to `"Track your daily work sessions"`. No other changes — server component passes `initialSessions` unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added aria-pressed to picker buttons**
- **Found during:** Task 1
- **Issue:** Duration picker, break type, and break duration preset buttons use selected/active states but had no ARIA indication of pressed state (accessibility gap)
- **Fix:** Added `aria-pressed={selectedMinutes === min}` / `aria-pressed={breakType === type}` / `aria-pressed={breakMinutes === min}` to all toggle buttons
- **Files modified:** src/components/student/WorkTrackerClient.tsx
- **Commit:** d38cfe9

**2. [Rule 1 - Bug] TypeScript error from staging order**
- **Found during:** Task 1 verification
- **Issue:** WorkTrackerClient used `sessionMinutes` prop on CycleCard before CycleCard was updated — tsc error TS2322. Plan intended Tasks 1 and 2 to be independent but prop interface had a cross-dependency.
- **Fix:** Updated CycleCard (Task 2) before re-running tsc. Both tasks were committed separately as planned after TypeScript was clean.
- **Files modified:** src/components/student/CycleCard.tsx (committed in Task 2)
- **Commit:** 9ff0f18

**3. [Rule 2 - Missing] Added daily report link in idle/break states**
- **Found during:** Task 1 render implementation
- **Issue:** After removing the allComplete celebration banner (D-07), there was no path for a student who completed sessions to navigate to the daily report. The plan specified removing the banner but didn't add a replacement link.
- **Fix:** Added a subtle "Submit Daily Report" link that appears when `completedCount > 0` and no active/paused session and phase is not break. Uses `Link` component (already imported) and `ROUTES.student.report`.
- **Files modified:** src/components/student/WorkTrackerClient.tsx
- **Commit:** d38cfe9

## Decisions Made

1. **TrackerPhase state machine** — Discriminated union (`idle | setup | working | break`) provides explicit, exhaustive phase transitions instead of derived booleans. The `phase` state is the single source of UI rendering truth.

2. **Break countdown is client-only** — The break timer runs entirely in React state via `setInterval`. No DB calls, no `paused_at` mutations during break. This matches the research note in STATE.md: "Break timer in React state only."

3. **First session skips break** — `completedCount >= 2` check in `handleComplete` means: after completing session 1 (completedCount goes 0→1, newCompletedCount = 1), phase goes to `idle`. After completing session 2+ (newCompletedCount >= 2), phase goes to `break`. This implements WORK-03 correctly.

4. **useCallback on all handlers** — All mutation handlers use `useCallback` with explicit deps to avoid unnecessary re-renders when passed to child components (WorkTimer's `onComplete`, CycleCard's `onResume`).

## Known Stubs

None — all functionality is fully wired. Break countdown uses `breakMinutes` state (set in setup phase), session list reads from `sessions` state, progress bar reads from `totalMinutesWorked` derived from completed sessions.

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npm run lint`: 0 errors (4 pre-existing warnings in unrelated files)
- `grep -r "cyclesPerDay" src/components/`: no matches
- `grep -r "allComplete" src/components/`: no matches
- `grep -r "All 4 cycles" src/`: no matches
- All must_haves truths satisfied:
  - Duration picker (30/45/60) shown in setup phase
  - Break type and duration selection shown for non-first sessions
  - First session starts immediately without break prompt
  - Break countdown ticks down visually with role="timer"
  - Skip break button present
  - Circular timer ring uses session_minutes via totalSeconds prop
  - Session list is dynamic, newest-first, shows existing sessions only
  - Latest 4 shown by default with "Show N more sessions" link
  - Each session card shows "Session N — X min"
  - Hours progress bar replaces cycle display
  - Progress bar caps at 100% visually, sessions continue
  - Session count shown in bar (X sessions completed)
  - No celebration banner blocks further sessions

## Self-Check: PASSED

Files verified:
- src/components/student/WorkTrackerClient.tsx: FOUND — 310 lines, contains TrackerPhase, sessionDurationOptions, breakOptions, role="progressbar", role="timer", Skip Break, formatHoursMinutes, more session
- src/components/student/WorkTimer.tsx: FOUND — WORK_TRACKER removed, Session ${cycleNumber} on lines 78, 85; Session {cycleNumber} on visible text
- src/components/student/CycleCard.tsx: FOUND — sessionMinutes?: number in interface, Session {cycleNumber} in display
- src/app/(dashboard)/student/work/page.tsx: FOUND — "Track your daily work sessions" subtitle

Commits verified:
- d38cfe9: feat(14-02): refactor WorkTrackerClient with state machine and flexible sessions
- 9ff0f18: feat(14-02): update WorkTimer, CycleCard, and Work page for flexible sessions
