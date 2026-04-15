---
phase: 57-roadmap-step-8-insertion
fixed_at: 2026-04-15T00:00:00Z
review_path: .planning/phases/57-roadmap-step-8-insertion/57-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 1
skipped: 1
status: partial
---

# Phase 57: Code Review Fix Report

**Fixed at:** 2026-04-15
**Source review:** `.planning/phases/57-roadmap-step-8-insertion/57-REVIEW.md`
**Iteration:** 1

## Summary

- Findings in scope (this pass): 2 warnings (selective scope; info items deferred)
- Warnings fixed: 1/2
- Warnings deferred: 1/2
- Info fixed: 0/4 (all info items deferred — out of scope for selective pass)

## Finding Status

| ID | Severity | Status | Commit | Notes |
|----|----------|--------|--------|-------|
| WR-01 | Warning | fixed | `0f46c1d` | SMOKE 5 reworded as `SKIPPED_IN_JS`; authoritative check delegated to `scripts/phase-57-smoke.sql` |
| WR-02 | Warning | deferred | — | Known limitation — migration 00030 already in production; backfill is a separate product decision |
| IN-01 | Info | deferred | — | Out of scope (selective pass targets warnings only) |
| IN-02 | Info | deferred | — | Out of scope (selective pass targets warnings only) |
| IN-03 | Info | deferred | — | Out of scope (selective pass targets warnings only) |
| IN-04 | Info | deferred | — | Out of scope (selective pass targets warnings only) |

## Fixed Issues

### WR-01: JS smoke runner SMOKE 5 is a no-op

**Files modified:** `scripts/phase-57-smoke-runner.cjs`
**Commit:** `0f46c1d`
**Applied fix:** Reworded SMOKE 5 so the JS runner no longer masquerades as a real verification of the `get_coach_milestones` RPC body.

Concrete changes in `scripts/phase-57-smoke-runner.cjs` (lines 130–150):

1. Replaced the misleading comment block that framed the check as "INFERRED-PASS via migration apply success" with an explicit note that (a) `supabase-js` cannot call `pg_get_functiondef`, and (b) `CREATE OR REPLACE` success does NOT prove step-number semantics (a mis-typed `rp.step_number = 11` would still pass). The new comment points operators to `scripts/phase-57-smoke.sql` as the authoritative RPC-body check via psql or `supabase db execute`.
2. Changed the `record(...)` call:
   - `expected` now reads: `"rp.step_number = 12 AND rp.step_number = 14 in get_coach_milestones body (verified by scripts/phase-57-smoke.sql via psql)"`.
   - `observed` now reads: `"SKIPPED in JS runner — run scripts/phase-57-smoke.sql for authoritative check"`.
   - `extra` now overrides the `result` field to `"SKIPPED_IN_JS"` (neutral marker — neither `PASS` nor `FAIL`). This works because the existing `record()` implementation spreads `extra` after its default `result: pass ? "PASS" : "FAIL"`, so the override replaces the default cleanly.
   - `method` updated to: `"SKIPPED_IN_JS — see scripts/phase-57-smoke.sql for real verification"`.
3. Side-effect on exit code: the runner's final check is `results.filter((r) => r.result === "FAIL").length`, so `"SKIPPED_IN_JS"` does not cause a non-zero exit. This is intentional — the JS runner continues to be a convenience tool for the 7 checks it *can* actually run, while SMOKE 5 is now correctly labeled as "not verified here" instead of "INFERRED-PASS".

**Verification performed:**
- Tier 1 (mandatory): re-read lines 128–157 of `scripts/phase-57-smoke-runner.cjs`; fix text present, surrounding SMOKE 4 and SMOKE 6 blocks intact.
- Tier 2 (preferred): `node -c scripts/phase-57-smoke-runner.cjs` passed with no output (CommonJS syntax valid).
- Additional: `npx tsc --noEmit` at repo root completed with no errors (no TypeScript breakage — expected, as this file is a `.cjs` script outside the TS project graph).

## Deferred Issues

### WR-02: Auto-complete stamps `completed_at = now()` on grandfathered students

**File:** `supabase/migrations/00030_roadmap_step_8_insertion.sql:227-237`
**Status:** Deferred as a known limitation — NOT a code defect.

**Reasoning:**

1. **Migration is already applied to production.** Phase 56/57 records show migration `00030_roadmap_step_8_insertion.sql` was shipped and the Step-8 rows already exist in the production `roadmap_progress` table with `completed_at = now_at_migration_time`. Editing the migration file now is purely cosmetic — it would not retroactively change the stamped rows.
2. **Backfilling `completed_at` to inherit Step 7's timestamp requires a separate corrective migration.** That would mean: (a) authoring `00031_backfill_step_8_completed_at.sql` that `UPDATE`s the affected rows to `rp.completed_at` from their Step 7 row, (b) deciding the correct semantic source (Step 7 timestamp? NULL? the real attendance date once known?), and (c) running a new migration cycle against prod. All of that is out of scope for a code-review fix pass.
3. **This is a product/analytics decision, not a code defect.** The grandfathering design is documented and intentional. The trade-off (migration-day timestamp vs. Step 7 timestamp vs. NULL) is a judgment call for the product owner and downstream analytics consumers, not something this fix pass should decide unilaterally.

**Recommended follow-up (for a future phase, not this pass):**

- Product/analytics owner decides the correct semantic for grandfathered `completed_at` values.
- If a change is approved, author a dedicated corrective migration (e.g., `00031_backfill_step_8_completed_at.sql`) with a clear rollback plan.
- Update `00030`'s header comment to document the `now()` choice explicitly as "grandfathering stamp, NOT real attendance date" so future analytics authors don't misinterpret the field.

**Do NOT write a backfill migration in this pass.** Per the orchestrator's instruction, WR-02 ships as-is.

### IN-01 through IN-04

All four info items (Map-as-Set waste, env parser quote stripping, hard-coded title duplication, SMOKE 2 pagination clarity) are deferred as out-of-scope for this selective warning-focused pass. They are minor code-quality nits in `scripts/phase-57-smoke-runner.cjs` and do not affect correctness of the phase's invariants.

---

_Fixed: 2026-04-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
_Scope: selective (WR-01 only; WR-02 deferred by orchestrator; info items out of scope)_
