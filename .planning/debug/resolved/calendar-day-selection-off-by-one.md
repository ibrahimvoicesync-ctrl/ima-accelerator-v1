---
status: resolved
trigger: "CalendarTab day selection highlight is off by one — clicking day 10 highlights day 9, but detail panel shows day 10 data correctly"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — UTC/local timezone mismatch on the modifiers.selected Date construction
test: Full code trace from click to isSameDay comparison in react-day-picker internals
expecting: n/a (confirmed)
next_action: Return diagnosis

## Symptoms

expected: Clicking day 10 should highlight day 10 with grey background
actual: Clicking day 10 highlights day 9, but the detail panel correctly shows day 10's data
errors: No errors — purely visual mismatch
reproduction: Click any day in CalendarTab; the highlighted day is one day behind
started: Since CalendarTab was added (phase 17-02)

## Eliminated

(none — root cause confirmed on first hypothesis)

## Evidence

- timestamp: 2026-03-28T00:10:00Z
  checked: react-day-picker v9.14 DayPicker.js — how internal calendar dates are created
  found: Without timeZone prop, DayPicker uses default DateLib which creates dates via `new Date(year, monthIndex, date)` — LOCAL time. Calendar day cells are local-time Date objects (e.g., March 10 = 2026-03-10T00:00:00-05:00 for EST).
  implication: The internal day.date objects are in local time.

- timestamp: 2026-03-28T00:11:00Z
  checked: CalendarTab.tsx line 138 — modifiers.selected Date construction
  found: `new Date(selectedDate + "T00:00:00Z")` creates a UTC midnight Date. For selectedDate="2026-03-10", this creates 2026-03-10T00:00:00Z which in EST is 2026-03-09T19:00:00-05:00 (March 9 local).
  implication: The modifier date lands on the PREVIOUS day in local time for users west of UTC.

- timestamp: 2026-03-28T00:12:00Z
  checked: react-day-picker dateMatchModifiers.js line 25 and date-fns isSameDay/startOfDay
  found: Modifier matching uses `isSameDay(date, matcher)` which calls `startOfDay` → `setHours(0,0,0,0)` in LOCAL time. So the UTC midnight Date (March 9 local) gets compared to each calendar cell's local-time Date. It matches March 9's cell, NOT March 10's.
  implication: This is the mechanism causing the off-by-one highlight.

- timestamp: 2026-03-28T00:13:00Z
  checked: Why detail panel and activity dots work correctly
  found: Detail panel (lines 112-113) uses selectedDate string directly for Map lookups — no Date comparison. Activity dots (line 80) use dateStrUTC(day.date) for string comparison against data Maps — also no Date comparison. Both bypass the isSameDay local-time comparison entirely.
  implication: Explains why ONLY the highlight is wrong while data and dots are correct.

- timestamp: 2026-03-28T00:14:00Z
  checked: handleDayClick (line 105-108) and dateStrUTC (line 51-53)
  found: handleDayClick receives a local-time Date from react-day-picker, then dateStrUTC extracts UTC components. For EST user clicking March 10: date is 2026-03-10T00:00:00-05:00 = 2026-03-10T05:00:00Z, so getUTCDate()=10, dateStr="2026-03-10". This is correct only because the local time is 00:00 and the UTC time is still the same calendar day. Works for west-of-UTC users but would BREAK for east-of-UTC users (see latent bug below).
  implication: The selectedDate string is correct for the reporting user, but the round-trip back to Date on line 138 breaks it.

- timestamp: 2026-03-28T00:15:00Z
  checked: Latent bugs from UTC/local mismatch throughout the component
  found: Line 87 uses day.date.getUTCDate() to display the day number — for east-of-UTC users this could show the wrong number. Line 80 uses dateStrUTC(day.date) to match activity data — for east-of-UTC this could match wrong dates. Line 100 handleMonthChange uses getUTCFullYear/getUTCMonth on a local-time Date.
  implication: The entire component has a systemic UTC-vs-local confusion. The fix should standardize on local time since react-day-picker uses local time internally.

## Resolution

root_cause: |
  LINE 138 of src/components/coach/CalendarTab.tsx:
  `modifiers={{ selected: selectedDate ? new Date(selectedDate + "T00:00:00Z") : undefined }}`

  The "T00:00:00Z" suffix creates a Date at UTC midnight. But react-day-picker (without a
  timeZone prop) creates all its internal calendar day Dates in LOCAL time and compares
  modifiers using date-fns isSameDay, which operates in local time (setHours(0,0,0,0)).

  For any user west of UTC (negative offset), the UTC midnight Date rolls back to the
  PREVIOUS calendar day in local time. E.g., for EST (UTC-5):
    new Date("2026-03-10T00:00:00Z") = 2026-03-09T19:00:00 EST → startOfDay = March 9 EST
    Calendar cell for March 10 = 2026-03-10T00:00:00 EST → startOfDay = March 10 EST
    isSameDay(March 10, March 9) = FALSE → no highlight on March 10
    isSameDay(March 9, March 9) = TRUE → highlight on March 9 instead

  SYSTEMIC ISSUE: The entire component uses dateStrUTC() and getUTCDate() on dates that
  react-day-picker provides in local time. This works accidentally for some timezones
  but is fundamentally wrong.

fix: |
  (Not applied — diagnosis only)

verification: |
  (Not applied — diagnosis only)

files_changed: []
