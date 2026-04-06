---
phase: 39
slug: api-route-handlers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if configured) or manual curl/httpie verification |
| **Config file** | none — API routes tested via HTTP requests |
| **Quick run command** | `npx tsc --noEmit && npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | DEAL-01 | T-39-01 | POST creates deal for authenticated student only | build | `npm run build` | ❌ W0 | ⬜ pending |
| 39-01-02 | 01 | 1 | DEAL-04 | T-39-02 | PATCH restricted to deal owner | build | `npm run build` | ❌ W0 | ⬜ pending |
| 39-01-03 | 01 | 1 | DEAL-05 | T-39-03 | DELETE 3-tier role check | build | `npm run build` | ❌ W0 | ⬜ pending |
| 39-01-04 | 01 | 1 | VIEW-05, VIEW-06 | T-39-04 | GET scoped to coach/owner roles | build | `npm run build` | ❌ W0 | ⬜ pending |
| 39-01-05 | 01 | 1 | INFR-05 | T-39-05 | CSRF, rate limit, Zod on all endpoints | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — route handlers are verified via TypeScript compilation and build.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 23505 retry on POST | DEAL-01 | Requires concurrent insert race condition | Insert two deals simultaneously, verify no error surfaces |
| Coach delete authorization | DEAL-05 | Requires multi-user auth context | Login as coach, attempt delete of assigned vs unassigned student's deal |
| Rate limit 429 response | INFR-05 | Requires 30+ rapid requests | Send 31 requests in < 60s, verify 429 on 31st |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
