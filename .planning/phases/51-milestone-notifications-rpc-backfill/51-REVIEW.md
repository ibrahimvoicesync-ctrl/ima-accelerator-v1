---
phase: 51-milestone-notifications-rpc-backfill
reviewed: 2026-04-13T22:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - supabase/migrations/00027_get_coach_milestones_and_backfill.sql
  - src/lib/rpc/coach-milestones-types.ts
  - src/lib/rpc/coach-milestones.ts
  - src/app/api/deals/route.ts
  - src/app/api/reports/route.ts
  - src/app/api/roadmap/route.ts
  - src/lib/rpc/types.ts
  - src/lib/types.ts
findings:
  critical: 0
  high: 0
  medium: 2
  low: 3
  info: 3
  total: 8
status: partially_resolved
fix_pass: 2026-04-13T22:30:00Z
fix_pass_commit: c395f27
---

# Phase 51: Code Review Report

**Reviewed:** 2026-04-13T22:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Commits Covered:** 8484c45 (migration), 379f84d (types+fetcher), d102bfd (revalidate fan-out), 2a55ea3 (types drift)
**Status:** findings (all medium or below — ship-safe)

## Summary

Phase 51 lands a clean, atomic milestone-notifications pipeline: migration 00027
creates `get_coach_milestones`, rewrites `get_sidebar_badges` to fold the new
count, backfills historical events into `alert_dismissals`, and embeds 9
executable ASSERT blocks. The TypeScript wrapper, cache layer, and
`revalidateTag` fan-out across three mutation routes are wired consistently
with Phase 47/48 precedent.

**D-07 compliance (per-deal alert key):** VERIFIED. `closed_deals` CTE composes
`milestone_closed_deal:{student_id}:{deal_id}` (migration line 102); backfill
uses the same triple composition (line 439); ASSERT 5 structurally validates
uniqueness across distinct deal_ids.

**D-08 compliance (no new notification table):** VERIFIED. Every qualifying /
dismissal path reuses the existing `alert_dismissals (owner_id, alert_key)`
composite from migration 00004. No new table, no new column.

**D-16 compliance (all deals trigger regardless of logged_by):** VERIFIED.
`closed_deals` CTE has no `logged_by` filter (line 100-112); backfill likewise
has no filter (line 437-446).

**revalidateTag fan-out correctness:** VERIFIED. Both branches of `POST /api/deals`
(success line 230 and 23505-retry line 200), both branches of `POST /api/reports`
(update line 126 and insert line 173), and `PATCH /api/roadmap` (line 133) all
invoke `coachMilestonesTag(studentRow.coach_id)` after resolving the coach via
admin client. All calls are wrapped in try/catch with `console.error` on
failure, satisfying CLAUDE.md rule #5. `revalidateTag("badges")` was
additionally added to deals (lines 184, 214) and roadmap (line 123) — previously
missing, confirmed via git history.

**CLAUDE.md hard rules:**
- Rule #4 (admin client in API routes): PASS — all `.from()` and `.rpc()` calls
  in modified routes go through `createAdminClient()`.
- Rule #5 (never swallow errors): PASS — every new catch block has
  `console.error`; `fetchCoachMilestones` throws with structured error message.
- Rule #6 (check response.ok): N/A — no new `fetch()` calls introduced (RPC
  calls use Supabase client which exposes `{data, error}` separately and both
  are checked).
- Rule #7 (Zod import): PASS — all new code uses `import { z } from "zod"`.

The 2 medium items are correctness-adjacent (one a mild type-safety regression,
one an idempotency edge case in ASSERTs). No critical or high findings.

## Medium

### MD-01: `fetchCoachMilestones` casts admin client to `any`, bypassing the generated RPC signature

**Status:** RESOLVED in commit c395f27 (Phase 51 fix pass) — cast and eslint-disable removed; `tsc --noEmit` and `npm run build` both green.

**File:** `src/lib/rpc/coach-milestones.ts:49-54`
**Issue:**
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data, error } = await (admin as any).rpc("get_coach_milestones", {
```
The `Database['public']['Functions'].get_coach_milestones` entry was added to
`src/lib/types.ts:754-762` in commit 2a55ea3 precisely so the admin client
could infer the RPC args. The `(admin as any)` cast and `eslint-disable` defeat
that closure — any drift in the RPC arg names (e.g. renaming `p_coach_id`) will
silently compile. Phase 48's `coach-analytics.ts` template has the same
shortcut, so this is consistency-with-precedent rather than new debt, but the
types are now in place to do it right.

**Fix:**
```typescript
const { data, error } = await admin.rpc("get_coach_milestones", {
  p_coach_id:           coachId,
  p_today:              today,
  p_tech_setup_enabled: MILESTONE_FEATURE_FLAGS.techSetupEnabled,
});
```
Remove the cast and the eslint-disable. If the Supabase typegen still chokes on
`Returns: unknown`, narrow with `as CoachMilestonesPayload` after the result
check (already done at line 67). Same cleanup applies retroactively to
`coach-analytics.ts` / `coach-dashboard.ts` but that is out of scope for 51.

### MD-02: ASSERT 4 and ASSERT 7 mutate real production tables without a SAVEPOINT, relying on transaction rollback-on-failure

**Status:** DEFERRED — migration 00027 is already applied to the remote DB. Rewriting it now would create migration drift between local and remote. Logged for a follow-up housekeeping migration that adds `FOUND`-based clarity (and optionally SAVEPOINT wrappers) without altering the applied behavior.

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:558-611` (ASSERT 4), `:659-725` (ASSERT 7)
**Issue:** Both assertions pick a real `(coach_id, student_id)` pair from
`users`, delete any existing `alert_dismissals` row, UPSERT/UPDATE
`roadmap_progress` for step 11, run the RPC, then manually restore previous
state (`v_prev_status`, `v_prev_completed_at`, `v_had_dismissal`). If the
assertion passes, state is restored — fine. If the assertion **fails**, the
RAISE EXCEPTION aborts the BEGIN/COMMIT and rollback cleans everything — also
fine. However, if an **unexpected** error occurs between the mutation and the
restore blocks (e.g., a `now()` call returns something surprising, or the
restore UPDATE hits a CHECK constraint), the transaction still rolls back
because we're inside the outer `BEGIN;` — so the real risk is low.

The actual subtle bug: **the ASSERT 4 snapshot query can match zero or one
rows.** `SELECT true, status, completed_at INTO v_prev_step_exists, ...` with
no row found leaves `v_prev_step_exists` as NULL (not false — plpgsql assigns
the default of NULL for SELECT INTO with zero rows), which then flows into
`IF v_prev_step_exists THEN` at line 579. `NULL` evaluates falsy in `IF`, so
execution takes the INSERT branch — correct behavior. However the declared
default `:= false` on line 540 means the variable starts as false, and the
SELECT INTO may leave it unchanged if zero rows... actually plpgsql DOES
overwrite it with NULL on zero-row SELECT INTO (unless you use STRICT). This
is defensive but the code happens to do the right thing. Classify as medium
because a future reader will misread this.

**Fix:** Use `FOUND` after the SELECT INTO, which is the idiomatic plpgsql
pattern and unambiguous:
```sql
SELECT status, completed_at
  INTO v_prev_status, v_prev_completed_at
FROM roadmap_progress
WHERE student_id = v_student AND step_number = 11;
v_prev_step_exists := FOUND;
```
Same change in ASSERT 7 at line 674-677. Optional: wrap each assertion's
mutate/restore pair in `BEGIN ... EXCEPTION WHEN OTHERS THEN ... RAISE` to
guarantee restore runs even on unexpected errors — but given the outer BEGIN
rolls back on failure, this is belt-and-suspenders.

## Low

### LO-01: `tech_setup` CTE uses placeholder `step_number = 0` which violates the CHECK constraint if executed

**Status:** DEFERRED — touches applied migration 00027. Will be addressed when D-06 resolves (the same migration that replaces the placeholder will use a defensive sentinel like `-1` or add a `RAISE EXCEPTION` guard).

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:130`
**Issue:**
```sql
AND rp.step_number = 0   -- PLACEHOLDER — replace when D-06 resolves
```
`roadmap_progress.step_number` has `CHECK (step_number BETWEEN 1 AND 10)` in
migration 00001, later expanded to 1..15. Zero is impossible — no row can
match. That is the intended safety net (combined with
`p_tech_setup_enabled = true` guard), but if a future engineer flips the flag
WITHOUT editing the step number, the tech_setup CTE will silently return zero
rows even though the flag is on — a confusing debug experience.

**Fix:** Make the placeholder intent louder. Either:
1. Use `step_number = -1` (guaranteed impossible, draws the eye), or
2. Add a defensive check that raises at RPC time if the flag is on but step is
   unset:
```sql
IF p_tech_setup_enabled = true THEN
  RAISE EXCEPTION 'tech_setup enabled but step reference not set — update migration %', 'after D-06';
END IF;
```
Place before the WITH clause, so the flag flip in config.ts without a
migration update fails loud. The FUTURE WORK comment at header line 19-23
already documents this; the check makes it enforceable.

### LO-02: Backfill does not scope by student_id to prevent cross-coach contamination on reassignment

**Status:** DEFERRED (documentation-only, applied migration). Will be added as a SYNC comment to a future housekeeping migration touching this area.

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:408-446`
**Issue:** Backfill uses `u.coach_id` at migration time — so when student X is
currently assigned to coach A but was historically assigned to coach B when
they completed step 11, the dismissal is recorded against coach A, not B. This
is the INTENDED semantics (NOTIF-10 says "no flood on rollout for the *current*
coach"), and per D-07/D-08 the alert_key does NOT embed coach_id so reassigning
X from A to B in the future would re-surface the alert to B. That is arguably
a feature (new coach sees historical milestone) but the behavior is not
documented in the migration header or in any ASSERT.

**Fix:** Add a SYNC comment at line 408 (before the first backfill INSERT)
explicitly stating: "Backfill scopes to the student's CURRENT coach_id only.
Reassigning a student to a new coach after migration will re-surface historical
milestones to that new coach — intentional per D-08 one-shot-per-coach
semantics." No code change required; documentation only.

### LO-03: `coach-milestones.ts` re-exports via two paths, creating import-style ambiguity

**Status:** SKIPPED (advisory). Current pattern mirrors `coach-analytics.ts` / `coach-dashboard.ts` precedent; revisiting in isolation would create inconsistency with sibling modules. Best addressed as part of a broader RPC-wrapper sweep across all four modules.

**File:** `src/lib/rpc/coach-milestones.ts:19-30`
**Issue:** The server module imports `coachMilestonesTag` and
`CoachMilestonesPayload` from `coach-milestones-types`, then re-exports the
same symbols (line 25, 26-30). A server caller can import from either
`@/lib/rpc/coach-milestones-types` or `@/lib/rpc/coach-milestones` and get the
same `coachMilestonesTag`. The 3 API routes import from `-types` (correct,
client-safe precedent). Future consumers may split randomly, creating dual
paths for the same symbol.

**Fix:** Remove the re-exports at lines 25-30 — consumers who want types
import from `-types`; consumers who want the fetcher import from
`coach-milestones`. Keeps the two-module split clean. Optional; the current
pattern mirrors `coach-analytics.ts` so leaving it preserves consistency.

## Info

### IN-01: `v_account_age_days` computed from `now()` in owner branch is inconsistent with `p_today` parameterization

**File:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql:334`
**Issue:** The coach branch was updated to use `v_today` (from `p_today`
param) instead of `CURRENT_DATE` — good drift fix. The owner branch also
substitutes `v_today` for the date cutoffs, but `v_account_age_days` still
uses `now()`:
```sql
v_account_age_days := EXTRACT(EPOCH FROM (now() - v_student.joined_at)) / 86400.0;
```
If a test passes `p_today = '2026-01-01'` to simulate time-travel, the date
cutoffs shift but the grace-period check against `joined_at` does not. Pre-
existing drift from 00017, not introduced in Phase 51, but Phase 51 is the
first migration to expose `p_today` as a testable parameter so the
inconsistency is now visible.

**Fix:** Replace `now() - v_student.joined_at` with
`(v_today::timestamptz - v_student.joined_at)`. Out-of-scope for Phase 51 — log
as future-phase cleanup.

### IN-02: `fetchCoachMilestones` throws on `!data`, but Supabase's RPC should never return `data = null` when there is no error

**File:** `src/lib/rpc/coach-milestones.ts:62-65`
**Issue:** The defensive `if (!data)` branch exists; the RPC is defined to
always return a jsonb envelope (lines 158-161 of the migration use
`jsonb_build_object` which is never null). The check is belt-and-suspenders
and the error message "RPC returned no data" is technically unreachable under
the current RPC contract. Harmless; documented here for completeness.

### IN-03: `coach-milestones-types.ts` duplicates the `MilestoneType` union instead of importing from `config.ts`

**File:** `src/lib/rpc/coach-milestones-types.ts:14-18`
**Issue:** The file header comment at line 11-13 explicitly justifies the
duplication ("keeps the client bundle minimal"), so this is intentional. The
SYNC comment anchor is present. Only noting to confirm the duplication is
understood and deliberate — if `config.ts.MILESTONES` grows a fifth type,
both places must update.

**Fix:** Consider adding a type-level assertion elsewhere (e.g., in a server-
only test file) that `typeof MILESTONES[number]["type"]` matches `MilestoneType`
— catches drift at build time without pulling `config.ts` into the client
bundle. Optional.

## Cross-Cutting Verification

| Concern | Status | Notes |
|---------|--------|-------|
| SQL injection | NO RISK | All user inputs reach the RPC as typed params (uuid, date, boolean) — no string concatenation into SQL |
| Search path hijacking | SAFE | Both RPCs have `SET search_path = public` |
| SECURITY DEFINER scope | SAFE | Auth guard `IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_coach_id` mirrors 00025 pattern; service_role bypass is intentional |
| Deadlock potential | LOW | Backfill INSERTs touch only `alert_dismissals`; no circular lock acquisition with RPC reads. ASSERT 4/7 mutations are single-table updates within txn |
| Transaction atomicity | GOOD | Entire file wrapped in `BEGIN; ... COMMIT;` — RPC, sidebar rewrite, backfill, and 9 asserts are all-or-nothing |
| Idempotency | GOOD | Backfill uses `ON CONFLICT (owner_id, alert_key) DO NOTHING` on all 3 insert blocks; migration is safely re-runnable |
| RLS implications | SAFE | `alert_dismissals` RLS from 00014 lets coaches INSERT where `owner_id = auth.uid()`. Backfill runs as service_role so bypasses RLS — documented in plan interfaces |
| Cache-key correctness | GOOD | `unstable_cache(["coach-milestones", coachId, today])` — date in key means per-day entries; tag `coach-milestones:${coachId}` busts all dates on revalidate |
| Admin-client usage in API routes | PASS | All `.from()` / `.rpc()` in deals/reports/roadmap use `createAdminClient()` per CLAUDE.md rule #4 |
| revalidateTag coverage | COMPLETE | 5 `coachMilestonesTag` sites across 3 routes (deals×2, reports×2, roadmap×1); `"badges"` added where previously missing |

## Conclusion

Phase 51 is ship-ready. The 2 medium items are code-hygiene improvements that
do not block the rollout; MD-01 can be addressed in a sweep with the other
RPC wrappers (coach-analytics, coach-dashboard, student-analytics), and MD-02
is a defensive clarity improvement to the ASSERTs that will already fail
loudly at migration time if broken.

The per-deal vs one-shot key composition (D-07), `alert_dismissals` reuse
(D-08), all-sources-log-trigger (D-16), and full revalidateTag fan-out are all
correct. 9/9 in-migration ASSERTs provide strong invariants, especially
ASSERT 2 (post-backfill zero for every real coach) which is the critical
rollout-safety guarantee.

---

_Reviewed: 2026-04-13T22:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
