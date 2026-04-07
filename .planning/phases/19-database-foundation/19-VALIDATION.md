---
phase: 19
slug: database-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure exists in this project |
| **Config file** | None |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | DB-01 | manual | EXPLAIN ANALYZE in Supabase SQL Editor | N/A | ⬜ pending |
| 19-01-02 | 01 | 1 | DB-01 | manual | EXPLAIN ANALYZE in Supabase SQL Editor | N/A | ⬜ pending |
| 19-02-01 | 02 | 1 | DB-02 | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 19-03-01 | 03 | 1 | DB-03 | manual | EXPLAIN output check in SQL Editor | N/A | ⬜ pending |
| 19-04-01 | 04 | 1 | DB-04 | manual | SQL Editor query | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework installation needed — Phase 19 is SQL migrations and one TypeScript file edit verified by `npx tsc --noEmit`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Composite indexes used by query planner | DB-01 | Requires EXPLAIN ANALYZE on live Supabase database | Run EXPLAIN ANALYZE queries in SQL Editor; verify output shows "Index Scan" not "Seq Scan" |
| RLS policies use initplan evaluation | DB-03 | Requires EXPLAIN on policy-covered query with authenticated role | Set role context in SQL Editor; run EXPLAIN; verify "InitPlan" nodes present |
| pg_stat_statements captures query stats | DB-04 | Requires Supabase Dashboard extension activation | Enable extension via Dashboard; run baseline capture query; verify results returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
