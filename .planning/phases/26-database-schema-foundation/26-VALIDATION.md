---
phase: 26
slug: database-schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | psql / supabase CLI |
| **Config file** | supabase/config.toml |
| **Quick run command** | `npx supabase db reset && npx supabase db test` |
| **Full suite command** | `npx supabase db reset && npx supabase db test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx supabase db reset && npx supabase db test`
- **After every plan wave:** Run `npx supabase db reset && npx supabase db test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | PLAN-07 | migration | `npx supabase db reset` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | UNDO-05 | migration | `npx supabase db reset` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/00013_daily_plans_undo_log.sql` — migration file for both tables

*Existing infrastructure covers all phase requirements via supabase db reset.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS policy enforcement | PLAN-07, UNDO-05 | Requires authenticated context | Test with different user roles via supabase dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
