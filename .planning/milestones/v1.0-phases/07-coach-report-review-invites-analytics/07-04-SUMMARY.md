---
phase: 07-coach-report-review-invites-analytics
plan: "04"
subsystem: coach
tags: [bug-fix, uat, gap-closure, reports, invites]
dependency_graph:
  requires: ["07-01", "07-02"]
  provides: [report-filter-stability, invite-duplicate-guard]
  affects: [coach-reports-page, invites-api]
tech_stack:
  added: []
  patterns: [react-key-remount, 409-conflict-guard]
key_files:
  modified:
    - src/app/(dashboard)/coach/reports/page.tsx
    - src/app/api/invites/route.ts
decisions:
  - "[07-04]: key prop on CoachReportsClient derived from searchParams — forces React unmount/remount when filter or student changes, so useState(reports) always initializes from correctly filtered server prop"
  - "[07-04]: Existing-user check in POST /api/invites queries users table via admin client before code generation — returns 409 before any insert, no orphaned invite codes"
metrics:
  duration: "1 min"
  completed: "2026-03-17"
  tasks_completed: 2
  files_modified: 2
requirements: [COACH-04, COACH-05]
---

# Phase 7 Plan 04: UAT Gap Closure Summary

**One-liner:** React key-prop remount fix for report filter tabs + 409 duplicate-email guard on invite API.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix report filter tabs — add key prop to CoachReportsClient | 1d24ccc | src/app/(dashboard)/coach/reports/page.tsx |
| 2 | Fix invite API — reject existing user emails with 409 | c2ba6ed | src/app/api/invites/route.ts |

## What Was Built

**Task 1 — Report filter tabs (key prop remount)**

Added `key={`${sp.reviewed ?? "all"}-${sp.student_id ?? ""}`}` to the `<CoachReportsClient>` invocation in `coach/reports/page.tsx`. When the coach navigates to a different filter tab or selects a different student (via `router.push`), the URL searchParams change, the server component re-renders with freshly filtered `reports`, and the new `key` value causes React to unmount the old `CoachReportsClient` and mount a fresh instance — so `useState(reports)` initialises from the correct filtered prop rather than stale state.

**Task 2 — Invite duplicate email guard (409)**

Added an `admin.from("users").select("id").eq("email", ...).maybeSingle()` query in `POST /api/invites` immediately after Zod validation and before code generation. If `existingUser` is non-null, returns `{ error: "A user with this email is already registered" }` with HTTP 409. No invite code is generated and no row is inserted.

## Verification

- `npx tsc --noEmit` — passes, no errors
- `npm run build` — passes, all routes compile

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `src/app/(dashboard)/coach/reports/page.tsx` — key prop present on line 197
- [x] `src/app/api/invites/route.ts` — 409 guard present, maybeSingle pattern used
- [x] Commits 1d24ccc and c2ba6ed exist
