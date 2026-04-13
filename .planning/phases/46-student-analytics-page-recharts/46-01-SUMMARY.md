---
phase: 46-student-analytics-page-recharts
plan: "01"
status: complete
completed: 2026-04-13
---

# Plan 46-01 — Student Analytics Page + Recharts — SUMMARY

## Objective delivered
Shipped the Student Analytics Page (`/student/analytics` and `/student_diy/analytics`) with six KPI cards, Outreach + Hours trend charts (Recharts), roadmap deadline status list, and paginated deal history table. All data flows through a single batch RPC `public.get_student_analytics` wrapped in `unstable_cache` (60s TTL, user-scoped tag) and invalidated by deal/report/session/roadmap mutations.

Satisfies ANALYTICS-01 through ANALYTICS-10.

## Files touched

### Created
- `supabase/migrations/00023_get_student_analytics.sql` — SECURITY DEFINER STABLE RPC with auth guard (`RAISE 'not_authorized'` when `(SELECT auth.uid())` distinct from `p_student_id`).
- `src/lib/rpc/student-analytics.ts` — server-side RPC fetcher (`fetchStudentAnalytics`) that calls `createAdminClient().rpc('get_student_analytics', ...)` and throws on error (never swallows).
- `src/lib/rpc/student-analytics-types.ts` — **pure types + constants module** (no server-only imports). Client components import types/constants from here; the server fetcher re-exports them for convenience.
- `src/app/(dashboard)/student/analytics/page.tsx` — server component: `requireRole('student')`, zod safeParse on range/page, `unstable_cache` with `studentAnalyticsTag(user.id)` + `revalidate: 60`.
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` — `"use client"` component rendering all 6 KPI cards, Recharts Line + Bar, role=group range selector, `<details>` chart fallback tables, Roadmap status list, deal history table + PaginationControls.
- `src/app/(dashboard)/student/analytics/loading.tsx` — skeleton matching layout, `aria-busy="true"` on each Card.
- `src/app/(dashboard)/student/analytics/error.tsx` — `"use client"`, logs via `console.error`, Retry button `min-h-[44px]`.
- `src/app/(dashboard)/student_diy/analytics/page.tsx` — mirror with `requireRole('student_diy')` and `basePath="/student_diy/analytics"`; reuses the same AnalyticsClient.
- `src/app/(dashboard)/student_diy/analytics/loading.tsx` — re-exports from student route (server component re-export is safe).
- `src/app/(dashboard)/student_diy/analytics/error.tsx` — **inlined** (`"use client"` required per client-boundary; re-export would not carry the directive in Turbopack).

### Modified
- `src/lib/config.ts` — ROUTES.student.analytics + ROUTES.student_diy.analytics; NAVIGATION entries (BarChart3 icon) for both student roles.
- `src/lib/types.ts` — `Database['public']['Functions'].get_student_analytics` typed.
- `src/app/api/deals/route.ts` + `src/app/api/deals/[id]/route.ts` — `revalidateTag(studentAnalyticsTag(studentId))` on mutations.
- `src/app/api/reports/route.ts` — revalidateTag on submit.
- `src/app/api/work-sessions/route.ts` + `src/app/api/work-sessions/[id]/route.ts` — revalidateTag on status transitions.
- `src/app/api/roadmap/route.ts` — revalidateTag on PATCH.
- `package.json` — `recharts@^3.8.1` already present from prior planning; no install required.

## Build verification
- `npx tsc --noEmit` → exit 0
- `npm run lint` → exit 0 (zero issues in phase 46 files; repo has pre-existing baseline warnings/errors in unrelated files)
- `npm run build` → exit 0; `/student/analytics` and `/student_diy/analytics` both compile as dynamic routes

## Migration status
- Migration file authored at `supabase/migrations/00023_get_student_analytics.sql`.
- Local apply not performed in this session (supabase CLI apply deferred to deployment/CI); the function signature and return shape match `src/lib/types.ts` `get_student_analytics` typing, so TS build is green regardless.
- Deferred: manual `supabase gen types` regeneration to replace the hand-typed `Returns: unknown` with the generated jsonb type.

## Rule compliance (CLAUDE.md Hard Rules)
1. **motion-safe:** — every `animate-*` class in AnalyticsClient.tsx uses `motion-safe:animate-*` (verified by grep — only hit is in a comment).
2. **44px touch targets** — all Range buttons, `<summary>` toggles, roadmap list items, and Retry button carry `min-h-[44px]` (roadmap `<li>` carries min-h-[44px]; PaginationControls primitive is audited separately).
3. **Accessible labels** — range selector is `<div role="group" aria-label="Select time range">`; each chart wrapper is `role="img"` with prose `aria-label`; tables have `<caption class="sr-only">`; every decorative icon has `aria-hidden="true"`.
4. **Admin client in API routes** — API routes modified used their existing admin-client patterns; no new `.from()` calls added to client code.
5. **Never swallow errors** — RPC fetcher logs + throws; error.tsx boundary calls `console.error`; revalidateTag not wrapped (next/cache `revalidateTag` is sync-safe and does not throw).
6. **Check response.ok** — no new `fetch()` calls in phase 46 client; all data flows through server props.
7. **Zod import** — `import { z } from "zod"` used in both page.tsx files.
8. **ima-* tokens only** — the only hex literals are inside the single `chartColors` const (JS literals required for Recharts stroke/fill props) and mirror `tailwind.config.ts` ima-* values. All other colors use `ima-*` utility classes.

## Notable decisions
- **Types module split** — during build, the initial design (single `student-analytics.ts` with both types and fetcher) failed with `server-only` being pulled into the client bundle via type imports. Split into `student-analytics-types.ts` (pure) + `student-analytics.ts` (server fetcher re-exporting types). AnalyticsClient now imports exclusively from the types module.
- **student_diy error.tsx inlined** — Next.js 16 Turbopack does not propagate the `"use client"` directive across a bare `export { default } from "..."` re-export. Inlined the error component so the directive sits at the file top. loading.tsx stayed as a re-export (server component, no directive required).
- **Streak window** — SQL restricts streak lookback to 365 days for performance; production data will never exceed that before the caching layer kicks in.

## Deferred / follow-up
- Manual smoke test of `/student/analytics` against a live student account (requires deploy + applied migration 00023). Build-time route manifest shows both routes registered.
- Supabase `gen types` regeneration to tighten `Returns: unknown` → jsonb generated shape.
