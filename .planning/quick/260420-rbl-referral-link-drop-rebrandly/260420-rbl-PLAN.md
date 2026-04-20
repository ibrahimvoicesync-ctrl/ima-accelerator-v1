# Quick Task 260420-rbl: Replace Rebrandly with application.imaccelerator.com referral URLs

Student referral short links must no longer use `https://rebrand.ly/*`. They should read
`https://application.imaccelerator.com/{referral_code}` — a completely separate service the
user maintains owns the redirect to
`https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_content={slug(name)}-{code}`.

Scope for **this repo** is construction-only: emit the new URL, invalidate cached Rebrandly
values, delete the dead Rebrandly plumbing. The redirect service is out of scope.

## Task 1: Rewrite /api/referral-link to stop calling Rebrandly

**File:** `src/app/api/referral-link/route.ts`

**Action:**
1. Delete the `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` env guards (STEP 3 and the `apiKey` / `workspaceId` locals).
2. Delete the Rebrandly fetch block (STEP 6 — `fetch("https://api.rebrandly.com/...")` + response-shape check + scheme prepend).
3. Replace with a one-liner: `const shortUrl = \`https://application.imaccelerator.com/${referralCode}\``.
4. Keep every other step exactly as-is: CSRF, auth, role gate, profile read, empty-body parse, cache-hit short-circuit, referral-code generation + CAS persist, referral_short_url CAS persist, success shape.
5. Update any step-number / pitfall comments that referenced Rebrandly so the file stays coherent; do not add new prose.

**Verify:**
- `npx tsc --noEmit` passes.
- `npm run lint` clean on the file.
- No remaining `rebrandly` / `REBRANDLY_` references in the file.

## Task 2: Migration 00037 — null out cached Rebrandly URLs

**File:** `supabase/migrations/00037_reset_referral_short_url.sql` (NEW)

**Action:**
- Transactional: `BEGIN; ... COMMIT;`.
- `UPDATE public.users SET referral_short_url = NULL WHERE referral_short_url LIKE 'https://rebrand.ly/%'`.
- ASSERT block verifies post-update count of `referral_short_url LIKE 'https://rebrand.ly/%'` is 0.
- Idempotent: re-running is a no-op (the WHERE filter matches nothing after the first run).
- Follow the file-header comment style used by 00031.

**Verify:** File parses as valid SQL (header + BEGIN/COMMIT + single UPDATE + DO $$ ASSERT $$).

## Task 3: Drop REBRANDLY_* from .env.local.example

**File:** `.env.local.example`

**Action:** Delete the entire Rebrandly block (lines 9-17 in the current file) — the section header comment, `REBRANDLY_API_KEY=`, the workspace comments, and `REBRANDLY_WORKSPACE_ID=`.

**Verify:** No `REBRANDLY` string remains in the file.

## Task 4: Delete the Phase-59 smoke runner

**File:** `scripts/phase-59-smoke-runner.cjs`

**Action:** Delete the file. It exercises the Rebrandly path that no longer exists.

**Verify:** File is gone; no references to it remain in `package.json` scripts or docs (grep to confirm).

## Out of scope (not touching)

- `src/components/student/ReferralCard.tsx` — renders whatever `shortUrl` the API returns.
- `src/components/student/ReferralNudge.tsx` — static copy only.
- `src/proxy.ts` — no new public routes needed; the redirect lives off-domain.
- `next.config.ts` — no host-based rewrites (external service handles the subdomain).
- `src/lib/types.ts` — schema columns unchanged.
- Any slug helper — the external service owns the redirect + utm_content formatting.

## Done when

- API returns `https://application.imaccelerator.com/<8-hex-code>` for student / student_diy.
- Migration 00037 is committed and every pre-existing `rebrand.ly` URL in `referral_short_url` is NULL so the API recomputes on next call.
- REBRANDLY_* env vars and the smoke runner are gone.
- `npx tsc --noEmit` passes.
