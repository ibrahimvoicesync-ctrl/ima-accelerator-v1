---
phase: 01-foundation
plan: 02
subsystem: database
tags: [supabase, postgres, rls, typescript, sql, migrations]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold with TypeScript strict mode and @supabase/ssr installed
provides:
  - 6-table V1 Postgres schema with RLS, triggers, and performance-optimized policies
  - Typed Supabase client factories (admin, server, browser)
  - Database type definitions matching V1 schema (Row/Insert/Update for all 6 tables)
  - Realistic seed data (8 users, sessions, roadmap progress, daily reports)
affects: [02-auth, 03-student, 04-coach, 05-owner, all phases querying data]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "(select get_user_role()) initplan wrapper pattern for RLS performance"
    - "Deterministic UUIDs (00000000-0000-0000-0000-00000000XXXX) for seed data"
    - "NULL auth_id on all seed users — linked post-OAuth by email match"
    - "Three-tier Supabase client: admin (service role) / server (SSR+cookies) / browser"

key-files:
  created:
    - supabase/migrations/00001_create_tables.sql
    - supabase/seed.sql
    - src/lib/supabase/admin.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/types.ts
  modified: []

key-decisions:
  - "types.ts is a hand-crafted typed placeholder (Docker not running) — regenerate with `npx supabase gen types typescript --local > src/lib/types.ts` once Docker is running"
  - "magic_links uses standalone design from migration 00003 (not invite-tied from rebuild plan) — more flexible, reusable across registration paths"
  - "All 5 security functions in single migration 00001 — simpler than reference project's 3-migration approach"

patterns-established:
  - "RLS policy pattern: always use (select get_user_role()) and (select get_user_id()) initplan wrappers, never raw function calls"
  - "Admin client pattern: import server-only guard in admin.ts, never import in client components"
  - "Seed data pattern: deterministic UUIDs, NULL auth_id, realistic date offsets with NOW() - INTERVAL"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 1 Plan 2: Database Schema, Clients, and Types Summary

**6-table V1 Postgres schema (RLS on all tables, initplan-optimized policies, security triggers) with three typed Supabase client tiers and Database type definitions**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T15:04:21Z
- **Completed:** 2026-03-16T15:09:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- V1 Postgres schema with 6 tables (users, invites, magic_links, work_sessions, roadmap_progress, daily_reports), helper functions, security triggers, and RLS policies on all tables using the `(select get_user_role())` initplan performance wrapper
- Realistic seed data with 8 users (1 owner, 2 coaches, 5 students), 9 work sessions, 50 roadmap progress rows, and 10 daily reports with varied statuses and dates
- Three typed Supabase client factories: `createAdminClient()` (service role, server-only guarded), `createClient()` (SSR with cookies, async), and `createClient()` (browser); all typed with the `Database` generic; `npx tsc --noEmit` passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: V1 database migration with 6 tables, RLS policies, and seed data** - `8489895` (feat)
2. **Task 2: Three Supabase client tiers and TypeScript Database types** - `df4a324` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified

- `supabase/migrations/00001_create_tables.sql` — Single migration: helper functions, 6 tables, indexes, RLS, security triggers
- `supabase/seed.sql` — Realistic seed: 8 users, invites, magic link, work sessions, roadmap progress, daily reports
- `src/lib/supabase/admin.ts` — Service-role client with `import "server-only"` guard
- `src/lib/supabase/server.ts` — SSR client with cookie handling for Next.js App Router
- `src/lib/supabase/client.ts` — Browser client using `createBrowserClient`
- `src/lib/types.ts` — Typed Database schema placeholder (hand-crafted, fully typed Row/Insert/Update for all 6 tables)

## Decisions Made

- **types.ts is a typed placeholder, not auto-generated:** Docker Desktop was not running so `npx supabase gen types typescript --local` failed. Created a hand-crafted placeholder with full Row/Insert/Update typings matching the schema exactly. Regenerate once Docker is running.
- **magic_links design from migration 00003:** Used the standalone magic_links table (code, role, created_by, max_uses, use_count, is_active) rather than the invite-tied version in IMA-V1-REBUILD-PLAN.md. The 00003 version is more flexible.
- **Single migration file:** All V1 infrastructure in one migration (00001_create_tables.sql) rather than the 3-migration split in reference-old. Simpler for a clean rebuild.

## Deviations from Plan

None — plan executed exactly as written. The `supabase db reset` verification was blocked by Docker not running (infrastructure gate, not a code error). All other verifications passed.

## Issues Encountered

- **Docker not running:** Both `npx supabase db reset` and `npx supabase gen types typescript --local` require Docker Desktop. Docker returned "pipe/docker_engine not found." This blocked live schema validation and type generation. Resolution: verified migration SQL correctness by inspection against reference patterns; created typed placeholder for types.ts per the plan's fallback instruction. No code changes required.

## User Setup Required

**Docker required for full local development.** When Docker Desktop is running:

1. Start local Supabase: `npx supabase start`
2. Apply migration and seed: `npx supabase db reset`
3. Regenerate types: `npx supabase gen types typescript --local > src/lib/types.ts`
4. Add `.env.local` with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
   SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase start output>
   ```

## Next Phase Readiness

- Data layer complete: 6-table schema, typed clients, seed data ready for 01-03 (auth flow)
- Admin client requires `SUPABASE_SERVICE_ROLE_KEY` env var — set before running auth callback
- types.ts placeholder compiles cleanly — regenerate with actual schema once Docker running
- No blockers for 01-03 (auth) which will use all three client tiers

---
*Phase: 01-foundation*
*Completed: 2026-03-16*
