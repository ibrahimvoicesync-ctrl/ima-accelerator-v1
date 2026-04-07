---
phase: 42-dashboard-stat-cards
plan: 01
subsystem: dashboard-ui
tags: [stat-cards, deals, student-dashboard, server-component]
dependency_graph:
  requires: [deals-table-types]
  provides: [student-deals-stat-cards, student-diy-deals-stat-cards]
  affects: [student-dashboard, student-diy-dashboard]
tech_stack:
  added: []
  patterns: [inline-stat-cards, Number-coercion-aggregation, toLocaleString-formatting]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/student_diy/page.tsx
decisions:
  - D-01 through D-09 from 42-CONTEXT.md applied exactly as specified
  - text-ima-primary chosen for stat values (matches existing progress card pattern)
  - "all time" and "from X deals" used as subtitle text
metrics:
  duration: 4m 5s
  completed: 2026-04-07
  tasks: 2
  files_modified: 2
---

# Phase 42 Plan 01: Dashboard Stat Cards Summary

Deals stat cards (Deals Closed, Total Revenue, Total Profit) added to both student and student_diy dashboards with server-side aggregation from deals table using Number() coercion and toLocaleString formatting.

## What Was Done

### Task 1: Student Dashboard Deals Stat Cards (24e530d)

- Added `Handshake`, `DollarSign`, `TrendingUp` icon imports from lucide-react
- Added deals query (`admin.from("deals").select("revenue, profit").eq("student_id", user.id)`) as 6th entry in existing Promise.all
- Added error logging: `console.error("[student dashboard] Failed to load deals:", dealsError)`
- Added aggregation: `dealsClosed` (array length), `totalRevenue` and `totalProfit` (reduce with `Number()` coercion)
- Rendered 3-card grid row (`grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6`) between KPI outreach cards and Roadmap/Report cards
- All cards use `bg-ima-surface border border-ima-border rounded-xl p-4` pattern
- All icons have `aria-hidden="true"`; values use `text-ima-primary`
- Revenue/profit formatted with `toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`

### Task 2: Student DIY Dashboard Deals Stat Cards (3a2032e)

- Same icon imports added
- Added deals query as 3rd entry in existing Promise.all (was 2 entries)
- Same error logging, aggregation, and card rendering pattern
- Cards placed as separate 3-col grid AFTER existing 2-col Work+Roadmap grid (not nested)
- Verified two separate grid divs: `sm:grid-cols-2` (existing) and `sm:grid-cols-3` (new)

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASSED |
| `npm run build` | PASSED |
| `npm run lint` (modified files) | PASSED (0 issues in modified files) |
| ima-* tokens only | PASSED (no hardcoded hex/gray) |
| aria-hidden on icons | PASSED (all 6 icon instances) |
| Number() coercion | PASSED (both files) |
| .eq("student_id", user.id) | PASSED (IDOR prevention) |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 24e530d | feat(42-01): add deals stat cards to student dashboard |
| 2 | 3a2032e | feat(42-01): add deals stat cards to student_diy dashboard |

## Self-Check: PASSED

- [x] src/app/(dashboard)/student/page.tsx exists
- [x] src/app/(dashboard)/student_diy/page.tsx exists
- [x] 42-01-SUMMARY.md exists
- [x] Commit 24e530d found
- [x] Commit 3a2032e found
