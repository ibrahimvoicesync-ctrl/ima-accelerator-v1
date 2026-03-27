# Phase 13: Schema & Config Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

DB migrations for flexible sessions and KPI columns; config additions for session duration options, KPI targets, and roadmap target days. This phase makes the database and config ready to receive all v1.1 UI features (Phases 14-18) without blocking any downstream work.

</domain>

<decisions>
## Implementation Decisions

### Cycle Constraint
- **D-01:** Drop the `CHECK(cycle_number BETWEEN 1 AND 4)` constraint on `work_sessions`. Keep `cycle_number` column and the `UNIQUE(student_id, date, cycle_number)` index. `cycle_number` becomes an unbounded sequence counter (1, 2, 3, 4, 5...) per day. Phase 14 code will assign the next available number.

### Claude's Discretion
- Migration file organization (single combined vs. separate per table) — Claude may choose the approach that best fits the existing 00001-00005 migration pattern
- Backfill strategy for existing data — `session_minutes` for past sessions (all were 45 min), new outreach columns for past daily reports (existing `outreach_count` column exists)
- Config structure — how to organize new exports (`sessionDurationOptions`, `defaultSessionMinutes`, `KPI_TARGETS`, `target_days` per roadmap step) relative to existing config sections
- Roadmap `target_days` placeholder values — STATE.md notes "placeholders until Abu Lahya confirms"; Claude picks reasonable defaults

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — Current schema for all 6 tables, RLS policies, and security triggers (especially `restrict_coach_report_update` which must be updated alongside daily_reports column additions)
- `supabase/migrations/00003_add_pause_support.sql` — Already added `paused` status to work_sessions CHECK constraint and `paused_at` column

### Config
- `src/lib/config.ts` — Single source of truth for all platform config; `WORK_TRACKER`, `ROADMAP_STEPS`, `DAILY_REPORT`, and `VALIDATION` sections all need additions
- `src/lib/utils.ts` — Contains `getToday()` (local time); `getTodayUTC()` must be added here

### Requirements
- `.planning/REQUIREMENTS.md` — WORK-09 (session_minutes column), KPI-07 (5 new daily_reports columns), ROAD-01 (target_days in config + deadline calculation)

### Critical Implementation Notes
- `.planning/STATE.md` §Accumulated Context — NOT NULL migration pattern, restrict_coach_report_update trigger update, Postgres SUM for lifetime outreach, getTodayUTC() formula

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getToday()` in `src/lib/utils.ts` — local-time date utility; `getTodayUTC()` follows same pattern but uses UTC
- `formatPausedRemaining()` in `src/lib/utils.ts` — already accepts `sessionMinutes` param (forward-compatible)
- `formatHours()` in `src/lib/utils.ts` — converts minutes to hours display string

### Established Patterns
- Config uses `as const` assertions throughout — new exports should match
- Migration files are numbered sequentially (00001-00005) — next is 00006
- `ROADMAP_STEPS` is an array of objects with `step`, `title`, `description` — `target_days` would be a new property on each object
- `WORK_TRACKER` is a flat object — `sessionDurationOptions` and `defaultSessionMinutes` fit naturally here
- `VALIDATION` section has `outreachCount` bounds — may need update for granular outreach fields

### Integration Points
- `restrict_coach_report_update` trigger (line 411-428 of 00001) — must pin all 5 new daily_reports columns so coaches can't modify student-submitted KPI data
- `UNIQUE(student_id, date, cycle_number)` index — stays intact; Phase 14 code must SELECT MAX(cycle_number) + 1 before INSERT
- `outreach_count` column in daily_reports — existing column; new granular columns supplement it; total outreach computed as `outreach_brands + outreach_influencers` at query time (per KPI-02)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for migration and config structure.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-schema-config-foundation*
*Context gathered: 2026-03-27*
