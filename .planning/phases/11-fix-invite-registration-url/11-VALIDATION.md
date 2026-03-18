---
phase: 11
slug: fix-invite-registration-url
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None established (TypeScript + lint only) |
| **Config file** | tsconfig.json, eslint.config.mjs |
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
| 11-01-01 | 01 | 1 | COACH-05 | manual-only (OAuth flow) | `npx tsc --noEmit` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | OWNER-06 | manual-only (OAuth flow) | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No test files needed — TypeScript compilation is the only automated check available for this one-line string fix.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `POST /api/invites` returns `registerUrl` with path `/register/{code}` | COACH-05 | OAuth flow requires real Google account | 1. Call POST /api/invites with valid auth 2. Verify response `registerUrl` contains `/register/{code}` format |
| Owner-generated invite URL format matches path-segment format | OWNER-06 | OAuth flow requires real Google account | 1. Call POST /api/invites as owner 2. Verify same `/register/{code}` format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
