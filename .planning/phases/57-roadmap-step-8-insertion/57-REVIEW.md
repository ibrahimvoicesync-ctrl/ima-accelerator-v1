---
phase: 57-roadmap-step-8-insertion
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - supabase/migrations/00030_roadmap_step_8_insertion.sql
  - src/lib/config.ts
  - scripts/phase-57-smoke-runner.cjs
  - scripts/phase-57-smoke.sql
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 57: Code Review Report

**Reviewed:** 2026-04-15
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 57 inserts a new Stage 1 Step 8 ("Join at least one Influencer Q&A session") and renumbers old Steps 8–15 → 9–16. The core migration (`00030`) is well-constructed: atomic `BEGIN…COMMIT`, two-pass renumber correctly dodges the `UNIQUE(student_id, step_number)` collision, CHECK constraint is dropped and re-added around the renumber window, and embedded `ASSERT` blocks verify the invariants (`MAX(step_number) <= 16`, zero duplicates).

The critical cross-file invariant — `MILESTONE_CONFIG.influencersClosedStep` (11→12) and `brandResponseStep` (13→14) in `src/lib/config.ts` matching `rp.step_number = 12` / `rp.step_number = 14` in the RPC body — is correctly synchronized.

Two warnings flag areas that deserve an operator-level note rather than code changes:

1. The JS smoke runner's SMOKE 5 is a no-op that always passes (the SQL smoke has the real check).
2. The auto-complete `INSERT` grandfathers in every student past old Step 7, including those already at old Steps 10+, which stamps `completed_at = now()` on a Q&A session they never attended. This matches the documented intent but the `completed_at` timestamp misleads downstream analytics.

Four informational items cover minor code-quality nits in the smoke runner.

No critical issues. No security issues. No Hard-Rules violations (no UI code touched).

## Warnings

### WR-01: JS smoke runner SMOKE 5 is a no-op

**File:** `scripts/phase-57-smoke-runner.cjs:136-142`
**Issue:** SMOKE 5 is hardcoded to `record(..., true, ...)` and claims "INFERRED-PASS via migration apply success" — but a mis-typed step number in the RPC body (e.g., `rp.step_number = 11` left behind after find/replace) would still let the migration succeed, because `CREATE OR REPLACE` only validates syntax, not step-number semantics. This smoke run therefore does NOT catch the very class of bug the phase's "atomicity" rule exists to prevent. The paired `scripts/phase-57-smoke.sql` SMOKE 5 uses `pg_get_functiondef` to verify both `step_number = 12` and `step_number = 14` substrings are present — that is the real check, and it requires direct DB access (psql or `supabase db execute`).

**Fix:** Either (a) add a Supabase RPC wrapper around `pg_get_functiondef` so the JS runner can call it and assert the same two `LIKE` patterns the SQL smoke checks, or (b) gate the JS runner's final exit code on running the SQL smoke first and parsing its output, or (c) reword SMOKE 5's name and the runner's documentation to make clear this step is skipped in JS and MUST be covered by running `scripts/phase-57-smoke.sql` via psql. Option (c) is cheapest and acceptable given the SQL smoke is the canonical source of truth, but the current phrasing of `method: "INFERRED via migration apply success"` invites false confidence.

Suggested replacement (option c):

```js
record(
  "SMOKE 5: rpc_step_references",
  "verified by scripts/phase-57-smoke.sql (requires psql — JS runner cannot call pg_get_functiondef)",
  "SKIPPED in JS runner — run SQL smoke for authoritative check",
  true,
  { method: "SKIPPED_IN_JS — see phase-57-smoke.sql for real verification" }
);
```

### WR-02: Auto-complete stamps `completed_at = now()` on grandfathered students

**File:** `supabase/migrations/00030_roadmap_step_8_insertion.sql:227-237`
**Issue:** The Step-8 auto-completion `INSERT … SELECT` matches every student with a completed Step 7. Students who were already deep into old Step 10+ never attended the new Step 8 Q&A session, yet they receive a row with `completed_at = now()`. This is the documented design (grandfathering), but the `now()` timestamp:

- Misrepresents the actual attendance date in downstream analytics (e.g., "students who completed Step 8 in the last 7 days" will spike on migration day).
- Could trigger a milestone-alert flood if any future logic keys off Step 8 completion timestamps (no current milestone does — `influencersClosedStep` is 12, `brandResponseStep` is 14 — but the pattern is fragile).

**Fix:** Consider using `rp.completed_at` (the Step 7 completion timestamp) or `NULL` instead of `now()`, so grandfathered rows are timestamped by their real progression point rather than migration-deploy moment:

```sql
INSERT INTO public.roadmap_progress (student_id, step_number, step_name, status, completed_at)
SELECT
  rp.student_id,
  8,
  'Join at least one Influencer Q&A session (CPM + pricing)',
  'completed',
  rp.completed_at   -- inherit Step 7 completion time, not migration deploy time
FROM public.roadmap_progress rp
WHERE rp.step_number = 7
  AND rp.status = 'completed'
ON CONFLICT (student_id, step_number) DO NOTHING;
```

At minimum, document the `now()` choice explicitly in the header comment as "grandfathering stamp, NOT real attendance date" so future analytics authors don't misinterpret the field. If the deploy is imminent and changing the SQL is too risky, ship as-is and add a migration note.

## Info

### IN-01: Smoke runner uses Map as Set (waste)

**File:** `scripts/phase-57-smoke-runner.cjs:70-76`
**Issue:** `const seen = new Map(); ... seen.set(k, true);` uses a Map with always-`true` values where a Set is idiomatic.
**Fix:** `const seen = new Set(); ... if (seen.has(k)) dups++; else seen.add(k);`.

### IN-02: Env parser strips mismatched quotes

**File:** `scripts/phase-57-smoke-runner.cjs:20`
**Issue:** `m[2].replace(/^['"]|['"]$/g, "")` strips leading and trailing quotes independently, so a value like `"foo'` becomes `foo` (both removed). Harmless for well-formed `.env.local` but silently wrong on malformed input.
**Fix:** Match paired quotes only:

```js
const raw = m[2];
const m2 = raw.match(/^(['"])(.*)\1$/);
env[m[1]] = m2 ? m2[2] : raw;
```

### IN-03: Hard-coded Phase 57 title duplicated across files

**File:** `scripts/phase-57-smoke-runner.cjs:31`, `scripts/phase-57-smoke.sql:51,53`, `supabase/migrations/00030_roadmap_step_8_insertion.sql:231`
**Issue:** The string `"Join at least one Influencer Q&A session (CPM + pricing)"` is repeated verbatim in 4 places. `src/lib/config.ts:163` ROADMAP_STEPS[7].title is the source of truth, but nothing imports it here (SQL and CommonJS scripts can't), so drift risk is non-zero.
**Fix:** Add a lint step or a CI check that asserts the title matches across `config.ts`, migration, and both smoke scripts. Alternative: keep a short sync comment on each occurrence pointing at `src/lib/config.ts:163`.

### IN-04: SMOKE 2 pagination loop clarity

**File:** `scripts/phase-57-smoke-runner.cjs:60-69`
**Issue:** `while (true)` with `if (!data || data.length < chunk) break;` is correct but opaque. On the edge case where `data.length === chunk` on the last page, the loop executes one extra empty `range()` call (fine, but wasteful). More importantly, the `break` condition couples to the `data` shape rather than to a clear "finished" signal.
**Fix:** Use `while (data.length === chunk)` pattern or switch to `.range(from, from+chunk-1)` followed by explicit row-count check. Not blocking.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
