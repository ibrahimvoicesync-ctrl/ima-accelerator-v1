# Phase 20: Query Consolidation & Caching - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Drop the owner dashboard from 8+ round trips to ≤2 via Postgres RPC consolidation, wrap badge counts with 60-second unstable_cache, add React cache() dedup on server component data fetches, and implement server-side pagination on owner student and coach list pages. No new features, no UI redesign — pure query optimization and caching.

</domain>

<decisions>
## Implementation Decisions

### RPC Consolidation Scope
- **D-01:** Create `get_owner_dashboard_stats()` Postgres RPC that returns all 4 owner dashboard counts (active students, active coaches, sessions today, reports today) in a single call. The owner dashboard page (`src/app/(dashboard)/owner/page.tsx`) currently fires 4 parallel queries — consolidate into 1 RPC.
- **D-02:** Create `get_sidebar_badges(p_role text, p_user_id uuid)` Postgres RPC that computes badge counts server-side. Owner sidebar currently fires 7 queries for alert logic — consolidate into 1 RPC. Coach sidebar fires 2 queries — include in same RPC with role-based branching.
- **D-03:** Create `get_student_detail(p_student_id uuid, p_month_start date, p_month_end date)` Postgres RPC that returns all student detail data as a composite JSON response. Coach student detail fires 9 queries, owner student detail fires 11 — consolidate into 1 RPC each (or 1 shared RPC with optional owner-only fields).
- **D-04:** RPC functions live in a new migration file `00010_query_consolidation.sql`. Each function is `SECURITY DEFINER` with `SET search_path = public` to work with the admin client pattern (service_role bypasses RLS).

### Caching Strategy
- **D-05:** Sidebar badge counts use `unstable_cache()` with 60-second TTL and `revalidateTag('badges')` — per REQUIREMENTS.md QUERY-04. Cache key includes user ID and role so different users don't share badge state.
- **D-06:** React `cache()` (from 'react') wraps the `getSessionUser()` call and each RPC-calling server function so duplicate calls within a single RSC render tree are deduped — per REQUIREMENTS.md QUERY-03. This is render-tree scoped (per-request), NOT cross-request.
- **D-07:** Owner dashboard stats do NOT get unstable_cache — they're fast enough as a single RPC. React `cache()` dedup is sufficient.
- **D-08:** Invalidate badge cache (`revalidateTag('badges')`) in mutation API routes that affect badge counts: report submission, report review, session start/complete, student invite acceptance.

### Pagination Design
- **D-09:** Owner student list page: 25 students per page, server-side `.range()` with URL search params `?page=1`. Total count uses `count: 'estimated'` (not 'exact') per v1.2 research — exact count causes full table scan.
- **D-10:** Owner coach list page: same pagination pattern as student list — 25 per page, `.range()`, `count: 'estimated'`, URL search params.
- **D-11:** Search/filter stays server-side — the current client-side `OwnerStudentSearchClient` component will be replaced with a server-side search using `.ilike()` combined with pagination. Search resets to page 1.
- **D-12:** Pagination UI: simple "Previous / Next" with current page indicator and total page estimate. No page number buttons — keeps it simple and works with estimated counts.

### Migration & Rollout
- **D-13:** Single migration file `00010_query_consolidation.sql` for all RPC functions. This is a cohesive optimization set — same pattern as Phase 19's single migration.
- **D-14:** Big-bang swap per page — when a page gets its RPC function, all individual queries on that page switch to the RPC call in the same plan. No incremental/mixed state.
- **D-15:** Verify RPC output matches current query output before swapping — write the RPC, test it returns the same data shape, then update the page component.

### Claude's Discretion
- All decisions above are Claude's discretion — user explicitly skipped all discussion areas.
- RPC function return types (JSON vs composite row types) — use whatever is cleanest for TypeScript consumption.
- Exact `unstable_cache` key structure and tag naming conventions.
- Whether `get_student_detail` is one function with role branching or two separate functions (`get_student_detail_coach` / `get_student_detail_owner`).
- React cache() wrapper placement — whether to wrap individual functions or create a cached data layer module.
- Pagination component implementation details.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Query Optimization — QUERY-01 through QUERY-06 acceptance criteria
- `.planning/REQUIREMENTS.md` §Out of Scope — confirms no Redis/Upstash, no revalidate=N on auth routes

### v1.2 Research
- `.planning/research/PITFALLS.md` — Pitfall re: revalidate=N broken on auth routes (cookies()), count: 'exact' full scan
- `.planning/research/ARCHITECTURE.md` — Current architecture patterns, data fetching conventions
- `.planning/research/STACK.md` — Stack-specific constraints (Next.js 16 caching APIs)

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — Table definitions, existing indexes, RLS policies, helper functions
- `supabase/migrations/00006_v1_1_schema.sql` — V1.1 schema additions (KPI columns queried by dashboard)
- `supabase/migrations/00009_database_foundation.sql` — Phase 19 indexes and pg_stat_statements setup

### Phase 19 Context
- `.planning/phases/19-database-foundation/19-CONTEXT.md` — Admin client singleton pattern, index decisions, monitoring baseline

### Target Pages (current query patterns to consolidate)
- `src/app/(dashboard)/owner/page.tsx` — Owner dashboard (4 queries → 1 RPC)
- `src/app/(dashboard)/layout.tsx` — Sidebar badge computation (7 owner queries → 1 cached RPC)
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Coach student detail (9 queries → 1 RPC)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Owner student detail (11 queries → 1 RPC)
- `src/app/(dashboard)/owner/students/page.tsx` — Owner student list (no pagination → server-side paginated)
- `src/app/(dashboard)/owner/coaches/page.tsx` — Owner coach list (no pagination → server-side paginated)

### Admin Client
- `src/lib/supabase/admin.ts` — Singleton admin client (all RPC calls go through this)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAdminClient()` singleton at `src/lib/supabase/admin.ts` — all RPC `.rpc()` calls will use this
- `Promise.all()` pattern in all dashboard pages — already parallel, consolidation replaces multiple promises with single RPC call
- `OwnerStudentSearchClient` component — will be replaced with server-side search but layout/styling can be reused
- RLS helper functions `get_user_id()` and `get_user_role()` — available for use inside RPC functions if needed
- `NAVIGATION` config in `src/lib/config.ts` — badge keys (`active_alerts`, `unreviewed_reports`) define what sidebar expects

### Established Patterns
- Server components do all data fetching (async pages, no useEffect) — cache() wraps cleanly
- Admin client bypasses RLS — RPC functions should be `SECURITY DEFINER` to match
- Migrations follow `000XX_description.sql` naming in `supabase/migrations/`
- All API mutations are in `src/app/api/` route handlers — cache invalidation hooks go here

### Integration Points
- `src/app/(dashboard)/layout.tsx` — badge computation moves to cached RPC call
- `src/app/api/reports/route.ts` — needs `revalidateTag('badges')` after report submission
- `src/app/api/reports/[reportId]/review/route.ts` — needs badge cache invalidation
- `src/app/api/sessions/route.ts` — needs badge cache invalidation on session mutations
- Supabase migration system — new `00010_query_consolidation.sql` file

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user deferred all decisions to Claude. Open to standard approaches guided by v1.2 research findings, REQUIREMENTS.md acceptance criteria, and codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-query-consolidation-caching*
*Context gathered: 2026-03-30*
