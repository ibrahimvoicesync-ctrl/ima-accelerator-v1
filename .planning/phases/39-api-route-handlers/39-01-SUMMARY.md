---
phase: 39-api-route-handlers
plan: "01"
subsystem: api
tags: [api, deals, crud, auth, csrf, rate-limit, zod]
dependency_graph:
  requires:
    - 38-01  # deals table migration (00021_deals.sql)
  provides:
    - POST /api/deals
    - GET /api/deals
    - PATCH /api/deals/[id]
    - DELETE /api/deals/[id]
  affects:
    - Phase 41 (student deal UI reads/writes these endpoints)
    - Phase 42 (dashboard stats queries deals via GET)
    - Phase 43 (coach/owner deal tab uses GET)
tech_stack:
  added: []
  patterns:
    - CSRF -> Auth -> Profile -> Role -> RateLimit -> Body -> Zod -> Ownership -> DB -> revalidateTag -> Response
    - 23505 unique_violation single-retry pattern (no loop, no delay)
    - Three-tier DELETE authorization (student own / coach assigned / owner any)
    - Ownership at query level via .eq("student_id", profile.id) — no separate fetch for PATCH
    - revalidateTag scoped to deals-{studentId} with "default" profile
key_files:
  created:
    - src/app/api/deals/route.ts
    - src/app/api/deals/[id]/route.ts
  modified: []
decisions:
  - "revalidateTag requires two arguments in this Next.js version: tag and profile (second arg = 'default')"
  - "Deviation: revalidateTag('deals-X') → revalidateTag('deals-X', 'default') — matched existing codebase pattern"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 39 Plan 01: Deal CRUD API Route Handlers Summary

**One-liner:** Four deal CRUD endpoints (POST/GET in route.ts, PATCH/DELETE in [id]/route.ts) with CSRF, rate limiting, Zod validation, 23505 retry on POST, single-query ownership on PATCH, and three-tier DELETE authorization.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | POST + GET handlers in /api/deals/route.ts | 0634799 | src/app/api/deals/route.ts |
| 2 | PATCH + DELETE handlers in /api/deals/[id]/route.ts | dcec44f | src/app/api/deals/[id]/route.ts |

## What Was Built

### `src/app/api/deals/route.ts`

**POST /api/deals** (student/student_diy only):
- Full CSRF -> auth -> profile -> role check -> rate limit -> body parse -> Zod -> DB insert pipeline
- 23505 unique_violation retry: single retry without loop or delay, matching D-03/D-04 spec
- Insert payload omits `deal_number` — trigger `assign_deal_number()` always sets it
- Returns `{ data: deal }` with status 201
- Cache invalidation: `revalidateTag("deals-{profile.id}", "default")`

**GET /api/deals** (coach/owner only):
- Accepts `student_id` and `page` query params; validates `student_id` is present (400 if missing)
- Page size: 25 rows; sorted `created_at DESC`
- Returns `{ data: Deal[], total: number, page: number }` shape

### `src/app/api/deals/[id]/route.ts`

**PATCH /api/deals/[id]** (student/student_diy only):
- UUID regex validation on `id` param before any auth check
- `patchDealSchema` with `.refine()` requiring at least one of revenue/profit
- Ownership enforced at query level: `.eq("id", id).eq("student_id", profile.id)` in single UPDATE — no separate fetch (per RESEARCH.md Pitfall 3)
- Returns 404 "Deal not found or forbidden" when student_id filter excludes the row
- Cache invalidation: `revalidateTag("deals-{profile.id}", "default")`

**DELETE /api/deals/[id]** (all four roles):
- Fetches deal first to get `student_id` for authorization and cache tag scoping
- Three-tier authorization:
  - Tier 1 (student/student_diy): `deal.student_id === profile.id`
  - Tier 2 (coach): `users.coach_id === profile.id` for the deal's student
  - Tier 3 (owner): passes through after role check
- Cache invalidation: `revalidateTag("deals-{deal.student_id}", "default")` — uses `deal.student_id` NOT `profile.id` so coach/owner deletes invalidate the correct student's cache

## Verification Results

- `npx tsc --noEmit`: PASSED (0 errors)
- `npm run build`: PASSED
- `npx eslint src/app/api/deals/`: PASSED (0 errors)
- Both files exist at expected paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] revalidateTag requires two arguments**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** `revalidateTag(tag)` with one argument fails TypeScript in this Next.js version — signature is `revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined`
- **Fix:** Changed all `revalidateTag(\`deals-${...}\`)` calls to `revalidateTag(\`deals-${...}\`, "default")`, matching the pattern used throughout the existing codebase (`revalidateTag("badges", "default")`)
- **Files modified:** `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/route.ts`
- **Commit:** Inline fix before Task 1 commit (0634799)

## Known Stubs

None — all endpoints are fully wired with real DB queries.

## Threat Flags

No new security surfaces beyond what was in the plan's threat model. All four endpoints from the STRIDE register are mitigated as specified (T-39-01 through T-39-10).

## Self-Check: PASSED

- [x] `src/app/api/deals/route.ts` — exists
- [x] `src/app/api/deals/[id]/route.ts` — exists
- [x] Commit 0634799 — exists (`git log --oneline | grep 0634799`)
- [x] Commit dcec44f — exists (`git log --oneline | grep dcec44f`)
- [x] TypeScript clean — `npx tsc --noEmit` exits 0
- [x] Build passes — `npm run build` exits 0
