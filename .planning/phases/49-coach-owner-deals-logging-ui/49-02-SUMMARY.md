---
phase: 49
plan: 02
title: Coach & Owner "Add Deal" button + DealFormModal reuse
status: completed
date: 2026-04-13
---

# Plan 49-02 — Summary

## What was built

`src/components/coach/DealsTab.tsx` converted from pure-presentational SSR to a `"use client"` interactive tab shared by both the coach and owner student-detail pages.

### New behaviors

- **Add Deal button** — primary variant, `min-h-[44px]`, `aria-label="Add deal for {studentName}"`, `Plus` icon marked `aria-hidden="true"`.
- **DealFormModal reuse** — imports `@/components/student/DealFormModal` verbatim; no new modal code.
- **Optimistic insert** — `useOptimistic` + reducer pattern; tempDeal's `logged_by` set to `viewerId` so the "You" chip renders instantly. `startTransition` wrap per React 19 rules.
- **POST /api/deals** — body `{ revenue, profit, student_id }`. Route handler (Phase 45) enforces dual-layer auth: coach-branch verifies `coach_id === profile.id` (layer 1 = route; layer 2 = RLS WITH CHECK on `coach_insert_deals`); owner-branch verifies target is a student.
- **response.ok check** before JSON parse; `router.refresh()` on both success and failure; `console.error` + toast in catch block.
- **Stable refs** for toast/router per CLAUDE.md useCallback dep pattern.
- **Attribution chip** column added to table rows (between Margin and Date) — renders `DealAttributionChip` from plan 49-01.

### Wiring

- `src/components/coach/StudentDetailClient.tsx` — passes `studentId`, `student.name`, `viewerRole="coach"`, `viewerId`, `userMap` to `DealsTab`.
- `src/components/owner/OwnerStudentDetailClient.tsx` — same with `viewerRole="owner"`.

### Out of scope (per plan)

- Coach/owner edit or delete of deals.
- Pagination for coach/owner deal lists.
- API or migration changes (Phase 45 foundation reused unchanged).

## Validation

- `npx tsc --noEmit` → exit 0.
- Scoped ESLint on `DealsTab.tsx` + both detail clients → 0 errors.
- `npm run build` → exit 0. All routes compile cleanly including `/coach/students/[studentId]` and `/owner/students/[studentId]`.

## Success criteria mapping

1. **SC-1 Coach Add Deal button** — present on `DealsTab` with 44px, opens shared modal. PASSED.
2. **SC-2 Owner Add Deal button** — same component reused, `viewerRole="owner"`. PASSED.
3. **SC-3 logged_by + deal_number + visibility** — POST /api/deals sets `logged_by = profile.id`, DB trigger assigns `deal_number`, revalidateTag fires for student-analytics + coach-dashboard/analytics. PASSED (code path).
4. **SC-4 Attribution chip in every table** — wired in plan 49-01 via shared `DealAttributionChip` + `formatDealLoggedBy`. PASSED.
5. **SC-5 lint + tsc + build gate** — PASSED with pre-existing `Date.now()` warnings noted (Phase 45 legacy, unrelated to Phase 49 edits).

## Artifacts

- MOD: `src/components/coach/DealsTab.tsx` (rewritten as client component with Add Deal)
- MOD: `src/components/coach/StudentDetailClient.tsx`
- MOD: `src/components/owner/OwnerStudentDetailClient.tsx`
