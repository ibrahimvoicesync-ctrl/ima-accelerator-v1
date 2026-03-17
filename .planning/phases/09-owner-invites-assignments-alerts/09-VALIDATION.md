---
phase: 9
slug: owner-invites-assignments-alerts
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if configured) / manual verification via dev server |
| **Config file** | none — primary validation is build + manual UAT |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | OWNER-06 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | OWNER-06 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | OWNER-06 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 1 | OWNER-07 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-02-02 | 02 | 1 | OWNER-07 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-03-01 | 03 | 2 | OWNER-08, OWNER-09 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-03-02 | 03 | 2 | OWNER-08, OWNER-09 | build+manual | `npm run build` | ✅ | ⬜ pending |
| 09-03-03 | 03 | 2 | OWNER-09 | build+manual | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Invite link copy to clipboard | OWNER-06 | Clipboard API requires browser context | Generate invite, click copy, paste in new tab |
| 72-hour expiry enforcement | OWNER-06 | Requires time manipulation | Generate invite, verify `expires_at` in DB is +72h |
| Student reassignment from detail page | OWNER-07 | UI interaction flow | Navigate to student detail, change coach, verify update |
| Alert list shows correct at-risk students | OWNER-08 | Requires seeded test data with specific activity gaps | Seed inactive students, verify alert appearance |
| Alert acknowledge/dismiss persistence | OWNER-09 | UI + DB interaction | Dismiss alert, refresh page, verify gone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
