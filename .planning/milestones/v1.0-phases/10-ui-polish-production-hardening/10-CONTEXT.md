# Phase 10: UI Polish & Production Hardening - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Every page has loading states (skeletons via Suspense), graceful error handling (error boundaries with retry), motivating empty states with CTAs, and works on mobile (375px, no horizontal scroll, 44px touch targets). All UI uses ima-* design tokens, blue primary (#2563EB), Inter font. This is the final polish pass before production — no new features.

</domain>

<decisions>
## Implementation Decisions

### Empty states
- Motivating tone across all roles — encouraging copy that nudges action (fits the coaching/accelerator vibe)
- Every empty state includes a CTA button pointing to the logical next step (e.g., "Start your first cycle" on work tracker, "Invite students" on coach dashboard)
- Lucide icons in rounded background circles as visual anchors (matching reference-old EmptyState pattern)
- Port both variants from reference-old: full-page (centered, for standalone pages like report history/alerts) and compact (inline within dashboard cards with no data)

### Mobile & touch
- Keep current mobile nav approach (top bar with hamburger, sidebar slides over) — already built, focus polish on page content
- Tables and lists stack to cards on mobile — each row becomes a compact card with key info, no horizontal scroll
- Systematic audit of all 20 dashboard pages at 375px width
- 44px touch target violations found and fixed automatically using min-h-[44px] / h-11 patterns from Button component

### Claude's Discretion
- Loading skeleton design per page (page-specific vs generic SkeletonCard grids)
- Suspense boundary placement strategy (loading.tsx files vs inline Suspense)
- Error boundary strategy (dashboard-level vs per-route error.tsx)
- Error message copy and retry behavior
- Specific Lucide icon choices per empty state context
- Specific empty state CTA text and destinations per page
- Which table columns to show in mobile card view vs hide
- Exact responsive breakpoints for table-to-card transitions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI patterns (reference-old)
- `reference-old/src/components/ui/EmptyState.tsx` — EmptyState component with default + compact variants to port
- `reference-old/src/app/(dashboard)/error.tsx` — Error boundary pattern with Card, AlertTriangle icon, Try Again + Go Home buttons
- `reference-old/src/app/(dashboard)/student/loading.tsx` — Loading page pattern using SkeletonPage

### Existing V1 primitives
- `src/components/ui/Skeleton.tsx` — Skeleton + SkeletonCard already exist (ima-border, motion-safe:animate-pulse)
- `src/components/ui/Card.tsx` — CVA Card with default/warm/accent/bordered-left variants
- `src/components/ui/Button.tsx` — CVA Button with 44px touch targets, loading state, Spinner integration
- `src/app/(dashboard)/layout.tsx` — Dashboard layout with Sidebar, ToastProvider, badge computation

### Requirements
- `CLAUDE.md` — Hard rules: motion-safe, 44px targets, aria labels, ima-* tokens only

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Skeleton` + `SkeletonCard` — ready for use in loading.tsx files
- `Card` (CVA, 4 variants) — use for mobile card stacking of table rows
- `Button` (CVA, 5 variants, loading state) — use for empty state CTAs
- `Badge`, `Modal`, `Toast`, `Input`, `Textarea`, `Spinner` — all CVA primitives available
- `reference-old/EmptyState` — port directly, uses ima-* tokens compatible with V1

### Established Patterns
- Server components for all data-fetching pages (async page.tsx)
- Client components only for interactivity ("use client" islands)
- ima-* design tokens everywhere, `motion-safe:` prefix on animations
- `min-h-[44px]` / `h-11` for touch targets
- `role="status"`, `role="alert"`, `aria-hidden="true"` on decorative elements

### Integration Points
- 20 dashboard pages need loading.tsx, error.tsx, and empty state coverage
- Dashboard layout (`src/app/(dashboard)/layout.tsx`) — Suspense boundaries wrap children here or per-route
- Sidebar component — mobile hamburger menu already functional

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Port EmptyState from reference-old, create error.tsx following reference-old pattern, build loading.tsx files per route.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ui-polish-production-hardening*
*Context gathered: 2026-03-17*
