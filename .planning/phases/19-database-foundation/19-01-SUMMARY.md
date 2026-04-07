---
phase: 19-database-foundation
plan: "01"
subsystem: database
tags: [indexes, singleton, performance, migration, supabase]
dependency_graph:
  requires: []
  provides: [DB-01, DB-02]
  affects: [all API routes using createAdminClient, work_sessions queries, roadmap_progress queries]
tech_stack:
  added: []
  patterns: [module-level singleton, idempotent CREATE INDEX IF NOT EXISTS]
key_files:
  created:
    - supabase/migrations/00009_database_foundation.sql
  modified:
    - src/lib/supabase/admin.ts
decisions:
  - "Used module-level singleton with lazy init (not eager) so missing env vars surface at request time, not module load"
  - "Kept createAdminClient() function name unchanged — 36 call sites require zero modification"
  - "Used CREATE INDEX IF NOT EXISTS throughout for idempotency on re-runs"
metrics:
  duration: "1 minute"
  completed: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements:
  - DB-01
  - DB-02
---

# Phase 19 Plan 01: Database Foundation — Migration and Admin Singleton Summary

**One-liner:** Composite index on work_sessions(student_id, date, status) via idempotent migration + module-level singleton admin client with auth options preventing session persistence.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create migration 00009 with composite index and pg_stat_statements | 4b39184 | supabase/migrations/00009_database_foundation.sql |
| 2 | Convert createAdminClient to module-level singleton | e897f65 | src/lib/supabase/admin.ts |

## What Was Built

### Task 1: Migration 00009

Created `supabase/migrations/00009_database_foundation.sql` with:

1. **`idx_work_sessions_student_date_status`** — new covering index on `public.work_sessions(student_id, date, status)`. Satisfies DB-01. Adds status coverage for work-tracker "find active session" queries that filter by `status = 'in_progress'`. The existing `idx_work_sessions_student_date` covers (student_id, date) hot path; this new index extends it for the 3-column pattern.

2. **`idx_roadmap_progress_student` (no-op)** — idempotent `CREATE INDEX IF NOT EXISTS` confirming this index already exists from migration 00001. Documents DB-01 traceability.

3. **`pg_stat_statements` extension** — `CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions`. Enables query performance monitoring baseline for Phase 20 (Query Consolidation). On Supabase hosted, typically enabled via Dashboard; this anchors the intent in version control.

All statements use `IF NOT EXISTS` for idempotency. No DROP statements. No RLS policy modifications.

### Task 2: Admin Client Singleton

Converted `src/lib/supabase/admin.ts` from per-call instantiation to module-level singleton:

- Module-level `let _adminClient: ReturnType<typeof createClient<Database>> | null = null`
- Lazy initialization: `if (!_adminClient) { _adminClient = createClient(...) }`
- Auth options: `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` — prevents service_role from attempting cookie-based session management (stateless by design)
- Function signature `createAdminClient()` unchanged — all 36 call sites transparent to change
- `import "server-only"` directive retained — enforces CLAUDE.md rule: admin client only in server code
- `server.ts` and `client.ts` NOT modified (per D-03 constraint)

## Verification

- `npx tsc --noEmit`: PASS (zero errors)
- `npm run build`: PASS (34 pages, zero errors)
- Migration file content checks: PASS (idx_work_sessions_student_date_status present, pg_stat_statements present, IF NOT EXISTS on all CREATE INDEX, no DROP statements)
- server.ts unchanged: PASS (git diff shows no changes)
- client.ts unchanged: PASS (git diff shows no changes)

## Deviations from Plan

None — plan executed exactly as written. All tasks used the exact SQL and TypeScript specified in the plan, with no modifications needed.

## Known Stubs

None — this plan creates infrastructure (SQL migration + TypeScript code). No UI components, no data-binding stubs.

## Self-Check: PASSED

Files exist:
- supabase/migrations/00009_database_foundation.sql: FOUND
- src/lib/supabase/admin.ts: FOUND (modified)

Commits exist:
- 4b39184: FOUND (feat(19-01): add migration 00009)
- e897f65: FOUND (feat(19-01): convert createAdminClient to singleton)
