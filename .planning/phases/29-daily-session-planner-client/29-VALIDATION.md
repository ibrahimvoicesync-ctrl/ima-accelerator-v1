---
phase: 29
slug: daily-session-planner-client
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / jest (Next.js built-in) |
| **Config file** | vitest.config.ts or jest.config.js |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | PLAN-01 | type-check | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 29-01-02 | 01 | 1 | PLAN-02 | type-check | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | PLAN-03 | type-check | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 29-02-01 | 02 | 1 | PLAN-04 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-02-02 | 02 | 1 | PLAN-05 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-02-03 | 02 | 1 | PLAN-06 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-03-01 | 03 | 2 | PLAN-10 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-03-02 | 03 | 2 | COMP-01 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-03-03 | 03 | 2 | COMP-02 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-03-04 | 03 | 2 | COMP-03 | build | `npm run build` | ⬜ W0 | ⬜ pending |
| 29-03-05 | 03 | 2 | COMP-04 | build | `npm run build` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Planner UI appears on first daily visit | PLAN-01 | Requires browser session state | Open Work Tracker with no plan today, verify planner appears |
| Break types auto-assign correctly | PLAN-02 | Visual verification of UI state | Add 4+ sessions, verify odd=short break, even=long break, last=none |
| Confirm button disabled until valid total | PLAN-03 | Interactive UI state | Add sessions, verify button enables at/below 4h cap |
| Motivational card shows once per day | COMP-01 | Requires localStorage + daily reset | Complete all planned sessions, verify card appears, refresh, verify hidden |
| Arabic text renders RTL correctly | COMP-02 | Visual/RTL rendering check | Complete plan, verify "اللهم بارك" is large, centered, dir="rtl" |
| Ad-hoc sessions after completion | COMP-04 | Interactive flow verification | Dismiss motivational card, start ad-hoc session, verify no daily cap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
