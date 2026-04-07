---
phase: 42
slug: dashboard-stat-cards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no jest/vitest/test infra in project) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | SC-1 | — | N/A | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 42-01-02 | 01 | 1 | SC-2 | T-42-01 | `.eq("student_id", user.id)` scopes query | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 42-01-03 | 01 | 1 | SC-3 | — | N/A | visual | Manual: inspect HTML classes | N/A | ⬜ pending |
| 42-01-04 | 01 | 1 | SC-4 | — | N/A | build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework exists in this project; validation is done via TypeScript build + manual UAT.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3 stat cards visible on student dashboard | SC-1 | Visual layout, no test infra | Log in as student, verify 3 cards appear below existing KPI cards |
| Values match authenticated student's deals | SC-2 | Requires live data + auth | Log in, compare card values with deals page totals |
| Cards use ima-* tokens, match existing style | SC-3 | Visual/CSS verification | Inspect rendered HTML for ima-* classes, no hardcoded hex |
| Both student and student_diy show cards | SC-4 | Route-level verification | Navigate to both dashboard routes, verify cards present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
