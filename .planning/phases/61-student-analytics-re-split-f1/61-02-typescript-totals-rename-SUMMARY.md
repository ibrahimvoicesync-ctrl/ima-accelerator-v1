---
phase: 61-student-analytics-re-split-f1
plan: 02
subsystem: types
tags: [typescript, rpc-types, student-analytics, breaking-contract, tsc-gate]

# Dependency graph
requires:
  - phase: 61-student-analytics-re-split-f1
    provides: "61-01 — migration 00033 emits new jsonb keys total_brand_outreach + total_influencer_outreach and removes total_emails + total_influencers"
provides:
  - "src/lib/rpc/student-analytics-types.ts — StudentAnalyticsTotals type renamed in place to mirror 00033 jsonb shape"
  - "Compile-time breaking signal at exactly 2 consumer sites (AnalyticsClient.tsx:203, :208) — intended handoff to Plan 61-03"
affects:
  - "61-03-consumer-rewrite-cache-bump (will fix the 2 tsc errors introduced here; bumps unstable_cache keys + removes DIY hide-guard)"
  - "61-04-build-gate-and-shape-assert (full tsc/lint/build gate runs green only after Plan 03 lands)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-place breaking type rename — no back-compat alias, no optional field, no V1/V2 suffix. tsc is the authoritative stale-consumer detector (CONTEXT locked decision)"

key-files:
  created: []
  modified:
    - "src/lib/rpc/student-analytics-types.ts (lines 22-23; only 2 fields inside StudentAnalyticsTotals changed)"

key-decisions:
  - "In-place field rename: total_emails → total_brand_outreach; total_influencers → total_influencer_outreach (CONTEXT 'breaking is the point')"
  - "No back-compat shim — did NOT make old fields optional, did NOT introduce StudentAnalyticsTotalsV1 alias, did NOT add @deprecated JSDoc tags, did NOT emit a union type"
  - "Preserved field order (total_hours, total_brand_outreach, total_influencer_outreach, total_deals, total_revenue, total_profit) to minimize diff noise"
  - "Left all other exports in the module untouched (STUDENT_ANALYTICS_PAGE_SIZE, STUDENT_ANALYTICS_RANGES, OutreachBucket, HoursBucket, LoggerRole, DealRow, DealSummary, RoadmapProgressRow, StudentAnalyticsPayload, studentAnalyticsTag)"
  - "Did NOT run npx tsc --noEmit as a go/no-go gate for this plan — tsc is EXPECTED to fail at AnalyticsClient.tsx:203 + :208 per plan acceptance criteria; that failure is the intended signal for Plan 61-03"

patterns-established:
  - "Breaking type rename as consumer-break oracle: rename fields in the authoritative type alias, let tsc enumerate every stale consumer at compile time, then fix consumers in the next plan. No manual grep census required; the compiler is the census."

requirements-completed: [SA-04]

# Metrics
duration: 1min
completed: 2026-04-17
---

# Phase 61 Plan 02: TypeScript Totals Rename Summary

**In-place rename of `StudentAnalyticsTotals` fields — `total_emails` → `total_brand_outreach`, `total_influencers` → `total_influencer_outreach` — so the TypeScript contract mirrors migration 00033's new jsonb payload keys. `tsc --noEmit` now fails at exactly the two known consumer sites (AnalyticsClient.tsx:203, :208) by design; Plan 03 will resolve them.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-17T04:51:01Z
- **Completed:** 2026-04-17T04:51:49Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Edited `src/lib/rpc/student-analytics-types.ts` with exactly two field-level replacements inside the `StudentAnalyticsTotals` type alias (lines 22 and 23).
- Field `total_emails: number;` replaced with `total_brand_outreach: number;` (line 22).
- Field `total_influencers: number;` replaced with `total_influencer_outreach: number;` (line 23).
- Field order preserved: `total_hours`, `total_brand_outreach`, `total_influencer_outreach`, `total_deals`, `total_revenue`, `total_profit`.
- All other exports in the module (constants, unrelated types, `studentAnalyticsTag()` function, file header comment) untouched.
- Breaking signal now armed: `npx tsc --noEmit` fails at exactly `AnalyticsClient.tsx:203` (consumer of `.total_emails`) and `AnalyticsClient.tsx:208` (consumer of `.total_influencers`) — the intended handoff mechanism for Plan 61-03.

## Field Rename Diff

```diff
 export type StudentAnalyticsTotals = {
   total_hours: number;
-  total_emails: number;
-  total_influencers: number;
+  total_brand_outreach: number;
+  total_influencer_outreach: number;
   total_deals: number;
   total_revenue: number;
   total_profit: number;
 };
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename StudentAnalyticsTotals fields in place** — `6b45966` (refactor)

_Final metadata commit for this plan will land after SUMMARY/STATE/ROADMAP updates._

## Files Created/Modified

- `src/lib/rpc/student-analytics-types.ts` — renamed 2 fields inside `StudentAnalyticsTotals`; no other lines changed.

## Decisions Made

See frontmatter `key-decisions`. In summary: in-place rename, no back-compat, no tsc gate (tsc failure is the intended signal).

## Deviations from Plan

None — plan executed exactly as written. The grep automated-verify expression from the plan (`grep -c "total_brand_outreach: number;" && grep -c "total_influencer_outreach: number;" && ! grep -q "total_emails: number;" && ! grep -q "total_influencers: number;"`) passes.

## Issues Encountered

None.

## Verification Performed

Grep checks against the edited file (all pass):

| Expected | Result |
|---|---|
| `grep -n "total_brand_outreach: number;"` → ≥1 hit | ✓ line 22 |
| `grep -n "total_influencer_outreach: number;"` → ≥1 hit | ✓ line 23 |
| `grep -n "total_emails: number;"` → 0 hits | ✓ 0 matches |
| `grep -n "total_influencers: number;"` → 0 hits | ✓ 0 matches |
| `StudentAnalyticsTotals` export still present as single `type` alias | ✓ line 20 |
| Field order preserved | ✓ total_hours, total_brand_outreach, total_influencer_outreach, total_deals, total_revenue, total_profit |

Informational grep audit outside the type file (`grep -rn "total_emails\|total_influencers" src/`):

| Hit | Expected? | Handling |
|---|---|---|
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203` — `data.totals.total_emails.toLocaleString()` | YES | Intended tsc error; fixed in Plan 61-03 |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:208` — `data.totals.total_influencers.toLocaleString()` | YES | Intended tsc error; fixed in Plan 61-03 |
| `src/lib/types.ts:728, 740, 752` — `total_influencers_contacted` on `student_kpi_summaries` | YES | Different identifier (unrelated column), DO NOT touch — confirmed via RESEARCH.md |

No unexpected references. The breaking signal is isolated to exactly the two known consumer lines as designed.

## tsc Handoff Note

**tsc now fails at `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203` and `:208` — this is intended; Plan 61-03 will fix those consumer sites along with the cache-key bump, DIY hide-guard removal, and KPI card label updates.** Do NOT treat the tsc failure as a Plan 02 regression; acceptance criteria are grep-only per the plan.

## Known Stubs

None.

## Threat Flags

None — this is a pure type-contract rename. No new network endpoints, auth paths, file access, or trust-boundary schema introduced. The RPC auth guard and cache-key tagging remain unchanged.

## Self-Check: PASSED

- [x] `src/lib/rpc/student-analytics-types.ts` exists and contains the new field names at lines 22-23.
- [x] Commit `6b45966` exists in `git log --oneline`.
- [x] No other files modified by this plan.
- [x] Phase-level invariants preserved (no alias/shim/union added; field order preserved; all other exports untouched).
