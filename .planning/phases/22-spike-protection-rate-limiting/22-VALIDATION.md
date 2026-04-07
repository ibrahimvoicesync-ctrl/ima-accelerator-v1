---
phase: 22
slug: spike-protection-rate-limiting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework — project uses tsc/lint/build |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npm run lint && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | SEC-01 | migration | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | SEC-01 | integration | `npm run build` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | SEC-01 | integration | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework needed. Validation uses tsc, lint, and build.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 429 response with Retry-After header | SEC-01 | Requires real HTTP request to mutation endpoint exceeding rate limit | Send 31 POST requests within 60s to any mutation endpoint; verify 31st returns 429 with Retry-After header |
| pg_cron cleanup job | SEC-01 | Requires Supabase dashboard or direct DB access to verify cron job exists | Check supabase dashboard or run `SELECT * FROM cron.job WHERE jobname = 'cleanup_rate_limit_log'` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
