---
status: diagnosed
trigger: "CalendarTab month navigation is noticeably laggy/slow — router.push triggers full server re-render"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: router.push in CalendarTab.handleMonthChange triggers full server-side page re-render, re-running 9 (coach) or 11 (owner) Supabase queries — only 2 of which are month-scoped. The remaining 7-9 queries return identical data on every month change.
test: Traced full code path from CalendarTab -> router.push -> server page -> Promise.all -> client component
expecting: Confirmed that month navigation re-executes all queries, not just calendar-scoped ones
next_action: Return diagnosis

## Symptoms

expected: Month navigation in CalendarTab should feel instant — user clicks prev/next month arrow and sees the new month's data immediately
actual: Noticeable lag on each month change; UI feels sluggish during navigation
errors: No runtime errors
reproduction: Open coach or owner student detail page, click prev/next month arrows on calendar
started: Since phase 17-02 wired CalendarTab with server-side month-scoped queries

## Eliminated

(none — root cause confirmed on first investigation pass)

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: CalendarTab.tsx handleMonthChange (line 98-103)
  found: Calls router.push(`${basePath}?tab=calendar&month=${mm}`) which is a Next.js App Router navigation. This triggers a full server-side re-render of the page component because the searchParams change.
  implication: Every month arrow click = full server round-trip

- timestamp: 2026-03-28T00:02:00Z
  checked: Coach page (coach/students/[studentId]/page.tsx) — Promise.all block (lines 62-124)
  found: 9 parallel Supabase queries run on every page render. Only 2 are month-scoped (sessionsResult using firstDay/lastDay, reportsResult using firstDay/lastDay). The other 7 are month-INDEPENDENT: roadmapResult, lifetimeReportsResult, todayReportResult, todaySessionsResult, latestSessionResult, latestReportResult, recentRatingsResult.
  implication: Changing month re-runs 7 queries that return identical data every time

- timestamp: 2026-03-28T00:03:00Z
  checked: Owner page (owner/students/[studentId]/page.tsx) — Promise.all block (lines 64-138)
  found: 11 parallel Supabase queries. Only 2 are month-scoped. The other 9 are month-INDEPENDENT (same 7 as coach + coachesResult + studentCountsResult).
  implication: Owner page is even worse — 9 redundant queries per month change

- timestamp: 2026-03-28T00:04:00Z
  checked: Whether student record fetch is also redundant
  found: The initial student fetch (line 37-42 coach, line 37-42 owner) also re-runs on every month change. Auth check (requireRole) also re-runs.
  implication: Total re-execution: auth check + student fetch + 9/11 queries = 10-12 server operations per month arrow click

- timestamp: 2026-03-28T00:05:00Z
  checked: CalendarTab receives currentMonth as prop from server page
  found: currentMonth is derived from searchParams.month in the server component, then passed to StudentDetailClient -> CalendarTab. The CalendarTab is a client component that could manage month state locally.
  implication: The month state does NOT need to live in the URL/server — it could be local client state, with only the calendar data needing refresh

- timestamp: 2026-03-28T00:06:00Z
  checked: What data actually changes when month changes
  found: Only calendarSessions and calendarReports change. Everything else (student info, KPIs, roadmap, at-risk status, coach list) is identical across month changes.
  implication: Only 2 of the 9-11 queries produce different results when the month changes. The other 7-9 are pure waste on month navigation.

- timestamp: 2026-03-28T00:07:00Z
  checked: Tab switching mechanism in StudentDetailClient (line 71-74)
  found: Tab switching uses window.history.replaceState — a pure client-side URL update with no server round-trip. This is the correct pattern — month navigation should work the same way.
  implication: The tab change pattern proves the app already uses client-side URL updates for UI state. Month navigation should follow the same pattern.

## Resolution

root_cause: |
  THREE compounding factors cause the calendar month navigation lag:

  1. UNNECESSARY FULL SERVER ROUND-TRIP (PRIMARY CAUSE):
     File: src/components/coach/CalendarTab.tsx, line 101-102
     handleMonthChange calls router.push() which triggers a full Next.js server navigation.
     This re-executes the entire server page component including auth, student fetch, and ALL queries.

  2. MASSIVE QUERY OVER-FETCH ON MONTH CHANGE:
     Files: src/app/(dashboard)/coach/students/[studentId]/page.tsx (lines 62-124)
             src/app/(dashboard)/owner/students/[studentId]/page.tsx (lines 64-138)
     The server pages run 9 queries (coach) or 11 queries (owner) in Promise.all.
     Only 2 queries are month-scoped (work_sessions + daily_reports with date filters).
     The other 7-9 queries (roadmap, lifetime reports, today's report, today's sessions,
     latest session, latest report, recent ratings, coaches list, student counts) are
     completely independent of the selected month and return identical data every time.

  3. NO CLIENT-SIDE CACHING OR SEPARATION:
     The month is treated as a URL searchParam, making it server state when it should be
     client state. The calendar data (sessions + reports for a month) should be fetched
     independently via a lightweight API endpoint or client-side fetch, while all other
     data stays static from the initial page load.

  Net effect: clicking a month arrow triggers ~10-12 server-side operations (auth + student
  fetch + 9-11 DB queries) when only 2 DB queries with different date filters are needed.

fix: |
  (Not applied — diagnosis only)

verification: |
  (Not applied — diagnosis only)

files_changed: []
