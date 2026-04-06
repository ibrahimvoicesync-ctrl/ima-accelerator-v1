---
phase: 33
slug: coach-assignments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / Next.js built-in |
| **Config file** | `vitest.config.ts` or `next.config.ts` |
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
| 33-01-01 | 01 | 1 | ASSIGN-06 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 33-01-02 | 01 | 1 | ASSIGN-01 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 33-02-01 | 02 | 2 | ASSIGN-01, ASSIGN-02, ASSIGN-03, ASSIGN-04, ASSIGN-05 | build | `npm run build` | ✅ | ⬜ pending |
| 33-02-02 | 02 | 2 | ASSIGN-06 | manual | Manual API test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Student/student_diy gets 403 from assignment API | ASSIGN-06 | Requires authenticated request with specific role | Call PATCH /api/assignments with student auth; verify 403 response |
| Optimistic UI updates without page reload | ASSIGN-02 | Visual/interaction behavior | Assign a student, verify list updates instantly without flash |
| Student moves between lists on reassign | ASSIGN-03 | Visual state transition | Reassign student to another coach, verify disappears from source and appears in target |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
