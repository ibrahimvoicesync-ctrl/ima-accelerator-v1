# Phase 26: Database Schema Foundation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add two new database tables — `daily_plans` and `roadmap_undo_log` — with correct constraints, indexes, and RLS policies. This is pure database schema work that unblocks all v1.3 API work (Phases 27-29). No UI changes, no API endpoints, no application code changes.

</domain>

<decisions>
## Implementation Decisions

### Migration Organization
- **D-01:** Single migration file `00013_daily_plans_undo_log.sql` for both tables — consistent with Phase 13 and Phase 19 pattern of cohesive schema migrations.

### UTC Date Safety
- **D-02:** UTC enforcement is application-level only. The `daily_plans.date` column uses `DEFAULT CURRENT_DATE` (Supabase runs UTC by default). No DB-level CHECK constraint for UTC safety — the app already has `getTodayUTC()` in `src/lib/utils.ts` which must be used consistently when creating and querying plans.

### Append-Only Enforcement (roadmap_undo_log)
- **D-03:** RLS policies are sufficient for append-only enforcement — no INSERT-only trigger needed. The roadmap_undo_log table gets RLS policies that allow INSERT for coach/owner and SELECT for actors on their own rows, with no UPDATE or DELETE policies. Admin code (service_role) is trusted.

### plan_json JSONB Constraints
- **D-04:** No DB-level CHECK constraints on plan_json JSONB structure. Validation is purely at the application level via Zod safeParse (per v1.3 research decision: "always Zod safeParse at read, never TypeScript cast").

### Claude's Discretion
- Index strategy details beyond the required `(student_id, date)` composite index on daily_plans
- Column types for roadmap_undo_log (text vs enum for actor_role, integer vs smallint for step_number)
- RLS policy naming conventions (follow existing pattern from 00001_create_tables.sql)
- Whether to add foreign key constraints on actor_id/student_id referencing users(id) with CASCADE

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — All 6 original table definitions, RLS policies with initplan pattern, `get_user_id()` and `get_user_role()` helper functions
- `supabase/migrations/00006_v1_1_schema.sql` — V1.1 schema additions pattern reference
- `supabase/migrations/00009_database_foundation.sql` — Phase 19 index/RLS patterns
- `supabase/migrations/00011_write_path.sql` — Most recent table creation migration (student_kpi_summaries)
- `supabase/migrations/00012_rate_limit_log.sql` — Most recent migration, RLS-enabled table with no JWT policies pattern (reference for append-only approach)

### Requirements
- `.planning/REQUIREMENTS.md` §Session Planner — PLAN-07 (daily_plans table spec)
- `.planning/REQUIREMENTS.md` §Coach/Owner Undo — UNDO-05 (undo log spec)

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 26 — Exact column definitions, constraint requirements, RLS rules, and index specifications

### Research Context
- `.planning/STATE.md` §Accumulated Context — v1.3 research decisions (plan_json version field, Zod safeParse pattern, cascade re-lock constraint)

### Application Utilities
- `src/lib/utils.ts` — `getTodayUTC()` utility for UTC-safe date handling (application-level enforcement)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_user_id()` and `get_user_role()` SQL functions (00001) — initplan wrappers for RLS, already defined and used across all tables
- `getTodayUTC()` in `src/lib/utils.ts` — UTC date utility for application-level date handling
- Migration patterns from 00011/00012 — recent table creation examples to follow

### Established Patterns
- Migrations: sequential `000XX_description.sql` in `supabase/migrations/` — next is `00013`
- RLS: `(select get_user_role())` and `(select get_user_id())` initplan wrappers on all policies
- Tables: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY` pattern
- Timestamps: `timestamptz NOT NULL DEFAULT now()` for created_at columns
- Foreign keys: `REFERENCES public.users(id) ON DELETE CASCADE` pattern
- Index naming: `idx_{table}_{columns}` convention

### Integration Points
- Phase 27 (Coach/Owner Roadmap Undo) will add API routes that INSERT into roadmap_undo_log
- Phase 28 (Daily Session Planner API) will add API routes that read/write daily_plans
- Phase 29 (Daily Session Planner Client) will consume daily_plans via Phase 28 API
- No existing application code references these tables yet — clean integration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The success criteria in ROADMAP.md prescribe exact column definitions and constraints.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-database-schema-foundation*
*Context gathered: 2026-03-31*
