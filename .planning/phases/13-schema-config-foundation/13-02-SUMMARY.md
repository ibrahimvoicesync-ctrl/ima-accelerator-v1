---
phase: 13-schema-config-foundation
plan: "02"
subsystem: config-utils
tags: [config, utilities, kpi-targets, roadmap, typescript]
dependency_graph:
  requires: []
  provides:
    - "WORK_TRACKER.sessionDurationOptions ([30, 45, 60])"
    - "WORK_TRACKER.defaultSessionMinutes (45)"
    - "KPI_TARGETS export ({ lifetimeOutreach: 2500, dailyOutreach: 50 })"
    - "ROADMAP_STEPS[*].target_days (all 10 steps)"
    - "VALIDATION outreach fields (outreachBrands, outreachInfluencers, brandsContacted, influencersContacted, callsJoined)"
    - "getTodayUTC() utility in utils.ts"
  affects:
    - "Phase 14 (Flexible Work Sessions) — consumes sessionDurationOptions, defaultSessionMinutes"
    - "Phase 15 (Outreach KPI Banner) — consumes KPI_TARGETS and outreach validation bounds"
    - "Phase 18 (Roadmap Date KPIs) — consumes target_days and getTodayUTC()"
tech_stack:
  added: []
  patterns:
    - "as const readonly tuple for sessionDurationOptions"
    - "UTC date utility via toISOString().split('T')[0]"
key_files:
  created: []
  modified:
    - src/lib/config.ts
    - src/lib/utils.ts
decisions:
  - "target_days values are placeholders (1, 3, 7, 14, 21, 28, 35, 42, 49, 56) pending Abu Lahya confirmation"
  - "sessionMinutes/cyclesPerDay/breakMinutes kept in WORK_TRACKER for backward compat — Phase 14 migrates consumers"
  - "callsJoined max: 100 (not 500) because daily call count is realistically much lower than outreach"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-27"
  tasks: 2
  files: 2
---

# Phase 13 Plan 02: Config & Utility Additions Summary

**One-liner:** Extended config.ts with sessionDurationOptions, KPI_TARGETS, per-step target_days, and five outreach validation bounds; added getTodayUTC() UTC date utility to utils.ts.

## What Was Done

Updated `src/lib/config.ts` with all config foundation additions for v1.1 feature phases, and added `getTodayUTC()` to `src/lib/utils.ts`. Both files pass `npx tsc --noEmit` with zero errors.

## Tasks

### Task 1: Add session duration options, KPI targets, target_days, and validation to config.ts

**Commit:** `7407fb1`
**Files:** `src/lib/config.ts`

Changes made:
- Added `sessionDurationOptions: [30, 45, 60] as const` and `defaultSessionMinutes: 45` to `WORK_TRACKER`
- Added new `KPI_TARGETS` export (section 5.5) with `lifetimeOutreach: 2500` and `dailyOutreach: 50`
- Added `target_days` to all 10 `ROADMAP_STEPS` entries: 1, 3, 7, 14, 21, 28, 35, 42, 49, 56
- Added TODO comment on ROADMAP_STEPS to confirm values with Abu Lahya before Phase 18 ships
- Added 5 new outreach validation entries: `outreachBrands`, `outreachInfluencers`, `brandsContacted`, `influencersContacted`, `callsJoined`
- Added `kpiTargets: KPI_TARGETS` to default config export (between `workTracker` and `roadmap`)
- Preserved all existing WORK_TRACKER properties (`sessionMinutes`, `breakMinutes`, `cyclesPerDay`)

### Task 2: Add getTodayUTC() utility to utils.ts

**Commit:** `870e871`
**Files:** `src/lib/utils.ts`

Changes made:
- Added `getTodayUTC()` function immediately after `getToday()`
- Returns `new Date().toISOString().split("T")[0]` — UTC YYYY-MM-DD
- Includes JSDoc comment: `/** Returns today's date as YYYY-MM-DD in UTC */`
- `getToday()` unchanged — both coexist for different use cases

## Verification

- `npx tsc --noEmit`: PASSED (zero errors)
- `npm run lint`: PASSED (3 pre-existing warnings in unrelated files, zero errors)
- All acceptance criteria met:
  - `sessionDurationOptions: [30, 45, 60] as const` present in WORK_TRACKER
  - `defaultSessionMinutes: 45` present in WORK_TRACKER
  - `export const KPI_TARGETS` present with lifetimeOutreach: 2500 and dailyOutreach: 50
  - All 10 ROADMAP_STEPS have target_days (1..56)
  - TODO comment present on ROADMAP_STEPS
  - `outreachBrands: { min: 0, max: 500 }` in VALIDATION
  - `callsJoined: { min: 0, max: 100 }` in VALIDATION
  - `kpiTargets: KPI_TARGETS` in default export
  - `sessionMinutes: 45`, `cyclesPerDay: 4`, `breakMinutes: 15` all preserved
  - `export function getTodayUTC(): string` in utils.ts
  - Return value uses `toISOString().split("T")[0]`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports are wired with real values, no placeholders preventing plan goal achievement. The target_days values are documented placeholders by design (noted in plan), acceptable during development.

## Self-Check: PASSED

- `src/lib/config.ts`: FOUND and verified
- `src/lib/utils.ts`: FOUND and verified
- Commit `7407fb1`: FOUND
- Commit `870e871`: FOUND
