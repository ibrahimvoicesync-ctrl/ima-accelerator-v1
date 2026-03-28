---
phase: 15-outreach-kpi-banner
plan: "02"
subsystem: student-kpi-ui
tags: [kpi, rag, progress-banner, student-layout, homepage-cards]
dependency_graph:
  requires: [15-01]
  provides: [student-progress-banner, student-kpi-cards]
  affects: [student-homepage, student-work-page, student-roadmap-page, student-report-page]
tech_stack:
  added: []
  patterns: [student-sub-layout, presentational-server-component, postgrest-aggregate, rag-color-utility]
key_files:
  created:
    - src/app/(dashboard)/student/layout.tsx
    - src/components/student/ProgressBanner.tsx
  modified:
    - src/app/(dashboard)/student/page.tsx
decisions:
  - "Student sub-layout calls requireRole(student) for its own data fetching — acceptable because Next.js 16 deduplicates identical server-side auth fetch calls within the same render tree"
  - "dailyMinutesWorked in the banner comes from work_sessions (not hours_worked from daily_reports) to reflect actual completed session time, not form-entered hours"
  - "ProgressBanner exported as named export (not default) to allow tree-shaking and cleaner import syntax"
metrics:
  duration: "8m"
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 15 Plan 02: ProgressBanner + KPI Cards Summary

Sticky ProgressBanner on every student page with 6 KPI metrics (3 RAG-coded, 3 raw numbers) and 3 KPI breakdown cards on the student homepage — powered by PostgREST aggregates and the kpi.ts RAG utility from Plan 01.

## What Was Built

### Task 1 — Student sub-layout + ProgressBanner component

**src/app/(dashboard)/student/layout.tsx** — New async server component:
- Calls `requireRole("student")` for auth enforcement
- Three parallel queries: PostgREST lifetime aggregate (`outreach_brands.sum(), outreach_influencers.sum()`), today's report fields, and user `joined_at`
- Fourth sequential query for today's completed `work_sessions` to compute `dailyMinutesWorked` (actual session minutes, more accurate than form-entered hours)
- All errors logged via `console.error`, never swallowed
- Renders `<ProgressBanner>` with all 7 props above `{children}`

**src/components/student/ProgressBanner.tsx** — Presentational server component:
- No `"use client"` directive — pure server component
- Props: `lifetimeOutreach`, `dailyOutreach`, `dailyMinutesWorked`, `callsJoined`, `brandsContacted`, `influencersContacted`, `joinedAt`
- Computes `daysInProgram(joinedAt)` and three RAG statuses via kpi.ts utilities
- `sticky top-0 z-10 bg-ima-surface border-b border-ima-border` — sticks inside `<main>` without affecting sidebar
- `role="region" aria-label="KPI summary"` — proper landmark region
- Inline `KpiItem` helper: RAG items show colored dot + colored value; non-RAG items show neutral secondary text
- Calls joined, brands contacted, influencers contacted rendered without RAG per D-06

### Task 2 — Student homepage KPI breakdown cards

**src/app/(dashboard)/student/page.tsx** — Enhanced with KPI data and cards:
- Added `KPI_TARGETS` from config and all RAG functions from kpi.ts to imports
- Extended `Promise.all` with two new queries: PostgREST lifetime aggregate + user `joined_at`
- Updated `daily_reports` select to include `outreach_brands, outreach_influencers` for today's card
- Computes `lifetimeRag`, `dailyOutRag`, `hoursRag` using kpi.ts functions
- Three KPI cards inserted between Work Progress card and Roadmap/Report grid:
  - **Lifetime Outreach** — large number + RAG progress bar (pace-based RAG per D-01)
  - **Daily Outreach** — large number + RAG progress bar (target: 50/day per D-02)
  - **Hours Worked** — formatted hours + RAG progress bar (reuses existing `progressPercent` per D-03)
- All progress bars: `role="progressbar"` with `aria-valuenow/min/max/label`, `motion-safe:transition-all`, `Math.min(100, ...)` cap
- All RAG dots: `aria-hidden="true"` (decorative)
- All targets from `KPI_TARGETS`/`WORK_TRACKER` (config is truth, no hardcoded 2500/50)

## Decisions Made

1. **dailyMinutesWorked from work_sessions**: The hours KPI in the banner uses completed session minutes from `work_sessions`, not `hours_worked` from the report form. This gives real-time accuracy throughout the day — the form field auto-fills at report time, but the banner should reflect actual work done.

2. **Named export for ProgressBanner**: `export function ProgressBanner(...)` rather than `export default`. Consistent with the project's other component export patterns (e.g., `ReportForm.tsx`).

3. **No duplicate data fetching between layout and page**: The layout fetches banner data, the page fetches its own KPI data independently. Some overlap exists (lifetime aggregate is fetched in both), which is intentional — the page doesn't depend on the layout's data flow, keeping components independent.

## Deviations from Plan

None — plan executed exactly as written.

## Checkpoint: Task 3 (Visual Verification)

Task 3 is a `checkpoint:human-verify` gate. It requires visual verification of:
- ProgressBanner visible and sticky on `/student`, `/student/work`, `/student/roadmap`, `/student/report`
- KPI cards on `/student` homepage showing RAG-colored progress bars
- RAG colors: green/amber/red based on progress, neutral on day zero
- Mobile viewport (375px): banner items wrap, no overflow

This checkpoint was NOT executed — it requires human visual inspection in a browser.

## Verification

- `npm run build`: PASS (33/33 pages, 0 errors)
- `npm run lint`: PASS (0 errors, 5 pre-existing warnings in unrelated files)
- `npx tsc --noEmit` via build: PASS (Next.js Turbopack build runs TypeScript — 0 errors in project source)

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `325f939` | feat(15-02): add student sub-layout + ProgressBanner component |
| Task 2 | `8e9a2eb` | feat(15-02): add KPI breakdown cards to student homepage |

## Self-Check: PASSED
