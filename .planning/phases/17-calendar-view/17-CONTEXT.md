# Phase 17: Calendar View - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches and owners can review a student's full activity history in a calendar month view with day-level detail. Calendar tab replaces the existing Work Sessions and Reports tabs on student detail pages. Roadmap tab remains unchanged. Delivers CAL-01 through CAL-04.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation areas deferred to Claude — user skipped discussion. Claude has full flexibility on:

- **Day detail panel** — How clicking a day cell displays session + report data (inline expand, side panel, modal). Desktop vs mobile layout for side-by-side vs stacked content.
- **Activity indicators** — Visual style for green (work + report), amber (partial), empty day indicators (dots, background fills, borders). Month grid cell sizing and density.
- **Tab restructuring** — How Calendar tab replaces Work Sessions + Reports tabs. Tab naming, default tab state, URL param behavior (`?tab=calendar` replacing `?tab=work` and `?tab=reports`).
- **Empty/edge states** — What shows for months before student joined, future dates, months with zero activity. Navigation limits (how far back/forward).
- **Calendar grid implementation** — Using `react-day-picker@^9.14.0` (already decided in STATE.md) or custom grid. Styling to match ima-* design tokens.
- **Data fetching strategy** — Month-scoped queries using `?month=YYYY-MM` search params (already decided in STATE.md). Server-side fetch vs client-side day detail loading.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CAL-01 through CAL-04 (all map to this phase)

### Prior Phase Context
- `.planning/phases/16-coach-owner-kpi-visibility/16-CONTEXT.md` — Phase 16 KPI summary on coach/owner pages, tab structure, roadmap 15-step config
- `.planning/phases/15-outreach-kpi-banner/15-CONTEXT.md` — Phase 15 RAG thresholds, KPI data sourcing, ProgressBanner design

### Accumulated Context (STATE.md)
- `.planning/STATE.md` §Critical Implementation Notes — Calendar uses `?month=YYYY-MM` search params, `react-day-picker@^9.14.0` for React 19 compat

### Student Detail Pages (Coach + Owner)
- `src/components/coach/StudentDetailClient.tsx` — Coach student detail client with tabs (work, roadmap, reports), KPI summary, session/report props
- `src/components/owner/OwnerStudentDetailClient.tsx` — Owner student detail client with tabs + coach assignment, same tab structure
- `src/components/coach/StudentDetailTabs.tsx` — Shared tab component (TabKey = "work" | "roadmap" | "reports"), ARIA roles

### Tab Content Components (being replaced)
- `src/components/coach/WorkSessionsTab.tsx` — Work sessions list grouped by date, session status badges
- `src/components/coach/ReportsTab.tsx` — Reports list with date, hours, star rating, outreach count, review status

### Server Pages
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Coach student detail server page with Promise.all data fetching
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Owner student detail server page with Promise.all data fetching

### Config & Utilities
- `src/lib/config.ts` — KPI_TARGETS, WORK_TRACKER, roadmap steps config
- `src/lib/kpi.ts` — RAG calculation functions, color class helpers
- `src/lib/utils.ts` — formatHoursMinutes, getTodayUTC

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StudentDetailTabs` component — tab bar with ARIA roles; needs TabKey update to include "calendar" and remove "work"/"reports"
- `WorkSessionsTab` data types and formatting — session display logic reusable inside day detail panel
- `ReportsTab` data types and formatting — report display logic reusable inside day detail panel
- `Card`, `CardContent`, `Badge` components — for day detail panel layout
- `EmptyState` component — for empty calendar states
- `kpi.ts` RAG functions — if day detail needs RAG indicators
- `formatHoursMinutes()` — for session duration display in day detail

### Established Patterns
- Server components for all reads with `createAdminClient()` + user ID filter
- `Promise.all` parallel fetch in student detail pages — calendar data queries slot in
- Tab state via `useState` + `window.history.replaceState` for URL param sync
- Both coach and owner pages share the same tab components from `src/components/coach/`
- `motion-safe:` prefix on all animations, `min-h-[44px]` on interactive elements
- Date formatting with `T00:00:00Z` suffix for UTC consistency

### Integration Points
- Both `StudentDetailClient` and `OwnerStudentDetailClient` render tabs and conditionally show tab content — calendar component slots in here
- Server pages fetch sessions + reports and pass as props — need to restructure for month-scoped calendar data
- URL `?tab=` param needs updating (calendar replaces work/reports)
- `?month=YYYY-MM` param for month navigation (server-side query scoping)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred all decisions to Claude's discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-calendar-view*
*Context gathered: 2026-03-28*
