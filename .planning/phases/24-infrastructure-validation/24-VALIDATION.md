---
phase: 24
slug: infrastructure-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | k6 v1.7.0 (load testing) + SQL seed scripts |
| **Config file** | `load-tests/` (created in Wave 1) |
| **Quick run command** | `"/c/Program Files/k6/k6.exe" run load-tests/scenarios/read-mix.js` |
| **Full suite command** | `"/c/Program Files/k6/k6.exe" run load-tests/scenarios/combined.js` |
| **Estimated runtime** | ~120-300 seconds (full load test) |

---

## Sampling Rate

- **After every task commit:** Run smoke test (10 VUs, 30s)
- **After every plan wave:** Run full suite with thresholds
- **Before `/gsd:verify-work`:** Full suite must be green (all thresholds pass)
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 0 | INFRA-01 | setup | staging project provisioned | ❌ W0 | ⬜ pending |
| 24-01-02 | 01 | 1 | INFRA-01 | seed | SQL seed script runs without error | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | INFRA-01 | load | k6 smoke test exits 0 | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 2 | INFRA-01 | load | k6 full load test exits 0 with thresholds | ❌ W0 | ⬜ pending |
| 24-03-01 | 03 | 3 | INFRA-02 | doc | capacity doc contains connection/latency tables | ❌ W0 | ⬜ pending |
| 24-03-02 | 03 | 3 | INFRA-03 | doc | PROJECT.md Key Decisions contains compute tier decision | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Staging Supabase project provisioned (requires human action)
- [ ] Staging project linked via `supabase link`
- [ ] Migrations applied via `supabase db push`
- [ ] `tests/load/` directory created with k6 test scaffolding

*Note: k6 is already installed at `C:\Program Files\k6\k6.exe`*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Staging Supabase provisioning | INFRA-01 | Requires Supabase dashboard access | Create staging project, run `supabase link`, `supabase db push` |
| Compute tier decision | INFRA-03 | Human judgment on cost/performance tradeoff | Review load test results, decide stay/upgrade, document rationale |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
