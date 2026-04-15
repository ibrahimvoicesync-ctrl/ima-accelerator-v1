-- =============================================================================
-- Phase 57 Post-Deploy Smoke Verification
--
-- Run AFTER `supabase db push` applies migration 00030 to staging/prod.
-- Every query prints a row with a PASS/FAIL-able result.
-- Capture output into .planning/phases/57-roadmap-step-8-insertion/57-03-SMOKE-RESULTS.md
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -f scripts/phase-57-smoke.sql
--   # OR
--   supabase db execute --file scripts/phase-57-smoke.sql
-- =============================================================================

-- SMOKE 1: MAX(step_number) = 16 (ASSERT 1 from migration)
SELECT 'SMOKE 1: max_step_number' AS check_name,
       MAX(step_number) AS observed,
       16 AS expected,
       CASE WHEN MAX(step_number) = 16 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM public.roadmap_progress;

-- SMOKE 2: Zero duplicate (student_id, step_number) rows
SELECT 'SMOKE 2: duplicate_rows' AS check_name,
       COUNT(*) AS observed,
       0 AS expected,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM (
    SELECT student_id, step_number
      FROM public.roadmap_progress
     GROUP BY student_id, step_number
    HAVING COUNT(*) > 1
  ) dup;

-- SMOKE 3: Every student who has a completed step 7 row ALSO has a
--          completed step 8 row (auto-complete coverage)
SELECT 'SMOKE 3: step_7_completed_without_step_8' AS check_name,
       COUNT(*) AS observed,
       0 AS expected,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM public.roadmap_progress rp7
  WHERE rp7.step_number = 7
    AND rp7.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.roadmap_progress rp8
      WHERE rp8.student_id = rp7.student_id
        AND rp8.step_number = 8
        AND rp8.status = 'completed'
    );

-- SMOKE 4: New Step 8 rows carry the Phase 57 title
SELECT 'SMOKE 4: step_8_has_phase_57_title' AS check_name,
       COUNT(*) FILTER (WHERE step_name != 'Join at least one Influencer Q&A session (CPM + pricing)') AS mismatches,
       0 AS expected,
       CASE WHEN COUNT(*) FILTER (WHERE step_name != 'Join at least one Influencer Q&A session (CPM + pricing)') = 0 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM public.roadmap_progress
  WHERE step_number = 8;

-- SMOKE 5: get_coach_milestones RPC references step 12 (five_inf) and 14 (brand_resp)
--          Verified structurally: source-definition query
SELECT 'SMOKE 5: rpc_step_references' AS check_name,
       (pg_get_functiondef('public.get_coach_milestones'::regproc) LIKE '%rp.step_number = 12%'
        AND pg_get_functiondef('public.get_coach_milestones'::regproc) LIKE '%rp.step_number = 14%')
         AS both_present,
       CASE WHEN pg_get_functiondef('public.get_coach_milestones'::regproc) LIKE '%rp.step_number = 12%'
             AND pg_get_functiondef('public.get_coach_milestones'::regproc) LIKE '%rp.step_number = 14%'
            THEN 'PASS' ELSE 'FAIL' END AS result;

-- SMOKE 6: CHECK constraint is BETWEEN 1 AND 16
SELECT 'SMOKE 6: check_constraint' AS check_name,
       pg_get_constraintdef(oid) AS constraint_def,
       CASE WHEN pg_get_constraintdef(oid) LIKE '%BETWEEN 1 AND 16%' THEN 'PASS' ELSE 'FAIL' END AS result
  FROM pg_constraint
  WHERE conrelid = 'public.roadmap_progress'::regclass
    AND conname = 'roadmap_progress_step_number_check';

-- SMOKE 7: No student has a step_number above 16 (CHECK enforcement proof)
SELECT 'SMOKE 7: no_over_16' AS check_name,
       COUNT(*) AS observed,
       0 AS expected,
       CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
  FROM public.roadmap_progress
  WHERE step_number > 16 OR step_number < 1;

-- SMOKE 8: Coach milestone payload structure (for one real coach, if any)
--          This is diagnostic, not a hard assertion. If zero coaches: skipped.
DO $smoke_8$
DECLARE
  v_coach uuid;
  v_payload jsonb;
BEGIN
  SELECT id INTO v_coach
    FROM public.users
   WHERE role = 'coach' AND status = 'active'
   LIMIT 1;
  IF v_coach IS NULL THEN
    RAISE NOTICE 'SMOKE 8: skipped — no active coach in DB';
    RETURN;
  END IF;
  v_payload := public.get_coach_milestones(v_coach, CURRENT_DATE, false);
  RAISE NOTICE 'SMOKE 8: coach_id=%, envelope_keys=%, count=%',
    v_coach,
    (SELECT string_agg(k, ',') FROM jsonb_object_keys(v_payload) k),
    (v_payload->>'count');
END $smoke_8$;
