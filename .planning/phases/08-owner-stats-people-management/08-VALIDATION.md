---
phase: 08
slug: owner-stats-people-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js build + TypeScript compiler |
| **Config file** | `tsconfig.json`, `next.config.ts` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | OWNER-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | OWNER-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | OWNER-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | OWNER-04 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | OWNER-05 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner sees 4 stat cards with correct aggregate data | OWNER-01 | Visual layout + live data | Navigate to /owner, verify 4 cards render with non-zero counts |
| Student list is searchable | OWNER-02 | Interactive search UX | Go to /owner/students, type in search, verify filtering works |
| Student detail shows sessions, reports, roadmap | OWNER-03 | Multi-section visual check | Click a student, verify 3 data sections render |
| Coach list shows student count and avg rating | OWNER-04 | Computed metrics display | Go to /owner/coaches, verify each card has count + rating |
| Coach detail shows assigned students and metrics | OWNER-05 | Cross-reference data | Click a coach, verify assigned students list and 4 stat cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
