---
plan_id: 55-03
phase: 55
title: "[BLOCKING] Apply migration 00029 and regenerate src/lib/types.ts"
wave: 2
depends_on: [55-01, 55-02]
autonomous: false  # interactive: requires SUPABASE_ACCESS_TOKEN / db connection
requirements:
  - CHAT-REM-04
  - CHAT-REM-05
  - CHAT-REM-07
  - ANNOUNCE-01
files_modified:
  - supabase/migrations/00029_chat_removal_announcements.sql  # applied (no file change)
  - src/lib/types.ts  # regenerated from live DB
must_haves:
  - Migration 00029 executed successfully against the target database
  - messages table no longer exists in the DB
  - announcements table exists with all columns, FK, RLS, index, trigger
  - src/lib/types.ts regenerated — contains announcements type block, no messages type block
---

# Plan 55-03 — [BLOCKING] Schema push + TypeScript types regeneration

## Context

Supabase-backed project; TypeScript types in `src/lib/types.ts` are generated from the live DB schema via `npx supabase gen types`. The project's verification strategy (CLAUDE.md hard-rule pattern: config/types are the source of truth for build) requires types to reflect the actual database — otherwise `npm run build` can false-positive pass even when the DB is out of sync.

This plan runs the migration, regenerates types, and confirms the messages type block is gone + announcements type block is present. It is marked `autonomous: false` because it requires a DB connection (env-dependent) and may prompt for credentials.

## Tasks

<task id="55-03-T1" type="execute">
  <title>Apply migration 00029 to the Supabase database</title>
  <read_first>
    - supabase/migrations/00029_chat_removal_announcements.sql (file produced by Plan 55-01)
    - supabase/config.toml (project + db connection settings)
  </read_first>
  <action>
    Run the Supabase migration push:
    ```
    supabase db push
    ```

    **If the command requires auth:** Set `SUPABASE_ACCESS_TOKEN` in env, or run `supabase login` first. Do NOT commit the token.

    **Non-TTY workaround:** If running headless (e.g., CI), ensure `SUPABASE_ACCESS_TOKEN` is set. Command is non-interactive when token is present.

    **Atomicity guarantee:** The migration is a single `BEGIN…COMMIT` block (per Plan 55-01). If any statement fails, the transaction rolls back and the DB is unchanged. If push fails mid-migration and reports a partial state, STOP and report the error — do NOT attempt ad-hoc recovery SQL. The rollback is automatic; re-running `supabase db push` after fixing the underlying issue is the correct path.

    **Post-push validation queries** (run via `psql` or Supabase SQL editor; copy/paste the results into task log):
    ```sql
    -- Must return 0:
    SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages';

    -- Must return 1:
    SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements';

    -- Must return 5 (id, author_id, content, created_at, updated_at):
    SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'announcements';

    -- Must return 4 (SELECT, INSERT, UPDATE, DELETE):
    SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'announcements';

    -- Must return 1:
    SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'announcements_created_at_idx';

    -- Must return 1:
    SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name = 'announcements_updated_at_trigger';

    -- Must succeed (no error about missing messages table):
    SELECT get_sidebar_badges(
      (SELECT id FROM users WHERE role = 'coach' LIMIT 1),
      'coach'
    );
    ```
  </action>
  <acceptance_criteria>
    - `supabase db push` exits 0 (or equivalent — "already up to date" is also acceptable if the migration was previously applied)
    - Post-push validation query: `SELECT count(*) FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public'` returns 0
    - Post-push validation query: `SELECT count(*) FROM information_schema.tables WHERE table_name = 'announcements' AND table_schema = 'public'` returns 1
    - Post-push validation query: `SELECT count(*) FROM pg_policies WHERE tablename = 'announcements'` returns 4
    - Calling `get_sidebar_badges(<coach_uuid>, 'coach')` returns a jsonb object with keys `unreviewed_reports` and `coach_milestone_alerts` and NO `unread_messages` key
  </acceptance_criteria>
</task>

<task id="55-03-T2" type="execute">
  <title>Regenerate src/lib/types.ts from live Supabase schema</title>
  <read_first>
    - src/lib/types.ts (current state — includes messages block on lines ~534-588 that must disappear)
    - supabase/config.toml (for project-id if using --project-id flag)
  </read_first>
  <action>
    Regenerate the TypeScript types from the live database schema:
    ```
    npx supabase gen types typescript --local > src/lib/types.ts
    ```

    **If using a remote/linked project** instead of local:
    ```
    npx supabase gen types typescript --linked > src/lib/types.ts
    ```

    **If neither works (no local instance, no linked project):** Use the project-id:
    ```
    npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types.ts
    ```
    The `<PROJECT_ID>` can be found in `supabase/config.toml` or in the Supabase dashboard URL.

    After regen, verify the file was written and is non-empty:
    ```
    test -s src/lib/types.ts
    ```

    **If the regen output differs drastically from the previous file** (e.g., missing tables that should still exist like `users`, `daily_reports`, `work_sessions`, `roadmap_progress`, `invites`, `magic_links`), STOP — this indicates the command hit the wrong database. Re-check connection settings before proceeding.
  </action>
  <acceptance_criteria>
    - `test -s src/lib/types.ts` exits 0 (file exists and is non-empty)
    - `grep -c "messages:" src/lib/types.ts` in the Tables block returns 0 (the messages table type block is gone). Verify with: `grep -A2 "Tables: {" src/lib/types.ts | head -200 | grep "messages:"` returns empty.
    - `grep -c "announcements:" src/lib/types.ts` returns >= 1 (new announcements type block exists)
    - `grep -c "users:" src/lib/types.ts` returns >= 1 (pre-existing tables preserved — sanity check we hit the right DB)
    - `grep -c "work_sessions:" src/lib/types.ts` returns >= 1
    - `grep -c "daily_reports:" src/lib/types.ts` returns >= 1
    - `grep -c "roadmap_progress:" src/lib/types.ts` returns >= 1
  </acceptance_criteria>
</task>

<task id="55-03-T3" type="execute">
  <title>Scrub any residual unread_messages references</title>
  <read_first>
    - Output of `grep -rn "unread_messages" src/` (post-regen)
  </read_first>
  <action>
    Run: `grep -rn "unread_messages" src/`

    Expected result: **zero matches**.

    - If the regenerated `src/lib/types.ts` contains `unread_messages`, that's a bug — it means the DB still has the column somewhere. STOP and investigate (the function return shape shouldn't be in the generated types file anyway; only table columns are).
    - If any other source file contains `unread_messages`, that's a Plan 55-02 gap. Open that file, remove the reference, and note which file required fixing.

    This task is a safety net — if Plan 55-02 was thorough, there is nothing to do here.
  </action>
  <acceptance_criteria>
    - `grep -rn "unread_messages" src/` returns 0 matches
  </acceptance_criteria>
</task>

## Verification

- DB state matches expected post-migration shape (messages gone, announcements present with RLS + index + trigger).
- TypeScript types regenerated and reflect DB.
- Zero `unread_messages` references anywhere in `src/`.
- Plan 55-04 will confirm `npm run build` passes clean.
