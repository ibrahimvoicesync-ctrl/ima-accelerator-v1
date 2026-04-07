# Phase 41: Student Deals Pages - Research

**Researched:** 2026-04-07
**Domain:** Next.js App Router CRUD page with useOptimistic list mutations
**Confidence:** HIGH

## Summary

Phase 41 adds /student/deals and /student_diy/deals pages where students can add, view, edit, and delete their deals. All APIs are already built (Phase 39). All routes, nav, types, and validation constants are already configured (Phase 40). This phase is purely UI: two thin server component pages + one shared DealsClient component + a deal form modal.

The implementation pattern is completely established in the codebase. Every decision in CONTEXT.md maps directly to an existing codebase artifact. The only genuine design work is the list row layout and deciding delete confirmation UX (left to Claude's discretion).

**Primary recommendation:** Copy the ReportFormWrapper useOptimistic + startTransition + router.refresh() pattern, adapt it for list operations (add/edit/delete on a Deal array), and wire everything through the existing Modal, EmptyState, Button, Input, and Toast components.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Table-style rows (reuse existing table/list patterns from the codebase), not cards. Each row shows deal number, revenue, profit, and date.
- **D-02:** Sorted most-recent first (by created_at DESC), matching the API's default sort order.
- **D-03:** Modal form for both adding and editing deals. Reuse the existing Modal component (sm or md size).
- **D-04:** Single modal component handles both create and edit modes — pass a `deal` prop (null for create, populated for edit).
- **D-05:** useOptimistic operates on the full deals array (not a single item). Add inserts at the top, edit replaces in-place, delete removes from array.
- **D-06:** Follow the existing pattern: `useOptimistic` + `startTransition` + `router.refresh()` (as in ReportFormWrapper), adapted for list operations.
- **D-07:** Optimistic add uses a temporary negative ID and placeholder deal_number until the server response confirms the real values.
- **D-08:** EmptyState component (default variant — centered layout) with DollarSign icon and "Add your first deal" CTA button that opens the add modal.
- **D-09:** DealsClient is a single "use client" component shared between /student/deals/page.tsx and /student_diy/deals/page.tsx. Each page.tsx is a thin server component that fetches deals and passes them as props.

### Claude's Discretion

- Number formatting for revenue/profit (currency display with 2 decimal places)
- Loading skeleton design while deals are being fetched
- Delete confirmation approach (inline confirm button vs modal confirmation)
- Whether to show profit margin percentage inline or omit it (Phase 43 shows it in coach/owner view)
- Exact responsive breakpoint behavior for the table on mobile

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEAL-03 | Student and student_diy users can view their own deal history list, add new deals, edit existing deals, and delete deals — all with immediate optimistic UI feedback | Covered by useOptimistic list pattern (D-05/D-06), POST /api/deals, PATCH+DELETE /api/deals/[id] |
| DEAL-07 | The DealsClient component is shared between /student/deals and /student_diy/deals and supports both roles with the same UI | Covered by D-09 pattern; requireRole() accepts array of roles in server pages |
</phase_requirements>

---

## Standard Stack

### Core (all already in project)
| Component | Source | Purpose | Notes |
|-----------|--------|---------|-------|
| `useOptimistic` | React 19 (already in use) | Instant list mutations before API response | Used in ReportFormWrapper |
| `startTransition` | React 19 | Wraps optimistic updates | Must wrap `addOptimistic` call |
| `useRouter` + `router.refresh()` | Next.js App Router | Re-fetches server component data after mutation | Standard pattern |
| `Modal` | `src/components/ui/Modal.tsx` | Add/edit form container | sm or md size; portal-rendered, focus-trapped |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Zero-state display | default variant (centered) |
| `Button` | `src/components/ui/Button.tsx` | CTA, edit, delete actions | Enforces 44px via h-11 |
| `Input` | `src/components/ui/Input.tsx` | Revenue/profit form fields | Built-in label + aria support |
| `useToast` | `src/components/ui/Toast.tsx` | Success/error feedback | `{ toast } = useToast()` pattern |
| `Skeleton` | `src/components/ui/Skeleton.tsx` | Loading state for loading.tsx | `motion-safe:animate-pulse` already applied |
| `createAdminClient` | `src/lib/supabase/admin.ts` | Server-side DB query in page.tsx | Never in client components |
| `requireRole` | `src/lib/session.ts` | Role guard in server page | Accepts `Role | Role[]` |

**Installation:** All dependencies already present. No new packages needed.

---

## Architecture Patterns

### Recommended File Structure
```
src/app/(dashboard)/student/deals/
├── page.tsx          # Server component — requireRole("student"), fetch, render DealsClient
└── loading.tsx       # Skeleton placeholders for the table

src/app/(dashboard)/student_diy/deals/
├── page.tsx          # Server component — requireRole("student_diy"), fetch, render DealsClient
└── loading.tsx       # Same skeleton (or shared import)

src/components/student/
├── DealsClient.tsx   # "use client" — list + CRUD with useOptimistic
└── DealFormModal.tsx # Modal + form for add/edit (null deal = create, populated = edit)
```

### Pattern 1: Server Page Fetching and Passing Props
Both page.tsx files follow the same thin-server-component convention already established in student_diy/work/page.tsx and student/report/history/page.tsx.

```typescript
// src/app/(dashboard)/student/deals/page.tsx
// Source: established codebase pattern (student_diy/work/page.tsx)
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DealsClient } from "@/components/student/DealsClient";
import type { Database } from "@/lib/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

export default async function StudentDealsPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const { data: deals, error } = await admin
    .from("deals")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[student deals page] Failed to load deals:", error);
  }

  return (
    <div className="px-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ima-text">My Deals</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Track your brand deal revenue and profit
        </p>
      </div>
      <DealsClient initialDeals={(deals ?? []) as Deal[]} />
    </div>
  );
}
```

**student_diy variant:** Identical but `requireRole("student_diy")` and lives at `/student_diy/deals/page.tsx`.

### Pattern 2: useOptimistic on Full List (D-05/D-06)
The key adaptation from ReportFormWrapper — that component optimizes a single item; this component optimizes an array.

```typescript
// Source: ReportFormWrapper.tsx pattern adapted for list
// src/components/student/DealsClient.tsx
"use client";

import { useOptimistic, startTransition } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

type OptimisticAction =
  | { type: "add"; deal: Deal }
  | { type: "edit"; deal: Deal }
  | { type: "delete"; id: string };

function dealsReducer(state: Deal[], action: OptimisticAction): Deal[] {
  switch (action.type) {
    case "add":
      return [action.deal, ...state];           // insert at top (most-recent first)
    case "edit":
      return state.map((d) => d.id === action.deal.id ? action.deal : d);
    case "delete":
      return state.filter((d) => d.id !== action.id);
  }
}

export function DealsClient({ initialDeals }: { initialDeals: Deal[] }) {
  const router = useRouter();
  const [optimisticDeals, dispatchOptimistic] = useOptimistic(initialDeals, dealsReducer);

  const handleAdd = async (payload: { revenue: number; profit: number }) => {
    // Optimistic placeholder (D-07: negative ID, placeholder deal_number)
    const tempDeal: Deal = {
      id: String(-Date.now()),
      student_id: "",           // unknown client-side, irrelevant for display
      deal_number: optimisticDeals.length + 1,
      revenue: payload.revenue,
      profit: payload.profit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    startTransition(() => dispatchOptimistic({ type: "add", deal: tempDeal }));

    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { /* toast error */ return; }
    router.refresh();  // revalidates server data, replaces temp item with real row
  };

  // ... handleEdit, handleDelete similar
}
```

### Pattern 3: Optimistic Delete (Success Criteria #4)
Delete must disappear instantly and NOT reappear after router.refresh(). The key is that `dispatchOptimistic({ type: "delete", id })` removes it from the optimistic list immediately, and `router.refresh()` eventually returns a server list that also excludes it.

```typescript
const handleDelete = async (id: string) => {
  startTransition(() => dispatchOptimistic({ type: "delete", id }));
  const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
  if (!res.ok) {
    // On failure: router.refresh() re-fetches — row reappears from server truth
    router.refresh();
    toast({ type: "error", title: "Failed to delete deal" });
    return;
  }
  router.refresh();
};
```

### Pattern 4: Deal Row Layout (D-01)
Table-style rows inside a Card, using divide-y pattern seen in CoachReportsClient/ReportRow.

```typescript
// Row structure — each deal row in the list
<div className="divide-y divide-ima-border">
  {optimisticDeals.map((deal) => (
    <div
      key={deal.id}
      className="flex items-center gap-4 py-3 px-4 min-h-[44px]"
    >
      <span className="text-sm font-medium text-ima-text w-20 shrink-0">
        Deal #{deal.deal_number}
      </span>
      <span className="text-sm text-ima-text flex-1">
        ${Number(deal.revenue).toFixed(2)}
      </span>
      <span className="text-sm text-ima-text-secondary flex-1">
        ${Number(deal.profit).toFixed(2)}
      </span>
      <span className="text-xs text-ima-text-muted w-24 text-right">
        {formatDate(deal.created_at)}
      </span>
      {/* Edit + Delete buttons */}
    </div>
  ))}
</div>
```

### Pattern 5: DealFormModal (D-03/D-04)
Single modal handles both create and edit. `deal` prop is null for create, populated for edit.

```typescript
// Source: RoadmapClient.tsx + Modal.tsx patterns
interface DealFormModalProps {
  open: boolean;
  onClose: () => void;
  deal: Deal | null;       // null = create mode, populated = edit mode
  onSuccess: (data: { revenue: number; profit: number }) => void;
}
```

Form fields: `revenue` (number input, step="0.01") and `profit` (number input, step="0.01"). Both are required. Use `Input` component's `label` prop for accessible labels. Validate client-side against `VALIDATION.deals.revenueMin/Max` and `VALIDATION.deals.profitMin/Max` from config.

### Pattern 6: Stable Refs for Toast (CLAUDE.md rule)
CLAUDE.md requires "stable useCallback deps — use refs for toast/router". WorkTrackerClient demonstrates the pattern:

```typescript
const routerRef = useRef(useRouter());
const router = routerRef.current;
const { toast } = useToast();
const toastRef = useRef(toast);
// In callbacks: routerRef.current.refresh(), toastRef.current({ ... })
```

### Anti-Patterns to Avoid

- **Never pass deal_number to POST body.** The API explicitly excludes it — deal_number is assigned by a DB trigger. Only `revenue` and `profit` go in the POST body.
- **Never use `response.json()` before checking `response.ok`.** Every fetch must gate on `if (!res.ok)` first (CLAUDE.md hard rule).
- **Never hardcode currency symbols without Number() coercion.** `revenue` and `profit` are typed as `string | number` (Postgres numeric returns as string from Supabase). Always `Number(deal.revenue).toFixed(2)`.
- **Never import createAdminClient in DealsClient.tsx.** Admin client is server-only. The client component calls fetch() to the API routes.
- **Never use "zod/v4" import.** Must be `import { z } from "zod"` (CLAUDE.md hard rule, though no Zod needed client-side for this phase).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with focus trap | Custom overlay | `Modal` from `src/components/ui/Modal.tsx` | Already has portal, escape key, focus trap, inert background, ARIA |
| Empty state display | Inline conditional JSX | `EmptyState` from `src/components/ui/EmptyState.tsx` | Consistent styling, role="status" included |
| Toast notifications | Custom state/display | `useToast` from `src/components/ui/Toast.tsx` | Already integrated in ToastProvider |
| Accessible form inputs | Raw `<input>` | `Input` from `src/components/ui/Input.tsx` | Auto-generates htmlFor/id pair, aria-invalid, error display |
| Loading skeleton | Inline div shimmer | `Skeleton` from `src/components/ui/Skeleton.tsx` | Already applies motion-safe:animate-pulse |
| Optimistic UI | Local useState + rollback logic | `useOptimistic` + reducer | React 19 native; no need for manual rollback complexity |

---

## Common Pitfalls

### Pitfall 1: Optimistic Deal Number Mismatch
**What goes wrong:** The optimistic placeholder uses `optimisticDeals.length + 1` as deal_number. If two tabs are open, this will be wrong. After `router.refresh()`, the server-provided deal_number replaces the placeholder.
**Why it happens:** deal_number is assigned server-side by a DB trigger using FOR UPDATE row lock.
**How to avoid:** The temporary deal_number is cosmetic only. Success criteria only requires "Deal #N with the correct sequential number" — this is satisfied after router.refresh() completes. Accept that the optimistic placeholder may show a slightly wrong number for the brief moment before refresh.
**Warning signs:** If the number stays wrong after refresh, router.refresh() is not being called.

### Pitfall 2: revenue/profit Coercion Missing
**What goes wrong:** `${deal.revenue}` renders as e.g. "1500" instead of "$1,500.00". Worse, arithmetic like `Number(deal.revenue) - Number(deal.profit)` silently returns NaN if coercion is skipped.
**Why it happens:** Supabase returns Postgres `numeric(12,2)` as a string in the JS response. Types.ts declares `string | number` to reflect this.
**How to avoid:** Always wrap in `Number()` at every arithmetic/display site: `Number(deal.revenue).toFixed(2)`, not `deal.revenue.toFixed(2)`.

### Pitfall 3: Delete Row Reappears After Refresh
**What goes wrong:** Delete removes row optimistically but it reappears after `router.refresh()`.
**Why it happens:** `router.refresh()` triggers a server refetch. If the DELETE API call has not completed before `router.refresh()` runs (e.g., called in wrong order), the server still returns the row.
**How to avoid:** `router.refresh()` should only be called AFTER the `await fetch(...)` resolves. The optimistic dispatch happens synchronously in startTransition before the await — the await only controls when router.refresh() fires.

### Pitfall 4: Missing response.ok Check
**What goes wrong:** Build lint passes but runtime errors from the API are silently swallowed, optimistic state diverges from server state permanently.
**How to avoid:** Every `fetch()` call must: `if (!res.ok) { toast error; return; }`. On error for DELETE, call `router.refresh()` to restore the row.

### Pitfall 5: requireRole Array for Dual-Role Pages
**What goes wrong:** `requireRole("student")` in the student_diy page.tsx redirects student_diy users.
**How to avoid:** The two pages are separate files in their respective route groups — /student/deals uses `requireRole("student")` and /student_diy/deals uses `requireRole("student_diy")`. They both import the same DealsClient. They are NOT the same page.tsx.

### Pitfall 6: motion-safe Missing on Animations
**What goes wrong:** Accessibility violation; CLAUDE.md hard rule failure.
**How to avoid:** Any `animate-*` class MUST be `motion-safe:animate-*`. Skeleton already does this. Any hover transitions in deal rows must use `motion-safe:transition-*`.

---

## Code Examples

### API Call: Create Deal
```typescript
// Source: verified from src/app/api/deals/route.ts
const res = await fetch("/api/deals", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revenue: 1500, profit: 500 }),
});
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: null }));
  toast({ type: "error", title: err.error || "Failed to add deal" });
  return;
}
const { data: newDeal } = await res.json();
router.refresh();
```

### API Call: Edit Deal
```typescript
// Source: verified from src/app/api/deals/[id]/route.ts
const res = await fetch(`/api/deals/${deal.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ revenue: 2000, profit: 800 }),
});
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: null }));
  toast({ type: "error", title: err.error || "Failed to update deal" });
  return;
}
router.refresh();
```

### API Call: Delete Deal
```typescript
// Source: verified from src/app/api/deals/[id]/route.ts
const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: null }));
  toast({ type: "error", title: err.error || "Failed to delete deal" });
  router.refresh(); // restore the optimistically-removed row
  return;
}
router.refresh();
```

### Revenue/Profit Number Display
```typescript
// Source: STATE.md v1.5 D-02 — coerce with Number() at every arithmetic site
function formatCurrency(value: string | number): string {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

### Loading Skeleton (loading.tsx)
```typescript
// Source: established pattern from src/app/(dashboard)/student/report/loading.tsx
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 space-y-5">
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="bg-ima-surface border border-ima-border rounded-xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-ima-border last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## API Surface (Already Built — Phase 39)

| Endpoint | Method | Role | Body / Params | Returns |
|----------|--------|------|---------------|---------|
| `/api/deals` | POST | student, student_diy | `{ revenue: number, profit: number }` | `{ data: Deal }` 201 |
| `/api/deals` | GET | coach, owner only | `?student_id=&page=` | `{ data: Deal[], total, page }` |
| `/api/deals/[id]` | PATCH | student, student_diy (own) | `{ revenue?, profit? }` | `{ data: Deal }` |
| `/api/deals/[id]` | DELETE | student/diy (own), coach (assigned), owner (any) | — | `{ success: true }` |

**Key constraint:** The GET endpoint is coach/owner only. Student pages fetch deals directly via adminClient in the server component (bypasses RLS, scoped by `student_id = user.id`). The client component never calls GET /api/deals.

---

## Config References (Phase 40 Already Complete)

| Config Item | Value | Location |
|-------------|-------|----------|
| `ROUTES.student.deals` | `/student/deals` | `src/lib/config.ts` |
| `ROUTES.student_diy.deals` | `/student_diy/deals` | `src/lib/config.ts` |
| `NAVIGATION.student` | includes `{ label: "Deals", href: ROUTES.student.deals, icon: "DollarSign" }` | `src/lib/config.ts` line 310 |
| `NAVIGATION.student_diy` | includes `{ label: "Deals", href: ROUTES.student_diy.deals, icon: "DollarSign" }` | `src/lib/config.ts` line 318 |
| `VALIDATION.deals.revenueMin/Max` | `0 / 9999999999.99` | `src/lib/config.ts` line 338–341 |
| `VALIDATION.deals.profitMin/Max` | `0 / 9999999999.99` | `src/lib/config.ts` line 338–341 |
| Deal type (Row/Insert/Update) | `id, student_id, deal_number, revenue: string\|number, profit: string\|number, created_at, updated_at` | `src/lib/types.ts` line 662–699 |

---

## Environment Availability

Step 2.6: SKIPPED — this is a purely UI/code phase. No new external dependencies. All tools (Next.js dev server, Supabase admin client) are verified running from prior phases.

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield UI phase, not a rename/refactor/migration. No runtime state to inventory.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual UAT via browser (no automated test files in this project) |
| Config file | none |
| Quick run command | `npm run build && npm run lint && npx tsc --noEmit` |
| Full suite command | Same |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEAL-03 | Add deal — row appears instantly at top of list | manual-UAT | `npm run build` (type safety only) | N/A |
| DEAL-03 | Edit deal — updated values appear immediately | manual-UAT | `npm run build` | N/A |
| DEAL-03 | Delete deal — row disappears, does not reappear after refresh | manual-UAT | `npm run build` | N/A |
| DEAL-07 | /student_diy/deals renders same UI with same CRUD | manual-UAT | `npm run build` | N/A |

**Justification for manual-only:** This project has no automated test infrastructure (no jest.config, no vitest.config, no test/ directory). UAT is conducted via browser against the dev server.

### Wave 0 Gaps
None — existing infrastructure covers all phase requirements. Build + lint + tsc are the automated gates.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireRole()` in server page.tsx — redirects unauthenticated users |
| V3 Session Management | no (handled by Supabase Auth, not this phase) | — |
| V4 Access Control | yes | API routes already enforce student-only access; server page scopes query by `student_id = user.id` |
| V5 Input Validation | yes | API-side: Zod safeParse (already in route handlers). Client-side: HTML5 min/max attributes on number inputs |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR (student accesses another student's deals) | Elevation of privilege | PATCH/DELETE API enforces `.eq("student_id", profile.id)` ownership; server page fetches only `eq("student_id", user.id)` |
| Optimistic state desync | Tampering (local state) | `router.refresh()` after every mutation re-fetches authoritative server data |
| XSS via deal content | Spoofing | Revenue/profit are numeric fields — no user-controlled string rendered as HTML |
| CSRF on mutations | Tampering | `verifyOrigin()` already in POST/PATCH/DELETE handlers (verified in route.ts source) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Deal rows without a loading.tsx sibling still work — Next.js uses the parent route's Suspense boundary | Validation Architecture | Minor: page may not show skeleton; fix by adding loading.tsx (plan should include it anyway) |
| A2 | The student page.tsx can fetch from adminClient without pagination — student deal counts are expected to stay under a few hundred | Standard Stack | Low risk: VALIDATION.deals allows up to ~10B/deal, but count of deals is not bounded. Plan should add a reasonable `.limit(100)` or note that pagination is not required for v1 |

**Both items are low risk and easily addressed in the plan.**

---

## Open Questions

1. **Deal count pagination on the student-facing page**
   - What we know: The GET /api/deals endpoint (coach/owner use) supports pagination. The student server page fetches directly via adminClient with no explicit limit.
   - What's unclear: Should the student page be paginated? Success Criteria says "full deal history list" which implies no pagination for v1.
   - Recommendation: Fetch all with `.limit(500)` as a safety cap. No pagination UI needed in this phase.

2. **Delete confirmation UX** (Claude's Discretion)
   - What we know: CONTEXT.md leaves this to Claude. CoachAssignmentsClient uses inline optimistic updates without a confirm dialog.
   - Recommendation: Use an inline "Confirm delete?" toggle pattern (click Delete → button changes to "Confirm" + "Cancel" for 1 click) rather than a modal, to keep UX fast and avoid extra modal state. This avoids a second Modal mounting.

---

## Sources

### Primary (HIGH confidence — verified by reading source files)
- `src/components/student/ReportFormWrapper.tsx` — useOptimistic + startTransition + router.refresh() pattern
- `src/components/ui/Modal.tsx` — Modal API, props, sizes
- `src/components/ui/EmptyState.tsx` — EmptyState variants and props
- `src/components/ui/Button.tsx` — buttonVariants, 44px enforcement
- `src/components/ui/Input.tsx` — Input with label prop, aria-invalid
- `src/components/ui/Toast.tsx` — useToast hook signature
- `src/components/ui/Skeleton.tsx` — Skeleton component API
- `src/app/api/deals/route.ts` — POST/GET endpoints, body schema, response shape
- `src/app/api/deals/[id]/route.ts` — PATCH/DELETE endpoints, ownership enforcement
- `src/lib/config.ts` — ROUTES.student.deals, ROUTES.student_diy.deals, NAVIGATION entries, VALIDATION.deals
- `src/lib/types.ts` — Deal Row/Insert/Update types, revenue/profit as `string | number`
- `src/lib/session.ts` — requireRole() signature
- `src/app/(dashboard)/student_diy/work/page.tsx` — thin server component pattern
- `src/app/(dashboard)/student/report/loading.tsx` — loading.tsx skeleton pattern
- `CLAUDE.md` — hard rules (motion-safe, 44px, admin client, response.ok, zod import, ima-* tokens)

### Secondary (MEDIUM confidence)
- `.planning/phases/41-student-deals-pages/41-CONTEXT.md` — locked decisions
- `.planning/STATE.md` — v1.5 decisions D-01 through D-05

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components read from source
- Architecture patterns: HIGH — all patterns traced to existing codebase files
- API surface: HIGH — both route handlers read in full
- Pitfalls: HIGH — derived from type system, CLAUDE.md rules, and API behavior

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable stack — React 19, Next.js 16, no third-party changes expected)
