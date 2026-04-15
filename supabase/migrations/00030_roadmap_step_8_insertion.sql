-- =============================================================================
-- Phase 57: Roadmap Step 8 Insertion
-- Migration: 00030_roadmap_step_8_insertion.sql
--
-- Closes ROADMAP-01, ROADMAP-02, ROADMAP-03, ROADMAP-06, ROADMAP-09.
--
-- SYNC: src/lib/config.ts ROADMAP_STEPS (16 entries) + MILESTONE_CONFIG
-- (.influencersClosedStep = 12, .brandResponseStep = 14). These two files
-- MUST land in the SAME Git commit as this migration — missing either half
-- silently breaks coach milestone alerts (STATE.md §Critical Constraints v1.6).
--
-- ATOMIC: single BEGIN…COMMIT. The CHECK constraint swap MUST happen BEFORE
-- any UPDATE that pushes step_number above 15, because pass 1 of the
-- two-pass renumber writes 108–115 (to dodge the UNIQUE(student_id,
-- step_number) collision), which violates the old BETWEEN 1 AND 15 CHECK.
--
-- Two-pass renumber (non-negotiable):
--   Pass 1: UPDATE … SET step_number = step_number + 100 WHERE step_number BETWEEN 8 AND 15
--   Pass 2: UPDATE … SET step_number = step_number - 99 WHERE step_number BETWEEN 108 AND 115
-- A naive single-pass "SET step_number = step_number + 1 WHERE step_number BETWEEN 8 AND 15"
-- violates the UNIQUE(student_id, step_number) index (8→9 collides with existing 9, etc.).
--
-- Auto-complete: every student with a completed row at step 7 (post-renumber,
-- step 7 is untouched) gets a fresh completed row at step 8. ON CONFLICT
-- DO NOTHING guards against re-run idempotency.
--
-- Asserts: MAX(step_number) = 16 AND zero duplicate (student_id, step_number)
-- rows. Assertion failure raises an exception — Postgres rolls back the
-- transaction atomically; zero db state change.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Section 1: Drop the old BETWEEN 1 AND 15 CHECK constraint.
-- Re-added as BETWEEN 1 AND 16 in Section 5 AFTER the two-pass renumber
-- returns every row to the 1–16 range. Pass 1 writes 108–115 which would
-- violate ANY BETWEEN 1 AND N check, so the constraint must be absent
-- during the renumber window.
-- -----------------------------------------------------------------------------

ALTER TABLE public.roadmap_progress
  DROP CONSTRAINT IF EXISTS roadmap_progress_step_number_check;

-- -----------------------------------------------------------------------------
-- Section 2: Two-pass renumber of existing Steps 8–15 → 9–16.
-- Pass 1 shifts 8–15 into 108–115 (outside the collision range) so Pass 2
-- can shift into 9–16 without colliding with existing rows on the
-- UNIQUE(student_id, step_number) index.
--
-- Single-pass "step_number + 1 WHERE step_number BETWEEN 8 AND 15" would
-- violate the UNIQUE constraint: e.g., student X's row at step 8 moving
-- to step 9 collides with student X's existing row at step 9.
-- -----------------------------------------------------------------------------

-- Pass 1: Shift old Steps 8–15 to 108–115.
UPDATE public.roadmap_progress
  SET step_number = step_number + 100
 WHERE step_number BETWEEN 8 AND 15;

-- Pass 2: Shift 108–115 down to 9–16.
UPDATE public.roadmap_progress
  SET step_number = step_number - 99
 WHERE step_number BETWEEN 108 AND 115;
