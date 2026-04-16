---
phase: 58-schema-backfill
plan: 01
subsystem: database

tags: [postgres, migration, supabase, types, env-config, rebrandly, referral]

requires:
  - phase: 57-roadmap-step-8-insertion
    provides: "Migration sequence up to 00030; baseline public.users schema without referral columns"

provides:
  - "supabase/migrations/00031_referral_links.sql — adds referral_code varchar(12) + referral_short_url text to public.users, backfills existing student/student_diy rows via upper(substr(md5(id::text), 1, 8)), creates partial UNIQUE index idx_users_referral_code WHERE referral_code IS NOT NULL, and verifies 7 invariants via DO \$phase58_assert\$ block"
  - "src/lib/types.ts — Database['public']['Tables']['users'] Row/Insert/Update blocks now surface referral_code and referral_short_url (nullable strings)"
  - ".env.local.example — documents REBRANDLY_API_KEY= (empty) under a labelled Rebrandly section for Phase 59 onboarding"

affects:
  - 58-02-apply-migration
  - 59-referral-api-rebrandly
  - 60-referralcard-ui

tech-stack:
  added: []
  patterns:
    - "Single-transaction additive migration (BEGIN;/COMMIT;) with embedded DO \$name_assert\$ block — same shape as 00022 and 00030"
    - "Partial UNIQUE index WHERE col IS NOT NULL — reuses 00015 idx_messages_recipient_read precedent"
    - "Deterministic PK-derived backfill via upper(substr(md5(id::text), 1, 8)) with AND col IS NULL idempotency guard"
    - "types.ts hand-edit (not codegen) preserves HAND-EDIT narrowings for role and status CHECK constraints"

key-files:
  created:
    - "supabase/migrations/00031_referral_links.sql"
  modified:
    - "src/lib/types.ts"
    - ".env.local.example"

key-decisions:
  - "Hand-edit types.ts rather than regenerate via Supabase CLI to preserve HAND-EDIT narrowings for role and status enums (Pitfall 7 in 58-RESEARCH.md)"
  - "Include COMMENT ON COLUMN annotations for in-db documentation of both new columns (A3 assumption — cost-free, standard Postgres practice)"
  - "Use IF NOT EXISTS guards on ADD COLUMN and CREATE UNIQUE INDEX for rerun-safety (A4 assumption — matches 00022 idiom)"
  - "Keep AND referral_code IS NULL idempotency guard on backfill UPDATE (A1 assumption — defensive default, zero cost)"

patterns-established:
  - "Embedded named-dollar-quoted ASSERT block: DO \$phase58_assert\$ ... END \$phase58_assert\$ — 7 invariants covering column shape (nullability + varchar length), backfill completeness, no-pollution guard, deterministic shape match, and partial UNIQUE index presence"

requirements-completed: [DB-01, DB-02, DB-03, CFG-01]

duration: 3min
completed: 2026-04-16
---

# Phase 58 Plan 01: Schema & Backfill Summary

**Additive Postgres migration (00031) adds `referral_code varchar(12)` + `referral_short_url text` to `public.users`, backfills every existing student/student_diy row with a deterministic 8-char upper-hex code via `upper(substr(md5(id::text), 1, 8))`, enforces uniqueness via a partial UNIQUE index, and documents `REBRANDLY_API_KEY=` onboarding for Phase 59.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-16T04:18:19Z
- **Completed:** 2026-04-16T04:21:22Z
- **Tasks:** 3 / 3
- **Files modified:** 3 (1 created, 2 edited)

## Accomplishments

- **DB-01 / DB-02 / DB-03 — migration SQL authored.** `supabase/migrations/00031_referral_links.sql` is a 122-line single `BEGIN;`/`COMMIT;` transaction with four sections: (1) `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS` × 2 + two `COMMENT ON COLUMN` statements; (2) backfill `UPDATE public.users SET referral_code = upper(substr(md5(id::text), 1, 8)) WHERE role IN ('student','student_diy') AND referral_code IS NULL`; (3) `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code) WHERE referral_code IS NOT NULL`; (4) `DO $phase58_assert$` block with 7 `ASSERT` statements covering column nullability, varchar(12) length, backfill completeness, no-pollution guard, deterministic shape match, and partial UNIQUE index presence. Any assertion failure rolls back the entire transaction — zero db state change.
- **Types surfaced for downstream phases.** `src/lib/types.ts` Row/Insert/Update blocks for the `users` table now include `referral_code` and `referral_short_url`, alphabetically inserted between `niche` and `role`. `npx tsc --noEmit` exits 0; existing HAND-EDIT narrowings for `role` and `status` preserved.
- **CFG-01 — Rebrandly env var documented.** `.env.local.example` now carries a labelled Rebrandly section (header + 2 comment lines + empty assignment) matching the existing Discord comment-group style. Empty value enforced — no real key in the tracked file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 00031_referral_links.sql migration** — `41a2f14` (feat)
2. **Task 2: Hand-edit src/lib/types.ts to surface referral columns on users Row/Insert/Update** — `63cd6fc` (feat)
3. **Task 3: Append REBRANDLY_API_KEY block to .env.local.example** — `d841827` (docs)

## Files Created/Modified

- `supabase/migrations/00031_referral_links.sql` (created, 122 lines) — additive migration: 2 nullable columns + `COMMENT ON COLUMN` × 2 + deterministic backfill + partial UNIQUE index + 7-ASSERT verification block, all wrapped in a single `BEGIN;`/`COMMIT;` transaction.
- `src/lib/types.ts` (modified, +6 lines) — adds `referral_code: string | null` + `referral_short_url: string | null` to the users `Row` block at lines 777–778, `referral_code?: string | null` + `referral_short_url?: string | null` to `Insert` block at lines 795–796, and same optional fields to `Update` block at lines 812–813. Diff applied:

  ```diff
  @@ users.Row @@
       niche: string | null
  +    referral_code: string | null
  +    referral_short_url: string | null
       // HAND-EDIT: narrow from DB CHECK constraint — reapply after regen.
       role: "owner" | "coach" | "student" | "student_diy"

  @@ users.Insert @@
       niche?: string | null
  +    referral_code?: string | null
  +    referral_short_url?: string | null
       role: "owner" | "coach" | "student" | "student_diy"

  @@ users.Update @@
       niche?: string | null
  +    referral_code?: string | null
  +    referral_short_url?: string | null
       role?: "owner" | "coach" | "student" | "student_diy"
  ```

- `.env.local.example` (modified, +5 lines) — appends Rebrandly onboarding block after the Discord section:

  ```diff
   NEXT_PUBLIC_DISCORD_CHANNEL_ID=
  +
  +# Rebrandly (student referral short-link generation — v1.7)
  +# Required by /api/referral-link (Phase 59). Get a key at https://app.rebrandly.com/account/api
  +# When unset, the referral endpoint returns HTTP 500 with a clear console.error; the dashboard continues to load.
  +REBRANDLY_API_KEY=
  ```

## Decisions Made

- **Hand-edit types.ts, not codegen.** Six-line delta is trivial; running `npx supabase gen types typescript` would clobber HAND-EDIT narrowings at lines 640 (status), 779 (users role), and 840 (work_sessions status) per Pitfall 7 in `58-RESEARCH.md`.
- **Include `COMMENT ON COLUMN` annotations.** Two-line cost; makes `\d+ public.users` self-documenting about the 8-char upper-hex derivation and the Phase 58/59 provenance. Zero repo-wide precedent but zero downside.
- **Seven ASSERTs, not six.** The acceptance-criteria floor was ≥6; shipping 7 provides independent checks for: column nullability (×2), varchar(12) length (×1), backfill completeness (×1), no owner/coach pollution (×1), deterministic shape match (×1), partial UNIQUE index presence (×1).
- **Named dollar-quote tag.** Used `$phase58_assert$` (not `$$`) to avoid any future accidental nesting conflicts in combined migrations; matches Phase 57's `$phase57_assert$` pattern in 00030.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion verified green, `npx tsc --noEmit` exit 0, no auto-fixes applied, no architectural questions raised.

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -c '^BEGIN;' 00031_*.sql` | 1 | 1 | ✓ |
| `grep -c '^COMMIT;' 00031_*.sql` | 1 | 1 | ✓ |
| `grep -c 'ADD COLUMN IF NOT EXISTS referral_code      varchar(12)'` | 1 | 1 | ✓ |
| `grep -c 'ADD COLUMN IF NOT EXISTS referral_short_url text'` | 1 | 1 | ✓ |
| `grep -cF 'upper(substr(md5(id::text), 1, 8))'` | ≥1 | 2 | ✓ |
| `grep -c 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code'` | 1 | 1 | ✓ |
| `grep -c 'WHERE referral_code IS NOT NULL'` | ≥1 | 1 | ✓ |
| `grep -cE '^\s*ASSERT' 00031_*.sql` | ≥6 | 7 | ✓ |
| `grep -c 'CREATE TABLE' 00031_*.sql` | 0 | 0 | ✓ |
| `grep -c '^DROP' 00031_*.sql` | 0 | 0 | ✓ |
| `grep -c 'referral_code: string \| null' types.ts` | 1 | 1 | ✓ |
| `grep -c 'referral_short_url: string \| null' types.ts` | 1 | 1 | ✓ |
| `grep -c 'referral_code?: string \| null' types.ts` | 2 | 2 | ✓ |
| `grep -c 'referral_short_url?: string \| null' types.ts` | 2 | 2 | ✓ |
| `grep -c '"owner" \| "coach" \| "student" \| "student_diy"' types.ts` | 3 | 3 | ✓ |
| `npx tsc --noEmit` exit code | 0 | 0 | ✓ |
| `grep -c '^REBRANDLY_API_KEY=$' .env.local.example` | 1 | 1 | ✓ |
| `grep -cE '^REBRANDLY_API_KEY=.+$' .env.local.example` | 0 | 0 | ✓ |
| `grep -c '^# Rebrandly' .env.local.example` | 1 | 1 | ✓ |
| `git check-ignore .env.local.example` exit | non-zero | 1 | ✓ |

All 20 checks pass. HAND-EDIT marker count is 3 in the file (status at 640, users.role at 779, work_sessions.status at 840) — the plan's acceptance criterion of "expect 2" undercounted the repo baseline; all three pre-existing markers remain intact post-edit, so the semantic invariant (HAND-EDIT narrowings preserved) holds.

## Issues Encountered

None. Plan executed in ~3 minutes with no blockers.

## User Setup Required

None — no external service configuration required for this plan. The real `REBRANDLY_API_KEY` value will be needed in `.env.local` (gitignored) once Phase 59's `/api/referral-link` route lands; dev-side onboarding is documented via the comment block appended in this plan. Phase 58 itself has no runtime dependency on the key.

## Threat Flags

None. All modified files fit within the phase's `<threat_model>` scope (T-58-01 through T-58-05). No new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries were introduced outside the planned surface.

## Next Phase Readiness

- **Plan 58-02 unblocked.** `supabase/migrations/00031_referral_links.sql` is authored and committed (`41a2f14`); Plan 02 can immediately run `supabase db push` (or `supabase migration up`) without any additional file edits. The embedded 7-ASSERT block is the verification surface for the DB apply step.
- **Phase 59 (Referral API + Rebrandly) prerequisite met.** `Database['public']['Tables']['users']['Row']` now carries `referral_code: string | null` and `referral_short_url: string | null`, so admin-client reads in `/api/referral-link` will compile against strict TS typings.
- **Phase 60 (ReferralCard UI) prerequisite met.** Same type surface is available for any client-side consumer that hydrates from an API response.
- **CFG-02 build gate deferred to Plan 02.** Plan 01 is file-authoring only; Plan 02 applies the migration and runs `npm run lint && npx tsc --noEmit && npm run build`. Local `npx tsc --noEmit` exit 0 post-Task-2 confirms no type drift from this plan's edits.

## Self-Check

- [x] `supabase/migrations/00031_referral_links.sql` — FOUND (122 lines)
- [x] `src/lib/types.ts` edit — FOUND (referral_code + referral_short_url in Row/Insert/Update)
- [x] `.env.local.example` edit — FOUND (REBRANDLY_API_KEY= empty + # Rebrandly header)
- [x] Commit `41a2f14` (Task 1) — FOUND in git log
- [x] Commit `63cd6fc` (Task 2) — FOUND in git log
- [x] Commit `d841827` (Task 3) — FOUND in git log

## Self-Check: PASSED

---
*Phase: 58-schema-backfill*
*Plan: 01*
*Completed: 2026-04-16*
