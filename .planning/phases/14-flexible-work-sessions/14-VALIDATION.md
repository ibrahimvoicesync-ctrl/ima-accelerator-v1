---
phase: 14
slug: flexible-work-sessions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (e2e) + manual UAT |
| **Config file** | none detected — UAT is the gate |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | WORK-06 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | WORK-06 | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | WORK-08 | build | `npm run build` | N/A | ⬜ pending |
| 14-02-02 | 02 | 1 | WORK-01, WORK-06 | build | `npm run build` | N/A | ⬜ pending |
| 14-03-01 | 03 | 2 | WORK-01 through WORK-08 | manual-only | UAT | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — UAT is the validation gate per project history (v1.0 used manual UAT for all work tracker phases).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Duration picker renders 30/45/60 buttons | WORK-01 | UI interaction | Select each duration, verify timer ring adapts |
| Break type selector with constrained ranges | WORK-02 | UI interaction | Select short/long, verify minute options change |
| First cycle skips break | WORK-03 | Stateful UI flow | Complete first session, verify no break countdown |
| Break countdown ticks and auto-ends | WORK-04 | Timer behavior | Complete 2nd session, verify break countdown starts |
| Skip break early | WORK-05 | UI interaction | During break, click Skip, verify immediate transition |
| POST stores session_minutes | WORK-06 | DB inspection | Start session with 30 min, check DB row |
| Timer adapts to duration | WORK-07 | Visual | Select 30 min, verify ring completes in 30 min |
| 5th+ sessions allowed | WORK-08 | Flow test | Complete 5 sessions, verify no block |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
