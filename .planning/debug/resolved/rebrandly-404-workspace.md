---
status: resolved
trigger: "POST /api/referral-link returns 502. Rebrandly upstream returns 404 Not Found with body {message: Not found, code: NotFound, source: workspace}."
created: 2026-04-16
updated: 2026-04-16
slug: rebrandly-404-workspace
---

# Debug: Rebrandly POST /v1/links → 404 NotFound (source: workspace)

## Symptoms

DATA_START
**Expected behavior:**
- User clicks "Get My Link" on `/student` or `/student_diy` dashboard.
- `POST /api/referral-link` calls Rebrandly `POST https://api.rebrandly.com/v1/links` with the API key in the `apikey` header.
- Rebrandly returns 200 with `{ id, shortUrl }`. Route persists `https://${shortUrl}` and returns `{ shortUrl, referralCode }`.

**Actual behavior:**
- ReferralCard shows "Could not generate your link. Please try again."
- Server log:
  ```
  [POST /api/referral-link] Rebrandly non-OK: 404 Not Found {"message":"Not found","code":"NotFound","source":"workspace"}
  POST /api/referral-link 502 in 563ms
  ```
- The `source: "workspace"` field is the diagnostic — Rebrandly is rejecting the request because the workspace tied to the supplied API key cannot be found (deleted, wrong key, or key belongs to a workspace the request resolves against).

**Error message (verbatim):**
```
[POST /api/referral-link] Rebrandly non-OK: 404 Not Found {"message":"Not found","code":"NotFound","source":"workspace"}
POST /api/referral-link 502 in 563ms (compile: 1457µs, render: 561ms)
```

**Timeline:**
- v1.7 Phase 59 wired up the route and shipped 2026-04-16.
- v1.7 milestone audit verified end-to-end pipeline structure, but the live Rebrandly call was not exercised against real credentials in audit (smoke runner uses fakes).
- This is the first attempted live call against the Rebrandly API with whatever key is currently in `.env.local`.

**Reproduction:**
1. `npm run dev`.
2. Sign in as a student or student_diy.
3. Click "Get My Link" on the dashboard ReferralCard.
4. Server returns 502; client surfaces "Could not generate your link".

**Related context:**
- Route: `src/app/api/referral-link/route.ts` (lines 91-117 — Rebrandly fetch). It sends `apikey: <REBRANDLY_API_KEY>` header only — no workspace header, no Bearer token.
- Body: `{ destination: "https://www.imaccelerator.com/?ref=${referralCode}", title: "IMA Referral - ${name ?? code}" }`.
- `.env.local` exists and contains a `REBRANDLY_API_KEY=...` line (confirmed with grep).
- Rebrandly API docs: https://developers.rebrandly.com/reference/post_links — auth via `apikey` header. `source: "workspace"` in a 404 typically means the resolved workspace is missing/deleted/wrong.
- The route does NOT set a `workspace` header. Without it, Rebrandly should default to the workspace owning the API key. If the key is from a deleted/disabled workspace, you get exactly this error.

**Hypotheses to evaluate (most likely first):**
1. The `REBRANDLY_API_KEY` in `.env.local` is invalid, expired, or from a workspace that has been deleted/renamed in Rebrandly.
2. The API key is correct but the Rebrandly account requires an explicit `workspace` header that is not being sent.
3. The destination URL (`https://www.imaccelerator.com/?ref=...`) is being rejected by a domain restriction on the workspace — but Rebrandly normally returns a different error for that (403 or 422), not 404 source: workspace.
4. The key was rotated and `.env.local` is stale.
DATA_END

## Current Focus

hypothesis: CONFIRMED — Hypothesis #2. The API key is valid but the account has multiple workspaces, ALL with `default: false`. Without an explicit `workspace` header, Rebrandly cannot resolve a default workspace and returns 404 source: workspace.

test: PASSED — direct curl probes against /v1/account (200), /v1/workspaces (200, 3 workspaces, all default=false), POST /v1/links without workspace header (404 reproduced exactly), POST /v1/links WITH workspace header for "Main Workspace" (200 OK with valid shortUrl).

expecting: Adding `workspace: <id>` header to the route's POST will resolve the 404. CONFIRMED.

next_action: COMPLETE.

## Evidence

- timestamp: 2026-04-16 probe
  GET https://api.rebrandly.com/v1/account with REBRANDLY_API_KEY from .env.local → HTTP 200
  Account: id=f62f644b5dd54bcfaddfa3c3c5625378, username=ugo@imaccelerator.com, fullName="Ugo Varlet", subscription category=free
  → Key is VALID. Hypothesis #1 (bad/expired key) eliminated.

- timestamp: 2026-04-16 probe
  GET https://api.rebrandly.com/v1/workspaces → HTTP 200, returned 3 workspaces:
    - id=064885ad3e504b41a8ebc40701c3d457  name="Main Workspace"  default=false  role=admin  links=158  (owner aman@imaccelerator.com)
    - id=5083a59912c644fca780e094ae24559c  name="Righteous and Rich"  default=false  role=admin
    - id=ad5de6c99d314ae8b98334a3bc2f8b56  name="Mustafa"  default=false  role=admin
  → CRITICAL: NONE have default=true. Without an explicit workspace header, Rebrandly has no workspace to scope the request to → 404 source:workspace.

- timestamp: 2026-04-16 probe
  POST https://api.rebrandly.com/v1/links with same headers as route (apikey only, no workspace) → HTTP 404, body `{"message":"Not found","code":"NotFound","source":"workspace"}`
  → 404 reproduced EXACTLY as the dashboard saw it. Confirms route headers are the issue, not request body or destination.

- timestamp: 2026-04-16 probe
  POST https://api.rebrandly.com/v1/links with `workspace: 064885ad3e504b41a8ebc40701c3d457` header added → HTTP 200, body contains `id`, `shortUrl: rebrand.ly/ikls35k`, `slashtag`, full link metadata.
  → FIX CONFIRMED. Adding workspace header resolves the 404. (Test link cleaned up.)

- timestamp: 2026-04-16 post-fix verify
  After applying the code fix and writing REBRANDLY_WORKSPACE_ID into .env.local, re-ran POST simulation with the exact headers the updated route now sends → HTTP 200, shortUrl=rebrand.ly/j6kxhyj. (Verify link cleaned up.)

- timestamp: 2026-04-16 build verify
  `npx tsc --noEmit` → clean (no output)
  `npm run lint` → 0 errors, 4 pre-existing warnings (none in referral-link/route.ts)

## Eliminated

- Hypothesis #1 (bad/expired/deleted-workspace key): /v1/account returned 200 with full account metadata.
- Hypothesis #3 (destination domain restriction): the same destination succeeded as soon as the workspace header was added; Rebrandly returns 422/403 for domain restrictions, not 404 source:workspace.
- Hypothesis #4 (stale key): account endpoint authenticates successfully — key is current.
- Route logic itself (CSRF, auth, role gate, profile lookup, code generation, CAS persist, 502 mapping): all verified correct in Phase 59 audit; only the missing workspace header was wrong.

## Resolution

**Root cause:**
The Rebrandly API key in `.env.local` belongs to an account with 3 workspaces, none of which is marked as default. Rebrandly's `POST /v1/links` requires either a default workspace OR an explicit `workspace: <id>` header to resolve scope. The shipped route in v1.7 Phase 59 sent only the `apikey` header, so Rebrandly had no workspace context and returned `404 {source: "workspace"}`.

This was not caught in the Phase 59 audit because the smoke runner uses a fake key and never reaches the live Rebrandly endpoint — it tests the route's branching, not the upstream contract.

**Fix applied (code):**
- `src/app/api/referral-link/route.ts` (STEP 3 + STEP 6):
  - Added `REBRANDLY_WORKSPACE_ID` env-var read alongside `REBRANDLY_API_KEY`.
  - Added explicit guard returning 500 + `console.error` if the workspace id is missing (mirrors the existing API-07 pattern, satisfies CLAUDE.md never-swallow-errors rule).
  - Added `workspace: workspaceId` to the request headers in the POST to `https://api.rebrandly.com/v1/links` (alongside the existing `apikey` and `Content-Type` headers).
- `.env.local.example`: added `REBRANDLY_WORKSPACE_ID=` with a comment explaining when it's required and where to find the id (`GET /v1/workspaces`).

**Fix applied (configuration):**
- `.env.local` (NOT committed — gitignored, contains secrets): set `REBRANDLY_WORKSPACE_ID=064885ad3e504b41a8ebc40701c3d457` (the "Main Workspace" with 158 existing links, owner aman@imaccelerator.com — the right one for IMA referrals).

**Verification:**
- Direct curl probe with the exact headers the updated route now sends → HTTP 200 with valid shortUrl.
- `npx tsc --noEmit` → clean.
- `npm run lint` → 0 errors.
- Test/verification links created in Rebrandly during the probe were deleted (DELETE 200 for both).

**Action required from user:**
- **Restart the dev server** (`npm run dev`) so the new `REBRANDLY_WORKSPACE_ID` env var is loaded — Next.js does not hot-reload `.env.local`.
- Then click "Get My Link" again on the student dashboard; it will now succeed and persist `https://rebrand.ly/<slug>` to `users.referral_short_url`.
- (Optional) If you want to switch which Rebrandly workspace receives the links later, change `REBRANDLY_WORKSPACE_ID` in `.env.local` to one of:
  - `064885ad3e504b41a8ebc40701c3d457` — Main Workspace (current, 158 links)
  - `5083a59912c644fca780e094ae24559c` — Righteous and Rich
  - `ad5de6c99d314ae8b98334a3bc2f8b56` — Mustafa
- (Optional, defensive) In the Rebrandly dashboard, mark one workspace as the default for this API key so any future un-scoped calls don't silently break.

**Files changed:**
- `src/app/api/referral-link/route.ts` (env read + workspace header)
- `.env.local.example` (documented new var)
- `.env.local` (local config — NOT staged for git, contains the actual workspace id)
