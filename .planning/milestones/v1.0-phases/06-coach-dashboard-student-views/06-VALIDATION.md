---
phase: 6
slug: coach-dashboard-student-views
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if configured) / manual verification via dev server |
| **Config file** | `next.config.ts` (Next.js build validation) |
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
| 06-01-01 | 01 | 1 | COACH-01 | build+type | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | COACH-01 | build+type | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | COACH-02 | build+type | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | COACH-02 | build+type | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 2 | COACH-03 | build+type | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — TypeScript compiler and ESLint are already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coach sees only assigned students | COACH-01 | Requires multi-user auth context | Login as coach, verify no other coach's students visible |
| At-risk visual flagging | COACH-02 | Visual verification needed | Check student card shows red "At Risk" badge, banner lists at-risk students |
| Student detail drill-down | COACH-03 | Navigation + data display | Click student card, verify roadmap/sessions/reports tabs load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
