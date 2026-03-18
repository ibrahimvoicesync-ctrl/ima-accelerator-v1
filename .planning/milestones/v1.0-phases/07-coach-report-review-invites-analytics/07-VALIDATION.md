---
phase: 7
slug: coach-report-review-invites-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test framework installed in project |
| **Config file** | None — consistent with Phases 1-6 |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | COACH-04 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 07-01-02 | 01 | 1 | COACH-04 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 07-02-01 | 02 | 1 | COACH-05 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 07-02-02 | 02 | 1 | COACH-05 | build | `npx tsc --noEmit` | N/A | ⬜ pending |
| 07-03-01 | 03 | 2 | COACH-06 | build | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installed — consistent with all prior phases (1-6). Validation relies on TypeScript type checking, ESLint, and build verification.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PATCH /api/reports/[id]/review marks report reviewed | COACH-04 | No test framework | POST review via browser, verify report disappears from inbox |
| PATCH with reviewed=false clears reviewed_by | COACH-04 | No test framework | Toggle un-review, verify report reappears in inbox |
| PATCH forbidden if student not assigned to coach | COACH-04 | No test framework | Attempt review of unassigned student report, verify 403 |
| POST /api/invites creates invite with 72h expiry | COACH-05 | No test framework | Generate invite, check DB for expires_at = now + 72h |
| POST /api/invites auto-sets coach_id | COACH-05 | No test framework | Generate invite as coach, verify coach_id in DB matches session |
| Analytics page renders 4 stat cards | COACH-06 | No test framework | Open analytics page, verify 4 stat cards with correct values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
