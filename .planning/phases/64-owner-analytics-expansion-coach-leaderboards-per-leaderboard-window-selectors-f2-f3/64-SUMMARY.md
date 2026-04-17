# Phase 64: Owner Analytics Expansion — Coach Leaderboards + Per-Leaderboard Window Selectors (F2 + F3)

**Shipped:** 2026-04-17
**Status:** Complete
**Plans:** 6 (waves 1-3)

## What Was Built

- Expanded `get_owner_analytics` RPC from 3 lifetime leaderboards (hours/profit/deals) to **24 pre-computed slots** (6 leaderboards × 4 trailing-N-days windows) via migration `00035_expand_owner_analytics_leaderboards.sql`.
- Added **3 coach leaderboards** (revenue, avg total outreach per student per day, deals) below the 3 student leaderboards on `/owner/analytics`.
- New `SegmentedControl` UI primitive (radiogroup + radio + arrow-key nav + 44px + ima-* tokens).
- **6 independent window toggles** (Weekly / Monthly / Yearly / All Time) — one per leaderboard — default "All Time".
- **SSR-only, zero client re-fetch** — client component swaps pre-computed slices on toggle; no `fetch()` or `useEffect` re-fetch.
- **LeaderboardCard extended** with `linkRows?: boolean` (non-linked rows for coach leaderboards per OA-01).
- **Closed v1.6 deferred ownerAnalyticsTag invariant** — `/api/reports` now calls `revalidateTag(ownerAnalyticsTag(), "default")` on both update and insert branches.
- **Cache-key bump** from `["owner-analytics"]` to `["owner-analytics-v2"]` in the same atomic commit as migration 00035.

## Key Decisions

- **WS-02 ambiguity resolved**: trailing N days (7/30/365), NOT calendar periods.
- **Coach eligibility**: `role='coach' AND status='active' AND EXISTS (active assigned student)`. Coaches with ≥1 active student but zero metric value appear with 0 (no HAVING filter).
- **Cache TAG unchanged** (`owner-analytics`) so all existing `revalidateTag(ownerAnalyticsTag())` call sites keep working.
- **Tiebreaker**: `ORDER BY metric DESC, LOWER(name) ASC, id::text ASC` applied across all 24 ranked CTEs.
- **avg_total_outreach formula** documented in SQL header + SQL comment: `SUM(brands+influencers) / (COUNT(DISTINCT students) × window_days)`.

## Files

- `supabase/migrations/00035_expand_owner_analytics_leaderboards.sql` (new)
- `src/lib/rpc/owner-analytics-types.ts` (reshaped to V2)
- `src/lib/rpc/owner-analytics.ts` (cache key bump)
- `src/components/ui/SegmentedControl.tsx` (new)
- `src/components/analytics/LeaderboardCard.tsx` (linkRows prop)
- `src/app/(dashboard)/owner/analytics/page.tsx` (thin server component)
- `src/app/(dashboard)/owner/analytics/OwnerAnalyticsClient.tsx` (new — 6 toggles)
- `src/app/api/reports/route.ts` (ownerAnalyticsTag on both branches)
- `src/components/owner/analytics/OwnerAnalyticsTeaser.tsx` (reads .alltime slice of new shape)

## Verification

- 9/9 must-haves verified.
- 18/18 requirements (OA-01..08, WS-01..10) satisfied.
- Build gate green: `npm run lint` (0 errors), `npx tsc --noEmit` (0 errors), `npm run build` (success).
- Shape-asserts green: 0 `fetch(` in analytics dir; 2 `revalidateTag(ownerAnalyticsTag())` in `/api/reports`; cache key = `owner-analytics-v2`.
