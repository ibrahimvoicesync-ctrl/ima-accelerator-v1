---
phase: 30
slug: database-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Supabase CLI (psql) + TypeScript compiler |
| **Config file** | `supabase/config.toml` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | SCHEMA-01 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | SCHEMA-02 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | SCHEMA-03 | migration | `supabase db reset` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | SCHEMA-04 | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/00015_v1_4_schema.sql` — migration file with all 4 tables + role constraints + RLS
- [ ] Supabase CLI available for `supabase db reset` validation

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration runs without errors on remote Supabase | SCHEMA-01 | Requires live Supabase instance | Run `supabase db push` against staging |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
