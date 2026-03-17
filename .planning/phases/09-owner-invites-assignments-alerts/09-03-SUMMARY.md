---
phase: 09-owner-invites-assignments-alerts
plan: "03"
subsystem: owner-alerts
tags: [alerts, dismissals, badge, owner, computed-alerts]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [owner-alerts-page, alert-dismissals-table, dismiss-api]
  affects: [dashboard-layout, sidebar-badge, config]
tech_stack:
  added: []
  patterns:
    - Computed alerts (no cron, query-time only)
    - Exclusive inactive/dropoff classification (if/else if)
    - Optimistic dismiss with revert on error
    - stable toastRef/routerRef pattern
    - new Date(today + "T23:59:59Z").getTime() instead of Date.now() for react-hooks/purity compliance
key_files:
  created:
    - supabase/migrations/00004_alert_dismissals.sql
    - src/app/api/alerts/dismiss/route.ts
    - src/components/owner/OwnerAlertsClient.tsx
    - src/app/(dashboard)/owner/alerts/page.tsx
  modified:
    - src/lib/config.ts
    - src/app/(dashboard)/layout.tsx
    - src/lib/types.ts
decisions:
  - "alert_dismissals table uses UNIQUE(owner_id, alert_key) — upsert with ignoreDuplicates: true makes re-dismiss idempotent"
  - "Student 7+ days inactive = dropoff ONLY (exclusive if/else if) — never shown as both inactive and dropoff"
  - "Unreviewed reports = ONE summary alert with count — not per-report cards"
  - "Alert keys are time-windowed: inactive=daily, dropoff=weekly, unreviewed=daily, coach=monthly — dismissed condition re-triggers in new window"
  - "Badge computation in layout.tsx uses nowMs from new Date(today + T23:59:59Z) to avoid react-hooks/purity lint error on Date.now()"
  - "alert_dismissals added to types.ts placeholder — required for TypeScript to accept upsert (Rule 3 auto-fix)"
metrics:
  duration: "5 min"
  completed: "2026-03-17"
  tasks_completed: 2
  files_changed: 7
---

# Phase 09 Plan 03: Owner Alert System Summary

**One-liner:** Computed at-risk alerts (inactive/dropoff/unreviewed/coach) with dismiss-to-dismissals-table and sidebar badge count.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | alert_dismissals migration and POST /api/alerts/dismiss | e38a4fa | supabase/migrations/00004_alert_dismissals.sql, src/app/api/alerts/dismiss/route.ts, src/lib/types.ts |
| 2 | Owner alerts page, OwnerAlertsClient, config badge, layout wiring | 4e60f39 | src/lib/config.ts, src/app/(dashboard)/layout.tsx, src/components/owner/OwnerAlertsClient.tsx, src/app/(dashboard)/owner/alerts/page.tsx |

## What Was Built

**alert_dismissals table** (`00004_alert_dismissals.sql`): Tracks which computed alerts the owner has dismissed. UNIQUE(owner_id, alert_key) constraint. RLS: owner can SELECT and INSERT only their own rows using `(select get_user_role()) = 'owner'` initplan pattern. Explicit GRANT ALL as defense-in-depth.

**POST /api/alerts/dismiss**: Owner-only endpoint that validates `alert_key` (Zod, 1-200 chars), upserts into alert_dismissals idempotently. `owner_id` set from authenticated profile.id, never from request body.

**OwnerAlertsClient**: "use client" component. Filter tabs (All/Active/Dismissed) with active count badge. Alert cards with `role="alert"`, severity icon (aria-hidden), badge (error/warning variant), time-ago display, "View Details" link to owner/students/[id] or owner/coaches/[id], and Dismiss button. Optimistic dismiss with automatic revert on error. Stable `toastRef`/`routerRef` pattern. `motion-safe:transition-colors` on filter buttons. All touch targets ≥44px.

**Owner alerts page** (`/owner/alerts`): Server component computing 4 alert types at request time:
- `student_inactive:{id}:{YYYY-MM-DD}` — 3-6 days no activity (warning)
- `student_dropoff:{id}:{YYYY-WW}` — 7+ days no activity (critical, exclusive with inactive)
- `unreviewed_reports:{YYYY-MM-DD}` — single summary with count (warning)
- `coach_underperform:{id}:{YYYY-MM}` — avg rating < 2.5 over 14 days (warning)

Alerts sorted: active-first, then critical > warning. Dismissed state derived from alert_dismissals lookup.

**Config + layout badge**: `badge: "active_alerts"` added to NAVIGATION.owner Alerts entry. Layout.tsx extends badge computation to owner role: counts all active alerts minus dismissed count for sidebar badge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added alert_dismissals to types.ts placeholder**
- **Found during:** Task 1
- **Issue:** TypeScript strict types on Supabase client — `alert_dismissals` table didn't exist in `src/lib/types.ts`, causing TS2769 "no overload matches" on `.upsert()` call.
- **Fix:** Added full Row/Insert/Update/Relationships types for `alert_dismissals` to `src/lib/types.ts`.
- **Files modified:** src/lib/types.ts
- **Commit:** e38a4fa

**2. [Rule 1 - Bug] Replaced Date.now() with date-string-derived nowMs in layout.tsx and alerts page**
- **Found during:** Task 2 lint check
- **Issue:** `react-hooks/purity` lint rule flags `Date.now()` as an impure function call in server components. Lint exit code 1 on both layout.tsx and alerts/page.tsx.
- **Fix:** Used `new Date(todayStr + "T23:59:59Z").getTime()` pattern (same pattern used in existing coach block) to derive `nowMs` from today's date string.
- **Files modified:** src/app/(dashboard)/layout.tsx, src/app/(dashboard)/owner/alerts/page.tsx
- **Commit:** 4e60f39

## Self-Check: PASSED

- supabase/migrations/00004_alert_dismissals.sql: FOUND
- src/app/api/alerts/dismiss/route.ts: FOUND
- src/components/owner/OwnerAlertsClient.tsx: FOUND
- src/app/(dashboard)/owner/alerts/page.tsx: FOUND
- Commit e38a4fa: FOUND
- Commit 4e60f39: FOUND
- npx tsc --noEmit: exits 0
- npm run lint: exits 0
- npm run build: passes, /owner/alerts listed as dynamic route
