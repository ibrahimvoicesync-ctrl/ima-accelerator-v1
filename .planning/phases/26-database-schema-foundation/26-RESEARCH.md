# Phase 26: Database Schema Foundation - Research

**Researched:** 2026-03-31
**Domain:** PostgreSQL schema design — Supabase migrations, RLS policies, JSONB tables, composite indexes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single migration file `00013_daily_plans_undo_log.sql` for both tables — consistent with Phase 13 and Phase 19 pattern of cohesive schema migrations.
- **D-02:** UTC enforcement is application-level only. The `daily_plans.date` column uses `DEFAULT CURRENT_DATE` (Supabase runs UTC by default). No DB-level CHECK constraint for UTC safety — the app already has `getTodayUTC()` in `src/lib/utils.ts` which must be used consistently when creating and querying plans.
- **D-03:** RLS policies are sufficient for append-only enforcement — no INSERT-only trigger needed. The roadmap_undo_log table gets RLS policies that allow INSERT for coach/owner and SELECT for actors on their own rows, with no UPDATE or DELETE policies. Admin code (service_role) is trusted.
- **D-04:** No DB-level CHECK constraints on plan_json JSONB structure. Validation is purely at the application level via Zod safeParse (per v1.3 research decision: "always Zod safeParse at read, never TypeScript cast").

### Claude's Discretion

- Index strategy details beyond the required `(student_id, date)` composite index on daily_plans
- Column types for roadmap_undo_log (text vs enum for actor_role, integer vs smallint for step_number)
- RLS policy naming conventions (follow existing pattern from 00001_create_tables.sql)
- Whether to add foreign key constraints on actor_id/student_id referencing users(id) with CASCADE

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-07 | daily_plans table stores one plan per student per day with plan_json (array of session configs), UNIQUE(student_id, date) constraint | Table DDL pattern from 00001 + JSONB column + UNIQUE constraint design fully documented below |
| UNDO-05 | Every undo action is logged to roadmap_undo_log table (who, when, which student, which step) | Append-only pattern from 00012 (RLS enabled, no policies except INSERT/SELECT) documented below |
</phase_requirements>

---

## Summary

Phase 26 is pure database schema work: write one migration file that creates two new tables with correct columns, constraints, indexes, and RLS policies. No application code changes. No API routes. No UI.

All patterns needed already exist in this codebase. The `00001_create_tables.sql` migration establishes the canonical template for every table: `id uuid DEFAULT gen_random_uuid() PRIMARY KEY`, `timestamptz NOT NULL DEFAULT now()` for timestamps, `REFERENCES public.users(id) ON DELETE CASCADE` for foreign keys, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and `(select get_user_role())` / `(select get_user_id())` initplan wrappers on all policies. The `00012_rate_limit_log.sql` migration demonstrates the exact append-only pattern: RLS enabled, no JWT-scoped policies, only service_role access.

The discretionary decisions are: use `text` for `actor_role` (consistent with existing `role` columns in `users` and `magic_links`), use `integer` for `step_number` (consistent with `roadmap_progress.step_number`), add foreign key constraints on all uuid columns referencing `users(id) ON DELETE CASCADE` (consistent with every other table in the schema), and follow the `"role_operation_table"` naming convention for policies (e.g., `"student_insert_daily_plans"`).

**Primary recommendation:** Write `supabase/migrations/00013_daily_plans_undo_log.sql` following the exact structural template of `00001_create_tables.sql`. Deploy via `npx supabase db push --linked`. Verify with `SELECT * FROM information_schema.tables` and RLS policy inspection.

---

## Standard Stack

### Core (No New Dependencies)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL (via Supabase) | 17 (config.toml `major_version = 17`) | All DDL — tables, indexes, RLS, constraints | Platform database |
| Supabase CLI | 2.78.1 (installed as devDependency) | Deploy migration via `npx supabase db push --linked` | Project's established deployment tool |
| `supabase/migrations/` | — | Migration file location | Established project convention — all 12 prior migrations here |

### No New npm Dependencies

This phase installs nothing. All work is SQL in a single migration file.

**Deployment command:**
```bash
npx supabase db push --linked
```

---

## Architecture Patterns

### Established Migration Structure

Every migration in this project follows this exact structure (verified across 00001–00012):

```
Section 1: Table DDL (CREATE TABLE)
Section 2: Indexes (CREATE INDEX)
Section 3: RLS enable (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
Section 4: RLS policies (CREATE POLICY ...)
```

### Pattern 1: Standard Table DDL

From `00001_create_tables.sql` — the canonical template for new tables:

```sql
-- Source: supabase/migrations/00001_create_tables.sql
CREATE TABLE public.{table_name} (
  id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz  NOT NULL DEFAULT now()
);
```

Key rules (all observed in existing migrations):
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` — always uuid, always gen_random_uuid()
- Foreign keys always `REFERENCES public.users(id) ON DELETE CASCADE`
- Timestamps always `timestamptz NOT NULL DEFAULT now()`
- Date columns always `date` type (not `timestamptz`)

### Pattern 2: JSONB Column (no constraints per D-04)

```sql
-- Source: CONTEXT.md D-04 decision
plan_json jsonb NOT NULL
```

No CHECK constraint on structure. Zod handles all structural validation at application layer.

### Pattern 3: UNIQUE Constraint on (student_id, date)

From `00001_create_tables.sql` — the `daily_reports` table uses the same one-per-student-per-day pattern:

```sql
-- Source: supabase/migrations/00001_create_tables.sql
CREATE UNIQUE INDEX idx_daily_reports_student_date ON public.daily_reports(student_id, date);
```

For `daily_plans`, the UNIQUE constraint can be expressed as either a `UNIQUE INDEX` or an inline `UNIQUE(student_id, date)` constraint on the table. Both work. The project uses `CREATE UNIQUE INDEX` exclusively (not inline UNIQUE) — follow that pattern.

### Pattern 4: RLS Initplan Wrappers

From `00001_create_tables.sql` — EVERY policy uses `(select get_user_role())` and `(select get_user_id())` scalar subquery wrappers:

```sql
-- Source: supabase/migrations/00001_create_tables.sql
CREATE POLICY "student_select_work_sessions" ON public.work_sessions
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));

CREATE POLICY "student_insert_work_sessions" ON public.work_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));
```

The `(select ...)` wrapper forces Postgres to evaluate the function once per query (initplan), not once per row. Both `get_user_role()` and `get_user_id()` are `STABLE SECURITY DEFINER` functions already defined in 00001 — they are available to all subsequent migrations without redefinition.

### Pattern 5: Append-Only Table (RLS enabled, no JWT policies)

From `00012_rate_limit_log.sql` — RLS enabled but no JWT-scoped policies, only service_role access:

```sql
-- Source: supabase/migrations/00012_rate_limit_log.sql
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No CREATE POLICY statements follow
-- service_role bypasses RLS entirely
```

However, `roadmap_undo_log` differs from `rate_limit_log`: coaches and owners need to INSERT via their JWT (authenticated client), and actors need to SELECT their own rows. So unlike 00012, this table DOES need JWT RLS policies — just no UPDATE or DELETE policies.

### Pattern 6: Policy Naming Convention

All policies in the project follow `"role_operation_table"` naming. Examples from 00001:
- `"student_select_work_sessions"`
- `"student_insert_work_sessions"`
- `"coach_select_roadmap"`
- `"owner_select_invites"`

Follow this exact convention for new policies.

### Pattern 7: Index Naming Convention

All indexes follow `idx_{table}_{columns}` naming. Examples from 00001:
- `idx_work_sessions_student_date`
- `idx_roadmap_progress_student`
- `idx_daily_reports_student_date`

### Recommended Migration Structure for 00013

```sql
-- ============================================================================
-- Phase 26: Database Schema Foundation
-- Migration: 00013_daily_plans_undo_log.sql
-- ============================================================================

-- ============================================================================
-- Section 1: daily_plans table
-- ============================================================================
CREATE TABLE public.daily_plans ( ... );

-- ============================================================================
-- Section 2: daily_plans indexes
-- ============================================================================
CREATE UNIQUE INDEX idx_daily_plans_student_date ON public.daily_plans(student_id, date);

-- ============================================================================
-- Section 3: roadmap_undo_log table
-- ============================================================================
CREATE TABLE public.roadmap_undo_log ( ... );

-- ============================================================================
-- Section 4: roadmap_undo_log indexes (if any)
-- ============================================================================

-- ============================================================================
-- Section 5: Enable RLS on both tables
-- ============================================================================
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_undo_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Section 6: RLS policies — daily_plans
-- ============================================================================

-- ============================================================================
-- Section 7: RLS policies — roadmap_undo_log
-- ============================================================================
```

### Anti-Patterns to Avoid

- **Bare `auth.uid()` in RLS policies:** Always wrap as `(select get_user_id())` — bare `auth.uid()` is evaluated per row, not per query. Every existing policy in this project uses the wrapper. Do not deviate.
- **Using `get_user_id()` as direct auth check:** The initplan wrapper pattern is `student_id = (select get_user_id())`, NOT `student_id = auth.uid()` — the helper function joins to the `users` table.
- **Redefining `get_user_role()` or `get_user_id()`:** These are already defined in 00001. Never redefine them in a later migration — use them as-is.
- **Hardcoding role values:** Always use string literals `'student'`, `'coach'`, `'owner'` consistent with existing policies. No enums needed.
- **Migration without section comments:** Every migration in this project has clear section headers. Follow the pattern.
- **Creating a trigger for append-only enforcement:** D-03 locked decision — RLS-only is sufficient for coach/owner access; service_role bypasses RLS and is trusted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-row auth evaluation | Custom per-row function | `(select get_user_id())` initplan wrapper | Already defined in 00001; forces once-per-query evaluation |
| UUID generation | Custom sequence or trigger | `DEFAULT gen_random_uuid()` | Built-in Postgres function, consistent with all 6 existing tables |
| Append-only enforcement | Trigger that raises exception on UPDATE/DELETE | No UPDATE/DELETE RLS policies | D-03: RLS sufficient; triggers add complexity with no benefit |
| JSONB schema validation | DB-level CHECK constraint | Zod safeParse at application layer | D-04: validated at API boundary, not DB |

---

## Discretionary Decisions (Claude's Discretion Resolved)

### actor_role column type

Use `text NOT NULL`. Reasoning:
- Every existing role column in this codebase is `text` or `varchar` (users.role is `varchar(20)`, magic_links.role is `text`)
- No enum type exists in the schema; introducing one here would be inconsistent
- `text` with a CHECK constraint was considered but D-03/D-04 philosophy prefers app-level validation
- `text NOT NULL` is simplest and consistent

### step_number column type

Use `integer NOT NULL`. Reasoning:
- `roadmap_progress.step_number` is `integer` — the undo log references the same concept
- `smallint` would save 2 bytes per row but adds cognitive overhead with no practical benefit at this scale
- Consistent with existing `step_number` column definition

### Foreign key constraints on actor_id and student_id

Add `REFERENCES public.users(id) ON DELETE CASCADE` on both. Reasoning:
- Every uuid column that references a user in this schema has this constraint (work_sessions.student_id, roadmap_progress.student_id, daily_reports.student_id, rate_limit_log.user_id, etc.)
- Deleting a user should cascade-delete their undo log entries — the log is useless without the referenced user
- Consistent with the entire existing schema

### daily_plans RLS policies

Three policies needed:
1. `"student_insert_daily_plans"` — student can INSERT rows where `student_id = (select get_user_id())`
2. `"student_select_daily_plans"` — student can SELECT their own rows
3. `"owner_select_daily_plans"` — owner can SELECT all rows
4. `"coach_select_daily_plans"` — coach can SELECT rows for their assigned students

Students INSERT and SELECT their own plans. Coaches and owner can read plans (needed by future Phase 28/29 features like ENH-08 Coach visibility). No UPDATE policy — plans are write-once via POST with idempotent conflict return (Phase 28 handles this at API level).

### roadmap_undo_log RLS policies

Three policies needed:
1. `"coach_insert_roadmap_undo_log"` — coach can INSERT (actor_id must be their own user_id)
2. `"owner_insert_roadmap_undo_log"` — owner can INSERT
3. `"coach_select_roadmap_undo_log"` — coach can SELECT rows where `actor_id = (select get_user_id())`
4. `"owner_select_roadmap_undo_log"` — owner can SELECT all rows

No student INSERT or SELECT. No UPDATE or DELETE for anyone (append-only per D-03).

### Additional index on roadmap_undo_log

Add `idx_roadmap_undo_log_student` on `(student_id)` — Phase 27 will query "all undo events for student X" when rendering the undo history. This is a single-column index on a lightweight table; low cost, good coverage for the expected access pattern.

---

## Common Pitfalls

### Pitfall 1: Missing `(select ...)` wrapper on `get_user_id()` in WITH CHECK

**What goes wrong:** Policy compiles and works functionally but evaluates per row instead of once per query — 100x performance regression at 5k rows.
**Why it happens:** The bare call `get_user_id() = student_id` is syntactically valid. The optimizer does not warn.
**How to avoid:** Every `get_user_id()` and `get_user_role()` call in a policy MUST be wrapped: `(select get_user_id())`, `(select get_user_role())`.
**Warning signs:** EXPLAIN shows "InitPlan" absent from policy evaluation nodes.

### Pitfall 2: UNIQUE constraint allows duplicate plan insertion on same UTC/local day boundary

**What goes wrong:** Student in UTC+4 timezone creates a plan at 11:45 PM local (which is 7:45 PM UTC = same UTC date). If they refresh at midnight local (8:00 PM UTC = still same UTC date), no duplicate. But if Supabase is ever not UTC, the default `CURRENT_DATE` could mismatch application `getTodayUTC()`.
**Why it happens:** `DEFAULT CURRENT_DATE` uses the database session timezone. Supabase hosted always runs UTC.
**How to avoid:** D-02 locked decision — no DB-level UTC enforcement needed. Document that `getTodayUTC()` in application code is the single source of truth for date values written to this column.
**Warning signs:** None at current scale. Becomes an issue only if database timezone setting is ever changed (it won't be on hosted Supabase).

### Pitfall 3: Writing plan_json without version field

**What goes wrong:** Phase 28 stores plan_json without a `version` field. When plan_json schema evolves in v1.4+, old records cannot be distinguished from new ones — Zod parse fails silently and falls back to "no plan today" for every historical record.
**Why it happens:** v1.3 research decision requires `plan_json` to include `version: 1`. The DB schema doesn't enforce this (D-04), so it's easy to forget.
**How to avoid:** Document in the migration comment that `plan_json` must include `{ version: 1, ... }`. Phase 28 API implementation must enforce this via Zod schema.
**Warning signs:** Phase 28 Zod schema does not include a `version` field.

### Pitfall 4: roadmap_undo_log actor_id / student_id confusion

**What goes wrong:** INSERT policy checks `actor_id = (select get_user_id())` but at runtime the API inserts the coach's user_id as student_id instead of actor_id — policy violation causes a silent empty INSERT or 403.
**Why it happens:** Two uuid columns referencing users in one table; easy to swap in application code.
**How to avoid:** Policy names clearly separate actor vs student. Phase 27 implementation must verify column assignment in INSERT.
**Warning signs:** Phase 27 API returns 201 but no row appears in the table (RLS denied silently).

### Pitfall 5: Forgetting grants for new tables

**What goes wrong:** New tables exist but `anon`, `authenticated`, `service_role` cannot access them because `GRANT ALL ON ALL TABLES` only covers tables that existed at the time of that statement.
**Why it happens:** The grants in `00001` cover tables created BEFORE or AT grant time. Tables in `00013` were created after. The `ALTER DEFAULT PRIVILEGES` in 00001 should cover new tables, but this is worth verifying.
**How to avoid:** The project uses `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role` in 00001 — this statement covers all FUTURE tables created by the same role. Confirmed safe. No extra grants needed in 00013.
**Warning signs:** API route returns 403 or "permission denied for table daily_plans" even when service_role is used.

---

## Code Examples

### daily_plans table DDL

```sql
-- Source: pattern from supabase/migrations/00001_create_tables.sql + CONTEXT.md decisions
CREATE TABLE public.daily_plans (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date       date    NOT NULL DEFAULT CURRENT_DATE,
  plan_json  jsonb   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_daily_plans_student_date ON public.daily_plans(student_id, date);
```

### roadmap_undo_log table DDL

```sql
-- Source: pattern from supabase/migrations/00001_create_tables.sql + CONTEXT.md decisions
CREATE TABLE public.roadmap_undo_log (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_role  text         NOT NULL,
  student_id  uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  step_number integer      NOT NULL,
  undone_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX idx_roadmap_undo_log_student ON public.roadmap_undo_log(student_id);
```

### RLS enable

```sql
-- Source: pattern from supabase/migrations/00001_create_tables.sql
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_undo_log ENABLE ROW LEVEL SECURITY;
```

### daily_plans RLS policies

```sql
-- Source: pattern from supabase/migrations/00001_create_tables.sql
CREATE POLICY "student_select_daily_plans" ON public.daily_plans
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));

CREATE POLICY "student_insert_daily_plans" ON public.daily_plans
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));

CREATE POLICY "coach_select_daily_plans" ON public.daily_plans
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (SELECT id FROM public.users WHERE coach_id = (select get_user_id()))
  );

CREATE POLICY "owner_select_daily_plans" ON public.daily_plans
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');
```

### roadmap_undo_log RLS policies

```sql
-- Source: pattern from supabase/migrations/00001_create_tables.sql
-- Append-only: INSERT and SELECT only, no UPDATE or DELETE
CREATE POLICY "coach_insert_roadmap_undo_log" ON public.roadmap_undo_log
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) = 'coach'
    AND actor_id = (select get_user_id())
  );

CREATE POLICY "owner_insert_roadmap_undo_log" ON public.roadmap_undo_log
  FOR INSERT TO authenticated
  WITH CHECK ((select get_user_role()) = 'owner');

CREATE POLICY "coach_select_roadmap_undo_log" ON public.roadmap_undo_log
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND actor_id = (select get_user_id())
  );

CREATE POLICY "owner_select_roadmap_undo_log" ON public.roadmap_undo_log
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `auth.uid()` in RLS | `(select get_user_id())` initplan wrapper | Phase 19 confirmed | Per-query evaluation instead of per-row |
| Separate migration per concern | Cohesive migration per phase | Established in Phase 19 | One migration = one deployable unit |

---

## Open Questions

1. **Should `roadmap_undo_log.actor_role` have a CHECK constraint (text IN ('coach', 'owner'))?**
   - What we know: D-04 discourages DB-level constraints on json. But actor_role is a text column, not JSONB.
   - What's unclear: D-04 was specifically about plan_json JSONB. A simple CHECK on a text column is less contentious and consistent with `users.role CHECK (role IN ('owner', 'coach', 'student'))`.
   - Recommendation: Add `CHECK (actor_role IN ('coach', 'owner'))` — it's a plain text constraint, not a JSONB schema constraint. D-04 does not prohibit it. Aligns with how `users.role` and `invites.role` are constrained.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration deployment (`npx supabase db push`) | Yes (devDependency) | 2.78.1 | — |
| Supabase linked project | `npx supabase db push --linked` | Yes (`.temp/project-ref` exists: `uzfzoxfakxmsbttelhnr`) | — | — |
| PostgreSQL (hosted) | Schema changes | Yes (Supabase hosted, version 17) | 17 | — |

**Missing dependencies with no fallback:** None — all tools available.

---

## Validation Architecture

### Test Framework

No automated test framework is installed for this project (no jest, vitest, or pytest config detected). Phase 26 is pure SQL DDL — validation is schema inspection via Supabase Studio or psql.

| Property | Value |
|----------|-------|
| Framework | None (SQL migration — no unit test framework) |
| Config file | none |
| Quick run command | `npx supabase db push --linked --dry-run` |
| Full suite command | `npx supabase db push --linked` then manual schema inspection |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Verification Method | Automated? |
|--------|----------|-----------|---------------------|------------|
| PLAN-07 | daily_plans table exists with correct columns, UNIQUE(student_id, date), RLS | manual schema inspection | Supabase Studio > Table Editor; SELECT from information_schema.tables | Manual only — no test framework |
| UNDO-05 | roadmap_undo_log table exists, append-only (no UPDATE/DELETE policies), INSERT/SELECT for coach/owner | manual policy inspection | Supabase Studio > Authentication > Policies | Manual only |

### Per-Plan Verification

Each plan should end with:
1. `npx supabase db push --linked` — migration applies without error
2. Spot-check in Supabase Studio: table exists, columns visible, RLS indicator shows enabled
3. Policy list shows expected policies and NO update/delete policies on roadmap_undo_log

### Wave 0 Gaps

None — no test infrastructure needed for a pure SQL migration phase. Verification is manual schema inspection, which is appropriate for DDL work.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To Phase 26 |
|-----------|---------------------|
| Config is truth — import from src/lib/config.ts | Not applicable (no application code changes) |
| Admin client only in server code | Not applicable (no application code changes) |
| Proxy not middleware | Not applicable (no application code changes) |
| Google OAuth only | Not applicable |
| Light theme with blue accents | Not applicable |
| motion-safe on animate-* classes | Not applicable (no UI) |
| 44px touch targets | Not applicable (no UI) |
| Accessible labels | Not applicable (no UI) |
| Admin client in API routes | Not applicable (no API routes in this phase) |
| Never swallow errors | Not applicable |
| Check response.ok | Not applicable |
| Zod import `from "zod"` never `"zod/v4"` | Not applicable (no application code) |
| ima-* tokens only | Not applicable (no UI) |

**This phase has zero application code changes. All CLAUDE.md hard rules are not applicable. The only deliverable is `supabase/migrations/00013_daily_plans_undo_log.sql`.**

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/00001_create_tables.sql` — Canonical table DDL, index naming, RLS policy naming, initplan wrapper pattern, foreign key conventions
- `supabase/migrations/00012_rate_limit_log.sql` — Append-only table pattern (RLS enabled, no JWT policies)
- `supabase/migrations/00011_write_path.sql` — Most recent table creation (student_kpi_summaries)
- `supabase/migrations/00009_database_foundation.sql` — Index naming and IF NOT EXISTS pattern
- `.planning/phases/26-database-schema-foundation/26-CONTEXT.md` — Locked decisions D-01 through D-04

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — PLAN-07 and UNDO-05 requirement text
- `.planning/ROADMAP.md` — Phase 26 success criteria (exact column names)
- `.planning/STATE.md` — v1.3 research decisions (plan_json version field, Zod safeParse pattern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; Supabase CLI version confirmed from package.json
- Architecture: HIGH — all patterns verified from existing migrations in this codebase
- Pitfalls: HIGH — identified from codebase inspection and established patterns; no speculative claims
- Discretionary decisions: HIGH — all resolved by examining existing schema conventions directly

**Research date:** 2026-03-31
**Valid until:** Stable — SQL DDL patterns don't change; valid indefinitely unless Supabase PostgreSQL major version changes
