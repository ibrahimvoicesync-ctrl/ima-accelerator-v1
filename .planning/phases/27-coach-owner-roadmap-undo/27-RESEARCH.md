# Phase 27: Coach/Owner Roadmap Undo - Research

**Researched:** 2026-03-31
**Domain:** Next.js API route (PATCH), React client component mutation, Supabase admin client, audit log
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** When undoing step N and step N+1 is currently active (not yet completed), the confirmation dialog MUST include a cascade warning: "Are you sure you want to reset Step X back to active? Step Y (currently active) will also be re-locked."
- **D-02:** When step N+1 is NOT active (i.e., it's locked or doesn't exist), use the simple text: "Are you sure you want to reset Step X back to active?"
- **D-03:** The API response must indicate whether a cascade re-lock happened so the client can display the correct confirmation dialog text before the action and the correct toast after.
- **D-04:** Inline icon button on completed steps in the coach/owner RoadmapTab. Standard placement — no hover-only visibility.
- **D-05:** Toast notification on success ("Step X reset to active" or "Step X reset to active, Step Y re-locked") plus optimistic or fetched re-render of the roadmap. Standard pattern.
- **D-06:** Toast error on failure (network error, already undone, etc.). Modal closes on error. Standard pattern.

### Claude's Discretion

- Undo icon choice (e.g., RotateCcw from lucide-react, or similar)
- Exact undo button size/color within ima-* design tokens
- Whether to pre-check N+1 status client-side for the dialog text or fetch it from the API
- Loading state while undo request is in-flight (disable button, spinner, etc.)
- Whether the API returns the updated roadmap rows or the client refetches

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UNDO-01 | Coach can revert any completed roadmap step to active for their assigned students via PATCH /api/roadmap/undo | Authorization chain pattern documented; coach assignment check via `student.coach_id === profile.id` (exact pattern from `/api/calendar/route.ts`) |
| UNDO-02 | Owner can revert any completed roadmap step to active for any student via the same endpoint | Owner role bypasses assignment check — same pattern as all other owner-scoped routes |
| UNDO-03 | Undo presents a confirmation dialog before executing ("Are you sure you want to reset Step X back to active?") | Modal component fully documented; confirmation pattern extracted from `RoadmapClient.tsx` |
| UNDO-04 | If step N+1 is currently active (not completed), undoing step N re-locks N+1 to maintain sequential progression | Cascade re-lock logic documented; single-request pattern matches existing forward-unlock pattern in `/api/roadmap/route.ts` |

</phase_requirements>

---

## Summary

Phase 27 builds a PATCH endpoint at `/api/roadmap/undo/route.ts` and a UI undo button + confirmation modal in `RoadmapTab.tsx`. The existing codebase already contains all reusable primitives: the `Modal`, `Button`, `Toast`, and `useToast` hook are production-ready; the CSRF → auth → role → rate-limit → Zod → ownership → logic API chain is established; the `roadmap_undo_log` table was created in Phase 26 and is ready for INSERT. There are no new dependencies required.

The largest implementation concern is the N+1 cascade re-lock, which must occur in the same database request as the step N revert. A two-query sequential approach (UPDATE step N, then conditionally UPDATE step N+1) is safe because both use the admin client and operate within a single request — identical to the forward-unlock pattern in the existing `/api/roadmap/route.ts`. However the client also needs to know in advance whether a cascade will occur to show the correct dialog text (D-01 vs D-02). The recommended approach is to pre-detect N+1 status client-side from the `roadmap` array that is already passed as a prop — no extra API call needed.

`RoadmapTab.tsx` is currently a pure display component with no state or callbacks. Adding the undo button requires converting it to use `useState`/`useCallback` for the confirm modal state, a `useRef` for the toast and router (stable deps pattern established in `RoadmapClient.tsx`), and a new `studentId` prop. Both `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` already receive `studentId` and pass it to the `RoadmapTab` render site — a one-line prop thread change.

**Primary recommendation:** Implement as three focused tasks: (1) API route `src/app/api/roadmap/undo/route.ts`, (2) `RoadmapTab.tsx` UI changes + new `studentId` prop, (3) prop thread update in `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx`.

---

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Installed Version | Purpose | Why Standard |
|---------|----------|---------|--------------|
| next | 15.x (App Router) | PATCH route handler in `src/app/api/roadmap/undo/route.ts` | Project stack |
| zod | installed (import from `"zod"` not `"zod/v4"`) | Request body validation | Project standard; CLAUDE.md hard rule |
| @supabase/supabase-js | installed | Admin client for DB mutations | Project standard |
| lucide-react | installed | `RotateCcw` icon for undo button | Project icon library |

### No New Installations Required

All required tools are already in `node_modules`. Confirmed by `STATE.md`: "Zero new npm dependencies — motion, lru-cache, zod, lucide-react all cover v1.3 needs at installed versions."

---

## Architecture Patterns

### API Route: Authorization Chain

Every mutation API route in this project follows the same chain. The undo route must follow it exactly:

```
CSRF check (verifyOrigin) → Auth (supabase.auth.getUser) → Role (admin .from("users") .select("id, role")) → Role guard (coach or owner only) → Rate limit (checkRateLimit) → Body parse (request.json()) → Zod safeParse → Student ownership check → Business logic → INSERT roadmap_undo_log → Response
```

**Coach assignment check pattern** (from `/api/calendar/route.ts`, HIGH confidence — read directly):

```typescript
// 1. Fetch student to get coach_id
const { data: student, error: studentError } = await admin
  .from("users")
  .select("id, coach_id")
  .eq("id", studentId)
  .eq("role", "student")
  .single();

if (studentError || !student) {
  return NextResponse.json({ error: "Student not found" }, { status: 404 });
}

// 2. Coach can only access their own students
if (profile.role === "coach" && student.coach_id !== profile.id) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// owner: no check needed — falls through
```

### API Route: Cascade Re-lock in Single Request

The existing `/api/roadmap/route.ts` (step completion) already demonstrates the forward-unlock pattern: mark step N completed, then conditionally set step N+1 to active. The undo route mirrors this in reverse: mark step N active, then conditionally set step N+1 back to locked if it is currently active.

```typescript
// Revert step N to active
const { data: reverted, error: revertError } = await admin
  .from("roadmap_progress")
  .update({ status: "active", completed_at: null })
  .eq("student_id", studentId)
  .eq("step_number", step_number)
  .eq("status", "completed")  // guard against race: only revert if still completed
  .select()
  .single();

if (revertError || !reverted) {
  return NextResponse.json({ error: "Step not found or already reverted" }, { status: 400 });
}

// Cascade: re-lock step N+1 only if it is currently active
let relocked = null;
if (step_number < ROADMAP_STEPS.length) {
  const { data: nextStep } = await admin
    .from("roadmap_progress")
    .update({ status: "locked" })
    .eq("student_id", studentId)
    .eq("step_number", step_number + 1)
    .eq("status", "active")  // only lock if currently active, not if completed or locked
    .select()
    .single();

  relocked = nextStep ?? null;
}
```

The `.eq("status", "active")` guard on the N+1 update ensures a completed N+1 step is never accidentally re-locked — a hard safety constraint for sequential progression integrity.

### API Route: Audit Log INSERT

After successful revert, always INSERT into `roadmap_undo_log` using the admin client. This table is append-only (RLS has no UPDATE/DELETE policies).

```typescript
await admin.from("roadmap_undo_log").insert({
  actor_id: profile.id,
  actor_role: profile.role,  // "coach" | "owner"
  student_id: studentId,
  step_number: step_number,
  // undone_at defaults to now()
});
```

### API Route: Response Shape

Per D-03, the response must indicate whether a cascade occurred. Recommended shape:

```typescript
return NextResponse.json({
  data: {
    reverted,          // updated roadmap_progress row for step N
    relocked,          // updated roadmap_progress row for step N+1, or null
    cascade: relocked !== null,
  }
});
```

### API Route: Zod Schema

```typescript
const undoSchema = z.object({
  studentId: z.string().uuid(),
  step_number: z.number().int().min(1).max(ROADMAP_STEPS.length),
});
```

Both `studentId` and `step_number` are required in the body. The student ID cannot come from the URL (no dynamic route segment in the new file path) so it must be in the request body.

### UI Component: RoadmapTab Conversion

`RoadmapTab.tsx` is currently a pure display component (`"use client"` header is absent). Converting it to a stateful component:

1. Add `"use client"` directive
2. Add `studentId: string` to `RoadmapTabProps`
3. Import: `useState`, `useCallback`, `useRef`, `useEffect`, `useRouter` (for `.refresh()`), `useToast`
4. State: `confirmStep: number | null` — tracks which step the undo modal is open for
5. State: `undoing: boolean` — loading state during in-flight request
6. Follow the `useRef` stable dep pattern from `RoadmapClient.tsx` for `toastRef` and `routerRef`

**Cascade dialog text determination** — detect N+1 status from the `roadmap` prop already available in the component (no additional API call needed):

```typescript
// Inside the modal render, when confirmStep is not null:
const nextStepRow = confirmStep !== null
  ? roadmap.find(r => r.step_number === confirmStep + 1)
  : null;
const nextStepIsActive = nextStepRow?.status === "active";
const nextStepConfig = confirmStep !== null
  ? ROADMAP_STEPS.find(s => s.step === confirmStep + 1)
  : null;

const dialogDescription = nextStepIsActive && nextStepConfig
  ? `Are you sure you want to reset Step ${confirmStep} back to active? Step ${confirmStep + 1}: "${nextStepConfig.title}" (currently active) will also be re-locked.`
  : `Are you sure you want to reset Step ${confirmStep} back to active?`;
```

This satisfies D-01 and D-02 without an extra network round-trip.

### UI Component: Undo Button Placement

Add an undo button only on steps with `status === "completed"`. Inline next to or below the step title:

```typescript
{status === "completed" && (
  <button
    onClick={() => setConfirmStep(step.step)}
    className="inline-flex items-center gap-1 text-xs text-ima-text-secondary hover:text-ima-primary motion-safe:transition-colors min-h-[44px] min-w-[44px]"
    aria-label={`Undo Step ${step.step}: ${step.title}`}
  >
    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
    Undo
  </button>
)}
```

Icon: `RotateCcw` from lucide-react (already in the project's icon library). Size/color: Claude's discretion per CONTEXT.md.

### UI Component: handleUndo Callback Pattern

Follow the `handleComplete` pattern in `RoadmapClient.tsx` exactly:

```typescript
const handleUndo = useCallback(async () => {
  if (confirmStep === null) return;
  setUndoing(true);
  try {
    const res = await fetch("/api/roadmap/undo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, step_number: confirmStep }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toastRef.current({ type: "error", title: (err as { error?: string }).error ?? "Failed to undo step" });
    } else {
      const json = await res.json();
      const cascade = json?.data?.cascade === true;
      const stepTitle = ROADMAP_STEPS.find(s => s.step === confirmStep)?.title ?? `Step ${confirmStep}`;
      const nextTitle = ROADMAP_STEPS.find(s => s.step === confirmStep + 1)?.title;
      toastRef.current({
        type: "success",
        title: cascade && nextTitle
          ? `Step ${confirmStep} reset to active, Step ${confirmStep + 1} re-locked`
          : `Step ${confirmStep}: "${stepTitle}" reset to active`,
      });
      routerRef.current.refresh();
    }
  } catch {
    toastRef.current({ type: "error", title: "Failed to undo step" });
  } finally {
    setUndoing(false);
    setConfirmStep(null);
  }
}, [confirmStep, studentId]);
```

Note: `response.ok` is checked before `res.json()` — CLAUDE.md hard rule.

### Prop Thread: studentId to RoadmapTab

Both parent components already have `studentId` in scope and already pass it to `CalendarTab`. Only the `RoadmapTab` call site needs updating:

In `StudentDetailClient.tsx` (line 107):
```typescript
// Before:
{activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} joinedAt={student.joined_at} />}
// After:
{activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} joinedAt={student.joined_at} studentId={studentId} />}
```

In `OwnerStudentDetailClient.tsx` (line 226):
```typescript
// Before:
{activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} joinedAt={student.joined_at} />}
// After:
{activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} joinedAt={student.joined_at} studentId={studentId} />}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible modal with focus trap + ESC | Custom dialog | `Modal` from `src/components/ui/Modal.tsx` | Already has focus trap, portal, `aria-modal`, `aria-labelledby`, ESC close, backdrop click close |
| Toast notifications | Custom notification | `useToast` + `ToastProvider` | Already has `role="log"`, `role="alert"`, 5-second auto-dismiss, success/error variants |
| CVA button variants | Custom button | `Button` from `src/components/ui/Button.tsx` | Already has 44px min-h, loading spinner, `aria-busy`, all ima-* color tokens |
| CSRF protection | Origin header check | `verifyOrigin()` from `src/lib/csrf.ts` | Drop-in; must be first check in every mutation route |
| Rate limiting | Custom counter | `checkRateLimit()` from `src/lib/rate-limit.ts` | DB-backed, per-user per-endpoint, fail-open on transient errors |
| Admin DB client | Direct Supabase client | `createAdminClient()` from `src/lib/supabase/admin.ts` | Bypasses RLS safely for server-side mutations; CLAUDE.md rule: never in client components |

**Key insight:** Every primitive needed for this phase already exists. This phase is pure wiring — a new API route and UI mutation layer using established patterns.

---

## Common Pitfalls

### Pitfall 1: Missing `.eq("status", "completed")` Guard on Revert UPDATE

**What goes wrong:** If the UPDATE to revert step N doesn't filter by `status = 'completed'`, a race condition (two concurrent undo requests) silently succeeds twice. The step data is still valid but the audit log has two entries for the same action.

**Why it happens:** Supabase `.update()` without a status guard updates any matching row regardless of current state.

**How to avoid:** Add `.eq("status", "completed")` to the UPDATE for step N. If `data` is null (row not found or status didn't match), return 400 "Step not found or already reverted."

**Warning signs:** Two `roadmap_undo_log` entries for the same `(student_id, step_number)` within seconds of each other.

### Pitfall 2: Re-locking a Completed Step N+1

**What goes wrong:** If step N+1 is already completed (student completed both steps N and N+1 before the undo), the cascade re-lock must NOT revert step N+1 — that would destroy legitimate student progress.

**Why it happens:** A naive cascade that always re-locks N+1 regardless of status.

**How to avoid:** Add `.eq("status", "active")` to the N+1 UPDATE. This ensures only an active (but not yet completed) N+1 step is re-locked. A completed N+1 step is untouched.

**Warning signs:** A student's completed step N+2, N+3 are still shown as completed but step N+1 was reverted — visible inconsistency in sequential progression.

### Pitfall 3: Missing `"use client"` Directive on RoadmapTab

**What goes wrong:** Adding `useState`/`useCallback`/`useRouter` to `RoadmapTab.tsx` without the `"use client"` directive causes a Next.js runtime error: "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with 'use client'."

**Why it happens:** `RoadmapTab.tsx` is currently a pure display component without the directive. It renders correctly as a Server Component today.

**How to avoid:** Add `"use client"` as the very first line of `RoadmapTab.tsx` before any imports.

### Pitfall 4: Swallowing fetch() Errors

**What goes wrong:** Not calling `res.ok` check before `res.json()` — if the server returns a non-JSON error body, `res.json()` throws, the catch block fires but with a less useful message.

**Why it happens:** Forgetting CLAUDE.md hard rule #6.

**How to avoid:** Always check `if (!res.ok)` before parsing. Use `.catch(() => ({}))` on the `res.json()` call inside the error branch to gracefully handle non-JSON error bodies.

### Pitfall 5: Not Using Refs for toast/router in useCallback

**What goes wrong:** Passing `toast` and `router` directly as `useCallback` dependencies causes the callback to be recreated on every render. If `handleUndo` is passed as a prop, this can trigger downstream re-renders or stale closures.

**Why it happens:** React's `useCallback` dependencies must be stable.

**How to avoid:** Use the `useRef` pattern established in `RoadmapClient.tsx` and `OwnerStudentDetailClient.tsx`:
```typescript
const toastRef = useRef(toast);
useEffect(() => { toastRef.current = toast; }, [toast]);
const routerRef = useRef(useRouter());
```
Reference `toastRef.current` and `routerRef.current` inside the callback.

### Pitfall 6: Admin Client in Client Component

**What goes wrong:** Accidentally importing `createAdminClient` in `RoadmapTab.tsx` — the component file is client-side after adding `"use client"`.

**Why it happens:** Copy-paste from server-side code.

**How to avoid:** The admin client is only used in `src/app/api/roadmap/undo/route.ts` (server only). The client component only calls `fetch()`. CLAUDE.md hard rule #2: "Admin client only in server code."

### Pitfall 7: Wrong Zod Import

**What goes wrong:** Using `import { z } from "zod/v4"` in the new route.

**Why it happens:** IDE auto-import sometimes resolves to the v4 subpath.

**How to avoid:** CLAUDE.md hard rule #7: Always `import { z } from "zod"`.

---

## Code Examples

### Full API Route Structure (verified from existing routes)

```typescript
// src/app/api/roadmap/undo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/csrf";

const undoSchema = z.object({
  studentId: z.string().uuid(),
  step_number: z.number().int().min(1).max(ROADMAP_STEPS.length),
});

export async function PATCH(request: NextRequest) {
  try {
    // 1. CSRF
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 2. Auth
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 3. Profile + role
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (!profile || (profile.role !== "coach" && profile.role !== "owner")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 4. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/roadmap/undo");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 5. Body
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    // 6. Zod
    const parsed = undoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 });
    }
    const { studentId, step_number } = parsed.data;

    // 7. Coach ownership check
    const { data: student, error: studentError } = await admin
      .from("users")
      .select("id, coach_id")
      .eq("id", studentId)
      .eq("role", "student")
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (profile.role === "coach" && student.coach_id !== profile.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 8. Revert step N (guard: only if currently completed)
    const { data: reverted, error: revertError } = await admin
      .from("roadmap_progress")
      .update({ status: "active", completed_at: null })
      .eq("student_id", studentId)
      .eq("step_number", step_number)
      .eq("status", "completed")
      .select()
      .single();

    if (revertError || !reverted) {
      return NextResponse.json({ error: "Step not found or already reverted" }, { status: 400 });
    }

    // 9. Cascade: re-lock N+1 only if currently active
    let relocked = null;
    if (step_number < ROADMAP_STEPS.length) {
      const { data: nextStep } = await admin
        .from("roadmap_progress")
        .update({ status: "locked" })
        .eq("student_id", studentId)
        .eq("step_number", step_number + 1)
        .eq("status", "active")
        .select()
        .single();
      relocked = nextStep ?? null;
    }

    // 10. Audit log
    await admin.from("roadmap_undo_log").insert({
      actor_id: profile.id,
      actor_role: profile.role,
      student_id: studentId,
      step_number,
    });

    return NextResponse.json({ data: { reverted, relocked, cascade: relocked !== null } });
  } catch (error) {
    console.error("PATCH /api/roadmap/undo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Modal Confirmation Pattern (from `RoadmapClient.tsx`, HIGH confidence)

```typescript
// Confirmation modal — paste pattern from RoadmapClient.tsx
<Modal
  open={confirmStep !== null}
  onClose={() => { if (!undoing) setConfirmStep(null); }}
  title="Undo Step?"
  description={dialogDescription}  // computed from cascade detection above
>
  <div className="flex gap-3 mt-4">
    <Button
      variant="danger"
      loading={undoing}
      onClick={handleUndo}
    >
      Reset to Active
    </Button>
    <Button variant="ghost" onClick={() => setConfirmStep(null)} disabled={undoing}>
      Cancel
    </Button>
  </div>
</Modal>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Two separate requests (revert + re-lock) | Single PATCH request handles both in sequence | Prevents two-step race; matches existing forward-unlock pattern |
| Client-side state polling for N+1 status | Read from existing `roadmap` prop array | No extra network call; roadmap array is always up to date on render |

---

## Open Questions

1. **Should the modal close on error, or stay open?**
   - What we know: D-06 says "Modal closes on error."
   - What's unclear: Is that the best UX if the user might retry?
   - Recommendation: Follow D-06 exactly — close modal on error, show toast. User can click the undo button again.

2. **What if both N and N+1 are completed — should undo be blocked?**
   - What we know: UNDO-04 only mandates cascade re-lock when N+1 is "currently active." If N+1 is completed, no cascade occurs.
   - What's unclear: Should undoing step N still be allowed when N+1 is completed?
   - Recommendation: Allow it (only revert N, leave N+1 completed). The `.eq("status", "active")` guard on the N+1 UPDATE handles this naturally. This matches sequential progression semantics: a coach may want to reset an early step without disturbing later progress.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes to an existing Next.js project. No new external tools, CLIs, databases, or services are required. The Supabase instance and `roadmap_undo_log` table were created in Phase 26.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in `src/` — no jest.config, vitest.config, or test files in project src |
| Config file | None — Wave 0 gap |
| Quick run command | `npx tsc --noEmit` (type check as proxy for unit validation) |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNDO-01 | Coach reverts step for assigned student, returns 200 | manual smoke | `npm run build` (type safety) | N/A — no test framework |
| UNDO-02 | Owner reverts step for any student, returns 200 | manual smoke | `npm run build` | N/A |
| UNDO-03 | Modal opens with correct text; confirm fires PATCH | manual smoke | `npm run lint` | N/A |
| UNDO-04 | N+1 active step is re-locked in same request | manual smoke | `npm run build` | N/A |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual UAT before `/gsd:verify-work`

### Wave 0 Gaps

- No unit test framework exists in the project. All validation is build-time (TypeScript) + lint + manual UAT.
- This is consistent with all previous phases — no gaps to fill before implementation begins.

---

## Project Constraints (from CLAUDE.md)

All directives the planner must verify compliance against:

| Constraint | Applies To |
|------------|-----------|
| `"use client"` required when using React hooks | `RoadmapTab.tsx` after conversion |
| Admin client only in server code | Route handler only; never in RoadmapTab |
| Proxy not middleware | No new middleware — not applicable |
| Google OAuth only | No auth changes — not applicable |
| `motion-safe:` on every `animate-*` class | Any new animations in RoadmapTab |
| 44px touch targets (`min-h-[44px]`, `h-11`) | Undo button must have `min-h-[44px]` |
| Accessible labels on every interactive element | Undo button needs `aria-label` |
| Admin client in route handlers for every `.from()` query | Undo route uses `createAdminClient()` for all queries |
| Never swallow errors — every `catch` must toast or `console.error` | Both route and component catch blocks |
| Check `response.ok` before parsing JSON | `handleUndo` fetch call |
| `import { z } from "zod"` — never `"zod/v4"` | Undo route Zod import |
| `ima-*` tokens only — no hardcoded hex/gray | Undo button styling |
| `px-4` on page wrappers | Not applicable (component, not page) |
| Stable `useCallback` deps via refs | `toastRef`, `routerRef` in RoadmapTab |
| Zod `safeParse` on all API inputs | `undoSchema.safeParse(body)` in route |
| Auth + role check before validation | Order: CSRF → auth → role → rate-limit → Zod |
| Filter by user ID in queries — never rely on RLS alone | `studentId` filter on all roadmap_progress queries |

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `src/components/coach/RoadmapTab.tsx` — current component structure, props interface
- Direct file read: `src/app/api/roadmap/route.ts` — existing PATCH endpoint, forward-unlock pattern
- Direct file read: `src/app/api/calendar/route.ts` — coach assignment check pattern (`student.coach_id !== profile.id`)
- Direct file read: `src/components/student/RoadmapClient.tsx` — Modal confirmation pattern, stable ref pattern
- Direct file read: `src/components/ui/Modal.tsx` — Modal props interface, focus trap, portal
- Direct file read: `src/components/ui/Button.tsx` — button variants, sizes, loading prop
- Direct file read: `src/components/ui/Toast.tsx` — useToast hook, toast call signature
- Direct file read: `src/components/coach/StudentDetailClient.tsx` — studentId prop already in scope
- Direct file read: `src/components/owner/OwnerStudentDetailClient.tsx` — studentId prop already in scope
- Direct file read: `supabase/migrations/00013_daily_plans_undo_log.sql` — roadmap_undo_log schema, RLS policies
- Direct file read: `src/lib/config.ts` — ROADMAP_STEPS length (15), step structure

### Secondary (MEDIUM confidence)

- Direct file read: `src/lib/csrf.ts` — verifyOrigin signature
- Direct file read: `src/lib/rate-limit.ts` — checkRateLimit signature
- Direct file read: `.planning/STATE.md` — zero new npm dependencies decision

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by direct dependency inspection; zero new packages needed
- Architecture: HIGH — all patterns read directly from existing production code
- Pitfalls: HIGH — identified from code inspection of existing patterns and failure modes
- Cascade re-lock logic: HIGH — mirrors forward-unlock pattern in existing route exactly

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable — no external dependencies; all sources are local code)
