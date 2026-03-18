---
phase: 10
slug: ui-polish-production-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if configured) / manual CLI verification |
| **Config file** | none — visual/layout validation is primarily manual + grep-based |
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
| 10-01-01 | 01 | 1 | UI-06 | grep + build | `grep -r "ima-" src/components/ui/ && npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 1 | UI-01 | file existence + build | `ls src/app/(dashboard)/*/loading.tsx && npm run build` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | UI-02 | file existence + build | `ls src/app/(dashboard)/*/error.tsx && npm run build` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | UI-03 | grep + build | `grep -r "EmptyState" src/app/ && npm run build` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | UI-04, UI-05 | build + grep | `grep -r "min-h-\[44px\]" src/ && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] loading.tsx files — created per route in plan 10-02
- [ ] error.tsx files — created per route in plan 10-02
- [ ] EmptyState component — ported from reference-old in plan 10-03

*Existing infrastructure (Skeleton, SkeletonCard, Button, Card, CVA) covers shared primitive requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 375px mobile layout — no horizontal scroll | UI-04 | Visual layout check requires browser | Open each page at 375px width in Chrome DevTools, verify no horizontal scroll |
| Skeleton matches page layout shape | UI-01 | Visual comparison | Compare loading.tsx skeleton to actual page layout in browser |
| Empty state copy is motivating/contextual | UI-03 | Subjective copy quality | Read each empty state message, verify it includes contextual CTA |
| ima-* token visual consistency | UI-06 | Visual color check | Verify blue primary (#2563EB), Inter font across all pages |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
