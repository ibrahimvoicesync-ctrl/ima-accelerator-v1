---
phase: 17
slug: calendar-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / Next.js build + TypeScript |
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
| 17-01-01 | 01 | 1 | CAL-01 | build | `npm run build` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | CAL-02 | build | `npm run build` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 1 | CAL-03 | build | `npm run build` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 1 | CAL-04 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install react-day-picker@^9.14.0` — calendar grid component (pre-decided in STATE.md)

*Existing infrastructure covers remaining phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Green/amber dot colors correct | CAL-02 | Visual verification | Load calendar, verify green dot on days with both session+report, amber on partial |
| Day detail panel layout | CAL-03 | Visual verification | Click a day cell, verify sessions and report display side by side on desktop |
| Month navigation no stale data | CAL-04 | Timing-dependent | Navigate prev/next months, verify data refreshes without flicker or stale content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
