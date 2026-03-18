---
phase: 05
slug: student-daily-reports-ai-chat
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if installed) / manual verification via build + runtime |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npx tsc --noEmit && npm run build` |
| **Full suite command** | `npx tsc --noEmit && npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run build`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | REPT-01 | build + type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | REPT-02 | build + type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | REPT-03 | build + type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 1 | REPT-01 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 05-02-02 | 02 | 1 | REPT-02 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 05-03-01 | 03 | 2 | REPT-03 | build + manual | `npm run build` | ✅ | ⬜ pending |
| 05-03-02 | 03 | 2 | AICHAT-01 | build + manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hours auto-fill from sessions | REPT-01 | Requires DB state with completed sessions | Create work sessions, open report form, verify hours match |
| Star rating click interaction | REPT-02 | UI interaction test | Click stars 1-5, verify filled state updates |
| Submit confirmation state | REPT-02 | Requires form submission flow | Submit report, verify form shows confirmation |
| Cannot re-submit (update only) | REPT-02 | Requires existing report state | Submit, reload, verify "Update Report" button shown |
| Past reports list display | REPT-03 | Requires multiple reports in DB | Submit reports on multiple days, verify history page |
| AI chat iframe loads | AICHAT-01 | Iframe + placeholder URL | Navigate to /student/ask, verify iframe or Coming Soon state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
