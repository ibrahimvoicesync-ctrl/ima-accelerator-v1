# Project Research Summary

**Project:** IMA Accelerator v1.5 — Student Deal Tracking
**Domain:** Closed brand deal logging (revenue + profit per deal) integrated into an existing coaching/mentorship platform
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

IMA Accelerator v1.5 adds student deal tracking to a production Next.js 16 + Supabase platform that already has 14 tables, 4 roles, RLS everywhere, and 20 migrations. The feature is a focused addition: a `deals` table, CRUD route handlers, a student-facing page shared between `student` and `student_diy`, dashboard stat cards, and a read-only coach/owner tab on student detail pages. Every required capability — form handling, optimistic UI, pagination, rate limiting, CSRF, modal components — is already in the codebase. Zero new npm dependencies are needed.

The recommended approach follows established platform patterns exactly: a Postgres trigger for safe per-student `deal_number` auto-increment, `numeric(12,2)` columns for monetary amounts, server component shells with client islands, `useOptimistic` for add and delete, role-split API handlers for delete permissions, and live aggregate queries on the dashboard. The only genuine technical risk is the `deal_number` race condition on concurrent inserts — mitigated by a `BEFORE INSERT` trigger with `SELECT COALESCE(MAX, 0) + 1 ... FOR UPDATE` and a `UNIQUE (student_id, deal_number)` constraint as a last-resort safety net. All other risks are well-understood and follow proven in-codebase patterns.

The single unblocking dependency is the database migration. Everything else — API routes, student pages, dashboard stats, coach/owner tab — proceeds in sequence after the migration lands. Steps 4 (student pages) and 5 (dashboard stats) can be parallelized after migration and API routes are complete. The implementation is additive and surgical: no existing routes, components, or tables are structurally changed.

---

## Key Findings

### Recommended Stack

No new packages are required. The full v1.5 feature set is covered by what is already installed.

**Core technologies (confirmed by codebase audit):**
- `numeric(12,2)` Postgres columns — correct type for monetary amounts; avoids float rounding errors and truncation at deal-tracking scale
- Postgres `BEFORE INSERT` trigger — safe `deal_number` auto-increment per student; eliminates race condition that application-level `MAX + 1` cannot prevent
- React 19 `useOptimistic` + `startTransition` — optimistic list add/delete; already used in `ReportFormWrapper`, extends naturally to list CRUD
- `Intl.NumberFormat` — currency display formatting; built into the Node.js runtime, no library needed
- `createAdminClient()` in all route handlers — existing hard rule; bypasses RLS, enforces ownership via explicit code checks
- `checkRateLimit()` + `verifyOrigin()` — existing mutation protection helpers; must be applied to all new deal routes per CLAUDE.md hard rules

**Critical version note:** The `deal_number` trigger must use `SECURITY DEFINER` and `SET search_path = public` to match the security posture of all other SECURITY DEFINER functions in the migration history (confirmed from `00001_create_tables.sql`).

**Confirmed: zero new npm installs for v1.5.**

### Expected Features

**Must have (table stakes) — all P1 for v1.5 launch:**
- `deals` DB migration — the single unblocking dependency for all downstream work
- `POST /api/deals`, `PATCH /api/deals/[id]`, `DELETE /api/deals/[id]`, `GET /api/deals` (paginated) — full CRUD with role-scoped permissions
- Student Deals page (`/student/deals`) — add form, deal history list, edit modal, delete with confirmation
- `student_diy` Deals page (`/student_diy/deals`) — reuses the same `DealsClient` component; role check enforced at API layer only
- Dashboard stat cards: Deals Closed + Total Revenue + Total Profit — live aggregate query on student dashboard server component
- Coach Deals tab on student detail page — summary row + paginated list (25/page) + delete button
- Owner Deals tab on student detail page — reuses `DealsTab` component; delete unrestricted by coach assignment
- Per-student `deal_number` with UNIQUE constraint — stated requirement; concurrency-safe via trigger

**Should have — P2, add after core validation:**
- `useOptimistic` on deal add and delete — polish; pattern already established in codebase
- Profit margin % alongside profit amount — one formula, low implementation cost
- Deal count chip in skip tracker badge area

**Defer to v2+:**
- Deal pipeline / stage tracking (prospecting → pitched → closed)
- Influencer FK on deals
- Leaderboard by revenue / gamification
- Multi-currency support
- Retainer / recurring deal modeling
- Soft delete / trash-restore flow

### Architecture Approach

The architecture extends v1.4 patterns without introducing new structural concepts. A new `deals` table is the data foundation. Two new server component shells (`/student/deals`, `/student_diy/deals`) follow the existing page pattern: server fetch with `createAdminClient()` passes props to a `"use client"` island (`DealsClient`). A new `DealsTab` component placed in `src/components/coach/` (alongside `CalendarTab`) serves both coach and owner student detail pages. Route handlers at `/api/deals` and `/api/deals/[id]` follow the role-split pattern from `/api/reports`. Dashboard stats are read from a live aggregate query on the student dashboard server component — not from `student_kpi_summaries`, which is nightly-refreshed and would produce stale counts.

**Major components:**
1. `supabase/migrations/00021_deals.sql` — deals table, `deal_number` trigger, RLS policies, indexes, `UNIQUE (student_id, deal_number)` constraint
2. `src/app/api/deals/route.ts` and `[id]/route.ts` — GET (paginated coach/owner list), POST (student add), PATCH (student edit own), DELETE (role-scoped ownership check)
3. `src/components/student/DealsClient.tsx` — `"use client"` CRUD UI with useOptimistic; shared by student and student_diy pages
4. `src/components/coach/DealsTab.tsx` — `"use client"` paginated read-only table; shared by coach and owner detail pages
5. `src/app/(dashboard)/student/deals/page.tsx` and `student_diy/deals/page.tsx` — thin server shells
6. Modified files: `src/lib/config.ts` (routes + nav + validation constants), `StudentDetailTabs.tsx` (TabKey union extension), `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` (Deals tab render), both detail `page.tsx` files (add deals fetch to `Promise.all`), both student dashboard `page.tsx` files (add deal stat cards)

### Critical Pitfalls

1. **Per-student `deal_number` race condition** — Use a `BEFORE INSERT` trigger that executes `SELECT COALESCE(MAX(deal_number), 0) + 1 FROM deals WHERE student_id = NEW.student_id` with `FOR UPDATE` row lock plus a `UNIQUE (student_id, deal_number)` constraint as the safety net. Never implement as application-layer `MAX + 1` — concurrent requests produce duplicate deal numbers before either INSERT completes.

2. **`NUMERIC` columns returned as strings by PostgREST** — Supabase JS client serializes `numeric(12,2)` as strings, not JS numbers (open issue postgrest-js #419). Every arithmetic site must coerce: `Number(row.revenue ?? 0)`. Declare revenue/profit as `string | number` in `types.ts` to force explicit conversion. Without this, dashboard totals display as concatenated strings (e.g., `"012500.002500.00"`).

3. **RLS `initplan` missing** — Every `get_user_role()` and `get_user_id()` call in RLS policies must use the `(SELECT fn())` initplan wrapper, matching the pattern from `00001_create_tables.sql`. Bare function calls cause per-row re-evaluation — a performance cliff when coaches paginate through deal lists.

4. **Coach cross-student delete bypass** — The DELETE route must perform a two-step check: fetch the deal's `student_id`, then verify `student.coach_id === profile.id` before allowing the coach delete. Role check alone (`profile.role === 'coach'`) is not sufficient and is a known authorization gap pattern.

5. **Dashboard stats cache invalidation mismatch** — Deal stats must be fetched as a live aggregate on the student dashboard server component (not from `student_kpi_summaries`). After POST/DELETE, the `revalidateTag` tag in the API route must exactly match the tag used in the server component fetch. Mismatch causes stale deal counts visible to students immediately after logging a deal.

6. **`useOptimistic` delete flash on coach/owner tab** — After a coach deletes a deal, optimistic remove is immediate but if `router.refresh()` is not called on success, React reconciles the optimistic state with stale server state and the deleted row re-appears briefly. Delete handler must call `router.refresh()` after a successful API DELETE response.

---

## Implications for Roadmap

### Phase 1: Database Foundation
**Rationale:** The migration is the single hard dependency for everything else. No page, route, or component can be built without the table existing in Supabase. It must ship first and be verified before any other work starts.
**Delivers:** `deals` table with `deal_number` trigger, `UNIQUE (student_id, deal_number)` constraint, RLS policies with initplan wrapping, indexes on `(student_id, closed_at DESC)`, `types.ts` updated with `string | number` for revenue/profit fields.
**Addresses:** Table stakes (deals table migration), deal_number per student stated requirement.
**Avoids:** Race condition pitfall (trigger handles it from day one), RLS initplan pitfall (built into migration SQL), NUMERIC string pitfall (types.ts declared correctly upfront).

### Phase 2: API Route Handlers
**Rationale:** Route handlers are the shared dependency for both the student CRUD pages and the coach/owner Deals tab. They must exist before any client can mutate data, and they are fully testable in isolation before any UI is built.
**Delivers:** `POST /api/deals`, `PATCH /api/deals/[id]`, `DELETE /api/deals/[id]` (role-scoped), `GET /api/deals` (paginated, coach/owner only). All routes include `verifyOrigin`, `checkRateLimit`, Zod validation, and explicit ownership checks.
**Addresses:** Rate limiting requirement, CSRF requirement, role-scoped delete, student_diy parity (API accepts both student roles).
**Avoids:** Coach cross-student delete bypass (explicit two-step check in DELETE handler), missing rate limiting and CSRF (both required by CLAUDE.md hard rules). Define `revalidateTag` tag names here to lock cache invalidation strategy before dashboard phase.

### Phase 3: Config Updates
**Rationale:** TypeScript errors if pages reference routes that do not exist in `config.ts`. Updating config before creating pages keeps the codebase in a valid state and propagates route definitions to all type-checked sites.
**Delivers:** `ROUTES.student.deals`, `ROUTES.student_diy.deals`, "Deals" nav items for student and student_diy, `DEALS` validation constants (revenue max, notes max length) in `src/lib/config.ts`. Proxy.ts coverage is already handled by existing prefix matchers.
**Addresses:** Config-is-truth rule (CLAUDE.md rule 1).

### Phase 4: Student Deals Pages
**Rationale:** After migration + API routes + config, the student-facing CRUD flow is self-contained. Both `/student/deals` and `/student_diy/deals` share one `DealsClient` component — effectively one unit of work. Can be done in parallel with Phase 5.
**Delivers:** Server shells for both student roles, `DealsClient` component with add form, deal history list (most recent first), edit modal, delete confirmation, empty state ("No deals yet — close your first brand deal"), and `useOptimistic` for add and delete.
**Addresses:** Must-have student CRUD features, student_diy parity (stated requirement), optimistic UI differentiator.
**Avoids:** `useOptimistic` delete flash — `router.refresh()` called on delete success as a named checklist item.

### Phase 5: Dashboard Stat Cards
**Rationale:** Self-contained server component changes to both student and student_diy dashboards. No dependency on Phase 4. Can be parallelized with Phase 4 after Phases 1–3 are complete.
**Delivers:** Three stat cards (Deals Closed, Total Revenue, Total Profit) on student and student_diy dashboards, using a live aggregate query directly from the `deals` table (not from `student_kpi_summaries`).
**Addresses:** Dashboard stats table-stakes requirement — accountability signal on the landing page.
**Avoids:** Stale stats pitfall — live query not nightly cron. `revalidateTag` tag agreed in Phase 2 is used here for cache invalidation alignment.

### Phase 6: Coach and Owner Deals Tab
**Rationale:** The most touch-heavy step (6 files modified), but each change is surgical. Must come after Phase 2 (needs the GET API endpoint). Coach and owner reuse the same `DealsTab` component — write once, mount twice.
**Delivers:** `DealsTab` component with summary stats header + 25/page paginated list + delete button. `StudentDetailTabs.tsx` extended with `"deals"` `TabKey`. Both `StudentDetailClient` and `OwnerStudentDetailClient` render the Deals tab. Both detail `page.tsx` files fetch initial deals data in `Promise.all`.
**Addresses:** Coach deals tab, owner deals tab, stated 25/page pagination requirement.
**Avoids:** Anti-pattern of inlining deals JSX in both detail clients (extract `DealsTab` once, import twice). Anti-pattern of fetching deals through the `get_student_detail` RPC (fetch directly in `Promise.all` — keeps RPC interface stable).

### Phase Ordering Rationale

- The migration is the only hard blocker. Every other phase has at most a dependency on a prior phase being complete.
- API routes come second because both the student pages and the coach/owner tab need them for mutations. Having routes first enables iterative testing against real endpoints before any UI exists.
- Config update (Phase 3) is fast and should land before pages are created to keep TypeScript compilation clean.
- Student pages (Phase 4) and dashboard stats (Phase 5) are independent of each other and can be parallelized.
- The coach/owner tab (Phase 6) comes last because it has the widest file surface and depends on the GET endpoint from Phase 2.

### Research Flags

All phases follow well-documented, verified patterns from the existing codebase. No phase requires a `/gsd-research-phase` call.

- **Phase 1 (Migration):** Full SQL DDL for table, trigger, constraints, RLS, and indexes is documented in STACK.md. Copy directly. Verify with `EXPLAIN ANALYZE` that RLS initplan appears.
- **Phase 2 (API Routes):** Role-split handler pattern with working TypeScript examples is in ARCHITECTURE.md. Rate limit and CSRF helpers already exist with no changes needed.
- **Phase 3 (Config):** Mechanical additions following existing nav/route entry format.
- **Phase 4 (Student Pages):** `DealsClient` pattern derived from `WorkTrackerClient` + `ReportFormWrapper`. `useOptimistic` list pattern documented in ARCHITECTURE.md.
- **Phase 5 (Dashboard Stats):** Parallel query pattern from existing student dashboard server component. Tag alignment is the only implementation detail to verify.
- **Phase 6 (Coach/Owner Tab):** `DealsTab` follows `CalendarTab` pattern exactly. Tab extension follows existing `StudentDetailTabs` union type extension pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages confirmed. SQL DDL verified against 20 existing migrations. `Intl.NumberFormat` confirmed in Node.js 20+ runtime used by the project. |
| Features | HIGH | Scope derived directly from PROJECT.md (locked v1.5 decisions). Anti-features explicitly listed with rationale cross-checked against PROJECT.md Out of Scope list. |
| Architecture | HIGH | Based on direct codebase analysis of v1.4 source. All component locations, data flow paths, and file modification targets are confirmed against existing files — not inferred. |
| Pitfalls | HIGH | All 6 critical pitfalls are grounded in: open Supabase/PostgREST issues (NUMERIC as string), PostgreSQL advisory lock documentation (race condition), and codebase audit (RLS initplan pattern, coach assignment check pattern from v1.2). |

**Overall confidence:** HIGH

### Gaps to Address

- **NUMERIC coercion in `types.ts`:** The `types.ts` file is hand-crafted. Revenue/profit fields must be declared as `string | number`. Log `typeof row.revenue` from one real Supabase query during Phase 1 verification to confirm PostgREST behavior matches expectation before any display code is written.

- **Dashboard cache tag alignment:** The `revalidateTag` tag used in `POST /api/deals` and `DELETE /api/deals/[id]` must exactly match the tag used in the student dashboard server component fetch. The exact tag naming convention (`"deals"` vs `"deals-${studentId}"` vs a path-based key) must be decided in Phase 2 and documented before Phase 5 implements the dashboard query.

- **Trigger concurrency at edge case:** The `BEFORE INSERT` trigger is safe under normal usage but has not been load-tested in this specific codebase. The `UNIQUE (student_id, deal_number)` constraint is the last-resort safety net — a 23505 conflict on the rare concurrent insert should be handled with a single retry in the POST route handler. Implement the retry as a named checklist item in Phase 2.

---

## Sources

### Primary (HIGH confidence)

- `.planning/PROJECT.md` — v1.5 milestone features, Out of Scope decisions, locked architectural decisions
- Existing codebase: `src/app/(dashboard)/`, `src/components/coach/`, `src/components/student/`, `src/lib/config.ts`, `src/proxy.ts`, `src/lib/rate-limit.ts`, `src/lib/csrf.ts`
- Migration history: `supabase/migrations/00001_create_tables.sql` through `00020_add_eyoub_owner.sql`
- Supabase RLS performance and best practices — https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- PostgreSQL docs on explicit locking and advisory locks — https://www.postgresql.org/docs/current/explicit-locking.html
- Next.js revalidateTag docs — https://nextjs.org/docs/app/api-reference/functions/revalidateTag

### Secondary (MEDIUM confidence)

- Supabase/postgrest-js issue #419: NUMERIC returned as string — https://github.com/supabase/postgrest-js/issues/419
- Supabase/CLI issue #582: NUMERIC type generated as `number` causing precision loss — https://github.com/supabase/cli/issues/582
- HubSpot Deals Dashboard (Bold BI) — deal stat card design: count + revenue + avg deal size pattern
- Klipfolio Sales KPI Dashboard examples — closed deals, total revenue, profit as headline metrics
- Monday.com Sales Dashboard Templates — deal list table UX and card groupings
- Momentum.io / Scratchpad — coach-facing deal visibility and accountability patterns in sales coaching platforms

### Tertiary (LOW confidence — inferred)

- React 19 useOptimistic issue #31967 (delete flash behavior) — https://github.com/facebook/react/issues/31967
- vercel/next.js issue #49619 (useOptimistic revert before revalidatePath render) — https://github.com/vercel/next.js/issues/49619

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
