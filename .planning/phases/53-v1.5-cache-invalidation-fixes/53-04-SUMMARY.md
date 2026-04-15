---
phase: 53-v1.5-cache-invalidation-fixes
plan: "04"
subsystem: planning-bookkeeping, build-gate
tags: [requirements, traceability, build-gate, lint-fix]
dependency_graph:
  requires: ["53-01", "53-02", "53-03"]
  provides: ["requirements-traceability-correct", "d12-build-gate-green"]
  affects: [".planning/REQUIREMENTS.md", "src/components/ui/Modal.tsx", "src/components/student/DealFormModal.tsx", "src/app/(dashboard)/coach/students/[studentId]/page.tsx", "src/app/(dashboard)/owner/students/[studentId]/page.tsx", "eslint.config.mjs"]
tech_stack:
  added: []
  patterns: ["key-prop-for-modal-reset", "useEffect-ref-sync", "eslint-globalIgnores"]
key_files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - eslint.config.mjs
    - src/app/(dashboard)/coach/students/[studentId]/page.tsx
    - src/app/(dashboard)/owner/students/[studentId]/page.tsx
    - src/components/student/DealFormModal.tsx
    - src/components/ui/Modal.tsx
decisions:
  - "Add load-tests/** to ESLint globalIgnores — CommonJS k6 scripts are not Next.js source"
  - "DealFormModal refactored to inner DealForm with key prop for lint-clean modal reset"
  - "Modal.tsx onCloseRef sync moved into useEffect() to avoid ref-during-render lint error"
  - "Date.now() replaced with new Date(today + T00:00:00Z).getTime() in server components"
metrics:
  duration: "11 minutes"
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_modified: 6
---

# Phase 53 Plan 04: Requirements Traceability Reconciliation + D-12 Build Gate Summary

**One-liner:** Reconciled REQUIREMENTS.md to v1.5 audit reality (44 `[ ]`→`[x]` + 1 `[x]`→`[ ]`) and ran the D-12 build gate, fixing 4 pre-existing lint errors to achieve a clean `npm run lint && npx tsc --noEmit && npm run build` pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Reconcile REQUIREMENTS.md checkboxes | e1f1cdb | .planning/REQUIREMENTS.md |
| 2 | D-12 build gate — lint + typecheck + build | 5fa84e8 | eslint.config.mjs, 4 src files |

## What Was Done

### Task 1: REQUIREMENTS.md Checkbox Reconciliation

Applied 45 targeted checkbox flips to `.planning/REQUIREMENTS.md` to align traceability with v1.5-MILESTONE-AUDIT.md's `scores.requirements: 54/54`:

- **44 `[ ]`→`[x]` flips:** All 10 ANALYTICS, 7 COACH-DASH, 7 COACH-ANALYTICS, 11 DEALS, 8 PERF requirements, plus NOTIF-06 (shipped in Phase 52 coach-alerts work)
- **1 `[x]`→`[ ]` flip:** NOTIF-01 (correcting a pre-existing bookkeeping error — audit classifies NOTIF-01 as deferred pending STATE.md D-06 stakeholder meeting)

Post-edit state: 53 `[x]` + 1 `[ ]` (NOTIF-01) = 54 in scope. Traceability table and Coverage footnote (`47/47 primary REQ-IDs mapped`) are byte-identical to pre-edit.

Verification grep results (all matching expected counts):
- ANALYTICS [x]: 10, COACH-DASH [x]: 7, COACH-ANALYTICS [x]: 7, DEALS [x]: 11, PERF [x]: 8, NOTIF [x]: 10
- All `[ ]` counts: 0 except NOTIF (1 = NOTIF-01 deferred)

### Task 2: D-12 Build Gate

Executed `npm run lint && npx tsc --noEmit && npm run build` from the worktree root. The initial lint run revealed 4 pre-existing ESLint errors (not introduced by Plans 01-03) that blocked the gate. Fixed all 4 (Rule 1 — auto-fix bugs, Rule 3 — fix blocking issues):

1. **`coach/students/[studentId]/page.tsx`**: `Date.now()` flagged as impure function during render. Fixed by using `new Date(today + "T00:00:00Z").getTime()` where `today` is already computed via `getTodayUTC()`.
2. **`owner/students/[studentId]/page.tsx`**: Same `Date.now()` pattern. Same fix.
3. **`components/student/DealFormModal.tsx`**: `setState` called synchronously in `useEffect` body (`react-hooks/set-state-in-effect`). Fixed by refactoring into an inner `DealForm` component with `useState` lazy initialization and a `key={deal?.id ?? "new"}` prop on the outer `DealFormModal` — React remounts `DealForm` cleanly when the modal switches deals.
4. **`components/ui/Modal.tsx`**: `onCloseRef.current = onClose` assigned during render (`react-hooks/refs`). Fixed by wrapping in `useEffect(() => { onCloseRef.current = onClose; })` (no deps = runs after every render, correct for keeping ref in sync).

Additionally, added `load-tests/**` to `eslint.config.mjs` `globalIgnores` — the `load-tests/scripts/gen-tokens.js` file is a CommonJS Node.js k6 helper that legitimately uses `require()` and is not part of the Next.js build.

**Final gate results:**
- `npm run lint`: EXIT_CODE 0, zero errors (6 pre-existing warnings only)
- `npx tsc --noEmit`: EXIT_CODE 0, zero type errors
- `npm run build`: EXIT_CODE 0, 56 pages compiled successfully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 pre-existing ESLint errors blocking D-12 gate**
- **Found during:** Task 2 (D-12 build gate execution)
- **Issue:** `npm run lint` failed with 4 errors in files not touched by Plans 01-03: `Date.now()` impure function calls in 2 server pages, `setState` in useEffect in DealFormModal, ref update during render in Modal
- **Fix:** Replaced `Date.now()` with `getTodayUTC()`-derived timestamp; refactored DealFormModal to use key-prop remount pattern; moved `onCloseRef.current` sync to `useEffect()`
- **Files modified:** `src/app/(dashboard)/coach/students/[studentId]/page.tsx`, `src/app/(dashboard)/owner/students/[studentId]/page.tsx`, `src/components/student/DealFormModal.tsx`, `src/components/ui/Modal.tsx`
- **Commit:** 5fa84e8

**2. [Rule 3 - Blocking] Added load-tests/** to ESLint globalIgnores**
- **Found during:** Task 2 (D-12 build gate execution)
- **Issue:** `load-tests/scripts/gen-tokens.js` uses CommonJS `require()` which triggers `@typescript-eslint/no-require-imports` errors. File is a k6 JWT pre-generation script — not Next.js source.
- **Fix:** Added `"load-tests/**"` to `eslint.config.mjs` `globalIgnores` list
- **Files modified:** `eslint.config.mjs`
- **Commit:** 5fa84e8

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan modifies only planning bookkeeping (REQUIREMENTS.md) and fixes pre-existing lint issues in existing source files. No new threat surface.

## Known Stubs

None — this plan does not create UI components or wire data.

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` exists and has correct checkbox counts (verified by grep)
- `.planning/phases/53-v1.5-cache-invalidation-fixes/53-04-SUMMARY.md` created
- Commit e1f1cdb exists (Task 1)
- Commit 5fa84e8 exists (Task 2)
- `npm run lint` exits 0
- `npx tsc --noEmit` exits 0
- `npm run build` exits 0 (56 pages)
