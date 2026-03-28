---
phase: 16-coach-owner-kpi-visibility
verified: 2026-03-28T11:00:00Z
status: human_needed
score: 12/12 must-haves verified
re_verification: true
previous_status: human_needed
previous_score: 7/7
gaps_closed:
  - "DB CHECK constraint expanded from BETWEEN 1 AND 10 to BETWEEN 1 AND 15 (migration 00008)"
  - "Existing students backfilled with steps 11-15 as locked via ON CONFLICT DO NOTHING"
  - "seed.sql updated to 75 rows (5 students x 15 steps) with config-matching step names"
  - "Lazy seeding is now additive (upsert with ignoreDuplicates, no DELETE)"
  - "All hardcoded '10 steps' strings replaced with ROADMAP_STEPS.length"
  - "Loading skeleton uses ROADMAP_STEPS.length instead of hardcoded 10"
gaps_remaining: []
regressions: []
human_verification:
  - test: "Visual: Coach student detail page renders KPI card between header and tabs"
    expected: "A Card appears between the student header and the tab bar showing Lifetime Outreach X / 2,500, Daily Outreach X / 50, Hours Worked Xh Xm / 4h, Current Step: Stage N: StageName — StepTitle, with RAG color dots on the first 3 items"
    why_human: "JSX render path verified programmatically; actual pixel-level rendering and RAG dot visibility require browser"
  - test: "Visual: Owner student detail page renders identical KPI card"
    expected: "Same KPI card layout appears between the student info header block and the tab bar on the owner view"
    why_human: "Both pages are wired identically in code; visual confirmation needed to satisfy VIS-01/VIS-02 acceptance"
  - test: "RAG colors match student ProgressBanner for the same student"
    expected: "Opening the same student's dashboard as the student shows matching RAG dot colors as the coach/owner KPI card"
    why_human: "Code uses the same kpi.ts functions (lifetimeOutreachRag, dailyOutreachRag, dailyHoursRag) — correctness is structural; cross-role visual match needs human check"
  - test: "Correct roadmap step shown after DB migration applied"
    expected: "A student at step 7 should show 'Stage 2: Influencer Outreach — Follow Up' (or whichever step 7 is in the 15-step config) on coach/owner KPI card. No more 'no roadmap progress' or wrong step display."
    why_human: "UAT issue 4 was diagnosed as DB constraint + destructive seeding. Migration 00008 and plan 04 fix the root cause in code. Requires a live re-run with a student account to confirm the fix is effective end-to-end."
---

# Phase 16: Coach/Owner KPI Visibility Verification Report

**Phase Goal:** Coaches and owners can see each student's KPI progress and RAG status on the student detail page without needing to navigate elsewhere
**Verified:** 2026-03-28
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 16-03 and 16-04)

## Re-Verification Context

The previous VERIFICATION.md (also dated 2026-03-28) confirmed 7/7 truths for the KPI visibility feature (plans 16-01 and 16-02) but carried `status: human_needed` pending browser render checks.

UAT then surfaced one major issue (test 4): the roadmap step displayed incorrectly — sometimes showing "no roadmap progress" or "Stage 1" for a student at stage 7. Root cause: the DB CHECK constraint capped step_number at 10, causing destructive lazy seeding to fail for steps 11-15, which then wiped existing progress rows.

Plans 16-03 and 16-04 were authored as gap closure. This re-verification covers those plans in addition to doing a regression check on the original 7 truths.

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                    | Status     | Evidence                                                                                            |
|----|------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------|
| 1  | ROADMAP_STEPS config has 15 steps across 3 named stages                                  | VERIFIED   | config.ts: 15 entries, each with stage (1/2/3) and stageName fields                               |
| 2  | KpiItem is importable from ProgressBanner.tsx by external modules                        | VERIFIED   | ProgressBanner.tsx line 23: `export function KpiItem(` — named export, unchanged from plan 01      |
| 3  | StudentKpiSummary renders 3 RAG-coded KPIs plus current roadmap step                     | VERIFIED   | StudentKpiSummary.tsx: 3 KpiItem with ragStatus props + step display; uses kpi.ts RAG functions     |
| 4  | Coach student detail page shows read-only KPI summary with correct targets and RAG       | VERIFIED   | Coach page.tsx: KPI queries in Promise.all; scalars computed; kpiData prop passed to StudentDetailClient; StudentDetailClient renders StudentKpiSummary |
| 5  | Owner student detail page shows identical read-only KPI summary                          | VERIFIED   | Owner page.tsx: identical KPI query pattern; same scalar computation; OwnerStudentDetailClient renders StudentKpiSummary |
| 6  | KPI card shows current roadmap step in Stage+Step format                                 | VERIFIED   | StudentKpiSummary.tsx: `` `Stage ${step.stage}: ${step.stageName} — ${step.title}` ``              |
| 7  | RAG colors on coach/owner views use identical kpi.ts functions as student view           | VERIFIED   | StudentKpiSummary.tsx imports same lifetimeOutreachRag/dailyOutreachRag/dailyHoursRag as ProgressBanner |
| 8  | DB CHECK constraint allows steps 1-15 (not capped at 10)                                 | VERIFIED   | migration 00008 line 15: `CHECK (step_number BETWEEN 1 AND 15)`; drops old constraint first        |
| 9  | Existing students have steps 11-15 backfilled as locked                                  | VERIFIED   | migration 00008 lines 24-49: INSERT...SELECT CROSS JOIN steps 11-15, ON CONFLICT DO NOTHING        |
| 10 | seed.sql has 75 roadmap_progress rows matching ROADMAP_STEPS config titles               | VERIFIED   | seed.sql lines 167-259: 5 students x 15 rows each; step names match config exactly                |
| 11 | Lazy seeding is additive (upsert, no DELETE)                                             | VERIFIED   | roadmap/page.tsx lines 29-58: existingSteps diff + upsert with ignoreDuplicates; no .delete() in file |
| 12 | All hardcoded "10 steps" strings replaced with ROADMAP_STEPS.length                      | VERIFIED   | student/page.tsx line 261: `{ROADMAP_STEPS.length}-step program journey`; roadmap/page.tsx line 70: template literal; loading.tsx line 30: `Array.from({ length: ROADMAP_STEPS.length })` |

**Score:** 12/12 truths verified (automated). Visual rendering and end-to-end step display correctness pend human check.

---

### Required Artifacts

| Artifact                                                                    | Expected                                                              | Status   | Details                                                                                                      |
|-----------------------------------------------------------------------------|-----------------------------------------------------------------------|----------|--------------------------------------------------------------------------------------------------------------|
| `src/lib/config.ts`                                                         | 15-step ROADMAP_STEPS with stage/stageName fields                     | VERIFIED | 15 entries, stage 1-3, stageName per stage, 15-steps comment                                                |
| `src/components/student/ProgressBanner.tsx`                                 | Exported KpiItem subcomponent                                         | VERIFIED | Line 23: `export function KpiItem(` — named export                                                          |
| `src/components/student/StudentKpiSummary.tsx`                              | Read-only KPI card for coach/owner views                              | VERIFIED | 83 lines; no "use client"; Card+KpiItem; 3 RAG KPIs + step display                                         |
| `src/app/(dashboard)/coach/students/[studentId]/page.tsx`                  | KPI data queries in Promise.all + computed scalars                    | VERIFIED | Lines 38-74: 6-query Promise.all with brands_contacted/influencers_contacted queries                        |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx`                  | KPI data queries in Promise.all + computed scalars                    | VERIFIED | Lines 38-86: 8-query Promise.all with KPI queries at positions 6/7/8                                       |
| `src/components/coach/StudentDetailClient.tsx`                             | StudentKpiSummary rendered between header and tabs                    | VERIFIED | Line 9: import; lines 80-86: StudentKpiSummary between StudentHeader and StudentDetailTabs                  |
| `src/components/owner/OwnerStudentDetailClient.tsx`                        | StudentKpiSummary rendered between header and tabs                    | VERIFIED | Line 14: import; lines 199-205: StudentKpiSummary after header block, before tabs                           |
| `supabase/migrations/00008_expand_roadmap_to_15_steps.sql`                 | Expand CHECK constraint to 15, backfill steps 11-15, update step names | VERIFIED | All 3 sections present: DROP/ADD constraint, INSERT backfill ON CONFLICT, 10 UPDATE statements for step names |
| `supabase/seed.sql`                                                         | 75 roadmap_progress rows, 5 students x 15 steps, config-matching names | VERIFIED | Lines 167-259: 5 per-student INSERT blocks each with 15 rows; step_names match config exactly               |
| `src/app/(dashboard)/student/roadmap/page.tsx`                             | Additive upsert seeding, no DELETE, ROADMAP_STEPS.length subtitle     | VERIFIED | Lines 29-58: existingSteps diff + upsert onConflict/ignoreDuplicates; no .delete() call; line 70: dynamic subtitle |
| `src/app/(dashboard)/student/roadmap/loading.tsx`                          | Dynamic skeleton count from ROADMAP_STEPS.length                      | VERIFIED | Line 2: ROADMAP_STEPS import; line 30: `Array.from({ length: ROADMAP_STEPS.length })`                      |
| `src/app/(dashboard)/student/page.tsx`                                     | ROADMAP_STEPS.length instead of hardcoded "10-step"                   | VERIFIED | Line 261: `{ROADMAP_STEPS.length}-step program journey`                                                     |

---

### Key Link Verification

| From                                                | To                              | Via                                   | Status | Details                                                                                                    |
|-----------------------------------------------------|---------------------------------|---------------------------------------|--------|------------------------------------------------------------------------------------------------------------|
| StudentKpiSummary.tsx                               | ProgressBanner.tsx              | KpiItem import                        | WIRED  | Line 1: import { KpiItem }; used 4x in JSX                                                                |
| StudentKpiSummary.tsx                               | src/lib/kpi.ts                  | RAG function imports                  | WIRED  | Lines 3-8: lifetimeOutreachRag/dailyOutreachRag/dailyHoursRag imported and used lines 36-38               |
| StudentKpiSummary.tsx                               | src/lib/config.ts               | ROADMAP_STEPS import                  | WIRED  | Line 2: ROADMAP_STEPS imported; used in getStepDisplay                                                    |
| StudentDetailClient.tsx                             | StudentKpiSummary.tsx           | import and render                     | WIRED  | Line 9: import; line 80: JSX render                                                                       |
| OwnerStudentDetailClient.tsx                        | StudentKpiSummary.tsx           | import and render                     | WIRED  | Line 14: import; line 199: JSX render                                                                     |
| coach/students/[studentId]/page.tsx                 | daily_reports table             | brands_contacted queries              | WIRED  | Lines 59, 64: .select("brands_contacted, influencers_contacted") with .eq("student_id")                   |
| owner/students/[studentId]/page.tsx                 | daily_reports table             | brands_contacted queries              | WIRED  | Lines 71, 76: identical query pattern                                                                     |
| roadmap/page.tsx lazy seeding                       | roadmap_progress table          | upsert onConflict/ignoreDuplicates    | WIRED  | Line 44: .upsert(rows, { onConflict: "student_id,step_number", ignoreDuplicates: true }); no DELETE       |
| migration 00008                                     | roadmap_progress table          | ALTER TABLE + INSERT CROSS JOIN       | WIRED  | CHECK constraint drop+add (lines 11-15); backfill INSERT (lines 24-49); 10 UPDATE statements (lines 56-94) |

---

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable              | Source                                                                                  | Produces Real Data | Status     |
|---------------------------------|----------------------------|-----------------------------------------------------------------------------------------|--------------------|------------|
| StudentDetailClient.tsx         | kpiData.lifetimeOutreach   | Coach page: allLifetimeReports.reduce(brands_contacted + influencers_contacted) from DB | Yes — Supabase query on daily_reports, admin client, filtered by student_id | FLOWING |
| StudentDetailClient.tsx         | kpiData.dailyOutreach      | Coach page: todayReport.brands_contacted + influencers_contacted from .eq("date", today) | Yes — Supabase query on daily_reports, today filter | FLOWING |
| StudentDetailClient.tsx         | kpiData.dailyMinutesWorked | Coach page: todaySessionsResult.data.filter(completed).reduce(duration_minutes)         | Yes — Supabase query on work_sessions, today filter | FLOWING |
| StudentDetailClient.tsx         | kpiData.currentStepNumber  | Coach page: roadmap.find(status === "active")?.step_number from roadmapResult           | Yes — uses already-fetched roadmap_progress data; now can include steps 11-15 after migration | FLOWING |
| OwnerStudentDetailClient.tsx    | kpiData.* (all fields)     | Owner page: identical computation pattern to coach page                                  | Yes — same DB queries, owner sees any student | FLOWING |

---

### Behavioral Spot-Checks

| Behavior                                                          | Command                                                            | Result              | Status |
|-------------------------------------------------------------------|--------------------------------------------------------------------|---------------------|--------|
| TypeScript compiles without errors                                | `npx tsc --noEmit`                                                 | Exit 0, no output   | PASS   |
| No DELETE query in roadmap/page.tsx                               | `grep -n "DELETE\|\.delete(" roadmap/page.tsx`                     | No output (not found) | PASS |
| Upsert with ignoreDuplicates present in roadmap/page.tsx          | `grep -n "ignoreDuplicates" roadmap/page.tsx`                      | Line 44             | PASS   |
| No hardcoded "10-step" or "10 steps" in student pages             | `grep -n "10-step\|10 steps\|length: 10" student/page.tsx roadmap/page.tsx loading.tsx` | No output | PASS |
| migration 00008 has BETWEEN 1 AND 15                              | `grep -c "BETWEEN 1 AND 15" 00008_expand_roadmap_to_15_steps.sql` | 1                   | PASS   |
| seed.sql contains 5 "Close First Brand Deal" rows                 | `grep -c "Close First Brand Deal" seed.sql`                        | 5 (one per student) | PASS   |
| All 6 plan commits exist                                          | `git log --oneline` for d4eb8cd, 434f61b, df25942, 2ce332b, 9dd7489, 11c0288 | All 6 found | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                    | Status                 | Evidence                                                                                                                 |
|-------------|----------------|--------------------------------------------------------------------------------|------------------------|--------------------------------------------------------------------------------------------------------------------------|
| VIS-01      | 16-02          | Coach student detail page shows read-only KPI summary (lifetime/2500, daily/50, hours, RAG status) | SATISFIED (pending visual) | Coach page fetches KPI data, passes to StudentDetailClient, which renders StudentKpiSummary; REQUIREMENTS.md still shows `[ ]` (doc lag) |
| VIS-02      | 16-02          | Owner student detail page shows same read-only KPI summary                    | SATISFIED (pending visual) | Owner page wired identically; REQUIREMENTS.md still shows `[ ]` (doc lag)                                              |
| VIS-03      | 16-01, 16-02, 16-03, 16-04 | KPI card includes current roadmap step for context                  | SATISFIED              | getStepDisplay() in StudentKpiSummary; DB now supports 15 steps; step display UAT issue resolved by migration + additive seeding |
| VIS-04      | 16-01, 16-02   | Coach and owner see same RAG status colors as the student                      | SATISFIED              | StudentKpiSummary uses same lifetimeOutreachRag/dailyOutreachRag/dailyHoursRag as ProgressBanner                        |

**Note on documentation lag:** REQUIREMENTS.md marks VIS-01 and VIS-02 as `[ ] Pending`. Implementation is fully wired in code and all 6 commits confirm execution. This is a documentation-only gap — not an implementation gap.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/lib/config.ts | 127-128 | Two TODO comments in ROADMAP_STEPS block | Info | Deferred decisions: target_days values for Phase 18, step titles for steps 8-15 from Abu Lahya. Not implementation stubs — existing titles work correctly. |

No stub patterns found in phase-modified files:
- No `return null`, `return {}`, `return []` in component render paths
- No hardcoded empty prop values passed to StudentKpiSummary at call sites
- No `TODO`/`FIXME` in new component or wiring files
- No empty catch blocks
- All fetch/query errors are console.error'd
- No DELETE query remains in lazy seeding (replaced by additive upsert)
- No hardcoded "10" step count in any student-facing file

---

### Hard Rules Compliance Check

| Rule | File(s) | Status | Notes |
|------|---------|--------|-------|
| motion-safe: on animate-* classes | All phase files | PASS | No animate-* classes in plans 03/04 modified files |
| 44px touch targets | All phase files | PASS | No interactive elements added in plans 03/04 |
| Accessible labels | StudentKpiSummary.tsx | PASS | role="region" + aria-label="Student KPI summary"; unchanged from plan 01 |
| Admin client in API routes | roadmap/page.tsx | PASS | createAdminClient() used for upsert and re-fetch queries |
| Never swallow errors | roadmap/page.tsx | PASS | upsertError caught and console.error'd (line 46-48) |
| ima-* tokens only | All phase files | PASS | No color changes in plans 03/04; StudentKpiSummary uses ima-* tokens |

---

### Human Verification Required

### 1. Coach KPI Card Render

**Test:** Log in as a coach account, navigate to any student's detail page (Coach Dashboard -> My Students -> click a student).
**Expected:** A Card component appears between the student name/email/joined header and the Work/Roadmap/Reports tab bar. The card shows 4 items: "Lifetime Outreach: X / 2,500", "Daily Outreach: X / 50", "Hours Worked: Xh Xm / 4h", "Current Step: Stage N: StageName — StepTitle". The first 3 items show colored dots (green/amber/red) based on RAG status.
**Why human:** JSX render path is structurally verified; browser rendering of the Card layout, dot colors, and responsive flex-wrap requires visual confirmation.

### 2. Owner KPI Card Render

**Test:** Log in as an owner account, navigate to any student's detail page (Owner -> Students -> click a student).
**Expected:** The same KPI summary card appears between the inline owner student header block (which includes the coach assignment dropdown) and the tab bar. Values and RAG colors match what the coach sees for the same student.
**Why human:** Both pages are wired identically in code; cross-role visual parity requires human check.

### 3. RAG Color Parity With Student View

**Test:** For a student who has submitted reports and work sessions, log in as that student and note the ProgressBanner values and dot colors. Then log in as their coach and open that student's detail page.
**Expected:** The RAG dot colors (green/amber/red) on the coach KPI card match the student's ProgressBanner dots for Lifetime Outreach, Daily Outreach, and Hours Worked. The exact numeric values should also match.
**Why human:** Same kpi.ts functions are used in both components (structurally verified) — actual dot color rendering and value accuracy require a live data cross-check.

### 4. Correct Roadmap Step After Migration (UAT Issue 4 Regression Check)

**Test:** After running `supabase db reset` (or applying migration 00008 to the live DB), log in as a student who has previously worked through roadmap steps (e.g., a student at step 7). Navigate to the student's roadmap page (to trigger lazy seeding if needed). Then log in as that student's coach and open the student detail page.
**Expected:** The KPI card shows the correct current step — for a student at step 7 it should display "Stage 1: Setup & Preparation — Follow Up" (step 7 from the config). It should NOT show "no roadmap progress" or "Stage 1" if the student is at a higher step. Visiting the roadmap page a second time should not log errors.
**Why human:** The root cause of UAT issue 4 (DB constraint + destructive seeding) has been fixed in code. The migration must actually run against the live DB, and the additive seeding must be verified to work correctly with a real student account in a live browser session.

---

### Gaps Summary

No implementation gaps found. All 12 observable truths are verified across all four levels (exists, substantive, wired, data flowing).

Plans 16-03 and 16-04 fully address the UAT issue root cause:
- Migration 00008 expands the DB CHECK constraint (step_number BETWEEN 1 AND 15) — the core blocker that caused constraint violations.
- Migration 00008 backfills steps 11-15 for existing students and corrects step names 1-10.
- seed.sql updated to 75 rows with config-matching step names.
- Lazy seeding is now additive (upsert with ignoreDuplicates, no DELETE) — the destructive pattern that wiped progress is gone.
- All hardcoded "10 steps" strings use ROADMAP_STEPS.length dynamically.

Two documentation items are noted but do not block goal achievement:
1. REQUIREMENTS.md marks VIS-01 and VIS-02 as `[ ]` (unchecked) — code satisfies both requirements.
2. ROADMAP.md may still show earlier plans unchecked — all plans were executed and committed.

The single remaining human verification item beyond visual checks is the end-to-end regression test for UAT issue 4 — confirming the correct step displays for a real student after migration runs.

---

_Verified: 2026-03-28_
_Verifier: Claude (gsd-verifier)_
