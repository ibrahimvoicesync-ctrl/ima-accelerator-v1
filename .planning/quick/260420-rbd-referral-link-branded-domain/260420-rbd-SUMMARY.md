---
status: complete
---

# Quick Task 260420-rbd: Rebrandly branded-domain registration — Summary

**Completed:** 2026-04-20

## Why this task existed

Yesterday's quick task `260420-rbl` removed the Rebrandly API call under the
assumption that a separate redirect service owned `application.imaccelerator.com`.
The user clarified today: that subdomain is actually a Rebrandly **branded
domain** on the Main Workspace (`064885ad3e504b41a8ebc40701c3d457`), domain id
`fc91a930b2c742a2bfa3c979c24e616e`. Rebrandly owns the redirect, but only for
slashtags that have been registered as links. The URLs `260420-rbl` emitted
were never registered, so they 404 at the branded domain.

This task reintroduces the Rebrandly `POST /v1/links` call, scoped to the
branded domain so every returned `shortUrl` is
`application.imaccelerator.com/<slashtag>` instead of `rebrand.ly/<slashtag>`.

## Pre-ship probe (passed — zero test pollution left in Rebrandly)

- `POST /v1/links` with `slashtag=probetest<epoch>` + `domain.id=fc91a930…` →
  HTTP 200, `shortUrl=application.imaccelerator.com/probetest<epoch>`,
  `domain.fullName=application.imaccelerator.com`. Confirms branded-domain
  binding works via `domain.id` (no reliance on a default domain).
- `DELETE /v1/links/<id>` → HTTP 200.

## Changes

### 1. `src/app/api/referral-link/route.ts` (modified)
- Restored env guards for `REBRANDLY_API_KEY` + `REBRANDLY_WORKSPACE_ID` and
  added a new `REBRANDLY_DOMAIN_ID` guard. Each missing var → `console.error`
  + `return 500` (API-07 pattern).
- Added a local `slugifyName(name)` helper: NFKD-normalize → lowercase →
  collapse non-`[a-z0-9]` to `-` → trim → cap 40 chars → fallback `"student"`.
- Built `utmContent = ${slug(name)}-${code.toLowerCase()}` and
  `destination = https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_content=<encoded utmContent>`.
- `POST https://api.rebrandly.com/v1/links` with
  `{ destination, slashtag: referralCode, domain: { id: domainId }, title }`,
  `signal: AbortSignal.timeout(8000)`, headers `{ apikey, workspace, Content-Type }`.
- Response handling:
  - `status === 409` (concurrent writer owns the slashtag) → synthesize
    `https://application.imaccelerator.com/<code>` and continue to CAS
    persist. Prevents a spurious 502 on double-click.
  - `!response.ok` → `console.error` + `return 502`.
  - Missing `shortUrl` string → `console.error` + `return 502`.
  - Ok → persist `https://<rbBody.shortUrl>` via the existing CAS write.
- Everything else preserved byte-for-byte: CSRF, auth, role gate, profile read,
  empty-body parse, cache-hit short-circuit, referral-code CAS persist,
  concurrent-writer re-read, `{ shortUrl, referralCode }` response shape.

### 2. `supabase/migrations/00042_reset_unregistered_referral_urls.sql` (NEW)
- Transactional (`BEGIN;…COMMIT;`), idempotent (`WHERE … LIKE` matches nothing
  after first run), with a `DO $mig42_assert$` block that rolls back if any
  offending rows remain.
- Nulls every `users.referral_short_url` matching
  `https://application.imaccelerator.com/%` — those were written by yesterday's
  code before the branded-domain fix and point at un-registered slashtags.
- Next `/api/referral-link` call regenerates them via the real Rebrandly POST.

### 3. `.env.local.example` (modified)
- Appended a Rebrandly section with `REBRANDLY_API_KEY`,
  `REBRANDLY_WORKSPACE_ID`, and new `REBRANDLY_DOMAIN_ID`. Each line carries
  an inline curl recipe for discovering the value (`/v1/account`,
  `/v1/workspaces`, `/v1/domains`).

### 4. `.env.local` (local only — NOT committed, gitignored)
- Appended `REBRANDLY_DOMAIN_ID=fc91a930b2c742a2bfa3c979c24e616e`.
- `REBRANDLY_API_KEY` + `REBRANDLY_WORKSPACE_ID` were preserved from the
  2026-04-16 debug session; no change.

## Not touched

- `src/components/student/ReferralCard.tsx` / `ReferralNudge.tsx` — render
  whatever `shortUrl` the API returns.
- `src/proxy.ts` / `next.config.ts` — Rebrandly owns the DNS-level redirect.
- `src/lib/types.ts` — schema unchanged.

## Verification

- `npx tsc --noEmit` → exit 0.
- `npm run lint` → 0 errors, 2 pre-existing warnings unrelated to referral
  code (`WorkTrackerClient.tsx:277`, `Modal.tsx:98`).
- `grep -rn "REBRANDLY_" src/` → 6 matches, all inside
  `src/app/api/referral-link/route.ts` (guards + three `console.error` strings).
- Live Rebrandly probe: POST 200 then DELETE 200 (see above).

## Follow-ups for the user

1. **Restart `npm run dev`** so Next.js reloads the new `REBRANDLY_DOMAIN_ID`
   from `.env.local`.
2. **Apply migration 00042** against your Supabase project. Any student who
   saw yesterday's un-registered URL will regenerate a fresh, registered one
   on their next "Get My Link" click.
3. **End-to-end smoke:** sign in as a `student` or `student_diy`, click
   "Get My Link" on the dashboard `ReferralCard`. The returned URL should be
   `https://application.imaccelerator.com/<8-char-code>`. Visit it in an
   incognito window — Rebrandly should redirect you to
   `https://www.imaccelerator.com/apply/typeform?utm_source=referral&utm_content=<slug>-<code>`.
4. If you want a belt-and-braces safeguard against missing-default-domain
   drift in Rebrandly later, mark `application.imaccelerator.com` as the
   default domain in the Main Workspace — harmless when we already pass
   `domain.id` explicitly.

## Commits

1. `d09a535` — feat(referral): register referral links on the application.imaccelerator.com Rebrandly branded domain
2. `6bb8934` — feat(db): reset unregistered application.* referral URLs (migration 00042)
3. `d8d598e` — chore(referral): restore REBRANDLY_* env vars and document REBRANDLY_DOMAIN_ID
