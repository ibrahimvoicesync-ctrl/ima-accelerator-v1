# Phase 38: Database Foundation - Context

**Gathered:** 2026-04-06 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

The deals table exists in Supabase with all constraints, policies, and indexes — no application code can proceed without it. Migration file, RLS policies, trigger, indexes, and types.ts Deal type.

</domain>

<decisions>
## Implementation Decisions

### Deal Table Schema
- **D-01:** Columns: id (uuid PK), student_id (uuid FK → users), deal_number (integer), revenue (numeric(12,2)), profit (numeric(12,2)), created_at (timestamptz), updated_at (timestamptz). No notes, brand_name, or status columns — not in requirements.
- **D-02:** deal_number auto-assigned by BEFORE INSERT trigger using MAX(deal_number) + 1 with FOR UPDATE row lock to prevent race-condition duplicates on concurrent inserts (STATE.md D-01 — locked).
- **D-03:** UNIQUE constraint on (student_id, deal_number) — per success criteria.

### Column Types & Constraints
- **D-04:** revenue and profit as numeric(12,2) — per success criteria and STATE.md D-02.
- **D-05:** CHECK constraints: revenue >= 0, profit >= 0 (non-negative enforcement).
- **D-06:** ON DELETE CASCADE on student_id FK — deleting a user cascades to their deals.
- **D-07:** types.ts Deal type declares revenue and profit as `string | number` to force explicit Number() coercion at arithmetic sites (STATE.md D-02 — locked).

### RLS Policies
- **D-08:** RLS uses `(SELECT get_user_id())` and `(SELECT get_user_role())` initplan pattern — per success criteria INFR-04 and v1.2 established pattern.
- **D-09:** Student SELECT/INSERT/UPDATE/DELETE own deals (student_id = get_user_id()).
- **D-10:** Student_diy has identical policies to student — same deal access (DEAL-06).
- **D-11:** Coach SELECT/DELETE for assigned students only (join to users.coach_id = get_user_id()) — per VIEW-05.
- **D-12:** Owner SELECT/DELETE any deal — per VIEW-06.
- **D-13:** No coach INSERT/UPDATE on deals — coaches don't create or edit student deals.

### Indexes & Infrastructure
- **D-14:** Index on (student_id, created_at DESC) — per success criteria INFR-03.
- **D-15:** Migration file: 00021_deals.sql — next sequential after 00020.
- **D-16:** handle_updated_at() trigger on deals table — reuse existing function from 00001.

### Claude's Discretion
- Exact RLS policy naming convention (follow existing pattern from 00015)
- SQL comment section structure (follow existing migration pattern)
- Whether to combine student and student_diy into a single policy using IN ('student', 'student_diy') or keep separate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration patterns
- `supabase/migrations/00015_v1_4_schema.sql` — Most recent multi-table migration; RLS policy pattern, sectioned SQL comments, initplan usage
- `supabase/migrations/00001_create_tables.sql` — handle_updated_at() function definition, get_user_id()/get_user_role() helper functions

### Type definitions
- `src/lib/types.ts` — Database type definitions; Deal type must be added here with Row/Insert/Update pattern

### Requirements
- `.planning/REQUIREMENTS.md` — INFR-01 through INFR-04 (deals table specs), DEAL-02 (deal_number auto-increment)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `handle_updated_at()` trigger function (00001) — reuse for deals.updated_at
- `get_user_id()` / `get_user_role()` helper functions — used in all RLS policies
- Existing migration numbering: 00001-00020, next is 00021

### Established Patterns
- RLS initplan pattern: `(select get_user_role())` not `get_user_role()` — prevents per-row function call
- Coach assigned-student check: `JOIN public.users s ON s.id = {table}.student_id WHERE s.coach_id = (select get_user_id())` — pattern from 00015 report_comments and messages
- Sectioned SQL with `-- ============================================================================` comment blocks
- gen_random_uuid() for PK defaults, timestamptz with `DEFAULT now()` for timestamps

### Integration Points
- types.ts: Deal type added alongside existing table types (Row/Insert/Update pattern)
- Migration applied via Supabase CLI: `supabase db push` or `supabase migration up`
- Phase 39 API routes will query this table — schema must be stable before API work begins

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard database foundation following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 38-database-foundation*
*Context gathered: 2026-04-06*
