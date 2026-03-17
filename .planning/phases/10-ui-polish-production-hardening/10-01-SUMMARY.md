---
phase: 10-ui-polish-production-hardening
plan: 01
subsystem: ui
tags: [react, nextjs, error-boundary, empty-state, accessibility, tailwind]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: UI primitives (Button, Card, buttonVariants) used in error boundaries
provides:
  - EmptyState component with default + compact variants exported from ui barrel
  - 21 error.tsx boundaries covering all dashboard routes (1 shared + 20 per-route)
affects: [10-02, 10-03, all dashboard pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - error.tsx per-route boundary with role="alert", console.error logging, Try Again + Go Home
    - EmptyState with default (full-page centered) and compact (horizontal inline) variants

key-files:
  created:
    - src/components/ui/EmptyState.tsx
    - src/app/(dashboard)/error.tsx
    - src/app/(dashboard)/student/error.tsx
    - src/app/(dashboard)/student/work/error.tsx
    - src/app/(dashboard)/student/roadmap/error.tsx
    - src/app/(dashboard)/student/report/error.tsx
    - src/app/(dashboard)/student/report/history/error.tsx
    - src/app/(dashboard)/student/ask/error.tsx
    - src/app/(dashboard)/coach/error.tsx
    - src/app/(dashboard)/coach/reports/error.tsx
    - src/app/(dashboard)/coach/analytics/error.tsx
    - src/app/(dashboard)/coach/invites/error.tsx
    - src/app/(dashboard)/coach/students/error.tsx
    - src/app/(dashboard)/coach/students/[studentId]/error.tsx
    - src/app/(dashboard)/owner/error.tsx
    - src/app/(dashboard)/owner/students/error.tsx
    - src/app/(dashboard)/owner/students/[studentId]/error.tsx
    - src/app/(dashboard)/owner/coaches/error.tsx
    - src/app/(dashboard)/owner/coaches/[coachId]/error.tsx
    - src/app/(dashboard)/owner/invites/error.tsx
    - src/app/(dashboard)/owner/assignments/error.tsx
    - src/app/(dashboard)/owner/alerts/error.tsx
  modified:
    - src/components/ui/index.ts

key-decisions:
  - "Error boundaries use role-appropriate Go Home links (student->/student, coach->/coach, owner->/owner) so users land on their dashboard, not the app root"
  - "Per-route boundaries have simpler copy ('We couldn't load this page') vs dashboard-level fallback which has support contact language — matches error severity"

patterns-established:
  - "error.tsx pattern: 'use client', useEffect console.error, role=alert outer div, AlertTriangle with aria-hidden, Button Try Again + Link Go Home"
  - "EmptyState pattern: role=status, icon with aria-hidden, ima-surface-light bg, ima-* text tokens throughout"

requirements-completed: [UI-02, UI-03, UI-06]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 10 Plan 01: Error Boundaries + EmptyState Summary

**EmptyState component (default + compact variants) and 21 error.tsx boundaries covering every dashboard route, all using ima-* tokens, role="alert", and role-specific Go Home navigation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T22:34:10Z
- **Completed:** 2026-03-17T22:37:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Ported EmptyState from reference-old with default (full-page py-16 centered) and compact (horizontal flex inline) variants, both with role="status" and aria-hidden on icon wrappers
- Created shared dashboard-level error.tsx fallback with full error context and support contact language
- Created 20 per-route error.tsx files for all student, coach, and owner routes with role-specific Go Home links

## Task Commits

Each task was committed atomically:

1. **Task 1: Port EmptyState component and add to barrel export** - `d3ed0cb` (feat)
2. **Task 2: Create error.tsx boundaries for dashboard-level and all 20 routes** - `0220204` (feat)

**Plan metadata:** (pending final docs commit)

## Files Created/Modified
- `src/components/ui/EmptyState.tsx` - Reusable empty state with default + compact variants, role="status"
- `src/components/ui/index.ts` - Added EmptyState barrel export
- `src/app/(dashboard)/error.tsx` - Shared dashboard-level error fallback with support contact copy
- `src/app/(dashboard)/student/error.tsx` - Student dashboard error boundary, Go Home → /student
- `src/app/(dashboard)/student/work/error.tsx` - Student work tracker error boundary
- `src/app/(dashboard)/student/roadmap/error.tsx` - Student roadmap error boundary
- `src/app/(dashboard)/student/report/error.tsx` - Student daily report error boundary
- `src/app/(dashboard)/student/report/history/error.tsx` - Student report history error boundary
- `src/app/(dashboard)/student/ask/error.tsx` - Ask Abu Lahya error boundary
- `src/app/(dashboard)/coach/error.tsx` - Coach dashboard error boundary, Go Home → /coach
- `src/app/(dashboard)/coach/reports/error.tsx` - Coach reports error boundary
- `src/app/(dashboard)/coach/analytics/error.tsx` - Coach analytics error boundary
- `src/app/(dashboard)/coach/invites/error.tsx` - Coach invites error boundary
- `src/app/(dashboard)/coach/students/error.tsx` - Coach students error boundary
- `src/app/(dashboard)/coach/students/[studentId]/error.tsx` - Coach student detail error boundary
- `src/app/(dashboard)/owner/error.tsx` - Owner dashboard error boundary, Go Home → /owner
- `src/app/(dashboard)/owner/students/error.tsx` - Owner students list error boundary
- `src/app/(dashboard)/owner/students/[studentId]/error.tsx` - Owner student detail error boundary
- `src/app/(dashboard)/owner/coaches/error.tsx` - Owner coaches list error boundary
- `src/app/(dashboard)/owner/coaches/[coachId]/error.tsx` - Owner coach detail error boundary
- `src/app/(dashboard)/owner/invites/error.tsx` - Owner invites error boundary
- `src/app/(dashboard)/owner/assignments/error.tsx` - Owner assignments error boundary
- `src/app/(dashboard)/owner/alerts/error.tsx` - Owner alerts error boundary

## Decisions Made
- Error boundaries use role-appropriate Go Home links (student→/student, coach→/coach, owner→/owner) so users land on their own dashboard, not the app root
- Per-route boundaries use simpler copy ("We couldn't load this page") vs dashboard-level fallback which includes support contact language, matching error severity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EmptyState is ready for Plan 02 to replace ad-hoc empty states across all pages
- Error boundaries cover all 21 dashboard routes — every page now degrades gracefully on failure
- TypeScript strict mode: `npx tsc --noEmit` passes clean

## Self-Check: PASSED

- FOUND: src/components/ui/EmptyState.tsx
- FOUND: src/app/(dashboard)/error.tsx (and all 20 per-route variants)
- FOUND: .planning/phases/10-ui-polish-production-hardening/10-01-SUMMARY.md
- FOUND: d3ed0cb (Task 1 commit)
- FOUND: 0220204 (Task 2 commit)

---
*Phase: 10-ui-polish-production-hardening*
*Completed: 2026-03-17*
