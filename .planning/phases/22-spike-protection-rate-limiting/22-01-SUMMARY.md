---
phase: 22-spike-protection-rate-limiting
plan: 01
subsystem: database
tags: [rate-limiting, postgres, pg-cron, supabase, typescript, server-only]

# Dependency graph
requires:
  - phase: 21-write-path-pre-aggregation
    provides: migration 00011 established pg_cron pattern and SQL style for this phase to follow

provides:
  - rate_limit_log table (bigserial PK, user_id FK, endpoint, called_at) with covering index and RLS
  - pg_cron cleanup job at 3:30 AM UTC with 2-hour retention
  - checkRateLimit() async helper in src/lib/rate-limit.ts with COUNT + INSERT pattern
  - RateLimitResult type (allowed, remaining, retryAfterSeconds)

affects: [22-02-route-integration, security-audit, infrastructure-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-backed rate limiting: COUNT window query then conditional INSERT — no in-memory state"
    - "server-only guard + createAdminClient() import pattern in all rate-limit-adjacent server modules"
    - "pg_cron idempotent registration: unschedule then schedule in DO block with EXCEPTION handler"

key-files:
  created:
    - supabase/migrations/00012_rate_limit_log.sql
    - src/lib/rate-limit.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "DB-backed rate limiting chosen over in-memory (research confirmed in-memory is broken in serverless — each container has isolated state)"
  - "Errors propagate naturally from checkRateLimit() — fail open on DB error is correct (better than blocking legitimate users on transient failure)"
  - "rate_limit_log table has RLS enabled but no policies — access exclusively via service_role admin client"
  - "types.ts extended with rate_limit_log and student_kpi_summaries entries — required for TypeScript to type-check .from() calls against new tables"

patterns-established:
  - "Rate limit check: COUNT rows in window → if below limit, INSERT log row → return result"
  - "Covering index on (user_id, endpoint, called_at DESC) — all three columns used in WHERE + ORDER"

requirements-completed: [SEC-01]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 22 Plan 01: Rate Limit Infrastructure Summary

**DB-backed rate_limit_log table with covering index, pg_cron 2-hour cleanup, and checkRateLimit() helper using COUNT+INSERT atomic pattern**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T13:21:43Z
- **Completed:** 2026-03-30T13:25:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created migration 00012 with rate_limit_log table, covering index on all three query columns, RLS enabled (no policies), and idempotent pg_cron cleanup at 3:30 AM UTC
- Created src/lib/rate-limit.ts exporting checkRateLimit() with rolling window COUNT query + conditional INSERT, RateLimitResult type, server-only guard
- Extended types.ts with rate_limit_log and student_kpi_summaries table types so TypeScript can type-check all .from() calls against these tables

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00012_rate_limit_log.sql** - `29706e7` (feat)
2. **Task 2: Create src/lib/rate-limit.ts helper** - `2a2b7d0` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `supabase/migrations/00012_rate_limit_log.sql` - rate_limit_log table, covering index, RLS, pg_cron cleanup job
- `src/lib/rate-limit.ts` - checkRateLimit() helper with COUNT + INSERT pattern, RateLimitResult type
- `src/lib/types.ts` - Added rate_limit_log and student_kpi_summaries table type definitions (Rule 3 auto-fix)

## Decisions Made

- DB-backed rate limiting: in-memory would be broken in serverless (isolated per-container state). rate_limit_log table is the correct approach.
- Errors propagate naturally from checkRateLimit() — fail open on transient DB error is safer than false rejections for legitimate users.
- types.ts extended manually (not regenerated) — Docker/local Supabase not running; hand-craft is the established pattern in this project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added rate_limit_log and student_kpi_summaries to types.ts**
- **Found during:** Task 2 (Create src/lib/rate-limit.ts helper)
- **Issue:** types.ts is a hand-crafted placeholder that lacked entries for rate_limit_log (and student_kpi_summaries from Phase 21). The Supabase client `.from("rate_limit_log").insert(...)` call typed the argument as `never` — TypeScript error TS2769 blocked compilation.
- **Fix:** Added full Row/Insert/Update/Relationships definitions for both rate_limit_log and student_kpi_summaries in types.ts.
- **Files modified:** src/lib/types.ts
- **Verification:** `npx tsc --noEmit` exits clean with no errors.
- **Committed in:** 2a2b7d0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for TypeScript correctness. types.ts is a known hand-crafted placeholder in this project — this pattern has been used in every prior phase that added new tables.

## Issues Encountered

None beyond the types.ts blocking issue above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- checkRateLimit() is ready to integrate into all 8 mutation routes in Plan 22-02
- Types are in place for full TypeScript support in route handlers
- Migration 00012 ready to apply to production Supabase instance

---
*Phase: 22-spike-protection-rate-limiting*
*Completed: 2026-03-30*
