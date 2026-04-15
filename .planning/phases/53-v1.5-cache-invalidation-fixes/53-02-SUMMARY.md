---
phase: 53-v1.5-cache-invalidation-fixes
plan: "02"
subsystem: api-rate-limiting
tags:
  - rate-limiting
  - csv-export
  - coach-analytics
  - perf
  - security
dependency_graph:
  requires:
    - src/lib/rate-limit.ts (checkRateLimit function)
    - src/lib/session.ts (getSessionUser)
  provides:
    - Rate-limited GET /api/coach/analytics/export.csv (30 req/min/coach)
  affects:
    - src/app/api/coach/analytics/export.csv/route.ts
tech_stack:
  added: []
  patterns:
    - checkRateLimit after role gate, before param validation (canonical coach API pattern)
key_files:
  created: []
  modified:
    - src/app/api/coach/analytics/export.csv/route.ts
decisions:
  - Use default checkRateLimit args (30 req/min) — no override per PERF-02 policy
  - 429 response uses JSON envelope (not plain-text like 400/500 paths) to match all other coach routes
  - Rate-limit key is user.id (profile UUID from getSessionUser), not authId
metrics:
  duration: "~5 minutes"
  completed: "2026-04-15T11:10:17Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 53 Plan 02: Add Rate Limiting to Coach Analytics CSV Export Summary

**One-liner:** Added `checkRateLimit(user.id, "/api/coach/analytics/export.csv")` to the CSV export GET handler — caps the expensive 5000-row RPC at 30 req/min/coach and returns a standard 429 JSON envelope with `Retry-After` header on breach.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rate limit to coach analytics CSV export GET handler | 5639d3f | src/app/api/coach/analytics/export.csv/route.ts |

## What Was Done

The CSV export route at `src/app/api/coach/analytics/export.csv/route.ts` had auth + role gate but no rate limiting, leaving it vulnerable to a DoS loop where a coach could fire the expensive `get_coach_analytics(page_size=5000)` RPC without bound.

Changes made to the GET handler:

1. Added `import { checkRateLimit } from "@/lib/rate-limit"` alongside existing imports.
2. Inserted the canonical rate-limit block immediately after the role gate (step 1) and before param validation (now step 3):
   - `await checkRateLimit(user.id, "/api/coach/analytics/export.csv")`
   - Returns `{ error: "Too many requests, try again in N seconds." }` with status 429 and `Retry-After: N` header on limit breach.
   - `fetchCoachAnalytics` is NOT called when `allowed === false` — early return prevents the expensive RPC.
3. Renumbered inline step comments from 5 steps (1-5) to 6 steps (1-6): auth, rate limit, validate params, fetch, build CSV body, return attachment.

## Acceptance Criteria — All Passed

- `import { checkRateLimit } from "@/lib/rate-limit"` present: PASS
- `await checkRateLimit(` call present: PASS
- `"/api/coach/analytics/export.csv"` endpoint key string present: PASS
- `status: 429` branch present: PASS
- `"Retry-After": String(retryAfterSeconds)` header present: PASS
- Exactly 2 `checkRateLimit` occurrences (import + call, no double-call): PASS
- No `maxRequests` override (30/min policy preserved): PASS
- `npx tsc --noEmit` exits 0: PASS
- `eslint src/app/api/coach/analytics/export.csv/route.ts` exits 0: PASS

## Deviations from Plan

None — plan executed exactly as written. The import was added after `fetchCoachAnalytics` import (line 17) and the rate-limit check was inserted verbatim per the plan's exact insert specification.

## Known Stubs

None.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `checkRateLimit` function writes to the existing `rate_limit_log` table (already in threat model T-53.02-04). No new threat flags.

## Pre-existing Lint Issues (Out of Scope)

`npm run lint` reports 7 pre-existing errors in files not modified by this plan:
- `load-tests/scripts/gen-tokens.js` — `require()` style imports
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — `Date.now()` during render
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — `Date.now()` during render
- `src/components/student/DealFormModal.tsx` — setState in effect
- `src/components/ui/Modal.tsx` — ref access during render

These are not caused by this plan's changes and are logged to deferred-items for tracking.

## Self-Check: PASSED

- `src/app/api/coach/analytics/export.csv/route.ts` — FOUND, modified correctly
- Commit `5639d3f` — FOUND in git log
- No unexpected file deletions in commit
