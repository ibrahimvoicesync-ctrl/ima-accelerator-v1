---
phase: 52
plan: "01"
subsystem: coach-alerts
tags:
  - coach
  - alerts
  - notifications
  - sidebar
  - types
dependency_graph:
  requires:
    - "51: getCoachMilestonesCached RPC + CoachMilestoneRow types"
    - "51: alert_dismissals table + dismiss route skeleton"
  provides:
    - "CoachAlertFeedItem union type (alerts-types.ts) for Plan 02 page + client"
    - "Dismiss route now busts coach-milestones cache (Plan 02 needs router.refresh() to work)"
    - "Sidebar '9+' cap for coach_milestone_alerts (NOTIF-09)"
  affects:
    - "52-02: coach alerts page rewrite imports CoachAlertFeedItem from alerts-types.ts"
tech_stack:
  added: []
  patterns:
    - "Shared types file with no use-client/server-only — importable from both sides of boundary"
    - "revalidateTag chaining: bust badges + coach-milestones in same dismiss handler"
    - "IIFE in JSX for badge cap logic — avoids module-scope helper, keeps logic colocated"
key_files:
  created:
    - src/components/coach/alerts-types.ts
  modified:
    - src/app/api/alerts/dismiss/route.ts
    - src/components/layout/Sidebar.tsx
decisions:
  - "No use-client or server-only in alerts-types.ts — both page.tsx (server) and CoachAlertsClient.tsx (client) need it"
  - "IIFE pattern in Sidebar badge render over module-scope helper — keeps cap logic colocated per plan guidance"
  - "revalidateTag for owner profile.id is a harmless no-op — no role gate needed (matches existing codebase pattern)"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-14T05:19:51Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
---

# Phase 52 Plan 01: Alerts Plumbing Summary

**One-liner:** Shared CoachAlertFeedItem types module + dismiss-route milestone cache bust + Sidebar "9+" badge cap — all three plumbing gaps required by Plan 02.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create shared alerts-types.ts | c9e4cea | src/components/coach/alerts-types.ts (created) |
| 2 | Patch dismiss route for coach-milestones cache | ed86e2f | src/app/api/alerts/dismiss/route.ts |
| 3 | Add 9+ cap to Sidebar badge render | 0482f7f | src/components/layout/Sidebar.tsx |

---

## What Was Built

### Task 1 — alerts-types.ts

New shared types file at `src/components/coach/alerts-types.ts` with no `"use client"` or `"server-only"` directive. Exports:

- `CoachAlertFeedType` — union of 5 alert types: `100h_milestone` + the 4 RPC milestone types
- `CoachAlertFeedItem` — flat interface used by both server page and client component (alert_key, student_id, student_name, milestone_type, occurred_at, message, deal_id)
- `milestoneRowToFeedItem` — adapter from `CoachMilestoneRow` (RPC shape) to `CoachAlertFeedItem` flat shape; sets `message: null`
- `MILESTONE_META` — lookup record keyed by `CoachAlertFeedType` with label, Icon (lucide-react), iconTint, iconBg, badgeVariant for all 5 types

### Task 2 — Dismiss route cache bust

Added `import { coachMilestonesTag } from "@/lib/rpc/coach-milestones-types"` and a second `revalidateTag(coachMilestonesTag(profile.id), "default")` call after the existing `revalidateTag("badges", "default")`. The existing badges bust is unchanged. This ensures that after a dismiss + `router.refresh()`, Plan 02's alerts page fetches fresh RPC data rather than serving a stale cache.

### Task 3 — Sidebar 9+ cap

Replaced the static `{badgeCounts[item.badge]}` render with an IIFE that computes `displayCount`: for the `coach_milestone_alerts` badge key with `rawCount >= 10`, renders `"9+"`; all other counts and badge keys render the raw number as a string. Span classes unchanged. Cap is scoped exclusively to `coach_milestone_alerts` — other badges (`unread_messages`, `active_alerts`) are unaffected.

---

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched the specified code snippets verbatim. No bugs found, no missing functionality, no blocking issues.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npx eslint` on 3 files | PASS — zero errors |
| `grep -c '"9+"' Sidebar.tsx` | 2 (comment + value literal) |
| `grep -c 'coachMilestonesTag(profile.id)' route.ts` | 1 |
| `grep -c '"use client"' alerts-types.ts` | 0 |
| `grep -c '"server-only"' alerts-types.ts` | 0 |
| `grep -c 'MILESTONE_META' alerts-types.ts` | 2 (declaration + export) |
| All 5 MILESTONE_META keys present | PASS |

---

## Known Stubs

None — this plan creates no UI. All outputs are types, a cache invalidation, and a display cap. No stubs or placeholder data.

---

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The dismiss route modification adds only a `revalidateTag` call with a server-derived ID — no new trust boundary crossed. T-52-06 (tampering via arbitrary coachId) mitigated by using `profile.id` from server auth lookup.

---

## Self-Check: PASSED

- `src/components/coach/alerts-types.ts` — exists, confirmed via Write tool output
- Commit c9e4cea — confirmed via git log
- Commit ed86e2f — confirmed via git log
- Commit 0482f7f — confirmed via git log
- `npx tsc --noEmit` — no output = zero errors (confirmed)
- Lint on all 3 files — no output = zero errors (confirmed)
