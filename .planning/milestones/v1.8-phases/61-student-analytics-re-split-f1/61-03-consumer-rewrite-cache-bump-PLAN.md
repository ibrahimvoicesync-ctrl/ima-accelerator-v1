---
phase: 61
plan: 03
type: execute
wave: 3
depends_on:
  - 61-02
files_modified:
  - src/app/(dashboard)/student/analytics/page.tsx
  - src/app/(dashboard)/student_diy/analytics/page.tsx
  - src/app/(dashboard)/student/analytics/AnalyticsClient.tsx
autonomous: true
requirements:
  - SA-01
  - SA-02
  - SA-05
  - SA-06
  - SA-07
  - SA-08
must_haves:
  truths:
    - "Both /student/analytics and /student_diy/analytics unstable_cache calls use the new key literal [\"student-analytics-v2\"]"
    - "AnalyticsClient.tsx renders a KpiCard labeled \"Total Brand Outreach\" reading data.totals.total_brand_outreach"
    - "AnalyticsClient.tsx renders a KpiCard labeled \"Total Influencer Outreach\" reading data.totals.total_influencer_outreach"
    - "AnalyticsClient.tsx no longer contains a viewerRole !== \"student_diy\" wrapper around the two outreach KpiCards (SA-07 resolved as SHOW)"
    - "Grid at AnalyticsClient.tsx:178-183 uses lg:grid-cols-6 unconditionally (no ternary that collapses to lg:grid-cols-4 for DIY)"
    - "Outreach trend chart block (AnalyticsClient.tsx:~235-339 reading data.outreach_trend[].brands/.influencers) is UNTOUCHED (SA-08)"
    - "After this plan, npx tsc --noEmit exits 0"
  artifacts:
    - path: "src/app/(dashboard)/student/analytics/page.tsx"
      provides: "Cache key bumped to student-analytics-v2"
      contains: "\"student-analytics-v2\""
    - path: "src/app/(dashboard)/student_diy/analytics/page.tsx"
      provides: "Cache key bumped to student-analytics-v2 (identical bump)"
      contains: "\"student-analytics-v2\""
    - path: "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx"
      provides: "Two renamed KpiCards + DIY guard removed + grid simplified"
      contains: "Total Brand Outreach"
  key_links:
    - from: "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx (KPI strip lines 178-227)"
      to: "StudentAnalyticsTotals.total_brand_outreach / .total_influencer_outreach (Plan 02 rename)"
      via: "data.totals.<field>.toLocaleString()"
      pattern: "data\\.totals\\.total_brand_outreach|data\\.totals\\.total_influencer_outreach"
    - from: "page.tsx unstable_cache calls (both routes)"
      to: "migration 00033 new jsonb shape (Plan 01)"
      via: "cache-key namespace switch prevents 60s TTL rollover SSR crash"
      pattern: "\"student-analytics-v2\""
---

<objective>
Land three consumer-side edits in one plan — all three depend on the Plan 02 type rename and together make `npx tsc --noEmit` exit 0:

1. Bump `unstable_cache` key from `["student-analytics"]` to `["student-analytics-v2"]` at `src/app/(dashboard)/student/analytics/page.tsx:50`.
2. Bump identical key at `src/app/(dashboard)/student_diy/analytics/page.tsx:50` (MUST be identical literal).
3. Rewrite the KPI strip in `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`: rename the two cards to "Total Brand Outreach" / "Total Influencer Outreach" reading the new type fields; REMOVE the `viewerRole !== "student_diy"` hide-guard at line 198 (SA-07 = SHOW per CONTEXT D-01); simplify the grid className at line 180-183 to unconditional `lg:grid-cols-6`.

Purpose: Atomically flips every runtime consumer to the new RPC shape in the same commit as the migration — satisfies SA-05/SA-06 "in the SAME commit" constraint and closes the tsc breakage introduced by Plan 02. Also implements SA-07 locked decision to SHOW outreach cards to DIY students.

Output: 3 files modified; `npx tsc --noEmit` exits 0 after this plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md
@.planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md
@.planning/phases/61-student-analytics-re-split-f1/61-VALIDATION.md
@src/app/(dashboard)/student/analytics/AnalyticsClient.tsx
@src/app/(dashboard)/student/analytics/page.tsx
@src/app/(dashboard)/student_diy/analytics/page.tsx
@.planning/phases/61-student-analytics-re-split-f1/61-02-SUMMARY.md
</context>

<interfaces>
<!-- Type consumed (from Plan 02): -->
```typescript
// From src/lib/rpc/student-analytics-types.ts (Plan 02 shape):
export type StudentAnalyticsTotals = {
  total_hours: number;
  total_brand_outreach: number;       // NEW (was total_emails)
  total_influencer_outreach: number;  // NEW (was total_influencers)
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};
```

<!-- Current code shapes in the 3 files to edit: -->

```typescript
// src/app/(dashboard)/student/analytics/page.tsx lines 47-55 (CURRENT):
const fetchCached = unstable_cache(
  async (studentId: string, r: StudentAnalyticsRange, p: number) =>
    fetchStudentAnalytics(studentId, r, p),
  ["student-analytics"],                                 // line 50 — BUMP TO "student-analytics-v2"
  { revalidate: 60, tags: [studentAnalyticsTag(user.id)] },
);

// src/app/(dashboard)/student_diy/analytics/page.tsx lines 47-55 (CURRENT):
// IDENTICAL structure; same edit on line 50.
```

```tsx
// src/app/(dashboard)/student/analytics/AnalyticsClient.tsx lines 178-227 (CURRENT):
<section
  aria-label="Lifetime totals"
  className={cn(
    "grid grid-cols-2 sm:grid-cols-3 gap-4 motion-safe:animate-fadeIn",
    viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6",   // line 182 — SIMPLIFY
  )}
>
  <KpiCard icon={<Clock ... />} label="Total Hours" ... />
  {viewerRole !== "student_diy" && (                                      // line 198 — REMOVE guard
    <>
      <KpiCard
        icon={<Mail className="h-5 w-5" aria-hidden="true" />}
        label="Total Emails"                                              // line 202 — RENAME
        value={data.totals.total_emails.toLocaleString()}                 // line 203 — RENAME field
      />
      <KpiCard
        icon={<Users className="h-5 w-5" aria-hidden="true" />}
        label="Total Influencers"                                         // line 207 — RENAME
        value={data.totals.total_influencers.toLocaleString()}            // line 208 — RENAME field
      />
    </>
  )}
  <KpiCard icon={<Handshake ... />} label="Total Deals" ... />
  <KpiCard icon={<DollarSign ... />} label="Total Revenue" ... />
  <KpiCard icon={<TrendingUp ... />} label="Total Profit" ... />
</section>
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Bump unstable_cache key on both analytics pages</name>
  <files>src/app/(dashboard)/student/analytics/page.tsx, src/app/(dashboard)/student_diy/analytics/page.tsx</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md (locked decision: cache-key bump in SAME commit as migration; literal bump `["student-analytics"]` → `["student-analytics-v2"]`)
    - .planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md ("Pattern 2: Cache-key bump in same commit as RPC shape change" + "Example 2: `unstable_cache` key bump")
    - src/app/(dashboard)/student/analytics/page.tsx (lines 47-55 — the `unstable_cache` wrapper)
    - src/app/(dashboard)/student_diy/analytics/page.tsx (lines 47-55 — IDENTICAL wrapper; identical bump)
  </read_first>

  <action>
    Two file edits, both identical in content:

    1. In `src/app/(dashboard)/student/analytics/page.tsx`, change line 50 from:
       ```typescript
         ["student-analytics"],
       ```
       to:
       ```typescript
         ["student-analytics-v2"],
       ```

    2. In `src/app/(dashboard)/student_diy/analytics/page.tsx`, change line 50 from:
       ```typescript
         ["student-analytics"],
       ```
       to:
       ```typescript
         ["student-analytics-v2"],
       ```

    The literal MUST be IDENTICAL across both files (`"student-analytics-v2"`, no version drift, no per-route suffix). Do NOT change any other line in either file. Do NOT change the `revalidate: 60` TTL. Do NOT change the `tags: [studentAnalyticsTag(user.id)]` entry. Do NOT rename `studentAnalyticsTag` import. Do NOT touch the `requireRole` or `createAdminClient()` calls.
  </action>

  <verify>
    <automated>grep -c '"student-analytics-v2"' src/app/\(dashboard\)/student/analytics/page.tsx &amp;&amp; grep -c '"student-analytics-v2"' src/app/\(dashboard\)/student_diy/analytics/page.tsx &amp;&amp; ! grep -q '\["student-analytics"\]' src/app/\(dashboard\)/student/analytics/page.tsx &amp;&amp; ! grep -q '\["student-analytics"\]' src/app/\(dashboard\)/student_diy/analytics/page.tsx</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/(dashboard)/student/analytics/page.tsx` contains exact string `["student-analytics-v2"]` (≥1 match).
    - `src/app/(dashboard)/student_diy/analytics/page.tsx` contains exact string `["student-analytics-v2"]` (≥1 match).
    - `src/app/(dashboard)/student/analytics/page.tsx` does NOT contain the string `["student-analytics"]` (0 matches — the v1 literal must be gone).
    - `src/app/(dashboard)/student_diy/analytics/page.tsx` does NOT contain the string `["student-analytics"]` (0 matches).
    - The literal is IDENTICAL across both files (grep the same string `"student-analytics-v2"` and confirm both return ≥1).
    - `revalidate: 60` and `tags: [studentAnalyticsTag(user.id)]` still present on both files (run `grep "revalidate: 60" src/app/\(dashboard\)/student{,_diy}/analytics/page.tsx` — 2 hits).
    - Neither page.tsx imports any new modules; the existing imports (`unstable_cache`, `studentAnalyticsTag`, etc.) remain.
  </acceptance_criteria>

  <done>
    Both cache keys bumped to identical `"student-analytics-v2"` literal; both page.tsx files modified only at line 50; verification greps pass.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Rewrite AnalyticsClient KPI strip — rename 2 cards + remove DIY hide-guard + simplify grid className</name>
  <files>src/app/(dashboard)/student/analytics/AnalyticsClient.tsx</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md (locked decision D: SA-07 = SHOW the renamed cards to student_diy; remove hide-guard at AnalyticsClient.tsx:198; expand grid to unconditional lg:grid-cols-6)
    - .planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md ("Example 3: KPI strip after SA-07 resolve-as-SHOW" + "Pitfall 4: Grid column-count ternary left pointing to old (4-col) DIY layout")
    - src/app/(dashboard)/student/analytics/AnalyticsClient.tsx (ENTIRE file — need to confirm imports, KPI section boundaries, and that the outreach trend chart block at ~235-339 is NOT touched)
    - src/lib/rpc/student-analytics-types.ts (Plan 02 output — confirm StudentAnalyticsTotals now has total_brand_outreach + total_influencer_outreach)
  </read_first>

  <action>
    Edit `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx`. Make THREE surgical changes to the KPI strip section (currently lines 178-227 in the source). Do NOT touch anything outside this section.

    **Change 1 — Simplify grid className (line 180-183).** Current:
    ```tsx
          className={cn(
            "grid grid-cols-2 sm:grid-cols-3 gap-4 motion-safe:animate-fadeIn",
            viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6",
          )}
    ```
    Replace with:
    ```tsx
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"
    ```
    The `cn(...)` call is replaced with a single literal string because there is no longer a conditional. The `motion-safe:animate-fadeIn` class MUST be preserved (CLAUDE.md Hard Rule 1).

    **Change 2 — Remove the DIY hide-guard wrapper (lines 198 + 210-211).** Current block (lines 198-211):
    ```tsx
            {viewerRole !== "student_diy" && (
              <>
                <KpiCard
                  icon={<Mail className="h-5 w-5" aria-hidden="true" />}
                  label="Total Emails"
                  value={data.totals.total_emails.toLocaleString()}
                />
                <KpiCard
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  label="Total Influencers"
                  value={data.totals.total_influencers.toLocaleString()}
                />
              </>
            )}
    ```
    Replace with (Change 2 + Change 3 applied together):
    ```tsx
            <KpiCard
              icon={<Mail className="h-5 w-5" aria-hidden="true" />}
              label="Total Brand Outreach"
              value={data.totals.total_brand_outreach.toLocaleString()}
            />
            <KpiCard
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              label="Total Influencer Outreach"
              value={data.totals.total_influencer_outreach.toLocaleString()}
            />
    ```

    **Change 3 — (already applied inside Change 2 above):** Rename card labels + rename type-field references:
    - `label="Total Emails"` → `label="Total Brand Outreach"`
    - `data.totals.total_emails.toLocaleString()` → `data.totals.total_brand_outreach.toLocaleString()`
    - `label="Total Influencers"` → `label="Total Influencer Outreach"`
    - `data.totals.total_influencers.toLocaleString()` → `data.totals.total_influencer_outreach.toLocaleString()`

    **Icon choice (per RESEARCH discretion section):** KEEP current icons — `Mail` for "Total Brand Outreach" and `Users` for "Total Influencer Outreach". Do NOT change the `import { ... Mail, ... Users, ... } from "lucide-react"` block at lines 31-39. Do NOT swap to `Send` / `UserPlus`.

    **DO NOT MODIFY** (explicit out-of-scope per SA-08, SA-09, and research "Files that MUST NOT change"):
    - The outreach trend chart block at approx lines 235-339 (reads `data.outreach_trend[].brands` / `.influencers`; DIFFERENT path — SA-08).
    - The hours trend chart, deal table, deal pagination, or roadmap section.
    - The imports at lines 1-59 (DO NOT remove `cn` import — it may be used elsewhere in the file; only the `cn(...)` call inside the KPI grid className is replaced; run `grep "cn(" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` to verify `cn` is still imported AND used elsewhere, OR to confirm it is safe to remove. If after the edit `cn(` appears ZERO times in the file, REMOVE the `cn` import from line 50; if it appears ≥1 times elsewhere, leave the import.).
    - The `viewerRole` prop signature on `AnalyticsClientProps`; `viewerRole` is still used by other branches in the file (e.g., the outreach trend chart labels or pagination logic — the executor should grep `viewerRole` across the file; only the two usages in the KPI strip are removed by this edit).

    After these three changes, the KPI strip section should render 6 `<KpiCard>` siblings directly as children of the `<section>`: Total Hours, Total Brand Outreach, Total Influencer Outreach, Total Deals, Total Revenue, Total Profit — with NO fragment wrapper and NO conditional guard around any of them.
  </action>

  <verify>
    <automated>grep -c "Total Brand Outreach" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; grep -c "Total Influencer Outreach" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; grep -c "data\.totals\.total_brand_outreach" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; grep -c "data\.totals\.total_influencer_outreach" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; ! grep -q "Total Emails" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; ! grep -q "Total Influencers" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; ! grep -q 'viewerRole !== "student_diy"' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; ! grep -q "lg:grid-cols-4" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; grep -q "lg:grid-cols-6" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx &amp;&amp; npx tsc --noEmit</automated>
  </verify>

  <acceptance_criteria>
    - `AnalyticsClient.tsx` contains exact string `Total Brand Outreach` (≥1 match — the new KpiCard label).
    - `AnalyticsClient.tsx` contains exact string `Total Influencer Outreach` (≥1 match).
    - `AnalyticsClient.tsx` contains exact string `data.totals.total_brand_outreach` (≥1 match — the new field access).
    - `AnalyticsClient.tsx` contains exact string `data.totals.total_influencer_outreach` (≥1 match).
    - `AnalyticsClient.tsx` does NOT contain the string `Total Emails` (0 matches — old label removed).
    - `AnalyticsClient.tsx` does NOT contain the string `Total Influencers` (0 matches — old label removed).
    - `AnalyticsClient.tsx` does NOT contain the string `data.totals.total_emails` (0 matches).
    - `AnalyticsClient.tsx` does NOT contain the string `data.totals.total_influencers` (0 matches — note: `data.totals.total_influencer_outreach` contains `data.totals.total_influencer` as prefix but NOT `data.totals.total_influencers` with trailing `s`; grep the exact quoted string).
    - `AnalyticsClient.tsx` does NOT contain the string `viewerRole !== "student_diy"` (0 matches — hide-guard removed; SA-07 = SHOW).
    - `AnalyticsClient.tsx` does NOT contain the string `lg:grid-cols-4` (0 matches — grid is now unconditional 6-col at lg).
    - `AnalyticsClient.tsx` contains exact string `lg:grid-cols-6` (≥1 match — unconditional 6-col class).
    - `AnalyticsClient.tsx` contains exact string `motion-safe:animate-fadeIn` (≥1 match — CLAUDE Hard Rule 1 preserved on the grid className).
    - Icon imports `Mail` and `Users` still present in the `lucide-react` import block (grep `"^  Mail,$\|^  Users,$" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` returns 2 hits, or inspect lines 31-39 manually).
    - `npx tsc --noEmit` exits 0 with zero errors and zero warnings (this is the critical plan gate — Plan 02 left tsc broken at lines 203/208 of this file; this task closes that).
    - Outreach trend chart block (search `data.outreach_trend` across the file) still present with 0 modifications to that block's contents (SA-08 regression invariant — grep `data\.outreach_trend` returns the same count of hits as before the edit).
    - Daily report form files (`src/app/api/reports/route.ts`) NOT modified by this task (SA-09 invariant).
    - No `as any` / `as unknown` cast added near `totals` in this file (grep `as any\|as unknown` in the KPI strip region — 0 matches; the type flows cleanly).
  </acceptance_criteria>

  <done>
    AnalyticsClient KPI strip renders 6 unconditional cards with the 2 renamed labels; DIY hide-guard removed; grid simplified to `lg:grid-cols-6`; outreach trend chart untouched; `npx tsc --noEmit` exits 0.
  </done>
</task>

</tasks>

<verification>
Plan-level verification (run after BOTH tasks):
- `grep -c "Total Brand Outreach\|Total Influencer Outreach" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` ≥ 2
- `grep "student-analytics-v2" src/app/\(dashboard\)/student{,_diy}/analytics/page.tsx` returns 2 hits (one per file)
- `grep -rn 'total_emails\b\|total_influencers\b' src/` returns 0 hits for these two identifiers (the broader regex may still match `total_influencers_contacted` in `src/lib/types.ts` — that is a DIFFERENT identifier on the `student_kpi_summaries` table, NOT a violation; use `\b` word boundary and confirm only non-matches are unrelated)
- `grep -c 'viewerRole !== "student_diy"' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` = 0
- `grep -c "lg:grid-cols-4" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` = 0
- `npx tsc --noEmit` exits 0.
</verification>

<success_criteria>
All 3 consumer-side files updated; cache keys bumped identically on both routes; AnalyticsClient renders 6 KPI cards unconditionally with correct labels and field accesses; tsc is green. Phase is ready for final build gate in Plan 04.
</success_criteria>

<output>
After completion, create `.planning/phases/61-student-analytics-re-split-f1/61-03-SUMMARY.md` with: 3 files modified with before/after snippet per file, the final `npx tsc --noEmit` exit code, and a note "Plan 04 runs the full build gate (lint + tsc + build)."
</output>
