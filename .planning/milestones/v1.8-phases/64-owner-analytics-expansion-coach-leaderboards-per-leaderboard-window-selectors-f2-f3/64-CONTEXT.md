# Phase 64: Owner Analytics Expansion — Coach Leaderboards + Per-Leaderboard Window Selectors (F2 + F3) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The owner analytics page gains three new coach leaderboards (total revenue, avg total outreach per student per day, total deals) beneath the existing three student leaderboards, and every one of the six leaderboards carries an independent Weekly / Monthly / Yearly / All Time toggle — powered by a single `get_owner_analytics` RPC that pre-computes all 24 slots in one call and delivered via SSR with zero client re-fetch on toggle.

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

- **WS-02 ambiguity resolved**: window semantics are trailing N days (Weekly = last 7 days, Monthly = last 30, Yearly = last 365) — NOT calendar week/month/year. Matches the migration `00023:71` precedent.
- **`ownerAnalyticsTag()` invariant — v1.6 deferred item**: Must add `revalidateTag(ownerAnalyticsTag(), "default")` to `src/app/api/reports/route.ts` on both the update-existing-row and insert-new-row branches. Flagged in `v16-AUTONOMOUS-CHECKPOINT.md` as deferred; this phase closes it.
- **Migration 00035** — next available number (00034 applied in Phase 62). File name: `supabase/migrations/00035_expand_owner_analytics_leaderboards.sql`. Expands existing `get_owner_analytics` RPC to 24 slots.
- **RPC defensive drop**: use `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` pattern to prevent PGRST203 overload collisions. Single post-migration `pg_proc` row expected.
- **Breaking RPC → cache-key bump**: in the SAME atomic commit, bump the `unstable_cache` key for `get_owner_analytics` (e.g., `owner-analytics-v2` or next-version increment — check current key and bump).
- **New primitive needed**: `src/components/ui/SegmentedControl.tsx` (Tailwind + CVA, ima-* tokens, `min-h-[44px]`, `motion-safe:` on any transitions, `role="radiogroup"` + `role="radio"` + `aria-checked`, arrow-key navigation).
- **SSR-only, zero client re-fetch on toggle**: all 24 slots returned in one RPC call, client toggle just swaps which pre-computed slice renders — verified by `rg -n "fetch\\(" src/app/\\(dashboard\\)/owner/analytics/` returning zero hits in new client component.
- **Tiebreaker pattern (Phase 54)**: all 24 ranked CTEs use `ORDER BY metric DESC, LOWER(name) ASC, id::text ASC`.
- **Coach filter**: exclude coaches with `status != 'active'` OR zero assigned active students (via `EXISTS` subquery on `users` where `coach_id = c.id AND role IN ('student','student_diy') AND status='active'`). Coaches with ≥1 assigned student but zero metric value appear with 0.
- **Avg-total-outreach formula**: `SUM(COALESCE(brands_contacted,0) + COALESCE(influencers_contacted,0)) / (COUNT(distinct assigned students with role IN ('student','student_diy')) × window_days)` — document in SQL comment.
- **Owner homepage `OwnerAnalyticsTeaser` stays unchanged** — student-only, do not add coach section there.
- **JSON payload shape**: `leaderboards.students.{hours,profit,deals}.{weekly,monthly,yearly,alltime}` and `leaderboards.coaches.{revenue,avg_total_outreach,deals}.{weekly,monthly,yearly,alltime}`.
- **Default window on initial load**: "All Time" per requirement WS-*.
- **Build gate**: `npm run lint && npx tsc --noEmit && npm run build` must exit 0 before phase close.
- **Hard Rules (CLAUDE.md)**: `motion-safe:` on animations, `min-h-[44px]` on every interactive element, aria-labels or label+htmlFor on inputs, admin client for `.from()` in API routes, never swallow errors (console.error or toast), `response.ok` before parsing JSON, `import { z } from "zod"`, ima-* tokens only.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
