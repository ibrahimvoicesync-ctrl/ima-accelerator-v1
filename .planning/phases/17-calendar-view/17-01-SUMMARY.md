---
phase: 17-calendar-view
plan: 01
subsystem: ui
tags: [react-day-picker, calendar, tabs, coach, date-fns]

# Dependency graph
requires:
  - phase: 16-coach-owner-kpi-visibility
    provides: StudentDetailTabs and coach student detail page infrastructure

provides:
  - CalendarTab component with DayPicker month grid, activity dot indicators, and day detail panel
  - react-day-picker@^9.14.0 installed as new dependency
  - StudentDetailTabs updated to "calendar" | "roadmap" TabKey (Work Sessions and Reports tabs removed)

affects: [17-02, coach student detail pages, owner student detail pages]

# Tech tracking
tech-stack:
  added: [react-day-picker@^9.14.0]
  patterns:
    - Custom DayButton closure pattern — ActivityDayButton nested inside CalendarTab for getActivity closure
    - UTC-safe date helpers using getUTCFullYear/getUTCMonth/getUTCDate to avoid timezone boundary shifts
    - No stylesheet import — classNames prop used exclusively for full ima-* token control
    - router.push for month navigation (triggers server re-render for fresh data, not replaceState)
    - Toggle-select pattern — clicking selected date deselects (setSelectedDate toggles to null)

key-files:
  created:
    - src/components/coach/CalendarTab.tsx
  modified:
    - src/components/coach/StudentDetailTabs.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "ActivityDayButton nested inside CalendarTab as closure over getActivity — avoids prop drilling"
  - "No react-day-picker stylesheet import — classNames prop gives full ima-* token control"
  - "router.push (not replaceState) for month navigation — triggers server re-render for fresh month data"
  - "setSelectedDate(null) on month change — clears stale detail panel when navigating months"
  - "CalendarTab accepts pre-fetched sessions/reports arrays — server page does the querying (Plan 02 wires this)"

patterns-established:
  - "UTC date helper: dateStrUTC(d) uses getUTCFullYear/getUTCMonth/getUTCDate — reuse in Plan 02 server pages"
  - "DayPicker classNames prop pattern — all styling via ima-* tokens, no stylesheet"

requirements-completed: [CAL-01, CAL-02, CAL-03, CAL-04]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 17 Plan 01: Calendar View Component Summary

**react-day-picker month grid with green/amber activity dots, toggle day detail panel (sessions + report side by side), and two-tab StudentDetailTabs (Calendar + Roadmap)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-28T16:30:57Z
- **Completed:** 2026-03-28T16:33:10Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (CalendarTab.tsx created, StudentDetailTabs.tsx updated, package.json, package-lock.json)

## Accomplishments
- Installed react-day-picker@^9.14.0 (only new npm dep in v1.1, React 19 compat)
- Created CalendarTab.tsx (236 lines) with full month grid, activity dots, and day detail panel
- Updated StudentDetailTabs TabKey from "work" | "roadmap" | "reports" to "calendar" | "roadmap"
- All ima-* design tokens, 44px touch targets, and ARIA attributes in place

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-day-picker and update StudentDetailTabs** - `ea9bde2` (feat)
2. **Task 2: Create CalendarTab component** - `600a116` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/coach/CalendarTab.tsx` - Month grid calendar with DayPicker, activity indicators (green=full, amber=partial), clickable day detail panel, month navigation via router.push
- `src/components/coach/StudentDetailTabs.tsx` - TabKey updated to "calendar" | "roadmap", two-entry tabs array
- `package.json` - Added react-day-picker@^9.14.0 dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- ActivityDayButton nested inside CalendarTab to close over getActivity without prop drilling
- No react-day-picker stylesheet import — classNames prop gives full control with ima-* tokens
- router.push for month navigation (not replaceState) to trigger server re-render for fresh data
- setSelectedDate(null) on month change to prevent stale detail panel from prior month
- CalendarTab accepts pre-fetched sessions/reports arrays — server page fetching left to Plan 02

## Deviations from Plan

None — plan executed exactly as written. TypeScript errors in StudentDetailClient.tsx and OwnerStudentDetailClient.tsx referencing old TabKey values ("work", "reports") are expected per the plan and will be fixed in Plan 02.

## Issues Encountered

None. TypeScript check confirmed CalendarTab.tsx is type-correct. Only expected pre-existing errors from consumer files that reference the old TabKey union (Plan 02 fix).

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — CalendarTab accepts real data props and renders all fields. No hardcoded empty values or placeholder text that blocks plan goals. Plan 02 will wire the server-side data fetching.

## Next Phase Readiness
- CalendarTab.tsx is ready — Plan 02 wires it into StudentDetailClient.tsx, OwnerStudentDetailClient.tsx, and server pages
- StudentDetailTabs TabKey updated — Plan 02 fixes the two TypeScript errors in consumer components
- react-day-picker installed and importable

---
*Phase: 17-calendar-view*
*Completed: 2026-03-28*
