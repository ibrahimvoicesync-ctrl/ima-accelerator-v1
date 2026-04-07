---
phase: 41-student-deals-pages
plan: "01"
subsystem: student-deals-client
tags: [react, useOptimistic, CRUD, modal, client-components]
dependency_graph:
  requires:
    - src/lib/types.ts (Database.deals Row type)
    - src/lib/config.ts (VALIDATION.deals bounds)
    - src/components/ui/Modal.tsx
    - src/components/ui/Input.tsx
    - src/components/ui/Button.tsx
    - src/components/ui/EmptyState.tsx
    - src/components/ui/Toast.tsx (useToast hook)
    - /api/deals (POST endpoint from Phase 39)
    - /api/deals/[id] (PATCH/DELETE endpoints from Phase 39)
  provides:
    - src/components/student/DealFormModal.tsx (DealFormModal export)
    - src/components/student/DealsClient.tsx (DealsClient export)
  affects:
    - src/app/(dashboard)/student/deals/page.tsx (Plan 02 will import DealsClient)
    - src/app/(dashboard)/student_diy/deals/page.tsx (Plan 02 will import DealsClient)
tech_stack:
  added:
    - React 19 useOptimistic with custom dealsReducer
    - startTransition for concurrent optimistic dispatches
  patterns:
    - Stable refs (routerRef, toastRef) for useCallback deps per CLAUDE.md
    - Optimistic add uses negative timestamp ID (String(-Date.now())) as temp key
    - router.refresh() re-fetches authoritative server data after every mutation
    - Inline delete confirmation (confirmDeleteId state) — no external dialog
    - response.ok check before JSON parse on every fetch call
key_files:
  created:
    - src/components/student/DealFormModal.tsx
    - src/components/student/DealsClient.tsx
  modified: []
decisions:
  - DealFormModal resets state via useEffect watching [deal, open] so edit mode and create mode initialize correctly every time the modal opens
  - handleAdd/handleEdit/handleDelete all call routerRef.current.refresh() on both success and error to ensure server state stays authoritative
  - Delete confirmation uses local confirmDeleteId state (no timeout auto-reset) to avoid accidental deletions
metrics:
  duration: "~25 minutes"
  completed: "2026-04-07"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 41 Plan 01: DealFormModal and DealsClient Components Summary

**One-liner:** React 19 useOptimistic CRUD client components for student deals — DealFormModal (create/edit modal) and DealsClient (list with optimistic add/edit/delete and table layout).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DealFormModal component | 48af153 | src/components/student/DealFormModal.tsx |
| 2 | Create DealsClient with useOptimistic CRUD | 88b8364 | src/components/student/DealsClient.tsx |

## What Was Built

### DealFormModal (src/components/student/DealFormModal.tsx)

A `"use client"` modal form component wrapping the existing `Modal` primitive. Accepts `deal: Deal | null` — null triggers create mode ("Add Deal" title, empty inputs), populated triggers edit mode ("Edit Deal" title, pre-filled inputs).

Key behaviors:
- `useEffect` watching `[deal, open]` resets form values each time the modal opens
- `parseFloat` parses inputs, NaN guard runs before bounds validation
- `VALIDATION.deals.revenueMin/Max` and `profitMin/Max` applied to both `min`/`max` attributes and client-side validation
- Error message displayed with `role="alert"` above the action buttons
- Cancel + Submit buttons in `flex justify-end gap-3 mt-6` layout
- Submit button shows loading spinner via `Button loading={loading}` prop

### DealsClient (src/components/student/DealsClient.tsx)

A `"use client"` list component using React 19's `useOptimistic` with a `dealsReducer`:
- **add**: prepends new deal to the list (instant feedback before API responds)
- **edit**: replaces matching deal in-place (instant feedback before API responds)
- **delete**: filters out the deal (instant feedback before API responds)

Stable refs for `router` and `toast` prevent stale closure issues in `useCallback` handlers. All three mutation handlers follow the same pattern:
1. Create optimistic state update and dispatch via `startTransition`
2. Close modal / set deletingId
3. Fetch API endpoint (always checking `response.ok`)
4. On error: toast error + `router.refresh()` to restore authoritative state
5. On success: toast success + `router.refresh()` to sync server state

UI structure:
- Header row with "My Deals" h2 and "Add Deal" primary button (Plus icon)
- `EmptyState` with `DollarSign` icon, "No deals yet" title, "Add your first deal" CTA when list is empty
- Table-style list in `bg-ima-surface border border-ima-border rounded-xl` container when deals exist
- Column headers (hidden on mobile, shown on sm+): Deal, Revenue, Profit, Date, Actions
- Each row: `min-h-[44px]`, deal number (`Deal #N`), formatted revenue, formatted profit, date, edit/delete buttons
- Inline delete confirmation: clicking delete shows Confirm (danger) + Cancel (ghost) buttons
- `formatCurrency` helper using `Number()` coercion and `toLocaleString("en-US")` for 2 decimal places

## CLAUDE.md Compliance

| Rule | Compliance |
|------|-----------|
| motion-safe: | No custom `animate-*` classes added; Button/Modal handle their own transitions |
| 44px touch targets | All buttons use Button component (h-11 default, min-h-[44px] sm size); rows have min-h-[44px] |
| Accessible labels | All icon-only buttons have `aria-label`; Input component provides label/htmlFor; icons have `aria-hidden="true"` |
| Admin client not in client components | Neither file imports createAdminClient |
| Never swallow errors | Every catch block calls `toastRef.current({ type: "error" })` and `console.error` |
| Check response.ok | Every `fetch()` call checks `res.ok` before parsing JSON |
| Zod import | No Zod used in these client components (server-side validation is in API routes) |
| ima-* tokens only | All color classes use ima-* tokens; no hardcoded hex values |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both components wire directly to real API endpoints (`/api/deals`, `/api/deals/[id]`) and the `initialDeals` prop will receive real server data from the page.tsx server component (Plan 02).

## Threat Flags

None — these are purely client-side UI components. They send fetch() calls to authenticated API endpoints but introduce no new network surface beyond what the API routes (Phase 39) already expose. The API routes handle auth enforcement; the threat model for T-41-01 and T-41-03 is mitigated at the API layer.

## Self-Check: PASSED

- [x] src/components/student/DealFormModal.tsx exists
- [x] src/components/student/DealsClient.tsx exists
- [x] Commit 48af153 exists (feat(41-01): create DealFormModal component)
- [x] Commit 88b8364 exists (feat(41-01): create DealsClient component with useOptimistic CRUD)
- [x] `npx tsc --noEmit` passes with zero errors
- [x] No createAdminClient imports in either file
- [x] All fetch() calls check response.ok
- [x] Number() coercion used at every revenue/profit display site
