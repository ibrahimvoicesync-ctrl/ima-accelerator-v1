---
phase: 41
slug: student-deals-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 41 — Validation Strategy

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
| 41-01-01 | 01 | 1 | DEAL-03 | — | N/A | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 41-01-02 | 01 | 1 | DEAL-03 | — | N/A | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 41-01-03 | 01 | 1 | DEAL-07 | — | N/A | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 41-01-04 | 01 | 1 | DEAL-03 | — | Auth check before data access | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optimistic add shows instantly | DEAL-03 | Requires browser interaction | Add deal, verify row appears before network response |
| Optimistic delete removes instantly | DEAL-03 | Requires browser interaction | Delete deal, verify row gone before network response |
| student_diy route works identically | DEAL-07 | Requires role-specific login | Log in as student_diy, navigate to /student_diy/deals, perform CRUD |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
