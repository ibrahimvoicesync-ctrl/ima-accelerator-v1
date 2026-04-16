---
phase: 58-schema-backfill
verified: 2026-04-16T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: none
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 58: Schema & Backfill — Verification Report

**Phase Goal:** The `public.users` table can store a per-user Rebrandly referral code and short URL, with every existing student and student_diy row pre-seeded with a deterministic code, and dev onboarding knows the new env var is required.

**Verified:** 2026-04-16T00:00:00Z
**Status:** passed
**Re-verification:** No — initial verification.

## Goal Achievement

Phase 58 is file-authoring + DB-apply + build-gate. The goal decomposes into five ROADMAP Success Criteria (SC1–SC5), all of which map 1:1 to PLAN must-have truths. Every truth is backed by either (a) static grep against the shipped files in the repo, (b) verbatim Q1/Q2/Q3 query evidence captured in `58-02-SUMMARY.md` from a live admin-client run against the linked remote Supabase project (`uzfzoxfakxmsbttelhnr`), or (c) transitive proof via the migration's embedded 7-ASSERT block (any failure would have rolled back `BEGIN;...COMMIT;` and made `supabase db push` exit non-zero — it exited 0).

### Observable Truths

| # | Truth (from ROADMAP SC) | Status | Evidence |
|---|------------------------|--------|----------|
| 1 | Migration `supabase/migrations/00031_referral_links.sql` applies cleanly on top of `00030`, leaving `public.users` with two new nullable columns: `referral_code` (`varchar(12)`) and `referral_short_url` (`text`). | VERIFIED | File exists (122 lines), exactly one `^BEGIN;` and one `^COMMIT;`, contains `ADD COLUMN IF NOT EXISTS referral_code      varchar(12)` and `ADD COLUMN IF NOT EXISTS referral_short_url text`. `supabase db push` exit 0, `supabase migration list` shows `00031 \| 00031` (Local \| Remote). Q1 post-push admin-client query: `Columns returned: [ 'id', 'role', 'referral_code', 'referral_short_url' ]` — columns physically present in live schema. ASSERT 1a (nullable + char_max_length=12) and ASSERT 1b (url nullable) inside `$phase58_assert$` block passed at apply time. |
| 2 | After migration, every pre-existing row with `role IN ('student','student_diy')` has a non-null `referral_code` matching `upper(substr(md5(id::text), 1, 8))`; every owner and coach row still has `referral_code IS NULL`. | VERIFIED | Migration line 40–43: `UPDATE public.users SET referral_code = upper(substr(md5(id::text), 1, 8)) WHERE role IN ('student', 'student_diy') AND referral_code IS NULL;` (exact-string match; string appears twice — once in backfill, once in ASSERT 2c). Q2 runtime evidence from 58-02-SUMMARY.md: student=5 rows (null_codes=0, with_codes=5), student_diy=2 rows (null_codes=0, with_codes=2), owner=4 rows (null_codes=4, with_codes=0), coach=10 rows (null_codes=10, with_codes=0). ASSERT 2a, 2b, 2c (backfill completeness, no owner/coach pollution, deterministic shape match) passed in-DB. |
| 3 | Attempting to insert a duplicate non-null `referral_code` is rejected by a UNIQUE-where-NOT-NULL index, so collisions surface at write time rather than silently overwriting. | VERIFIED | Migration line 50–52: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code) WHERE referral_code IS NOT NULL;` — exact shape, matches 00015:62 precedent (`idx_messages_recipient_read`). ASSERT 3 in the `$phase58_assert$` block queries `pg_indexes` for `idx_users_referral_code` and fails the transaction if absent — push exit 0 proves the index exists. Q3 indirect check: 7 rows with codes, 7 unique codes, zero collisions. |
| 4 | `.env.local.example` documents `REBRANDLY_API_KEY=` (empty value) under a clearly labelled section so a fresh clone fails loudly with the existing missing-env error path rather than crashing. | VERIFIED | `.env.local.example` contains exactly 1 line matching `^REBRANDLY_API_KEY=$` (empty value) and 0 lines matching `^REBRANDLY_API_KEY=.+$` (no real key). Header comment `# Rebrandly (student referral short-link generation — v1.7)` present at line 9 with 2 follow-up comment lines explaining the onboarding contract and fail-soft behavior. File is git-tracked (`git check-ignore` returns exit 1). `git log -p -- .env.local.example` has 0 lines matching `^+REBRANDLY_API_KEY=.+` — no real key ever committed. |
| 5 | Post-phase build gate passes: `npm run lint && npx tsc --noEmit && npm run build` exits 0 with no new errors or warnings. | VERIFIED | 58-02-SUMMARY.md Evidence section: combined command exit 0, wall time 24.258s. Step breakdown: lint (8.8s, 0 errors, 4 pre-existing warnings), tsc --noEmit (1.8s, 0 errors), build (14.5s, exit 0, "Compiled successfully in 7.5s", 58 routes generated). Re-verified on current HEAD: `npx tsc --noEmit` exits 0 with empty stdout. CFG-02 unblock fix (+2 lines in `eslint.config.mjs` to ignore `scripts/**/*.cjs`, parallel to the existing `load-tests/**` exception) is a precedent-matching Rule 3 auto-fix and preserves the intent of the gate. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00031_referral_links.sql` | Single-BEGIN/COMMIT additive migration, 2 columns, backfill, partial UNIQUE index, ≥6 ASSERTs | VERIFIED | 122 lines, 1 `BEGIN;`, 1 `COMMIT;`, 7 `ASSERT` statements, named dollar-quote `$phase58_assert$`, no `CREATE TABLE`, no `DROP`. Exact expression `upper(substr(md5(id::text), 1, 8))` appears twice (backfill + ASSERT 2c). |
| `src/lib/types.ts` | Row/Insert/Update blocks of users table carry `referral_code` and `referral_short_url` | VERIFIED | Lines 777–778 (Row, non-optional nullable), 795–796 (Insert, optional nullable), 812–813 (Update, optional nullable). `grep -c 'referral_code: string \| null'` = 1; `grep -c 'referral_code?: string \| null'` = 2. HAND-EDIT marker at line 779 preserved; role/status narrowings (3 occurrences) intact. |
| `.env.local.example` | `REBRANDLY_API_KEY=` empty under labelled section | VERIFIED | Line 12: `REBRANDLY_API_KEY=` (empty value). Header at line 9, 2 explanatory comment lines at 10–11. Supabase + Discord blocks preserved. |
| `eslint.config.mjs` | CFG-02 gate unblock (Phase 58 auto-fix) | VERIFIED | Lines 17–18: comment + `"scripts/**/*.cjs",` entry in `globalIgnores`, parallel to `load-tests/**`. Precedent-matching, in-scope Rule 3 fix. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `supabase/migrations/00031_referral_links.sql` | `public.users` table schema | `ALTER TABLE … ADD COLUMN` + `UPDATE` + `CREATE UNIQUE INDEX` | WIRED | Migration applied via `npx supabase db push` (exit 0); `supabase migration list` shows `00031` in both Local and Remote columns; Q1 post-push query returns both new columns on the live `public.users` table. |
| `src/lib/types.ts` | `Database['public']['Tables']['users']` | Hand-edit of Row/Insert/Update blocks (no codegen) | WIRED | `referral_code` and `referral_short_url` present in all three blocks at the correct alphabetic insertion point (after `niche`, before `role`). `tsc --noEmit` exit 0 confirms consumers will type-check correctly when Phase 59 reads these columns. No consumers in Phase 58 itself — first consumer is `/api/referral-link` in Phase 59, correctly deferred. |
| `supabase/migrations/00031_referral_links.sql` | `idx_users_referral_code` partial UNIQUE index | `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE referral_code IS NOT NULL` | WIRED | Partial UNIQUE index defined at lines 50–52 of the migration; ASSERT 3 inside `$phase58_assert$` queries `pg_indexes` and would roll back on absence. Push exit 0 = index exists remotely. |
| `.env.local.example` | Phase 59 `/api/referral-link` onboarding contract | Comment block + empty `REBRANDLY_API_KEY=` | WIRED | Comment documents key requirement and fail-soft behavior. No runtime consumer in Phase 58 (expected — Phase 59 is first consumer). |

### Data-Flow Trace (Level 4)

Phase 58 ships schema + types + env documentation + lint config — none of these are render surfaces that hydrate from a data source. Level 4 is not applicable: there is no component, page, or dashboard in this phase. Phase 59 (the first renderer of `referral_code` / `referral_short_url`) will be the natural place to run Level 4 against the data flow.

_Status: N/A — no dynamic-data renderers in phase scope._

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration file exists and contains transactional envelope | `test -f supabase/migrations/00031_referral_links.sql && grep -c '^BEGIN;' && grep -c '^COMMIT;'` | file present; 1 BEGIN; 1 COMMIT | PASS |
| Migration contains deterministic backfill expression | `grep -cF 'upper(substr(md5(id::text), 1, 8))'` | 2 (backfill + ASSERT 2c) | PASS |
| Migration contains partial UNIQUE index | `grep -c 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code' && grep -c 'WHERE referral_code IS NOT NULL'` | 1 + 1 | PASS |
| types.ts surfaces new columns in all three blocks | `grep -c 'referral_code: string \| null' = 1; grep -c 'referral_code?: string \| null' = 2; same for referral_short_url` | 1/2/1/2 | PASS |
| TypeScript compilation passes | `npx tsc --noEmit` | exit 0, empty stdout | PASS |
| env.example has empty REBRANDLY_API_KEY | `grep -c '^REBRANDLY_API_KEY=$' = 1 && grep -cE '^REBRANDLY_API_KEY=.+$' = 0` | 1 + 0 | PASS |
| No real key in git history | `git log -p -- .env.local.example \| grep -cE '^\+REBRANDLY_API_KEY=.+'` | 0 | PASS |
| .env.local.example is git-tracked | `git check-ignore .env.local.example` | exit 1 (not ignored) | PASS |
| No anti-pattern comments in migration | `grep -iE 'TODO\|FIXME\|XXX\|HACK\|PLACEHOLDER\|placeholder' supabase/migrations/00031_referral_links.sql` | 0 matches | PASS |
| No CREATE TABLE or DROP in migration (pure additive) | `grep -c 'CREATE TABLE' && grep -c '^DROP'` | 0 + 0 | PASS |
| Live DB has migration applied (from SUMMARY evidence) | `supabase migration list` output in 58-02-SUMMARY.md | `00031 \| 00031 \| 00031` | PASS |
| Live DB backfill correctness (from SUMMARY Q2 evidence) | Admin-client query in 58-02-SUMMARY.md | 5 student + 2 student_diy with codes; 4 owner + 10 coach null | PASS |
| Live DB uniqueness (from SUMMARY Q3 evidence) | Admin-client uniqueness check in 58-02-SUMMARY.md | 7 rows with codes, 7 unique | PASS |

All 13 spot-checks PASS. Live-DB checks (rows 11–13) rely on verbatim evidence captured in 58-02-SUMMARY.md; re-running them here would require admin-client + service-role key which is outside verifier scope. The in-DB `$phase58_assert$` block provides transitive proof: any failed invariant would have rolled back the `BEGIN;...COMMIT;` and caused `supabase db push` to exit non-zero — push exited 0, so all 7 ASSERTs passed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DB-01 | 58-01-PLAN, 58-02-PLAN | Migration adds 2 nullable columns to `public.users`; runs cleanly on top of 00030 | SATISFIED | Truth 1 verified; file shipped, migration applied remotely, columns confirmed via Q1 |
| DB-02 | 58-01-PLAN, 58-02-PLAN | Backfill uses `upper(substr(md5(id::text), 1, 8))`; owners/coaches untouched | SATISFIED | Truth 2 verified; Q2 row counts prove backfill scope; ASSERT 2a/2b/2c passed in-DB |
| DB-03 | 58-01-PLAN, 58-02-PLAN | Partial UNIQUE index enforces collision detection | SATISFIED | Truth 3 verified; index defined in migration; ASSERT 3 passed in-DB; Q3 shows 7/7 unique |
| CFG-01 | 58-01-PLAN | `.env.local.example` documents `REBRANDLY_API_KEY=` (empty) | SATISFIED | Truth 4 verified; exact `^REBRANDLY_API_KEY=$` match; no key in git history |
| CFG-02 | 58-02-PLAN | Post-phase build gate exits 0 | SATISFIED | Truth 5 verified; 58-02-SUMMARY evidence section shows combined exit 0 in 24.258s; re-verified `tsc --noEmit` exit 0 on current HEAD |

All 5 requirements SATISFIED. No orphaned requirements — REQUIREMENTS.md mapping for Phase 58 (DB-01/02/03, CFG-01, CFG-02) matches plan claims exactly.

### Anti-Patterns Found

None. Scans performed on all modified files:

| File | Pattern Searched | Result | Severity |
|------|-----------------|--------|----------|
| `supabase/migrations/00031_referral_links.sql` | TODO/FIXME/XXX/HACK/PLACEHOLDER (case-insensitive) | 0 matches | — |
| `supabase/migrations/00031_referral_links.sql` | `CREATE TABLE` (accidental table creation) | 0 matches | — |
| `supabase/migrations/00031_referral_links.sql` | `^DROP` (destructive statements) | 0 matches | — |
| `.env.local.example` | `REBRANDLY_API_KEY=.+` (real-key leak) | 0 matches | — |
| `git log -p -- .env.local.example` | `^+REBRANDLY_API_KEY=.+` (real key ever committed) | 0 matches | — |
| `src/lib/types.ts` | HAND-EDIT marker preservation | 3 markers present (pre-existing) | — |

### Human Verification Required

None. All five success criteria map to code-verifiable artifacts or to in-DB ASSERTs whose pass/fail is transitively proved by the `supabase db push` exit code. Live-DB runtime state (Q1/Q2/Q3) is documented with verbatim query output in `58-02-SUMMARY.md`; the executor captured admin-client results at apply time.

A user with Supabase SQL access may optionally spot-check by running the Q1/Q2/Q3 queries from `58-02-PLAN.md` directly against the linked project, but this is not required to close the phase — the transitive proof via transactional ASSERTs is sufficient code-level evidence.

### Deferred Items

Two downstream observations noted by the code reviewer (58-REVIEW.md, Info-level, non-blocking):

| # | Observation | Addressed In | Evidence |
|---|-------------|-------------|----------|
| 1 | Pre-index collision detection is implicit (relies on `CREATE UNIQUE INDEX` failure rolling back the transaction rather than a friendly ASSERT) | N/A — behavior is correct, reviewer optional fix | 58-REVIEW.md IN-01 marks this as non-blocking. Transactional rollback preserves data integrity; collision probability negligible at current scale (7 users, 16^8 ~ 4.3B-slot space). |
| 2 | New student/student_diy rows created after the migration have `referral_code IS NULL` until Phase 59 fills them | Phase 59 — Referral API + Rebrandly | ROADMAP.md line 504: "Any authenticated student or student_diy user can `POST /api/referral-link` and receive an idempotent JSON `{ shortUrl, referralCode }` — Rebrandly is called at most once per user for life". Phase 59 API-03 handles NULL-code case by generating at request time. |

Deferred items are informational only — no actionable gaps.

### Gaps Summary

None. Phase 58 achieved its stated goal: `public.users` now has two nullable referral columns; every pre-existing student and student_diy row is backfilled with a deterministic code; owners and coaches are untouched; a partial UNIQUE index guards against future collisions; the migration is applied to the linked remote Supabase project; types.ts surfaces the new columns for Phase 59/60 consumers; `.env.local.example` documents the onboarding contract for `REBRANDLY_API_KEY`; and the CFG-02 build gate exits 0. All 5 ROADMAP Success Criteria pass under goal-backward verification with strong code-level evidence.

---

_Verified: 2026-04-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
