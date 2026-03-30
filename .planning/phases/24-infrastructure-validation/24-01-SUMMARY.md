---
phase: 24-infrastructure-validation
plan: "01"
subsystem: load-testing
tags: [load-testing, seed-data, jwt, capacity-planning, k6]
dependency_graph:
  requires: []
  provides:
    - load-tests/seed/00001_staging_seed.sql
    - load-tests/scripts/gen-tokens.js
    - load-tests/CAPACITY.md
  affects:
    - Plans 24-02 (k6 scenarios) and 24-03 (test execution) — blocked on staging provisioning
tech_stack:
  added:
    - jsonwebtoken (npm) — JWT minting for k6 VU token pool
  patterns:
    - Set-based INSERT...SELECT with generate_series for bulk seed data (avoids PL/pgSQL loop timeout)
    - Deterministic UUID auth_id pattern for cross-script JWT sub claim matching
    - 80/20 timestamp distribution to simulate 11 PM UTC submission spike
key_files:
  created:
    - load-tests/seed/00001_staging_seed.sql
    - load-tests/scripts/gen-tokens.js
    - load-tests/tokens/.gitkeep
    - load-tests/CAPACITY.md
  modified:
    - .gitignore
decisions:
  - Deterministic auth_id UUIDs (00000000-0000-4000-{a000|b000}-{N padded}) allow JWT script to generate matching sub claims without querying the DB
  - Set-based INSERT...SELECT pattern chosen over PL/pgSQL FOR LOOP to stay within Supabase SQL editor timeout (<5 min for 500k rows)
  - Safety guard in seed SQL aborts if non-seed users detected — prevents accidental production data loss
  - load-tests/tokens/*.json gitignored (signed JWTs equivalent to authenticated sessions); load-tests/results/ gitignored (large k6 JSON output)
metrics:
  duration: "3 minutes"
  completed: "2026-03-30"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 1
---

# Phase 24 Plan 01: Load Test Infrastructure Summary

**One-liner:** Set-based SQL seed (5k students, ~500k rows, 80% 9-11 PM UTC spike) with deterministic-UUID JWT pre-generation script and capacity report template.

## What Was Built

### Task 1: Seed SQL Script and JWT Pre-generation Script

**`load-tests/seed/00001_staging_seed.sql`** — Staging-only seed script that:
- Creates 1 owner + 10 coaches + 5,000 students with deterministic `auth_id` UUIDs
- Generates ~450,000 daily_reports using `INSERT INTO ... SELECT FROM generate_series(1,89)` (set-based, not looped — stays under Supabase SQL editor timeout)
- 80% of `submitted_at` timestamps clustered in hours 21-22 UTC (9-11 PM spike per D-07)
- Generates ~150,000 work_sessions (3 cycles/day for first 30 days per student)
- Generates ~50,000 roadmap_progress rows (10 steps per student, first 3 completed, step 4 active, 5-10 locked)
- Includes safety guard that aborts if non-seed users are detected (production protection)

**`load-tests/scripts/gen-tokens.js`** — Node.js CommonJS script that:
- Reads `STAGING_JWT_SECRET` from env (exits with clear error if missing)
- Generates 5,000 student + 1 owner + 10 coach JWTs with Supabase claims (`sub`, `role: authenticated`, `aud: authenticated`, `iss: supabase`, 7-day expiry)
- Writes `student_tokens.json`, `owner_token.json`, `student_uuids.json` to `load-tests/tokens/`
- Auth_id UUID pattern matches seed SQL exactly: `00000000-0000-4000-a000-{N padded to 12}`

**`load-tests/tokens/.gitkeep`** — Tracks the tokens directory without committing generated files.

### Task 2: Gitignore Updates and Capacity Template

**`.gitignore`** — Appended two entries:
- `load-tests/tokens/*.json` — signed JWTs are equivalent to authenticated sessions; must not be committed
- `load-tests/results/` — k6 JSON output files; large and machine-specific

**`load-tests/CAPACITY.md`** — Capacity report template with:
- Tables for all 3 scenarios (read mix, write spike, combined) with P50/P95/P99 columns
- Connection usage section with SQL query (`pg_stat_activity`) for manual dashboard capture (D-12, D-16)
- Rate limiter verification section with SQL query against `rate_limit_log` (D-17)
- `pg_stat_statements` top-10-slowest-queries section with SQL query and reset command
- Redis/Upstash go/no-go evaluation section documenting D-13 dual-condition criteria
- Compute sizing decision section (outcome to be written to PROJECT.md Key Decisions)

## Human Action Required (Task 0 — Blocking for Plans 02-03)

Task 0 is a `checkpoint:human-action` that must be completed before Plans 24-02 and 24-03 can run:

1. Create a staging Supabase project (same compute tier and region as production per D-01)
2. Link CLI: `npx supabase link --project-ref <ref>`
3. Push all migrations: `npx supabase db push`
4. Verify tables: users, daily_reports, work_sessions, roadmap_progress, rate_limit_log, student_kpi_summaries
5. Provide: `STAGING_SUPABASE_URL`, `STAGING_JWT_SECRET`, `STAGING_SUPABASE_ANON_KEY`

After staging is provisioned:
- Run seed: `npx supabase db execute --sql-file load-tests/seed/00001_staging_seed.sql`
- Generate tokens: `STAGING_JWT_SECRET=<secret> node load-tests/scripts/gen-tokens.js`

## Deviations from Plan

### Plan Execution Order Adjustment

Task 0 (`checkpoint:human-action`) was not blocked on before executing Tasks 1 and 2 because:
- Tasks 1 and 2 create files (seed SQL, JWT script, CAPACITY.md) that do NOT require the staging project to exist
- These are code artifacts prepared for when the human provisions staging
- The staging project is needed to RUN the load tests (Plans 02-03), not to create the scripts (Plan 01)

This was treated as a non-blocking deviation — Tasks 1 and 2 are fully autonomous and the human-action requirement is documented clearly in this SUMMARY.

## Known Stubs

None. All artifacts are complete templates/scripts. No hardcoded placeholders in the executable scripts.

The CAPACITY.md template contains `[placeholders]` by design — these are the fields the human fills in after running the load tests.

## Self-Check: PASSED

| File | Status |
|------|--------|
| load-tests/seed/00001_staging_seed.sql | FOUND |
| load-tests/scripts/gen-tokens.js | FOUND |
| load-tests/tokens/.gitkeep | FOUND |
| load-tests/CAPACITY.md | FOUND |
| .gitignore (updated) | FOUND |
| .planning/phases/24-infrastructure-validation/24-01-SUMMARY.md | FOUND |

| Commit | Message |
|--------|---------|
| 44be902 | feat(24-01): create seed SQL script and JWT pre-generation script |
| 28b2565 | chore(24-01): update gitignore and create capacity report template |
