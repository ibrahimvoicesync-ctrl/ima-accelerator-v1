---
phase: 16
slug: coach-owner-kpi-visibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js build + TypeScript compiler |
| **Config file** | `tsconfig.json`, `next.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | VIS-03 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 1 | VIS-01, VIS-02, VIS-03, VIS-04 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 1 | VIS-01, VIS-03 | build | `npm run build` | ✅ | ⬜ pending |
| 16-04-01 | 04 | 1 | VIS-02, VIS-03 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RAG colors match student view | VIS-01, VIS-02 | Visual color comparison | Compare coach/owner student detail KPI card colors with student ProgressBanner for same student |
| Roadmap step displays correctly | VIS-03 | Content correctness | Verify "Stage X: Name — Step Y: Name" format with actual student data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
