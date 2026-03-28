# Roadmap: IMA Accelerator V1

## Milestones

- ✅ **v1.0 IMA Accelerator V1** — Phases 1-12 (shipped 2026-03-18)
- 🔄 **v1.1 V2 Feature Build** — Phases 13-18 (in progress)

## Phases

<details>
<summary>✅ v1.0 IMA Accelerator V1 (Phases 1-12) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-16
- [x] Phase 2: Authentication & Access (3/3 plans) — completed 2026-03-16
- [x] Phase 3: Student Work Tracker (3/3 plans) — completed 2026-03-16
- [x] Phase 4: Student Roadmap (2/2 plans) — completed 2026-03-16
- [x] Phase 5: Student Daily Reports & AI Chat (3/3 plans) — completed 2026-03-16
- [x] Phase 6: Coach Dashboard & Student Views (2/2 plans) — completed 2026-03-16
- [x] Phase 7: Coach Report Review, Invites & Analytics (4/4 plans) — completed 2026-03-17
- [x] Phase 8: Owner Stats & People Management (4/4 plans) — completed 2026-03-17
- [x] Phase 9: Owner Invites, Assignments & Alerts (5/5 plans) — completed 2026-03-17
- [x] Phase 10: UI Polish & Production Hardening (4/4 plans) — completed 2026-03-17
- [x] Phase 11: Fix Invite Registration URL (3/3 plans) — completed 2026-03-18
- [x] Phase 12: CLAUDE.md Hard Rule Compliance (2/2 plans) — completed 2026-03-18

</details>

**v1.1 V2 Feature Build**

- [x] **Phase 13: Schema & Config Foundation** — DB migrations for flexible sessions and KPI columns; config additions for duration options, KPI targets, and roadmap target days (completed 2026-03-27)
- [x] **Phase 14: Flexible Work Sessions** — Student-selectable durations (30/45/60 min), break countdown between cycles, unlimited daily sessions (completed 2026-03-27)
- [x] **Phase 15: Outreach KPI Banner** — Granular outreach fields on daily report form, sticky progress banner with lifetime/daily targets and RAG color coding (completed 2026-03-28)
- [x] **Phase 16: Coach/Owner KPI Visibility** — Read-only KPI summary card with RAG status on coach and owner student detail pages; gap closure for 15-step roadmap DB migration (completed 2026-03-28)
- [x] **Phase 17: Calendar View** — Month grid calendar replacing work sessions and reports tabs on student detail pages, with day detail panel (completed 2026-03-28)
- [ ] **Phase 18: Roadmap Date KPIs & Completion Logging** — Deadline status chips (on-track/due-soon/overdue) and completed_at display on all roadmap views

## Phase Details

### Phase 13: Schema & Config Foundation
**Goal**: The database and config are ready to receive all v1.1 features without blocking any UI or API work
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: WORK-09, KPI-07, ROAD-01
**Success Criteria** (what must be TRUE):
  1. `work_sessions` table has a `session_minutes` column; the `cycle_number BETWEEN 1 AND 4` CHECK constraint is relaxed; the `paused` status is accepted by the DB
  2. `daily_reports` table has five new integer columns: `outreach_brands`, `outreach_influencers`, `brands_contacted`, `influencers_contacted`, `calls_joined`; the `restrict_coach_report_update` trigger is updated in the same migration
  3. `config.ts` exports `sessionDurationOptions` (30/45/60), `defaultSessionMinutes`, and `KPI_TARGETS` (`{ lifetimeOutreach: 2500, dailyOutreach: 50 }`)
  4. Each roadmap step in `config.ts` has a `target_days` value; `getTodayUTC()` utility exists in `src/lib/utils.ts`
  5. `npx tsc --noEmit` passes with zero errors after all config changes
**Plans:** 2/2 plans complete
Plans:
- [x] 13-01-PLAN.md — V1.1 database migration (session_minutes, constraint drop, KPI columns, trigger update)
- [x] 13-02-PLAN.md — Config and utility additions (duration options, KPI targets, roadmap target_days, getTodayUTC)

### Phase 14: Flexible Work Sessions
**Goal**: Students can choose their session duration, take timed breaks between cycles, and run unlimited sessions per day
**Depends on**: Phase 13
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08
**Success Criteria** (what must be TRUE):
  1. Student can select 30, 45, or 60 minutes before starting any cycle; the circular timer ring adapts to the chosen duration
  2. After completing a cycle (not the first), a break countdown appears with the student's chosen break type and duration; the student can skip the break early
  3. The first cycle of the day starts immediately with no break prompt
  4. Completing a session writes the chosen `session_minutes` to `work_sessions`; the daily hours total reflects the actual durations stored
  5. Students can complete more than 4 cycles in a day without any error or block; the 4-hour daily goal displays as a KPI reference, not a hard cap
**Plans:** 3/3 plans complete
Plans:
- [x] 14-01-PLAN.md — Foundation: types, config breakOptions, utils formatHoursMinutes, API route updates
- [x] 14-02-PLAN.md — Core Work Tracker UI: state machine, duration picker, break countdown, session list, hours bar
- [x] 14-03-PLAN.md — Student dashboard hours-based progress migration
**UI hint**: yes

### Phase 15: Outreach KPI Banner
**Goal**: Students see their granular outreach progress against program targets at all times and can log all outreach types in the daily report
**Depends on**: Phase 13, Phase 14
**Requirements**: KPI-01, KPI-02, KPI-03, KPI-04, KPI-05, KPI-06
**Success Criteria** (what must be TRUE):
  1. The daily report form has five separate numeric fields: outreach to brands, outreach to influencers, brands contacted, influencers contacted, and calls joined; submitting stores all five values
  2. A sticky banner appears at the top of every student page showing lifetime outreach (X/2,500) and daily outreach (X/50), where lifetime total is computed as the SUM of `outreach_brands + outreach_influencers` across all reports
  3. Each KPI indicator on the banner is color-coded: green when on target, amber when at 80% or above, red below 80%; the student homepage KPI cards use the same RAG color coding
  4. The banner also displays total hours worked, calls joined, brands contacted, and influencers contacted for the current day
**Plans:** 2/2 plans complete
Plans:
- [x] 15-01-PLAN.md — Foundation (types, kpi.ts, config) + API route + ReportForm granular fields
- [x] 15-02-PLAN.md — Student sub-layout with ProgressBanner + homepage KPI cards + visual checkpoint
**UI hint**: yes

### Phase 16: Coach/Owner KPI Visibility
**Goal**: Coaches and owners can see each student's KPI progress and RAG status on the student detail page without needing to navigate elsewhere
**Depends on**: Phase 15
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04
**Success Criteria** (what must be TRUE):
  1. Coach student detail page header shows a read-only KPI summary: lifetime outreach vs 2,500 target, daily outreach vs 50 target, hours worked, and RAG status colors matching what the student sees
  2. Owner student detail page shows the same read-only KPI summary with identical RAG color coding
  3. The KPI summary card includes the student's current roadmap step number and name for context
**Plans:** 4/4 plans complete
Plans:
- [x] 16-01-PLAN.md — Config update (15-step roadmap with stages), KpiItem export, StudentKpiSummary component
- [x] 16-02-PLAN.md — Wire KPI queries into coach/owner server pages + render StudentKpiSummary in client components
- [x] 16-03-PLAN.md — Gap closure: expand DB CHECK constraint to 15 steps, backfill existing students, update seed data
- [x] 16-04-PLAN.md — Gap closure: non-destructive lazy seeding, fix hardcoded "10 steps" strings
**UI hint**: yes

### Phase 17: Calendar View
**Goal**: Coaches and owners can review a student's full activity history in a calendar month view with day-level detail
**Depends on**: Phase 16
**Requirements**: CAL-01, CAL-02, CAL-03, CAL-04
**Success Criteria** (what must be TRUE):
  1. The Work Sessions and Reports tabs on student detail pages are replaced by a single Calendar tab; the Roadmap tab remains unchanged
  2. The Calendar tab shows a month grid where each day cell displays color indicators: green dot for days with both work sessions and a report, amber dot for partial days, empty for days with no activity
  3. Clicking a day opens an inline panel showing that day's work sessions (duration, status, timestamps) and daily report (all KPI fields) side by side
  4. Students can navigate to previous and current months using prev/next controls; the current month loads by default; month changes do not show stale or truncated data for active students
**Plans:** 3/3 plans complete
Plans:
- [x] 17-01-PLAN.md — Install react-day-picker, create CalendarTab component, update StudentDetailTabs
- [x] 17-02-PLAN.md — Wire CalendarTab into coach/owner server pages and client components with month-scoped queries
- [ ] 17-03-PLAN.md — Gap closure: fix day selection off-by-one (UTC/local mismatch) and month navigation lag (client-side fetch)
**UI hint**: yes

### Phase 18: Roadmap Date KPIs & Completion Logging
**Goal**: Students, coaches, and owners can see whether each roadmap step is on schedule and when completed steps were finished
**Depends on**: Phase 13, Phase 14
**Requirements**: ROAD-02, ROAD-03, ROAD-04, ROAD-05
**Success Criteria** (what must be TRUE):
  1. Each roadmap step on the student roadmap view displays a status chip: green "On Track" when the deadline is more than 2 days away, amber "Due Soon" within 2 days, red "Overdue" past deadline
  2. Completed roadmap steps display their `completed_at` date alongside the completion indicator
  3. Coach and owner roadmap tabs on student detail pages show the same deadline status chips and completed_at dates as the student view
**Plans:** 1/2 plans executed
Plans:
- [x] 18-01-PLAN.md — Deadline status utility + student RoadmapStep Badge chips (ROAD-02, ROAD-03, ROAD-04)
- [ ] 18-02-PLAN.md — Coach/owner RoadmapTab deadline chips + progress bar /15 fix (ROAD-05)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-16 |
| 2. Authentication & Access | v1.0 | 3/3 | Complete | 2026-03-16 |
| 3. Student Work Tracker | v1.0 | 3/3 | Complete | 2026-03-16 |
| 4. Student Roadmap | v1.0 | 2/2 | Complete | 2026-03-16 |
| 5. Student Daily Reports & AI Chat | v1.0 | 3/3 | Complete | 2026-03-16 |
| 6. Coach Dashboard & Student Views | v1.0 | 2/2 | Complete | 2026-03-16 |
| 7. Coach Report Review, Invites & Analytics | v1.0 | 4/4 | Complete | 2026-03-17 |
| 8. Owner Stats & People Management | v1.0 | 4/4 | Complete | 2026-03-17 |
| 9. Owner Invites, Assignments & Alerts | v1.0 | 5/5 | Complete | 2026-03-17 |
| 10. UI Polish & Production Hardening | v1.0 | 4/4 | Complete | 2026-03-17 |
| 11. Fix Invite Registration URL | v1.0 | 3/3 | Complete | 2026-03-18 |
| 12. CLAUDE.md Hard Rule Compliance | v1.0 | 2/2 | Complete | 2026-03-18 |
| 13. Schema & Config Foundation | v1.1 | 2/2 | Complete    | 2026-03-27 |
| 14. Flexible Work Sessions | v1.1 | 3/3 | Complete    | 2026-03-27 |
| 15. Outreach KPI Banner | v1.1 | 2/2 | Complete   | 2026-03-28 |
| 16. Coach/Owner KPI Visibility | v1.1 | 4/4 | Complete    | 2026-03-28 |
| 17. Calendar View | v1.1 | 2/3 | Complete    | 2026-03-28 |
| 18. Roadmap Date KPIs & Completion Logging | v1.1 | 1/2 | In Progress|  |
