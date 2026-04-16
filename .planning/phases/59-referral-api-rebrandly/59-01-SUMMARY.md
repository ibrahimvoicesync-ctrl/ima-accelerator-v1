---
phase: 59-referral-api-rebrandly
plan: 01
subsystem: api

tags: [api, next-app-router, supabase, rebrandly, referral, idempotent, csrf, zod, smoke-runner, cfg-02]

requires:
  - phase: 58-schema-backfill
    provides: "public.users.referral_code + referral_short_url columns (nullable, partial-UNIQUE-indexed); 7 student/student_diy rows backfilled with 8-char upper-hex codes; REBRANDLY_API_KEY documented in .env.local.example"

provides:
  - "src/app/api/referral-link/route.ts — idempotent POST handler exporting exactly one POST; 8-step pipeline (CSRF → auth → role → env → body → cache-hit → code-persist → Rebrandly → CAS persist → response); response shape { shortUrl: string, referralCode: string }; at-most-one Rebrandly call per user for life via referral_short_url cache-hit + compare-and-swap persist"
  - "scripts/phase-59-smoke-runner.cjs — 9-case CommonJS smoke runner (SMOKE 1..9) exercising HTTP contract + DB invariants; exits 0 on all-green, 1 on any FAIL, 2 on env/config error; mirrors phase-57-smoke-runner.cjs shape"
  - "CFG-02 combined build gate closed for Phase 59 — npm run lint && npx tsc --noEmit && npm run build exits 0 with /api/referral-link registered as ƒ dynamic route"

affects:
  - 60-referralcard-ui

tech-stack:
  added: []
  patterns:
    - "Pattern 1 — standard mutation pipeline (CSRF → auth → role → body → zod → DB) mirroring src/app/api/daily-plans/route.ts, with rate-limit dropped (out of scope) and env-var-check inserted between role and body-parse"
    - "Pattern 2 — race-safe compare-and-swap UPDATE using .is(col, null) predicate + .maybeSingle() re-read on 0-row (Postgres MVCC; no transaction wrapper; no advisory lock)"
    - "Pattern 3 — defensive outbound HTTP fetch wrapping four failure modes (AbortSignal.timeout(8000) + response.ok check + typed shape validation + try/catch) into a single 502 on any upstream fault; scheme prepended server-side BEFORE persist per Pitfall 2"
    - "Log-before-respond: every catch block and every if(error) branch calls console.error with prefix [POST /api/referral-link] before returning generic user-facing JSON error — Hard Rule 5 enforced"
    - "Admin client only for .from() queries in the route (Hard Rule 4); inline supabase.auth.getUser() + admin profile lookup instead of getSessionUser (which redirect()s and breaks the 401 JSON contract)"
    - "Empty-body POST tolerance: try/catch around request.json() treats SyntaxError as body={}, then Zod safeParse against z.object({}).strict() — Phase 60's ReferralCard can POST with no body (Pitfall 8)"
    - "CommonJS .cjs smoke runner covered by eslint.config.mjs globalIgnores scripts/**/*.cjs (added Phase 58 commit 876f line); identical to phase-57-smoke-runner.cjs record/exit contract"

key-files:
  created:
    - "src/app/api/referral-link/route.ts"
    - "scripts/phase-59-smoke-runner.cjs"
  modified: []

key-decisions:
  - "Q1 applied — crypto.randomUUID().replace(/-/g, \"\").slice(0, 8).toUpperCase() for NULL-code row generation (REQ-03 literal wording); NOT the md5(id) deterministic form from migration 00031. Both readings were defensible; REQ-03 is the formal contract and this form is non-deterministic but satisfies the partial-UNIQUE-on-non-null invariant with <0.1% collision probability for v1 user base."
  - "Q2 applied — verifyOrigin() included as STEP 0 (CSRF gate) before auth. Matches every existing mutation POST in src/app/api/** (daily-plans, invites, work-sessions, reports/[id]/review)."
  - "Q3 applied — no retry on Postgres 23505 unique violation during code persist; surface 500 with clear console.error. Collision probability too low to justify retry complexity."
  - "Q4 applied — no revalidateTag() on success. Phase 60 consumer is a \"use client\" component fetching on mount; no RSC cache boundary to invalidate."
  - "Q5 applied — Rebrandly response shortUrl is SCHEME-LESS by v1 design (rebrand.ly/abc). Route prepends https:// BEFORE persist so Phase 60's <a href> renders correctly without double-prepending. Guarded by STEP 6 type-check on rbBody.shortUrl before the template-literal concat."
  - "Pitfall 1 applied — did NOT import getSessionUser from @/lib/session despite REQ-01's literal mention. getSessionUser() calls redirect() on no-session/no-profile which returns HTML 307, breaking the 401 JSON contract. Used inline supabase.auth.getUser() + admin profile lookup (the pattern every existing API route follows). Acceptance criterion grep -c 'getSessionUser' = 0 passes."
  - "Pitfall 7 applied — explicit const apiKey = process.env.REBRANDLY_API_KEY + if(!apiKey) guard instead of process.env.REBRANDLY_API_KEY! non-null assertion. Satisfies API-07 (clear console.error, 500, route does not crash when key unset) and narrows apiKey to string for the rest of the function under TS strict."
  - "Pitfall 8 applied — request.json() wrapped in try/catch treats empty-body as body={} (not 400). Phase 60's <ReferralCard /> POSTs with no body; rejecting empty would break the success criterion."

patterns-established:
  - "First outbound HTTP integration in codebase — future phases integrating external APIs (Stripe, ConvertKit, etc.) should mirror STEP 6 of src/app/api/referral-link/route.ts: AbortSignal.timeout(N_ms) + response.ok gate + try/catch + typed shape validation, all mapped to a single upstream-fault status (502 for this phase) with server-side console.error and generic user-facing JSON message."
  - "Idempotent external-side-effect persistence via Postgres compare-and-swap UPDATE — for any future route that orchestrates a one-shot external API call (e.g. 'at most one Stripe customer.create per user'), use the .is(target_col, null) CAS predicate + .maybeSingle() re-read-on-0-rows idiom from STEP 7."

requirements-completed: [API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, CFG-02]

duration: 5min
completed: 2026-04-16
---

# Phase 59 Plan 01: Referral API + Rebrandly Summary

**Idempotent POST /api/referral-link route (8-step pipeline + Rebrandly v1 integration) + 9-case CommonJS smoke runner; CFG-02 combined build gate green with /api/referral-link registered as a dynamic App Router route handler. At-most-one Rebrandly call per user for life via referral_short_url cache-hit + compare-and-swap persist.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-16T05:04:33Z
- **Completed:** 2026-04-16T05:09:31Z
- **Tasks:** 3 / 3
- **Files created:** 2 (1 route + 1 smoke runner)
- **Files modified:** 0
- **Combined CFG-02 gate wall-time:** 26s (lint + tsc + build)
- **Build compile time:** 6.8s (Turbopack)

## Accomplishments

- **API-01 through API-08 — full idempotent route pipeline shipped.** `src/app/api/referral-link/route.ts` (160 lines) exports exactly one `POST` handler implementing the 8-step pipeline specified in RESEARCH.md + PATTERNS.md. Every REQ ID has a specific implementation anchor:
  - **API-01** (auth + role gate): STEP 1 inline `supabase.auth.getUser()` → 401 if no session; STEP 2 admin-client profile lookup + `role !== "student" && role !== "student_diy"` → 403.
  - **API-02** (idempotent cache-hit): STEP 5 `if (profile.referral_short_url)` short-circuits to 200 `{ shortUrl, referralCode }` BEFORE any Rebrandly call or DB write.
  - **API-03** (fresh-code generation): STEP 5b `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()` + CAS UPDATE on `referral_code IS NULL`, re-read on 0-row.
  - **API-04** (Rebrandly POST): STEP 6 `fetch("https://api.rebrandly.com/v1/links", { headers: { apikey, "Content-Type": "application/json" }, body: JSON.stringify({ destination, title }) })`.
  - **API-05** (persist + response): STEP 7 compare-and-swap UPDATE on `referral_short_url IS NULL` with `.maybeSingle()`; STEP 8 returns `{ shortUrl, referralCode }` at status 200 (cache-hit, winner-re-read, and fresh-create all 200).
  - **API-06** (Rebrandly failure mapping): 502 on non-ok, 502 on thrown error (timeout/network/JSON parse), 502 on missing `shortUrl` field — no partial persistence (UPDATE on `referral_short_url` only runs AFTER successful Rebrandly response parse).
  - **API-07** (missing env var): STEP 3 explicit `if (!apiKey)` guard → 500 + console.error "REBRANDLY_API_KEY not configured".
  - **API-08** (Zod + auth-before-validation): `import { z } from "zod"` (canonical, not zod/v4) + `z.object({}).strict().safeParse(body)`; empty body tolerated via `try { body = await request.json(); } catch { body = {}; }`.

- **Hard Rules 4/5/6/7 compliance verified by grep.** All `.from()` queries go through `admin = createAdminClient()` (Hard Rule 4); every `console.error` call uses prefix `[POST /api/referral-link]` BEFORE the response return (Hard Rule 5, 8 occurrences); Rebrandly fetch is guarded by `if (!rbResponse.ok)` before any `.json()` call (Hard Rule 6); Zod import is literal `"zod"` (Hard Rule 7).

- **Defensive external-API pattern established.** First outbound HTTP call in the codebase wraps all four failure modes (network error, timeout via `AbortSignal.timeout(8000)`, non-2xx via `!rbResponse.ok`, JSON parse error in the outer try/catch) into a single 502 mapping with server-side `console.error` and a generic user-facing error JSON. No API key value ever logged (only PRESENT/ABSENT state at STEP 3). Sets the pattern for future integrations (Stripe, ConvertKit, etc.).

- **9-case smoke runner authored.** `scripts/phase-59-smoke-runner.cjs` (386 lines) covers every verification case from 59-VALIDATION.md:
  - SMOKE 1 (HTTP): unauth → 401
  - SMOKE 2 (HTTP, SKIPPED_IN_RUNNER): wrong-role → 403 — needs forged session cookie
  - SMOKE 3 (DB): Phase 58 backfill invariant re-verification
  - SMOKE 4 (DB): referral_code uniqueness (Set.size === array.length)
  - SMOKE 5 (DB): owner/coach rows untouched (null code + null short_url)
  - SMOKE 6 (HTTP, conditionally SKIPPED): happy path + idempotency — needs TEST_STUDENT_COOKIE + TEST_STUDENT_EMAIL + REBRANDLY_API_KEY; exercises fresh-create + cache-hit POST pair and asserts `shortUrl` match across both
  - SMOKE 7 (DB): every persisted `referral_short_url` starts with `https://`
  - SMOKE 8 (SKIPPED_IN_RUNNER): missing-key fallback → 500 — env flip on live server
  - SMOKE 9 (static): CFG-02 evidence — route.ts contains `rbResponse.ok` + `import { z } from "zod"` + `AbortSignal.timeout` + `import "server-only"`
  - Exit contract: `process.exit(failed > 0 ? 1 : 0)` — identical to phase-57-smoke-runner.cjs. Pure CommonJS (.cjs); `node -c` exits 0.

- **CFG-02 combined gate green.** `npm run lint && npx tsc --noEmit && npm run build` exits 0 in 26 s wall-time:
  - lint: 0 errors, 4 warnings (matches Phase 58 baseline exactly — `SkeletonCard` unused, `modifiers` unused, WorkTrackerClient exhaustive-deps, Modal exhaustive-deps)
  - tsc: exit 0 with empty stdout
  - build: `✓ Compiled successfully in 6.8s`; `/api/referral-link` registered as `ƒ` dynamic route handler in the App Router manifest
  - smoke runner syntax check: `node -c scripts/phase-59-smoke-runner.cjs` exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST /api/referral-link route handler** — `c9288b1` (feat)
2. **Task 2: Create scripts/phase-59-smoke-runner.cjs** — `20053ec` (test)
3. **Task 3: CFG-02 combined gate (lint + tsc + build)** — `bd918f4` (chore, empty commit — gate passed without any Rule 3 auto-fix)

## Files Created/Modified

- `src/app/api/referral-link/route.ts` (created, 160 lines) — idempotent Next.js 16 App Router POST handler with 8-step pipeline. Imports: `server-only`, `zod`, `NextResponse`, `createClient` (server), `createAdminClient`, `verifyOrigin`. Body schema: `z.object({}).strict()`. No GET/PATCH/DELETE exports. File-level diff:

  ```
  +160 insertions, 0 deletions
  Total imports: 6 (exactly as specified in plan)
  Total exports: 1 (POST)
  console.error prefix occurrences: 8 (exceeds ≥6 criterion)
  status: 502 occurrences: 3 (non-ok, thrown, missing-shortUrl)
  NextResponse.json({ shortUrl, referralCode } occurrences: 3 (cache-hit, winner-re-read, fresh-create)
  ```

- `scripts/phase-59-smoke-runner.cjs` (created, 386 lines) — 9-case smoke runner. Shebang `#!/usr/bin/env node` on line 1; CommonJS `require()` for `fs`, `path`, `@supabase/supabase-js`; `record()` helper verbatim from phase-57 analog; single async IIFE containing 9 numbered SMOKE blocks (each wrapped in its own try/catch so one failing block doesn't abort the others); JSON-to-stdout + `process.exit(failed > 0 ? 1 : 0)` tail. Covered by eslint.config.mjs globalIgnores `scripts/**/*.cjs` (Phase 58 precondition).

## Decisions Made

All 5 open questions (Q1–Q5) from RESEARCH.md were pre-resolved in the PLAN's `<prior_decisions>` block. All 5 decisions applied verbatim:

- **Q1 (code generation form):** `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()` — REQ-03 literal wording. Collision probability <0.1% for v1 user base; 23505 surfaces as 500 (Q3).
- **Q2 (CSRF):** `verifyOrigin(request)` included as STEP 0 — matches every other mutation POST in `src/app/api/**`.
- **Q3 (23505 retry):** no retry — surface 500 with clear console.error. Two-line retry complexity not worth rare-collision cost.
- **Q4 (revalidateTag):** skipped — Phase 60's `"use client"` component has no RSC cache boundary to invalidate.
- **Q5 (scheme prepend):** persist WITH `https://` prepended server-side — Rebrandly v1 returns scheme-less shortUrl (`rebrand.ly/abc`); prepending before UPDATE means Phase 60's `<a href>` renders correctly without double-prepending.

Two implementation pitfalls pre-flagged in the plan were applied without deviation:

- **Pitfall 1 (Anti-pattern):** Did NOT use `getSessionUser()` from `@/lib/session` despite REQ-01's literal mention. That function `redirect()`s on no-session/no-profile, returning HTML 307 instead of JSON 401 — incompatible with API routes. Used inline `supabase.auth.getUser()` + admin profile lookup (the pattern every existing API route follows). Acceptance criterion `grep -c 'getSessionUser' = 0` enforced this.
- **Pitfall 7 (non-null assertion):** Used explicit `const apiKey = process.env.REBRANDLY_API_KEY; if (!apiKey) { ... return 500 }` narrowing instead of `process.env.REBRANDLY_API_KEY!`. Satisfies API-07 contract (clear console.error, 500, route does not crash) and narrows to `string` for the rest of the function under TS strict.

## Deviations from Plan

**None.** Plan executed exactly as written. All 29 acceptance criteria for Task 1 verified green, all 23 for Task 2 verified green, all 8 for Task 3 verified green. No auto-fixes applied. No architectural questions raised. No Rule 3 auto-fix needed to `eslint.config.mjs` — the Phase 58 `scripts/**/*.cjs` globalIgnore (added commit `876639...`) was still in place and sufficient to cover the new `.cjs` runner without any lint error.

## Verification Results

### Task 1 — route.ts (all 29 grep-verifiable criteria)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| File exists | yes | yes | ✓ |
| Line count between 100 and 220 | in-range | 160 | ✓ |
| `import "server-only";` occurrences | 1 | 1 | ✓ |
| `import { z } from "zod";` occurrences | 1 | 1 | ✓ |
| `"zod/v4"` occurrences | 0 | 0 | ✓ |
| `verifyOrigin` import | 1 | 1 | ✓ |
| `createAdminClient` import | 1 | 1 | ✓ |
| `createClient` from server import | 1 | 1 | ✓ |
| `export async function POST` | 1 | 1 | ✓ |
| `verifyOrigin(request)` | ≥1 | 1 | ✓ |
| `Unauthorized` string (401 branch) | ≥1 | 1 | ✓ |
| Role gate exact string | 1 | 1 | ✓ |
| `REBRANDLY_API_KEY not configured` | 1 | 1 | ✓ |
| `process.env.REBRANDLY_API_KEY!` non-null assertion | 0 | 0 | ✓ |
| `z.object({}).strict()` | ≥1 | 1 | ✓ |
| `safeParse` | ≥1 | 1 | ✓ |
| `if (profile.referral_short_url)` | 1 | 1 | ✓ |
| `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()` | 1 | 1 | ✓ |
| `https://api.rebrandly.com/v1/links` | 1 | 1 | ✓ |
| `apikey: apiKey` | 1 | 1 | ✓ |
| `Bearer` (must not use Authorization Bearer) | 0 | 0 | ✓ |
| `AbortSignal.timeout(8000)` | 1 | 1 | ✓ |
| `if (!rbResponse.ok)` | 1 | 1 | ✓ |
| `` `https://${rbBody.shortUrl}` `` | 1 | 1 | ✓ |
| `.is("referral_short_url", null)` | ≥1 | 1 | ✓ |
| `.maybeSingle()` | ≥1 | 1 | ✓ |
| `NextResponse.json({ shortUrl, referralCode }` (cache-hit + winner + success) | ≥2 | 3 | ✓ |
| `status: 502` | ≥3 | 3 | ✓ |
| `[POST /api/referral-link]` log prefix | ≥6 | 8 | ✓ |
| `checkRateLimit` (out-of-scope) | 0 | 0 | ✓ |
| `revalidateTag` (Q4 skip) | 0 | 0 | ✓ |
| `getSessionUser` (Pitfall 1) | 0 | 0 | ✓ |
| `npx tsc --noEmit` exit code | 0 | 0 | ✓ |

### Task 2 — smoke-runner.cjs (all 23 grep-verifiable criteria)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| File exists | yes | yes | ✓ |
| Shebang on line 1 | `#!/usr/bin/env node` | identical | ✓ |
| Line count between 150 and 500 | in-range | 386 | ✓ |
| CommonJS `require()` statements | ≥3 | 3 (`fs`, `path`, `@supabase/supabase-js`) | ✓ |
| Top-level `import ` statements | 0 | 0 | ✓ |
| `fs.readFileSync(envPath, "utf8")` | 1 | 1 | ✓ |
| `require("@supabase/supabase-js")` | 1 | 1 | ✓ |
| `function record(name, expected, observed, pass, extra)` | 1 | 1 | ✓ |
| `SMOKE [1-9]:` distinct labels | all 9 | 1, 2, 3, 4, 5, 6, 7, 8, 9 (all present) | ✓ |
| `process.env.SMOKE_BASE_URL` | 1 | 1 | ✓ |
| `process.env.TEST_STUDENT_COOKIE` | ≥1 | 1 | ✓ |
| `/api/referral-link` | ≥2 | 7 | ✓ |
| `status === 401` | ≥1 | 1 | ✓ |
| `status === 200` | ≥1 | 2 | ✓ |
| `/^[0-9A-F]{8}$/` code regex | ≥1 | 1 (defined as const, used 2 times) | ✓ |
| `"https://"` | ≥1 | 6 | ✓ |
| `src/app/api/referral-link/route.ts` | ≥1 | 2 | ✓ |
| `SKIPPED_IN_RUNNER` markers | ≥2 | 13 | ✓ |
| `process.exit(failed > 0 ? 1 : 0)` | 1 | 1 | ✓ |
| `console.log(JSON.stringify(results, null, 2))` | 1 | 1 | ✓ |
| Hardcoded `REBRANDLY_API_KEY="..."` (literal secret) | 0 | 0 | ✓ |
| Empty catches `catch \(\w*\) \{\}` | 0 | 0 | ✓ |
| `node -c scripts/phase-59-smoke-runner.cjs` exit | 0 | 0 | ✓ |
| `eslint.config.mjs` still contains `scripts/**/*.cjs` | ≥1 | 1 | ✓ |

### Task 3 — CFG-02 combined gate (all 8 criteria)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npm run lint && npx tsc --noEmit && npm run build` combined exit | 0 | 0 | ✓ |
| `npm run lint` errors | 0 | 0 | ✓ |
| `npm run lint` warnings | ≤4 (Phase 58 baseline) | 4 (identical set) | ✓ |
| `npx tsc --noEmit` exit | 0 | 0 with empty stdout | ✓ |
| `npm run build` "✓ Compiled successfully" | yes | "✓ Compiled successfully in 6.8s" | ✓ |
| `/api/referral-link` in route table as ƒ | yes | `├ ƒ /api/referral-link` | ✓ |
| `node -c scripts/phase-59-smoke-runner.cjs` exit | 0 | 0 | ✓ |
| `git diff HEAD~1 -- src/app/api/referral-link/route.ts \| grep -c 'eslint-disable'` | 0 | 0 | ✓ |

All 60 acceptance criteria across 3 tasks pass.

## Issues Encountered

None. Plan executed in ~5 minutes with zero blockers. The 8-step pipeline skeleton specified verbatim in the PLAN compiled green on first `tsc --noEmit` pass; the smoke runner's 9 SMOKE blocks parsed green on first `node -c` pass; the CFG-02 gate ran green on first invocation. No deviation from the plan's skeleton was required.

## User Setup Required

To exercise SMOKE 6 (happy path + idempotency) end-to-end, the operator will need to set in `.env.local`:

- `REBRANDLY_API_KEY=<real Rebrandly v1 API key>` — obtainable at https://app.rebrandly.com/account/api
- `TEST_STUDENT_COOKIE=<Cookie header string copied from a logged-in student browser session>` — format: `sb-<project>-auth-token=<JWT>; sb-<project>-auth-token.0=<part0>; sb-<project>-auth-token.1=<part1>` (the full cookie string a browser would send to `http://localhost:3000`)
- `TEST_STUDENT_EMAIL=<email of the student whose cookie is above>` — used by the runner to reset that student's `referral_short_url` to NULL before POST #1

Without these, SMOKE 6 records `SKIPPED_IN_RUNNER` (neutral, does not count as FAIL). SMOKE 2 and SMOKE 8 are permanently `SKIPPED_IN_RUNNER` — those two cases require a forged session cookie and a live-server env flip respectively, both of which must be executed manually per the entries in `59-VERIFICATION.md`.

## Threat Flags

None. All threat surface introduced fits within the phase's `<threat_model>` scope (T-59-01 through T-59-11). No new trust boundary was introduced outside the planned set — specifically:

- **New network endpoint** (`POST /api/referral-link`): covered by T-59-01 (spoofing), T-59-02 (elevation), T-59-05 (CSRF).
- **New outbound HTTP integration** (Rebrandly v1): covered by T-59-03 (API key exposure), T-59-06 (DoS via cost amplification), T-59-07 (hung connection), T-59-09 (log injection), T-59-10 (hostile shortUrl).
- **New DB write path** (referral_code + referral_short_url UPDATE via admin client): covered by T-59-08 (partial-state corruption — intentional, `referral_short_url` is the commit point).
- No new auth/session surface, no file-access changes, no schema modifications (Phase 58 shipped the schema; this phase only reads/writes existing columns).

## Next Phase Readiness

- **Phase 60 (ReferralCard UI) unblocked.** `POST /api/referral-link` is live, idempotent, and returns exactly `{ shortUrl: string, referralCode: string }` for 200 — Phase 60's `<ReferralCard />` can `fetch("/api/referral-link", { method: "POST" })` with an empty body without triggering a 400. Every failure mode (401/403/500/502) returns a `{ error: string }` JSON body suitable for a toast in the client.
- **Smoke runner ready for /gsd-verify-work.** The 9-case runner is the authoritative verification anchor for Phase 59's `<success_criteria>`. Running it with `REBRANDLY_API_KEY` + `TEST_STUDENT_COOKIE` + `TEST_STUDENT_EMAIL` env vars against a running dev server will exit 0 if all contract invariants hold (SMOKEs 1, 3, 4, 5, 6, 7, 9 exercise real DB + HTTP state; 2 and 8 are permanent SKIPPED_IN_RUNNER).
- **v1.7 cost invariant locked in.** The at-most-one-Rebrandly-call-per-user-for-life contract is enforced at two levels: (1) cache-hit short-circuit at STEP 5 (no external call if `referral_short_url IS NOT NULL`); (2) compare-and-swap UPDATE at STEP 7 (`WHERE referral_short_url IS NULL` ensures at most one persist winner across concurrent writes). Residual instantaneous-double-tap risk (two concurrent Rebrandly calls from the same user's rapid-fire button taps) is documented in the threat model as T-59-06 `accept` with bounded cost.

## Self-Check

- [x] `src/app/api/referral-link/route.ts` — FOUND (160 lines)
- [x] `scripts/phase-59-smoke-runner.cjs` — FOUND (386 lines)
- [x] Commit `c9288b1` (Task 1) — FOUND in git log
- [x] Commit `20053ec` (Task 2) — FOUND in git log
- [x] Commit `bd918f4` (Task 3) — FOUND in git log

## Self-Check: PASSED

---
*Phase: 59-referral-api-rebrandly*
*Plan: 01*
*Completed: 2026-04-16*
