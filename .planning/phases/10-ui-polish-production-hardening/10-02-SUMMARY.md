---
phase: 10-ui-polish-production-hardening
plan: "02"
subsystem: loading-skeletons
tags: [ui, loading, skeleton, ux, nextjs]
dependency_graph:
  requires: []
  provides: [loading-skeletons-all-dashboard-routes]
  affects: [all-dashboard-routes]
tech_stack:
  added: []
  patterns:
    - Next.js loading.tsx route-level Suspense boundaries
    - Skeleton/SkeletonCard primitives from @/components/ui/Skeleton
    - ima-* design tokens for skeleton backgrounds
key_files:
  created:
    - src/app/(dashboard)/student/loading.tsx
    - src/app/(dashboard)/student/work/loading.tsx
    - src/app/(dashboard)/student/roadmap/loading.tsx
    - src/app/(dashboard)/student/report/loading.tsx
    - src/app/(dashboard)/student/report/history/loading.tsx
    - src/app/(dashboard)/student/ask/loading.tsx
    - src/app/(dashboard)/coach/loading.tsx
    - src/app/(dashboard)/coach/reports/loading.tsx
    - src/app/(dashboard)/coach/analytics/loading.tsx
    - src/app/(dashboard)/coach/invites/loading.tsx
    - src/app/(dashboard)/coach/students/loading.tsx
    - src/app/(dashboard)/coach/students/[studentId]/loading.tsx
    - src/app/(dashboard)/owner/loading.tsx
    - src/app/(dashboard)/owner/students/loading.tsx
    - src/app/(dashboard)/owner/students/[studentId]/loading.tsx
    - src/app/(dashboard)/owner/coaches/loading.tsx
    - src/app/(dashboard)/owner/coaches/[coachId]/loading.tsx
    - src/app/(dashboard)/owner/invites/loading.tsx
    - src/app/(dashboard)/owner/assignments/loading.tsx
    - src/app/(dashboard)/owner/alerts/loading.tsx
  modified: []
decisions:
  - "loading.tsx files use Skeleton/SkeletonCard primitives exclusively — motion-safe:animate-pulse handled by primitive, not inline classes"
  - "Each skeleton matches actual page layout shape (read page.tsx first) to prevent layout shift on content arrival"
  - "No aria-hidden on skeleton wrappers — Skeleton component handles aria-hidden internally"
metrics:
  duration: "2 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 20
---

# Phase 10 Plan 02: Loading Skeleton Files Summary

20 route-level loading.tsx skeleton files created across all dashboard routes using Skeleton/SkeletonCard primitives with ima-* tokens and motion-safe:animate-pulse.

## What Was Built

Created 20 `loading.tsx` files — one per dashboard route — so Next.js automatically activates Suspense boundaries while server data fetches. Each skeleton mirrors the actual page layout shape to prevent jarring layout shifts when real content arrives.

**Student routes (6 files):**
- `/student` — heading + work progress card (progress bar + button) + 2-col roadmap/report cards
- `/student/work` — heading + centered circular timer + 4-col cycle cards grid
- `/student/roadmap` — heading + progress overview card + 10-step vertical list
- `/student/report` — heading + date/stats row + status banner + form card with 4 field skeletons
- `/student/report/history` — back link + heading + 5x SkeletonCard list
- `/student/ask` — heading + h-[600px] iframe placeholder

**Coach routes (6 files):**
- `/coach` — heading + 3 stat cards + student card grid (4x SkeletonCard)
- `/coach/reports` — heading + 4 stat cards + filter tabs + 5 report row skeletons
- `/coach/analytics` — heading + 4 metric cards + student breakdown section
- `/coach/invites` — heading + 4 stat cards + tabs + form area + invite list
- `/coach/students` — heading + 4x SkeletonCard grid
- `/coach/students/[studentId]` — back link + avatar header + tab bar + 2x SkeletonCard

**Owner routes (8 files):**
- `/owner` — heading + 4 stat cards (2x2 grid)
- `/owner/students` — heading + search bar + 6x SkeletonCard grid
- `/owner/students/[studentId]` — back link + avatar header + assignment dropdown + tabs + 2x SkeletonCard
- `/owner/coaches` — heading + 4x SkeletonCard grid
- `/owner/coaches/[coachId]` — back link + avatar header + 4 stat cards + 4x SkeletonCard
- `/owner/invites` — heading + 4 stat cards + tabs + form + invite list
- `/owner/assignments` — heading + 3-col stat row + coach capacity cards + student assignment list
- `/owner/alerts` — heading + 5 filter tab skeletons + 4x SkeletonCard

## Decisions Made

- All `loading.tsx` files use `Skeleton`/`SkeletonCard` primitives from `@/components/ui/Skeleton` — the primitive handles `motion-safe:animate-pulse` and `aria-hidden` internally, keeping skeleton files clean
- Skeleton shapes verified against actual `page.tsx` files to minimize layout shift
- `px-4` outer wrapper on all files for consistent mobile padding

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- 20 loading.tsx files: FOUND (verified via `find ... | wc -l` = 20)
- No hardcoded colors: FOUND (grep for text-gray/bg-gray returned nothing)
- All use Skeleton import: FOUND (grep -rL returned nothing)
- No bare animate-pulse: FOUND (all pulse via Skeleton primitive)

### Commits Exist
- Task 1 (student + coach, 12 files): 00c95b9
- Task 2 (owner, 8 files): 720111e

## Self-Check: PASSED
