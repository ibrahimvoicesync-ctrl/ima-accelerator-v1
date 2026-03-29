# Phase 19: Database Foundation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the database structurally ready for 5,000 students: composite indexes on hot query paths, admin client singleton, RLS initplan verification, and a query performance monitoring baseline. No UI changes, no new features — pure infrastructure optimization.

</domain>

<decisions>
## Implementation Decisions

### Admin Client Singleton (DB-02)
- **D-01:** Keep the function name `createAdminClient()` — changing internals to singleton pattern but NOT renaming. Avoids touching 36 files for a rename; the name is already established across the codebase.
- **D-02:** Singleton uses `let` module-level variable with lazy initialization. Auth options: `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` since service_role is stateless.
- **D-03:** Do NOT apply singleton pattern to `createServerClient()` — it reads request-scoped cookies and must be instantiated per-request. This is a hard constraint from v1.2 research.

### Composite Indexes (DB-01)
- **D-04:** Verify existing indexes are optimal AND add missing ones. Existing indexes `idx_work_sessions_student_date(student_id, date)` and `idx_daily_reports_student_date(student_id, date)` already cover the primary hot paths — audit whether additional columns (e.g., `status` on work_sessions) improve hot query plans.
- **D-05:** Use EXPLAIN ANALYZE to verify index usage on actual hot queries before and after changes. Don't add indexes speculatively.

### RLS Initplan Verification (DB-03)
- **D-06:** Existing RLS policies already use `(select get_user_role())` and `(select get_user_id())` initplan wrappers — this is already correct. The task is to VERIFY (not rewrite) that all policies follow this pattern, and confirm with EXPLAIN that initplan evaluation occurs.
- **D-07:** Check helper functions `get_user_id()` and `get_user_role()` — both are marked `STABLE` and `SECURITY DEFINER`, which is correct for initplan optimization.

### Monitoring Baseline (DB-04)
- **D-08:** Enable `pg_stat_statements` via Supabase dashboard (extension activation). Capture baseline as a markdown document in the phase directory — version controlled, easily referenced by Phase 20.
- **D-09:** Record top 10 slowest queries before and after index migration. Format: query text, mean_exec_time, calls, rows returned.

### Migration Strategy
- **D-10:** Single migration file (`00009_database_foundation.sql`) for all Phase 19 SQL changes — indexes, any RLS fixes, pg_stat_statements setup. This is a cohesive optimization set, not separate features.

### Claude's Discretion
- All decisions above are Claude's discretion — user explicitly deferred all gray areas.
- Researcher and planner should use best judgment on implementation details within these guardrails.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — All 6 table definitions, existing indexes, RLS policies, helper functions
- `supabase/migrations/00006_v1_1_schema.sql` — V1.1 schema additions (session_minutes, KPI columns)

### Admin Client
- `src/lib/supabase/admin.ts` — Current createAdminClient() implementation (target for singleton conversion)
- `src/lib/supabase/server.ts` — createServerClient() — do NOT modify (cookies-scoped)
- `src/lib/supabase/client.ts` — Browser client — do NOT modify

### Research
- `.planning/research/PITFALLS.md` — Pitfall 1 (admin client connection exhaustion), Pitfall 2 (server client cannot be singleton)
- `.planning/research/ARCHITECTURE.md` — Current architecture patterns
- `.planning/research/STACK.md` — Stack-specific constraints

### Requirements
- `.planning/REQUIREMENTS.md` §Database & Monitoring — DB-01 through DB-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAdminClient()` at `src/lib/supabase/admin.ts` — 10 lines, straightforward singleton conversion
- Existing composite indexes in migration 00001 cover `(student_id, date)` on work_sessions and daily_reports
- RLS helper functions `get_user_id()` and `get_user_role()` already follow initplan pattern

### Established Patterns
- All migrations follow `000XX_description.sql` naming in `supabase/migrations/`
- Admin client is imported as `import { createAdminClient } from "@/lib/supabase/admin"` in all 36 files
- RLS policies consistently use `(select get_user_role())` wrapper — no bare `auth.uid()` calls found in policies

### Integration Points
- 72 `createAdminClient()` call occurrences across 36 source files — singleton change is invisible to callers
- `supabase/config.toml` — may need pg_stat_statements extension configuration
- Supabase dashboard — pg_stat_statements must be enabled as an extension

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user deferred all decisions to Claude. Open to standard approaches guided by v1.2 research findings and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-database-foundation*
*Context gathered: 2026-03-30*
