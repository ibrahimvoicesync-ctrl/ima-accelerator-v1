# Phase 16: Coach/Owner KPI Visibility - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches and owners can see each student's KPI progress and RAG status on the student detail page without needing to navigate elsewhere. Read-only visibility — no editing, no target overrides. Delivers VIS-01 through VIS-04.

</domain>

<decisions>
## Implementation Decisions

### Data freshness
- **D-01:** Real-time data — same approach as the student's ProgressBanner. Hours come from work_sessions sum (not the report's hours_worked field), outreach from daily_reports aggregation. Coach/owner sees live progress even before the student submits today's report.
- **D-02:** Query strategy mirrors student view: lifetime outreach via Postgres SUM over daily_reports, daily outreach from today's report, daily hours from today's work_sessions. Use `createAdminClient()` with student_id filter.

### RAG color coding
- **D-03:** Same RAG thresholds and colors as student view (carried from Phase 15 D-01 through D-06). Reuse `kpi.ts` functions directly — no separate logic for coach/owner.
- **D-04:** Day-zero neutral state applies here too (Phase 15 D-04).

### Roadmap step display
- **D-05:** KPI card shows current roadmap step in "Stage + step name" format: e.g., "Stage 2: Influencer Outreach — Step 9: Get First Reply". No fraction or progress bar.
- **D-06:** The actual roadmap is 15 steps across 3 stages:
  - Stage 1 (Setup & Preparation): Steps 1-7, day-based deadlines (day 0-4)
  - Stage 2 (Influencer Outreach): Steps 8-11, no deadlines
  - Stage 3 (Brand Outreach): Steps 12-15, no deadlines
  Stage names and step-to-stage mapping must be in config.ts for the display to work.

### Claude's Discretion
- KPI card placement — where the summary appears on coach/owner student detail pages (above tabs, in header area, etc.). Should be always-visible without needing to switch tabs.
- Component approach — whether to reuse `ProgressBanner` directly, create a compact variant, or build a new `StudentKpiSummary` component. The student's ProgressBanner is sticky full-width with 6 KPI items; coach/owner context may warrant a different layout.
- Query integration — how to add KPI data fetching to the existing `Promise.all` in both server pages without duplicating logic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — VIS-01 through VIS-04 (all map to this phase)

### Prior Phase Context
- `.planning/phases/15-outreach-kpi-banner/15-CONTEXT.md` — Phase 15 decisions on RAG thresholds (D-01 through D-06), ProgressBanner design, KPI data sourcing strategy
- `.planning/phases/13-schema-config-foundation/13-CONTEXT.md` — Phase 13 decisions on DB migration (5 KPI columns), config structure (`KPI_TARGETS`, `VALIDATION`)

### KPI Logic
- `src/lib/kpi.ts` — RAG calculation functions (`lifetimeOutreachRag`, `dailyOutreachRag`, `dailyHoursRag`, `daysInProgram`), `ragToColorClass`, `ragToBgClass`
- `src/components/student/ProgressBanner.tsx` — Student KPI banner component, `KpiItem` subcomponent pattern

### Coach/Owner Student Detail Pages
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Coach student detail server page with existing `Promise.all` data fetching
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Owner student detail server page with existing `Promise.all` data fetching
- `src/components/coach/StudentDetailClient.tsx` — Coach student detail client component (tabs: Work, Roadmap, Reports)
- `src/components/owner/OwnerStudentDetailClient.tsx` — Owner student detail client component (tabs + coach assignment)

### Config
- `src/lib/config.ts` — `KPI_TARGETS`, `WORK_TRACKER.dailyGoalHours`, roadmap steps config (needs stage names and step-to-stage mapping for D-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `kpi.ts` functions: `lifetimeOutreachRag`, `dailyOutreachRag`, `dailyHoursRag`, `daysInProgram`, `ragToColorClass`, `ragToBgClass` — all directly reusable for coach/owner views
- `ProgressBanner` + `KpiItem` pattern — proven layout for KPI display with RAG dots
- `formatHoursMinutes()` utility in `src/lib/utils.ts` — for hours display
- `Card`, `CardHeader`, `CardContent` components — for wrapping KPI summary

### Established Patterns
- Server components for all reads with `createAdminClient()`
- `Promise.all` parallel fetch in student detail pages — KPI queries slot in alongside existing fetches
- Both coach and owner pages already fetch `roadmap_progress` (step_number, status) — current step derivable from existing data
- Both pages already compute at-risk status from sessions/reports — pattern for server-side KPI computation exists

### Integration Points
- Coach page fetches: users, work_sessions, roadmap_progress, daily_reports — add KPI aggregation queries to existing `Promise.all`
- Owner page fetches: same + coaches list — same integration approach
- Both client components receive props from server page — add KPI data to props interface
- Daily reports query currently selects `outreach_count` — needs to include granular fields (`outreach_brands`, `outreach_influencers`, `brands_contacted`, `influencers_contacted`, `calls_joined`)

</code_context>

<specifics>
## Specific Ideas

- The actual roadmap has 15 steps across 3 stages (not the 10 originally referenced in v1.0). User provided full roadmap with stage names, step names, day-based deadlines for early steps, and unlock_urls for some steps. This data needs to be in config.ts for the stage+step display to work.
- Stage names: "Setup & Preparation", "Influencer Outreach", "Brand Outreach"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-coach-owner-kpi-visibility*
*Context gathered: 2026-03-28*
