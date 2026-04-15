---
phase: 55
status: human_needed
autonomous_waves_complete: [1]
blocked_waves: [2, 3]
---

# Phase 55 Verification — Wave 1 complete, Waves 2 + 3 blocked on human action

## Status

**`human_needed`** — the autonomous portion of Phase 55 (Wave 1: Plans 55-01 and 55-02) is complete and committed. Waves 2 and 3 are flagged `autonomous: false` and require a human with Supabase access and a browser.

## What's already done (autonomous, Wave 1)

| Plan | Status | Commits |
|------|--------|---------|
| 55-01 (migration SQL) | complete | `ccaf21c` |
| 55-02 (chat code sweep) | complete | `954ee48`, `792b9e1` |
| Wave 1 tracking | complete | `7306b49` |

## What's blocking

### Plan 55-03 — Apply migration 00029 and regenerate src/lib/types.ts

**Why blocked:** Requires `SUPABASE_ACCESS_TOKEN` / a live DB connection to run `supabase db push` and `npx supabase gen types`. These credentials are not available to the execution agent.

**Manual steps for user:**

1. **Sanity-check the migration locally first (recommended):**
   ```bash
   # From repo root, with supabase CLI linked:
   supabase db reset                # applies all migrations 00001-00029 to local DB
   # Verify tables + function shape:
   supabase db diff                 # expect: clean
   ```
   If `supabase db reset` errors inside 00029, STOP and report — the statement order is the most likely culprit (must be: function replace → table create → drop).

2. **Push to the remote DB:**
   ```bash
   supabase db push
   ```

3. **Regenerate types:**
   ```bash
   npx supabase gen types typescript --linked > src/lib/types.ts
   # or if using project-id form:
   # npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/types.ts
   ```

4. **Verify the regenerated file:**
   ```bash
   grep -c "messages:" src/lib/types.ts       # expect 0 (messages table block gone)
   grep -c "announcements:" src/lib/types.ts  # expect >=1 (announcements table present)
   grep -c "unread_messages" src/lib/types.ts # expect 0
   ```

5. **Commit:**
   ```bash
   git add src/lib/types.ts
   git commit -m "feat(55-03): apply migration 00029 and regenerate src/lib/types.ts"
   ```

6. **Write `.planning/phases/55-chat-removal-announcements-migration/55-03-SUMMARY.md`** with status: complete.

### Plan 55-04 — Verify clean build and dashboard loads for all 4 roles

**Why blocked:** Requires a running dev server and live browser sessions for owner, coach, student, and student_diy roles.

**Manual verification steps:**

1. **Type-check, lint, build (these can be run after 55-03):**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
   All three must exit 0 with no errors.

2. **Smoke-test each role:**
   ```bash
   npm run dev
   # In browser, log in as each of:
   #   - owner  (expect: dashboard loads, no Chat in sidebar, no console errors)
   #   - coach  (expect: dashboard loads, no Chat in sidebar, unreviewed_reports + coach_milestone_alerts badges still render)
   #   - student      (expect: dashboard loads, no Chat in sidebar, Ask Abu Lahya still visible)
   #   - student_diy  (expect: dashboard loads, unchanged — never had Chat)
   ```

3. **Confirm the sidebar `get_sidebar_badges` RPC returns the right shape for each role:**
   - Owner → `{ active_alerts: <n> }`
   - Coach → `{ unreviewed_reports: <n>, coach_milestone_alerts: <n> }`
   - Student → `{}`
   - Student_diy → `{}`

4. **Commit the verification artifact:**
   Write `.planning/phases/55-chat-removal-announcements-migration/55-04-SUMMARY.md` with per-role PASS/FAIL observations.

## Safety note — non-negotiable statement ordering

The migration is an **atomic single-transaction** file. Supabase / Postgres will apply it as one unit; either the whole thing succeeds or the whole thing rolls back. No dashboard downtime can happen mid-transaction. Verified via `awk` during Plan 55-01:

- `CREATE OR REPLACE FUNCTION public.get_sidebar_badges` → line 21
- `CREATE TABLE public.announcements` → line 193
- `DROP TABLE public.messages CASCADE` → line 277

If `supabase db push` fails, the live DB is unchanged (transaction rollback).

## Checkpoint for resume

To resume automation after the human steps above, re-run:

```bash
# after plan 03 completes:
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap update-plan-progress 55 55-03 complete

# after plan 04 completes:
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap update-plan-progress 55 55-04 complete

# Then invoke the GSD phase verifier:
# (or just run the next-phase command — the orchestrator handles completion)
```
