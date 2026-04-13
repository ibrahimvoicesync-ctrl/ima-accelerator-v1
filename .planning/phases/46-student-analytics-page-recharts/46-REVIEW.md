---
phase: 46-student-analytics-page-recharts
status: clean
reviewed: 2026-04-13
depth: standard
files_reviewed: 22
---

# Phase 46 — Code Review

## Scope
Reviewed all 22 files touched in commit `23cde0e` (feat(46): student analytics page + RPC + Recharts).

## Findings

### Critical
None.

### High
None.

### Medium
None.

### Low
None that warrant a fix in this phase. Observations and minor notes below.

### Observations / Notes

1. **`fetchCached` key re-use across students is safe but could be clearer.**
   In both `src/app/(dashboard)/student/analytics/page.tsx` and `src/app/(dashboard)/student_diy/analytics/page.tsx`, the `unstable_cache` key array is `['student-analytics']`; per Next.js semantics, the runtime arguments (studentId, range, page) are folded into the cache key, so cache isolation per user is correct. No action needed — flagging for future developers who might assume the first argument is the sole key.

2. **Admin client returns `auth.uid() = NULL`; the SQL guard handles this explicitly.**
   `createAdminClient()` uses the service role key, so `(SELECT auth.uid())` inside the RPC is NULL. Migration 00023 guards with `IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_student_id THEN RAISE`. The Next server component already verified the session identity via `requireRole` before calling the RPC, so the dual-layer authorization is intact.

3. **Unused `isPending` UI signal is wired but page/range change uses server navigation.**
   `AnalyticsClient.tsx` wraps `router.push` in `startTransition`; Next App Router handles the navigation + re-fetch. `isPending` drives the `aria-busy` and faded-opacity treatment on the container. Not a bug — noted for clarity.

4. **Re-export of types from server module.**
   `src/lib/rpc/student-analytics.ts` re-exports types/constants from `student-analytics-types.ts` for convenience. This preserves the original import surface for server callers while keeping the types module client-safe. Server and client paths are now correctly separated.

5. **`navigate` helper only used by range selector.**
   In `AnalyticsClient.tsx` the `navigate` callback is only invoked from `onRangeChange`; page navigation is handled directly by `PaginationControls` via Link hrefs. The two paths are consistent — both end up changing the URL and triggering a server re-render — so no divergence risk.

## CLAUDE.md Hard Rules — spot checks

| # | Rule | Result |
|---|------|--------|
| 1 | motion-safe on animate-* | PASS |
| 2 | 44px touch targets | PASS |
| 3 | aria labels / accessible content | PASS |
| 4 | admin client in API routes | PASS (only new .from() is `admin.from('users')` inside server components, which is correct for App Router server components) |
| 5 | never swallow errors | PASS (revalidateTag wrapped in try/catch with console.error; RPC fetcher logs+throws) |
| 6 | response.ok on fetch | N/A (no new fetch calls) |
| 7 | import { z } from "zod" | PASS |
| 8 | ima-* tokens only | PASS (single audited chartColors const with documented mirror to ima-* tokens) |

## Security review

- SQL function is `SECURITY DEFINER` with `SET search_path = public` — injection-safe (no dynamic SQL, all parameters bound).
- Authorization guard is the first executable statement and uses the `(SELECT auth.uid())` pattern (PERF-03).
- `GRANT EXECUTE` scoped to `authenticated, service_role` only.
- Client component does not receive any service-role credentials; the admin client lives entirely in the server-only module tree.
- All route handlers retained their existing CSRF + rate-limit + Zod validation; `revalidateTag` additions are strictly additive and non-authoritative.

## Build gates (from VERIFICATION.md)

- `npx tsc --noEmit`: exit 0
- `npm run lint`: exit 0
- `npm run build`: exit 0

## Verdict

**status: clean**

No actionable issues. The implementation cleanly satisfies the plan, the UI-SPEC, and CLAUDE.md hard rules. The client/server boundary split into `student-analytics.ts` + `student-analytics-types.ts` is a principled fix for the server-only import leak and is documented in the phase SUMMARY.
