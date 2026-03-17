# Phase 10: UI Polish & Production Hardening - Research

**Researched:** 2026-03-17
**Domain:** Next.js App Router loading/error states, React Suspense, empty state UI, mobile responsive audit, CVA component polish
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Empty states:** Motivating tone, every empty state includes a CTA button pointing to the logical next step. Lucide icons in rounded background circles as visual anchors (matching reference-old EmptyState pattern). Port both variants from reference-old: full-page (centered, for standalone pages) and compact (inline within dashboard cards).
- **Mobile nav:** Keep current mobile nav approach (top bar with hamburger, sidebar slides over) — already built, focus polish on page content.
- **Tables/lists → cards:** Tables and lists stack to cards on mobile. Each row becomes a compact card with key info, no horizontal scroll.
- **Touch targets:** 44px touch target violations found and fixed automatically using `min-h-[44px]` / `h-11` patterns from Button component.
- **Mobile audit scope:** Systematic audit of all 20 dashboard pages at 375px width.

### Claude's Discretion
- Loading skeleton design per page (page-specific vs generic SkeletonCard grids)
- Suspense boundary placement strategy (loading.tsx files vs inline Suspense)
- Error boundary strategy (dashboard-level vs per-route error.tsx)
- Error message copy and retry behavior
- Specific Lucide icon choices per empty state context
- Specific empty state CTA text and destinations per page
- Which table columns to show in mobile card view vs hide
- Exact responsive breakpoints for table-to-card transitions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | All pages have loading skeletons | Next.js `loading.tsx` per route + existing `Skeleton`/`SkeletonCard` components |
| UI-02 | Error boundaries catch and display errors gracefully | Next.js `error.tsx` files + reference-old error pattern |
| UI-03 | Empty states show motivating copy with action CTAs | Port `EmptyState` from reference-old (already ima-* compatible) |
| UI-04 | All pages are mobile responsive | Page-by-page audit, card-stacking pattern for list/detail rows |
| UI-05 | All interactive elements meet 44px touch target minimum | Button CVA already enforces `min-h-[44px]`; audit raw `<a>` and `<button>` elements |
| UI-06 | Shared UI components match old codebase visual style | ima-* tokens, Inter font, #2563EB primary — already configured in tailwind.config.ts |
</phase_requirements>

---

## Summary

Phase 10 is a pure polish pass — no new features. All 20 dashboard pages need three infrastructure files added (`loading.tsx`, `error.tsx`) and their empty states upgraded to the canonical `EmptyState` component. The heavy lifting is already done: `Skeleton`, `SkeletonCard`, `Button`, `Card`, and all CVA primitives are fully built and token-compliant. The `EmptyState` component needs to be ported from `reference-old/` where it exists verbatim.

The mobile audit is the most nuanced part. The pages split into two buckets: (1) card-grid pages (most student/coach/owner list pages) that already use `grid grid-cols-1 md:grid-cols-2` and need minimal changes, and (2) specific pages with inline `flex-wrap` row layouts (assignment rows, report rows, invite rows) that can overflow on 375px. The `OwnerAssignmentsClient` already uses `flex-col sm:flex-row` — the pattern is established. The main mobile risk is the `min-w-[180px]` select in assignments and the `ReportRow` summary line's wrapping behavior with multiple inline elements.

No new libraries are needed. Everything needed for this phase is already in the codebase or directly portable from reference-old.

**Primary recommendation:** Port `EmptyState` first, add `loading.tsx` / `error.tsx` to all 20 routes in a single wave, then do the mobile audit as a targeted sweep of the handful of pages with non-card list layouts.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | `loading.tsx` + `error.tsx` file conventions | Built-in, zero config |
| React | 19.2.3 | Suspense boundaries, Error boundaries | Built-in |
| class-variance-authority | ^0.7.1 | CVA variants on all UI primitives | Already used throughout |
| lucide-react | ^0.576.0 | Icons for empty states | Already used throughout |
| tailwindcss | 4.x | ima-* tokens, responsive breakpoints | Already configured |

### Existing V1 UI Primitives (ready to use)
| Component | File | Notes |
|-----------|------|-------|
| `Skeleton` | `src/components/ui/Skeleton.tsx` | `bg-ima-border motion-safe:animate-pulse` — correct |
| `SkeletonCard` | `src/components/ui/Skeleton.tsx` | Generic 3-line card skeleton |
| `Button` | `src/components/ui/Button.tsx` | CVA, 5 variants, loading state, `min-h-[44px]` on all sizes |
| `Card` | `src/components/ui/Card.tsx` | CVA, 4 variants, `CardContent`/`CardHeader`/`CardTitle` etc. |
| `Badge` | `src/components/ui/Badge.tsx` | CVA |

### To Port from reference-old
| Component | Source | Status |
|-----------|--------|--------|
| `EmptyState` | `reference-old/src/components/ui/EmptyState.tsx` | Port verbatim — already uses ima-* tokens |

### To Create (new files)
| File Pattern | Count | What |
|-------------|-------|------|
| `src/app/(dashboard)/[role]/[page]/loading.tsx` | ~20 | Page-specific skeleton |
| `src/app/(dashboard)/[role]/[page]/error.tsx` | ~20 | Error boundary with retry |
| `src/app/(dashboard)/error.tsx` | 1 | Dashboard-level fallback (shared) |
| `src/components/ui/EmptyState.tsx` | 1 | Ported from reference-old |

**Installation:** None required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── components/ui/
│   └── EmptyState.tsx          # NEW — ported from reference-old
├── app/(dashboard)/
│   ├── error.tsx               # NEW — dashboard-level error fallback
│   ├── student/
│   │   ├── loading.tsx         # NEW
│   │   ├── error.tsx           # NEW
│   │   ├── work/
│   │   │   ├── loading.tsx     # NEW
│   │   │   └── error.tsx       # NEW
│   │   ├── roadmap/
│   │   │   ├── loading.tsx     # NEW
│   │   │   └── error.tsx       # NEW
│   │   ├── report/
│   │   │   ├── loading.tsx     # NEW
│   │   │   ├── error.tsx       # NEW
│   │   │   └── history/
│   │   │       ├── loading.tsx # NEW
│   │   │       └── error.tsx   # NEW
│   │   └── ask/
│   │       ├── loading.tsx     # NEW
│   │       └── error.tsx       # NEW
│   ├── coach/
│   │   ├── loading.tsx / error.tsx
│   │   ├── reports/ loading.tsx / error.tsx
│   │   ├── analytics/ loading.tsx / error.tsx
│   │   ├── invites/ loading.tsx / error.tsx
│   │   └── students/[studentId]/ loading.tsx / error.tsx
│   └── owner/
│       ├── loading.tsx / error.tsx
│       ├── students/ loading.tsx / error.tsx
│       ├── students/[studentId]/ loading.tsx / error.tsx
│       ├── coaches/ loading.tsx / error.tsx
│       ├── coaches/[coachId]/ loading.tsx / error.tsx
│       ├── invites/ loading.tsx / error.tsx
│       ├── assignments/ loading.tsx / error.tsx
│       └── alerts/ loading.tsx / error.tsx
```

### Pattern 1: loading.tsx with page-matched skeletons

Next.js automatically wraps the route segment in a Suspense boundary when `loading.tsx` is present. The loading file must be a default export returning a React component.

**Strategy decision (Claude's discretion):** Use page-specific skeletons that match the actual page layout shape rather than a generic SkeletonCard grid. This prevents jarring layout shifts when the real content loads.

```typescript
// src/app/(dashboard)/owner/page.tsx loading.tsx — matches 4-col stat grid
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**For pages that have a title + card grid:**
```typescript
// Generic reusable skeleton shape for list pages (coach dashboard, owner coaches, etc.)
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 2: error.tsx — "use client" error boundary

Next.js requires `error.tsx` to be a Client Component. It receives `error` (the thrown Error) and `reset` (a function to retry). Port the reference-old pattern verbatim.

```typescript
// src/app/(dashboard)/error.tsx — dashboard-level fallback
"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";
import { Card, CardContent } from "@/components/ui";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-12 flex items-center justify-center" role="alert">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <AlertTriangle className="h-12 w-12 text-ima-error mb-4" aria-hidden="true" />
          <h1 className="text-xl font-bold text-ima-text mb-2">Something went wrong</h1>
          <p className="text-sm text-ima-text-secondary mb-6">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          <div className="flex gap-3">
            <Button variant="primary" onClick={reset}>Try Again</Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>Go Home</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Error boundary scoping:** One shared `error.tsx` at `(dashboard)/error.tsx` covers all routes as a fallback. Individual route-level `error.tsx` files can override with more specific messages (e.g., "Couldn't load your students" on the coach page).

### Pattern 3: EmptyState component (ported from reference-old)

The reference-old `EmptyState` component is already ima-* token compatible. Port it directly to `src/components/ui/EmptyState.tsx` with no changes needed.

```typescript
// src/components/ui/EmptyState.tsx — port verbatim from reference-old
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "compact";
}

export function EmptyState({ icon, title, description, action, variant = "default" }: EmptyStateProps) {
  // ... (port verbatim — see reference-old/src/components/ui/EmptyState.tsx)
}
```

**Add to `src/components/ui/index.ts`:**
```typescript
export { EmptyState } from "./EmptyState";
```

### Pattern 4: Replacing inline empty states

Several pages already have ad-hoc empty states using `Card + CardContent + icon + text` patterns. These should be replaced with `EmptyState` for consistency.

**Existing ad-hoc pattern (before):**
```typescript
<Card>
  <CardContent className="p-8 text-center">
    <Users className="h-10 w-10 text-ima-text-secondary mx-auto mb-3" aria-hidden="true" />
    <p className="text-sm font-medium text-ima-text">No students assigned yet</p>
    <p className="text-xs text-ima-text-secondary mt-1">Students will appear here once assigned to you.</p>
  </CardContent>
</Card>
```

**After with EmptyState:**
```typescript
<EmptyState
  icon={<Users className="h-6 w-6" />}
  title="No students assigned yet"
  description="Students will appear here once the owner assigns them to you."
  action={<Button variant="outline" size="sm" asChild><Link href="/coach/invites">Invite Students</Link></Button>}
/>
```

### Pattern 5: Mobile card stacking for list rows

The `OwnerAssignmentsClient` already uses `flex-col sm:flex-row sm:items-center` — this is the established pattern. Apply consistently.

For the `ReportRow` component (coach/reports), the `flex-wrap` summary row can overflow on 375px because it tries to fit: name/date + stars + hours/outreach + button. **Mobile fix:** Stack into two sub-rows on mobile.

```typescript
// ReportRow summary — mobile-safe version
<div className="flex flex-col sm:flex-row sm:items-center gap-2 min-h-[44px]">
  {/* Row 1 on mobile: name + date + status badge */}
  <div className="flex items-center justify-between flex-1 min-w-0">
    <div>
      <p className="text-sm font-semibold text-ima-text truncate">{studentName}</p>
      <p className="text-xs text-ima-text-secondary">{formatDate(report.date)}</p>
    </div>
    {isReviewed ? <Badge variant="success" size="sm">Reviewed</Badge> : null}
  </div>
  {/* Row 2 on mobile: stars + metrics + button */}
  <div className="flex items-center gap-3 flex-wrap">
    <StarDisplay rating={report.star_rating} />
    <span className="text-xs text-ima-text-secondary">{hours}h · {outreach} outreach</span>
    <Button ...>Mark Reviewed</Button>
  </div>
</div>
```

### Anti-Patterns to Avoid

- **`aria-hidden` missing on decorative icons in EmptyState:** The icon slot in EmptyState wraps the icon in a div with `aria-hidden="true"` already — do not add aria-hidden to the icon itself when passing via the `icon` prop; the wrapper handles it.
- **`loading.tsx` that renders differently from actual page layout:** Don't use a generic `<div>Loading...</div>`. Always match the skeleton shape to the page structure to prevent layout shifts.
- **`error.tsx` without `useEffect(() => { console.error(error) }, [error])`:** This loses error observability. Always log the raw error.
- **Replacing `<Link>` CTAs in EmptyState with `<button>` that navigates:** Use `<Link>` or a Button with `asChild` for navigation CTAs, never a button with router.push().
- **Hardcoded colors in new code:** All color values must use ima-* tokens. No `text-gray-500`, no `bg-[#eee]`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page loading state | Custom spinner overlay | `loading.tsx` + `Skeleton` | Next.js Suspense integration is automatic |
| Error catching | try/catch in page.tsx rendering | `error.tsx` file | Catches render errors AND data errors; integrates with React error boundaries |
| Empty state UI | One-off Card+icon+text patterns | `EmptyState` component | Consistency, accessibility (role="status"), responsive by design |
| Touch target enforcement | Per-element `min-h` audit | Button CVA (already enforces), `min-h-[44px]` on raw interactive elements | Button already guarantees 44px; only raw `<a>` and `<button>` elements need manual audit |

**Key insight:** Next.js `loading.tsx` + `error.tsx` is the correct mechanism for this stack. Manual Suspense wrappers inside page.tsx are only needed if sub-components need independent loading states — which none of the current pages require.

---

## Common Pitfalls

### Pitfall 1: error.tsx scope — sibling vs parent
**What goes wrong:** Placing `error.tsx` inside a route directory only catches errors from that route's `page.tsx`. If `layout.tsx` throws (e.g., the dashboard layout fails to fetch the user profile), a sibling `error.tsx` does NOT catch it — the error propagates to the parent segment's error boundary.
**Why it happens:** Next.js error boundaries wrap `{children}` within a layout, not the layout itself.
**How to avoid:** The dashboard `layout.tsx` already handles auth failures with redirects (no thrown errors), so a single `(dashboard)/error.tsx` plus per-route `error.tsx` files is sufficient. Do NOT put an `error.tsx` at `src/app/error.tsx` unless you want to catch root-level auth errors.
**Warning signs:** Error boundary not catching errors during development even though `error.tsx` is present.

### Pitfall 2: loading.tsx and streaming — layout data blocks skeleton
**What goes wrong:** `loading.tsx` shows immediately, but if the parent `layout.tsx` has slow `await` calls (the dashboard layout does many DB queries for badge counts), the skeleton is only shown AFTER the layout finishes.
**Why it happens:** `loading.tsx` wraps the page's Suspense boundary but the layout itself is still blocking.
**How to avoid:** This is acceptable for V1. The dashboard layout runs fast DB queries (counts + badge computation). The skeleton is still shown before the page's own data loads. For the current scale, this is not a problem.
**Warning signs:** Skeleton never appears during local dev even with slow DB.

### Pitfall 3: motion-safe omitted on Skeleton pulse
**What goes wrong:** Skeleton uses `motion-safe:animate-pulse` but a developer adds new skeleton elements and forgets the `motion-safe:` prefix.
**Why it happens:** CLAUDE.md hard rule; forgetting the prefix violates it.
**How to avoid:** Always write `motion-safe:animate-pulse`, never just `animate-pulse`. The existing `Skeleton` component already enforces this; only custom skeleton elements need vigilance.

### Pitfall 4: EmptyState CTA using raw `<a>` tag
**What goes wrong:** Using a raw anchor `<a>` for the CTA button inside EmptyState gives inconsistent styling and may not meet 44px touch target.
**Why it happens:** Quick copy-paste.
**How to avoid:** Always use `<Button>` with `asChild` + `<Link>`, or just `<Button>` for client-side navigation callbacks. Button CVA enforces `min-h-[44px]` on all sizes.

### Pitfall 5: Missing `role="alert"` on error.tsx and `role="status"` on EmptyState
**What goes wrong:** Screen readers don't announce the error or empty state when content changes.
**Why it happens:** Forgetting ARIA roles on dynamic regions.
**How to avoid:** The reference-old error.tsx uses `role="alert"` on its outer div; the reference-old EmptyState uses `role="status"`. Port these verbatim and they are already correct.

### Pitfall 6: 44px audit missing raw interactive elements
**What goes wrong:** The audit only checks `<Button>` elements (which are already 44px) but misses raw `<a>` links, `<select>` elements, and `<details><summary>` clickables.
**Why it happens:** Button CVA is correct; engineers assume other elements are fine.
**How to avoid:** Specific elements to audit:
  - `<Link>` elements used as standalone links (back arrows, "View Details" links) — need `min-h-[44px] inline-flex items-center`
  - `<select>` in `OwnerAssignmentsClient` — already has `min-h-[44px]` (line 271)
  - `<details><summary>` in `ReportRow` — the CardContent inside has `min-h-[44px]` on the flex row (line 59)
  - `<button>` filter tabs in `OwnerAlertsClient` — already have `min-h-[44px]` (line 158)
  - Raw `<Link>` elements on coach/owner stat cards — wrapped in `min-h-[44px] block` (owner/page.tsx lines 67, 87)

### Pitfall 7: `OwnerInvitesClient` table rows overflowing on 375px
**What goes wrong:** The invites list renders invite codes + copy buttons + status badges in a horizontal row. On 375px, code + badge + button will overflow.
**Why it happens:** Not yet audited at 375px width.
**How to avoid:** Wrap invite rows in `flex-col sm:flex-row` and truncate the invite code with `truncate` or show a shortened version.

---

## Code Examples

Verified patterns from existing codebase or reference-old:

### Loading page skeleton — stat card page
```typescript
// Matches owner/page.tsx layout shape
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      <Skeleton className="h-8 w-48 mb-2" aria-hidden="true" />
      <Skeleton className="h-4 w-32 mb-6" aria-hidden="true" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Loading page skeleton — card grid list page
```typescript
// Matches coach/page.tsx, owner/students/page.tsx, owner/coaches/page.tsx
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      <Skeleton className="h-8 w-48 mb-2" aria-hidden="true" />
      <Skeleton className="h-4 w-32 mb-6" aria-hidden="true" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
```

### Loading page skeleton — student dashboard
```typescript
// Matches student/page.tsx layout: heading + work card + 2-col grid
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      <Skeleton className="h-8 w-56 mb-2" aria-hidden="true" />
      <Skeleton className="h-4 w-48 mb-6" aria-hidden="true" />
      {/* Work card */}
      <div className="bg-ima-surface border border-ima-border rounded-xl p-6 mt-6 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      {/* 2-col placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
```

### EmptyState usage — full-page variant (standalone pages)
```typescript
// For: student/report/history, owner/alerts (when empty), coach/reports (no students)
import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

<EmptyState
  icon={<FileText className="h-6 w-6" />}
  title="No reports yet"
  description="Submit your first daily report to start tracking your progress."
  action={
    <Button asChild>
      <Link href="/student/report">Submit Your First Report</Link>
    </Button>
  }
/>
```

### EmptyState usage — compact variant (inline in dashboard cards)
```typescript
// For: coach dashboard "My Students" section when no students assigned
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

<EmptyState
  variant="compact"
  icon={<Users className="h-5 w-5" />}
  title="No students assigned yet"
  description="Students will appear here once the owner assigns them to you."
  action={
    <Button variant="outline" size="sm" asChild>
      <Link href="/coach/invites">Invite Students</Link>
    </Button>
  }
/>
```

---

## Page-by-Page Audit Summary

### 20 Dashboard Pages — Coverage Matrix

| Route | Role | Has loading.tsx | Has error.tsx | Empty States | Mobile Risk |
|-------|------|-----------------|---------------|-------------|-------------|
| `/student` | student | MISSING | MISSING | Inline (roadmap card) | LOW — card-based layout |
| `/student/work` | student | MISSING | MISSING | None (always has content) | LOW |
| `/student/roadmap` | student | MISSING | MISSING | None (always has content) | LOW |
| `/student/report` | student | MISSING | MISSING | None (always has form) | LOW |
| `/student/report/history` | student | MISSING | MISSING | Inline (basic, no CTA) | LOW — single-col cards |
| `/student/ask` | student | MISSING | MISSING | None (iframe) | LOW |
| `/coach` | coach | MISSING | MISSING | Inline (no students) | LOW |
| `/coach/reports` | coach | MISSING | MISSING | Two inline states | MEDIUM — ReportRow flex-wrap |
| `/coach/analytics` | coach | MISSING | MISSING | Inline (no students) | LOW — grid layout |
| `/coach/invites` | coach | MISSING | MISSING | None visible | MEDIUM — invite code rows |
| `/coach/students` | coach | MISSING | MISSING | Redirects to /coach | N/A |
| `/coach/students/[studentId]` | coach | MISSING | MISSING | Tab-specific states | LOW |
| `/owner` | owner | MISSING | MISSING | None (stat cards) | LOW |
| `/owner/students` | owner | MISSING | MISSING | Inline (no search match) | LOW — card grid |
| `/owner/students/[studentId]` | owner | MISSING | MISSING | Tab-specific | LOW |
| `/owner/coaches` | owner | MISSING | MISSING | Inline (no coaches) | LOW — card grid |
| `/owner/coaches/[coachId]` | owner | MISSING | MISSING | Tab-specific | LOW |
| `/owner/invites` | owner | MISSING | MISSING | None on invites list | HIGH — invite code + button rows |
| `/owner/assignments` | owner | MISSING | MISSING | Inline (no students) | MEDIUM — select dropdown |
| `/owner/alerts` | owner | MISSING | MISSING | Inline via OwnerAlertsClient | LOW — card-based |

**Notes:**
- `/coach/students` redirects to `/coach` — no loading/error files needed
- `coach/students/[studentId]` shares StudentDetailClient with owner's detail page

### High-Priority Mobile Fixes

1. **`OwnerInvitesClient`** — invite code rows likely overflow on 375px. Need to audit `src/components/owner/OwnerInvitesClient.tsx` (not yet read — see Wave 0 gap below).
2. **`CoachInvitesClient`** — same risk as OwnerInvitesClient.
3. **`ReportRow`** — the flex-wrap summary with 4+ inline elements (name, stars, hours, outreach, button) may overflow 375px. Apply `flex-col sm:flex-row` restructuring.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` loading states | `loading.tsx` files (Suspense) | Next.js 13+ App Router | Zero-config, automatic |
| Class components + `componentDidCatch` | `error.tsx` files | Next.js 13+ App Router | File-based, co-located with route |
| Custom error boundaries with HOC | `"use client"` error.tsx | React 18+ | Simpler, no HOC needed |
| `SkeletonPage`/`SkeletonGrid` variants | `Skeleton` + `SkeletonCard` only | Phase 05 decision | V1 scope reduction (Phase 05 decision: only Skeleton + SkeletonCard in V1) |

**Deprecated/outdated for this project:**
- `SkeletonPage`, `SkeletonList`, `SkeletonTable`, `SkeletonGrid`, `SkeletonForm` from reference-old — NOT in V1. Build page-specific skeletons from `Skeleton` + `SkeletonCard` primitives instead.
- `ima-surface-warm` token — NOT in V1 token set. Use `ima-surface-light` instead (established in Phase 05).
- `ima-brand-gold`, `tier-*`, `brand-*`, `warm-*` tokens — cut from V1. Use only the 17 tokens in `tailwind.config.ts`.

---

## Open Questions

1. **OwnerInvitesClient and CoachInvitesClient mobile layout**
   - What we know: Both components render invite code rows but weren't read in full during research
   - What's unclear: Whether they use flex-wrap rows that overflow at 375px
   - Recommendation: Planner should instruct implementer to read both files before mobile audit and apply `flex-col sm:flex-row` if needed

2. **coach/students/[studentId] loading skeleton shape**
   - What we know: The page uses `StudentDetailClient` with tab navigation (Reports, Sessions, Roadmap)
   - What's unclear: Whether a tab-aware skeleton is needed or a generic card stack suffices
   - Recommendation: Generic card stack is acceptable for V1 — a tab-shaped skeleton is overengineering for this phase

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files, no test directories, no test scripts in package.json |
| Config file | None |
| Quick run command | `npm run build && npm run lint` (build + lint as proxy) |
| Full suite command | `npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | All 20 routes have loading.tsx | manual-only | File existence check: `find src/app/(dashboard) -name loading.tsx` | ❌ Wave 0 |
| UI-02 | Error boundaries present | manual-only | File existence check: `find src/app/(dashboard) -name error.tsx` | ❌ Wave 0 |
| UI-03 | EmptyState component exists and exported | build | `npx tsc --noEmit` catches import errors | ❌ Wave 0 |
| UI-04 | Mobile layout (375px no overflow) | manual-only | DevTools 375px viewport audit — not automatable | N/A |
| UI-05 | 44px touch targets | manual-only | DevTools element inspection — not automatable | N/A |
| UI-06 | ima-* tokens, Inter font, blue primary | build + lint | `npm run lint` catches hardcoded hex; `npx tsc --noEmit` for type errors | N/A |

**Manual-only justification for UI-04 and UI-05:** Responsive layout and touch target validation requires visual browser inspection. There is no automated test runner configured in this project. Build success (`npm run build`) and type check (`npx tsc --noEmit`) serve as the primary automated gates.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/ui/EmptyState.tsx` — needed before any empty state usage in UI-03
- [ ] `src/app/(dashboard)/error.tsx` — dashboard-level error boundary, needed before per-route error files
- Reading `src/components/owner/OwnerInvitesClient.tsx` and `src/components/coach/CoachInvitesClient.tsx` to complete mobile audit assessment

*(No test framework install required — project has no test infrastructure and none was planned for V1)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — read all 20 page files, all UI primitives, layout.tsx, tailwind.config.ts
- `reference-old/src/components/ui/EmptyState.tsx` — ported component source
- `reference-old/src/app/(dashboard)/error.tsx` — error boundary pattern
- `tailwind.config.ts` — confirmed 17 ima-* tokens in V1

### Secondary (MEDIUM confidence)
- Next.js App Router docs on `loading.tsx` and `error.tsx` file conventions — consistent with Next.js 13+ known behavior, verified against project's Next.js 16.1.6

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — patterns verified from reference-old source and existing codebase
- Pitfalls: HIGH — pitfalls derived from reading actual code (no speculation)
- Mobile audit: MEDIUM — 18/20 pages read; OwnerInvitesClient and CoachInvitesClient not fully audited

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack, 30-day window)
