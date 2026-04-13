---
phase: 48-full-coach-analytics-page
plan: "01"
type: execute
status: complete
completed_at: 2026-04-13
requirements:
  - COACH-ANALYTICS-01
  - COACH-ANALYTICS-02
  - COACH-ANALYTICS-03
  - COACH-ANALYTICS-04
  - COACH-ANALYTICS-05
  - COACH-ANALYTICS-06
  - COACH-ANALYTICS-07
---

# Phase 48 / Plan 01 — Full Coach Analytics Page: Summary

## Artifacts Shipped

**SQL (1 new migration):**
- `supabase/migrations/00025_get_coach_analytics.sql` — single batch RPC
  `public.get_coach_analytics(p_coach_id uuid, p_window_days int, p_today date, p_leaderboard_limit int, p_page int, p_page_size int, p_sort text, p_search text) RETURNS jsonb`
  with SECURITY DEFINER, STABLE, `search_path = public`. Returns envelope
  `{stats, leaderboards, deals_trend, active_inactive, students, pagination}`.
  Copies the Phase 46/47 auth guard pattern verbatim (service_role bypass,
  mismatched authenticated caller rejected with `not_authorized`/42501).
  Reuses Phase 44's `student_activity_status()` helper for both the
  active/inactive header chip and per-student `activity_status` column.
  Embedded `DO $$` ASSERTs verify signature, zero-student envelope shape,
  and param clamping.

**TypeScript / Next.js (new):**
- `src/lib/rpc/coach-analytics-types.ts` — pure types + `coachAnalyticsTag`
  helper + `COACH_ANALYTICS_PAGE_SIZE` (25) + `CoachAnalyticsSort` union.
  Zero server-only imports.
- `src/lib/rpc/coach-analytics.ts` — `import "server-only"` top-of-file;
  exports `fetchCoachAnalytics` (uncached, used by CSV route) and
  `getCoachAnalyticsCached` (wraps `unstable_cache` 60s TTL, tag
  `coach-analytics:${coachId}`).
- `src/lib/schemas/coach-analytics-params.ts` — Zod schema + safeParse
  helper; `import { z } from "zod"`; page [1,10000], pageSize literal 25,
  sort enum (12 keys), search trimmed max 100.

**Page + boundaries (rewritten):**
- `src/app/(dashboard)/coach/analytics/page.tsx` — fully rewritten. Legacy
  in-page Supabase queries (prior ~200 LOC) deleted. Now a thin server
  component: `requireRole("coach")` → Zod parse searchParams (redirect on
  fail) → `getCoachAnalyticsCached` → render `CoachAnalyticsClient`. The
  pre-existing no-students `EmptyState` branch is preserved verbatim for
  first-time coaches.
- `src/app/(dashboard)/coach/analytics/loading.tsx` — composite skeleton
  (header + 5 KPIs + 3 leaderboards + chart + 25-row table) under a single
  `role="status"` `aria-label="Loading coach analytics"` wrapper.
- `src/app/(dashboard)/coach/analytics/error.tsx` — `useEffect(console.error)`
  + "Couldn't load analytics" + Try Again button.

**Feature components (7 new, under `src/components/coach/analytics/`):**
- `CoachAnalyticsClient.tsx` — "use client" orchestrator; `useRouter` +
  `useTransition`; URL-mutating callbacks for sort/search/page.
- `KPIGrid.tsx` — 5 cards (Highest Deals / Total Revenue / Avg Roadmap Step
  / Avg Email Count / Most Emails Sent) with tinted icon boxes matching
  Phase 47 geometry.
- `LeaderboardCard.tsx` — single card instanced 3× for hours-this-week,
  emails-this-week, all-time-deals; rank #1 uses `bg-ima-primary text-white`
  pill; ranks 2–5 use muted text; avatar circles match Phase 47.
- `DealsTrendChart.tsx` — "use client" Recharts BarChart with `role="img"`
  + `tabIndex={0}` wrapper, `<details>` text fallback, `isAnimationActive=
  {false}` (prefers-reduced-motion), single `chartColors` const with
  mandatory ima-token comment — the ONLY hex literals in the phase.
- `StudentListTable.tsx` — "use client" sortable table with real `<button>`
  headers, `aria-sort` on each `<th>`, `ChevronsUpDown`/`ChevronUp`/
  `ChevronDown` indicator, 300ms debounced search input with Escape-to-
  clear, and `PaginationControls` primitive reused unchanged. Empty states
  for no-students vs no-search-match (with Clear search CTA).
- `ExportCsvButton.tsx` — "use client"; `window.location.href` download
  with 1500ms cooldown; `aria-busy` during export.
- `ActiveInactiveChip.tsx` — two-half pill with `role="status"` + sentence-
  form `aria-label` + native `title` definition.

**API route (new):**
- `src/app/api/coach/analytics/export.csv/route.ts` — `GET` with
  `dynamic="force-dynamic"`. Auth-gated to coach role. Zod-validates sort +
  search. Calls `fetchCoachAnalytics` with `pageSize=5000` (hard cap);
  rejects 400 "Export too large." beyond cap. Builds RFC-4180 CSV via
  inline `csvEscape`; returns `text/csv; charset=utf-8` with
  `Content-Disposition: attachment; filename="coach-analytics-{id}-{today}.csv"`
  and `Cache-Control: no-store`.

**Cache invalidation (3 existing routes updated):**
- `src/app/api/deals/route.ts` — import `coachAnalyticsTag`; add
  `revalidateTag(coachAnalyticsTag(coachId))` alongside existing
  `coachDashboardTag` call in both POST success branches (initial + retry).
- `src/app/api/reports/route.ts` — same pattern (covers insert AND
  edit/resubmit branches).
- `src/app/api/work-sessions/route.ts` — same pattern (POST complete).
- All three files import from the pure types file
  `@/lib/rpc/coach-analytics-types` so no server-only import chain drags
  into the route handlers unintentionally.

## Hard-Rule Compliance (CLAUDE.md)

- `motion-safe:` — every transition/hover effect uses `motion-safe:`; grep
  for unprefixed `animate-*` in changed files returns 0 matches.
- `min-h-[44px]` — every interactive link/button (sort headers, row links,
  name-cell links, search clear, pagination, Export) carries it.
- `aria-label` — sort buttons, search input, clear button, export button,
  KPI cards, leaderboard row links, chart wrapper all have sentence-form
  labels; search input has matching `<label htmlFor>` with `sr-only`.
- Admin client in API — CSV route uses `fetchCoachAnalytics` which uses
  `createAdminClient` internally; all three mutation-route additions are
  inside handlers that already use the admin client.
- Never swallow errors — every `try/catch` console.errors; the CSV route's
  top-level catch returns a 500 body and logs.
- Response.ok — no new `fetch()` in client code; export uses
  `window.location.href` (browser handles the download).
- Zod import — every new schema uses `import { z } from "zod"`, never
  `"zod/v4"`.
- `ima-*` tokens only — `grep -rE "(text|bg|border)-(gray|slate|zinc|neutral)-"`
  in changed files returns 0; `grep -rE "#[0-9a-fA-F]{3,8}"` returns exactly
  3 matches (all inside the documented `chartColors` const in
  `DealsTrendChart.tsx`). `text-white` only appears on the rank-#1 badge
  and avatar circles.
- `px-4` page wrapper — `px-4 py-6 max-w-7xl mx-auto` on all three route
  entrypoints (`page.tsx`, `loading.tsx`, `error.tsx`).

## Build + Lint + Type-check

- `npx tsc --noEmit` → exits 0.
- `npx eslint` on all 15 new files + 3 modified routes → 0 errors, 0
  warnings (project-wide lint has pre-existing noise elsewhere, none in
  Phase 48 surface).
- `npm run build` → successful production build; `/coach/analytics` listed
  as `ƒ` (dynamic) route alongside the rest of the coach tree.

## Requirement Coverage

- **COACH-ANALYTICS-01** — 5 aggregate KPIs (Highest Deals, Total Revenue,
  Avg Roadmap Step, Avg Email Count, Most Emails Sent) rendered via
  `KPIGrid`.
- **COACH-ANALYTICS-02** — 3 top-5 leaderboards (hours-this-week,
  emails-this-week, all-time-deals) rendered via `LeaderboardCard ×3`.
- **COACH-ANALYTICS-03** — 12-week "Deals Closed Over Time" chart rendered
  via `DealsTrendChart`; RPC pads to exactly 12 buckets oldest-first.
- **COACH-ANALYTICS-04** — Active/Inactive header chip rendered via
  `ActiveInactiveChip`, computed from Phase 44's `student_activity_status`
  helper.
- **COACH-ANALYTICS-05** — 25/page paginated list with 6 sortable columns
  (name, hours, emails, deals, step, lastActive) driven by Zod-validated
  URL `sort` enum.
- **COACH-ANALYTICS-06** — Server-side name search via `ILIKE`, 300ms
  debounce, Escape-to-clear, URL-backed.
- **COACH-ANALYTICS-07** — Single batch RPC `get_coach_analytics`, wrapped
  in `unstable_cache(60s)` with tag `coach-analytics:${coachId}`,
  invalidated by deals/reports/work-sessions mutation handlers; all data
  scoped to `coach_id = p_coach_id AND status = 'active'` assigned students
  only.

## Follow-ups (out of scope for Phase 48)

- UAT verification of search/sort round-trip with real data (gsd-verify-work).
- Performance profiling of `get_coach_analytics` at 5k-student tenants
  (PERF-01 already satisfied by Phase 44 indexes).
- Phase 51 will add milestone-notification invalidation hooks that also
  target `coachAnalyticsTag` — no change needed here.
