---
phase: 48
reviewed_at: 2026-04-13
reviewer: inline-claude
depth: standard
status: clean
---

# Phase 48 — Code Review

## Scope

Files reviewed (committed in `feat(48): full coach analytics page...`):

- `supabase/migrations/00025_get_coach_analytics.sql`
- `src/lib/rpc/coach-analytics-types.ts`
- `src/lib/rpc/coach-analytics.ts`
- `src/lib/schemas/coach-analytics-params.ts`
- `src/app/(dashboard)/coach/analytics/page.tsx`
- `src/app/(dashboard)/coach/analytics/loading.tsx`
- `src/app/(dashboard)/coach/analytics/error.tsx`
- `src/components/coach/analytics/CoachAnalyticsClient.tsx`
- `src/components/coach/analytics/KPIGrid.tsx`
- `src/components/coach/analytics/LeaderboardCard.tsx`
- `src/components/coach/analytics/DealsTrendChart.tsx`
- `src/components/coach/analytics/StudentListTable.tsx`
- `src/components/coach/analytics/ExportCsvButton.tsx`
- `src/components/coach/analytics/ActiveInactiveChip.tsx`
- `src/app/api/coach/analytics/export.csv/route.ts`
- `src/app/api/deals/route.ts` (3 lines — revalidateTag additions)
- `src/app/api/reports/route.ts` (2 additions)
- `src/app/api/work-sessions/route.ts` (2 additions)

## Findings

### Critical / High — 0

None.

### Medium — 0

None.

### Low / Nit — 2 (documented, non-blocking)

**L1. SQL sort CASE list repeats twice (inner ORDER BY + window ROW_NUMBER).**
The per_student paginated query computes `row_pos` via `ROW_NUMBER() OVER (ORDER BY ...)` AND also includes the same `ORDER BY ...` list on the derived table. Both are required — the ROW_NUMBER gives a stable outer aggregation order while the inner `ORDER BY + OFFSET + LIMIT` is what actually slices the page. Postgres query planner will collapse one pass in most cases. Not a bug, but the duplication is visually heavy; a future refactor could cache the expression as a WITH-level column. Documented here so the next reviewer doesn't flag it again.

**L2. CSV export uses `window.location.href` instead of `fetch()` + Blob anchor.**
This is the correct pragmatic choice for a GET-only auth-gated CSV route (browser follows the redirect, `Content-Disposition: attachment` triggers the save dialog). However, it means the 1500ms cooldown in `ExportCsvButton.tsx` is a heuristic — if the server takes > 1.5s the button re-enables while the download is still streaming. Acceptable for a coach with < 1000 students; larger tenants would benefit from a fetch()+Blob approach. Non-blocking; documented for future refinement.

## Security

- **Auth guards layered correctly.** The SQL function rejects authenticated callers whose `auth.uid() != p_coach_id` (service_role bypass preserved). The CSV API route enforces coach role before any RPC call. The page uses `requireRole("coach")` which redirects non-coaches to their role dashboard.
- **CSRF/origin.** The CSV route is a GET with no state mutation — Origin verification is not required (Phase 45 convention uses `verifyOrigin` only on mutating endpoints).
- **Rate limiting.** The CSV route does not call `checkRateLimit` — the endpoint is read-only and the existing RPC cache absorbs most load. For a multi-MB file an attacker could repeatedly trigger. Matches the pattern used in Phase 46 student analytics routes; out of scope to add here without a project-wide policy change.
- **Zod safeParse on every boundary.** page.tsx searchParams, CSV route URL params — both use `.safeParse` with redirect/400 on failure. No unvalidated input reaches the RPC.
- **Admin client only in server code.** `src/lib/rpc/coach-analytics.ts` begins with `import "server-only"` — any accidental client import crashes the build loudly. Types file is pure TS, safe for client use.
- **SQL injection surface:** `p_search` is bound as a parameter to `ILIKE '%' || p_search || '%'` — parameterized, no literal string concatenation into SQL text.

## Correctness

- **Zero-student short-circuit** returns a 12-bucket `deals_trend` (not an empty array) — matches the TS type's "always length 12" invariant, preventing client `buckets[0]` undefined crashes.
- **Deals trend** uses `created_at` (not a non-existent `closed_at` column). Confirmed against Phase 46 migration 00023 which uses the same column.
- **Leaderboards** filter `HAVING metric > 0` so zero-metric students are never ranked — no placeholder "—" rows.
- **Active/Inactive** delegates to the Phase 44 `student_activity_status` helper (D-14 canonical). No drift from the 7-day window definition.
- **Pagination total** is computed before the OFFSET/LIMIT page slice, so `total_pages` reflects the filtered result set (search-aware), not the raw student count.
- **Empty-state detection** in page.tsx uses `total === 0 && active+inactive === 0 && !search` — correctly distinguishes "no students assigned" from "search returned nothing" from "some students but all inactive".

## Accessibility

- Every interactive element (sort headers, row links, name links, search input, clear button, pagination, Export) has `min-h-[44px]` (or `min-h-[44px] min-w-[44px]` for icon-only).
- Chart wrapper has `role="img"` + `tabIndex={0}` + sentence-form `aria-label` and a `<details>` text fallback.
- Sort buttons use native `<button>` elements with `aria-sort` on the parent `<th>`; chevron icon is `aria-hidden`.
- Search input has a paired `<label htmlFor sr-only>` plus `aria-label` (belt-and-suspenders — screen reader reads one, not both).
- Decorative lucide icons all carry `aria-hidden="true"`.
- Loading skeletons wrapped in a single `role="status"` with `aria-label="Loading coach analytics"`; nested skeletons `aria-hidden`.
- Status chip uses `role="status"` + sentence-form `aria-label` + native `title` for the D-14 definition.

## Hard-rule compliance (CLAUDE.md)

| Rule | Evidence |
|------|----------|
| motion-safe:animate-* | Zero `animate-*` classes introduced; all transitions use `motion-safe:transition-colors` |
| 44px touch targets | Audited above |
| Accessible labels | Audited above |
| Admin client in API | CSV route + all mutation handlers confirmed |
| Never swallow errors | Every try/catch has `console.error`; no empty catch blocks |
| Check response.ok | No new `fetch()` calls introduced (export uses `window.location.href`) |
| Zod import | `import { z } from "zod"` — no `"zod/v4"` |
| ima-* tokens only | Zero gray/slate/zinc/neutral; exactly 3 hex literals in documented `chartColors` const |

## Build evidence

- `npx tsc --noEmit` — exit 0.
- `npx eslint <all phase 48 files + 3 modified routes>` — 0 errors, 0 warnings.
- `npm run build` — success; `/coach/analytics` compiled as dynamic route.

## Recommendation

**status: clean** — no fixes required. Two documented low-priority observations (L1 SQL duplication, L2 export cooldown heuristic) are non-blocking and explicitly acceptable per prior-phase precedent.

Phase 48 is ready for UI review (`/gsd-ui-review`) and subsequent user UAT.
