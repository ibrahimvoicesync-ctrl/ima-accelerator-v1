---
status: complete
---

# Quick Task 260417-oud: Remove outreach metrics from student_diy analytics — Summary

**Completed:** 2026-04-17

## Changes

### 1. `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`
- Added `showOutreach?: boolean` prop (default `true`) to `AnalyticsClientProps` so the `/student/analytics` surface keeps all 6 KPIs + both charts
- KPI grid gates the `Brand Outreach` and `Influencer Outreach` cards behind `showOutreach`; grid cols switch to `sm:grid-cols-2 lg:grid-cols-4` when outreach is hidden so the remaining 4 cards fill evenly
- Trend section gates the Outreach area chart card behind `showOutreach`; the surrounding grid drops from `lg:grid-cols-2` to a single-column layout so the Hours chart spans the row

### 2. `src/app/(dashboard)/student_diy/analytics/page.tsx`
- Passes `showOutreach={false}` to `AnalyticsClient`

## Result
- `/student/analytics` → unchanged (6 KPIs + Outreach chart + Hours chart)
- `/student_diy/analytics` → 4 KPIs (Total Hours, Total Deals, Total Revenue, Total Profit) + Hours chart only
- Roadmap progress and Deal history remain identical across both surfaces

## Verification
- `npx tsc --noEmit` passes
- `npm run lint` — no new warnings on AnalyticsClient or the student_diy page
