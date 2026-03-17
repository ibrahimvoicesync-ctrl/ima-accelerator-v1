---
phase: 10-ui-polish-production-hardening
plan: "03"
subsystem: ui-consistency
tags: [empty-states, accessibility, ux, polish]
dependency_graph:
  requires: ["10-01"]
  provides: ["UI-03"]
  affects: [coach-dashboard, coach-reports, coach-analytics, coach-students, student-report-history, owner-coaches, owner-coach-detail, coach-invites, coach-reports-client, coach-reports-tab, coach-roadmap-tab, owner-alerts, owner-assignments, owner-invites, owner-students]
tech_stack:
  added: []
  patterns: [EmptyState component, buttonVariants + Link for CTA buttons]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/coach/page.tsx
    - src/app/(dashboard)/coach/reports/page.tsx
    - src/app/(dashboard)/coach/analytics/page.tsx
    - src/app/(dashboard)/coach/students/page.tsx
    - src/app/(dashboard)/student/report/history/page.tsx
    - src/app/(dashboard)/owner/coaches/page.tsx
    - src/app/(dashboard)/owner/coaches/[coachId]/page.tsx
    - src/components/coach/CoachReportsClient.tsx
    - src/components/coach/CoachInvitesClient.tsx
    - src/components/coach/ReportsTab.tsx
    - src/components/coach/RoadmapTab.tsx
    - src/components/owner/OwnerAlertsClient.tsx
    - src/components/owner/OwnerAssignmentsClient.tsx
    - src/components/owner/OwnerInvitesClient.tsx
    - src/components/owner/OwnerStudentSearchClient.tsx
decisions:
  - "Used Route icon instead of Map for RoadmapTab empty state — Map collides with JavaScript's built-in Map global causing TypeScript errors"
  - "OwnerAssignmentsClient CTA only shown when filter is 'all' and no search term — contextual relevance"
  - "Compact variant used for inline section empty states (coach dashboard My Students, coach detail students, ReportsTab, RoadmapTab)"
  - "Default variant used for full-page empty states (standalone pages with no data)"
metrics:
  duration: "6 min"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_modified: 15
---

# Phase 10 Plan 03: Empty State Canonicalization Summary

**One-liner:** Replaced 15 ad-hoc Card+icon+text empty states with the canonical EmptyState component across all dashboard pages and client components, adding contextual CTAs and accessible role="status" semantics.

## What Was Built

Systematically replaced every ad-hoc empty state pattern (`<Card><CardContent className="p-8 text-center">...icon...text...</CardContent></Card>`) with the canonical `EmptyState` component from `src/components/ui/EmptyState.tsx`.

**Server pages (Task 1) — 7 files:**
1. `coach/page.tsx` — My Students section: compact EmptyState with "Invite Students" CTA
2. `coach/reports/page.tsx` — No students early return: full EmptyState with "Invite Students" CTA
3. `coach/analytics/page.tsx` — No students early return: full EmptyState with "Invite Students" CTA
4. `coach/students/page.tsx` — Empty student grid: full EmptyState with "Invite Students" CTA
5. `student/report/history/page.tsx` — No reports: full EmptyState with "Submit Your First Report" CTA
6. `owner/coaches/page.tsx` — No coaches: full EmptyState with "Invite Coaches" CTA
7. `owner/coaches/[coachId]/page.tsx` — No assigned students: compact EmptyState with "Manage Assignments" CTA

**Client components (Task 2) — 8 files:**
1. `CoachReportsClient.tsx` — No reports found: full EmptyState (no CTA, filter change is the action)
2. `CoachInvitesClient.tsx` — No invites + no magic links: 2 EmptyState instances
3. `ReportsTab.tsx` — No reports in student tab: compact EmptyState
4. `RoadmapTab.tsx` — No roadmap progress: compact EmptyState with Route icon
5. `OwnerAlertsClient.tsx` — No alerts: EmptyState using existing EMPTY_MESSAGES object
6. `OwnerAssignmentsClient.tsx` — No students found: EmptyState with conditional "Invite Students" CTA
7. `OwnerInvitesClient.tsx` — No invites + no magic links: 2 EmptyState instances
8. `OwnerStudentSearchClient.tsx` — No students: EmptyState with conditional "Invite Students" CTA

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Map icon name collides with JavaScript built-in Map global**
- **Found during:** Task 2 (RoadmapTab.tsx)
- **Issue:** `import { Map } from "lucide-react"` caused TypeScript error — lucide's `Map` component has a naming collision with JS built-in Map, producing "Argument of type '...' is not assignable to type 'Omit<LucideProps, ref>'" error
- **Fix:** Changed icon from `Map` to `Route` (also from lucide-react, semantically appropriate for roadmap)
- **Files modified:** `src/components/coach/RoadmapTab.tsx`

**2. [Rule 1 - Cleanup] Unused imports after empty state replacement**
- **Found during:** Task 2 lint check
- **Issue:** After removing `<CardContent>` from empty state patterns, `CardContent` and `Shield` imports became unused warnings
- **Fix:** Removed `CardContent` from `coach/students/page.tsx` and `CoachReportsClient.tsx`; removed `CardContent` and `Shield` from `owner/coaches/page.tsx`
- **Files modified:** 3 files

## Commits

- `c156f84` — feat(10-03): replace ad-hoc empty states in server pages with EmptyState
- `4afa551` — feat(10-03): replace ad-hoc empty states in client components with EmptyState

## Self-Check: PASSED

All 15 files verified to contain `EmptyState` import and usage. TypeScript passes (`npx tsc --noEmit` no errors). Lint passes with 0 errors (1 pre-existing unrelated warning in student/loading.tsx).
