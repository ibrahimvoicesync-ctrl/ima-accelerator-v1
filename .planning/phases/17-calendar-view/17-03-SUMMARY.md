---
phase: 17-calendar-view
plan: "03"
subsystem: calendar
tags: [bug-fix, client-side-nav, timezone, api-route]
dependency_graph:
  requires: ["17-02"]
  provides: ["CAL-02", "CAL-03"]
  affects: [CalendarTab, api/calendar, coach-student-detail, owner-student-detail]
tech_stack:
  added: ["/api/calendar GET route"]
  patterns: ["local-time Date construction", "client-side fetch with replaceState", "SSR current-month only"]
key_files:
  created:
    - src/app/api/calendar/route.ts
  modified:
    - src/components/coach/CalendarTab.tsx
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
decisions:
  - "CalendarTab handles all month navigation client-side; server pages always SSR current month"
  - "Local-time Date construction throughout CalendarTab eliminates UTC off-by-one for any timezone west of UTC"
  - "Loading state uses opacity-50 transition only (no animate-* to avoid motion-safe requirement)"
metrics:
  duration: "4 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 17 Plan 03: Calendar Gap Closure — Timezone Fix and Client-Side Month Navigation Summary

Fixed two UAT-diagnosed gaps: UTC/local timezone off-by-one in day selection, and full server re-render on month navigation replaced by lightweight client-side fetch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix UTC/local timezone mismatch in CalendarTab | 2f41399 | src/components/coach/CalendarTab.tsx |
| 2 | Client-side month navigation with lightweight API route | beff44a | src/app/api/calendar/route.ts, coach/page.tsx, owner/page.tsx |

## What Was Built

**Task 1 — Timezone fix:**
- Replaced `dateStrUTC` (using `getUTCFullYear`/`getUTCMonth`/`getUTCDate`) with `dateStrLocal` (using `getFullYear`/`getMonth`/`getDate`)
- Fixed `ActivityDayButton` day number display: `getUTCDate()` -> `getDate()`
- Fixed `handleMonthChange` month string: `getUTCFullYear`/`getUTCMonth` -> local equivalents
- Fixed `monthDate` construction: `new Date(\`${currentMonth}-01T00:00:00Z\`)` -> `new Date(y, m-1, 1)` (local time)
- Fixed `modifiers.selected`: `new Date(selectedDate + "T00:00:00Z")` -> `new Date(y, m-1, d)` (local time)
- No `getUTC*` calls remain in CalendarTab.tsx

**Task 2 — Client-side month navigation:**
- Added `GET /api/calendar` route with auth (401), role check (403 if not coach/owner), coach ownership guard (403 if coach accesses other coach's student), student existence check (404), Zod validation on query params, parallel `work_sessions` + `daily_reports` fetch, admin client for all queries
- Added `displaySessions`, `displayReports`, `displayMonth`, `isLoadingMonth` state to CalendarTab
- `handleMonthChange` now async: updates URL via `window.history.replaceState`, fetches `/api/calendar`, updates display state
- Removed `useRouter` import from CalendarTab
- Calendar grid wrapped in `opacity-50` div when `isLoadingMonth` is true (no animate-* per CLAUDE.md hard rule 1)
- Both server pages simplified: removed `?month` searchParam parsing, always scope to `today.slice(0, 7)` for SSR initial data

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is wired through live Supabase queries.

## Self-Check: PASSED

- FOUND: src/components/coach/CalendarTab.tsx
- FOUND: src/app/api/calendar/route.ts
- FOUND: commit 2f41399 (Task 1)
- FOUND: commit beff44a (Task 2)
