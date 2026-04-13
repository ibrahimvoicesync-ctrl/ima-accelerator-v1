# Phase 51: Milestone Notifications RPC + Backfill - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Coaches receive a visible notification exactly once for each qualifying event across assigned students — Tech/Email Setup Finished, 5 Influencers Closed (Step 11), First Brand Response (Step 13), and every Closed Deal — without a flood of retroactive alerts on rollout, and with the sidebar badge as the single source of truth.

</domain>

<decisions>
## Implementation Decisions

### Locked from ROADMAP / Phase 50
- D-06: Tech/Email Setup trigger pending — gated by `MILESTONE_FEATURE_FLAGS.techSetupEnabled` (currently false). Code path is wired but does not fire until D-06 resolves.
- D-07: Closed-deal alert key includes `deal_id` (per-deal granularity) — every deal fires fresh notification.
- D-08: Reuse the existing `alert_dismissals` table pattern (260401-cwd / 100h_milestone), do NOT introduce a new notifications table.
- D-16: Coach-logged AND owner-logged deals must trigger the closed-deal milestone (not just student-logged).
- New RPC name: `get_coach_milestones(p_coach_id, p_today)`.
- Cache: `unstable_cache` with 60s TTL, tag = `coach-milestones-${coachId}`.
- Existing `get_sidebar_badges` coach branch must include the new milestone count alongside the 100h legacy count.
- Migration 00025 = combined (RPC + backfill + indexes if needed).

### Claude's Discretion
- Implementation details (helper function structure, query shape, predicate composition) — at Claude's discretion.
- Whether to write a single migration (00025) or split (e.g., 00025 RPC, 00026 backfill) — Claude decides based on atomicity vs. clarity.
- Specific revalidateTag call sites in API routes (POST /api/deals, POST /api/reports, roadmap-step completion routes) — locate via codebase scan.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Key files to inspect:
- `supabase/migrations/00014_*` — alert_dismissals table + 260401-cwd 100h pattern (reference for SYNC comments and pattern)
- `supabase/migrations/00021_*` — recent RPC style
- Existing `get_sidebar_badges` RPC — extend coach branch
- `src/lib/config.ts` Section 16 — MILESTONE_CONFIG, MILESTONES, MILESTONE_FEATURE_FLAGS, MILESTONE_KEY_PATTERNS (Phase 50)
- API routes: `src/app/api/deals/route.ts`, `src/app/api/reports/route.ts`, roadmap-step-completion route(s)
- Phase 44 analytics RPC pattern + indexes

</code_context>

<specifics>
## Specific Ideas

- Backfill must INSERT into `alert_dismissals` for every already-completed Step 11, Step 13, and already-closed deal (per-deal_id).
- A unit test must confirm `get_coach_milestones` returns zero new notifications immediately after the migration runs (idempotency check).
- Performance target: P95 <1s at 5k students / 50 per coach × 4 milestone types = ~200 predicate evaluations per dashboard view.

</specifics>

<deferred>
## Deferred Ideas

- NOTIF-01 (Tech/Email Setup activation) — code path wired but feature flag stays false until D-06 resolves at Monday stakeholder meeting.

</deferred>
