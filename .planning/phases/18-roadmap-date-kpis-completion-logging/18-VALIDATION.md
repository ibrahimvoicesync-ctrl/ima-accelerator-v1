---
phase: 18
slug: roadmap-date-kpis-completion-logging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / Next.js build |
| **Config file** | vitest.config.ts or "none — Wave 0 installs" |
| **Quick run command** | `npx tsc --noEmit && npm run lint` |
| **Full suite command** | `npm run build` |
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
| 18-01-01 | 01 | 1 | ROAD-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | ROAD-03 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 18-02-01 | 02 | 1 | ROAD-02,ROAD-04 | build | `npm run build` | ✅ | ⬜ pending |
| 18-02-02 | 02 | 1 | ROAD-03,ROAD-04 | build | `npm run build` | ✅ | ⬜ pending |
| 18-03-01 | 03 | 2 | ROAD-05 | build | `npm run build` | ✅ | ⬜ pending |
| 18-03-02 | 03 | 2 | ROAD-05 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status chip colors match RAG spec (green/amber/red) | ROAD-02 | Visual verification | Check student roadmap page — verify chips are green >2d, amber ≤2d, red past deadline |
| Coach/owner views match student view chips | ROAD-05 | Visual cross-role check | Login as coach/owner, navigate to student detail roadmap tab, compare with student view |
| completed_at date displays correctly | ROAD-03 | Visual verification | Mark a step complete, verify "Completed [date]" shows with correct date |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
