---
phase: 52
plan: "02"
subsystem: coach-alerts
tags:
  - coach
  - alerts
  - notifications
  - ui
  - grouped-feed
dependency_graph:
  requires:
    - "52-01: CoachAlertFeedItem types + MILESTONE_META + milestoneRowToFeedItem"
    - "52-01: dismiss route now busts coach-milestones cache"
    - "52-01: Sidebar 9+ cap"
    - "51: getCoachMilestonesCached RPC"
  provides:
    - "NOTIF-09: /coach/alerts page with grouped-by-student milestone feed"
    - "Merged legacy 100h + RPC milestone feeds into single CoachAlertFeedItem[]"
    - "Per-row optimistic dismiss with error revert"
    - "Per-student bulk dismiss via Promise.allSettled with partial revert"
    - "Three filter tabs (All / Active / Dismissed) with ARIA tab semantics"
  affects:
    - "Sidebar badge count already capped at 9+ (Plan 01)"
    - "/api/alerts/dismiss — consumed by CoachAlertsClient for both single and bulk dismiss"
tech_stack:
  added: []
  patterns:
    - "Server Component merges two async data sources (legacy query + RPC) before passing to Client Component"
    - "Client-side dismissed Set<string> for optimistic UI — server owns truth after router.refresh()"
    - "Promise.allSettled for bulk dismiss — partial success/revert semantics"
    - "useMemo for filter+group derivation — tab switches never round-trip to server"
    - "Stable refs for toast/router callbacks in useCallback deps"
    - "role=tab + aria-selected on filter buttons (not aria-pressed — ARIA spec compliance)"
key_files:
  created: []
  modified:
    - src/app/(dashboard)/coach/alerts/page.tsx
    - src/components/coach/CoachAlertsClient.tsx
decisions:
  - "Use completed_at (not updated_at) for work_sessions latest-completion timestamp — updated_at column does not exist in schema"
  - "Use aria-selected on role=tab elements (not aria-pressed) — jsx-a11y/role-supports-aria-props enforces ARIA spec; aria-pressed is for role=button/checkbox/menuitem"
  - "Target lint check runs on plan files only — npm run lint scans .claude/worktrees/ and .next/build/ which have pre-existing unrelated errors; targeted file lint exits 0"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-14T05:30:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 2
---

# Phase 52 Plan 02: Coach Alerts Page Summary

**One-liner:** Grouped-by-student milestone alerts page merging legacy 100h + Phase 51 RPC feeds with optimistic single-row and bulk dismiss via Promise.allSettled.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite coach/alerts/page.tsx to merge legacy 100h + RPC milestone feeds | 280eddb | src/app/(dashboard)/coach/alerts/page.tsx |
| 2 | Rewrite CoachAlertsClient.tsx with grouped feed, bulk dismiss, and multi-type rendering | 9ab12bb | src/components/coach/CoachAlertsClient.tsx |
| 3 | Run phase-level build gate and grep-verify all contract invariants | (no commit — gate task) | all 5 plan files verified |

---

## What Was Built

### Task 1 — coach/alerts/page.tsx rewrite

Complete rewrite of the server component. Key changes from the pre-Phase-52 page:

- **Replaced** `getToday()` with `getTodayUTC()` so the RPC cache key is stable across server timezone drift (matches Phase 48/51 precedent).
- **Three parallel fetches** via `Promise.all`: active students, coach's dismissed keys, and `getCoachMilestonesCached(user.id, today)`.
- **Legacy 100h feed** preserved — computes 45-day qualification window, sums `session_minutes` per student, emits one `CoachAlertFeedItem` per qualifying undismissed student. Uses `completed_at` (not the non-existent `updated_at`) as the latest-session timestamp.
- **RPC feed** mapped via `milestoneRowToFeedItem` from `alerts-types.ts`.
- **Merged and sorted** both feeds by `occurred_at` descending before passing to client.
- **Prop name** changed to `initialFeed` (was `initialAlerts`); old `CoachAlertItem` type import fully removed.
- **UI-SPEC compliance**: Bell icon `text-ima-primary`, h1 `font-semibold`, active-count badge `ima-success/10 text-ima-success`, subheading text matches Copywriting Contract exactly.

### Task 2 — CoachAlertsClient.tsx rewrite

Complete rewrite of the client component. Key changes:

- **Props**: `initialFeed: CoachAlertFeedItem[]` — no longer carries a `dismissed` boolean field; dismissed state is a `Set<string>` of alert_keys owned by the client.
- **Old `CoachAlertItem` type** deleted entirely — no re-export.
- **Grouping via useMemo**: filters feed per tab, groups by `student_id`, sorts groups by max `occurred_at` descending, sorts rows within groups by `occurred_at` descending.
- **Single-row dismiss**: optimistic add to `dismissedKeys`, API call via `postDismiss()`, revert on failure + error toast, success toast + `router.refresh()`.
- **Bulk dismiss**: `Promise.allSettled` over all undismissed keys in group, only failed keys revert, single toast per outcome, `router.refresh()` only when at least one succeeded.
- **Filter tabs**: plain `<button>` elements with `role="tab"`, `aria-selected={filter === key}`, `type="button"`, `min-h-[44px]`; container has `role="tablist"`.
- **Alert rows**: `Card variant="bordered-left" className="border-l-ima-success"` for active; `variant="default"` for dismissed. `CardContent className="p-4"` (16px per spec). `role="alert"` on inner div.
- **Icons**: `MILESTONE_META[row.milestone_type]` drives all icon/label/color — zero hardcoded label strings.
- **All four toast titles** match UI-SPEC Copywriting Contract verbatim.
- **Stable callback deps**: `toast` and `router` accessed via refs inside `useCallback`; `postDismiss` is a plain async function (not memoized) to keep `handleDismiss`/`handleBulkDismiss` deps minimal.

### Task 3 — Build gate and contract invariants

All checks passed:

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npm run build` | PASS — 56 pages, exit 0 |
| Targeted ESLint on 3 plan files | PASS — zero errors |
| Plan 01 artifacts still present | PASS — all 3 invariants matched |
| Plan 02 Task 1 contract greps | PASS — all 4 invariants matched |
| Plan 02 Task 2 contract greps | PASS — all invariants matched |
| `git diff package.json package-lock.json` | PASS — unchanged |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed: work_sessions.updated_at does not exist**
- **Found during:** Task 1 (TypeScript typecheck after writing page.tsx)
- **Issue:** Plan code snippet used `updated_at` in the work_sessions select query, but the actual schema column is `completed_at` (see migration 00001_create_tables.sql). TypeScript threw `SelectQueryError<"column 'updated_at' does not exist on 'work_sessions'">` on 8 lines.
- **Fix:** Replaced all three occurrences of `updated_at` with `completed_at` in the select string and the loop logic.
- **Files modified:** `src/app/(dashboard)/coach/alerts/page.tsx`
- **Commit:** 280eddb

**2. [Rule 2 - A11y] Fixed: aria-pressed not valid on role="tab"**
- **Found during:** Task 2 ESLint run (`jsx-a11y/role-supports-aria-props` warning)
- **Issue:** Plan spec called for `aria-pressed={filter === key}` on `role="tab"` buttons. Per ARIA spec, `aria-pressed` is valid on `role="button"`, `role="checkbox"`, etc. — not `role="tab"`. The correct attribute for tab selection state is `aria-selected`.
- **Fix:** Replaced `aria-pressed={filter === key}` with `aria-selected={filter === key}`. This also satisfies the plan's acceptance criterion intent (keyboard-accessible filter tabs with correct ARIA state).
- **Files modified:** `src/components/coach/CoachAlertsClient.tsx`
- **Commit:** 9ab12bb

---

## Known Stubs

None — both files are fully wired. The page fetches live data from Supabase and the RPC; the client component derives all UI state from `initialFeed`. No placeholder text, hardcoded empty arrays, or mock data.

---

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `/coach/alerts` page was already behind `requireRole("coach")` auth. The `CoachAlertsClient` only calls the existing `/api/alerts/dismiss` route (POST with `alert_key`). No new trust boundaries crossed.

---

## Self-Check: PASSED

- `src/app/(dashboard)/coach/alerts/page.tsx` — exists, confirmed via Write
- `src/components/coach/CoachAlertsClient.tsx` — exists, confirmed via Write
- Commit 280eddb — confirmed via `git log`
- Commit 9ab12bb — confirmed via `git log`
- `npx tsc --noEmit` — zero errors (confirmed)
- `npm run build` — exit 0, 56 pages (confirmed)
- Targeted ESLint on plan files — exit 0, zero errors (confirmed)
- All contract invariants — passed (confirmed above)
