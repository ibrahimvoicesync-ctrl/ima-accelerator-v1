# Phase 13: Schema & Config Foundation - Research

**Researched:** 2026-03-27
**Domain:** PostgreSQL migration patterns (Supabase), TypeScript config authoring (as const), utility function authoring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Drop the `CHECK(cycle_number BETWEEN 1 AND 4)` constraint on `work_sessions`. Keep `cycle_number` column and the `UNIQUE(student_id, date, cycle_number)` index. `cycle_number` becomes an unbounded sequence counter (1, 2, 3, 4, 5...) per day. Phase 14 code will assign the next available number.

### Claude's Discretion

- Migration file organization (single combined vs. separate per table) — Claude may choose the approach that best fits the existing 00001-00005 migration pattern
- Backfill strategy for existing data — `session_minutes` for past sessions (all were 45 min), new outreach columns for past daily reports (existing `outreach_count` column exists)
- Config structure — how to organize new exports (`sessionDurationOptions`, `defaultSessionMinutes`, `KPI_TARGETS`, `target_days` per roadmap step) relative to existing config sections
- Roadmap `target_days` placeholder values — STATE.md notes "placeholders until Abu Lahya confirms"; Claude picks reasonable defaults

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WORK-09 | DB migration adds `session_minutes` column to `work_sessions` | NOT NULL migration pattern; backfill with 45 (existing default); remove cycle constraint in same migration |
| KPI-07 | DB migration adds 5 new integer columns to `daily_reports` | NOT NULL migration pattern; trigger update required in same migration file |
| ROAD-01 | Each roadmap step has `target_days` in config; deadline = joined_at + target_days | `as const` pattern; `getTodayUTC()` utility in utils.ts |
</phase_requirements>

---

## Summary

Phase 13 is a pure schema-and-config phase with no UI work and no new npm dependencies. All changes are confined to three files: one new Supabase migration (00006), `src/lib/config.ts`, and `src/lib/utils.ts`. TypeScript is currently passing with zero errors and must remain clean after all edits.

The most important technical concern is the **NOT NULL migration pattern**: adding a NOT NULL column to a live table requires three steps in a single migration transaction — add nullable, backfill with UPDATE, then SET NOT NULL. Skipping the backfill step will cause the migration to fail on any table that has existing rows. The `work_sessions` and `daily_reports` tables both have real data and require this pattern.

The second concern is the **trigger update atomicity rule** (from STATE.md Pitfall 8): any new columns added to `daily_reports` must be pinned inside the `restrict_coach_report_update` trigger function in the same migration. If the trigger is not updated, coaches can overwrite student-submitted KPI data through the existing RLS UPDATE policy.

**Primary recommendation:** Write one migration file (00006) that handles all three schema changes — `work_sessions` column addition + constraint drop, `daily_reports` column additions + trigger update — then update `config.ts` and `utils.ts` as TypeScript-only edits with no runtime risk.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (via Supabase) | 15.x (Supabase-managed) | Schema host | Project's DB layer |
| TypeScript | 5.9.3 (tsc) | Config and utils type safety | Project uses strict mode |
| Supabase CLI | 2.78.1 (devDep) | Migration runner | Project-established tool |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Already installed; NOT needed here | `getTodayUTC()` is a one-liner using `new Date().toISOString()` |

No new npm dependencies required for this phase.

**Installation:** None needed.

---

## Architecture Patterns

### Migration File Structure

Follow the established pattern: sequential numeric prefix, descriptive suffix, no subdirectories.

```
supabase/migrations/
├── 00001_create_tables.sql        # Base schema
├── 00002_fix_grants.sql           # Grant fixes
├── 00003_add_pause_support.sql    # Pause feature
├── 00004_alert_dismissals.sql     # Alert table
├── 00005_add_michael_owner.sql    # Data seed
└── 00006_v1_1_schema.sql          # THIS PHASE (all v1.1 schema changes)
```

**Single file decision rationale:** All three changes (work_sessions, daily_reports columns, trigger update) are logically coupled — daily_reports columns and trigger update MUST be atomic. Combining work_sessions into the same file keeps the v1.1 schema change set reviewable in one place.

### Pattern 1: NOT NULL Column Addition on Live Data

**What:** Adding a non-nullable column to a table that already has rows. Postgres rejects bare `ADD COLUMN col NOT NULL` with no DEFAULT when rows exist (it cannot backfill).

**When to use:** Any `ADD COLUMN ... NOT NULL` on a table with existing data.

**Correct three-step pattern:**

```sql
-- Step 1: Add nullable (no constraint, no DEFAULT on the column def)
ALTER TABLE public.work_sessions
  ADD COLUMN session_minutes integer;

-- Step 2: Backfill existing rows
UPDATE public.work_sessions
  SET session_minutes = 45
  WHERE session_minutes IS NULL;

-- Step 3: Apply NOT NULL constraint
ALTER TABLE public.work_sessions
  ALTER COLUMN session_minutes SET NOT NULL;
```

**Why 45 for backfill:** The WORK_TRACKER.sessionMinutes config value was 45 throughout v1.0. All existing sessions used 45 minutes.

**Incorrect (fails on live data):**
```sql
-- BAD — will fail if any rows exist
ALTER TABLE public.work_sessions
  ADD COLUMN session_minutes integer NOT NULL DEFAULT 45;
-- (DEFAULT makes this technically work, but leaves a column-level DEFAULT
--  that will silently accept future NULL inputs. Remove DEFAULT after backfill.)
```

Note: Using `DEFAULT 45` in the ADD COLUMN statement does work in Postgres and avoids a separate UPDATE, but it sets a persistent column default. For this codebase the preference is explicit backfill + SET NOT NULL (no persistent default), matching the existing migration style.

### Pattern 2: Dropping and Recreating a CHECK Constraint

**What:** Postgres cannot ALTER a CHECK constraint in-place. Must DROP the old constraint then ADD a new one (or omit it entirely).

**Current constraint on `work_sessions`:**
```sql
-- cycle_number integer NOT NULL CHECK (cycle_number BETWEEN 1 AND 4)
-- constraint name: work_sessions_cycle_number_check
```

**Migration to drop without replacement (D-01 decision):**
```sql
ALTER TABLE public.work_sessions
  DROP CONSTRAINT work_sessions_cycle_number_check;
```

**How to find the constraint name:** The constraint name follows Postgres's default naming: `{table}_{column}_check`. For `work_sessions.cycle_number` it is `work_sessions_cycle_number_check`. Verify via `\d work_sessions` in psql if uncertain.

The `UNIQUE(student_id, date, cycle_number)` index (`idx_work_sessions_student_date_cycle`) is NOT touched — it stays intact.

### Pattern 3: Updating a Trigger Function In-Place

**What:** `CREATE OR REPLACE FUNCTION` replaces the function body without dropping the trigger binding. The trigger itself does not need to be recreated.

**Current `restrict_coach_report_update` function (lines 411-428 in 00001):**
```sql
CREATE OR REPLACE FUNCTION public.restrict_coach_report_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (select get_user_role()) = 'coach' THEN
    NEW.student_id     := OLD.student_id;
    NEW.date           := OLD.date;
    NEW.hours_worked   := OLD.hours_worked;
    NEW.star_rating    := OLD.star_rating;
    NEW.outreach_count := OLD.outreach_count;
    NEW.wins           := OLD.wins;
    NEW.improvements   := OLD.improvements;
    NEW.submitted_at   := OLD.submitted_at;
    NEW.created_at     := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
```

**Updated version adds 5 new columns after `outreach_count`:**
```sql
CREATE OR REPLACE FUNCTION public.restrict_coach_report_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (select get_user_role()) = 'coach' THEN
    NEW.student_id              := OLD.student_id;
    NEW.date                    := OLD.date;
    NEW.hours_worked            := OLD.hours_worked;
    NEW.star_rating             := OLD.star_rating;
    NEW.outreach_count          := OLD.outreach_count;
    NEW.outreach_brands         := OLD.outreach_brands;
    NEW.outreach_influencers    := OLD.outreach_influencers;
    NEW.brands_contacted        := OLD.brands_contacted;
    NEW.influencers_contacted   := OLD.influencers_contacted;
    NEW.calls_joined            := OLD.calls_joined;
    NEW.wins                    := OLD.wins;
    NEW.improvements            := OLD.improvements;
    NEW.submitted_at            := OLD.submitted_at;
    NEW.created_at              := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
```

The `CREATE TRIGGER enforce_coach_report_fields` statement in 00001 does NOT need to be rerun — `CREATE OR REPLACE FUNCTION` updates the function body in place, and the existing trigger binding points to the same function name.

### Pattern 4: Config Additions Using `as const`

**What:** All config in this codebase uses `as const` assertions. New exports must follow the same pattern.

**Adding to WORK_TRACKER:**
```typescript
// Source: src/lib/config.ts existing pattern
export const WORK_TRACKER = {
  sessionMinutes: 45,        // KEPT for backward compatibility
  breakMinutes: 15,
  cyclesPerDay: 4,           // KEPT — Phase 14 will handle the "no cap" logic
  dailyGoalHours: 4,
  abandonGraceSeconds: 300,
  sessionDurationOptions: [30, 45, 60] as const,
  defaultSessionMinutes: 45,
} as const;
```

**New KPI_TARGETS export (top-level, not nested):**
```typescript
export const KPI_TARGETS = {
  lifetimeOutreach: 2500,
  dailyOutreach: 50,
} as const;
```

**ROADMAP_STEPS with target_days:**
```typescript
export const ROADMAP_STEPS = [
  { step: 1, title: "Join the Course",             description: "...", autoComplete: true, target_days: 1   },
  { step: 2, title: "Plan Your Work",              description: "...",                    target_days: 3   },
  { step: 3, title: "Pick Your Niche",             description: "...",                    target_days: 7   },
  { step: 4, title: "Build Your Website",          description: "...",                    target_days: 14  },
  { step: 5, title: "Send Your First Email",       description: "...",                    target_days: 21  },
  { step: 6, title: "Get Your First Response",     description: "...",                    target_days: 28  },
  { step: 7, title: "Close Your First Influencer", description: "...",                    target_days: 35  },
  { step: 8, title: "Close 5 Influencers",         description: "...",                    target_days: 42  },
  { step: 9, title: "Brand Outreach",              description: "...",                    target_days: 49  },
  { step: 10, title: "Close Your First Brand Deal",description: "...",                    target_days: 56  },
] as const;
```

NOTE: `target_days` values above are weekly-cadence placeholders (7 days per step). STATE.md explicitly notes these are placeholders until Abu Lahya confirms. The planner should include a comment in the config file flagging them as pending confirmation.

**Adding to default export:** `KPI_TARGETS` must be added to the `config` object at the bottom of config.ts, alongside the existing keys.

### Pattern 5: getTodayUTC() in utils.ts

**What:** Returns today's date in YYYY-MM-DD format using UTC (not local time). Needed for all deadline arithmetic so server-side and client-side date math agrees regardless of user timezone.

```typescript
// Source: STATE.md Accumulated Context + existing getToday() pattern
/** Returns today's date as YYYY-MM-DD in UTC */
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}
```

This is a one-liner that mirrors `getToday()` but uses UTC. Both functions live in `src/lib/utils.ts`.

### Anti-Patterns to Avoid

- **Bare `ADD COLUMN ... NOT NULL` without backfill:** Fails on any table with existing rows if no DEFAULT is specified. Even with DEFAULT, the persistent default can mask missing data in application code.
- **Updating trigger in a separate migration file:** The `restrict_coach_report_update` function MUST be updated in the same migration that adds the new `daily_reports` columns. A window where columns exist but the trigger hasn't been updated creates a data integrity gap.
- **Skipping the constraint name lookup:** Postgres names CHECK constraints using `{table}_{column}_check` convention. Using a wrong name in `DROP CONSTRAINT` will fail the migration. The constraint on `cycle_number` is `work_sessions_cycle_number_check`.
- **Hardcoding KPI targets in component files:** All KPI values (2500, 50) must come from `KPI_TARGETS` in config.ts per CLAUDE.md rule #1 (Config is truth).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UTC date string | Custom date formatter | `new Date().toISOString().split("T")[0]` | ISO string is always UTC; one-liner |
| Constraint introspection | Querying pg_constraint | Use known convention: `{table}_{column}_check` | Deterministic in this codebase |
| Type-safe config | Manual type definitions | `as const` + infer from array/object | TypeScript infers the literal types automatically |

---

## Common Pitfalls

### Pitfall 1: Trigger Not Updated in Same Migration

**What goes wrong:** The 5 new `daily_reports` columns are added in 00006, but the `restrict_coach_report_update` trigger function is not updated. Coaches can now overwrite `outreach_brands`, `outreach_influencers`, etc. because the trigger only pins the old column list.

**Why it happens:** Migration author treats the trigger update as a separate concern and defers it.

**How to avoid:** The trigger `CREATE OR REPLACE FUNCTION` block must appear in the SAME migration file as the `ADD COLUMN` statements. Enforce this in the task checklist.

**Warning signs:** The migration applies without error but a coach can SET outreach_brands on any student report they have UPDATE access to.

### Pitfall 2: Wrong Constraint Name in DROP CONSTRAINT

**What goes wrong:** `ALTER TABLE public.work_sessions DROP CONSTRAINT work_sessions_cycle_number_check` fails with "constraint does not exist."

**Why it happens:** Constraint was named differently (e.g., `cycle_number_check` or custom name in original DDL).

**How to avoid:** The original DDL in 00001 uses inline `CHECK (cycle_number BETWEEN 1 AND 4)` with no explicit `CONSTRAINT name` clause. Postgres auto-names these as `{table}_{column}_check`. The name is `work_sessions_cycle_number_check`. Verify by inspecting the actual DB if uncertain before deploying.

**Warning signs:** Migration fails at the DROP CONSTRAINT line. If uncertain, use `IF EXISTS`:
```sql
ALTER TABLE public.work_sessions
  DROP CONSTRAINT IF EXISTS work_sessions_cycle_number_check;
```

### Pitfall 3: TypeScript Error from `as const` Shape Change in ROADMAP_STEPS

**What goes wrong:** Adding `target_days` to ROADMAP_STEPS breaks downstream TypeScript code that typed the array elements as having only `{ step, title, description }`.

**Why it happens:** TypeScript infers the element type from the `as const` array. Adding a new property widens the inferred type — this is not a breaking change (it is additive). However, if any code uses `Pick` or explicit interface that does NOT include `target_days`, those usages will not break (extra properties are fine in structural typing). The only risk is if code uses `Omit` or a mapped type that excludes `target_days`.

**How to avoid:** Run `npx tsc --noEmit` after updating `ROADMAP_STEPS`. The TypeScript check is the gate.

**Warning signs:** `tsc --noEmit` output shows type errors referencing `ROADMAP_STEPS` element types.

### Pitfall 4: `cyclesPerDay` in WORK_TRACKER Confusion

**What goes wrong:** Someone removes `cyclesPerDay: 4` from WORK_TRACKER thinking "no daily cap" means the field is obsolete.

**Why it happens:** WORK-08 says no hard cap on cycles, which suggests `cyclesPerDay` is no longer needed.

**How to avoid:** Do NOT remove `cyclesPerDay` in Phase 13. STATE.md notes there are 6 consumers of `cyclesPerDay` across the codebase. Phase 14 handles those consumers. Phase 13 only adds new fields; it does not remove existing ones.

### Pitfall 5: zod Import from Wrong Path

**What goes wrong:** New validation code (if any) uses `import { z } from "zod/v4"` — this is explicitly forbidden by CLAUDE.md.

**Why it happens:** zod v4 introduced a `zod/v4` export path; some examples online use it.

**How to avoid:** Always `import { z } from "zod"`. Phase 13 does not add new API routes, so this risk is low — but note it for Phase 15+ work.

---

## Code Examples

Verified patterns from the existing codebase and STATE.md:

### Full Migration 00006 Structure (Template)

```sql
-- ============================================================================
-- IMA Accelerator V1.1 — Schema Foundation
-- Adds session_minutes to work_sessions, drops cycle_number cap constraint,
-- adds 5 KPI columns to daily_reports, updates restrict_coach_report_update
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. work_sessions: add session_minutes column
-- ---------------------------------------------------------------------------
ALTER TABLE public.work_sessions
  ADD COLUMN session_minutes integer;

UPDATE public.work_sessions
  SET session_minutes = 45
  WHERE session_minutes IS NULL;

ALTER TABLE public.work_sessions
  ALTER COLUMN session_minutes SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. work_sessions: drop cycle_number BETWEEN 1 AND 4 constraint (D-01)
-- Keep UNIQUE(student_id, date, cycle_number) index intact.
-- ---------------------------------------------------------------------------
ALTER TABLE public.work_sessions
  DROP CONSTRAINT IF EXISTS work_sessions_cycle_number_check;

-- ---------------------------------------------------------------------------
-- 3. daily_reports: add 5 KPI columns (nullable backfill, then NOT NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.daily_reports
  ADD COLUMN outreach_brands       integer,
  ADD COLUMN outreach_influencers  integer,
  ADD COLUMN brands_contacted      integer,
  ADD COLUMN influencers_contacted integer,
  ADD COLUMN calls_joined          integer;

UPDATE public.daily_reports
  SET outreach_brands       = 0,
      outreach_influencers  = 0,
      brands_contacted      = 0,
      influencers_contacted = 0,
      calls_joined          = 0
  WHERE outreach_brands IS NULL;

ALTER TABLE public.daily_reports
  ALTER COLUMN outreach_brands       SET NOT NULL,
  ALTER COLUMN outreach_influencers  SET NOT NULL,
  ALTER COLUMN brands_contacted      SET NOT NULL,
  ALTER COLUMN influencers_contacted SET NOT NULL,
  ALTER COLUMN calls_joined          SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Update restrict_coach_report_update trigger to pin new columns
--    MUST be in same migration as column additions (atomicity rule)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restrict_coach_report_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (select get_user_role()) = 'coach' THEN
    NEW.student_id              := OLD.student_id;
    NEW.date                    := OLD.date;
    NEW.hours_worked            := OLD.hours_worked;
    NEW.star_rating             := OLD.star_rating;
    NEW.outreach_count          := OLD.outreach_count;
    NEW.outreach_brands         := OLD.outreach_brands;
    NEW.outreach_influencers    := OLD.outreach_influencers;
    NEW.brands_contacted        := OLD.brands_contacted;
    NEW.influencers_contacted   := OLD.influencers_contacted;
    NEW.calls_joined            := OLD.calls_joined;
    NEW.wins                    := OLD.wins;
    NEW.improvements            := OLD.improvements;
    NEW.submitted_at            := OLD.submitted_at;
    NEW.created_at              := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
```

### getTodayUTC() in utils.ts

```typescript
// Source: STATE.md Accumulated Context formula
/** Returns today's date as YYYY-MM-DD in UTC */
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}
```

### KPI_TARGETS export in config.ts

```typescript
// Source: REQUIREMENTS.md KPI-07, CONTEXT.md
export const KPI_TARGETS = {
  lifetimeOutreach: 2500,
  dailyOutreach: 50,
} as const;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cycle_number CHECK (BETWEEN 1 AND 4)` | Unbounded sequence counter, no CHECK | Phase 13 (D-01) | Phase 14 can insert cycle 5, 6, ... |
| Single `outreach_count` column | 5 granular outreach columns + `outreach_count` retained | Phase 13 | Phase 15 builds KPI banner from granular data |
| `sessionMinutes: 45` only | `sessionDurationOptions: [30, 45, 60]` + `defaultSessionMinutes: 45` | Phase 13 | Phase 14 can offer duration picker |

---

## Open Questions

1. **Exact `target_days` values per roadmap step**
   - What we know: Abu Lahya's program runs approximately 8 weeks; 10 steps in sequence
   - What's unclear: Whether some steps have longer target windows (e.g., close 5 influencers vs. pick a niche)
   - Recommendation: Use weekly-cadence placeholders (7 days × step number) with a prominent comment: `// TODO: Confirm with Abu Lahya before Phase 18 ships`

2. **`paused` status CHECK constraint on `work_sessions`**
   - What we know: Migration 00003 already added `paused` to the status CHECK. The success criteria for Phase 13 says "the `paused` status is accepted by the DB" — this is ALREADY MET.
   - Recommendation: Phase 13 plan should include a verification task (SELECT from information_schema) to confirm `paused` is already in the constraint, not a migration task.

3. **Backfill zero vs. NULL for outreach KPI columns**
   - What we know: New daily_reports columns should default to 0 (not NULL) for math safety (SUM queries)
   - What's unclear: Whether old reports with no outreach data should be 0 or distinguishable from "submitted with 0"
   - Recommendation: Backfill with 0 (matching the existing `outreach_count NOT NULL DEFAULT 0` pattern). Future queries use `outreach_brands + outreach_influencers` which is safe with 0.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsc type check | Yes | v24.13.0 | — |
| TypeScript (tsc) | Type check gate | Yes | 5.9.3 | — |
| Supabase CLI | Migration apply | No | — | Apply via Supabase dashboard SQL editor |
| Supabase local DB | Migration test locally | Unknown | — | Apply direct to hosted Supabase project |

**Missing dependencies with no fallback:**
- None that block the phase. All SQL can be applied via the Supabase dashboard SQL editor if the CLI is not available.

**Missing dependencies with fallback:**
- Supabase CLI not found in PATH — migrations can be applied via the Supabase project dashboard (SQL > Run query). The migration file is still written to `supabase/migrations/` for version control.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc) — no Jest/Vitest in this project |
| Config file | `tsconfig.json` |
| Quick run command | `npx tsc --noEmit` |
| Full suite command | `npx tsc --noEmit && npm run lint` |

No unit test framework is installed (no Jest, Vitest, or test runner in package.json). TypeScript type checking is the primary automated validation mechanism. The phase success criteria explicitly requires `npx tsc --noEmit` to pass with zero errors.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WORK-09 | `session_minutes` column on `work_sessions` | DB verification (manual) | `npx tsc --noEmit` (for type safety of any TS referencing it) | N/A |
| WORK-09 | Cycle constraint dropped | DB verification (manual) | N/A | N/A |
| KPI-07 | 5 new columns on `daily_reports` | DB verification (manual) | N/A | N/A |
| KPI-07 | `restrict_coach_report_update` pins new columns | DB verification (manual) | N/A | N/A |
| ROAD-01 | `sessionDurationOptions` exported from config.ts | tsc | `npx tsc --noEmit` | Will be created |
| ROAD-01 | `KPI_TARGETS` exported from config.ts | tsc | `npx tsc --noEmit` | Will be created |
| ROAD-01 | `target_days` on each ROADMAP_STEPS entry | tsc | `npx tsc --noEmit` | Will be created |
| ROAD-01 | `getTodayUTC()` exported from utils.ts | tsc | `npx tsc --noEmit` | Will be created |

DB schema changes cannot be automatically verified by tsc. Manual verification via Supabase dashboard or psql is the gate for WORK-09 and KPI-07.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && npm run lint`
- **Phase gate:** `npx tsc --noEmit` green before `/gsd:verify-work`

### Wave 0 Gaps

None — no test framework to install. The only gap is the absence of automated DB schema verification, which is inherent to this project's tooling setup (manual Supabase dashboard check is acceptable).

---

## Project Constraints (from CLAUDE.md)

These directives apply to all code written in this phase:

1. **Config is truth** — import from `src/lib/config.ts`, never hardcode roles/nav/roadmap. New exports (`KPI_TARGETS`, `sessionDurationOptions`, `defaultSessionMinutes`, `target_days`) must live in config.ts.
2. **Admin client only in server code** — not applicable to this phase (no API routes).
3. **Proxy not middleware** — not applicable to this phase.
4. **Google OAuth only** — not applicable to this phase.
5. **Light theme with ima-* tokens** — not applicable to this phase (no UI).
6. **motion-safe:** — not applicable to this phase (no UI).
7. **44px touch targets** — not applicable to this phase (no UI).
8. **Accessible labels** — not applicable to this phase (no UI).
9. **Admin client in API routes** — not applicable to this phase (no API routes).
10. **Never swallow errors** — not applicable to this phase (no async code).
11. **Check response.ok** — not applicable to this phase (no fetch calls).
12. **Zod import** — `import { z } from "zod"`, never `"zod/v4"`. Not needed this phase but noted for context.
13. **ima-* tokens only** — not applicable to this phase (no UI).

The zod package installed is v4.3.6. The correct import is `import { z } from "zod"` (NOT `"zod/v4"`) as required by CLAUDE.md.

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/00001_create_tables.sql` — Exact schema for `work_sessions` and `daily_reports`, `restrict_coach_report_update` trigger body (lines 411-428)
- `supabase/migrations/00003_add_pause_support.sql` — Confirmed `paused` status already in CHECK constraint; DROP/ADD pattern for CHECK constraints
- `src/lib/config.ts` — Current `WORK_TRACKER` shape, `ROADMAP_STEPS` shape, `DAILY_REPORT` shape, `VALIDATION` section; default export structure
- `src/lib/utils.ts` — Existing `getToday()` implementation (template for `getTodayUTC()`)
- `.planning/phases/13-schema-config-foundation/13-CONTEXT.md` — All locked decisions and implementation notes
- `.planning/STATE.md` — NOT NULL migration pattern, trigger atomicity rule, getTodayUTC formula, cyclesPerDay consumer count
- `package.json` — Confirmed no test runner installed; zod v4.3.6 installed; date-fns v4 available but unneeded

### Secondary (MEDIUM confidence)

- Postgres documentation pattern for ALTER TABLE / DROP CONSTRAINT — constraint auto-naming convention `{table}_{column}_check` is standard Postgres behavior, verified by reading the 00001 DDL (no explicit CONSTRAINT name used)

### Tertiary (LOW confidence)

- target_days placeholder values (7 × step number) — reasonable guess; needs confirmation from Abu Lahya before Phase 18

---

## Metadata

**Confidence breakdown:**

- Migration patterns: HIGH — read actual migration files; patterns match STATE.md documented rules
- Config structure: HIGH — read config.ts directly; all insertion points identified
- Trigger update: HIGH — read exact trigger body from 00001; update is mechanical column list addition
- target_days values: LOW — placeholders pending Abu Lahya confirmation
- Supabase CLI availability: confirmed not in PATH; fallback via dashboard is viable

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain — Postgres and TypeScript patterns are not fast-moving)
