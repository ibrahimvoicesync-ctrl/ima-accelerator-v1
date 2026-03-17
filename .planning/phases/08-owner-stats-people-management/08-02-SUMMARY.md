---
phase: 08-owner-stats-people-management
plan: "02"
subsystem: owner-student-management
tags: [owner, students, search, detail, tabs]
dependency_graph:
  requires:
    - src/lib/session.ts (requireRole)
    - src/lib/supabase/admin.ts (createAdminClient)
    - src/components/coach/StudentDetailTabs.tsx
    - src/components/coach/WorkSessionsTab.tsx
    - src/components/coach/RoadmapTab.tsx
    - src/components/coach/ReportsTab.tsx
  provides:
    - /owner/students page (searchable student list)
    - /owner/students/[studentId] page (tabbed student detail)
  affects:
    - Owner navigation to student management pages
tech_stack:
  added: []
  patterns:
    - URL-based search with 300ms debounce via stable router ref
    - Inline header component to avoid back-link coupling
    - Promise.all parallel enrichment fetch (same pattern as coach)
    - At-risk computation via COACH_CONFIG thresholds (reused from coach view)
key_files:
  created:
    - src/app/(dashboard)/owner/students/page.tsx
    - src/components/owner/OwnerStudentSearchClient.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx
  modified: []
decisions:
  - "OwnerStudentDetailClient uses inline header instead of importing StudentHeader — avoids back-link coupling (/coach hardcoded in StudentHeader)"
  - "Owner student list has no status filter — owner sees ALL students (active, inactive, suspended) for full platform visibility"
  - "Reused coach tab components (WorkSessionsTab, RoadmapTab, ReportsTab) verbatim — no route awareness in those components"
metrics:
  duration: "2 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 8 Plan 02: Owner Student Management Summary

Owner student list (searchable) and detail pages that give the owner full visibility into all students on the platform without coach_id restrictions.

## Tasks Completed

### Task 1: Owner student list page with search
**Commit:** 748ec26

Created `src/app/(dashboard)/owner/students/page.tsx` (server component) and `src/components/owner/OwnerStudentSearchClient.tsx` (client component).

- Server page reads `searchParams`, fetches all students via admin client with optional `ilike` search filter on name or email
- No status filter — owner sees all students regardless of active/inactive/suspended state
- Client component uses stable `routerRef` pattern (same as phases 3/5/7) to prevent router dependency churn
- 300ms debounce via `timerRef` clears pending timeout before setting new one
- Student card grid with initials avatar, status badge, empty state with contextual message

### Task 2: Owner student detail page with tabs
**Commit:** af3d5cd

Created `src/app/(dashboard)/owner/students/[studentId]/page.tsx` (server component) and `src/components/owner/OwnerStudentDetailClient.tsx` (client component).

- Server page uses `.eq("role", "student")` only — no `.eq("coach_id", ...)` restriction
- Promise.all parallel fetch for sessions (limit 120), roadmap, reports (limit 20)
- At-risk computation identical to coach student detail page (COACH_CONFIG thresholds)
- Client component has inline `OwnerStudentHeader` with `href="/owner/students"` back link
- `window.history.replaceState` uses `/owner/students/${studentId}?tab=` prefix
- Reuses `StudentDetailTabs`, `WorkSessionsTab`, `RoadmapTab`, `ReportsTab` from coach components

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` exits 0 (zero type errors)
- `npm run build` completes successfully — `/owner/students` and `/owner/students/[studentId]` appear in build output
- All ima-* tokens, 44px touch targets, aria labels applied
- All acceptance criteria for both tasks satisfied

## Self-Check: PASSED
