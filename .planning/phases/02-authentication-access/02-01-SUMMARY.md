---
phase: 02-authentication-access
plan: 01
subsystem: auth
tags: [oauth, callback, session, supabase, invite, magic-link, roadmap-seeding]
dependency_graph:
  requires:
    - 01-foundation (supabase clients, config, types)
  provides:
    - OAuth callback handler for all registration flows
    - getSessionUser() and requireRole() for server components
  affects:
    - All server components needing auth (uses session.ts)
    - Register pages (consume callback route)
    - Dashboard layout (can migrate to getSessionUser)
tech_stack:
  added: []
  patterns:
    - Optimistic locking for magic link slot claiming (.eq("use_count", current) in update)
    - Atomic invite consumption (.eq("used", false) in update)
    - Admin client bypasses RLS for reliable auth callback operations
    - Server-verified auth via getUser() not getSession()
key_files:
  created:
    - src/app/api/auth/callback/route.ts
    - src/lib/session.ts
  modified: []
decisions:
  - No last_active_at updates — V1 schema lacks this column; updated_at is auto-set by DB trigger
  - No revalidateTag — no caching infrastructure in V1
  - requireRole redirects to user's own dashboard (not /no-access) for friendlier UX
  - Admin client used throughout callback — bypasses RLS, avoids get_user_role() failures during session establishment
metrics:
  duration: 3 min
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 2 Plan 1: OAuth Callback Route and Session Helper Summary

OAuth callback handler with multi-path registration (invite/magic link/returning user) and typed session helper using admin client for reliable profile lookup.

## What Was Built

### Task 1: OAuth Callback Route (`src/app/api/auth/callback/route.ts`)

The central auth brain handling all authentication flows:

1. **Returning user** — auth_id match redirects to role dashboard immediately (no last_active_at update needed; DB trigger handles updated_at)
2. **Email linking** — pre-created profiles (null auth_id) get linked on first OAuth sign-in
3. **Invite registration** — atomic consume prevents race conditions; user created with invite role/coach_id; invite rollback on failure
4. **Magic link registration** — optimistic lock on use_count prevents overselling slots; existing-email check with use_count rollback; creator coach_id assignment for students
5. **Student roadmap seeding** — 10 rows inserted at registration (step 1 completed, step 2 active, steps 3-10 locked)
6. **No profile, no code** — redirects to /no-access

V1 schema compliance enforced: zero `last_active_at` references, zero `revalidateTag` calls.

### Task 2: Session Helper (`src/lib/session.ts`)

Two exports for server components:

- `getSessionUser()` — exchanges Supabase auth token for typed SessionUser; redirects /login (no user) or /no-access (no profile); uses admin client for reliable RLS bypass
- `requireRole(allowed)` — wraps getSessionUser with role enforcement; redirects to user's own dashboard on mismatch (friendly UX)

Type `SessionUser` maps snake_case DB fields to camelCase at the boundary (auth_id → authId, coach_id → coachId).

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Issues Discovered (Out of Scope)

The `register/page.tsx` and `register/[code]/page.tsx` files (committed in a prior session as `feat(02-02)`) import `MagicLinkCard` and `RegisterCard` client components that have not yet been created. These TS errors are pre-existing and outside this plan's scope — they belong to plan 02-02 (register UI).

## Verification

- `src/app/api/auth/callback/route.ts` — exports `GET`, imports `createAdminClient`, `createClient`, `ROLE_REDIRECTS`, `ROADMAP_STEPS`, `VALIDATION`, no `last_active_at`, no `revalidateTag`, atomic invite consume, optimistic lock, roadmap seeding, rollback logic
- `src/lib/session.ts` — exports `SessionUser`, `getSessionUser`, `requireRole`; uses `getUser()` not `getSession()`; admin client for profile; [session] error prefix
- TypeScript: 0 errors in new files (`npx tsc --noEmit` clean for both files)

## Self-Check: PASSED

- `src/app/api/auth/callback/route.ts` — FOUND
- `src/lib/session.ts` — FOUND
- Commit `478f35c` — FOUND (feat(02-01): create OAuth callback route handler)
- Commit `0cc15ca` — FOUND (feat(02-01): create session helper utility)
