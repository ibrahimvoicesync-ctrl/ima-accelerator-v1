---
phase: 27-coach-owner-roadmap-undo
plan: 02
subsystem: ui
tags: [react, typescript, roadmap, undo, modal, toast, accessibility, coach, owner]

# Dependency graph
requires:
  - phase: 27-01
    provides: PATCH /api/roadmap/undo endpoint with cascade re-lock and audit logging

provides:
  - Undo button on completed steps in coach/owner RoadmapTab
  - Confirmation modal with cascade-aware description text
  - handleUndo callback wired to PATCH /api/roadmap/undo

affects: [human-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable ref pattern: useRef(useRouter()), toastRef updated via useEffect — same as RoadmapClient.tsx"
    - "IIFE in JSX for modal description computation — avoids declaring variables in render scope"
    - "res.ok check before res.json() — CLAUDE.md hard rule applied"

key-files:
  created: []
  modified:
    - src/components/coach/RoadmapTab.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx

key-decisions:
  - "Use IIFE in JSX for modal cascade-description computation — avoids extracting to separate component for a small inline computation"
  - "confirmStep null check inside IIFE uses (confirmStep ?? 0) + 1 to avoid non-null assertion — cleaner than !"
  - "Build failure is pre-existing Google Fonts network error (no internet), not caused by our changes — tsc --noEmit passes with zero errors"

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 27 Plan 02: Undo UI — RoadmapTab Undo Button, Modal, and studentId Prop Threading

**Undo button on completed steps with cascade-aware confirmation modal and handleUndo callback wired to PATCH /api/roadmap/undo; studentId prop threaded from both coach and owner parent detail components**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T07:38:37Z
- **Completed:** 2026-03-31T07:41:37Z
- **Tasks:** 2 of 3 (Task 3 is a checkpoint:human-verify — awaiting user)
- **Files modified:** 3

## Accomplishments

- Added undo button (RotateCcw icon, aria-label, 44px touch target) on all completed steps in RoadmapTab
- Confirmation modal with cascade-aware description: simple variant vs "will also be re-locked" cascade variant computed client-side from roadmap prop (no extra API call)
- handleUndo callback following exact RoadmapClient.tsx stable-ref pattern (routerRef, toastRef, useCallback with confirmStep + studentId deps)
- res.ok checked before res.json(); catch block always calls toastRef.current (never swallows errors per CLAUDE.md)
- studentId prop threaded from StudentDetailClient.tsx and OwnerStudentDetailClient.tsx to RoadmapTab

## Task Commits

1. **Task 1: Add undo button, confirmation modal, and handleUndo to RoadmapTab** — `f3fa725` (feat)
2. **Task 2: Thread studentId prop to RoadmapTab in both parent components** — `88c38b6` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/components/coach/RoadmapTab.tsx` — Added studentId prop, useState (confirmStep, undoing), useRef (routerRef, toastRef), useCallback (handleUndo), undo button on completed steps, confirmation modal with cascade text
- `src/components/coach/StudentDetailClient.tsx` — Added `studentId={studentId}` to RoadmapTab call site
- `src/components/owner/OwnerStudentDetailClient.tsx` — Added `studentId={studentId}` to RoadmapTab call site

## Decisions Made

- Used IIFE in JSX for modal cascade-description computation to keep it inline without extracting a separate component
- Used `(confirmStep ?? 0) + 1` instead of non-null assertion (`confirmStep! + 1`) inside the IIFE for cleaner TypeScript
- The pre-existing Google Fonts network error causes `npm run build` to fail (no internet access to Google APIs in this environment) — this is not caused by our changes; `npx tsc --noEmit` passes with zero errors confirming type safety

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing `npm run build` failure due to Google Fonts fetch error (network: no internet access). This is environment-specific and not introduced by this plan. `npx tsc --noEmit` passes with zero errors.

## Known Stubs

None — all data flows are wired. The undo button reads `roadmap` prop for cascade detection, and `studentId` prop for the API call. No placeholder data.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Task 3 is a checkpoint:human-verify requiring the user to test the end-to-end undo flow in the browser
- After verification, Phase 27 is complete and Phase 28 (daily session planner) can proceed

---
*Phase: 27-coach-owner-roadmap-undo*
*Completed: 2026-03-31*
