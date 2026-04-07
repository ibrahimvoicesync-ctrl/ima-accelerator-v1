---
phase: 25
slug: roadmap-config-stage-headers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / Next.js dev server manual checks |
| **Config file** | vitest.config.ts or "none — Wave 0 installs" |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | ROAD-01 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 25-01-02 | 01 | 1 | ROAD-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 25-01-03 | 01 | 1 | ROAD-03 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 25-01-04 | 01 | 1 | ROAD-04 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 25-02-01 | 02 | 1 | ROAD-05 | visual + type | `npm run build` | ✅ | ⬜ pending |
| 25-02-02 | 02 | 1 | ROAD-06 | visual + type | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stage headers render visually grouped | ROAD-05, ROAD-06 | Visual layout check | Open /student/roadmap and /coach/students/[id] — verify 3 stage headers appear grouping correct step ranges |
| Deadline chip responds to 14-day target | ROAD-04 | Requires time-based state | Check step 8 shows 14-day target, verify chip color changes based on elapsed time |
| Unlock URL opens correct link | ROAD-02 | External link behavior | Click step 5 unlock URL — should open skool CRM link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
