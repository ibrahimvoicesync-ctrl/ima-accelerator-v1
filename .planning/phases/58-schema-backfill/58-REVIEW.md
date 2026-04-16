---
phase: 58-schema-backfill
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - supabase/migrations/00031_referral_links.sql
  - src/lib/types.ts
  - .env.local.example
  - eslint.config.mjs
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 58: Code Review Report

**Reviewed:** 2026-04-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** clean

## Summary

All four Phase 58 files (schema migration, hand-edited Database types, env example, ESLint config) meet quality standards. No critical or warning issues found. The migration is transactional, idempotent, and self-verifying via an embedded `DO` block with six ASSERTs covering nullability, varchar length, backfill completeness, role-scope, deterministic-expression match, and unique-index existence. The TypeScript additions to `users` are consistent across Row/Insert/Update. The `.env.local.example` entry for `REBRANDLY_API_KEY` is empty (correct) and documents fallback behavior. The ESLint ignore entry for `scripts/**/*.cjs` is correctly scoped.

Two Info-level observations are recorded below for awareness — neither blocks Phase 59 or Phase 60.

## Info

### IN-01: md5 8-hex collision handling is deferred to index creation

**File:** `supabase/migrations/00031_referral_links.sql:40-52`
**Issue:** The backfill computes `upper(substr(md5(id::text), 1, 8))` for every student/student_diy row before `CREATE UNIQUE INDEX IF NOT EXISTS` runs. md5 over a uuid is effectively uniform, so the 8-hex-char space (16^8 ~ 4.3B) is far larger than any realistic user base, but the migration does not pre-scan for collisions. If a collision ever occurred, the `UPDATE` would succeed and the subsequent `CREATE UNIQUE INDEX` would fail — correctly rolling back the whole transaction because of the outer `BEGIN;...COMMIT;`. The behavior is safe; the observation is that a failing index creation would surface as an opaque `could not create unique index "idx_users_referral_code"` error with no hint that the cause is a deterministic-backfill collision.
**Fix:** Non-blocking. If desired for operator ergonomics, add a pre-index ASSERT:
```sql
-- Optional: surface collisions with a friendly message before CREATE INDEX.
DECLARE v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes
    FROM (SELECT referral_code FROM public.users
           WHERE referral_code IS NOT NULL
           GROUP BY referral_code HAVING count(*) > 1) d;
  ASSERT v_dupes = 0,
    format('Phase 58: %s md5-truncation collisions detected in backfill; widen substring or pick a different hash.', v_dupes);
END;
```
Not required — the txn rolls back cleanly either way, and collision probability with current user volume is negligible.

### IN-02: Future-role-addition promise in COMMENT is not self-enforcing

**File:** `supabase/migrations/00031_referral_links.sql:30-33`
**Issue:** The column COMMENT says "Phase 59 generates codes for any subsequent role additions." Phase 58 itself does not install a trigger that auto-fills `referral_code` on INSERT/UPDATE of a newly-promoted student. The contract therefore lives entirely in Phase 59's API code and invite-acceptance flow, not in the schema. If Phase 59 forgets to fill this on a new student created outside `/api/referral-link`, the partial UNIQUE index permits NULL so the DB will not complain — but the student will be missing a code until the next Phase 59 call.
**Fix:** No change for Phase 58 (out of scope per migration header). Phase 59 acceptance criteria should include: "creating a new student/student_diy row (via invite redemption or role change) either eagerly writes a `referral_code` or is covered by a lazy-fill path on first dashboard render." Recommend adding a verification line to `58-VERIFICATION.md` noting this downstream dependency so it is not lost.

---

_Reviewed: 2026-04-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
