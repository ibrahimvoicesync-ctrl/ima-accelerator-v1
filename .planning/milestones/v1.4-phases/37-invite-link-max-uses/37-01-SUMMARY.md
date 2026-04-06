---
phase: 37-invite-link-max-uses
plan: 01
subsystem: api
tags: [zod, postgres, supabase, magic-links, invite]

# Dependency graph
requires:
  - phase: 30-database-schema-foundation
    provides: magic_links table with max_uses column (number | null)
provides:
  - Migration 00019 sets DEFAULT 10 on magic_links.max_uses (no backfill)
  - POST /api/magic-links accepts optional max_uses (1-10000, default 10) via consolidated Zod postSchema
affects:
  - 37-02-invite-link-max-uses (UI plan that reads max_uses from API response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consolidated postSchema: single z.object parsing both role + max_uses instead of sequential roleSchema + manual extraction"
    - "Grandfathered nulls: ALTER DEFAULT does not backfill — existing null rows remain unlimited"

key-files:
  created:
    - supabase/migrations/00019_magic_links_default.sql
  modified:
    - src/app/api/magic-links/route.ts

key-decisions:
  - "D-05 honored: migration uses ALTER DEFAULT only, no UPDATE — existing null-max_uses rows remain grandfathered as unlimited"
  - "postSchema default 10 enforces D-13 (invite link default max_uses = 10) at application layer; DB DEFAULT 10 provides defense in depth"
  - "Invalid max_uses (0, 10001, non-integer) now return 400 with Zod issue message — previously ignored silently"

patterns-established:
  - "Consolidated body schema: combine all POST body fields into one postSchema z.object rather than parsing role separately, then max_uses separately"

requirements-completed: [INVITE-01, INVITE-03]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 37 Plan 01: Invite Link Max Uses — DB Default + API Schema Summary

**Migration 00019 sets DEFAULT 10 on magic_links.max_uses; POST /api/magic-links consolidated to single Zod postSchema accepting role + max_uses (1-10000, default 10)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T09:30:00Z
- **Completed:** 2026-04-04T09:38:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created migration 00019 with a single ALTER DEFAULT statement — no UPDATE, existing null rows grandfathered as unlimited (D-05)
- Replaced the old separate roleSchema + try/catch body parsing with a consolidated postSchema that validates both role and max_uses in one safeParse call
- Insert block now passes maxUses (default 10) to the DB instead of null — satisfies D-13

## Task Commits

1. **Task 1: Create migration 00019 and update POST /api/magic-links** - `9847cca` (feat)

**Plan metadata:** pending final commit (docs)

## Files Created/Modified
- `supabase/migrations/00019_magic_links_default.sql` - Single ALTER TABLE statement setting DEFAULT 10 on magic_links.max_uses
- `src/app/api/magic-links/route.ts` - Added postSchema (role + max_uses 1-10000 default 10), replaced roleSchema try/catch with single safeParse, insert uses maxUses variable

## Decisions Made
- Honored D-05: migration is ALTER DEFAULT only — no UPDATE or backfill. Existing null rows remain as unlimited links (grandfathered behavior).
- postSchema placed next to existing patchSchema for consistency (both near top of file, before handler functions).
- safeParse failure now returns 400 with Zod issue message — previously the old code silently ignored validation failures and used the default.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — migration must be applied to Supabase (owner's responsibility, same as all prior migrations).

## Next Phase Readiness
- Plan 01 complete. Migration 00019 and API update are ready.
- Plan 02 (UI) can now build on the max_uses field being reliably set on every new link.
- No blockers.

---
*Phase: 37-invite-link-max-uses*
*Completed: 2026-04-04*
