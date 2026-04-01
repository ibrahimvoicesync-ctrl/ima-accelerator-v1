---
phase: 260401-tuq
plan: 01
subsystem: api
tags: [bug-fix, csrf, work-sessions, production-debugging]
dependency_graph:
  requires: []
  provides: [diagnostic-csrf-logging, work-sessions-error-handling]
  affects: [src/lib/csrf.ts, src/app/api/work-sessions/route.ts]
tech_stack:
  added: []
  patterns: [console.error diagnostic logging, Supabase error destructuring]
key_files:
  modified:
    - src/lib/csrf.ts
    - src/app/api/work-sessions/route.ts
decisions:
  - Logged originHost, expectedHost, and NEXT_PUBLIC_APP_URL together for one-look diagnosis
  - dailyPlanError check placed before !todayPlan to avoid misleading 400 masking real 500 errors
  - Happy-path behavior intentionally unchanged — only error branches added
metrics:
  duration: 5m
  completed: 2026-04-01T19:36:20Z
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 260401-tuq: Fix Work Sessions Production Failures Summary

**One-liner:** CSRF and daily_plans error logging to make production 403/500 failures diagnosable instead of silent.

## What Was Done

Two production bugs were patched to make failures visible and correctly reported:

**Bug 1 — CSRF origin mismatch was silent:** When `NEXT_PUBLIC_APP_URL` is misconfigured in production (e.g., set to `http://localhost:3000` instead of the real domain), every work-session POST returns 403 with no server log. Debugging was impossible without reproducing locally. Fix: added `console.error` on the mismatch branch with `originHost`, `expectedHost`, and the raw `NEXT_PUBLIC_APP_URL` env var value.

**Bug 2 — daily_plans query failure masked as "create a plan":** The Supabase query result was destructured as `{ data: todayPlan }` — discarding the `error` field entirely. If the `daily_plans` table didn't exist (migration not applied), or had a network/permission error, `todayPlan` would be `null` and the handler would return a misleading 400 "You must create a daily plan" when the real problem was a server-side failure. Fix: destructure `error: dailyPlanError`, check it first, return 500 with the real Supabase error logged.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | CSRF hostname mismatch diagnostic logging | 4deb6fc | src/lib/csrf.ts |
| 2 | daily_plans query error handling in work-sessions POST | e534448 | src/app/api/work-sessions/route.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` — passed, zero errors
- `npx eslint src/lib/csrf.ts src/app/api/work-sessions/route.ts` — passed, zero issues
- Pre-existing lint errors in unrelated files (`owner/students/[studentId]/page.tsx`, `student/loading.tsx`, `CalendarTab.tsx`, `WorkTrackerClient.tsx`) are out of scope for this task

## Known Stubs

None.

## Production Environment Checklist

These items must be verified manually in the production environment for work sessions to function correctly:

1. **`NEXT_PUBLIC_APP_URL` must be set to the production URL** in Vercel environment variables — for example `https://yourdomain.com`, NOT `http://localhost:3000`. If this is wrong, every work-session POST will return 403 (CSRF blocked). The new log will now clearly show `originHost` vs `expectedHost` to diagnose this.

2. **Migration 00013 (`daily_plans` table) must be applied** in the production Supabase database. If this migration has not been run, the `daily_plans` query will fail with a Supabase error — now returned as 500 "Failed to check daily plan" instead of the misleading 400.

3. **Migration 00006 (`session_minutes` column on `work_sessions`) must be applied** in the production Supabase database. If missing, session inserts will fail at the INSERT step with a 500 error (already logged via the existing `insertError` handler).

## Self-Check

Files exist:
- src/lib/csrf.ts — modified with console.error on mismatch path
- src/app/api/work-sessions/route.ts — modified with dailyPlanError check

Commits exist:
- 4deb6fc — CSRF logging fix
- e534448 — daily_plans error handling fix

## Self-Check: PASSED
