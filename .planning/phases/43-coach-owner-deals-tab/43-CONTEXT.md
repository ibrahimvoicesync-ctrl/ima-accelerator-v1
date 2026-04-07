# Phase 43: Coach & Owner Deals Tab - Context

**Gathered:** 2026-04-07 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

New "Deals" tab on coach and owner student detail pages (next to Calendar and Roadmap). Read-only table showing the student's deals with deal number, revenue, profit, profit margin %, and date. Data fetched via existing GET /api/deals endpoint.

</domain>

<decisions>
## Implementation Decisions

### Tab Integration
- **D-01:** Expand `TabKey` union in `StudentDetailTabs.tsx` from `"calendar" | "roadmap"` to `"calendar" | "roadmap" | "deals"` and add `{ key: "deals", label: "Deals" }` to the `tabs` array.
- **D-02:** Both `StudentDetailClient` (coach) and `OwnerStudentDetailClient` (owner) already share `StudentDetailTabs` — the new tab appears in both automatically.
- **D-03:** URL param handling follows existing pattern: `?tab=deals` in `window.history.replaceState`.
- **D-04:** `initialTab` prop parsing expands to recognize `"deals"` alongside `"calendar"` and `"roadmap"`.

### Deals Table Display
- **D-05:** Reuse the Phase 41 table-style row layout (deal number, revenue, profit, date) — read-only, no edit/delete actions for coach/owner.
- **D-06:** Add profit margin % column inline per roadmap success criteria #4: `((profit / revenue) * 100).toFixed(1)%`. Handle division-by-zero (revenue=0 → show "—").
- **D-07:** `Number()` coercion on revenue/profit before arithmetic (Phase 41 D-06 pattern).
- **D-08:** `toLocaleString()` with 2 decimal places for revenue/profit formatting (Phase 42 D-07 pattern).
- **D-09:** Empty state when student has no deals — use EmptyState component (compact variant) with "No deals yet" message, no CTA button (read-only view).
- **D-10:** Sorted most-recent first (created_at DESC), matching GET /api/deals default sort.

### Data Fetching
- **D-11:** Server-side fetch in both page.tsx files (coach/owner student detail) using admin client query — same pattern as existing calendar/roadmap data fetching in those pages. Add deals query to existing `Promise.all`.
- **D-12:** No pagination needed initially — fetch all deals for the student in the server component. If a student has many deals in the future, pagination can be added later.
- **D-13:** Pass deals array as prop to a new `DealsTab` component rendered when `activeTab === "deals"`.

### Component Structure
- **D-14:** New `DealsTab` component in `src/components/coach/` (shared by coach and owner, same as CalendarTab/RoadmapTab pattern). Read-only, no client interactivity needed beyond tab switching.

### Claude's Discretion
- Exact table header labels and column widths
- Mobile responsive behavior for the table (horizontal scroll vs stacked layout)
- Whether to show a summary row (total revenue/profit) at the bottom of the table
- Loading skeleton shape for the deals tab content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Tab system (modify these)
- `src/components/coach/StudentDetailTabs.tsx` — TabKey union and tabs array to expand
- `src/components/coach/StudentDetailClient.tsx` — Coach student detail, add deals tab rendering
- `src/components/owner/OwnerStudentDetailClient.tsx` — Owner student detail, add deals tab rendering

### Server pages (add deals query)
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Coach student detail server page
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Owner student detail server page

### API endpoint (reference only)
- `src/app/api/deals/route.ts` — GET endpoint with student_id param, paginated, coach/owner only

### Existing patterns to follow
- `src/components/coach/CalendarTab.tsx` — Shared tab component pattern (coach + owner)
- `src/components/coach/RoadmapTab.tsx` — Another shared tab component
- `src/components/student/DealsClient.tsx` — Phase 41 table layout to replicate (read-only version)

### Config & types
- `src/lib/config.ts` — VALIDATION.deals constants
- `src/lib/types.ts` — Deal type with `revenue: string | number`, `profit: string | number`

### Prior phase decisions
- `.planning/phases/41-student-deals-pages/41-CONTEXT.md` — D-01 (table rows), D-06 (Number() coercion), D-07 (optimistic placeholder ID)
- `.planning/phases/42-dashboard-stat-cards/42-CONTEXT.md` — D-07 (toLocaleString formatting)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StudentDetailTabs` — shared tab bar with accessible ARIA roles, Button-based tabs
- `CalendarTab` / `RoadmapTab` — pattern for tab content components accepting data props
- `EmptyState` component — default and compact variants
- `DealsClient` (Phase 41) — table markup to reference for column structure

### Established Patterns
- Server component page.tsx fetches data via `Promise.all` with admin client
- Tab content components receive data as props from parent client component
- `StudentDetailTabs` shared between coach and owner detail clients
- `Number()` coercion at every arithmetic site for `string | number` fields

### Integration Points
- `StudentDetailTabs` tabs array — add "deals" entry
- `StudentDetailClient` + `OwnerStudentDetailClient` — add `deals` prop and `DealsTab` rendering
- Both `[studentId]/page.tsx` files — add deals query to `Promise.all`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward tab addition reusing established patterns. Phase 41 table layout for deals display, existing GET /api/deals for data, existing tab system for integration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 43-coach-owner-deals-tab*
*Context gathered: 2026-04-07*
