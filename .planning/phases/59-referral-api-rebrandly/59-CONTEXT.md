# Phase 59: Referral API + Rebrandly - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Any authenticated student or student_diy user can `POST /api/referral-link` and receive an idempotent JSON `{ shortUrl, referralCode }` — Rebrandly is called at most once per user for life, and every documented failure mode (auth, role, missing key, Rebrandly outage, DB error) returns a stable HTTP status without corrupting state.

**Requirements:** API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, CFG-02.

**Success criteria (from ROADMAP):**
1. Unauthenticated POST → 401; owner/coach → 403. Neither touches DB or Rebrandly.
2. First authenticated POST from a backfilled student/student_diy → 200 with `{ shortUrl, referralCode }`; subsequent POSTs return the same `shortUrl` with zero new Rebrandly calls (idempotent for life).
3. Backfill-skipped student/student_diy (`referral_code IS NULL`) → fresh 8-char code is persisted to `public.users` BEFORE Rebrandly is called; response echoes the same code.
4. `REBRANDLY_API_KEY` unset → 500 (dashboard still loads); Rebrandly non-OK/throw/timeout → 502, `console.error` logs cause, `referral_short_url` remains NULL (no partial persistence).
5. Standard API pipeline — `getSessionUser()` + role gate BEFORE Zod `safeParse`; admin client for all DB access; `response.ok` checked before parsing Rebrandly JSON; `import { z } from "zod"` (never `zod/v4`).
6. CFG-02: `npm run lint && npx tsc --noEmit && npm run build` exits 0.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, CLAUDE.md Hard Rules, and codebase conventions to guide decisions. Key constraints already locked by the goal:

- **Idempotency contract:** At most one Rebrandly call per user, for life. Use `referral_short_url IS NOT NULL` as the skip signal; do not re-call even on transient past failures — a persisted short URL is the commit point.
- **Code generation for NULL-code rows:** Must use the same shape as the backfill (`upper(substr(md5(id::text), 1, 8))`) so the deterministic invariant holds for any student/student_diy created after migration 00031 was applied, OR use a fresh crypto-random 8-char upper-hex code. Pick one and be consistent. (Default: match the migration's deterministic form — Phase 58 established this pattern.)
- **Failure modes map to HTTP codes:** 401 (no session), 403 (wrong role), 500 (server misconfig — missing env var), 502 (upstream fault — Rebrandly down/err/timeout), 400 (malformed body). DB errors during the pre-Rebrandly code persist should also 500.
- **No partial persistence:** If Rebrandly fails, `referral_short_url` stays NULL — the next call will retry. The `referral_code` IS allowed to be persisted before Rebrandly is called (in fact required by SC3).

### Reference patterns
- Mirror the auth-then-role-then-body-parse order used in existing API routes under `src/app/api/**`.
- Use the admin Supabase client (`src/lib/supabase/admin.ts` or equivalent) — never import in client code.
- Rebrandly API docs: `POST https://api.rebrandly.com/v1/links` with `apikey` header; response includes `shortUrl` field.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

Known fixtures from Phase 58:
- `public.users.referral_code varchar(12)` + `public.users.referral_short_url text`, both nullable.
- Partial UNIQUE index `idx_users_referral_code WHERE referral_code IS NOT NULL` — in-db uniqueness is guaranteed.
- 5 students + 2 student_diy rows backfilled at migration apply time (2026-04-16); 4 owners + 10 coaches untouched.
- `.env.local.example` documents `REBRANDLY_API_KEY=` as required for this phase.

</code_context>

<specifics>
## Specific Ideas

- Route lives at `src/app/api/referral-link/route.ts` (per Next.js 16 App Router conventions).
- Export `POST` handler; no GET needed (Phase 60 consumes the POST response directly).
- Rebrandly request: `{ destination: "https://ima.example/refer/{code}", slashtag?: {code} }` — destination URL scheme is at Claude's discretion but must include the `referral_code` so click-through can attribute.
- Short URL is persisted on success; response shape is exactly `{ shortUrl: string, referralCode: string }`.

</specifics>

<deferred>
## Deferred Ideas

- Rebrandly click-tracking / analytics ingestion — out of scope (no payout scope per v1.7 milestone memory).
- Owner/coach admin view of who generated links — not in v1.7.
- Automatic code regeneration on demand — not offered; the first Rebrandly success locks the short URL for life.

</deferred>
