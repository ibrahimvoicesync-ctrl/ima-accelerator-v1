---
phase: 25-roadmap-config-stage-headers
plan: 01
subsystem: ui
tags: [roadmap, config, react, tailwind, stage-headers]

# Dependency graph
requires:
  - phase: 18-roadmap-date-kpis
    provides: RoadmapStep component with deadline chips and isLast prop
provides:
  - Updated ROADMAP_STEPS with corrected descriptions, unlock URLs, and target_days
  - Stage-grouped student roadmap view with three visible stage headers
affects:
  - 25-02 (stage headers for coach/owner RoadmapTab)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage-grouped roadmap rendering via config stageName fields (not hardcoded)"
    - "Per-stage isLast prop pattern — connecting lines stop at stage boundaries"

key-files:
  created: []
  modified:
    - src/lib/config.ts
    - src/components/student/RoadmapClient.tsx

key-decisions:
  - "isLast prop is per-stage (stageSteps.length - 1) not global, so connecting lines stop at each stage boundary"
  - "stages array derived from ROADMAP_STEPS config at render time (not hardcoded) per Config-is-truth rule"

patterns-established:
  - "Stage grouping pattern: [...new Map(ROADMAP_STEPS.map(s => [s.stage, s.stageName])).entries()].map(...)"
  - "Stage header visual: text-xs font-semibold uppercase tracking-wider text-ima-text-muted + flex-1 h-px bg-ima-border rule"

requirements-completed: [ROAD-01, ROAD-02, ROAD-03, ROAD-04, ROAD-05]

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 25 Plan 01: Roadmap Config & Stage Headers Summary

**ROADMAP_STEPS updated with parenthetical time guidance on all 8 active steps, corrected unlock URLs (step 5 = skool CRM, step 6 = null), step 6/7 description rewrites, step 8 target_days: 14, and student roadmap now renders three stage header sections**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-31T06:07:08Z
- **Completed:** 2026-03-31T06:10:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Updated all 8 active ROADMAP_STEPS descriptions with exact parenthetical time guidance (D-01)
- Moved unlock_url from step 6 to step 5 (skool CRM link), set step 6 unlock_url to null (D-02, D-03)
- Rewrote step 6 description to include "Watch 3 Influencer Roast My Email" and step 7 title/description to drafting-only (D-04, D-05)
- Set step 8 target_days from null to 14 (D-06)
- Added stage header grouping to student RoadmapClient with three visible sections (Setup & Preparation, Influencer Outreach, Brand Outreach)
- Per-stage isLast prop ensures connecting lines stop at each stage boundary, not just the global last step

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ROADMAP_STEPS config with corrected content** - `a9d460c` (feat)
2. **Task 2: Add stage header grouping to student RoadmapClient** - `d7012e1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/config.ts` - Updated ROADMAP_STEPS steps 1-8 descriptions with parenthetical time guidance; step 5 unlock_url set to skool CRM; step 6 unlock_url set to null; step 6 description rewritten; step 7 title and description rewritten (drafting only); step 8 target_days set to 14
- `src/components/student/RoadmapClient.tsx` - Added cn import, stages array derived from config, flat ROADMAP_STEPS.map replaced with stage-grouped rendering with visible stage headers using ima-* design tokens

## Decisions Made

- isLast prop passed as `i === stageSteps.length - 1` (per-stage) so the connecting timeline line does not extend past the last step of a stage into the next stage header
- Stages array derived at render time from ROADMAP_STEPS config fields (not hardcoded stage names), adhering to "Config is truth" CLAUDE.md rule
- Stage header horizontal rule uses `bg-ima-border` and `aria-hidden="true"` per accessibility and ima-* token rules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Student roadmap page now groups steps under three stage headers driven by config
- Coach/owner RoadmapTab still uses flat list (plan 25-02 covers that)
- All ROAD-01 through ROAD-05 requirements satisfied; ROAD-06 (coach/owner stage headers) covered by plan 02

---
*Phase: 25-roadmap-config-stage-headers*
*Completed: 2026-03-31*

## Self-Check: PASSED

- FOUND: src/lib/config.ts
- FOUND: src/components/student/RoadmapClient.tsx
- FOUND: .planning/phases/25-roadmap-config-stage-headers/25-01-SUMMARY.md
- FOUND commit: a9d460c (feat(25-01): update ROADMAP_STEPS with corrected descriptions and URLs)
- FOUND commit: d7012e1 (feat(25-01): add stage header grouping to student RoadmapClient)
