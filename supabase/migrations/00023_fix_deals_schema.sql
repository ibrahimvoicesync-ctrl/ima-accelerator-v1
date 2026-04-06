-- ============================================================================
-- Fix deals table schema
--
-- The deals table was created manually with a legacy schema (brand_name,
-- deal_value, status, closed_at, notes) before migration 00021 ran.
-- Migration 00021 was marked as applied but its CREATE TABLE silently failed
-- because the table already existed. This migration drops the old table and
-- recreates it with the correct v1.5 schema from 00021.
-- ============================================================================

-- Drop the old deals table and all dependent objects (triggers, policies, indexes)
DROP TABLE IF EXISTS public.deals CASCADE;

-- Drop the trigger function if it exists (CASCADE above may not cover it)
DROP FUNCTION IF EXISTS public.assign_deal_number() CASCADE;

-- ============================================================================
-- Re-apply 00021: deals table DDL
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

-- deal_number trigger function
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

-- BEFORE INSERT trigger for deal_number
CREATE TRIGGER set_deal_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_deal_number();

-- updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS policies
-- ============================================================================

-- Owner: read all deals
CREATE POLICY "owner_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');

-- Owner: delete any deal
CREATE POLICY "owner_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'owner');

-- Coach: read deals belonging to assigned students only
CREATE POLICY "coach_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

-- Coach: delete deals belonging to assigned students only
CREATE POLICY "coach_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

-- Student + student_diy: read own deals
CREATE POLICY "student_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

-- Student + student_diy: insert own deals
CREATE POLICY "student_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

-- Student + student_diy: update own deals
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
-- Indexes
-- ============================================================================

CREATE INDEX idx_deals_student_created ON public.deals(student_id, created_at DESC);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
