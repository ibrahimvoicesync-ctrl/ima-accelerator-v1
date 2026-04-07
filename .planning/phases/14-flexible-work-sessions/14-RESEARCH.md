# Phase 14: Flexible Work Sessions - Research

**Researched:** 2026-03-27
**Domain:** React state machine, client-side countdown timers, Supabase mutations, Next.js App Router UI refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace the fixed 4-slot CycleCard grid with a growing list that only shows sessions that actually exist (completed, active, paused). No empty "pending" slots.
- **D-02:** Each session card shows the duration the student chose (e.g. "Session 3 - 45 min") alongside the status.
- **D-03:** List order is newest-first — active/latest session at top, completed sessions stack below.
- **D-04:** Show latest 4 session cards by default; collapse older ones behind a "Show N more" link for students doing 6+ sessions.
- **D-05:** Replace "X of 4 cycles done" with an hours-based progress bar: "1h 30m / 4h" with a visual bar.
- **D-06:** Also display session count below the bar (e.g. "3 sessions completed").
- **D-07:** When the student hits 4 hours, the progress bar fills to 100% and stays there. No celebration banner. Student can keep starting more sessions.
- **D-08:** Progress bar uses a single color (ima-primary / blue). No RAG color coding.

### Claude's Discretion

- Pre-session setup UI — how the duration picker (30/45/60) and break type/duration selection appear before starting a session. Claude may design the selection step based on existing UI patterns.
- Break countdown UI — how the break timer displays between cycles, skip-early interaction, and first-cycle-skips-break logic. Claude may design based on existing WorkTimer patterns.
- Terminology — whether to call them "sessions" or "cycles" in the UI.
- CycleCard component evolution — whether to rename/refactor the existing component or create a new one.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-01 | Student can select session duration (30, 45, or 60 min) before starting a cycle | Config already has `sessionDurationOptions: [30, 45, 60]`; WorkTrackerClient needs a pre-start selection step; state machine handles idle → selecting → active |
| WORK-02 | Student can select break type (short 5-10 min or long 10-30 min) and exact duration before starting a cycle | New `breakConfig` entries needed in WORK_TRACKER config; break selection UI shown in pre-start step (not a separate page) |
| WORK-03 | First cycle of the day skips the break — break runs between cycles only | `completedCount === 0` check in WorkTrackerClient; break state never entered for first session |
| WORK-04 | Break displays as a visible countdown; when break ends, student can start next cycle | `breakSecondsRemaining` in React state only — no DB write; same `setInterval` pattern as WorkTimer |
| WORK-05 | Student can skip a break early | Button in break-countdown UI that calls a handler setting break state to null/0 |
| WORK-06 | Each work_sessions row stores the chosen session_minutes | POST body gains `session_minutes`; DB column already added in Phase 13 (migration 00006) |
| WORK-07 | Circular timer adapts to whatever duration was chosen | WorkTimer already accepts `totalSeconds` prop; pass `selectedMinutes * 60` instead of `WORK_TRACKER.sessionMinutes * 60` |
| WORK-08 | No daily cycle cap — students can do unlimited sessions; 4-hour daily goal is KPI reference not hard cap | Remove `cycle_number` max validator in POST route; remove `allComplete` guard; remove `cyclesPerDay` from progress display |
</phase_requirements>

---

## Summary

Phase 14 is a **UI state machine refactor** of the existing Work Tracker. The database foundation is already done (Phase 13 delivered `session_minutes` column and dropped the `cycle_number <= 4` constraint). No new migrations are needed for this phase. All changes are in client components, one server page, two API routes, and config.

The core work falls into five areas:
1. **`cyclesPerDay` consumer migration** — 13 call-sites across 4 files must move from count-based to hours-based logic.
2. **WorkTrackerClient state machine expansion** — add a "pre-session setup" state, a "break countdown" state, and wire session_minutes through every mutation.
3. **Session list evolution** — replace the fixed 4-slot grid with a dynamic, newest-first, collapsible list.
4. **Hours-based progress bar** — replace "X of 4 cycles" with "Xh Ym / 4h" bar on both the work page and the student dashboard.
5. **API route hardening** — remove the `cycle_number` max cap from POST and accept `session_minutes` in the body.

The break timer is **client-state only**. It never touches the database or any API route. This is both a constraint from Phase 13 research and the correct design (break time is not tracked).

**Primary recommendation:** Implement as a single-component state machine inside WorkTrackerClient with a `phase` discriminant: `"setup" | "working" | "break" | "idle"`. Keep all break state in `useState`; never persist it.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | installed | `useState`, `useEffect`, `useRef`, `useCallback` | Already in project |
| Next.js App Router | 16 | Server component (work page), route handlers | Already in project |
| Tailwind CSS 4 | installed | ima-* tokens, responsive classes | Project standard |
| Zod | installed | API route validation | CLAUDE.md hard rule |
| Supabase admin client | installed | Mutations in route handlers | CLAUDE.md hard rule |

### No New NPM Installs Required

All patterns needed for this phase (countdown timers, progress bars, conditional UI) are handled with existing React primitives and Tailwind. The project's `lucide-react` already provides timer icons.

**Version verification:** No new packages — skip.

---

## Architecture Patterns

### State Machine for WorkTrackerClient

WorkTrackerClient must handle four distinct phases of student interaction. Model them as a discriminated state value:

```typescript
// Pattern verified against existing codebase
type TrackerPhase =
  | { kind: "idle" }           // No active session; show setup button
  | { kind: "setup" }          // Pre-session: duration + break selection
  | { kind: "working" }        // Timer running or paused
  | { kind: "break"; secondsRemaining: number };  // Break countdown
```

Only one of these is ever true at a time. This prevents the current "check 4 booleans" pattern (allComplete, activeSession, pausedSession, !activeSession && !pausedSession).

### Break State — Client Only

```typescript
// CORRECT: break lives in React state, never in DB
const [breakSecondsRemaining, setBreakSecondsRemaining] = useState<number | null>(null);

// Break tick (same setInterval pattern as WorkTimer)
useEffect(() => {
  if (breakSecondsRemaining === null || breakSecondsRemaining <= 0) return;
  const id = setInterval(() => {
    setBreakSecondsRemaining(prev => {
      if (prev === null || prev <= 1) { clearInterval(id); return null; }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(id);
}, [breakSecondsRemaining]);
```

**Never** set `paused_at` during a break. `paused_at` is only for pausing mid-session.

### Pre-Session Setup UI

Since the selection step appears once before every session start (except the very first implicit one — actually WORK-02 says selection is before every start, so it always appears), use inline button groups matching existing ima-* patterns:

```typescript
// Duration picker — three toggle buttons
// Existing pattern: bg-ima-primary for selected, bg-ima-surface for unselected
const [selectedMinutes, setSelectedMinutes] = useState<30 | 45 | 60>(
  WORK_TRACKER.defaultSessionMinutes
);

// Break config — only shown when completedCount > 0
const [breakType, setBreakType] = useState<"short" | "long">("short");
const [breakMinutes, setBreakMinutes] = useState(5);
```

The setup step transitions to "working" when the student taps "Start". The handler calls `handleStart(selectedMinutes)`.

### cyclesPerDay Migration — All 13 Consumers

Complete audit of all 13 call-sites (verified by grep):

**File 1: `src/components/student/WorkTrackerClient.tsx` (7 hits)**
| Line | Current | Migration |
|------|---------|-----------|
| 67 | `allComplete = completedCount >= cyclesPerDay` | Remove — no completion gate; bar fills at 4h |
| 68 | `nextCycleNumber = Math.min(completedCount + 1, cyclesPerDay)` | `nextCycleNumber = completedCount + 1` |
| 104 | `duration_minutes: WORK_TRACKER.sessionMinutes` | Use `selectedMinutes` from state |
| 230 | `totalSeconds={WORK_TRACKER.sessionMinutes * 60}` | `totalSeconds={activeSession.session_minutes * 60}` |
| 292 | `WORK_TRACKER.sessionMinutes` (formatPausedRemaining) | `pausedSession.session_minutes` |
| 343 | `{completedCount} of {WORK_TRACKER.cyclesPerDay} cycles done` | Remove — replaced by hours bar (D-05/D-06) |
| 357 | `Array.from({ length: cyclesPerDay }, ...)` (fixed 4-slot grid) | Replace with dynamic list (D-01 through D-04) |

**File 2: `src/components/student/WorkTimer.tsx` (3 hits)**
| Line | Current | Migration |
|------|---------|-----------|
| 78 | `"...Cycle ${cycleNumber} of ${cyclesPerDay}"` (screen reader) | Remove "of N" — just `"Cycle ${cycleNumber}"` |
| 85 | `aria-label="...Cycle ${cycleNumber} of ${cyclesPerDay}"` | Remove "of N" |
| 129 | `Cycle {cycleNumber} of {WORK_TRACKER.cyclesPerDay}` | `Session {cycleNumber}` (or "Cycle {n}") |

**File 3: `src/app/api/work-sessions/route.ts` (1 hit)**
| Line | Current | Migration |
|------|---------|-----------|
| 9 | `.max(WORK_TRACKER.cyclesPerDay)` in Zod schema | Remove `.max()` — unbounded; add `session_minutes` field |

**File 4: `src/app/(dashboard)/student/page.tsx` (4 hits)**
| Line | Current | Migration |
|------|---------|-----------|
| 18 | `completedCount < cyclesPerDay` → "Start Cycle N" | Replace with hours-based logic: if `totalMinutesWorked < dailyGoalHours * 60` |
| 59 | `progressPercent = completedCount / cyclesPerDay * 100` | `progressPercent = Math.min(100, totalMinutesWorked / (dailyGoalHours * 60) * 100)` |
| 82 | `{completedCount}/{WORK_TRACKER.cyclesPerDay}` | Replace with `{formatHours(totalMinutesWorked)} / {dailyGoalHours}h` |
| 93 | `aria-valuemax={WORK_TRACKER.cyclesPerDay}` | `aria-valuemax={WORK_TRACKER.dailyGoalHours * 60}` (minutes) |

### Hours Progress Bar

Per D-05/D-07, the bar fills based on total minutes worked. Cap at 100% once the student hits 4 hours; they can keep going but the bar stays full:

```typescript
const dailyGoalMinutes = WORK_TRACKER.dailyGoalHours * 60; // 240
const progressPercent = Math.min(100, Math.round((totalMinutesWorked / dailyGoalMinutes) * 100));

// Display: "1h 30m / 4h"
function formatHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

Add `formatHoursMinutes` to `src/lib/utils.ts`. Existing `formatHours` returns one decimal place (e.g., "1.5h") — the new function is needed for the "1h 30m / 4h" display.

### Session List (D-01 through D-04)

Replace the fixed 4-slot grid with a dynamic list. Only show sessions that exist:

```typescript
// Sort newest-first: highest cycle_number first
const visibleSessions = [...sessions]
  .filter(s => s.status !== "abandoned" || /* optionally show abandoned */ false)
  .sort((a, b) => b.cycle_number - a.cycle_number);

const DEFAULT_VISIBLE = 4;
const [showAll, setShowAll] = useState(false);
const displayed = showAll ? visibleSessions : visibleSessions.slice(0, DEFAULT_VISIBLE);
const hiddenCount = visibleSessions.length - DEFAULT_VISIBLE;
```

CycleCard (or renamed SessionCard) gains a `sessionMinutes` prop to display "Session 3 — 45 min" (D-02).

### API Route Changes

**POST `/api/work-sessions`:**
```typescript
// Before (gating):
cycle_number: z.number().int().min(1).max(WORK_TRACKER.cyclesPerDay),

// After (unbounded):
cycle_number: z.number().int().min(1),
session_minutes: z.number().int().refine(
  (v) => (WORK_TRACKER.sessionDurationOptions as readonly number[]).includes(v),
  { message: "Invalid session duration" }
),
```

Also add `session_minutes` to the INSERT payload.

**PATCH `/api/work-sessions/[id]`:**
```typescript
// Line 87 — change fallback to use stored value, not config default
// The stored session.session_minutes should be the source of truth.
// Remove the duration_minutes field from patchSchema (it is always session.session_minutes).
// OR: keep it optional but validate it matches one of sessionDurationOptions.
update.duration_minutes = duration_minutes ?? session.session_minutes;
```

The cleanest approach: remove `duration_minutes` from the PATCH schema entirely. The route sets `duration_minutes = session.session_minutes` on completion. The client no longer needs to send it.

### Types Must Be Updated

`src/lib/types.ts` — WorkSession Row does not include `session_minutes` yet (it is in the DB after migration 00006 but the TypeScript type was not updated). Must add:

```typescript
// Row:
session_minutes: number;

// Insert:
session_minutes: number;

// Update:
session_minutes?: number;
```

### Anti-Patterns to Avoid

- **Persisting break state to DB:** Break countdown is React state only. Never touch `paused_at` during a break.
- **Using `getToday()` for server-side date comparisons:** Use `getTodayUTC()` in server components and API routes. `getToday()` is local-time and only safe in client components.
- **Hardcoding `sessionMinutes` in CycleCard timeInfo:** Always read from `session.session_minutes`, never `WORK_TRACKER.sessionMinutes`.
- **Leaving `allComplete` guard:** Remove it — no hard cap. The progress bar handles the 4h goal visually.
- **Empty catch blocks:** Every catch must `console.error` per CLAUDE.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Countdown timer tick | Custom `setTimeout` chain | `setInterval` with `calcRemaining()` — already proven in WorkTimer |
| Minutes format "1h 30m" | Date library | `Math.floor(m/60)` + modulo — trivial, no import needed |
| Break duration options | Freeform input | Config-driven presets — matches out-of-scope rule against free-form input |
| Session list "Show more" | Pagination library | `useState(false)` + `.slice(0, 4)` — exactly what the design calls for |
| Circular timer ring | Canvas or third-party | SVG `strokeDashoffset` — already implemented in WorkTimer, reuse as-is |

**Key insight:** Every hard sub-problem in this phase already has a working solution in the codebase. The task is wiring existing patterns together, not building new primitives.

---

## Runtime State Inventory

> This is a migration phase (removing `cyclesPerDay` as a hard cap, adding `session_minutes`).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `work_sessions` rows — `session_minutes` column already backfilled to 45 for all existing rows (Phase 13 migration 00006) | None — data is already migrated |
| Stored data | `work_sessions` — `cycle_number` DB constraint already dropped in migration 00006 | None — already done |
| Live service config | No external services carry `cyclesPerDay` or session duration config | None |
| OS-registered state | None | None — verified by audit |
| Secrets/env vars | None reference `cyclesPerDay` | None |
| Build artifacts | TypeScript types in `src/lib/types.ts` do not yet include `session_minutes` column | Code edit required — add to Row/Insert/Update types |

**Nothing found in "live service config", "OS-registered state", "secrets/env vars", "build artifacts" categories beyond the types.ts gap above.**

---

## Common Pitfalls

### Pitfall 1: Forgetting `session_minutes` in WorkSession TypeScript Type

**What goes wrong:** TypeScript will not complain if `session_minutes` is absent from the type; Supabase client returns the column but the type says it does not exist. Code accessing `session.session_minutes` gets a type error or silently gets `undefined`.
**Why it happens:** Migration 00006 added the column to the DB, but `src/lib/types.ts` was not regenerated.
**How to avoid:** Add `session_minutes: number` to WorkSession Row/Insert/Update types before writing any component that reads it.
**Warning signs:** TypeScript errors like "Property 'session_minutes' does not exist on type WorkSession".

### Pitfall 2: Using `WORK_TRACKER.sessionMinutes` as the Completion Duration

**What goes wrong:** `handleComplete` currently sends `duration_minutes: WORK_TRACKER.sessionMinutes` (hardcoded 45). If session was 30 min, a 45-minute duration is written — hours total is wrong.
**Why it happens:** Phase 13 didn't change the mutation code, only the DB schema.
**How to avoid:** On completion, the API route reads `session.session_minutes` (stored at start time) and uses that. Remove `duration_minutes` from the client PATCH body.
**Warning signs:** Hours total on progress bar is always a multiple of 45, even when 30-min sessions were used.

### Pitfall 3: Break Timer Triggering on First Session

**What goes wrong:** Break countdown launches after cycle 1 completes even though WORK-03 says first cycle skips the break.
**Why it happens:** Break trigger logic checks `completedCount > 0` after a session completes — but `completedCount` is re-derived from `sessions` which includes the just-completed session, making it `1` on first completion.
**How to avoid:** Check `completedCount === 1` (i.e. "the one that just completed is the first") — trigger break only when `completedCount >= 2`. Alternatively, track whether a break has been shown for the most recent completion.
**Warning signs:** Break countdown appears after the very first session.

### Pitfall 4: `cyclesPerDay` Missed in Student Dashboard

**What goes wrong:** WorkTrackerClient is updated but the student dashboard (`/student/page.tsx`) still uses `cyclesPerDay`-based progress — "3/4 cycles" and progress bar max of 4.
**Why it happens:** The dashboard is a separate server component that independently queries sessions and renders progress.
**How to avoid:** The grep audit shows 4 hits in `student/page.tsx`. All four must be migrated to hours-based logic in the same wave as WorkTrackerClient.
**Warning signs:** Work Tracker page shows hours bar, but student dashboard still shows "3/4 cycles".

### Pitfall 5: Stale `cycle_number` Ordering in Work Page Query

**What goes wrong:** Work page fetches sessions `.order("cycle_number", { ascending: true })` — this is fine for display, but once the list is newest-first in the UI (D-03), the sort order is managed client-side. The server query order doesn't matter for correctness, but sending ascending order while displaying descending is confusing.
**Why it happens:** Legacy query from Phase 13.
**How to avoid:** Change server query to `.order("cycle_number", { ascending: false })` or leave as ascending and let the client sort — but be explicit about which layer owns the sort.

### Pitfall 6: `allComplete` Guard Blocks 5th+ Sessions

**What goes wrong:** `allComplete = completedCount >= WORK_TRACKER.cyclesPerDay` is evaluated to `true` once 4 sessions complete, and the "idle" branch shows `{allComplete && ...celebration}` instead of the start button.
**Why it happens:** The `allComplete` variable gates the entire idle render path.
**How to avoid:** Remove `allComplete` entirely (D-07: no celebration banner). The progress bar filling to 100% is the only signal. The start button stays visible always when idle.
**Warning signs:** After completing 4 sessions, no "Start Session 5" button appears.

### Pitfall 7: Break Duration Slider Not Constrained to Break Type Range

**What goes wrong:** "Short" break type but student can still select 30 minutes.
**Why it happens:** If break minutes are stored independently without re-validating against type.
**How to avoid:** On `breakType` change, reset `breakMinutes` to the minimum of the new type's range. Validate in the pre-session setup UI.

---

## Code Examples

### WorkTimer — Existing Pattern (HIGH confidence, source: src/components/student/WorkTimer.tsx)

The timer already accepts `totalSeconds` and derives everything from that. For Phase 14, replace the hardcoded pass of `WORK_TRACKER.sessionMinutes * 60` with the session's stored duration:

```typescript
// Before (line 230, WorkTrackerClient.tsx):
totalSeconds={WORK_TRACKER.sessionMinutes * 60}

// After:
totalSeconds={(activeSession.session_minutes ?? WORK_TRACKER.defaultSessionMinutes) * 60}
```

### Break Countdown (client state only)

```typescript
// In WorkTrackerClient:
const [breakSecondsRemaining, setBreakSecondsRemaining] = useState<number | null>(null);
const [selectedBreakMinutes, setSelectedBreakMinutes] = useState(5);

// Trigger break after session complete (not first session):
function triggerBreak(breakMinutes: number) {
  setBreakSecondsRemaining(breakMinutes * 60);
}

// Tick
useEffect(() => {
  if (breakSecondsRemaining === null || breakSecondsRemaining <= 0) {
    if (breakSecondsRemaining === 0) setBreakSecondsRemaining(null);
    return;
  }
  const id = setInterval(() => {
    setBreakSecondsRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : null));
  }, 1000);
  return () => clearInterval(id);
}, [breakSecondsRemaining]);

// Skip break
function handleSkipBreak() {
  setBreakSecondsRemaining(null);
}
```

### Hours-Based Progress Bar

```typescript
// In WorkTrackerClient and student/page.tsx:
const dailyGoalMinutes = WORK_TRACKER.dailyGoalHours * 60; // 240
const progressPercent = Math.min(100, Math.round((totalMinutesWorked / dailyGoalMinutes) * 100));

// Display string "1h 30m / 4h":
const hWorked = Math.floor(totalMinutesWorked / 60);
const mWorked = totalMinutesWorked % 60;
const workedLabel = hWorked > 0 ? `${hWorked}h ${mWorked > 0 ? `${mWorked}m` : ""}`.trim() : `${mWorked}m`;
const goalLabel = `${WORK_TRACKER.dailyGoalHours}h`;

// Accessible progressbar:
<div
  role="progressbar"
  aria-valuenow={totalMinutesWorked}
  aria-valuemin={0}
  aria-valuemax={dailyGoalMinutes}
  aria-label={`Daily hours progress: ${workedLabel} of ${goalLabel}`}
>
```

### POST route — Unbounded cycle_number + session_minutes

```typescript
const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycle_number: z.number().int().min(1),   // no .max()
  session_minutes: z.number().int().refine(
    (v) => (WORK_TRACKER.sessionDurationOptions as readonly number[]).includes(v),
    { message: "session_minutes must be 30, 45, or 60" }
  ),
});

// In INSERT:
.insert({
  student_id: profile.id,
  date,
  cycle_number,
  session_minutes,
  started_at: new Date().toISOString(),
  status: "in_progress",
})
```

### PATCH route — Use stored session_minutes on completion

```typescript
if (newStatus === "completed") {
  update.completed_at = new Date().toISOString();
  // Use the stored session_minutes, not a client-supplied value
  update.duration_minutes = session.session_minutes;
}
```

Remove `duration_minutes` from `patchSchema` entirely — it is always derived from the stored row.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 4-cycle count-based progress | Hours-based progress bar (D-05) | Phase 14 | Sessions of any duration now count correctly |
| `WORK_TRACKER.sessionMinutes` hardcoded in completion | `session.session_minutes` from DB row | Phase 14 | Accurate duration history |
| `cycle_number <= 4` DB constraint | Unbounded (dropped in Phase 13) | Phase 13 (already done) | No action needed |
| `sessionMinutes` not in DB | `session_minutes` column, NOT NULL, default 45 | Phase 13 (already done) | Row always has a stored duration |
| Fixed 4-slot CycleCard grid | Dynamic growing list | Phase 14 | Cleaner UI for 5+ sessions |

---

## Open Questions

1. **Terminology: "Session" vs "Cycle"**
   - What we know: The UI currently says "Cycle"; CONTEXT.md leaves this to Claude's discretion.
   - What's unclear: Whether renaming affects anything beyond WorkTimer/CycleCard display text.
   - Recommendation: Rename to "Session" in the UI (the DB column is `cycle_number` but that is internal). "Session 3 — 45 min" reads more naturally than "Cycle 3 — 45 min".

2. **Break type config structure**
   - What we know: WORK-02 requires "short: 5-10 min, long: 10-30 min" ranges. CONTEXT.md leaves the exact break config to Claude.
   - What's unclear: Whether break duration should be a slider, a button group with presets (5, 10, 15, 20, 30 min), or a simple short/long toggle (no minute selection).
   - Recommendation: Add to WORK_TRACKER config:
     ```typescript
     breakOptions: {
       short: { min: 5, max: 10, default: 5 },
       long:  { min: 10, max: 30, default: 15 },
     }
     ```
     Expose as button-group presets: short = [5, 10], long = [10, 15, 20, 30]. No slider (avoids accessibility complexity).

3. **`handleComplete` race condition — client vs. timer auto-complete**
   - What we know: The current code already silently ignores "Cannot transition" errors (WorkTrackerClient line 110). This is the right guard.
   - What's unclear: Does the race condition still exist when the completion timer fires, OR does the existing guard cover it?
   - Recommendation: Keep the existing guard. It handles the race when the timer fires while the student is also clicking "Complete".

---

## Environment Availability

Step 2.6: SKIPPED — Phase 14 is a pure code/config/UI change. No new external tools, services, runtimes, CLIs, or databases are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (e2e) + manual UAT |
| Config file | none detected in project — UAT is the gate |
| Quick run command | `npm run build` (no type errors) + `npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Duration picker renders 30/45/60 buttons; selection changes `selectedMinutes` state | manual-only | `npx tsc --noEmit` catches type errors | N/A |
| WORK-02 | Break type selector renders; break minutes constrained to range; selection stored in state | manual-only | `npx tsc --noEmit` | N/A |
| WORK-03 | `breakSecondsRemaining` never set when `completedCount === 0` at time of completion | manual-only | review code logic | N/A |
| WORK-04 | Break countdown ticks down from selected break minutes | manual-only | observe in browser | N/A |
| WORK-05 | "Skip" button sets `breakSecondsRemaining = null` immediately | manual-only | observe in browser | N/A |
| WORK-06 | POST body includes `session_minutes`; DB row stores correct value | manual-only + DB inspect | `npx tsc --noEmit` | N/A |
| WORK-07 | WorkTimer `totalSeconds` prop changes with duration selection | manual-only | `npx tsc --noEmit` | N/A |
| WORK-08 | 5th+ sessions start without error; progress bar stays at 100% | manual-only | `npm run build` | N/A |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green + manual UAT passes before `/gsd:verify-work`

### Wave 0 Gaps

None — no test files needed. UAT is the validation gate for this phase per project history (v1.0 used manual UAT for all work tracker phases).

---

## Project Constraints (from CLAUDE.md)

These directives apply to every file touched in Phase 14:

| Constraint | Impact on Phase 14 |
|------------|-------------------|
| `motion-safe:` on every `animate-*` | Break countdown and duration picker transitions must use `motion-safe:transition-*` |
| 44px touch targets | Duration picker buttons: `min-h-[44px]`; break type buttons: `min-h-[44px]`; Skip Break button: `min-h-[44px]` |
| ARIA on dynamic content | Break countdown timer: `role="timer"`; hours progress bar: `role="progressbar"` with `aria-valuenow/min/max` |
| Admin client in API routes | POST and PATCH routes already use admin client — preserve this |
| Never swallow errors | All catch blocks: `console.error(...)` |
| Check `response.ok` | All fetch() calls in WorkTrackerClient must check `response.ok` before parsing |
| `import { z } from "zod"` | Not `"zod/v4"` |
| `ima-*` tokens only | Duration picker buttons: `bg-ima-primary` for selected state; all new text uses `text-ima-text`, `text-ima-text-secondary` |
| `px-4` on page wrappers | Already present on work page; ensure any new wrapper sections have `px-4` |
| Stable `useCallback` deps | Break countdown handler and `handleSkipBreak` must use refs if passed as callbacks |
| Config is truth | `sessionDurationOptions` and break config must come from `WORK_TRACKER` in `config.ts` |
| Admin client never in client components | Only in `src/app/api/` and `src/lib/supabase/admin.ts` |
| Proxy not middleware | No changes needed — no routing changes in this phase |
| Filter by user ID in queries | POST and PATCH routes already do this — preserve |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `src/components/student/WorkTrackerClient.tsx` — full implementation, all 7 cyclesPerDay usages
- Direct codebase read: `src/components/student/WorkTimer.tsx` — totalSeconds prop, SVG ring, tick pattern
- Direct codebase read: `src/components/student/CycleCard.tsx` — props interface, status icons
- Direct codebase read: `src/app/api/work-sessions/route.ts` — POST Zod schema, cycle_number max cap
- Direct codebase read: `src/app/api/work-sessions/[id]/route.ts` — PATCH schema, completion logic
- Direct codebase read: `src/lib/config.ts` — sessionDurationOptions, defaultSessionMinutes, dailyGoalHours
- Direct codebase read: `src/lib/utils.ts` — formatHours, formatPausedRemaining, getToday/getTodayUTC
- Direct codebase read: `supabase/migrations/00006_v1_1_schema.sql` — session_minutes column already added and backfilled
- Direct codebase read: `src/app/(dashboard)/student/page.tsx` — 4 cyclesPerDay usages confirmed
- Direct grep: 13 total cyclesPerDay call-sites across 4 files

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` §Accumulated Context — break timer is client state only, cyclesPerDay audit is gating

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns are verified in existing code
- Architecture: HIGH — all patterns verified by direct code read
- Pitfalls: HIGH — all identified from direct code inspection of existing consumers
- Consumer migration: HIGH — confirmed by exhaustive grep (13 call-sites, 4 files)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable codebase; no fast-moving dependencies)
