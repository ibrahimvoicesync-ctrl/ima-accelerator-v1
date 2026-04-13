---
phase: 50-milestone-config
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - src/lib/config.ts
commit: a97e657
findings:
  critical: 0
  high: 0
  medium: 0
  low: 2
  info: 3
  total: 5
status: findings
---

# Phase 50: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Commit under review:** `a97e657` (feat(50): add MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS to config.ts)
**Files Reviewed:** 1 (`src/lib/config.ts`, Section 16 + DEFAULT EXPORT renumber)
**Status:** findings (all Low/Info — no blocking issues)

## Summary

The new Section 16 "MILESTONE CONFIG" is a clean, pure-data/pure-function addition to `src/lib/config.ts`. Plan adherence is exact: every must-have from `50-01-PLAN.md` is present, D-06 gating is belt-and-braces (flag + nullable type), D-07 is satisfied (`closedDeal` includes `dealId`), and the SYNC banner style mirrors Section 15 (ACTIVITY) and migration 00014/00021.

**Correctness verification** (cross-referenced against the actual `ROADMAP_STEPS` array at `src/lib/config.ts:155-174`):
- `ROADMAP_STEPS[10].step === 11` with title "Close 5 Influencers" — **confirmed accurate** (line 168).
- `ROADMAP_STEPS[12].step === 13` with title "Get Brand Response" — **confirmed accurate** (line 171).
- `MILESTONES.closedDeal('s1','d1')` composes `milestone_closed_deal:s1:d1` — unambiguous since UUIDs contain no `:` separator. D-07 contract holds.
- `MILESTONE_KEY_PATTERNS.allV15Milestones = "milestone_%"` correctly excludes legacy `100h_milestone:%` (different prefix). Confirmed against `supabase/migrations/00014_coach_alert_dismissals.sql:116`.
- No CLAUDE.md hard rules apply to a config-only file (no animations, touch targets, inputs, fetch, catch, zod, colors).
- `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false` (D-06 gate) + `MILESTONE_CONFIG.techSetupStep: null as number | null` (type gate) — correct defense-in-depth.
- Default-export registration correctly inserted after `activity: ACTIVITY,` and before `invites: INVITE_CONFIG,` (lines 463-466).
- Zero runtime behavior change — no consumer yet reads these constants, legacy `100h_milestone:{studentId}` path untouched, `COACH_CONFIG.milestoneMinutesThreshold`/`milestoneDaysWindow` unchanged.

No bugs, no security issues, no plan deviations. Findings below are low-severity type-safety observations and info-level suggestions for Phase 51 handoff ergonomics.

## Critical Issues

None.

## High Issues

None.

## Medium Issues

None.

## Low Issues

### LO-01: `MilestoneType` is exported but never bound to the composers/config structurally

**File:** `src/lib/config.ts:376-380` (union), `382-396` (config), `420-432` (composers), `437-444` (patterns)

**Issue:** `MilestoneType` is a discriminated string-literal union (`"tech_setup" | "5_influencers" | "brand_response" | "closed_deal"`), but `MILESTONE_CONFIG`, `MILESTONES`, and `MILESTONE_KEY_PATTERNS` all use camelCase keys (`techSetupStep`, `fiveInfluencers`, `brandResponse`, `closedDeal`) that are not enforced by the type. If a future Phase 51 author adds a fifth milestone type they must manually add it to four places (the union, the config object, the composer object, and the patterns object) with zero compiler help to keep them in sync. A `Record<MilestoneType, T>` shape or a key-map type would prevent silent drift.

**Fix (non-blocking, consider in Phase 51 when a consumer emerges):**
```typescript
// Optional: bind the composers to the discriminant union
export const MILESTONES: {
  techSetup: (studentId: string) => `milestone_tech_setup:${string}`;
  fiveInfluencers: (studentId: string) => `milestone_5_influencers:${string}`;
  brandResponse: (studentId: string) => `milestone_brand_response:${string}`;
  closedDeal: (
    studentId: string,
    dealId: string,
  ) => `milestone_closed_deal:${string}:${string}`;
} = {
  /* …current values… */
} as const;
```
Or introduce `MilestoneKey = "techSetup" | "fiveInfluencers" | ...` and use it to index all three parallel records. Not required now — plan explicitly scopes to config surface only, and `as const` already narrows return types sufficiently for Phase 51's current needs.

### LO-02: `MILESTONE_KEY_PATTERNS.allV15Milestones = "milestone_%"` is prefix-greedy

**File:** `src/lib/config.ts:443`

**Issue:** The `"milestone_%"` LIKE pattern correctly excludes legacy `100h_milestone:...` keys (verified), but it would ALSO match any future namespace that begins with `milestone_` (e.g., a hypothetical `milestone_v2_foo:...` or `milestone_experimental:...`). Today there is no such collision because v1.5 owns the `milestone_*` namespace exclusively. This is a future-proofing concern only, not a bug.

**Fix (defer until there is concrete risk):** If/when a non-v1.5 namespace is added under `milestone_*`, introduce an explicit allow-list pattern or version the namespace (`milestone_v15_*`). No action needed for Phase 51.

## Info

### IN-01: `MILESTONE_KEY_PATTERNS.techSetup` is present even though `techSetupEnabled: false`

**File:** `src/lib/config.ts:438`

**Observation:** Defining the `techSetup` LIKE pattern before the feature flag flips to `true` is intentional per the plan (so Phase 51 can unconditionally reference it by name in SYNC comments). No action needed — flagged only so a future reader does not assume the pattern is dead code and delete it. The plan's own threat model T-50-05 explicitly calls out the belt-and-braces gating.

### IN-02: SYNC banner style matches 00014/00021 convention exactly

**File:** `src/lib/config.ts:361-375`

**Observation:** The banner comment correctly names `supabase/migrations/00027_*` as the expected consumer, calls out `/coach/alerts` UI and `get_sidebar_badges` as secondary consumers, and states the "new migration required to change" contract in the same shape as Section 15 (ACTIVITY, lines 347-356) and migration 00014's header. The Phase 51 executor will be able to grep-reference back to this banner unambiguously. No action needed.

### IN-03: Section-16-to-17 renumbering is the only churn in pre-existing code

**File:** `src/lib/config.ts:446`

**Observation:** The only pre-existing line changed is the banner `// 16. DEFAULT EXPORT` → `// 17. DEFAULT EXPORT — aggregate all V1 configs`. No other refactoring, reformatting, or re-ordering. This matches the plan's "DO NOT refactor or reformat any unrelated section" constraint. No action needed.

## Plan Adherence Check

| Plan Requirement | Status | Evidence |
|------------------|--------|----------|
| `MILESTONE_CONFIG.influencersClosedStep === 11` | PASS | `src/lib/config.ts:391` |
| `MILESTONE_CONFIG.brandResponseStep === 13` | PASS | `src/lib/config.ts:395` |
| `MILESTONE_CONFIG.techSetupStep` nullable placeholder | PASS | `src/lib/config.ts:387` (`null as number \| null`) |
| D-07: `closedDeal` includes `deal_id` | PASS | `src/lib/config.ts:430-431` |
| `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false` | PASS | `src/lib/config.ts:405` |
| SYNC comments match 00014/00021 style | PASS | `src/lib/config.ts:361-375`, `408-419`, `434-436` |
| Default-export exposes 4 new keys | PASS | `src/lib/config.ts:463-466` |
| No unrelated file touched, no new dependencies | PASS | diff shows only `src/lib/config.ts` +90/-1 |
| `MilestoneType` exported | PASS | `src/lib/config.ts:376-380` |
| `MILESTONE_KEY_PATTERNS` with 5 fields | PASS | `src/lib/config.ts:437-444` |

Every `must_have` from `50-01-PLAN.md` is satisfied. No `cannot_have` boundary was crossed. No UI, API, DB, or test code was introduced — pure config surface as intended.

## Post-Phase Gate Status (from SUMMARY, spot-verified)

- `npx tsc --noEmit` — PASS (0 errors)
- `npm run build` — PASS (Next.js 16 production build green)
- `npx eslint src/lib/config.ts` — PASS (0 errors, 0 warnings on the modified file)
- `npm run lint` (repo-wide) — pre-existing failures in unrelated files (DealFormModal, WorkTrackerClient, Modal); plan explicitly scopes this out as "do not fix — scope creep." Not a Phase 50 regression.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
