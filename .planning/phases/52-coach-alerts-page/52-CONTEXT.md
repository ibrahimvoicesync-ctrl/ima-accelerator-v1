# Phase 52: Coach Alerts Page - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

A coach can review every active milestone notification in one place at `/coach/alerts`, dismiss them individually or in bulk, and see the sidebar badge cap at "9+" so a burst of closed-deal notifications never clutters the UI.

</domain>

<decisions>
## Implementation Decisions

### Locked from ROADMAP / Phase 51
- Route: `/coach/alerts` (under existing `(dashboard)` segment).
- Data source: Phase 51's `getCoachMilestonesCached(coachId)` from `src/lib/rpc/coach-milestones.ts`.
- Cache tag: revalidate `coach-milestones:${coachId}` after dismiss mutations.
- Dismissal target: existing `alert_dismissals` table (per D-08 — no new table).
- Sidebar badge cap: render "9+" when count >= 10 (capped, not raw number).
- Grouping: by student name; one Bulk Dismiss action per student group.
- Optimistic UI: row removed immediately on dismiss click.

### Claude's Discretion
- Visual layout details (card vs list rows, spacing, icon placement) — at Claude's discretion within ima-* design tokens.
- Whether to add a new API route (e.g., `POST /api/coach/alerts/dismiss`) or reuse an existing dismissal handler — Claude decides based on what's already in place (likely there's a dismiss endpoint for the legacy 100h alert).
- Whether to use Server Component for the page shell + Client Component for interactivity, or fully Client Component — Claude decides based on existing coach pages' patterns.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research / UI-SPEC. Key files to inspect:
- `src/app/(dashboard)/coach/` — sibling coach pages for layout patterns
- `src/components/Sidebar.tsx` — where the badge renders (cap to "9+" lives here)
- Existing dismiss handler for legacy 100h alert (reuse if possible)
- `src/lib/rpc/coach-milestones.ts` — the data fetcher
- `src/components/ui/` — CVA primitives for buttons/cards/skeletons
- ima-* design tokens in `tailwind.config.ts`

</code_context>

<specifics>
## Specific Ideas

- 44px touch targets on Dismiss buttons (Hard Rule 2 from CLAUDE.md).
- Loading skeletons during initial fetch; empty state when zero notifications.
- Optimistic removal — show toast on failure with restore behavior, never silently swallow errors (Hard Rule 5).

</specifics>

<deferred>
## Deferred Ideas

None — this phase is scope-bounded.

</deferred>
