---
plan_id: 55-01
phase: 55
title: "Write migration 00029: atomic chat removal + announcements table"
wave: 1
depends_on: []
autonomous: true
requirements:
  - CHAT-REM-04
  - CHAT-REM-05
  - CHAT-REM-08
  - ANNOUNCE-01
  - ANNOUNCE-09
  - ANNOUNCE-10
files_modified:
  - supabase/migrations/00029_chat_removal_announcements.sql
must_haves:
  - Single BEGIN…COMMIT block
  - Exact statement order (1) CREATE OR REPLACE get_sidebar_badges, (2) CREATE TABLE announcements + RLS + trigger + index, (3) DROP TABLE messages CASCADE
  - get_sidebar_badges has zero references to messages/unread_messages anywhere in the function body (including owner branch)
  - announcements uses (SELECT auth.uid()) initplan pattern in every RLS policy
  - updated_at trigger on announcements
---

# Plan 55-01 — Migration 00029 (atomic chat removal + announcements)

## Context

Authors the single migration that ends chat and lays down the `announcements` table. The migration must be atomic: if any statement fails, the whole thing rolls back. Statement order is **non-negotiable** per D-55-02 and the Phase 55 success criterion #4 — reordering crashes the dashboard for any session that hits the DB mid-transaction.

This plan **writes the file only**. Applying the migration to the database happens in Plan 55-03 (schema push wave).

## Tasks

<task id="55-01-T1" type="execute">
  <title>Create supabase/migrations/00029_chat_removal_announcements.sql with full atomic transaction</title>
  <read_first>
    - supabase/migrations/00017_chat_badges.sql (current get_sidebar_badges — full source to port without unread_messages branches)
    - supabase/migrations/00027_get_coach_milestones_and_backfill.sql (latest migration — header style reference)
    - supabase/migrations/00015_v1_4_schema.sql (updated_at trigger pattern reference)
    - supabase/migrations/00021_analytics_foundation.sql (RLS policy reference using (SELECT auth.uid()) initplan pattern)
    - .planning/phases/55-chat-removal-announcements-migration/55-CONTEXT.md (locked decisions D-55-01…05)
  </read_first>
  <action>
    Create `supabase/migrations/00029_chat_removal_announcements.sql` with **exactly this structure** (single BEGIN…COMMIT, statement order non-negotiable):

    ```sql
    -- ============================================================================
    -- Phase 55: Chat Removal + Announcements Migration
    -- Migration: 00029_chat_removal_announcements.sql
    --
    -- ATOMIC TRANSACTION — statement order is NON-NEGOTIABLE:
    --   (1) CREATE OR REPLACE FUNCTION get_sidebar_badges (no unread_messages)
    --   (2) CREATE TABLE announcements (+ RLS + trigger + index)
    --   (3) DROP TABLE messages CASCADE
    --
    -- Rationale: between steps (1) and (3) any session that calls
    -- get_sidebar_badges must see a function body that does NOT reference
    -- the messages table. Dropping messages before replacing the function
    -- would crash every dashboard page load for concurrent sessions.
    -- ============================================================================

    BEGIN;

    -- --------------------------------------------------------------------------
    -- (1) Replace get_sidebar_badges — strip ALL unread_messages branches
    -- --------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)
    RETURNS jsonb
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      -- SYNC: must match OWNER_CONFIG.alertThresholds in src/lib/config.ts
      v_inactive_days   integer := 3;
      v_dropoff_days    integer := 7;
      v_coach_rating    numeric := 2.5;
      v_coach_window    integer := 14;
      -- SYNC: must match COACH_CONFIG.reportInboxDays in src/lib/config.ts
      v_report_inbox_days integer := 7;

      v_today          date := CURRENT_DATE;
      v_inactive_cutoff date;
      v_dropoff_cutoff  date;
      v_coach_window_cutoff date;

      v_alert_count    integer := 0;
      v_dismissed_count integer := 0;

      v_student        RECORD;
      v_last_active    date;
      v_account_age_days numeric;

      v_unreviewed_count integer := 0;

      v_coach          RECORD;
      v_avg_rating     numeric;

      v_milestone_count     integer := 0;
      v_milestone_dismissed integer := 0;
    BEGIN
      -- --------------------------------------------------------------
      -- COACH ROLE: unreviewed reports + 100h milestone alerts
      -- (unread_messages removed — Phase 55)
      -- --------------------------------------------------------------
      IF p_role = 'coach' THEN
        SELECT count(*)
          INTO v_unreviewed_count
          FROM daily_reports dr
          JOIN users s ON s.id = dr.student_id
         WHERE s.coach_id = p_user_id
           AND s.status   = 'active'
           AND dr.date   >= (v_today - v_report_inbox_days)
           AND dr.reviewed_by IS NULL
           AND dr.submitted_at IS NOT NULL;

        FOR v_student IN
          SELECT u.id
          FROM users u
          WHERE u.role = 'student'
            AND u.status = 'active'
            AND u.coach_id = p_user_id
            AND u.joined_at >= CURRENT_DATE - 45
        LOOP
          IF (
            SELECT COALESCE(SUM(ws.session_minutes), 0)
            FROM work_sessions ws
            WHERE ws.student_id = v_student.id
              AND ws.status = 'completed'
          ) >= 6000 THEN
            v_milestone_count := v_milestone_count + 1;
          END IF;
        END LOOP;

        SELECT count(*)
          INTO v_milestone_dismissed
          FROM alert_dismissals
         WHERE owner_id = p_user_id
           AND alert_key LIKE '100h_milestone:%';

        RETURN jsonb_build_object(
          'unreviewed_reports', v_unreviewed_count,
          'coach_milestone_alerts', GREATEST(0, v_milestone_count - v_milestone_dismissed)
        );
      END IF;

      -- --------------------------------------------------------------
      -- STUDENT ROLE: (unread_messages removed — Phase 55)
      -- Returns empty object; no student badges after chat removal.
      -- Phase 56 will add unread_announcements here.
      -- --------------------------------------------------------------
      IF p_role = 'student' THEN
        RETURN '{}'::jsonb;
      END IF;

      -- --------------------------------------------------------------
      -- OWNER ROLE: multi-signal alert count
      -- (unread_messages removed from return object — Phase 55)
      -- --------------------------------------------------------------
      IF p_role = 'owner' THEN
        v_inactive_cutoff     := v_today - v_inactive_days;
        v_dropoff_cutoff      := v_today - v_dropoff_days;
        v_coach_window_cutoff := v_today - v_coach_window;

        FOR v_student IN
          SELECT
            u.id,
            u.joined_at,
            MAX(GREATEST(
              (SELECT MAX(ws.date) FROM work_sessions ws WHERE ws.student_id = u.id AND ws.date >= v_dropoff_cutoff),
              (SELECT MAX(dr.date) FROM daily_reports dr  WHERE dr.student_id = u.id AND dr.date >= v_dropoff_cutoff AND dr.submitted_at IS NOT NULL)
            )) AS last_active
          FROM users u
          WHERE u.role = 'student' AND u.status = 'active'
          GROUP BY u.id, u.joined_at
        LOOP
          v_last_active      := v_student.last_active;
          v_account_age_days := EXTRACT(EPOCH FROM (now() - v_student.joined_at)) / 86400.0;

          IF v_last_active IS NULL OR v_last_active < v_dropoff_cutoff THEN
            IF v_account_age_days < v_dropoff_days THEN
              CONTINUE;
            END IF;
            v_alert_count := v_alert_count + 1;
          ELSIF v_last_active < v_inactive_cutoff THEN
            IF v_account_age_days < v_inactive_days THEN
              CONTINUE;
            END IF;
            v_alert_count := v_alert_count + 1;
          END IF;
        END LOOP;

        SELECT count(*)
          INTO v_unreviewed_count
          FROM daily_reports
         WHERE reviewed_by IS NULL
           AND submitted_at IS NOT NULL;

        IF v_unreviewed_count > 0 THEN
          v_alert_count := v_alert_count + 1;
        END IF;

        FOR v_coach IN
          SELECT id FROM users WHERE role = 'coach' AND status = 'active'
        LOOP
          SELECT AVG(dr.star_rating)
            INTO v_avg_rating
            FROM daily_reports dr
            JOIN users s ON s.id = dr.student_id
           WHERE s.coach_id = v_coach.id
             AND dr.date   >= v_coach_window_cutoff
             AND dr.submitted_at IS NOT NULL
             AND dr.star_rating IS NOT NULL;

          IF v_avg_rating IS NOT NULL AND v_avg_rating < v_coach_rating THEN
            v_alert_count := v_alert_count + 1;
          END IF;
        END LOOP;

        SELECT count(*)
          INTO v_dismissed_count
          FROM alert_dismissals
         WHERE owner_id = p_user_id;

        RETURN jsonb_build_object(
          'active_alerts', GREATEST(0, v_alert_count - v_dismissed_count)
        );
      END IF;

      -- Any other role (student_diy or unknown): empty object
      RETURN '{}'::jsonb;
    END;
    $$;

    -- --------------------------------------------------------------------------
    -- (2) Create announcements table + RLS + updated_at trigger + index
    -- --------------------------------------------------------------------------
    CREATE TABLE public.announcements (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      content    text NOT NULL CHECK (char_length(content) <= 2000),
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );

    CREATE INDEX announcements_created_at_idx
      ON public.announcements (created_at DESC);

    -- updated_at trigger (D-55-05)
    CREATE OR REPLACE FUNCTION public.announcements_set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER announcements_updated_at_trigger
      BEFORE UPDATE ON public.announcements
      FOR EACH ROW
      EXECUTE FUNCTION public.announcements_set_updated_at();

    -- RLS (D-55-02: full RLS in 00029)
    ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

    -- SELECT: all authenticated users (owner, coach, student, student_diy)
    CREATE POLICY announcements_select_authenticated
      ON public.announcements
      FOR SELECT
      USING ((SELECT auth.uid()) IS NOT NULL);

    -- INSERT: owner + coach only; author_id must be the caller
    CREATE POLICY announcements_insert_owner_coach
      ON public.announcements
      FOR INSERT
      WITH CHECK (
        author_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.role IN ('owner', 'coach')
        )
      );

    -- UPDATE: owner + coach only, author-scoped
    CREATE POLICY announcements_update_own
      ON public.announcements
      FOR UPDATE
      USING (
        author_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.role IN ('owner', 'coach')
        )
      )
      WITH CHECK (
        author_id = (SELECT auth.uid())
      );

    -- DELETE: owner + coach only, author-scoped
    CREATE POLICY announcements_delete_own
      ON public.announcements
      FOR DELETE
      USING (
        author_id = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.role IN ('owner', 'coach')
        )
      );

    -- Grants (match style of 00002_fix_grants.sql)
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

    -- --------------------------------------------------------------------------
    -- (3) Drop messages table (CASCADE — removes dependent FKs/policies)
    -- --------------------------------------------------------------------------
    DROP TABLE public.messages CASCADE;

    COMMIT;
    ```

    **Constraints that MUST be preserved verbatim in the file:**
    - First non-comment line after the header is `BEGIN;` and last non-comment line is `COMMIT;`
    - There is exactly one `BEGIN;` and one `COMMIT;` (no nested transactions, no SAVEPOINTs)
    - `CREATE OR REPLACE FUNCTION public.get_sidebar_badges` appears BEFORE `CREATE TABLE public.announcements` which appears BEFORE `DROP TABLE public.messages CASCADE`
    - The new `get_sidebar_badges` body contains zero occurrences of the strings `messages`, `unread_messages`, `recipient_id`, `is_broadcast`, or `read_at`
    - Every RLS policy uses `(SELECT auth.uid())` — never bare `auth.uid()`
    - The student branch returns `'{}'::jsonb` (empty object, not `jsonb_build_object('unread_messages', ...)`)
    - The owner branch's returned jsonb has keys `active_alerts` only (no `unread_messages: 0`)
  </action>
  <acceptance_criteria>
    - `test -f supabase/migrations/00029_chat_removal_announcements.sql` exits 0
    - `grep -c "^BEGIN;" supabase/migrations/00029_chat_removal_announcements.sql` returns 1
    - `grep -c "^COMMIT;" supabase/migrations/00029_chat_removal_announcements.sql` returns 1
    - Running `awk '/CREATE OR REPLACE FUNCTION public.get_sidebar_badges/{print NR; exit}' supabase/migrations/00029_chat_removal_announcements.sql` returns a line number LOWER than `awk '/CREATE TABLE public.announcements/{print NR; exit}' ...` which is LOWER than `awk '/DROP TABLE public.messages CASCADE/{print NR; exit}' ...`
    - `grep -c "unread_messages" supabase/migrations/00029_chat_removal_announcements.sql` returns 0
    - `grep -c "FROM messages" supabase/migrations/00029_chat_removal_announcements.sql` returns exactly 0 inside the get_sidebar_badges body (only the DROP statement should mention `messages`). Validate with: `grep -n "messages" supabase/migrations/00029_chat_removal_announcements.sql` shows only `DROP TABLE public.messages CASCADE;` and comment lines.
    - `grep -c "(SELECT auth.uid())" supabase/migrations/00029_chat_removal_announcements.sql` returns >= 8 (4 policies × at least 2 references each)
    - `grep -c "CREATE POLICY announcements_" supabase/migrations/00029_chat_removal_announcements.sql` returns 4
    - `grep -c "CREATE INDEX announcements_created_at_idx" supabase/migrations/00029_chat_removal_announcements.sql` returns 1
    - `grep -c "CREATE TRIGGER announcements_updated_at_trigger" supabase/migrations/00029_chat_removal_announcements.sql` returns 1
    - `grep -c "char_length(content) <= 2000" supabase/migrations/00029_chat_removal_announcements.sql` returns 1
    - `grep -c "ON DELETE CASCADE" supabase/migrations/00029_chat_removal_announcements.sql` returns >= 1 (author_id FK)
  </acceptance_criteria>
</task>

## Verification

- Migration file is present and well-formed SQL (syntactically — actual DB push happens in Plan 55-03).
- All acceptance-criteria greps pass.
- No code changes in this plan — migration file is the only deliverable.
