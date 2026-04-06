-- ============================================================================
-- Fix assign_deal_number() trigger
--
-- PostgreSQL does not allow FOR UPDATE with aggregate functions (MAX).
-- Split into two steps: lock rows first, then aggregate.
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
  -- Lock existing deal rows for this student to prevent concurrent inserts
  PERFORM 1 FROM public.deals WHERE student_id = NEW.student_id FOR UPDATE;

  -- Now safely compute the next deal number
  SELECT COALESCE(MAX(deal_number), 0) + 1
    INTO v_next
    FROM public.deals
   WHERE student_id = NEW.student_id;

  NEW.deal_number := v_next;
  RETURN NEW;
END;
$$;
