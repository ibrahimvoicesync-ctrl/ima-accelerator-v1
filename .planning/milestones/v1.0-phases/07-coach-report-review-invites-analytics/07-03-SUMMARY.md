---
phase: 07-coach-report-review-invites-analytics
plan: "03"
subsystem: coach-analytics
tags: [analytics, sidebar, badge, server-component, data-aggregation]
dependency_graph:
  requires: []
  provides: [coach-analytics-page, sidebar-badge-live-count]
  affects: [dashboard-layout, sidebar-navigation]
tech_stack:
  added: []
  patterns: [parallel-fetch, admin-client-queries, server-component-aggregation]
key_files:
  created:
    - src/app/(dashboard)/coach/analytics/page.tsx
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/components/layout/Sidebar.tsx
decisions:
  - "analytics page uses allStudents (not .eq status active) to count new/inactive students not filtered out by status"
  - "badgeCounts computed in DashboardLayout server component — single source of truth for all nav badge counts"
  - "layout.tsx profile select extended to include id field — avoids second auth_id lookup for badge computation"
metrics:
  duration: "4 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_modified: 3
---

# Phase 7 Plan 3: Coach Analytics + Sidebar Badge Summary

One-liner: Coach analytics page with 4 metric stat cards (submission rate, star rating, hours/day, outreach) and live sidebar Reports badge showing unreviewed report count.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build coach analytics page with stat cards and student breakdown | 5f6861d | src/app/(dashboard)/coach/analytics/page.tsx |
| 2 | Wire sidebar Reports badge with actual unreviewed count | d0ade0f | src/components/layout/Sidebar.tsx, src/app/(dashboard)/layout.tsx |

## What Was Built

### Task 1 — /coach/analytics page

Server component at `src/app/(dashboard)/coach/analytics/page.tsx` that:

- Authenticates with `requireRole("coach")`
- Fetches all students assigned to the coach
- Shows an empty state card when no students are assigned
- Parallel-fetches `daily_reports` (last 7 days, `submitted_at not null`) and `work_sessions` for all student IDs
- Computes 4 aggregate metrics from raw rows:
  - **Report Submission Rate** (%) = submitted reports / (active students * 7)
  - **Avg Star Rating** across all report rows with non-null ratings
  - **Avg Hours / Day** from `hours_worked` averaged across all reports
  - **Avg Outreach Count** from `outreach_count` averaged across all reports
- Renders 4 stat cards in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` layout with ima-* icon colors
- Categorizes each student into active / at-risk / inactive / new using the same logic as coach dashboard:
  - **New**: no activity AND joined < `COACH_CONFIG.atRiskInactiveDays` (3) days ago
  - **Inactive**: no activity AND joined >= `COACH_CONFIG.reportInboxDays` (7) days ago
  - **At-Risk**: inactive 3+ days OR avg rating < `COACH_CONFIG.atRiskRatingThreshold` (2)
  - **Active**: all others
- Renders Student Breakdown card with 4 category counts in grid layout

### Task 2 — Sidebar Reports badge wired

**Sidebar.tsx:**
- Added `badgeCounts?: Record<string, number>` prop (defaults to `{}`)
- Badge only renders when `badgeCounts[item.badge] > 0` (no badge shown when 0)
- Displays actual count number instead of `(badge)` placeholder

**layout.tsx:**
- Extended profile select from `.select("role, name")` to `.select("id, role, name")`
- For coach role: fetches active student IDs, then counts `daily_reports` in last 7 days where `reviewed_by is null` and `submitted_at not null`
- Sets `badgeCounts = { unreviewed_reports: count }` and passes to Sidebar
- For non-coach roles: `badgeCounts` remains `{}`
- Uses `COACH_CONFIG.reportInboxDays` for 7-day window (imported from config)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` — passes (0 errors)
- `npm run lint` — passes (0 errors, 0 warnings in changed files)
- `npm run build` — passes; `/coach/analytics` appears as dynamic server route in build output

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/app/(dashboard)/coach/analytics/page.tsx exists | FOUND |
| src/components/layout/Sidebar.tsx exists | FOUND |
| src/app/(dashboard)/layout.tsx exists | FOUND |
| commit 5f6861d (Task 1) exists | FOUND |
| commit d0ade0f (Task 2) exists | FOUND |
