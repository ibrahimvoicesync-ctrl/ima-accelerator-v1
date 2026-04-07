---
phase: 28-daily-session-planner-api
plan: "01"
subsystem: api
tags: [zod, supabase, daily-plans, rate-limiting, csrf]

# Dependency graph
requires:
  - phase: 26-database-schema-foundation
    provides: daily_plans table with UNIQUE(student_id, date), RLS policies, plan_json JSONB column
  - phase: 22-spike-protection-rate-limiting
    provides: checkRateLimit() helper for API rate limiting
  - phase: 23-security-audit
    provides: verifyOrigin() CSRF helper

provides:
  - Zod schema module src/lib/schemas/daily-plan.ts (planJsonSchema, sessionEntrySchema, PlanJson type)
  - POST /api/daily-plans — create daily plan with 4h cap validation, idempotent on duplicate
  - GET /api/daily-plans — retrieve today's plan for authenticated student, null if none

affects:
  - 28-02 (work-sessions cap enforcement — imports planJsonSchema from daily-plan.ts)
  - 29-session-planner-ui (client will consume POST and GET daily-plans endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "src/lib/schemas/ directory for shared Zod schema modules reused across route handlers"
    - "Idempotent POST: insert-then-fetch on 23505 to return existing record without erroring"

key-files:
  created:
    - src/lib/schemas/daily-plan.ts
    - src/app/api/daily-plans/route.ts
  modified: []

key-decisions:
  - "plan_json uses version:1 literal for schema evolution safety (D-07 from v1.3 research)"
  - "GET handler uses .maybeSingle() so no error thrown when no plan exists for today"
  - "GET handler omits CSRF and rate limit, consistent with /api/calendar pattern for read-only endpoints"
  - "23505 conflict returns existing plan with status 200 (idempotent per D-06) rather than erroring"

patterns-established:
  - "Shared Zod schema in src/lib/schemas/ imported by both route handler and downstream plan modifiers"
  - "CSRF -> Auth -> Role -> RateLimit -> Body -> Zod chain order enforced on POST"
  - "Auth -> Role only on GET (no CSRF/rate-limit for safe methods)"

requirements-completed:
  - PLAN-08

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 28 Plan 01: Daily Plans Schema and API Summary

**plan_json Zod schema (version:1, 4h cap) with idempotent POST and null-safe GET for /api/daily-plans**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T08:38:46Z
- **Completed:** 2026-03-31T08:42:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `src/lib/schemas/daily-plan.ts` with `planJsonSchema` (version:1, total_work_minutes max 240, sessions min 1), `sessionEntrySchema` (session_minutes from WORK_TRACKER config, break_type enum, break_minutes), and `PlanJson` type
- Created `POST /api/daily-plans` with full CSRF → Auth → Role → RateLimit → Body → Zod chain; inserts plan into daily_plans table; returns existing plan (status 200) on UNIQUE(student_id, date) conflict per D-06; returns 201 on fresh creation
- Created `GET /api/daily-plans` with Auth → Role only (no CSRF/rate-limit for reads); uses `.maybeSingle()` to return null when no plan exists for today

## Task Commits

Each task was committed atomically:

1. **Task 1: Create plan_json Zod schema module** - `2057c14` (feat)
2. **Task 2: Create POST and GET /api/daily-plans route handlers** - `016c3dd` (feat)

**Plan metadata:** (to be committed with SUMMARY)

## Files Created/Modified

- `src/lib/schemas/daily-plan.ts` — Zod schema for plan_json: sessionEntrySchema, planJsonSchema (version:1, 4h cap), PlanJson type
- `src/app/api/daily-plans/route.ts` — POST (create plan, idempotent) and GET (today's plan or null) route handlers

## Decisions Made

- GET handler uses `.maybeSingle()` not `.single()` — ensures null return when no plan exists, no error thrown
- GET omits CSRF and rate limit, consistent with /api/calendar read pattern (no mutation, safe method)
- 23505 conflict on POST returns existing plan at status 200 (idempotent D-06), not 409 Conflict
- `revalidateTag("badges", "default")` called with two arguments matching existing codebase pattern in work-sessions/route.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `planJsonSchema` and `PlanJson` type are exported from `src/lib/schemas/daily-plan.ts` and ready for Plan 02 (work-sessions cap enforcement)
- POST /api/daily-plans and GET /api/daily-plans are live and ready for Phase 29 client consumption
- No blockers for Plan 02

---
*Phase: 28-daily-session-planner-api*
*Completed: 2026-03-31*
