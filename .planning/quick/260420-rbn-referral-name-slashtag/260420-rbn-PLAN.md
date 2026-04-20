# Quick Task 260420-rbn: Name-based Rebrandly slashtag + utm_campaign

Today's prior quick task `260420-rbd` registered referral links on the
`application.imaccelerator.com` Rebrandly branded domain using the 8-char random
`referral_code` as the slashtag (e.g. `.../75691E9F`) and shipped the destination
with `utm_content=<slug>-<code>`.

User correction: the short URL should carry the student's name slug
(`.../ibrahim-awwad`), and the destination should use `utm_campaign=<slug>`
instead of `utm_content`.

Confirmed user decisions:
- **(a)** On slashtag collision (409), retry once with `<name-slug>-<referral-code-lowercased>`.
- **(ii)** `utm_campaign` is always `slugifyName(name)` (or `"student"` if nameless) — NOT the final slashtag. Two students with the same name share the same utm_campaign.
- **(y)** Nameless users get slashtag `student-<code-lowercased>` (random 8 hex ≈ unique).
- **Orphan cleanup:** delete the one Rebrandly link currently registered under the old scheme (slashtag `75691E9F`).

## Task 1: Rewrite route to use name slug + utm_campaign

**File:** `src/app/api/referral-link/route.ts`

**Action:**
1. Compute `const trimmedName = (profile.name ?? "").trim()` and
   `const nameSlug = trimmedName ? slugifyName(trimmedName) : ""`.
2. Compute `const codeLower = referralCode.toLowerCase()`.
3. Primary slashtag: `nameSlug || \`student-\${codeLower}\``.
4. `utm_campaign`: `nameSlug || "student"`. Build
   `destination = \`${REFERRAL_DESTINATION}?utm_source=referral&utm_campaign=${encodeURIComponent(utmCampaign)}\``.
5. Single Rebrandly POST helper `tryRebrandly(slashtag)` that returns the raw
   `Response`. Call once with `primarySlashtag`; if `status === 409 && nameSlug`,
   call again with `${nameSlug}-${codeLower}`.
6. On final non-ok: `console.error` (never-swallow) + 502. On ok: validate
   `shortUrl` string non-empty, persist `https://<shortUrl>` via the existing CAS.
7. Remove the old "synthesize URL on 409" branch — the retry supersedes it. The
   concurrent-same-user race is already suppressed by the cache-hit short-circuit
   at the top of the route.
8. Preserve CSRF, auth, role gate, profile read, empty-body parse, cache-hit
   short-circuit, code CAS, persist CAS, concurrent-writer re-read, success shape.

**Verify:**
- `npx tsc --noEmit` passes.
- `npm run lint` clean on the file.
- `REBRANDLY_API_KEY` / `REBRANDLY_WORKSPACE_ID` / `REBRANDLY_DOMAIN_ID` each appear
  exactly once in `src/`.
- No remaining `utm_content` reference in the route.

## Task 2: Migration 00043 — null the one code-based URL

**File:** `supabase/migrations/00043_reset_code_based_referral_urls.sql` (NEW)

**Action:**
- Transactional (`BEGIN;…COMMIT;`), idempotent (exact-match WHERE), with ASSERT.
- `UPDATE public.users SET referral_short_url = NULL WHERE referral_short_url = 'https://application.imaccelerator.com/' || referral_code` — exact-match on
  the code-based format; no regex, no risk of nulling a future name-based URL
  whose slug happens to equal its code.
- ASSERT block verifies post-update count matching that filter is 0.

Purpose: 1 row currently holds the old code-based URL (Ibrahim Awwad student,
`75691E9F`). Nulling it forces regeneration under the new name-slug scheme.

## Task 3: Delete the one Rebrandly orphan link

**Action:** `DELETE /v1/links/a6c51fe98fbd44969f2e9174ff9c9af7` against the
Rebrandly API. This was the only link registered under the old code-slashtag
scheme. Every other link on the `application.imaccelerator.com` branded domain
belongs to the marketing team (campaigns like `Kushtrim-extended`,
`Michael-extended`, `fg1`, `bio`, `clips`, etc.) — those are NOT touched.

## Task 4: Push + redeploy

- `git push origin master` (same as 260420-rbd).
- `vercel --prod --archive=tgz` to build + deploy with the new code. Env vars
  unchanged (same 3 Rebrandly vars already in place).

## Out of scope

- `ReferralCard.tsx` / `ReferralNudge.tsx` — render whatever URL the API returns.
- `src/proxy.ts` / `next.config.ts` — Rebrandly owns the DNS-level redirect.
- `src/lib/types.ts` — schema unchanged.
- Vercel env vars — unchanged since 260420-rbd.

## Pre-ship probe (passed)

- `POST /v1/links` with `slashtag=probetest<epoch>`, `destination=…?utm_source=referral&utm_campaign=probetest<epoch>`,
  `domain.id=fc91a930…` → HTTP 200,
  `shortUrl=application.imaccelerator.com/probetest<epoch>`,
  `destination` echoed back with `utm_campaign`.
- `DELETE /v1/links/<id>` → HTTP 200. No test pollution.

## Done when

- `/api/referral-link` returns `https://application.imaccelerator.com/<name-slug>`
  (or `<name-slug>-<code>` on collision, or `student-<code>` when nameless).
- Destination URL carries `utm_source=referral&utm_campaign=<slug>`, no
  `utm_content`.
- Migration 00043 applied — no rows remain with the old code-based URL shape.
- Orphan Rebrandly link `75691E9F` deleted from the workspace.
- Vercel production redeployed; user confirms live smoke test passes.
