---
phase: 20-query-consolidation-caching
plan: "04"
subsystem: ui
tags: [pagination, server-side, supabase, next.js, react]

# Dependency graph
requires:
  - phase: 20-01
    provides: admin client singleton, RPC types, session cache
provides:
  - PaginationControls reusable component with ima-* tokens and 44px touch targets
  - Server-side paginated student list with search via form GET and .range()
  - Server-side paginated coach list with per-page enrichment queries
affects:
  - 20-05 (caching layer may wrap these paginated pages)
  - 24-infrastructure-validation (pagination is scalability foundation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side pagination with .range(from, to) and count: 'estimated'"
    - "URL-driven page state via searchParams Promise"
    - "Enrichment queries scoped to current page's IDs only (not full-table joins)"
    - "Server-side search via HTML form GET (no client component needed)"

key-files:
  created:
    - src/components/ui/PaginationControls.tsx
  modified:
    - src/app/(dashboard)/owner/students/page.tsx
    - src/app/(dashboard)/owner/coaches/page.tsx

key-decisions:
  - "Replaced OwnerStudentSearchClient (client component) with server-side form GET — eliminates client JS for search, resets to page 1 automatically on new search"
  - "Coach enrichment queries (students + reports) scoped to current page's coachIds only — O(page_size) not O(all_coaches) at scale"
  - "count: 'estimated' on both paginated queries — avoids full table scan for count"
  - "PaginationControls returns null when totalPages <= 1 — no pagination UI for small datasets"

patterns-established:
  - "Pagination pattern: const from = (page-1) * PAGE_SIZE; const to = from + PAGE_SIZE - 1; .range(from, to)"
  - "Estimated count: { count: 'estimated' } in select, then Math.ceil(count / PAGE_SIZE)"
  - "Search preservation: searchParams prop on PaginationControls so Next URL includes search=X"

requirements-completed: [QUERY-05, QUERY-06]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 20 Plan 04: Server-Side Pagination for Owner List Pages Summary

**PaginationControls component + server-side paginated student/coach list pages with .range(), count: 'estimated', and per-page enrichment queries replacing full-table loads**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-30T06:45:00Z
- **Completed:** 2026-03-30T06:52:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created PaginationControls reusable component with Previous/Next navigation, ima-* tokens, 44px touch targets, and aria-label accessibility
- Converted owner students page from full-table fetch to .range(from, to) with count: 'estimated', 25 per page; replaced OwnerStudentSearchClient client component with server-side form GET search
- Converted owner coaches page from loading all coaches + all students + all reports to paginated coaches with enrichment queries scoped to the current page's coach IDs only

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PaginationControls component** - `8e15250` (feat)
2. **Task 2: Convert student list and coach list pages to server-side pagination** - `9e8e7c3` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/ui/PaginationControls.tsx` - Reusable Previous/Next pagination with ima-* tokens, 44px touch targets, aria-label on nav, aria-disabled on disabled states, basePath+searchParams props
- `src/app/(dashboard)/owner/students/page.tsx` - Server-side paginated student list; .range() + count: 'estimated'; form GET search; PaginationControls; OwnerStudentSearchClient removed
- `src/app/(dashboard)/owner/coaches/page.tsx` - Server-side paginated coach list; .range() + count: 'estimated'; enrichment only for current page coaches; PaginationControls

## Decisions Made
- Replaced OwnerStudentSearchClient with a plain HTML form GET — eliminates client-side JS bundle for search, always resets to page 1 on new search (correct behavior), no debounce complexity needed
- Coach enrichment queries (student counts + avg ratings) now scoped to current page's coach IDs via `.in("coach_id", coachIds)` — prevents loading all students/reports when paginated
- Used `~` prefix in "Page X of ~Y" indicator to communicate that totalPages is estimated, not exact

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are fully wired. The `~` prefix on counts is intentional (reflects count: 'estimated' behavior).

## Next Phase Readiness
- Server-side pagination foundation complete for owner list pages
- PaginationControls component is reusable for any future list pages
- Ready for Phase 20-05 (React cache() dedup and route-level revalidation)

---
*Phase: 20-query-consolidation-caching*
*Completed: 2026-03-30*
