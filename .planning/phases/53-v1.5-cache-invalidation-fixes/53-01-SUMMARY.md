---
phase: 53-v1.5-cache-invalidation-fixes
plan: "01"
subsystem: cache-invalidation
tags: [cache, revalidation, coach-dashboard, coach-analytics, work-sessions]
requirements: [COACH-DASH-04, COACH-DASH-06, COACH-ANALYTICS-07, PERF-05]
gap_closure: true

dependency_graph:
  requires:
    - src/lib/rpc/coach-dashboard-types.ts (coachDashboardTag helper — Phase 47)
    - src/lib/rpc/coach-analytics-types.ts (coachAnalyticsTag helper — Phase 48)
  provides:
    - coach dashboard + analytics cache invalidation on work-session completion
  affects:
    - /coach (coach dashboard leaderboard — immediate update after student completes session)
    - /coach/analytics (coach analytics hours leaderboard — immediate update)

tech_stack:
  added: []
  patterns:
    - revalidateTag with scoped coach-id cache keys
    - try/catch wrapping non-critical cache invalidation to protect student response

key_files:
  modified:
    - src/app/api/work-sessions/[id]/route.ts

decisions:
  - "Coach-tag bust gated on newStatus === 'completed' only — paused/resume/in_progress transitions do not change completed minutes in leaderboard aggregates"
  - "admin client used for coach_id lookup (not supabase user client) — consistent with existing pattern in route handler"
  - "try/catch wraps the coach_id lookup so a transient DB error never fails the student's PATCH response"

metrics:
  duration_minutes: 1
  completed_date: "2026-04-15"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 53 Plan 01: Coach Tag Cache Bust on Work-Session Completion Summary

**One-liner:** Added `coachDashboardTag` + `coachAnalyticsTag` revalidation to the PATCH /api/work-sessions/[id] handler, gated on `newStatus === "completed"`, closing the major cache staleness gap for coach leaderboards.

## What Was Built

The `PATCH /api/work-sessions/[id]` handler was missing cache invalidation for the coach dashboard and coach analytics caches. This meant that when a student completed a work session, the coach's "Top 3 This Week" leaderboard and coach analytics hours leaderboard remained stale for up to 60 seconds (the existing `unstable_cache` TTL).

**Changes made to `src/app/api/work-sessions/[id]/route.ts`:**

1. Added two new imports at the top of the file:
   - `coachDashboardTag` from `@/lib/rpc/coach-dashboard-types`
   - `coachAnalyticsTag` from `@/lib/rpc/coach-analytics-types`

2. Injected a coach-tag bust block immediately after the existing `studentAnalyticsTag` try/catch, before the final `return NextResponse.json(updated)`:
   - Gated on `newStatus === "completed"` — only fires when completed minutes actually change
   - Uses the admin client to look up the student's `coach_id` from the `users` table
   - Calls `revalidateTag(coachDashboardTag(coach_id), "default")` and `revalidateTag(coachAnalyticsTag(coach_id), "default")` when coach exists
   - Wrapped in `try/catch` to prevent a transient DB error from breaking the student's PATCH response

## Acceptance Criteria Verification

| Check | Result |
|-------|--------|
| `import { coachDashboardTag }` present | PASS |
| `import { coachAnalyticsTag }` present | PASS |
| `revalidateTag(coachDashboardTag(...)` present | PASS |
| `revalidateTag(coachAnalyticsTag(...)` present | PASS |
| `revalidateTag(studentAnalyticsTag(...))` still present (regression guard) | PASS |
| `revalidateTag("badges"` still present (regression guard) | PASS |
| `if (newStatus === "completed")` count >= 2 (original + new guard) | PASS (count = 2) |
| `npx tsc --noEmit` | PASS (zero errors) |
| `npm run lint` on modified file | PASS (zero errors) |

## Deviations from Plan

None — plan executed exactly as written. The canonical pattern from `deals/route.ts` was followed precisely.

## Known Stubs

None.

## Threat Flags

None. The new code path:
- Uses admin client keyed on `profile.id` (derived from `auth.getUser()`) so a student cannot inject a foreign `coach_id` (T-53.01-03 mitigated)
- Rate limiting at 30 req/min already bounds invalidation rate (T-53.01-02 accepted)
- Wrapped in try/catch so failure is non-fatal (defense-in-depth)

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add coach-tag invalidation to work-sessions PATCH | d5c8ce9 | src/app/api/work-sessions/[id]/route.ts |

## Self-Check: PASSED

- `src/app/api/work-sessions/[id]/route.ts` exists and contains both new imports and bust block
- Commit `d5c8ce9` verified in git log
- No file deletions in commit
