---
phase: 43
slug: coach-owner-deals-tab
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 43 — Validation Strategy

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
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | SC-1,SC-2 | — | N/A | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-01-02 | 01 | 1 | SC-3,SC-4 | — | N/A | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 43-01-03 | 01 | 1 | SC-1,SC-2 | — | N/A | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deals tab visible on coach student detail | SC-1 | Visual UI check | Navigate to /coach/students/[id]?tab=deals, verify tab renders |
| Deals tab visible on owner student detail | SC-2 | Visual UI check | Navigate to /owner/students/[id]?tab=deals, verify tab renders |
| Profit margin % displays correctly | SC-4 | Visual calculation check | Verify margin = (profit/revenue)*100 with correct formatting |
| Division-by-zero shows "—" | SC-4 | Edge case visual | Create deal with revenue=0, verify "—" shown for margin |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
