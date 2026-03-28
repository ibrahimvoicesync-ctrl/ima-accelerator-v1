---
status: complete
phase: 16-coach-owner-kpi-visibility
source: [16-01-SUMMARY.md, 16-02-SUMMARY.md]
started: 2026-03-28T09:10:00Z
updated: 2026-03-28T20:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Coach Student Detail — KPI Summary Card Visible
expected: Navigate to a coach's student detail page (/coach/students/{studentId}). Between the student header and the tab bar, a KPI summary card should be visible showing: Lifetime Outreach count, Daily Outreach count, Daily Hours Worked, and Current Roadmap Step.
result: pass

### 2. Owner Student Detail — KPI Summary Card Visible
expected: Navigate to an owner's student detail page (/owner/students/{studentId}). Between the student header and the tab bar, the same KPI summary card should appear showing: Lifetime Outreach count, Daily Outreach count, Daily Hours Worked, and Current Roadmap Step.
result: pass

### 3. KPI RAG Color Coding
expected: KPI values display with RAG color coding — green for on-target, amber for approaching threshold, red for below threshold. Colors should match the same RAG logic used on the student's own dashboard.
result: pass

### 4. Roadmap Step Format
expected: The current roadmap step displays in the format "Stage N: StageName — StepTitle" (e.g., "Stage 1: Setup & Preparation — Step Title"). The em dash separator should be visible between the stage name and step title.
result: pass
note: "Previously showed wrong step — user confirms now displaying correctly"

### 5. KPI Data Is Live
expected: KPI values reflect actual database data — not placeholder or hardcoded values. If the student has submitted daily reports or logged work sessions, those counts should appear. If no data exists, values should show 0 or equivalent.
result: pass

### 6. KPI Card Always Visible Across Tabs
expected: On either the coach or owner student detail page, switch between available tabs. The KPI summary card should remain visible above the tab content — it does not disappear when switching tabs.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Current roadmap step displays correct step number matching student's actual progress"
  status: resolved
  reason: "User reported: the display is perfect, but the step is wrong, it sometimes says no roadmap progress although the person was logged in once or stage 1 although he is stage 7."
  severity: major
  test: 4
  root_cause: "DB CHECK constraint caps step_number at 10 (never migrated to 15). Seed data uses old 10-step names. Auth callback tries to seed 15 steps but steps 11-15 fail DB constraint. Lazy re-seeding in roadmap page is destructive (delete-all then reinsert). Hardcoded '10 steps' strings in student pages."
  artifacts:
    - path: "supabase/migrations/00001_create_tables.sql:104"
      issue: "CHECK (step_number BETWEEN 1 AND 10) — needs expansion to 15"
    - path: "supabase/seed.sql:152-227"
      issue: "Stale 10-step roadmap names and structure"
    - path: "src/app/api/auth/callback/route.ts:161-179,312-332,418-438"
      issue: "Seeds 15 steps into DB that only accepts 10"
    - path: "src/app/(dashboard)/student/roadmap/page.tsx:29-56"
      issue: "Destructive lazy re-seeding deletes all rows then reinserts"
    - path: "src/app/api/roadmap/route.ts:8"
      issue: "Zod max(15) vs DB max(10) mismatch"
    - path: "src/app/(dashboard)/student/page.tsx:80,263"
      issue: "Hardcoded '10 steps' strings"
  missing:
    - "Migration to expand CHECK constraint to BETWEEN 1 AND 15"
    - "Updated seed data with 15-step roadmap from config.ts"
    - "Data migration to add steps 11-15 for existing students"
    - "Non-destructive lazy seeding (additive, not delete-all)"
    - "Fix hardcoded '10 steps' strings to use ROADMAP_STEPS.length"
  debug_session: ".planning/debug/kpi-summary-wrong-roadmap-step.md"
