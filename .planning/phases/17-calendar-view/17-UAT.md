---
status: resolved
phase: 17-calendar-view
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md]
started: 2026-03-28T17:00:00Z
updated: 2026-03-28T19:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Calendar Tab Default on Coach Student Detail
expected: Navigate to a coach student detail page. The "Calendar" tab should be selected by default. A month grid for the current month (March 2026) displays with day numbers.
result: pass

### 2. Calendar Tab Default on Owner Student Detail
expected: Navigate to an owner student detail page. Same behavior — "Calendar" tab selected by default with month grid showing current month.
result: pass

### 3. Activity Dot Indicators
expected: Days that have work sessions and/or daily reports show colored dot indicators on the calendar. Green dot = both session AND report that day. Amber dot = only one of the two.
result: pass

### 4. Day Detail Panel
expected: Click a day with activity. A detail panel appears below the calendar showing session info (duration) and report info (brands contacted, influencers contacted, calls joined) for that day. Click the same day again to deselect and hide the panel.
result: issue
reported: "Detail panel data is correct — shows cycles, duration, status, hours, brands contacted, calls joined, wins, improvement. But the day selection highlight (grey background) is off by one — click day 10 and day 9 goes grey. Dots are on the correct days. Data shown is correct for the clicked day. Visual highlight misalignment only."
severity: cosmetic

### 5. Month Navigation
expected: Click the previous/next month arrows on the calendar. The calendar navigates to that month, the URL updates with ?month=YYYY-MM, and data refreshes showing activity for the new month.
result: issue
reported: "Works but has a really big delay and is laggy when navigating between months"
severity: minor

### 6. Roadmap Tab Still Works
expected: Click the "Roadmap" tab. The roadmap view displays correctly. Click back to "Calendar" — the calendar reappears.
result: pass

### 7. Old Tabs Removed
expected: The tab bar shows only "Calendar" and "Roadmap". The old "Work Sessions" and "Reports" tabs no longer appear.
result: pass

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Day selection highlight should appear on the clicked day"
  status: resolved
  reason: "User reported: clicking a day highlights (grey background) the previous day instead. Dots are correct, data is correct — only the selection highlight is off by one."
  severity: cosmetic
  test: 4
  root_cause: "Timezone mismatch in modifiers.selected (CalendarTab.tsx:138). Date constructed with UTC midnight suffix 'T00:00:00Z' but react-day-picker compares in local time via date-fns isSameDay. For users west of UTC, the UTC date rolls back one calendar day in local time. Secondary: dateStrUTC helper and getUTCDate/getUTCFullYear/getUTCMonth calls throughout the file also use UTC when react-day-picker operates in local time."
  artifacts:
    - path: "src/components/coach/CalendarTab.tsx"
      issue: "Line 138: modifiers.selected uses UTC Date; lines 51-53: dateStrUTC uses getUTC* methods; line 87: getUTCDate(); line 100: getUTCFullYear/getUTCMonth"
  missing:
    - "Replace dateStrUTC with local-time dateStrLocal using getFullYear/getMonth/getDate"
    - "Replace new Date(selectedDate + 'T00:00:00Z') with local-time Date construction"
    - "Replace all getUTC* calls with local-time equivalents"
  debug_session: ".planning/debug/calendar-day-selection-off-by-one.md"
- truth: "Month navigation should be responsive without noticeable delay"
  status: resolved
  reason: "User reported: works but has a really big delay and is laggy when navigating between months"
  severity: minor
  test: 5
  root_cause: "router.push() in handleMonthChange triggers full Next.js server re-render, re-executing all 9 (coach) or 11 (owner) Supabase queries. Only 2 queries are month-scoped — the other 7-9 are redundant work on every month click."
  artifacts:
    - path: "src/components/coach/CalendarTab.tsx"
      issue: "Line 98-103: handleMonthChange uses router.push instead of client-side state"
    - path: "src/app/(dashboard)/coach/students/[studentId]/page.tsx"
      issue: "Lines 62-124: All 9 queries re-run on month change; only 2 need to"
    - path: "src/app/(dashboard)/owner/students/[studentId]/page.tsx"
      issue: "Lines 64-138: All 11 queries re-run; only 2 need to"
  missing:
    - "Make month a client-side useState in CalendarTab, use replaceState for URL"
    - "Create lightweight API route for month-scoped calendar data only"
    - "Fetch only sessions + reports for new month via client-side fetch"
  debug_session: ".planning/debug/calendar-month-nav-laggy.md"
