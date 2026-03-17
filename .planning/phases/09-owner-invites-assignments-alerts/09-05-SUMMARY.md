---
phase: 09-owner-invites-assignments-alerts
plan: "05"
subsystem: owner-alerts
tags: [bug-fix, grace-period, joined_at, false-positive, uat]
dependency_graph:
  requires: ["09-03"]
  provides: ["joined_at grace period for alert classification"]
  affects: ["src/app/(dashboard)/owner/alerts/page.tsx", "src/app/(dashboard)/layout.tsx"]
tech_stack:
  added: []
  patterns: ["account age grace period via joined_at timestamp comparison"]
key_files:
  modified:
    - src/app/(dashboard)/owner/alerts/page.tsx
    - src/app/(dashboard)/layout.tsx
decisions:
  - "[09-05]: joined_at grace period checks placed inline before alert key creation — avoids early-continue complexity, each threshold branch has its own guard"
  - "[09-05]: accountAgeDays computed from nowMs (end-of-day epoch) matching inactiveCutoff/dropoffCutoff computation — consistent reference point"
metrics:
  duration: "2 min"
  completed: "2026-03-17"
  tasks_completed: 2
  files_modified: 2
requirements: ["OWNER-08"]
---

# Phase 09 Plan 05: Fix False-Positive Dropoff Alerts Summary

**One-liner:** Fixed false-positive student dropoff alerts by adding joined_at grace periods — students with account age < 7 days are excluded from dropoff, < 3 days from inactive, in both the alerts page and sidebar badge count.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add joined_at grace period to alerts page | 1922950 | src/app/(dashboard)/owner/alerts/page.tsx |
| 2 | Add joined_at grace period to sidebar badge computation | 6d6b731 | src/app/(dashboard)/layout.tsx |

## What Was Built

This plan closes UAT issue 9: new students were immediately appearing as "dropoff" alerts with the message "Has never logged any activity" because the alert classification treated `!last` (no activity record) as 999 days inactive without checking account age.

**Root cause:** The classification loop used `!last || last < dropoffCutoff` with no account age check, so any student who hadn't yet logged any activity would immediately appear as a critical dropoff alert the moment their account was created.

**Fix:** Both files now compute `accountAgeDays = (nowMs - new Date(student.joined_at).getTime()) / 86400000` before each alert branch and skip classification if the account is younger than the relevant threshold.

### Alerts page (src/app/(dashboard)/owner/alerts/page.tsx)
- Added `joined_at` to student select query
- Added grace period computation in the classification loop
- Dropoff guard: `if (accountAgeDays < thresholds.studentDropoffDays) continue` (7 days)
- Inactive guard: `if (accountAgeDays < thresholds.studentInactiveDays) continue` (3 days)
- Unreviewed reports and coach underperformance alerts are unaffected

### Sidebar badge (src/app/(dashboard)/layout.tsx)
- Added `joined_at` to student select query
- Switched classification loop from `for (const sid of studentIds)` to `for (const s of (allStudents ?? []))` to access `joined_at`
- Applied identical grace period guards for dropoff and inactive counts
- Badge count is now consistent with the alerts page classification

## Verification

- `npx tsc --noEmit` exits 0
- `npm run lint` exits 0
- `npm run build` succeeds — all routes compile cleanly

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist
- src/app/(dashboard)/owner/alerts/page.tsx — contains `joined_at`
- src/app/(dashboard)/layout.tsx — contains `joined_at`

### Commits exist
- 1922950 — fix(09-05): add joined_at grace period to owner alerts page
- 6d6b731 — fix(09-05): add joined_at grace period to sidebar badge computation

## Self-Check: PASSED

All files present and all commits verified.
