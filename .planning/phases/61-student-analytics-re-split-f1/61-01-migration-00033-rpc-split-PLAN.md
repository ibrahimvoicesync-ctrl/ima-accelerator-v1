---
phase: 61
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00033_fix_student_analytics_outreach_split.sql
autonomous: true
requirements:
  - SA-03
  - SA-09
must_haves:
  truths:
    - "Migration 00033 applies cleanly on top of migration 00032 (last applied)"
    - "After migration, exactly one overload of public.get_student_analytics exists in pg_proc"
    - "RPC totals jsonb contains total_brand_outreach + total_influencer_outreach keys and does NOT contain total_emails / total_influencers keys"
    - "Daily report form schema untouched — brands_contacted + influencers_contacted columns on daily_reports remain separate integers"
  artifacts:
    - path: "supabase/migrations/00033_fix_student_analytics_outreach_split.sql"
      provides: "Breaking DROP+CREATE of get_student_analytics with renamed totals keys"
      contains: "DO $drop$"
  key_links:
    - from: "supabase/migrations/00033_fix_student_analytics_outreach_split.sql"
      to: "pg_proc.get_student_analytics(uuid, text, int, int)"
      via: "DROP FUNCTION ... (identity_args) loop + CREATE OR REPLACE FUNCTION"
      pattern: "pg_get_function_identity_arguments"
---

<objective>
Create migration `00033_fix_student_analytics_outreach_split.sql` that drops every existing overload of `public.get_student_analytics` via the defensive `DO $drop$` pattern, then recreates it with the same `(uuid, text, int, int) RETURNS jsonb` signature and body — EXCEPT the `v_totals` `jsonb_build_object` call, which replaces the `total_emails` + `total_influencers` keys with `total_brand_outreach` + `total_influencer_outreach`. Finishes with a post-migration `DO $assert$` that verifies exactly one overload remains in `pg_proc`.

Purpose: Fixes the double-count bug (old `total_emails` = `SUM(brands + influencers)` was both mis-labeled and double-counted influencers). Breaking jsonb shape; consumers in Plan 02/03 depend on this shape.

Output: Single SQL file applied via `supabase db push` or local `supabase migration up`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md
@.planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md
@.planning/phases/61-student-analytics-re-split-f1/61-VALIDATION.md
@supabase/migrations/00023_get_student_analytics.sql
@supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql
</context>

<interfaces>
<!-- RPC signature (UNCHANGED - only the RETURNS jsonb payload shape changes): -->

```sql
public.get_student_analytics(
  p_student_id uuid,
  p_range      text DEFAULT '30d',
  p_page       int  DEFAULT 1,
  p_page_size  int  DEFAULT 25
) RETURNS jsonb
```

<!-- Current v_totals jsonb_build_object (00023_get_student_analytics.sql lines 92-121) - MUST REPLACE these two keys: -->

```sql
-- OLD (lines 98-110 in 00023):
'total_emails',
  COALESCE((
    SELECT SUM(COALESCE(brands_contacted,0) + COALESCE(influencers_contacted,0))
    FROM daily_reports
    WHERE student_id = p_student_id AND submitted_at IS NOT NULL
  ), 0),
'total_influencers',
  COALESCE((
    SELECT SUM(COALESCE(influencers_contacted,0))
    FROM daily_reports
    WHERE student_id = p_student_id AND submitted_at IS NOT NULL
  ), 0),
```

<!-- Full current expected totals keys set (after rename): total_hours, total_brand_outreach, total_influencer_outreach, total_deals, total_revenue, total_profit -->
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 00033 — defensive DROP + CREATE OR REPLACE with renamed jsonb keys + post-assert</name>
  <files>supabase/migrations/00033_fix_student_analytics_outreach_split.sql</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md (the "Migration 00033 Structural Template" section + "Pattern 1: Defensive RPC DROP" section)
    - supabase/migrations/00023_get_student_analytics.sql (ENTIRE file — the body of the current RPC is copied verbatim EXCEPT the v_totals jsonb_build_object call at lines 92-121)
    - supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql (defensive drop pattern precedent)
  </read_first>

  <action>
    Create a NEW file at `supabase/migrations/00033_fix_student_analytics_outreach_split.sql`. Structure:

    1. File-header comment block (4-6 lines) stating: Phase 61 (v1.8 F1) breaking re-split; removes `total_emails` / `total_influencers` from totals payload; adds `total_brand_outreach` / `total_influencer_outreach`; supersedes 00023; consumers updated in same commit.

    2. `BEGIN;`

    3. Defensive drop block — copy VERBATIM from 61-RESEARCH.md section "Pattern 1: Defensive RPC DROP before CREATE":
       ```sql
       DO $drop$
       DECLARE r record;
       BEGIN
         FOR r IN
           SELECT pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics'
         LOOP
           EXECUTE format('DROP FUNCTION public.get_student_analytics(%s) CASCADE', r.args);
         END LOOP;
       END $drop$;
       ```

    4. `CREATE OR REPLACE FUNCTION public.get_student_analytics(p_student_id uuid, p_range text DEFAULT '30d', p_page int DEFAULT 1, p_page_size int DEFAULT 25) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ ... $$;`

    5. Function BODY: Copy the entire `AS $$ ... $$` body VERBATIM from `supabase/migrations/00023_get_student_analytics.sql` (lines 40-255 approximately — everything inside the `AS $$` delimiters) WITH EXACTLY ONE CHANGE inside the `v_totals := jsonb_build_object(` call:

       REMOVE these two key/value pairs (currently at 00023 lines 98-110):
       ```sql
       'total_emails',
         COALESCE((
           SELECT SUM(COALESCE(brands_contacted,0) + COALESCE(influencers_contacted,0))
           FROM daily_reports
           WHERE student_id = p_student_id AND submitted_at IS NOT NULL
         ), 0),
       'total_influencers',
         COALESCE((
           SELECT SUM(COALESCE(influencers_contacted,0))
           FROM daily_reports
           WHERE student_id = p_student_id AND submitted_at IS NOT NULL
         ), 0),
       ```

       REPLACE with:
       ```sql
       'total_brand_outreach',
         COALESCE((
           SELECT SUM(COALESCE(brands_contacted,0))
           FROM daily_reports
           WHERE student_id = p_student_id AND submitted_at IS NOT NULL
         ), 0),
       'total_influencer_outreach',
         COALESCE((
           SELECT SUM(COALESCE(influencers_contacted,0))
           FROM daily_reports
           WHERE student_id = p_student_id AND submitted_at IS NOT NULL
         ), 0),
       ```

       EVERY OTHER LINE OF THE BODY IS IDENTICAL to 00023 — do NOT touch auth guard (`v_caller`), range validation, bucket-mode selection, `v_streak` computation, `v_outreach_trend`, `v_hours_trend`, `v_deals`, `v_deal_summary`, `v_roadmap_progress`, or final `jsonb_build_object` assembly. Preserve comments. Preserve `SECURITY DEFINER`, `STABLE`, `SET search_path = public`.

    6. `COMMENT ON FUNCTION public.get_student_analytics(uuid, text, int, int) IS 'Phase 61 (v1.8 F1): Breaking re-split — totals.total_brand_outreach + total_influencer_outreach replace total_emails + total_influencers. Cache keys bumped to "student-analytics-v2" in same commit. Supersedes 00023.';`

    7. `GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int) TO authenticated, service_role;`

    8. Post-migration assert block:
       ```sql
       DO $assert$
       BEGIN
         IF (SELECT COUNT(*) FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics') <> 1 THEN
           RAISE EXCEPTION 'Migration 00033 post-assert failed: get_student_analytics has <> 1 overload';
         END IF;
       END $assert$;
       ```

    9. `COMMIT;`

    DO NOT add any back-compat shim (no `total_emails` alias in the output jsonb; no ternary that emits both old and new keys). DO NOT touch the `daily_reports` table schema. DO NOT rename the function. DO NOT change the argument list. DO NOT add new arguments.
  </action>

  <verify>
    <automated>grep -c "DO \$drop\$" supabase/migrations/00033_fix_student_analytics_outreach_split.sql &amp;&amp; grep -c "total_brand_outreach" supabase/migrations/00033_fix_student_analytics_outreach_split.sql &amp;&amp; grep -c "total_influencer_outreach" supabase/migrations/00033_fix_student_analytics_outreach_split.sql &amp;&amp; ! grep -q "'total_emails'" supabase/migrations/00033_fix_student_analytics_outreach_split.sql &amp;&amp; ! grep -q "'total_influencers'" supabase/migrations/00033_fix_student_analytics_outreach_split.sql</automated>
  </verify>

  <acceptance_criteria>
    - File `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` exists.
    - Contains exact string `DO $drop$` (defensive drop block present).
    - Contains exact string `pg_get_function_identity_arguments(p.oid)` (defensive-drop loop body).
    - Contains exact string `DROP FUNCTION public.get_student_analytics(%s) CASCADE` (the format() call inside the loop).
    - Contains exact string `'total_brand_outreach'` (new jsonb key literal).
    - Contains exact string `'total_influencer_outreach'` (new jsonb key literal).
    - Contains exact string `SUM(COALESCE(brands_contacted,0))` (the brand-only aggregation — no `+ influencers_contacted`).
    - Does NOT contain the string `'total_emails'` (old key removed).
    - Does NOT contain the string `'total_influencers'` (old key removed, except as a word boundary inside `total_influencer_outreach` — grep with `'total_influencers'` with single quotes must return 0).
    - Does NOT contain the string `SUM(COALESCE(brands_contacted,0) + COALESCE(influencers_contacted,0))` (old double-sum expression removed).
    - Contains exact string `DO $assert$` (post-migration assert block present).
    - Contains exact string `RAISE EXCEPTION 'Migration 00033 post-assert failed` (assert failure path).
    - Contains exact string `GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int) TO authenticated, service_role;`
    - Preserves `SECURITY DEFINER`, `STABLE`, `LANGUAGE plpgsql`, `SET search_path = public` on the CREATE statement.
    - Signature unchanged: `p_student_id uuid, p_range text DEFAULT '30d', p_page int DEFAULT 1, p_page_size int DEFAULT 25`.
    - File wrapped in a single `BEGIN; ... COMMIT;` transaction.
  </acceptance_criteria>

  <done>
    Migration file exists with defensive DROP + CREATE OR REPLACE + renamed totals keys + post-assert; all acceptance_criteria grep checks pass; tsc/build not yet runnable (consumer changes land in Plans 02/03).
  </done>
</task>

</tasks>

<verification>
After this plan:
- `grep "total_brand_outreach" supabase/migrations/00033_fix_student_analytics_outreach_split.sql` returns ≥1 hit
- `grep "'total_emails'" supabase/migrations/00033_fix_student_analytics_outreach_split.sql` returns 0 hits
- `grep "'total_influencers'" supabase/migrations/00033_fix_student_analytics_outreach_split.sql` returns 0 hits (note: exact quoted literal — `total_influencer_outreach` contains `total_influencer` without trailing `s'`)
- `grep "DO \$drop\$" supabase/migrations/00033_fix_student_analytics_outreach_split.sql` returns ≥1 hit
- `grep "DO \$assert\$" supabase/migrations/00033_fix_student_analytics_outreach_split.sql` returns ≥1 hit

Note: The TypeScript/consumer side does not yet compile at this point — that is expected. Plans 02 and 03 land the consumer updates. Do not run `npx tsc --noEmit` as a gate for this plan; it will fail at `AnalyticsClient.tsx` lines 203/208 until Plan 03 runs.
</verification>

<success_criteria>
Migration file created with defensive DROP + CREATE OR REPLACE + post-assert; executor did NOT touch `00023_get_student_analytics.sql` (append-only migration history); executor did NOT add back-compat aliases; function signature unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/61-student-analytics-re-split-f1/61-01-SUMMARY.md` with: migration file path, grep confirmations (the 5 required strings listed above), and a one-line note that tsc will still fail until Plans 02/03 land (expected).
</output>
