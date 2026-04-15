---
phase: 54
plan: 02
subsystem: analytics
tags: [owner-analytics, rpc-wrapper, types, shared-component]
requires: [public.get_owner_analytics, src/lib/supabase/admin.ts, next/cache]
provides: [owner-analytics-types, owner-analytics wrapper, shared LeaderboardCard]
affects: [src/lib/rpc, src/components/analytics, src/components/coach/analytics]
tech-stack:
  added: []
  patterns: [server-only module, unstable_cache 60s + tag, client-safe types module, hrefPrefix prop for link reuse]
key-files:
  created:
    - src/lib/rpc/owner-analytics-types.ts
    - src/lib/rpc/owner-analytics.ts
    - src/components/analytics/LeaderboardCard.tsx
  modified:
    - src/components/coach/analytics/CoachAnalyticsClient.tsx
  deleted:
    - src/components/coach/analytics/LeaderboardCard.tsx
key-decisions:
  - D-02 implemented exactly (relocate + hrefPrefix prop, default '/coach/students/')
  - Global cache tag (no per-user suffix) because single owner
  - Re-exports from wrapper so server callers have one import path
requirements-completed: [OA-04, OA-06, PERF-04]
duration: 12 min
completed: 2026-04-15
---

# Phase 54 Plan 02: Owner Analytics TypeScript Surface + LeaderboardCard Relocation Summary

Built the TypeScript consumer surface for the Plan 01 RPC: client-safe types module, server-only cached fetcher (60s `unstable_cache` tagged `owner-analytics`), and relocated shared `LeaderboardCard` with new `hrefPrefix` prop per D-02.

## Task Results

### Task 1: Create owner-analytics-types.ts — PASSED

File: `src/lib/rpc/owner-analytics-types.ts` (83 lines). Exports:
- `OwnerLeaderboardHoursRow`, `OwnerLeaderboardProfitRow`, `OwnerLeaderboardDealsRow`
- `OwnerLeaderboards`, `OwnerAnalyticsPayload`
- `OWNER_ANALYTICS_TAG = "owner-analytics"` const
- `ownerAnalyticsTag(): string` helper

No server-only imports (client-safe). Commit: `e838cd3`.

### Task 2: Create owner-analytics.ts — PASSED

File: `src/lib/rpc/owner-analytics.ts` (89 lines). Exports:
- `fetchOwnerAnalytics(): Promise<OwnerAnalyticsPayload>` (uncached)
- `getOwnerAnalyticsCached(): Promise<OwnerAnalyticsPayload>` (60s TTL, tag `owner-analytics`)
- Re-exports `OWNER_ANALYTICS_TAG`, `ownerAnalyticsTag`, and all payload types

First non-comment line is `import "server-only"`. Uses `unstable_cache` with `revalidate: 60, tags: [ownerAnalyticsTag()]`. Errors logged via `console.error` and rethrown (Rule #5). Commits: `ef8e438`, `d629cd5` (lint cleanup).

### Task 3: Relocate LeaderboardCard + update coach import — PASSED

Files:
- Created `src/components/analytics/LeaderboardCard.tsx` (identical Phase 48 structure + `hrefPrefix?: string` prop defaulting to `"/coach/students/"`)
- Updated `src/components/coach/analytics/CoachAnalyticsClient.tsx` line 21 — import now `from "@/components/analytics/LeaderboardCard"`
- Deleted `src/components/coach/analytics/LeaderboardCard.tsx`

Verification:
- `test -f src/components/analytics/LeaderboardCard.tsx` — PASS
- `! test -f src/components/coach/analytics/LeaderboardCard.tsx` — PASS
- New import path present — PASS
- `hrefPrefix?: string` prop and `hrefPrefix = "/coach/students/"` default — PASS
- `${hrefPrefix}${row.student_id}` concatenation — PASS
- `npx tsc --noEmit` — PASS (zero errors)

Commit: `aab1499` (rename with 75% similarity detected by git).

## Export Surface Snapshot

```typescript
// src/lib/rpc/owner-analytics-types.ts
export type OwnerLeaderboardHoursRow, OwnerLeaderboardProfitRow, OwnerLeaderboardDealsRow;
export type OwnerLeaderboards, OwnerAnalyticsPayload;
export const OWNER_ANALYTICS_TAG;
export function ownerAnalyticsTag(): string;

// src/lib/rpc/owner-analytics.ts
import "server-only";
export async function fetchOwnerAnalytics(): Promise<OwnerAnalyticsPayload>;
export async function getOwnerAnalyticsCached(): Promise<OwnerAnalyticsPayload>;
// re-exports: OWNER_ANALYTICS_TAG, ownerAnalyticsTag, all payload types

// src/components/analytics/LeaderboardCard.tsx
export type LeaderboardRow;
export function LeaderboardCard(props: {
  heading, subheading, rows, emptyHeading, emptyBody, headingId;
  hrefPrefix?: string;  // default "/coach/students/"
});
```

## Deviations from Plan

**[Rule 2 - Lint warning cleanup] Unused direct value import of OWNER_ANALYTICS_TAG** — Found during: post-implementation lint | Issue: `import { OWNER_ANALYTICS_TAG, ... }` on line 24 was re-exported (line 30) but never referenced inside the module body, triggering `@typescript-eslint/no-unused-vars` warning | Fix: dropped the value from the direct import block; re-export remains identical (public surface unchanged) | Files modified: `src/lib/rpc/owner-analytics.ts` | Verification: `npx tsc --noEmit` passes, re-export line intact | Commit hash: d629cd5

**Total deviations:** 1 auto-fixed (Rule 2 lint cleanup). **Impact:** None — public surface identical.

## Authentication Gates

None.

## Issues Encountered

None. `npm run lint` exits 0 (project-wide, not zero-warning mode). The only new-file warning was fixed.

## Self-Check: PASSED

- `key-files.created` exist on disk: all three verified
- `git log --oneline --grep="54-02"` returns 4 commits: e838cd3, ef8e438, aab1499, d629cd5 — verified
- Task acceptance criteria pass
- Re-verified the plan-level `<verification>` commands: `npx tsc --noEmit` passes

## Next

Plan 03 (owner analytics page + homepage teaser + sidebar nav) and Plan 04 (revalidateTag fan-out in mutation routes) can now both import from this stable surface. Coach analytics smoke test pending manual UAT (layout should be identical — hrefPrefix defaults preserve Phase 48 behavior).
