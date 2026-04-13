---
phase: 51-milestone-notifications-rpc-backfill
fixed_at: 2026-04-13T22:30:00Z
review_path: .planning/phases/51-milestone-notifications-rpc-backfill/51-REVIEW.md
iteration: 1
mode: --auto (safe + contained only)
findings_in_scope: 8
fixed: 1
deferred: 6
skipped: 1
status: partial
verification: tsc --noEmit + npm run build (both green)
---

# Phase 51: Code Review Fix Report

**Fixed at:** 2026-04-13T22:30:00Z
**Source review:** `.planning/phases/51-milestone-notifications-rpc-backfill/51-REVIEW.md`
**Iteration:** 1
**Mode:** `--auto` (apply only safe + contained fixes)

**Summary:**
- Findings in scope: 8 (2 medium, 3 low, 3 info)
- Fixed: 1 (MD-01)
- Deferred to follow-up housekeeping migration: 4 (MD-02, LO-01, LO-02, IN-01 — all touch already-applied migration 00027)
- Skipped (advisory / out-of-scope): 3 (LO-03, IN-02, IN-03)

## Fixed Issues

### MD-01: `fetchCoachMilestones` casts admin client to `any`, bypassing the generated RPC signature

**Files modified:** `src/lib/rpc/coach-milestones.ts`
**Commit:** `c395f27`
**Applied fix:**
- Removed `(admin as any)` cast and the accompanying `// eslint-disable-next-line @typescript-eslint/no-explicit-any` directive on lines 49-50.
- Now calls `admin.rpc("get_coach_milestones", { ... })` directly, relying on the generated `Database['public']['Functions'].get_coach_milestones` entry already present in `src/lib/types.ts:754-762`.
- Verified the existing `Returns: unknown` typing flows through the trailing `as unknown as CoachMilestonesPayload` cast at line 66 — no additional narrowing needed.

**Verification:**
- `npx tsc --noEmit` — clean (no errors).
- `npm run build` — clean production build.
- The arg names (`p_coach_id`, `p_today`, `p_tech_setup_enabled`) are now type-checked against the generated signature, so future RPC arg-name drift will fail at compile time instead of silently slipping through.

## Deferred Issues (housekeeping migration)

The following findings all touch **migration 00027**, which is already applied to the remote DB. Rewriting an applied migration creates local↔remote drift, so these are deferred to a future follow-up housekeeping migration (or to the migration that resolves D-06, since LO-01 and the deferred items in that area share scope).

### MD-02: ASSERT 4 / ASSERT 7 use ambiguous `SELECT INTO ... v_prev_step_exists` pattern

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:558-611`, `:659-725`
**Reason for defer:** Migration is applied; rewriting causes drift. The fix is purely a clarity improvement (use `FOUND` after `SELECT INTO`) — current logic is correct, just non-idiomatic. Future housekeeping migration should refactor both ASSERT blocks to use the `FOUND` pattern and optionally wrap mutate/restore pairs in `SAVEPOINT ... EXCEPTION WHEN OTHERS THEN RAISE` for belt-and-suspenders restore guarantee.

### LO-01: `tech_setup` CTE uses placeholder `step_number = 0` (violates CHECK constraint)

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:130`
**Reason for defer:** Already gated by `p_tech_setup_enabled = false`. The placeholder is intentional; the migration that resolves D-06 will replace it with the confirmed step number anyway. At that time, change the sentinel to `-1` (more obviously impossible) and add an upfront `IF p_tech_setup_enabled = true AND <step ref unset> THEN RAISE EXCEPTION ...` guard.

### LO-02: Backfill cross-coach contamination on reassignment is undocumented

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:408-446`
**Reason for defer:** Documentation-only change to applied migration. Add a SYNC comment block at line 408 in the next housekeeping migration, explicitly stating the intentional D-08 one-shot-per-coach reassignment behavior.

### IN-01: `v_account_age_days` uses `now()` instead of parameterized `v_today` in owner branch

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:334`
**Reason for defer:** Pre-existing drift from migration 00017, exposed by Phase 51's `p_today` param addition but not introduced by it. Fix in a future migration that touches the owner branch or adds time-travel test coverage.

## Skipped Issues (advisory / out-of-scope)

### LO-03: `coach-milestones.ts` re-exports via two paths

**File:** `src/lib/rpc/coach-milestones.ts:19-30`
**Reason for skip:** Current re-export pattern mirrors the established precedent in `coach-analytics.ts` and `coach-dashboard.ts`. Removing only this module's re-exports would create cross-module inconsistency. Best addressed as a single sweep across all RPC-wrapper modules — out of scope for a Phase 51 fix pass.

### IN-02: Defensive `if (!data)` is technically unreachable

**File:** `src/lib/rpc/coach-milestones.ts:62-65`
**Reason for skip:** Belt-and-suspenders defensive code that costs nothing and protects against future RPC contract changes. Reviewer flagged for completeness only — no action recommended.

### IN-03: `MilestoneType` union duplicated in `coach-milestones-types.ts`

**File:** `src/lib/rpc/coach-milestones-types.ts:14-18`
**Reason for skip:** Duplication is intentional (file header explicitly justifies it as a client-bundle-size optimization). The optional drift-detection assertion suggested by the reviewer can be added later if `MILESTONES` grows.

## Verification Performed

| Tier | Check | Result |
|------|-------|--------|
| 1 | Re-read modified file section after Edit | PASS — cast removed, surrounding code intact |
| 2 | `npx tsc --noEmit` (full project) | PASS — no errors |
| 2 | `npm run build` (full production build) | PASS — all 54 routes compiled |

The cast removal is structural (no logic change), so syntax/type checks fully validate the fix. No semantic risk requiring human verification.

## Source-Code Hygiene

- No source files left in broken state.
- No partial or uncommitted changes remain.
- `git checkout --` rollback was not needed (verification passed first try).
- Conventional-commits format used: `fix(51): ...`.

---

_Fixed: 2026-04-13T22:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
_Mode: --auto (conservative)_
