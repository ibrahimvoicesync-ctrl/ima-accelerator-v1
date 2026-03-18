---
phase: 08-owner-stats-people-management
plan: 01
subsystem: ui
tags: [supabase, next.js, react, dashboard, stats]

# Dependency graph
requires:
  - phase: 06-coach-dashboard-student-views
    provides: StudentCard component and coach dashboard patterns
  - phase: 01-foundation
    provides: ima-* design tokens, config.ts, Card/CardContent components
provides:
  - Owner dashboard with 4 live aggregate stat cards (Total Students, Total Coaches, Active Today, Reports Today)
  - StudentCard with optional basePath prop for cross-role reuse
affects:
  - 08-02-owner-students-list (uses StudentCard with basePath="/owner/students")
  - 08-03-owner-coaches-list (uses StudentCard with basePath="/owner/coaches/[id]/students")

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Promise.all parallel queries on server components for aggregate stats
    - Distinct student count via Set.size instead of DB count (avoids inflated session counts)
    - Optional prop with default value for backward-compatible component extension

key-files:
  created: []
  modified:
    - src/app/(dashboard)/owner/page.tsx
    - src/components/coach/StudentCard.tsx

key-decisions:
  - "StudentCard basePath defaults to /coach/students — all existing coach usages unaffected without passing prop"
  - "Active Today uses distinct student_id Set — work_sessions has one row per session, not per student, so Set deduplication is required"
  - "Active Today and Reports Today are display-only cards — no navigation targets exist for these filtered views in V1"

patterns-established:
  - "Clickable stat cards: wrap Card interactive in Link with min-h-[44px] block class"
  - "Display-only stat cards: plain Card with no Link wrapper or interactive prop"

requirements-completed:
  - OWNER-01

# Metrics
duration: 1min
completed: 2026-03-17
---

# Phase 8 Plan 1: Owner Dashboard Stats Page Summary

**Owner /owner page with 4 live aggregate stat cards using parallel admin queries, and backward-compatible StudentCard basePath prop for cross-role reuse**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-17T16:56:37Z
- **Completed:** 2026-03-17T16:57:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Owner dashboard now shows 4 platform-wide aggregate stat cards replacing the placeholder
- Total Students and Total Coaches cards link to /owner/students and /owner/coaches respectively
- Active Today uses a distinct student_id Set so multiple sessions per student count as 1
- StudentCard now accepts an optional basePath prop for use on owner coach detail pages (Plan 03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add basePath prop to StudentCard** - `40cd75c` (feat)
2. **Task 2: Build owner dashboard stats page** - `fe1b974` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(dashboard)/owner/page.tsx` - Owner dashboard with 4 aggregate stat cards, Promise.all queries, clickable and display-only cards
- `src/components/coach/StudentCard.tsx` - Added optional basePath prop (defaults to /coach/students); backward-compatible

## Decisions Made

- StudentCard basePath defaults to "/coach/students" — existing coach dashboard and at-risk banner usages continue working without any changes
- Active Today query fetches `student_id` rows (not head:true count) so we can compute `new Set().size` for distinct students — using count:exact would inflate the count with duplicate sessions per student
- Active Today and Reports Today have no clickable destination in V1, so they use plain `<Card>` with no Link wrapper

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 (Owner Students List) can now use StudentCard with `basePath="/owner/students"`
- Plan 03 (Owner Coaches + Coach Detail) can use StudentCard with `basePath="/owner/coaches/[id]/students"`
- Owner dashboard is live at /owner with real data from the platform

---
*Phase: 08-owner-stats-people-management*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/owner/page.tsx
- FOUND: src/components/coach/StudentCard.tsx
- FOUND: .planning/phases/08-owner-stats-people-management/08-01-SUMMARY.md
- FOUND: 40cd75c (Task 1 commit)
- FOUND: fe1b974 (Task 2 commit)
