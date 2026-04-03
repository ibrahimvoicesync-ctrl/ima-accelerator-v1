---
phase: 31
slug: student-diy-role
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual UAT + TypeScript compiler + ESLint (no automated test suite) |
| **Config file** | tsconfig.json, .eslintrc (existing) |
| **Quick run command** | `npm run build && npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | ROLE-01, ROLE-02, ROLE-03 | type-check | `npx tsc --noEmit` | N/A (compile) | pending |
| 31-01-02 | 01 | 1 | ROLE-02, ROLE-05 | build | `npx tsc --noEmit && npm run build` | N/A (compile) | pending |
| 31-01-03 | 01 | 1 | ROLE-01, ROLE-06 | build | `npx tsc --noEmit && npm run build` | N/A (compile) | pending |
| 31-02-01 | 02 | 2 | ROLE-02, ROLE-03, ROLE-04 | build | `npx tsc --noEmit && npm run build` | N/A (new file) | pending |
| 31-02-02 | 02 | 2 | ROLE-04, ROLE-05 | build | `npx tsc --noEmit && npm run build` | N/A (new files) | pending |
| 31-03-01 | 03 | 2 | ROLE-06, ROLE-07 | build | `npx tsc --noEmit && npm run build` | N/A (compile) | pending |
| 31-03-02 | 03 | 2 | ROLE-07 | build | `npx tsc --noEmit && npm run build` | N/A (compile) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. TypeScript compilation (`npx tsc --noEmit`) is the primary machine-checkable gate. No test framework install needed. No stub files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| student_diy invite registration completes via Google OAuth | ROLE-01 | OAuth flow requires browser interaction | Create student_diy invite, open link in incognito, complete Google sign-in, verify role in users table |
| student_diy user redirected to /student_diy after login | ROLE-02 | Requires live session + proxy | Log in as student_diy, verify browser URL is /student_diy |
| Sidebar shows exactly 3 items | ROLE-03 | Visual verification | Log in as student_diy, verify sidebar shows Dashboard, Work Tracker, Roadmap only |
| Work tracker and roadmap function identically | ROLE-04 | Functional smoke test | Start/complete a work session, progress a roadmap step |
| Blocked routes redirect to dashboard | ROLE-05 | Requires live proxy routing | Navigate to /student_diy/report, /student_diy/chat, /student_diy/resources, verify redirect |
| No coach assigned to student_diy | ROLE-06 | DB state verification | Check users table for student_diy user, verify coach_id is null |
| Owner and coach can create student_diy invites | ROLE-07 | UI interaction | Log in as owner, create student_diy invite, verify success; repeat as coach |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-03
