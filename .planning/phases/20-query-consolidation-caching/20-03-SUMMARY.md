---
phase: 20-query-consolidation-caching
plan: "03"
subsystem: database
tags: [supabase, rpc, query-consolidation, student-detail, coach, owner]

# Dependency graph
requires:
  - phase: 20-query-consolidation-caching/plan-01
    provides: get_student_detail RPC function, StudentDetailResult type in src/lib/rpc/types.ts
provides:
  - Coach student detail page using single get_student_detail RPC (9 queries → 1)
  - Owner student detail page using single get_student_detail RPC (11 queries → 1)
affects: [20-query-consolidation-caching]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cast admin client to any for unregistered RPC calls (get_student_detail not yet in generated types)"
    - "Cast roadmap status string to union type for component prop compatibility"
    - "Derive all KPI values (lifetime_outreach, today_outreach, today_minutes_worked) directly from RPC result"
    - "Fallback to empty shape when RPC returns null/error to prevent render crashes"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx

key-decisions:
  - "Use (admin as any).rpc() to bypass TypeScript RPC registry until supabase gen types regenerated with new functions"
  - "Cast detailData as unknown as StudentDetailResult for safe type narrowing from unregistered RPC response"
  - "Cast roadmap array status field to 'locked' | 'active' | 'completed' union to satisfy StudentDetailClient prop type"

patterns-established:
  - "Pattern: defense-in-depth student ownership check (.eq('coach_id', user.id) or .eq('role', 'student')) stays as a separate pre-RPC query even after consolidation"
  - "Pattern: RPC fallback object prevents null dereference on error — shape must match StudentDetailResult zero-value"

requirements-completed: [QUERY-02, QUERY-03]

# Metrics
duration: 10min
completed: 2026-03-30
---

# Phase 20 Plan 03: Student Detail RPC Consolidation Summary

**Coach and owner student detail pages consolidated from 9-query and 11-query Promise.all blocks to a single get_student_detail RPC call each, with identical props passed to client components**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T07:00:00Z
- **Completed:** 2026-03-30T07:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Coach student detail page: 9 parallel Supabase queries eliminated, replaced with `admin.rpc("get_student_detail", { p_include_coach_mgmt: false })`
- Owner student detail page: 11 parallel Supabase queries eliminated, replaced with `admin.rpc("get_student_detail", { p_include_coach_mgmt: true })`
- Defense-in-depth checks preserved on both pages (coach: `.eq("coach_id", user.id)`, owner: `.eq("role", "student")`)
- All props to `StudentDetailClient` and `OwnerStudentDetailClient` remain identical — no UI regression
- KPI derivation (lifetime outreach, daily outreach, daily minutes worked) now uses RPC-provided aggregates directly
- At-risk computation uses RPC-provided `latest_session_date`, `latest_report_date`, and `recent_ratings[]`
- TypeScript check and production build pass with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite coach student detail page to use RPC** - `d2e7eb0` (feat)
2. **Task 2: Rewrite owner student detail page to use RPC** - `ebf2f01` (feat)

## Files Created/Modified
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` - Replaced 9-query Promise.all with single RPC call (p_include_coach_mgmt: false)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` - Replaced 11-query Promise.all with single RPC call (p_include_coach_mgmt: true)

## Decisions Made
- Used `(admin as any).rpc()` cast because `get_student_detail` is not yet registered in the hand-crafted `src/lib/types.ts` (generated types not yet regenerated from local Supabase). This is intentional — the types file is a placeholder until `npx supabase gen types` runs.
- Used `detailData as unknown as StudentDetailResult` (double cast through unknown) rather than direct cast to satisfy TypeScript's overlap check.
- Cast `detail.roadmap` array's status field to the narrow union type `"locked" | "active" | "completed"` because `StudentDetailResult` uses `string` (to avoid over-constraining the RPC return type) while the client component prop requires the union.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors for unregistered RPC call and narrow status type**
- **Found during:** Task 1 (Rewrite coach student detail page)
- **Issue:** `admin.rpc("get_student_detail")` fails TypeScript because `get_student_detail` is not in the generated types. Also `detailData as StudentDetailResult` fails because `string | null` doesn't overlap with `StudentDetailResult`. Also `roadmap` status prop type mismatch (`string` vs `"locked" | "active" | "completed"`).
- **Fix:** Cast admin to `any` for RPC call; use double cast `as unknown as StudentDetailResult`; cast roadmap array inline to union status type.
- **Files modified:** `src/app/(dashboard)/coach/students/[studentId]/page.tsx`, `src/app/(dashboard)/owner/students/[studentId]/page.tsx`
- **Verification:** `npx tsc --noEmit` exits 0, `npm run build` succeeds.
- **Committed in:** `d2e7eb0` (Task 1), `ebf2f01` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: TypeScript type compatibility with unregistered RPC)
**Impact on plan:** Required fix for TypeScript strict mode. No scope creep. Same cast pattern will be needed for any RPC added before types are regenerated.

## Issues Encountered
- The worktree was behind master (did not have Plan 01 changes — `src/lib/rpc/types.ts`). Rebased onto master before execution to obtain the `StudentDetailResult` type. No conflict.

## Known Stubs
None — both pages are fully wired to the RPC. No placeholder data or hardcoded values.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Both student detail pages now use the consolidated RPC — down from 9+11 = 20 round trips to 2 RPC calls
- The `get_student_detail` RPC was created in Plan 01's migration `00010_query_consolidation.sql`
- Ready for Plan 04 (pagination) or Plan 05 (React cache/revalidation)
- Note: `src/lib/types.ts` still doesn't include `get_student_detail` — regenerate types when local Supabase is running

---
*Phase: 20-query-consolidation-caching*
*Completed: 2026-03-30*
