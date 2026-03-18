---
phase: 06-coach-dashboard-student-views
plan: "02"
subsystem: coach-student-detail
tags: [coach, student-detail, tabs, server-component, at-risk]
dependency_graph:
  requires:
    - 06-01 (CoachDashboard and student list must exist for navigation link)
    - src/lib/session.ts (requireRole)
    - src/lib/supabase/admin.ts (createAdminClient)
    - src/lib/config.ts (COACH_CONFIG, ROADMAP_STEPS)
    - src/components/ui/Badge.tsx
    - src/components/ui/Card.tsx
    - src/components/ui/Button.tsx
  provides:
    - /coach/students/[studentId] page with 3-tab detail view
    - StudentDetailClient (tab orchestrator)
    - StudentHeader (back nav + avatar + at-risk badge)
    - StudentDetailTabs (ARIA tablist with 3 tabs)
    - RoadmapTab (10-step timeline + progress bar)
    - WorkSessionsTab (grouped by date with cycle cards)
    - ReportsTab (read-only report list with star ratings)
  affects:
    - Coach workflow: enables drill-down from student list to detail view
tech_stack:
  added: []
  patterns:
    - Server component with parallel data fetch (Promise.all)
    - Defense-in-depth: server page filters by coach_id to prevent cross-coach access
    - URL query param update via window.history.replaceState for tab state
    - Inline type definitions instead of importing from lib/types
key_files:
  created:
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/components/coach/StudentDetailClient.tsx
    - src/components/coach/StudentHeader.tsx
    - src/components/coach/StudentDetailTabs.tsx
    - src/components/coach/RoadmapTab.tsx
    - src/components/coach/WorkSessionsTab.tsx
    - src/components/coach/ReportsTab.tsx
  modified: []
decisions:
  - "StudentHeader omits niche display per V1 scope (niche in schema but not surfaced on coach detail header)"
  - "ReportsTab has no mark-as-reviewed action — that is Phase 7 scope"
  - "eslint-disable-next-line on Date.now() in server page — react-hooks/purity is false positive for async server components"
  - "Back button links to /coach (not /coach/students) — /coach/students just redirects to /coach"
metrics:
  duration: "4 min"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 6 Plan 02: Student Detail Page Summary

**One-liner:** Coach student detail page with 3-tab view (Work Sessions/Roadmap/Reports), server-side parallel data fetch, defense-in-depth coach_id guard, and at-risk computation.

## What Was Built

The student detail page at `/coach/students/[studentId]` gives coaches a complete picture of individual student activity. The server component fetches all data in parallel and passes it to a client-side tab orchestrator.

### Server Page (`[studentId]/page.tsx`)
- Calls `requireRole("coach")` for auth enforcement
- Fetches student with `.eq("coach_id", user.id)` defense-in-depth (cross-coach prevention)
- Returns `notFound()` if student doesn't belong to this coach
- Parallel `Promise.all` fetches: work sessions (120 limit), roadmap progress, daily reports (20 limit)
- Computes at-risk status: inactivity days + 7-day average star rating below threshold
- Reads `?tab=` query param and passes as `initialTab` for URL-driven initial tab

### StudentHeader
- Back button (Link + ghost Button) to `/coach`
- Initials avatar (w-14 h-14, bg-ima-primary, text-white)
- Student name as `<h1>`, join date formatted
- Suspended badge when `status === "suspended"`
- At-risk badge (error variant) + reasons string when `isAtRisk`

### StudentDetailTabs
- 3 tabs only: Work Sessions, Roadmap, Reports (no deals/calls from reference-old)
- `role="tablist"` on container, `role="tab"` on each button
- `aria-selected`, `aria-controls` for ARIA compliance
- Exports `TabKey` type for use in `StudentDetailClient`

### StudentDetailClient
- `useState<TabKey>` for active tab
- `handleTabChange` updates URL via `window.history.replaceState` (no page reload)
- Renders tab components conditionally by `activeTab` value

### Tab Components
- **RoadmapTab:** Progress bar with `role="progressbar"` + `aria-valuenow/min/max`, 10-step timeline from `ROADMAP_STEPS`, locked/active/completed icons with `aria-hidden`
- **WorkSessionsTab:** Groups sessions by date using `Map`, displays cycle cards with status badges, inline empty state
- **ReportsTab:** Read-only report cards with `StarDisplay` helper, Reviewed/Pending badges, wins/improvements text, no mark-as-reviewed (Phase 7)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added eslint-disable for Date.now() in server page**
- **Found during:** Task 2 lint verification
- **Issue:** `react-hooks/purity` lint rule flags `Date.now()` as impure, even in async server components (false positive)
- **Fix:** Added `// eslint-disable-next-line react-hooks/purity -- async server component, not a hook` comment
- **Files modified:** `src/app/(dashboard)/coach/students/[studentId]/page.tsx`
- **Commit:** c82e889

## Pre-existing Issues (Out of Scope)

**`src/app/(dashboard)/coach/page.tsx`** — 2 `react-hooks/purity` lint errors on `Date.now()` calls at lines 97 and 126. These existed before this plan and are not caused by 06-02 changes. Logged to `deferred-items.md`.

## Acceptance Criteria Verification

- [x] `src/components/coach/RoadmapTab.tsx` exists with `export function RoadmapTab`
- [x] RoadmapTab imports `ROADMAP_STEPS` from `@/lib/config`
- [x] RoadmapTab contains `role="tabpanel"` and `role="progressbar"`
- [x] RoadmapTab has `aria-hidden="true"` on icons
- [x] RoadmapTab uses `motion-safe:transition-all motion-safe:duration-300`
- [x] `src/components/coach/WorkSessionsTab.tsx` exists with `export function WorkSessionsTab`
- [x] WorkSessionsTab has group-by-date logic using `Map`
- [x] WorkSessionsTab has `role="tabpanel"` with `id="tabpanel-work"`
- [x] WorkSessionsTab does NOT contain `EmptyState` import
- [x] `src/components/coach/ReportsTab.tsx` exists with `export function ReportsTab`
- [x] ReportsTab does NOT contain `handleReview`
- [x] ReportsTab does NOT contain "Mark Reviewed" text
- [x] ReportsTab does NOT contain `onReviewComplete` in interface
- [x] ReportsTab contains `StarDisplay` helper
- [x] ReportsTab has `role="tabpanel"` with `id="tabpanel-reports"`
- [x] `src/components/coach/StudentHeader.tsx` exists with Link to `/coach`
- [x] StudentHeader has `Badge variant="error"` for at-risk
- [x] StudentHeader has `aria-hidden="true"` on ChevronLeft
- [x] `src/components/coach/StudentDetailTabs.tsx` exists with exactly 3 tabs
- [x] StudentDetailTabs does NOT contain "deals" or "calls"
- [x] StudentDetailTabs has `role="tablist"` and `role="tab"`
- [x] StudentDetailTabs exports `TabKey` type
- [x] `src/components/coach/StudentDetailClient.tsx` has "use client" directive
- [x] StudentDetailClient has `window.history.replaceState` for URL update
- [x] StudentDetailClient does NOT contain "PlayerCard", "DealsTab", "CallsTab", or "Modal"
- [x] StudentDetailClient imports all 5 sub-components
- [x] `/coach/students/[studentId]/page.tsx` exists
- [x] Server page has `requireRole("coach")`
- [x] Server page has `.eq("coach_id", user.id)` defense-in-depth
- [x] Server page has `notFound()` for missing student
- [x] Server page has `Promise.all` parallel fetch
- [x] Server page has `COACH_CONFIG.atRiskInactiveDays`
- [x] Server page has `console.error` for error handling
- [x] Server page does NOT have "use client"
- [x] `npx tsc --noEmit` exits 0
- [x] Build succeeds with route `/coach/students/[studentId]` in output

## Self-Check: PASSED
