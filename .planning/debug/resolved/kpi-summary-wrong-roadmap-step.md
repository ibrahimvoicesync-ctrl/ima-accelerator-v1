---
status: resolved
trigger: "StudentKpiSummary shows wrong roadmap step data on coach/owner student detail pages"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T00:00:00Z
---

## Current Focus

hypothesis: Multiple root causes — DB CHECK constraint blocks steps 11-15, seed data uses stale 10-step names, "no roadmap progress" caused by lazy seeding gap on coach/owner pages
test: Traced all code paths from DB schema through queries to component display
expecting: Confirmed mismatches between 15-step config and 10-step DB/seed constraints
next_action: Return diagnosis

## Symptoms

expected: StudentKpiSummary should show correct current roadmap step for each student
actual: Sometimes says "no roadmap progress" for active students; shows "stage 1" for student at stage 7 (Layla at old step 7 = "Deal Closing" maps to new step 7 = "Follow Up" in Stage 1)
errors: No runtime errors — data silently wrong
reproduction: View any student detail page as coach or owner
started: After phase 16-01 expanded ROADMAP_STEPS from 10 to 15

## Eliminated

(none — root causes confirmed on first investigation pass)

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: DB schema constraint in 00001_create_tables.sql line 104
  found: CHECK (step_number BETWEEN 1 AND 10) — hard cap at 10
  implication: Steps 11-15 from config CANNOT be inserted into roadmap_progress; any INSERT for step 11-15 will fail silently or throw constraint error

- timestamp: 2026-03-28T00:02:00Z
  checked: All 7 migrations (00001 through 00007) for any ALTER to roadmap_progress
  found: No migration updates the step_number CHECK constraint to allow 1-15
  implication: The 15-step expansion in config.ts was never accompanied by a DB migration

- timestamp: 2026-03-28T00:03:00Z
  checked: seed.sql roadmap_progress section (lines 152-227)
  found: Seed data uses old 10-step names (Niche Selection, Brand Research, Outreach Scripts, etc.) that do NOT match new 15-step config titles (Join the Course, Plan Your Work, Pick Your Niche, etc.)
  implication: step_name column is stale for all seeded students; step_number semantics shifted (old step 5 = "Follow-Up System" vs new step 5 = "Build a List of Influencers")

- timestamp: 2026-03-28T00:04:00Z
  checked: Auth callback roadmap seeding (src/app/api/auth/callback/route.ts lines 161-179, 312-332, 418-438)
  found: All three registration paths seed ALL 15 ROADMAP_STEPS. This will FAIL for steps 11-15 due to DB CHECK constraint.
  implication: New students registered after the 15-step change will get only steps 1-10 seeded (if Supabase does partial insert) or NO steps at all (if the insert is atomic and rolls back entirely). The error IS logged at line 179/330/436 but the user still gets redirected.

- timestamp: 2026-03-28T00:05:00Z
  checked: Student roadmap page lazy seeding (src/app/(dashboard)/student/roadmap/page.tsx lines 28-68)
  found: Has a "lazy seeding" path — if progress.length < ROADMAP_STEPS.length (15), it deletes all rows and re-inserts 15 steps. This re-insert will ALSO fail for steps 11-15 due to the same DB CHECK constraint.
  implication: Visiting /student/roadmap may DELETE existing progress and then fail to re-seed steps 11-15, potentially LOSING student progress data

- timestamp: 2026-03-28T00:06:00Z
  checked: Coach and owner student detail pages — currentStepNumber computation (coach page line 112, owner page line 147)
  found: Both use `roadmap.find((r) => r.status === "active")` which is correct logic
  implication: The query logic itself is fine. The bug is upstream — the data in roadmap_progress is wrong/missing/stale

- timestamp: 2026-03-28T00:07:00Z
  checked: StudentKpiSummary.tsx getStepDisplay function (line 20-25)
  found: Uses ROADMAP_STEPS.find((s) => s.step === stepNumber) to look up step metadata. Since step numbers changed meaning (old step 7 "Deal Closing" is now step 7 "Follow Up" in Stage 1), the display will show WRONG stage/title.
  implication: Layla at old step 7 ("Deal Closing") would display as "Stage 1: Setup & Preparation — Follow Up" instead of anything related to deal closing. This explains the "shows stage 1" symptom.

- timestamp: 2026-03-28T00:08:00Z
  checked: Student dashboard page hardcoded strings (src/app/(dashboard)/student/page.tsx line 80, 263)
  found: Line 80 says "10 steps from beginner to closing your first brand deal" — stale reference to old 10-step count. Line 263 says "Track your 10-step program journey" — same stale reference.
  implication: Minor UI inconsistency, confirms the 10-to-15 expansion was incomplete

- timestamp: 2026-03-28T00:09:00Z
  checked: /api/roadmap PATCH route (src/app/api/roadmap/route.ts line 8)
  found: Validation uses z.number().int().min(1).max(ROADMAP_STEPS.length) which is max(15). But the DB CHECK caps at 10.
  implication: API validation allows step 11-15 but DB will reject them — another mismatch

## Resolution

root_cause: |
  THREE interrelated root causes, all stemming from the 10-to-15 roadmap expansion in phase 16-01 not being accompanied by a database migration:

  1. DATABASE CHECK CONSTRAINT (BLOCKING):
     File: supabase/migrations/00001_create_tables.sql, line 104
     The roadmap_progress table has CHECK (step_number BETWEEN 1 AND 10).
     No subsequent migration updates this to BETWEEN 1 AND 15.
     This prevents steps 11-15 from being inserted, causing:
     - New student registration to partially fail (auth callback seeding)
     - Lazy re-seeding on /student/roadmap to fail and potentially DELETE existing data
     - "No roadmap progress" for newly registered students if the insert is atomic

  2. STALE SEED DATA (DATA MISMATCH):
     File: supabase/seed.sql, lines 152-227
     Seed data uses old 10-step roadmap names and only seeds steps 1-10.
     Step numbers now have different semantic meaning:
     - Old step 7 "Deal Closing" -> New step 7 "Follow Up" (Stage 1)
     - Old step 5 "Follow-Up System" -> New step 5 "Build a List of Influencers" (Stage 1)
     When StudentKpiSummary looks up step metadata from ROADMAP_STEPS by step_number,
     it maps old step numbers to new step definitions, showing wrong stage/title.

  3. DESTRUCTIVE LAZY SEEDING (DATA LOSS RISK):
     File: src/app/(dashboard)/student/roadmap/page.tsx, lines 29-56
     When a student has fewer rows than ROADMAP_STEPS.length (15), lazy seeding
     DELETES all existing rows and re-inserts 15 rows. Since steps 11-15 will fail
     the DB constraint, this can destroy real progress data for existing students
     who correctly have only 10 rows.

fix: |
  (Not applied — diagnosis only)

verification: |
  (Not applied — diagnosis only)

files_changed: []
