---
phase: quick
plan: 260401-cwd
subsystem: coach-alerts
tags: [coach, alerts, milestone, notifications, dismissals, rpc]
dependency_graph:
  requires:
    - alert_dismissals table (00004)
    - get_sidebar_badges RPC (00010)
    - work_sessions table
    - users table
  provides:
    - /coach/alerts page (100h milestone alerts)
    - coach_milestone_alerts sidebar badge
    - coach role support in /api/alerts/dismiss
  affects:
    - src/app/(dashboard)/layout.tsx (badge mapping)
    - src/lib/config.ts (COACH_CONFIG, ROUTES, NAVIGATION)
    - src/lib/rpc/types.ts (SidebarBadgesResult)
tech_stack:
  added: []
  patterns:
    - Computed alert pattern (no new table — alert_dismissals reused)
    - Optimistic dismiss with revert on error (matching OwnerAlertsClient)
    - useRef(useToast()) + useRef(useRouter()) for stable deps
    - Server component computes alerts at render time from work_sessions + users
key_files:
  created:
    - supabase/migrations/00014_coach_alert_dismissals.sql
    - src/app/(dashboard)/coach/alerts/page.tsx
    - src/app/(dashboard)/coach/alerts/loading.tsx
    - src/app/(dashboard)/coach/alerts/error.tsx
    - src/components/coach/CoachAlertsClient.tsx
  modified:
    - src/lib/config.ts
    - src/lib/rpc/types.ts
    - src/app/api/alerts/dismiss/route.ts
    - src/app/(dashboard)/layout.tsx
decisions:
  - "Reused alert_dismissals.owner_id column for coach user IDs — valid FK to users.id, no schema change needed"
  - "get_sidebar_badges coach block now returns both unreviewed_reports and coach_milestone_alerts in single JSONB"
  - "Milestone window check: joined_at >= today-45 filters qualifying students before the expensive session aggregation"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-01"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 9
---

# Quick Task 260401-cwd: Add Coach Notification for 100 Hours In Summary

**One-liner:** Computed 100h milestone alerts for coaches using existing alert_dismissals table — no new DB table, sidebar badge via updated get_sidebar_badges RPC, full dismiss/filter UI matching OwnerAlertsClient pattern.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migration, config, types, dismiss API, layout badge | cdbbcad | 00014_coach_alert_dismissals.sql, config.ts, rpc/types.ts, dismiss/route.ts, layout.tsx |
| 2 | Coach alerts page + client component | 40e619c | coach/alerts/page.tsx, CoachAlertsClient.tsx, loading.tsx, error.tsx |

## What Was Built

**Database (migration 00014):**
- Coach RLS policies on `alert_dismissals` — coaches can SELECT/INSERT their own dismissals using the existing `owner_id` column (valid FK to `users.id`)
- Updated `get_sidebar_badges` RPC: coach block now iterates qualifying students (joined within 45 days), sums completed `session_minutes` per student, counts undismissed 100h alerts, returns `coach_milestone_alerts` alongside `unreviewed_reports`

**Config (src/lib/config.ts):**
- `COACH_CONFIG.milestoneMinutesThreshold: 6000` and `milestoneDaysWindow: 45`
- `ROUTES.coach.alerts: "/coach/alerts"`
- Coach nav: "Alerts" item with Bell icon + `coach_milestone_alerts` badge key

**Type (src/lib/rpc/types.ts):**
- `SidebarBadgesResult.coach_milestone_alerts?: number`

**Dismiss API (src/app/api/alerts/dismiss/route.ts):**
- Role gate widened from `owner` only to `owner || coach`

**Layout (src/app/(dashboard)/layout.tsx):**
- Maps `badges.coach_milestone_alerts` to `badgeCounts.coach_milestone_alerts` (only if > 0)

**Coach Alerts Page (server component):**
- Parallel fetch: coach's active students + coach's dismissals
- Computes 45-day cutoff from `today - milestoneDaysWindow * 86400000`
- Filters qualifying students (joined within window), then fetches their completed `session_minutes` in a single batched query
- Builds alerts for students with `sum >= 6000` — key format: `100h_milestone:{student_id}`
- Sorts: undismissed first, then alphabetical by name
- Passes `initialAlerts` to `CoachAlertsClient`

**CoachAlertsClient (client component):**
- Filter tabs: All / Active / Dismissed, default = "active"
- Optimistic dismiss: sets `dismissed: true` immediately, reverts on error
- `handleDismiss` checks `response.ok` before parsing
- Uses `useRef(useToast())` + `useRef(useRouter())` for stable deps
- Alert cards: Trophy icon in `bg-ima-success/10`, Badge variant="success", "View Student" link, "Dismiss" button
- Undismissed: `bordered-left` card with `border-l-ima-success`; dismissed: default card
- Empty state with `EmptyState` component and per-filter messages

**Loading/Error:**
- Loading: 3 skeleton cards with `motion-safe:animate-pulse`
- Error: matches `CoachReportsError` pattern — Card with AlertTriangle, Try Again + Go Home buttons

## Hard Rules Verification

- motion-safe: `motion-safe:transition-colors` on filter tabs, `motion-safe:animate-pulse` in loading skeleton
- 44px: filter tab buttons `min-h-[44px]`, "View Student" link `min-h-[44px] inline-flex items-center`, Button size="sm" uses existing min-h
- Accessible labels: `role="alert"` + `aria-label` on alert container, `aria-hidden="true"` on all icons
- Admin client: `createAdminClient()` in server page for all DB queries
- No swallowed errors: `console.error` on all fetch errors; client dismiss error reverts and toasts
- response.ok: checked in `handleDismiss` before `.json()`
- Zod import: not needed in new files (Zod already used in dismiss route, unchanged)
- ima-* tokens: all colors use `ima-success`, `ima-text`, `ima-text-secondary`, `ima-primary`, `ima-border`, `ima-surface`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- supabase/migrations/00014_coach_alert_dismissals.sql: FOUND
- src/app/(dashboard)/coach/alerts/page.tsx: FOUND
- src/app/(dashboard)/coach/alerts/loading.tsx: FOUND
- src/app/(dashboard)/coach/alerts/error.tsx: FOUND
- src/components/coach/CoachAlertsClient.tsx: FOUND
- Commits cdbbcad and 40e619c: FOUND
- `npx tsc --noEmit`: PASSED (zero errors)
- `npm run build`: PASSED (/coach/alerts in output)
