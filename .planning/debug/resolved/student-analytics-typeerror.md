---
slug: student-analytics-typeerror
status: resolved
created: 2026-04-17T08:37:28Z
updated: 2026-04-17T09:55:00Z
resolved_commit: f6af379
trigger: |
  User reports /student/analytics page crashes at runtime.
  Error: TypeError: Cannot read properties of undefined (reading 'toLocaleString')
  Location: src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:198:51
  Code: value={data.totals.total_brand_outreach.toLocaleString()}
  Digest: 4179269157
---

# Debug Session: student-analytics-typeerror

## Symptoms

**Expected:** /student/analytics loads and renders KPI strip with Total Brand Outreach, Total Influencer Outreach, and other KPIs (post Phase 61 re-split).

**Actual:** Runtime TypeError crash during render. `data.totals.total_brand_outreach` is `undefined` when `.toLocaleString()` is called at AnalyticsClient.tsx:198:51.

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
  at AnalyticsClient (src\app\(dashboard)\student\analytics\AnalyticsClient.tsx:198:51)
digest: '4179269157'
```

**Timeline:** Surfaced immediately after v1.8 shipped (2026-04-17). Phase 61 introduced breaking `get_student_analytics` RPC rename.

## Current Focus

hypothesis: Stale Next.js `unstable_cache` fetch-cache entries (written with the OLD totals shape `{total_emails, total_influencers, ...}`) are being served to the post-Phase-61 consumer, which reads the NEW field names (`total_brand_outreach`, `total_influencer_outreach`). The consumer has no defensive guard, so the `undefined.toLocaleString()` access crashes render.
test: Confirmed by grep on `.next/dev/cache/fetch-cache/` — 7 cached payloads still contain `total_emails`/`total_influencers` (last stale write at 2026-04-17 07:04:40, AFTER cache-key bump commit a0d7bf6 at 06:54). Live RPC probe confirms correct new shape for all test students.
next_action: Apply dual-pronged fix — (1) defensive reads in AnalyticsClient, (2) cache-key bump to -v3 (or cache clear) to evict stale entries.

## Evidence

- timestamp: 2026-04-17T08:37:28Z | Error error digest `4179269157` captured from user's runtime stack.
- timestamp: 2026-04-17T08:37:28Z | Phase 61 build gate passed at ship (lint + tsc + build exit 0).
- timestamp: 2026-04-17T08:37:28Z | Migration list confirms 00033 applied on remote.
- timestamp: 2026-04-17T09:20:00Z | Live RPC probe for student 'Michael Coppotelli' (c7a9ff43): totals keys = total_deals, total_hours, total_profit, total_revenue, total_brand_outreach, total_influencer_outreach. Values populated correctly (23 / 27). Live DB shape is correct.
- timestamp: 2026-04-17T09:22:00Z | Live RPC probe for 35001723 + c94cfec1: both return new shape with populated totals.
- timestamp: 2026-04-17T09:25:00Z | Compiled .next/server chunks verified:
    * AnalyticsClient chunk (844f60fe): `total_brand_outreach` present (1x), `total_influencer_outreach` present (1x), `total_emails` absent (0x), labels "Total Brand Outreach"/"Total Influencer Outreach" present. Build date 2026-04-17 05:54Z.
    * page.tsx chunk (cb2fa434): cache key literal `["student-analytics-v2"]` present.
- timestamp: 2026-04-17T09:30:00Z | `.next/dev/cache/fetch-cache/` grep: 7 files contain `total_emails` (stale shape) + 1 file contains `total_brand_outreach` (fresh shape). Stale mtimes span 2026-04-16 13:19 through 2026-04-17 07:04. Critically, one stale write (file 1935...) has mtime 2026-04-17 07:04:40, which is ~10 minutes AFTER the cache-key bump commit landed on master (06:54 local = 04:54 UTC, commit a0d7bf6).
- timestamp: 2026-04-17T09:35:00Z | Inspected stale cache file 1935: body has `"totals":{"total_deals":4,"total_hours":16.75,"total_emails":50,"total_profit":1310000,"total_revenue":1531000,"total_influencers":47}` — tagged `student-analytics:35001723-3429-484a-b368-4282d678b6b9`. This is the exact missing-key shape that crashes the consumer.
- timestamp: 2026-04-17T09:38:00Z | AnalyticsClient.tsx reads 6 numeric totals via `data.totals.<field>.toLocaleString()` at lines 185 (via formatHours), 198, 203, 208, 213, 218 — ALL unguarded. Any stale or partial payload crashes the page.

## Eliminated

- RPC shape drift on the live DB — probed directly, shape is correct.
- Migration 00033 not applied — migration list and probe confirm it is applied.
- Stale TypeScript compile (old consumer in build) — .next/server bundles confirmed to contain new field names + new labels, built 05:54 UTC today.
- Secondary mapping layer between RPC and StudentAnalyticsTotals silently dropping fields — there is no mapping layer; fetchStudentAnalytics casts raw jsonb directly with `as unknown as StudentAnalyticsPayload`.
- Cache-key bump missing from shipped code — confirmed both page.tsx files are on `["student-analytics-v2"]` in source AND compiled bundles.
- Edge case for users with zero reports — SQL uses `COALESCE((SELECT SUM(...), 0))` so the key is always present on the new shape.

## Resolution

### Root Cause

Stale `unstable_cache` fetch-cache entries (written with the pre-Phase-61 totals shape `{total_emails, total_influencers, ...}`) are still being served to the post-Phase-61 consumer. The consumer reads `data.totals.total_brand_outreach` and `data.totals.total_influencer_outreach` with no defensive guard, so any payload lacking those keys throws `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` at render time.

Why the stale bleed-through defeats the `student-analytics-v2` cache-key bump: at least one stale cache file was written at 2026-04-17 07:04:40 (~10 minutes AFTER the bump commit `a0d7bf6` landed), meaning the running dev server hadn't picked up the new cache-key literal (turbopack HMR of `unstable_cache(..., keyParts, ...)` literal does not reliably re-key in Next.js 16). Those stale files remain valid under the 60-second revalidate window and are served to any student with a matching `(studentId, range, page)` tuple until revalidated.

Underlying hard rule violated: **breaking RPC shape changes in Next.js require either (a) a cache namespace bump AND a cache-dir wipe, or (b) a defensive consumer that tolerates missing/stale fields.** Phase 61 shipped (a) but skipped the cache-dir wipe. The consumer is also fragile: it does `data.totals.<field>.toLocaleString()` six times with zero guards.

### Fix (proposed, awaiting approval)

Two changes in one atomic commit:

1. **Defensive reads in AnalyticsClient.tsx** — wrap every numeric KPI access with `?? 0`. Converts a full page crash into a benign "0" display for stale/malformed payloads and protects against any future RPC-shape drift.
   - Line 185: `formatHours(data.totals.total_hours ?? 0)`
   - Line 198: `(data.totals.total_brand_outreach ?? 0).toLocaleString()`
   - Line 203: `(data.totals.total_influencer_outreach ?? 0).toLocaleString()`
   - Line 208: `(data.totals.total_deals ?? 0).toLocaleString()`
   - Line 213: `formatMoney(data.totals.total_revenue ?? 0)`
   - Line 218: `formatMoney(data.totals.total_profit ?? 0)`

2. **Cache key bump to `student-analytics-v3`** in both `src/app/(dashboard)/student/analytics/page.tsx:50` and `src/app/(dashboard)/student_diy/analytics/page.tsx:50`. This evicts all stale entries (the -v2 write at 07:04 is the proof that -v2 didn't fully land on all running dev sessions).

Why both, not just one: the cache bump alone relies on the dev process correctly picking up the new literal on HMR (which just failed us for -v2). The defensive reads alone would hide the stale cache forever (user sees "0" values). Together: stale entries get evicted AND any future shape drift degrades gracefully.

Optional cleanup (separate commit, not required for the fix): clear `.next/dev/cache/fetch-cache/` on the user's machine to evict any orphaned files immediately without waiting for the 60s TTL.

Build gate after fix: `npx tsc --noEmit` + `npm run lint` + `npm run build` should all exit 0. No type changes; all fields on `StudentAnalyticsTotals` are already typed as `number` so `?? 0` is type-safe.
