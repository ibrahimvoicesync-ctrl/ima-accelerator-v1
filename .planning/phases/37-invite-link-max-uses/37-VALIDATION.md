---
phase: 37
slug: invite-link-max-uses
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual UAT (no automated test framework detected) |
| **Config file** | none |
| **Quick run command** | `npm run lint && npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build + lint + type check + manual smoke
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-01 | 01 | 1 | INVITE-01 | manual smoke | `npm run build` | N/A | ⬜ pending |
| 37-01-02 | 01 | 1 | INVITE-01 | manual smoke | `npx tsc --noEmit` | N/A | ⬜ pending |
| 37-02-01 | 02 | 1 | INVITE-02 | manual UAT | visual inspection | N/A | ⬜ pending |
| 37-02-02 | 02 | 1 | INVITE-02 | manual UAT | visual inspection | N/A | ⬜ pending |
| 37-02-03 | 02 | 1 | INVITE-03 | manual UAT | pre-existing verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| POST /api/magic-links without max_uses creates link with max_uses=10 | INVITE-01 | No API test framework | Create invite link via UI, verify in Supabase that max_uses=10 |
| POST /api/magic-links with max_uses=5 creates link with max_uses=5 | INVITE-01 | No API test framework | Create invite link with custom max_uses, verify in Supabase |
| Coach invite page shows "3 / 10 used" format | INVITE-02 | Visual UI | Navigate to coach invite page, verify display format |
| Exhausted link shows red text + "Exhausted" badge | INVITE-02 | Visual UI | Create link with max_uses=1, use it, verify display |
| Grandfathered link (null max_uses) shows "X / ∞ used" | INVITE-02 | Visual UI | Check existing unlimited links display |
| Registration via exhausted link redirects to error | INVITE-03 | Pre-existing | Already implemented, verify no regression |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
