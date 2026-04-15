---
phase: 57-roadmap-step-8-insertion
plan: "02"
subsystem: api
tags: [typescript, config, roadmap, milestone-config, sync-with-rpc]

requires:
  - phase: 57-roadmap-step-8-insertion
    provides: Migration 00030 hard-codes RPC step references at 12 and 14 (must match this config)
provides:
  - 16-entry ROADMAP_STEPS array with new Step 8 "Join at least one Influencer Q&A session (CPM + pricing)" at array index 7
  - Renumbered Steps 9–16 (formerly 8–15) preserving titles, descriptions, stages, target_days, unlock_url
  - MILESTONE_CONFIG.influencersClosedStep = 12 and brandResponseStep = 14 with updated SYNC comments
affects: [57-03-grep-sweep, all UI components reading ROADMAP_STEPS.length or step indices, coach milestone alerts]

tech-stack:
  added: []
  patterns:
    - "Type-system source of truth (ROADMAP_STEPS as const) deploys in lock-step with Postgres RPC step literals — change either side without the other and coach milestone alerts silently break"

key-files:
  created: []
  modified:
    - src/lib/config.ts

key-decisions:
  - "Insert the new Step 8 at the END of Stage 1 (after Draft Your First Outreach Emails) — keeps Stage 1's original 7 day-based-deadline steps semantically intact while adding the new educational milestone before Stage 2 outreach kicks off."
  - "MILESTONE_CONFIG indices use the array position (zero-based) in the SYNC comments (ROADMAP_STEPS[11].step === 12) — humans verifying the binding can find the row directly without counting."
  - "Stage banner comments updated to reflect new ranges: Stage 1 (1-8), Stage 2 (9-12), Stage 3 (13-16). The section header was bumped from '15 steps, 3 stages' to '16 steps, 3 stages'."

patterns-established:
  - "When inserting a roadmap step, update in this order: (1) section header step count, (2) Stage banner comments for the affected and downstream stages, (3) renumber existing entries' step field only (no other fields touched), (4) insert the new entry verbatim, (5) update MILESTONE_CONFIG step bindings + SYNC comments to match the post-shift array indices"

requirements-completed: [ROADMAP-01, ROADMAP-05, ROADMAP-06]

duration: 2 min
completed: 2026-04-15
---

# Phase 57 Plan 02: Config.ts ROADMAP_STEPS + MILESTONE_CONFIG Update Summary

**TypeScript half of the Step 8 insertion: ROADMAP_STEPS expanded to 16 entries with the new Q&A step at index 7, existing Stage 2/3 entries renumbered 9–16, and MILESTONE_CONFIG step bindings shifted to 12/14 to match migration 00030's RPC literals.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T17:29:38Z
- **Completed:** 2026-04-15T17:31:08Z
- **Tasks:** 3 (Tasks 1–2 modified the file; Task 3 was the type-check verification)
- **Files modified:** 1

## Accomplishments

- ROADMAP_STEPS now has exactly 16 entries with `step` values 1, 2, 3, …, 16 in order (verified via `awk` between brackets + `sort -u`)
- New Step 8 entry inserted with title "Join at least one Influencer Q&A session (CPM + pricing)", description matching D-57-01 template, target_days=5, stage=1, stageName="Setup & Preparation"
- MILESTONE_CONFIG.influencersClosedStep = 12 (was 11); MILESTONE_CONFIG.brandResponseStep = 14 (was 13); SYNC comments cite the new indices ROADMAP_STEPS[11] and ROADMAP_STEPS[13]
- `npx tsc --noEmit` runs clean (zero `error TS` lines) — downstream consumers using `ROADMAP_STEPS.length` automatically pick up 16

## Task Commits

1. **Task 1: Insert Step 8 + renumber Stage 2/3 entries to 9–16** — `44def39` (feat)
2. **Task 2: MILESTONE_CONFIG step rebind 11→12, 13→14** — `491f973` (feat)
3. **Task 3: Type-check (`npx tsc --noEmit`)** — no commit (verification only; passed cleanly)

## Files Created/Modified

- `src/lib/config.ts` — ROADMAP_STEPS expanded to 16 entries, MILESTONE_CONFIG step bindings shifted, section header + 3 stage banner comments updated

## Decisions Made

- **Description text drafted from D-57-01 template.** Final wording: "Attend a live Influencer Q&A call with the IMA team. Learn how CPM is calculated and how to price influencer deals before your first outreach email lands." — matches the existing ROADMAP_STEPS style (1-2 sentences, action-oriented, parenthetical context optional).
- **`unlock_url: null`** for the new Step 8 — no specific Loom/Skool link associated yet. Future content team can populate via a follow-up content-only PR.

### MILESTONE_CONFIG before/after audit

| Field | Before | After |
|---|---|---|
| influencersClosedStep | 11 | 12 |
| brandResponseStep | 13 | 14 |
| SYNC comment (influencersClosedStep) | "ROADMAP_STEPS[10].step === 11" | "ROADMAP_STEPS[11].step === 12. Shifted 11→12 in Phase 57 …" |
| SYNC comment (brandResponseStep) | "ROADMAP_STEPS[12].step === 13" | "ROADMAP_STEPS[13].step === 14. Shifted 13→14 in Phase 57 …" |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 57-03 (grep sweep + smoke test) is unblocked.** Both the migration (57-01) and config (57-02) halves are now committed; 57-03 can run the codebase sweep for hardcoded step literals and then issue `npx supabase db push --linked` followed by smoke verification.
- **Critical deploy invariant satisfied:** `MILESTONE_CONFIG.influencersClosedStep === 12` and `brandResponseStep === 14` now match migration 00030's `rp.step_number = 12` (five_inf CTE) and `rp.step_number = 14` (brand_resp CTE). Coach milestone alerts will continue firing correctly after deploy.

---
*Phase: 57-roadmap-step-8-insertion*
*Completed: 2026-04-15*
