---
phase: 24-infrastructure-validation
plan: "02"
subsystem: load-testing
tags: [k6, load-testing, performance, capacity-planning, jwt, supabase, rate-limiting]

requires:
  - phase: 24-01
    provides: load-tests/tokens/ directory, gen-tokens.js script producing student_tokens.json and owner_token.json

provides:
  - load-tests/scenarios/write-spike.js
  - load-tests/scenarios/read-mix.js
  - load-tests/scenarios/combined.js

affects:
  - Plan 24-03 (test execution) — runs these scenario files against staging

tech-stack:
  added: []
  patterns:
    - k6 SharedArray for VU token distribution — one JWT per VU for independent rate limit buckets
    - k6 multi-scenario with named exec functions — concurrent write + read traffic
    - ramping-vus executor with sustain stages for realistic spike simulation
    - P95 + error rate thresholds as pass/fail gates (D-11)
    - sleep(3) on write path to stay under 30 req/min per endpoint (rate limit protection)
    - Direct PostgREST RPC calls via SUPABASE_URL for read-path load testing

key-files:
  created:
    - load-tests/scenarios/write-spike.js
    - load-tests/scenarios/read-mix.js
    - load-tests/scenarios/combined.js
  modified: []

key-decisions:
  - "read-mix.js uses direct PostgREST URL (SUPABASE_URL) not APP_URL for RPC calls — owner RPCs bypass Next.js routing to test DB layer directly"
  - "Origin header omitted on read-mix reads — GET and Supabase RPC calls do not trigger CSRF verifyOrigin() check; only mutation routes in Next.js API require it"
  - "combined.js uses lower VU counts (300 write + 50 read vs 500 + 100 standalone) since both scenarios run simultaneously — total additive load is equivalent"
  - "owner_token.json loaded as SharedArray array (index 0) to match gen-tokens.js output format consistently"

patterns-established:
  - "Pattern 1: SharedArray init — all k6 token loading uses SharedArray('name', fn) to avoid per-VU file reads"
  - "Pattern 2: Multi-scenario named exports — combined.js pattern with exec field + matching export function name for k6 multi-scenario support"

requirements-completed: [INFRA-01]

duration: 2min
completed: "2026-03-30"
---

# Phase 24 Plan 02: k6 Load Test Scenarios Summary

**Three k6 scenarios covering owner dashboard read mix (100 VUs), 11 PM student write spike (500 VUs), and combined concurrent traffic (300+50 VUs) with SharedArray token distribution, CSRF-correct headers, and P95 < 1s thresholds.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T17:38:33Z
- **Completed:** 2026-03-30T17:40:30Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Write-spike scenario: 500 VU ramping-vus targeting POST /api/reports and POST /api/work-sessions with Zod-valid bodies, Origin header for CSRF, sleep(3) for rate limit protection
- Read-mix scenario: 100 VU owner dashboard scenario calling get_owner_dashboard_stats, get_sidebar_badges RPCs and paginated student list via direct PostgREST
- Combined scenario: k6 multi-scenario with named writeSpike + readMix exec functions running concurrently at 300+50 VUs

## Task Commits

1. **Task 1: Create write-spike k6 scenario** - `01ec5a0` (feat)
2. **Task 2: Create read-mix and combined k6 scenarios** - `7adb3f7` (feat)

## Files Created/Modified

- `load-tests/scenarios/write-spike.js` - 500 VU student write spike (POST /api/reports + POST /api/work-sessions)
- `load-tests/scenarios/read-mix.js` - 100 VU owner dashboard read mix (get_owner_dashboard_stats, get_sidebar_badges, paginated list)
- `load-tests/scenarios/combined.js` - Concurrent multi-scenario (writeSpike 300 VUs + readMix 50 VUs)

## Decisions Made

- read-mix.js uses direct PostgREST URL (SUPABASE_URL) not APP_URL for RPC calls — owner RPCs bypass Next.js routing to test the DB aggregation layer directly. This matches the actual production read path which also goes through PostgREST.
- Origin header is included only on mutation routes (write-spike, combined writeSpike path). Read-mix and readMix paths do not need it — verifyOrigin() in CSRF middleware only applies to Next.js API route handlers, not direct PostgREST calls.
- combined.js VU counts (300 write + 50 read) are intentionally lower than standalone scenarios (500 + 100) because both run simultaneously — the total additive load at 350 VUs simultaneous is the meaningful combined stress figure.
- owner_token.json is loaded as SharedArray for consistency with the k6 SharedArray pattern, even though only index 0 is used (single owner).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The staging environment provisioning remains the human-action blocker documented in Plan 24-01.

## Next Phase Readiness

- All three k6 scenario files are ready to run against staging
- Plan 24-03 (test execution) can proceed once the human completes the staging provisioning checkpoint from Plan 24-01:
  1. Staging Supabase project provisioned with migrations applied
  2. `STAGING_JWT_SECRET=<secret> node load-tests/scripts/gen-tokens.js` run to generate tokens
  3. k6 available at `"/c/Program Files/k6/k6.exe"` (confirmed installed)
- Run order: write-spike first (isolated), then read-mix (isolated), then combined (stress)

## Known Stubs

None. All three scenario scripts are complete and executable — no placeholders.

## Self-Check: PASSED

| File | Status |
|------|--------|
| load-tests/scenarios/write-spike.js | FOUND |
| load-tests/scenarios/read-mix.js | FOUND |
| load-tests/scenarios/combined.js | FOUND |
| .planning/phases/24-infrastructure-validation/24-02-SUMMARY.md | FOUND |

| Commit | Message |
|--------|---------|
| 01ec5a0 | feat(24-02): create write-spike k6 scenario |
| 7adb3f7 | feat(24-02): create read-mix and combined k6 scenarios |

---
*Phase: 24-infrastructure-validation*
*Completed: 2026-03-30*
