---
phase: 43-coach-owner-deals-tab
reviewed: 2026-04-07T19:16:12Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/components/coach/DealsTab.tsx
  - src/components/coach/StudentDetailTabs.tsx
  - src/components/coach/StudentDetailClient.tsx
  - src/components/owner/OwnerStudentDetailClient.tsx
  - src/app/(dashboard)/coach/students/[studentId]/page.tsx
  - src/app/(dashboard)/owner/students/[studentId]/page.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-04-07T19:16:12Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Deals Tab feature across coach and owner student detail views. The implementation is solid overall: correct use of admin client in server components, proper auth/role gating, parameterized Supabase queries, error logging on all query failures, ima-* design tokens throughout, ARIA attributes on tabs/panels, 44px touch targets via Button `sm` size, and defensive null coalescing on query results.

Three minor issues found -- one warning related to mobile layout consistency and two informational accessibility/hygiene items. No critical issues, no security vulnerabilities, no swallowed errors.

## Warnings

### WR-01: DealsTab summary row layout breaks on mobile

**File:** `src/components/coach/DealsTab.tsx:76`
**Issue:** The summary row uses `flex items-center gap-4` (always horizontal), but individual deal rows use `flex flex-col sm:flex-row` (stacked on mobile). The column headers are `hidden sm:flex` (hidden on mobile). On mobile screens, deal rows stack vertically while the summary row remains horizontal with fixed-width spans (`w-24`, `flex-1`, `w-20`, `w-28`), creating a visual misalignment between rows and their total.
**Fix:** Make the summary row responsive to match the deal rows:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 bg-ima-surface-light border-t border-ima-border text-sm font-medium">
  <span className="w-24 text-ima-text shrink-0">Total</span>
  <span className="flex-1 text-ima-text">{formatCurrency(totalRevenue)}</span>
  <span className="flex-1 text-ima-text-secondary">{formatCurrency(totalProfit)}</span>
  <span className="w-20 text-ima-text-secondary shrink-0">{formatMargin(totalRevenue, totalProfit)}</span>
  <span className="w-28 shrink-0 hidden sm:block"></span>
</div>
```

## Info

### IN-01: Tab panels missing tabindex for keyboard accessibility

**File:** `src/components/coach/DealsTab.tsx:30`
**Issue:** The `role="tabpanel"` div does not have `tabindex="0"`, which the WAI-ARIA tabs pattern recommends so keyboard users can focus the panel after selecting a tab. The same pattern applies to the calendar and roadmap tab panels (out of this review's file scope).
**Fix:** Add `tabindex={0}` to the tabpanel container:
```tsx
<div role="tabpanel" id="tabpanel-deals" aria-labelledby="tab-deals" tabIndex={0} className="space-y-4">
```

### IN-02: Deals query selects unused updated_at column

**File:** `src/app/(dashboard)/coach/students/[studentId]/page.tsx:133`
**File:** `src/app/(dashboard)/owner/students/[studentId]/page.tsx:152`
**Issue:** Both page files select `updated_at` in the deals query, but `DealsTab` never renders or uses `updated_at`. This is a minor hygiene issue -- selecting unused columns wastes a small amount of bandwidth.
**Fix:** Remove `updated_at` from the select:
```ts
.select("id, student_id, deal_number, revenue, profit, created_at")
```

---

_Reviewed: 2026-04-07T19:16:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
