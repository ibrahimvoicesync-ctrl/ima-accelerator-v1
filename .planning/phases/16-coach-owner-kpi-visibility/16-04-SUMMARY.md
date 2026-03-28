---
phase: 16-coach-owner-kpi-visibility
plan: "04"
subsystem: ui
tags: [roadmap, seeding, lazy-init, dynamic-config, skeleton]

# Dependency graph
requires:
  - phase: 16-coach-owner-kpi-visibility/16-01
    provides: ROADMAP_STEPS expanded to 15 steps across 3 stages
provides:
  - Non-destructive additive lazy seeding in student roadmap page
  - Dynamic ROADMAP_STEPS.length references throughout student pages
  - Dynamic loading skeleton count in roadmap loading.tsx
affects: [student-roadmap, student-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive UPSERT with onConflict/ignoreDuplicates for idempotent row initialization"
    - "Dynamic config-driven UI strings via ROADMAP_STEPS.length instead of hardcoded literals"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/student/roadmap/page.tsx
    - src/app/(dashboard)/student/roadmap/loading.tsx
    - src/app/(dashboard)/student/page.tsx

key-decisions:
  - "Additive upsert pattern: only insert missing steps, never delete existing rows — preserves student progress during schema expansions"
  - "ignoreDuplicates:true on upsert makes second-visit idempotent without error logging"

patterns-established:
  - "Lazy seeding pattern: fetch -> diff existingSteps vs ROADMAP_STEPS -> upsert only missing rows"
  - "All step count strings reference ROADMAP_STEPS.length, never hardcoded numerals"

requirements-completed: [VIS-03]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 16 Plan 04: Non-Destructive Roadmap Lazy Seeding Summary

**Additive upsert replaces destructive delete-then-reinsert seeding, preserving student progress when ROADMAP_STEPS expands; all hardcoded "10 steps" strings replaced with dynamic ROADMAP_STEPS.length**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T10:00:00Z
- **Completed:** 2026-03-28T10:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced destructive lazy seeding (delete-then-reinsert) with additive upsert that only adds missing steps — a student at step 7 with 10 rows now gets steps 11-15 added as locked without losing any progress
- Made second visit to `/student/roadmap` truly idempotent via `ignoreDuplicates: true` — no spurious errors on repeated page loads
- Replaced all hardcoded "10 steps" / "10-step" strings in roadmap/page.tsx and student/page.tsx with `ROADMAP_STEPS.length`
- Updated loading skeleton in roadmap/loading.tsx to render `ROADMAP_STEPS.length` placeholder rows (15) instead of hardcoded 10

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace destructive lazy seeding with additive upsert, dynamic skeleton** - `df25942` (fix)
2. **Task 2: Fix hardcoded 10-step string on student dashboard** - `2ce332b` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(dashboard)/student/roadmap/page.tsx` - Replaced delete-then-reinsert block with additive upsert; subtitle uses ROADMAP_STEPS.length
- `src/app/(dashboard)/student/roadmap/loading.tsx` - Added ROADMAP_STEPS import; skeleton count uses ROADMAP_STEPS.length
- `src/app/(dashboard)/student/page.tsx` - Replaced hardcoded "10-step program journey" with dynamic ROADMAP_STEPS.length

## Decisions Made

- New students (0 rows): still get all 15 steps seeded as locked on first visit — acceptable since step 1 is completed automatically by the auth callback, not the roadmap page
- Missing steps always seeded as "locked" — correct behavior since missing rows only appear for students who registered before the 15-step expansion; those steps come after their current position

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Roadmap lazy seeding is now safe for 15-step schema; will remain safe for any future ROADMAP_STEPS expansion
- VIS-03 requirement satisfied: destructive seeding that caused UAT issue is resolved
- No blockers for remaining phase plans

---
*Phase: 16-coach-owner-kpi-visibility*
*Completed: 2026-03-28*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/student/roadmap/page.tsx
- FOUND: src/app/(dashboard)/student/roadmap/loading.tsx
- FOUND: src/app/(dashboard)/student/page.tsx
- FOUND: .planning/phases/16-coach-owner-kpi-visibility/16-04-SUMMARY.md
- FOUND commit: df25942 (Task 1)
- FOUND commit: 2ce332b (Task 2)
