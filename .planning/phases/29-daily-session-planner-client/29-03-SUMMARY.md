---
phase: 29-daily-session-planner-client
plan: "03"
subsystem: ui
tags: [react, next.js, tailwind, localstorage, motivational-card, ad-hoc-sessions, arabic-rtl]

# Dependency graph
requires:
  - phase: 29-02
    provides: WorkTrackerClient with mode derivation (planning/executing/adhoc), PlannedSessionList, handleStartWithConfig
  - phase: 29-01
    provides: PlannerUI component, initialPlan prop on WorkTrackerClient
affects:
  - 29-UAT (end-to-end verification of complete planner flow)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hasSeenCard state via localStorage with SSR guard: typeof window === 'undefined' check in useState lazy initializer"
    - "ima-motivational-seen-{today} localStorage key — daily expiry built into key format"
    - "markCardSeen() helper: sets localStorage + flips React state atomically"
    - "handleStartNextSession/handleDismissCard both reset break defaults (Pitfall 5 guard)"

key-files:
  created:
    - src/components/student/MotivationalCard.tsx
  modified:
    - src/components/student/WorkTrackerClient.tsx

key-decisions:
  - "MotivationalCard uses Modal component (open=true, size=sm) for built-in focus trap and Escape key handling"
  - "hasSeenCard initialized from localStorage in useState lazy initializer with SSR guard — avoids hydration mismatch"
  - "handleStartNextSession transitions directly to setup phase (not idle) so user lands on duration picker immediately"
  - "handleDismissCard returns to idle (no setPhase call) — phase=idle is the natural post-card state"
  - "MotivationalCard condition excludes phase.kind=setup to avoid card re-appearing if user navigates back from setup"

patterns-established:
  - "Arabic RTL text: dir=rtl lang=ar on wrapper element — not text-right Tailwind class"
  - "Once-per-day UI via localStorage key with date suffix — key format ima-{feature}-seen-{today}"

requirements-completed: [COMP-01, COMP-02, COMP-03, COMP-04]

# Metrics
duration: 15min
completed: 2026-03-31
status: complete
---

# Phase 29 Plan 03: Motivational Card and Ad-hoc Mode Summary

**MotivationalCard component with Arabic (dir=rtl) text, localStorage daily-once guard, and WorkTrackerClient wired for post-plan motivational flow then ad-hoc sessions**

## Status

**All tasks complete. Checkpoint approved by user.**

## Performance

- **Duration:** ~15 min (Tasks 1-2)
- **Started:** 2026-03-31T00:00:00Z
- **Completed:** 2026-03-31 (partial — checkpoint pending)
- **Tasks:** 2 of 3 completed
- **Files modified:** 2 (MotivationalCard.tsx created, WorkTrackerClient.tsx modified)

## Accomplishments

- MotivationalCard component renders in a Modal with Arabic text (اللهم بارك) using dir="rtl" lang="ar" per D-06 and COMP-01
- English encouragement text "You have done the bare minimum! Continue with your next work session"
- Start Next Session button transitions to ad-hoc setup phase with defaults reset (Pitfall 5)
- Dismiss button returns to idle with defaults reset
- hasSeenCard state reads from localStorage `ima-motivational-seen-{today}` with SSR guard — card shows once per day
- Ad-hoc idle block updated: requires hasSeenCard=true, shows "Plan complete — ad-hoc session (no daily cap)" text per COMP-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MotivationalCard component** - `727b2eb` (feat)
2. **Task 2: Wire MotivationalCard and ad-hoc mode into WorkTrackerClient** - `4a0bc1d` (feat)
3. **Task 3: Verify complete planner flow** - APPROVED (user checkpoint)

## Files Created/Modified

- `src/components/student/MotivationalCard.tsx` - New: Modal-based motivational card with Arabic/English text, Start Next Session and Dismiss buttons, ima-* tokens, min-h-[44px], motion-safe:transition-colors
- `src/components/student/WorkTrackerClient.tsx` - Added MotivationalCard import, hasSeenCard state with localStorage SSR guard, markCardSeen helper, handleStartNextSession and handleDismissCard callbacks, MotivationalCard rendering in adhoc mode, updated ad-hoc idle block to show after card seen

## Decisions Made

- MotivationalCard uses Modal (open=true, size=sm) for focus trap and Escape key handling — no need to implement these manually
- hasSeenCard initialized from localStorage in useState lazy initializer with `typeof window === "undefined"` guard for SSR safety
- handleStartNextSession calls `setPhase({ kind: "setup" })` directly — takes user to duration picker immediately rather than making them click Set Up Session
- handleDismissCard does not call setPhase — the natural idle state shows after markCardSeen flips hasSeenCard, revealing the Set Up Session button
- MotivationalCard condition includes `phase.kind !== "setup"` to prevent card from reappearing if user is already in setup phase

## Deviations from Plan

None — Tasks 1 and 2 executed exactly as written. All acceptance criteria met.

## Issues Encountered

None — both tasks compiled cleanly. TypeScript passes with zero errors. Only pre-existing lint warning in handleComplete deps (completedCount) which pre-dates this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete planner flow is implemented: planning → executing → motivational card → ad-hoc
- Task 3 (human-verify checkpoint) requires manual verification of end-to-end flow
- After checkpoint approval: all COMP requirements are fulfilled

---
*Phase: 29-daily-session-planner-client*
*Completed: 2026-03-31 (checkpoint pending)*

## Self-Check: PASSED

- FOUND: src/components/student/MotivationalCard.tsx
- FOUND: .planning/phases/29-daily-session-planner-client/29-03-SUMMARY.md
- FOUND commit: 727b2eb (Task 1 - MotivationalCard)
- FOUND commit: 4a0bc1d (Task 2 - WorkTrackerClient wiring)
