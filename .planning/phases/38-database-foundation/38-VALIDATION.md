---
phase: 38
slug: database-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no jest/vitest configured) |
| **Config file** | None |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | INFR-01 | — | N/A | manual | `\d deals` in Supabase Studio | N/A | ⬜ pending |
| 38-01-02 | 01 | 1 | INFR-02 | — | FOR UPDATE row lock prevents race conditions | manual | Insert two rows concurrently, verify no duplicate deal_number | N/A | ⬜ pending |
| 38-01-03 | 01 | 1 | INFR-03 | — | N/A | manual | `\d deals` in Supabase Studio | N/A | ⬜ pending |
| 38-01-04 | 01 | 1 | INFR-04 | T-38-01 | RLS initplan prevents per-row function calls | manual | EXPLAIN ANALYZE SELECT * FROM deals in Studio | N/A | ⬜ pending |
| 38-01-05 | 01 | 1 | DEAL-02 | — | N/A | manual | Insert test row, verify deal_number=1; insert second, verify deal_number=2 | N/A | ⬜ pending |
| 38-01-06 | 01 | 1 | DEAL-02 | — | N/A | automated | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/types.ts` — Deal type entry (Row/Insert/Update triple)

*Existing infrastructure covers automated build/type checks. SQL artifacts require manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| deals table schema correct | INFR-01 | SQL DDL — no test framework for DB schema | Run `\d deals` in Supabase Studio, verify columns match spec |
| deal_number auto-increment | INFR-02, DEAL-02 | Requires concurrent insert test | Insert 2 rows for same student, verify sequential deal_numbers |
| Index exists | INFR-03 | Schema inspection only | Run `\d deals` in Studio, verify idx_deals_student_created |
| RLS initplan pattern | INFR-04 | Requires EXPLAIN ANALYZE | Run `EXPLAIN ANALYZE SELECT * FROM deals` in Studio SQL editor, verify InitPlan nodes |
| CHECK constraints | INFR-01 | Negative test | Insert row with negative revenue, verify rejection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
