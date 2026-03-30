---
phase: 20-query-consolidation-caching
plan: "02"
subsystem: dashboard-caching
tags: [rpc, unstable_cache, badge-invalidation, layout, owner-dashboard]
dependency_graph:
  requires: [20-01]
  provides: [badge-cache, owner-dashboard-rpc, cache-invalidation]
  affects: [layout.tsx, owner/page.tsx, api/reports, api/work-sessions, api/alerts]
tech_stack:
  added: [unstable_cache, revalidateTag]
  patterns: [rpc-consolidation, tag-based-cache-invalidation, request-dedup]
key_files:
  created: []
  modified:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/owner/page.tsx
    - src/lib/types.ts
    - src/app/api/reports/route.ts
    - src/app/api/reports/[id]/review/route.ts
    - src/app/api/work-sessions/route.ts
    - src/app/api/work-sessions/[id]/route.ts
    - src/app/api/alerts/dismiss/route.ts
decisions:
  - "revalidateTag requires second argument (profile) in Next.js 16 — use 'default' to avoid deprecation warning"
  - "Add Phase 20 RPC function types to src/lib/types.ts since Supabase generated types are a hand-crafted placeholder that only had get_user_id and get_user_role"
metrics:
  duration: "8 minutes"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 8
---

# Phase 20 Plan 02: Layout Caching + Owner Dashboard RPC Summary

**One-liner:** Dashboard layout drops from 10+ badge queries to a single unstable_cache-wrapped RPC call; owner dashboard drops from 4 parallel queries to 1 RPC; all 5 mutation routes invalidate badge cache via revalidateTag.

## What Was Built

### Task 1: layout.tsx — getSessionUser + cached RPC badges

Rewrote `src/app/(dashboard)/layout.tsx` from 195 lines to ~55 lines:

- Replaced manual `supabase.auth.getUser()` + admin profile lookup with `getSessionUser()` from Plan 01 (React cache-wrapped, per-request dedup)
- Replaced entire badge computation block (10+ DB queries including student loop, session/report joins, alert counting, dismissal counting) with a single `unstable_cache`-wrapped RPC call to `get_sidebar_badges(p_user_id, p_role)`
- Cache config: `tags: ["badges"]`, `revalidate: 60` (60-second TTL)
- Error path logs via `console.error` — never swallows errors
- Sidebar receives same `badgeCounts: Record<string, number>` shape as before

Also added Phase 20 RPC function type definitions to `src/lib/types.ts` (deviation fix — types file only had `get_user_id` and `get_user_role`; new RPC functions added: `get_owner_dashboard_stats`, `get_sidebar_badges`, `get_student_detail`).

**Commit:** bd854d7

### Task 2: owner/page.tsx RPC + badge invalidation in 5 API routes

**Part A: owner/page.tsx**

Replaced 4-query `Promise.all` block with single `admin.rpc("get_owner_dashboard_stats")` call:
- Removed `Promise.all` with 4 separate admin queries for students, coaches, active sessions, reports
- Removed `activeTodayCount` Set computation (now in SQL)
- Removed `getToday` import (date computed in SQL)
- Single `console.error` for RPC failure
- Stats typed as `OwnerDashboardStats` from `@/lib/rpc/types`

**Part B: 5 API routes — badge cache invalidation**

Added `import { revalidateTag } from "next/cache"` and `revalidateTag("badges", "default")` to:
1. `src/app/api/reports/route.ts` — POST: after update and insert success (both report create and update paths)
2. `src/app/api/reports/[id]/review/route.ts` — PATCH: after successful review status toggle
3. `src/app/api/work-sessions/route.ts` — POST: after successful session insert
4. `src/app/api/work-sessions/[id]/route.ts` — PATCH: after successful session status update
5. `src/app/api/alerts/dismiss/route.ts` — POST: after successful dismissal upsert

**Commit:** 287653f

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Next.js 16 revalidateTag requires second argument**
- **Found during:** Task 2 build verification
- **Issue:** `revalidateTag("badges")` caused TypeScript error `Expected 2 arguments, but got 1` — Next.js 16 changed the `revalidateTag` signature to require a `profile: string | CacheLifeConfig` second argument (runtime emits deprecation warning without it)
- **Fix:** Added `"default"` as second argument: `revalidateTag("badges", "default")` — uses the built-in default cache profile
- **Files modified:** All 5 API route files
- **Commit:** 287653f (included in Task 2 commit)

**2. [Rule 2 - Missing critical functionality] RPC function types missing from types.ts**
- **Found during:** Task 1 TypeScript check
- **Issue:** `src/lib/types.ts` only had `get_user_id` and `get_user_role` in the `Functions` section; new Phase 20 RPC functions (`get_owner_dashboard_stats`, `get_sidebar_badges`, `get_student_detail`) were not registered, causing TypeScript error `Argument of type '"get_sidebar_badges"' is not assignable`
- **Fix:** Added type definitions for all 3 new RPC functions to `src/lib/types.ts`
- **Files modified:** `src/lib/types.ts`
- **Commit:** bd854d7 (included in Task 1 commit)

## Known Stubs

None — all data flows are wired. RPC calls will return empty/zero results until the SQL migration (from Plan 01) is deployed to Supabase, but the code path is complete.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/(dashboard)/layout.tsx
- FOUND: src/app/(dashboard)/owner/page.tsx
- FOUND: src/lib/types.ts
- FOUND: src/app/api/reports/route.ts
- FOUND: src/app/api/reports/[id]/review/route.ts
- FOUND: src/app/api/work-sessions/route.ts
- FOUND: src/app/api/work-sessions/[id]/route.ts
- FOUND: src/app/api/alerts/dismiss/route.ts

Commits exist:
- FOUND: bd854d7 — feat(20-02): rewrite layout.tsx to use getSessionUser + cached RPC badges
- FOUND: 287653f — feat(20-02): rewrite owner dashboard to RPC + add badge cache invalidation to 5 API routes
