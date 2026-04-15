---
phase: 57-roadmap-step-8-insertion
plan: "01"
subsystem: database
tags: [postgres, supabase, migration, roadmap, rpc, atomic-transaction, two-pass-renumber]

requires:
  - phase: 51-coach-milestone-notifications
    provides: get_coach_milestones RPC body (00027) — copied verbatim minus step references
  - phase: 25-roadmap-15-step-expansion
    provides: roadmap_progress_step_number_check constraint pattern + 15-step ceiling we now lift to 16
provides:
  - Atomic Step 8 insertion migration 00030 (constraint swap → two-pass renumber → RPC rewrite → auto-complete → re-add constraint → ASSERT invariants → COMMIT)
  - get_coach_milestones rebound to step 12 (influencersClosedStep) and step 14 (brandResponseStep)
  - Auto-complete of new step 8 for every student with completed old step 7
affects: [57-02-config-update, 57-03-grep-sweep, future coach milestone alert work]

tech-stack:
  added: []
  patterns:
    - "Two-pass renumber (+100 / -99) to dodge UNIQUE(student_id, step_number) collisions during step renumbering"
    - "DO $named_block$ ASSERT pattern with format() error messages for atomic invariant validation inside BEGIN…COMMIT"
    - "Constraint drop → mutate → re-add at new ceiling pattern (CHECK constraints absent during the renumber window)"

key-files:
  created:
    - supabase/migrations/00030_roadmap_step_8_insertion.sql
  modified: []

key-decisions:
  - "Constraint must be DROPPED during pass 1 (which writes 108–115) and only RE-ADDED at BETWEEN 1 AND 16 after pass 2 lands rows back in 1–16. A single ALTER … BETWEEN 1 AND 16 up-front would still reject the intermediate 108–115 values."
  - "Auto-complete uses status varchar = 'completed' (not boolean completed = true), step_name = literal Phase 57 title, ON CONFLICT DO NOTHING for re-run idempotency (matches actual roadmap_progress schema from 00001)."
  - "RPC body copied verbatim from 00027:31-163 with only two step-number literals changed (11→12 and 13→14) plus '(Phase 57: shifted N→M)' SYNC comments."
  - "get_sidebar_badges intentionally NOT rewritten — composes get_coach_milestones, automatically picks up new step references."

patterns-established:
  - "Atomic step-number insertion: drop CHECK → two-pass +100/-99 renumber → CREATE OR REPLACE downstream RPCs → auto-complete INSERT … ON CONFLICT → re-add CHECK → DO $$ ASSERT $$ → COMMIT"
  - "ASSERT messages use format() with actual values to make rollback diagnostics actionable"

requirements-completed: [ROADMAP-01, ROADMAP-02, ROADMAP-03, ROADMAP-06, ROADMAP-09]

duration: 4 min
completed: 2026-04-15
---

# Phase 57 Plan 01: Roadmap Step 8 Insertion Migration Summary

**Single-transaction Postgres migration that drops the step_number CHECK, two-pass-renumbers existing roadmap_progress steps 8–15 to 9–16 (via +100/-99 to dodge UNIQUE collisions), rewrites get_coach_milestones with steps 12/14, auto-completes new step 8 for old step-7 completers, re-adds CHECK at BETWEEN 1 AND 16, and asserts invariants — all-or-nothing.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T17:24:27Z
- **Completed:** 2026-04-15T17:28:13Z
- **Tasks:** 7 (Tasks 1–6 mutated the file; Task 7 was a verify-only check that passed without modification)
- **Files modified:** 1 (created)

## Accomplishments

- Atomic migration file `supabase/migrations/00030_roadmap_step_8_insertion.sql` (281 lines) wrapping every change in a single BEGIN…COMMIT
- Two-pass renumber (Pass 1: +100, Pass 2: −99) bypasses the UNIQUE(student_id, step_number) index hazard that a naive +1 single-pass would trigger
- `get_coach_milestones` rebound: `five_inf` CTE now keys on `rp.step_number = 12`; `brand_resp` CTE on `rp.step_number = 14`. All other RPC logic (auth guard, student resolution, closed_deals, tech_setup, alert_dismissals semi-join) preserved verbatim from migration 00027
- Auto-complete `INSERT … SELECT … WHERE step_number = 7 AND status = 'completed' ON CONFLICT (student_id, step_number) DO NOTHING` — schema-correct (status varchar, step_name NOT NULL)
- Embedded `DO $phase57_assert$` block validates `MAX(step_number) <= 16` and zero duplicate `(student_id, step_number)` rows; failure raises and rolls back the entire transaction

## Task Commits

1. **Task 1: Header + BEGIN block** — `4191a68` (feat)
2. **Task 2: DROP step_number CHECK constraint (Section 1)** — `9a7a090` (feat)
3. **Task 3: Two-pass renumber 8–15 → 9–16 (Section 2)** — `f1f12c0` (feat)
4. **Task 4: CREATE OR REPLACE get_coach_milestones with steps 12/14 (Section 3)** — `b5d0787` (feat)
5. **Task 5: Auto-complete INSERT for new step 8 (Section 4)** — `1bba806` (feat)
6. **Task 6: Re-add CHECK constraint + ASSERT invariants + COMMIT (Sections 5–6)** — `2ff6e23` (feat)
7. **Task 7: Final-state verification** — no commit (read-only check; all 7 conditions passed)

## Files Created/Modified

- `supabase/migrations/00030_roadmap_step_8_insertion.sql` — Phase 57 atomic Step 8 insertion migration (created)

## Decisions Made

- **Constraint two-stage swap, not one-shot.** The plan-author's first draft had Section 1 add the new BETWEEN 1 AND 16 constraint immediately. The plan correction (and we) deferred ADD CONSTRAINT to Section 5 because pass 1 writes step_number = 108–115 transiently, and ANY `BETWEEN 1 AND N` check (15 OR 16) rejects those values. The constraint must be absent during the renumber window.
- **Status filter only on auto-complete.** Students with old step 7 in `active`/`locked` state are not auto-completed — they self-mark via the standard flow (per ROADMAP-04 / D-57-02 in CONTEXT.md).
- **alert_dismissals keyed on alert_key (student_id), not step_number.** No backfill of historical dismissals required when renumbering — the renumber updates `step_number` but `'milestone_5_influencers:{student_id}'` and `'milestone_brand_response:{student_id}'` keys remain valid for the same students (per RPC inline note).

## Deviations from Plan

None — plan executed exactly as written. Plan 57-01 already documented the constraint two-stage swap correction inline (Task 2 § Correction), so following the action steps verbatim produced the correct ordering.

## Issues Encountered

None.

## User Setup Required

None — migration deploys via `npx supabase db push --linked` after the full Phase 57 commit set lands. That step is covered in Plan 57-03 Task 7 (post-deploy smoke verification).

## Next Phase Readiness

- **Plan 57-02 (config.ts) is the matching half** — must commit before this migration ships to production. The atomicity requirement is *deploy-level*: config.ts MILESTONE_CONFIG.influencersClosedStep / brandResponseStep MUST equal the RPC step literals (12 / 14) in the same release.
- **Plan 57-03 (grep sweep + smoke test)** consumes both 57-01 and 57-02 outputs — sweeps src/ for hardcoded step literals → config refs, then runs `npx supabase db push --linked` and the post-deploy smoke SQL.
- No blockers.

---
*Phase: 57-roadmap-step-8-insertion*
*Completed: 2026-04-15*
