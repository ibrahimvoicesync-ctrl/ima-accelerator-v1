# Phase 65: Owner Alerts Prune to `deal_closed` Only (F4) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The `/owner/alerts` feed stops generating `student_inactive`, `student_dropoff`, `unreviewed_reports`, and `coach_underperforming` alerts entirely — silently, with no tombstone — and replaces them with one `deal_closed` alert per closed deal (title = student name, message = "Closed a $X,XXX deal", links to `/owner/students/{student_id}`, key `deal_closed:{deal_id}`, dismissible via the existing `/api/alerts/dismiss` route); the owner sidebar badge count matches the pruned feed via a rewritten `get_sidebar_badges` OWNER branch.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

- **OAL-09 resolution**: `deal_closed` feed uses a **30-day trailing window filter** (matches Phase 64 trailing-window convention; keeps feed responsive, avoids unbounded historical list). If implementation reveals this is wrong, pick the safer option.
- **Alert key format**: `deal_closed:{deal_id}` — exactly one alert per closed deal (idempotent generation).
- **Alert field spec**:
  - `title` = student name (from `users.name` where `users.id = deals.student_id`)
  - `message` = `Closed a $X,XXX deal` (amount formatted with thousands separators, e.g. `Closed a $12,500 deal`)
  - `link` = `/owner/students/{student_id}`
  - `key` = `deal_closed:{deal_id}`
  - `type` = `deal_closed`
- **Silent prune**: The 4 old alert types (`student_inactive`, `student_dropoff`, `unreviewed_reports`, `coach_underperforming`) simply stop generating. No tombstone alert, no data migration, no user-facing notice. Existing dismissed/active rows of those types remain in the `alerts` table as harmless dead data — the feed query filters them out by `type = 'deal_closed'`.
- **Migration 00036** — next available number (00035 applied in Phase 64). File name: `supabase/migrations/00036_prune_owner_alerts_to_deal_closed.sql`. Rewrites the `get_sidebar_badges` OWNER branch so the `owner_alerts_unread` count reflects only undismissed `deal_closed` alerts within the 30-day window.
- **RPC defensive drop**: use `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` pattern to prevent PGRST203 overload collisions for `get_sidebar_badges`. Single post-migration `pg_proc` row expected.
- **Breaking RPC → cache-key bump**: in the SAME atomic commit as migration 00036, bump the `unstable_cache` key for `get_sidebar_badges` (find current key — likely `sidebar-badges-vN` — and increment to next version).
- **Existing dismissal route**: `/api/alerts/dismiss` is reused unchanged. Do NOT create a new dismiss route — verify the existing route accepts `deal_closed` keys.
- **Badge count invariant**: owner sidebar badge MUST equal the count of undismissed `deal_closed` alerts rendered in the `/owner/alerts` feed (both derive from the same 30-day trailing window + same dismissal state).
- **Feed generator location**: likely `src/app/(dashboard)/owner/alerts/page.tsx` and/or a server-side generator helper (e.g., `src/lib/owner/alerts.ts` or similar). Phase planning should locate the existing generator for the 4 old types and rewrite it in place rather than adding a parallel generator.
- **Deals source**: the `deals` table (introduced in earlier milestone). Fields referenced: `id`, `student_id`, `amount` (or equivalent money column), `closed_at` (or equivalent timestamp indicating closure). Plan must confirm actual column names via `\d deals` / migration history.
- **Alert row generation**: one row per deal with `closed_at >= NOW() - INTERVAL '30 days'`. Idempotency enforced via unique key `deal_closed:{deal_id}` (upsert-on-conflict or NOT EXISTS guard).
- **Build gate**: `npm run lint && npx tsc --noEmit && npm run build` must exit 0 before phase close.
- **Hard Rules (CLAUDE.md)**: `motion-safe:` on animations, `min-h-[44px]` on every interactive element, aria-labels or label+htmlFor on inputs, admin client for `.from()` in API routes, never swallow errors (console.error or toast), `response.ok` before parsing JSON, `import { z } from "zod"`, ima-* tokens only.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
