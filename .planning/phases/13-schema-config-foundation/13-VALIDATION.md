---
phase: 13
slug: schema-config-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler (tsc) — no Jest/Vitest in this project |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | WORK-09 | tsc | `npx tsc --noEmit` | N/A (SQL) | ⬜ pending |
| 13-01-02 | 01 | 1 | WORK-09 | manual | DB schema check | N/A (SQL) | ⬜ pending |
| 13-01-03 | 01 | 1 | KPI-07 | manual | DB schema check | N/A (SQL) | ⬜ pending |
| 13-01-04 | 01 | 1 | KPI-07 | manual | DB trigger check | N/A (SQL) | ⬜ pending |
| 13-02-01 | 02 | 1 | ROAD-01 | tsc | `npx tsc --noEmit` | Will be created | ⬜ pending |
| 13-02-02 | 02 | 1 | ROAD-01 | tsc | `npx tsc --noEmit` | Will be created | ⬜ pending |
| 13-02-03 | 02 | 1 | ROAD-01 | tsc | `npx tsc --noEmit` | Will be created | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework to install — TypeScript compiler is the primary automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `session_minutes` column exists on `work_sessions` | WORK-09 | SQL DDL — no tsc verification | Check via Supabase dashboard: `SELECT column_name FROM information_schema.columns WHERE table_name='work_sessions'` |
| Cycle constraint dropped | WORK-09 | SQL DDL — no tsc verification | Verify no `BETWEEN 1 AND 4` constraint: `SELECT conname FROM pg_constraint WHERE conrelid='work_sessions'::regclass` |
| 5 new columns on `daily_reports` | KPI-07 | SQL DDL — no tsc verification | Check via Supabase dashboard: `SELECT column_name FROM information_schema.columns WHERE table_name='daily_reports'` |
| `restrict_coach_report_update` pins new columns | KPI-07 | SQL trigger — no tsc verification | Read trigger body from `pg_proc` or migration file |
| `paused` status accepted by DB | WORK-09 | Already done in migration 00003 | Verify via: `grep 'paused' supabase/migrations/00003_add_pause_support.sql` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
