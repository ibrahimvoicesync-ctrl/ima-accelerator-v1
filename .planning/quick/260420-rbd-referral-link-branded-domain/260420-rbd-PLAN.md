# Quick Task 260420-rbd: Register referral links on the application.imaccelerator.com Rebrandly branded domain

Yesterday's quick task 260420-rbl stopped calling Rebrandly and just synthesized
`https://application.imaccelerator.com/<code>` URLs locally. That was based on the
assumption that a separate redirect service owned the subdomain.

In fact, `application.imaccelerator.com` is configured as a **Rebrandly branded
domain** on the Main Workspace (`064885ad3e504b41a8ebc40701c3d457`), domain id
`fc91a930b2c742a2bfa3c979c24e616e`. Rebrandly owns the redirect on that subdomain,
but only for slashtags that have been registered as links. Synthesizing URLs
without registering them produces 404s.

The fix: reintroduce the Rebrandly `POST /v1/links` call, but scope every link
to the branded domain so the `shortUrl` is returned as
`application.imaccelerator.com/<slashtag>` instead of `rebrand.ly/<slashtag>`.

## Task 1: Rewrite /api/referral-link to register each referral code in Rebrandly

**File:** `src/app/api/referral-link/route.ts`

**Action:**
1. Restore the env guards for `REBRANDLY_API_KEY`, `REBRANDLY_WORKSPACE_ID`, and
   **new** `REBRANDLY_DOMAIN_ID`. Missing any of them → `console.error` + `return 500`
   (API-07 pattern; satisfies the never-swallow-errors rule).
2. Add a local `slugifyName(name: string | null)` helper: lowercase, NFKD-strip
   diacritics, collapse non-`[a-z0-9]` → `-`, trim, cap at 40 chars, fallback to
   `"student"` when empty.
3. After the existing `referralCode` generation + CAS, build:
   - `utmContent = `${slugifyName(profile.name)}-${referralCode.toLowerCase()}``
   - `destination = `https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_content=${encodeURIComponent(utmContent)}``
4. `POST https://api.rebrandly.com/v1/links` with headers
   `{ apikey, workspace, Content-Type: application/json }`, body
   `{ destination, slashtag: referralCode, domain: { id: REBRANDLY_DOMAIN_ID }, title }`,
   `signal: AbortSignal.timeout(8000)`.
5. Response handling:
   - `status === 409` (concurrent writer won the slashtag): synthesize
     `https://application.imaccelerator.com/<code>` and continue to CAS persist.
   - `!rbResponse.ok`: `console.error` with status/statusText/body + `return 502`.
   - Otherwise: validate `shortUrl` is a non-empty string, persist
     `https://${rbBody.shortUrl}`.
6. Keep the rest byte-for-byte: CSRF, auth, role gate, profile read, empty-body
   parse, cache-hit short-circuit, referral-code CAS persist, referral_short_url
   CAS persist, concurrent-writer re-read, success shape `{ shortUrl, referralCode }`.

**Verify:**
- `npx tsc --noEmit` passes.
- `npm run lint` clean on the file.
- `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` / `REBRANDLY_DOMAIN_ID` each appear
  exactly once in `src/`, all inside this route.

## Task 2: Migration 00042 — null out unregistered application.* URLs

**File:** `supabase/migrations/00042_reset_unregistered_referral_urls.sql` (NEW)

**Action:**
- Transactional: `BEGIN; ... COMMIT;`.
- `UPDATE public.users SET referral_short_url = NULL WHERE referral_short_url LIKE 'https://application.imaccelerator.com/%'`.
- ASSERT block verifies post-update count is 0.
- Idempotent: re-running matches nothing after the first run.
- Header comment follows the 00041 style.

Purpose: yesterday's 260420-rbl code wrote URLs that were never registered in
Rebrandly, so they currently 404 on the branded domain. Nulling them forces the
next `/api/referral-link` call to recompute via the real Rebrandly POST, which
will register the slashtag and return a working URL.

## Task 3: Restore REBRANDLY_* section in .env.local.example

**File:** `.env.local.example`

**Action:** Append the Rebrandly section with `REBRANDLY_API_KEY`,
`REBRANDLY_WORKSPACE_ID`, and `REBRANDLY_DOMAIN_ID` plus a comment explaining
where each value comes from (`GET /v1/account`, `GET /v1/workspaces`, `GET /v1/domains`).

## Task 4: Set REBRANDLY_DOMAIN_ID locally

**File:** `.env.local` (gitignored)

**Action:** Append `REBRANDLY_DOMAIN_ID=fc91a930b2c742a2bfa3c979c24e616e`.
`REBRANDLY_API_KEY` and `REBRANDLY_WORKSPACE_ID` were preserved from the 2026-04-16
debug session and need no change.

## Out of scope

- `src/components/student/ReferralCard.tsx` / `ReferralNudge.tsx` — render whatever
  the API returns, no change needed.
- `src/proxy.ts` / `next.config.ts` — Rebrandly owns the DNS-level redirect.
- `src/lib/types.ts` — schema columns unchanged.

## Pre-ship probe (passed)

- `POST /v1/links` with `slashtag=probetest<epoch>`, `domain.id=fc91a930...` →
  HTTP 200, `shortUrl=application.imaccelerator.com/probetest<epoch>`,
  `domain.fullName=application.imaccelerator.com`.
- `DELETE /v1/links/<id>` → HTTP 200. Probe link removed.
- Confirms: branded-domain binding works, slashtag echoes through, no test pollution.

## Done when

- `/api/referral-link` returns `https://application.imaccelerator.com/<code>` and
  that URL redirects through Rebrandly to the Typeform destination.
- Migration 00042 committed; pre-existing application.* short_url values are
  NULL so next call re-registers them.
- Env section restored with the new domain id documented.
- `npx tsc --noEmit` + `npm run lint` pass.
- User has restarted `npm run dev` and clicked "Get My Link" on a dashboard to
  confirm a real Rebrandly link is created and redirects correctly.
