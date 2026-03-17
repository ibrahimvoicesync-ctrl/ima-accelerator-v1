---
phase: 09-owner-invites-assignments-alerts
plan: "02"
subsystem: owner-assignments
tags: [owner, assignments, coach, api, student-detail]
dependency_graph:
  requires:
    - 08-owner-stats-people-management (owner student detail page exists)
    - 09-01 (owner invite APIs exist)
  provides:
    - PATCH /api/assignments (coach assignment endpoint)
    - /owner/assignments redirect page
    - Coach dropdown on owner student detail
  affects:
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx
tech_stack:
  added: []
  patterns:
    - stable-ref pattern (routerRef, toastRef) for async callbacks
    - parallel Promise.all with 5 queries
    - Zod safeParse with nullable uuid for coach_id
key_files:
  created:
    - src/app/api/assignments/route.ts
    - src/app/(dashboard)/owner/assignments/page.tsx
  modified:
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/owner/OwnerStudentDetailClient.tsx
decisions:
  - "09-02: /owner/assignments is a redirect page — no dedicated assignments page per locked decision"
  - "09-02: coach dropdown placed in header section, sm:items-start alignment prevents vertical centering with avatar"
  - "09-02: coach_id validated as uuid().nullable() so null unassigns the student"
  - "09-02: student and coach existence verified before update — defense in depth on top of RLS"
metrics:
  duration: "3 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 09 Plan 02: Owner Coach Assignments Summary

One-liner: PATCH /api/assignments endpoint + coach dropdown on owner student detail using stable-ref pattern with student count display.

## What Was Built

Owner can now assign or reassign any student to any coach directly from the student detail page. A new `PATCH /api/assignments` route validates owner role, verifies the student and coach exist, and updates `users.coach_id`. The `/owner/assignments` nav item redirects to `/owner/students` (no dedicated assignments page per locked decision). The student detail page fetches active coaches with student counts in a parallel 5-query `Promise.all`, passing `coaches` and `currentCoachId` props to the client component. The coach dropdown shows "Coach Name (N students)" format and fires the PATCH immediately on change. Success and error toasts display, page refreshes on success, and selection reverts on error.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create PATCH /api/assignments and /owner/assignments redirect | 58de6a5 | src/app/api/assignments/route.ts, src/app/(dashboard)/owner/assignments/page.tsx |
| 2 | Extend owner student detail with coach assignment dropdown | e268eb2 | src/app/(dashboard)/owner/students/[studentId]/page.tsx, src/components/owner/OwnerStudentDetailClient.tsx |

## Verification

- `npx tsc --noEmit` passes (no output)
- `npm run lint` passes (no output)
- `npm run build` completes — `/api/assignments` and `/owner/assignments` visible in route table
- PATCH /api/assignments: validates owner role, verifies student exists (.eq("role", "student")), verifies coach exists (.eq("role", "coach")), updates coach_id
- /owner/assignments: redirects to /owner/students
- Owner student detail: shows coach dropdown with student counts, assignment change toasts and refreshes

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/app/api/assignments/route.ts: EXISTS
- src/app/(dashboard)/owner/assignments/page.tsx: EXISTS
- src/app/(dashboard)/owner/students/[studentId]/page.tsx: MODIFIED (coachesResult, studentCountsResult, coachOptions, coaches/currentCoachId props)
- src/components/owner/OwnerStudentDetailClient.tsx: MODIFIED (coaches/currentCoachId props, handleAssign, coach-assign dropdown)
- Commit 58de6a5: EXISTS (feat(09-02): add PATCH /api/assignments...)
- Commit e268eb2: EXISTS (feat(09-02): extend owner student detail...)
