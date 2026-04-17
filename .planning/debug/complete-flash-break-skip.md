---
slug: complete-flash-break-skip
status: resolved
trigger: when I complete a session, there is a moment where I see the time the session takes And the skip pause cirvlee, debug it
created: 2026-04-17
updated: 2026-04-17
---

# Debug: complete-flash-break-skip

## Symptoms

- **Expected behavior:** When the user clicks "Complete session", the active-session UI (WorkTimer countdown + Complete/Pause/Abandon controls) should disappear cleanly and the break countdown UI ("Skip break" + break MM:SS timer) should appear in its place — no visible overlap.
- **Actual behavior:** For a brief moment after clicking Complete, the user sees the active session's remaining time AND the break countdown (with the skip-break circle/button) at the same time. UI flicker / dual render.
- **Error messages:** None reported (visual flicker, not console error).
- **Timeline:** Reproduces on the current build of the Work Tracker (post stitch-blend bolder pass). Not yet confirmed when introduced.
- **Reproduction:**
  1. Start a work session (any duration / break preset).
  2. While the WorkTimer is running, click "Complete session".
  3. Observe the gap between the optimistic break-phase render and the server's `router.refresh()` removing the active session.

## Current Focus

```yaml
hypothesis: handleComplete sets phase to "break" optimistically and calls router.refresh(), but the local `sessions` state still contains the in_progress session until the server round-trip + setState completes. Both gates ({phase.kind === "break"} block AND {activeSession} block in WorkTrackerClient.tsx) evaluate true simultaneously, so both UIs render for one paint.
test: Inspect the conditional render gates around lines 442 and 551 of src/components/student/WorkTrackerClient.tsx. Confirm there is no shared exclusivity guard. Check whether handleComplete optimistically removes the completed session from local state before the router.refresh() resolves.
expecting: The "Active timer" block at line 551 only checks `activeSession`. The "Break countdown" block at line 442 only checks `phase.kind === "break"`. After PATCH success, phase flips to break instantly but `sessions` still contains the in_progress row → both render. Optimistic local update of sessions (or gating active block on `phase.kind !== "break"`) would resolve it.
next_action: Confirmed and fixed — see Resolution.
reasoning_checkpoint: ""
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-04-17T00:00:00Z — code knowledge from prior read this session: `handleComplete` calls `setPhase({ kind: "break", secondsRemaining: breakMinutes * 60 })` then `router.refresh()` (WorkTrackerClient.tsx ~260-261). The render gates for active session (~551) and break countdown (~442) are independent, so they can both be true between optimistic phase flip and server refetch landing.
- timestamp: 2026-04-17T00:00:01Z — re-read WorkTrackerClient.tsx in full. Confirmed line 444 gate is bare `{phase.kind === "break" && ...}` and line 553 gate is bare `{activeSession && ...}` with zero shared exclusivity. `handleComplete` at line 240-268 flips phase to break (line 260) and calls router.refresh() (line 261) but never touches local `sessions` state — so `activeSession = sessions.find(s => s.status === "in_progress")` stays truthy for one paint until the server-data sync useEffect (line 58-60) fires on new props.
- timestamp: 2026-04-17T00:00:02Z — WorkTimer.tsx inspected; it is a pure display component driven by `startedAt`/`totalSeconds` props. Not a contributor to the flicker.

## Eliminated

- WorkTimer.tsx as source — it is a pure countdown driven by props, no state that could bleed across the transition.
- Server round-trip latency as the sole cause — the flicker is a client-side state ordering issue; optimistic local update of `sessions` removes it entirely, independent of network timing.

## Resolution

root_cause: "handleComplete flipped phase to 'break' synchronously but left the completed session in local `sessions` state until `router.refresh()` delivered fresh server props. The break-countdown render gate (`phase.kind === 'break'`) and the active-timer render gate (`activeSession`) were fully independent, so both rendered for one paint."
fix: "Two-layer defense in src/components/student/WorkTrackerClient.tsx: (1) optimistically mark the completed session as `completed` in local `sessions` state inside `handleComplete` before setting the break phase (line 258-264), so `activeSession` becomes undefined in the same render pass that the break phase activates; (2) harden the active-timer render gate with `activeSession && phase.kind !== 'break'` (line 553) as a cheap mutual-exclusion guard in case any future handler flips phase to break without updating local sessions."
verification: "npx tsc --noEmit passes clean. npx eslint on the changed file shows only a pre-existing warning (unrelated to this fix). Fix preserves all motion-safe: animations, 44px+ touch targets, ima-* tokens, and single editorial-restrained lane — no visual or accessibility changes, only state sequencing."
files_changed:
  - src/components/student/WorkTrackerClient.tsx
