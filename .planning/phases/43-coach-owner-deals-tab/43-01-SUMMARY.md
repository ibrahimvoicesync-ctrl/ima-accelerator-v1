---
phase: 43-coach-owner-deals-tab
plan: 01
status: complete
started: 2026-04-07
completed: 2026-04-07
---

## Summary

Added a "Deals" tab to both coach and owner student detail pages. The tab displays a read-only table with deal number, revenue, profit, profit margin %, and date columns, plus a summary totals row. Empty state shown for students with no deals. URL param `?tab=deals` enables direct navigation.

## Changes

### Files Created
- `src/components/coach/DealsTab.tsx` — Read-only deals table component with margin calculation, currency formatting, empty state, and summary row

### Files Modified
- `src/components/coach/StudentDetailTabs.tsx` — Added "deals" to TabKey union and tabs array
- `src/components/coach/StudentDetailClient.tsx` — Added deals prop, DealsTab import, validTabs array for tab initialization
- `src/components/owner/OwnerStudentDetailClient.tsx` — Same changes as coach client
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Server-side deals query with admin client
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Server-side deals query with admin client

## Key Decisions
- DealsTab is a non-client component (no "use client") — pure props display
- Shared between coach and owner views via import from `@/components/coach/DealsTab`
- Division-by-zero guard: margin shows em-dash when revenue is 0
- validTabs array replaces hardcoded ternary for tab initialization

## Verification
- `npx tsc --noEmit` — passed
- `npm run build` — passed
- Human verification — approved
