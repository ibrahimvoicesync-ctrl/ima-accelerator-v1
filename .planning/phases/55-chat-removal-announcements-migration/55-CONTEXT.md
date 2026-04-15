# Phase 55: Chat Removal + Announcements Migration - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Mode:** Interactive (batch table, all 5 recommendations accepted)

<domain>
## Phase Boundary

One atomic migration (00029) that permanently removes chat and introduces the `announcements` table in a single `BEGIN…COMMIT` transaction, paired with complete deletion of all chat code from the codebase in the same deploy. Phase 56 builds the announcements CRUD and pages on top of the table created here.

</domain>

<decisions>
## Implementation Decisions

### Migration 00029 Structure (locked by SC#4)
- Single `BEGIN … COMMIT` transaction, order non-negotiable:
  1. `CREATE OR REPLACE FUNCTION get_sidebar_badges` with all `unread_messages` branches removed (coach + student + owner)
  2. `CREATE TABLE announcements` with full RLS policies and index
  3. `DROP TABLE messages CASCADE`
- Reordering these steps crashes the dashboard for any session that hits the DB between steps — never permit a window where `get_sidebar_badges` still references `messages` that no longer exists.

### D-55-01: `unread_announcements` badge stub — **NO**
- Do not add `unread_announcements` field to `get_sidebar_badges` in 00029.
- Phase 56 will extend `get_sidebar_badges` when it implements announcement-read tracking.
- Rationale: Keeps 00029's scope narrowly destructive/creative (drop + create). No speculative fields.

### D-55-02: Announcements RLS in 00029 — **YES, FULL RLS**
- Include all RLS policies in 00029:
  - `SELECT`: all authenticated users (owner, coach, student, student_diy) — uses `(SELECT auth.uid())` initplan pattern
  - `INSERT`: owner + coach only (via role check in USING clause)
  - `UPDATE`: owner + coach only, additionally scoped to `author_id = (SELECT auth.uid())` so authors can only edit their own
  - `DELETE`: owner + coach only, same author-scope as UPDATE
- Rationale: Phase 56 only ships API/UI — no further migrations needed for authorization. Single source of truth.

### D-55-03: Chat code deletion sweep — **FULL SWEEP**
Beyond SC#2's enumerated list, also remove:
- `src/components/chat/` — all 6 files (ChatComposer, ConversationList, MessageThread, MessageBubble, DaySeparator, BroadcastCard)
- `src/lib/rpc/types.ts:18` — `unread_messages?: number` field on `SidebarBadgesResult`
- `src/lib/types.ts:746-760` (approximate) — the entire `messages` table type block
- `src/app/(dashboard)/layout.tsx:47-48` — badge count mapping `if (badges.unread_messages !== undefined …)` block
- `src/lib/config.ts:303, 314` — both `NAVIGATION` entries for `/coach/chat` and `/student/chat`
- `src/proxy.ts` — any route guards referencing `/coach/chat` or `/student/chat`
- Any test files (e.g., `*.test.ts`, `__tests__/`) that import from deleted paths
- Any leftover `MessageSquare` icon imports that become unused after NAVIGATION entries are removed
- Rationale: v1.5 Phase 53 postmortem established partial code deletions create orphaned imports and build failures. No half-measures.

### D-55-04: `messages` data preservation — **NO ARCHIVE**
- `DROP TABLE messages CASCADE` — no export, no backup, no JSON dump.
- Rationale: Chat was internal, no retention commitment. If Abu Lahya had wanted history, he would have flagged it during v1.6 roadmap discussion.
- If this decision is reversed later, restore from Supabase backup snapshots.

### D-55-05: `announcements.updated_at` trigger — **YES, IN 00029**
- Include a `BEFORE UPDATE` trigger on `announcements` that sets `updated_at = NOW()` on every update.
- Phase 56 uses `updated_at > created_at` to render the "(edited)" indicator.
- Rationale: Trigger belongs with the table DDL, not Phase 56's API migration. Phase 56 ships UI/API only.

### Claude's Discretion
- Exact RLS policy SQL syntax (USING clause formulation)
- Index details beyond `created_at DESC` if planner identifies further pagination-query patterns
- Whether to coalesce the `CASCADE` drop with explicit FK checks (planner decides based on 00017/00013 cross-refs)
- Specific file-by-file deletion order within a single commit (atomicity matters at DB level, not file level)
- Test stubs/spec fixtures that may need updating (sweep during planning)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `(SELECT auth.uid())` initplan pattern already used in 00021, 00023, 00024, 00025 RLS policies — copy the established form
- Migration header comment style established in all existing migrations (reference 00027 as closest)
- `updated_at` trigger pattern used in earlier migrations (check 00015, 00016 for reusable function)

### Chat Surface (all to be deleted)
- Routes: `src/app/(dashboard)/coach/chat/page.tsx`, `src/app/(dashboard)/student/chat/page.tsx`
- API: `src/app/api/messages/route.ts`, `src/app/api/messages/read/route.ts`
- Components: `src/components/chat/` (6 files)
- Utils: `src/lib/chat-utils.ts`
- Types: `src/lib/rpc/types.ts:14-20` (`SidebarBadgesResult.unread_messages`), `src/lib/types.ts:~746-760` (messages table block)
- Config: `src/lib/config.ts:303, 314` (NAVIGATION badge entries for chat)
- Layout wiring: `src/app/(dashboard)/layout.tsx:47-48` (badge mapping)
- Proxy: `src/proxy.ts` chat route guards (grep to locate)

### Established Patterns
- Single-transaction SQL migrations land in `supabase/migrations/NNNNN_name.sql`
- RPC types live in `src/lib/rpc/types.ts`, auto-generated table types in `src/lib/types.ts`
- Sidebar badge contract: `SidebarBadgesResult` feeds `(dashboard)/layout.tsx` which builds `badgeCounts` consumed by the `Sidebar` component
- Nav entries in `src/lib/config.ts` drive the sidebar render — CLAUDE.md rule: "Config is truth, never hardcode nav"

### Integration Points
- `get_sidebar_badges` is called on every dashboard page load via `layout.tsx:10` — any shape change is a breaking surface for all four role branches
- CLAUDE.md hard rule 4: admin client in API routes — deletion does not violate this (no API to create)
- CLAUDE.md hard rule 8: ima-* tokens only — n/a for this phase (no UI)

</code_context>

<specifics>
## Specific Ideas

- Migration filename: `supabase/migrations/00029_chat_removal_announcements.sql`
- `announcements` schema (from SC#3):
  ```sql
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  author_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  content       text NOT NULL CHECK (char_length(content) <= 2000)
  created_at    timestamptz NOT NULL DEFAULT NOW()
  updated_at    timestamptz NOT NULL DEFAULT NOW()
  ```
- Index: `CREATE INDEX announcements_created_at_idx ON announcements (created_at DESC);`
- Build verification: `npm run build` MUST pass clean at end of phase (SC#1)
- No `SidebarBadgesResult.unread_messages` references may remain anywhere in `src/`

</specifics>

<deferred>
## Deferred Ideas

- `unread_announcements` badge in `get_sidebar_badges` — moves to Phase 56 (requires read-tracking logic to be designed first)
- Announcements CRUD API routes — Phase 56
- Announcements UI pages (`/announcements`, sidebar entry for all roles) — Phase 56
- Pagination (25/page) and "(edited)" indicator logic — Phase 56 (data foundation via `updated_at` is ready here)
- Announcement categories/types/pinning — not in v1.6 scope (backlog candidate)
- `messages` data export for archive — rejected per D-55-04; may revisit if stakeholder requests

</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 55 section
- `.planning/STATE.md` — §Critical Constraints for v1.6 (Phase 55 atomicity)
- `.planning/phases/54-owner-analytics/54-CONTEXT.md` — prior phase decisions (migration numbering lineage)
- `.planning/phases/54-owner-analytics/54-AUTONOMOUS-CHECKPOINT.md` — v1.6 run checkpoint, Phase 55 atomicity warning
- `supabase/migrations/00017_chat_badges.sql` — existing `get_sidebar_badges` with `unread_messages` branches (to be replaced)
- `supabase/migrations/00027_get_coach_milestones_and_backfill.sql` — latest migration for style/header reference
- `src/lib/rpc/types.ts` — `SidebarBadgesResult` contract
- `src/app/(dashboard)/layout.tsx` — badge mapping consumer
- `CLAUDE.md` — hard rules (especially "Config is truth", admin-client-in-API, token rules)

</canonical_refs>
