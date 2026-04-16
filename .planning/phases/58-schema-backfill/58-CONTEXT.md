# Phase 58: Schema & Backfill - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The `public.users` table can store a per-user Rebrandly referral code and short URL, with every existing student and student_diy row pre-seeded with a deterministic code, and dev onboarding knows the new env var is required.

Migration `supabase/migrations/00031_referral_links.sql` applies cleanly on top of `00030`, adds two nullable columns (`referral_code varchar(12)`, `referral_short_url text`), backfills `referral_code` for pre-existing rows with `role IN ('student','student_diy')` using `upper(substr(md5(id::text), 1, 8))`, enforces uniqueness via a partial UNIQUE-where-NOT-NULL index, and `.env.local.example` documents `REBRANDLY_API_KEY=`. The post-phase build gate (`npm run lint && npx tsc --noEmit && npm run build`) passes.

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

No specific requirements — discuss phase skipped. Refer to ROADMAP Phase 58 description and success criteria (DB-01, DB-02, DB-03, CFG-01, CFG-02).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
