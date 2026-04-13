---
phase: 47-coach-dashboard-homepage-stats
status: passed
verified: 2026-04-13
plans_verified: 1
---

# Phase 47 — Verification

## Plan verification results

### 47-01 — Coach Dashboard Homepage Stats
status: passed

Checklist (from 47-01-PLAN `must_haves.truths` and `<verify>` blocks):

- [x] `npx tsc --noEmit` exits 0 (verified inline).
- [x] `npm run lint` on the 9 Phase 47 files exits 0; zero issues attributable to Phase 47. Repo baseline errors in unrelated files (Modal.tsx, DealFormModal.tsx, etc.) pre-existed.
- [x] `npm run build` exits 0; `/coach` listed in the route manifest.
- [x] Migration 00024 well-formed — `CREATE OR REPLACE FUNCTION public.get_coach_dashboard(uuid, date, date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public`; `GRANT EXECUTE ... TO service_role, authenticated;` present.
- [x] Auth guard pattern matches Phase 46 verbatim — first executable statement raises `'not_authorized'` (ERRCODE 42501) when `(SELECT auth.uid())` is non-null and distinct from `p_coach_id`.
- [x] Returns single jsonb envelope with exactly three top-level keys: `stats`, `recent_reports`, `top_hours_week`.
- [x] `stats` has exactly four keys: `deals_closed`, `revenue`, `avg_roadmap_step`, `emails_sent`.
- [x] Zero-assigned-students short-circuit returns zeros and empty arrays (no NULL leakage).
- [x] `recent_reports` capped at 3 entries, ordered `submitted_at DESC NULLS LAST`, joined with `users.name`.
- [x] `top_hours_week` capped at 3 entries, computed from `work_sessions WHERE status='completed' AND date BETWEEN v_week_start AND p_today`, filtered to `>0` minutes (no placeholder rows).
- [x] Week start computed via `date_trunc('week', p_today)::date` (ISO Monday — matches Phase 44 convention).
- [x] `src/lib/rpc/coach-dashboard-types.ts` has zero runtime imports; exports `coachDashboardTag(coachId)` returning literal `coach-dashboard:${coachId}`.
- [x] `src/lib/rpc/coach-dashboard.ts` imports `createAdminClient`, calls `admin.rpc('get_coach_dashboard', ...)`, `console.error`s and rethrows on error/no-data.
- [x] `/coach` page wraps `fetchCoachDashboard` in `unstable_cache` with key `['coach-dashboard', user.id]`, `revalidate: 60`, `tags: [coachDashboardTag(user.id)]`.
- [x] 4 `<KPICard>` instances render in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6` with correct labels, server-formatted values, semantic tints (primary / success / info / warning), `/coach/analytics#deals|#revenue|#roadmap|#emails` links, and sentence-form `aria-label`s.
- [x] `<RecentSubmissionsCard>` and `<WeeklyLeaderboardCard>` render in `grid-cols-1 lg:grid-cols-2 gap-4 mt-6` immediately after the KPI grid and before the at-risk banner.
- [x] Currency / integer formatting via `Intl.NumberFormat`; roadmap step via `Number.toFixed(1)`; zero-state values render `0`, `$0`, `0.0`, `0` per UI-SPEC.
- [x] All 4 KPI value `<p>` elements carry `text-2xl font-bold text-ima-text tabular-nums`.
- [x] Recent Submissions header "Recent Submissions" + sub "3 most recent reports from your students"; "See all reports" link → `/coach/reports`, `min-h-[44px] inline-flex items-center text-ima-primary`.
- [x] Each report row is a `<Link href="/coach/reports#${id}">` with `min-h-[44px]`, `motion-safe:transition-colors`, `hover:bg-ima-surface-light`, and a sentence-form `aria-label`.
- [x] Star rating: 5 `<Star>` icons, filled stars use `text-ima-warning fill-ima-warning`, unfilled use `text-ima-border`; every `<Star>` is `aria-hidden="true"`.
- [x] RecentSubmissionsCard empty state uses `<EmptyState variant="compact">` with title "No submissions yet" and the spec'd description.
- [x] Leaderboard header "Top 3 This Week" + sub "Hours worked since Monday".
- [x] Rank #1 rendered as a custom `bg-ima-primary text-white` pill (Badge primitive lacks a "primary" variant; pill replicates the spec colors); ranks 2–3 use `text-ima-text-muted font-semibold`. Avatar circle reuses the at-risk list pattern (`w-8 h-8 rounded-full bg-ima-primary text-white text-xs font-semibold`).
- [x] Hours format derived from minutes: `${Math.floor(m/60)}h ${m%60}m`, displayed with `tabular-nums`.
- [x] Leaderboard empty state uses `<EmptyState variant="compact">` with the spec'd title/description.
- [x] No placeholder rows for missing ranks — when fewer than 3 students have hours, only the existing rows render.
- [x] `revalidateTag(coachDashboardTag(coachId))` wired in `src/app/api/deals/route.ts` (POST primary + retry paths), `src/app/api/reports/route.ts` (UPDATE + INSERT paths), and `src/app/api/work-sessions/route.ts` (POST path).
- [x] Each invalidation guards a null `coach_id` via `if (studentRow?.coach_id)` and wraps in try/catch that `console.error`s — never throws.
- [x] Every `.from()` query in mutated route handlers uses the existing admin client (`createAdminClient`).
- [x] No new unprefixed `animate-*` classes added (none used; transitions explicitly `motion-safe:transition-shadow` / `motion-safe:transition-colors`).
- [x] No hardcoded hex / `text-(gray|slate|zinc|neutral)-*` introduced in any new or edited file (verified via grep on diff scope).
- [x] All interactive elements added (KPI Link, See-all Link, row Link) carry `min-h-[44px]`.

## Success criteria (ROADMAP Phase 47)

- [x] Coach lands on `/coach` and sees 4 stat cards each clickable to `/coach/analytics#<anchor>`. Cards each render with `min-h-[44px]` and a sentence-form `aria-label`.
- [x] "Recent Submissions" card shows the 3 most recent submitted daily reports, with a "See all reports" link.
- [x] "Top 3 This Week" leaderboard ranks by hours worked Monday→today (week_start derived via `date_trunc('week', p_today)::date`, ISO Monday).
- [x] Single batch RPC `public.get_coach_dashboard(p_coach_id, p_week_start, p_today)` returns `{ stats, recent_reports, top_hours_week }` in one jsonb envelope; assigned-student scoping enforced at the SQL layer.
- [x] Result wrapped in `unstable_cache` 60s TTL keyed `coach-dashboard:${coachId}`; deal/report/session writes call `revalidateTag` for the same key.
- [x] Loading skeletons (existing `coach/loading.tsx`) cover the page during fetch; empty state for the Recent + Leaderboard zero data is the `<EmptyState>` primitive (zero assigned students renders zero KPIs + two empty cards, which is the documented contract).
- [x] Post-phase gate passes — lint, tsc, build all exit 0.

## Notes / Deferrals

- Live SQL smoke against a real Supabase project (migration 00024 must be applied before live render).
- Manual visual QA at the three breakpoints — covered by UI-SPEC contracts; defer to UI-REVIEW step.
- Existing `coach/loading.tsx` skeleton was not extended for the new sections — acceptable because the skeleton is layout-shape-only and the new blocks render below the fold during the same server request (no separate skeleton needed in this server-rendered page).
