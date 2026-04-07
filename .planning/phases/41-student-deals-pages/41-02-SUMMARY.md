---
phase: 41-student-deals-pages
plan: "02"
subsystem: student-deals-routes
tags: [next.js, server-components, route-files, loading-skeleton]
dependency_graph:
  requires:
    - src/components/student/DealsClient.tsx (Plan 01 — DealsClient export)
    - src/lib/session.ts (requireRole)
    - src/lib/supabase/admin.ts (createAdminClient)
    - src/lib/types.ts (Database.deals Row type)
    - src/components/ui/Skeleton.tsx (Skeleton component)
  provides:
    - src/app/(dashboard)/student/deals/page.tsx (student deals server page)
    - src/app/(dashboard)/student/deals/loading.tsx (student deals loading skeleton)
    - src/app/(dashboard)/student_diy/deals/page.tsx (student_diy deals server page)
    - src/app/(dashboard)/student_diy/deals/loading.tsx (student_diy deals loading skeleton)
  affects:
    - /student/deals (route now accessible for student role)
    - /student_diy/deals (route now accessible for student_diy role)
tech_stack:
  added: []
  patterns:
    - Thin server component — fetch data, pass as props to client component
    - requireRole() redirect guard (server-side role enforcement)
    - createAdminClient() scoped by user.id (defense in depth)
    - loading.tsx skeleton matches page layout shape for smooth transition
key_files:
  created:
    - src/app/(dashboard)/student/deals/page.tsx
    - src/app/(dashboard)/student/deals/loading.tsx
    - src/app/(dashboard)/student_diy/deals/page.tsx
    - src/app/(dashboard)/student_diy/deals/loading.tsx
  modified: []
decisions:
  - requireRole takes a single string per route (not an array) to enforce strict role isolation between student and student_diy
  - .limit(500) on server fetch as safety cap — no pagination needed at current scale
  - Both loading.tsx files are identical (same skeleton layout mirrors same DealsClient UI)
metrics:
  duration: "~15 minutes"
  completed: "2026-04-07"
  tasks_completed: 1
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 41 Plan 02: Student Deals Route Files Summary

**One-liner:** Thin server pages for /student/deals and /student_diy/deals wiring adminClient-fetched deal lists to the shared DealsClient component, with matching table-shaped loading skeletons.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server pages and loading skeletons for both deal routes | 8cbbdec | src/app/(dashboard)/student/deals/page.tsx, src/app/(dashboard)/student/deals/loading.tsx, src/app/(dashboard)/student_diy/deals/page.tsx, src/app/(dashboard)/student_diy/deals/loading.tsx |

## Tasks Pending

| Task | Name | Status |
|------|------|--------|
| 2 | Verify full CRUD flow on both deal pages | checkpoint:human-verify — pending |

## What Was Built

### student/deals/page.tsx

Thin async server component that:
- Calls `requireRole("student")` — redirects any non-student away
- Fetches deals via `createAdminClient().from("deals").select("*").eq("student_id", user.id).order("created_at", { ascending: false }).limit(500)`
- Logs fetch errors with `console.error` (never swallowed)
- Passes `(deals ?? []) as Deal[]` to `<DealsClient initialDeals={...} />`
- Wraps content in `<div className="px-4 space-y-5">` (mobile-safe, CLAUDE.md px-4 rule)

### student_diy/deals/page.tsx

Identical to student version except:
- `requireRole("student_diy")` for role isolation
- Function name `StudentDiyDealsPage`
- Console error prefix `"[student_diy deals page]"`

### Both loading.tsx files

Skeleton skeleton matching the DealsClient table layout:
- Page heading row (h-8 title + h-4 subtitle)
- Flex-end button area (h-11 w-28 — matches 44px touch target height)
- `bg-ima-surface border border-ima-border rounded-xl` container
- Hidden-on-mobile table header row (`hidden sm:flex`)
- 5 row skeletons with `last:border-0` pattern
- All colors use ima-* tokens only

## Deviations from Plan

None — plan executed exactly as written.

## TypeScript Status

`npx tsc --noEmit` reports 2 errors: `Cannot find module '@/components/student/DealsClient'` in both page.tsx files. These errors are expected in the parallel execution model — `DealsClient.tsx` is created by Plan 01's parallel worktree. TypeScript will compile clean after the orchestrator merges both worktrees.

## Threat Model Coverage

All T-41-05 through T-41-08 mitigations are in place:
- T-41-05: `requireRole("student")` + `.eq("student_id", user.id)` on student page
- T-41-06: `requireRole("student_diy")` + `.eq("student_id", user.id)` on student_diy page
- T-41-07: `.eq("student_id", user.id)` prevents cross-student data access
- T-41-08: `.limit(500)` caps the query

## Self-Check: PASSED

- [x] src/app/(dashboard)/student/deals/page.tsx exists
- [x] src/app/(dashboard)/student/deals/loading.tsx exists
- [x] src/app/(dashboard)/student_diy/deals/page.tsx exists
- [x] src/app/(dashboard)/student_diy/deals/loading.tsx exists
- [x] Commit 8cbbdec exists with exactly 4 files, no deletions
