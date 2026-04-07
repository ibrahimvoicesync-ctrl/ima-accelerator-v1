---
phase: 42-dashboard-stat-cards
reviewed: 2026-04-07T12:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/app/(dashboard)/student/page.tsx
  - src/app/(dashboard)/student_diy/page.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-04-07T12:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed both student dashboard pages (student and student_diy). Both files are well-structured server components that correctly use `requireRole` for authorization, `createAdminClient` for database queries (per project Hard Rule #4), and follow all ima-* design token conventions. Error handling is present on every query with `console.error` logging (no swallowed errors -- Hard Rule #5). Accessibility is solid with `role="progressbar"`, `aria-label`, `aria-hidden="true"` on decorative icons, and 44px touch targets on all interactive elements.

Two warnings found related to potential NaN propagation when coercing deal amounts, and two informational items about function length and cross-file code duplication.

## Warnings

### WR-01: Number coercion on deal revenue/profit may produce NaN

**File:** `src/app/(dashboard)/student/page.tsx:77-78`
**Also in:** `src/app/(dashboard)/student_diy/page.tsx:61-62`
**Issue:** `Number(d.revenue)` and `Number(d.profit)` are used in a `reduce` sum. The database type for these fields is `string | number`. If Supabase returns a value that cannot be parsed as a number (e.g., an empty string or unexpected format from a `numeric`/`decimal` column), `Number(...)` returns `NaN`, which silently poisons the entire sum. The UI would then display "NaN" to the user.
**Fix:** Guard against NaN in the reduce:
```typescript
const totalRevenue = dealsData.reduce((sum, d) => {
  const val = Number(d.revenue);
  return sum + (Number.isNaN(val) ? 0 : val);
}, 0);
const totalProfit = dealsData.reduce((sum, d) => {
  const val = Number(d.profit);
  return sum + (Number.isNaN(val) ? 0 : val);
}, 0);
```

### WR-02: Missing currency symbol on revenue/profit display

**File:** `src/app/(dashboard)/student/page.tsx:255,267`
**Also in:** `src/app/(dashboard)/student_diy/page.tsx:209,220`
**Issue:** Revenue and profit amounts are displayed with `toLocaleString` formatting (2 decimal places) but no currency symbol. The card heading says "Total Revenue" / "Total Profit" and the icon is `DollarSign`, but the actual number renders as e.g. `1,500.00` without a `$` prefix. This may confuse users about whether the value is in dollars, euros, or another currency. Using `toLocaleString` without a locale also means the format varies by the server's locale setting, which may differ from user expectations (e.g., `1.500,00` in German locale).
**Fix:** Either prepend a currency symbol explicitly or use `Intl.NumberFormat` with an explicit locale and currency:
```typescript
// Option A: Simple prefix
<p>$ {totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>

// Option B: Full Intl formatting
{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalRevenue)}
```

## Info

### IN-01: Large single-function server component

**File:** `src/app/(dashboard)/student/page.tsx:33-360`
**Issue:** The `StudentDashboard` component is 327 lines long, mixing data fetching, data transformation, and JSX rendering in a single function. While acceptable for a server component, it increases cognitive load for future maintenance.
**Fix:** Consider extracting pure data-transformation logic (lines 73-110) into a helper function (e.g., `computeDashboardData`), and extracting repeated card patterns (KPI cards, deal stat cards) into shared sub-components. This would also reduce duplication with `student_diy/page.tsx`.

### IN-02: Significant code duplication between student and student_diy dashboards

**File:** `src/app/(dashboard)/student/page.tsx` and `src/app/(dashboard)/student_diy/page.tsx`
**Issue:** Approximately 70% of the code is duplicated between these two files: the `getNextAction` helper, session/deal data processing, deal stat cards, roadmap progress card, and most UI markup. The only differences are: (1) student_diy omits KPI outreach cards and daily report card, (2) route prefixes differ (`/student/` vs `/student_diy/`), and (3) student_diy omits the report/lifetime queries. This duplication means bug fixes or UI changes must be applied in both files.
**Fix:** Extract shared components (`DealStatCards`, `RoadmapCard`, `WorkProgressCard`) and shared logic (`getNextAction`, `computeSessionStats`) into `src/components/dashboard/` modules. Each dashboard page would then compose these shared pieces with role-specific additions.

---

_Reviewed: 2026-04-07T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
