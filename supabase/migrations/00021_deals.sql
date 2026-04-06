-- ============================================================================
-- Phase 38: Database Foundation -- deals table
-- Migration: 00021_deals.sql
--
-- Creates the deals table for v1.5 Student Deals milestone.
-- Each deal is auto-numbered per student via BEFORE INSERT trigger with
-- FOR UPDATE row lock to prevent race-condition duplicate deal_number values.
--
-- Requires: get_user_id(), get_user_role(), handle_updated_at() from 00001
-- ============================================================================


-- ============================================================================
-- Section 1: deals table DDL
--
-- Columns per CONTEXT.md D-01: id, student_id, deal_number, revenue, profit,
-- created_at, updated_at. No notes, brand_name, or status columns in v1.5.
-- numeric(12,2) for exact decimal arithmetic (D-04). CHECK constraints
-- enforce non-negative values (D-05). ON DELETE CASCADE on student_id (D-06).
-- UNIQUE (student_id, deal_number) prevents duplicates at DB level (D-03).
-- deal_number NOT NULL even though trigger sets it -- the trigger always fires.
-- ============================================================================

CREATE TABLE public.deals (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deal_number integer       NOT NULL,
  revenue     numeric(12,2) NOT NULL CHECK (revenue >= 0),
  profit      numeric(12,2) NOT NULL CHECK (profit >= 0),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT deals_student_deal_number_key UNIQUE (student_id, deal_number)
);


-- ============================================================================
-- Section 2: deal_number trigger function
--
-- SECURITY DEFINER so the trigger can read all rows for the same student
-- without RLS filtering. COALESCE(MAX, 0) + 1 handles the first deal per
-- student (MAX on empty set returns NULL; COALESCE converts NULL to 0).
-- FOR UPDATE row-locks the student's existing deal rows, preventing two
-- concurrent inserts from both reading MAX=5 and both assigning deal_number=6.
-- The WHERE clause scopes the lock to the inserting student only so other
-- students' concurrent inserts are not blocked (D-02, STATE.md D-01 locked).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_deal_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(deal_number), 0) + 1
    INTO v_next
    FROM public.deals
   WHERE student_id = NEW.student_id
     FOR UPDATE;

  NEW.deal_number := v_next;
  RETURN NEW;
END;
$$;


-- ============================================================================
-- Section 3: deal_number BEFORE INSERT trigger
--
-- Fires before every INSERT so deal_number is always assigned by the trigger
-- regardless of any value the caller supplies. This makes deal_number
-- effectively auto-incremented per student (D-02).
-- ============================================================================

CREATE TRIGGER set_deal_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_deal_number();


-- ============================================================================
-- Section 4: updated_at trigger
--
-- Reuses handle_updated_at() from 00001 -- no redefinition needed. Keeps
-- updated_at in sync with every UPDATE on the deals table (D-16).
-- ============================================================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- Section 5: Enable RLS
--
-- RLS must be enabled before policies are added (D-08). Without this, all
-- CREATE POLICY statements below are silently accepted but never enforced.
-- ============================================================================

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- Section 6: RLS policies -- deals
--
-- initplan pattern: every policy wraps get_user_role() and get_user_id() in
-- scalar subqueries. This forces Postgres to evaluate each function once per
-- query (initplan) rather than once per row, matching the established pattern
-- from 00001 and 00015 (D-08, INFR-04).
--
-- Policy set (D-09 through D-13):
--   owner:       SELECT + DELETE (full read, no INSERT/UPDATE/owner-edit)
--   coach:       SELECT + DELETE own assigned students' deals only
--   student/diy: SELECT + INSERT + UPDATE + DELETE own deals
--   NO coach INSERT or UPDATE policies (D-13).
-- ============================================================================

-- Owner: read all deals
CREATE POLICY "owner_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');

-- Owner: delete any deal
CREATE POLICY "owner_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'owner');

-- Coach: read deals belonging to assigned students only (D-11)
CREATE POLICY "coach_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

-- Coach: delete deals belonging to assigned students only (D-11)
CREATE POLICY "coach_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

-- Student + student_diy: read own deals (D-09, D-10 combined policy)
CREATE POLICY "student_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

-- Student + student_diy: insert own deals (WITH CHECK required for INSERT)
CREATE POLICY "student_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

-- Student + student_diy: update own deals (USING + WITH CHECK required for UPDATE)
CREATE POLICY "student_update_deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  )
  WITH CHECK (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

-- Student + student_diy: delete own deals
CREATE POLICY "student_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );


-- ============================================================================
-- Section 7: Indexes
--
-- Composite index on (student_id, created_at DESC) covers the primary query
-- pattern: list a student's deals in reverse chronological order (D-14,
-- INFR-03). student_id is the leading column so the index also covers
-- single-student existence checks efficiently.
-- ============================================================================

CREATE INDEX idx_deals_student_created ON public.deals(student_id, created_at DESC);
