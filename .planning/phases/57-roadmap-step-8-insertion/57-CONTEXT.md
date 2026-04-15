# Phase 57: Roadmap Step 8 Insertion - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Mode:** Interactive (batch table, all 8 recommendations accepted)

<domain>
## Phase Boundary

Migration 00030 inserts a new Step 8 ("Join at least one Influencer Q&A session (CPM + pricing)") at the end of Stage 1, atomically renumbers existing Steps 8–15 → 9–16, auto-completes the new step for students past old Step 7, and updates `MILESTONE_CONFIG` + `get_coach_milestones` RPC SQL in the same commit. Plus a full codebase grep sweep for hardcoded step-number literals.

</domain>

<decisions>
## Implementation Decisions

### Migration 00030 Structure (locked by SC#5)
- Single `BEGIN … COMMIT` transaction, exact order:
  1. `ALTER TABLE roadmap_progress DROP CONSTRAINT <name>` + `ADD CONSTRAINT … CHECK (step_number BETWEEN 1 AND 16)` — relaxes ceiling first
  2. **Pass 1**: `UPDATE roadmap_progress SET step_number = step_number + 100 WHERE step_number BETWEEN 8 AND 15` — shifts old Steps 8–15 to 108–115 (outside collision range)
  3. **Pass 2**: `UPDATE roadmap_progress SET step_number = step_number - 99 WHERE step_number BETWEEN 108 AND 115` — shifts 108–115 to 9–16
  4. `CREATE OR REPLACE FUNCTION get_coach_milestones` with `influencersClosedStep = 12` and `brandResponseStep = 14` (shifted +1 each)
  5. Auto-complete: `INSERT INTO roadmap_progress (student_id, step_number, step_name, status, completed_at) SELECT student_id, 8, '<Phase 57 title>', 'completed', NOW() FROM roadmap_progress WHERE step_number = 7 AND status = 'completed' ON CONFLICT (student_id, step_number) DO NOTHING`
     — Schema correction: `roadmap_progress` uses `status varchar` (not boolean `completed`); `step_name` is NOT NULL. Planner caught this during Phase 57 planning. Step 7 rows after Pass 2 are still at 7 (unchanged); the INSERT references the POST-renumber state, so old step-7 completers get a fresh completed row at new step 8.
  6. `DO $$ BEGIN ASSERT (SELECT MAX(step_number) FROM roadmap_progress) = 16; ASSERT (SELECT COUNT(*) FROM (SELECT student_id, step_number FROM roadmap_progress GROUP BY student_id, step_number HAVING COUNT(*) > 1) dup) = 0; END $$;`
  7. Implicit `COMMIT` (via migration boundary) — ASSERT failures roll back automatically.
- Order non-negotiable: the CHECK constraint must be relaxed BEFORE any UPDATE that could temporarily exceed 15.

### D-57-01: New Step 8 content
- **Title**: "Join at least one Influencer Q&A session (CPM + pricing)" (locked by roadmap)
- **Body description**: Brief, action-oriented, matching existing `ROADMAP_STEPS` style — planner drafts 1-2 sentences explaining what the student does and why. Suggested template: "Attend a live Influencer Q&A call. Learn how CPM is calculated and how to price deals before your first outreach."
- **target_days**: 5 (locked by ROADMAP-01)
- **Stage**: Stage 1 "Setup & Preparation" (locked by SC#1)
- **Insertion position**: End of Stage 1, before old Step 8 "Send your First Email" (which becomes new Step 9).

### D-57-02: Auto-complete logic for new Step 8
- Gate on **old Step 7 completion state** only. SQL (after renumber, step 7 is still step 7):
  ```sql
  -- Schema: roadmap_progress uses status varchar (NOT boolean 'completed');
  -- step_name is NOT NULL.
  INSERT INTO roadmap_progress (student_id, step_number, step_name, status, completed_at)
  SELECT student_id,
         8,
         'Join at least one Influencer Q&A session (CPM + pricing)',
         'completed',
         NOW()
  FROM roadmap_progress
  WHERE step_number = 7 AND status = 'completed'
  ON CONFLICT (student_id, step_number) DO NOTHING;
  ```
- Students with old Step 7 in-progress or not started: no row inserted; new Step 8 shows as locked/available per existing gating rules.
- Students who skipped old Step 7 but completed later steps: NOT auto-completed for new Step 8 (conservative; avoids false credit). They can self-mark via the standard flow (ROADMAP-04).
- `ON CONFLICT DO NOTHING` guards against re-run.

### D-57-03: `student_diy` handling — **Identical to student**
- SC#2 mandates both roles handled. The `roadmap_progress` table's `student_id` FK references `users.id` without role filter. Both student and student_diy rows are treated identically in Passes 1/2 and the auto-complete INSERT.
- No role-branch in the migration SQL.

### D-57-04: Grep sweep scope — **Broad**
Codebase sweep after migration. Replace magic numbers with config references per CLAUDE.md "Config is truth":
- Literal strings: `/15`, `/10`, `of 15`, `of 10`
- Step-number comparisons: `step_number === N`, `step === N`, `step > N`, `step < N`, `step_number > N`, etc. where N is any integer 7–15
- Named constants: `STEP_8`, `STEP_NINE`, etc. (if any)
- Replace with: `ROADMAP_STEPS.length`, `MILESTONE_CONFIG.influencersClosedStep`, `MILESTONE_CONFIG.brandResponseStep`, or direct `ROADMAP_STEPS[N - 1]` references as appropriate.
- Planner includes a dedicated grep-and-replace task as the final plan in the phase.

### D-57-05: No feature flag
- Migration is deterministic and atomic. `BEGIN … COMMIT` either succeeds or rolls back; no partial state.
- No `ROADMAP_STEP_8_ENABLED` flag or gated render logic. Adds dead code, blocks downstream features, contradicts atomic deploy.

### D-57-06: `MILESTONE_CONFIG` update ordering — **Same commit**
- `src/lib/config.ts`: `influencersClosedStep: 11 → 12`, `brandResponseStep: 13 → 14`
- Migration 00030: `CREATE OR REPLACE FUNCTION get_coach_milestones` with same shifted values.
- Both changes land in the same Git commit with migration 00030.
- Critical: missing either half silently breaks coach milestone alerts (STATE.md §Critical Constraints).

### D-57-07: Assert failure behavior — **Native Postgres rollback**
- Two asserts inside a single `DO $$ … $$` block:
  1. `ASSERT (SELECT MAX(step_number) FROM roadmap_progress) = 16` — confirms renumber succeeded
  2. `ASSERT (SELECT COUNT(*) FROM (SELECT student_id, step_number FROM roadmap_progress GROUP BY student_id, step_number HAVING COUNT(*) > 1) dup) = 0` — confirms no duplicate step rows
- If either fails, Postgres raises an exception and the transaction rolls back atomically; zero db state change.
- No custom error handling needed.

### D-57-08: Post-deploy verification — **Smoke script**
- Add a verification task to the final plan. Script (or manual query) checks:
  1. One student who was on old Step 8 (should now be on Step 9 with completed=true if previously completed; Step 9 untouched state otherwise)
  2. One student who completed old Step 7 (should have `roadmap_progress` row at step_number=8 with completed=true)
  3. One brand-new student with no `roadmap_progress` rows (unaffected, new Step 8 shows as normal locked/available)
  4. `SELECT MAX(step_number) FROM roadmap_progress` = 16
  5. `ROADMAP_STEPS.length` (in JS/TS) = 16 — via `npm run build` type-check
  6. A coach with a student at step 12 sees the `5_influencers` milestone fire correctly
  7. A coach with a student at step 14 sees the `brand_response` milestone fire correctly

### Claude's Discretion
- Exact constraint name for the `BETWEEN 1 AND 15` CHECK — planner greps migrations 00001–00027
- Description text wording for new Step 8 (D-57-01) — 1-2 sentences following existing ROADMAP_STEPS style
- Whether auto-complete INSERT uses `SELECT DISTINCT` or `ON CONFLICT DO NOTHING` or both
- Exact grep patterns beyond the examples in D-57-04 (ripgrep/regex tuning)
- Whether the grep-and-replace task is one plan or fans out
- How to structure the migration file (comments, section separators)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ROADMAP_STEPS` array in `src/lib/config.ts` — the source of truth per CLAUDE.md
- `MILESTONE_CONFIG` object in `src/lib/config.ts` — step-number bindings for milestone alerts
- `get_coach_milestones` RPC — defined in `supabase/migrations/00027_get_coach_milestones_and_backfill.sql`
- Existing two-phase-UPDATE pattern: check earlier migrations (18, 19, 25, 26) for renumber precedents
- `ON CONFLICT (student_id, step_number) DO NOTHING` — matches existing UNIQUE constraint per STATE.md
- Grep/replace pattern already applied in phase 48 and 53 — reuse that precedent

### Established Patterns
- Migrations are idempotent-safe via `IF NOT EXISTS` / `DROP … IF EXISTS` where applicable
- `CREATE OR REPLACE FUNCTION` for RPC updates
- Section comments in SQL migrations (header block with Phase N, rationale, order rationale)
- STATE.md §Critical Constraints is the authoritative warning source
- Progress bar denominators derived from `ROADMAP_STEPS.length` (not hardcoded) — Phase 25 established this

### Integration Points
- `src/lib/config.ts` — `ROADMAP_STEPS` array + `MILESTONE_CONFIG` values
- `src/lib/rpc/coach-milestones-types.ts` — `MilestoneType` union (unchanged by this phase)
- `supabase/migrations/00030_roadmap_step_8_insertion.sql` — new file
- `src/app/(dashboard)/student/roadmap/page.tsx` (or similar) — consumes ROADMAP_STEPS; should just work after config update
- `src/app/(dashboard)/coach/**/roadmap*.tsx` — coach-facing progress views
- `src/app/(dashboard)/owner/**/roadmap*.tsx` — owner-facing progress views

</code_context>

<specifics>
## Specific Ideas

- Migration filename: `supabase/migrations/00030_roadmap_step_8_insertion.sql`
- New Step 8 entry in `ROADMAP_STEPS` structure (planner verifies exact type fields):
  ```ts
  {
    step_number: 8,
    title: "Join at least one Influencer Q&A session (CPM + pricing)",
    description: "[1-2 sentences per D-57-01]",
    target_days: 5,
    stage: "Setup & Preparation",
    // …other fields matching existing entries
  }
  ```
- Existing Steps 8–15 in `ROADMAP_STEPS` get renumbered in the file (step_number fields updated 8→9, 9→10, …, 15→16), entry ORDER matches step_number ascending
- `MILESTONE_CONFIG.influencersClosedStep: 12`, `MILESTONE_CONFIG.brandResponseStep: 14`
- ASSERT blocks use `DO $$ BEGIN … END $$;` syntax (Postgres DO statement)
- npm run build + lint + type-check are authoritative regression guards

</specifics>

<deferred>
## Deferred Ideas

- Feature flag for staged rollout — rejected per D-57-05
- Rollback migration 00031 — not needed; `00030` is atomic and idempotent-safe via ON CONFLICT; if rollback ever needed, write it as a separate remediation
- Admin UI for editing roadmap steps — not in v1.6 scope; `ROADMAP_STEPS` remains code-configured
- Analytics on new Step 8 completion rate — deferred to future analytics phase

</deferred>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 57 section
- `.planning/REQUIREMENTS.md` — lines 49–57 (ROADMAP-01 through ROADMAP-09)
- `.planning/REQUIREMENTS.md` — verification matrix rows 126–134
- `.planning/STATE.md` — §Critical Constraints for v1.6 (Phase 57 atomicity, two-pass renumber)
- `src/lib/config.ts` — `ROADMAP_STEPS`, `MILESTONE_CONFIG`
- `supabase/migrations/00027_get_coach_milestones_and_backfill.sql` — current `get_coach_milestones` to rewrite
- `src/lib/rpc/coach-milestones-types.ts` — `MilestoneType` + tag helper
- `CLAUDE.md` — "Config is truth" rule + Zod/admin-client rules

</canonical_refs>
