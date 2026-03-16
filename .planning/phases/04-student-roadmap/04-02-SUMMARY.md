---
phase: 04-student-roadmap
plan: "02"
subsystem: ui
tags: [react, supabase, roadmap, tailwind, server-components, client-components]

# Dependency graph
requires:
  - phase: 04-student-roadmap/04-01
    provides: UI primitives (Button, Badge, Modal, Toast), PATCH /api/roadmap route
  - phase: 01-foundation
    provides: types.ts, config.ts, session.ts, admin client
  - phase: 03-student-work-tracker
    provides: student dashboard page, dashboard layout

provides:
  - RoadmapStep component with completed/active/locked visual states and 44px touch targets
  - RoadmapClient client island with PATCH fetch, Modal confirmation, stable router ref pattern
  - /student/roadmap server page with lazy seeding (Step 1 auto-completed on first visit)
  - Dashboard live roadmap card with adaptive CTA (Continue/Complete/View)
  - ToastProvider wired into dashboard layout for all student pages

affects:
  - 05-daily-report (uses dashboard layout with ToastProvider)
  - any phase that adds student pages (ToastProvider already in layout)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Lazy seeding pattern — server page checks progress.length < ROADMAP_STEPS.length, deletes partial rows, inserts full seed set on first visit
    - Stable router ref pattern — useRef(useRouter()) avoids dependency churn in useCallback
    - Toast ref pattern — toastRef.current = toast in useEffect keeps toast current in closures
    - Promise.all parallel queries — dashboard parallel-loads work_sessions + roadmap_progress

key-files:
  created:
    - src/components/student/RoadmapStep.tsx
    - src/components/student/RoadmapClient.tsx
    - src/app/(dashboard)/student/roadmap/page.tsx
  modified:
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/layout.tsx

key-decisions:
  - "bg-ima-surface-light for locked circle (not bg-ima-surface) — subtle differentiation for locked state"
  - "Lazy seeding runs server-side on page load — no separate API call, transparent to student"
  - "ToastProvider inside <main> not at root layout — scoped to dashboard, avoids noise on auth pages"
  - "Promise.all for parallel queries in student dashboard — avoids sequential DB round trips"

patterns-established:
  - "Lazy seeding: server page checks rows count, seeds with Step 1 completed if missing"
  - "Stable refs: routerRef + toastRef pattern for async mutation callbacks"
  - "V1 type derivation: Database['public']['Tables']['roadmap_progress']['Row'] not named export"

requirements-completed: [ROAD-01, ROAD-02, ROAD-03]

# Metrics
duration: 15min
completed: 2026-03-16
---

# Phase 4 Plan 02: Student Roadmap Summary

**10-step roadmap page with lazy seeding, visual step states (completed/active/locked), mark-complete modal, and live dashboard card with adaptive CTA**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-16T20:30:00Z
- **Completed:** 2026-03-16T20:45:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Roadmap page renders 10 steps with green/blue/gray circle indicators, lazy-seeds on first visit with Step 1 completed and Step 2 active
- RoadmapClient confirmation modal triggers PATCH /api/roadmap, shows success/error toasts, refreshes via router.refresh()
- Student dashboard roadmap card replaced placeholder with live data: completion count, progress bar, adaptive CTA
- ToastProvider added to dashboard layout — toast notifications work across all student pages

## Task Commits

Each task was committed atomically:

1. **Task 1: RoadmapStep, RoadmapClient, and roadmap server page** - `4ae1094` (feat)
2. **Task 2: Wire dashboard roadmap card and ToastProvider** - `c64207b` (feat)

**Plan metadata:** (docs commit — created with this SUMMARY)

## Files Created/Modified
- `src/components/student/RoadmapStep.tsx` - Single step with circle indicator, connecting line, status-based styling (completed/active/locked)
- `src/components/student/RoadmapClient.tsx` - Client island: step list, PATCH fetch, Modal confirmation, toast on success/error
- `src/app/(dashboard)/student/roadmap/page.tsx` - Server page: lazy seeding, progress card, celebration card, RoadmapClient render
- `src/app/(dashboard)/student/page.tsx` - Dashboard: Promise.all queries, live roadmap card with adaptive CTA replacing placeholder
- `src/app/(dashboard)/layout.tsx` - ToastProvider wrapping dashboard children

## Decisions Made
- `bg-ima-surface-light` for locked circle (plan specified this change from reference-old's `bg-ima-surface`)
- Lazy seeding runs entirely server-side — no separate seeding API endpoint needed
- ToastProvider inside `<main>` scopes toasts to dashboard, avoiding auth pages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 04-01 prerequisites were uncommitted**
- **Found during:** Pre-execution check
- **Issue:** Plan 04-02 depends on 04-01 (UI primitives + roadmap API route). The route was already committed (9562b82, ca9a240). UI files (Badge, Button, Modal, Toast, Spinner, index.ts) were already on disk but some were not yet tracked.
- **Fix:** Verified all 04-01 files existed on disk and type-checked; created only the missing roadmap API route. No new UI work needed — everything was in place.
- **Files modified:** src/app/api/roadmap/route.ts (already committed in prior session)
- **Verification:** npx tsc --noEmit passed, npm run build succeeded
- **Committed in:** 9562b82 (pre-existing commit)

---

**Total deviations:** 1 auto-assessed (blocking dependency already resolved)
**Impact on plan:** No scope creep. 04-01 artifacts were in place; 04-02 executed cleanly.

## Issues Encountered
None — all plan files were in correct state for execution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Student roadmap fully functional: 10-step view, lazy seeding, mark-complete flow, dashboard card
- Phase 5 (Daily Report) can use ToastProvider already wired in dashboard layout
- PATCH /api/roadmap ready for integration tests

---
*Phase: 04-student-roadmap*
*Completed: 2026-03-16*
