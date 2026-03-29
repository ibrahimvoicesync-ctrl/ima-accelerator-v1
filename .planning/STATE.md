---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Performance, Scale & Security
status: defining-requirements
last_updated: "2026-03-29"
last_activity: 2026-03-29
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** Defining requirements for v1.2

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-29 — Milestone v1.2 started

## Phases at a Glance

(Populated by roadmapper)

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 started:** 2026-03-29

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v1.0 decisions marked with outcomes after milestone completion.

- [Phase 13]: Backfill session_minutes=45 for existing rows (all v1.0 sessions used 45-min cycles); backfill 5 KPI columns to 0 (matches outreach_count pattern)
- [Phase 13]: target_days values are placeholders pending Abu Lahya confirmation; acceptable during development
- [Phase 13]: sessionMinutes/cyclesPerDay/breakMinutes kept in WORK_TRACKER for backward compat; Phase 14 migrates consumers
- [Phase 14]: PATCH route derives duration_minutes from stored session.session_minutes on completion, never config default
- [Phase 14]: cycle_number cap removed from POST schema — sessions are now unbounded per day (WORK-08)
- [Phase 14]: Progress bar uses totalMinutesWorked / dailyGoalMinutes, capped at 100% via Math.min; CTA gates on hours worked not cycle count
- [Phase 14]: TrackerPhase discriminated union (idle/setup/working/break) replaces boolean-derived state for explicit phase transitions
- [Phase 14]: Break countdown is React state only — never touches DB or paused_at field
- [Phase 15-outreach-kpi-banner]: outreach_count kept populated as outreach_brands + outreach_influencers for backward compat; kpi.ts daysInProgram < 1 guard prevents day-zero red state per D-04
- [Phase 15-outreach-kpi-banner]: Student sub-layout calls requireRole(student) independently — Next.js 16 deduplicates auth fetch calls within same render tree
- [Phase 15-outreach-kpi-banner]: dailyMinutesWorked from work_sessions (not hours_worked report field) for real-time accuracy in ProgressBanner
- [Phase 16-coach-owner-kpi-visibility]: ROADMAP_STEPS expanded to 15 steps across 3 stages (Setup & Preparation steps 1-7, Influencer Outreach steps 8-11, Brand Outreach steps 12-15); target_days typed as number | null to prevent TypeScript literal narrowing
- [Phase 16-coach-owner-kpi-visibility]: KpiItem exported in place from ProgressBanner.tsx (not moved); StudentKpiSummary is a pure server component receiving pre-computed scalars; stage display format is 'Stage N: StageName — StepTitle' per D-05
- [Phase 16-coach-owner-kpi-visibility]: Additive upsert pattern for lazy seeding: only insert missing steps, never delete existing rows — preserves student progress during roadmap schema expansions
- [Phase 16-03]: UPDATE-only for step names 1-10 preserves status/completed_at; backfill uses ON CONFLICT DO NOTHING for idempotency
- [Phase 17-calendar-view]: ActivityDayButton nested inside CalendarTab as closure over getActivity; no react-day-picker stylesheet import — classNames prop for full ima-* token control; router.push for month navigation to trigger server re-render
- [Phase 17-calendar-view]: sevenDaysAgo moved before Promise.all so it can be used in recentRatingsResult query; separate latestSession/latestReport queries ensure at-risk is independent of calendar month view
- [Phase 18-01]: getDeadlineStatus utility with DeadlineStatus discriminated union; joinedAt normalized before date construction; daysLate suffix only for positive values; kind: none for null target_days
- [Phase 18-roadmap-date-kpis-completion-logging]: RoadmapTab is read-only on coach/owner views; rowMap replaces statusMap to carry completed_at; progress denominator uses ROADMAP_STEPS.length (15)

### Critical Implementation Notes (from research)

- **cyclesPerDay audit is gating** — run `grep -r "cyclesPerDay" src/` before writing any Phase 14 code; 6 consumers must all be updated
- **Break timer in React state only** — never touch `paused_at` during a break; `breakSecondsRemaining` is client state only
- **Postgres SUM for lifetime outreach** — never JS `.reduce()` over fetched rows; use PostgREST aggregate query
- **getTodayUTC() for all deadline math** — `new Date().toISOString().split("T")[0]`; not `getToday()` which uses local time
- **Calendar uses `?month=YYYY-MM` search params** — server-scoped queries with `gte`/`lte` bounds; never a row limit + client filter
- **NOT NULL migration pattern** — add nullable, backfill with UPDATE, then SET NOT NULL in a single migration; never bare `ADD COLUMN ... NOT NULL` on live data
- **Daily reports trigger** — `restrict_coach_report_update` must be updated in the same migration as any `daily_reports` column additions (Pitfall 8)
- **`react-day-picker@^9.14.0`** — React 19 compat fixed in v9.4.3; only new npm dependency in v1.1
- **target_days values** — placeholders in config until Abu Lahya confirms program timeline; note in Phase 18 plan
- **PostgREST REST API** — app uses @supabase/supabase-js, NOT direct Postgres connections; PostgREST has built-in connection pooler; Supavisor NOT needed
- **createAdminClient() singleton** — currently creates new client per call (36 files import it); refactor to module-level singleton in v1.2
- **Owner layout: 8 DB calls** — coach: 2 calls, student: 0 additional; owner path is the consolidation target
- **No pagination on owner lists** — students/coaches fetched with no .range() or limit; critical gap at 5k students

### Pending Todos

- Abu Lahya must confirm `target_days` per roadmap step before Phase 18 ships (placeholder values acceptable during development)
- Abu Lahya must supply AI chat iframe URL (carried from v1.0; non-blocking for v1.2)

### Blockers/Concerns

None blocking Phase 19 start.
