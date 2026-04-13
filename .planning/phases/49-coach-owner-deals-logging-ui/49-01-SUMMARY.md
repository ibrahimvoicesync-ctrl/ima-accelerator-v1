---
phase: 49
plan: 01
title: Shared attribution helper + chip component + consumer wiring
status: completed
date: 2026-04-13
---

# Plan 49-01 — Summary

## What was built

1. **`src/lib/deals-attribution.ts`** — pure helper `formatDealLoggedBy(deal, viewerRole, viewerId, userMap)` returning `{ label, variant, ariaLabel }`. Emits "You" for self-logged, first-name for coaches, "Owner: {first}" for owners, "Unknown" for missing/null. Single `console.warn` on lookup miss (never swallowed).
2. **`src/components/shared/DealAttributionChip.tsx`** — presentational chip. Server-component-compatible. `role="status"`, `aria-label` from helper output, 4 variant styles (self/coach/owner/unknown). All `ima-*` tokens.

## Wired everywhere deals render

- `src/components/student/DealsClient.tsx` — new chip column added to rows + header; `viewerId`, `viewerRole`, `userMap` props accepted; optimistic tempDeal sets `logged_by = viewerId` so "You" renders instantly.
- `src/app/(dashboard)/student/deals/page.tsx` + `src/app/(dashboard)/student_diy/deals/page.tsx` — fetch distinct `logged_by` ids, build userMap, pass to `DealsClient`.
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` + `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — same userMap fetch; pass `viewerId` (`user.id` / `owner.id`) and `userMap` down.
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` — deleted inline `AttributionChip`; replaced with shared `DealAttributionChip`. Accepts `viewerId`, `viewerRole`, `userMap` props.
- `src/app/(dashboard)/student/analytics/page.tsx` + `src/app/(dashboard)/student_diy/analytics/page.tsx` — build userMap from `data.deals` logged_by ids; pass through.

## Validation

- `npx tsc --noEmit` → exit 0.
- Scoped ESLint on all changed files → 0 errors in my edits. (2 pre-existing `Date.now()` purity errors flagged in coach+owner student-detail page files on lines NOT modified by Phase 49; inherited from Phase 45, documented in 45-VERIFICATION.md.)
- `npm run build` → exit 0, all routes compile.

## Artifacts

- NEW: `src/lib/deals-attribution.ts`
- NEW: `src/components/shared/DealAttributionChip.tsx`
- MOD: `src/components/student/DealsClient.tsx`
- MOD: `src/app/(dashboard)/student/deals/page.tsx`
- MOD: `src/app/(dashboard)/student_diy/deals/page.tsx`
- MOD: `src/app/(dashboard)/coach/students/[studentId]/page.tsx`
- MOD: `src/app/(dashboard)/owner/students/[studentId]/page.tsx`
- MOD: `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`
- MOD: `src/app/(dashboard)/student/analytics/page.tsx`
- MOD: `src/app/(dashboard)/student_diy/analytics/page.tsx`
