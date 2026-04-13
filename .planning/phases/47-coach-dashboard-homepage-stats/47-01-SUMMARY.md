---
phase: 47-coach-dashboard-homepage-stats
plan: "01"
status: complete
completed: 2026-04-13
---

# Plan 47-01 — Coach Dashboard Homepage Stats — SUMMARY

## Objective delivered
Shipped the Coach Dashboard Homepage Stats additions on `/coach`: 4 KPI cards
(Deals Closed, Revenue Generated, Avg Roadmap Step, Emails Sent), a Recent
Submissions card with the 3 most recent submitted reports, and a Top-3 Weekly
Hours leaderboard. All three blocks are sourced from one batch RPC
`public.get_coach_dashboard`, wrapped in `unstable_cache` (60s TTL,
per-coach key) with cache tag `coach-dashboard:${coachId}` invalidated by
mutations from `/api/deals`, `/api/reports`, and `/api/work-sessions`.

Satisfies COACH-DASH-01 through COACH-DASH-07.

## Files touched

### Created
- `supabase/migrations/00024_get_coach_dashboard.sql` — `SECURITY DEFINER STABLE` RPC. First statement raises `'not_authorized'` (ERRCODE 42501) when `(SELECT auth.uid())` is non-null and distinct from `p_coach_id`. Returns one jsonb envelope `{ stats, recent_reports, top_hours_week }`. Reuses Phase 44 indexes; reuses Phase 46 auth pattern verbatim.
- `src/lib/rpc/coach-dashboard-types.ts` — pure types module, zero runtime imports. Exports `CoachDashboardStats`, `CoachRecentReport`, `CoachTopHoursRow`, `CoachDashboardPayload`, and `coachDashboardTag(coachId)` helper.
- `src/lib/rpc/coach-dashboard.ts` — server-only fetcher (`fetchCoachDashboard`) that calls `createAdminClient().rpc('get_coach_dashboard', ...)` and rethrows on error. Re-exports types + tag for ergonomic single-source server import.
- `src/components/coach/KPICard.tsx` — reusable KPI card link. Composes existing `<Card>` + `<CardContent>` exactly like the legacy 3 stat cards. Tinted icon box, value uses `tabular-nums`, link wrapper carries `min-h-[44px]`, `motion-safe:transition-shadow`, `focus-visible:outline-2`, and a sentence-form `aria-label`.
- `src/components/coach/RecentSubmissionsCard.tsx` — server component with header + "See all reports" link (`min-h-[44px]`), 0–3 row links (each `min-h-[44px]`, `motion-safe:transition-colors`, `aria-label` describing student + rating + relative time), 5-star icons (`fill-ima-warning` for rated, `text-ima-border` for unrated, all `aria-hidden="true"`), and `<EmptyState variant="compact">` for the zero state.
- `src/components/coach/WeeklyLeaderboardCard.tsx` — server component with header, 0–3 rows (rank #1 rendered as a custom `bg-ima-primary text-white` pill, ranks 2–3 as `text-ima-text-muted` labels), avatar circle reuses the existing at-risk list pattern, hours rendered as `${h}h ${m}m` with `tabular-nums`, `<EmptyState variant="compact">` for zero state. Never renders placeholder rows for missing ranks.

### Modified
- `src/app/(dashboard)/coach/page.tsx` — added `unstable_cache` wrapper around `fetchCoachDashboard` keyed `["coach-dashboard", user.id]` with `revalidate: 60` and `tags: [coachDashboardTag(user.id)]`. Server-formats KPI values via `Intl.NumberFormat` (currency + integer) and `Number.toFixed(1)` for the roadmap step. Renders the new KPI grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6`) and the Recent + Leaderboard grid (`grid-cols-1 lg:grid-cols-2 gap-4 mt-6`) between the existing 3-stat cards and the at-risk banner. Existing greeting / 3 stat cards / at-risk banner / student grid untouched.
- `src/app/api/deals/route.ts` — imports `coachDashboardTag`, then on both POST success paths (initial and 23505 retry) looks up the affected student's `coach_id` and calls `revalidateTag(coachDashboardTag(coachId))` inside a `try/catch` that `console.error`s on failure (never bubbles up).
- `src/app/api/reports/route.ts` — same pattern at both the UPDATE path and the INSERT path.
- `src/app/api/work-sessions/route.ts` — same pattern at the POST success path.

## Build verification
- `npx tsc --noEmit` → exit 0
- `npm run lint` (only the 9 Phase 47 files) → exit 0; zero issues. Repo-wide baseline lint errors (`Modal.tsx refs`, `DealFormModal.tsx setState in effect`, `coach/page.tsx purity`, etc.) pre-existed and are unrelated to Phase 47.
- `npm run build` → exit 0; `/coach` compiles as a dynamic route alongside the rest.

## Known deferrals
- Live RPC smoke against a real Supabase project (migration 00024 must be applied before the route renders against production data).
- Manual visual QA at <640px / 640–1023px / >=1024px breakpoints — covered by UI-SPEC contracts; deferred to UI-REVIEW step.
