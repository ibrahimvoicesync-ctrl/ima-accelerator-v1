---
phase: 19-database-foundation
plan: "02"
subsystem: database
tags: [rls, indexes, performance, baseline, pg_stat_statements, monitoring]
dependency_graph:
  requires: [19-01]
  provides: [DB-03, DB-04]
  affects: [Phase 20 query optimization targets]
tech_stack:
  added: []
  patterns: [initplan scalar subquery wrapper, pg_stat_statements monitoring]
key_files:
  created:
    - .planning/phases/19-database-foundation/BASELINE.md
  modified: []
decisions:
  - "34 RLS policies (not 26 as originally noted in research) all confirmed using initplan wrappers from source audit — count discrepancy was due to research being done on earlier schema version"
  - "BASELINE.md scaffold approach: pre-write all SQL queries and instructions so human only needs to paste results, not construct queries"
metrics:
  duration: "5 minutes (Task 1 auto) + human time (Task 2 checkpoint)"
  completed: "2026-03-30"
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 0
requirements:
  - DB-03
  - DB-04
---

# Phase 19 Plan 02: Database Foundation — Verification and Baseline Summary

**One-liner:** BASELINE.md scaffold created with programmatic RLS source audit confirming all 34 policies use initplan wrappers; pg_stat_statements and EXPLAIN templates ready for human to fill via Supabase SQL Editor.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Audit RLS policies and create BASELINE.md scaffold | 4bcad98 | .planning/phases/19-database-foundation/BASELINE.md |
| 2 | Human applies migration, enables pg_stat_statements, fills BASELINE.md | PENDING — checkpoint | .planning/phases/19-database-foundation/BASELINE.md |

## What Was Built

### Task 1: BASELINE.md Scaffold (complete)

Created `.planning/phases/19-database-foundation/BASELINE.md` with:

1. **RLS Source Audit** — Programmatic grep on `supabase/migrations/00001_create_tables.sql` confirmed:
   - All 34 `CREATE POLICY` statements use `(select get_user_role())` and/or `(select get_user_id())` wrapper pattern
   - 49 occurrences of `(select get_user_role())` in policy definitions
   - 32 occurrences of `(select get_user_id())` in policy definitions
   - Zero bare `auth.uid()` in any policy definition (only in helper function bodies at lines 150 and 160)
   - `get_user_id()`: LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public
   - `get_user_role()`: LANGUAGE sql, STABLE, SECURITY DEFINER, SET search_path = public

2. **pg_stat_statements templates** — Before/After query capture templates with full SQL, including `pg_stat_statements_reset()` calls and the 10-column SELECT from `extensions.pg_stat_statements`. Tables with placeholder rows ready for human to fill.

3. **EXPLAIN ANALYZE templates** — 3 hot path queries pre-written:
   - `work_sessions` date+student hot path → expected `idx_work_sessions_student_date`
   - `daily_reports` date+student hot path → expected `idx_daily_reports_student_date`
   - `work_sessions` status filter → expected `idx_work_sessions_student_date_status` (new from 00009)

4. **RLS initplan EXPLAIN template** — Pre-written `SET LOCAL role = authenticated` block with expected "InitPlan" node documentation.

5. **Step-by-step migration application instructions** — Human operator guide covering pg_stat_statements enable, counter reset, app activity, before/after snapshots, and all EXPLAIN queries with UUID lookup SQL.

### Task 2: Human Verification (PENDING — checkpoint)

The following must be done by human operator in Supabase Dashboard/SQL Editor:
- Enable `pg_stat_statements` extension via Dashboard
- Reset counters and capture before-migration baseline
- Apply migration 00009 (CREATE INDEX statements)
- Reset counters and capture after-migration baseline
- Run 3 EXPLAIN ANALYZE queries with real student UUIDs
- Run RLS initplan EXPLAIN with real auth UUID
- Paste all results into BASELINE.md and commit

## Deviations from Plan

**1. [Rule 1 - Bug] Policy count corrected from 26 to 34**
- **Found during:** Task 1 source audit
- **Issue:** The plan stated "All 26 RLS policies" but the actual count is 34 (source audit: `grep -c "CREATE POLICY"` returns 34). The research was done on an earlier schema snapshot. The BASELINE.md scaffold was written with the correct count of 34.
- **Fix:** BASELINE.md documents 34 policies (not 26). No code change needed — the policies themselves were already correct.
- **Files modified:** .planning/phases/19-database-foundation/BASELINE.md

## Known Stubs

None — this plan creates only documentation artifacts (BASELINE.md). Task 2 placeholder text (`[PASTE EXPLAIN OUTPUT HERE]`, `[TO BE FILLED...]`) is intentional pending human operator steps, not stubs in the software sense.

## Self-Check: PASSED

Files exist:
- .planning/phases/19-database-foundation/BASELINE.md: FOUND

Commits exist:
- 4bcad98: FOUND (docs(19-02): create BASELINE.md scaffold with RLS source audit)
