---
phase: 02-authentication-access
plan: 03
subsystem: auth
tags: [supabase, next.js, server-components, session, role-enforcement]

# Dependency graph
requires:
  - phase: 02-authentication-access/02-01
    provides: session.ts with getSessionUser and requireRole helpers
provides:
  - Dashboard pages with per-page defense-in-depth auth checks and personalized greetings
  - Sign-out POST API route that clears Supabase session and redirects to /login
affects: [03-work-tracker, 04-roadmap, 05-ai-assistant, 06-daily-report, 07-coach-dashboard, 08-owner-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async Server Component pattern: export default async function, no 'use client'"
    - "Defense-in-depth auth: layout.tsx handles layout-level check, page.tsx uses getSessionUser/requireRole"
    - "Sign-out via POST to prevent CSRF, always redirects regardless of error"

key-files:
  created:
    - src/app/api/auth/signout/route.ts
  modified:
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/coach/page.tsx
    - src/app/(dashboard)/owner/page.tsx

key-decisions:
  - "Sign-out always redirects to /login even if signOut() errors — user intent is to leave"
  - "Per-page auth is defense-in-depth only — proxy.ts and layout.tsx already guard routes"

patterns-established:
  - "Dashboard page pattern: async Server Component calling getSessionUser/requireRole at top, returns JSX with user.name"
  - "Sign-out pattern: POST method, SSR client, log error but don't block redirect"

requirements-completed: [AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 1min
completed: 2026-03-16
---

# Phase 2 Plan 03: Dashboard Auth Wiring & Sign-out Summary

**Per-page auth enforcement wired into three dashboard Server Components via getSessionUser/requireRole, plus a CSRF-safe POST sign-out route that clears the Supabase session**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-16T16:58:57Z
- **Completed:** 2026-03-16T16:59:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Upgraded student, coach, and owner dashboard pages from static placeholders to async Server Components with real auth checks
- Student page uses `getSessionUser()` and displays personalized `user.name` greeting
- Coach and owner pages use `requireRole()` for role-based defense-in-depth (non-coaches/owners are redirected to their own dashboard)
- Created sign-out POST route that clears Supabase session cookies and redirects to /login with graceful error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire auth checks into dashboard pages** - `eefda54` (feat)
2. **Task 2: Create sign-out API route** - `74a8064` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(dashboard)/student/page.tsx` - Async Server Component using getSessionUser(), displays welcome greeting
- `src/app/(dashboard)/coach/page.tsx` - Async Server Component using requireRole("coach"), displays welcome greeting
- `src/app/(dashboard)/owner/page.tsx` - Async Server Component using requireRole("owner"), displays welcome greeting
- `src/app/api/auth/signout/route.ts` - POST route that calls supabase.auth.signOut() and redirects to /login

## Decisions Made

- Sign-out route always redirects to /login even when signOut() errors — the user's intent is to leave, blocking them would be poor UX
- Per-page auth is explicitly defense-in-depth — proxy.ts protects at route level, layout.tsx provides additional layer, page.tsx is the third layer; each layer also provides the SessionUser object pages need for personalization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three dashboard pages now display personalized greetings from the database profile
- Sign-out endpoint ready for Sidebar sign-out button to call (POST /api/auth/signout)
- Defense-in-depth auth chain complete: proxy.ts -> layout.tsx -> page.tsx
- Ready for Phase 3-5 feature content to be added to student/coach/owner pages

---
*Phase: 02-authentication-access*
*Completed: 2026-03-16*
