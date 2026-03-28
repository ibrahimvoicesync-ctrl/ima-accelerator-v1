---
phase: 15
slug: outreach-kpi-banner
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed (TypeScript build verification) |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build && npx tsc --noEmit && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | KPI-01 | smoke | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | KPI-03 | smoke + manual | `npx tsc --noEmit` + manual form submit | ✅ | ⬜ pending |
| 15-03-01 | 03 | 1 | KPI-02, KPI-04 | smoke + manual | `npx tsc --noEmit` + visit 4 student pages | ✅ | ⬜ pending |
| 15-04-01 | 04 | 2 | KPI-05, KPI-06 | manual | Open /student, verify RAG colors on cards | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/types.ts` — add 5 new columns (`outreach_brands`, `outreach_influencers`, `brands_contacted`, `influencers_contacted`, `calls_joined`) to `daily_reports` Row, Insert, Update types
- [ ] `src/lib/kpi.ts` — create RAG utility file with `getRAGStatus()`, `getLifetimeRAG()`, `getDailyOutreachRAG()`, `getDailyHoursRAG()` functions

*Existing infrastructure covers all phase requirements after Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lifetime outreach = SUM(outreach_brands + outreach_influencers) | KPI-02 | PostgREST aggregate correctness requires live DB | Open /student, verify banner lifetime count matches DB sum |
| Banner appears on all 4 student pages | KPI-04 | Layout-level rendering verification | Visit /student, /student/work, /student/roadmap, /student/report |
| RAG color coding visually correct | KPI-05 | Visual verification of CSS color classes | Open /student, verify green/amber/red on KPI indicators |
| KPI cards on homepage with correct RAG | KPI-06 | Visual verification of card colors | Open /student, verify KPI card colors match banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
