---
phase: 21
slug: write-path-pre-aggregation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if configured) / manual verification via SQL + browser |
| **Config file** | none — validation via SQL queries and browser checks |
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
| 21-01-01 | 01 | 1 | WRITE-01 | SQL verify | `SELECT count(*) FROM student_kpi_summaries` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | WRITE-01 | SQL verify | `SELECT * FROM cron.job WHERE jobname = 'refresh_student_kpi_summaries'` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 2 | WRITE-01 | SQL verify | RPC functions reference student_kpi_summaries | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 2 | WRITE-02 | browser | Submit report, observe optimistic UI before API response | ❌ W0 | ⬜ pending |
| 21-04-01 | 04 | 3 | WRITE-03 | doc review | Write path audit document exists with DB call counts | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Migration file `00011_write_path.sql` — creates table, function, pg_cron job
- [ ] pg_cron extension enabled in Supabase Dashboard (manual prerequisite)

*Existing infrastructure (TypeScript, ESLint, build) covers type safety and lint requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optimistic UI shows banner before API responds | WRITE-02 | Requires visual timing check | 1. Throttle network to Slow 3G, 2. Submit report, 3. Verify banner appears before API response |
| pg_cron job runs at 2 AM UTC | WRITE-01 | Requires waiting for scheduled time or manual trigger | Run `SELECT public.refresh_student_kpi_summaries()` manually, verify upsert |
| Advisory lock prevents overlapping runs | WRITE-01 | Requires concurrent execution | Open two psql sessions, run function simultaneously, verify one returns early |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
