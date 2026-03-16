# Phase 3: Student Work Tracker - Research

**Researched:** 2026-03-16
**Domain:** Client-side countdown timer, SVG progress ring, Supabase mutations, Next.js 16 App Router server/client split
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Timer display:** Hero timer layout: large centered circular progress ring with MM:SS countdown in the center when a cycle is active. SVG ring depletes as time passes, big digits in the center. Timer is the star of the page during an active cycle. Prominent Pause and Complete buttons below the timer. Shows "Cycle N of 4" label beneath the ring. Auto-complete when timer reaches 0:00 — cycle is marked completed automatically with a success toast, no extra click needed.
- **Idle state (no active cycle):** Prominent "Start Cycle N" button at the top of the page. Shows "N of 4 cycles done" subtitle. Today's cycle slots displayed below in a 2-column card grid.
- **Cycle progress display:** Today's 4 cycles shown as cards in a 2x2 grid (desktop), stacking to 1-column on mobile. Each card shows: cycle number, status icon, and time info — Completed: checkmark + "45 min", Active: play icon + "MM:SS left", Paused: pause icon + "MM:SS left", Pending: dot + "Pending", Abandoned: X icon + "Abandoned". No extra info (start time, etc.) — keep it scannable.
- **Pause/Resume UX:** Resume button appears in BOTH the main action area (prominent) AND as a smaller button on the paused cycle card. Two paths to the same action for discoverability.
- **All-complete state:** Green-accented celebration card: "All 4 cycles complete!" with total hours worked. Nudge to submit daily report: "Great work! Don't forget to submit your daily report." CTA button: "Submit Daily Report" linking to /student/report. No option to start extra cycles (V1 caps at 4).
- **Student dashboard integration:** Personalized greeting "Good morning/afternoon/evening, [FirstName]!". Work progress card showing: "N/4 cycles" + "X.Xh worked" + linear progress bar + adaptive CTA. Adaptive CTA changes based on state: Idle → "Start Cycle N" (/student/work), Active → "Continue Cycle" (/student/work), Paused → "Resume Cycle" (/student/work), All 4 done → "Submit Report" (/student/report). Placeholder cards for Roadmap and Daily Report sections (Phase 4-5 will fill these).

### Claude's Discretion

- Timer ring size, colors, and animation details (use ima-* tokens)
- Exact cycle card styling and hover states
- Loading skeleton design for the work tracker page
- Abandon confirmation UX (modal vs inline — user skipped this area)
- Browser tab title updates during active timer
- Toast messages for cycle actions
- Stale session auto-abandon logic and timing
- Pause schema migration approach (adding paused_at column and paused status)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. The following features remain V2: streaks, extra cycles beyond 4, focus mode, leaderboard, player cards.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WORK-01 | Student can start a 45-minute work cycle | POST /api/work-sessions creates row with status=in_progress; timer restores from started_at |
| WORK-02 | Student can complete a work cycle | PATCH /api/work-sessions/[id] with status=completed + duration_minutes=45; router.refresh() syncs UI |
| WORK-03 | Student can pause a work cycle (timer state saved, resumable) | Requires DB migration for paused_at column and "paused" status; PATCH sets paused_at; resume recalculates started_at |
| WORK-04 | Student can track up to 4 cycles per day | Unique index (student_id, date, cycle_number) enforces this; cycle_number CHECK (1-4) in migration |
| WORK-05 | Student sees today's cycle progress on dashboard | Server component fetches today's sessions; DailyGoalRing + adaptive CTA based on session state |
| WORK-06 | Student can abandon a work cycle (5-min grace period) | PATCH with status=abandoned; WORK_TRACKER.abandonGraceSeconds=300 drives confirmation threshold |
</phase_requirements>

---

## Summary

Phase 3 builds the student work tracker — the core daily activity loop. The timer itself is a client-side countdown (`useEffect` + `setInterval`) that restores remaining time from `started_at` stored in Postgres, meaning the timer survives navigation and browser refresh with no localStorage or cookie required.

The primary technical challenge is the database schema gap: the current `work_sessions` table (migration 00001) is missing the `paused_at` column and the `"paused"` status enum value. A new migration (00003) is required before any pause/resume functionality can work. All other timer logic is purely client-side arithmetic.

The reference implementation in `reference-old/` provides near-complete, production-quality components — WorkTimer, CycleCard, WorkTrackerClient — that need only modest stripping (V2 features: focus mode, extra cycles, streaks). The reference API routes in `reference-old/src/app/api/work-sessions/` show the exact Zod schemas and mutation patterns needed, but must be adapted to remove V2 dependencies (`STREAK_CONFIG`, `is_extra` column, `streak_count` field).

**Primary recommendation:** Adapt reference-old components rather than writing from scratch. The migration for `paused_at` + `"paused"` status is the critical prerequisite; everything else follows the reference pattern.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useEffect` + `setInterval` | React 19 (built-in) | Client-side 1-second countdown tick | No external dependency; calcRemaining() from started_at is the source of truth |
| SVG `strokeDashoffset` | Browser native | Circular progress ring animation | Zero-dependency, no canvas; motion-safe:transition-[stroke-dashoffset] makes it accessible |
| Next.js `router.refresh()` | Next.js 16 | Re-fetches server component data after mutation | Correct App Router pattern — refetches without full navigation |
| Supabase admin client | @supabase/supabase-js ^2.99.2 | Server-side DB mutations in API routes | Admin client bypasses RLS; required per CLAUDE.md Hard Rules |
| Zod | ^4.3.6 (import from "zod" not "zod/v4") | API input validation | Hard rule; safeParse on all API inputs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.576.0 | Status icons (Check, Pause, Play, X, Circle, Timer) | Already installed; use for cycle card status icons |
| useRef for callbacks | React 19 (built-in) | Stable refs for toast/router/onComplete to prevent stale closure issues | Required when passing callbacks into useEffect intervals |
| date-fns | ^4.1.0 | Date helpers | Already installed; getToday() can use simple toISOString().split("T")[0] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| setInterval + calcRemaining() | Web Workers Timer | Web Workers are more accurate under tab throttling but significantly more complex and overkill for 45-min cycles |
| SVG ring | CSS conic-gradient | CSS approach is simpler but lacks browser support guarantees for animation in motion-safe context |
| router.refresh() | SWR/React Query | SWR/RQ add dependencies; router.refresh() is the established pattern in this codebase |

**Installation:** No new packages needed — all required libraries are already in package.json.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/student/
│   │   ├── page.tsx                    # REWRITE — dashboard with session data (server component)
│   │   └── work/
│   │       └── page.tsx                # NEW — work tracker page (server component)
│   └── api/
│       └── work-sessions/
│           ├── route.ts                # NEW — POST: start cycle
│           └── [id]/
│               └── route.ts            # NEW — PATCH: complete/pause/resume/abandon
├── components/
│   └── student/
│       ├── WorkTrackerClient.tsx       # NEW — client component (adapted from reference-old)
│       ├── WorkTimer.tsx               # NEW — countdown ring (adapted from reference-old)
│       └── CycleCard.tsx               # NEW — cycle status card (adapted from reference-old)
├── lib/
│   └── utils.ts                        # EXTEND — add timer utility functions
└── supabase/migrations/
    └── 00003_add_pause_support.sql    # NEW — paused_at + "paused" status
```

### Pattern 1: Timer Persistence via started_at Arithmetic

**What:** The client never stores time in state beyond the current render. On every mount (page load, navigation return), `calcRemaining()` recomputes from `started_at` in the database record.

**When to use:** Whenever a timer must survive navigation. Requires the session row to be the source of truth.

**Example:**
```typescript
// Source: reference-old/src/components/student/WorkTimer.tsx
const calcRemaining = useCallback(() => {
  if (!startedAt) return totalSeconds;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, totalSeconds - elapsed);
}, [startedAt, totalSeconds]);

useEffect(() => {
  setRemainingSeconds(calcRemaining()); // restore on mount
}, [calcRemaining]);

useEffect(() => {
  if (!sessionId || !startedAt) return;
  const interval = setInterval(() => {
    const remaining = calcRemaining();
    setRemainingSeconds(remaining);
    if (remaining <= 0) {
      clearInterval(interval);
      onCompleteRef.current(); // auto-complete
    }
  }, 1000);
  return () => clearInterval(interval);
}, [sessionId, startedAt, calcRemaining]);
```

### Pattern 2: Resume by Shifting started_at

**What:** On resume, instead of storing a `paused_duration`, the server recomputes a new `started_at` such that elapsed time = elapsed-before-pause. This means the client timer code needs no special "paused time" handling — it always computes from a single `started_at`.

**When to use:** Any timer that supports pause/resume without client complexity.

**Example:**
```typescript
// Source: reference-old/src/app/api/work-sessions/[id]/route.ts
// On resume: shift started_at forward by pause duration
const pausedAt = new Date(session.paused_at).getTime();
const startedAt = new Date(session.started_at).getTime();
const elapsedBeforePause = pausedAt - startedAt;
const newStartedAt = new Date(Date.now() - elapsedBeforePause).toISOString();
// newStartedAt is set on the row; paused_at is set to null
```

### Pattern 3: Stable Callback Refs in Timer useEffect

**What:** Store `onComplete`, `toast`, and `router` in refs to avoid tearing down/rebuilding the `setInterval` when callback identity changes between renders.

**When to use:** Any `useEffect` with a long-lived interval that closes over frequently-changing callbacks.

```typescript
// Source: reference-old/src/components/student/WorkTimer.tsx
const onCompleteRef = useRef(onComplete);
useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
// Inside interval: call onCompleteRef.current() not onComplete()
```

### Pattern 4: Server Component + Client Island

**What:** The `/student/work` page is a server component that fetches today's sessions and passes them as `initialSessions` prop to `WorkTrackerClient` (a "use client" component). The server component re-renders on `router.refresh()` to sync state after mutations.

```typescript
// src/app/(dashboard)/student/work/page.tsx (server component)
export default async function WorkPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const { data: sessions } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .order("cycle_number", { ascending: true });
  return <WorkTrackerClient initialSessions={(sessions ?? []) as WorkSession[]} />;
}
```

### Pattern 5: API Route Auth Pattern (established in Phase 2)

```typescript
// src/app/api/work-sessions/route.ts
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();
if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const admin = createAdminClient();
const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", authUser.id).single();
if (!profile || profile.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
// THEN validate body with Zod safeParse
```

### Anti-Patterns to Avoid

- **Storing timer in localStorage:** Timer should always restore from `started_at` in DB — localStorage is unreliable and creates state sync bugs.
- **Calling `router.push()` after mutation:** Use `router.refresh()` to re-run server component data fetch without navigation.
- **Passing `toast` or `router` directly as useEffect deps:** These are unstable references. Always store them in refs.
- **Relying on RLS alone in API routes:** Every query must filter by `student_id = profile.id` even though RLS also enforces it (CLAUDE.md Hard Rule).
- **Using client component for the page wrapper:** Only the interactive countdown needs "use client". The page.tsx that fetches sessions is a server component.
- **Extra cycles UI (V2):** Do not render "Start Extra Cycle" button. V1 caps at 4. Reference-old has extra cycle support — strip it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG circular progress ring | Custom canvas animation or CSS conic-gradient | Reference-old DailyProgressRing / WorkTimer SVG pattern | Already proven, accessible, uses ima-* tokens correctly |
| Timer arithmetic | Custom time library | `Date.now() - new Date(startedAt).getTime()` inline math | Simple enough to inline; no dependency needed |
| Cycle status logic | Custom state machine | Direct session.status field comparisons | Status lives in DB; no separate client state needed |
| Abandon confirmation | Custom dialog library | Inline conditional UI or simple boolean state | No modal library in stack; keep it simple |
| Session mutation | Supabase client direct | Admin client in API routes | Hard rule from CLAUDE.md; never mutate from client |

**Key insight:** The reference-old codebase is the primary "don't hand-roll" asset. WorkTimer, CycleCard, and WorkTrackerClient are production-ready with correct ARIA, motion-safe classes, and ima-* tokens. Adapt, don't rewrite.

---

## Common Pitfalls

### Pitfall 1: Missing DB Migration for Pause Support

**What goes wrong:** TypeScript errors on `session.paused_at`, runtime 400 errors from Postgres CHECK constraint when trying to set status="paused" (current CHECK only allows in_progress/completed/abandoned).

**Why it happens:** Migration 00001 created `work_sessions` without `paused_at` column and without "paused" in the status CHECK. The reference-old code and types assume these exist.

**How to avoid:** Migration 00003 must be the FIRST task in Wave 1. It must:
1. Add `paused_at timestamptz` column to `work_sessions`
2. Drop the existing `status` CHECK constraint
3. Add new CHECK that includes "paused": `CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused'))`
4. Update `src/lib/types.ts` WorkSession Row/Insert/Update to add `paused_at: string | null` and add "paused" to status union

**Warning signs:** TypeScript error `Property 'paused_at' does not exist on type...` or `invalid input value for enum` from Postgres.

### Pitfall 2: WorkSession Type Missing paused_at

**What goes wrong:** CycleCard and WorkTrackerClient reference `session.paused_at` but the current `src/lib/types.ts` WorkSession Row type does not include that field. TypeScript will error.

**Why it happens:** types.ts is a handwritten placeholder (noted in file comment: "Docker not running; regenerate once Docker is running"). It mirrors 00001 schema exactly, which predates the pause feature.

**How to avoid:** Update types.ts in the same task as the migration. Add `paused_at: string | null` to Row, Insert, Update, and add `"paused"` to the status union type.

### Pitfall 3: Timer Ticking After Component Unmount

**What goes wrong:** `setInterval` callback fires after unmount, calling setState on an unmounted component or calling `router.refresh()` on a stale router reference.

**Why it happens:** Missing cleanup in useEffect return.

**How to avoid:** The reference-old WorkTimer already has `return () => clearInterval(interval)` in the interval useEffect. Copy exactly, do not omit the cleanup.

### Pitfall 4: Auto-Complete Race Condition

**What goes wrong:** Timer hits 0 and `onComplete` fires, triggering a PATCH request. If the user also clicks "Complete" at the same moment, two PATCH requests fire simultaneously — the second fails with "Session is not in progress" (already completed).

**Why it happens:** Auto-complete callback and manual complete button both call the same handler.

**How to avoid:** The API route's PATCH handler already guards: `if (session.status !== 'in_progress') return 400`. The client should also disable the Complete button once `remainingSeconds === 0`. The API error response should be silently ignored on the second call (or caught and not toasted as an error).

### Pitfall 5: reference-old Dependencies That Don't Exist in V1

**What goes wrong:** Copying reference-old code pulls in `FEATURES.focusMode`, `STREAK_CONFIG`, `is_extra` column, `streak_count`, `FEATURES.leaderboard` — none of which exist in V1.

**Why it happens:** reference-old is the V2 codebase with all features.

**How to avoid:** When adapting each component, explicitly strip:
- `FocusMode` component import and usage
- `FEATURES` feature flag checks
- `extraSessions` / `getNextExtraCycle()` logic
- `STREAK_CONFIG` reference in the [id] PATCH route
- `is_extra` field in work_sessions insert
- `streak_count` / `last_active_at` fields in user profile queries
- `dealsClosed`, `revenue`, `outreachCount` queries from student dashboard

### Pitfall 6: cycle_number CHECK Constraint in Migration

**What goes wrong:** V1 migration 00001 has `CHECK (cycle_number BETWEEN 1 AND 4)`. The reference-old POST route allows `max(WORK_TRACKER.cyclesPerDay + 20)` for extra cycles. Inserting cycle_number > 4 will fail with a DB constraint error.

**Why it happens:** V1 intentionally caps at 4 cycles. The reference supports extra cycles.

**How to avoid:** The V1 POST route's Zod schema must cap `cycle_number` at `WORK_TRACKER.cyclesPerDay` (4), not `cyclesPerDay + 20`. This aligns with the DB constraint.

### Pitfall 7: Abandon Logic — 5-Minute Grace Period

**What goes wrong:** The reference-old abandon logic is straightforward — it just sends `status: "abandoned"` with no grace period check. The V1 requirement says: if less than 5 minutes have elapsed, require confirmation; after 5 minutes, abandon is immediate.

**Why it happens:** Grace period logic lives in the client, not the API. The API just sets status=abandoned.

**How to avoid:** The client needs to check `Date.now() - new Date(session.started_at).getTime() < WORK_TRACKER.abandonGraceSeconds * 1000` to determine whether to show a confirmation step before calling the abandon API. The abandon API itself remains simple — it just sets status=abandoned.

### Pitfall 8: getSessionUser() Signature Mismatch

**What goes wrong:** The reference-old code calls `getSessionUser("student")` with a role argument, but the V1 `src/lib/session.ts` `getSessionUser()` takes no arguments. Role enforcement uses the separate `requireRole()` function.

**Why it happens:** reference-old has a different session helper signature.

**How to avoid:** Use `requireRole("student")` in work tracker server components and API routes, not `getSessionUser("student")`.

---

## Code Examples

Verified patterns from the project's reference implementation:

### SVG Circular Progress Ring (depletes as time passes)

```typescript
// Source: reference-old/src/components/student/WorkTimer.tsx
const size = 280;
const strokeWidth = 8;
const radius = (size - strokeWidth) / 2;
const circumference = 2 * Math.PI * radius;
const strokeDashoffset = circumference * (1 - progress); // progress = remainingSeconds / totalSeconds

// JSX:
<svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
  {/* Track ring */}
  <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-ima-border" />
  {/* Progress ring */}
  <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
    className="text-ima-primary motion-safe:transition-[stroke-dashoffset] duration-1000 ease-linear" />
</svg>
// Timer text overlay:
<div className="absolute inset-0 flex flex-col items-center justify-center">
  <span className="text-4xl md:text-5xl font-mono font-bold text-ima-text">{timeStr}</span>
  <span className="text-sm text-ima-text-secondary mt-1">Cycle {cycleNumber} of 4</span>
</div>
```

### Accessible Timer Container

```typescript
// Source: reference-old/src/components/student/WorkTimer.tsx
<div
  role="timer"
  aria-label={`${minutes} minutes and ${seconds} seconds remaining in Cycle ${cycleNumber} of 4`}
>
  {/* Screen reader announcement every 15 seconds */}
  <div aria-live="polite" className="sr-only">
    {remainingSeconds > 0 && remainingSeconds % 15 === 0
      ? `${minutes} minutes ${seconds} seconds remaining`
      : ""}
  </div>
  {/* SVG ring */}
</div>
```

### POST /api/work-sessions — V1 Adapted Schema

```typescript
// Adapted from reference-old/src/app/api/work-sessions/route.ts
// V1 changes: max cycle_number capped at cyclesPerDay (4), no is_extra field
import { z } from "zod";
import { WORK_TRACKER } from "@/lib/config";

const postSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycle_number: z.number().int().min(1).max(WORK_TRACKER.cyclesPerDay), // V1: no extras
});

// Insert: no is_extra field (not in V1 schema)
await admin.from("work_sessions").insert({
  student_id: profile.id,
  date,
  cycle_number,
  started_at: new Date().toISOString(),
  status: "in_progress",
});
```

### PATCH /api/work-sessions/[id] — V1 Adapted

```typescript
// Adapted from reference-old/src/app/api/work-sessions/[id]/route.ts
// V1 changes: no streak update logic, no is_extra, no streak_count in user select
const patchSchema = z.object({
  status: z.enum(["completed", "abandoned", "paused", "in_progress"]),
  duration_minutes: z.number().int().min(0).max(60).optional(),
});

// Profile select: only id and role needed (no streak_count, last_active_at in V1)
const { data: profile } = await admin
  .from("users")
  .select("id, role")
  .eq("auth_id", authUser.id)
  .single();
```

### Migration 00003 — Add Pause Support

```sql
-- supabase/migrations/00003_add_pause_support.sql
ALTER TABLE public.work_sessions
  ADD COLUMN paused_at timestamptz;

-- Drop existing status CHECK
ALTER TABLE public.work_sessions
  DROP CONSTRAINT work_sessions_status_check;

-- Re-add with 'paused' included
ALTER TABLE public.work_sessions
  ADD CONSTRAINT work_sessions_status_check
  CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused'));
```

### getToday() and Timer Utility Functions

The V1 `src/lib/utils.ts` currently only has `cn()`. Several utilities from reference-old are needed:

```typescript
// Add to src/lib/utils.ts (from reference-old/src/lib/utils.ts)

/** Returns today's date as YYYY-MM-DD in UTC */
export function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

/** Validates a date string matches YYYY-MM-DD format */
export function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date + "T00:00:00Z").getTime());
}

/** Display label for a cycle number */
export function getCycleLabel(cycleNumber: number, cyclesPerDay: number): string {
  return `Cycle ${cycleNumber}`;  // V1: no extra cycles, always "Cycle N"
}

/** Format MM:SS remaining for a paused session */
export function formatPausedRemaining(
  startedAt: string, pausedAt: string, sessionMinutes: number
): string {
  const totalMs = sessionMinutes * 60 * 1000;
  const elapsedMs = new Date(pausedAt).getTime() - new Date(startedAt).getTime();
  if (Number.isNaN(elapsedMs)) return "--:--";
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Format minutes as hours string: 90 → "1h 30m", 60 → "1h" */
export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Time-of-day greeting */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
```

### WorkSession Type Update (src/lib/types.ts)

```typescript
// Status union update — add "paused"
status: "in_progress" | "completed" | "abandoned" | "paused";

// Add paused_at to Row, Insert, Update
paused_at: string | null;  // Row
paused_at?: string | null;  // Insert, Update
```

### Adaptive CTA Logic for Dashboard

```typescript
// Adapted from reference-old/src/app/(dashboard)/student/page.tsx
function getNextAction(
  completedCount: number,
  activeSession: WorkSession | undefined,
  pausedSession: WorkSession | undefined,
): { label: string; href: string } {
  if (activeSession) return { label: "Continue Cycle", href: "/student/work" };
  if (pausedSession) return { label: "Resume Cycle", href: "/student/work" };
  if (completedCount < WORK_TRACKER.cyclesPerDay) {
    return { label: `Start Cycle ${completedCount + 1}`, href: "/student/work" };
  }
  return { label: "Submit Report", href: "/student/report" };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store timer remaining in localStorage | Compute from `started_at` DB field | Always the correct approach | Timer survives tab close, different devices |
| Next.js middleware.ts for route guards | proxy.ts | Next.js 16 breaking change | Already implemented in Phase 1 |
| `getServerSideProps` for data | Server Components + `router.refresh()` | App Router (Next 13+) | Server components fetch data, client islands handle interactivity |
| `params` as direct object | `params: Promise<{id: string}>` then `await params` | Next.js 15+ | Already in reference-old [id] route; use this pattern |

**Deprecated/outdated (reference-old specific):**
- `is_extra` column: V2 schema only — V1 work_sessions table does not have this column. Do not insert it.
- `streak_count` / `last_active_at` on users: V2 only — V1 schema has neither. Do not query them.
- `STREAK_CONFIG`: V2 config export only — not in V1 config.ts. Remove all streak update logic.
- `FEATURES` flag object: V2 only — not in V1 config.ts. Remove all feature flag conditional renders.
- `getCycleLabel()` with "Extra Cycle" logic: V1 always returns "Cycle N"; strip the extra cycle branch.

---

## Open Questions

1. **Stale session auto-abandon**
   - What we know: CONTEXT.md lists this as Claude's Discretion with no explicit requirement
   - What's unclear: Should an `in_progress` session from yesterday auto-abandon on today's page load? The DB has no cron job (out of scope per REQUIREMENTS.md)
   - Recommendation: On page load in WorkTrackerClient, detect sessions with `date < today` and `status === 'in_progress'`, then fire a silent abandon PATCH. This is a client-side cleanup triggered by the render, not a cron job.

2. **Abandon confirmation UX — modal vs inline**
   - What we know: Claude's discretion; user skipped this decision
   - Recommendation: Use inline conditional state (a simple boolean `showAbandonConfirm`) toggled by the Abandon button. No modal library needed. Renders a small confirmation row beneath the button: "Are you sure? [Confirm Abandon]" — removes need for a modal portal.

3. **Browser tab title during active timer**
   - What we know: Claude's discretion
   - Recommendation: `document.title = "${timeStr} — Work Tracker | IMA"` inside the timer's 1-second tick. Reset to "Work Tracker | IMA" on unmount. This is a progressive enhancement — no ARIA impact.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no test runner in package.json scripts or devDependencies |
| Config file | None — Wave 0 must add |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-01 | Start a cycle creates in_progress row | unit (util) | TBD after framework install | Wave 0 |
| WORK-02 | Complete cycle sets status=completed | unit (util) | TBD after framework install | Wave 0 |
| WORK-03 | Pause saves paused_at; resume recalculates started_at | unit (util) | TBD after framework install | Wave 0 |
| WORK-04 | Max 4 cycles enforced (DB constraint + Zod) | unit (util) | TBD after framework install | Wave 0 |
| WORK-05 | Dashboard adaptive CTA logic | unit (util: getNextAction) | TBD after framework install | Wave 0 |
| WORK-06 | Abandon grace period (< 5min requires confirm) | unit (util) | TBD after framework install | Wave 0 |

**Note:** All WORK-* requirements involve UI interactions and DB mutations that are difficult to test in isolation without integration test infrastructure. The most testable units are the pure functions: `calcRemaining()`, `getNextAction()`, `formatPausedRemaining()`, `getGreeting()`. Timer UI behavior is best verified manually through UAT.

**Recommendation:** Given no test framework exists and the phase is primarily UI/mutation work, install Vitest for pure function unit tests as a Wave 0 task. E2E timer behavior is verified through UAT. This aligns with how Phase 2 was verified (UAT-based).

### Wave 0 Gaps

- [ ] `vitest` or another test framework — currently not in package.json at all
- [ ] `tests/lib/utils.test.ts` — covers timer util functions (formatPausedRemaining, getNextAction, calcRemaining logic)
- [ ] `00003_add_pause_support.sql` migration — prerequisite for all pause/resume work

*(If test framework complexity outweighs value for this phase, skip Vitest and validate entirely through UAT as was done in Phase 2.)*

---

## Sources

### Primary (HIGH confidence)

- `reference-old/src/components/student/WorkTimer.tsx` — Timer countdown pattern, SVG ring, auto-complete
- `reference-old/src/components/student/WorkTrackerClient.tsx` — Full work tracker orchestration, session state management
- `reference-old/src/components/student/CycleCard.tsx` — Cycle status card with all status variants
- `reference-old/src/app/api/work-sessions/route.ts` — POST: start cycle, conflict detection, admin client pattern
- `reference-old/src/app/api/work-sessions/[id]/route.ts` — PATCH: pause/resume/complete/abandon, started_at shift on resume
- `reference-old/src/app/(dashboard)/student/page.tsx` — Dashboard with DailyGoalRing, adaptive CTA, parallel data fetch
- `supabase/migrations/00001_create_tables.sql` — Current work_sessions schema (missing paused_at)
- `src/lib/config.ts` — WORK_TRACKER constants (sessionMinutes: 45, cyclesPerDay: 4, abandonGraceSeconds: 300)
- `src/lib/session.ts` — requireRole() signature for V1
- `reference-old/src/lib/utils.ts` — Timer utility functions to port to V1

### Secondary (MEDIUM confidence)

- `src/lib/types.ts` — WorkSession type (confirmed missing paused_at — handwritten placeholder, not auto-generated)
- `src/app/api/auth/callback/route.ts` — Established API route auth pattern (createClient + createAdminClient)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages needed; all tools already installed and used in Phase 2
- Architecture: HIGH — reference-old provides near-complete proven implementation; patterns are directly applicable
- Pitfalls: HIGH — schema gap (missing paused_at/paused status) and V2 cleanup items are fully identified and enumerated
- Migration approach: HIGH — ALTER TABLE ADD COLUMN + DROP/ADD CONSTRAINT is standard Postgres DDL

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack — no fast-moving dependencies)
