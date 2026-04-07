# Phase 19: Database Foundation - Research

**Researched:** 2026-03-30
**Domain:** PostgreSQL performance (indexes, RLS initplan, pg_stat_statements) + TypeScript singleton pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Admin Client Singleton (DB-02)**
- D-01: Keep the function name `createAdminClient()` — changing internals to singleton pattern but NOT renaming. Avoids touching 36 files for a rename; the name is already established across the codebase.
- D-02: Singleton uses `let` module-level variable with lazy initialization. Auth options: `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` since service_role is stateless.
- D-03: Do NOT apply singleton pattern to `createServerClient()` — it reads request-scoped cookies and must be instantiated per-request. This is a hard constraint from v1.2 research.

**Composite Indexes (DB-01)**
- D-04: Verify existing indexes are optimal AND add missing ones. Existing indexes `idx_work_sessions_student_date(student_id, date)` and `idx_daily_reports_student_date(student_id, date)` already cover the primary hot paths — audit whether additional columns (e.g., `status` on work_sessions) improve hot query plans.
- D-05: Use EXPLAIN ANALYZE to verify index usage on actual hot queries before and after changes. Don't add indexes speculatively.

**RLS Initplan Verification (DB-03)**
- D-06: Existing RLS policies already use `(select get_user_role())` and `(select get_user_id())` initplan wrappers — this is already correct. The task is to VERIFY (not rewrite) that all policies follow this pattern, and confirm with EXPLAIN that initplan evaluation occurs.
- D-07: Check helper functions `get_user_id()` and `get_user_role()` — both are marked `STABLE` and `SECURITY DEFINER`, which is correct for initplan optimization.

**Monitoring Baseline (DB-04)**
- D-08: Enable `pg_stat_statements` via Supabase dashboard (extension activation). Capture baseline as a markdown document in the phase directory — version controlled, easily referenced by Phase 20.
- D-09: Record top 10 slowest queries before and after index migration. Format: query text, mean_exec_time, calls, rows returned.

**Migration Strategy**
- D-10: Single migration file (`00009_database_foundation.sql`) for all Phase 19 SQL changes — indexes, any RLS fixes, pg_stat_statements setup. This is a cohesive optimization set, not separate features.

### Claude's Discretion

All decisions above are Claude's discretion — user explicitly deferred all gray areas. Researcher and planner should use best judgment on implementation details within these guardrails.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DB-01 | Composite indexes exist on daily_reports(student_id, date), work_sessions(student_id, date, status), roadmap_progress(student_id) — verified with EXPLAIN ANALYZE | Index gap analysis below: `idx_work_sessions_student_date` and `idx_daily_reports_student_date` exist; `work_sessions(student_id, date, status)` covering index and `roadmap_progress(student_id)` standalone index need verification |
| DB-02 | createAdminClient() is a module-level singleton reused across requests within the same process | Singleton pattern documented in PITFALLS.md Pitfall 1; 36 call sites confirmed in src/; current admin.ts is 15 lines — trivial conversion |
| DB-03 | All RLS policies use (SELECT auth.uid()) instead of auth.uid() for initplan optimization | Migration 00001 already uses `(select get_user_role())` and `(select get_user_id())` wrappers throughout; VERIFY task, not rewrite |
| DB-04 | pg_stat_statements enabled, slow queries >200ms logged, baseline metrics recorded before and after index changes | pg_stat_statements is a Supabase Pro built-in; enable via Dashboard; query view for top-10 baseline capture |

</phase_requirements>

---

## Summary

Phase 19 is a pure infrastructure optimization phase — no UI changes, no new API routes. It addresses four database-level concerns that must be in place before query consolidation work begins in Phase 20.

**Existing state is mostly correct.** Migration 00001 already established composite indexes on `work_sessions(student_id, date)` and `daily_reports(student_id, date)`, and all RLS policies already use the `(select get_user_role())` initplan wrapper pattern. The work here is: (1) audit whether `status` should be included in the work_sessions index and confirm `roadmap_progress(student_id)` is covered, (2) convert `createAdminClient()` to a module-level singleton in one file, (3) run EXPLAIN to formally verify RLS initplan behavior, and (4) enable pg_stat_statements and capture a before/after query baseline.

The singleton conversion affects only `src/lib/supabase/admin.ts` (15 lines). The migration file `00009_database_foundation.sql` covers all index additions and any pg_stat_statements SQL setup. All 36 call sites are transparent to the change.

**Primary recommendation:** Write `00009_database_foundation.sql` first (indexes + pg_stat_statements reset), capture the pre-migration baseline from `pg_stat_statements`, apply the migration, capture the post-migration baseline, then convert `admin.ts` to singleton, and finally run EXPLAIN to verify both index scans and initplan.

---

## Standard Stack

### Core (No New Dependencies)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL (via Supabase) | 17 (confirmed via config.toml `major_version = 17`) | All schema changes, indexes, RLS | Platform database |
| `@supabase/supabase-js` | Already installed | Admin client singleton wrapper | Platform JS client |
| Supabase SQL Editor / psql | — | Running EXPLAIN ANALYZE, pg_stat_statements queries | Only way to inspect execution plans on hosted Supabase |

### No New npm Packages Required

Phase 19 is 100% infrastructure — SQL migrations and one TypeScript file edit. No new npm dependencies are introduced.

**Version verification:** No packages to verify. `@supabase/supabase-js` is already installed and unchanged.

---

## Architecture Patterns

### Recommended File Structure for Phase 19

```
supabase/migrations/
└── 00009_database_foundation.sql   # New — indexes + pg_stat_statements

src/lib/supabase/
└── admin.ts                        # Modified — singleton conversion only

.planning/phases/19-database-foundation/
└── BASELINE.md                     # New — pg_stat_statements before/after capture
```

### Pattern 1: Module-Level Singleton for Stateless Service Client

**What:** A `let` variable at module scope holds the client instance. The exported function checks if it exists and returns it; otherwise creates and stores it. Node.js module caching means this variable persists for the lifetime of the process.

**When to use:** Only for clients that have no per-request state — service_role key is static, no cookies, no session management.

**Current code (admin.ts — 15 lines):**
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

**Target singleton pattern (from PITFALLS.md Pitfall 1, HIGH confidence):**
```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }
  return _adminClient;
}
```

**Key detail:** The function signature is unchanged. All 36 call sites (confirmed via grep) require zero changes.

### Pattern 2: Composite Index on Filter + Sort Columns

**What:** A composite index covers all columns in a query's WHERE clause. Postgres can satisfy the query entirely from the index without touching the heap (index-only scan) when all projected columns are indexed.

**When to use:** Hot query paths that filter by `student_id` AND a second column. Adding `status` to work_sessions covers the common "active sessions for student today" filter.

**Existing indexes in migration 00001 (confirmed by direct read):**
```sql
-- work_sessions
CREATE INDEX idx_work_sessions_student_date ON public.work_sessions(student_id, date);
CREATE UNIQUE INDEX idx_work_sessions_student_date_cycle ON public.work_sessions(student_id, date, cycle_number);
CREATE INDEX idx_work_sessions_student ON public.work_sessions(student_id);

-- daily_reports
CREATE UNIQUE INDEX idx_daily_reports_student_date ON public.daily_reports(student_id, date);
CREATE INDEX idx_daily_reports_date ON public.daily_reports(date);
CREATE INDEX idx_daily_reports_student ON public.daily_reports(student_id);

-- roadmap_progress
CREATE UNIQUE INDEX idx_roadmap_progress_student_step ON public.roadmap_progress(student_id, step_number);
CREATE INDEX idx_roadmap_progress_student ON public.roadmap_progress(student_id);
```

**Gap analysis for DB-01 requirements:**

| Requirement | Existing Coverage | Gap |
|-------------|------------------|-----|
| `daily_reports(student_id, date)` | `idx_daily_reports_student_date` UNIQUE already covers this | None — already unique index |
| `work_sessions(student_id, date, status)` | `idx_work_sessions_student_date` covers (student_id, date) but NOT status | Add `idx_work_sessions_student_date_status(student_id, date, status)` OR verify that existing index is sufficient for actual queries |
| `roadmap_progress(student_id)` | `idx_roadmap_progress_student` already exists | None — already covered |

**The hot work_sessions query (from student dashboard page.tsx, line 45):**
```typescript
admin.from("work_sessions")
  .select("*")
  .eq("student_id", user.id)
  .eq("date", today)
  .order("cycle_number", { ascending: true })
```
This does NOT filter by `status` in the hot path. The `idx_work_sessions_student_date` index already handles this. DB-01 requires verifying `(student_id, date, status)` — add the index but EXPLAIN ANALYZE to confirm it's used.

**Migration 00009 SQL for new index:**
```sql
-- Add covering index for work_sessions status filter (used by active session queries)
CREATE INDEX IF NOT EXISTS idx_work_sessions_student_date_status
  ON public.work_sessions(student_id, date, status);
```

### Pattern 3: RLS initplan Verification via EXPLAIN

**What:** PostgreSQL's EXPLAIN output distinguishes "InitPlan" (evaluated once per query) from per-row subquery evaluation. When RLS uses `(SELECT auth.uid())`, the planner promotes it to an initplan.

**Current RLS state (confirmed by reading 00001_create_tables.sql):** ALL policies already use `(select get_user_role())` and `(select get_user_id())` wrappers. No bare `auth.uid()` calls exist in policy definitions.

**Verification SQL to run in Supabase SQL Editor:**
```sql
-- Verify initplan appears in execution plan for policy-covered query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM work_sessions WHERE student_id = '<test-uuid>' AND date = CURRENT_DATE;
```

The EXPLAIN output should contain `InitPlan` nodes for the `get_user_role()` and `get_user_id()` calls, not inline subplan evaluations.

**Helper function audit (confirmed from 00001):**
```sql
-- Both functions are STABLE and SECURITY DEFINER — correct for initplan
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.users WHERE auth_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE auth_id = auth.uid() $$;
```

`STABLE` + scalar subquery + `SECURITY DEFINER` — this combination is the documented initplan trigger in Postgres RLS.

### Pattern 4: pg_stat_statements Baseline Capture

**What:** pg_stat_statements tracks execution statistics per normalized query. Querying it before and after adding indexes shows which queries improved.

**Enable (one-time, via Supabase Dashboard):**
Dashboard → Database → Extensions → Enable `pg_stat_statements`

**Reset and capture SQL:**
```sql
-- Reset counters before starting the benchmark window
SELECT pg_stat_statements_reset();

-- After running application load (or letting it run for a few hours):
-- Capture top 10 by total execution time
SELECT
  LEFT(query, 120)     AS query_snippet,
  calls,
  ROUND(mean_exec_time::numeric, 2)  AS mean_ms,
  ROUND(total_exec_time::numeric, 2) AS total_ms,
  rows
FROM pg_stat_statements
WHERE calls > 5
ORDER BY total_exec_time DESC
LIMIT 10;
```

**Baseline document:** Store as `.planning/phases/19-database-foundation/BASELINE.md` with before-migration and after-migration snapshots. This is the source of truth for Phase 20 query optimization work.

### Anti-Patterns to Avoid

- **Do NOT apply singleton to `createServerClient()`** — it uses `cookies()` which is request-scoped. Applying the same pattern causes `Error: cookies was called outside a request scope` at runtime (documented Pitfall 2 in PITFALLS.md).
- **Do NOT rename `createAdminClient()`** — Decision D-01 locks this. The function is called in 36 files; a rename provides zero functional benefit.
- **Do NOT add speculative indexes** — Decision D-05 requires EXPLAIN ANALYZE verification before finalizing. Only add an index if the hot query plan shows it's used.
- **Do NOT split into multiple migration files** — Decision D-10 requires a single `00009_database_foundation.sql`.
- **Do NOT use `CREATE INDEX` without `IF NOT EXISTS`** — migrations run on Supabase's hosted environment; idempotency prevents errors on re-run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting if index is used | Manual query timing | `EXPLAIN (ANALYZE, BUFFERS)` | Shows actual execution plan, not just timing guesses |
| Confirming initplan | Visual code inspection | `EXPLAIN` output with `InitPlan` node | Postgres may change optimization; only EXPLAIN confirms runtime behavior |
| Identifying slow queries | Application-level logging | `pg_stat_statements` view | Captures normalized queries across all callers, including PostgREST internals |
| Connection pooling | Custom pool manager | Supabase JS module-level singleton | PostgREST already has a built-in pooler; JS singleton prevents N clients per Lambda |

---

## Common Pitfalls

### Pitfall 1: Applying Singleton to createServerClient (FATAL)

**What goes wrong:** Runtime error `cookies was called outside a request scope`. Pages crash. Happens only in production on cold-start requests, not in dev mode.

**Why it happens:** `createServerClient` from `@supabase/ssr` internally calls Next.js `cookies()`. This function is only valid within a request handler scope, not at module initialization time.

**How to avoid:** The singleton change is scoped ONLY to `src/lib/supabase/admin.ts`. `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` are explicitly out of scope (Decision D-03).

**Warning signs:** Any modification to server.ts or client.ts during this phase is a scope violation.

### Pitfall 2: EXPLAIN Shows Sequential Scan Despite Index Existing

**What goes wrong:** Postgres query planner chooses a seq scan over an available index when the table is small or statistics say seq scan is faster.

**Why it happens:** On a development/staging database with few rows, Postgres correctly determines a seq scan is cheaper than an index scan. The planner chooses based on estimated cost, not index existence.

**How to avoid:** EXPLAIN ANALYZE on production data (or seeded realistic data). For tables with only a handful of rows, a seq scan is correct behavior — don't force index scans artificially.

**Warning signs:** DB-01 acceptance criteria specifically says "index scans, not seq scans" — this is conditional on production-scale data. Document in BASELINE.md if indexes exist but seq scans are chosen due to table size.

### Pitfall 3: Migration 00009 Conflicts with Existing Index Names

**What goes wrong:** `CREATE INDEX idx_work_sessions_student_date_status` fails if the index already exists from a prior attempt.

**Why it happens:** Migrations on Supabase's hosted environment are not always cleanly reset between attempts.

**How to avoid:** Use `CREATE INDEX IF NOT EXISTS` throughout migration 00009. This is idempotent.

### Pitfall 4: pg_stat_statements Not Available at Query Time

**What goes wrong:** `SELECT * FROM pg_stat_statements` returns error `relation "pg_stat_statements" does not exist`.

**Why it happens:** Extension not yet enabled, or the schema search path doesn't include `extensions`.

**How to avoid:** Enable via Dashboard first. Supabase places pg_stat_statements in the `extensions` schema. Query as `SELECT * FROM extensions.pg_stat_statements` or run `SET search_path = extensions, public` first.

### Pitfall 5: Singleton Variable Captured in Test Environment

**What goes wrong:** In tests, the singleton persists between test cases using different environment variables, causing stale client state.

**Why it happens:** Module-level variables persist across test file execution in Jest/Vitest unless the module is explicitly reset.

**How to avoid:** This project has no test infrastructure (confirmed — no test files in src/). The singleton is safe as-is. If tests are added in a future phase, they would need `jest.resetModules()` or module isolation.

---

## Code Examples

### Singleton Admin Client (target state for admin.ts)

```typescript
// src/lib/supabase/admin.ts
// Source: PITFALLS.md Pitfall 1 (project research, HIGH confidence)
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let _adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Server-only Supabase client with service role key.
 * Bypasses RLS — use only in server API routes and server components
 * for admin operations like profile lookups during auth callbacks.
 *
 * Module-level singleton: instantiated once per process, not once per request.
 * Safe for service_role (stateless — no cookies, no session).
 * Do NOT apply this pattern to createServerClient() (request-scoped cookies).
 */
export function createAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  }
  return _adminClient;
}
```

### Migration 00009: Index and pg_stat_statements Setup

```sql
-- supabase/migrations/00009_database_foundation.sql
-- Phase 19: Database Foundation — indexes, RLS verification helpers, pg_stat_statements
-- All CREATE INDEX use IF NOT EXISTS for idempotency.

-- ---------------------------------------------------------------------------
-- 1. Composite index: work_sessions(student_id, date, status)
--    Satisfies DB-01 requirement. Covers queries that filter by status
--    (e.g., in_progress sessions). The existing idx_work_sessions_student_date
--    covers the (student_id, date) hot path; this adds status coverage.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_work_sessions_student_date_status
  ON public.work_sessions(student_id, date, status);

-- ---------------------------------------------------------------------------
-- 2. Confirm roadmap_progress(student_id) coverage.
--    idx_roadmap_progress_student already exists from migration 00001.
--    This CREATE INDEX IF NOT EXISTS is a no-op that documents the intent.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_student
  ON public.roadmap_progress(student_id);

-- ---------------------------------------------------------------------------
-- 3. Enable pg_stat_statements extension (if not already enabled).
--    Note: On Supabase hosted, this is typically enabled via Dashboard.
--    Including here as a documentation anchor and for local dev.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_stat_statements SCHEMA extensions;
```

### EXPLAIN ANALYZE Queries for Verification

```sql
-- Verify index scan on work_sessions hot path (student dashboard)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.work_sessions
WHERE student_id = '<test-uuid>'
  AND date = CURRENT_DATE
ORDER BY cycle_number;

-- Verify index scan on daily_reports hot path (student dashboard + history)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT submitted_at, brands_contacted, influencers_contacted
FROM public.daily_reports
WHERE student_id = '<test-uuid>'
  AND date = CURRENT_DATE;

-- Verify initplan for RLS policies (run as authenticated user, not service_role)
-- Set role context first:
SET LOCAL role = authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "<auth-uuid>"}';
EXPLAIN (ANALYZE, FORMAT TEXT)
SELECT * FROM public.work_sessions LIMIT 5;
-- Look for "InitPlan" nodes in the output, not "SubPlan"
```

### pg_stat_statements Baseline Query

```sql
-- Run in Supabase SQL Editor after enabling extension
-- Capture BEFORE applying migration 00009

SELECT
  LEFT(query, 120)                              AS query_snippet,
  calls,
  ROUND(mean_exec_time::numeric, 2)             AS mean_ms,
  ROUND(total_exec_time::numeric, 2)            AS total_ms,
  rows,
  ROUND(100.0 * shared_blks_hit /
    NULLIF(shared_blks_hit + shared_blks_read, 0), 1) AS cache_hit_pct
FROM extensions.pg_stat_statements
WHERE calls > 5
  AND query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `auth.uid()` bare in RLS | `(SELECT auth.uid())` initplan wrapper | Postgres RLS optimization, well-documented since Postgres 14+ | 10-100x reduction in function calls per query at scale |
| Per-request `createClient()` | Module-level singleton | Serverless era best practice | Prevents connection exhaustion under concurrent load |
| Manual query timing | pg_stat_statements | Available in Postgres 9.4+ | Normalized query stats across all callers |

**Existing patterns already correct in this codebase:**
- All RLS policies in migration 00001: use `(select get_user_role())` / `(select get_user_id())` — no rewrites needed
- Helper functions `get_user_id()`, `get_user_role()`: `STABLE` + `SECURITY DEFINER` — already optimal

---

## Open Questions

1. **Does the work_sessions status index actually improve query plans?**
   - What we know: The hot student dashboard query does not filter by `status` — it fetches all sessions for a student+date. The status-filtered query (finding `in_progress` sessions) is used in the work tracker page.
   - What's unclear: Whether Postgres chooses the new 3-column index or falls back to the existing 2-column index for non-status queries.
   - Recommendation: Add the index (DB-01 acceptance criteria requires it), then run EXPLAIN ANALYZE on both query types to document which index is chosen.

2. **pg_stat_statements on hosted Supabase: schema location**
   - What we know: Supabase places extensions in the `extensions` schema. The `extra_search_path` in config.toml includes `extensions`. SQL Editor queries may need `extensions.pg_stat_statements` fully qualified.
   - What's unclear: Whether the Dashboard extension activation also grants `pg_stat_statements_reset()` to the `postgres` role used in SQL Editor.
   - Recommendation: Attempt `SELECT pg_stat_statements_reset()` in SQL Editor after enabling; if denied, grant via: `GRANT EXECUTE ON FUNCTION extensions.pg_stat_statements_reset() TO postgres;`

3. **Baseline capture timing: real production data vs. synthetic**
   - What we know: The platform is live with real students. pg_stat_statements will capture real query patterns immediately after enablement.
   - What's unclear: How long to let it run before capturing the baseline (an hour? a day?).
   - Recommendation: Enable pg_stat_statements, reset counters, wait for at least one active student session to complete (to populate real data), then capture. Document the capture timestamp and data volume in BASELINE.md.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase hosted Postgres | All DB tasks | Assumed available (live platform) | 17 (from config.toml) | — |
| Supabase SQL Editor / Dashboard | pg_stat_statements enable, EXPLAIN queries | Available (Supabase Pro) | — | `psql` with connection string |
| Node.js / npm | TypeScript build verification | Assumed (dev environment running) | — | — |
| pg_stat_statements extension | DB-04 | Must be enabled via Dashboard | Built into Supabase Pro | Dashboard manual activation |

**Missing dependencies with no fallback:** None — all dependencies are either already available or require a one-click Dashboard action.

**Missing dependencies with fallback:** None identified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test infrastructure exists in this project (confirmed: no test files in src/, no jest.config.*, no vitest.config.*) |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (type-check only) |
| Full suite command | `npm run build` (compile + lint) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | Composite indexes exist and are used | manual | EXPLAIN ANALYZE in Supabase SQL Editor | N/A — SQL verification |
| DB-02 | createAdminClient() is singleton | unit + type-check | `npx tsc --noEmit` (verifies type correctness of singleton) | ❌ Wave 0 gap |
| DB-03 | RLS policies use initplan | manual | EXPLAIN output check in SQL Editor | N/A — SQL verification |
| DB-04 | pg_stat_statements captures baseline | manual | SQL Editor query | N/A — SQL verification |

**Note:** DB-01, DB-03, and DB-04 are database infrastructure verifications that cannot be automated via a local test runner — they require live Supabase access and SQL Editor queries. DB-02 (singleton conversion) is a TypeScript code change that can be verified with a type check.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` — verifies admin.ts singleton compiles correctly
- **Per wave merge:** `npm run build` — full build including lint
- **Phase gate:** `npm run build` green + all EXPLAIN ANALYZE outputs documented in BASELINE.md

### Wave 0 Gaps

None for test infrastructure (no tests exist and none are required for SQL migration work). TypeScript verification is via `npx tsc --noEmit` which is already available.

---

## Project Constraints (from CLAUDE.md)

The planner must enforce these on every task in this phase:

| Constraint | Applies To Phase 19 |
|------------|---------------------|
| `import { z } from "zod"` (not `"zod/v4"`) | Not applicable — no Zod changes in Phase 19 |
| Admin client only in server code | Singleton is still `server-only` — `import "server-only"` stays at top of admin.ts |
| `createAdminClient()` only in API routes and server components | No new call sites introduced — singleton change is internal only |
| Proxy not middleware | Not applicable — no routing changes |
| ima-* tokens only, no hardcoded hex | Not applicable — no UI changes |
| 44px touch targets | Not applicable — no UI changes |
| Never swallow errors | admin.ts does not have error handling in singleton init — environment variables are non-null asserted; if undefined, the error propagates naturally |
| Check response.ok on fetch | Not applicable — no new fetch calls |
| Zod safeParse on API inputs | Not applicable — no new API routes |

**Key constraint for this phase:** The `import "server-only"` directive MUST remain at the top of `admin.ts` after the singleton conversion. This ensures the module cannot be accidentally imported in client components.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase read: `supabase/migrations/00001_create_tables.sql` — confirmed all existing indexes and all RLS policy patterns
- Direct codebase read: `src/lib/supabase/admin.ts` — confirmed current implementation (15 lines, function-per-call pattern)
- Direct codebase read: `src/lib/session.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/student/page.tsx` — confirmed hot query patterns
- Grep: 36 files confirmed using `createAdminClient()` — singleton change is transparent to all callers
- Project research: `.planning/research/PITFALLS.md` Pitfall 1 — singleton pattern with exact TypeScript code and auth options (HIGH confidence, previously researched from Supabase official docs)
- Project research: `.planning/research/PITFALLS.md` Pitfall 2 — server client cookie scope error (confirmed constraint)
- Project research: `.planning/research/ARCHITECTURE.md` — v1.2 target architecture diagram showing singleton

### Secondary (MEDIUM confidence)

- `.planning/research/STACK.md` — pg_stat_statements query syntax (`SELECT query, calls, mean_exec_time FROM pg_stat_statements`) verified against project research
- `supabase/config.toml` — confirmed `major_version = 17` and `extra_search_path = ["public", "extensions"]`

### Tertiary (LOW confidence — for validation)

- EXPLAIN initplan behavior in Supabase's hosted Postgres 17: based on PostgreSQL documentation patterns for `STABLE` functions in RLS. Not independently web-verified in this session; consistent with project research.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all changes are within existing installed packages and Supabase platform
- Architecture: HIGH — singleton pattern sourced from project PITFALLS.md which was researched from official docs; index gap analysis based on direct migration file read
- Pitfalls: HIGH — Pitfalls 1 and 2 are documented from official sources in project research; Pitfalls 3-5 are derived from the codebase structure

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — Postgres indexing and TypeScript singleton patterns are not fast-moving)
