# Phase 21: Write Path & Pre-Aggregation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Pre-compute nightly KPI aggregations via pg_cron into a summary table so dashboards read pre-aggregated data instead of scanning all reports. Add optimistic UI to student daily report submission for instant feedback. Audit write paths (report submission, session complete) for unnecessary round trips. No new features — pure write-path optimization and pre-aggregation.

</domain>

<decisions>
## Implementation Decisions

### Summary Table Schema (WRITE-01)
- **D-01:** Create `student_kpi_summaries` table with comprehensive columns covering everything coaches/owners query repeatedly: `student_id` (PK, FK → users), `total_brands_contacted`, `total_influencers_contacted`, `total_hours_worked`, `total_calls_joined`, `total_reports`, `last_active_date`, `current_streak` (consecutive days with report submitted), `last_report_date` (used for incremental aggregation), `updated_at` (timestamp of last aggregation run).
- **D-02:** `current_streak` = consecutive calendar days with a daily_reports row, counting backward from the most recent report. If a student submitted Mon-Thu but not Fri, streak resets to 0 on Saturday's aggregation run.
- **D-03:** `total_reports` included so coach analytics "report rate" (reports / days in program) can read from summary instead of COUNT(*) on daily_reports.

### Aggregation Strategy (WRITE-01)
- **D-04:** Incremental aggregation — pg_cron job only recomputes students where `daily_reports.date >= student_kpi_summaries.last_report_date`. At 5k students with ~200 daily submissions, this keeps the job fast and the advisory lock duration short.
- **D-05:** Bootstrap detection — on first run (or when summary rows don't exist for a student), the function does a full compute for those students and inserts rows. After bootstrap, all subsequent runs are incremental.
- **D-06:** pg_cron job scheduled at 2 AM UTC (6 AM UAE) per v1.2 research. Function `refresh_student_kpi_summaries()` uses `pg_try_advisory_lock()` to prevent overlapping runs. Idempotent upsert via `INSERT ... ON CONFLICT (student_id) DO UPDATE`.

### Dashboard Switchover
- **D-07:** Phase 20 RPC functions (`get_owner_dashboard_stats`, `get_student_detail`, `get_sidebar_badges`) should be updated to read from `student_kpi_summaries` for aggregate KPI data instead of computing with SUM/COUNT across daily_reports. Don't build a summary table and not use it.
- **D-08:** Coach analytics page reads from summary table for report rate and outreach totals.

### Optimistic UI (WRITE-02)
- **D-09:** Keep the existing fetch-based report submission pattern (API route at `/api/reports`). Add `useOptimistic` from React 19 on top — wrap the fetch in `startTransition`, show optimistic submitted state immediately, then `router.refresh()` after success to get server ground truth. On API failure, optimistic state rolls back automatically and submit button re-enables.
- **D-10:** Standard UX: show the "Report submitted for today" banner optimistically before API responds, show success toast on confirmation, show error toast + rollback on failure.

### Write Path Audit (WRITE-03)
- **D-11:** Audit document records exact DB call count for: (1) report submission path (`POST /api/reports`), (2) work session complete path (`POST /api/sessions`). Confirms no unnecessary round trips exist. Output is a markdown document in the phase directory.

### Migration Strategy
- **D-12:** Single migration file `00011_write_path.sql` for all Phase 21 SQL: `student_kpi_summaries` table, `refresh_student_kpi_summaries()` function, pg_cron job scheduling, and any RPC updates for dashboard switchover.

### Claude's Discretion
- Exact column types and constraints on student_kpi_summaries (numeric precision, NOT NULL vs nullable)
- How refresh_student_kpi_summaries() computes streak (window function vs loop)
- Whether RPC updates go in the same migration or a separate one
- useOptimistic + startTransition wiring details in ReportForm
- Write path audit document format and level of detail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Write Path — WRITE-01, WRITE-02, WRITE-03 acceptance criteria
- `.planning/REQUIREMENTS.md` §Out of Scope — no Redis/Upstash, no revalidate=N on auth routes

### v1.2 Research
- `.planning/research/PITFALLS.md` — pg_cron UTC-only scheduling, admin client singleton constraints, advisory lock patterns
- `.planning/research/ARCHITECTURE.md` — Current architecture patterns, data fetching conventions
- `.planning/research/STACK.md` — Stack-specific constraints (Next.js 16 caching APIs, React 19 hooks)

### Phase 19 & 20 Context
- `.planning/phases/19-database-foundation/19-CONTEXT.md` — Admin client singleton (D-01/D-02), migration pattern (D-10), monitoring baseline (D-08/D-09)
- `.planning/phases/20-query-consolidation-caching/20-CONTEXT.md` — RPC consolidation (D-01 through D-04), caching strategy (D-05 through D-08), badge invalidation points (D-08)

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — Table definitions, daily_reports schema, RLS policies
- `supabase/migrations/00006_v1_1_schema.sql` — V1.1 KPI columns (brands_contacted, influencers_contacted, calls_joined)
- `supabase/migrations/00009_database_foundation.sql` — Phase 19 indexes, pg_stat_statements
- `supabase/migrations/00010_query_consolidation.sql` — Phase 20 RPC functions (get_owner_dashboard_stats, get_sidebar_badges, get_student_detail)

### Target Code
- `src/app/api/reports/route.ts` — Report submission API route (write path audit target, badge invalidation already wired)
- `src/app/api/sessions/route.ts` — Session API route (write path audit target)
- `src/components/student/ReportForm.tsx` — Client-side report form (useOptimistic integration target)
- `src/components/student/ReportFormWrapper.tsx` — Wrapper component (may need optimistic state lifting)
- `src/app/(dashboard)/student/report/page.tsx` — Server component that renders report form
- `src/lib/kpi.ts` — KPI utility functions (RAG status, streak calculation reference)

### Admin Client
- `src/lib/supabase/admin.ts` — Singleton admin client (all RPC and pg_cron function calls go through this)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createAdminClient()` singleton at `src/lib/supabase/admin.ts` — all new RPC calls use this
- `kpi.ts` utility functions — RAG status computation, `daysInProgram()` calculator; summary table enables these to read pre-aggregated data
- `StudentKpiSummary` component at `src/components/student/StudentKpiSummary.tsx` — currently computes KPIs inline, can switch to summary table reads
- Phase 20 RPC functions in `00010_query_consolidation.sql` — `get_owner_dashboard_stats`, `get_student_detail`, `get_sidebar_badges` are the update targets for D-07/D-08
- `revalidateTag("badges", "default")` already called in report submission API route — badge cache invalidation is wired

### Established Patterns
- Single migration file per phase (`00009`, `00010` → `00011`)
- RPC functions are `SECURITY DEFINER` with `SET search_path = public` (Phase 20 pattern)
- Server components do all data fetching; client components handle interactivity only
- `ReportForm` uses `react-hook-form` + `useState` for submit state + `fetch()` for API calls
- Toast notifications for success/error feedback via `useToast()` hook

### Integration Points
- `student_kpi_summaries` table feeds into Phase 20 RPCs (get_owner_dashboard_stats, get_student_detail, get_sidebar_badges)
- Coach analytics page (`src/app/(dashboard)/coach/analytics/page.tsx`) reads aggregate KPIs — switches to summary table
- `ReportForm.tsx` gets `useOptimistic` + `startTransition` integration
- `src/app/(dashboard)/student/report/page.tsx` may need to pass optimistic state handler to ReportFormWrapper
- pg_cron extension must be enabled on Supabase Pro plan (dashboard setting)

</code_context>

<specifics>
## Specific Ideas

- "Put everything in that coaches/owners query repeatedly" — make the summary table comprehensive so dashboard RPCs read from it instead of computing live. Don't compute twice.
- "Incremental. Only recompute students where daily_reports.date >= summary.last_report_date. At 5k students, full recompute is wasteful when only ~200 submitted reports that day."
- Dashboard switchover is an "obvious yes" — build it and use it in the same phase.
- Optimistic UI is "standard" — success toast, rollback on error.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-write-path-pre-aggregation*
*Context gathered: 2026-03-30*
