---
status: resolved
trigger: "Timer delay on start + hide countdown from student view"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T15:00:00Z
---

## Current Focus

hypothesis: Root causes confirmed for both issues
test: Code trace complete
expecting: N/A — diagnosis complete
next_action: Return structured diagnosis

## Symptoms

expected: Timer appears immediately when student starts session; countdown hidden from student view
actual: Timer has delay before appearing; student sees "Session 1 — 45 min" and "44:59 left" countdown
errors: No error messages — UX timing issue
reproduction: Student starts a work session and observes delay + countdown display
started: Unknown — may have always been this way

## Eliminated

- hypothesis: Timer component itself is slow to render
  evidence: WorkTimer.tsx initializes remainingSeconds in useState initializer (line 30) using calcRemaining() — it computes instantly from startedAt. The component renders immediately when given props.
  timestamp: 2026-03-30T00:20:00Z

- hypothesis: API route is slow
  evidence: API route does auth + insert + return — standard Supabase operations. No external calls. Not the bottleneck.
  timestamp: 2026-03-30T00:21:00Z

## Evidence

- timestamp: 2026-03-30T00:15:00Z
  checked: handleStart flow in WorkTrackerClient.tsx (lines 122-146)
  found: |
    The sequence is:
    1. setIsLoading(true)
    2. POST /api/work-sessions — creates session in DB with started_at = now
    3. setPhase({ kind: "working" })
    4. router.refresh() — triggers server component re-fetch
    5. setIsLoading(false)

    The WorkTimer only renders when `activeSession` is truthy (line 389).
    activeSession is derived from `sessions` state (line 78).
    sessions comes from `initialSessions` prop which is set by the server component.

    CRITICAL: After handleStart, the client sets phase to "working" but the
    timer still won't appear because activeSession is null — the sessions
    state hasn't been updated yet. It only updates when router.refresh()
    completes and the server component re-renders with fresh data, causing
    the useEffect on line 40-42 to fire:

      useEffect(() => { setSessions(initialSessions); }, [initialSessions]);

    This means there's a full round-trip to the server before the timer appears:
    POST to API -> router.refresh() -> server re-queries DB -> new props ->
    setSessions -> activeSession becomes truthy -> timer renders.
  implication: ROOT CAUSE of delay. The timer depends on server-fetched data arriving via router.refresh().

- timestamp: 2026-03-30T00:16:00Z
  checked: Timer conditional rendering in WorkTrackerClient.tsx (line 389)
  found: |
    The timer renders inside: `{activeSession && (...)}`
    activeSession = sessions.find(s => s.status === "in_progress") (line 78)
    sessions comes from initialSessions prop updated via useEffect (line 40-42)

    There is NO optimistic update — handleStart does not add the new session
    to the local sessions state. It relies entirely on router.refresh() to
    get the new session data.
  implication: Confirms the delay is caused by lack of optimistic state update.

- timestamp: 2026-03-30T00:17:00Z
  checked: Countdown display locations for student view
  found: |
    The countdown "44:59 left" appears in TWO places in the student view:

    1. WorkTimer.tsx (lines 123-130) — the main circular timer display showing
       "MM:SS" and "Session N". This is the PRIMARY timer the student interacts with.

    2. CycleCard.tsx (line 30) — the session history card shows
       "Session {cycleNumber} — {sessionMinutes} min" and below it the timeInfo
       which for in_progress sessions is computed in WorkTrackerClient.tsx lines 549-557
       as "{mins}:{secs} left".

    The CycleCard is what shows "Session 1 — 45 min" with "44:59 left" below it.
    The WorkTimer is the big circular countdown.
  implication: The "Session 1 — 45 min" and "44:59 left" text comes from CycleCard, not WorkTimer.

- timestamp: 2026-03-30T00:18:00Z
  checked: Coach/owner view of work sessions
  found: |
    Coaches see WorkSessionsTab.tsx which shows sessions grouped by date with
    status badges and duration. This is a separate component with its own data flow
    from the student detail page. It does NOT show a live countdown — just status
    and duration_minutes for completed sessions.

    The countdown display is ONLY in the student's own work tracker view
    (WorkTrackerClient + CycleCard + WorkTimer).
  implication: |
    Hiding countdown from students means hiding it in CycleCard and potentially
    WorkTimer — but WorkTimer IS the student's timer interface. Hiding WorkTimer
    from students would remove their ability to see any timer at all.

    The user likely wants to hide the CycleCard's "44:59 left" text and possibly
    the "45 min" duration from the session history cards, NOT the main circular
    timer (which is the whole point of the work tracker).

- timestamp: 2026-03-30T00:19:00Z
  checked: Role availability in WorkTrackerClient context
  found: |
    WorkTrackerClient is rendered from src/app/(dashboard)/student/work/page.tsx
    which calls requireRole("student") — meaning only students access this page.
    The component receives NO role prop and has no role context.

    CycleCard also receives no role information.

    To hide countdown from students, you'd need to either:
    a) Pass role down from the server component (straightforward)
    b) Use a context provider (heavier)

    BUT: This page is student-only. Coaches/owners never see this page.
    They see WorkSessionsTab instead. So hiding countdown "from students
    but showing to coaches" doesn't apply to the same component — they
    already see different components.
  implication: |
    The request to "hide from students but show to coaches" is already
    partially satisfied by architecture: coaches see WorkSessionsTab (no
    live countdown). The question is whether to remove the countdown info
    from CycleCard in the student's OWN view.

## Resolution

root_cause: |
  ISSUE 1 (Timer delay): The handleStart function in WorkTrackerClient.tsx
  (line 122-146) does NOT perform an optimistic state update after the API
  call succeeds. It creates the session via POST, sets phase to "working",
  then calls router.refresh(). But the WorkTimer component only renders
  when activeSession is truthy (line 389), and activeSession derives from
  the sessions state array (line 78), which only updates when the server
  component re-renders with fresh initialSessions and the useEffect on
  line 40-42 fires. This creates a full server round-trip delay between
  clicking "Start" and seeing the timer.

  ISSUE 2 (Countdown visible to student): The "Session 1 — 45 min" and
  "44:59 left" text comes from the CycleCard component (rendered in
  WorkTrackerClient.tsx lines 543-579). The main WorkTimer circular display
  also shows the countdown but that IS the timer functionality. Coaches and
  owners already see a DIFFERENT component (WorkSessionsTab.tsx) which does
  NOT show a live countdown.

fix: |
  ISSUE 1 FIX: After the POST succeeds, optimistically add the new session
  to local state before router.refresh() completes. The API returns the
  created session object (line 109 of route.ts). Use that response to
  immediately update sessions state:

    const newSession = await response.json();
    setSessions(prev => [...prev, newSession]);
    setPhase({ kind: "working" });
    router.refresh(); // still refresh for consistency, but timer shows instantly

  ISSUE 2 FIX: The CycleCard already shows countdown info ("44:59 left")
  only in the student's own view. To hide it:
  - In WorkTrackerClient.tsx, change the timeInfo computation for
    in_progress sessions (lines 549-557) to show something like "In progress"
    instead of the countdown.
  - Optionally remove sessionMinutes from CycleCard props for in_progress
    sessions so it doesn't show "— 45 min".

  This is LOW RISK because:
  - CycleCard is a display-only component
  - The main WorkTimer (circular ring) would remain unchanged
  - Coaches already see WorkSessionsTab, not CycleCard

verification: Code trace only — cannot verify without running the app
files_changed: []
