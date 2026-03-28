---
phase: 16-coach-owner-kpi-visibility
plan: 02
subsystem: ui
tags: [kpi, coach, owner, student-detail, rag, outreach]

# Dependency graph
requires:
  - phase: 16-01
    provides: StudentKpiSummary component with KpiItem, RAG logic, ROADMAP_STEPS config

provides:
  - KPI queries wired into coach student detail server page
  - KPI queries wired into owner student detail server page
  - StudentKpiSummary rendered between header and tabs on coach view
  - StudentKpiSummary rendered between header and tabs on owner view

affects: [17-calendar-view, 18-roadmap-date-kpis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page extends Promise.all with KPI sub-queries (lifetime reports, today report, today sessions)"
    - "KPI scalars computed server-side from query results before passing to client component"
    - "kpiData prop pattern: client components receive pre-computed scalars, not raw query results"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx

key-decisions:
  - "KPI queries appended to existing Promise.all as positions 4/5/6 (coach) and 6/7/8 (owner) — parallel with all other fetches, no extra waterfall"
  - "kpiData passed as a single structured prop rather than 5 individual props — keeps interface clean and extensible"
  - "StudentKpiSummary placed between header and tab bar — always visible regardless of active tab, matching plan guidance"

patterns-established:
  - "kpiData prop pattern: server page computes scalars, passes as structured object to client component"

requirements-completed: [VIS-01, VIS-02, VIS-03, VIS-04]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 16 Plan 02: Coach/Owner KPI Visibility Summary

**Read-only StudentKpiSummary card wired into coach and owner student detail pages showing live lifetime/daily outreach, hours worked, and current roadmap step with RAG colors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T08:56:41Z
- **Completed:** 2026-03-28T08:59:00Z
- **Tasks:** 2 (Task 3 is checkpoint:human-verify awaiting visual confirmation)
- **Files modified:** 4

## Accomplishments

- Coach student detail page now fetches lifetime outreach, today's daily outreach, and today's minutes worked in parallel with existing queries — zero extra waterfalls
- Owner student detail page receives identical KPI data using same query pattern
- Both pages compute `lifetimeOutreach`, `dailyOutreach`, `dailyMinutesWorked`, and `currentStepNumber` server-side and pass as `kpiData` prop
- `StudentDetailClient` and `OwnerStudentDetailClient` each accept `kpiData` and render `<StudentKpiSummary>` between the student header and the tab bar — permanently visible without switching tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add KPI queries to coach and owner server pages** - `11c0288` (feat)
2. **Task 2: Update client components to accept kpiData and render StudentKpiSummary** - `9dd7489` (feat)
3. **Task 3: Visual verification checkpoint** — awaiting human confirmation

**Plan metadata:** (docs commit to follow after Task 3)

## Files Created/Modified

- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Extended Promise.all with 3 KPI queries, added KPI scalar computation, added kpiData prop to JSX
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Same additions as coach page plus existing 5-query structure preserved
- `src/components/coach/StudentDetailClient.tsx` — Added kpiData prop, StudentKpiSummary import, JSX render between StudentHeader and StudentDetailTabs
- `src/components/owner/OwnerStudentDetailClient.tsx` — Same additions as StudentDetailClient, renders after closing div of inline header block

## Decisions Made

- KPI queries appended to existing `Promise.all` as new positions — all queries run in parallel, no added waterfall latency
- `kpiData` passed as a single structured prop rather than 5 individual props — cleaner interface, matches plan spec
- `StudentKpiSummary` placed between student header and tabs — always visible regardless of active tab per plan guidance

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

TypeScript check after Task 1 showed expected errors (kpiData prop not yet defined on client components). Resolved immediately in Task 2. Final `npx tsc --noEmit` exits clean, `npm run build` succeeds, `npm run lint` shows only 7 pre-existing warnings (0 new).

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all KPI values are wired to live Supabase queries. No hardcoded/placeholder data.

## Next Phase Readiness

- VIS-01 through VIS-04 requirements satisfied pending visual verification (Task 3 checkpoint)
- Phase 17 (Calendar View) can proceed once Task 3 human-verify is approved
- No blockers

---
*Phase: 16-coach-owner-kpi-visibility*
*Completed: 2026-03-28*
