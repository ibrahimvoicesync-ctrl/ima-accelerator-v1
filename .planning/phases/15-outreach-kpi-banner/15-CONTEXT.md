# Phase 15: Outreach KPI Banner - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Students see their granular outreach progress against program targets at all times and can log all outreach types in the daily report. This phase delivers: (1) a redesigned daily report form with 5 granular outreach fields replacing the single `outreach_count`, (2) a sticky ProgressBanner on every student page showing lifetime/daily KPIs with RAG color coding, and (3) KPI breakdown cards on the student homepage.

</domain>

<decisions>
## Implementation Decisions

### RAG Threshold Logic
- **D-01:** Lifetime outreach uses pace-based RAG: `ratio = actual / (days_in_program × 50)`. Green when ratio >= 100%, amber when ratio >= 80%, red when ratio < 80%. This naturally connects the daily target (50/day) to the lifetime target (2,500).
- **D-02:** Daily outreach RAG: green >= 50, amber >= 40 (80%), red < 40.
- **D-03:** Daily hours RAG follows the same pattern: green >= 4h (100%), amber >= 3h 12m (80%), red < 3h 12m. Based on `WORK_TRACKER.dailyGoalHours`.
- **D-04:** Day-zero handling: if a student joined today (0 full days in program), show KPI numbers with no RAG color (neutral state). RAG kicks in after 1 full day. Use `max(1, days_in_program)` check — if days < 1, suppress color.

### RAG Scope
- **D-05:** RAG color coding applies to: lifetime outreach (X/2,500), daily outreach (X/50), and daily hours worked (X/4h). Three KPIs get RAG treatment.
- **D-06:** Calls joined, brands contacted, and influencers contacted display as raw numbers without RAG color coding (no targets defined for these).

### Claude's Discretion
- Report form layout — how to organize 5 numeric outreach fields in the daily report form (grouping, field order, labels, helper text). The existing `react-hook-form` pattern and `Input` component should be reused.
- Banner layout and stickiness — where ProgressBanner renders (layout-level vs per-page), scroll behavior (CSS sticky vs fixed), mobile responsiveness. Should fit the existing dashboard layout pattern.
- Homepage KPI cards — how KPI breakdown cards integrate with the 3 existing dashboard cards (Today's Work, Roadmap, Daily Report). May add new cards, rearrange, or augment existing ones.
- Whether to keep the legacy `outreach_count` column populated (as sum of brands + influencers) for backward compatibility or deprecate it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — KPI-01 through KPI-06 (all map to this phase)

### Prior Phase Context
- `.planning/phases/13-schema-config-foundation/13-CONTEXT.md` — Phase 13 decisions on DB migration (5 KPI columns added), config structure (`KPI_TARGETS`, validation bounds)
- `.planning/phases/14-flexible-work-sessions/14-CONTEXT.md` — Phase 14 established hours-based progress bar (blue, no RAG); RAG explicitly deferred to Phase 15

### Config
- `src/lib/config.ts` — `KPI_TARGETS` (lifetimeOutreach: 2500, dailyOutreach: 50), `DAILY_REPORT.fields` (currently `outreachCount` label needs update to granular fields), `VALIDATION` (already has bounds for `outreachBrands`, `outreachInfluencers`, `brandsContacted`, `influencersContacted`, `callsJoined`), `WORK_TRACKER.dailyGoalHours` (4)

### Existing Code to Modify
- `src/components/student/ReportForm.tsx` — Current form with single `outreach_count` field; must expand to 5 granular fields
- `src/app/api/reports/route.ts` — POST endpoint accepting `outreach_count`; must accept 5 granular fields
- `src/app/(dashboard)/student/page.tsx` — Student homepage with 3 dashboard cards; KPI cards will be added here
- `src/app/(dashboard)/layout.tsx` — Dashboard layout wrapping all pages; ProgressBanner for students would likely render here or in a student-specific sublayout

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — daily_reports table schema, `restrict_coach_report_update` trigger

### Critical Implementation Notes
- `.planning/STATE.md` §Accumulated Context — "Postgres SUM for lifetime outreach — never JS `.reduce()` over fetched rows; use PostgREST aggregate query"
- `.planning/STATE.md` §Accumulated Context — "Daily reports trigger — `restrict_coach_report_update` must be updated in the same migration as any `daily_reports` column additions"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Input` component (`src/components/ui/Input.tsx`) — already supports `label`, `type="number"`, `min`, `max`, `error` props; will be reused for all 5 outreach fields
- `Card`, `CardHeader`, `CardContent` components — used throughout dashboard; KPI cards will follow same pattern
- `formatHoursMinutes()` utility in `src/lib/utils.ts` — for hours display in banner
- `KPI_TARGETS` and `VALIDATION` bounds already in config from Phase 13
- `react-hook-form` already used in `ReportForm.tsx` — extend existing form pattern

### Established Patterns
- Server components for all reads (student dashboard page is async server component)
- `createAdminClient()` for server-side queries
- `WORK_TRACKER.dailyGoalHours * 60` for daily goal minutes calculation
- `Math.min(100, ...)` for capping progress at 100%
- `role="progressbar"` with aria attributes on progress bars
- `motion-safe:transition-*` on all animated elements
- `min-h-[44px]` on all interactive elements

### Integration Points
- Student dashboard queries sessions and reports already — KPI data can be fetched alongside existing queries
- Dashboard layout has role info (`profile.role`) — can conditionally render ProgressBanner for students
- `POST /api/reports` upserts with admin client — must add 5 new fields to insert/update
- Zod schema in `POST /api/reports` must add 5 new fields with validation bounds from `VALIDATION`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for form layout, banner design, and homepage card integration.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-outreach-kpi-banner*
*Context gathered: 2026-03-28*
