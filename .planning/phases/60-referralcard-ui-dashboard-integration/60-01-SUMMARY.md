---
phase: 60
plan: 1
subsystem: student-ui
tags: [referral, client-component, dashboard-integration, v1.7]
dependency_graph:
  requires:
    - "59-01: POST /api/referral-link (idempotent, returns { shortUrl, referralCode })"
    - "src/components/ui/Button.tsx (loading prop, primary variant, size=md)"
    - "src/components/ui/Toast.tsx (useToast hook)"
    - "lucide-react (Copy, Check, Share2 icons)"
  provides:
    - "src/components/student/ReferralCard.tsx — self-contained client component, no props"
    - "ReferralCard rendered at bottom of /student and /student_diy dashboards"
  affects:
    - "src/app/(dashboard)/student/page.tsx — new import + JSX block"
    - "src/app/(dashboard)/student_diy/page.tsx — new import + JSX block"
tech_stack:
  added: []
  patterns:
    - "useState lazy initializer for SSR-safe browser API detection (navigator.share)"
    - "useLayoutEffect for ref sync (avoids react-hooks/refs lint error in strict worktree config)"
    - "useCallback with toastRef.current (never toast in deps — stable memoization)"
    - "ReturnType<typeof setTimeout> ref + useEffect cleanup for 2s Copied! timer"
key_files:
  created:
    - src/components/student/ReferralCard.tsx
  modified:
    - src/app/(dashboard)/student/page.tsx
    - src/app/(dashboard)/student_diy/page.tsx
decisions:
  - "SSR-safe navigator.share detection via useState lazy initializer (detectShareSupport fn) instead of useEffect+setState — avoids react-hooks/set-state-in-effect lint error present in worktree ESLint config"
  - "toastRef synced via useLayoutEffect instead of direct render-body assignment — avoids react-hooks/refs lint error in worktree ESLint config; semantics are equivalent"
  - "Description copy kept on one line in JSX for grep-based acceptance criteria to match"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-16"
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  build_gate_lint: "PASS (5s)"
  build_gate_tsc: "PASS (2s)"
  build_gate_build: "PASS (10s, 59 routes)"
---

# Phase 60 Plan 1: ReferralCard UI & Dashboard Integration Summary

**One-liner:** Self-contained `"use client"` ReferralCard with INITIAL/LOADING/READY state machine, clipboard copy with 2s Copied! toggle, SSR-safe Web Share, and ima-* token styling — integrated at the bottom of both student dashboards.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create ReferralCard client component | f7c4f0a | src/components/student/ReferralCard.tsx (created) |
| 2 | Integrate ReferralCard into both dashboards | bf4a231 | student/page.tsx, student_diy/page.tsx (modified) |
| 3 | Run post-phase build gate (CFG-02) | — | verification only |

## Requirements Covered

| ID | Description | Status |
|----|-------------|--------|
| UI-01 | `"use client"` component, no props, fetches POST /api/referral-link | DONE |
| UI-02 | INITIAL state: $500 heading, professional description, Get My Link button min-h-[44px] | DONE |
| UI-03 | LOADING state: spinner via Button loading prop (motion-safe:animate-spin via Spinner primitive) | DONE |
| UI-04 | READY state: short URL, Copy 2s toggle, Share hidden when unavailable | DONE |
| UI-05 | ima-* tokens only, aria-hidden on decorative icons, aria-label on icon-only buttons | DONE |
| UI-06 | response.ok before JSON; toast + console.error on all failure paths | DONE |
| INT-01 | `<ReferralCard />` at bottom of student/page.tsx in mt-6 wrapper | DONE |
| INT-02 | `<ReferralCard />` at bottom of student_diy/page.tsx in mt-6 wrapper | DONE |
| CFG-02 | npm run lint && npx tsc --noEmit && npm run build exits 0 | DONE |

## Build Gate Results

| Command | Result | Time |
|---------|--------|------|
| `npm run lint` | PASS — 0 errors, 4 pre-existing warnings (unchanged) | 5s |
| `npx tsc --noEmit` | PASS — 0 errors | 2s |
| `npm run build` | PASS — 59 routes, /student and /student_diy built cleanly | 10s |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint react-hooks/refs error on toastRef sync**
- **Found during:** Task 1 lint gate
- **Issue:** The worktree ESLint config includes the `react-hooks/refs` rule (stricter than main repo), which flags direct ref mutation (`toastRef.current = toast`) in the render body. This pattern is used in DealsClient.tsx in the main repo but was not flagged there because the main repo's ESLint config does not include this rule.
- **Fix:** Moved ref sync to `useLayoutEffect(() => { toastRef.current = toast; })` — identical runtime semantics, compliant with the stricter rule.
- **Files modified:** src/components/student/ReferralCard.tsx
- **Commit:** f7c4f0a

**2. [Rule 1 - Bug] ESLint react-hooks/set-state-in-effect error on shareSupported detection**
- **Found during:** Task 1 lint gate (second pass)
- **Issue:** The worktree ESLint config includes `react-hooks/set-state-in-effect`, which flags `setState` calls inside `useEffect` with an empty deps array. The plan's recommended pattern (`useEffect(() => { setShareSupported(...); }, [])`) was blocked.
- **Fix:** Replaced the effect-based detection with a `useState` lazy initializer: `useState<boolean>(detectShareSupport)` where `detectShareSupport` is a module-level function that checks `typeof navigator !== "undefined" && typeof navigator.share === "function"`. This is SSR-safe: during server render `typeof navigator === "undefined"` returns false (no Share button), and on the client the correct value is computed once at mount.
- **Files modified:** src/components/student/ReferralCard.tsx
- **Commit:** f7c4f0a

**3. [Rule 2 - Correctness] Description copy split across two lines**
- **Found during:** Task 1 acceptance criteria verification
- **Issue:** The description `<p>` text was line-wrapped at column 100 (standard formatter width), splitting the sentence across two lines. The plan's acceptance criteria grep uses `grep -F 'Share your personal referral link with a friend...'` which requires the full string on one line to match.
- **Fix:** Consolidated description onto a single line inside the `<p>` tag.
- **Files modified:** src/components/student/ReferralCard.tsx
- **Commit:** f7c4f0a

## Known Stubs

None. The component wires directly to the live `POST /api/referral-link` endpoint from Phase 59. No placeholder data, no hardcoded URLs.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary surfaces introduced. The component is a thin UI wrapper over the Phase 59 route handler. XSS, CSRF, and open-redirect mitigations verified per the plan's threat model (T-60-01 through T-60-06).

## Self-Check

| Check | Result |
|-------|--------|
| src/components/student/ReferralCard.tsx exists | PASS |
| src/app/(dashboard)/student/page.tsx contains ReferralCard | PASS |
| src/app/(dashboard)/student_diy/page.tsx contains ReferralCard | PASS |
| Commit f7c4f0a exists | PASS |
| Commit bf4a231 exists | PASS |
| npm run build exits 0 (59 routes, no errors) | PASS |

## Self-Check: PASSED
