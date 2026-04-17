---
phase: 61
plan: 04
type: execute
wave: 4
depends_on:
  - 61-03
files_modified: []
autonomous: false
requirements:
  - SA-08
  - SA-09
must_haves:
  truths:
    - "npm run lint exits 0 with zero errors and zero warnings"
    - "npx tsc --noEmit exits 0 with zero errors"
    - "npm run build exits 0 with zero errors and zero warnings"
    - "Outreach trend chart on /student/analytics still splits brand vs influencer series (SA-08 regression visual confirm)"
    - "Daily report form still collects brands_contacted + influencers_contacted as separate integers (SA-09 regression visual confirm)"
    - "Logged-in as student_diy, /student_diy/analytics renders exactly 6 KPI cards with Total Brand Outreach + Total Influencer Outreach visible at lg: breakpoint without column overflow (SA-07 human verify)"
  artifacts:
    - path: "(none — this plan is a verification gate; no new files)"
      provides: "Confirmation the phase is ship-ready"
  key_links:
    - from: "npm run lint && npx tsc --noEmit && npm run build"
      to: "all prior plan deliverables (migration 00033 + type rename + consumer rewrite)"
      via: "post-phase gate per CLAUDE.md + STATE.md"
      pattern: "exit code 0"
---

<objective>
Run the full CLAUDE.md post-phase gate (`npm run lint && npx tsc --noEmit && npm run build`) AND a human-verification checkpoint covering the three visual regressions listed in the Phase 61 success criteria: outreach trend chart unchanged (SA-08), daily report form unchanged (SA-09), and DIY student sees the 6 KPI cards without layout overflow (SA-07 = SHOW).

Purpose: Final gate before `/gsd-verify-work`. Catches any regression introduced by Plans 01-03 that grep-level acceptance criteria missed (e.g., a missing import, an unused-variable lint warning from the removed `viewerRole` branch, a Next.js 16 `unstable_cache` signature drift).

Output: Build gate green + 3 human confirmations. No code modified by this plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/61-student-analytics-re-split-f1/61-CONTEXT.md
@.planning/phases/61-student-analytics-re-split-f1/61-RESEARCH.md
@.planning/phases/61-student-analytics-re-split-f1/61-VALIDATION.md
@.planning/phases/61-student-analytics-re-split-f1/61-01-SUMMARY.md
@.planning/phases/61-student-analytics-re-split-f1/61-02-SUMMARY.md
@.planning/phases/61-student-analytics-re-split-f1/61-03-SUMMARY.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Run post-phase build gate + grep-audit final invariants</name>
  <files>(no files modified)</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-03-SUMMARY.md (confirm all 3 consumer files were updated per Plan 03)
    - CLAUDE.md (Hard Rules 1-8; post-phase gate command `npm run lint && npx tsc --noEmit && npm run build`)
    - .planning/STATE.md (post-phase gate mandate in "Critical Constraints Carried Into v1.8")
  </read_first>

  <action>
    Run the following commands in order. Each must exit with code 0 before proceeding to the next. If any fails, STOP and surface the error output; do NOT attempt to auto-fix (that is the executor's responsibility in a revision round).

    1. `npm run lint`  — expected: exits 0 with zero errors and zero warnings. If ESLint flags an unused `viewerRole` import or `cn` import in `AnalyticsClient.tsx`, THAT is a Plan 03 regression and should be reported, not silenced.

    2. `npx tsc --noEmit`  — expected: exits 0. Should produce zero output. If it emits errors citing `total_emails` or `total_influencers`, a consumer was missed in Plan 03; report the file:line and STOP.

    3. `npm run build`  — expected: exits 0. This exercises Next.js's static-analysis + Supabase-generated types + `unstable_cache` signature + all route segments. Should complete with zero errors and zero warnings (Next.js 16 will warn loudly on `unstable_cache` misuse).

    4. Run the phase-level grep audit (all must pass):
       - `grep -rn 'total_emails\b' src/` returns 0 hits (word-boundary `\b` excludes `total_emails_v1` or similar false positives).
       - `grep -rn 'total_influencers\b' src/` returns 0 hits (the `total_influencers_contacted` column on `student_kpi_summaries` is a DIFFERENT identifier and is correctly excluded by `\b` because the next char is `_`, not end-of-word).
       - `grep -rn "'total_emails'\|'total_influencers'" supabase/migrations/00033_*.sql` returns 0 hits (migration has only the new quoted keys).
       - `grep "student-analytics-v2" src/app/\(dashboard\)/student/analytics/page.tsx src/app/\(dashboard\)/student_diy/analytics/page.tsx` returns 2 hits (one per file).
       - `grep -c 'viewerRole !== "student_diy"' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` returns 0.

    5. Capture the successful exit codes and output sizes and forward them to the SUMMARY.
  </action>

  <verify>
    <automated>npm run lint &amp;&amp; npx tsc --noEmit &amp;&amp; npm run build</automated>
  </verify>

  <acceptance_criteria>
    - `npm run lint` exits 0 with zero errors and zero warnings.
    - `npx tsc --noEmit` exits 0 with zero output.
    - `npm run build` exits 0 with zero errors and zero warnings.
    - `grep -rn 'total_emails\b' src/` returns 0 hits.
    - `grep -rn 'total_influencers\b' src/` returns 0 hits (remember `total_influencers_contacted` on `student_kpi_summaries` is a DIFFERENT identifier on a DIFFERENT table — word boundary `\b` distinguishes them correctly).
    - Migration file `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` unchanged since Plan 01 (no edits since its creation).
    - Both page.tsx cache literals still equal `"student-analytics-v2"` (no drift).
    - AnalyticsClient.tsx still contains `Total Brand Outreach` + `Total Influencer Outreach` labels.
  </acceptance_criteria>

  <done>
    Build gate green; grep audits pass; zero code modified in this task; ready for the human-verification checkpoint below.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human-verify SA-01/SA-02/SA-07/SA-08/SA-09 on running app</name>
  <files>(no files modified — human browser + psql verification)</files>

  <read_first>
    - .planning/phases/61-student-analytics-re-split-f1/61-01-SUMMARY.md (Plan 01 migration details)
    - .planning/phases/61-student-analytics-re-split-f1/61-02-SUMMARY.md (Plan 02 type rename)
    - .planning/phases/61-student-analytics-re-split-f1/61-03-SUMMARY.md (Plan 03 consumer rewrite)
    - .planning/phases/61-student-analytics-re-split-f1/61-VALIDATION.md (Manual-Only Verifications table)
  </read_first>

  <action>
    This is a human-verification checkpoint. Claude pauses; the user performs the 5 checks listed in the `<how-to-verify>` block below, applies migration 00033 to the local Supabase DB, then types "approved" or describes any failing check.

    The checks cover the five manual regressions that grep + tsc + build cannot catch:
    1. SQL shape of the RPC `totals` payload (SA-03).
    2. `/student/analytics` KPI strip visual + value correctness (SA-01 + SA-02).
    3. `/student_diy/analytics` shows 6 cards without overflow at `lg:` breakpoint (SA-07).
    4. Outreach trend chart still splits brand vs influencer series (SA-08).
    5. Daily report form still has two separate integer fields (SA-09).
  </action>

  <what-built>
    Plans 01-03 delivered:
    - Migration 00033 drops + recreates `get_student_analytics` with `total_brand_outreach` + `total_influencer_outreach` in the `totals` jsonb payload (removes `total_emails` / `total_influencers`).
    - `StudentAnalyticsTotals` type updated to mirror the new shape.
    - Both analytics routes (`/student/analytics` and `/student_diy/analytics`) bumped their `unstable_cache` keys to `["student-analytics-v2"]` in the same commit as the migration.
    - `AnalyticsClient.tsx` now renders 6 unconditional `<KpiCard>` items: Total Hours, Total Brand Outreach, Total Influencer Outreach, Total Deals, Total Revenue, Total Profit. The DIY hide-guard was removed (SA-07 = SHOW per CONTEXT D-01). Grid is unconditional `lg:grid-cols-6`.

    Task 1 above already confirmed lint + tsc + build are green and the grep-level invariants hold. This checkpoint covers the five runtime/visual regressions that grep cannot catch.
  </what-built>

  <how-to-verify>
    Apply migration 00033 to your local Supabase (`supabase db push` or `supabase migration up` — whichever your project uses). Then:

    1. **SA-03 / SA-07 post-migration SQL shape assert.** Run against the DB:
       ```
       psql -c "SELECT jsonb_object_keys((public.get_student_analytics((SELECT id FROM users WHERE role='student' LIMIT 1), '30d', 1, 25))->'totals');"
       ```
       Expected output: exactly these 6 keys in some order — `total_hours`, `total_brand_outreach`, `total_influencer_outreach`, `total_deals`, `total_revenue`, `total_profit`. MUST NOT contain `total_emails` or `total_influencers`. Also verify exactly one overload exists:
       ```
       psql -c "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_student_analytics';"
       ```
       Expected: `1`.

    2. **SA-01 / SA-02 / SA-07 student UI render.** `npm run dev`. Log in as any user with `role='student'` (pick one with existing `daily_reports` rows so SUMs are non-zero). Navigate to `http://localhost:3000/student/analytics`. Confirm the KPI strip shows 6 cards in this order at the `lg:` breakpoint (≥1024px viewport): Total Hours, Total Brand Outreach, Total Influencer Outreach, Total Deals, Total Revenue, Total Profit. Spot-check: "Total Brand Outreach" value should equal the sum of `brands_contacted` across that student's `daily_reports` (verify with a one-off `psql -c "SELECT SUM(COALESCE(brands_contacted,0)) FROM daily_reports WHERE student_id='<uuid>' AND submitted_at IS NOT NULL;"`) and likewise for influencers. Neither card should equal `brands + influencers` combined.

    3. **SA-07 DIY UI render (no overflow).** Log out, log back in as a user with `role='student_diy'`. Navigate to `http://localhost:3000/student_diy/analytics`. Confirm the SAME six cards render visibly — DIY user is no longer missing the outreach cards. At a 1024px viewport the grid should fit 6 columns without wrapping or horizontal overflow.

    4. **SA-08 outreach trend chart regression.** Back on `/student/analytics`, scroll past the KPI strip to the outreach trend chart. Confirm the chart still plots two series (brand + influencer) as separate lines/bars. The chart reads a different data path (`data.outreach_trend[].brands` / `.influencers`) and should be visually identical to pre-Phase-61.

    5. **SA-09 daily report form regression.** Navigate to the student's daily report submission page (path varies — likely `/student/report` or equivalent; check the student-side navigation). Confirm the form still collects `brands_contacted` and `influencers_contacted` as two separate integer inputs. No schema change expected.

    If any check fails, describe the failure (which check, observed vs expected, a screenshot if it's a layout issue). Otherwise, approve.
  </how-to-verify>

  <verify>
    <automated>MANUAL — human-verify checkpoint; no automated gate. Task 1 above covers all automatable gates (lint + tsc + build + greps). SQL shape check runs in psql against local Supabase (requires DB access and applied migration).</automated>
  </verify>

  <acceptance_criteria>
    - Human tester types "approved" after running all 5 checks.
    - Check 1 (SQL shape): `jsonb_object_keys` output contains `total_brand_outreach` + `total_influencer_outreach`, does NOT contain `total_emails` or `total_influencers`; `pg_proc` count = 1.
    - Check 2 (student UI): 6 KPI cards visible with correct labels; "Total Brand Outreach" value matches `SUM(brands_contacted)` for the test student; "Total Influencer Outreach" value matches `SUM(influencers_contacted)`.
    - Check 3 (DIY UI): 6 KPI cards visible at ≥1024px without wrap/overflow.
    - Check 4 (trend chart): two series (brand + influencer) still plotted; chart visually unchanged from pre-Phase-61.
    - Check 5 (daily report form): form unchanged, still two separate integer inputs.
  </acceptance_criteria>

  <resume-signal>Type "approved" if all 5 checks pass, or describe the failing check(s).</resume-signal>

  <done>
    Human tester approved all 5 checks; Phase 61 is ship-ready and can proceed to `/gsd-verify-work`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser client → Next.js server component (SSR) | Untrusted query params (`?range=`, `?page=`) cross here; Zod schemas re-validate before hitting the RPC |
| Next.js server → Supabase RPC (SECURITY DEFINER) | Admin-client invocation; RPC has its own `v_caller = p_student_id` auth guard as a second layer |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-61-01 | Information Disclosure | `get_student_analytics` RPC | mitigate | Existing `v_caller IS DISTINCT FROM p_student_id → RAISE EXCEPTION 'not_authorized'` guard preserved verbatim in migration 00033; Plan 01 action text mandates "copy body VERBATIM from 00023" for every section except `v_totals` jsonb_build_object |
| T-61-02 | Denial of Service | PGRST203 dual-overload dispatch on `get_student_analytics` | mitigate | Defensive `DO $drop$` loop over `pg_proc` + `DROP FUNCTION ... (identity_args) CASCADE` + post-migration `DO $assert$` that raises if COUNT(*) ≠ 1 (Plan 01 acceptance criteria enforces all three) |
| T-61-03 | Availability | SSR crash on stale `unstable_cache` during 60s TTL rollover after breaking jsonb shape | mitigate | Cache-key literal bump `["student-analytics"]` → `["student-analytics-v2"]` on both `/student/analytics` and `/student_diy/analytics` page.tsx files, in same commit as migration 00033 (Plan 03 Task 1 enforces identical bump on both files) |
| T-61-04 | Tampering | SQL injection via `p_range` text param | accept | Existing defense preserved: `p_range IN ('7d','30d','90d','all')` plpgsql check + Zod `z.enum(STUDENT_ANALYTICS_RANGES).catch("30d")` at both page.tsx entry points; Phase 61 does not change args |
| T-61-05 | Spoofing | Cross-user analytics read via cache-key collision | mitigate | `studentAnalyticsTag(user.id)` per-user tag + per-invocation args include `studentId`; cache entries keyed on (key + args) so two different users have disjoint cache namespaces — preserved verbatim; only the literal string in the key array changes |
</threat_model>

<verification>
- `npm run lint && npx tsc --noEmit && npm run build` exits 0.
- All 5 human-verification checks pass.
- `git diff --stat` shows the expected file set: 1 new migration + 2 modified pages + 1 modified type + 1 modified client (AnalyticsClient) = 4 modified / 1 new.
- No files modified outside the expected set (in particular: `src/app/api/reports/route.ts`, `src/lib/types.ts`, outreach trend chart block, and daily report form all unchanged — satisfies SA-08 + SA-09 invariants).
</verification>

<success_criteria>
Phase 61 ship-ready: all 9 requirements (SA-01..09) satisfied; build gate green; human-verified on both `/student/analytics` and `/student_diy/analytics`; migration post-assert passes with exactly 1 overload; tsc caught zero stale consumers (none remain). Ready to hand off to `/gsd-verify-work`.
</success_criteria>

<output>
After completion, create `.planning/phases/61-student-analytics-re-split-f1/61-04-SUMMARY.md` with: build-gate exit codes, `jsonb_object_keys` output from the post-migration psql check, pg_proc count, and the human-verifier's "approved" statement (or the failure description if re-work is needed). Also note the final `git diff --stat` output for the phase.
</output>
