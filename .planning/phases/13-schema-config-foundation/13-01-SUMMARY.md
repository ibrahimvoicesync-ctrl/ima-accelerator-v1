---
phase: 13-schema-config-foundation
plan: 01
subsystem: database
tags: [migration, schema, work_sessions, daily_reports, trigger, postgresql]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/00006_v1_1_schema.sql
    - work_sessions.session_minutes (NOT NULL integer)
    - work_sessions cycle_number unbounded (no cap constraint)
    - daily_reports.outreach_brands (NOT NULL integer)
    - daily_reports.outreach_influencers (NOT NULL integer)
    - daily_reports.brands_contacted (NOT NULL integer)
    - daily_reports.influencers_contacted (NOT NULL integer)
    - daily_reports.calls_joined (NOT NULL integer)
    - restrict_coach_report_update trigger pinning 14 columns
  affects:
    - public.work_sessions
    - public.daily_reports
    - public.restrict_coach_report_update (function)
tech_stack:
  added: []
  patterns:
    - NOT NULL migration pattern (add nullable, backfill, set NOT NULL)
    - CREATE OR REPLACE FUNCTION for trigger update without recreating binding
key_files:
  created:
    - supabase/migrations/00006_v1_1_schema.sql
  modified: []
decisions:
  - "Backfill session_minutes = 45 for all existing rows (v1.0 sessions all used 45-minute cycles per WORK_TRACKER.sessionMinutes)"
  - "Backfill 5 KPI columns to 0 (matches existing outreach_count NOT NULL DEFAULT 0 pattern, ensures SUM queries work)"
  - "Used IF EXISTS on DROP CONSTRAINT to make migration safe on databases where constraint may already be dropped"
  - "No CREATE TRIGGER needed — CREATE OR REPLACE FUNCTION updates the function body, existing trigger binding remains intact"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-27"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
requirements_satisfied:
  - WORK-09
  - KPI-07
---

# Phase 13 Plan 01: V1.1 Schema Foundation Summary

**One-liner:** PostgreSQL migration adding session_minutes to work_sessions, dropping cycle_number cap, and adding 5 granular KPI columns to daily_reports with trigger pin update.

## What Was Built

Created `supabase/migrations/00006_v1_1_schema.sql` — a single migration file with 4 ordered sections that unblock all downstream phases (14-18):

1. **session_minutes column** — Added `integer NOT NULL` to `work_sessions` using the safe NOT NULL pattern (add nullable, backfill to 45, set NOT NULL). Backfill value 45 matches all v1.0 sessions which used `WORK_TRACKER.sessionMinutes = 45`.

2. **Cycle number cap removed** — Dropped `work_sessions_cycle_number_check` constraint (which enforced `cycle_number BETWEEN 1 AND 4`) using `IF EXISTS` for safety. The `UNIQUE(student_id, date, cycle_number)` index is untouched — cycle_number remains the sequence counter, now unbounded.

3. **5 granular KPI columns** — Added `outreach_brands`, `outreach_influencers`, `brands_contacted`, `influencers_contacted`, `calls_joined` to `daily_reports` as `integer NOT NULL`, backfilled to 0. Pattern matches existing `outreach_count NOT NULL DEFAULT 0`.

4. **Trigger update** — Updated `restrict_coach_report_update()` via `CREATE OR REPLACE FUNCTION` to pin all 14 columns (9 original + 5 new). New columns inserted after `outreach_count` and before `wins` in the pin list, per plan spec. No `CREATE TRIGGER` needed — existing binding remains.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `37c4947` | feat(13-01): add V1.1 schema migration 00006_v1_1_schema.sql |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This is a pure SQL migration file with no UI stubs.

## Self-Check: PASSED

- [x] `supabase/migrations/00006_v1_1_schema.sql` exists
- [x] Contains `ADD COLUMN session_minutes integer` (nullable first)
- [x] Contains `SET session_minutes = 45` (backfill)
- [x] Contains `ALTER COLUMN session_minutes SET NOT NULL`
- [x] Contains `DROP CONSTRAINT IF EXISTS work_sessions_cycle_number_check`
- [x] Contains `ADD COLUMN outreach_brands` + 4 more ADD COLUMN lines
- [x] Contains `SET outreach_brands = 0` backfill for all 5
- [x] Contains `ALTER COLUMN outreach_brands SET NOT NULL` + 4 more SET NOT NULL
- [x] Contains `CREATE OR REPLACE FUNCTION public.restrict_coach_report_update()`
- [x] Trigger pins all 14 columns (9 original + 5 new)
- [x] No `CREATE TRIGGER` statement
- [x] UNIQUE(student_id, date, cycle_number) index untouched
- [x] Commit `37c4947` confirmed in git log
