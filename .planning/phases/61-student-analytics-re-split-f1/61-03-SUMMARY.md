---
phase: 61-student-analytics-re-split-f1
plan: 03
subsystem: ui
tags: [nextjs, unstable_cache, react, typescript, analytics, kpi, recharts, tailwind]

# Dependency graph
requires:
  - phase: 61
    provides: "Migration 00033 + StudentAnalyticsTotals type rename (total_brand_outreach / total_influencer_outreach)"
provides:
  - "Student /analytics KPI strip renders 6 unconditional KpiCards with renamed outreach labels and new field accesses"
  - "Cache-key namespace bump to student-analytics-v2 atomically orphans every stale entry on both /student/analytics and /student_diy/analytics"
  - "npx tsc --noEmit passes — plan gate closed; Plan 02's intentional breakage resolved"
  - "SA-07 resolved as SHOW — student_diy users now see Total Brand Outreach and Total Influencer Outreach"
affects: [61-04-build-gate-and-shape-assert, 62, 63, 64]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cache-key literal bump in same commit as breaking RPC shape (prevents 60s TTL rollover SSR crash)"
    - "Unconditional KPI grid — viewer-role hide-guard replaced by SHOW-for-all decision (SA-07 D-01)"

key-files:
  created: []
  modified:
    - "src/app/(dashboard)/student/analytics/page.tsx"
    - "src/app/(dashboard)/student_diy/analytics/page.tsx"
    - "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx"

key-decisions:
  - "Kept current Mail + Users icons for renamed cards — icon semantics weak, label carries meaning; minimum churn (Research Option 1)"
  - "Replaced cn(...) call on KPI grid className with literal string — conditional collapsed after SA-07 resolve-as-SHOW"
  - "Left cn import intact — still used at line 163 on outer div for isPending conditional"
  - "Identical cache-key literal across both /student and /student_diy pages — no per-route suffix"

patterns-established:
  - "Pattern: Breaking RPC shape change → cache-key literal bump in consumer page.tsx in SAME commit as migration (prevents TTL rollover crash)"
  - "Pattern: KPI grid column count expressed as unconditional Tailwind class once viewer-role gating is removed (no stale ternary)"

requirements-completed: [SA-01, SA-02, SA-05, SA-06, SA-07]

# Metrics
duration: 1m34s
completed: 2026-04-17
---

# Phase 61 Plan 03: Consumer Rewrite + Cache Bump Summary

**Flipped every /student and /student_diy analytics consumer to the new RPC shape (total_brand_outreach, total_influencer_outreach), bumped unstable_cache keys to student-analytics-v2 atomically, and removed the DIY KPI hide-guard — npx tsc --noEmit exits 0, closing the intentional Plan 02 breakage.**

## Performance

- **Duration:** 1m 34s
- **Started:** 2026-04-17T04:53:46Z
- **Completed:** 2026-04-17T04:55:20Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Both `/student/analytics` and `/student_diy/analytics` page.tsx files bumped `unstable_cache` key literal from `["student-analytics"]` to `["student-analytics-v2"]` (SA-05, SA-06) — atomic cache namespace switch prevents 60s TTL rollover SSR crash.
- `AnalyticsClient.tsx` KPI strip rewritten: "Total Emails" → "Total Brand Outreach", "Total Influencers" → "Total Influencer Outreach"; field accesses switched to `data.totals.total_brand_outreach` / `data.totals.total_influencer_outreach` (SA-01, SA-02).
- `viewerRole !== "student_diy"` hide-guard at AnalyticsClient.tsx:198 removed — student_diy users now see all 6 KPI cards (SA-07 resolved as SHOW per CONTEXT D-01).
- Grid className simplified from `cn(..., ternary lg:grid-cols-4 / lg:grid-cols-6)` to unconditional literal string `"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"`.
- Plan gate green: `npx tsc --noEmit` exits 0 — resolves the intentional Plan 02 tsc breakage at AnalyticsClient.tsx:203, 208.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump unstable_cache key on both analytics pages** — `a0d7bf6` (feat)
2. **Task 2: Rewrite AnalyticsClient KPI strip — rename 2 cards + remove DIY hide-guard + simplify grid className** — `8812854` (feat)

_Plan metadata commit follows below as a separate docs commit._

## Files Created/Modified

- `src/app/(dashboard)/student/analytics/page.tsx` — single-line change: `["student-analytics"]` → `["student-analytics-v2"]` at line 50; `revalidate: 60` and `tags: [studentAnalyticsTag(user.id)]` preserved.
- `src/app/(dashboard)/student_diy/analytics/page.tsx` — identical single-line change at line 50 (literal matches sibling route exactly).
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` — KPI strip (lines 178-220) rewritten: grid simplified to unconditional `lg:grid-cols-6`, DIY hide-guard fragment removed, two KpiCards renamed with new field accesses; outreach trend chart block (lines 222-331) UNTOUCHED (SA-08 invariant); `cn` import preserved (still used at line 163 for outer div).

## Before/After Snippets

### `src/app/(dashboard)/student/analytics/page.tsx` line 50
```diff
- ["student-analytics"],
+ ["student-analytics-v2"],
```

### `src/app/(dashboard)/student_diy/analytics/page.tsx` line 50
```diff
- ["student-analytics"],
+ ["student-analytics-v2"],
```

### `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` lines 178-220
```diff
  <section
    aria-label="Lifetime totals"
-   className={cn(
-     "grid grid-cols-2 sm:grid-cols-3 gap-4 motion-safe:animate-fadeIn",
-     viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6",
-   )}
+   className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"
  >
    <KpiCard
      icon={<Clock className="h-5 w-5" aria-hidden="true" />}
      label="Total Hours"
      value={formatHours(data.totals.total_hours)}
      suffix={ ... }
    />
-   {viewerRole !== "student_diy" && (
-     <>
-       <KpiCard
-         icon={<Mail className="h-5 w-5" aria-hidden="true" />}
-         label="Total Emails"
-         value={data.totals.total_emails.toLocaleString()}
-       />
-       <KpiCard
-         icon={<Users className="h-5 w-5" aria-hidden="true" />}
-         label="Total Influencers"
-         value={data.totals.total_influencers.toLocaleString()}
-       />
-     </>
-   )}
+   <KpiCard
+     icon={<Mail className="h-5 w-5" aria-hidden="true" />}
+     label="Total Brand Outreach"
+     value={data.totals.total_brand_outreach.toLocaleString()}
+   />
+   <KpiCard
+     icon={<Users className="h-5 w-5" aria-hidden="true" />}
+     label="Total Influencer Outreach"
+     value={data.totals.total_influencer_outreach.toLocaleString()}
+   />
    <KpiCard
      icon={<Handshake className="h-5 w-5" aria-hidden="true" />}
      label="Total Deals"
      value={data.totals.total_deals.toLocaleString()}
    />
    <KpiCard icon={<DollarSign ... />} label="Total Revenue" ... />
    <KpiCard icon={<TrendingUp ... />} label="Total Profit" ... />
  </section>
```

## Decisions Made

- **Kept Mail + Users icons.** Research Option 1 (minimum churn); no lucide-react import changes required.
- **Replaced `cn(...)` on grid with literal string.** After SA-07 collapsed the viewerRole ternary, there is a single class set — a literal is cleaner and auditable.
- **Left `cn` import intact.** Used at line 163 on outer wrapper div with `isPending` conditional — removing would break that call site.

## Deviations from Plan

None — plan executed exactly as written. All three edits (cache-key bump ×2, KPI strip rewrite) applied per plan prescription; no auto-fixes triggered, no blocking issues discovered, no architectural changes needed.

## Issues Encountered

None. `npx tsc --noEmit` passed on first attempt after Task 2 edit.

## Verification Evidence

Plan-level automated checks (run post-Task 2):

| Check | Command | Result |
|-------|---------|--------|
| Cache-key bump on /student route | `grep -c '"student-analytics-v2"' src/app/(dashboard)/student/analytics/page.tsx` | 1 |
| Cache-key bump on /student_diy route | `grep -c '"student-analytics-v2"' src/app/(dashboard)/student_diy/analytics/page.tsx` | 1 |
| Old key absent on /student route | `grep -q '\["student-analytics"\]' src/app/(dashboard)/student/analytics/page.tsx` | no match (0) |
| Old key absent on /student_diy route | `grep -q '\["student-analytics"\]' src/app/(dashboard)/student_diy/analytics/page.tsx` | no match (0) |
| `Total Brand Outreach` label present | `grep -c "Total Brand Outreach" AnalyticsClient.tsx` | 1 |
| `Total Influencer Outreach` label present | `grep -c "Total Influencer Outreach" AnalyticsClient.tsx` | 1 |
| `data.totals.total_brand_outreach` access | `grep -c "data\.totals\.total_brand_outreach" AnalyticsClient.tsx` | 1 |
| `data.totals.total_influencer_outreach` access | `grep -c "data\.totals\.total_influencer_outreach" AnalyticsClient.tsx` | 1 |
| Old `Total Emails` label absent | `grep -q "Total Emails" AnalyticsClient.tsx` | no match (0) |
| Old `Total Influencers` label absent | `grep -q "Total Influencers" AnalyticsClient.tsx` | no match (0) |
| DIY hide-guard absent | `grep -q 'viewerRole !== "student_diy"' AnalyticsClient.tsx` | no match (0) |
| Old 4-col grid class absent | `grep -q "lg:grid-cols-4" AnalyticsClient.tsx` | no match (0) |
| New unconditional 6-col grid class present | `grep -q "lg:grid-cols-6" AnalyticsClient.tsx` | match |
| `motion-safe:animate-fadeIn` preserved on grid | `grep -n "motion-safe:animate-fadeIn" AnalyticsClient.tsx` | line 180 (+ 439, 486 elsewhere) |
| Outreach trend chart untouched (SA-08) | `grep -c "data\.outreach_trend" AnalyticsClient.tsx` | 6 hits at lines 141, 142, 147, 234, 249, 319 — identical to pre-edit |
| Word-boundary `total_emails`\|`total_influencers` across src/ | `rg '\btotal_emails\b\|\btotal_influencers\b' src/` | 0 hits |
| `as any` / `as unknown` near totals | `rg "as any\|as unknown" AnalyticsClient.tsx` | 0 hits |
| **Plan gate: TypeScript check** | `npx tsc --noEmit; echo $?` | **exit code 0** |

## CLAUDE.md Hard Rules Compliance

| Rule | Applies | Compliance |
|------|---------|------------|
| 1. `motion-safe:` on `animate-*` | yes | `motion-safe:animate-fadeIn` preserved on KPI grid className (line 180) |
| 2. 44px touch targets | n/a | No new interactive elements added (KpiCard is display-only) |
| 3. Accessible labels | yes | `aria-label="Lifetime totals"` on section retained; `aria-hidden="true"` on all icons retained |
| 4. Admin client in API routes | n/a | Only server component + client component edits — no API route changes |
| 5. Never swallow errors | n/a | No try/catch blocks added or modified |
| 6. Check `response.ok` | n/a | No `fetch()` calls added |
| 7. Zod import `from "zod"` | yes | Existing `import { z } from "zod"` on both page.tsx files unchanged |
| 8. ima-* tokens only | yes | No hardcoded colors added; all existing ima-text, ima-text-secondary, ima-warning, ima-primary, ima-border, ima-surface-light tokens preserved |

## Next Phase Readiness

- Plan 04 (`61-04-build-gate-and-shape-assert-PLAN.md`) is unblocked. Plan 04 runs the full build gate (`npm run lint && npx tsc --noEmit && npm run build`) plus the psql jsonb_object_keys shape assertion against a live database.
- `npx tsc --noEmit` already green at this point; `npm run lint` and `npm run build` remain as Plan 04's responsibility.
- No lingering deferred items. No open blockers introduced by this plan.

## Self-Check: PASSED

All SUMMARY.md claims verified:

- Commit `a0d7bf6` exists: `git log --all --oneline | grep -q "a0d7bf6"` → FOUND
- Commit `8812854` exists: `git log --all --oneline | grep -q "8812854"` → FOUND
- `src/app/(dashboard)/student/analytics/page.tsx` exists and contains `"student-analytics-v2"` → FOUND
- `src/app/(dashboard)/student_diy/analytics/page.tsx` exists and contains `"student-analytics-v2"` → FOUND
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` exists and contains `Total Brand Outreach` + `Total Influencer Outreach` + `data.totals.total_brand_outreach` + `data.totals.total_influencer_outreach` → FOUND
- `npx tsc --noEmit` exit code 0 (plan gate) → CONFIRMED
- All CLAUDE.md Hard Rules preserved → CONFIRMED

---

*Phase: 61-student-analytics-re-split-f1*
*Plan: 03 (consumer-rewrite-cache-bump)*
*Completed: 2026-04-17*
