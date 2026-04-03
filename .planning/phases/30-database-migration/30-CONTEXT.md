# Phase 30: Database Migration - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Migration 00015 adds 4 new tables (report_comments, messages, resources, glossary_terms), expands role CHECK constraints to include `student_diy` on users/invites/magic_links, enables RLS on all new tables, and updates the TypeScript types file. Pure database schema work — no UI, no API routes, no application code changes.

</domain>

<decisions>
## Implementation Decisions

### Messages Table Design
- **D-01:** Single `messages` table with `is_broadcast` boolean flag — no separate broadcast table. `recipient_id` is NULL for broadcast messages. `coach_id` serves as the room/conversation anchor.

### Read Tracking
- **D-02:** Per-message `read_at` timestamptz column on the messages table. No separate read_receipts table. Unread badge computed as `COUNT(*) WHERE recipient_id = :user_id AND read_at IS NULL`.

### Migration Organization
- **D-03:** Single migration file `00015_v1_4_schema.sql` covering all 4 new tables + role CHECK constraint ALTERs. Fewer migrations = less risk.

### RLS Policy Approach
- **D-04:** Defense-in-depth only. RLS policies are a safety net, not the primary access control. Real enforcement is in `proxy.ts` + API route role checks + admin client queries. `student_diy` restrictions are enforced at the app layer (proxy guard + nav config), not via RLS exclusion.

### Claude's Discretion
- Exact column types and sizes for all 4 tables (derive from downstream phase requirements COMMENT-01 through RES-09)
- Index strategy beyond what's required for hot query paths
- RLS policy naming conventions (follow existing patterns from 00001_create_tables.sql)
- Foreign key CASCADE/RESTRICT choices on new tables

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema (Migration Patterns)
- `supabase/migrations/00001_create_tables.sql` — Original 6 tables, `get_user_id()`/`get_user_role()` helpers, RLS initplan pattern, role CHECK constraint syntax
- `supabase/migrations/00013_daily_plans_undo_log.sql` — Most recent table creation migration (Phase 26 pattern reference)
- `supabase/migrations/00014_coach_alert_dismissals.sql` — Latest migration file (numbering: next is 00015)

### Requirements (Column Derivation)
- `.planning/REQUIREMENTS.md` §Report Comments — COMMENT-01 through COMMENT-05 (report_comments table needs)
- `.planning/REQUIREMENTS.md` §Chat System — CHAT-01 through CHAT-13 (messages table needs)
- `.planning/REQUIREMENTS.md` §Resources Tab — RES-01 through RES-09 (resources + glossary_terms table needs)
- `.planning/REQUIREMENTS.md` §Schema & Foundation — SCHEMA-01 through SCHEMA-04 (migration success criteria)

### TypeScript Types
- `src/lib/types.ts` — Current Database type with Row/Insert/Update patterns for all existing tables; Role union currently `'owner' | 'coach' | 'student'`

### Role Integration Points
- `src/lib/config.ts` — ROLES constant and Role type (currently 3 roles — Phase 31 will expand, but types.ts must include `student_diy` now per SCHEMA-04)

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 30 — Exact success criteria for migration, CHECK constraints, RLS, and types

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_user_id()` and `get_user_role()` SQL functions (00001) — initplan wrappers for RLS, already defined
- Migration sequential naming pattern: `000XX_description.sql` in `supabase/migrations/`

### Established Patterns
- Tables: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`
- Timestamps: `timestamptz NOT NULL DEFAULT now()` for created_at
- Foreign keys: `REFERENCES public.users(id) ON DELETE CASCADE`
- RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... USING ((select get_user_id()) = column)`
- Index naming: `idx_{table}_{columns}`
- Role CHECK: `CHECK (role IN ('owner', 'coach', 'student'))` — will ALTER to add `'student_diy'`
- TypeScript: Row/Insert/Update type triplet per table in `src/lib/types.ts`

### Integration Points
- 3 role CHECK constraints need ALTER: `users.role`, `invites.role`, `magic_links.role`
- Phase 31 (Student_DIY Role) depends on this migration for role constraint
- Phases 32-37 depend on these tables for their features
- `src/lib/types.ts` must be updated in sync with migration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The success criteria in ROADMAP.md and feature requirements in REQUIREMENTS.md prescribe exact column structures.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-database-migration*
*Context gathered: 2026-04-03*
