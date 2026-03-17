---
phase: 10-ui-polish-production-hardening
plan: "04"
subsystem: mobile-responsive-layouts
tags: [mobile, responsive, touch-targets, accessibility]
dependency_graph:
  requires: []
  provides: [mobile-safe-report-rows, mobile-safe-invite-rows, mobile-safe-assignment-select]
  affects: [coach-reports-page, coach-invites-page, owner-invites-page, owner-assignments-page]
tech_stack:
  added: []
  patterns: [flex-col sm:flex-row mobile stacking, sm:hidden / hidden sm:inline-flex responsive badge visibility]
key_files:
  created: []
  modified:
    - src/components/coach/ReportRow.tsx
    - src/components/coach/CoachReportsClient.tsx
    - src/components/coach/CoachInvitesClient.tsx
    - src/components/owner/OwnerInvitesClient.tsx
    - src/components/owner/OwnerAssignmentsClient.tsx
decisions:
  - "ReportRow uses sm:contents trick to collapse the top-row flex context on desktop — badge shown in separate div with sm:hidden on mobile, hidden sm:inline-flex on desktop"
  - "OwnerAssignmentsClient select gets min-w-0 w-full on mobile so it fills the parent column, reverts to sm:min-w-[180px] sm:w-auto on desktop"
  - "Magic link metadata lines get flex-wrap added to prevent overflow of the code + metadata inline on narrow screens"
metrics:
  duration: 2 min
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_modified: 5
requirements_met: [UI-04, UI-05]
---

# Phase 10 Plan 04: Mobile Layout Overflow Fixes and Touch Target Audit Summary

Fixed mobile layout overflow issues across 5 components by replacing flat `flex flex-wrap` and `flex items-center justify-between` patterns with `flex-col sm:flex-row sm:items-center` stacking that collapses to vertical card layout on 375px screens.

## Tasks Completed

### Task 1: Fix ReportRow and CoachReportsClient mobile layouts

**ReportRow.tsx** — Replaced the single `flex flex-wrap items-center gap-3 min-h-[44px]` summary row with a two-row mobile layout. On mobile the report card splits into: top row (student name + date + reviewed badge) and bottom row (stars + hours/outreach + action button). On desktop (sm+) both rows collapse via `sm:contents` back into a single horizontal flex line. The `Reviewed` badge is rendered twice: once with `sm:hidden` in the top row for mobile, once with `hidden sm:inline-flex` in the bottom row for desktop.

**CoachReportsClient.tsx** — Changed filter bar wrapper from `flex flex-wrap items-center` to `flex flex-col sm:flex-row sm:items-center`. Tab buttons wrapped in `flex gap-2 flex-wrap` to stay as a horizontal group independently. Student dropdown appears below tabs on mobile, inline on desktop.

### Task 2: Fix invite client and assignment mobile layouts + touch target audit

**CoachInvitesClient.tsx** — Both invite history rows and magic link rows updated from `flex items-center justify-between` to `flex flex-col sm:flex-row sm:items-center`. Content div gets `min-w-0 flex-1`, action buttons wrapped in `shrink-0` div. Magic link metadata line gets `flex-wrap` to prevent overflow of the code + timestamps inline.

**OwnerInvitesClient.tsx** — Same pattern applied. Both invite history rows (line 332) and magic link rows (line 380) now stack on mobile.

**OwnerAssignmentsClient.tsx** — Coach assignment `<select>` changed from `min-w-[180px]` to `min-w-0 w-full sm:min-w-[180px] sm:w-auto`. The parent CardContent already had `flex-col sm:flex-row` so the select fills full width on mobile and reverts to its min-width on desktop.

**Touch target audit** — All `<select>` elements in modified files confirmed at `min-h-[44px]`. All `<button>` elements use the Button component which enforces `min-h-[44px]`. No violations found.

## Decisions Made

- Used `sm:contents` in ReportRow to allow the top-row flex container to "dissolve" into the parent flex context on desktop, keeping desktop layout unchanged while enabling the two-row mobile split
- Added `flex-wrap` to magic link metadata `<p>` elements so long code + date + use-count strings wrap instead of overflow on narrow screens
- OwnerAssignmentsClient select: `w-full` on mobile works because the parent right-column div (`flex items-center gap-2 shrink-0`) is inside a `flex-col sm:flex-row` CardContent, so on mobile the select column is full parent width

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit`: PASSED
- `npm run build`: PASSED
- All 5 components contain `flex-col sm:flex-row` mobile stacking patterns
- ReportRow contains `sm:hidden` (mobile badge) and `hidden sm:inline-flex` (desktop badge)
- Old `flex flex-wrap items-center gap-3 min-h-[44px]` pattern removed from ReportRow
- OwnerAssignmentsClient select: `min-w-[180px]` only appears as `sm:min-w-[180px]`
- All selects in modified files have `min-h-[44px]`

## Self-Check: PASSED
