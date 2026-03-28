---
phase: 17-calendar-view
plan: 02
subsystem: ui
tags: [calendar, server-pages, data-wiring, coach, owner]

# Dependency graph
requires:
  - phase: 17-01
    provides: CalendarTab component and updated StudentDetailTabs TabKey

provides:
  - Month-scoped server queries feeding CalendarTab on coach and owner student detail pages
  - CalendarTab wired into StudentDetailClient (role="coach") and OwnerStudentDetailClient (role="owner")
  - ?month=YYYY-MM search param support with validation and fallback to current month

affects: [coach student detail page, owner student detail page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Month bounds pattern: firstDay = monthStr-01, lastDay via setUTCMonth(+1, 0)
    - sevenDaysAgo computed before Promise.all to enable at-risk recent ratings query
    - Separate latestSessionResult/latestReportResult queries for at-risk (independent of month-scoped calendar data)
    - eslint-disable react-hooks/purity on Date.now() in async server components

key-files:
  created: []
  modified:
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx

key-decisions:
  - "sevenDaysAgo computed before Promise.all so it can be used in recentRatingsResult query"
  - "latestSessionResult and latestReportResult are separate at-risk queries — calendar-scoped data cannot be used for at-risk when user views a past month"
  - "Default tab changed from 'work' to 'calendar' — only 'roadmap' overrides, otherwise calendar is default"

# Metrics
duration: ~6min
completed: 2026-03-28
---

# Phase 17 Plan 02: Calendar Data Wiring Summary

**Month-scoped Supabase queries with ?month=YYYY-MM param validation feeding CalendarTab on both coach and owner student detail pages, replacing WorkSessionsTab/ReportsTab.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-28T16:34:00Z
- **Completed:** 2026-03-28T16:40:00Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (2 server pages, 2 client components)

## Accomplishments
- Updated both server pages to accept `?month=YYYY-MM` searchParam with regex validation and current-month fallback
- Added `getMonthBounds` logic (firstDay / lastDay via UTC setUTCMonth) for scoped queries
- Replaced old sessions query (limit 120, no session_minutes) with month-scoped + session_minutes + ascending order
- Replaced old reports query (limit 20, outreach_count) with month-scoped + brands_contacted / influencers_contacted / calls_joined
- Added dedicated at-risk queries: latestSessionResult, latestReportResult, recentRatingsResult (independent of calendar month scope)
- Moved sevenDaysAgo computation before Promise.all to feed recentRatingsResult query
- Updated StudentDetailClient: removed WorkSessionsTab/ReportsTab, added CalendarTab (role="coach"), default tab "calendar"
- Updated OwnerStudentDetailClient: removed WorkSessionsTab/ReportsTab, added CalendarTab (role="owner"), default tab "calendar"
- Fixed eslint react-hooks/purity error on Date.now() with disable comment (same pattern as original code)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update server pages with month-scoped queries** - `64771f8` (feat)
2. **Task 2: Wire CalendarTab into client components** - `0bb204c` (feat)

## Files Created/Modified
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` - Month-scoped calendar queries, ?month param, calendarSessions/calendarReports/currentMonth props
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` - Identical changes to coach server page
- `src/components/coach/StudentDetailClient.tsx` - CalendarTab replaces WorkSessionsTab/ReportsTab, props updated, default tab "calendar"
- `src/components/owner/OwnerStudentDetailClient.tsx` - CalendarTab replaces WorkSessionsTab/ReportsTab, props updated, default tab "calendar"

## Decisions Made
- sevenDaysAgo moved before Promise.all so it can be used directly in the recentRatingsResult query
- Separate latestSessionResult/latestReportResult queries ensure at-risk computation is independent of which calendar month the user is viewing
- Default tab logic: `initialTab === "roadmap" ? "roadmap" : "calendar"` — only "roadmap" can override the calendar default

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react-hooks/purity lint error on Date.now()**
- **Found during:** Task 2 verification (npm run lint)
- **Issue:** `Date.now()` call in both server pages triggered `react-hooks/purity` lint error (0 errors expected)
- **Fix:** Added `// eslint-disable-next-line react-hooks/purity -- async server component, not a hook` comment above both `Date.now()` calls, matching the pattern from the original code
- **Files modified:** Both server page files
- **Commit:** `0bb204c` (included in Task 2 commit since the fix was applied to the same files)

## Issues Encountered

One lint error (react-hooks/purity on Date.now()) auto-fixed inline per Rule 1. All other verification passed cleanly.

## User Setup Required

None — all changes are code-level. No new dependencies, environment variables, or external services.

## Known Stubs

None — CalendarTab receives real data from month-scoped queries. All fields (brands_contacted, influencers_contacted, calls_joined, session_minutes) are selected from the database and passed through.

## Next Phase Readiness
- Phase 17 complete — both plans executed, CalendarTab fully wired with live data
- Phase 18 (Roadmap Date KPIs & Completion Logging) can proceed independently

---
*Phase: 17-calendar-view*
*Completed: 2026-03-28*
