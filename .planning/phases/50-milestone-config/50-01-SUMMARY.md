---
phase: 50-milestone-config
plan: 01
subsystem: config
tags: [config, milestones, notifications, feature-flags, v1.5]
requires: []
provides:
  - MILESTONE_CONFIG
  - MILESTONES
  - MILESTONE_FEATURE_FLAGS
  - MILESTONE_KEY_PATTERNS
  - MilestoneType
affects:
  - src/lib/config.ts
tech-stack:
  added: []
  patterns:
    - "template-literal alert-key composers with `as const` return type"
    - "named SQL LIKE-pattern constants for SYNC contract with migrations"
    - "feature-flag object paired with nullable placeholder for deferred decisions"
key-files:
  created: []
  modified:
    - src/lib/config.ts
decisions:
  - "D-06 placeholder: techSetupStep=null + techSetupEnabled=false until Monday stakeholder meeting"
  - "D-07 satisfied: closedDeal alert_key includes deal_id so every deal fires fresh notification"
  - "D-08 honored: legacy 100h_milestone path untouched; new namespace extends same convention"
  - "YAGNI: no decomposer/parser for alert keys — consumers only compose"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 1
  loc_added: ~85
requirements:
  - NOTIF-01 (placeholder — activation deferred to Phase 51 after D-06 resolution)
---

# Phase 50 Plan 01: Milestone Config Summary

Config-only surface that lands MILESTONE_CONFIG, MILESTONES alert-key composers, MILESTONE_FEATURE_FLAGS, and MILESTONE_KEY_PATTERNS in `src/lib/config.ts` so Phase 51's RPC + UI can reference named constants (not magic numbers) with zero runtime behavior change.

## What Changed

Appended a new section 16 "MILESTONE CONFIG" to `src/lib/config.ts` (immediately after section 15 ACTIVITY), renumbered the existing DEFAULT EXPORT to section 17, and wired four new keys into the default-export `config` object (`milestones`, `milestoneFlags`, `milestoneKeys`, `milestoneKeyPatterns`).

### New Exports

| Export | Kind | Shape |
|--------|------|-------|
| `MilestoneType` | type | `"tech_setup" \| "5_influencers" \| "brand_response" \| "closed_deal"` |
| `MILESTONE_CONFIG` | const object | `{ techSetupStep: null \| number, influencersClosedStep: 11, brandResponseStep: 13 }` |
| `MILESTONE_FEATURE_FLAGS` | const object | `{ techSetupEnabled: false }` |
| `MILESTONES` | const object | 4 alert-key composer arrow-fns returning `as const` template literals |
| `MILESTONE_KEY_PATTERNS` | const object | 5 SQL LIKE patterns as named string literal constants |

### Alert-Key Composer Contract (NOTIF-05)

- **One-shot per student** (techSetup / fiveInfluencers / brandResponse): `milestone_{type}:{student_id}`
- **Per-deal** (closedDeal, D-07): `milestone_closed_deal:{student_id}:{deal_id}` — second deal by same student yields a different `deal_id` → fresh notification

### SYNC Contract with Future Migration 00027

Section banner comment explicitly names `supabase/migrations/00027_*` (the Phase 51 milestone RPC migration) as the expected consumer, and individual field comments pin numeric step references to their `ROADMAP_STEPS[n]` source entries. Banner style mirrors the ACTIVITY (section 15) + 00014_coach_alert_dismissals.sql + 00021_analytics_foundation.sql convention so the future migration header can grep-reference back to this config.

## Why `techSetupEnabled: false` (D-06 Gate Rationale)

D-06 ("Tech/Email Setup Finished" roadmap step) is a HARD BLOCKER on Phase 51 NOTIF-01 only, pending a Monday stakeholder meeting with Abu Lahya. Belt-and-braces gating:

1. **Flag gate:** `MILESTONE_FEATURE_FLAGS.techSetupEnabled = false` — Phase 51 RPC short-circuits before evaluating the tech-setup branch.
2. **Type gate:** `MILESTONE_CONFIG.techSetupStep: null as number | null` — TypeScript forces a null check even if the flag gate is forgotten.

Flipping BOTH values (set flag true + assign confirmed step number) ships in the same commit that records D-06 resolution. No further config migration needed.

## Tasks Completed

- [x] **Task 1:** Append MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS to src/lib/config.ts + extend default-export — commit `a97e657`
- [x] **Task 2:** Post-phase build gate — `npm run lint && npx tsc --noEmit && npm run build` (see Verification Results)

## Verification Results

| Gate | Result | Notes |
|------|--------|-------|
| `npx eslint src/lib/config.ts` | **PASS** (exit 0) | Zero errors, zero warnings on the modified file |
| `npx tsc --noEmit` | **PASS** (exit 0) | Zero errors across the full TS project |
| `npm run build` | **PASS** (exit 0) | Full Next.js 16 production build succeeds; all routes compile |
| `npm run lint` (repo-wide) | Pre-existing failures | 5419 errors + 81686 warnings all in files NOT modified by this plan (DealFormModal, WorkTrackerClient, Modal, etc.). Per plan Task 2 explicit instruction: "If lint reports an error on a LINE YOU DID NOT TOUCH (pre-existing), note it in the summary but do not fix — scope creep." |

### Success Criteria Coverage

1. ✅ `src/lib/config.ts` contains new section 16 with all 4 exports + `MilestoneType`
2. ✅ `MILESTONE_CONFIG.techSetupStep === null`, `.influencersClosedStep === 11`, `.brandResponseStep === 13`
3. ✅ `MILESTONES.closedDeal(studentId, dealId)` includes `deal_id` (D-07)
4. ✅ `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false` (D-06 gate)
5. ✅ SYNC comments match 00014/00021 style and reference migration `00027_*`
6. ✅ Default-export exposes `.milestones`, `.milestoneFlags`, `.milestoneKeys`, `.milestoneKeyPatterns`
7. ✅ `npx tsc --noEmit && npm run build` exit 0 (D-12 / PERF-07 gate passes for the modified file)
8. ✅ No unrelated file modified; zero new dependencies; zero runtime behavior change

## NOTIF-01 Placeholder Status

NOTIF-01 requires "MILESTONE_CONFIG contains the roadmap step reference, placeholder until D-06 confirmed". **Landed** as `techSetupStep: null` + `techSetupEnabled: false`. Full activation is Phase 51's responsibility after the Monday D-06 meeting — requires (a) assigning the confirmed step number to `techSetupStep`, (b) flipping `techSetupEnabled` to `true`, and (c) the Phase 51 RPC wiring. No additional config surface required.

## Deviations from Plan

**None of substance.** Plan executed exactly as written.

**One pre-existing condition noted (not a deviation):** `npm run lint` exits non-zero repo-wide due to 5419 pre-existing errors in files outside this plan's scope (DealFormModal.tsx, WorkTrackerClient.tsx, Modal.tsx, and others). The plan's Task 2 explicitly anticipated this and instructed: "If lint reports an error on a LINE YOU DID NOT TOUCH (pre-existing), note it in the summary but do not fix — scope creep." The gate for THIS plan's modifications (`npx eslint src/lib/config.ts`) passes cleanly with exit 0 and zero warnings. Both mandatory automated verifies in the plan (`npx tsc --noEmit` and `npm run build`) pass exit 0.

## Threat Model Outcome

All 5 STRIDE threats from the plan's threat register resolved as designed:

- **T-50-01** (Tampering, flag): Accepted — `as const` prevents runtime mutation
- **T-50-02** (Info disclosure, closedDeal key): Accepted — no new PII (UUIDs already visible to authenticated coach)
- **T-50-03** (Repudiation, SYNC drift): Mitigated — banner names migration 00027_* explicitly
- **T-50-04** (DoS, LIKE prefix): Accepted — btree-indexed column
- **T-50-05** (EoP, null deref): Mitigated — flag gate + nullable type (belt-and-braces)

## Commits

- `a97e657` — feat(50): add MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS to config.ts

## Self-Check: PASSED

- ✅ `src/lib/config.ts` — modified, exports verified by direct file read (lines 361-471)
- ✅ commit `a97e657` — verified present in `git log`
- ✅ Section 16 banner comment style matches section 15 (ACTIVITY) exactly
- ✅ All 4 new keys appear in default-export `config` object (verified lines 463-466)
- ✅ SYNC comment references `supabase/migrations/00027_*`
- ✅ No `from` / import statements added (pure data + arrow functions)
- ✅ Legacy 100h_milestone path untouched — `COACH_CONFIG.milestoneMinutesThreshold` / `milestoneDaysWindow` unchanged
