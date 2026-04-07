# Phase 30: Database Migration - Research

**Researched:** 2026-04-03
**Domain:** Supabase Postgres schema migration — new tables, ALTER TABLE constraints, RLS policies, TypeScript types
**Confidence:** HIGH

## Summary

Phase 30 is a pure database schema phase. It creates a single migration file `00015_v1_4_schema.sql` that adds four new tables (report_comments, messages, resources, glossary_terms), expands three role CHECK constraints to include `student_diy`, enables RLS on the four new tables, and updates `src/lib/types.ts` with the new Row/Insert/Update types.

All patterns required to complete this phase already exist in the codebase. The existing migrations establish the exact SQL conventions (initplan RLS, index naming, uuid/timestamptz column defaults, FK CASCADE/SET NULL choices) that the new migration must follow. The TypeScript types file follows a fully hand-maintained pattern — there is no code-gen step in this project's CI.

The one area requiring judgment is the exact column definitions for each of the four new tables. These are fully derivable from downstream feature requirements (COMMENT-01 through RES-09) and from the locked design decision D-01 (single messages table with `is_broadcast` flag).

**Primary recommendation:** Write `00015_v1_4_schema.sql` as a single idempotent migration following the exact structural conventions of `00013_daily_plans_undo_log.sql`, then manually update `src/lib/types.ts` to match.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single `messages` table with `is_broadcast` boolean flag — no separate broadcast table. `recipient_id` is NULL for broadcast messages. `coach_id` serves as the room/conversation anchor.
- **D-02:** Per-message `read_at` timestamptz column on the messages table. No separate read_receipts table. Unread badge computed as `COUNT(*) WHERE recipient_id = :user_id AND read_at IS NULL`.
- **D-03:** Single migration file `00015_v1_4_schema.sql` covering all 4 new tables + role CHECK constraint ALTERs. Fewer migrations = less risk.
- **D-04 (RLS):** Defense-in-depth only. RLS policies are a safety net, not the primary access control. Real enforcement is in `proxy.ts` + API route role checks + admin client queries. `student_diy` restrictions are enforced at the app layer (proxy guard + nav config), not via RLS exclusion.

### Claude's Discretion

- Exact column types and sizes for all 4 tables (derive from downstream phase requirements COMMENT-01 through RES-09)
- Index strategy beyond what's required for hot query paths
- RLS policy naming conventions (follow existing patterns from 00001_create_tables.sql)
- Foreign key CASCADE/RESTRICT choices on new tables

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | All 4 new tables (report_comments, messages, resources, glossary_terms) exist with correct columns, constraints, and indexes in a single migration (00015) | Column derivation from COMMENT-01–05, CHAT-01–13, RES-01–09 documented in Architecture Patterns section |
| SCHEMA-02 | Users, invites, and magic_links role CHECK constraints accept 'student_diy' as a valid value | ALTER TABLE pattern verified in 00006_v1_1_schema.sql; exact DROP/ADD syntax documented below |
| SCHEMA-03 | RLS policies are enabled on all 4 new tables with appropriate read/write restrictions | RLS initplan pattern documented; per-table policy matrix in Architecture Patterns |
| SCHEMA-04 | TypeScript types include Row/Insert/Update types for all 4 new tables and the Role union includes 'student_diy' | Manual edit pattern confirmed — no code-gen in this project; exact type shapes documented |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Postgres | (hosted, current) | Schema host | Project's database layer |
| supabase CLI | local (migrations dir exists) | Migration file execution via `supabase db push` | Established project pattern |
| TypeScript | strict | Manual types file | No code-gen step used in this project |

### Supporting

None — this phase has no npm dependencies. It is SQL + TypeScript edits only.

**Installation:** No installation required for this phase.

---

## Architecture Patterns

### Migration File Organization

The project uses sequential zero-padded 5-digit migration names in `supabase/migrations/`. Next file: `00015_v1_4_schema.sql`. Existing migrations are NOT idempotent — they use `CREATE TABLE` not `CREATE TABLE IF NOT EXISTS`. Follow the same pattern (the file runs once against the target DB).

Migration `00013_daily_plans_undo_log.sql` is the canonical structural reference: sections labeled with comments, CREATE TABLE, CREATE INDEX, ALTER TABLE ENABLE ROW LEVEL SECURITY, CREATE POLICY blocks per table.

### Pattern 1: Table Creation

```sql
-- Source: supabase/migrations/00013_daily_plans_undo_log.sql
CREATE TABLE public.report_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid        NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  coach_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

Key conventions:
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `timestamptz NOT NULL DEFAULT now()` for all timestamps
- `REFERENCES public.users(id) ON DELETE CASCADE` for FK to users
- `text` for unbounded strings, `varchar(N)` when a cap is meaningful

### Pattern 2: Role CHECK Constraint ALTER

The existing CHECK constraint syntax (from 00001):
```sql
CHECK (role IN ('owner', 'coach', 'student'))
```

PostgreSQL does not support adding a value to an existing CHECK constraint in-place. The correct approach is DROP + ADD in a single transaction:

```sql
-- Source: pattern from 00006_v1_1_schema.sql (DROP CONSTRAINT IF EXISTS)
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'coach', 'student', 'student_diy'));
```

This must be applied to three tables: `users`, `invites`, `magic_links`.

**Constraint name discovery:** The constraint names are not explicitly defined in 00001 — Postgres auto-generates them as `{table}_role_check`. Verify before writing by checking `pg_constraint` or using `DROP CONSTRAINT IF EXISTS` with the auto-generated names:
- `users_role_check`
- `invites_role_check`
- `magic_links_role_check`

The `IF EXISTS` guard makes the DROP safe even if names differ.

### Pattern 3: RLS initplan Wrapper

All RLS policies in this codebase wrap `get_user_role()` and `get_user_id()` in scalar subqueries to force initplan evaluation (once per query, not per row). This is a deliberate performance pattern.

```sql
-- Source: supabase/migrations/00001_create_tables.sql
CREATE POLICY "owner_select_report_comments" ON public.report_comments
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');

CREATE POLICY "coach_select_report_comments" ON public.report_comments
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND report_id IN (
      SELECT dr.id FROM public.daily_reports dr
      JOIN public.users s ON s.id = dr.student_id
      WHERE s.coach_id = (select get_user_id())
    )
  );
```

**Per-table policy matrix (to derive in planning):**

| Table | Roles with SELECT | Roles with INSERT | Roles with UPDATE | Roles with DELETE |
|-------|-------------------|-------------------|-------------------|-------------------|
| report_comments | owner, coach (own students) | owner, coach (own students) | owner, coach (own row) | owner, coach (own row) |
| messages | owner, coach (sent/received), student (sent/received) | coach (sender), student (sender) | coach+student (own — for read_at only) | — |
| resources | owner, coach, student | owner, coach | owner, coach | owner, coach |
| glossary_terms | owner, coach, student | owner, coach | owner, coach | owner, coach |

Note: Per D-04, `student_diy` is excluded from all four tables' RLS policies by omission — app-layer proxy/nav guards handle student_diy access denial. The RLS policies match the role names from `get_user_role()` which returns a string like `'coach'`, `'student'`, etc.

### Pattern 4: Index Naming

```sql
-- Source: supabase/migrations/00001_create_tables.sql
CREATE INDEX idx_{table}_{columns} ON public.{table}({columns});
```

Hot query paths that need indexes:
- `report_comments`: `(report_id)` — look up comments for a given report
- `messages`: `(coach_id, recipient_id)` — conversation thread lookup; `(recipient_id, read_at)` — unread count query (CHAT-06/07)
- `resources`: no compound index needed; a simple `(created_at)` or none is fine
- `glossary_terms`: `(term)` — case-insensitive search (RES-08); the UNIQUE constraint on term (RES-09) already creates an index

### Pattern 5: Unique Constraint with Case-Insensitive Comparison (glossary_terms)

RES-09 requires case-insensitive unique constraint on glossary term name. PostgreSQL approach:

```sql
CREATE UNIQUE INDEX idx_glossary_terms_term_lower ON public.glossary_terms(lower(term));
```

A functional unique index on `lower(term)` enforces uniqueness without a custom collation. Queries using `WHERE lower(term) = lower(:search)` use this index.

### Pattern 6: TypeScript Type Update

`src/lib/types.ts` is hand-maintained (no code-gen in this project — see file header comment). The pattern per table is a three-shape object: `Row`, `Insert` (all non-default columns required, defaulted columns optional), `Update` (all columns optional).

Current Role union in `src/lib/types.ts` (line 14):
```typescript
role: "owner" | "coach" | "student";
```

Must expand to:
```typescript
role: "owner" | "coach" | "student" | "student_diy";
```

This change appears in THREE places in types.ts: `users.Row.role`, `users.Insert.role`, `users.Update.role`. The same expansion applies to `invites` and `magic_links` role fields.

Also note: `src/lib/config.ts` defines `ROLES` and `Role` type — Phase 31 expands that, but per SCHEMA-04, `types.ts` must include `student_diy` NOW. The `types.ts` Role union is independent of the `config.ts` Role type.

### Recommended Project Structure (migration sections)

```sql
-- 00015_v1_4_schema.sql
-- Section 1: report_comments table + indexes
-- Section 2: messages table + indexes
-- Section 3: resources table + indexes
-- Section 4: glossary_terms table + indexes + unique constraint
-- Section 5: Role CHECK constraint ALTERs (users, invites, magic_links)
-- Section 6: Enable RLS on all 4 new tables
-- Section 7: RLS policies — report_comments
-- Section 8: RLS policies — messages
-- Section 9: RLS policies — resources
-- Section 10: RLS policies — glossary_terms
```

### Anti-Patterns to Avoid

- **Separate broadcast table:** Locked decision D-01 prohibits this. Single messages table with `is_broadcast` boolean.
- **read_receipts table:** Locked decision D-02 prohibits this. `read_at timestamptz` column on messages.
- **Multiple migration files:** Locked decision D-03 requires a single file.
- **student_diy RLS exclusion policies:** Per D-04, do NOT write `(select get_user_role()) != 'student_diy'` style exclusions. App layer handles student_diy blocking.
- **Hardcoding role values in HAVING/WHERE in SQL:** Use the `get_user_role()` function consistently.
- **CURRENT_DATE in functions:** Project has an established rule (from STATE.md) to pass UTC dates from application — do not use `CURRENT_DATE` inside Postgres RPC functions. For Phase 30 this is not relevant (no RPCs), but table defaults using `DEFAULT CURRENT_DATE` on a `date` column are fine (it's a table default, not computed logic).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive unique on glossary terms | Manual duplicate check in API | Functional unique index `lower(term)` | DB enforces at insert time, handles race conditions |
| Unread message count | Separate read_receipts table | `read_at IS NULL` on messages table (D-02) | Simpler, fewer joins, locked design decision |
| Role expansion | New column or separate role table | `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` | Standard Postgres approach, no data migration needed |

---

## Derived Column Specifications

### report_comments table (from COMMENT-01 through COMMENT-05)

| Column | Type | Constraints | Derivation |
|--------|------|-------------|------------|
| id | uuid | PK DEFAULT gen_random_uuid() | Standard |
| report_id | uuid | NOT NULL FK daily_reports(id) ON DELETE CASCADE | COMMENT-01: comments belong to reports |
| coach_id | uuid | NOT NULL FK users(id) ON DELETE CASCADE | COMMENT-01/04: coach or owner submits |
| comment | text | NOT NULL | COMMENT-01: max 1000 chars enforced at app layer |
| created_at | timestamptz | NOT NULL DEFAULT now() | Standard |
| updated_at | timestamptz | NOT NULL DEFAULT now() | Upsert behavior (COMMENT-02) requires updated_at |

UNIQUE constraint: `(report_id)` — COMMENT-02 allows only one comment per report. This enforces the upsert constraint at DB level. The API uses `INSERT ... ON CONFLICT (report_id) DO UPDATE`.

### messages table (from CHAT-01 through CHAT-13, D-01, D-02)

| Column | Type | Constraints | Derivation |
|--------|------|-------------|------------|
| id | uuid | PK DEFAULT gen_random_uuid() | Standard |
| coach_id | uuid | NOT NULL FK users(id) ON DELETE CASCADE | D-01: coach is conversation anchor |
| sender_id | uuid | NOT NULL FK users(id) ON DELETE CASCADE | CHAT-02/04: identifies sender for bubble alignment |
| recipient_id | uuid | FK users(id) ON DELETE CASCADE, NULLABLE | D-01: NULL for broadcast |
| is_broadcast | boolean | NOT NULL DEFAULT false | D-01: broadcast flag |
| content | text | NOT NULL | CHAT-12: max 2000 chars enforced at app layer |
| read_at | timestamptz | NULLABLE | D-02: per-message read tracking |
| created_at | timestamptz | NOT NULL DEFAULT now() | CHAT-08: cursor-based pagination uses this |

### resources table (from RES-01 through RES-06)

| Column | Type | Constraints | Derivation |
|--------|------|-------------|------------|
| id | uuid | PK DEFAULT gen_random_uuid() | Standard |
| title | varchar(255) | NOT NULL | RES-04: title required |
| url | text | NOT NULL | RES-04: URL required |
| comment | text | NULLABLE | RES-04: optional comment |
| created_by | uuid | NOT NULL FK users(id) ON DELETE CASCADE | RES-04: owner/coach creates |
| created_at | timestamptz | NOT NULL DEFAULT now() | Standard |

### glossary_terms table (from RES-07 through RES-09)

| Column | Type | Constraints | Derivation |
|--------|------|-------------|------------|
| id | uuid | PK DEFAULT gen_random_uuid() | Standard |
| term | varchar(255) | NOT NULL | RES-07: term name |
| definition | text | NOT NULL | RES-07: definition |
| created_by | uuid | NOT NULL FK users(id) ON DELETE CASCADE | RES-07: owner/coach creates |
| created_at | timestamptz | NOT NULL DEFAULT now() | Standard |
| updated_at | timestamptz | NOT NULL DEFAULT now() | RES-07: edit support |

UNIQUE: functional index on `lower(term)` per RES-09.

---

## Common Pitfalls

### Pitfall 1: CHECK Constraint Name Mismatch

**What goes wrong:** The DROP CONSTRAINT command fails silently or errors if the constraint name does not match the auto-generated name.
**Why it happens:** Postgres auto-names CHECK constraints as `{table}_role_check` when no explicit name is given — but this is implementation-specific and can differ.
**How to avoid:** Use `DROP CONSTRAINT IF EXISTS` with the expected auto-generated names (`users_role_check`, `invites_role_check`, `magic_links_role_check`). The `IF EXISTS` guard prevents hard failures. Verify names against the live DB before finalizing.
**Warning signs:** Migration error message "constraint does not exist" during execution.

### Pitfall 2: Forgetting updated_at Trigger for report_comments and glossary_terms

**What goes wrong:** `updated_at` column stays at its initial value permanently.
**Why it happens:** The project uses the `handle_updated_at()` trigger function to auto-update `updated_at` on BEFORE UPDATE — but the trigger must be explicitly registered per table.
**How to avoid:** Add `CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();` for every table that has an `updated_at` column. The function already exists from 00001.
**Warning signs:** Coach edits a comment or glossary term, but `updated_at` shows the original create timestamp in the DB.

### Pitfall 3: RLS Policy Omissions Create Silent Blocks

**What goes wrong:** Application queries return empty results or "permission denied" instead of data.
**Why it happens:** When RLS is enabled but no matching policy exists for a role's action, Postgres defaults to DENY.
**How to avoid:** For each table, explicitly enumerate which role+operation combinations need access and write policies for all of them. Use the policy matrix in Architecture Patterns above. Test with the anon client (RLS-enforced) not just the admin/service-role client.
**Warning signs:** API returns empty arrays or RLS-related Postgres errors in Supabase logs.

### Pitfall 4: TypeScript Role Union Update in 9 Locations

**What goes wrong:** TypeScript compiler errors in downstream phases when code uses `role: "student_diy"` against the old union type.
**Why it happens:** The Role union `"owner" | "coach" | "student"` appears in `users.Row`, `users.Insert`, `users.Update`, `invites.Row`, `invites.Insert`, `invites.Update`, `magic_links.Row`, `magic_links.Insert`, `magic_links.Update` — nine separate locations.
**How to avoid:** Update all nine occurrences in `src/lib/types.ts`. Search for `"coach" | "student"` (without owner) to find the invites/magic_links entries, and `"owner" | "coach" | "student"` for the users entries.
**Warning signs:** TypeScript error `Type '"student_diy"' is not assignable to type '"owner" | "coach" | "student"'`.

### Pitfall 5: Not Granting Permissions on New Tables

**What goes wrong:** New tables are invisible to the Supabase anon/authenticated roles even after RLS is enabled.
**Why it happens:** Migration 00001 granted privileges on "all tables in schema public" with `GRANT ALL ON ALL TABLES IN SCHEMA public` plus default privileges — but these apply to tables that existed at grant time, and ALTER DEFAULT PRIVILEGES covers future tables for the creating role only.
**How to avoid:** In practice, Supabase's hosted environment handles this via default privileges (00001 sets `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role`) — so new tables created by the migration owner role inherit these grants automatically. This is LOW risk in Supabase hosted environments but verify if unexpected permission errors appear.
**Warning signs:** "permission denied for table X" when using the anon or authenticated client.

### Pitfall 6: report_comments UNIQUE Constraint Placement

**What goes wrong:** Two coaches both comment on the same report, creating duplicates — or the upsert fails because the conflict target is wrong.
**Why it happens:** COMMENT-02 requires exactly one comment per report. If the UNIQUE constraint is on `report_id` alone, only one comment per report is allowed globally (correct). But the API must use `ON CONFLICT (report_id) DO UPDATE SET comment = EXCLUDED.comment, updated_at = now()`.
**How to avoid:** Create `UNIQUE (report_id)` constraint on report_comments. Write the INSERT in the API (Phase 34) as an upsert. This means the FIRST commenter's coach_id "wins" the slot — subsequent updates overwrite.
**Warning signs:** Duplicate report_comments rows for the same report_id.

---

## Runtime State Inventory

This is a schema migration phase — new tables only, plus ALTER TABLE on existing constraint names.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing rows in new tables (tables don't exist yet). Existing rows in users/invites/magic_links all have valid roles ('owner','coach','student') — none will violate the expanded CHECK. | None — DROP/ADD constraint is safe on existing data |
| Live service config | Supabase hosted DB has the current schema. Migration runs via `supabase db push` or direct SQL execution against hosted DB. | Execute migration against hosted DB |
| OS-registered state | None — no rename, no OS-level registrations | None |
| Secrets/env vars | None — no new env vars in this phase | None |
| Build artifacts | `src/lib/types.ts` is a source file, not a build artifact — edit it in place | Code edit to add new table types and expand Role unions |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files found in project |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 | 4 tables exist with correct columns | manual-only (DB inspection) | `npm run build` (catches type errors) | N/A |
| SCHEMA-02 | role CHECK accepts 'student_diy' | manual-only (DB inspection) | N/A | N/A |
| SCHEMA-03 | RLS enabled on 4 tables | manual-only (DB inspection) | N/A | N/A |
| SCHEMA-04 | TypeScript types include new tables and expanded Role union | unit (TypeScript compile) | `npx tsc --noEmit` | ✅ src/lib/types.ts |

**Note:** This is a database migration phase. The primary verification is running the migration against the hosted Supabase DB and inspecting the resulting schema. TypeScript compilation is the only automated verification step available — it confirms SCHEMA-04.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build && npx tsc --noEmit && npm run lint`
- **Phase gate:** Migration executed successfully + TypeScript clean before `/gsd:verify-work`

### Wave 0 Gaps

None — existing infrastructure (TypeScript compiler) covers the one automatable requirement. The other three requirements are verified by inspecting the Supabase database schema after migration execution.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| supabase CLI | Running migration against local DB | Unknown (not checked) | — | Apply SQL directly via Supabase Dashboard SQL editor |
| Supabase hosted DB | SCHEMA-01–03 verification | ✓ (project is live) | hosted | — |
| TypeScript compiler | SCHEMA-04 verification | ✓ | per package.json | — |
| Node.js / npm | Build commands | ✓ | per package.json | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:**
- `supabase CLI` local: If not installed, apply migration via Supabase Dashboard → SQL Editor → paste and run the migration file content. This is the established fallback for this project given it uses hosted Supabase (not local Docker).

---

## Code Examples

### Example: ALTER TABLE for Role CHECK expansion

```sql
-- Drop old 3-value CHECK constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new 4-value CHECK constraint
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'coach', 'student', 'student_diy'));

-- Repeat for invites and magic_links
ALTER TABLE public.invites
  DROP CONSTRAINT IF EXISTS invites_role_check;

ALTER TABLE public.invites
  ADD CONSTRAINT invites_role_check
  CHECK (role IN ('coach', 'student', 'student_diy'));

ALTER TABLE public.magic_links
  DROP CONSTRAINT IF EXISTS magic_links_role_check;

ALTER TABLE public.magic_links
  ADD CONSTRAINT magic_links_role_check
  CHECK (role IN ('coach', 'student', 'student_diy'));
```

Note: `users` includes `'owner'` in its role set; `invites` and `magic_links` do not (owners are created directly, not via invites/magic_links).

### Example: messages RLS — Coach selects own conversations

```sql
-- Source: pattern from 00001_create_tables.sql (coach_select with coach_id match)
CREATE POLICY "coach_select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND coach_id = (select get_user_id())
  );
```

### Example: messages RLS — Student sees their messages

```sql
CREATE POLICY "student_select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'student'
    AND (
      recipient_id = (select get_user_id())
      OR (is_broadcast = true AND coach_id = (
        SELECT coach_id FROM public.users WHERE id = (select get_user_id())
      ))
    )
  );
```

### Example: Upsert-friendly report_comments unique constraint

```sql
CREATE UNIQUE INDEX idx_report_comments_report_id ON public.report_comments(report_id);
```

This enables the Phase 34 API to use:
```sql
INSERT INTO report_comments (report_id, coach_id, comment)
VALUES ($1, $2, $3)
ON CONFLICT (report_id)
DO UPDATE SET comment = EXCLUDED.comment, updated_at = now();
```

### Example: TypeScript type addition (new table pattern)

```typescript
// Add to Database.public.Tables in src/lib/types.ts
report_comments: {
  Row: {
    id: string;
    report_id: string;
    coach_id: string;
    comment: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    report_id: string;
    coach_id: string;
    comment: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    report_id?: string;
    coach_id?: string;
    comment?: string;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "report_comments_report_id_fkey";
      columns: ["report_id"];
      isOneToOne: true;
      referencedRelation: "daily_reports";
      referencedColumns: ["id"];
    },
    {
      foreignKeyName: "report_comments_coach_id_fkey";
      columns: ["coach_id"];
      isOneToOne: false;
      referencedRelation: "users";
      referencedColumns: ["id"];
    }
  ];
};
```

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` that are relevant to this phase:

| Directive | Applies to Phase 30? | How |
|-----------|---------------------|-----|
| Config is truth — import from src/lib/config.ts | Partially — types.ts edit must be consistent with config.ts, but Phase 31 expands config.ts | types.ts Role union update in this phase; config.ts ROLES constant update is Phase 31's job |
| Admin client only in server code | Not applicable (no app code in this phase) | — |
| Proxy not middleware | Not applicable | — |
| Zod import: `import { z } from "zod"` | Not applicable (no API routes in this phase) | — |
| ima-* tokens only | Not applicable (no UI in this phase) | — |
| Never swallow errors | Not applicable (no JS/TS code written in this phase) | — |

**Phase 30 is SQL + one TypeScript file edit.** CLAUDE.md rules primarily govern UI/API code and do not constrain migration SQL syntax. The TypeScript edit must follow the existing file conventions (manual Row/Insert/Update triplets, no code-gen).

---

## Open Questions

1. **Exact Postgres constraint names on users/invites/magic_links**
   - What we know: Postgres auto-generates constraint names as `{table}_role_check` for unnamed CHECK constraints
   - What's unclear: Whether the actual constraint in the hosted DB has this exact auto-generated name (versus a custom name assigned in an earlier migration)
   - Recommendation: Use `DROP CONSTRAINT IF EXISTS {table}_role_check` — the `IF EXISTS` makes this safe. If the constraint has a different name, the DROP is a no-op and the new ADD will fail with a duplicate values error. Verify once by inspecting `pg_constraint` in Supabase Dashboard before finalizing.

2. **messages INSERT RLS — who can insert broadcasts?**
   - What we know: CHAT-05 says coach can send broadcasts. Broadcast `recipient_id` is NULL. The RLS INSERT policy for coach needs to allow NULL `recipient_id` for `is_broadcast = true`.
   - What's unclear: Should the INSERT policy enforce `is_broadcast` and `recipient_id` consistency at DB level?
   - Recommendation: Keep RLS simple — allow coach to INSERT any message where `coach_id = get_user_id()`. App-layer API enforces the is_broadcast/recipient_id logic. Aligns with D-04 (RLS is defense-in-depth only).

---

## Sources

### Primary (HIGH confidence)

- `supabase/migrations/00001_create_tables.sql` — Full migration patterns: table creation, RLS initplan, index naming, CHECK constraints, trigger registration
- `supabase/migrations/00006_v1_1_schema.sql` — ALTER TABLE pattern including `DROP CONSTRAINT IF EXISTS`
- `supabase/migrations/00013_daily_plans_undo_log.sql` — Most recent full-table creation migration; section structure reference
- `supabase/migrations/00014_coach_alert_dismissals.sql` — Latest migration (confirms 00015 is next)
- `src/lib/types.ts` — Full Database type structure; all existing Row/Insert/Update patterns
- `src/lib/config.ts` — Current ROLES constant and Role type (3 roles); confirms types.ts is independent
- `.planning/phases/30-database-migration/30-CONTEXT.md` — Locked decisions D-01 through D-04
- `.planning/REQUIREMENTS.md` — Full column derivation for all 4 tables

### Secondary (MEDIUM confidence)

- PostgreSQL docs on CHECK constraints: DROP CONSTRAINT + ADD CONSTRAINT is the only way to modify a CHECK in Postgres (no ALTER CONSTRAINT equivalent for CHECK predicates)

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tooling is already established in the project
- Architecture: HIGH — exact SQL patterns extracted from existing migrations
- Pitfalls: HIGH — derived from direct inspection of existing code and Postgres behavior
- Column specifications: HIGH — directly derived from locked REQUIREMENTS.md entries

**Research date:** 2026-04-03
**Valid until:** Stable (pure SQL migration against a fixed schema — findings do not expire)
