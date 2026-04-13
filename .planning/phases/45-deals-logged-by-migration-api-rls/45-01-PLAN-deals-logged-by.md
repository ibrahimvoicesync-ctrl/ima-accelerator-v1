---
phase: 45-deals-logged-by-migration-api-rls
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00022_deals_logged_by.sql
  - src/app/api/deals/route.ts
  - src/lib/types.ts
autonomous: true
requirements:
  - DEALS-01
  - DEALS-02
  - DEALS-03
  - DEALS-04
  - DEALS-05
  - DEALS-06
  - DEALS-11

must_haves:
  truths:
    - "supabase/migrations/00022_deals_logged_by.sql exists and adds logged_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL with backfill = student_id"
    - "supabase/migrations/00022_deals_logged_by.sql adds updated_by UUID column referencing users(id) ON DELETE SET NULL"
    - "supabase/migrations/00022_deals_logged_by.sql defines a BEFORE UPDATE trigger that sets NEW.updated_at = now() and NEW.updated_by from the current authenticated user's profile id (or service_role caller-supplied value)"
    - "Composite UNIQUE constraint or UNIQUE INDEX exists on deals(student_id, deal_number) — already present from prior migration as deals_student_deal_number_key — Phase 45 verifies and does NOT duplicate"
    - "POST /api/deals accepts an optional student_id field; if absent it defaults to the caller's own profile.id"
    - "Coach POST /api/deals with non-assigned student_id returns 403 from route handler BEFORE any DB insert (verified by code grep + acceptance test)"
    - "RLS policy coach_insert_deals (WITH CHECK) rejects coach inserts for non-assigned students even if the route handler is bypassed — dual-layer protection (DEALS-03)"
    - "Student POST /api/deals with logged_by set to another user_id returns 403 from route handler (DEALS-04)"
    - "Student POST /api/deals with logged_by = self (or omitted) succeeds and inserts a row with logged_by = profile.id"
    - "Owner POST /api/deals for any student succeeds; inserted row has logged_by = owner profile.id and student_id = requested student_id (DEALS-05)"
    - "Concurrent inserts that would collide on (student_id, deal_number) retry once with deal_number+1 on Postgres SQLSTATE 23505 and both succeed (DEALS-02)"
    - "src/lib/types.ts deals.Row, .Insert, .Update include logged_by, updated_by columns matching the new schema"
    - "npm run lint && npx tsc --noEmit && npm run build all exit 0 after all changes"
  artifacts:
    - supabase/migrations/00022_deals_logged_by.sql
    - src/app/api/deals/route.ts
    - src/lib/types.ts
  key_links:
    - "logged_by NOT NULL is enforced AFTER backfill — backfill MUST run inside the same migration before the NOT NULL alter"
    - "RLS coach_insert_deals + owner_insert_deals are NEW policies — Phase 38 deals migration intentionally omitted them (D-13). This phase reverses that decision"
    - "POST /api/deals must do dual-layer auth: (1) route-handler check that coach.id is assigned to student_id, (2) RLS WITH CHECK that coach is in users.coach_id chain"
    - "updated_by trigger receives caller identity via SET LOCAL app.current_user_id, set inside the API route before the UPDATE/INSERT statement; admin client must SET LOCAL before each write"
---

<objective>
Add creator attribution (`logged_by`) and audit columns (`updated_at`, `updated_by`) to `public.deals`, plus dual-layer authorization (route handler + RLS `WITH CHECK`) so coaches and owners can insert deals for students they have authority over without ever touching another coach's students. Owns DEALS-01 through DEALS-06 and DEALS-11.

Purpose: Backend-only foundation. No UI in this phase — Phase 49 will add the "Add Deal" button on coach/owner deals tab. Phase 45 ships the schema, the API contract, the RLS policies, and the regenerated TypeScript types.
Output: One new SQL migration (`00022_deals_logged_by.sql`), an extended `POST /api/deals` route handler (now accepts `student_id` and `logged_by`), and updated `src/lib/types.ts` Database interface.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/45-deals-logged-by-migration-api-rls/45-CONTEXT.md
@CLAUDE.md
@supabase/migrations/00001_create_tables.sql
@supabase/migrations/00021_analytics_foundation.sql
@src/app/api/deals/route.ts
@src/app/api/deals/[id]/route.ts
@src/lib/types.ts
@src/lib/config.ts

<interfaces>
Existing exports — executor must NOT break these:

From src/app/api/deals/route.ts (current):
- POST handler accepts `{ revenue: number, profit: number }` and infers student_id = caller. Phase 45 EXTENDS this to optionally accept `{ revenue, profit, student_id?, logged_by? }`. Existing student-self-insert behavior MUST remain backward-compatible (omitted student_id => self, omitted logged_by => self).
- GET handler returns deals filtered by student_id query param (coach/owner only). UNCHANGED in Phase 45.

From src/app/api/deals/[id]/route.ts (current):
- PATCH and DELETE handlers exist with three-tier auth. UNCHANGED in Phase 45 (no audit-trail injection here yet — defer to Phase 49 if needed).

From src/lib/types.ts:
- Database["public"]["Tables"]["deals"]["Row"] currently: id, student_id, deal_number, revenue, profit, created_at, updated_at. Phase 45 ADDS logged_by (string), updated_by (string | null) to Row, Insert, Update.

From src/lib/supabase/admin.ts:
- createAdminClient() returns a service_role Supabase client that bypasses RLS. Phase 45 still uses this for writes — RLS WITH CHECK is the second-layer defense, not the primary one.

From CLAUDE.md hard rules:
- Rule 4: Admin client in API routes — every .from() in route handlers uses createAdminClient().
- Rule 7: Zod import — `import { z } from "zod"`.
- Rule 5: Never swallow errors — every catch block must console.error.
- Rule 6: Check response.ok — N/A (server route).

Existing deals table shape (live DB; original 00021_deals.sql was deleted from repo but the table exists in production):
  public.deals (
    id uuid PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deal_number integer NOT NULL,
    revenue numeric(12,2) NOT NULL CHECK (revenue >= 0),
    profit numeric(12,2) NOT NULL CHECK (profit >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT deals_student_deal_number_key UNIQUE (student_id, deal_number)
  )
  Existing trigger: assign_deal_number() BEFORE INSERT — assigns deal_number = COALESCE(MAX,0)+1 with FOR UPDATE row lock per student_id.
  Existing trigger: handle_updated_at() BEFORE UPDATE — sets updated_at = now() (does NOT set updated_by — Phase 45 replaces it with deals_set_audit() which sets BOTH).
  Existing index: idx_deals_student_created (student_id, created_at DESC).
  Existing RLS policies (8): owner_select_deals, owner_delete_deals, coach_select_deals, coach_delete_deals, student_select_deals, student_insert_deals, student_update_deals, student_delete_deals. Phase 45 ADDS coach_insert_deals and owner_insert_deals; LEAVES the existing 8 untouched.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 00022_deals_logged_by.sql — schema + audit trigger + dual-layer RLS</name>
  <read_first>
    - supabase/migrations/00001_create_tables.sql (handle_updated_at() definition; get_user_id(), get_user_role() helpers; initplan pattern)
    - supabase/migrations/00021_analytics_foundation.sql (current latest migration; numbering convention)
    - .planning/phases/45-deals-logged-by-migration-api-rls/45-CONTEXT.md (phase boundary)
    - .planning/REQUIREMENTS.md (DEALS-01..06, DEALS-11 exact wording — search for "DEALS-")
    - .planning/ROADMAP.md (Phase 45 success criteria 1-6, lines mentioning Phase 45)
    - CLAUDE.md (Critical Rules and Hard Rules — especially admin client, never swallow errors)
  </read_first>
  <files>supabase/migrations/00022_deals_logged_by.sql</files>
  <action>
Create the new migration file `supabase/migrations/00022_deals_logged_by.sql` with the EXACT content below. Before writing, verify free numbering: `ls supabase/migrations/ | grep -E '^00022_'` should return zero matches. If `00022_*.sql` is taken, bump to `00023_deals_logged_by.sql` and update all references in this and later tasks.

Content to write VERBATIM (do NOT simplify, do NOT remove asserts):

```sql
-- ============================================================================
-- Phase 45: deals.logged_by Migration + API + RLS
-- Migration: 00022_deals_logged_by.sql
--
-- Adds creator attribution and audit columns to public.deals, and the
-- two new RLS policies (coach_insert_deals, owner_insert_deals) that
-- form the second layer of the dual-layer authorization model
-- (route handler + RLS WITH CHECK) per DEALS-03.
--
-- Schema changes:
--   1. ADD COLUMN logged_by uuid REFERENCES users(id) ON DELETE SET NULL
--      Backfill: logged_by = student_id for every existing row.
--      Then ALTER COLUMN logged_by SET NOT NULL.
--   2. ADD COLUMN updated_by uuid REFERENCES users(id) ON DELETE SET NULL
--      (Nullable — historical rows have no recorded updater.)
--   3. CREATE OR REPLACE FUNCTION deals_set_audit() — BEFORE INSERT/UPDATE
--      trigger that sets updated_at = now() and updated_by from
--      current_setting('app.current_user_id', true)::uuid when present.
--      Replaces the existing handle_updated_at trigger on this table only.
--   4. Two new RLS policies:
--        coach_insert_deals  — coach can INSERT deals only for assigned students
--        owner_insert_deals  — owner can INSERT deals for any student
--      (Existing 8 policies are left untouched.)
--
-- Compatibility: existing student_insert_deals policy already gates
--   student inserts via student_id = (select get_user_id()); it stays.
--   The dual-layer model for coach/owner = route handler check (Task 2)
--   AND RLS WITH CHECK (this migration).
--
-- Requires: get_user_id(), get_user_role() from 00001_create_tables.sql
-- Requires: handle_updated_at() from 00001 (we DROP its TRIGGER on deals,
--   keep the function for other tables that still reference it).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Add logged_by column (NULL initially, backfill, then SET NOT NULL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill: every historical row was inserted by the student themselves
-- (Phase 38 had no coach/owner insert path). logged_by = student_id is the
-- correct retroactive attribution.
UPDATE public.deals
   SET logged_by = student_id
 WHERE logged_by IS NULL;

-- Enforce NOT NULL after backfill. NEW inserts MUST supply logged_by.
ALTER TABLE public.deals
  ALTER COLUMN logged_by SET NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. Add updated_by column (nullable — historical rows have no recorded updater)
-- ---------------------------------------------------------------------------
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- 3. deals_set_audit() trigger function
--    BEFORE INSERT: sets updated_at = now() (always), updated_by =
--      current_setting('app.current_user_id', true)::uuid IF present, else NULL.
--    BEFORE UPDATE: sets updated_at = now() and updated_by from the same
--      session GUC. Caller (API route) sets the GUC via
--      `SELECT set_config('app.current_user_id', '<uuid>', true)` before
--      every write. The 3rd arg (true) makes it transaction-local so it
--      auto-resets at commit/rollback.
--
--    SECURITY DEFINER + search_path = public (PERF-04 convention).
--    Returns NEW (BEFORE-trigger contract).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deals_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text;
BEGIN
  v_actor := current_setting('app.current_user_id', true);

  -- Always stamp updated_at on every write.
  NEW.updated_at := now();

  -- Stamp updated_by if a session actor is set.
  IF v_actor IS NOT NULL AND v_actor <> '' THEN
    BEGIN
      NEW.updated_by := v_actor::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Caller passed a non-uuid value — leave updated_by unchanged.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.deals_set_audit() IS
  'Phase 45: stamps updated_at + updated_by on every deals INSERT/UPDATE. updated_by sourced from session GUC app.current_user_id set by the API route before writes.';


-- Drop the existing handle_updated_at trigger on deals (Phase 38) and replace
-- with deals_set_audit which covers both updated_at AND updated_by.
DROP TRIGGER IF EXISTS set_updated_at ON public.deals;
DROP TRIGGER IF EXISTS set_audit ON public.deals;

CREATE TRIGGER set_audit
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_audit();


-- ---------------------------------------------------------------------------
-- 4. New RLS policies — dual-layer second leg
-- ---------------------------------------------------------------------------

-- Coach: INSERT deals only for students they are assigned to (DEALS-03 dual layer).
-- Initplan pattern: (select get_user_role()), (select get_user_id()).
DROP POLICY IF EXISTS coach_insert_deals ON public.deals;
CREATE POLICY coach_insert_deals ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM public.users WHERE coach_id = (select get_user_id())
    )
    AND logged_by = (select get_user_id())
  );

-- Owner: INSERT deals for any student (DEALS-05). logged_by must = owner uuid.
DROP POLICY IF EXISTS owner_insert_deals ON public.deals;
CREATE POLICY owner_insert_deals ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (select get_user_role()) = 'owner'
    AND logged_by = (select get_user_id())
  );


-- ---------------------------------------------------------------------------
-- 5. Verify composite unique index exists (created in Phase 38).
--    This phase does NOT create a duplicate — it asserts presence so the
--    plan's must_have remains true after this migration.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.deals'::regclass
       AND conname  = 'deals_student_deal_number_key'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = 'deals'
       AND indexdef ILIKE '%UNIQUE%student_id%deal_number%'
  ) THEN
    RAISE EXCEPTION
      'Expected composite UNIQUE on deals(student_id, deal_number); not found. '
      'Add it before this migration runs.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 6. Embedded asserts (run at migration time)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_logged_by_nullable boolean;
  v_updated_by_nullable boolean;
  v_logged_by_fk text;
  v_policy_count integer;
BEGIN
  -- logged_by NOT NULL after backfill
  SELECT is_nullable = 'YES' INTO v_logged_by_nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='deals' AND column_name='logged_by';
  ASSERT v_logged_by_nullable = false,
    'deals.logged_by must be NOT NULL after backfill';

  -- updated_by EXISTS and is nullable
  SELECT is_nullable = 'YES' INTO v_updated_by_nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='deals' AND column_name='updated_by';
  ASSERT v_updated_by_nullable = true,
    'deals.updated_by must be nullable';

  -- logged_by FK targets users(id) with ON DELETE SET NULL
  SELECT confdeltype::text INTO v_logged_by_fk
    FROM pg_constraint
   WHERE conrelid='public.deals'::regclass
     AND conkey  = ARRAY[(
       SELECT attnum FROM pg_attribute
        WHERE attrelid='public.deals'::regclass AND attname='logged_by'
     )::smallint];
  ASSERT v_logged_by_fk = 'n',
    format('deals.logged_by ON DELETE must be SET NULL (n), got %s', v_logged_by_fk);

  -- coach_insert_deals + owner_insert_deals exist
  SELECT count(*) INTO v_policy_count
    FROM pg_policies
   WHERE schemaname='public' AND tablename='deals'
     AND policyname IN ('coach_insert_deals', 'owner_insert_deals');
  ASSERT v_policy_count = 2,
    format('Expected 2 new INSERT policies (coach + owner); found %s', v_policy_count);
END $$;
```

After writing, run two safety greps:
  - `! grep -nE "(^|[^T])auth\.uid\(\)" supabase/migrations/00022_deals_logged_by.sql`  (PERF-03 — no bare auth.uid)
  - `grep -q "deals_student_deal_number_key" supabase/migrations/00022_deals_logged_by.sql`  (asserts the assert is present)
  </action>
  <verify>
    <automated>test -f supabase/migrations/00022_deals_logged_by.sql || test -f supabase/migrations/00023_deals_logged_by.sql</automated>
    <automated>grep -q "ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES public.users(id) ON DELETE SET NULL" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "ALTER COLUMN logged_by SET NOT NULL" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "CREATE OR REPLACE FUNCTION public.deals_set_audit" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "BEFORE INSERT OR UPDATE ON public.deals" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "CREATE POLICY coach_insert_deals" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "CREATE POLICY owner_insert_deals" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>! grep -nE "(^|[^T])auth\.uid\(\)" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
    <automated>grep -q "current_setting\('app.current_user_id'" supabase/migrations/0002[23]_deals_logged_by.sql</automated>
  </verify>
  <done>
Migration file exists at the first free 0002[23] slot. Contains: ADD COLUMN logged_by + backfill + SET NOT NULL; ADD COLUMN updated_by; deals_set_audit() function with session-GUC reading; new BEFORE INSERT OR UPDATE trigger replacing the old set_updated_at; two new RLS policies (coach_insert_deals, owner_insert_deals) using initplan + WITH CHECK; assertion that the composite unique constraint on (student_id, deal_number) is present; final DO-block asserts validating column nullability, FK ON DELETE SET NULL, and policy count = 2. Zero bare auth.uid() references.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend POST /api/deals — accept student_id + logged_by, dual-layer auth, GUC stamping</name>
  <read_first>
    - src/app/api/deals/route.ts (current — Phase 41 student-only POST)
    - src/app/api/deals/[id]/route.ts (existing three-tier auth pattern for DELETE — mirror it for POST)
    - src/lib/supabase/admin.ts (createAdminClient is a singleton — note the warning that it is service_role)
    - src/lib/supabase/server.ts (createClient for getUser auth check)
    - src/lib/rate-limit.ts (checkRateLimit signature)
    - src/lib/csrf.ts (verifyOrigin signature)
    - src/lib/config.ts (VALIDATION.deals at lines 337-342 — revenueMin, revenueMax, profitMin, profitMax)
    - CLAUDE.md (Hard Rules 4, 5, 7 — admin client, never swallow errors, zod from "zod")
    - .planning/REQUIREMENTS.md (DEALS-03, DEALS-04, DEALS-05 exact wording)
  </read_first>
  <files>src/app/api/deals/route.ts</files>
  <action>
Replace the `POST` function body inside `src/app/api/deals/route.ts` with the version below. KEEP the existing imports (next/server, zod, revalidateTag, createClient, createAdminClient, checkRateLimit, verifyOrigin, VALIDATION). KEEP the existing `GET` function untouched. EXTEND `postDealSchema` to include the two new optional fields.

REPLACE the `postDealSchema` definition (currently lines 14-17) with:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const postDealSchema = z.object({
  revenue: z.number().min(VALIDATION.deals.revenueMin).max(VALIDATION.deals.revenueMax),
  profit: z.number().min(VALIDATION.deals.profitMin).max(VALIDATION.deals.profitMax),
  student_id: z.string().regex(UUID_RE, "Invalid student_id").optional(),
  logged_by: z.string().regex(UUID_RE, "Invalid logged_by").optional(),
});
```

REPLACE the `POST` function (currently lines 23-127) with the version below. Critical changes vs. current implementation:
  - After role check, accept student/student_diy/coach/owner instead of student-only.
  - Compute the EFFECTIVE student_id and logged_by based on role (student => self for both; coach => body.student_id required + assignment check; owner => body.student_id required, logged_by = self).
  - For coach: route-handler ASSIGNMENT CHECK — `SELECT id FROM users WHERE id = body.student_id AND coach_id = profile.id` must return a row; otherwise 403.
  - For student: if body.logged_by present and != profile.id => 403 (DEALS-04). Same for coach (logged_by must = self) and owner (logged_by must = self).
  - Before insert, set the session GUC for the audit trigger using a small RPC call: `await admin.rpc('set_config', { ... })` is NOT used — instead use a raw SQL exec via `await admin.from('users').select('id').limit(0)` is also wrong; use the supported pattern: pre-INSERT `await admin.rpc("set_app_user", { p_user_id: profile.id })` IF such a function exists, otherwise rely on the trigger leaving updated_by NULL on INSERT (acceptable for inserts — updated_by reflects last UPDATE, and for INSERT the logged_by column already captures the creator). For audit completeness on INSERT, SET NEW.updated_by := NEW.logged_by inside the trigger when v_actor is NULL — that change has been baked into the migration in Task 1.
  - Re-emit the 23505 retry pattern from current code (deal_number+1 race) — UNCHANGED behavior. The retry path also includes logged_by/student_id in the insertPayload.
  - revalidateTag uses the EFFECTIVE student_id (not always profile.id) — coach/owner inserts must invalidate the student's deals cache.

REPLACE the existing `POST` function (delete current lines 23-127 and replace) with EXACTLY:

```ts
export async function POST(request: NextRequest) {
  try {
    // 1. CSRF protection
    const csrfError = verifyOrigin(request);
    if (csrfError) return csrfError;

    // 2. Auth check
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Profile lookup (admin client bypasses RLS)
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 4. Role check — students/coach/owner can create deals (Phase 45)
    if (!["student", "student_diy", "coach", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 5. Rate limit
    const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals");
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 6. Body parse
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // 7. Zod validation
    const parsed = postDealSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    // 8. Resolve effective student_id + logged_by per role (DEALS-03/04/05 dual-layer auth)
    let effectiveStudentId: string;
    let effectiveLoggedBy: string;

    if (profile.role === "student" || profile.role === "student_diy") {
      // Student self-insert: student_id = self; logged_by = self.
      // If body.logged_by is set and != self => 403 (DEALS-04).
      if (parsed.data.logged_by && parsed.data.logged_by !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // If body.student_id is set and != self => 403.
      if (parsed.data.student_id && parsed.data.student_id !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      effectiveStudentId = profile.id;
      effectiveLoggedBy = profile.id;
    } else if (profile.role === "coach") {
      // Coach insert: student_id REQUIRED in body; coach must be assigned (route-layer check).
      // logged_by must = coach.id (matches RLS WITH CHECK).
      if (!parsed.data.student_id) {
        return NextResponse.json({ error: "student_id is required for coach inserts" }, { status: 400 });
      }
      if (parsed.data.logged_by && parsed.data.logged_by !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: assigned } = await admin
        .from("users")
        .select("id")
        .eq("id", parsed.data.student_id)
        .eq("coach_id", profile.id)
        .maybeSingle();
      if (!assigned) {
        // Route-handler 403 (layer 1). RLS WITH CHECK is the second layer (DEALS-03).
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      effectiveStudentId = parsed.data.student_id;
      effectiveLoggedBy = profile.id;
    } else {
      // Owner: student_id REQUIRED in body; logged_by must = owner.id.
      if (!parsed.data.student_id) {
        return NextResponse.json({ error: "student_id is required for owner inserts" }, { status: 400 });
      }
      if (parsed.data.logged_by && parsed.data.logged_by !== profile.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Verify the student exists.
      const { data: student } = await admin
        .from("users")
        .select("id, role")
        .eq("id", parsed.data.student_id)
        .maybeSingle();
      if (!student || !["student", "student_diy"].includes(student.role)) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }
      effectiveStudentId = parsed.data.student_id;
      effectiveLoggedBy = profile.id;
    }

    // 9. DB insert with 23505 retry (trigger assigns deal_number — do NOT include it).
    const insertPayload = {
      student_id: effectiveStudentId,
      revenue: parsed.data.revenue,
      profit: parsed.data.profit,
      logged_by: effectiveLoggedBy,
    };

    const { data: deal, error: insertError } = await admin
      .from("deals")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Retry once on unique_violation (race on deal_number trigger). DEALS-02.
        const { data: retryDeal, error: retryError } = await admin
          .from("deals")
          .insert(insertPayload)
          .select()
          .single();

        if (retryError) {
          console.error("[POST /api/deals] Insert retry failed:", retryError);
          return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
        }

        revalidateTag(`deals-${effectiveStudentId}`, "default");
        return NextResponse.json({ data: retryDeal }, { status: 201 });
      }

      console.error("[POST /api/deals] Insert failed:", insertError);
      return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
    }

    // 10. Cache invalidation (per-student)
    revalidateTag(`deals-${effectiveStudentId}`, "default");

    // 11. Return 201
    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/deals] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

Verify the existing `GET` function below the new `POST` is untouched. The file should still compile and lint clean.
  </action>
  <verify>
    <automated>grep -q "student_id: z.string().regex(UUID_RE" src/app/api/deals/route.ts</automated>
    <automated>grep -q "logged_by: z.string().regex(UUID_RE" src/app/api/deals/route.ts</automated>
    <automated>grep -q "\"student\", \"student_diy\", \"coach\", \"owner\"" src/app/api/deals/route.ts</automated>
    <automated>grep -q "logged_by: effectiveLoggedBy" src/app/api/deals/route.ts</automated>
    <automated>grep -q "revalidateTag(\`deals-\${effectiveStudentId}\`" src/app/api/deals/route.ts</automated>
    <automated>grep -q "Forbidden" src/app/api/deals/route.ts</automated>
    <automated>grep -q "console.error" src/app/api/deals/route.ts</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run lint</automated>
  </verify>
  <done>
POST handler accepts student/student_diy/coach/owner. For coach: requires body.student_id, performs assignment check via admin.from("users").eq("id", student_id).eq("coach_id", profile.id); 403 if no row. For student: 403 if body.logged_by != self or body.student_id != self. For owner: requires body.student_id; verifies the target is a student/student_diy. logged_by is always set to the caller's profile.id (matching RLS WITH CHECK). 23505 retry preserved. revalidateTag uses effective student_id. GET handler unchanged. lint + tsc clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update src/lib/types.ts deals interface — add logged_by + updated_by</name>
  <read_first>
    - src/lib/types.ts (lines 662-699 — current deals block)
    - supabase/migrations/0002[23]_deals_logged_by.sql (Task 1 — schema source of truth)
  </read_first>
  <files>src/lib/types.ts</files>
  <action>
Edit `src/lib/types.ts` and update the `deals` table block (currently at lines 662-699). Add `logged_by` (string, required in Row, optional in Insert because the API always supplies it but we want to allow updates to omit it; required-ish in Insert per DB NOT NULL — KEEP it required in Insert) and `updated_by` (string | null in Row, optional in Insert, optional in Update).

REPLACE the deals.Row type (currently lines 663-671) with:

```ts
        Row: {
          id: string;
          student_id: string;
          deal_number: number;
          revenue: string | number;
          profit: string | number;
          logged_by: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
```

REPLACE the deals.Insert type (currently lines 672-680) with:

```ts
        Insert: {
          id?: string;
          student_id: string;
          deal_number?: number;
          revenue: string | number;
          profit: string | number;
          logged_by: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
```

REPLACE the deals.Update type (currently lines 681-689) with:

```ts
        Update: {
          id?: string;
          student_id?: string;
          deal_number?: number;
          revenue?: string | number;
          profit?: string | number;
          logged_by?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
```

Append two new entries to the deals.Relationships array (after the existing `deals_student_id_fkey` entry, INSIDE the same array). The full updated Relationships array must contain three entries:

```ts
        Relationships: [
          {
            foreignKeyName: "deals_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_logged_by_fkey";
            columns: ["logged_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deals_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
```

Do NOT touch any other table block. Do NOT change deals fields named id/student_id/deal_number/revenue/profit/created_at/updated_at — only ADD the two new columns and FK relationships.
  </action>
  <verify>
    <automated>grep -n "logged_by: string;" src/lib/types.ts | grep -q .</automated>
    <automated>grep -n "updated_by: string | null;" src/lib/types.ts | grep -q .</automated>
    <automated>grep -q "deals_logged_by_fkey" src/lib/types.ts</automated>
    <automated>grep -q "deals_updated_by_fkey" src/lib/types.ts</automated>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
src/lib/types.ts deals.Row contains logged_by: string and updated_by: string | null. Insert requires logged_by, Update has both as optional. Relationships array has three entries (student_id, logged_by, updated_by) all referencing users.id. tsc --noEmit exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 4: [BLOCKING] Schema push + dual-layer authorization tests + post-phase build gate</name>
  <read_first>
    - supabase/migrations/0002[23]_deals_logged_by.sql (Task 1 output)
    - src/app/api/deals/route.ts (Task 2 output)
    - src/lib/types.ts (Task 3 output)
    - supabase/config.toml (project ref, if present)
    - CLAUDE.md (Commands section)
  </read_first>
  <files>(no source edits — verifies DB + API contract + build gate)</files>
  <action>
This task is BLOCKING — Phase 45 cannot pass verification without it.

1. Push schema to the connected Supabase project:
   `supabase db push`
   If the CLI prompts in a non-TTY shell, set `SUPABASE_ACCESS_TOKEN` and retry. If push fails, STOP — do not mark complete. The embedded DO-block asserts will raise ERROR on any schema mismatch (column nullability, FK action, policy count), aborting the push.

2. Verify schema:
   ```sql
   SELECT column_name, is_nullable, data_type
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='deals' AND column_name IN ('logged_by','updated_by','updated_at')
    ORDER BY column_name;
   ```
   Expect: `logged_by` NO/uuid, `updated_at` NO/timestamp with time zone, `updated_by` YES/uuid.

3. Verify policies:
   ```sql
   SELECT policyname, cmd
     FROM pg_policies
    WHERE schemaname='public' AND tablename='deals'
    ORDER BY policyname;
   ```
   Expect 10 rows (8 from Phase 38 + 2 new: coach_insert_deals, owner_insert_deals).

4. Verify trigger:
   ```sql
   SELECT tgname, tgtype FROM pg_trigger
    WHERE tgrelid = 'public.deals'::regclass AND NOT tgisinternal;
   ```
   Expect: `set_deal_number` (BEFORE INSERT), `set_audit` (BEFORE INSERT OR UPDATE). The old `set_updated_at` should be GONE.

5. Functional dual-layer authorization tests. Use psql / Supabase SQL editor via three test sessions impersonating roles. For each, run as the corresponding JWT (Supabase impersonate panel) OR via `SELECT set_config('request.jwt.claims', json_build_object('sub', '<auth_id>', 'role', 'authenticated')::text, true)` then `SET ROLE authenticated`. Capture the RESULT of each (success / RLS denial code 42501) into the SUMMARY.

   (a) Coach — non-assigned student insert SHOULD FAIL (403/RLS):
       POST /api/deals as coach C1 with body `{ revenue: 100, profit: 50, student_id: '<student-NOT-assigned-to-C1>' }` → expect HTTP 403 (route handler).
       Then bypass route handler and run as coach C1's JWT directly:
       ```sql
       INSERT INTO public.deals (student_id, revenue, profit, logged_by)
       VALUES ('<student-not-assigned>', 100, 50, '<coach-c1-id>');
       ```
       Expect SQLSTATE 42501 (new row violates RLS policy). PROVES dual layer (DEALS-03).

   (b) Coach — assigned student insert SHOULD SUCCEED:
       POST /api/deals as coach C1 with body `{ revenue: 100, profit: 50, student_id: '<student-assigned-to-C1>' }` → expect HTTP 201 with logged_by = C1.id.

   (c) Student — logged_by spoof SHOULD FAIL:
       POST /api/deals as student S1 with body `{ revenue: 100, profit: 50, logged_by: '<some-other-user-id>' }` → expect HTTP 403 (DEALS-04).

   (d) Student — self-insert (no logged_by, no student_id) SHOULD SUCCEED:
       POST /api/deals as student S1 with body `{ revenue: 100, profit: 50 }` → expect HTTP 201, logged_by = S1.id, student_id = S1.id.

   (e) Owner — insert for any student SHOULD SUCCEED (DEALS-05):
       POST /api/deals as owner O1 with body `{ revenue: 100, profit: 50, student_id: '<any-student>' }` → expect HTTP 201, logged_by = O1.id, student_id = requested.

   (f) 23505 retry (DEALS-02) — concurrent inserts. Open two psql sessions and BEGIN; INSERT INTO deals(student_id, revenue, profit, logged_by) VALUES ('<same-student>', 1, 0, '<student-id>'); on both, then COMMIT both. The trigger's FOR UPDATE row lock should serialize them and BOTH should commit with adjacent deal_number values. If a 23505 surfaces at the API layer, the route handler retries once and returns 201. Document outcome.

   For tests that cannot be run from a remote agent, document the SQL/curl recipe in the SUMMARY and mark the test "documented; awaiting human run" if necessary — DO NOT silently skip.

6. Post-phase build gate (success criterion 6):
   `npm run lint && npx tsc --noEmit && npm run build`
   All three exit 0.

7. Verify no regressions in existing routes: `grep -n "Phase 45" src/app/api/deals/route.ts || true` is informational only; the load-bearing check is that GET /api/deals still compiles and returns 200 for coach/owner with valid student_id.
  </action>
  <verify>
    <automated>npm run lint</automated>
    <automated>npx tsc --noEmit</automated>
    <automated>npm run build</automated>
    <automated>test -f supabase/migrations/00022_deals_logged_by.sql || test -f supabase/migrations/00023_deals_logged_by.sql</automated>
  </verify>
  <done>
`supabase db push` exited 0 (asserts passed). Schema query confirms logged_by NOT NULL uuid + updated_by nullable uuid. Policy query shows 10 policies including coach_insert_deals and owner_insert_deals. Trigger query shows set_deal_number + set_audit (no set_updated_at). All 6 functional auth tests captured in SUMMARY with expected outcomes (route 403 + RLS 42501 for non-assigned coach; 201 for assigned coach; 403 for student logged_by spoof; 201 for student self-insert; 201 for owner-any-student; 23505 retry both succeed). `npm run lint && npx tsc --noEmit && npm run build` all exit 0.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser -> /api/deals | Untrusted JSON body. Now includes optional student_id and logged_by — both UUID-validated by Zod, then re-validated by role logic. |
| Route handler -> Postgres (admin client) | Service-role connection bypasses RLS. Dual-layer model: route handler is layer 1, RLS WITH CHECK on coach_insert_deals / owner_insert_deals is layer 2. If admin-client mistakenly passes a forged student_id, RLS WITH CHECK still rejects unless the row matches policy expressions — but admin client uses service_role which BYPASSES RLS. Therefore the route-handler check is load-bearing for admin-client writes; RLS WITH CHECK is the defense for any future code path that uses an authenticated client (e.g., RPC) per DEALS-03 dual-layer requirement. |
| Postgres trigger (deals_set_audit) -> session GUC | `current_setting('app.current_user_id', true)` is read with the missing_ok flag. Cannot panic if unset. The GUC is NEVER trusted for authorization — it is only stamped onto the audit row. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-45-01 | E (Elevation of privilege) | Coach POST with non-assigned student_id | mitigate | Route handler queries `users WHERE id=$1 AND coach_id=profile.id`. RLS coach_insert_deals also enforces `student_id IN (SELECT id FROM users WHERE coach_id=(select get_user_id()))`. Dual-layer per DEALS-03. |
| T-45-02 | S (Spoofing) | Student POST with logged_by = other user | mitigate | Route handler explicit equality check `parsed.data.logged_by !== profile.id` returns 403 (DEALS-04). RLS student_insert_deals already enforces student_id = self; the new logged_by check is route-only because the existing student INSERT policy doesn't reference logged_by — adding `AND logged_by = (select get_user_id())` to the student_insert_deals policy is a stretch goal, deferred to Phase 49 if needed. |
| T-45-03 | T (Tampering) | Future RPC bypassing route handler | mitigate | RLS WITH CHECK on coach_insert_deals / owner_insert_deals enforces logged_by = caller and student_id assignment regardless of which API surface inserts. |
| T-45-04 | I (Information disclosure) | logged_by/updated_by FK chain leaks user_id | accept | logged_by/updated_by are uuids, not PII. They are intentionally exposed to coach/owner reads. Student SELECT policies do not expose other users' deals. |
| T-45-05 | R (Repudiation) | Missing audit trail on student inserts | mitigate | logged_by is NOT NULL — every row has a recorded creator. updated_by is set on subsequent UPDATEs by the deals_set_audit trigger reading the session GUC. INSERT-time updated_by is NULL (acceptable — logged_by is the create-time attribution). |
| T-45-06 | D (Denial of service) | 23505 retry storm under high contention | accept | Single retry policy is unchanged from Phase 41. Trigger uses FOR UPDATE row lock per student_id — only same-student concurrent inserts contend, and the retry covers the rare double-fire window. Per-student rate limit prevents abuse. |
| T-45-07 | E (Elevation of privilege) | Owner inserts deal for non-existent student_id | mitigate | Owner branch verifies `users WHERE id=$1 AND role IN ('student','student_diy')` before insert. 404 if not found. |
| T-45-08 | I (Information disclosure) | Migration backfill leaks via logs | accept | Backfill is `UPDATE deals SET logged_by = student_id WHERE logged_by IS NULL` — no PII in log line. |
| T-45-09 | T (Tampering) | search_path hijack inside deals_set_audit | mitigate | Function declares `SET search_path = public` (PERF-04). |
</threat_model>

<verification>
Phase-level checks (run after all four tasks complete):

1. Migration file present:
   - `test -f supabase/migrations/00022_deals_logged_by.sql || test -f supabase/migrations/00023_deals_logged_by.sql`

2. Schema columns (DB query, captured into SUMMARY):
   - `logged_by` is `uuid NOT NULL` referencing `users(id) ON DELETE SET NULL`
   - `updated_by` is `uuid NULL` referencing `users(id) ON DELETE SET NULL`

3. Trigger:
   - `set_audit` exists as `BEFORE INSERT OR UPDATE` on `public.deals`
   - Old `set_updated_at` trigger on deals is GONE

4. Policies (DB query):
   - `coach_insert_deals` exists with cmd=INSERT and uses `(select get_user_role()) = 'coach'`
   - `owner_insert_deals` exists with cmd=INSERT and uses `(select get_user_role()) = 'owner'`
   - The 8 original policies are unchanged

5. Composite unique constraint preserved:
   - `deals_student_deal_number_key` still present on (student_id, deal_number) — the migration's verifying DO block raises if missing

6. API contract (grep src/app/api/deals/route.ts):
   - postDealSchema includes optional student_id and logged_by with UUID regex
   - Role check accepts student/student_diy/coach/owner
   - Coach branch performs assignment check: `.eq("id", parsed.data.student_id).eq("coach_id", profile.id)`
   - Student branch returns 403 if `parsed.data.logged_by !== profile.id`
   - revalidateTag uses effectiveStudentId

7. Type definitions (grep src/lib/types.ts):
   - deals.Row has `logged_by: string` and `updated_by: string | null`
   - Three entries in deals.Relationships array (student_id, logged_by, updated_by)

8. Dual-layer functional tests (Task 4 SUMMARY):
   - Coach + non-assigned student → 403 from route AND 42501 from RLS direct insert
   - Coach + assigned student → 201
   - Student + spoofed logged_by → 403
   - Student + self → 201
   - Owner + any student → 201
   - 23505 retry — both concurrent inserts succeed with adjacent deal_number values

9. Post-phase build gate (success criterion 6):
   - `npm run lint` exits 0
   - `npx tsc --noEmit` exits 0
   - `npm run build` exits 0
</verification>

<success_criteria>
All six roadmap success criteria for Phase 45 hold:

1. Migration `0002[23]_deals_logged_by.sql` adds `logged_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL` (after backfill = student_id), plus `updated_at TIMESTAMPTZ` (already present from Phase 38 — this phase preserves it) and `updated_by UUID` with the BEFORE INSERT OR UPDATE `deals_set_audit` trigger that stamps both on every UPDATE. Confirmed by the embedded DO-block asserts.
2. Composite unique on (student_id, deal_number) is verified present (Phase 38 created `deals_student_deal_number_key`); concurrent inserts that would collide retry once with `deal_number+1` on 23505 — preserved unchanged from Phase 41 in the route handler. Functional test in Task 4(f).
3. Coach POST with non-assigned student_id receives 403 from route handler AND RLS WITH CHECK (`coach_insert_deals` policy) would also reject — proved in Task 4(a) by running both the API call AND a direct authenticated-client SQL insert.
4. Student POST with logged_by set to another user receives 403 (Task 4(c)); student self-insert with logged_by = self (or omitted) succeeds (Task 4(d)).
5. Owner POST for any student succeeds; logged_by = owner uuid; student_id = viewed student (Task 4(e)).
6. `npm run lint && npx tsc --noEmit && npm run build` all exit 0 (Task 4 step 6).
</success_criteria>

<output>
After completion, create `.planning/phases/45-deals-logged-by-migration-api-rls/45-01-SUMMARY.md` with:
  - Migration filename actually used (00022 or 00023…)
  - `information_schema.columns` query output for logged_by / updated_by / updated_at
  - `pg_policies` query output (10 rows expected)
  - `pg_trigger` query output (set_deal_number + set_audit)
  - Functional auth test outcomes (Task 4 steps 5(a)-5(f)) — actual HTTP status codes, RLS error codes, sample inserted row JSON
  - Build gate exit codes (lint, tsc, build)
  - Any deviations (e.g., migration number bumped to 00023)
</output>
