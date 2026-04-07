---
phase: 18-roadmap-date-kpis-completion-logging
plan: 01
subsystem: ui
tags: [roadmap, deadline, badge, date-math, utc, discriminated-union]

# Dependency graph
requires:
  - phase: 13-schema-config-foundation
    provides: target_days in ROADMAP_STEPS config and getTodayUTC() utility
  - phase: 16-coach-owner-kpi-visibility
    provides: RoadmapProgress type and 15-step ROADMAP_STEPS with target_days: number | null

provides:
  - getDeadlineStatus() utility in src/lib/roadmap-utils.ts (consumed by Plan 02)
  - DeadlineStatus discriminated union type with 5 kinds (none/completed/on-track/due-soon/overdue)
  - Student roadmap step with colored Badge chips for each deadline state
  - completed_at timestamp display with optional "(Xd late)" suffix

affects:
  - 18-02 (plan 02 imports getDeadlineStatus from roadmap-utils.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Discriminated union type for status state machines (DeadlineStatus)
    - UTC-only date math via getTodayUTC() + "T00:00:00Z" construction
    - joinedAt normalization handles both ISO timestamps and date-only strings

key-files:
  created:
    - src/lib/roadmap-utils.ts
  modified:
    - src/components/student/RoadmapStep.tsx

key-decisions:
  - "getDeadlineStatus returns kind: none for target_days: null steps — no chip renders (D-01)"
  - "Completed badge always variant=success regardless of lateness — daysLate suffix is the only late indicator (D-05)"
  - "All toLocaleDateString calls include timeZone: UTC to prevent off-by-one in non-UTC timezones"
  - "joinedAt normalized to YYYY-MM-DD before date construction to handle ISO timestamps from DB"

patterns-established:
  - "UTC date construction: new Date(normalizedDateStr + T00:00:00Z) never new Date(dateStr)"
  - "getTodayUTC() for today — never new Date() directly for deadline math"
  - "Discriminated union with kind field for status chips (roadmap-utils pattern)"

requirements-completed: [ROAD-02, ROAD-03, ROAD-04]

# Metrics
duration: 3min
completed: 2026-03-28
---

# Phase 18 Plan 01: Roadmap Deadline Status Chips Summary

**getDeadlineStatus() utility with DeadlineStatus discriminated union; student roadmap upgraded from primitive red text to colored Badge chips (on-track green / due-soon amber / overdue red / completed green with date and optional late suffix)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-28T17:53:02Z
- **Completed:** 2026-03-28T17:56:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/lib/roadmap-utils.ts` with `getDeadlineStatus()` function and `DeadlineStatus` discriminated union type covering all 5 deadline states
- Replaced primitive red-text deadline display in `RoadmapStep.tsx` with proper Badge chips — on-track (green), due-soon (amber), overdue (red), completed (green with date + optional late suffix)
- All date math is UTC-safe: uses `getTodayUTC()` and explicit `T00:00:00Z` construction, never `new Date()` for comparisons
- Steps with `target_days: null` produce `kind: "none"` — no chip renders per D-01
- Completed steps always show green Badge with formatted date; if completed past deadline, shows `(Xd late)` suffix per D-03/D-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Create roadmap-utils.ts with getDeadlineStatus() utility** - `38152de` (feat)
2. **Task 2: Upgrade RoadmapStep.tsx with Badge-based deadline status chips** - `5b9bac6` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/roadmap-utils.ts` - DeadlineStatus discriminated union type and getDeadlineStatus() utility; exported for Plan 02 consumption
- `src/components/student/RoadmapStep.tsx` - Replaced deadlineDate variable + old deadline paragraph + old completed Badge with new deadlineStatus computation and five-kind Badge chip rendering

## Decisions Made
- `getDeadlineStatus` normalizes `joinedAt` before date construction — handles both `"2026-01-15T12:00:00Z"` and `"2026-01-15"` formats from DB
- `daysLeft <= 2` boundary (inclusive) matches D-04: steps with `target_days: 0` show "Due Soon" on join day, "Overdue" the day after
- `daysLate > 0 ? daysLate : null` — only positive late counts shown; on-time completions get `null` (no suffix)
- Plan 02 can import `getDeadlineStatus` directly from `@/lib/roadmap-utils` — already established in this plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `getDeadlineStatus()` and `DeadlineStatus` type are exported and ready for Plan 02 consumption
- Plan 02 can import from `@/lib/roadmap-utils` without any additional setup
- TypeScript compiles cleanly, lint passes (zero errors), production build succeeds

---
*Phase: 18-roadmap-date-kpis-completion-logging*
*Completed: 2026-03-28*
