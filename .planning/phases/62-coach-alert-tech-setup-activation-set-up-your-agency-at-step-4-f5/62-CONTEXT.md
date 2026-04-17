# Phase 62: Coach Alert `tech_setup` Activation — "Set Up Your Agency" at Step 4 (F5) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Coaches receive a "Set Up Your Agency" alert on their `/coach/alerts` feed whenever one of their assigned students completes roadmap Step 4 post-deploy, with zero retroactive flood for students who already completed Step 4 before the migration ran — achieved by flipping `techSetupEnabled=true` + `techSetupStep=4`, rewriting the RPC CTE's placeholder `step_number=0` to `4`, and backfilling `alert_dismissals` for every historical completion.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from STATE.md and CLAUDE.md:
- Requirements: CA-01..07 (7 reqs).
- Migration 00034 (next available — 00033 is last applied).
- Use defensive `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` pattern to prevent PGRST203 overload collisions.
- Breaking RPC → cache-key bump in same commit (60s unstable_cache TTL rollover would crash SSR otherwise).
- Post-phase build gate: `npm run lint && npx tsc --noEmit && npm run build` must exit 0.
- CLAUDE.md Hard Rules: motion-safe, 44px touch targets, aria labels, admin client in API routes, never swallow errors, response.ok checks, `import { z } from "zod"`, ima-* tokens.
- Internal type key `tech_setup` is NOT renamed — only the human-facing label changes to "Set Up Your Agency".
- Backfill pattern mirrors Phase 52 in migration 00027 lines 409-420.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

Relevant files to inspect during planning:
- `src/lib/config.ts` — MILESTONE_CONFIG, MILESTONE_FEATURE_FLAGS
- `src/components/coach/alerts-types.ts` — MILESTONE_META, CoachAlertFeedType
- `supabase/migrations/00027_*.sql` — original `get_coach_milestones` CTE with `step_number=0` placeholder (line 130) and Phase 52 backfill pattern (lines 409-420)
- `supabase/migrations/00033_*.sql` — most recent RPC migration (Phase 61) for defensive drop pattern reference
- `src/lib/coach/getCoachMilestonesCached.ts` (or equivalent) — `unstable_cache` key to bump
- `src/app/api/alerts/dismiss/route.ts` — dismissal route (unchanged, uses `milestone_tech_setup:%` prefix)

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
</content>
</invoke>