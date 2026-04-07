# Phase 29: Daily Session Planner Client - Research

**Researched:** 2026-03-31
**Domain:** React client-side state machine extension (WorkTrackerClient), planner UI, sequential session execution, motivational card
**Confidence:** HIGH

## Summary

Phase 29 is entirely a client-side UI layer on top of a fully-built API. Phase 28 delivered POST/GET /api/daily-plans and plan-aware cap enforcement in POST /api/work-sessions. The server blocks sessions without a plan and enforces the 4-hour cap. This phase adds the planner UI to WorkTrackerClient, the planned session execution queue, and the post-completion motivational card.

The work is concentrated in three files: `WorkTrackerClient.tsx` (primary, ~610 lines), `page.tsx` (server component fetching plan alongside sessions), and one new component for the motivational card. No new npm dependencies are required — all needed primitives exist (Modal, Card, Button, CycleCard, WorkTimer). The break-auto-assignment logic, running total computation, and confirm-button gating are pure derived-state calculations with no external dependencies.

The most dangerous pitfall is the existing phase-reset `useEffect` (lines 90-101 in WorkTrackerClient). It resets to idle when neither `activeSession` nor `pausedSession` exists AND phase is not `setup` or `break`. Plan state must be stored as a separate boolean prop/flag that exempts the component from resetting when the student is in the planner — otherwise a page refresh will silently discard the planner view before the plan exists on the server.

**Primary recommendation:** Add `initialPlan` prop to `WorkTrackerClient`, derive a `mode` from it (`"planning" | "executing" | "adhoc" | "idle"`), store planner draft state in local component state, and gate the phase-reset useEffect on the absence of all four modes — not just `setup` and `break`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Each planned session does NOT auto-start. Student clicks to start each session — same as today's flow. The planner pre-fills duration and break settings so the student doesn't pick them each time.
- **D-02:** Show a list of planned sessions: completed ones get a checkmark, current one is highlighted with a "Start Session N" button, upcoming ones are greyed out.
- **D-03:** Skip the setup phase (duration/break picker) for planned sessions. The planned session list already shows duration/break info — clicking "Start Session N" goes straight to the working state.
- **D-04:** Reuse existing idle/working/break state machine — no new "planning" state needed. The planner is a pre-step that feeds config into the existing WorkTracker flow.
- **D-05:** Breaks auto-assign without student input during planning: odd-numbered sessions (1st, 3rd, 5th) get a short break choice, even sessions (2nd, 4th, 6th) get a long break choice, last session has no break. Student picks break duration within the assigned type.
- **D-06:** After all planned sessions complete, a motivational card appears showing Arabic "اللهم بارك" (large, centered, dir="rtl" lang="ar") and English "You have done the bare minimum! Continue with your next work session". Card shows once per day.
- **D-07:** Card has "Start Next Session" (goes to ad-hoc session picker) and "Dismiss" (closes card, returns to work tracker).

### Claude's Discretion
- Planner UI layout and styling (session-building interface, add session flow, running total display, confirm button behavior)
- Motivational card visual design (modal vs inline, animation)
- Ad-hoc session picker presentation after plan completion (simplified setup phase, how to indicate cap is lifted)
- State persistence across page refreshes (useEffect guard for plan-mode)
- Loading states and error handling during plan creation/session execution
- Planned session list component design (cards, list items, spacing)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-01 | Student sees a daily planner in Work Tracker page before their first session of the day | `initialPlan` prop: if null and no sessions today, render PlannerUI; server fetches today's plan in page.tsx |
| PLAN-02 | Student can add sessions (30/45/60 min) with a running total showing planned work hours (breaks excluded) | `WORK_TRACKER.sessionDurationOptions` drives picker; `formatHoursMinutes()` displays running total of session_minutes sum |
| PLAN-03 | Break types alternate: odd sessions (1st,3rd,5th) get short break, even sessions (2nd,4th,6th) get long break, last session has no break | Pure derived assignment: `index % 2 === 0 ? "short" : "long"`, last index gets "none" |
| PLAN-04 | Short break options: 5 or 10 min; long break options: 15, 20, 25, or 30 min | `WORK_TRACKER.breakOptions.short.presets` and `.long.presets` already defined in config |
| PLAN-05 | Cannot plan > 4h; confirm enabled when total reaches exactly 4h or nearest valid total ≤ 4h | `totalPlannedMinutes <= WORK_TRACKER.dailyGoalHours * 60`; disable "Add Session" when next addition would exceed cap; disable "Confirm" when no sessions added |
| PLAN-06 | After confirming, planner disappears and WorkTracker executes planned sessions in sequence | POST /api/daily-plans persists plan; component transitions from planner view to execution view driven by `initialPlan` on refresh |
| PLAN-10 | Student must complete all planned sessions before doing additional sessions | Server enforces (D-04 in Phase 28 API); client shows "ad-hoc" mode only when `completedCount >= plannedSessionCount` |
| COMP-01 | Motivational card with Arabic "اللهم بارك" and English text after all planned sessions complete | Inline component or Modal; dir="rtl" lang="ar" on Arabic text; shown once per day via `hasSeenCard` state seeded from prop |
| COMP-02 | Card has "Start Next Session" and "Dismiss" buttons | "Start Next Session" → ad-hoc mode; "Dismiss" → idle |
| COMP-03 | Ad-hoc sessions: free duration/break type choice, same fixed presets, no cap | After `planFulfilled`, existing setup phase renders with no cap constraint — server already lifts cap per D-03 |
| COMP-04 | Motivational card shown once per day; return visit goes straight to ad-hoc picker | `initialHasSeenCard` boolean prop from page.tsx (check localStorage key keyed by today's date, or server-side via plan + completedCount); on refresh, skip card |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useState, useEffect, useCallback, useRef) | 19 (installed) | Local planner draft state, phase-reset guard, stable callbacks | Already used throughout WorkTrackerClient |
| TypeScript strict | installed | Typed planner draft, PlanJson inference | Project-wide requirement |
| Zod (`import { z } from "zod"`) | installed | planJsonSchema for POST /api/daily-plans body | Already imported in daily-plan.ts schema file |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react (Check, Circle, Play) | installed | Session list status icons | CycleCard already uses these — reuse in planned session list |
| class-variance-authority (cva) | installed | Button/Card variant management | Already used in all UI primitives |
| clsx + tailwind-merge (cn) | installed | Conditional class composition | Already used everywhere |

### No New Dependencies
Per v1.3 research decision: "Zero new npm dependencies — motion, lru-cache, zod, lucide-react all cover v1.3 needs at installed versions." This phase requires no new packages.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/student/work/
│   └── page.tsx                    # MODIFY: fetch initialPlan alongside sessions
├── components/student/
│   ├── WorkTrackerClient.tsx        # PRIMARY MODIFY: add planner, execution list, card
│   ├── PlannerUI.tsx                # NEW: draft plan builder (session adder, total, confirm)
│   ├── PlannedSessionList.tsx       # NEW: ordered list (checkmark/active/greyed)
│   └── MotivationalCard.tsx         # NEW: post-plan completion card
├── lib/schemas/
│   └── daily-plan.ts               # EXISTING: PlanJson type, planJsonSchema — no changes
└── lib/config.ts                    # EXISTING: WORK_TRACKER — no changes
```

### Pattern 1: Planner Mode Detection
**What:** Derive current WorkTracker mode from server-fetched data, not from client-only state
**When to use:** On every page load — drives which UI panel renders

```typescript
// In WorkTrackerClient (after accepting initialPlan prop):
type WorkTrackerMode =
  | "planning"    // No plan today — show PlannerUI
  | "executing"   // Plan exists, planFulfilled = false — show PlannedSessionList
  | "adhoc"       // Plan fulfilled — show normal setup phase or ad-hoc picker
  | "completed";  // All planned sessions done and motivational card was dismissed

// Derived — never stored as state:
const planFulfilled = initialPlan !== null &&
  completedCount >= initialPlan.plan_json.sessions.length;
const mode: WorkTrackerMode =
  initialPlan === null ? "planning" :
  !planFulfilled ? "executing" :
  "adhoc";
```

### Pattern 2: Phase-Reset useEffect Guard Update
**What:** The existing phase-reset useEffect at lines 90-101 resets to "idle" when no activeSession/pausedSession. It currently exempts `kind === "setup"` and `kind === "break"`. After this phase, it must also exempt when mode is `"planning"`.
**When to use:** Any time plan-related state is added to WorkTrackerClient.

```typescript
// EXISTING (lines 90-101, WorkTrackerClient.tsx):
useEffect(() => {
  if (activeSession) {
    setPhase({ kind: "working" });
  } else if (pausedSession) {
    setPhase({ kind: "working" });
  } else if (phase.kind === "working") {
    // Session just ended — handled by handleComplete
  } else if (phase.kind !== "setup" && phase.kind !== "break") {
    setPhase({ kind: "idle" });
  }
}, [activeSession, pausedSession]);

// REQUIRED CHANGE — add planning guard:
// } else if (phase.kind !== "setup" && phase.kind !== "break" && mode !== "planning") {
//   setPhase({ kind: "idle" });
// }
// CRITICAL: mode must be derived from initialPlan (server prop), not local state,
// so it survives page refresh correctly.
```

### Pattern 3: Planner Draft State (local, not persisted)
**What:** Track the list of sessions being built before confirmation. Pure local state — discarded on refresh. After POST /api/daily-plans succeeds, the plan is server-persisted and page.tsx re-fetches it via router.refresh().

```typescript
type PlannerSession = {
  session_minutes: 30 | 45 | 60;
  break_type: "short" | "long" | "none";
  break_minutes: number;  // 0 when break_type === "none"
};

const [plannerSessions, setPlannerSessions] = useState<PlannerSession[]>([]);

// Derived:
const totalPlannedMinutes = plannerSessions.reduce((s, p) => s + p.session_minutes, 0);
const maxMinutes = WORK_TRACKER.dailyGoalHours * 60; // 240

// Break auto-assignment per PLAN-03/D-05:
function assignBreakType(sessionIndex: number, totalSessions: number): "short" | "long" | "none" {
  if (sessionIndex === totalSessions - 1) return "none";  // last session
  return sessionIndex % 2 === 0 ? "short" : "long";       // 0-indexed: 0=short, 1=long, 2=short...
}
```

### Pattern 4: Confirm Button Gating (PLAN-05)
**What:** "Confirm" is disabled until at least one session is added. "Add Session" is disabled when adding the smallest session (30 min) would exceed the 4h cap.

```typescript
const canAddSession = totalPlannedMinutes + Math.min(...WORK_TRACKER.sessionDurationOptions) <= maxMinutes;
// Smallest option is 30 min. If 210m planned, can add 30m (total 240). If 211m, cannot add any.
const canConfirm = plannerSessions.length > 0;
// Note: Server also validates total_work_minutes <= 240, so the button gating is UX-only.
```

### Pattern 5: Planned Session Execution (D-01, D-02, D-03)
**What:** When plan exists and not yet fulfilled, show PlannedSessionList instead of the idle "Set Up Session" button. Each row maps to `plan_json.sessions[index]`. Match row to completion status by `completedCount` (index-based, not by ID).

```typescript
// Determine each planned session's display state:
// index < completedCount         → "completed" (checkmark)
// index === completedCount       → "current" (active "Start Session N" button)
// index > completedCount         → "upcoming" (greyed out)

// When student clicks "Start Session N" for the current slot:
// 1. Grab plan_json.sessions[completedCount] for duration + break settings
// 2. Set selectedMinutes and breakMinutes from that slot
// 3. Call handleStart() directly — skip setup phase (D-03)
```

### Pattern 6: Motivational Card (COMP-01, COMP-04)
**What:** Shown once per day after plan fulfillment. "Once per day" tracked by checking localStorage key `ima-motivational-seen-{today}`. On mount: if plan fulfilled and key not set, show card. Key set on dismiss or "Start Next Session" click.

```typescript
// On mount — seed from localStorage:
const [hasSeenCard, setHasSeenCard] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`ima-motivational-seen-${getToday()}`) === "1";
});

function markCardSeen() {
  localStorage.setItem(`ima-motivational-seen-${getToday()}`, "1");
  setHasSeenCard(true);
}
```

**Why localStorage over server:** COMP-04 says "once per day" for display only — it has no server-side consequence. No database column change needed. localStorage keyed by today's date auto-expires each day.

### Pattern 7: Arabic Text Rendering (D-06)
**What:** Arabic text must use `dir="rtl"` and `lang="ar"` on its wrapper element — not just Tailwind `text-right`. Required for correct bidirectional rendering and screen reader pronunciation.

```tsx
// Source: v1.3 research decision documented in STATE.md
<p dir="rtl" lang="ar" className="text-4xl font-bold text-center text-ima-text">
  اللهم بارك
</p>
```

### Pattern 8: Confirmed Plan POST (PLAN-06)
**What:** On "Confirm Plan" click, POST plan_json to /api/daily-plans, then call router.refresh() to reload page.tsx which fetches the now-existing plan and passes it as initialPlan prop.

```typescript
async function handleConfirmPlan() {
  // Build plan_json from plannerSessions state
  const plan_json: PlanJson = {
    version: 1,
    total_work_minutes: totalPlannedMinutes,
    sessions: plannerSessions.map(s => ({
      session_minutes: s.session_minutes,
      break_type: s.break_type,
      break_minutes: s.break_minutes,
    })),
  };
  const response = await fetch("/api/daily-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan_json }),
  });
  if (!response.ok) {
    // toast error per hard rule
    return;
  }
  router.refresh();  // page.tsx refetches plan → initialPlan is now non-null → mode becomes "executing"
}
```

### Anti-Patterns to Avoid
- **Storing mode in useState:** Mode must be purely derived from `initialPlan` + `completedCount` so it survives refresh without drift between client state and server truth.
- **TypeScript-casting plan_json:** Always use `planJsonSchema.safeParse(initialPlan.plan_json)` when reading plan data from the prop — never `as PlanJson`.
- **Skipping motion-safe prefix:** Every `transition-*` and `animate-*` class must use `motion-safe:` prefix per hard rule #1.
- **Missing touch targets:** All buttons must have `min-h-[44px]` per hard rule #2.
- **Using `zod/v4` import path:** Always `import { z } from "zod"` per hard rule #7.
- **Hardcoded colors:** All colors use ima-* tokens, never hex per hard rule #8.
- **Empty catch blocks:** Every catch must toast or console.error per hard rule #5.
- **Unchecked fetch responses:** Every fetch must check `response.ok` before parsing JSON per hard rule #6.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with focus trap + escape | Custom overlay | `Modal.tsx` (existing) | Already handles focus trap, Escape, inert background, portal mounting |
| Break duration options | Hardcoded arrays | `WORK_TRACKER.breakOptions.short.presets` / `.long.presets` | Config-is-truth rule; changing presets in one place propagates everywhere |
| Session duration options | Hardcoded [30,45,60] | `WORK_TRACKER.sessionDurationOptions` | Same config-is-truth rule |
| "Hours:Minutes" formatting | Custom formatter | `formatHoursMinutes()` from utils.ts | Already handles edge cases (0m, 1h, 1h 30m) |
| Status icons (check, circle, play) | Custom SVG | `lucide-react` — already used in CycleCard | Consistent with existing session list styling |
| Plan session row | New component from scratch | Extend/adapt `CycleCard.tsx` patterns | CycleCard already has "pending" status + icon; planned row is similar shape |
| Date string for today | `new Date().toLocaleDateString()` | `getToday()` from utils.ts | Consistent local-timezone date string |
| Stable toast/router in callbacks | Direct `useToast()` call | `useRef(useToast())` / `useRef(useRouter())` pattern | Project-established pattern (toastRef, routerRef) — avoids stale closure in useCallback |

**Key insight:** This phase is almost entirely composition of existing primitives + derived-state logic. The main engineering work is the phase-reset guard update and the planner state machine transitions, not building new UI infrastructure.

---

## Common Pitfalls

### Pitfall 1: Phase-Reset useEffect Resets Planner on Refresh
**What goes wrong:** After the student refreshes mid-planning (before confirming), the phase-reset useEffect fires on mount, detects no activeSession/pausedSession, and sets phase to `idle`. The planner draft is already gone (local state). But if mode is NOT yet "planning" (because initialPlan is null), this is fine. If the planner has been confirmed and initialPlan is now non-null, the useEffect must not force mode back to idle.
**Why it happens:** The existing guard only checks `phase.kind !== "setup" && phase.kind !== "break"`. Plan execution mode is invisible to it.
**How to avoid:** Derive mode purely from initialPlan (server prop). The guard must check `mode !== "planning"` and `mode !== "executing"` as additional exemptions. Since mode is derived from a prop, it is stable across renders.
**Warning signs:** Planner UI flashes and disappears on page load; planned session list not showing after page refresh even though plan exists.

### Pitfall 2: Using plan_json Without Zod Parse
**What goes wrong:** `initialPlan.plan_json` is typed as `Record<string, unknown>` in `types.ts` (database type). Casting it to `PlanJson` directly skips validation and will cause runtime crashes if data is malformed.
**Why it happens:** TypeScript's structural typing allows the cast to compile.
**How to avoid:** Always `planJsonSchema.safeParse(initialPlan.plan_json)`. On parse failure, treat as "no plan" (show planner UI). This is documented in STATE.md Accumulated Context.
**Warning signs:** Runtime error "Cannot read property 'sessions' of undefined" in WorkTrackerClient.

### Pitfall 3: break_minutes = 0 for "none" Break Type
**What goes wrong:** When building the plan_json for the last session, break_type is "none" but break_minutes must be 0 (not undefined). The planJsonSchema validates break_minutes as `z.number().int().min(0)` — any non-zero value for a "none" break type is semantically incorrect and will be confusing for future readers.
**Why it happens:** Planner state default might carry the last-selected break duration into the "none" slot.
**How to avoid:** When assigning break_type === "none" to a session, always set break_minutes to 0. Enforce in `assignBreakType` helper.
**Warning signs:** Last session has non-zero break_minutes in plan_json despite break_type "none".

### Pitfall 4: handleStart Sends Wrong cycle_number During Planned Execution
**What goes wrong:** The existing `handleStart` sends `cycle_number: nextCycleNumber` where `nextCycleNumber = completedCount + 1`. During planned execution, this is still correct — it's just the next session number. No change needed to handleStart itself.
**Why it happens:** Confusion about whether cycle_number should track "planned slot index" vs "completed + 1". They are the same during sequential plan execution.
**How to avoid:** Confirm: `nextCycleNumber` equals `completedCount + 1` which equals `plannedSessionIndex + 1` (1-indexed) for sequential sessions. No override needed. Just pre-load selectedMinutes and breakMinutes from plan_json before calling handleStart.
**Warning signs:** Session 3 starts with cycle_number 2 because of off-by-one.

### Pitfall 5: Ad-Hoc Mode After Plan — Break Selection Defaults
**What goes wrong:** After plan fulfillment, the student enters ad-hoc mode (normal setup phase). The selected breakType and breakMinutes may still hold the last planned session's break settings. Student sees a pre-selected break type that doesn't reflect their free choice.
**Why it happens:** No state reset on mode transition to "adhoc".
**How to avoid:** When transitioning to ad-hoc mode (dismissing motivational card or clicking "Start Next Session"), reset breakType to "short" and breakMinutes to the first short preset.
**Warning signs:** Ad-hoc session picker shows "Long Break — 30 min" pre-selected even though student didn't choose it.

### Pitfall 6: Motivational Card hasSeenCard Initialization in SSR
**What goes wrong:** `localStorage.getItem(...)` throws on the server during SSR since `localStorage` is not available.
**Why it happens:** Next.js App Router server-renders components.
**How to avoid:** Initialize useState with a lazy initializer that guards against `typeof window === "undefined"`: `useState(() => typeof window !== "undefined" && localStorage.getItem(...) === "1")`.
**Warning signs:** Build error "localStorage is not defined" or hydration mismatch.

---

## Code Examples

### Add Session to Planner Draft

```typescript
// Source: derived from WORK_TRACKER config in src/lib/config.ts
function handleAddSession(minutes: 30 | 45 | 60) {
  setPlannerSessions((prev) => {
    const newIndex = prev.length; // 0-indexed position of the session being added
    const isLast = true; // will be last after adding (always — until next add)
    // Re-derive break types for all sessions including new one
    const updated = [
      ...prev.map((s, i) => ({
        ...s,
        break_type: assignBreakType(i, prev.length + 1),
        // Reset break_minutes to 0 only when newly assigned "none"
        break_minutes: assignBreakType(i, prev.length + 1) === "none" ? 0 : s.break_minutes,
      })),
      {
        session_minutes: minutes,
        break_type: assignBreakType(newIndex, prev.length + 1) as "short" | "long" | "none",
        break_minutes: assignBreakType(newIndex, prev.length + 1) === "none"
          ? 0
          : WORK_TRACKER.breakOptions[
              assignBreakType(newIndex, prev.length + 1) as "short" | "long"
            ].presets[0],
      },
    ];
    return updated;
  });
}
```

**Key insight on re-derive:** Every time a session is added, ALL sessions must have their break_type re-evaluated because adding a new session promotes the previous last session from "none" to "short" or "long". The implementation must re-derive break_type for every session on every addition.

### Planned Session List Render

```tsx
// Source: pattern derived from existing CycleCard + D-02 decision
{plan.sessions.map((plannedSession, index) => {
  const isCompleted = index < completedCount;
  const isCurrent = index === completedCount;
  const isUpcoming = index > completedCount;

  return (
    <div
      key={index}
      className={cn(
        "rounded-xl border p-4 flex items-center gap-3",
        isCompleted && "border-ima-border bg-ima-surface opacity-60",
        isCurrent && "border-ima-primary bg-ima-surface shadow-sm",
        isUpcoming && "border-ima-border bg-ima-surface opacity-40"
      )}
    >
      <div aria-hidden="true">
        {isCompleted && <Check className="h-5 w-5 text-ima-success" />}
        {isCurrent && <Play className="h-5 w-5 text-ima-primary" />}
        {isUpcoming && <Circle className="h-5 w-5 text-ima-text-muted" />}
      </div>
      <div className="flex-1">
        <p className="font-medium text-ima-text">
          Session {index + 1} — {plannedSession.session_minutes} min
        </p>
        <p className="text-sm text-ima-text-secondary">
          {plannedSession.break_type === "none"
            ? "No break"
            : `${plannedSession.break_minutes}m ${plannedSession.break_type} break`}
        </p>
      </div>
      {isCurrent && !activeSession && !pausedSession && (
        <button
          onClick={() => handleStartPlanned(index)}
          disabled={isLoading}
          className="bg-ima-primary text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
        >
          Start
        </button>
      )}
    </div>
  );
})}
```

### handleStartPlanned (replaces setup phase for planned sessions — D-03)

```typescript
// Loads planned session config then calls existing handleStart
const handleStartPlanned = useCallback(async (planIndex: number) => {
  const slot = parsedPlan.sessions[planIndex];
  if (!slot) return;
  // Pre-configure the session settings from the plan slot
  setSelectedMinutes(slot.session_minutes);
  if (slot.break_type !== "none") {
    setBreakType(slot.break_type);
    setBreakMinutes(slot.break_minutes);
  }
  // Call the existing start handler — it reads selectedMinutes/breakMinutes from state
  // IMPORTANT: must be called after state updates propagate, or use local vars
  // Better: inline the fetch here rather than relying on state to propagate
  await handleStartWithConfig(slot.session_minutes, slot.break_type, slot.break_minutes);
}, [parsedPlan, handleStartWithConfig]);
```

**Note:** Because React state updates are asynchronous, `handleStartPlanned` should either: (a) call a version of handleStart that accepts parameters directly, or (b) use a ref to store the pending planned config. The cleanest approach is a `handleStartWithConfig(minutes, breakType, breakMins)` that does the fetch inline without reading from state.

### Motivational Card

```tsx
// Source: Modal.tsx exists in src/components/ui/Modal.tsx
// Use Modal for accessible overlay with focus trap
{planFulfilled && !hasSeenCard && (
  <Modal open={true} onClose={markCardSeen} size="sm">
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <p
        dir="rtl"
        lang="ar"
        className="text-4xl font-bold text-ima-text"
      >
        اللهم بارك
      </p>
      <p className="text-base text-ima-text-secondary">
        You have done the bare minimum! Continue with your next work session
      </p>
      <div className="flex gap-3 mt-2 w-full">
        <button
          onClick={() => { markCardSeen(); setPhase({ kind: "setup" }); }}
          className="flex-1 bg-ima-primary text-white rounded-lg min-h-[44px] font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
        >
          Start Next Session
        </button>
        <button
          onClick={markCardSeen}
          className="flex-1 bg-ima-surface border border-ima-border text-ima-text rounded-lg min-h-[44px] font-medium hover:bg-ima-bg motion-safe:transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  </Modal>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual session setup each time | Pre-filled from plan | Phase 29 | Students don't select duration/break for planned sessions |
| Uncapped ad-hoc sessions | Plan required before any session | Phase 28 | POST /api/work-sessions blocks without plan |
| Free ad-hoc after plan | Cap lifts after plan fulfillment | Phase 28 D-03 | Server-enforced; client just shows ad-hoc picker |

**Deprecated/outdated:**
- Idle "Set Up Session" button: Still used for ad-hoc mode; hidden during planned execution mode
- Setup phase for planned sessions: Skipped per D-03; setup phase retained for ad-hoc (COMP-03)

---

## Open Questions

1. **Break duration selection during planning (PLAN-04)**
   - What we know: PLAN-04 says student picks break duration within the assigned type. PLAN-03 says break types auto-assign. D-05 confirms student picks duration within the assigned type.
   - What's unclear: Does the planner show a break duration picker per session row, or does the student confirm with a default (first preset) and can modify?
   - Recommendation: Show per-session break duration picker in the planner (inline, compact). Default to first preset for the assigned type. This is within Claude's Discretion scope.

2. **COMP-04: "Returning to Work Tracker after seeing card goes straight to ad-hoc picker"**
   - What we know: localStorage key persists across refresh for the day. If `hasSeenCard` is true on mount and plan is fulfilled, skip directly to ad-hoc mode.
   - What's unclear: Should this be a distinct UI state, or just "mode === adhoc and hasSeenCard === true means render normal setup phase"?
   - Recommendation: `mode === "adhoc"` already maps to the normal setup phase rendering. No additional state needed. The `hasSeenCard` localStorage check simply prevents re-showing the modal.

3. **plannedSessionIndex alignment with completedCount after abandoned sessions**
   - What we know: `completedCount` counts only `status === "completed"` sessions. An abandoned planned session means `completedCount` stays behind `cycle_number`. The server uses completed count vs planned count for cap fulfillment.
   - What's unclear: If a student abandons session 2 (planned), does slot 2 re-appear as "current" or does slot 3 become current?
   - Recommendation: `completedCount` should drive which slot is "current" (not cycle_number). An abandoned session does not advance the plan. The current slot index = completedCount. This matches the server's fulfillment logic (completed >= planned count).

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is pure client-side UI changes to an existing Next.js project with all dependencies installed)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no test files in src/, no jest.config.*, no vitest.config.*) |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (type check only) + `npm run lint` |
| Full suite command | `npm run build` (full production build validates compilation) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | Planner renders when initialPlan=null | manual-only | — | N/A |
| PLAN-02 | Running total updates on session add | manual-only | — | N/A |
| PLAN-03 | Break auto-assignment logic | unit (logic) | `npx tsc --noEmit` (type safety) | ❌ Wave 0 recommended |
| PLAN-04 | Break preset options from config | manual-only | — | N/A |
| PLAN-05 | Add Session disabled at 4h cap | manual-only | — | N/A |
| PLAN-06 | POST /api/daily-plans called on confirm | manual-only | — | N/A |
| PLAN-10 | Ad-hoc only after plan fulfilled | manual-only (server enforces) | — | N/A |
| COMP-01 | Motivational card Arabic text visible | manual-only | — | N/A |
| COMP-02 | Card buttons navigate correctly | manual-only | — | N/A |
| COMP-03 | Ad-hoc has no cap | manual-only (server enforces) | — | N/A |
| COMP-04 | Card not reshown on same day | manual-only | — | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps
- No test infrastructure for pure logic functions. The `assignBreakType` function is a candidate for a unit test but no test runner is configured in this project.
- Recommendation: Type-check and lint gates are the primary automated validation for this phase given the absence of a test framework.

*(Note: The project has no test framework. All req validation is manual + build/type-check. This is consistent with all previous phases.)*

---

## Sources

### Primary (HIGH confidence)
- `src/components/student/WorkTrackerClient.tsx` (read directly) — state machine structure, phase-reset useEffect, existing patterns
- `src/app/(dashboard)/student/work/page.tsx` (read directly) — server component fetch pattern for sessions
- `src/app/api/daily-plans/route.ts` (read directly) — POST/GET handlers, plan_json contract
- `src/app/api/work-sessions/route.ts` (read directly) — plan-aware cap enforcement, fulfillment logic
- `src/lib/schemas/daily-plan.ts` (read directly) — planJsonSchema, PlanJson type
- `src/lib/config.ts` (read directly) — WORK_TRACKER config
- `src/lib/utils.ts` (read directly) — formatHoursMinutes, getToday, getTodayUTC
- `src/components/ui/Modal.tsx` (read directly) — focus trap, portal, accessibility
- `src/components/ui/Card.tsx` (read directly) — Card variants available
- `src/components/ui/Button.tsx` (read directly) — Button variants, loading state
- `src/components/student/CycleCard.tsx` (read directly) — "pending" status support confirmed
- `.planning/phases/29-daily-session-planner-client/29-CONTEXT.md` (read directly) — locked decisions
- `.planning/STATE.md` (read directly) — v1.3 accumulated decisions (Arabic dir="rtl", phase-reset guard, plan_json Zod parse)
- `CLAUDE.md` (project instructions) — Hard rules applied throughout

### Secondary (MEDIUM confidence)
- None needed — all research sourced from project source code and context documents

### Tertiary (LOW confidence)
- None

---

## Project Constraints (from CLAUDE.md)

All directives below apply to every file created or modified in this phase:

1. **motion-safe:** — every `animate-*` / `transition-*` class MUST use `motion-safe:` prefix
2. **44px touch targets** — every interactive element: `min-h-[44px]`, buttons/icons also `min-w-[44px]` where square
3. **Accessible labels** — every input needs `aria-label` or `<label htmlFor>` + `id`; ARIA on dynamic content (`role="progressbar"`, `role="timer"`, `role="alert"`)
4. **Admin client in API routes** — every `.from()` query in route handlers uses admin client (no new routes in this phase, but page.tsx must use createAdminClient for plan fetch)
5. **Never swallow errors** — every `catch` must toast or `console.error`
6. **Check response.ok** — every `fetch()` must check `response.ok` before `.json()`
7. **Zod import** — `import { z } from "zod"`, never `"zod/v4"`
8. **ima-* tokens only** — all colors use ima-* design tokens; `text-white` only on colored backgrounds (buttons/avatars)
9. **Config is truth** — import from `src/lib/config.ts`, never hardcode roles/nav/roadmap/duration options
10. **Admin client only in server code** — never import createAdminClient in client components
11. **Proxy not middleware** — route guard is `src/proxy.ts`, not middleware.ts
12. **Google OAuth only** — no password flows
13. **Light theme with blue accents** — all UI uses ima-* tokens
14. **px-4 on all page wrappers** — already present on work page wrapper
15. **Stable useCallback deps** — use refs for toast/router (toastRef, routerRef pattern already established)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire phase uses installed packages only, no new dependencies
- Architecture patterns: HIGH — derived directly from reading source code; planner state machine is pure derived logic
- Pitfalls: HIGH — phase-reset useEffect documented in STATE.md, plan_json cast risk identified from types.ts, Arabic SSR risk is a known Next.js pattern
- Break assignment logic: HIGH — pure math from requirements, no external dependencies

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable stack, no external dependencies)
