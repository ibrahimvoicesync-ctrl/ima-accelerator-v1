---
phase: 36-resources-tab
plan: "02"
subsystem: api
tags: [resources, glossary, crud, api-routes, rate-limiting, csrf]
dependency_graph:
  requires: [36-01]
  provides: [GET /api/resources, POST /api/resources, DELETE /api/resources, GET /api/glossary, POST /api/glossary, PUT /api/glossary/[id], DELETE /api/glossary/[id]]
  affects: [36-03-resources-client-ui]
tech_stack:
  added: []
  patterns: [admin-client-pattern, zod-safeParse, verifyOrigin-csrf, checkRateLimit-mutation, 23505-duplicate-handling, async-params-nextjs16]
key_files:
  created:
    - src/app/api/resources/route.ts
    - src/app/api/glossary/route.ts
    - src/app/api/glossary/[id]/route.ts
  modified: []
decisions:
  - "GET endpoints have no rate limiting (read endpoints — rate limiting on GETs would exhaust 30 req/min cap)"
  - "Coach can only delete own resources; owner can delete any (ownership enforcement in DELETE handler)"
  - "23505 unique violation returns 409 with user-facing message for glossary POST and PUT"
  - "Next.js 16 async params: `const { id } = await params` in [id] route"
metrics:
  duration: "4m 24s"
  completed: "2026-04-04T05:56:57Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 36 Plan 02: Resources & Glossary API Routes Summary

Three API route files providing full CRUD for resource links and glossary terms: GET/POST/DELETE /api/resources with coach ownership enforcement and GET/POST /api/glossary plus PUT/DELETE /api/glossary/[id] with 409 duplicate term handling.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create /api/resources route (GET, POST, DELETE) | 7d3c940 | src/app/api/resources/route.ts |
| 2 | Create /api/glossary routes (GET, POST) and /api/glossary/[id] (PUT, DELETE) | 577b2bc | src/app/api/glossary/route.ts, src/app/api/glossary/[id]/route.ts |

## What Was Built

### /api/resources (route.ts)

- **GET**: No CSRF, no rate limit. Fetches all resources with poster name joined via `users!resources_created_by_fkey(name)`. Ordered pinned-first then newest. Allows owner, coach, student. Returns `{ resources: [] }`.
- **POST**: CSRF + rate limit. Owner/coach only (students blocked, 403). Validates with `addResourceSchema` (title, url, comment, is_pinned). Inserts with `created_by: profile.id` and `is_pinned: false` default. Returns `{ resource }` with 201.
- **DELETE**: CSRF + rate limit. Owner/coach only. Coach ownership check: if `profile.role === "coach"`, fetches `created_by` and returns 403 if mismatch. Owner bypasses ownership check. Returns `{ success: true }`.

### /api/glossary (route.ts)

- **GET**: No CSRF, no rate limit. Fetches all terms alphabetically (`order("term", { ascending: true })`) with poster name. Allows owner, coach, student. Returns `{ glossary_terms: [] }`.
- **POST**: CSRF + rate limit. Owner/coach only (D-12). Validates with `addGlossarySchema` (term, definition). Handles `insertError.code === "23505"` with 409 "A term with this name already exists" (RES-09). Returns `{ glossary_term }` with 201.

### /api/glossary/[id] (route.ts)

- **PUT**: UUID validation on id param. CSRF + rate limit. Owner/coach only. Validates with `updateGlossarySchema` (term?, definition? — both optional). Requires at least one field. Builds update object from defined fields only. Handles `updateError.code === "23505"` with 409. Returns `{ glossary_term }`.
- **DELETE**: UUID validation on id param. CSRF + rate limit. Owner/coach only. Returns `{ success: true }`.

## Decisions Made

1. GET endpoints have no rate limiting — consistent with /api/messages and /api/calendar read patterns.
2. Coach DELETE ownership enforcement — coach can only delete their own resources, owner can delete any.
3. 23505 handling — duplicate term name returns 409 with user-facing message on both POST and PUT (term rename can also collide).
4. Next.js 16 async params — `type RouteContext = { params: Promise<{ id: string }> }` with `await params`.
5. UUID regex validation on [id] param — full RFC 4122 UUID pattern check before DB query.

## Deviations from Plan

None — plan executed exactly as written. All patterns from /api/messages were followed consistently.

## Verification

- `npx tsc --noEmit`: Exits 0 (no type errors)
- `npm run lint`: No errors on all three route files
- `npm run build`: Full build succeeds
- All three route files exist with correct exports
- Grep for "23505": Confirmed in glossary POST and PUT
- Grep for "verifyOrigin": Confirmed on all 5 mutation handlers (POST resources, DELETE resources, POST glossary, PUT glossary/[id], DELETE glossary/[id])
- Grep for "checkRateLimit": Confirmed on all mutations, absent from GET handlers

## Self-Check: PASSED

- FOUND: src/app/api/resources/route.ts
- FOUND: src/app/api/glossary/route.ts
- FOUND: src/app/api/glossary/[id]/route.ts
- FOUND commit: 7d3c940 (Task 1)
- FOUND commit: 577b2bc (Task 2)
