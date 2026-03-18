---
phase: 01-foundation
plan: 03
subsystem: ui
tags: [nextjs, tailwind, supabase, config, routing, sidebar, framer-motion]

# Dependency graph
requires:
  - phase: 01-foundation/01-02
    provides: "createAdminClient(), createClient() server/browser, Database types, 6-table schema"
  - phase: 01-foundation/01-01
    provides: "Next.js scaffold, Tailwind v4 with ima-* tokens, path aliases, cn() utility"
provides:
  - "src/lib/config.ts: single source of truth for all V1 constants (roles, routes, navigation, roadmap, work tracker, daily report, coach/owner/invite/AI config, theme, validation)"
  - "src/proxy.ts: route guard with role-based access control, redirects unauthenticated to /login and wrong-role to correct dashboard"
  - "src/app/(dashboard)/layout.tsx: dashboard shell with auth guard and Sidebar"
  - "src/components/layout/Sidebar.tsx: collapsible sidebar with V1 navigation, separators, badge support, accessibility"
  - "Auth pages: /login and /no-access placeholders"
  - "Role placeholder dashboards: /owner, /coach, /student"
affects: [phases 2-10 — every feature page renders inside this layout, imports from config.ts, and is protected by proxy.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "config.ts as single source of truth — all roles, routes, navigation, and constants imported from here; never hardcoded"
    - "proxy.ts pattern — Next.js 16 route guard (not middleware.ts); uses createServerClient for session refresh, inline createClient with service-role key for role lookups"
    - "NavItem with separator and badge fields — render dividers and badge pills in Sidebar based on config metadata"
    - "Dashboard layout server component pattern — fetches profile via admin client, validates role, passes to Sidebar"
    - "Sidebar accessibility pattern — focus trap, Escape key, body scroll lock, skip-to-content, aria-label, aria-current, min-h-[44px], aria-hidden on icons"

key-files:
  created:
    - src/lib/config.ts
    - src/proxy.ts
    - src/app/(dashboard)/layout.tsx
    - src/components/layout/Sidebar.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/no-access/page.tsx
    - src/app/(dashboard)/owner/page.tsx
    - src/app/(dashboard)/coach/page.tsx
    - src/app/(dashboard)/student/page.tsx
  modified: []

key-decisions:
  - "NavItem type has separator and badge fields — separators render dividers before items, badges render placeholder pills until server data is wired in later phases"
  - "proxy.ts uses inline createClient (not createAdminClient wrapper) because proxy.ts cannot use server-only import guard — it runs in middleware-like context"
  - "V1 navigation: owner 6 items with separator before Invites, coach 5 items with separator before Invite Students + badge on Reports, student 5 items with Ask Abu Lahya at 4th position"
  - "Sidebar avatar uses from-ima-primary to-ima-secondary gradient (V1 tokens only, no brand-gold or warm-* tokens)"
  - "No Settings link in Sidebar — V1 has no settings pages; no FEATURES filter — V1 has no feature flags"

patterns-established:
  - "Pattern: All colors use ima-* tokens, never hardcoded hex/gray"
  - "Pattern: motion-safe: prefix on all animated transitions"
  - "Pattern: min-h-[44px] on all interactive elements"
  - "Pattern: aria-hidden on decorative icons, aria-label on interactive elements"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 1 Plan 03: Config, Proxy, and Dashboard Shell Summary

**V1 config.ts (15 constants, no V2 sections), proxy.ts role-based route guard, collapsible Sidebar with separator/badge nav, and placeholder pages for all three roles — npm build passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T15:12:17Z
- **Completed:** 2026-03-16T15:16:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- config.ts is the single source of truth: exports all V1 constants (APP_CONFIG, ROLES, Role type, ROUTES, ROLE_REDIRECTS, AUTH_CONFIG, WORK_TRACKER, ROADMAP_STEPS, DAILY_REPORT, COACH_CONFIG, OWNER_CONFIG, INVITE_CONFIG, AI_CONFIG, THEME, NAVIGATION with NavItem type, VALIDATION) with no V2 sections
- proxy.ts guards all non-static, non-API routes: unauthenticated visitors redirect to /login, wrong-role visitors redirect to their correct dashboard; uses service-role client for RLS-bypass role lookups
- Dashboard layout shell fetches user profile via admin client and renders Sidebar with role and userName; full accessibility: skip-to-content, focus trap, Escape key, body scroll lock, ARIA attributes, 44px touch targets, motion-safe animations
- All placeholder pages compile and render: login, no-access, owner dashboard, coach dashboard, student dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create V1 config.ts and proxy.ts route guard** - `daedbdd` (feat)
2. **Task 2: Create dashboard layout shell with Sidebar, auth pages, and role placeholder pages** - `4e7a5f0` (feat)

## Files Created/Modified

- `src/lib/config.ts` - Single source of truth: all V1 constants, NavItem type with separator/badge fields, NAVIGATION with V1 routes and separators, ROADMAP_STEPS (10 steps), default export aggregates all
- `src/proxy.ts` - Route guard: session refresh via createServerClient, role lookup via inline createClient with service-role key, redirects unauthenticated to /login and wrong-role to dashboard
- `src/app/(dashboard)/layout.tsx` - Dashboard layout shell: auth guard, admin client profile fetch, role validation, Sidebar + main content area
- `src/components/layout/Sidebar.tsx` - Collapsible sidebar: mobile overlay with AnimatePresence, focus trap, Escape key, body scroll lock, skip-to-content, separator dividers, badge placeholder pills, animated active indicator, 44px touch targets
- `src/app/(auth)/login/page.tsx` - Login placeholder page
- `src/app/(auth)/no-access/page.tsx` - No-access page with 44px CTA button
- `src/app/(dashboard)/owner/page.tsx` - Owner dashboard placeholder
- `src/app/(dashboard)/coach/page.tsx` - Coach dashboard placeholder
- `src/app/(dashboard)/student/page.tsx` - Student dashboard placeholder

## Decisions Made

- proxy.ts uses inline `createClient` from `@supabase/supabase-js` (not the createAdminClient wrapper) because proxy.ts cannot use the `server-only` import guard — it runs in a middleware-like context where that guard would throw
- NavItem type exposes `separator?: boolean` and `badge?: string` fields so Sidebar renders dividers and badge pills driven purely by config metadata, not hardcoded component logic
- Sidebar badge shows `(badge)` placeholder text; actual count will be passed as a prop from layout in a later phase when report counts are wired
- Avatar gradient uses `from-ima-primary to-ima-secondary` — the V1 token set does not include brand-gold or warm-* tokens

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- All foundation infrastructure is complete: scaffold (01-01), database + clients (01-02), config + proxy + layout (01-03)
- Phase 2 can begin implementing Google OAuth auth flow using the auth pages, proxy.ts route guard, and admin client already in place
- The proxy.ts `config.matcher` already excludes `/api/` routes so auth callback handlers in `/api/auth/callback` will work without going through the proxy

---
*Phase: 01-foundation*
*Completed: 2026-03-16*
