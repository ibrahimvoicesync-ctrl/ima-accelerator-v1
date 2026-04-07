---
phase: 16-coach-owner-kpi-visibility
plan: 01
subsystem: ui
tags: [roadmap, kpi, config, component, rag, tailwind]

# Dependency graph
requires:
  - phase: 15-outreach-kpi-banner
    provides: KpiItem pattern in ProgressBanner.tsx, kpi.ts RAG functions, KPI_TARGETS/WORK_TRACKER config
provides:
  - 15-step ROADMAP_STEPS config with stage/stageName fields across 3 stages
  - KpiItem exported from ProgressBanner.tsx for reuse
  - StudentKpiSummary component for coach/owner read-only KPI views
affects: [16-02-coach-owner-wiring, 17-calendar-view, 18-roadmap-date-kpis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ROADMAP_STEPS with stage/stageName fields for stage-aware step display"
    - "Shared KpiItem subcomponent exported from ProgressBanner for multi-consumer reuse"
    - "Pure presentational server component for cross-role KPI display"

key-files:
  created:
    - src/components/student/StudentKpiSummary.tsx
  modified:
    - src/lib/config.ts
    - src/components/student/ProgressBanner.tsx

key-decisions:
  - "ROADMAP_STEPS expanded from 10 to 15 steps across 3 stages (Setup & Preparation, Influencer Outreach, Brand Outreach) per D-06"
  - "target_days typed as number | null (not literal) to prevent TypeScript narrowing on const array"
  - "KpiItem stays in ProgressBanner.tsx (not moved) — exported in place so both ProgressBanner and StudentKpiSummary can use it"
  - "StudentKpiSummary is a pure server component (no use client) — receives pre-computed scalars, no data fetching"
  - "Stage display format: 'Stage N: StageName — StepTitle' per D-05"

patterns-established:
  - "Shared subcomponent pattern: export small presentational pieces from their original file, import where needed"
  - "Server-safe KPI components: pass scalars as props, compute RAG inline, no client state"

requirements-completed: [VIS-03, VIS-04]

# Metrics
duration: 2min
completed: 2026-03-28
---

# Phase 16 Plan 01: Coach/Owner KPI Visibility Foundation Summary

**15-step ROADMAP_STEPS config with stage names, exported KpiItem, and new StudentKpiSummary component as read-only KPI card for coach/owner views**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-28T08:52:46Z
- **Completed:** 2026-03-28T08:54:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced 10-step ROADMAP_STEPS with 15-step array spanning 3 named stages (Setup & Preparation, Influencer Outreach, Brand Outreach) per D-06
- Exported KpiItem from ProgressBanner.tsx enabling reuse by coach/owner components
- Created StudentKpiSummary.tsx — pure server component rendering 3 RAG-coded KPIs plus current roadmap step in "Stage N: StageName — StepTitle" format per D-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ROADMAP_STEPS to 15 steps with stage names and export KpiItem** - `3001e70` (feat)
2. **Task 2: Create StudentKpiSummary component** - `357d5e1` (feat)

## Files Created/Modified
- `src/lib/config.ts` - ROADMAP_STEPS expanded from 10 to 15 entries with stage (1/2/3) and stageName fields; target_days typed as number | null
- `src/components/student/ProgressBanner.tsx` - KpiItem changed from internal function to named export
- `src/components/student/StudentKpiSummary.tsx` - New component: accepts 5 scalar props, renders Card with 3 RAG KPIs + roadmap step, uses identical kpi.ts functions as student view (D-03)

## Decisions Made
- ROADMAP_STEPS target_days uses `as number | null` assertion on each literal to prevent TypeScript from narrowing to literal types (e.g. `0`) that break downstream `number | null` consumers
- KpiItem exported in place from ProgressBanner.tsx rather than moved to a shared file — keeps co-location with ProgressBanner which also uses it
- StudentKpiSummary has no "use client" directive — it is a server component that receives pre-computed scalars; no data fetching, no client state
- Stage display format implemented as "Stage N: StageName — StepTitle" using em dash separator per D-05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - StudentKpiSummary is a presentational component only; data wiring happens in Plan 02.

## Next Phase Readiness
- Plan 02 (16-02) can now wire StudentKpiSummary into coach and owner student detail pages
- ROADMAP_STEPS with stage/stageName enables the "Stage N: StageName — StepTitle" display format
- KpiItem is available as a named import from ProgressBanner for any future consumers
- TypeScript compiles clean, production build succeeds

---
*Phase: 16-coach-owner-kpi-visibility*
*Completed: 2026-03-28*
