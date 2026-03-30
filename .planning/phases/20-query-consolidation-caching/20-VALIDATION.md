---
phase: 20
slug: query-consolidation-caching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js build + TypeScript compiler |
| **Config file** | tsconfig.json, next.config.ts |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | QUERY-01 | build | `npm run build` | ✅ | ⬜ pending |
| 20-01-02 | 01 | 1 | QUERY-02 | build | `npm run build` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 1 | QUERY-03 | build | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 2 | QUERY-04 | build | `npm run build` | ✅ | ⬜ pending |
| 20-04-01 | 04 | 2 | QUERY-05 | build | `npm run build` | ✅ | ⬜ pending |
| 20-04-02 | 04 | 2 | QUERY-06 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework install needed. Validation uses `npm run build`, `npm run lint`, and `npx tsc --noEmit` (already configured).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner dashboard ≤2 round trips | QUERY-01 | Requires Supabase query log inspection | Enable pgAudit or add `console.log` in dev, load `/owner`, count DB queries |
| Badge cache 60s TTL | QUERY-04 | Requires timed observation | Load owner sidebar, note badge values, mutate data, verify stale for 60s then refresh |
| Pagination URL params | QUERY-05 | Requires browser interaction | Navigate to `/owner/students?page=2`, verify URL updates and correct page loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
