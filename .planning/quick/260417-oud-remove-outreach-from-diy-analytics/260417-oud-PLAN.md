# Quick Task 260417-oud: Remove outreach metrics from student_diy analytics

## Task 1: Gate outreach UI behind a prop on AnalyticsClient

**Files:** `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`, `src/app/(dashboard)/student_diy/analytics/page.tsx`

**Action:**
1. Add `showOutreach?: boolean` prop to `AnalyticsClient` (default `true` so `/student/analytics` keeps its current UI)
2. Drop the Brand Outreach and Influencer Outreach KPI cards when `showOutreach === false`
3. Drop the Outreach trend card (area chart) when `showOutreach === false`; the trend section then renders only the Hours chart and switches its grid from `grid-cols-1 lg:grid-cols-2` to `grid-cols-1` so the card spans the full row
4. Re-space the KPI grid: when outreach is hidden, the remaining 4 cards use `sm:grid-cols-2 lg:grid-cols-4` so there is no awkward empty column at lg
5. Pass `showOutreach={false}` from `src/app/(dashboard)/student_diy/analytics/page.tsx`

**Verify:** `npx tsc --noEmit` passes, `npm run lint` has no new AnalyticsClient errors, `/student/analytics` renders all 6 KPIs + both trend charts, `/student_diy/analytics` renders 4 KPIs (Total Hours, Total Deals, Total Revenue, Total Profit) + Hours chart only.

**Done:** Both pages build cleanly, student_diy has no references to brand/influencer outreach.
