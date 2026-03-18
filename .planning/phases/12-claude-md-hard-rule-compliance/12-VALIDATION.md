---
phase: 12
slug: claude-md-hard-rule-compliance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — build-tool only |
| **Config file** | n/a |
| **Quick run command** | `npm run lint && npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | ima-* tokens in WorkTrackerClient | grep scan | `grep -n "bg-green-\|text-green-\|bg-red-\|text-red-\|bg-amber-\|text-amber-" src/components/student/WorkTrackerClient.tsx` (expect 0) | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | ima-* tokens in CycleCard | grep scan | `grep -n "text-green-\|text-amber-\|text-red-" src/components/student/CycleCard.tsx` (expect 0) | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | ima-* tokens in auth pages | grep scan | `grep -rn "bg-red-\|text-red-\|border-red-" src/app/\(auth\)/` (expect 0) | ✅ | ⬜ pending |
| 12-02-01 | 02 | 1 | response.ok in abandonStale | code inspect | Manual inspection of WorkTrackerClient.tsx abandonStale path | ✅ | ⬜ pending |
| 12-02-02 | 02 | 1 | StudentCard touch target | grep scan | `grep "min-h-\[44px\]" src/components/coach/StudentCard.tsx` (expect match) | ✅ | ⬜ pending |
| 12-02-03 | 02 | 1 | getToday() local date | code inspect | Verify getToday() uses getFullYear/getMonth/getDate, not toISOString | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — verification is grep + build tools.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| response.ok check in abandonStale | SC-3 | Logic flow requires code review | Inspect WorkTrackerClient.tsx abandonStale fetch; confirm response.ok checked before proceeding |
| getToday() returns local date | SC-5 | Date logic requires reading implementation | Verify getToday() uses getFullYear()/getMonth()/getDate(), not toISOString() |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
