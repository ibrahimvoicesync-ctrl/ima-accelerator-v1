# Phase 61: Student Analytics Re-split (F1) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Relabel & re-split the `total_emails` KPI on `/student/analytics` (and `/student_diy/analytics`) into two independent aggregates — `total_brand_outreach` and `total_influencer_outreach` — via a breaking `get_student_analytics` RPC change delivered in migration `00033_fix_student_analytics_outreach_split.sql`, with the `StudentAnalyticsTotals` TypeScript type, consumers, and `unstable_cache` keys all updated in lockstep.

Scope: KPI cards only. The outreach trend chart and daily report form are explicitly out of scope.

</domain>

<decisions>
## Implementation Decisions

### Locked Defaults (from STATE.md v1.8 intent)
- **SA-07 DIY KPI visibility**: SHOW the renamed cards to `student_diy` users (default v1.8 intent). Remove the `AnalyticsClient.tsx:198` hide-for-DIY guard for these two KPIs.
- **Migration numbering**: `00033_fix_student_analytics_outreach_split.sql` is the next migration.
- **Defensive RPC drop pattern**: use `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` to avoid PGRST203 overload collisions (v1.7 lesson).
- **Cache-key bump**: bump `unstable_cache` keys for `/student/analytics/page.tsx` and `/student_diy/analytics/page.tsx` (e.g. `["student-analytics"]` → `["student-analytics-v2"]`) in the same commit as the migration to prevent 60s TTL rollover SSR crash.
- **Breaking-change posture**: no back-compat shims. Old `total_emails` / `total_influencers` payload keys are removed; `npx tsc --noEmit` must catch every stale consumer.

### Claude's Discretion
- Specific KPI card labels: "Total Brand Outreach" and "Total Influencer Outreach" (from ROADMAP success criteria).
- File-level placement of the two new cards (replace the single `total_emails` card, preserve adjacent card ordering).
- Whether to rename the `StudentAnalyticsTotals` type in place or introduce a v2 alias (prefer in-place rename — breaking is the point).

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Key entry points per STATE.md & git status:
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` (line ~198 has DIY hide-guard)
- `src/app/(dashboard)/student/analytics/page.tsx` and `/student_diy/analytics/page.tsx` (`unstable_cache` call sites)
- `supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql` (last applied migration — 00033 goes after it)
- Existing RPC: `get_student_analytics` (returns `totals` jsonb payload)

</code_context>

<specifics>
## Specific Ideas

Requirements SA-01..09 already enumerate the concrete contract. No additional per-feature preferences — refer to ROADMAP Phase 61 success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
