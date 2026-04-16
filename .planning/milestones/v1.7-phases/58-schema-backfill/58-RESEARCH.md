# Phase 58: Schema & Backfill - Research

**Researched:** 2026-04-16
**Domain:** Postgres schema migration (additive columns + deterministic backfill + partial UNIQUE index) and env-example documentation
**Confidence:** HIGH

## Summary

Phase 58 is a pure database-plus-config phase: add two nullable columns to `public.users`, deterministically backfill `referral_code` for every existing `student` / `student_diy` row, enforce uniqueness via a partial UNIQUE index (WHERE `referral_code IS NOT NULL`), and append `REBRANDLY_API_KEY=` to `.env.local.example`. No API routes, no UI, no RLS policy changes — all referral reads/writes in later phases will go through the admin client, which bypasses RLS by design per CLAUDE.md Hard Rule 4 and the existing `users` table's RLS posture.

Every ingredient here is already a proven pattern in this repo: `00022_deals_logged_by.sql` is a near-perfect template (ADD COLUMN → backfill UPDATE → optionally tighten constraint → embedded `DO $$ ... ASSERT ... $$` block). Recent migrations (00027+) wrap the entire DDL+DML in an explicit `BEGIN; ... COMMIT;` for atomic rollback on assertion failure — Phase 58 must follow that same envelope so a failed invariant check (e.g. an unexpected owner row ending up with a non-null code) rolls the whole migration back cleanly.

One subtle point deserves upfront attention: Postgres's native `md5()` returns a 32-char hex string and `substr(md5(id::text), 1, 8)` yields 8 lower-case hex chars; wrapping in `upper()` is what makes the success-criterion string (`upper(substr(md5(id::text), 1, 8))`) deterministic in the documented form. `varchar(12)` has 4 chars of headroom for the 8-char hex payload — the extra width is for API-03 in Phase 59, which generates its own 8-char codes for any user whose `referral_code` is still NULL at request time.

**Primary recommendation:** Write `00031_referral_links.sql` as a single `BEGIN;...COMMIT;` transaction with five ordered sections — (1) `ALTER TABLE ADD COLUMN` × 2, (2) backfill `UPDATE ... WHERE role IN ('student','student_diy')`, (3) `CREATE UNIQUE INDEX ... WHERE referral_code IS NOT NULL`, (4) optional `COMMENT ON COLUMN` documentation, (5) `DO $$ ... ASSERT ... $$` block verifying the three success criteria (columns exist nullable; every target row backfilled; zero owner/coach rows got a code; unique index present). Regenerate `src/lib/types.ts` afterward so the new columns surface on `Database['public']['Tables']['users']['Row' | 'Insert' | 'Update']`. Append a commented `REBRANDLY_API_KEY=` block to `.env.local.example`. Final gate: `npm run lint && npx tsc --noEmit && npm run build`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion

All implementation choices. Auto-generated from ROADMAP Phase 58 description and success criteria (DB-01, DB-02, DB-03, CFG-01, CFG-02).

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped.

### Out-of-Scope Reminders from Milestone Spec (REQUIREMENTS.md, STATE.md)

- **No payout / $500 credit tracking** — Phase 58 is schema only; payout is a future milestone.
- **No referral analytics UI, no admin referral dashboard** — deferred.
- **No registration / onboarding referral-capture flow** — v1.7 is link generation only.
- **No custom Rebrandly branded domain** — use default `rebrand.ly`.
- **No rate-limiting on `/api/referral-link`** — Phase 59 concern, and idempotent by design (one Rebrandly call per user for life).
- **No RLS changes** — `public.users` RLS is untouched; referral reads/writes use admin client (Hard Rule 4).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID     | Description                                                                                                                                                                                                      | Research Support                                                                                                                                                                                                                                        |
|--------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| DB-01  | Migration `00031_referral_links.sql` adds two nullable columns to `public.users`: `referral_code` (`varchar(12)`, UNIQUE where NOT NULL) and `referral_short_url` (`text`). Runs cleanly on top of `00030`.      | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with explicit NULL — standard additive-migration pattern; 00022 logged_by is the template. `varchar(12)` is wider than the 8 required hex chars to match API-03 future use of 8-char codes with slack.       |
| DB-02  | Same migration backfills `referral_code` for every existing `student` and `student_diy` row using `upper(substr(md5(id::text), 1, 8))`. Owner and coach rows left untouched (still NULL).                        | `UPDATE public.users SET referral_code = upper(substr(md5(id::text), 1, 8)) WHERE role IN ('student','student_diy')` — Postgres native `md5()` returns lower-hex text; `upper()` forces the documented shape. Idempotent across re-runs (deterministic). |
| DB-03  | `referral_code` uniqueness enforced by index (UNIQUE where NOT NULL) so collisions surface at write time, not silently.                                                                                         | `CREATE UNIQUE INDEX idx_users_referral_code ON public.users(referral_code) WHERE referral_code IS NOT NULL` — partial unique index; precedent in 00015 (`idx_messages_recipient_read ... WHERE read_at IS NULL`).                                       |
| CFG-01 | `.env.local.example` documents `REBRANDLY_API_KEY=` (empty value) under a clearly labelled section so onboarding devs know the key is required.                                                                  | Current file has 6 lines; append a two-line comment block and the empty assignment. `.env.local.example` is NOT ignored by `.gitignore` (only `.env*.local` is). Missing-env error path = `process.env.X!` non-null assertion throws at runtime.           |
| CFG-02 | Post-phase build gate (`npm run lint && npx tsc --noEmit && npm run build`) exits 0 with no new errors/warnings.                                                                                                | Running the gate after the migration + types regen + env-example edit catches any drift (e.g. stale `Database` type, import errors). Already the standard phase-close ritual across v1.4–v1.6.                                                          |
</phase_requirements>

## Architectural Responsibility Map

| Capability                              | Primary Tier         | Secondary Tier       | Rationale                                                                                                         |
|-----------------------------------------|---------------------|----------------------|-------------------------------------------------------------------------------------------------------------------|
| Store per-user referral code + short URL | Database / Storage  | —                    | Additive columns on `public.users`; no app-tier surface change in Phase 58.                                       |
| Backfill existing rows                   | Database / Storage  | —                    | Deterministic `UPDATE` computed inside Postgres from existing `id` — no app code involved.                        |
| Collision detection                      | Database / Storage  | API (Phase 59)       | Partial UNIQUE index produces a constraint violation; API layer in Phase 59 will surface it as HTTP 409/500 with logged cause. |
| Env-var contract (REBRANDLY_API_KEY)     | CDN / Static (repo) | API / Backend (read) | `.env.local.example` is a checked-in file (not runtime); `process.env.REBRANDLY_API_KEY` is read by Phase 59 API route. |
| Types generation (`src/lib/types.ts`)    | Database / Storage  | API + Frontend       | New columns must surface in `Database` type so Phase 59 admin-client reads compile.                               |
| Build gate                               | CI / Local          | —                    | `lint + tsc --noEmit + build` — cross-cutting; not a runtime tier.                                                |

## Standard Stack

### Core

| Library     | Version   | Purpose                                              | Why Standard                                                                                                         |
|-------------|-----------|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| PostgreSQL  | 14+       | Schema migration, backfill, partial unique index     | Already the platform DB (Supabase); `md5()`, partial indexes, and transactional DDL are all first-class.            |
| Supabase CLI| ^2.78.1   | Generates `src/lib/types.ts` from live schema        | Already in `devDependencies`; `npx supabase gen types typescript` is the existing regen flow.                       |
| Next.js     | 16.1.6    | Compile/lint gate; build must pass after migration   | Already the app runtime — build gate is the phase-close ritual.                                                      |
| TypeScript  | ^5        | `tsc --noEmit` type-check picks up new `Database` row fields | Strict mode in tsconfig.json — every untyped reference to `referral_code` in later phases will fail build. |

### Supporting

| Library                | Version  | Purpose                                        | When to Use                                                                 |
|------------------------|----------|------------------------------------------------|-----------------------------------------------------------------------------|
| `@supabase/supabase-js`| ^2.99.2  | Admin client runtime (used by Phase 59)        | Not touched in Phase 58 — listed so the planner knows which types key off `Database`. |
| `zod`                  | ^4.3.6   | Runtime schema validation (Phase 59)           | Not used in Phase 58 — listed for cross-phase awareness (Hard Rule 7 still applies in 59). |

### Alternatives Considered

| Instead of                                         | Could Use                                                                                 | Tradeoff                                                                                                                                                                                                                 |
|----------------------------------------------------|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Partial UNIQUE INDEX `WHERE IS NOT NULL`           | Table-level `UNIQUE` on the column                                                        | Plain `UNIQUE` treats NULL as distinct (Postgres allows many NULLs), so technically it also works — but the success-criterion explicitly says "UNIQUE-where-NOT-NULL index". Partial index is unambiguous; stick with it. |
| `upper(substr(md5(id::text), 1, 8))` backfill expression | Random 8-char generation inside `UPDATE`                                           | Random is non-deterministic — re-running the migration on a fresh database would produce different codes. Success criterion #2 literally names the md5 expression; deterministic is the point.                           |
| Regenerate `types.ts` via Supabase CLI             | Hand-edit the `users` Row/Insert/Update blocks                                            | Hand-edit is fine for a 2-column addition (pattern is obvious) and avoids re-running codegen on an unrelated schema surface. Existing `types.ts` has "HAND-EDIT: ... reapply after regen" comments confirming both paths are accepted. |
| Append `REBRANDLY_API_KEY=` at end of file         | Insert alphabetically / in a grouped "third-party integrations" section                   | File is 6 lines with a Discord group already; simply appending a new labelled block matches existing style.                                                                                                              |

**Installation:**

No new npm packages are added in Phase 58. Supabase CLI is already installed as a devDependency.

```bash
# No-op — dependency snapshot unchanged after this phase.
```

**Version verification:** The stack is verified against the local `package.json` (read 2026-04-16): Next 16.1.6, React 19.2.3, TypeScript ^5, Zod ^4.3.6, Supabase CLI ^2.78.1, `@supabase/supabase-js` ^2.99.2 `[VERIFIED: package.json]`. No new packages needed, so no `npm view` call is necessary.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│  supabase/migrations/   │
│  00030_roadmap_step_8…  │  ◄── last applied baseline
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  00031_referral_links.sql  (NEW, this phase)    │
│  ─────────────────────────────────────────────  │
│  BEGIN;                                         │
│    [1] ALTER TABLE users ADD COLUMN referral_code varchar(12)     │
│    [1] ALTER TABLE users ADD COLUMN referral_short_url text       │
│    [2] UPDATE users SET referral_code = upper(substr(md5(id::text), 1, 8)) │
│        WHERE role IN ('student','student_diy') AND referral_code IS NULL  │
│    [3] CREATE UNIQUE INDEX idx_users_referral_code                │
│        ON users(referral_code) WHERE referral_code IS NOT NULL    │
│    [4] COMMENT ON COLUMN … (optional documentation)               │
│    [5] DO $$ ... ASSERT ... $$  (4 invariants; fail → rollback)   │
│  COMMIT;                                        │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│  public.users           │      │  src/lib/types.ts (regen)    │
│  ─ referral_code        │◄─────│  users.Row gains two fields  │
│  ─ referral_short_url   │      │  → downstream tsc --noEmit   │
│  ─ partial UNIQUE idx   │      └──────────────────────────────┘
└─────────────────────────┘

┌─────────────────────────────────┐
│  .env.local.example  (edit)     │
│  append: REBRANDLY_API_KEY=     │
│  (documents onboarding contract; │
│   process.env.X! throws at      │
│   runtime in Phase 59 when unset)│
└─────────────────────────────────┘

             │
             ▼
┌─────────────────────────────────┐
│  CFG-02 Build Gate              │
│  npm run lint && npx tsc        │
│    --noEmit && npm run build    │
└─────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/migrations/
└── 00031_referral_links.sql      # NEW — single-transaction migration

src/lib/
└── types.ts                       # EDIT — add referral_code / referral_short_url to users Row/Insert/Update

.env.local.example                 # EDIT — append REBRANDLY_API_KEY= block
```

No new directories, no new components, no new API routes in this phase.

### Pattern 1: Additive column migration with deterministic backfill + embedded assertions

**What:** A single `BEGIN;...COMMIT;` migration file that adds columns, backfills from existing data, creates supporting indexes, then runs a `DO $$ ... ASSERT ... $$` block to verify invariants. Any ASSERT failure raises an exception, Postgres auto-rollbacks, the database ends in its pre-migration state.

**When to use:** Any schema change that adds a nullable column + derives its value from existing rows. Non-negotiable for this repo per the `00022_deals_logged_by.sql` precedent.

**Example:**

```sql
-- Source: supabase/migrations/00022_deals_logged_by.sql (repo precedent — HIGH confidence)

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS logged_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.deals
   SET logged_by = student_id
 WHERE logged_by IS NULL;

ALTER TABLE public.deals
  ALTER COLUMN logged_by SET NOT NULL;

-- … [other DDL / DML] …

DO $$
DECLARE
  v_logged_by_nullable boolean;
BEGIN
  SELECT is_nullable = 'YES' INTO v_logged_by_nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='deals' AND column_name='logged_by';
  ASSERT v_logged_by_nullable = false,
    'deals.logged_by must be NOT NULL after backfill';
END $$;
```

### Pattern 2: Partial UNIQUE index `WHERE column IS NOT NULL`

**What:** A unique constraint that only applies when the column is non-null — allows many NULL rows (owners, coaches) while enforcing uniqueness on non-null rows (students, student_diy).

**When to use:** Any time a column is optional per-row but must be unique when present. Precedent in this repo: `00015_v1_4_schema.sql` used this exact pattern for `idx_messages_recipient_read` (WHERE `read_at IS NULL`) — same syntactic shape, different predicate. `[VERIFIED: grep of supabase/migrations]`

**Example:**

```sql
-- Source: Pattern derived from 00015:62 (idx_messages_recipient_read); Postgres docs

CREATE UNIQUE INDEX idx_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;
```

**Key difference from `UNIQUE` constraint:** In Postgres, a table-level `UNIQUE` already treats NULLs as distinct (many NULLs allowed) `[CITED: Postgres docs — unique constraint semantics]`, so technically `ALTER TABLE ADD UNIQUE (referral_code)` would also "work". But the success criterion explicitly names the partial unique index — that's the committed shape, and partial indexes also skip over NULL rows in the on-disk structure (marginal read/write perf gain at scale).

### Pattern 3: Deterministic backfill expression tied to primary key

**What:** Derive the backfilled value from immutable columns (here: `id::text`) so re-running the migration on a freshly reset database produces identical codes. This is important for reproducibility across dev/staging/prod and for any future smoke-test that seeds users.

**Why `md5`:** Postgres native, no extension required, deterministic, produces a 32-char lowercase hex string. Taking the first 8 chars (`substr(md5(id::text), 1, 8)`) gives a 36^8 ≈ 2.8 trillion (actually 16^8 = ~4.3 billion) address space, which is more than enough for any plausible student count — collision risk at 100k users is ~10^-4 (birthday paradox on 4.3B slots). Phase 59 handles any collision gracefully via the UNIQUE index raising `23505`.

**Example:**

```sql
-- Source: Success criterion #2 (REQUIREMENTS DB-02)

UPDATE public.users
   SET referral_code = upper(substr(md5(id::text), 1, 8))
 WHERE role IN ('student', 'student_diy')
   AND referral_code IS NULL;  -- idempotency guard: don't overwrite if re-run
```

### Anti-Patterns to Avoid

- **Non-transactional migration (omitting `BEGIN;...COMMIT;`):** Without an explicit transaction envelope, a mid-migration failure leaves the database in a partial state (e.g. columns added but backfill half-done, or backfill done but index missing). Every migration from 00027 onward uses explicit `BEGIN;...COMMIT;` — follow that.
- **Backfilling before adding NOT NULL / uniqueness constraints in the wrong order:** If you create the UNIQUE index BEFORE the backfill, the index is empty at creation (fine), but if the backfill produces a collision (extraordinarily unlikely, but possible), the UPDATE fails mid-way. Order doesn't actually matter for correctness here because the index is partial-on-not-null, but conceptually it's cleaner to: ADD COLUMN (null) → BACKFILL → CREATE INDEX. Matches the template in 00022.
- **Using `CREATE TABLE … referral_code ... UNIQUE` inline:** We're adding to an existing table, not creating one — inline UNIQUE isn't an option anyway, but flagging so the planner doesn't propose it.
- **Overwriting existing non-null codes on re-run:** The backfill `UPDATE` must include `AND referral_code IS NULL` so a second run is a no-op. Without this guard, a hand-assigned code (if any ever get introduced) would be silently replaced.
- **Forgetting to regenerate `src/lib/types.ts`:** If `types.ts` isn't updated, any code in Phase 59/60 that touches `user.referral_code` either errors (strict mode) or gets typed as `unknown` — build gate catches this, but updating in the same commit avoids a second CI cycle.
- **Adding `REBRANDLY_API_KEY` to an ignored file:** `.gitignore` blocks `.env*.local` but NOT `.env.local.example`. Double-check the diff shows the file as tracked.
- **Committing a real API key accidentally:** The value in `.env.local.example` MUST be empty (`REBRANDLY_API_KEY=`). Real keys live only in `.env.local` (gitignored) or in hosting env vars.

## Don't Hand-Roll

| Problem                                              | Don't Build                                                              | Use Instead                                                         | Why                                                                                                                                          |
|------------------------------------------------------|--------------------------------------------------------------------------|---------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Unique-but-nullable column constraint                | Trigger function that checks uniqueness on INSERT/UPDATE                  | Partial UNIQUE index `WHERE col IS NOT NULL`                        | Triggers are race-y, indexes are atomic. Postgres handles this exact case natively. Precedent: 00015 `idx_messages_recipient_read`.          |
| Deterministic 8-char ID derivation                   | JavaScript/Python script that SELECTs users, hashes client-side, UPDATEs| `upper(substr(md5(id::text), 1, 8))` inside a single UPDATE         | Single round trip, no race with concurrent inserts, deterministic, no new dependency. Postgres `md5()` is first-class.                       |
| Runtime "env var missing" error path                 | Custom env-var validation library                                        | Existing `process.env.X!` non-null-assertion pattern                | Repo already does this in `src/lib/supabase/admin.ts`. TypeScript's `!` operator crashes loudly at first access — exact behaviour CFG-01 names. |
| Migration runner                                     | Custom SQL-apply script                                                  | `supabase` CLI (already in devDependencies)                         | Supabase CLI owns the 00001–00030 sequence; introducing a second runner forks the migration flow.                                            |
| Types codegen for 2-column addition                  | Hand-rolled codegen script                                               | `npx supabase gen types typescript` OR inline edit per existing `// HAND-EDIT` comments | Both are pre-approved in repo: `types.ts` has explicit `HAND-EDIT: narrow from DB CHECK constraint — reapply after regen.` markers. Simpler path wins. |

**Key insight:** This phase has zero net-new primitives. Every ingredient (additive migration, backfill, partial UNIQUE, embedded ASSERTs, env example) has at least one direct precedent in `supabase/migrations/` or in `src/lib/`. The planner's job is to sequence the primitives, not to research novel ones.

## Runtime State Inventory

> This phase is additive schema + config; it is not a rename/refactor/migration-of-existing-data phase in the destructive sense. However, the backfill step DOES write runtime state, so the inventory is still relevant.

| Category                   | Items Found                                                                                                                                                           | Action Required                                                                 |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| Stored data                | `public.users.referral_code` will be populated for every existing student / student_diy row at migration time. `public.users.referral_short_url` stays NULL until Phase 59 runs per user. | Data migration via `UPDATE` inside the same .sql file as the schema change.      |
| Live service config        | None — Rebrandly has no pre-existing config to update in this phase. Short URLs don't exist yet; they're created on first API call in Phase 59.                       | None.                                                                            |
| OS-registered state        | None — no Task Scheduler / pm2 / systemd involvement.                                                                                                                 | None.                                                                            |
| Secrets / env vars         | `REBRANDLY_API_KEY` added to `.env.local.example` as empty placeholder. The real value in `.env.local` is a dev-onboarding action, not a Phase 58 task (the planner must NOT create / commit / paste the real key). No existing code reads this env var yet — Phase 59 will. | Update `.env.local.example` only. Real key is a manual onboarding step outside version control. |
| Build artifacts / installed packages | `src/lib/types.ts` is a generated-or-hand-maintained artifact that must be updated so downstream phases compile. No package reinstalls; `node_modules` unaffected. | Edit `src/lib/types.ts` in the same commit as the migration.                     |

**The canonical question — after every file is updated, what runtime state still has stale shape?** Only `public.users` rows in the live database — and the migration's embedded ASSERT block verifies the backfill completed.

## Common Pitfalls

### Pitfall 1: The `md5()` expression returns lowercase; forgetting `upper()` breaks success criterion #2

**What goes wrong:** Writing `substr(md5(id::text), 1, 8)` without `upper()` produces lower-case hex. The success criterion explicitly specifies `upper(substr(md5(id::text), 1, 8))` — any UAT check that re-computes the expected code will diff.

**Why it happens:** Postgres `md5()` returns lowercase hex per convention. It's easy to forget the `upper()` wrapper.

**How to avoid:** Keep the exact expression from REQUIREMENTS DB-02 verbatim: `upper(substr(md5(id::text), 1, 8))`. Embed it as an ASSERT check: `ASSERT (SELECT COUNT(*) FROM users WHERE role IN ('student','student_diy') AND (referral_code IS NULL OR referral_code <> upper(substr(md5(id::text), 1, 8)))) = 0, 'backfill shape mismatch'`.

**Warning signs:** UAT reports `abc12345` but the row shows `ABC12345` (or vice versa).

### Pitfall 2: `varchar(12)` vs `varchar(8)` — why the extra width?

**What goes wrong:** Someone "tightens" the column to `varchar(8)` thinking md5-substr is always 8 chars. This breaks Phase 59 API-03, which generates `upper(uuid.slice(0, 8))` — still 8 chars today, but any future widening (e.g. a 10-char branded code) requires a new migration.

**Why it happens:** The column width isn't explained in the success criterion; readers assume it's a typo.

**How to avoid:** Keep `varchar(12)` verbatim per DB-01. It's intentional slack. Add a `COMMENT ON COLUMN public.users.referral_code IS 'Per-user referral short code. 8 chars hex today (upper(md5-substr)); varchar(12) leaves room for future longer codes.'` so the intent is documented in-db.

**Warning signs:** A reviewer asks why the column is wider than the data.

### Pitfall 3: Partial UNIQUE index vs plain `UNIQUE` — behavior on many NULLs

**What goes wrong:** A reviewer sees `CREATE UNIQUE INDEX … WHERE referral_code IS NOT NULL` and asks "can't we just do `ADD UNIQUE (referral_code)`?" They're mostly right — Postgres treats NULLs as distinct by default (pre-15 behavior; even in 15+, `UNIQUE NULLS DISTINCT` is the default). But the explicit partial index is what the success criterion names and what makes the intent obvious at grep time.

**Why it happens:** Postgres NULL-handling in unique constraints is a well-known footgun.

**How to avoid:** Use the partial index exactly as written in DB-03. Don't "simplify" it to a bare `UNIQUE`.

**Warning signs:** A review PR suggests dropping the `WHERE` clause.

### Pitfall 4: Running the backfill without `AND referral_code IS NULL` makes the migration non-idempotent

**What goes wrong:** Running the migration a second time (dev database reset, re-apply after a rollback) overwrites any referral_code that was hand-assigned between runs.

**Why it happens:** The deterministic `md5(id::text)` expression is idempotent per-row, so it technically doesn't matter — but if Phase 59's API-03 path assigns a code to a user whose row was previously skipped (role change from owner → student after go-live, say), re-running the Phase 58 migration would overwrite THAT code with an md5-derived one.

**How to avoid:** Include `AND referral_code IS NULL` in the backfill `WHERE` clause. This is cheap defense-in-depth and costs nothing.

**Warning signs:** A user complains their short URL stopped working after a dev reset in the shared staging DB.

### Pitfall 5: Forgetting to update `src/lib/types.ts` in the same commit as the migration

**What goes wrong:** The migration lands in `supabase/migrations/` but the types file still reflects the pre-migration schema. Every downstream piece of code that reads `user.referral_code` sees `user: { referral_code?: undefined }` or — worse, in non-strict code paths — compiles with `any`.

**Why it happens:** Types file edits are a separate mental step; easy to defer.

**How to avoid:** The planner's task list for Phase 58 MUST include "edit `src/lib/types.ts`" as a sibling to the migration file edit, in the same commit. The build gate (CFG-02) will catch it — but catching earlier is better.

**Warning signs:** `tsc --noEmit` passes (because Phase 58 doesn't reference the new columns) but Phase 59's PR fails to compile.

### Pitfall 6: `.env.local.example` appears committed but was accidentally gitignored

**What goes wrong:** Someone generalizes `.gitignore` rules to `.env*` and catches `.env.local.example` in the dragnet. Fresh clones don't see the template.

**Why it happens:** Gitignore patterns are easy to misread.

**How to avoid:** Current `.gitignore` blocks `.env*.local` and four more specific names — `.env.local.example` is safe. Verify after commit: `git status` should show NOT-ignored, `git ls-files .env.local.example` should list it.

**Warning signs:** The file edit appears to succeed but `git add .env.local.example` reports "ignored by .gitignore".

### Pitfall 7: Regenerating `types.ts` via CLI clobbers existing HAND-EDIT comments

**What goes wrong:** Running `npx supabase gen types typescript --local > src/lib/types.ts` overwrites the file wholesale, destroying the HAND-EDIT markers that narrow types like `role: "owner" | "coach" | "student" | "student_diy"` (line 778) and `status: "locked" | "active" | "completed"` (line 641).

**Why it happens:** Codegen doesn't know about DB CHECK constraints — it outputs `string`. Repo has historically hand-narrowed these post-regen, evidenced by the inline `// HAND-EDIT: narrow from DB CHECK constraint — reapply after regen.` comments.

**How to avoid:** Either (a) re-apply the HAND-EDIT narrowings after running the CLI, OR (b) edit `types.ts` by hand for this small 2-column addition — the existing file already marks the HAND-EDIT sites, follow the same style.

**Warning signs:** Post-regen `git diff` shows `role: string` regressing from the narrowed union; `tsc --noEmit` flags new errors at role comparison sites.

## Code Examples

### Example 1: Full migration file skeleton

```sql
-- Source: Pattern distilled from 00022_deals_logged_by.sql + 00029/00030 transaction envelope
-- File: supabase/migrations/00031_referral_links.sql

-- =============================================================================
-- Phase 58: Schema & Backfill — Rebrandly referral columns on public.users
-- Migration: 00031_referral_links.sql
--
-- Closes DB-01, DB-02, DB-03.
--
-- Adds two nullable columns to public.users, backfills referral_code for every
-- existing student / student_diy row using upper(substr(md5(id::text), 1, 8)),
-- and enforces uniqueness via a partial UNIQUE index.
--
-- Idempotent: re-running on the same DB is a no-op (IF NOT EXISTS on columns
-- and index; backfill guarded by referral_code IS NULL).
--
-- Transactional: single BEGIN;...COMMIT;. Any ASSERT failure rolls back.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Section 1: Add columns (both nullable — owners/coaches stay NULL forever;
-- students/student_diy get referral_code filled by backfill below;
-- referral_short_url stays NULL until Phase 59 populates it per user).
-- -----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code      varchar(12),
  ADD COLUMN IF NOT EXISTS referral_short_url text;

-- Optional documentation — visible in psql \d+ public.users
COMMENT ON COLUMN public.users.referral_code IS
  'Phase 58: per-user referral short code. 8 hex chars (UPPER) today, derived from upper(substr(md5(id::text), 1, 8)) for pre-existing students; Phase 59 generates codes for any subsequent role additions. varchar(12) leaves 4 chars of headroom.';
COMMENT ON COLUMN public.users.referral_short_url IS
  'Phase 58/59: cached Rebrandly short URL. NULL = not yet generated. Persisted on first successful /api/referral-link call for life.';

-- -----------------------------------------------------------------------------
-- Section 2: Backfill existing student + student_diy rows.
-- Deterministic expression per DB-02. Idempotency guard via referral_code IS NULL.
-- -----------------------------------------------------------------------------

UPDATE public.users
   SET referral_code = upper(substr(md5(id::text), 1, 8))
 WHERE role IN ('student', 'student_diy')
   AND referral_code IS NULL;

-- -----------------------------------------------------------------------------
-- Section 3: Partial UNIQUE index — collisions surface at write time (DB-03).
-- Pattern: precedent at 00015:62 (idx_messages_recipient_read WHERE read_at IS NULL).
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Section 4: Embedded ASSERT block — verifies every DB success criterion.
-- Failure raises an exception → Postgres rolls back → zero db state change.
-- -----------------------------------------------------------------------------

DO $phase58_assert$
DECLARE
  v_code_nullable        boolean;
  v_url_nullable         boolean;
  v_code_max_len         integer;
  v_unbackfilled         integer;
  v_owner_coach_polluted integer;
  v_backfill_mismatch    integer;
  v_unique_index_exists  integer;
BEGIN
  -- ASSERT 1a: referral_code exists and is nullable.
  SELECT is_nullable = 'YES',
         character_maximum_length
    INTO v_code_nullable, v_code_max_len
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='users' AND column_name='referral_code';
  ASSERT v_code_nullable = true,
    'referral_code must be nullable';
  ASSERT v_code_max_len = 12,
    format('referral_code must be varchar(12), got varchar(%s)', v_code_max_len);

  -- ASSERT 1b: referral_short_url exists and is nullable.
  SELECT is_nullable = 'YES' INTO v_url_nullable
    FROM information_schema.columns
   WHERE table_schema='public' AND table_name='users' AND column_name='referral_short_url';
  ASSERT v_url_nullable = true,
    'referral_short_url must be nullable';

  -- ASSERT 2a: every pre-existing student / student_diy row has non-null code.
  SELECT count(*) INTO v_unbackfilled
    FROM public.users
   WHERE role IN ('student', 'student_diy')
     AND referral_code IS NULL;
  ASSERT v_unbackfilled = 0,
    format('Phase 58 ASSERT 2a: %s student/student_diy rows missing referral_code post-backfill', v_unbackfilled);

  -- ASSERT 2b: no owner / coach row was given a code.
  SELECT count(*) INTO v_owner_coach_polluted
    FROM public.users
   WHERE role IN ('owner', 'coach')
     AND referral_code IS NOT NULL;
  ASSERT v_owner_coach_polluted = 0,
    format('Phase 58 ASSERT 2b: %s owner/coach rows incorrectly have referral_code set', v_owner_coach_polluted);

  -- ASSERT 2c: every backfilled code matches the deterministic expression.
  SELECT count(*) INTO v_backfill_mismatch
    FROM public.users
   WHERE role IN ('student', 'student_diy')
     AND referral_code IS NOT NULL
     AND referral_code <> upper(substr(md5(id::text), 1, 8));
  ASSERT v_backfill_mismatch = 0,
    format('Phase 58 ASSERT 2c: %s rows have referral_code that does not match upper(substr(md5(id::text), 1, 8))', v_backfill_mismatch);

  -- ASSERT 3: the partial UNIQUE index exists.
  SELECT count(*) INTO v_unique_index_exists
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename  = 'users'
     AND indexname  = 'idx_users_referral_code';
  ASSERT v_unique_index_exists = 1,
    'Phase 58 ASSERT 3: partial UNIQUE index idx_users_referral_code is missing';
END $phase58_assert$;

COMMIT;
```

### Example 2: `types.ts` hand-edit (insertion into existing `users` block)

```typescript
// Source: src/lib/types.ts lines 766–822 (add referral_code / referral_short_url)
// Paste into the existing `users:` block — do NOT regenerate the whole file.

users: {
  Row: {
    // … existing fields …
    niche: string | null
    referral_code: string | null          // NEW — Phase 58
    referral_short_url: string | null     // NEW — Phase 58
    role: "owner" | "coach" | "student" | "student_diy"
    // … existing fields …
  }
  Insert: {
    // … existing fields …
    niche?: string | null
    referral_code?: string | null         // NEW — Phase 58
    referral_short_url?: string | null    // NEW — Phase 58
    role: "owner" | "coach" | "student" | "student_diy"
    // … existing fields …
  }
  Update: {
    // … existing fields …
    niche?: string | null
    referral_code?: string | null         // NEW — Phase 58
    referral_short_url?: string | null    // NEW — Phase 58
    role?: "owner" | "coach" | "student" | "student_diy"
    // … existing fields …
  }
  // … Relationships stay untouched …
}
```

### Example 3: `.env.local.example` append block

```bash
# Source: .env.local.example current content + append pattern

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Discord WidgetBot (Resources > Community tab)
NEXT_PUBLIC_DISCORD_GUILD_ID=
NEXT_PUBLIC_DISCORD_CHANNEL_ID=

# Rebrandly (student referral short-link generation — v1.7)
# Required by /api/referral-link (Phase 59). Get a key at https://app.rebrandly.com/account/api
# When unset, the referral endpoint returns HTTP 500 with a clear console.error; the dashboard continues to load.
REBRANDLY_API_KEY=
```

### Example 4: Applying the migration locally

```bash
# Source: Supabase CLI conventions (devDependency in package.json)

# From repo root
npx supabase db reset       # or: npx supabase migration up
# Inspect:
npx supabase db diff        # should show no drift after migration applies
```

### Example 5: Verifying the build gate (CFG-02)

```bash
# Source: CLAUDE.md "Commands" section + REQUIREMENTS CFG-02

npm run lint && npx tsc --noEmit && npm run build
```

Expected exit code: 0. Any new warning or error blocks the phase close.

## State of the Art

| Old Approach                                    | Current Approach                                                                          | When Changed    | Impact                                                                                                                                             |
|-------------------------------------------------|------------------------------------------------------------------------------------------|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| Non-transactional migrations                    | `BEGIN;...COMMIT;` envelope for every migration                                          | ~00027 onwards  | Atomic rollback on ASSERT failure. Phase 58 follows this.                                                                                          |
| Post-migration verification in separate SQL file| Embedded `DO $$ ... ASSERT ... $$` block in the same migration                            | 00022 onwards   | Single-file migration self-verifies its success criteria; no separate review step.                                                                 |
| UNIQUE constraint on optional column            | Partial UNIQUE INDEX `WHERE col IS NOT NULL`                                             | 00015 onwards   | Explicit intent; tiny perf gain; lines up with Postgres best practice.                                                                             |
| `types.ts` regenerated wholesale                | Hand-edit narrow additions when change surface is small; regen for large schema deltas   | Codebase norm   | `types.ts` has explicit HAND-EDIT markers — both paths are acceptable, choose based on change size.                                                |
| `process.env.X \|\| throw`                      | `process.env.X!` non-null assertion (throws at first access)                             | From v1.0       | Existing pattern in `src/lib/supabase/admin.ts`. CFG-01 references this as "the existing missing-env error path".                                  |

**Deprecated/outdated:**

- None relevant to this phase.

## Assumptions Log

| #  | Claim                                                                                                                                                                                                                                                               | Section                         | Risk if Wrong                                                                                                                                                                                                                    |
|----|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A1 | `[ASSUMED]` The user wants the backfill `UPDATE` to include `AND referral_code IS NULL` for idempotency. The success criterion doesn't explicitly require this, but it's a defensive default that costs nothing. | Pattern 3 / Example 1            | LOW — if rejected, drop the clause; the deterministic expression makes re-runs a no-op anyway, so removing the guard is still correct for a fresh DB.                                                                            |
| A2 | `[ASSUMED]` The user is content with hand-editing `src/lib/types.ts` rather than running the full Supabase codegen. Both are accepted in the repo per existing HAND-EDIT markers, but there's no formal policy. | Don't Hand-Roll / Example 2      | LOW — if the user prefers CLI regen, the planner re-applies the HAND-EDIT narrowings (role, status enums) after regen. Either path satisfies the build gate.                                                                     |
| A3 | `[ASSUMED]` `COMMENT ON COLUMN` annotations are desired for in-db documentation. The repo doesn't currently use them systematically (zero matches in migrations) but they're harmless and useful. | Example 1                        | LOW — if rejected, remove the two `COMMENT ON COLUMN` statements; they don't affect behavior or the success criteria.                                                                                                             |
| A4 | `[ASSUMED]` The migration should use `IF NOT EXISTS` guards on `ADD COLUMN` and `CREATE UNIQUE INDEX` for rerun-safety. Matches the idiom in 00022. | Example 1                        | LOW — if the user prefers strict one-shot migrations, drop `IF NOT EXISTS`; any re-run will fail loudly, which some teams prefer.                                                                                                |
| A5 | `[ASSUMED]` The `.env.local.example` append should include a commented description block (one line labeling the integration, one line explaining the error path). The current file has a similar commented label for Discord; consistent with file style. | CFG-01 / Example 3               | LOW — if the user wants a minimal append (just `REBRANDLY_API_KEY=` and no comment), it's a one-line edit difference.                                                                                                              |
| A6 | `[ASSUMED]` No data migration is needed for hypothetical role-change cases (e.g. a user who was `owner` at migration time and later becomes `student`). Phase 59 API-03 handles that path by generating a fresh code at request time. | Pitfall 4                        | LOW — REQUIREMENTS API-03 explicitly covers this scenario for Phase 59.                                                                                                                                                          |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Assumptions A1–A6 are stylistic / safety-margin choices; all are low-risk and reversible. None of them change the success-criteria shape.

## Open Questions (RESOLVED)

1. **Should the `COMMENT ON COLUMN` annotations be included?** — RESOLVED: Include them (cost-free, standard Postgres documentation; user may strip during review without impact).
   - What we know: No existing migration in the repo uses `COMMENT ON COLUMN` (grep for `COMMENT ON (COLUMN|INDEX)` returned zero matches).
   - Recommendation: Include them — they cost nothing, help future grepping, and are standard Postgres documentation.

2. **Hand-edit `types.ts` vs. re-run Supabase gen?** — RESOLVED: Hand-edit (6-line delta; preserves existing HAND-EDIT narrowings for `role` and `status` that a CLI regen would clobber).
   - What we know: HAND-EDIT markers exist at `types.ts:640` (status) and `types.ts:777` (role). Supabase CLI is already a devDependency.
   - Recommendation: Hand-edit. The delta is 2 column names × 3 blocks (Row/Insert/Update) = 6 lines.

3. **Should the migration pre-lock `public.users` to prevent concurrent writes during backfill?** — RESOLVED: No lock (row-level locks from the UPDATE suffice; Phase 59 API-03 handles any NULL code created by a concurrent INSERT).
   - What we know: The `UPDATE … WHERE role IN ('student','student_diy') AND referral_code IS NULL` acquires row-level locks on each target row. A concurrent INSERT with NULL code is tolerated because Phase 59 API-03 fills NULLs on demand.
   - Recommendation: Don't lock. Backfill is fast, no contention gain; a table lock would only serialize writes for no correctness benefit.

## Environment Availability

> Phase 58 is code + migration only — no new runtime deps. Still, because the migration runs against Postgres and must compile TypeScript, the relevant tools are checked below.

| Dependency                  | Required By                          | Available | Version      | Fallback                                                                 |
|-----------------------------|--------------------------------------|-----------|--------------|--------------------------------------------------------------------------|
| Node.js                     | `npm run lint/build`                 | Assumed ✓ | ≥18 per Next 16 | —                                                                        |
| npm                         | lint/build/tsc                       | Assumed ✓ | —            | —                                                                        |
| Supabase CLI (`supabase`)   | `supabase db reset` / `migration up` | ✓         | ^2.78.1 (devDep) | If missing, `npx supabase` auto-installs.                                |
| PostgreSQL (local via Supabase) | migration execution             | Assumed ✓ | 14+ (Supabase default) | Remote Supabase project works identically.                               |
| TypeScript                  | `tsc --noEmit`                       | ✓         | ^5 (devDep)  | —                                                                        |
| Next.js                     | `npm run build`                      | ✓         | 16.1.6       | —                                                                        |
| ESLint                      | `npm run lint`                       | ✓         | ^9           | —                                                                        |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — everything is in `package.json`'s `devDependencies`.

## Validation Architecture

> `.planning/config.json` was not read in this research; treating `nyquist_validation` as enabled by default per protocol.

### Test Framework

| Property             | Value                                                                                                                                                                                                                |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Framework            | None installed — `package.json` has no jest/vitest/playwright entries. Migration validation happens inside the `DO $$ ... ASSERT ... $$` block at migration time; TypeScript validation via `tsc --noEmit`; build validation via `next build`. |
| Config file          | —                                                                                                                                                                                                                    |
| Quick run command    | `npx tsc --noEmit` (≈15s)                                                                                                                                                                                            |
| Full suite command   | `npm run lint && npx tsc --noEmit && npm run build` (the CFG-02 gate)                                                                                                                                                |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                                                  | Test Type            | Automated Command                                                                                       | File Exists? |
|---------|------------------------------------------------------------------------------------------------------------------------------------------|----------------------|---------------------------------------------------------------------------------------------------------|-------------|
| DB-01   | Two nullable columns present, correct types                                                                                               | migration-ASSERT     | `npx supabase db reset` (ASSERTS 1a/1b run)                                                             | ✅ (migration file)       |
| DB-02   | All student/student_diy rows backfilled with correct deterministic code; no owner/coach pollution                                         | migration-ASSERT     | `npx supabase db reset` (ASSERTS 2a/2b/2c run)                                                          | ✅ (migration file)       |
| DB-03   | Partial UNIQUE index exists; duplicate insert raises 23505                                                                                | migration-ASSERT + manual | ASSERT 3 runs at migration time. Manual verify: `INSERT INTO users (…, referral_code) VALUES (…, existing_code)` must raise error. | ✅ (migration file) + manual |
| CFG-01  | `.env.local.example` contains `REBRANDLY_API_KEY=` line                                                                                  | smoke grep           | `grep -q '^REBRANDLY_API_KEY=' .env.local.example && echo OK`                                           | ❌ (new grep, trivial)      |
| CFG-02  | Build pipeline exits 0                                                                                                                    | integration-build    | `npm run lint && npx tsc --noEmit && npm run build`                                                     | ✅ (commands exist)       |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run lint && npx tsc --noEmit && npm run build`
- **Phase gate:** Apply migration locally (`npx supabase db reset`) → verify no ASSERT fired → run full gate → `/gsd-verify-work`

### Wave 0 Gaps

- [ ] No automated test framework installed repo-wide. Given the phase has **zero runtime code** (pure SQL + types + env-example), the migration's embedded ASSERT block + TypeScript compile + `next build` are the validation surface. No Wave 0 framework install is justified for this phase — historically consistent with the 14 prior DB-migration phases (00015–00030) which relied on the same strategy.
- [ ] A tiny shell-level smoke check for CFG-01 would be nice-to-have (`grep -q '^REBRANDLY_API_KEY=' .env.local.example`), but this can be a plan-local command rather than a test file.

## Security Domain

> `security_enforcement` treated as enabled (absent = enabled).

### Applicable ASVS Categories

| ASVS Category                     | Applies | Standard Control                                                                                                                               |
|-----------------------------------|---------|------------------------------------------------------------------------------------------------------------------------------------------------|
| V2 Authentication                 | no      | No auth surface changes in Phase 58.                                                                                                          |
| V3 Session Management             | no      | No session surface changes in Phase 58.                                                                                                       |
| V4 Access Control (RLS)           | partial | `public.users` RLS policies untouched; new columns inherit existing SELECT/UPDATE policies. Admin-client reads/writes bypass RLS by design (Hard Rule 4). No new policies required. |
| V5 Input Validation               | no      | No external input accepted in this phase — the backfill expression is server-computed from trusted `id` values already stored.                |
| V6 Cryptography                   | partial | `md5()` is used as a deterministic code-derivation function, NOT as a security primitive. It is not protecting secrets, authenticating callers, or hashing passwords — it's a 32-bit address-space reducer for marketing codes. Collision risk is accepted and handled by the UNIQUE index at write time. |
| V7 Error Handling & Logging       | partial | `process.env.REBRANDLY_API_KEY!` non-null-assertion will throw at runtime if unset (Phase 59 concern). Phase 58 only ensures `.env.local.example` documents the var so dev onboarding fails loudly rather than silently. |
| V8 Data Protection                | yes     | `referral_code` and `referral_short_url` are public-ish marketing identifiers (they'll be shared by students as URLs). No PII. No special storage hardening needed beyond existing `public.users` RLS. |
| V10 Communications                | no      | No network calls made in Phase 58 (Phase 59 handles Rebrandly HTTPS).                                                                          |

### Known Threat Patterns for Supabase Postgres additive migration

| Pattern                                             | STRIDE       | Standard Mitigation                                                                                                                                     |
|----------------------------------------------------|--------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| Partial migration failure leaves inconsistent DB    | Availability | `BEGIN;...COMMIT;` + embedded ASSERTs — any failure rolls back the entire change.                                                                       |
| Referral code enumeration (guess another user's)    | Info-disclosure | `md5(id::text)` truncated to 8 hex chars gives a 4.3-billion-slot space; non-sequential, not derivable from email/name. For marketing-link MVP, acceptable. Future hardening (custom domain + signed params) is explicitly out of scope per STATE.md. |
| Collision race during concurrent student insert     | Tampering    | Partial UNIQUE INDEX raises `23505` at write time; Phase 59 API-03 can catch and regenerate (out-of-scope for Phase 58 but pattern is in place).        |
| Committing real REBRANDLY_API_KEY to git            | Info-disclosure | `.env.local.example` value is empty (`REBRANDLY_API_KEY=`); real key lives in `.env.local` (gitignored) or hosting env vars. Grep the commit diff before pushing to confirm no 20+ char alphanumeric string leaked into the example. |
| Type drift between migration and `src/lib/types.ts` | Tampering (type-level) | Update `types.ts` in the same commit as the migration. CFG-02 build gate catches any downstream referrer that tripped on a missing field. |

## Sources

### Primary (HIGH confidence)

- **Repo file: `supabase/migrations/00022_deals_logged_by.sql`** — canonical additive-column-with-backfill-and-assertions template; used as the direct structural template for 00031.
- **Repo file: `supabase/migrations/00029_chat_removal_announcements.sql`** — BEGIN/COMMIT envelope pattern; table creation + RLS pattern (reference only, not needed in Phase 58).
- **Repo file: `supabase/migrations/00030_roadmap_step_8_insertion.sql`** — most recent migration; confirms BEGIN/COMMIT + DO $$ ... ASSERT $$ pattern is still current.
- **Repo file: `supabase/migrations/00015_v1_4_schema.sql`** — `idx_messages_recipient_read ... WHERE read_at IS NULL` — direct precedent for partial unique/index pattern; confirms role CHECK constraint swap technique (not needed here).
- **Repo file: `src/lib/types.ts`** — hand-editable Database type with explicit HAND-EDIT markers at lines 640 and 777; confirms both CLI-regen and hand-edit are accepted.
- **Repo file: `src/lib/supabase/admin.ts`** — `process.env.X!` non-null-assertion pattern, referenced by CFG-01 as "the existing missing-env error path".
- **Repo file: `package.json`** — stack versions verified: Next 16.1.6, React 19.2.3, TypeScript ^5, Zod ^4.3.6, Supabase CLI ^2.78.1.
- **Repo file: `.env.local.example`** — confirms current 6-line file structure + comment-header style for the Discord group.
- **Repo file: `.gitignore`** — confirms `.env*.local` is ignored but `.env.local.example` is tracked.
- **Repo file: `CLAUDE.md`** — Hard Rules 4 (admin client in API routes), 7 (Zod import), and conventions section.
- **Repo file: `.planning/REQUIREMENTS.md`** — v1.7 milestone requirements DB-01/02/03 and CFG-01/02 verbatim.
- **Repo file: `.planning/STATE.md`** — Critical Constraints Carried Into v1.7, next migration numbered 00031, v1.7 invariants.
- **Repo file: `.planning/ROADMAP.md`** — Phase 58 goal and full success-criteria text.

### Secondary (MEDIUM confidence)

- **Postgres docs — partial indexes & NULL uniqueness semantics** `[CITED: postgresql.org/docs indexes-partial.html & indexes-unique.html — general knowledge, not re-verified this session]`.
- **Supabase CLI — `supabase gen types typescript`** `[CITED: supabase.com/docs/reference/cli/supabase-gen-types — general knowledge, not re-verified this session]`.

### Tertiary (LOW confidence)

- None — every non-trivial claim in this document is either repo-verified or from well-established Postgres/Supabase fundamentals.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every dependency already in `package.json` and verified.
- Architecture: **HIGH** — direct precedent in 00022 for the exact migration shape (additive + backfill + ASSERT).
- Pitfalls: **HIGH** — most derived from actual in-repo HAND-EDIT markers, `.gitignore` patterns, and CLAUDE.md hard rules.

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — stack is stable; only risk is a Supabase CLI major bump breaking codegen, low probability in 30 days)
