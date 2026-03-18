---
phase: 03-student-work-tracker
plan: "02"
subsystem: student-work-tracker
tags: [work-tracker, timer, ui, client-components]
dependency_graph:
  requires: [03-01]
  provides: [work-tracker-ui, cycle-timer, cycle-cards, work-page]
  affects: [student-dashboard]
tech_stack:
  added: []
  patterns: [svg-circular-progress, stable-ref-callbacks, server-client-island, stale-session-cleanup]
key_files:
  created:
    - src/components/student/WorkTimer.tsx
    - src/components/student/CycleCard.tsx
    - src/components/student/WorkTrackerClient.tsx
    - src/app/(dashboard)/student/work/page.tsx
  modified: []
decisions:
  - "WorkTimer gets onComplete via ref to avoid clearing the setInterval on callback identity change"
  - "WorkTrackerClient uses useRef(useRouter()) for stable router reference in async callbacks"
  - "handleAbandon looks up target session by sessionId from sessions array — safe for both active and paused states"
  - "Stale session abandon fires silently on mount then calls router.refresh() — no user interruption"
  - "CycleCard resume button uses aria-label with cycle number for screen reader specificity"
metrics:
  duration: "4 min"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 3 Plan 2: Work Tracker UI Summary

SVG circular countdown timer, cycle status cards, and full start/pause/resume/complete/abandon interaction loop for the student work tracker page.

## What Was Built

### WorkTimer (src/components/student/WorkTimer.tsx)

SVG circular progress ring (280px, 8px stroke) that depletes clockwise. Computes `remainingSeconds` from `startedAt` on mount for navigation persistence. Ticks every second via `setInterval`. Calls `onComplete` (via stable `onCompleteRef`) when time hits 0. Updates browser tab title every tick. Has `role="timer"`, `aria-label` with dynamic time, `aria-live="polite"` region announcing every 15 seconds. SVG has `aria-hidden="true"`. Progress ring uses `motion-safe:transition-[stroke-dashoffset]`.

### CycleCard (src/components/student/CycleCard.tsx)

Renders one of 5 status states: completed (green Check), in_progress (blue Play), paused (amber Pause), abandoned (red X), pending (muted Circle). All icons have `aria-hidden="true"`. Paused state shows secondary Resume button with `min-h-[44px]` and `aria-label="Resume cycle N"`.

### WorkTrackerClient (src/components/student/WorkTrackerClient.tsx)

Client island orchestrating the full work tracker page:
- Derived state: `activeSession`, `pausedSession`, `completedCount`, `allComplete`, `nextCycleNumber`, `totalMinutesWorked`
- Stale session cleanup: auto-abandons any `in_progress`/`paused` sessions from past dates on mount
- `handleStart`: POST `/api/work-sessions`, checks `response.ok`, calls `router.refresh()`
- `handleComplete`: PATCH with `status: "completed"`, silently ignores "Cannot transition" race conditions
- `handlePause` / `handleResume`: PATCH with respective status, calls `router.refresh()`
- `handleAbandon`: looks up target by `sessionId` (not `activeSession`) — safe for both active and paused states; grace period check via `WORK_TRACKER.abandonGraceSeconds`; inline confirmation for < 5 min
- Render: allComplete celebration → active timer → paused state → idle start → cycle grid

### /student/work server page

Server component with `requireRole("student")` + `createAdminClient()` query filtered by `student_id` and `date`. Passes `sessions ?? []` to `WorkTrackerClient` island.

## Decisions Made

- **onCompleteRef pattern**: `WorkTimer` stores `onComplete` in a ref so the `setInterval` closure always calls the latest callback without being re-created on each render.
- **Stable router ref**: `WorkTrackerClient` uses `useRef(useRouter())` — stores the router instance once to prevent dependency churn in async mutation callbacks.
- **handleAbandon session lookup**: Abandon handler looks up the target session by `sessionId` from the `sessions` state array rather than using `activeSession` directly — this correctly handles abandoning a paused session from the paused-state action buttons.
- **Stale session silent abandon**: Stale sessions from past dates are abandoned silently on mount (no toast, no blocking) to keep the experience clean on return visits.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
