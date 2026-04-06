---
phase: 32
slug: skip-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / jest (Next.js built-in) |
| **Config file** | vitest.config.ts or jest.config.ts |
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
| 32-01-01 | 01 | 1 | SKIP-05 | migration | `supabase db diff` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | SKIP-01,02,03 | rpc | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 2 | SKIP-01,04 | integration | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration file for RPC function — stubs for SKIP-05
- [ ] Type definitions for skip count data — TypeScript compilation check

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skip badge visible on student cards | SKIP-01 | Visual UI check | Load coach dashboard, verify badge appears with correct count |
| Weekly reset on Monday | SKIP-02 | Time-dependent behavior | Verify RPC returns 0 when p_today is a Monday |
| Today excluded before deadline | SKIP-03 | Time-dependent behavior | Call RPC with p_current_hour < 23, verify today not counted |
| Owner views show same badge | SKIP-04 | Cross-view consistency | Compare badge on coach vs owner views |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
