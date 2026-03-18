---
phase: 11-fix-invite-registration-url
plan: "02"
subsystem: auth
tags: [supabase, invite, whitelist, google-oauth, registration]

# Dependency graph
requires:
  - phase: 02-authentication-access
    provides: Auth callback route with invite_code and magic_code branches as template
  - phase: 11-fix-invite-registration-url
    provides: 11-01 — context and debug analysis for invite whitelist architecture

provides:
  - Whitelist-based auto-registration: users sign in via Google OAuth and are auto-registered if their email matches an unexpired unused invite
  - Case-insensitive email whitelist lookup using .ilike() in auth callback
  - Email normalization (toLowerCase) in POST /api/invites before DB insertion
  - POST /api/invites no longer returns registerUrl in its response

affects: [invites, registration, auth-callback, coach-invites, owner-invites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist lookup pattern: .ilike().eq('used',false).gt('expires_at',...).order('created_at',{ascending:false}).limit(1).maybeSingle() for email-based invite matching"
    - "Atomic invite consumption: update.eq(id).eq(used,false) with rollback on user insert failure"
    - "wl* variable prefix to avoid shadowing invite_code branch variables in same function scope"

key-files:
  created: []
  modified:
    - src/app/api/auth/callback/route.ts
    - src/app/api/invites/route.ts

key-decisions:
  - "Use .ilike() not .eq(email.toLowerCase()) — Postgres = is case-sensitive; ILIKE handles legacy mixed-case invites without requiring data migration"
  - "order by created_at DESC + limit 1 — picks most recent whitelist invite when multiple exist for same email, consistent behavior"
  - "Rollback pattern for whitelist: mirrors invite_code branch exactly — used: false on failed user insert, with CRITICAL log if rollback also fails"
  - "Lowercase normalization in POST /api/invites is defense-in-depth alongside ilike lookup — new invites stored clean, legacy invites still found via ilike"
  - "registerUrl removed entirely — invite-only model is whitelist, not link-based; the code column preserved for audit and /register/[code] fallback"

patterns-established:
  - "Whitelist lookup always uses .ilike() for email matching (never .eq with .toLowerCase()) to handle legacy mixed-case stored values"
  - "All new invites stored with normalized lowercase email via POST /api/invites"

requirements-completed: [COACH-05, OWNER-06]

# Metrics
duration: 1min
completed: "2026-03-18"
---

# Phase 11 Plan 02: Invite Whitelist Auto-Registration Summary

**Whitelist-based Google OAuth auto-registration added to auth callback using case-insensitive .ilike() email matching, invite email normalized to lowercase in POST /api/invites, and registerUrl removed from invite API response.**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T14:58:31Z
- **Completed:** 2026-03-18T14:59:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Auth callback now checks for an unexpired unused invite matching user.email BEFORE redirecting to /no-access, enabling pure whitelist registration via normal Google sign-in
- Whitelist lookup uses .ilike() for case-insensitive email matching — handles legacy mixed-case invites without requiring a data migration
- Atomic invite consumption (eq id + eq used=false) with rollback on user insert failure, matching the existing invite_code branch pattern exactly
- Roadmap seeding for students on whitelist auto-registration, matching invite_code and magic_code branches
- POST /api/invites normalizes email to lowercase before existing-user check and DB insertion, providing defense-in-depth alongside the ilike lookup
- registerUrl removed from invite API response — invites are now a pure whitelist, not link distribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Add whitelist lookup to auth callback before /no-access redirect** - `3b80edc` (feat)
2. **Task 2: Normalize invite email to lowercase and remove registerUrl from POST /api/invites** - `1109f2a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/api/auth/callback/route.ts` - Added whitelist invite lookup code path before final /no-access redirect (107 lines inserted)
- `src/app/api/invites/route.ts` - Email normalized to lowercase, APP_CONFIG import removed, registerUrl generation and response field removed

## Decisions Made
- Used `.ilike("email", user.email)` instead of `.eq("email", user.email.toLowerCase())` — Postgres `=` is case-sensitive so `.eq` would miss invites stored as "User@Example.com" when Google returns "user@example.com"; `.ilike` maps to Postgres ILIKE which is case-insensitive
- Added `.order("created_at", { ascending: false }).limit(1)` to select most recent invite if multiple exist for the same email — deterministic behavior
- Variable names prefixed with `wl` throughout whitelist block to avoid shadowing variables from the `invite_code` branch above (e.g., `wlNewUser`, `wlInsertError`, `wlRoadmapRows`)
- `code` generation preserved in POST /api/invites despite registerUrl removal — the code is still inserted into the invites table for audit trail and the existing /register/[code] fallback path remains valid

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Invite whitelist model is complete: invites created via POST /api/invites whitelist an email, user signs in via Google OAuth, auth callback auto-registers them without visiting any invite link
- The /register/[code] fallback path remains functional for any invite_code flows still in use
- Both COACH-05 and OWNER-06 requirements are fulfilled

## Self-Check: PASSED

- FOUND: src/app/api/auth/callback/route.ts
- FOUND: src/app/api/invites/route.ts
- FOUND: .planning/phases/11-fix-invite-registration-url/11-02-SUMMARY.md
- FOUND: commit 3b80edc (Task 1)
- FOUND: commit 1109f2a (Task 2)

---
*Phase: 11-fix-invite-registration-url*
*Completed: 2026-03-18*
