---
phase: 47-coach-dashboard-homepage-stats
status: clean
reviewed: 2026-04-13
depth: standard
files_reviewed: 10
---

# Phase 47 — Code Review

## Scope

Reviewed all files modified or created during Phase 47 (10 files):
- `supabase/migrations/00024_get_coach_dashboard.sql`
- `src/lib/rpc/coach-dashboard.ts`
- `src/lib/rpc/coach-dashboard-types.ts`
- `src/components/coach/KPICard.tsx`
- `src/components/coach/RecentSubmissionsCard.tsx`
- `src/components/coach/WeeklyLeaderboardCard.tsx`
- `src/app/(dashboard)/coach/page.tsx`
- `src/app/api/deals/route.ts`
- `src/app/api/reports/route.ts`
- `src/app/api/work-sessions/route.ts`

## Severity legend

- BLOCKER — must fix before merge
- HIGH — fix before merge if possible
- MEDIUM — fix in a follow-up phase
- LOW — nit, optional
- INFO — note for future maintainers

## Findings

### BLOCKER
None.

### HIGH
None.

### MEDIUM
None.

### LOW

**L1 — `src/lib/rpc/coach-dashboard.ts`: `eslint-disable` on rpc cast**

The fetcher uses `(admin as any).rpc("get_coach_dashboard", ...)` with an `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment. This is consistent with the existing pattern in `src/app/(dashboard)/coach/page.tsx` (line 102) for `get_weekly_skip_counts`, and is necessary because the generated `Database` type does not yet include the new function. A future Phase could regenerate the Supabase types to drop the cast — out of scope here.

**L2 — `src/app/api/deals/route.ts`, `reports/route.ts`, `work-sessions/route.ts`: extra `users.coach_id` lookup on every mutation**

Each invalidation site issues an additional `admin.from("users").select("coach_id").eq("id", studentId)` query. At hot-path scale this is one extra round trip per deal/report/session write. Acceptable for now (writes are low-frequency and the lookup is by primary key — sub-millisecond), but a future optimization would carry `coach_id` through the request lifecycle (e.g., resolve once during auth and reuse) so we don't re-query it.

**L3 — `src/components/coach/RecentSubmissionsCard.tsx`: `formatRelative` rounds toward zero, never up**

For diffs like 59 minutes, the function emits `59m ago`; for 119 minutes, `1h ago` (truncated). Matches the UI-SPEC ("`Nm ago` if < 60m, `Nh ago` if < 24h"). No action needed; documented as intended behavior.

### INFO

**I1 — Migration 00024 reuses the Phase 46 auth pattern verbatim**

The `service_role bypass when auth.uid() IS NULL` comment block was lifted directly from `00023_get_student_analytics.sql`. Intentional and load-bearing — the Next.js API/page server already verifies session identity before calling the RPC via the admin client.

**I2 — `RecentSubmissionsCard.formatRelative` — `Number.isFinite` guard**

If `submitted_at` is malformed (RPC contract guarantees ISO Z), the function returns `""`. Better-than-throwing for a presentational component; the row's `aria-label` will read "rated 0 of 5 stars," which is acceptable degraded behavior.

**I3 — `WeeklyLeaderboardCard.formatHoursLabel` — defensive `Number.isFinite`**

Defensive against a future RPC that might send `null` or `NaN` minutes. Currently the SQL `COALESCE(SUM(...),0)::int` guarantees a non-null integer; the guard is belt-and-suspenders.

## Hard-rule audit (CLAUDE.md)

| Rule | Result |
|---|---|
| 1. `motion-safe:` on every `animate-*` | PASS — no `animate-*` introduced; transitions use `motion-safe:transition-shadow` / `motion-safe:transition-colors` |
| 2. 44px touch targets | PASS — KPICard link, See-all link, row link, leaderboard rows all carry `min-h-[44px]` |
| 3. Accessible labels | PASS — KPICard has sentence-form `aria-label`; report rows have `aria-label`; star icons + decorative icons all `aria-hidden="true"` |
| 4. Admin client in API routes | PASS — every `.from()` in mutated routes uses the existing `createAdminClient` instance |
| 5. Never swallow errors | PASS — every `catch` calls `console.error` with a tagged message |
| 6. Check `response.ok` | N/A — no new `fetch()` calls introduced |
| 7. `import { z } from "zod"` | N/A — no Zod schema added in Phase 47 |
| 8. ima-* tokens only | PASS — no hex literals, no `text-(gray\|slate\|zinc\|neutral)-*` introduced |

## Build gates

- `npx tsc --noEmit` → exit 0
- `npm run lint` on the 10 Phase 47 files → exit 0; zero issues attributable to Phase 47
- `npm run build` → exit 0

## Decision

`status: clean` — no fixes required.
