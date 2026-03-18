# Phase 4: Student Roadmap - Research

**Researched:** 2026-03-16
**Domain:** Next.js App Router server/client split, Supabase roadmap_progress table, sequential unlock logic, dashboard card integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Step visual layout**
- Vertical timeline with circle indicators and connecting line between steps (same pattern as reference-old)
- Completed step: green circle with checkmark, green connecting line
- Active step: blue circle with step number, pulsing ring, blue primary styling
- Locked step: gray circle with lock icon, muted text, gray connecting line
- All steps show title AND description (locked steps show muted description text for anticipation)
- Completed steps show completion date in a "Completed" badge (e.g., "Completed Mar 10")

**Progress summary card**
- Summary card at top of roadmap page showing "X of 10 steps completed" with percentage and progress bar
- Same pattern as reference-old progress overview card
- All-complete state: celebration card with congratulations message

**Dashboard roadmap card**
- Replace placeholder card with live data: current active step name, X/10 progress count, mini progress bar with percentage
- Adaptive CTA matching the Work Progress card pattern:
  - Active step exists: "Continue Step N" (links to /student/roadmap)
  - All 10 complete: "Roadmap Complete!" with celebration styling (green accent)
- Dashboard card fetches roadmap_progress data server-side

**Mark complete flow**
- Claude's discretion on confirmation UX (reference-old uses modal — can keep or simplify)

**Step 1 auto-complete**
- Claude's discretion on timing (auth callback vs lazy page-load seeding — reference-old does lazy seeding)

### Claude's Discretion
- Confirmation modal vs inline confirm vs direct action with toast for "Mark Complete"
- Step 1 auto-complete timing (signup callback vs first roadmap page visit)
- Timeline animation details (staggered entrance, slide-up)
- Loading skeleton design for roadmap page
- Toast messages for step completion
- All-complete celebration card design on roadmap page (reference-old has one)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROAD-01 | Student sees 10-step roadmap with locked/active/completed states | roadmap_progress table stores per-row status; ROADMAP_STEPS config drives step list; RoadmapStep component renders all three states |
| ROAD-02 | Student can mark active step as completed (unlocks next) | PATCH /api/roadmap validates active status, updates to completed, sets next step to active — all via admin client |
| ROAD-03 | Step 1 auto-completes on signup | Lazy seeding on first roadmap page visit: if progress.length < 10, insert all 10 rows with Step 1 = completed, Step 2 = active, rest = locked |
</phase_requirements>

---

## Summary

Phase 4 is a port-and-adapt job. The reference-old codebase contains a complete, working implementation of every requirement. The primary work is adaptation to V1 patterns: replacing non-existent tokens (`ima-border-warm`, `ima-brand-gold`, `ima-surface-warm`) with V1 equivalents, wiring the dashboard card with live data, and following established Phase 3 patterns for server/client split and mutation handling.

The database schema is already in place (`roadmap_progress` table with RLS, typed in `src/lib/types.ts`), config is already in place (`ROADMAP_STEPS` with 10 steps and `autoComplete` flag), and the route is already registered in navigation (`/student/roadmap`). No schema work is needed.

The key decisions for "Claude's discretion" areas: use the confirmation modal (reference-old already has it, it is correct UX for an irreversible action), use lazy page-load seeding (simpler, no auth callback dependency, reference-old proves it works), and use `router.refresh()` after PATCH (consistent with Phase 3 pattern).

**Primary recommendation:** Adapt reference-old components directly with minimal changes — the logic is correct; only token substitutions and V1 import path adjustments are needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 (project) | Server components for reads, route handlers for mutations | Established in all prior phases |
| Supabase admin client | Project version | All DB queries in server/API code | RLS bypass required for reliable reads |
| React 19 | Project version | Client interactivity (mark complete button, modal state) | Project standard |
| Zod | Project version | API input validation | Hard rule: `import { z } from "zod"` |
| lucide-react | Project version | Check, Lock, Map, PartyPopper icons | Used in reference-old roadmap components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | Project version | Step circle/indicator variants | Already used in reference-old RoadmapStep |
| cn (src/lib/utils) | - | Conditional class merging | All conditional styling in components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lazy seeding on page load | Auth callback seeding | Callback approach is tighter but adds coupling to auth flow; lazy is simpler and already proven |
| Confirmation modal | Inline confirm / direct action | Modal matches reference-old, correct for irreversible actions |

**Installation:** No new packages required. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/student/roadmap/
│   └── page.tsx                 # Server component: fetch progress, seed if needed, render
├── app/api/roadmap/
│   └── route.ts                 # PATCH handler: auth, role, Zod, mark complete, unlock next
├── components/student/
│   ├── RoadmapClient.tsx        # "use client": step list + confirmation modal + PATCH fetch
│   └── RoadmapStep.tsx          # "use client": single step with circle, line, status styling
```

The dashboard integration modifies an existing file:
```
src/app/(dashboard)/student/page.tsx  # Add roadmap_progress query, replace placeholder card
```

### Pattern 1: Server Component with Lazy Seeding
**What:** The roadmap page server component fetches progress rows; if fewer than 10 rows exist (new student), it seeds all 10 rows atomically before rendering. Step 1 gets `status: "completed"` and `completed_at: now()`, Step 2 gets `status: "active"`, all others get `status: "locked"`.
**When to use:** Any time a student visits `/student/roadmap` for the first time.
**Example:**
```typescript
// Source: reference-old/src/app/(dashboard)/student/roadmap/page.tsx (adapted)
// V1 change: use requireRole() from @/lib/session (not getSessionUser("student"))
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";

export default async function RoadmapPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const { data: progressData, error } = await admin
    .from("roadmap_progress")
    .select("*")
    .eq("student_id", user.id)
    .order("step_number", { ascending: true });

  if (error) console.error("[roadmap] Failed to fetch progress:", error);

  let progress = progressData ?? [];

  if (!error && progress.length < ROADMAP_STEPS.length) {
    // Delete partial rows, then seed all 10
    if (progress.length > 0) {
      await admin.from("roadmap_progress").delete().eq("student_id", user.id);
    }
    const now = new Date().toISOString();
    const rows = ROADMAP_STEPS.map((step) => ({
      student_id: user.id,
      step_number: step.step,
      step_name: step.title,
      status: step.step === 1 ? "completed" as const
             : step.step === 2 ? "active" as const
             : "locked" as const,
      completed_at: step.step === 1 ? now : null,
    }));
    await admin.from("roadmap_progress").insert(rows);
    const { data: fresh } = await admin
      .from("roadmap_progress").select("*")
      .eq("student_id", user.id).order("step_number", { ascending: true });
    progress = fresh ?? [];
  }
  // ... render
}
```

### Pattern 2: PATCH Route with Sequential Unlock
**What:** The API route validates that the target step is `active`, marks it `completed`, then sets `step_number + 1` to `active`.
**When to use:** Client calls `PATCH /api/roadmap` with `{ step_number: N }`.
**Example:**
```typescript
// Source: reference-old/src/app/api/roadmap/route.ts (V1-ready, no changes needed)
const patchSchema = z.object({
  step_number: z.number().int().min(1).max(ROADMAP_STEPS.length),
});

// Auth order: getUser() → admin profile lookup → role check → try/catch JSON → safeParse → query
if (step.status !== "active") {
  return NextResponse.json({ error: "Can only complete active steps" }, { status: 400 });
}
// Mark completed, then unlock next step if not last
if (step_number < ROADMAP_STEPS.length) {
  await admin.from("roadmap_progress")
    .update({ status: "active" })
    .eq("student_id", profile.id)
    .eq("step_number", step_number + 1);
}
```

### Pattern 3: Client Island with Modal Confirmation
**What:** `RoadmapClient` is a `"use client"` component that holds `confirmStep` state, renders the step list, and shows a confirmation modal before calling the API. Uses `router.refresh()` after successful PATCH to re-fetch server data.
**When to use:** Any client interaction that needs confirmation before irreversible mutation.
**Example:**
```typescript
// Source: reference-old/src/components/student/RoadmapClient.tsx (V1-ready)
const routerRef = useRef(useRouter());   // stable ref — Phase 3 established pattern
const toastRef = useRef(toast);          // stable ref for closures

const handleComplete = useCallback(async () => {
  const res = await fetch("/api/roadmap", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step_number: confirmStep }),
  });
  if (!res.ok) { /* toast error */ return; }
  /* toast success */
  routerRef.current.refresh();
}, [confirmStep]);
```

### Pattern 4: Dashboard Card with Live Roadmap Data
**What:** The existing placeholder Roadmap card in `student/page.tsx` fetches `roadmap_progress` rows server-side alongside `work_sessions`. Derives `activeStep`, `completedCount`, and renders a card matching the Work Progress card visual pattern.
**When to use:** Server component page that already queries other data.
**Example:**
```typescript
// Alongside the existing work_sessions query in student/page.tsx:
const { data: roadmapRows } = await admin
  .from("roadmap_progress")
  .select("step_number, status")
  .eq("student_id", user.id)
  .order("step_number", { ascending: true });

const completedCount = (roadmapRows ?? []).filter(r => r.status === "completed").length;
const activeStep = (roadmapRows ?? []).find(r => r.status === "active");
const allRoadmapComplete = completedCount === ROADMAP_STEPS.length;
// CTA: activeStep ? `Continue Step ${activeStep.step_number}` : "Roadmap Complete!"
```

### Anti-Patterns to Avoid
- **Using `createClient()` (non-admin) in API routes:** All `.from()` queries in route handlers must use `createAdminClient()`. The non-admin client in route handlers fails under some RLS conditions.
- **Importing `createAdminClient` in client components:** Admin client is server-only — the guard will throw at build time.
- **Using reference-old token names in V1:** `ima-border-warm`, `ima-brand-gold`, `ima-surface-warm` do NOT exist in V1's tailwind.config.ts. Substitute with V1 tokens (see Token Substitution table below).
- **Using `getSessionUser("student")` (reference-old signature):** V1's `session.ts` exports `requireRole("student")` — the function signature is different.
- **Animate without `motion-safe:`:** Every `animate-*` class must be `motion-safe:animate-*` per hard rules.
- **Locked step with enabled button:** Locked steps must have no "Mark Complete" button — only a locked badge.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step status type safety | Custom status enum | `Database["public"]["Tables"]["roadmap_progress"]["Row"]` from `src/lib/types.ts` | Already typed correctly: `"locked" \| "active" \| "completed"` |
| Sequential unlock logic | Complex step graph | Simple `step_number + 1` update | Steps are strictly sequential 1-10; no branching |
| Confirmation dialog | Custom confirm overlay | Modal from `reference-old/src/components/ui/Modal.tsx` | Full a11y: focus trap, Escape key, inert attribute, portal |
| Progress percent | Manual math | `Math.round((completedCount / ROADMAP_STEPS.length) * 100)` | Simple division, already in reference-old |
| Completion date formatting | Custom date formatter | `new Date(completed_at).toLocaleDateString()` | Locale-aware, sufficient for "Mar 10" display |
| Toast notifications | Custom toast | `useToast()` from reference-old `Toast.tsx` (needs port to V1) | Already exists in reference-old with type/title API |

**Key insight:** The reference-old codebase already solved all the hard parts of this phase. The implementation risk is near zero — this is an adaptation task, not a design task.

---

## Common Pitfalls

### Pitfall 1: V1 Token Gap — ima-brand-gold, ima-border-warm, ima-surface-warm
**What goes wrong:** Copying reference-old roadmap page code directly will reference three tokens that don't exist in V1's tailwind.config.ts. Build will succeed (Tailwind silently ignores unknown tokens) but colors will be missing.
**Why it happens:** reference-old has a richer token set including brand, warm, and tier tokens that were explicitly cut from V1.
**How to avoid:** Use this substitution table:

| Reference-old token | V1 substitute | Notes |
|--------------------|---------------|-------|
| `text-ima-brand-gold` | `text-ima-warning` | Both are amber/gold — `#F59E0B` in V1 |
| `bg-ima-border-warm` (progress bar track) | `bg-ima-border` | Slightly cooler but acceptable in V1 |
| `bg-ima-surface-warm` | `bg-ima-surface-light` | Light surface variant |
| `border-ima-border-warm` | `border-ima-border` | Standard border |
| `from-ima-success to-ima-brand-gold` gradient | `bg-ima-success` (flat) or `from-ima-success to-ima-primary` | V1 has no gold gradient; use flat green or blue-green gradient |

**Warning signs:** `text-ima-brand-gold` appears in the progress card percentage display (line 106 of reference-old roadmap page).

### Pitfall 2: requireRole vs getSessionUser Import
**What goes wrong:** reference-old uses `getSessionUser("student")` which accepts a role string argument. V1's `session.ts` exports `requireRole("student")` with a different signature — `getSessionUser()` takes no arguments and does not enforce role.
**Why it happens:** V1 refactored session helpers to separate concerns.
**How to avoid:** Use `requireRole("student")` in the roadmap page, consistent with `student/page.tsx`.

### Pitfall 3: RoadmapProgress Type — Use Database Row Type, Not Custom Interface
**What goes wrong:** reference-old defines a custom `RoadmapProgress` interface in `src/lib/types.ts` which is separate from the Database type. In V1, `src/lib/types.ts` is the auto-generated Database type — there is NO standalone `RoadmapProgress` type exported.
**Why it happens:** V1 consolidates all types into the single `Database` export.
**How to avoid:** In RoadmapClient.tsx and RoadmapStep.tsx, use:
```typescript
import type { Database } from "@/lib/types";
type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];
```

### Pitfall 4: useRef(useRouter()) Pattern
**What goes wrong:** Using `const router = useRouter()` directly in a `useCallback` causes stale closure warnings or incorrect deps arrays.
**Why it happens:** router reference can change between renders.
**How to avoid:** Phase 3 established the correct pattern:
```typescript
const routerRef = useRef(useRouter());
// use routerRef.current.refresh() inside callbacks
```
Reference-old RoadmapClient.tsx already uses `const router = useRouter()` (not ref) — adapt to V1 pattern using the ref approach consistent with WorkTrackerClient.

### Pitfall 5: Toast Dependency — Modal and Toast Not Yet in V1
**What goes wrong:** RoadmapClient references `Modal` and `useToast` from `@/components/ui` — but V1 has no `src/components/ui/` directory yet.
**Why it happens:** UI primitives haven't been ported to V1 yet (Work Tracker Phase 3 didn't need them).
**How to avoid:** Plan 04-01 or 04-02 must either: (a) create `src/components/ui/Modal.tsx` and `src/components/ui/Toast.tsx` ported from reference-old, or (b) inline the modal as a simple confirmation section within RoadmapClient without a separate Modal component. The planner should address this as a prerequisite task.

### Pitfall 6: Dashboard Query Adds a Second Admin Call
**What goes wrong:** Adding a roadmap_progress query to student/page.tsx means two admin DB calls in one server render. If not ordered correctly, it can serialize (slow).
**Why it happens:** Sequential awaits.
**How to avoid:** Run both queries in parallel:
```typescript
const [{ data: sessions }, { data: roadmapRows }] = await Promise.all([
  admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today),
  admin.from("roadmap_progress").select("step_number, status").eq("student_id", user.id),
]);
```

---

## Code Examples

### Correct V1 RoadmapProgress type derivation
```typescript
// Source: src/lib/types.ts (V1 Database type)
import type { Database } from "@/lib/types";
type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];
// Fields: id, student_id, step_number, step_name, status, completed_at, created_at, updated_at
```

### V1 Token Substitutions for Progress Card
```typescript
// Reference-old (DO NOT USE — tokens missing in V1):
// <span className="text-sm font-bold text-ima-brand-gold">{percent}%</span>
// <div className="h-3 bg-ima-border-warm rounded-full overflow-hidden" ...>
// <div className="h-full bg-gradient-to-r from-ima-success to-ima-brand-gold ...">

// V1 (CORRECT):
// <span className="text-sm font-bold text-ima-warning">{percent}%</span>
// <div className="h-3 bg-ima-border rounded-full overflow-hidden" role="progressbar" ...>
// <div className="h-full bg-ima-success rounded-full motion-safe:transition-all duration-500" style={{ width: `${percent}%` }}>
```

### Step circle with all three states (V1 tokens only)
```typescript
// Source: reference-old/src/components/student/RoadmapStep.tsx (all tokens valid in V1)
<div className={cn(
  "flex items-center justify-center w-11 h-11 rounded-full shrink-0 motion-safe:transition-all",
  status === "completed" && "bg-ima-success text-white shadow-sm",
  status === "active" && "bg-ima-primary text-white ring-4 ring-ima-primary/20 motion-safe:animate-pulse shadow-md",
  status === "locked" && "border-2 border-ima-border text-ima-text-muted bg-ima-surface-light"
)}>
  {status === "completed" && <Check className="h-5 w-5" aria-hidden="true" />}
  {status === "active" && <span className="text-sm font-bold">{step.step_number}</span>}
  {status === "locked" && <Lock className="h-4 w-4" aria-hidden="true" />}
</div>
```
Note: reference-old uses `bg-ima-surface` for locked circles; V1 can use `bg-ima-surface-light` for subtle differentiation since `ima-surface-light` exists in V1.

### PATCH route auth pattern (established, V1-ready)
```typescript
// Source: reference-old/src/app/api/roadmap/route.ts — no changes needed
// Pattern: supabase.auth.getUser() → admin profile lookup → role check → try JSON → safeParse → query
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();
if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const admin = createAdminClient();
const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", authUser.id).single();
if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
if (profile.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Parallel dashboard queries
```typescript
// In src/app/(dashboard)/student/page.tsx
const today = getToday();
const [{ data: sessions, error: sessionsError }, { data: roadmapRows }] = await Promise.all([
  admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today).order("cycle_number", { ascending: true }),
  admin.from("roadmap_progress").select("step_number, status").eq("student_id", user.id).order("step_number", { ascending: true }),
]);
```

### Adaptive dashboard CTA for roadmap card
```typescript
const roadmapCompleted = (roadmapRows ?? []).filter(r => r.status === "completed").length;
const activeRoadmapStep = (roadmapRows ?? []).find(r => r.status === "active");
const allRoadmapDone = roadmapCompleted === ROADMAP_STEPS.length && roadmapRows != null;

// CTA label:
const roadmapCTA = allRoadmapDone
  ? "Roadmap Complete!"
  : activeRoadmapStep
    ? `Continue Step ${activeRoadmapStep.step_number}`
    : "View Roadmap";  // fallback for unseeded state
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Seed roadmap at auth callback | Lazy seed on first roadmap page visit | V1 design decision | No dependency on auth callback; page handles its own data initialization |
| Middleware.ts route guard | proxy.ts route guard | Next.js 16 migration | proxy.ts is the only valid route guard in this stack |
| Separate RoadmapProgress type export | `Database["public"]["Tables"]["roadmap_progress"]["Row"]` | V1 types consolidation | Single source of truth for all table row types |

**Deprecated/outdated:**
- `getSessionUser("student")`: reference-old signature — use `requireRole("student")` in V1
- `ima-border-warm`, `ima-brand-gold`, `ima-surface-warm`: reference-old tokens — not in V1 tailwind.config.ts
- `import type { RoadmapProgress } from "@/lib/types"` as a named export: not available in V1 — derive from Database type

---

## Open Questions

1. **Toast/Modal UI primitives**
   - What we know: reference-old has `Modal.tsx`, `Toast.tsx`, `Button.tsx`, `Badge.tsx` in `src/components/ui/`; V1 has no `src/components/ui/` directory
   - What's unclear: should Phase 4 port the full UI kit, or just the components needed (Modal, Toast, Button, Badge)?
   - Recommendation: Port only the 4 components needed for Phase 4 (Modal, Toast/useToast, Button, Badge) as part of plan 04-02. These are all reference-old components that only use V1-valid tokens.

2. **Dashboard card: handle zero roadmap rows gracefully**
   - What we know: if student has never visited `/student/roadmap`, `roadmap_rows` will be empty — no seeding happens on dashboard
   - What's unclear: should the dashboard card show a different state when not yet seeded?
   - Recommendation: When `roadmapRows` is null/empty, show "Start Roadmap" CTA linking to `/student/roadmap`. The seeding happens on first roadmap page visit — that's correct behavior.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test directories in src/ |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROAD-01 | Student sees 10-step roadmap with locked/active/completed states | manual-only | — visual state rendering requires browser | N/A |
| ROAD-02 | Student can mark active step complete; next step unlocks | manual-only | — requires Supabase + browser interaction | N/A |
| ROAD-03 | Step 1 auto-completes on signup (lazy seeding) | manual-only | — requires new student account creation | N/A |

**Manual-only justification:** All three ROAD requirements involve UI state rendering, Supabase DB mutations, and auth session context — they cannot be meaningfully tested without a running Supabase instance and browser. No unit-testable pure logic is isolated in this phase. The planner should schedule manual UAT steps in the verification phase.

### Sampling Rate
- **Per task commit:** `npm run build && npx tsc --noEmit` (type safety, no test runner)
- **Per wave merge:** `npm run build && npx tsc --noEmit && npm run lint`
- **Phase gate:** Full build green + manual UAT before `/gsd:verify-work`

### Wave 0 Gaps
- No test infrastructure gaps to create — all ROAD requirements are manual-only
- Build verification commands are sufficient: `npm run build`, `npx tsc --noEmit`, `npm run lint`

---

## Sources

### Primary (HIGH confidence)
- `reference-old/src/app/api/roadmap/route.ts` — complete PATCH implementation, V1-ready
- `reference-old/src/components/student/RoadmapClient.tsx` — complete client island with modal
- `reference-old/src/components/student/RoadmapStep.tsx` — step component with all three visual states
- `reference-old/src/app/(dashboard)/student/roadmap/page.tsx` — server component with lazy seeding
- `src/lib/config.ts` — ROADMAP_STEPS (10 steps, autoComplete flag), ROUTES.student.roadmap
- `src/lib/types.ts` — Database type with roadmap_progress Row/Insert/Update
- `supabase/migrations/00001_create_tables.sql` — roadmap_progress schema, RLS policies
- `tailwind.config.ts` — V1 ima-* token inventory (17 tokens only)
- `src/lib/session.ts` — requireRole() signature
- `src/app/(dashboard)/student/page.tsx` — existing dashboard with placeholder card

### Secondary (MEDIUM confidence)
- `reference-old/src/components/ui/Modal.tsx` — a11y modal, reference for port
- `reference-old/src/components/ui/Badge.tsx` — CVA badge variants
- `reference-old/src/components/ui/Card.tsx` — card variants (includes warm/accent not in V1)
- `src/components/student/WorkTrackerClient.tsx` — Phase 3 established patterns (routerRef, error handling)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies are the project stack; no new packages
- Architecture: HIGH — reference-old provides complete working implementation; patterns verified against V1 codebase
- Pitfalls: HIGH — token gap verified by direct inspection of tailwind.config.ts vs reference-old template; type gap verified by inspection of V1 types.ts

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain — Next.js App Router + Supabase patterns)
