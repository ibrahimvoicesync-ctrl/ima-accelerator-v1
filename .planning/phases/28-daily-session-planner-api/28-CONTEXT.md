# Phase 28: Daily Session Planner API - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

The daily plans API is live with server-enforced 4-hour cap, idempotent plan creation, and the existing work-sessions endpoint enforces the cap when a plan exists. Two new endpoints: POST/GET /api/daily-plans. One modified endpoint: POST /api/work-sessions gets plan-aware cap enforcement.

</domain>

<decisions>
## Implementation Decisions

### Cap Enforcement Logic
- **D-01:** No plan yet today → block. Student must create a daily plan before starting any work session. POST /api/work-sessions returns 400 if no daily_plans row exists for the student + today's date.
- **D-02:** Plan exists, planned sessions not all completed → enforce cap. POST /api/work-sessions rejects if adding the requested session_minutes would cause total completed minutes + requested minutes to exceed the plan's total_work_minutes (240 max).
- **D-03:** Plan exists, all planned sessions completed → cap lifted. Student can start unlimited ad-hoc sessions with no time restriction. The plan is a one-time daily planning step covering the first 4h; after that, the student works freely.
- **D-04:** "Plan complete" detection: compare count of completed work_sessions for today against the number of sessions in plan_json. If completed >= planned count, the plan is fulfilled.
- **D-05:** API enforces cap only (total minutes), not session ordering. Client (Phase 29) handles sequential session execution in the UI. Keeps API simple.

### Idempotent Plan Creation (carried from Phase 26)
- **D-06:** POST /api/daily-plans with UNIQUE(student_id, date) — on conflict, return the existing plan (no duplicate insert). Zod validates total_work_minutes <= 240 server-side.

### plan_json Contract (carried from v1.3 research)
- **D-07:** plan_json must include `version: 1` field for schema evolution safety. Always Zod safeParse at read, never TypeScript cast. Treat parse failure as "no plan today."

### Claude's Discretion
- plan_json Zod schema shape (fields per session entry, top-level structure)
- API response shapes (status codes, payloads, error messages)
- How to detect "plan complete" efficiently (query strategy)
- Rate limiting and CSRF patterns (reuse existing checkRateLimit + verifyOrigin)
- Auth + role check patterns (follow existing work-sessions route)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00013_daily_plans_undo_log.sql` — daily_plans table definition, UNIQUE(student_id, date) index, RLS policies (student INSERT/SELECT own rows, coach/owner SELECT)
- `supabase/migrations/00001_create_tables.sql` — Original schema, get_user_id()/get_user_role() helpers, RLS patterns

### Existing API (to modify)
- `src/app/api/work-sessions/route.ts` — Current POST handler; must be modified to add plan-aware cap enforcement (D-01 through D-05)

### Types & Config
- `src/lib/types.ts` lines 418-448 — daily_plans TypeScript types (Row, Insert, Update)
- `src/lib/config.ts` §WORK_TRACKER — sessionDurationOptions [30, 45, 60], breakOptions (short: [5, 10], long: [15, 20, 25, 30]), dailyGoalHours: 4
- `src/lib/utils.ts` — getTodayUTC() for UTC-safe date comparison

### Shared Helpers
- `src/lib/rate-limit.ts` — checkRateLimit() helper for 30 req/min rate limiting
- `src/lib/csrf.ts` — verifyOrigin() CSRF protection
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

### Requirements
- `.planning/REQUIREMENTS.md` §Session Planner — PLAN-08 (POST /api/daily-plans with 4h cap), PLAN-09 (work-sessions cap enforcement)

### Prior Phase Context
- `.planning/phases/26-database-schema-foundation/26-CONTEXT.md` — Database decisions: single migration, UTC enforcement at app layer, no DB-level JSONB constraints, Zod safeParse only
- `.planning/STATE.md` §Accumulated Context — v1.3 research decisions on plan_json version field, ad-hoc session bypass, Zod safeParse pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `checkRateLimit(profileId, endpoint)` — drop-in rate limiting, already used on all mutation routes
- `verifyOrigin(request)` — CSRF protection, returns error response or null
- `createAdminClient()` — server-side Supabase client for all DB queries in route handlers
- `getTodayUTC()` — UTC date string for daily_plans date comparison
- `WORK_TRACKER.sessionDurationOptions` — [30, 45, 60] for Zod validation of session durations
- `WORK_TRACKER.breakOptions` — short [5, 10] and long [15, 20, 25, 30] for break validation

### Established Patterns
- API routes: auth check → role check → rate limit → parse body → Zod safeParse → admin query → revalidateTag
- Error handling: 401 Unauthorized, 403 Forbidden, 429 Too Many Requests, 400 Invalid Input, 409 Conflict, 500 Internal Server Error
- All mutations use `createAdminClient()`, never client-side Supabase
- `revalidateTag("badges", "default")` after mutations for cache invalidation

### Integration Points
- `POST /api/work-sessions` (existing) — must be modified to query daily_plans before inserting session
- `src/app/api/daily-plans/route.ts` (new) — new route file for POST and GET handlers
- Phase 29 client will consume GET /api/daily-plans to render planner state and POST to create plans

</code_context>

<specifics>
## Specific Ideas

- The daily plan is a one-time daily planning step: plan once, execute sessions, then work freely after completion
- "The student works freely" after plan completion — no restrictions, no tracking against the plan
- Cap check is pure math: sum of completed session minutes vs plan total, not session ordering

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-daily-session-planner-api*
*Context gathered: 2026-03-31*
