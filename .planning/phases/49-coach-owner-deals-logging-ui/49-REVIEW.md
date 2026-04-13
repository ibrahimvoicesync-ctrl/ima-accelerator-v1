---
phase: 49
status: clean
date: 2026-04-13
depth: standard
---

# Phase 49 Code Review

Scope: 13 files touched by Phase 49.

## Files reviewed

- `src/lib/deals-attribution.ts` (new)
- `src/components/shared/DealAttributionChip.tsx` (new)
- `src/components/coach/DealsTab.tsx` (rewrite: presentational → client)
- `src/components/student/DealsClient.tsx`
- `src/components/coach/StudentDetailClient.tsx`
- `src/components/owner/OwnerStudentDetailClient.tsx`
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx`
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx`
- `src/app/(dashboard)/student/deals/page.tsx`
- `src/app/(dashboard)/student_diy/deals/page.tsx`
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`
- `src/app/(dashboard)/student/analytics/page.tsx`
- `src/app/(dashboard)/student_diy/analytics/page.tsx`

## Findings

### Critical — 0
None.

### High — 0
None.

### Medium — 0
None.

### Low (informational, no action required)

1. **`dealsReducer` switch lacks a default branch.** Current discriminant union is `{ type: "add" }` only, so TypeScript correctly narrows the return type. A future action variant would fail to compile, which is the preferred safety net. No change.

2. **`viewerRole` parameter unused in the main branches of `formatDealLoggedBy`.** Used only in the `console.warn` when the userMap lookup misses. Retained because Phase 49 spec defines the helper signature as `formatDealLoggedBy(deal, viewerRole, viewerId, userMap)`. Future variants (e.g., hiding owner names from students) can gate on it without an API break.

3. **Optimistic `deal_number = optimisticDeals.length + 1` can briefly mismatch the server value** if there are gaps from prior deletes. `router.refresh()` corrects the display within one TTL. Matches existing `DealsClient` pattern — not a regression.

4. **Pre-existing `Date.now()` purity errors** on lines 100/121 of the coach+owner student-detail pages. Flagged by `react-hooks/purity` but NOT introduced by Phase 49 (same lines exist in Phase 45 baseline). Documented in 45-VERIFICATION.md. Out of scope for Phase 49.

## Hard-rule gate

| Rule | Status |
|------|--------|
| motion-safe on animate-* | N/A (no new animations) |
| min-h-[44px] on interactives | PASS (Add Deal button explicit) |
| aria-label / label htmlFor | PASS (button + chip both labeled) |
| Admin client in server code only | PASS (user lookups in server pages) |
| catch blocks toast + console.error | PASS (DealsTab.handleAdd) |
| fetch() checks response.ok | PASS |
| `import { z } from "zod"` | N/A (no new Zod) |
| ima-* tokens only | PASS (verified against tailwind.config.ts) |

## Security notes

- POST /api/deals unchanged — Phase 45 dual-layer authorization (route assignment check + RLS WITH CHECK on `coach_insert_deals` / `owner_insert_deals`) protects against coach inserts for unassigned students.
- `logged_by` is forced server-side to `profile.id`; client cannot spoof.
- userMap admin fetch exposes `name` + `role` only — no email / auth_id / coach_id leakage.
- No new CSRF vectors — reuses existing verifyOrigin path.
- No PII leaked beyond the full student name which the viewer already sees in the header.

## Verdict

**status: clean** — zero actionable findings. Phase 49 is ready for UI review and merge.
