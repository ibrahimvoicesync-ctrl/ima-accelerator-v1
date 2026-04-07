---
phase: 34
slug: report-comments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (no jest, vitest, or test scripts in package.json) |
| **Config file** | None |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npm run lint && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | COMMENT-01 | manual-only | `npm run build` | N/A | ⬜ pending |
| 34-01-02 | 01 | 1 | COMMENT-02 | manual-only | `npm run build` | N/A | ⬜ pending |
| 34-01-03 | 01 | 1 | COMMENT-03 | manual-only | `npm run build` | N/A | ⬜ pending |
| 34-01-04 | 01 | 1 | COMMENT-04 | manual-only | `npm run build` | N/A | ⬜ pending |
| 34-01-05 | 01 | 1 | COMMENT-05 | manual-only | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework exists in this project — all previous phases use build-time type checking + manual UAT.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coach submits comment (max 1000 chars) | COMMENT-01 | No test framework installed | Login as coach, open student report, type comment, click Save, verify it appears |
| Upsert replaces existing comment | COMMENT-02 | Requires DB state verification | Submit comment, edit and resubmit, verify single row in report_comments table |
| Student sees read-only feedback card | COMMENT-03 | Visual UI verification | Login as student, view report history, verify coach feedback card appears read-only |
| Owner can comment via CalendarTab | COMMENT-04 | Role-specific browser test | Login as owner, navigate to student detail, comment via CalendarTab |
| Student POST returns 403 | COMMENT-05 | Auth boundary test | Attempt POST /api/reports/{id}/comment as student, verify 403 response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
