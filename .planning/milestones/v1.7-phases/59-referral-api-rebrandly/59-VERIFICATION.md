---
phase: 59-referral-api-rebrandly
verified: 2026-04-16T00:00:00Z
status: human_needed
score: 6/6 must-haves code-verified (1 success criterion requires human runtime confirmation)
overrides_applied: 0
human_verification:
  - test: "SMOKE 1 unauthenticated POST → 401 against running dev server"
    expected: "POST http://localhost:3000/api/referral-link with no auth cookie returns HTTP 401 and DB rows for student/student_diy users are unchanged (referral_short_url still NULL on test student)"
    why_human: "Requires dev server running on :3000; smoke runner block is present and correct but cannot self-host the server"
  - test: "SMOKE 2 owner/coach POST → 403 (manual)"
    expected: "POST with a real owner or coach session cookie returns HTTP 403; user.referral_code and user.referral_short_url remain NULL after the call"
    why_human: "Smoke runner records this as SKIPPED_IN_RUNNER — needs a real session cookie that the runner cannot forge. Code-level evidence (line 37 role gate) confirms the 403 path exists."
  - test: "SMOKE 6 happy path + idempotency end-to-end"
    expected: "With REBRANDLY_API_KEY + TEST_STUDENT_COOKIE + TEST_STUDENT_EMAIL set, POST #1 returns 200 with valid {shortUrl, referralCode}, shortUrl starts with https://, referralCode matches /^[0-9A-F]{8}$/; POST #2 returns identical shortUrl + referralCode (zero new Rebrandly calls). After both POSTs, the persisted referral_short_url in public.users matches body1.shortUrl exactly."
    why_human: "Requires a live Rebrandly API key, a real student session cookie, and a running dev server. Runner block is gated on these env vars and otherwise records SKIPPED_IN_RUNNER. This is the only end-to-end exercise of the at-most-one-Rebrandly-call invariant against the live vendor."
  - test: "SMOKE 8 missing-key fallback → 500"
    expected: "With REBRANDLY_API_KEY unset in .env.local and dev server restarted, POST returns HTTP 500 with body {error: 'Server misconfigured'}, console.error logs '[POST /api/referral-link] REBRANDLY_API_KEY not configured', and the dashboard at /dashboard continues to load without crashing"
    why_human: "Requires stopping dev server, mutating .env.local, restarting — runner cannot flip env vars on a live process. Code-level evidence (lines 42-46) confirms the 500 + log path is wired correctly."
  - test: "Rebrandly link resolves correctly when visited (per 59-VALIDATION.md Manual-Only)"
    expected: "Pasting the shortUrl from a successful POST into a browser redirects to https://www.imaccelerator.com/?ref={CODE} with the referral_code preserved"
    why_human: "Requires live click in browser against the third-party Rebrandly redirect — cannot be verified by static analysis or local fetch"
  - test: "Rebrandly dashboard shows exactly one link per user (per 59-VALIDATION.md Manual-Only)"
    expected: "After running smoke suite for N users, count of links in Rebrandly dashboard equals N (no duplicates)"
    why_human: "Requires logging into Rebrandly web UI; only way to confirm the at-most-one-call cost invariant against the vendor side"
---

# Phase 59: Referral API + Rebrandly Verification Report

**Phase Goal:** Any authenticated student or student_diy user can `POST /api/referral-link` and receive an idempotent JSON `{ shortUrl, referralCode }` — Rebrandly is called at most once per user for life, and every documented failure mode (auth, role, missing key, Rebrandly outage, DB error) returns a stable HTTP status without corrupting state.

**Verified:** 2026-04-16
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Goal-backward verification: I asked "what must be TRUE for the goal to hold, what must EXIST, what must be WIRED, and what data must FLOW?" and verified each level against the codebase rather than the SUMMARY claims. All code-level must-haves verify cleanly. The goal is achieved at the code-level, but five behaviors require live execution (dev server + real session cookie + live Rebrandly API + browser click) that cannot be verified by static analysis. Those are routed to `human_verification`.

### Observable Truths (Roadmap Success Criteria)

These are the 6 Success Criteria from `.planning/ROADMAP.md` Phase 59. They are the contract — verified individually below.

| #   | Truth (Roadmap SC)                                                                                          | Status      | Evidence                                                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Unauth POST → 401; owner/coach POST → 403; neither path touches DB or Rebrandly                              | VERIFIED    | route.ts L13-14 (verifyOrigin), L17-23 (auth → 401 BEFORE any admin query), L37-39 (role gate → 403 BEFORE Rebrandly call at L94). Both error branches return before the env-var guard, body parse, cache-hit, code-persist, or Rebrandly fetch. Smoke SMOKE 1 + SMOKE 2 cover these.                                          |
| 2   | First POST → 200 {shortUrl, referralCode}; second+ POST → same shortUrl, zero new Rebrandly calls           | VERIFIED    | route.ts L61-66 cache-hit short-circuit returns 200 with persisted profile.referral_short_url WITHOUT entering STEP 6 (Rebrandly fetch). STEP 7 CAS-update on `.is("referral_short_url", null)` (L132) ensures only the first writer can set it. Live end-to-end exercise routed to `human_verification` (SMOKE 6).             |
| 3   | NULL-code user receives freshly generated 8-char code persisted to public.users BEFORE Rebrandly is called  | VERIFIED    | route.ts L69-89: STEP 5b runs only if profile.referral_code is null; generates via `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()` (L71); persists with CAS UPDATE on `referral_code IS NULL` (L72-76); Rebrandly fetch at L94 happens AFTER. Re-read at L83-88 handles concurrent writers.                  |
| 4   | REBRANDLY_API_KEY unset → 500 + dashboard loads; Rebrandly non-OK/throw/timeout → 502, no partial persist   | VERIFIED    | route.ts L42-46: explicit `if (!apiKey)` → 500 + console.error "REBRANDLY_API_KEY not configured" (no `process.env.X!` non-null assertion). 502 paths at L111 (non-ok), L116 (catch), L121 (missing shortUrl). STEP 7 CAS-persist (L128-134) only runs after successful Rebrandly parse — referral_short_url stays NULL on any 502 path. |
| 5   | Standard pipeline order: auth + role BEFORE Zod safeParse; admin client for all DB; response.ok before parse; `import { z } from "zod"` | VERIFIED (with one wording deviation) | Auth (L17) → role (L37) → env (L42) → body parse (L51) → safeParse (L55) — order correct. Admin client used for every `.from()` (L27, L73, L83, L129, L143). `if (!rbResponse.ok)` at L103 BEFORE `await rbResponse.json()` at L113. `import { z } from "zod"` literal at L2. **Wording deviation:** Roadmap SC mentions `getSessionUser()`; route uses inline `supabase.auth.getUser()` + admin profile lookup. This is documented in PLAN prior_decisions Pitfall 1 + REQUIREMENTS API-01 (which uses the same `getSessionUser()` wording). The deviation is intentional — `getSessionUser()` calls `redirect()` which returns HTML 307 instead of JSON 401, breaking the contract. Inline pattern matches every other API route. Functional intent (auth-before-validation) is preserved. |
| 6   | Build gate `npm run lint && npx tsc --noEmit && npm run build` exits 0                                       | VERIFIED    | `npx tsc --noEmit` re-run during this verification → exit 0, empty stdout. `.next/server/app/api/referral-link/route.js` exists in build artifacts (route compiled into App Router manifest). SUMMARY records 26s wall-time, 0 errors, 4 warnings (matches Phase 58 baseline). Commit `bd918f4` recorded the green gate.        |

**Score:** 6/6 Roadmap Success Criteria code-verified. SC2 + SC4 + SC5 have manual-execution sub-checks routed to `human_verification`.

### Required Artifacts

Three-level verification per artifact (exists / substantive / wired). Level 4 data-flow not applicable — this is a server-only API route + smoke runner; data flows into Rebrandly + DB and out as JSON, not into a rendered UI.

| Artifact                                  | Expected                                                                                                | Exists | Substantive (lines/patterns)                | Wired                                              | Status   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------- | -------------------------------------------------- | -------- |
| `src/app/api/referral-link/route.ts`      | Single POST export, 8-step pipeline (CSRF→auth→role→env→body→cache→code→Rebrandly→CAS→200)              | yes    | 163 lines (within 100-220), all 29 grep AC pass per SUMMARY; re-confirmed 8 console.error + 8 [POST /api/referral-link] prefix | Imports + uses csrf.ts, server.ts, admin.ts (all 3 dependency files exist at expected paths); route registered in `.next/server/app/api/referral-link/` build output | VERIFIED |
| `scripts/phase-59-smoke-runner.cjs`       | 9 SMOKE blocks, CommonJS, exits non-zero on any FAIL                                                    | yes    | 425 lines (within 150-500), all 9 SMOKE blocks present with try/catch isolation, exit contract `process.exit(failed > 0 ? 1 : 0)` at L424, snapshot/restore for SMOKE 6 at L274/L325-343 | `node -c` exits 0 (re-verified during this run); covered by eslint.config.mjs `scripts/**/*.cjs` ignore (grep confirmed) | VERIFIED |

### Key Link Verification

`gsd-tools verify key-links` reported all 6 links as "not found" but this is a tool bug (regex escape handling in patterns containing `\(` — the patterns ARE present in the file). I re-verified each link manually with Grep below.

| From                                  | To                                              | Via                                                          | Pattern                                | Status   | Evidence                                                          |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | -------------------------------------- | -------- | ----------------------------------------------------------------- |
| route.ts                              | src/lib/csrf.ts                                 | `import { verifyOrigin } from "@/lib/csrf"`                  | `verifyOrigin(request)`                | WIRED    | route.ts L6 (import) + L13 (call); csrf.ts file exists           |
| route.ts                              | src/lib/supabase/server.ts                      | `import { createClient } from "@/lib/supabase/server"`       | `supabase.auth.getUser()`              | WIRED    | route.ts L4 (import) + L17-20 (call); server.ts file exists      |
| route.ts                              | src/lib/supabase/admin.ts                       | `import { createAdminClient } from "@/lib/supabase/admin"`   | `createAdminClient()`                  | WIRED    | route.ts L5 (import) + L26 (call); admin.ts file exists          |
| route.ts                              | public.users.referral_code + referral_short_url | admin.from("users").select + .update CAS                     | `.is("referral_short_url", null)`      | WIRED    | route.ts L132 (CAS persist) + L29 (select) + L74 (update code) + L130 (update short_url); 9 references to `referral_short_url` in file |
| route.ts                              | https://api.rebrandly.com/v1/links              | fetch(url, { headers: { apikey, ... } })                     | `api.rebrandly.com/v1/links`           | WIRED    | route.ts L94 (fetch URL) + L96 (apikey header — NOT Bearer)      |
| scripts/phase-59-smoke-runner.cjs     | POST /api/referral-link                         | fetch() with test cookies / admin client seeding             | `/api/referral-link`                   | WIRED    | runner L78, L284, L295, L398; 7 references total; admin seeding via supabase-js client at L58 |

All 6 key links verified manually present and substantive.

### Behavioral Spot-Checks

| Behavior                                          | Command                                                  | Result                                                                                                  | Status |
| ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------ |
| TypeScript strict pass                            | `npx tsc --noEmit`                                       | exit 0, empty stdout (re-run during this verification)                                                 | PASS   |
| Smoke runner CommonJS parses                      | `node -c scripts/phase-59-smoke-runner.cjs`              | exit 0, prints `SYNTAX_OK` (re-run during this verification)                                           | PASS   |
| Route compiled into Next.js App Router manifest   | `ls .next/server/app/api/referral-link/`                 | route, route.js, route.js.map, route.js.nft.json, route_client-reference-manifest.js — all present     | PASS   |
| Route in routes-manifest                          | `grep "/api/referral-link" .next/routes-manifest.json`   | found                                                                                                   | PASS   |
| eslint .cjs ignore still in place                 | `grep "scripts/\*\*/\*.cjs" eslint.config.mjs`           | 1 match — Phase 58 precondition still holds                                                            | PASS   |
| REBRANDLY_API_KEY documented in env example       | `grep REBRANDLY_API_KEY .env.local.example`              | L12: `REBRANDLY_API_KEY=` (empty value, onboarding placeholder)                                        | PASS   |
| Live HTTP smoke against dev server                | `node scripts/phase-59-smoke-runner.cjs`                 | not executed — would require running `npm run dev` first; smoke runner block exists and is correct      | SKIP (requires server) |

### Requirements Coverage

| Requirement | Source Plan | Description (REQUIREMENTS.md)                                                                                                                                | Status    | Evidence                                                                                                                                  |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| API-01      | 59-01       | POST /api/referral-link authenticates via getSessionUser(), rejects non-student/student_diy with 403, unauth with 401                                        | SATISFIED | route.ts L17-23 (401), L37-39 (403). Wording deviation on getSessionUser → inline supabase.auth.getUser() documented in PLAN Pitfall 1; functional intent preserved |
| API-02      | 59-01       | Loads referral_code + referral_short_url via admin client; if short_url set, return immediately — no Rebrandly call                                          | SATISFIED | route.ts L26-31 (admin profile load with widened SELECT), L61-66 (cache-hit short-circuit BEFORE STEP 6)                                  |
| API-03      | 59-01       | If referral_code NULL at request time, generate `upper(uuid.slice(0, 8))` and persist BEFORE Rebrandly                                                       | SATISFIED | route.ts L69-89: gen via crypto.randomUUID() (L71), CAS persist (L72-76), re-read for race (L83-88). All BEFORE STEP 6 fetch at L94.       |
| API-04      | 59-01       | POST to https://api.rebrandly.com/v1/links with apikey header + Content-Type JSON + body {destination, title}; check response.ok before parse (Hard Rule 6)  | SATISFIED | route.ts L94-102 (fetch), L96 (apikey header — not Bearer), L97-100 (body), L103 (response.ok check) BEFORE L113 (json parse)             |
| API-05      | 59-01       | Persist returned shortUrl into public.users.referral_short_url; respond {shortUrl, referralCode}                                                             | SATISFIED | route.ts L125 (scheme prepend), L128-134 (CAS persist via .is(...,null) + .maybeSingle()), L162 (success response shape)                  |
| API-06      | 59-01       | Rebrandly failures (non-OK/throw/timeout) → 502 + console.error + no partial persistence (never persists partial row); Hard Rule 5 observed                  | SATISFIED | route.ts L103-117 (non-OK/catch both → 502 + console.error), L119-122 (missing shortUrl → 502). CAS persist (L128) only runs on success path. AbortSignal.timeout(8000) at L101. |
| API-07      | 59-01       | Missing REBRANDLY_API_KEY → 500 + clear console.error; route does not crash, dashboard continues to load                                                     | SATISFIED | route.ts L42-46: explicit `const apiKey = ...; if (!apiKey)` (no non-null assertion), 500 + console.error "REBRANDLY_API_KEY not configured" |
| API-08      | 59-01       | Body parsed with Zod safeParse + `import { z } from "zod"` (Hard Rule 7); auth+role check runs BEFORE validation                                             | SATISFIED | route.ts L2 (zod import), L9 (`z.object({}).strict()`), L55 (safeParse). Auth at L17 + role at L37 BOTH run BEFORE safeParse at L55.        |
| CFG-02      | 59-01       | Combined build gate `npm run lint && npx tsc --noEmit && npm run build` exits 0 (cross-cutting per phase)                                                    | SATISFIED | SUMMARY records exit 0 in 26s; commit bd918f4 records green gate; tsc re-run during this verification = exit 0; build artifacts present in `.next/` |

**No orphaned requirements.** REQUIREMENTS.md `Traceability` table maps API-01..08 + CFG-02 exclusively to Phase 59; all 9 are claimed by 59-01-PLAN's `requirements:` field.

### Anti-Patterns Found

Scanned both files (route.ts + smoke-runner.cjs) for stub patterns, hardcoded empty values, swallowed catches, console-only handlers, TODO/FIXME/PLACEHOLDER, return null/empty patterns.

| File                                 | Line | Pattern                                                              | Severity | Impact                                                                                                                                                                                                              |
| ------------------------------------ | ---- | -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| route.ts                             | L52  | `try { body = await request.json(); } catch { body = {}; }`           | Info     | Bare catch with `body = {}` — flagged by reviewer as IN-03. Documented as **intentional** per PLAN Pitfall 8 (empty-body POST is valid; Phase 60 ReferralCard will POST with no body). Comment at L8 explains. Not a defect. |
| route.ts                             | L99  | `title: \`IMA Referral - ${profile.name ?? referralCode}\``            | Info     | Sends user's display name to third-party Rebrandly API as link metadata. Flagged by reviewer as IN-04, deferred pending privacy-policy decision. Not a security defect; not a goal blocker. Tracked in REVIEW-FIX as deferred. |
| route.ts                             | L77  | No retry on 23505 unique-violation during code persist                | Info     | Surfaces 500 with clear console.error. Documented as **intentional** per PLAN prior_decisions Q3. Collision probability <0.1% for v1 user base. Not a defect.                                                       |
| route.ts                             | —    | `process.env.REBRANDLY_API_KEY!` non-null assertion                   | n/a      | Searched for, NOT present (0 matches) — explicit guard pattern at L42-46 instead. Hard Rule compliance.                                                                                                              |
| route.ts                             | —    | Empty/swallowed catches besides L52                                  | n/a      | None. All other catches `console.error` before returning (Hard Rule 5). Counted: 8 `console.error` calls, all with `[POST /api/referral-link]` prefix.                                                              |
| route.ts                             | —    | TODO / FIXME / placeholder comments                                   | n/a      | None.                                                                                                                                                                                                                |
| scripts/phase-59-smoke-runner.cjs    | —    | Empty catches `catch \(\w*\) \{\}`                                    | n/a      | None — every try/catch records a FAIL via the `record()` helper.                                                                                                                                                    |
| scripts/phase-59-smoke-runner.cjs    | —    | Hardcoded REBRANDLY_API_KEY value                                     | n/a      | None — only env-loader reads.                                                                                                                                                                                        |

**No blocker anti-patterns.** Three info items are all explicitly intentional per PLAN prior_decisions or REVIEW-FIX deferred-with-reason.

### Human Verification Required

See YAML frontmatter `human_verification` for the 6 manual checks. Summary:

1. **SMOKE 1 dev-server execution** — runner block correct, just needs `npm run dev` running.
2. **SMOKE 2 owner/coach 403** — needs forged owner/coach session cookie (smoke runner records SKIPPED_IN_RUNNER).
3. **SMOKE 6 happy path + idempotency end-to-end** — needs REBRANDLY_API_KEY + TEST_STUDENT_COOKIE + TEST_STUDENT_EMAIL + dev server. Runner block is gated correctly and includes snapshot/restore (WR-02 fix).
4. **SMOKE 8 missing-key fallback** — needs env flip + dev server restart.
5. **Rebrandly link resolves in browser** — per 59-VALIDATION.md Manual-Only.
6. **Rebrandly dashboard one-link-per-user count** — per 59-VALIDATION.md Manual-Only; this is the only way to confirm the at-most-one-call cost invariant against the vendor side.

### Gaps Summary

**No code-level gaps.** All 6 Roadmap Success Criteria, all 2 artifacts (3-level), all 6 key links, and all 9 requirements (API-01..08 + CFG-02) verify cleanly against the codebase. Anti-pattern scan found 3 info-level items, all explicitly intentional per PLAN prior_decisions or deferred per REVIEW-FIX.

**Why `human_needed` not `passed`:** The 6 items in `human_verification` are not gaps — they are unavoidable manual-execution checks that no static analysis can substitute for. SC2 (idempotency, "zero new Rebrandly calls beyond the first") and SC4 (Rebrandly outage → 502 with no partial persist) cannot be fully proven without a live API key and a live POST against the running route. Per the GSD verifier rules, when ANY human-verification items are produced, status must be `human_needed` (passed is reserved for code + data + behavior all green AND empty human-verification list).

**Notable strengths beyond the contract:**
- 8 `console.error` calls all use the `[POST /api/referral-link]` prefix exactly (exceeds the >=6 plan criterion).
- 3 occurrences of `NextResponse.json({ shortUrl, referralCode }` cover cache-hit, lost-CAS-winner, and fresh-create branches — all return the same response shape (REQ-05 invariant).
- 3 occurrences of `status: 502` (non-ok / catch / missing shortUrl) cover all three Rebrandly failure modes from API-06.
- WR-02 fix (commit fd281f5) added snapshot+restore in SMOKE 6 — protects the at-most-one-Rebrandly-call invariant even on runner crashes.
- Phase 58 dependency invariants checked structurally by SMOKE 3-5 + SMOKE 7 (DB-side, fully runnable without a session cookie).

---

_Verified: 2026-04-16_
_Verifier: Claude (gsd-verifier)_
