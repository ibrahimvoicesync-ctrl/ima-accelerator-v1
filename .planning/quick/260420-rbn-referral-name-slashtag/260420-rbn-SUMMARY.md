---
status: complete
---

# Quick Task 260420-rbn: Name-based Rebrandly slashtag + utm_campaign — Summary

**Completed:** 2026-04-20 (same day as 260420-rbl, 260420-rbd)

## Why this task existed

Quick task `260420-rbd` restored the Rebrandly call but kept the 8-char random
`referral_code` as the slashtag (e.g., `.../75691E9F`) and the destination with
`utm_content=<slug>-<code>`. The user wanted the short URL to carry the
student's **name** slug and the destination to use `utm_campaign=<slug>`.

Confirmed user decisions for the three edge cases:
- **(a)** On Rebrandly 409 (slashtag already taken): retry once with
  `<name-slug>-<referral-code-lowercased>`.
- **(ii)** `utm_campaign` is always `slugifyName(name)` (or `"student"` if
  nameless) — NOT the final slashtag. Two users with the same name share the
  same `utm_campaign` by design.
- **(y)** Nameless users get slashtag `student-<code-lowercased>` (random 8-hex
  ≈ unique).
- **Orphan:** delete the one Rebrandly link registered under the old
  code-slashtag scheme (`75691E9F`).

## Pre-ship probe (passed)

- `POST /v1/links` with `slashtag=probetest<epoch>` + `destination=…?utm_source=referral&utm_campaign=probetest<epoch>` + `domain.id=fc91a930…` → HTTP 200, `shortUrl=application.imaccelerator.com/probetest<epoch>`, destination echoed with `utm_campaign`. `DELETE /v1/links/<id>` → HTTP 200.

## Changes

### 1. `src/app/api/referral-link/route.ts` (refactor)
- `slugifyName()` now returns `""` for blank input (callers decide the
  `"student"` fallback).
- `REFERRAL_BASE_URL` constant dropped — Rebrandly's `shortUrl` response is the
  single source of truth.
- Primary slashtag: `slugifyName(profile.name) || "student-" + codeLower`.
- `utm_campaign`: `slugifyName(profile.name) || "student"`. Destination becomes
  `https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_campaign=<encoded>`.
- `registerSlashtag(slashtag)` helper for the Rebrandly POST. Call once with
  `primarySlashtag`. On `409 && nameSlug`, retry once with
  `${nameSlug}-${codeLower}`. Any remaining non-ok → `console.error` + 502.
- Removed the old "synthesize URL on 409" branch (superseded by the retry).
- Preserved byte-for-byte: CSRF, auth, role gate, profile read, empty-body
  parse, cache-hit short-circuit, code CAS, `referral_short_url` CAS,
  concurrent-writer re-read, `{ shortUrl, referralCode }` success shape.

### 2. `supabase/migrations/00043_reset_code_based_referral_urls.sql` (NEW)
- Transactional + idempotent + ASSERT.
- `UPDATE users SET referral_short_url = NULL WHERE referral_short_url = 'https://application.imaccelerator.com/' || referral_code`.
- Applied to production: 1 row nulled (Ibrahim Awwad student, code `75691E9F`).
  Post-update count = 0, assert PASS.

### 3. Rebrandly orphan deletion
- `DELETE /v1/links/a6c51fe98fbd44969f2e9174ff9c9af7` (slashtag `75691E9F`) →
  HTTP 200, response `status: "deleted"`. Final state: `clicks: 1` (one test
  click before deletion) — harmless.
- No other Rebrandly links touched. The 24 marketing-team links on the
  `application.imaccelerator.com` branded domain (campaigns: `Kushtrim-extended`,
  `Michael-extended`, `fg1`, `bio`, `clips`, `liban`, `organic`, etc.) are
  untouched.

### 4. Production deploy
- `git push origin master` → `3be1e4d..87a29d5`.
- `vercel --prod --yes --archive=tgz` → deployment `dpl_8KZAgnEQuZDvB3qZFQmcsTsXf2aK`,
  READY, aliased to `https://ima-accelerator-v1.vercel.app`.

## Not touched

- `ReferralCard.tsx` / `ReferralNudge.tsx` — render whatever the API returns.
- `src/proxy.ts` / `next.config.ts` — Rebrandly owns the DNS-level redirect.
- `src/lib/types.ts` — schema unchanged.
- Vercel env vars — `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` /
  `REBRANDLY_DOMAIN_ID` (all set in 260420-rbd) still the only required vars.

## Verification

- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 2 pre-existing warnings (unchanged).
- `grep -r "utm_content\|REFERRAL_BASE_URL" src/` → no matches.
- Supabase: 6 student rows currently have `referral_code` + NULL
  `referral_short_url`; next "Get My Link" click will register the new
  name-based slashtag on each.
- Live Vercel deployment READY on production alias.

## Expected behavior after the new deploy

For the current Supabase roster:

| name | expected slashtag (first click wins) | expected URL |
|---|---|---|
| Ibrahim Awwad (student) | `ibrahim-awwad` | `application.imaccelerator.com/ibrahim-awwad` |
| Ibrahim Awwad (student_diy) | `ibrahim-awwad-147222ad` (collision fallback) | `application.imaccelerator.com/ibrahim-awwad-147222ad` |
| Michael Coppotelli | `michael-coppotelli` | `application.imaccelerator.com/michael-coppotelli` |
| Test DIY Student | `test-diy-student` | `application.imaccelerator.com/test-diy-student` |
| yousaf qureshi | `yousaf-qureshi` | `application.imaccelerator.com/yousaf-qureshi` |
| Aman Abdur-Rauf | `aman-abdur-rauf` | `application.imaccelerator.com/aman-abdur-rauf` |
| Omar Varlet | `omar-varlet` | `application.imaccelerator.com/omar-varlet` |

All destinations: `https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_campaign=<name-slug>`.

For the two Ibrahim Awwad accounts specifically: whoever clicks "Get My Link"
first on the new deploy gets `ibrahim-awwad`; the second gets
`ibrahim-awwad-<their-code-lower>`. Both destinations carry
`utm_campaign=ibrahim-awwad` (per decision (ii)).

## Follow-ups for the user

1. Click "Get My Link" on your student account. Expected URL:
   `https://application.imaccelerator.com/ibrahim-awwad`. Visit in incognito —
   Rebrandly should redirect to
   `https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_campaign=ibrahim-awwad`.
2. Repeat on your student_diy account. Expected URL:
   `https://application.imaccelerator.com/ibrahim-awwad-147222ad` (collision
   fallback).
3. Known minor follow-up from 260420-rbd: `REBRANDLY_DOMAIN_ID` is still not
   set on the Vercel **Preview** scope (CLI wouldn't accept `--yes` without a
   branch). PR preview builds will still 500 until this is set via the Vercel
   dashboard. Low priority.

## Commits

1. `f5676c2` — refactor(referral): use name-slug Rebrandly slashtag + utm_campaign
2. `87a29d5` — feat(db): reset code-based referral URLs for name-slug reregistration (migration 00043)
3. (to be added) — chore(planning): record quick task 260420-rbn
