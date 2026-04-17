# Phase 64 Research: Owner Analytics Expansion (F2 + F3)

**Date:** 2026-04-17
**Mode:** Auto (skip_discuss)

## RESEARCH COMPLETE

## Summary

Phase 64 extends the owner analytics page with three coach leaderboards and six independent 4-window toggles. All 24 pre-computed slots are returned in one RPC call, rendered SSR-first, and swapped client-side with zero re-fetch.

## Current State (Codebase)

### Existing Owner Analytics Assets

- `supabase/migrations/00028_get_owner_analytics.sql` — current RPC: 3 student leaderboards (hours, profit, deals) — **lifetime only**, no window param.
- `src/lib/rpc/owner-analytics.ts` — wraps RPC in `unstable_cache` with cache key `["owner-analytics"]`, tag `OWNER_ANALYTICS_TAG = "owner-analytics"`, 60s TTL.
- `src/lib/rpc/owner-analytics-types.ts` — `OwnerAnalyticsPayload = { leaderboards: { hours_alltime, profit_alltime, deals_alltime } }` + `ownerAnalyticsTag()` helper.
- `src/app/(dashboard)/owner/analytics/page.tsx` — server component, renders 3 LeaderboardCards.
- `src/components/analytics/LeaderboardCard.tsx` — shared primitive, takes `hrefPrefix`; rows are `<Link>` inside `<li>`. Must support a **non-link variant** for coach rows per OA-01.
- `src/components/owner/analytics/OwnerAnalyticsTeaser.tsx` — student-only, unchanged per OA-01.

### Current cache invalidation (`ownerAnalyticsTag()`)

Present in: `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/route.ts`, `src/app/api/work-sessions/[id]/route.ts`.
**Missing in: `src/app/api/reports/route.ts`** — v1.6 audit defer. Phase 64 closes this gap.

### Existing UI primitives

- `src/components/ui/Card.tsx`, `Button.tsx` (CVA + ima-* tokens, `min-h-[44px]`, `motion-safe:` transitions). `Button.variants.size.sm = "min-h-[44px] px-3 text-xs rounded-md gap-1.5"` — a good template for the new `SegmentedControl` segment.
- No existing SegmentedControl / Tabs / Toggle primitive.

### Migration numbering

- Last applied: `00034_activate_tech_setup.sql` (Phase 62).
- `00033` = student analytics outreach split (Phase 61).
- Next: **`00035_expand_owner_analytics_leaderboards.sql`**.

### Tiebreaker pattern (Phase 54)

`ORDER BY metric DESC, LOWER(name) ASC, id::text ASC` — deterministic, case-insensitive.

### Defensive RPC drop pattern (migration 00028:47-59)

```sql
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_owner_analytics'
  LOOP
    EXECUTE format('DROP FUNCTION public.get_owner_analytics(%s) CASCADE', r.args);
  END LOOP;
END $drop$;
```

Prevents PGRST203 on overload collisions.

### Trailing-N-days precedent (migration 00023:71, resolves WS-02)

Window semantics = trailing N days, **NOT** calendar week/month/year:
- Weekly = `created_at >= NOW() - INTERVAL '7 days'`
- Monthly = `created_at >= NOW() - INTERVAL '30 days'`
- Yearly = `created_at >= NOW() - INTERVAL '365 days'`
- All Time = no filter.

`window_days` values for per-day normalization: 7, 30, 365. All Time uses `GREATEST(1, DATE_PART('day', NOW() - MIN(metric_date_col)))` or documented alternative for the avg-outreach denominator.

## Architecture Decisions

### A. RPC shape (24 slots)

```json
{
  "leaderboards": {
    "students": {
      "hours":  { "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] },
      "profit": { "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] },
      "deals":  { "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] }
    },
    "coaches": {
      "revenue":           { "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] },
      "avg_total_outreach":{ "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] },
      "deals":             { "weekly": [...], "monthly": [...], "yearly": [...], "alltime": [...] }
    }
  }
}
```

Every row: `{rank, <id_col>, <name_col>, <metric_col>, metric_display}`. Student rows keep `student_id`/`student_name`; coach rows use `coach_id`/`coach_name`.

### B. Cache-key bump

`["owner-analytics"]` → `["owner-analytics-v2"]` in the same atomic commit as migration 00035. This forces a hard cache miss so the old shape is never served.

### C. Coach leaderboard filter

```sql
FROM users c
WHERE c.role = 'coach'
  AND c.status = 'active'
  AND EXISTS (
    SELECT 1 FROM users s
    WHERE s.coach_id = c.id
      AND s.role IN ('student','student_diy')
      AND s.status = 'active'
  )
```

Coaches with ≥1 assigned active student but zero metric value → appear with 0 (no HAVING clause on coach CTEs; remove the `HAVING ... > 0` pattern used on student CTEs).

### D. avg_total_outreach formula (OA-03, WS-10)

Per-window:
```
SUM(brands_contacted + influencers_contacted) over reports in window where student.coach_id = c.id and student.role IN ('student','student_diy') and student.status='active'
/
(COUNT(DISTINCT student.id) × window_days)
```

For All Time, `window_days` = `GREATEST(1, (CURRENT_DATE - MIN(date_of_first_report_across_coach))::int)` OR a conservative `GREATEST(1, (CURRENT_DATE - (SELECT MIN(date) FROM daily_reports))::int)`. Simpler and defensible: use `GREATEST(1, COALESCE((CURRENT_DATE - MIN(dr.date))::int, 1))` scoped to each coach's reports.

Document in SQL comment.

### E. SegmentedControl primitive

- Path: `src/components/ui/SegmentedControl.tsx`
- CVA + ima-* tokens
- Rendered as `<div role="radiogroup" aria-label=...>` with `<button role="radio" aria-checked=...>` per segment
- `min-h-[44px]`, `motion-safe:transition-colors`
- Arrow-key navigation (ArrowLeft/ArrowRight → previous/next), wrap-around
- Controlled props: `options: {value, label}[]`, `value: string`, `onChange: (v) => void`, `ariaLabel: string`
- Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2`
- Active segment: `bg-ima-primary text-white`
- Inactive: `text-ima-text-secondary hover:bg-ima-surface-light`

### F. SSR + zero client re-fetch

- Server page passes the full 24-slot payload to a new client component `<OwnerAnalyticsClient payload={...} />`.
- Client state: `useState<Window>` per leaderboard (6 independent states), default `"alltime"`.
- Toggle → `setState(newWindow)` → React re-renders from already-delivered payload. No `fetch()`, no `useEffect`-triggered re-fetch.
- Verification grep: `rg -n "fetch\(" src/app/\(dashboard\)/owner/analytics/` must return 0 hits in any new client component.

### G. LeaderboardCard extension

Add `linkRows?: boolean` prop (default `true`). When `false`, render rows as plain `<li>` with internal `<div>` container (no `<Link>`). Same visual style: avatar + rank + name + metric.

Coach leaderboards call with `linkRows={false}`.

### H. Report route invalidation (closes v1.6 defer)

Add to BOTH branches (update-existing-row AND insert-new-row) of `POST /api/reports`:

```ts
try {
  revalidateTag(ownerAnalyticsTag(), "default");
} catch (e) {
  console.error("[revalidate-tag owner-analytics]", e);
}
```

Import: `import { ownerAnalyticsTag } from "@/lib/rpc/owner-analytics-types";`

## Validation Architecture

### Nyquist dimensions
- D1 File shape: migration lints, `psql -c "SELECT get_owner_analytics()"` returns valid jsonb with `leaderboards.students.{hours,profit,deals}.{weekly,monthly,yearly,alltime}` + coaches branch.
- D2 Types: TS types in `owner-analytics-types.ts` match RPC shape exactly.
- D3 Behavior: Toggle changes rendered data without `fetch()`.
- D4 Integration: Report mutation triggers `ownerAnalyticsTag()` revalidation.
- D5 Regression: Existing student teaser unchanged; Phase 54 tiebreaker preserved.
- D6 Hard rules: `min-h-[44px]`, `motion-safe:`, `aria-*`, ima-* only, admin client in API, Zod imports.
- D7 Deterministic output: tiebreaker applied.
- D8 Build gate: `npm run lint && npx tsc --noEmit && npm run build` passes.

### Anti-shallow rules
- All CTEs use concrete coach filter.
- SQL comment on window semantics + avg formula.
- Grep `rg -n "fetch\(" src/app/\(dashboard\)/owner/analytics/` returns 0 hits.
- `grep -c "revalidateTag(ownerAnalyticsTag()" src/app/api/reports/route.ts` returns **2** (both branches).

## Plan Breakdown

1. **Plan 01 — Migration 00035 + RPC shape expansion + types + cache-key bump** (single atomic server commit, wave 1)
2. **Plan 02 — SegmentedControl UI primitive** (wave 1, independent)
3. **Plan 03 — LeaderboardCard extension (`linkRows?: boolean`)** (wave 1, independent)
4. **Plan 04 — Owner analytics client + page refactor (SSR with 6 toggles, no client re-fetch)** (wave 2, depends on 01+02+03)
5. **Plan 05 — `/api/reports` route ownerAnalyticsTag invalidation (closes v1.6 defer)** (wave 1, independent)
6. **Plan 06 — Build gate + verification (lint+tsc+build)** (wave 3, depends on 04+05)
