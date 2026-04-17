---
phase: 61
slug: student-analytics-re-split-f1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — reliance on build/type tooling + SQL shape assertion |
| **Config file** | none — no test framework in package.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run lint && npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~45 seconds (build dominates) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` (~8s) — catches stale consumers of removed `total_emails` / `total_influencers` payload keys
- **After every plan wave:** Run `npm run lint && npx tsc --noEmit && npm run build` (~45s)
- **Before `/gsd-verify-work`:** Full suite must be green AND `psql -f` RPC shape assertion must return the new jsonb keys (`total_brand_outreach`, `total_influencer_outreach`) and 1 row from `pg_proc` for `get_student_analytics`
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 1 | SA-04 | — | Migration drops old overloads via defensive pattern; exactly 1 row in `pg_proc` for `get_student_analytics` | integration (SQL) | `psql -f supabase/migrations/00033_fix_student_analytics_outreach_split.sql && psql -c "SELECT COUNT(*) FROM pg_proc WHERE proname='get_student_analytics'"` | ❌ W0 (migration file to be created) | ⬜ pending |
| 61-01-02 | 01 | 1 | SA-03 | — | RPC `totals` jsonb contains keys `total_brand_outreach` + `total_influencer_outreach`, NOT `total_emails` / `total_influencers` | integration (SQL) | `psql -c "SELECT jsonb_object_keys((get_student_analytics('<any_uuid>','weekly',7,7)).totals)"` | ❌ W0 | ⬜ pending |
| 61-02-01 | 02 | 2 | SA-02 | — | `StudentAnalyticsTotals` type has `total_brand_outreach: number` + `total_influencer_outreach: number`; old fields removed | unit | `npx tsc --noEmit` + `grep -c "total_emails\|total_influencers\b" src/lib/types.ts` (must be 0 excluding `total_influencers_contacted` column) | ❌ W0 | ⬜ pending |
| 61-03-01 | 03 | 3 | SA-06 | — | Both analytics pages bump `unstable_cache` key to `["student-analytics-v2"]` in same commit as migration | unit | `grep "student-analytics-v2" src/app/(dashboard)/student/analytics/page.tsx src/app/(dashboard)/student_diy/analytics/page.tsx` (2 hits expected) | ❌ W0 | ⬜ pending |
| 61-03-02 | 03 | 3 | SA-01, SA-05 | — | AnalyticsClient renders "Total Brand Outreach" + "Total Influencer Outreach" KPI cards; no aggregation | unit (grep) | `grep -c "Total Brand Outreach\|Total Influencer Outreach" src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` (≥ 2 hits) | ❌ W0 | ⬜ pending |
| 61-03-03 | 03 | 3 | SA-07 | — | DIY hide-guard at `AnalyticsClient.tsx:198` removed; grid unconditional `lg:grid-cols-6` | unit (grep) | `grep -c "viewerRole !== .student_diy." src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` (must be 0 for the KPI wrapper) | ❌ W0 | ⬜ pending |
| 61-04-01 | 04 | 4 | SA-08 | — | Post-phase build gate green (lint + tsc + build) | integration | `npm run lint && npx tsc --noEmit && npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` — Wave 1 task creates
- [ ] `src/lib/types.ts` (or equivalent — research confirmed) — Wave 2 updates `StudentAnalyticsTotals`
- [ ] `src/app/(dashboard)/student/analytics/page.tsx` + `src/app/(dashboard)/student_diy/analytics/page.tsx` — Wave 3 bumps cache keys
- [ ] `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` — Wave 3 rewrites KPI cards + removes DIY hide-guard

No test framework install needed — project uses build/type tooling as the validation floor (documented state).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Render the new KPI cards on `/student/analytics` in a browser session (authenticated student) | SA-01 | No E2E framework; visual confirmation of card labels + non-aggregated values | 1. `npm run dev` 2. Log in as any student with `daily_reports` rows 3. Visit `/student/analytics` 4. Confirm two cards: "Total Brand Outreach" = SUM(brands_contacted), "Total Influencer Outreach" = SUM(influencers_contacted); neither sums both |
| Render the new KPI cards on `/student_diy/analytics` in a browser session (authenticated student_diy) | SA-07 | DIY route behavior differs from student; confirm renamed cards visible and layout at 6 columns | 1. Log in as `student_diy` user 2. Visit `/student_diy/analytics` 3. Confirm the two renamed cards are VISIBLE and grid renders 6 columns at `lg` breakpoint without overflow |
| Outreach trend chart unchanged | SA-05 | Regression check — the chart must continue to split brand vs influencer series | 1. Visit `/student/analytics` 2. Scroll to trend chart 3. Confirm two series (brand + influencer) still plotted as before |
| Daily report form unchanged | SA-05 | Regression check — the form must still collect `brands_contacted` and `influencers_contacted` as separate integers | 1. Visit `/student/report/new` (or wherever report submission happens) 2. Confirm form has the two separate integer fields unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
