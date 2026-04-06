# Phase 38: Database Foundation - Research

**Researched:** 2026-04-06
**Domain:** PostgreSQL / Supabase — migration SQL, RLS, BEFORE INSERT trigger, TypeScript types
**Confidence:** HIGH

## Summary

This phase is a pure database migration with no application code. All decisions are locked in CONTEXT.md and backed by the existing codebase's established patterns. The work is three files: `supabase/migrations/00021_deals.sql`, an update to `src/lib/types.ts`, and manual verification in Supabase Studio.

Every pattern the migration needs already exists in this codebase. The RLS initplan pattern (`(select get_user_role())` scalar subquery) is used on all 10+ existing tables. The `handle_updated_at()` trigger function is in 00001. The sectioned SQL comment style with `-- ===` dividers is established in 00015. The Row/Insert/Update type triple is in every entry of `types.ts`. Nothing new needs to be invented.

The only genuinely novel piece is the BEFORE INSERT trigger for race-safe `deal_number` auto-increment using `SELECT MAX(deal_number) FOR UPDATE`. This pattern does not already exist in the codebase but is a well-understood Postgres advisory row-lock pattern. It is documented in full below with the exact SQL, including the `COALESCE(MAX(...), 0) + 1` form to handle the first insert per student.

**Primary recommendation:** Write 00021_deals.sql following the 00015 section structure exactly. Copy the RLS initplan pattern verbatim from 00015. Write the deal_number trigger with FOR UPDATE on the student-scoped lock row. Add the Deal type to types.ts following the existing Row/Insert/Update triple.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Columns: id (uuid PK), student_id (uuid FK → users), deal_number (integer), revenue (numeric(12,2)), profit (numeric(12,2)), created_at (timestamptz), updated_at (timestamptz). No notes, brand_name, or status columns.
- **D-02:** deal_number auto-assigned by BEFORE INSERT trigger using MAX(deal_number) + 1 with FOR UPDATE row lock to prevent race-condition duplicates on concurrent inserts (STATE.md D-01 — locked).
- **D-03:** UNIQUE constraint on (student_id, deal_number).
- **D-04:** revenue and profit as numeric(12,2) — per success criteria and STATE.md D-02.
- **D-05:** CHECK constraints: revenue >= 0, profit >= 0.
- **D-06:** ON DELETE CASCADE on student_id FK.
- **D-07:** types.ts Deal type declares revenue and profit as `string | number` (STATE.md D-02 — locked).
- **D-08:** RLS uses `(SELECT get_user_id())` and `(SELECT get_user_role())` initplan pattern.
- **D-09:** Student SELECT/INSERT/UPDATE/DELETE own deals (student_id = get_user_id()).
- **D-10:** student_diy has identical policies to student — same deal access (DEAL-06).
- **D-11:** Coach SELECT/DELETE for assigned students only (join to users.coach_id = get_user_id()).
- **D-12:** Owner SELECT/DELETE any deal.
- **D-13:** No coach INSERT/UPDATE on deals.
- **D-14:** Index on (student_id, created_at DESC).
- **D-15:** Migration file: 00021_deals.sql.
- **D-16:** handle_updated_at() trigger on deals table — reuse existing function from 00001.

### Claude's Discretion
- Exact RLS policy naming convention (follow existing pattern from 00015)
- SQL comment section structure (follow existing migration pattern)
- Whether to combine student and student_diy into a single policy using IN ('student', 'student_diy') or keep separate

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Deals table with numeric(12,2) revenue/profit, deal_number, RLS policies | Full schema + RLS patterns documented below |
| INFR-02 | BEFORE INSERT trigger for race-safe deal_number auto-increment | Trigger SQL with FOR UPDATE documented in Code Examples |
| INFR-03 | Index on deals(student_id, created_at DESC) | Index DDL documented; pattern from 00015 idx_messages_created_at |
| INFR-04 | RLS with (SELECT auth.uid()) initplan pattern | Verified from 00001 + 00015; full policy set documented below |
| DEAL-02 | Deal receives auto-incremented deal_number per student | Covered by INFR-02 trigger; COALESCE handles first-insert edge case |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

All directives that apply to this phase:

| Directive | Applies to This Phase | Impact |
|-----------|-----------------------|--------|
| Config is truth — import from src/lib/config.ts | No — migration is SQL only | N/A for SQL |
| Admin client only in server code | No — no app code in this phase | N/A |
| Proxy not middleware | No — no app code | N/A |
| Google OAuth only | No | N/A |
| Zod import: `import { z } from "zod"` | No — no app code | N/A |
| ima-* tokens only | No — no UI in this phase | N/A |
| 44px touch targets | No — no UI in this phase | N/A |
| Never swallow errors | No — no app code | N/A |
| **types.ts additions must follow existing Row/Insert/Update pattern** | YES — Deal type added to types.ts | Follow pattern from all existing table entries |

---

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Supabase hosted Postgres | 15.x (Supabase default) | Database | Project's existing data layer |
| Supabase CLI (via npx) | 2.78.1 [VERIFIED: `npx supabase --version`] | Apply migration | Project's migration workflow |
| PostgreSQL BEFORE INSERT trigger | — | Race-safe deal_number | Prevents concurrent insert collision |
| `numeric(12,2)` column type | — | Revenue/profit storage | Exact decimal arithmetic, no float errors |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Supabase Studio `\d deals` | — | Verify schema post-migration | Manual verification step after push |
| EXPLAIN ANALYZE | — | Verify initplan in RLS | Confirm function is called once, not per row |

**Version verification:**
Supabase CLI confirmed via `npx supabase --version` → `2.78.1`. [VERIFIED: npx call]

---

## Architecture Patterns

### Migration File Structure
Follow the section pattern established in `00015_v1_4_schema.sql` exactly:

```
-- ============================================================================
-- Phase 38: Database Foundation — deals table
-- ...purpose/deps comment...
-- ============================================================================

-- Section 1: deals table DDL
-- Section 2: deal_number trigger function
-- Section 3: deal_number BEFORE INSERT trigger
-- Section 4: updated_at trigger
-- Section 5: Enable RLS
-- Section 6: RLS policies — deals
-- Section 7: Indexes
```

[VERIFIED: 00015_v1_4_schema.sql structure — read in this session]

### RLS Initplan Pattern
Every policy in this codebase wraps `get_user_role()` and `get_user_id()` in scalar subqueries. This forces Postgres to evaluate the function once per query (initplan) rather than once per row.

```sql
-- CORRECT — scalar subquery wrapper = initplan
USING ((select get_user_role()) = 'student')

-- WRONG — bare function call = per-row evaluation
USING (get_user_role() = 'student')
```

[VERIFIED: 00001_create_tables.sql line 180-340, 00015_v1_4_schema.sql lines 173-392 — read in this session]

### Coach Assigned-Student JOIN Pattern
The established pattern for coach access to student-scoped tables (from 00015 report_comments and 00001 work_sessions/roadmap):

```sql
-- Pattern A: subquery IN (used for simple student_id checks)
AND student_id IN (
  SELECT id FROM public.users WHERE coach_id = (select get_user_id())
)

-- Pattern B: explicit JOIN (used in 00015 report_comments for multi-hop)
AND student_id IN (
  SELECT dr.student_id FROM public.daily_reports dr
  JOIN public.users s ON s.id = dr.student_id
  WHERE s.coach_id = (select get_user_id())
)
```

For deals, Pattern A applies directly — `deals.student_id` → `users.coach_id`. [VERIFIED: 00001, 00015 — read in this session]

### Student + student_diy Combined Policy Pattern
CONTEXT.md (Claude's Discretion) leaves the choice of separate vs combined policies to the implementer. The recommendation is a single policy using `IN ('student', 'student_diy')` — this directly matches how DEAL-06 is described ("Both student and student_diy roles have access to Deals page"). Fewer policies = simpler RLS graph.

```sql
-- Combined: preferred for student/student_diy equivalence
USING (
  (select get_user_role()) IN ('student', 'student_diy')
  AND student_id = (select get_user_id())
)
```

[ASSUMED] — the IN ('student', 'student_diy') form is consistent with how the codebase already handles role equivalence in application code, but no prior migration has used this exact form for RLS policies. Separate policies are equally valid.

### Policy Naming Convention
Inferred from 00015 pattern: `{role}_{operation}_{table}`. Examples from 00015:
- `owner_select_report_comments`
- `coach_insert_report_comments`
- `student_select_resources`

For deals table:
- `owner_select_deals`, `owner_delete_deals`
- `coach_select_deals`, `coach_delete_deals`
- `student_select_deals`, `student_insert_deals`, `student_update_deals`, `student_delete_deals`

[VERIFIED: 00015_v1_4_schema.sql naming — read in this session]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| deal_number sequencing | App-level MAX+1 (read-then-write) | Postgres BEFORE INSERT trigger with FOR UPDATE | Concurrent inserts between read and write create duplicates; trigger runs inside transaction with row lock |
| Decimal arithmetic | float or double precision columns | `numeric(12,2)` | Floats have binary rounding errors; numeric is exact |
| updated_at maintenance | App-layer timestamp | `handle_updated_at()` trigger (00001) | Already exists; consistent with all other tables |
| RLS function overhead | Inline `auth.uid()` per-row calls | `(SELECT get_user_id())` initplan wrapper | Without wrapper, function called per row; initplan evaluates once |

**Key insight:** The FOR UPDATE lock in the deal_number trigger locks the student's most recent deal row before assigning the new number. Without this lock, two concurrent inserts can both read MAX=5, both compute 6, and create a UNIQUE constraint violation.

---

## Code Examples

Verified patterns from codebase reads:

### deals Table DDL
```sql
-- Source: pattern from 00001_create_tables.sql + CONTEXT.md D-01 through D-06
CREATE TABLE public.deals (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deal_number integer       NOT NULL,
  revenue     numeric(12,2) NOT NULL CHECK (revenue >= 0),
  profit      numeric(12,2) NOT NULL CHECK (profit >= 0),
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT deals_student_deal_number_key UNIQUE (student_id, deal_number)
);
```

### deal_number BEFORE INSERT Trigger Function
```sql
-- Source: STATE.md D-01 (locked decision) — FOR UPDATE pattern
-- COALESCE handles first deal per student (MAX returns NULL → COALESCE returns 0 → +1 = 1)
CREATE OR REPLACE FUNCTION public.assign_deal_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  SELECT COALESCE(MAX(deal_number), 0) + 1
    INTO v_next
    FROM public.deals
   WHERE student_id = NEW.student_id
     FOR UPDATE;

  NEW.deal_number := v_next;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_deal_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_deal_number();
```

### handle_updated_at Trigger (reuse from 00001)
```sql
-- Source: 00001_create_tables.sql lines 10-21 (verified in this session)
-- Function already exists — just register it on deals
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### RLS Policies — deals (complete set)
```sql
-- Source: initplan pattern from 00001 + 00015 (verified in this session)
-- CONTEXT.md D-08 through D-13

-- Enable RLS first
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Owner: full read + delete
CREATE POLICY "owner_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'owner');

CREATE POLICY "owner_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING ((select get_user_role()) = 'owner');

-- Coach: read + delete own assigned students' deals (D-11)
CREATE POLICY "coach_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

CREATE POLICY "coach_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
  );

-- Student + student_diy: full CRUD on own deals (D-09, D-10)
CREATE POLICY "student_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

CREATE POLICY "student_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

CREATE POLICY "student_update_deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  )
  WITH CHECK (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );

CREATE POLICY "student_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    (select get_user_role()) IN ('student', 'student_diy')
    AND student_id = (select get_user_id())
  );
```

### Index DDL
```sql
-- Source: CONTEXT.md D-14, pattern from 00015 idx_messages_created_at
CREATE INDEX idx_deals_student_created ON public.deals(student_id, created_at DESC);
```

### Deal Type in types.ts
```typescript
// Source: existing Row/Insert/Update pattern from types.ts (read in this session)
// STATE.md D-02 (locked): revenue and profit declared as string | number
// Supabase returns numeric(12,2) as string in the JS client
deals: {
  Row: {
    id: string;
    student_id: string;
    deal_number: number;
    revenue: string | number;
    profit: string | number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    student_id: string;
    deal_number?: number;         // set by trigger, optional on insert
    revenue: string | number;
    profit: string | number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    student_id?: string;
    deal_number?: number;
    revenue?: string | number;
    profit?: string | number;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "deals_student_id_fkey";
      columns: ["student_id"];
      isOneToOne: false;
      referencedRelation: "users";
      referencedColumns: ["id"];
    }
  ];
};
```

---

## Common Pitfalls

### Pitfall 1: Missing COALESCE in deal_number trigger
**What goes wrong:** `MAX(deal_number)` returns NULL when a student has no deals yet. `NULL + 1 = NULL`, so the first deal gets `deal_number = NULL`, violating NOT NULL.
**Why it happens:** SQL aggregate MAX on empty set returns NULL, not 0.
**How to avoid:** Use `COALESCE(MAX(deal_number), 0) + 1`.
**Warning signs:** First deal insert per student fails with NOT NULL constraint error.

### Pitfall 2: FOR UPDATE locking the wrong rows
**What goes wrong:** `SELECT MAX(...) FOR UPDATE` without a WHERE clause locks all deal rows, causing unnecessary blocking.
**Why it happens:** FOR UPDATE without WHERE attempts to lock every row scanned.
**How to avoid:** Always include `WHERE student_id = NEW.student_id` before `FOR UPDATE`. The lock is student-scoped; other students' concurrent inserts are not blocked.

### Pitfall 3: Bare `get_user_role()` call in RLS (not initplan)
**What goes wrong:** Policy works correctly but performs a full SQL function call per row scanned, degrading performance on tables with many rows.
**Why it happens:** Without scalar subquery wrapper, Postgres cannot hoist the function to initplan.
**How to avoid:** Always write `(select get_user_role())`, not `get_user_role()`. The success criteria explicitly requires EXPLAIN ANALYZE to show initplan.
**Warning signs:** EXPLAIN ANALYZE output shows `Function Scan` or per-row `get_user_role` calls instead of `InitPlan`.

### Pitfall 4: INSERT policy missing WITH CHECK
**What goes wrong:** INSERT policy with only USING clause is silently ignored by Postgres for INSERT operations. USING applies to SELECT/UPDATE/DELETE; INSERT requires WITH CHECK.
**Why it happens:** Postgres ignores USING on INSERT policies — the INSERT still succeeds, bypassing the intent of the policy.
**How to avoid:** INSERT policies must use `WITH CHECK`, not `USING`. UPDATE policies need both.

### Pitfall 5: Migration number collision
**What goes wrong:** Using a migration number already taken silently overrides the existing migration on `supabase db push` if not yet applied, or causes `already exists` errors.
**Why it happens:** Migration files are sorted and applied by filename prefix.
**How to avoid:** 00020 is the last applied migration. 00021 is confirmed available. [VERIFIED: `ls supabase/migrations/` — read in this session]

### Pitfall 6: deal_number exposed as optional in Insert type causing confusion
**What goes wrong:** Downstream API code sets `deal_number` explicitly in the insert payload, bypassing the trigger's assignment.
**Why it happens:** If Insert type marks `deal_number` as required, callers feel compelled to supply it.
**How to avoid:** Mark `deal_number` as optional (`deal_number?: number`) in the Insert type. The trigger sets it; the app layer must not supply it.

---

## Validation Architecture

### Test Framework
No automated test framework exists in this project. [VERIFIED: `package.json` has no test script, no jest/vitest config found — checked in this session]

| Property | Value |
|----------|-------|
| Framework | None (no jest/vitest configured) |
| Config file | None |
| Quick run command | Manual: `npx supabase db push` then verify in Studio |
| Full suite command | `npm run build && npx tsc --noEmit` (type check only) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-01 | deals table exists with correct columns | Manual | `\d deals` in Supabase Studio | N/A |
| INFR-02 | deal_number auto-increments safely | Manual | Insert two rows concurrently, verify no duplicate deal_number | N/A |
| INFR-03 | Index on (student_id, created_at DESC) | Manual | `\d deals` in Supabase Studio | N/A |
| INFR-04 | RLS initplan verified | Manual | EXPLAIN ANALYZE SELECT * FROM deals in Studio | N/A |
| DEAL-02 | deal_number = 1 for first deal, increments per student | Manual | Insert test row, verify deal_number=1; insert second, verify deal_number=2 | N/A |
| — | TypeScript types compile | Automated | `npx tsc --noEmit` | ❌ types.ts needs Deal entry |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (verifies types.ts compiles)
- **Per wave merge:** `npm run build` (full Next.js type check)
- **Phase gate:** Migration applied + `\d deals` confirms schema + tsc passes

### Wave 0 Gaps
- [ ] No test framework to install — manual verification only for SQL artifacts
- [ ] `src/lib/types.ts` — Deal entry missing (Wave 0 task writes it)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no auth logic in this phase | — |
| V3 Session Management | No | — |
| V4 Access Control | YES — RLS policies are access control | Postgres RLS with initplan pattern |
| V5 Input Validation | Partial — CHECK constraints only | `revenue >= 0`, `profit >= 0` CHECK constraints; Zod validation deferred to Phase 39 API |
| V6 Cryptography | No | — |

### Known Threat Patterns for Postgres RLS

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Student reads another student's deals | Information Disclosure | RLS `student_id = (select get_user_id())` + app-layer admin client filter |
| Coach reads unassigned student's deals | Information Disclosure | RLS `student_id IN (SELECT id FROM users WHERE coach_id = get_user_id())` |
| Concurrent insert duplicate deal_number | Tampering | BEFORE INSERT trigger with FOR UPDATE row lock |
| Negative revenue/profit values | Tampering | `CHECK (revenue >= 0)` + `CHECK (profit >= 0)` |
| deal_number set by caller (bypass auto-assign) | Tampering | Phase 39 API must strip `deal_number` from insert payload before passing to Supabase; Insert type marks it optional as signal |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Apply migration | Available via npx | 2.78.1 [VERIFIED] | — |
| Node.js | npx supabase | Available | v24.13.0 [VERIFIED] | — |
| Supabase project (hosted) | Migration target | Available (env configured) | — | Local dev via `supabase start` |
| psql | Direct DB query | Not available in PATH | — | Supabase Studio SQL editor |
| Docker | Local Supabase | Not checked | — | Use hosted Supabase + npx push |

**Missing dependencies with no fallback:**
- None — migration can be applied to hosted Supabase via `npx supabase db push` without psql or Docker.

**Missing dependencies with fallback:**
- psql not in PATH: use Supabase Studio SQL editor for manual verification and EXPLAIN ANALYZE.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Combined `IN ('student', 'student_diy')` RLS policy form is acceptable; no prior migration uses this exact form | Architecture Patterns | Low — separate policies are equally valid; implementer can split if preferred |
| A2 | `deal_number` should be optional in Insert type (trigger sets it) | Code Examples / types.ts | Low — if marked required, callers will supply it and trigger will overwrite, or validation rejects valid inserts |

---

## Open Questions

1. **EXPLAIN ANALYZE verification without psql**
   - What we know: psql is not in PATH; Supabase Studio provides SQL editor
   - What's unclear: Whether Studio's SQL editor supports `EXPLAIN ANALYZE` output display
   - Recommendation: Plan verification step via Studio SQL editor. If Studio does not render execution plan, use the Supabase MCP or a simple `EXPLAIN (FORMAT JSON, ANALYZE) SELECT * FROM deals WHERE student_id = '<uuid>'` and look for `"Node Type": "InitPlan"` in the JSON output.

2. **Migration application method (local vs push)**
   - What we know: `.env.local` points to 127.0.0.1 (local dev URL); `npx supabase --version` works
   - What's unclear: Whether the dev environment is currently connected to hosted Supabase or local Docker
   - Recommendation: Plan the verification task to use `npx supabase db push` targeting hosted Supabase (the production migration path). Document both commands; implementer uses the appropriate one.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| App-level `SELECT MAX + INSERT` for sequential IDs | Postgres BEFORE INSERT trigger with FOR UPDATE | v1.5 D-01 (locked) | Eliminates race condition window between read and write |
| Per-row `get_user_role()` in RLS | Scalar subquery `(select get_user_role())` = initplan | Established in 00001 (v1.0) | Single function call per query regardless of row count |

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/00001_create_tables.sql` — `handle_updated_at()`, `get_user_id()`, `get_user_role()` definitions; RLS initplan pattern verified [VERIFIED: read in this session]
- `supabase/migrations/00015_v1_4_schema.sql` — Section structure, policy naming, coach assigned-student JOIN pattern, student_diy role handling [VERIFIED: read in this session]
- `src/lib/types.ts` — Row/Insert/Update triple pattern; existing table type definitions [VERIFIED: read in this session]
- `.planning/phases/38-database-foundation/38-CONTEXT.md` — All locked decisions [VERIFIED: read in this session]
- `ls supabase/migrations/` — Last migration is 00020; 00021 is available [VERIFIED: bash in this session]
- `npx supabase --version` — 2.78.1 available [VERIFIED: bash in this session]

### Secondary (MEDIUM confidence)
- PostgreSQL documentation on `FOR UPDATE` in triggers — COALESCE + MAX + FOR UPDATE is the canonical sequential-number-per-partition pattern [ASSUMED based on training knowledge; consistent with STATE.md D-01 locked decision]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified in session
- Architecture: HIGH — all patterns read directly from codebase
- Pitfalls: HIGH — derived from direct SQL analysis + Postgres semantics
- Type definitions: HIGH — read directly from types.ts

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable SQL patterns; types.ts is hand-maintained so check before editing)
