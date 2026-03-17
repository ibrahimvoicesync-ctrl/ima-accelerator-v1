---
phase: 07-coach-report-review-invites-analytics
plan: "01"
subsystem: api, ui
tags: [coach, reports, supabase, react, next.js, typescript]

# Dependency graph
requires:
  - phase: 06-coach-dashboard-student-views
    provides: coach auth pattern, admin client usage, StudentCard component patterns
  - phase: 05-student-daily-reports-ai-chat
    provides: daily_reports table, POST /api/reports route pattern

provides:
  - PATCH /api/reports/[id]/review — toggle review status for coach
  - /coach/reports page — 7-day report inbox with stat cards
  - CoachReportsClient — filter tabs, student dropdown, optimistic toggle
  - ReportRow — expandable details/summary with star display and review toggle

affects:
  - 07-02 (invites)
  - 07-03 (analytics — reads reviewed_by for coach metrics)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Defense-in-depth ownership check: verify student belongs to coach before mutating report
    - Optimistic UI with local state + PATCH fetch, toast on success/error
    - details/summary for zero-JS expandable rows (accessible, no state needed)
    - Server-side filter application via searchParams, client navigates with router.push

key-files:
  created:
    - src/app/api/reports/[id]/review/route.ts
    - src/app/(dashboard)/coach/reports/page.tsx
    - src/components/coach/CoachReportsClient.tsx
    - src/components/coach/ReportRow.tsx
  modified: []

key-decisions:
  - "ReportItem.submitted_at typed as string|null to match DB type (filtered .not('submitted_at', 'is', null) guarantees non-null at runtime)"
  - "details/summary HTML used for expandable rows — no useState needed, fully accessible"
  - "toastRef stores toast function (not full useToast context) — stable ref pattern for async callbacks"

patterns-established:
  - "Coach report inbox: server fetches all, client handles optimistic toggle via PATCH + local state"
  - "Defense-in-depth: API verifies student.coach_id === profile.id before updating report"

requirements-completed: [COACH-04]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 7 Plan 01: Coach Report Review Summary

**PATCH /api/reports/[id]/review toggle route and /coach/reports inbox with filter tabs, student dropdown, expandable rows, and optimistic review toggle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T13:47:24Z
- **Completed:** 2026-03-17T13:50:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Coach-only PATCH route with defense-in-depth: verifies student belongs to requesting coach before toggling reviewed_by/reviewed_at
- /coach/reports server page with 4 stat cards (Total, Pending, Reviewed, Avg Hours) and searchParam-based filter state
- CoachReportsClient with filter tabs (Unreviewed/Reviewed/All), student dropdown, and optimistic toggle with stable router+toast refs
- ReportRow with HTML details/summary for zero-JS accordion, Unicode star display with role="img", and 44px touch targets on all interactive elements

## Task Commits

1. **Task 1: PATCH /api/reports/[id]/review route** - `9768388` (feat)
2. **Task 2: Report inbox page + CoachReportsClient + ReportRow** - `ea2bf86` (feat)

**Plan metadata:** TBD (docs)

## Files Created/Modified
- `src/app/api/reports/[id]/review/route.ts` - PATCH handler for toggling report review status
- `src/app/(dashboard)/coach/reports/page.tsx` - Server page with stat cards, data fetching, searchParam filters
- `src/components/coach/CoachReportsClient.tsx` - Client component with filter tabs, student dropdown, optimistic review toggle
- `src/components/coach/ReportRow.tsx` - Expandable report row with star display, review/un-review buttons

## Decisions Made
- `ReportItem.submitted_at` typed as `string | null` to match the DB-generated TypeScript type, even though the query filters with `.not("submitted_at", "is", null)`. Runtime guarantees non-null, but TypeScript needs the broader type.
- Used HTML `<details>/<summary>` for expandable rows — no React state needed, browser handles accordion natively, fully accessible.
- Toast ref stores the `toast` function extracted from `useToast()`, following the stable ref pattern established in Phase 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ReportItem.submitted_at type mismatch**
- **Found during:** Task 2 (TypeScript check after creating page.tsx)
- **Issue:** TypeScript error: DB type for `submitted_at` is `string | null` but `ReportItem` declared it as `string`, causing type incompatibility when passing filteredReports to CoachReportsClient
- **Fix:** Changed `submitted_at: string` to `submitted_at: string | null` in the `ReportItem` type in CoachReportsClient.tsx
- **Files modified:** src/components/coach/CoachReportsClient.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** ea2bf86 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type bug)
**Impact on plan:** Necessary for type correctness. No scope creep.

## Issues Encountered
None beyond the type fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Coach report review system complete — coaches can now review/un-review reports from the /coach/reports inbox
- Ready for Phase 7 Plan 02 (coach invites) and Plan 03 (coach analytics)
- The reviewed_by field is now being toggled, which feeds into coach analytics (Plan 03)

---
*Phase: 07-coach-report-review-invites-analytics*
*Completed: 2026-03-17*
