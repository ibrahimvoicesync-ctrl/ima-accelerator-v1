---
phase: 27-coach-owner-roadmap-undo
plan: 01
subsystem: api
tags: [supabase, nextjs, typescript, roadmap, undo, audit-log, rate-limit, csrf]

# Dependency graph
requires:
  - phase: 26-database-schema-foundation
    provides: roadmap_undo_log and daily_plans tables with RLS and indexes
  - phase: 22-spike-protection-rate-limiting
    provides: checkRateLimit helper used on this endpoint
  - phase: 23-security-audit
    provides: verifyOrigin CSRF helper used on this endpoint

provides:
  - PATCH /api/roadmap/undo — coach/owner endpoint to revert completed roadmap steps with cascade re-lock and audit logging

affects: [27-02, phase-28-daily-session-planner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth chain order: CSRF -> auth -> profile -> role guard -> rate limit -> JSON parse -> Zod -> ownership -> logic"
    - "Cascade re-lock: .eq('status','active') guard on N+1 prevents re-locking already-completed steps"
    - "Append-only audit: INSERT to roadmap_undo_log, never UPDATE/DELETE"

key-files:
  created:
    - src/app/api/roadmap/undo/route.ts
  modified:
    - src/lib/types.ts

key-decisions:
  - "Cascade re-lock guards against completed N+1 steps using .eq('status','active') — only active steps are re-locked"
  - "Coach ownership enforced at application layer (coach_id check) in addition to Zod and RLS"
  - "Audit log inserted after successful revert — ensures log only records actual state changes"

patterns-established:
  - "Coach undo pattern: fetch student with coach_id, compare to profile.id before mutation"
  - "Cascade: update N+1 in same request with status filter guard to prevent double-reverting"

requirements-completed: [UNDO-01, UNDO-02, UNDO-04]

# Metrics
duration: 8min
completed: 2026-03-31
---

# Phase 27 Plan 01: PATCH /api/roadmap/undo — Coach/Owner Cascade Revert with Audit Log

**PATCH /api/roadmap/undo endpoint with role-guarded ownership check, cascade re-lock of active N+1 step, and append-only audit logging to roadmap_undo_log**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-31T07:27:00Z
- **Completed:** 2026-03-31T07:35:01Z
- **Tasks:** 1 of 1
- **Files modified:** 2

## Accomplishments

- Created PATCH /api/roadmap/undo following the full CSRF -> auth -> role -> rate-limit -> Zod -> ownership -> revert -> cascade -> audit chain
- Coach/owner role guard with coach-specific ownership check (coach may only undo assigned students, owner unrestricted)
- Cascade re-lock safely skips N+1 if it is already completed — only active steps get re-locked

## Task Commits

1. **Task 1: Create PATCH /api/roadmap/undo route with cascade re-lock and audit logging** — `d7b2876` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/app/api/roadmap/undo/route.ts` — PATCH endpoint: CSRF, auth, coach/owner role guard, ownership, revert step N, cascade re-lock N+1, roadmap_undo_log INSERT
- `src/lib/types.ts` — Added daily_plans and roadmap_undo_log table types (Phase 26 migration 00013 was not reflected in the hand-crafted placeholder)

## Decisions Made

- Cascade uses `.eq("status", "active")` guard so that completing N+1 before undo does not cause data loss (completed steps stay completed)
- Audit log INSERT placed after successful revert — guarantees log only records actual state transitions
- Types for roadmap_undo_log and daily_plans added inline to existing hand-crafted types.ts (regenerate from local Supabase when Docker is available)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical types] Added daily_plans and roadmap_undo_log to src/lib/types.ts**
- **Found during:** Task 1 (creating route.ts — TypeScript error TS2769 on `admin.from("roadmap_undo_log").insert(...)`)
- **Issue:** types.ts is a hand-crafted placeholder (noted as such in file header). Migration 00013 added two new tables but the placeholder was not updated, making the admin client's `.from()` calls for these tables infer `never` for their Insert type.
- **Fix:** Added complete Row/Insert/Update/Relationships type definitions for both `daily_plans` and `roadmap_undo_log` tables matching the 00013 migration schema.
- **Files modified:** src/lib/types.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** d7b2876 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical types)
**Impact on plan:** Essential for TypeScript correctness. types.ts is explicitly a placeholder (comment in file header instructs regeneration from local Supabase). Update is a faithful reflection of the 00013 migration schema. No scope creep.

## Issues Encountered

Pre-existing ESLint errors in unrelated files (owner student page, loading.tsx, CalendarTab.tsx, WorkTrackerClient.tsx) — out of scope, not introduced by this plan, logged as deferred items.

## Known Stubs

None — this plan creates a pure API route with no UI rendering or data stubs.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PATCH /api/roadmap/undo is production-ready and type-safe
- Plan 02 (coach/owner UI confirmation dialog + undo button wiring) can proceed immediately
- No blockers

---
*Phase: 27-coach-owner-roadmap-undo*
*Completed: 2026-03-31*
