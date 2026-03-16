---
phase: 01
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Phase 1 uses TypeScript compilation + build as validation |
| **Config file** | none — no test framework for Phase 1 |
| **Quick run command** | `npx tsc --noEmit && npm run lint` |
| **Full suite command** | `npx tsc --noEmit && npm run lint && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit && npm run lint`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SC-1 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SC-2 | smoke | `npx supabase db reset && npx supabase status` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | SC-3 | manual | Manual browser test | N/A | ⬜ pending |
| 01-03-02 | 03 | 2 | SC-4 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 01-03-03 | 03 | 2 | SC-5 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No formal test framework needed for Phase 1 — all validation is TypeScript compilation + build + lint
- [ ] `npm run build` is the gate check — must pass before `/gsd:verify-work`
- [ ] `npx supabase db reset` validates schema correctness

*Existing infrastructure covers all phase requirements via build toolchain.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| proxy.ts redirects unauthenticated → /login | SC-3 | Requires browser session state | 1. Open localhost:3000 without auth → expect redirect to /login |
| proxy.ts redirects wrong-role → /no-access | SC-3 | Requires authenticated session with wrong role | 1. Login as student → navigate to /coaches → expect redirect to /no-access |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
