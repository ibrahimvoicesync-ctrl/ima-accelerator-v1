---
phase: 61
plan: 02
type: execute
wave: 2
depends_on:
  - 61-01
files_modified:
  - src/lib/rpc/student-analytics-types.ts
autonomous: true
requirements:
  - SA-04
must_haves:
  truths:
    - "StudentAnalyticsTotals type at src/lib/rpc/student-analytics-types.ts mirrors the new migration 00033 jsonb shape"
    - "Type has total_brand_outreach: number + total_influencer_outreach: number; does NOT have total_emails or total_influencers"
    - "npx tsc --noEmit fails at EXACTLY TWO known consumer lines (AnalyticsClient.tsx:203 and AnalyticsClient.tsx:208) after this plan — and ONLY those two sites; this is the intended breaking signal for Plan 03"
  artifacts:
    - path: "src/lib/rpc/student-analytics-types.ts"
      provides: "Updated StudentAnalyticsTotals type contract"
      contains: "total_brand_outreach"
  key_links:
    - from: "src/lib/rpc/student-analytics-types.ts:20-27"
      to: "AnalyticsClient.tsx:203, :208 (consumers of .total_emails / .total_influencers)"
      via: "tsc --noEmit compile-time error"
      pattern: "Property 'total_emails' does not exist on type 'StudentAnalyticsTotals'"
---

<objective>
Rename two fields on the `StudentAnalyticsTotals` type at `src/lib/rpc/student-analytics-types.ts` in place — `total_emails` → `total_brand_outreach` and `total_influencers` → `total_influencer_outreach` — so the TypeScript contract mirrors the renamed jsonb keys emitted by migration 00033.

Purpose: `tsc --noEmit` becomes the authoritative stale-consumer detector. Per CONTEXT.md locked decisions, NO back-compat alias is introduced; breaking the type IS the safety mechanism.

Output: Single type-file edit. After this plan, `npx tsc --noEmit` must fail at EXACTLY two lines in AnalyticsClient.tsx (203, 208) — this is the INTENDED signal for Plan 03.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md
@.planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md
@src/lib/rpc/student-analytics-types.ts
@.planning/phases/61-student-analytics-re-split-f1/61-01-SUMMARY.md
</context>

<interfaces>
<!-- Type being edited at src/lib/rpc/student-analytics-types.ts lines 20-27: -->

```typescript
// BEFORE (current, lines 20-27):
export type StudentAnalyticsTotals = {
  total_hours: number;
  total_emails: number;        // line 22 — REMOVE
  total_influencers: number;   // line 23 — REMOVE
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};

// AFTER (target shape):
export type StudentAnalyticsTotals = {
  total_hours: number;
  total_brand_outreach: number;       // was total_emails
  total_influencer_outreach: number;  // was total_influencers
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};
```

<!-- Consumer sites that WILL fail tsc after this edit (expected, fixed in Plan 03): -->
<!-- src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203 — data.totals.total_emails.toLocaleString() -->
<!-- src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:208 — data.totals.total_influencers.toLocaleString() -->
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rename StudentAnalyticsTotals fields in place</name>
  <files>src/lib/rpc/student-analytics-types.ts</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md (locked decision: in-place rename, no V1 alias, no optional fields)
    - .planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md ("Pattern 3: In-place type rename + breaking-change discipline" section; "Consumer Enumeration — Complete File:Line List" section)
    - src/lib/rpc/student-analytics-types.ts (current type definition — read entire file, 89 lines; only lines 20-27 change)
  </read_first>

  <action>
    Edit `src/lib/rpc/student-analytics-types.ts`. Make EXACTLY TWO field-level changes inside the `StudentAnalyticsTotals` type definition (currently lines 20-27):

    1. Line 22 currently reads:
       ```typescript
         total_emails: number;
       ```
       Replace with:
       ```typescript
         total_brand_outreach: number;
       ```

    2. Line 23 currently reads:
       ```typescript
         total_influencers: number;
       ```
       Replace with:
       ```typescript
         total_influencer_outreach: number;
       ```

    Do NOT touch any other line of the file. Do NOT make the fields optional (`?:`). Do NOT introduce a `StudentAnalyticsTotalsV1` alias. Do NOT add a union type that bridges old/new. Do NOT export a compat-shim type. Do NOT add a JSDoc `@deprecated` tag on anything — the old fields are REMOVED, not deprecated. Do NOT reorder fields (keep them in their current positions between `total_hours` and `total_deals`).

    After this edit the export stays:
    ```typescript
    export type StudentAnalyticsTotals = {
      total_hours: number;
      total_brand_outreach: number;
      total_influencer_outreach: number;
      total_deals: number;
      total_revenue: number;
      total_profit: number;
    };
    ```

    Preserve the file header comment block (lines 1-7). Preserve `STUDENT_ANALYTICS_PAGE_SIZE` constant, `StudentAnalyticsRange` type, `STUDENT_ANALYTICS_RANGES` array, `OutreachBucket`, `HoursBucket`, `LoggerRole`, `DealRow`, `DealSummary`, `RoadmapProgressRow`, `StudentAnalyticsPayload`, and `studentAnalyticsTag()` function — all untouched.
  </action>

  <verify>
    <automated>grep -c "total_brand_outreach: number;" src/lib/rpc/student-analytics-types.ts &amp;&amp; grep -c "total_influencer_outreach: number;" src/lib/rpc/student-analytics-types.ts &amp;&amp; ! grep -q "total_emails: number;" src/lib/rpc/student-analytics-types.ts &amp;&amp; ! grep -q "total_influencers: number;" src/lib/rpc/student-analytics-types.ts</automated>
  </verify>

  <acceptance_criteria>
    - File `src/lib/rpc/student-analytics-types.ts` contains exact string `total_brand_outreach: number;` (≥1 match).
    - File contains exact string `total_influencer_outreach: number;` (≥1 match).
    - File does NOT contain the string `total_emails: number;` (0 matches).
    - File does NOT contain the string `total_influencers: number;` (0 matches — note `total_influencer_outreach` would match a loose regex for `total_influencer`, so the exact literal `total_influencers:` with `s:` boundary must be absent).
    - The `StudentAnalyticsTotals` export is still a single named `type` alias (not an `interface`, not a union).
    - Fields remain in the order: `total_hours`, `total_brand_outreach`, `total_influencer_outreach`, `total_deals`, `total_revenue`, `total_profit`.
    - `grep -n "StudentAnalyticsTotals" src/lib/rpc/student-analytics-types.ts` still returns ≥1 match on the `export type StudentAnalyticsTotals` line.
    - No new exports added; no exports removed.
    - After this edit, `npx tsc --noEmit` is EXPECTED to fail at exactly 2 lines in `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` (lines 203 and 208 referencing `total_emails` / `total_influencers`). This is the INTENDED breaking signal; it will be resolved in Plan 03. Do NOT run tsc as a go/no-go gate for this plan.
    - Grep audit outside the type file is informational: `grep -rn "total_emails\|total_influencers" src/` should show the 2 known consumer hits at `AnalyticsClient.tsx:203, :208` plus `src/lib/types.ts` hits for the unrelated `total_influencers_contacted` column (different identifier; do not touch).
  </acceptance_criteria>

  <done>
    Type file updated with exactly the two field renames; no other files touched in this plan; `grep` acceptance_criteria pass; Plan 03 is now unblocked to fix the 2 known consumer breakpoints.
  </done>
</task>

</tasks>

<verification>
Plan-level verification:
- `grep -n "total_brand_outreach\|total_influencer_outreach" src/lib/rpc/student-analytics-types.ts` returns 2 hits (one per line 22, 23 after edit).
- `grep -n "total_emails\|total_influencers:" src/lib/rpc/student-analytics-types.ts` returns 0 hits.
- No other file modified by this plan.
- `npx tsc --noEmit` is EXPECTED TO FAIL at exactly `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203` and `:208` — this is the INTENDED signal for Plan 03. Do not treat it as a failure of this plan.
</verification>

<success_criteria>
Type rename complete; 2 known consumer sites (AnalyticsClient.tsx:203, :208) now error at compile time — exactly as designed. Plan 03 will fix those consumer sites.
</success_criteria>

<output>
After completion, create `.planning/phases/61-student-analytics-re-split-f1/61-02-SUMMARY.md` with: file modified, field rename diff, and explicit note "tsc now fails at AnalyticsClient.tsx:203 and :208 — intended; Plan 03 will fix."
</output>
