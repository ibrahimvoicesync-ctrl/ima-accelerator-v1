---
phase: 28-daily-session-planner-api
plan: "02"
subsystem: api
tags: [zod, supabase, daily-plans, work-sessions, cap-enforcement]

# Dependency graph
requires:
  - phase: 28-01
    provides: planJsonSchema from src/lib/schemas/daily-plan.ts, daily_plans table with UNIQUE(student_id, date)
  - phase: 26-database-schema-foundation
    provides: daily_plans table schema with plan_json JSONB column
  - phase: 22-spike-protection-rate-limiting
    provides: checkRateLimit() helper already wired in work-sessions route
  - phase: 23-security-audit
    provides: verifyOrigin() CSRF helper already wired in work-sessions route

provides:
  - Plan-aware cap enforcement in POST /api/work-sessions (D-01 through D-05, D-07)
  - Block if no daily plan exists for today (D-01)
  - 240-minute cap enforcement while plan not fulfilled (D-02)
  - Cap lifted after completed session count >= planned session count (D-03, D-04)

affects:
  - 29-session-planner-ui (client consumes POST /api/work-sessions; now requires daily plan to exist first)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan fulfillment detection: completed session count vs plan_json sessions array length (D-04)"
    - "Single query for both count and sum: select session_minutes + array.length + reduce (Pitfall 4)"
    - "Server UTC date (getTodayUTC) for plan lookup — never client-supplied date (Pitfall 1)"
    - "Zod safeParse on plan_json at runtime read, return 400 on parse failure (D-07)"

key-files:
  created: []
  modified:
    - src/app/api/work-sessions/route.ts

key-decisions:
  - "Plan-cap block inserted AFTER active-session conflict check and BEFORE insert — preserves all existing logic untouched"
  - "getTodayUTC() used for plan lookup, never the client-supplied date field — prevents cap bypass via date manipulation (Pitfall 1)"
  - "Single query for completed sessions provides both count (plan fulfillment) and sum (cap check) — eliminates redundant DB round trip (Pitfall 4)"
  - "plan_json parse failure treated as D-01 (no plan today) — blocks session and surfaces corruption immediately"

patterns-established:
  - "Plan-aware gate: fetch plan with maybeSingle, block if null, safeParse plan_json, check fulfillment, check cap"

requirements-completed:
  - PLAN-09

# Metrics
duration: 4min
completed: 2026-03-31
---

# Phase 28 Plan 02: Work-Sessions Cap Enforcement Summary

**Plan-aware 4h cap enforcement in POST /api/work-sessions: blocks if no plan (D-01), enforces total_work_minutes while plan unfulfilled (D-02), lifts cap after all planned sessions completed (D-03)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T08:47:05Z
- **Completed:** 2026-03-31T08:51:06Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Inserted plan-aware cap enforcement block into `POST /api/work-sessions` after the active-session conflict check and before the insert
- Blocks session creation when no daily plan exists for today, returning 400 with "You must create a daily plan before starting a work session." (D-01)
- Parses plan_json with Zod safeParse; on parse failure returns 400 with "Your daily plan data is invalid" and console.errors the corruption (D-07)
- Fetches completed sessions with a single query (select session_minutes) providing both count (for fulfillment detection) and sum (for cap math) in one DB round trip (Pitfall 4)
- Enforces total_work_minutes cap only while completed session count < planned session count; cap is fully lifted after plan fulfillment (D-02, D-03, D-04)
- Uses getTodayUTC() for all plan and session queries — never the client-supplied date field (Pitfall 1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add plan-aware cap enforcement to POST /api/work-sessions** - `7794921` (feat)

**Plan metadata:** (to be committed with SUMMARY)

## Files Created/Modified

- `src/app/api/work-sessions/route.ts` — Added 68 lines of plan-cap enforcement: imports getTodayUTC and planJsonSchema, fetches today's plan, Zod-parses plan_json, fetches completed sessions, checks fulfillment, enforces cap

## Decisions Made

- Plan-cap block inserted after active-session conflict check and before insert — preserves all existing logic (CSRF, auth, role, rate-limit, Zod, conflict check, insert, 23505, revalidateTag) untouched
- getTodayUTC() used for plan lookup, never the client-supplied `date` from the request body — prevents cap bypass via date manipulation
- Single query for completed sessions (select session_minutes): array.length = count for fulfillment check, array.reduce = sum for cap check — collapses two logical operations into one DB round trip per Pitfall 4 from RESEARCH.md
- plan_json parse failure returns 400 and console.errors — surfaces data corruption immediately rather than silently bypassing the cap

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- POST /api/work-sessions now enforces plan-aware cap: students must create a daily plan before any session, and cannot exceed the plan's total_work_minutes until the plan is fulfilled
- Phase 29 client (session-planner-ui) can consume POST /api/daily-plans to create plans and POST /api/work-sessions to start sessions with full server enforcement
- No blockers for Phase 29

---
*Phase: 28-daily-session-planner-api*
*Completed: 2026-03-31*
