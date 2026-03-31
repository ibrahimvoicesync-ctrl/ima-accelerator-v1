---
phase: 27
slug: coach-owner-roadmap-undo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no jest/vitest/test files in project src |
| **Config file** | None — Wave 0 gap |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | UNDO-01, UNDO-02, UNDO-04 | build + lint | `npm run build && npm run lint` | N/A | ⬜ pending |
| 27-01-02 | 01 | 1 | UNDO-03 | build + lint | `npm run build && npm run lint` | N/A | ⬜ pending |
| 27-01-03 | 01 | 1 | UNDO-01, UNDO-02 | build + lint | `npm run build && npm run lint` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No unit test framework exists in the project. All validation is build-time (TypeScript) + lint + manual UAT.
- This is consistent with all previous phases — no gaps to fill before implementation begins.

*Existing infrastructure covers all phase requirements via build-time type checking.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coach sees undo button on completed steps only | UNDO-01 | UI visual check | Log in as coach, navigate to assigned student roadmap, verify undo button visible on completed steps only |
| Modal opens with correct text (cascade vs simple) | UNDO-03 | UI interaction | Click undo on a step where N+1 is active, verify cascade warning; click undo where N+1 is not active, verify simple text |
| Step reverts to active after confirm | UNDO-01, UNDO-02 | UI state change | Confirm undo, verify step shows as in-progress without page reload |
| N+1 re-locks when N is undone | UNDO-04 | UI state + DB | Undo step N when N+1 is active, verify N+1 shows as locked |
| Coach cannot undo unassigned student step | UNDO-01 | Auth boundary | Attempt undo via API for unassigned student, verify 403 |
| Audit log entry created | UNDO-01 | DB verification | Check roadmap_undo_log table after undo action |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
