---
phase: 61-student-analytics-re-split-f1
plan: 01
subsystem: database
tags: [supabase, postgres, plpgsql, rpc, migration, jsonb, student-analytics]

# Dependency graph
requires:
  - phase: 46-student-analytics
    provides: "00023_get_student_analytics.sql — source body copied verbatim (except v_totals jsonb keys)"
  - phase: 60-hotfix-sidebar-badges-pgrst203
    provides: "00032 defensive DROP precedent using pg_get_function_identity_arguments loop"
provides:
  - "supabase/migrations/00033_fix_student_analytics_outreach_split.sql — breaking re-split of get_student_analytics totals payload"
  - "New totals jsonb keys: total_brand_outreach, total_influencer_outreach"
  - "Removed totals jsonb keys: total_emails (double-counted), total_influencers"
  - "Post-migration DO $assert$ guaranteeing exactly one overload of get_student_analytics"
affects:
  - "61-02-typescript-totals-rename (StudentAnalyticsTotals type consumes new keys)"
  - "61-03-consumer-rewrite-cache-bump (AnalyticsClient.tsx KPI cards + unstable_cache key bump)"
  - "61-04-build-gate-and-shape-assert (psql shape assert + full tsc/lint/build gate)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defensive RPC DROP loop via pg_get_function_identity_arguments (PGRST203 prevention)"
    - "Post-migration DO $assert$ overload-count invariant"
    - "Breaking RPC shape change — no back-compat shim (tsc is authoritative break detector)"

key-files:
  created:
    - "supabase/migrations/00033_fix_student_analytics_outreach_split.sql"
  modified: []

key-decisions:
  - "Copied full 00023 function body verbatim (auth guard, range validation, streak, trends, deals, roadmap, assembly) — only v_totals jsonb_build_object changed"
  - "Signature (uuid, text, int, int) RETURNS jsonb unchanged — avoids touching Supabase-CLI-generated Args type in src/lib/types.ts"
  - "No back-compat alias in jsonb output — breaking shape is the signal that drives tsc consumer break detection in Plans 02/03"
  - "Did NOT touch 00023 (append-only migration history preserved)"
  - "Did NOT rename the function (same name, new payload shape) — keeps fetchStudentAnalytics + Args type stable"

patterns-established:
  - "Defensive RPC DROP before CREATE — iterate pg_proc overloads via pg_get_function_identity_arguments and DROP each with EXECUTE format() CASCADE. Applied uniformly to every v1.8 RPC migration."
  - "Post-migration DO $assert$ — RAISE EXCEPTION if overload COUNT(*) <> 1, ensuring PGRST203 cannot recur silently."

requirements-completed: [SA-03, SA-09]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 61 Plan 01: Migration 00033 RPC Split Summary

**Breaking re-split of `public.get_student_analytics` totals payload — `total_emails`/`total_influencers` removed, `total_brand_outreach`/`total_influencer_outreach` added, with defensive `DO $drop$` loop and post-migration overload-count assert.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T04:45:46Z
- **Completed:** 2026-04-17T04:48:32Z
- **Tasks:** 1 / 1
- **Files modified:** 1 (1 created, 0 changed)

## Accomplishments

- Created `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` (285 lines, single `BEGIN; ... COMMIT;` transaction).
- Defensive DROP loop iterates every existing `public.get_student_analytics` overload via `pg_get_function_identity_arguments(p.oid)` and `EXECUTE format('DROP FUNCTION ... (%s) CASCADE', r.args)` — prevents PGRST203 overload collisions on future signature drift.
- `CREATE OR REPLACE FUNCTION public.get_student_analytics(uuid, text DEFAULT '30d', int DEFAULT 1, int DEFAULT 25) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public` — signature identical to 00023.
- Function body copied verbatim from 00023 EXCEPT `v_totals` `jsonb_build_object`:
  - Dropped: `'total_emails'` (was `SUM(brands + influencers)` — double-counted influencers) and `'total_influencers'`.
  - Added: `'total_brand_outreach' = SUM(COALESCE(brands_contacted,0))` and `'total_influencer_outreach' = SUM(COALESCE(influencers_contacted,0))`.
- `COMMENT ON FUNCTION` updated to document Phase 61 F1 supersession of 00023.
- `GRANT EXECUTE ... TO authenticated, service_role;` re-issued on the new function.
- Post-migration `DO $assert$` block raises exception if `COUNT(*) <> 1` overload of `get_student_analytics` in `pg_proc` — catches any future accidental dual-create.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00033 — defensive DROP + CREATE OR REPLACE with renamed jsonb keys + post-assert** — `65884b5` (feat)

## Files Created/Modified

- `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` — NEW. Breaking DROP+CREATE of `get_student_analytics` with `total_brand_outreach` + `total_influencer_outreach` jsonb keys replacing `total_emails` + `total_influencers`. 285 lines. Single transaction with defensive drop loop + post-migration overload-count assert.

## Decisions Made

- **Verbatim body copy** — re-implemented the full 00023 function body (auth guard, range validation, window computation, page guards, lifetime totals, streak, outreach trend, hours trend, deal history with pagination, deal summary, roadmap progress, final assembly) inside 00033 rather than ALTER-ing a subset. Postgres has no in-place `jsonb_build_object` patch; CREATE OR REPLACE requires the whole body. This matches the 00023→00033 supersession pattern.
- **Signature unchanged** — `(uuid, text, int, int) RETURNS jsonb` is preserved to avoid touching the Supabase-CLI-generated `Database["public"]["Functions"]["get_student_analytics"]["Args"]` in `src/lib/types.ts`. Only the opaque `Returns: Json` payload shape changed.
- **No back-compat alias** — CONTEXT.md locks breaking posture; tsc in Plan 03 is the stale-consumer detector.
- **Doc comments avoid the forbidden single-quoted literals** — `'total_emails'` and `'total_influencers'` must be absent per acceptance criteria (verifier greps the single-quoted form). Header and inline comments refer to these as `total_emails key` / `total_influencers key` (unquoted) to document the change without tripping the verifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comments initially contained the forbidden single-quoted literals `'total_emails'` and `'total_influencers'`**
- **Found during:** Task 1 self-verification (running the plan's `<verify><automated>` grep block)
- **Issue:** Initial draft placed change-log lines `'total_emails' → REMOVED` and `'total_influencers' → REMOVED` inside the header comment block. The acceptance criteria and verify script explicitly require `grep -q "'total_emails'"` and `grep -q "'total_influencers'"` to return 0 across the whole file, not just inside the function body. Those comment lines would have failed the automated verify.
- **Fix:** Rewrote the two comment lines to reference the keys without single quotes (`total_emails key → REMOVED`, `total_influencers key → REMOVED`). Functional content identical; single-quoted literal absent. Also confirmed the `COMMENT ON FUNCTION ... IS '...'` comment body mentions `total_emails` / `total_influencers` without enclosing them in nested single quotes, so the outer string-literal apostrophes do not create a false `'total_emails'` match.
- **Files modified:** `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` (header comment lines 35-36)
- **Verification:** `grep -c "'total_emails'"` = 0; `grep -c "'total_influencers'"` = 0; all 18 acceptance-criteria checks pass.
- **Committed in:** `65884b5` (part of the Task 1 commit — fix applied before staging)

---

**Total deviations:** 1 auto-fixed (1 bug — verifier-grep false positive in doc comments)
**Impact on plan:** Pure doc-comment rephrase; zero SQL semantic impact. No scope creep.

## Issues Encountered

None. The only friction was the initial verifier-grep false-positive in doc comments (documented above as a Rule 1 auto-fix).

## Acceptance Criteria Verification

All 18 grep checks pass against `supabase/migrations/00033_fix_student_analytics_outreach_split.sql`:

| Check | Expected | Actual |
|-------|----------|--------|
| `DO $drop$` present | ≥1 | 1 |
| `pg_get_function_identity_arguments(p.oid)` present | ≥1 | 1 |
| `DROP FUNCTION public.get_student_analytics(%s) CASCADE` present | ≥1 | 1 |
| `'total_brand_outreach'` present | ≥1 | 1 |
| `'total_influencer_outreach'` present | ≥1 | 1 |
| `SUM(COALESCE(brands_contacted,0))` (brand-only agg) present | ≥1 | 2 |
| `DO $assert$` present | ≥1 | 1 |
| `RAISE EXCEPTION 'Migration 00033 post-assert failed` present | ≥1 | 1 |
| `GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int)` present | ≥1 | 1 |
| `SECURITY DEFINER` present | ≥1 | 1 |
| `STABLE` present (exact line) | ≥1 | 1 |
| `LANGUAGE plpgsql` present | ≥1 | 1 |
| `SET search_path = public` present | ≥1 | 1 |
| `BEGIN;` (exact line) | ≥1 | 1 |
| `COMMIT;` (exact line) | ≥1 | 1 |
| `'total_emails'` absent | 0 | 0 |
| `'total_influencers'` absent | 0 | 0 |
| `SUM(COALESCE(brands_contacted,0) + COALESCE(influencers_contacted,0))` (old double-sum) absent | 0 | 0 |

## Known Stubs

None.

## Threat Flags

None — migration preserves the existing auth guard (`v_caller IS DISTINCT FROM p_student_id → RAISE EXCEPTION 'not_authorized'`), unchanged `GRANT EXECUTE TO authenticated, service_role`, and identical arg-type validation (`p_range NOT IN (...) → RAISE EXCEPTION`). No new network surface, no new trust boundary, no new schema surface. Totals-key rename is payload-shape only.

## User Setup Required

None — migration applies via the existing Supabase CLI pipeline (`supabase db push` locally or CI-driven `supabase migration up` against staging/prod). No new environment variables, dashboard config, or manual steps.

## Next Phase Readiness

- **Plan 02** (TypeScript totals rename) can proceed immediately. The new jsonb payload keys `total_brand_outreach` / `total_influencer_outreach` are defined; Plan 02 will rename the corresponding fields on `StudentAnalyticsTotals` in `src/lib/rpc/student-analytics-types.ts`, at which point `npx tsc --noEmit` will error at exactly two sites: `AnalyticsClient.tsx:203` and `:208` (the stale consumers).
- **Plan 03** (consumer rewrite + cache-key bump) will fix those tsc errors, remove the DIY hide-guard, and bump both `unstable_cache` keys (`["student-analytics"]` → `["student-analytics-v2"]`) on `/student/analytics/page.tsx:50` and `/student_diy/analytics/page.tsx:50` — all in the same commit.
- **Plan 04** (build gate + psql shape assert) runs the full CLAUDE.md post-phase gate.

**Expected state at end of Plan 01 (now):** tsc/lint/build intentionally NOT green yet (consumers still reference old keys). That is by design per the plan's `<verification>` note: "Do not run `npx tsc --noEmit` as a gate for this plan; it will fail at AnalyticsClient.tsx lines 203/208 until Plan 03 runs."

## Self-Check: PASSED

**File existence:**
- FOUND: `supabase/migrations/00033_fix_student_analytics_outreach_split.sql`

**Commit existence:**
- FOUND: `65884b5` (`git log --oneline | grep 65884b5` matches)

**Migration history invariant:**
- `supabase/migrations/00023_get_student_analytics.sql` untouched (last commit: 23cde0e from Phase 46). Append-only history preserved.

---
*Phase: 61-student-analytics-re-split-f1*
*Plan: 01*
*Completed: 2026-04-17*
