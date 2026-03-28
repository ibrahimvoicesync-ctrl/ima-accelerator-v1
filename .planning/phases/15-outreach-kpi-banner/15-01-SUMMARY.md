---
phase: 15-outreach-kpi-banner
plan: "01"
subsystem: daily-reports
tags: [kpi, outreach, types, form, api, rag]
dependency_graph:
  requires: [phase-13-schema-foundation]
  provides: [outreach-types, kpi-utility, granular-report-form, granular-api-route]
  affects: [student-report-page, coach-report-review, phase-15-02-progress-banner]
tech_stack:
  added: []
  patterns: [rag-utility-pure-functions, fieldset-grouped-form-inputs, backward-compat-legacy-column]
key_files:
  created:
    - src/lib/kpi.ts
  modified:
    - src/lib/types.ts
    - src/lib/config.ts
    - src/app/api/reports/route.ts
    - src/components/student/ReportForm.tsx
decisions:
  - "outreach_count kept populated as outreach_brands + outreach_influencers for backward compat (Phase 16 coach views may still read it)"
  - "kpi.ts uses daysInProgram < 1 neutral guard to prevent day-zero red state per D-04"
  - "ReportForm groups 5 outreach fields in a fieldset with 2-col grid for brand/influencer pairs, calls_joined full-width"
metrics:
  duration: "3m 17s"
  completed_date: "2026-03-28"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 15 Plan 01: Outreach Data Pipeline Foundation Summary

5 granular outreach columns wired end-to-end: types, kpi.ts RAG utility, config fields, API Zod schema, and ReportForm fieldset — replacing the single `outreach_count` field.

## What Was Built

### Task 1 — types.ts, kpi.ts, config DAILY_REPORT fields

**src/lib/types.ts** — Added 5 columns to `daily_reports` Row, Insert, and Update types:
- `outreach_brands: number`
- `outreach_influencers: number`
- `brands_contacted: number`
- `influencers_contacted: number`
- `calls_joined: number`

Legacy `outreach_count` retained in all three shapes for backward compatibility.

**src/lib/kpi.ts** — New pure utility file with 7 exports:
- `RagStatus` type: `"green" | "amber" | "red" | "neutral"`
- `getRagStatus(ratio, daysInProgram)`: core RAG logic with day-zero neutral guard
- `lifetimeOutreachRag(actual, daysInProgram)`: pace-based (actual / days×50), D-01
- `dailyOutreachRag(actual, daysInProgram)`: daily target (actual / 50), D-02
- `dailyHoursRag(minutesWorked, daysInProgram)`: hours target (minutes / 240), D-03
- `ragToColorClass(status)`: maps to `text-ima-success/warning/error/text-secondary`
- `ragToBgClass(status)`: maps to `bg-ima-success/warning/error/text-muted`
- `daysInProgram(joinedAt)`: UTC-normalized days since join date

**src/lib/config.ts** — Replaced `DAILY_REPORT.fields.outreachCount` with 5 fields:
`outreachBrands`, `outreachInfluencers`, `brandsContacted`, `influencersContacted`, `callsJoined`

### Task 2 — API route + ReportForm

**src/app/api/reports/route.ts** — Updated Zod schema replacing `outreach_count` with 5 validated fields using `VALIDATION` bounds from config. Both INSERT and UPDATE paths store all 5 columns plus `outreach_count = outreach_brands + outreach_influencers` for backward compatibility.

**src/components/student/ReportForm.tsx** — Replaced single `outreach_count` Input with `<fieldset>` containing 5 numeric inputs. Brand/influencer pairs in a 2-column grid; `calls_joined` full-width below. Uses `DAILY_REPORT.fields.*` labels and `VALIDATION.*` bounds from config (config is truth).

## Decisions Made

1. **outreach_count backward compat**: Populate `outreach_count = outreach_brands + outreach_influencers` on every INSERT/UPDATE. Phase 16 coach views may still read this column. One extra line in the route, no schema change required.

2. **Day-zero neutral guard**: `getRagStatus` returns `"neutral"` when `daysInProgram < 1`. Prevents newly-joined students from seeing red KPIs immediately. `lifetimeOutreachRag` has an additional guard before dividing to avoid NaN.

3. **Fieldset layout**: 2-column grid for the 4 paired fields (brand/influencer outreach, brand/influencer contacts), calls_joined full-width. Groups related fields visually without custom CSS — uses existing `grid grid-cols-2 gap-3` Tailwind pattern.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit`: PASS (0 errors)
- `npm run build`: PASS (33/33 pages, 0 errors)
- `npm run lint`: PASS (0 errors, 4 pre-existing warnings in unrelated files)
- `outreach_brands` confirmed in types.ts, route.ts, ReportForm.tsx
- `getRagStatus` exported from kpi.ts
- `outreachCount` removed from `DAILY_REPORT.fields` in config.ts

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | `becae53` | feat(15-01): add 5 granular outreach columns to types, create kpi.ts RAG utility, update DAILY_REPORT.fields |
| Task 2 | `a688f9c` | feat(15-01): expand API route and ReportForm to 5 granular outreach fields |

## Self-Check: PASSED
