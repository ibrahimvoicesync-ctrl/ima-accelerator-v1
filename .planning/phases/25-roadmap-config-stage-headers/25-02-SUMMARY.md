---
phase: 25-roadmap-config-stage-headers
plan: 02
subsystem: ui
tags: [roadmap, config, react, tailwind, stage-headers, coach, owner]

# Dependency graph
requires:
  - phase: 25-roadmap-config-stage-headers
    provides: Updated ROADMAP_STEPS with stage/stageName fields; student RoadmapClient stage grouping pattern
provides:
  - Stage-grouped roadmap rendering for coach and owner views in RoadmapTab
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same stage grouping pattern as student view: [...new Map(ROADMAP_STEPS.map(s => [s.stage, s.stageName])).entries()].map(...)"
    - "Stage header: text-xs font-semibold uppercase tracking-wider text-ima-text-muted + flex-1 h-px bg-ima-border"

key-files:
  created: []
  modified:
    - src/components/coach/RoadmapTab.tsx

key-decisions:
  - "Stages array derived from ROADMAP_STEPS config at render time (not hardcoded) per Config-is-truth rule"
  - "No per-stage isLast prop needed in RoadmapTab — it renders flat step divs, not RoadmapStep components with connecting lines"

patterns-established:
  - "Stage grouping in coach/owner view matches student view exactly: same header markup, same ima-* tokens"

requirements-completed: [ROAD-06]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 25 Plan 02: Roadmap Config & Stage Headers Summary

**Coach and owner RoadmapTab now renders three stage headers (Setup & Preparation, Influencer Outreach, Brand Outreach) derived from config stageName fields, matching the student roadmap view**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-31T06:14:00Z
- **Completed:** 2026-03-31T06:16:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced flat `ROADMAP_STEPS.map(...)` in RoadmapTab with stage-grouped rendering driven by config stageName
- Added three stage headers (Setup & Preparation, Influencer Outreach, Brand Outreach) using ima-* design tokens
- Outer timeline div spacing updated from `space-y-4` to `space-y-6`; stage groups use `space-y-3` for tighter step spacing
- All existing functionality preserved: progress bar, deadline chips, step status icons

## Task Commits

Each task was committed atomically:

1. **Task 1: Add stage header grouping to coach/owner RoadmapTab** - `ca87356` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/components/coach/RoadmapTab.tsx` - Replaced flat ROADMAP_STEPS.map with stage-grouped rendering; added stages array derived from config; added stage header divs with ima-* tokens; outer space-y-4 -> space-y-6; stage groups use space-y-3

## Decisions Made

- Stages array derived at render time from ROADMAP_STEPS config fields (not hardcoded stage names), adhering to "Config is truth" CLAUDE.md rule
- No isLast prop needed in this component — RoadmapTab uses flat divs per step, not RoadmapStep components with connecting timeline lines
- Stage header horizontal rule uses `bg-ima-border` and `aria-hidden="true"` per accessibility and ima-* token rules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both student (RoadmapClient) and coach/owner (RoadmapTab) roadmap views now show three stage headers driven by config
- All Phase 25 ROAD requirements (ROAD-01 through ROAD-06) satisfied
- Phase 25 complete — next phases cover coach/owner roadmap undo and daily session planner

---
*Phase: 25-roadmap-config-stage-headers*
*Completed: 2026-03-31*

## Self-Check: PASSED

- FOUND: src/components/coach/RoadmapTab.tsx
- FOUND: .planning/phases/25-roadmap-config-stage-headers/25-02-SUMMARY.md
- FOUND commit: ca87356 (feat(25-02): add stage header grouping to coach/owner RoadmapTab)
