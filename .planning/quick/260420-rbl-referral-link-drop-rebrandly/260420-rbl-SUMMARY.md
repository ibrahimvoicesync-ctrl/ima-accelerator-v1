---
status: complete
---

# Quick Task 260420-rbl: Replace Rebrandly with application.imaccelerator.com — Summary

**Completed:** 2026-04-20

## Changes

### 1. `src/app/api/referral-link/route.ts` (refactor)
- Deleted the `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` env guards.
- Deleted the Rebrandly `fetch("https://api.rebrandly.com/v1/links", ...)` block (timeout + ok-check + response-shape validation).
- Added `const REFERRAL_BASE_URL = "https://application.imaccelerator.com"`.
- Short-URL construction is now `${REFERRAL_BASE_URL}/${referralCode}`.
- Every other step is preserved byte-for-byte: CSRF, auth, role gate, profile read, empty-body parse, cache-hit short-circuit, referral-code generation + CAS persist, referral_short_url CAS persist, concurrent-writer re-read, success shape.
- Net: 4 insertions / 65 deletions.

### 2. `supabase/migrations/00041_reset_rebrandly_short_urls.sql` (NEW)
- Nulls `users.referral_short_url` where it still matches `https://rebrand.ly/%`, so the next `/api/referral-link` call recomputes the URL against the new base.
- Transactional (single `BEGIN;...COMMIT;`), idempotent (re-running hits zero rows), with a `DO $mig41_assert$` block verifying no `rebrand.ly` rows remain post-update.

### 3. `.env.local.example` (cleanup)
- Removed the `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` section (header comment + both vars).

### 4. `scripts/phase-59-smoke-runner.cjs` (deleted)
- 425-line Phase-59 smoke runner targeted the old Rebrandly path and is now dead code.

## Not touched

- `src/components/student/ReferralCard.tsx` — unchanged; renders whatever `shortUrl` the API returns, so the new URL shows up automatically.
- `src/components/student/ReferralNudge.tsx` — unchanged.
- `src/proxy.ts` — no public redirect route added (external service owns the redirect).
- `next.config.ts` — no host-based rewrites (external service owns the subdomain).
- `src/lib/types.ts` — schema columns unchanged.

## Result

- API now returns `https://application.imaccelerator.com/<8-hex-code>` for student / student_diy.
- Pre-existing `rebrand.ly` cached values will be nulled when migration 00041 is applied; the next API call rehydrates them.
- Zero remaining `rebrandly` / `rebrand.ly` / `REBRANDLY` references in `src/`.

## Verification

- `npx tsc --noEmit` → exits 0.
- `npm run lint` → 0 errors, 2 pre-existing unrelated warnings.
- `grep -r "rebrandly\|rebrand\.ly\|REBRANDLY" src/` → no matches.

## Follow-ups for the user

- **External redirect service**: whoever owns `application.imaccelerator.com` needs to redirect `/:code → https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_content=<slug(name)>-<code>`. This repo does not handle that.
- **Apply migration 00041** when deploying. Students who previously shared `rebrand.ly/*` links will have those links go dead — acknowledged by the user.

## Commits

1. `fe46ec7` — refactor(referral): stop calling Rebrandly; emit application.imaccelerator.com URLs
2. `09268f4` — feat(db): reset cached Rebrandly short URLs (migration 00041)
3. `2eeb3d8` — chore(referral): drop REBRANDLY_* env + obsolete Phase-59 smoke runner
