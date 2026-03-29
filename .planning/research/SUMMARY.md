# Project Research Summary

**Project:** IMA Accelerator V1 — Performance, Scale & Security (v1.2)
**Domain:** Coaching / Student Performance Management Platform
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

The IMA Accelerator is a Next.js 16 + Supabase platform for managing 5,000 concurrent coaching students. The v1.2 milestone is not a feature addition — it is a hardening milestone. The platform already ships and has real data. The research goal was to identify exactly what breaks when 5,000 students hit the system simultaneously (the nightly 11 PM submission spike) and how to fix it without adding unnecessary dependencies.

The recommended approach is a layered optimization strategy: fix the most dangerous problems first (connection exhaustion, insecure rate limiting, RLS policy performance), then add performance wins (RPC consolidation, caching, pagination, nightly pre-aggregation), then validate the result (load testing with k6 against a seeded staging environment), and finally lock down security (CSRF on route handlers, cross-user isolation audit). The entire v1.2 upgrade requires only one new npm dependency (`lru-cache`) — everything else is built into Next.js 16, React 19, or the Supabase Pro platform.

The dominant risk pattern across all research areas is the same: behaviors that appear correct in development because dev runs a single process, and only break under multi-instance or high-connection-count production conditions. Admin client per-call instantiation, in-memory rate limiting, `export const revalidate = 60` on Supabase JS routes, and `count: 'exact'` on large paginated queries all fall into this category. The mitigation pattern is also consistent: move shared state to the database (rate limits via `rate_limit_log` table, aggregates via `student_kpi_summaries`), deduplicate in-process connections (admin client singleton), and use Postgres for what Postgres is good at (RPC consolidation, pg_cron, advisory locks).

## Key Findings

### Recommended Stack

The v1.0/v1.1 stack (Next.js 16, React 19, Supabase, Tailwind CSS 4) is unchanged for v1.2. One new npm package is added. All other capabilities come from enabling existing platform features or using built-in framework primitives.

**Core technologies:**
- `lru-cache@^11.0.0`: In-memory sliding-window rate limit store — native TypeScript, LRU eviction prevents unbounded growth. Only appropriate for single-instance deployment; document Upstash as the upgrade path if Vercel serverless is adopted.
- `React.cache()` (built-in, React 19): Per-request deduplication of identical Supabase queries within a single render tree. Not a substitute for cross-request caching.
- `unstable_cache` (built-in, Next.js): Cross-request TTL caching for Supabase queries. Works for non-fetch async functions. Use `revalidateTag()` for mutation-driven invalidation.
- `pg_cron@1.6.4` (Supabase Pro extension): Nightly SQL jobs for KPI pre-aggregation. Max 8 concurrent jobs, 10-minute limit each. Well within budget for this scale.
- `pg_stat_statements` (Supabase Pro extension): Query performance monitoring. Use during Phase 19 baseline to identify slow queries before adding indexes.
- `k6 v1.7.0` (standalone CLI, not npm): Load testing. JavaScript test scripts, ramping VUs, P50/P95/P99 metrics. Used by Supabase internally.

**What NOT to add:** Redis/Upstash (defer until load tests prove in-memory insufficient per PROJECT.md), PgBouncer/Supavisor (PostgREST already pools), `helmet`/`express-rate-limit` (not compatible with Next.js App Router), materialized views (PostgREST cannot query them the same as regular tables).

### Expected Features

This milestone covers nine capability areas. They are not user-facing features but infrastructure capabilities.

**Must have (table stakes) — system breaks at 5k students without these:**
- Admin client module-level singleton — prevents connection exhaustion under load
- `(SELECT auth.uid())` wrapping in all RLS policies — prevents per-row volatile function full-table scans
- Postgres RPC functions for owner/coach dashboard consolidation — reduces 8 round trips to 2
- Server-side pagination with `.range()` on all owner list pages — fetching 5k rows per page load is a guaranteed timeout
- Supabase-backed rate limiting via `rate_limit_log` table — in-memory rate limiting is silently broken in serverless (each container has its own counter)
- CSRF Origin header check on all mutation route handlers — route handlers do NOT get Next.js automatic CSRF protection (only Server Actions do)

**Should have (performance and operational quality):**
- `React.cache()` on `getSessionUser()` and data-fetching functions — eliminates duplicate Supabase round trips within a single render
- `unstable_cache` with 60s TTL on owner badge counts and dashboard aggregates
- Nightly pg_cron KPI pre-aggregation into `student_kpi_summaries` table — reduces owner dashboard to PK lookups instead of full-table aggregates
- `pg_try_advisory_lock()` guard in the aggregation function — prevents overlapping cron runs from corrupting summary data
- Composite indexes with correct column ordering for hot query paths
- `useOptimistic` on report submission and session complete — perceived performance improvement for the 11 PM write spike
- Cross-user isolation audit — verify every admin-client query filters by authenticated user ID (RLS is bypassed, application code is the only gate)

**Defer (v2+):**
- Redis/Upstash distributed rate limiting — evaluate only if load tests prove in-memory insufficient
- Cursor-based pagination — not needed until student count exceeds ~50,000
- Supabase Edge Function rate-limit gateway — adds operational complexity; DB-backed approach is sufficient
- Materialized views — incompatible with PostgREST; summary table + pg_cron is the established Supabase pattern
- Real-time owner dashboard updates via Supabase Realtime — massive fanout at 5k students; 60s cached aggregates are sufficient

### Architecture Approach

The v1.2 architecture layers new patterns onto the existing structure without restructuring it. The existing layer separation (proxy.ts route guard, server components for reads, API route handlers for mutations, admin client for all server-side DB access) is correct and unchanged. Four new architectural patterns are added: admin client singleton (per-process, not per-call), React.cache() deduplication at the session and data-access layer, RPC function consolidation at the Supabase boundary, and a Supabase-backed rate limiter table replacing the broken in-memory approach.

**Major components and v1.2 changes:**
1. `src/lib/supabase/admin.ts` — MODIFIED: module-level singleton with `getAdminClient()` replaces 36 call sites of `createAdminClient()` that each created a new HTTP pool
2. `src/lib/session.ts` — MODIFIED: `getSessionUser()` wrapped with `React.cache()` to deduplicate the auth+profile lookup that currently fires twice per request (layout + page)
3. `src/lib/rate-limit.ts` — NEW: Supabase-backed sliding-window rate limiter; table `rate_limit_log` persists counts across serverless container instances
4. `src/lib/rpc/types.ts` — NEW: hand-typed TypeScript interfaces for RPC response shapes until `supabase gen types` can be regenerated
5. `supabase/migrations/00009_indexes.sql` — NEW: composite indexes for hot paths (`student_id+date` on `daily_reports`, `coach_id` on `users`)
6. `supabase/migrations/00010_rpc_functions.sql` — NEW: `get_sidebar_badges()` and `get_owner_dashboard_stats()` consolidating 8 dashboard queries into 2
7. `supabase/migrations/00011_summary_table.sql` — NEW: `student_kpi_summaries` table + `refresh_student_kpi_summaries()` function + pg_cron job at 2 AM UTC
8. `supabase/migrations/00012_rate_limit_log.sql` — NEW: `rate_limit_log` table + cleanup cron job

### Critical Pitfalls

1. **Admin client per-call instantiation exhausts DB connections at scale** — Fix: module-level singleton for `createAdminClient()` (service_role, stateless). Do NOT apply the same pattern to `createServerClient()` which reads request-scoped cookies — that throws a runtime `cookies was called outside a request scope` crash.

2. **In-memory rate limiting is silently broken in serverless** — Each Lambda container has its own memory. A user bypasses rate limits by hitting different container instances. Fix: use the `rate_limit_log` Postgres table with an atomic `INSERT + COUNT` pattern. One extra DB query per API call is acceptable at this scale.

3. **`auth.uid()` in RLS policies without `(SELECT ...)` wrapper causes full table scans** — Postgres treats `auth.uid()` as a volatile function and re-evaluates it per row, preventing index use. Fix: `USING (student_id = (SELECT auth.uid()))` — the `SELECT` wrapper creates an initplan evaluated once per statement.

4. **`export const revalidate = 60` has no effect on Supabase JS queries** — The Next.js Data Cache only intercepts `fetch()` calls. Supabase JS uses its own HTTP client that bypasses it. Fix: use `unstable_cache` to wrap Supabase functions for cross-request persistence.

5. **pg_cron runs in UTC with no overlap protection** — Scheduling for UAE time (UTC+4) requires explicit UTC offset calculation. Fix: document intended local time in SQL comments, write UTC explicitly. Wrap the aggregation function with `pg_try_advisory_lock()` to skip overlapping runs.

6. **Route handler CSRF is not automatic** — Only Server Actions get Next.js automatic CSRF protection. All `POST/PATCH/DELETE` route handlers need a manual Origin header check. Fix: `if (!origin || !origin.includes(host)) return 403` in every mutation handler.

7. **Admin client bypasses RLS — application code is the only gate** — Every query using `getAdminClient()` must explicitly filter by the authenticated user's ID. Fix: audit every API route for the pattern `auth check → verify resource ownership → query`.

## Implications for Roadmap

Based on combined research, the work falls naturally into 6 phases ordered by dependency and risk. Fix breaking problems before adding optimizations. Validate before shipping.

### Phase 19: Foundation — Indexes, Admin Singleton, and Monitoring Baseline

**Rationale:** The admin client singleton (Pitfall 1) is the highest-severity issue and must be fixed before any load testing makes sense. RLS policy performance (Pitfall 3) and composite index creation are pure database migrations with no functional dependencies. Establishing a pg_stat_statements baseline now lets subsequent phases measure actual improvement.

**Delivers:** Connection exhaustion eliminated at the infrastructure level; slow query baseline captured; RLS policies emit index scans instead of sequential scans.

**Addresses:** Admin client singleton (all 36 call sites renamed to `getAdminClient()`), `(SELECT auth.uid())` RLS policy audit, composite indexes on `daily_reports(student_id, date)` and `users(coach_id)`, pg_stat_statements query monitoring enabled, PostgREST pool size checked.

**Avoids:** Pitfall 1 (connection exhaustion), Pitfall 3 (RLS per-row volatile function scans), Pitfall 16 (wrong composite index column ordering — enumerate actual query shapes first, not table structure).

### Phase 20: Dashboard Performance — RPC Consolidation and Caching

**Rationale:** With the singleton in place, the next bottleneck is the 8+ round trips per owner dashboard load. RPC consolidation reduces PostgREST overhead. `React.cache()` and `unstable_cache` then layer caching on top. Pagination is included here because the owner student list is the worst-performing page for list operations.

**Delivers:** Owner dashboard drops from 8 PostgREST round trips to 2; badge counts served from 60s cache; student list paginated at 25 rows with URL-driven state.

**Addresses:** `get_sidebar_badges()` and `get_owner_dashboard_stats()` RPC functions; `React.cache()` on `getSessionUser()`; `unstable_cache` on owner badge counts; `.range()` pagination on all owner list pages with `count: 'estimated'`.

**Avoids:** Pitfall 7 (React.cache() vs unstable_cache confusion — they solve different scopes), Pitfall 8 (RPC over-consolidation — split by logical group, not one mega-function), Pitfall 13 (use `count: 'estimated'` not `count: 'exact'` on large paginated tables).

### Phase 21: Nightly Pre-Aggregation and Optimistic UI

**Rationale:** The pg_cron summary table is an independent database concern that can be built and tested before rate limiting. Optimistic UI for report submission is the highest-value perceived performance improvement for the 11 PM spike. Both are decoupled from security concerns.

**Delivers:** Owner dashboard KPI aggregates served from nightly summary table (PK lookup instead of full-table scan); report submission and session complete show immediate UI feedback with automatic rollback on failure.

**Addresses:** `student_kpi_summaries` table + `refresh_student_kpi_summaries()` function + 2 AM UTC pg_cron job; `useOptimistic` on report form and work tracker session complete; summary-first read path with live fallback.

**Avoids:** Pitfall 5 (pg_cron UTC timezone — document UAE offset in SQL comments), Pitfall 6 (pg_try_advisory_lock() prevents overlapping runs from corrupting summary data), Pitfall 9 (PostgREST upsert requires UNIQUE CONSTRAINT not just a unique index), Pitfall 15 (disable submit button on first click; call `router.refresh()` on failure to replace all optimistic state with server ground truth).

### Phase 22: Rate Limiting

**Rationale:** Rate limiting must come after the singleton fix (Phase 19) because the rate limiter itself uses `getAdminClient()`. It comes before security audit and load testing because both verify the rate limiter's behavior.

**Delivers:** Write paths protected at 30 req/min/user via Supabase-backed `rate_limit_log` table; 429 responses with `Retry-After` headers on all mutation routes; cleanup cron removes old rows nightly.

**Addresses:** `rate_limit_log` table + cleanup cron; `checkRateLimit()` async helper; rate limit check inserted after auth but before Zod validation in all POST/PATCH/DELETE handlers for work sessions, daily reports, and roadmap progress.

**Avoids:** Pitfall 3 (in-memory rate limiting is silently broken in serverless — must use DB-backed approach), Pitfall 10 (PostgREST pool ceiling — must be configured before high-throughput rate limit queries add load).

### Phase 23: Security Audit

**Rationale:** Security audit is a verification phase placed after all functional changes are complete. Auditing before Phase 20-22 changes are complete means re-auditing after each phase. This is a checklist phase, not a build phase.

**Delivers:** Verified cross-user isolation on all API routes; CSRF Origin checks on all mutation handlers; RLS policy correctness confirmed with `SET ROLE authenticated` SQL tests; `server-only` import guards verified across all 36+ admin client imports.

**Addresses:** Origin header CSRF check on all route handlers; cross-user isolation audit (every admin-client query filters by auth user ID); RLS verification with impersonated role SQL tests; `server-only` import enforcement audit.

**Avoids:** Pitfall 11 (admin client bypasses RLS — application code is the only gate), Pitfall 12 (CSRF route handler protection is not automatic — manual Origin check required on every mutation handler).

### Phase 24: Load Testing and Infrastructure Validation

**Rationale:** Load testing is always last. All optimizations must be in place before testing them. The test validates whether the previous five phases achieved the performance targets for the 5,000-student 11 PM spike scenario, and produces a go/no-go decision on Redis adoption.

**Delivers:** Measured P95 latency under 5k concurrent VUs; validated Postgres connection count stays below 70% of max during spike; confirmed rate limiter triggers correctly under simulated abuse; documented go/no-go decision on Redis evaluation.

**Addresses:** k6 test scripts for read paths (owner dashboard) and write paths (report submission); staging environment with 5k seeded users and 90 days of reports (~500k rows); pre-generated static auth tokens for k6 (not per-VU auth which triggers Auth rate limits); PostgREST pool configuration validation.

**Avoids:** Pitfall 14 (load testing triggers Supabase Auth rate limits — use pre-generated static JWTs; load test API layer not Auth layer), Pitfall 3 (verify rate limiter works across container instances by checking `rate_limit_log` counts during test).

### Phase Ordering Rationale

- Phase 19 before everything: connection exhaustion crashes the platform before any other optimization matters; it is also the prerequisite for all other phases.
- Phase 20 before Phase 21: RPC consolidation reduces the baseline query count; pre-aggregation then optimizes what is already reduced.
- Phase 21 before Phase 22: the pg_cron jobs and optimistic UI are functionally independent; completing them before rate limiting means the rate limiter can be audited in its final state.
- Phase 22 before Phase 23: the security audit verifies the completed rate limiter, not an in-progress one.
- Phase 24 last: partial optimization produces misleading load test results; only run tests when all optimizations are in place.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 19 (RLS policy audit):** The existing RLS policies need to be enumerated and evaluated individually for `auth.uid()` without `(SELECT ...)` wrapping. This is a codebase-specific audit, not a general pattern — read current migrations before writing the fix migration.
- **Phase 22 (rate limit DB overhead):** The `rate_limit_log` approach adds one synchronous DB write per API call. The actual latency impact is unknown until measured. If overhead exceeds ~10ms per call, Redis becomes necessary earlier than planned. Measure during Phase 19 baseline before committing.
- **Phase 24 (k6 staging seed data):** Generating 5k students and 90 days of reports (~500k rows) requires a seeding script. Plan seeding work as part of Phase 24 setup.

Phases with standard patterns (skip research-phase):

- **Phase 20 (RPC + caching):** Exact SQL and TypeScript implementation documented in ARCHITECTURE.md and STACK.md. No ambiguity.
- **Phase 21 (pg_cron aggregation):** Complete implementation pattern documented including advisory lock, upsert constraint requirements, and UTC scheduling.
- **Phase 23 (Security audit):** Checklist-based phase with explicit patterns from PITFALLS.md. Follows CLAUDE.md hard rules already established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry, official changelogs, and official docs. One new dependency (`lru-cache@^11.0.0`). All other tools are platform built-ins. |
| Features | HIGH | Nine capability areas fully researched with table stakes, differentiators, and anti-features documented. Patterns verified against Next.js 16 and Supabase official docs. |
| Architecture | HIGH | Based on direct codebase analysis (36 `createAdminClient()` call sites identified, existing migration numbering known) plus Next.js 16.2.1 official documentation. |
| Pitfalls | HIGH | 16 pitfalls documented with primary sources (Supabase official docs, Next.js security blog, PostgREST docs, pg_cron Supabase discussions). All pitfalls are grounded in specific production failure modes, not theoretical concerns. |

**Overall confidence:** HIGH

### Gaps to Address

- **Rate limiter DB overhead:** The `rate_limit_log` approach adds one synchronous DB write to every API call. The actual latency impact is unknown until measured against a baseline. If overhead exceeds ~10ms per call, Redis becomes necessary earlier than planned. Measure during Phase 19 baseline before fully committing to the DB-backed approach.
- **Existing RLS policy state:** Research identified the `auth.uid()` wrapping pitfall but did not enumerate the specific existing policies that violate it. A focused audit of current migration files is needed at the start of Phase 19.
- **PostgREST pool configuration:** The current PostgREST pool size on the Supabase Pro plan is unknown. Research identifies it should be ~40% of max_connections, but the actual configured value needs verification in the Supabase dashboard before Phase 24 load testing.
- **`cacheComponents: true` status:** ARCHITECTURE.md confirms the app does NOT enable `cacheComponents: true`, meaning the `"use cache"` directive is unavailable. Confirm this in `next.config.ts` at the start of Phase 20 before choosing caching primitives.

## Sources

### Primary (HIGH confidence)
- Next.js 16 official documentation — caching architecture (React.cache vs unstable_cache vs use cache), revalidation patterns, route handler CSRF
- Supabase official documentation — pg_cron extension, PostgREST RPC, connection pooling, RLS policy performance (auth_rls_initplan lint)
- React 19 release notes — useOptimistic API, cache() deduplication behavior
- PostgREST documentation — upsert conflict resolution (constraint vs index distinction)
- pg_cron Supabase community discussions — UTC scheduling confirmed, overlap protection with advisory locks

### Secondary (MEDIUM confidence)
- Supabase community and GitHub discussions — pg_cron UTC timezone behavior confirmed across multiple independent reports
- k6 documentation — load test script structure; Supabase benchmark usage confirmed

### Tertiary (LOW confidence)
- In-memory rate limiting serverless behavior — inferred from serverless architecture fundamentals; the actual number of concurrent Lambda instances on this specific deployment is not measured, only the failure mode is established

---
*Research completed: 2026-03-29*
*Ready for roadmap: yes*
