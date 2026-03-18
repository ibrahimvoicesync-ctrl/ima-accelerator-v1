---
phase: 09-owner-invites-assignments-alerts
plan: "04"
subsystem: owner-assignments
tags: [owner, assignments, coach-management, ui]
dependency_graph:
  requires: ["09-02"]
  provides: ["dedicated-assignments-page", "OwnerAssignmentsClient"]
  affects: ["/owner/assignments"]
tech_stack:
  added: []
  patterns: ["Promise.all server fetch", "local-override optimistic state", "stable routerRef/toastRef"]
key_files:
  created:
    - src/components/owner/OwnerAssignmentsClient.tsx
  modified:
    - src/app/(dashboard)/owner/assignments/page.tsx
decisions:
  - "[09-04]: /owner/assignments is now a dedicated server-rendered page — the original redirect to /owner/students (09-02 locked decision) is overridden by UAT finding (test 8)"
  - "[09-04]: liveCoachCounts recalculated from localAssignments state — coach capacity cards update immediately on dropdown change without waiting for router.refresh()"
metrics:
  duration: "2 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 2
---

# Phase 09 Plan 04: Owner Assignments Dedicated Page Summary

**One-liner:** Dedicated /owner/assignments page with coach capacity progress bars, filter tabs, search, and inline coach assignment dropdowns replacing the original redirect.

## What Was Built

**OwnerAssignmentsClient** (`src/components/owner/OwnerAssignmentsClient.tsx`):
- Coach capacity grid (2/3/5 col responsive) with live student counts and color-coded progress bars (primary / warning at 80% / error at 95%), using `role="progressbar"` with aria attributes
- Filter tabs: All / Assigned / Unassigned with per-tab count badges
- Search input (via `<Input>`) filtering by name and email (case-insensitive)
- Student rows using Card layout with avatar initials, name/email, and a `<select>` dropdown for coach assignment
- Dropdown calls `PATCH /api/assignments` on change, checks `response.ok`, shows toast, calls `router.refresh()`, reverts on error
- Saving state per row disables dropdown and shows "Saving..." text
- Local assignment overrides tracked in `localAssignments` Record for immediate capacity card updates
- Pending-change indicator: `border-ima-primary ring-1 ring-ima-primary/30` on modified rows
- Empty state card with contextual subtitle based on active filter

**Assignments page** (`src/app/(dashboard)/owner/assignments/page.tsx`):
- Replaced redirect-only page with full server component
- `requireRole("owner")` guard
- `Promise.all` parallel fetch for students (active only) and coaches (active only) via admin client
- Coach student counts computed from student data
- Page header with `ArrowLeftRight` icon and subtitle
- Stat row: Total Students, Assigned, Unassigned in 3-card grid
- Renders `OwnerAssignmentsClient` with hydrated data

## Verification

- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npm run build`: succeeded, `/owner/assignments` appears as `ƒ` (dynamic) route

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/components/owner/OwnerAssignmentsClient.tsx` exists and exports `OwnerAssignmentsClient`
- [x] `src/app/(dashboard)/owner/assignments/page.tsx` exists, no redirect import
- [x] Commit `4254d4a` (Task 1) exists
- [x] Commit `6693c19` (Task 2) exists
- [x] Build lists `/owner/assignments` as dynamic route

## Self-Check: PASSED
