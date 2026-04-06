---
phase: 36-resources-tab
plan: "01"
subsystem: foundation
tags: [migration, types, csp, navigation, config]
dependency_graph:
  requires: []
  provides: [resources-is_pinned-column, resources-types, csp-widgetbot, resources-nav]
  affects: [src/lib/config.ts, src/lib/types.ts, next.config.ts]
tech_stack:
  added: []
  patterns: [config-is-truth, migration-per-feature]
key_files:
  created:
    - supabase/migrations/00018_resources_pin.sql
  modified:
    - src/lib/types.ts
    - next.config.ts
    - src/lib/config.ts
decisions:
  - "Resources nav added to owner/coach/student only — student_diy excluded per D-11/RES-02"
  - "CSP frame-src restricted to 'self' and https://e.widgetbot.io only (not wildcard)"
  - "Owner Resources nav item uses separator:true to visually group it from Alerts"
metrics:
  duration: "5 minutes"
  completed: "2026-04-04"
  tasks_completed: 2
  files_modified: 4
---

# Phase 36 Plan 01: Resources Tab Foundation Summary

Foundation for the Resources Tab: database migration for is_pinned column, TypeScript types update, CSP header for WidgetBot iframe, and navigation config entries for owner/coach/student.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration + Types + CSP header | f484bd8 | supabase/migrations/00018_resources_pin.sql, src/lib/types.ts, next.config.ts |
| 2 | Add Resources to ROUTES and NAVIGATION in config.ts | 21617c9 | src/lib/config.ts |

## Decisions Made

- Resources navigation only wired for owner, coach, student roles. student_diy explicitly excluded per D-11 and RES-02.
- CSP frame-src header uses `'self' https://e.widgetbot.io` — minimal allowlist, not wildcard.
- Owner Resources nav item gets `separator: true` to visually group it from the Alerts entry above.
- Resources nav entries in NAVIGATION use `ROUTES.{role}.resources` references (not inline strings) per config-is-truth rule.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` — passes (0 errors)
- `npm run lint` — passes (0 warnings/errors)
- `npm run build` — passes (all routes compile)
- Migration file at `supabase/migrations/00018_resources_pin.sql` with ADD COLUMN is_pinned
- TypeScript types include is_pinned on resources Row/Insert/Update
- CSP frame-src header in next.config.ts allows https://e.widgetbot.io
- ROUTES has resources for owner, coach, student — none for student_diy
- NAVIGATION has Resources (BookOpen icon) for owner, coach, student — none for student_diy

## Known Stubs

None — this plan creates foundational config only; no UI components or data sources yet.

## Self-Check: PASSED
