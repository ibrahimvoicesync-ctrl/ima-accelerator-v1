---
phase: 34-report-comments
plan: "02"
subsystem: report-surfaces
tags: [comments, coach, owner, student, calendar, wiring]
dependency_graph:
  requires:
    - 34-01 (CommentForm, CoachFeedbackCard, POST /api/reports/[id]/comment)
  provides:
    - CommentForm wired in ReportRow expanded section
    - CommentForm wired in CalendarTab daily report panel (coach + owner)
    - CoachFeedbackCard displayed on student report history
    - Comments threaded through server pages and calendar API
  affects:
    - src/components/coach/CoachReportsClient.tsx (ReportItem type expanded)
    - src/components/coach/ReportRow.tsx (renders CommentForm)
    - src/components/coach/CalendarTab.tsx (accepts comments prop, renders CommentForm)
    - src/components/coach/StudentDetailClient.tsx (threads calendarComments)
    - src/components/owner/OwnerStudentDetailClient.tsx (threads calendarComments)
    - src/app/(dashboard)/coach/reports/page.tsx (fetches comments, passes existingComment)
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx (fetches calendarComments)
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx (fetches calendarComments)
    - src/app/api/calendar/route.ts (includes comments in response)
    - src/app/(dashboard)/student/report/history/page.tsx (renders CoachFeedbackCard)
tech_stack:
  added: []
  patterns:
    - Post-query comment fetch with reportIds .in() — avoids modifying existing queries
    - displayComments state in CalendarTab with month-change sync (Pitfall 2 resolved)
    - Array-shaped report_comments join on student history for defensive Supabase handling
key_files:
  created: []
  modified:
    - src/components/coach/CoachReportsClient.tsx
    - src/components/coach/ReportRow.tsx
    - src/app/(dashboard)/coach/reports/page.tsx
    - src/components/coach/CalendarTab.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/app/api/calendar/route.ts
    - src/app/(dashboard)/student/report/history/page.tsx
decisions:
  - "Array-shaped report_comments in student history type — safer than single-object; access [0] defensively"
  - "Post-query comments fetch (sequential after reports) instead of parallel — report IDs needed first"
  - "displayComments state initialized from comments prop — synced in handleMonthChange so pre-fill survives month navigation"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 10
---

# Phase 34 Plan 02: Report Comments — Surface Wiring Summary

**One-liner:** CommentForm wired into coach ReportRow expanded section and CalendarTab (coach + owner), CoachFeedbackCard rendered on student history with nested coach join, comment data threaded through all server pages and calendar API month-change response.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire CommentForm into coach/owner report surfaces and thread comment data | 5c7741c | CoachReportsClient.tsx, ReportRow.tsx, coach/reports/page.tsx, CalendarTab.tsx, StudentDetailClient.tsx, OwnerStudentDetailClient.tsx, coach/[studentId]/page.tsx, owner/[studentId]/page.tsx, calendar/route.ts |
| 2 | Display CoachFeedbackCard on student report history | c469f64 | student/report/history/page.tsx |

## What Was Built

**Coach Reports Page** (`src/app/(dashboard)/coach/reports/page.tsx`):
- Fetches all `report_comments` for the current page's report IDs after the existing reports query
- Builds `commentMap: Record<string, string>` keyed by report_id
- Maps `filteredReports` to `reportsWithComments` adding `existingComment` per report
- Passes `reportsWithComments` to `CoachReportsClient`

**CoachReportsClient / ReportItem** (`src/components/coach/CoachReportsClient.tsx`):
- Added `existingComment: string | null` to `ReportItem` type — used by ReportRow

**ReportRow** (`src/components/coach/ReportRow.tsx`):
- Added `import { CommentForm }` from shared/CommentForm
- Renders `<CommentForm reportId={report.id} initialComment={report.existingComment} />` in a second CardContent below the wins/improvements section inside `<details>` (D-01)

**CalendarTab** (`src/components/coach/CalendarTab.tsx`):
- Added `CalendarComment` type and `comments: Record<string, CalendarComment>` to props
- `displayComments` state initialized from `comments` prop
- `handleMonthChange` sets `displayComments(data.comments ?? {})` after fetching new month data (D-05, Pitfall 2 resolved)
- Renders `<CommentForm reportId={selectedReport.id} initialComment={displayComments[selectedReport.id]?.comment ?? null} />` inside the Daily Report card when a report exists (D-02)

**StudentDetailClient** (`src/components/coach/StudentDetailClient.tsx`):
- Added `calendarComments: Record<string, { comment: string }>` prop
- Passes `comments={calendarComments}` to CalendarTab

**OwnerStudentDetailClient** (`src/components/owner/OwnerStudentDetailClient.tsx`):
- Same change as StudentDetailClient — added `calendarComments` prop and threaded to CalendarTab (D-02 for owner)

**Coach Student Detail Page** (`src/app/(dashboard)/coach/students/[studentId]/page.tsx`):
- Fetches `report_comments` for `calendarReportIds` after the RPC call
- Builds `calendarComments: Record<string, { comment: string }>` lookup
- Passes `calendarComments={calendarComments}` to StudentDetailClient

**Owner Student Detail Page** (`src/app/(dashboard)/owner/students/[studentId]/page.tsx`):
- Identical pattern to coach page — fetches and passes `calendarComments`

**Calendar API** (`src/app/api/calendar/route.ts`):
- After existing sessions+reports Promise.all and error checks, fetches `report_comments` for fetched report IDs
- Builds `commentsMap: Record<string, { comment: string }>`
- Returns `{ sessions, reports, comments: commentsMap }` so month-change pre-fills correctly

**Student Report History** (`src/app/(dashboard)/student/report/history/page.tsx`):
- Added `import { CoachFeedbackCard }` from shared/CoachFeedbackCard
- Updated select query to join `report_comments ( id, comment, updated_at, coach:users!report_comments_coach_id_fkey ( name ) )`
- Defined `ReportWithComment` type with `report_comments` as `Array<...> | null` (defensive — handles both isOneToOne and array Supabase shapes)
- Wrapped each report card in `<div className="space-y-2">` with key on wrapper
- Renders `<CoachFeedbackCard>` below each card when `report.report_comments?.[0]` has a comment (D-03)

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit`: Passes with zero errors after both tasks
- `npm run build`: Succeeds — 41 routes compiled, all pages static-generated
- `npm run lint` on plan-modified files: Zero errors; 1 pre-existing warning in CalendarTab (`modifiers` unused — present before this plan)
- Lint errors in coach/owner student detail pages (`Date.now()` impurity) are pre-existing — present before Task 1, not introduced by this plan

## Known Stubs

None — all data paths are wired. Comments are fetched from real DB queries, passed through props, and rendered conditionally.

## Pre-existing Lint Issues (deferred)

- `src/app/(dashboard)/coach/students/[studentId]/page.tsx:100` — `Date.now()` impurity warning (pre-existing)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx:121` — `Date.now()` impurity warning (pre-existing)
- `load-tests/scripts/gen-tokens.js` — `require()` style imports (pre-existing)

## Self-Check: PASSED

- FOUND: src/components/coach/CoachReportsClient.tsx contains `existingComment: string | null`
- FOUND: src/components/coach/ReportRow.tsx contains `import { CommentForm }` and `<CommentForm reportId={report.id} initialComment={report.existingComment}`
- FOUND: src/components/coach/CalendarTab.tsx contains `comments: Record<string, CalendarComment>` and `<CommentForm` with `displayComments[selectedReport.id]`
- FOUND: src/app/(dashboard)/coach/reports/page.tsx contains `.from("report_comments")` query
- FOUND: src/app/(dashboard)/coach/students/[studentId]/page.tsx contains `calendarComments` prop passed to StudentDetailClient
- FOUND: src/app/(dashboard)/owner/students/[studentId]/page.tsx contains `calendarComments` prop passed to OwnerStudentDetailClient
- FOUND: src/app/api/calendar/route.ts response contains `comments:` field
- FOUND: src/app/(dashboard)/student/report/history/page.tsx contains `import { CoachFeedbackCard }`, nested join with `report_comments`, `coach:users!report_comments_coach_id_fkey`, and `<CoachFeedbackCard`
- FOUND commit 5c7741c (feat(34-02): wire CommentForm into coach/owner report surfaces and thread comment data)
- FOUND commit c469f64 (feat(34-02): display CoachFeedbackCard on student report history)
