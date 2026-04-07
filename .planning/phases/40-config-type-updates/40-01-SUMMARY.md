---
phase: 40-config-type-updates
plan: 01
subsystem: config
tags: [config, navigation, validation, deals, routes]
dependency_graph:
  requires: []
  provides: [ROUTES.student.deals, ROUTES.student_diy.deals, NAVIGATION.student.deals, NAVIGATION.student_diy.deals, VALIDATION.deals]
  affects: [src/app/api/deals/route.ts, src/app/api/deals/[id]/route.ts]
tech_stack:
  added: []
  patterns: [config-as-truth, VALIDATION-import-pattern]
key_files:
  created: []
  modified:
    - src/lib/config.ts
    - src/app/api/deals/route.ts
    - src/app/api/deals/[id]/route.ts
decisions:
  - "VALIDATION.deals includes both min and max for revenue and profit — consistent with outreachCount/brandsContacted pattern"
  - "DollarSign icon chosen for Deals nav entries (no separator, matching plan spec)"
  - "Header comment updated to remove 'deals' from V1 exclusion list — deals are now V1.5 scope"
metrics:
  duration: ~5 minutes
  completed: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
requirements: [DEAL-06]
---

# Phase 40 Plan 01: Config & Type Updates Summary

**One-liner:** Added deals ROUTES/NAVIGATION/VALIDATION constants to config.ts and refactored Phase 39 route handlers to import `VALIDATION.deals` instead of hardcoding `9999999999.99`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add deals ROUTES, NAVIGATION entries, and VALIDATION.deals to config.ts | 60f8933 | src/lib/config.ts |
| 2 | Refactor deal route handlers to import VALIDATION.deals from config | 99e723e | src/app/api/deals/route.ts, src/app/api/deals/[id]/route.ts |

## What Was Built

### Task 1 — config.ts updates

- Added `deals: "/student/deals"` to `ROUTES.student` (between `report` and `chat`)
- Added `deals: "/student_diy/deals"` to `ROUTES.student_diy` (between `roadmap` and `resources`)
- Added `{ label: "Deals", href: ROUTES.student.deals, icon: "DollarSign" }` to student NAVIGATION at position 5 (after Daily Report, before Chat)
- Added `{ label: "Deals", href: ROUTES.student_diy.deals, icon: "DollarSign" }` to student_diy NAVIGATION at position 3 (after Roadmap, before Resources)
- Added `VALIDATION.deals` with `revenueMin: 0`, `revenueMax: 9999999999.99`, `profitMin: 0`, `profitMax: 9999999999.99`
- Removed "deals," from the V1 exclusion comment in the file header

### Task 2 — route handler refactoring

- Added `import { VALIDATION } from "@/lib/config"` to both `src/app/api/deals/route.ts` and `src/app/api/deals/[id]/route.ts`
- Replaced all hardcoded `9999999999.99` literals in Zod schemas with `VALIDATION.deals.revenueMax`, `VALIDATION.deals.profitMax`, `VALIDATION.deals.revenueMin`, `VALIDATION.deals.profitMin`
- No other logic changed in either route handler

## Verification

- `npx tsc --noEmit` — passed with zero errors
- `npx eslint` on modified files — passed with zero errors
- No `9999999999.99` literal remains in either route handler
- `ROUTES.student.deals`, `ROUTES.student_diy.deals` confirmed in config.ts
- `VALIDATION.deals` confirmed in config.ts with all four boundary fields

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all constants are fully wired. Route handlers use the config values at request validation time.

## Threat Flags

None — no new trust boundaries introduced. All changes are compile-time constants.

## Self-Check: PASSED

- `/c/Users/ibrah/ima-accelerator-v1/.claude/worktrees/agent-a6a4778c/src/lib/config.ts` — exists, contains ROUTES.student.deals, ROUTES.student_diy.deals, NAVIGATION Deals entries, VALIDATION.deals
- `/c/Users/ibrah/ima-accelerator-v1/.claude/worktrees/agent-a6a4778c/src/app/api/deals/route.ts` — exists, imports VALIDATION, uses VALIDATION.deals constants
- `/c/Users/ibrah/ima-accelerator-v1/.claude/worktrees/agent-a6a4778c/src/app/api/deals/[id]/route.ts` — exists, imports VALIDATION, uses VALIDATION.deals constants
- Commit 60f8933 — Task 1 config.ts changes
- Commit 99e723e — Task 2 route handler refactoring
