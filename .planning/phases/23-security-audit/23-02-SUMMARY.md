---
phase: 23-security-audit
plan: 02
subsystem: security
tags: [csrf, security, api-hardening, information-leak-fix]
dependency_graph:
  requires: [23-01]
  provides: [SEC-03]
  affects: [all mutation API routes]
tech_stack:
  added: [src/lib/csrf.ts]
  patterns: [Origin header verification, server-only import guard, CSRF before auth pattern]
key_files:
  created:
    - src/lib/csrf.ts
  modified:
    - src/app/api/reports/route.ts
    - src/app/api/reports/[id]/review/route.ts
    - src/app/api/work-sessions/route.ts
    - src/app/api/work-sessions/[id]/route.ts
    - src/app/api/roadmap/route.ts
    - src/app/api/invites/route.ts
    - src/app/api/magic-links/route.ts
    - src/app/api/assignments/route.ts
    - src/app/api/alerts/dismiss/route.ts
    - src/app/api/auth/signout/route.ts
decisions:
  - "CSRF check inserts before auth (cheapest check first: CSRF -> Auth -> Role -> RateLimit -> Body -> Zod -> Ownership -> Logic)"
  - "verifyOrigin returns NextResponse|null pattern — null means continue, response means stop"
  - "Fallback to request Host header when NEXT_PUBLIC_APP_URL is not set (prevents dev environment failures)"
  - "reports/[id]/review returns 404 for all ownership failures to prevent report-ID enumeration (FIND-05)"
  - "auth/signout CSRF-protected even though it is dead code — no cost, correct if route ever reactivated"
metrics:
  duration: "4 minutes"
  completed: "2026-03-30"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 10
requirements:
  - SEC-03
---

# Phase 23 Plan 02: CSRF Protection & Ownership Leak Fix Summary

CSRF Origin header verification added to all 11 mutation handler functions across 10 route files via shared `verifyOrigin()` helper, and the `reports/[id]/review` ownership information leak fixed to return 404 for all failure modes.

## What Was Built

### Task 1: Human Checkpoint (Pre-Approved)

The human reviewed the Phase 23 Plan 01 audit report and approved remediation of all recommended findings. Specifically:

- **FIND-01 (High):** Apply CSRF protection to all 10 mutation routes — approved
- **FIND-05 (Medium):** Fix 404 vs 403 distinction in `reports/[id]/review` — approved

### Task 2: CSRF Helper + Route Integration

**`src/lib/csrf.ts`** — new shared helper:

- `import "server-only"` — prevents accidental client-side import
- `verifyOrigin(request: Request): NextResponse | null` — synchronous, reads only headers
- Returns 403 on: missing Origin, mismatched Origin, malformed Origin URL
- Falls back to `request.headers.get("host")` when `NEXT_PUBLIC_APP_URL` is not set
- `console.error` in catch block — never swallows errors (per CLAUDE.md rule 5)

**10 route files modified** — verifyOrigin inserted as first check in every POST/PATCH handler:

| Route | Handler(s) | Position |
|-------|-----------|---------|
| `reports/route.ts` | POST | Before `createClient()` |
| `reports/[id]/review/route.ts` | PATCH | Before `createClient()` + FIND-05 fix |
| `work-sessions/route.ts` | POST | Before `createClient()` |
| `work-sessions/[id]/route.ts` | PATCH | Before `createClient()` |
| `roadmap/route.ts` | PATCH | Inside outer try block, first statement |
| `invites/route.ts` | POST | Before `createClient()` |
| `magic-links/route.ts` | POST + PATCH | Before `createClient()` in each |
| `assignments/route.ts` | PATCH | Before `createClient()` |
| `alerts/dismiss/route.ts` | POST | Before `createClient()` |
| `auth/signout/route.ts` | POST | Before `createClient()` |

**FIND-05 fix in `reports/[id]/review/route.ts`:**

Changed the ownership failure response from `{ error: "Not your student" }, status: 403` to `{ error: "Report not found" }, status: 404`. Both "report does not exist" and "report belongs to another coach's student" now return identical 404 responses, preventing a compromised coach from enumerating valid report IDs by probing UUID space.

## Final Handler Order (All Mutation Routes)

```
1. CSRF check (verifyOrigin)          ← NEW
2. Auth check (createClient -> getUser)
3. Profile + role check (admin client)
4. Rate limit check (checkRateLimit)
5. Body parse (request.json with try-catch)
6. Zod validation (safeParse)
7. Ownership verification (if ID param)
8. Business logic query
```

## Verification Results

```
grep -r "import.*verifyOrigin.*csrf" src/app/api/ | wc -l   → 10 (all 10 route files)
grep -r "verifyOrigin(request)" src/app/api/ | wc -l         → 11 (magic-links has POST + PATCH)
grep "Not your student" src/app/api/reports/[id]/review/route.ts → no match (leak fixed)
npx tsc --noEmit                                              → exit 0 (clean)
npm run build                                                 → exit 0 (34 pages compiled)
```

## Decisions Made

1. **CSRF before auth** — cheapest check first. Origin header read is synchronous and requires no DB calls. Auth requires `createClient()` + `supabase.auth.getUser()`. Running CSRF first reduces load on auth infrastructure for CSRF attack traffic.

2. **`NextResponse | null` return pattern** — null means "continue", a response means "stop and return it". This pattern avoids calling `return undefined` and keeps handler code idiomatic.

3. **Host header fallback** — `NEXT_PUBLIC_APP_URL` may not be set in local dev or test environments. Falling back to `request.headers.get("host")` ensures the CSRF check works in all environments without false 403s.

4. **404 for all ownership failures** — per security principle of uniform error responses, all failure modes in the ownership check chain return 404. This closes the information disclosure gap identified in FIND-05.

5. **Dead code route hardened** — `auth/signout/route.ts` is confirmed dead code (Info/FIND-02) but receives CSRF protection anyway. It costs nothing and ensures correctness if the route is ever reactivated.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are wired and functional.

## Self-Check: PASSED

Files verified:
- `src/lib/csrf.ts` — FOUND
- All 10 route files contain `verifyOrigin` import — VERIFIED (10 matches)
- All 11 handler calls present — VERIFIED (11 matches)
- `"Not your student"` string absent from `reports/[id]/review/route.ts` — VERIFIED
- Commit `246fb20` exists — VERIFIED
