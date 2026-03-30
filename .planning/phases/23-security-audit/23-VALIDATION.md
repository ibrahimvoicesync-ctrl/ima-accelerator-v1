---
phase: 23
slug: security-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual audit + grep/read verification |
| **Config file** | none — audit phase uses grep commands |
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
| 23-01-01 | 01 | 1 | SEC-02 | audit | `grep -r "getUser" src/app/api/` | ✅ | ⬜ pending |
| 23-01-02 | 01 | 1 | SEC-03 | audit | `grep -r "Origin" src/app/api/` | ✅ | ⬜ pending |
| 23-01-03 | 01 | 1 | SEC-04 | audit | `grep -r "profile.id" src/app/api/` | ✅ | ⬜ pending |
| 23-01-04 | 01 | 1 | DB-03 | audit | `grep -c "select get_user" supabase/migrations/` | ✅ | ⬜ pending |
| 23-02-01 | 02 | 2 | SEC-03 | grep | `grep -r "verifyOrigin" src/app/api/` | ❌ W0 | ⬜ pending |
| 23-02-02 | 02 | 2 | SEC-02 | build | `npm run build` | ✅ | ⬜ pending |
| 23-02-03 | 02 | 2 | SEC-04 | grep | `grep -r "profile.id" src/app/api/reports/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/csrf.ts` — CSRF Origin verification helper (created in Plan 2)

*Existing infrastructure covers audit requirements (Plan 1). Plan 2 creates new files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human sign-off on audit report | FLAG: requires-human-review | Requires human judgement | Review 23-AUDIT-REPORT.md, approve findings and severity classifications |
| Cross-student data isolation | SEC-04 | Requires multi-user test scenario | Manually verify no student can access another's data via route params |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
