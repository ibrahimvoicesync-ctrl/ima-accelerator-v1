---
phase: 3
slug: student-work-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | WORK-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | WORK-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | WORK-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | WORK-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | WORK-05 | manual | browser test | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | WORK-06 | manual | browser test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` — install test framework (no framework detected)
- [ ] `vitest.config.ts` — configure Vitest for Next.js + TypeScript
- [ ] `src/__tests__/work-sessions.test.ts` — stubs for WORK-01 through WORK-04 API route tests

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Timer countdown displays and ticks | WORK-01 | Requires browser rendering + requestAnimationFrame | Start cycle, verify MM:SS counts down |
| Timer survives navigation/refresh | WORK-05 | Requires full browser navigation cycle | Start cycle, navigate away, return, verify timer restored |
| Today's cycle count visible on dashboard | WORK-06 | Requires server component rendering with real data | Complete cycles, check dashboard shows N/4 |
| Abandon grace period confirmation | WORK-04 | Requires interactive UI flow timing | Start cycle, try abandon before 5 min, verify confirmation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
