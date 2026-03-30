---
phase: 20-query-consolidation-caching
plan: "01"
subsystem: database
tags: [postgres, rpc, supabase, react-cache, sql, typescript]

# Dependency graph
requires:
  - phase: 19-database-foundation
    provides: Composite indexes and pg_stat_statements for hot query paths
  - phase: 18-roadmap-date-kpis-completion-logging
    provides: Final table schema with all KPI columns (brands_contacted, influencers_contacted, calls_joined, session_minutes)
provides:
  - Three SECURITY DEFINER Postgres RPC functions (get_owner_dashboard_stats, get_sidebar_badges, get_student_detail) in migration 00010
  - TypeScript RPC return type definitions in src/lib/rpc/types.ts
  - React cache() wrapper on getSessionUser for per-request render-tree deduplication
affects: [20-02, 20-03, 20-04, owner-dashboard, sidebar-badges, student-detail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React cache() wrapper on getSessionUser for per-request RSC render-tree dedup
    - Postgres SECURITY DEFINER RPC functions returning JSONB for TypeScript consumption
    - Shared RPC with optional owner-only fields via boolean parameter (p_include_coach_mgmt)

key-files:
  created:
    - supabase/migrations/00010_query_consolidation.sql
    - src/lib/rpc/types.ts
  modified:
    - src/lib/session.ts

key-decisions:
  - "Single shared get_student_detail RPC with p_include_coach_mgmt boolean flag rather than separate coach/owner functions"
  - "All three RPC functions use RETURNS jsonb with jsonb_build_object for clean TypeScript consumption"
  - "get_sidebar_badges computes alert logic inline in PL/pgSQL using same thresholds as OWNER_CONFIG.alertThresholds"
  - "React cache() wraps getSessionUser at declaration (export const) so requireRole benefits automatically"

patterns-established:
  - "Pattern: RPC functions have SYNC comments documenting config.ts coupling points"
  - "Pattern: p_include_coach_mgmt boolean DEFAULT false for optional owner-only fields in shared RPCs"
  - "Pattern: export const getSessionUser = cache(async () => {...}) for per-request RSC dedup"

requirements-completed: [QUERY-01, QUERY-02, QUERY-03]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 20 Plan 01: Query Consolidation Foundation Summary

**Three Postgres RPC functions (owner dashboard stats, sidebar badges, student detail) with TypeScript types and React cache() on getSessionUser for per-request deduplication**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T06:40:14Z
- **Completed:** 2026-03-30T06:43:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `supabase/migrations/00010_query_consolidation.sql` with three `SECURITY DEFINER` Postgres RPC functions that will consolidate 8+ dashboard queries down to ≤2 round trips when consumers are swapped in subsequent plans
- Created `src/lib/rpc/types.ts` with hand-typed TypeScript interfaces (`OwnerDashboardStats`, `SidebarBadgesResult`, `StudentDetailResult`) matching the JSONB return shapes from the SQL functions
- Wrapped `getSessionUser` with React `cache()` eliminating the redundant auth call when both `layout.tsx` and a child page call `requireRole()` in the same RSC render tree

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 00010 with all three RPC functions** - `478ed96` (feat)
2. **Task 2: Create RPC types and wrap getSessionUser with React cache()** - `f8daee5` (feat)

**Plan metadata:** `(pending docs commit)` (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/00010_query_consolidation.sql` - Three SECURITY DEFINER JSONB-returning Postgres RPC functions for owner dashboard stats, sidebar badges, and student detail
- `src/lib/rpc/types.ts` - TypeScript type definitions for all three RPC return shapes
- `src/lib/session.ts` - Added `import { cache } from "react"` and wrapped `getSessionUser` with `cache()`

## Decisions Made
- Used a single shared `get_student_detail` RPC with `p_include_coach_mgmt boolean DEFAULT false` parameter rather than two separate functions — cleaner and avoids duplication of the heavy 7-query body
- All RPC functions return `RETURNS jsonb` with `jsonb_build_object` — simplest pattern for TypeScript consumption via `.rpc()` call with type cast
- `get_sidebar_badges` computes alert logic entirely in PL/pgSQL using the same threshold values as `OWNER_CONFIG.alertThresholds` in config.ts, with `-- SYNC: must match` comments documenting the coupling
- React `cache()` wraps at the `export const` declaration level so `requireRole()` — which calls `getSessionUser()` internally — automatically benefits without any changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration applies to existing Supabase instance during normal `supabase db push` workflow.

## Known Stubs
None - this plan creates SQL functions and TypeScript types only. The RPC functions are not yet called by any consumer (those swaps happen in plans 02-04). This is intentional: plan 01 is the foundation that plans 02-04 depend on.

## Next Phase Readiness
- Migration 00010 is ready for `supabase db push` — all three RPC functions will be available immediately after migration runs
- TypeScript types are ready for consumers in plans 02-04 (dashboard swap, student detail swap, pagination)
- `getSessionUser` is now cache()-wrapped — any page that calls `requireRole()` after `layout.tsx` already called it will get the cached result at zero cost
- No blockers for plans 02, 03, or 04 — all three can proceed in parallel

## Self-Check: PASSED

- FOUND: supabase/migrations/00010_query_consolidation.sql
- FOUND: src/lib/rpc/types.ts
- FOUND: src/lib/session.ts
- FOUND: .planning/phases/20-query-consolidation-caching/20-01-SUMMARY.md
- FOUND: commit 478ed96 (Task 1)
- FOUND: commit f8daee5 (Task 2)

---
*Phase: 20-query-consolidation-caching*
*Completed: 2026-03-30*
