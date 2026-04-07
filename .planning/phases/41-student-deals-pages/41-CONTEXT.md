# Phase 41: Student Deals Pages - Context

**Gathered:** 2026-04-07 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Students and student_diy users can add, view, edit, and delete their deals from a dedicated Deals page at /student/deals and /student_diy/deals. A shared DealsClient component powers both routes. All CRUD operations use useOptimistic for instant UI feedback.

</domain>

<decisions>
## Implementation Decisions

### Deal List Layout
- **D-01:** Table-style rows (reuse existing table/list patterns from the codebase), not cards. Each row shows deal number, revenue, profit, and date.
- **D-02:** Sorted most-recent first (by created_at DESC), matching the API's default sort order.

### Add/Edit Form
- **D-03:** Modal form for both adding and editing deals. Reuse the existing Modal component (sm or md size).
- **D-04:** Single modal component handles both create and edit modes — pass a `deal` prop (null for create, populated for edit).

### Optimistic UI
- **D-05:** useOptimistic operates on the full deals array (not a single item). Add inserts at the top, edit replaces in-place, delete removes from array.
- **D-06:** Follow the existing pattern: `useOptimistic` + `startTransition` + `router.refresh()` (as in ReportFormWrapper), adapted for list operations.
- **D-07:** Optimistic add uses a temporary negative ID and placeholder deal_number until the server response confirms the real values.

### Empty State
- **D-08:** EmptyState component (default variant — centered layout) with DollarSign icon and "Add your first deal" CTA button that opens the add modal.

### Shared Component
- **D-09:** DealsClient is a single "use client" component shared between /student/deals/page.tsx and /student_diy/deals/page.tsx (per STATE.md D-04). Each page.tsx is a thin server component that fetches deals and passes them as props.

### Claude's Discretion
- Number formatting for revenue/profit (currency display with 2 decimal places)
- Loading skeleton design while deals are being fetched
- Delete confirmation approach (inline confirm button vs modal confirmation)
- Whether to show profit margin percentage inline or omit it (Phase 43 shows it in coach/owner view)
- Exact responsive breakpoint behavior for the table on mobile

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API endpoints (already built)
- `src/app/api/deals/route.ts` — POST (create) and GET (list with pagination) endpoints
- `src/app/api/deals/[id]/route.ts` — PATCH (update) and DELETE endpoints

### Config & types
- `src/lib/config.ts` — ROUTES.student.deals, ROUTES.student_diy.deals, NAVIGATION entries, VALIDATION.deals constants
- `src/lib/types.ts` — Deal type (Row/Insert/Update) with revenue/profit as `string | number`

### Existing UI patterns
- `src/components/student/ReportFormWrapper.tsx` — useOptimistic + startTransition + router.refresh() pattern to replicate
- `src/components/ui/Modal.tsx` — Modal component with sm/md/lg sizes, focus trap, escape close
- `src/components/ui/EmptyState.tsx` — EmptyState with default/compact variants
- `src/components/ui/Card.tsx` — Card variants (may use for page wrapper)

### Prior phase decisions
- `.planning/phases/40-config-type-updates/40-CONTEXT.md` — D-01 through D-10 (routes, nav, validation, types all done)

### Route guard
- `src/proxy.ts` — Prefix-matching covers /student/deals and /student_diy/deals automatically (Phase 40 D-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal` component — accessible, focus-trapped, portal-rendered, 3 sizes
- `EmptyState` component — default (centered) and compact variants with icon/title/description/action
- `Card` / `CardContent` / `CardHeader` — CVA-based with multiple variants
- `Button` component — CVA-based with ima-* tokens, enforces 44px touch targets
- `Input` component — with aria-label support, ima-* tokens
- `useOptimistic` pattern from ReportFormWrapper — adaptable to list operations
- `Skeleton` component — for loading states
- `Toast` component — for success/error feedback on CRUD operations

### Established Patterns
- Server component page.tsx fetches data, passes to "use client" *Client component
- Client components use `useOptimistic` + `startTransition` for instant feedback
- `router.refresh()` after mutation to revalidate server data
- All fetch() calls check `response.ok` before parsing JSON
- Error handling: toast on failure, never swallow errors
- `Number()` coercion at every arithmetic site for revenue/profit

### Integration Points
- `/student/deals/page.tsx` and `/student_diy/deals/page.tsx` — new server component pages
- `DealsClient` — new shared client component in `src/components/student/`
- API calls to `/api/deals` (POST, GET) and `/api/deals/[id]` (PATCH, DELETE)
- Sidebar renders Deals nav entry automatically from config NAVIGATION arrays

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard CRUD page following established codebase patterns. User confirmed: table rows, modal add/edit, useOptimistic on the list, EmptyState with "Add your first deal" CTA.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 41-student-deals-pages*
*Context gathered: 2026-04-07*
