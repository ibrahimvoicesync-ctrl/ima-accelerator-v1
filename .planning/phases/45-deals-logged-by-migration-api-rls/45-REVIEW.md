---
phase: 45-deals-logged-by-migration-api-rls
status: clean
date: 2026-04-13
depth: standard
reviewer: gsd-code-review (inline)
files_reviewed:
  - supabase/migrations/00022_deals_logged_by.sql
  - src/app/api/deals/route.ts
  - src/lib/types.ts
  - src/app/(dashboard)/coach/students/[studentId]/page.tsx
  - src/app/(dashboard)/owner/students/[studentId]/page.tsx
  - src/components/student/DealsClient.tsx
---

# Phase 45 Code Review

## Summary

No blocker-severity issues found. Phase 45 changes follow project conventions (Hard Rules 4, 5, 7, 8), preserve the existing CSRF + rate-limit pattern, and add the new dual-layer authorization safely. Migration uses idempotent DDL (`ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`), embedded asserts, and SECURITY DEFINER + search_path. API route handler adds explicit role branches with clean short-circuit 403/400 returns.

## Findings

### Blockers
None.

### Warnings
None introduced by Phase 45.

### Suggestions (non-blocking)

1. **updated_by is NULL on INSERT.** The `deals_set_audit` trigger reads `current_setting('app.current_user_id', true)`. The Phase 45 API route does NOT call `SELECT set_config('app.current_user_id', ...)` before inserts, so `updated_by` is NULL on INSERT. This is intentional and documented (logged_by captures create-time attribution), but Phase 49 should wire `set_config` before PATCH/UPDATE writes so edits have recorded authors.
   - Location: `src/app/api/deals/route.ts` POST handler; `src/app/api/deals/[id]/route.ts` PATCH handler (future).
   - Severity: suggestion (not blocker — plan threat model T-45-05 accepts this).

2. **Coach/owner branches repeat logged_by-spoof check.** Both coach and owner branches have an identical `if (parsed.data.logged_by && parsed.data.logged_by !== profile.id) return 403;` check. Could be lifted above the role switch to reduce duplication.
   - Location: `src/app/api/deals/route.ts` lines 112-114, 135-137.
   - Severity: cosmetic.

3. **Admin client bypasses RLS, so the RLS WITH CHECK layer is dormant for the primary API path.** The plan acknowledges this (threat model T-45-01). The RLS policies only fire if a future non-admin-client code path inserts (e.g., direct PostgREST RPC from authenticated JWT). This is still the correct design for defense-in-depth but worth surfacing for reviewers of later phases.
   - Location: `src/app/api/deals/route.ts` uses `createAdminClient()`; `supabase/migrations/00022_deals_logged_by.sql` defines `coach_insert_deals` / `owner_insert_deals`.
   - Severity: documentation only.

## Security review

- ✅ CSRF protection via `verifyOrigin` preserved on POST
- ✅ Auth check before role check before validation (correct order)
- ✅ Admin client only used in server route (Hard Rule 4)
- ✅ UUID regex validates `student_id` / `logged_by` before DB use (prevents injection; actually Supabase SDK parameterizes anyway)
- ✅ No secrets logged in error paths
- ✅ Never swallowed errors — every catch has `console.error` (Hard Rule 5)
- ✅ Zod import from `"zod"` (Hard Rule 7)
- ✅ SECURITY DEFINER function sets `search_path = public` (prevents search_path hijack)
- ✅ Transaction-local GUC (`set_config(..., true)`) auto-resets on commit (prevents cross-request leak)
- ✅ Backfill runs before SET NOT NULL (prevents migration failure on historical rows)

## Code quality

- ✅ All response codes correct (401, 403, 404, 400, 429, 500, 201)
- ✅ `maybeSingle()` used for optional coach assignment lookup (returns null instead of error on no row)
- ✅ Consistent error response shape `{ error: string }`
- ✅ `revalidateTag` uses `effectiveStudentId` — coach/owner inserts invalidate the correct student's cache
- ✅ Migration numbering convention followed (00022 after 00021)
- ✅ Migration comments document trust boundaries and intent
- ✅ Types mirror schema exactly (logged_by required on Insert, nullable on updated_by)

## Status: clean

No fixes required. Proceed to next phase.
