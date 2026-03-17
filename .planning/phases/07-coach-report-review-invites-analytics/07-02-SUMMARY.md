---
phase: 07-coach-report-review-invites-analytics
plan: 02
subsystem: api, ui
tags: [supabase, nextjs, typescript, invites, magic-links, clipboard]

# Dependency graph
requires:
  - phase: 06-coach-dashboard-student-views
    provides: Coach dashboard patterns — requireRole, createAdminClient, stat cards, parallel fetch
  - phase: 01-foundation
    provides: invites and magic_links DB tables with RLS policies

provides:
  - POST /api/invites — email invite with 72h expiry and auto coach_id assignment
  - POST /api/magic-links — unlimited-use shareable magic link generator
  - PATCH /api/magic-links?id=X — toggle is_active for deactivation/reactivation
  - /coach/invites page — stat cards + tabbed UI for invite management
  - CoachInvitesClient — copy-to-clipboard, invite history, magic link toggle

affects:
  - 02-authentication-access (register flow consumes invite codes and magic codes)
  - 07-03-analytics (invite stats feed analytics)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Manual auth pattern extended to new API routes (createClient + admin profile lookup + role check)
    - Optimistic UI update for toggle operations with automatic revert on error

key-files:
  created:
    - src/app/api/invites/route.ts
    - src/app/api/magic-links/route.ts
    - src/app/(dashboard)/coach/invites/page.tsx
    - src/components/coach/CoachInvitesClient.tsx
  modified: []

key-decisions:
  - "POST /api/magic-links uses no request body — coaches can generate links with a single click, no configuration needed"
  - "Magic link code uses crypto.getRandomValues with a curated charset (no ambiguous chars like 0/O, 1/l) for shareable URLs"
  - "Ownership check for PATCH reads magic_links.created_by before update — defense-in-depth on top of RLS"
  - "CoachInvitesClient uses optimistic update for toggle with revert on error — immediate feedback without waiting for server"
  - "lastUrl state persists until tab switch — coach can see generated URL until they switch tabs"

patterns-established:
  - "Tabbed form in client component with shared lastUrl state for clipboard display"
  - "Optimistic toggle: update state immediately, revert on error, toast on both outcomes"

requirements-completed: [COACH-05]

# Metrics
duration: 12min
completed: 2026-03-17
---

# Phase 07 Plan 02: Coach Invite System Summary

**Coach invite system with email invites (72h expiry + auto coach_id), magic links (reusable shareable URLs), clipboard copy, and full history with status badges and deactivation toggle**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-17T12:42:34Z
- **Completed:** 2026-03-17T12:54:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /api/invites creates 72-hour email invites with coach_id auto-set so students are assigned to the creating coach on registration
- POST /api/magic-links generates reusable 8-character codes (curated charset, no ambiguous chars) with no expiry and unlimited uses by default
- PATCH /api/magic-links?id=X toggles is_active with ownership verification (coach can only deactivate their own links)
- /coach/invites page with 4 stat cards (Total Invites, Used, Active Links, Expired/Inactive) and full tabbed UI
- CoachInvitesClient with clipboard copy, invite history (Used/Expired/Active badges), magic link history with Deactivate/Reactivate toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST /api/invites and POST+PATCH /api/magic-links API routes** - `fde0578` (feat)
2. **Task 2: Build coach invite page with CoachInvitesClient** - `493fd78` (feat)

**Plan metadata:** (created below in final commit)

## Files Created/Modified
- `src/app/api/invites/route.ts` - POST handler: email invite with code, 72h expiry, coach_id auto-set
- `src/app/api/magic-links/route.ts` - POST handler: magic link generator; PATCH handler: ownership-checked is_active toggle
- `src/app/(dashboard)/coach/invites/page.tsx` - Server component with requireRole("coach"), parallel DB fetch, 4 stat cards
- `src/components/coach/CoachInvitesClient.tsx` - Client component: tabbed email/magic UI, clipboard copy, history lists with status badges

## Decisions Made
- POST /api/magic-links accepts empty body (no email, no config) — single-click generation; simpler UX for coaches
- Magic code charset excludes ambiguous chars (0/O, I/l, 1) to prevent copy errors when sharing verbally or via screenshots
- Ownership check for PATCH reads `created_by` before update as defense-in-depth on top of RLS policies
- Optimistic UI update for magic link toggle gives immediate feedback; reverts state automatically on API error
- `lastUrl` state is reset on tab switch — prevents confusion when switching between email invite and magic link tabs

## Deviations from Plan

None - plan executed exactly as written.

The only deviation was fixing an ESLint warning (`_request` unused variable) in POST /api/magic-links by removing the unused parameter from the signature — this is a trivial cleanup, not a plan deviation.

## Issues Encountered
- Pre-existing TypeScript error from plan 07-01 (CoachReportsClient + reports page type mismatch on `submitted_at`) appeared on first `tsc --noEmit` run but resolved on second run — likely a TypeScript server cache issue. Build verified clean.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Coach invite system fully functional; coaches can generate and share invite links
- Register page (Phase 02) already consumes `?code=` and `?magic=` query params per existing auth flow
- Plan 07-03 (analytics) can read invites/magic_links tables for usage stats

---
*Phase: 07-coach-report-review-invites-analytics*
*Completed: 2026-03-17*
