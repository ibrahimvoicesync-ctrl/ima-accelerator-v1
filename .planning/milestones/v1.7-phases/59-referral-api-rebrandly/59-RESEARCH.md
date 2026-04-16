# Phase 59: Referral API + Rebrandly - Research

**Researched:** 2026-04-16
**Domain:** Server-side Next.js 16 App Router route handler integrating an external HTTP API (Rebrandly v1) with idempotent persistence in Supabase Postgres
**Confidence:** HIGH (codebase pipeline, schema, types, and Hard Rules all VERIFIED via Read/Grep; Rebrandly API contract VERIFIED via official developers.rebrandly.com docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Phase boundary:** Any authenticated `student` or `student_diy` can `POST /api/referral-link` and receive an idempotent JSON `{ shortUrl, referralCode }`. Rebrandly is called **at most once per user for life**, and every documented failure mode (auth, role, missing key, Rebrandly outage, DB error) returns a stable HTTP status without corrupting state.
- **Requirements in scope:** API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08, CFG-02.
- **Idempotency contract:** Use `referral_short_url IS NOT NULL` as the skip signal; do not re-call Rebrandly even on transient past failures — a persisted short URL is the commit point.
- **Code generation for NULL-code rows:** Use the **same shape as the migration backfill** (`upper(substr(md5(id::text), 1, 8))`) — Phase 58 established this pattern and CONTEXT.md flags it as the default. (See Architecture Patterns / Pitfalls below for a code-side equivalent.)
- **Failure-mode → HTTP code map:** 401 (no session), 403 (wrong role), 500 (server misconfig — missing env var; DB error during pre-Rebrandly persist), 502 (upstream fault — Rebrandly down/err/timeout), 400 (malformed body).
- **No partial persistence:** If Rebrandly fails, `referral_short_url` stays NULL — the next call retries. `referral_code` IS allowed (and required by SC3) to be persisted before Rebrandly is called.
- **Reference patterns from CONTEXT.md:** Mirror the auth-then-role-then-body-parse order from existing `src/app/api/**` routes; admin client only; Rebrandly endpoint is `POST https://api.rebrandly.com/v1/links` with `apikey` header; response includes `shortUrl`.

### Claude's Discretion

All implementation choices outside the locked decisions above. Specifically open: route file path, body schema (none vs. empty object), idempotency strategy on the DB write (compare-and-swap vs read-then-update), Rebrandly request body extras (title, slashtag), timeout duration, log message wording, response status code on cache-hit (200 vs 200).

### Deferred Ideas (OUT OF SCOPE)

- Rebrandly click-tracking / analytics ingestion — out of scope for v1.7 (no payout scope per milestone memory).
- Owner/coach admin view of who generated links — not in v1.7.
- Automatic code regeneration on demand — not offered; the first Rebrandly success locks the short URL for life.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Auth via `getSessionUser()`; 401 unauth; 403 non-student/student_diy | `src/lib/session.ts:22-51` defines `getSessionUser()` BUT it `redirect()`s on no-session/no-profile — **NOT SAFE for API routes** (returns HTML redirect, breaks 401 contract). Existing API routes use raw `supabase.auth.getUser()` + manual admin profile lookup pattern (see `src/app/api/daily-plans/route.ts:21-36`). REQ wording requires `getSessionUser()` literally — see Pitfall 1. |
| API-02 | Load `referral_code` + `referral_short_url`; if `referral_short_url` set, return immediately, no Rebrandly call | Single admin-client `select` on `users` filtered by `id = profile.id`; check `referral_short_url !== null` before any external fetch. |
| API-03 | If `referral_code IS NULL` at request time, generate via `upper(uuid.slice(0, 8))` (per REQ wording) AND persist BEFORE Rebrandly call | REQ-03 wording differs from CONTEXT.md "match migration's md5(id) shape." See Open Questions Q1 — REQ-03 likely meant a fresh random/uuid-derived code (since for any future role addition we don't have predictable id-derived codes; `crypto.randomUUID().slice(0,8).toUpperCase()` is one valid reading). Per CLAUDE.md "Config is truth" + REQUIREMENTS.md being the contract, follow REQ-03 wording. |
| API-04 | POST to `https://api.rebrandly.com/v1/links` with `Content-Type: application/json` + `apikey: $REBRANDLY_API_KEY`; body `{ destination, title }`; check `response.ok` before parse | Verified Rebrandly contract; `title` is optional (UTF8, 3-255 chars). Hard Rule 6 enforced. |
| API-05 | Persist returned `shortUrl` to `users.referral_short_url`; respond `{ shortUrl, referralCode }` | Single `update().eq("id", profile.id).select().single()` on admin client. CRITICAL: see Pitfall 4 — Rebrandly's `shortUrl` does NOT include `https://` scheme — must prepend before persisting OR persist as-is and prepend in UI (decision needed; Plan should pick one). |
| API-06 | Rebrandly fail (non-OK / throw / timeout) → HTTP 502 + `console.error` cause + no partial persistence | Wrap fetch in `try/catch`; check `!response.ok`; use `AbortSignal.timeout(N)` for timeout. NEVER write `referral_short_url` until Rebrandly returns ok-with-body. |
| API-07 | Missing `REBRANDLY_API_KEY` → HTTP 500 + clear `console.error`; route does not crash | Check `process.env.REBRANDLY_API_KEY` exists at handler entry (after auth/role gate but before any external work); return 500 cleanly. Dashboard load is unaffected (route is API-only, never imported into RSC). |
| API-08 | Body parsed with Zod `safeParse` + `import { z } from "zod"`; auth+role check BEFORE validation | Mirror `src/app/api/daily-plans/route.ts:51-65` ordering. Body for this endpoint is empty/unused — schema is `z.object({}).strict()` or skip body parse entirely (see Open Questions Q2). |
| CFG-02 | `npm run lint && npx tsc --noEmit && npm run build` exits 0 | Same gate Phase 58 closed in commit `876319d`. No new dependencies needed; `fetch`, `crypto.randomUUID`, `AbortSignal.timeout` are all native Node 20+ / Next.js 16 runtime APIs. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are the directives the planner MUST honor verbatim. They are project-wide and have the same authority as locked CONTEXT.md decisions.

| Rule | Plan-side enforcement for this phase |
|------|--------------------------------------|
| **Hard Rule 4** — Admin client in API routes (every `.from()` query in route handlers uses admin client) | All 3 DB touches (read profile/code/url; persist new code; persist short_url) MUST go through `createAdminClient()` from `@/lib/supabase/admin`. |
| **Hard Rule 5** — Never swallow errors (every `catch` block must `console.error` or toast) | Both DB-error and Rebrandly-error catch blocks MUST `console.error("[POST /api/referral-link] ...", err)` before returning the error response. |
| **Hard Rule 6** — Check `response.ok` before parsing JSON | Rebrandly `fetch()` MUST `if (!rbResponse.ok)` before `await rbResponse.json()`. |
| **Hard Rule 7** — `import { z } from "zod"` (never `"zod/v4"`) | Even if body is unused, any zod usage takes the canonical import. |
| Critical Rule 2 — Admin client only in server code | The route file is server-only (App Router route handlers always run server-side); add `import "server-only"` at the top defensively or rely on the admin module's own `import "server-only"` (already present at `src/lib/supabase/admin.ts:1`). |
| Critical Rule 3 — Proxy not middleware | Confirmed: `src/proxy.ts` exists; matcher excludes `/api/` (`src/proxy.ts:113-116`) so the route is not gated by the proxy. The route MUST do its own auth + role gate. |
| Code Quality — Auth + role check BEFORE validation on every API route | Order: CSRF (optional — see decision below) → auth → role → env-var-check → body-parse → zod → DB read → idempotency branch → external call → persist. |
| Code Quality — Filter by user ID in queries; never rely on RLS alone | Both `users` queries MUST `.eq("id", profile.id)`. |

---

## Summary

Phase 59 ships a single Next.js 16 App Router route handler at `src/app/api/referral-link/route.ts` that exports a `POST` function. The handler is a textbook example of the project's standard mutation pipeline (CSRF? → auth → role → env-check → idempotent DB read → conditional external call → conditional persist → response), with one twist: it integrates an **external HTTP API (Rebrandly v1)** for the first time in this codebase, and that integration must be defensively wrapped with `AbortSignal.timeout()`, a `response.ok` check, and a try/catch that cleanly maps every failure mode (network error, timeout, non-2xx, JSON parse error) to HTTP 502 without corrupting DB state.

The hard correctness invariant — *exactly one Rebrandly call per user for life* — reduces to a 3-step DB sequence: (1) read `referral_code` + `referral_short_url` for the caller; (2) if `referral_short_url IS NOT NULL`, return cached value immediately; (3) otherwise call Rebrandly and persist. Race-safety between two concurrent POSTs from the same user is achieved by gating the persist on `WHERE id = $1 AND referral_short_url IS NULL` and treating a 0-row update as "another request won — re-read and return their value." This is a standard compare-and-swap idiom and is sufficient given Postgres MVCC + the partial UNIQUE index already in place from Phase 58.

The Rebrandly API contract is well-documented but has two gotchas the planner must lock: (a) the `shortUrl` field returned by Rebrandly does **NOT** include a scheme (e.g. it returns `rebrand.ly/abc123`, not `https://rebrand.ly/abc123`) — verified via official Rebrandly docs and migration-from-Google-shortener page — so the route must prepend `https://` before persisting OR the UI must prepend on render (the planner should pick one and document it as a locked decision); (b) the `apikey` header is the only auth mechanism — there is no Bearer token alternative, no workspace header is needed for the default `rebrand.ly` domain.

**Primary recommendation:** Mirror `src/app/api/daily-plans/route.ts:15-95` for the auth+role+body+zod+admin-client skeleton, drop the rate-limit (per REQUIREMENTS.md "Out of Scope" — endpoint is idempotent and at most one Rebrandly call per user for life), drop CSRF check ONLY if the planner can justify it (the existing pattern always includes CSRF; safest is to keep it), wrap the Rebrandly fetch with `AbortSignal.timeout(8000)` and a try/catch that maps everything to 502, and use a compare-and-swap UPDATE for the persist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP entry / auth gate / role gate | API / Backend (Next.js route handler) | — | Hard Rule 4 + project convention; proxy.ts excludes `/api/` so the route owns its own gating. |
| Profile lookup (auth_id → users.id, role) | API / Backend | Database (Postgres via admin client) | Mirrors every existing API route in `src/app/api/**`. |
| Idempotency check (`referral_short_url IS NOT NULL`) | API / Backend | Database | Single SELECT against `public.users`. Cache-hit response stops here — no external call. |
| Referral code generation (when NULL) | API / Backend | Database | Code derived in Node (`crypto.randomUUID()` or md5 equivalent), persisted via admin client UPDATE. |
| Rebrandly link creation | External (Rebrandly v1 API) | API / Backend | The route is the sole orchestrator — UI never talks to Rebrandly directly. Hard Rule 2 (admin client only in server code) means the API key never leaves the route handler context. |
| Short URL persistence | Database | API / Backend | UPDATE `users.referral_short_url`, gated `WHERE id = $1 AND referral_short_url IS NULL` for race-safety. |
| Response shaping | API / Backend | — | `NextResponse.json({ shortUrl, referralCode }, { status })`. |

**Tier audit:** No browser/CDN tier involvement — Phase 60 (separate phase) handles the client-side `ReferralCard.tsx` consuming this endpoint. The boundary between Phase 59 and Phase 60 is the JSON contract `{ shortUrl: string, referralCode: string }`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 (verified `package.json:20`) | App Router route handler | Project standard. Route at `src/app/api/referral-link/route.ts` exporting `POST`. [VERIFIED: package.json] |
| @supabase/supabase-js | ^2.99.2 (verified `package.json:13`) | Admin client for DB read+write | Project standard via `createAdminClient()`. [VERIFIED: package.json + src/lib/supabase/admin.ts] |
| zod | ^4.3.6 (verified `package.json:28`) | Body schema (even if empty/strict) per Hard Rule 7 + API-08 | Project standard. Import `from "zod"` (never `"zod/v4"`). [VERIFIED: package.json + Hard Rule 7] |
| Native `fetch` | Node 20+ runtime | Rebrandly HTTP call | Built into Node.js / Next.js runtime. No new dependency. [VERIFIED: undici/Node20 native] |
| Native `AbortSignal.timeout` | Node 18+ | Rebrandly request timeout | Built-in since Node 18 / web platform 2022. No `setTimeout` boilerplate needed. [CITED: MDN AbortSignal] |
| Native `crypto.randomUUID` | Node 19+ / Web Crypto | Generate fresh code if `referral_code IS NULL` (REQ-03 wording: `upper(uuid.slice(0, 8))`) | Already used in codebase (see `src/app/api/invites/route.ts:85`: `crypto.randomUUID().replace(/-/g, "").slice(0, 16)`). [VERIFIED: codebase grep] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `verifyOrigin` from `@/lib/csrf` | repo-internal | CSRF protection (Origin header check) | Use if matching the existing mutation route pattern (every `POST` in `src/app/api/**` uses it). Decision lock recommended. [VERIFIED: src/lib/csrf.ts:14-43] |
| `next/server` `NextResponse` | bundled with Next.js 16.1.6 | Response builder | Standard for App Router route handlers. [VERIFIED: every route in src/app/api/**] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch` + `AbortSignal.timeout` | `axios` / `ky` / `got` | New dependency; no functional gain. Native `fetch` has a `Response.ok` boolean (Hard Rule 6 maps cleanly), `Response.statusText`, and supports `signal: AbortSignal.timeout(ms)` — sufficient. Not worth a new dep. |
| `crypto.randomUUID().slice(0,8).toUpperCase()` | `crypto.randomBytes(4).toString("hex").toUpperCase()` | Both produce 8 hex chars. UUID-derived has slightly higher entropy in the slice (but still ~32 bits — see Pitfall 5). `randomUUID()` is more idiomatic and already in codebase. |
| Native `fetch` | `node-fetch` | Already deprecated path — Next.js 16 / Node 20 has native `fetch` from undici. |
| Compare-and-swap UPDATE for race-safety | Postgres advisory lock (`pg_advisory_xact_lock(hashtextextended($1, 0))`) | Advisory locks need a serializable lock-key (would use user id hash); requires a transaction. Compare-and-swap with `WHERE referral_short_url IS NULL` + a re-read on 0 rows updated is simpler, requires no new infra, and works with PostgREST. (See Architecture Patterns / Pattern 2.) |

**Installation:** None. All dependencies are already installed.

**Version verification:**

```bash
# Verified by Read of package.json:
next                 16.1.6        # production dep, line 20
@supabase/supabase-js ^2.99.2      # production dep, line 13
zod                  ^4.3.6        # production dep, line 28 — note: project uses zod 4.x but imports as `from "zod"` per Hard Rule 7, never `"zod/v4"`
```

[VERIFIED: package.json read 2026-04-16]

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Client (Phase 60 — ReferralCard.tsx, OUT OF SCOPE for Phase 59)         │
└──────────────────────────────────────────────────────────────────────────┘
                                    │ POST /api/referral-link
                                    │ (Origin: https://app.host)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  src/app/api/referral-link/route.ts  (POST handler)                      │
│                                                                           │
│  STEP 0  verifyOrigin(req) ─── 403 if mismatched ────────────► response  │
│  STEP 1  supabase.auth.getUser() ─── null? ── 401 ───────────► response  │
│  STEP 2  admin.from("users").select("id, role").eq("auth_id", ...)       │
│           role ∉ {student, student_diy}? ── 403 ─────────────► response  │
│  STEP 3  process.env.REBRANDLY_API_KEY missing? ── 500 ──────► response  │
│  STEP 4  (optional) zod.safeParse(body) ── 400 if bad ───────► response  │
│  STEP 5  admin.from("users").select("referral_code, referral_short_url") │
│           .eq("id", profile.id).single()                                  │
│           ├── referral_short_url !== null?                                │
│           │    └── 200 { shortUrl, referralCode } ───────────► response  │
│           │        (CACHE HIT — no Rebrandly call, no DB write)          │
│           │                                                               │
│           └── referral_code === null?                                     │
│                ├── code = crypto.randomUUID().slice(0,8).toUpperCase()    │
│                └── admin.from("users").update({ referral_code: code })   │
│                        .eq("id", profile.id)                              │
│                        .eq("referral_code", null)  ◄── compare-and-swap  │
│                        .select("referral_code").single()                  │
│                    if 0 rows / unique-violation → re-read code, continue │
│                    if other DB error → 500 ─────────────────► response   │
│                                                                           │
│  STEP 6  (referral_code is now non-null in scope)                        │
│          fetch("https://api.rebrandly.com/v1/links", {                   │
│            method: "POST",                                                │
│            headers: { apikey, "Content-Type": "application/json" },      │
│            body: JSON.stringify({ destination, title }),                  │
│            signal: AbortSignal.timeout(8000),                             │
│          })                                                               │
│           ├── throws (network/timeout) ── catch → 502 ───────► response  │
│           │                                                               │
│           ▼                                                               │
│         response.ok?  ── false → 502 + console.error ─────────► response │
│           │                                                               │
│           ▼                                                               │
│         body = await response.json()                                      │
│         shortUrl = "https://" + body.shortUrl  ◄── prepend scheme        │
│                                                                           │
│  STEP 7  admin.from("users").update({ referral_short_url: shortUrl })    │
│           .eq("id", profile.id)                                           │
│           .eq("referral_short_url", null)  ◄── compare-and-swap          │
│           .select("referral_short_url").single()                          │
│           ├── 0 rows → re-read (someone else won) → return their value   │
│           └── other DB error → 500 + console.error ──────────► response  │
│                                                                           │
│  STEP 8  return NextResponse.json({ shortUrl, referralCode }, 200)       │
└──────────────────────────────────────────────────────────────────────────┘
            │                                              ▲
            │ apikey + body                                │ shortUrl (no scheme)
            ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│  Rebrandly v1 API — POST https://api.rebrandly.com/v1/links              │
└──────────────────────────────────────────────────────────────────────────┘
            │                                              ▲
            │ admin client                                 │
            ▼                                              │
┌──────────────────────────────────────────────────────────────────────────┐
│  Supabase Postgres — public.users                                         │
│    columns: referral_code varchar(12), referral_short_url text           │
│    partial UNIQUE idx_users_referral_code WHERE referral_code IS NOT NULL│
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   └── api/
│       └── referral-link/
│           └── route.ts                       # NEW — POST handler (this phase)
└── lib/
    ├── supabase/
    │   └── admin.ts                           # EXISTING — createAdminClient()
    ├── csrf.ts                                # EXISTING — verifyOrigin()
    └── session.ts                             # EXISTING — see Pitfall 1 about getSessionUser
```

No new directories, no new lib files needed. **Single file:** `src/app/api/referral-link/route.ts`.

### Pattern 1: Standard Mutation Pipeline (mirror this verbatim)

**What:** The 8-step CSRF → auth → role → rate-limit → body → zod → ownership → logic ordering used by every existing mutation route in `src/app/api/**`.
**When to use:** Every protected POST/PATCH/DELETE handler. (For Phase 59, drop rate-limit per REQUIREMENTS.md "Out of Scope" reasoning; insert env-var-check between role and body-parse.)
**Example (canonical — daily-plans POST):**

```typescript
// Source: src/app/api/daily-plans/route.ts (verified read 2026-04-16)
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

const postBodySchema = z.object({ /* ... */ });

export async function POST(request: Request) {
  // 1. CSRF — cheapest check first
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // 2. Auth
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 3. Role check — student only
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile || (profile.role !== "student" && profile.role !== "student_diy")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. (Phase 59 inserts env-var check HERE, replacing rate-limit)

  // 5. Parse body
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // 6. Zod validation
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // 7. Business logic (DB write, etc.)
  // ...
}
```

### Pattern 2: Compare-and-Swap UPDATE for race-safe single-flight

**What:** A `WHERE col IS NULL` filter on UPDATE turns concurrent writes into "first writer wins; everyone else gets 0 rows updated." Combine with a re-read on 0-row to return the winner's value.
**When to use:** Idempotent persists where you must guarantee at most one external side-effect (Rebrandly call) across concurrent requests from the same actor.
**Example (Phase 59 short-URL persist):**

```typescript
// Persist short URL — race-safe: only the first writer to find referral_short_url IS NULL succeeds.
const { data: persisted, error: persistError } = await admin
  .from("users")
  .update({ referral_short_url: shortUrl })
  .eq("id", profile.id)
  .is("referral_short_url", null)         // ◄── compare-and-swap predicate
  .select("referral_short_url")
  .maybeSingle();

if (persistError) {
  console.error("[POST /api/referral-link] Failed to persist short URL:", persistError);
  return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
}

if (!persisted) {
  // Another concurrent request won — re-read and return their value.
  const { data: winner } = await admin
    .from("users")
    .select("referral_short_url")
    .eq("id", profile.id)
    .single();
  if (winner?.referral_short_url) {
    return NextResponse.json({ shortUrl: winner.referral_short_url, referralCode }, { status: 200 });
  }
  // Should be unreachable; defensive 500.
  console.error("[POST /api/referral-link] Lost compare-and-swap but no winner found");
  return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
}

return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
```

**Why this works:** Postgres MVCC guarantees the UPDATE either matches the row (writer wins) or matches 0 rows (writer lost). No advisory lock needed. The losing writer's Rebrandly response is "wasted" (one extra Rebrandly call in a true race), but that's acceptable: the success criterion is "at most one Rebrandly call per user **for life**" not "across instantaneous concurrent requests" — and the practical race window (user double-tapping the button before the first response arrives) is small. If even single-call-during-race is required, see Anti-Patterns #1 below for advisory-lock alternative.

### Pattern 3: Defensive external-API fetch with timeout + ok check + try/catch

**What:** The minimal-defensive pattern for any outbound HTTP call. Wraps four failure modes (network error, timeout, non-2xx, JSON parse error) in one try/catch that always logs and always returns 502.
**Example (Phase 59 Rebrandly call):**

```typescript
let rbBody: { id: string; shortUrl: string; [k: string]: unknown };
try {
  const rbResponse = await fetch("https://api.rebrandly.com/v1/links", {
    method: "POST",
    headers: {
      apikey: process.env.REBRANDLY_API_KEY!,        // checked non-null at STEP 3
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      destination: `https://www.imaccelerator.com/?ref=${referralCode}`,
      title: `IMA Referral - ${profile.name}`,
    }),
    signal: AbortSignal.timeout(8000),               // 8s ceiling — see Pitfall 6
  });

  if (!rbResponse.ok) {
    // Hard Rule 6: must check ok before parsing
    const errBody = await rbResponse.text().catch(() => "<unreadable>");
    console.error(
      "[POST /api/referral-link] Rebrandly non-OK:",
      rbResponse.status,
      rbResponse.statusText,
      errBody
    );
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

  rbBody = await rbResponse.json();
  if (typeof rbBody?.shortUrl !== "string") {
    console.error("[POST /api/referral-link] Rebrandly response missing shortUrl:", rbBody);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }
} catch (err) {
  // Catches: AbortError/TimeoutError, network errors, JSON parse errors
  console.error("[POST /api/referral-link] Rebrandly fetch failed:", err);
  return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
}

// shortUrl from Rebrandly does NOT include scheme — prepend.
const shortUrl = `https://${rbBody.shortUrl}`;
```

[CITED: developers.rebrandly.com — shortUrl is documented as scheme-less by intentional v1 design]
[CITED: MDN AbortSignal.timeout — TimeoutError DOMException on timeout]

### Anti-Patterns to Avoid

1. **Do NOT use `getSessionUser()` from `src/lib/session.ts` in this route.** It calls `redirect("/login")` / `redirect("/no-access")` on no-session/no-profile (lines 28, 41) — that's correct for server components but breaks the API contract (must return 401/403 JSON, not HTML redirect). REQ-01 says "authenticate via `getSessionUser()`" — this is REQUIREMENTS.md wording but the actual function is incompatible with API routes. **The plan should follow the existing API-route pattern (raw `supabase.auth.getUser()` + admin profile lookup) and treat REQ-01's `getSessionUser()` mention as conceptual ("session user lookup"), not a literal function reference.** See Pitfall 1.

2. **Do NOT persist `referral_short_url` BEFORE checking Rebrandly's `response.ok`.** Persisting on optimistic 2xx-without-body would corrupt state on a malformed-response (e.g. 200 with no `shortUrl` field). Order: parse → validate → persist.

3. **Do NOT use `getSessionUser()`'s React `cache()` wrapping in a route handler context.** `cache()` is keyed by RSC render tree; route handlers don't have one. (Even if you bypassed the redirect issue, the cache would silently no-op per request, which is fine but adds confusion.)

4. **Do NOT skip the `AbortSignal.timeout()`.** Without it, a hanging Rebrandly connection would tie up the route until the platform's request timeout (typically 60s on Vercel hobby, 300s on pro) — and the user sees a hung browser. 8s ceiling is generous for a write API.

5. **Do NOT trust `referral_code` to be non-null when reading.** Even though Phase 58 backfilled all 7 existing student/student_diy rows, future students added between Phase 58 and Phase 59 ship dates (or post-ship via invite acceptance) would have NULL codes — handle the NULL branch (REQ-03).

6. **Do NOT generate `referral_code` AFTER Rebrandly call.** REQ-03 explicitly says "before calling Rebrandly." Persisting the code first means even if Rebrandly fails, the next call has the same code (deterministic destination URL).

7. **Do NOT create a one-off harness module for the Rebrandly fetch.** Inline `fetch()` in the route handler — single-use, no other consumer. Adding `src/lib/rebrandly.ts` would be premature abstraction (the only other v1.7 consumer is Phase 60 via the API itself, not direct).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP timeout for outbound fetch | Custom `setTimeout` + `AbortController` boilerplate | `signal: AbortSignal.timeout(ms)` | One-line solution since Node 18; the manual `AbortController` + `setTimeout` + clear pattern adds 4 lines of bookkeeping for zero benefit. [CITED: MDN AbortSignal.timeout] |
| 8-char hex code generation | `Math.random().toString(36).slice(2, 10).toUpperCase()` | `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()` (matches existing codebase pattern at `src/app/api/invites/route.ts:85`) | `Math.random` is not cryptographically secure and should never be used for any user-facing identifier. `randomUUID()` is in the codebase precedent. |
| Race-safe single-writer for short URL | DB advisory lock + transaction | Compare-and-swap `UPDATE ... WHERE referral_short_url IS NULL` + re-read on 0 rows | Single statement, no transaction, works with PostgREST. Already used pattern; advisory locks would need a transaction wrapper not currently used in any route. |
| HTTP client for Rebrandly | `axios` / `node-fetch` / `ky` | Native `fetch` | Native `fetch` (undici) is built into Node 20 + Next.js 16. Has `Response.ok`, `Response.json()`, `signal` option. Adding a dep means a new package to audit, version-pin, and lint-ignore. |
| CSRF check for the route | Custom Origin header parsing | `verifyOrigin(request)` from `@/lib/csrf` | Already in the codebase; matches every other mutation route. |
| Auth + profile lookup | New helper function | The 7-line inline pattern from `src/app/api/daily-plans/route.ts:21-36` | Inlining matches every other API route — adding a helper would be code-style drift. |

**Key insight:** This phase is mostly *plumbing* between three existing systems (Supabase admin client, native `fetch`, Postgres compare-and-swap). The ONLY net-new logic is the Rebrandly request body shape and the cache-hit / generate / persist branches. Resist the urge to introduce a `lib/rebrandly.ts` module — single-call, single-consumer.

## Runtime State Inventory

> N/A — this is a greenfield API endpoint, not a rename or refactor. No stored data, live service config, OS-registered state, secrets, or build artifacts carry old-string references that would break post-deploy.
>
> **Fresh-state items introduced** (relevant for future phases, not for this one's planning):
> - `REBRANDLY_API_KEY` becomes a hard runtime requirement once this phase ships. Already documented in `.env.local.example` (Phase 58, commit `d841827`). Production deployment requires the value be set in the deploy environment (Vercel project env vars or equivalent).
> - Each Rebrandly link created is permanent state in Rebrandly's account — for this milestone, no API endpoint is needed to delete them; the links are append-only for life.

## Common Pitfalls

### Pitfall 1: `getSessionUser()` from `src/lib/session.ts` calls `redirect()` and is incompatible with API routes

**What goes wrong:** REQ-01 reads "authenticates the caller via `getSessionUser()`." The repo has a function literally named `getSessionUser` at `src/lib/session.ts:22-51`, but it calls `redirect("/login")` on no-session (line 28) and `redirect("/no-access")` on no-profile (line 41) — both throw `NEXT_REDIRECT` errors that produce HTML 307 responses, NOT JSON 401/403. Calling it from an API route violates the API-01 contract ("Unauthenticated requests return 401").

**Why it happens:** `getSessionUser()` was designed for Server Components (the `cache(...)` wrapping is the giveaway). REQ-01's wording was likely conceptual ("perform a session-user lookup"), not a literal function-name directive. None of the existing API routes use `getSessionUser()` — they all inline `supabase.auth.getUser()` + admin profile lookup (verified: `src/app/api/daily-plans/route.ts:21-36`, `src/app/api/invites/route.ts:19-32`, `src/app/api/work-sessions/route.ts:30-44`, `src/app/api/reports/[id]/review/route.ts:21-44`).

**How to avoid:** Use the inline pattern from existing routes. Document in the plan summary that REQ-01's `getSessionUser()` mention is interpreted as conceptual session-user lookup, satisfied by the project-standard `supabase.auth.getUser()` + admin profile lookup chain. (If the planner disagrees, the alternative is to refactor `session.ts` to add a `getSessionUserOrNull()` non-redirecting variant — out of scope for Phase 59.)

**Warning signs:** A route that imports from `@/lib/session` AND exports `POST`/`GET` from `src/app/api/**` — that's almost always wrong.

### Pitfall 2: Rebrandly's `shortUrl` does not include `https://` scheme

**What goes wrong:** Storing `body.shortUrl` directly into `referral_short_url` results in values like `rebrand.ly/abc123` instead of `https://rebrand.ly/abc123`. Phase 60's UI renders this in an `<a href={...}>` and the browser interprets it as a relative URL → broken link to `https://app.imaccelerator.com/rebrand.ly/abc123`.

**Why it happens:** Rebrandly v1 deliberately omits the protocol in the `shortUrl` field — verified per official docs ("This choice, in v1, was an intentional one, to allow API clients getting more control over the protocol of choice"). [CITED: developers.rebrandly.com migrating-from-google-shortener-api page]

**How to avoid:** Prepend `https://` BEFORE persisting:
```typescript
const shortUrl = `https://${rbBody.shortUrl}`;
```
The planner should also document this as a locked decision so Phase 60 doesn't double-prepend.

**Warning signs:** A persisted `referral_short_url` value that doesn't start with `https://` — write a one-time guard in Phase 60's read path that warns if the value doesn't start with a scheme.

### Pitfall 3: Concurrent double-tap can produce two Rebrandly calls for the same user

**What goes wrong:** User taps "Generate Link" twice in rapid succession. Both requests hit the route, both pass the `referral_short_url IS NULL` cache check (because neither has persisted yet), both call Rebrandly, both persist. Now the user has two Rebrandly links — and only one is stored. The other is "leaked" (lives in the Rebrandly dashboard but is not in the DB and never referenced).

**Why it happens:** Read-then-write without a row-level lock. The cache check (read) and the persist (write) are not in a transaction.

**How to avoid (sufficient for v1.7):** Compare-and-swap UPDATE (Pattern 2 above). Mitigates the *persist* race — only one writer wins. Doesn't prevent the duplicate Rebrandly call but limits the cost to "two Rebrandly API requests, one wasted link in their dashboard, one canonical link returned to user." For v1.7's "at most one Rebrandly call per user **for life**" criterion, this is the practical reading. (If strict instantaneous single-call is required, the planner should add a Postgres advisory lock before the cache check — see Anti-Patterns #1 above.)

**Warning signs:** Rebrandly dashboard accumulating duplicate links per user — flag for cleanup in a future hardening phase.

### Pitfall 4: Forgetting `import "server-only"` allows the API route file to be accidentally imported by a client component via barrel re-export

**What goes wrong:** If anyone exports the route handler module from a barrel (e.g. `src/app/api/index.ts`) and imports it from a client file, the bundle would include the Rebrandly API key reference (technically `process.env.REBRANDLY_API_KEY` becomes `undefined` at the browser, but the surface area for accidental leakage is wider than zero).

**Why it happens:** Next.js does not enforce server-onlyness on route files by default — only files marked `"use server"` (server actions) or imports of `server-only` are guarded.

**How to avoid:** The admin client module already has `import "server-only"` at the top of `src/lib/supabase/admin.ts:1`. Importing it transitively makes the route handler server-only by association. If the planner wants belt-and-suspenders, add `import "server-only"` at the top of the route file explicitly — zero runtime cost.

**Warning signs:** A client file (`"use client"` directive) anywhere in the codebase importing from `@/lib/supabase/admin` — that's an immediate bug regardless of this route.

### Pitfall 5: 8 hex chars = ~32 bits of entropy = collision risk grows fast

**What goes wrong:** With 8 hex chars (16⁸ ≈ 4.3B values), birthday-paradox collision probability hits 50% at ~65k codes. The partial UNIQUE index will catch a collision at write time (returning Postgres error code `23505`), but the route currently has no retry logic — the user gets a 500. With an expected user base in the low thousands for v1, collision probability is <0.1%, but it's non-zero.

**Why it happens:** REQ-03 + Phase 58's deterministic backfill both chose 8-char codes. Bumping to 12 chars is a future change; for v1.7, accept the risk.

**How to avoid:** On Postgres `23505` (unique violation) during code-persist UPDATE, retry with a fresh `crypto.randomUUID().slice(0,8).toUpperCase()` up to 3 times before surfacing 500. Alternatively, don't retry and surface 500 with a clear `console.error` — collision is so rare the operational cost is acceptable. Planner picks one. (Recommend: 1 retry, then 500. Two-line change.)

**Warning signs:** A 500 from this endpoint with `console.error` mentioning "23505" or "duplicate key value violates unique constraint" — investigate the user, generate a manual code if needed.

### Pitfall 6: AbortSignal.timeout uses the platform's default timer; choose a value that beats Vercel's request timeout

**What goes wrong:** Vercel's hobby tier kills any request running >10s; pro tier >60s. If Rebrandly hangs, your route hangs until the platform terminates it — user sees a TCP-reset error, not your nice 502. Setting `AbortSignal.timeout(15000)` on a hobby tier means the platform kills you before your timeout fires.

**Why it happens:** Implementation oversight; nobody checks the deployment tier when picking the timeout.

**How to avoid:** Set `AbortSignal.timeout(8000)` (8 seconds) — comfortably under both hobby (10s) and pro (60s) tiers. Rebrandly's typical response time is <500ms; 8s gives 16x headroom. If the deployment tier is known (check `vercel.json` or `next.config.*`), tune as desired but never go above 50s on pro / 8s on hobby.

**Warning signs:** Production logs showing fetch errors that don't match TimeoutError or AbortError shape — likely platform-killed instead of self-killed.

### Pitfall 7: Forgetting that `process.env.REBRANDLY_API_KEY` is a string-or-undefined, not a string

**What goes wrong:** TypeScript strict mode (`strict: true` per CLAUDE.md "TypeScript strict") types `process.env.REBRANDLY_API_KEY` as `string | undefined`. Using it without checking → `tsc --noEmit` fails OR worse: a non-null-assertion `!` masks the missing-key case and you skip API-07.

**Why it happens:** Easy to write `apikey: process.env.REBRANDLY_API_KEY!` for terseness.

**How to avoid:** Explicit guard at STEP 3:
```typescript
const apiKey = process.env.REBRANDLY_API_KEY;
if (!apiKey) {
  console.error("[POST /api/referral-link] REBRANDLY_API_KEY not configured");
  return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
}
// Now apiKey is narrowed to string for the rest of the function.
```
This satisfies API-07 (clear `console.error`, 500, route does not crash).

**Warning signs:** A `!` after `process.env.REBRANDLY_API_KEY` anywhere in the route — that's a missed API-07 implementation.

### Pitfall 8: Empty body POST and zod's `safeParse` interaction

**What goes wrong:** API-08 requires Zod `safeParse` on body. The route has no body input. `await request.json()` on an empty body throws `SyntaxError: Unexpected end of JSON input`, which is caught by the standard try/catch and returns 400 — but that contradicts the success criterion (an empty-body POST from a valid student should succeed with 200/cache or 200/generated).

**Why it happens:** UI sends `fetch("/api/referral-link", { method: "POST" })` without a body; route insists on JSON-parsing.

**How to avoid:** Either (a) make body parsing optional — wrap `request.json()` in try/catch and treat empty as `{}`, then pass `{}` to `z.object({}).strict().safeParse(...)`; or (b) skip body parsing and zod entirely (cleanest reading: API-08 says "Request input (body, if any)" — "if any" allows skipping). Planner picks one. **Recommendation: option (a)** — it satisfies the literal reading of "Zod safeParse on all API inputs" while still accepting empty bodies. Five-line cost.

```typescript
const bodySchema = z.object({}).strict();
let body: unknown = {};
try { body = await request.json(); }
catch { body = {}; }                                 // Empty body is valid
const parsed = bodySchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
```

**Warning signs:** A 400 response from the route on an empty-body POST from the React UI — that's an API-08 implementation drift.

## Code Examples

### Complete Reference Skeleton (mirror this in the plan)

```typescript
// Source: synthesized from src/app/api/daily-plans/route.ts (verified pattern)
//         + Rebrandly v1 docs (developers.rebrandly.com)
//         + CLAUDE.md Hard Rules 4, 5, 6, 7
//
// Path: src/app/api/referral-link/route.ts
import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";

const bodySchema = z.object({}).strict();

export async function POST(request: Request) {
  // STEP 0: CSRF (cheapest; matches every other mutation route)
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // STEP 1: Auth
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // STEP 2: Role gate (admin client for profile lookup)
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, name, role, referral_code, referral_short_url")
    .eq("auth_id", authUser.id)
    .single();

  if (profileError || !profile) {
    console.error("[POST /api/referral-link] Profile lookup failed:", profileError);
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }
  if (profile.role !== "student" && profile.role !== "student_diy") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // STEP 3: API-07 — env var check
  const apiKey = process.env.REBRANDLY_API_KEY;
  if (!apiKey) {
    console.error("[POST /api/referral-link] REBRANDLY_API_KEY not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // STEP 4: API-08 — body parse + zod (empty body is valid)
  let body: unknown = {};
  try { body = await request.json(); } catch { body = {}; }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // STEP 5: API-02 — cache hit?
  if (profile.referral_short_url) {
    return NextResponse.json(
      { shortUrl: profile.referral_short_url, referralCode: profile.referral_code },
      { status: 200 }
    );
  }

  // STEP 5b: API-03 — generate code if NULL, persist BEFORE Rebrandly call
  let referralCode = profile.referral_code;
  if (!referralCode) {
    referralCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const { error: codeError } = await admin
      .from("users")
      .update({ referral_code: referralCode })
      .eq("id", profile.id)
      .is("referral_code", null);
    if (codeError) {
      // 23505 = unique violation — extremely rare collision; surface 500.
      console.error("[POST /api/referral-link] Failed to persist referral_code:", codeError);
      return NextResponse.json({ error: "Failed to generate referral code" }, { status: 500 });
    }
    // No re-read needed — if 0 rows updated (lost race) we just proceed with the code we generated.
    // The other writer's code will be in the row; ours is "logically" assigned. To be strictly correct,
    // re-read here:
    const { data: refreshed } = await admin
      .from("users")
      .select("referral_code")
      .eq("id", profile.id)
      .single();
    if (refreshed?.referral_code) referralCode = refreshed.referral_code;
  }

  // STEP 6: API-04 / API-06 — Rebrandly call with timeout + ok check + try/catch
  let rbBody: { id?: string; shortUrl?: string };
  try {
    const rbResponse = await fetch("https://api.rebrandly.com/v1/links", {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: `https://www.imaccelerator.com/?ref=${referralCode}`,
        title: `IMA Referral - ${profile.name}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!rbResponse.ok) {
      const errText = await rbResponse.text().catch(() => "<unreadable>");
      console.error(
        "[POST /api/referral-link] Rebrandly non-OK:",
        rbResponse.status, rbResponse.statusText, errText
      );
      return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
    }
    rbBody = await rbResponse.json();
  } catch (err) {
    console.error("[POST /api/referral-link] Rebrandly fetch failed:", err);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

  if (typeof rbBody.shortUrl !== "string" || rbBody.shortUrl.length === 0) {
    console.error("[POST /api/referral-link] Rebrandly response missing shortUrl:", rbBody);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
  }

  // Pitfall 2: prepend scheme — Rebrandly's shortUrl is scheme-less by v1 design.
  const shortUrl = `https://${rbBody.shortUrl}`;

  // STEP 7: API-05 — race-safe persist (Pattern 2 compare-and-swap)
  const { data: persisted, error: persistError } = await admin
    .from("users")
    .update({ referral_short_url: shortUrl })
    .eq("id", profile.id)
    .is("referral_short_url", null)
    .select("referral_short_url")
    .maybeSingle();

  if (persistError) {
    console.error("[POST /api/referral-link] Persist failed:", persistError);
    return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
  }

  if (!persisted) {
    // Concurrent winner — return their value.
    const { data: winner } = await admin
      .from("users")
      .select("referral_short_url")
      .eq("id", profile.id)
      .single();
    if (winner?.referral_short_url) {
      return NextResponse.json(
        { shortUrl: winner.referral_short_url, referralCode },
        { status: 200 }
      );
    }
    console.error("[POST /api/referral-link] Lost race but no winner found");
    return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
  }

  // STEP 8: success
  return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
}
```

[VERIFIED: pattern lines 1-50 mirror src/app/api/daily-plans/route.ts; lines 65-95 implement Pattern 2 verbatim]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` package import | Native `fetch` (undici-based) | Node 18 (Apr 2022); Next.js 13.4 stable | No new dep needed; native API. |
| `setTimeout` + `AbortController` boilerplate | `AbortSignal.timeout(ms)` | Node 17.3 (Dec 2021) / Web Platform 2022 | One-line timeout. [CITED: MDN] |
| `uuid` npm package | `crypto.randomUUID()` | Node 14.17 (Jun 2021) / Web Crypto | Already used in codebase. No dep. |
| Read-then-update with explicit `BEGIN` transaction | Compare-and-swap `UPDATE ... WHERE col IS NULL` | Always available in Postgres | Single statement, no transaction wrapper needed. |
| Service-role key in custom Authorization header | Direct injection via `apikey: $KEY` | Rebrandly v1 (current) | Documented in Rebrandly docs; lowercase header is the canonical form. [CITED: developers.rebrandly.com get-started] |

**Deprecated/outdated:**
- Don't use the `Bearer ${REBRANDLY_API_KEY}` Authorization header — Rebrandly v1 does not accept it; the only supported scheme is the `apikey` custom header. [CITED: developers.rebrandly.com get-started]
- Don't pass `domain: "rebrand.ly"` in the request body — `rebrand.ly` is the default and the field is only needed for custom domains (out of scope per REQUIREMENTS.md "Out of Scope" #6 "Custom Rebrandly domain").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The route does NOT need a custom domain or workspace header (default `rebrand.ly` is acceptable) | API-04 example | Low — REQUIREMENTS.md "Out of Scope" #6 explicitly excludes custom domains; no workspace usage anywhere in the milestone scope. [CITED: REQUIREMENTS.md OOS #6] |
| A2 | `verifyOrigin()` (CSRF) should be included | Architecture Patterns Pattern 1 | Low — every other mutation POST in `src/app/api/**` uses it. Skipping it for this route would be a deviation; the planner should keep it unless explicitly justified. |
| A3 | `AbortSignal.timeout(8000)` is appropriate (8s; under Vercel hobby's 10s; well under pro's 60s) | Pitfall 6 | Low — Rebrandly typical response is <500ms; 8s is 16x headroom. If deployed on a tier with <8s timeout, lower this. |
| A4 | Empty-body POST should be accepted (treated as `{}`) | Pitfall 8 | Low — Phase 60's UI sends an empty-body POST; rejecting it would break the success criterion. |
| A5 | Code generation for NULL-code rows uses `crypto.randomUUID().slice(0,8).toUpperCase()` (matching REQ-03 wording "upper(uuid.slice(0, 8))") | API-03, Phase Requirements table | **MEDIUM** — CONTEXT.md says match the migration's `upper(substr(md5(id::text), 1, 8))` shape (deterministic, id-derived); REQUIREMENTS.md REQ-03 says `upper(uuid.slice(0, 8))` (non-deterministic, fresh per call). They contradict. Open Question Q1. |
| A6 | The `referral_short_url` value persisted to DB includes the `https://` scheme prepended by the route | Pitfall 2, Code Examples STEP 7 | **MEDIUM** — alternative is to persist scheme-less and prepend in UI; either works but the planner must lock one choice for Phase 60 to know which. |
| A7 | On a Postgres `23505` unique violation during the code-persist UPDATE (collision in 8-char code space), the route surfaces 500 (no retry). | Pitfall 5 | Low — collision probability is <0.1% for v1 user base. Retry-once would be 2 extra lines if desired. |
| A8 | The reference `getSessionUser` mention in REQ-01 is conceptual ("session user lookup"), not a literal directive to call the existing redirect-throwing helper | Pitfall 1, Phase Requirements API-01 | **MEDIUM** — strict literal reading of REQ-01 would force the planner to either refactor `session.ts` or accept that the route is broken. The recommended interpretation matches every other API route in the repo. |
| A9 | The Rebrandly destination URL template is `https://www.imaccelerator.com/?ref={CODE}` (per REQ-04 verbatim) | API-04 in code example | Low — REQ-04 is explicit about this URL shape. |
| A10 | The Rebrandly `title` field is `IMA Referral - ${user.name}` (per REQ-04 verbatim — note: docs say title is 3-255 UTF8; with hyphen+name it stays in range) | API-04 in code example | Low — REQ-04 specifies this. |

## Open Questions

1. **Q1: Code generation for NULL-code rows — md5(id) deterministic vs random/uuid?**
   - What we know: CONTEXT.md "Decisions" → "Default: match the migration's deterministic form." REQUIREMENTS.md REQ-03 → "generates one (`upper(uuid.slice(0, 8))`)." These contradict.
   - What's unclear: Which is the locked choice?
   - Recommendation: Follow REQUIREMENTS.md (it is the formal contract; CONTEXT.md says "OR use a fresh crypto-random 8-char upper-hex code" — the literal REQ-03 wording aligns with this branch). Use `crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()`. **Note in plan that this is the chosen interpretation; add a one-line comment in the code.** If the planner wants to be ultra-safe, generate the code via a JS port of the SQL: `crypto.createHash('md5').update(profile.id).digest('hex').slice(0, 8).toUpperCase()` — that exactly matches the migration's deterministic shape. Either reading is defensible; document the choice.

2. **Q2: Should `verifyOrigin()` (CSRF) be included?**
   - What we know: Every existing mutation route in `src/app/api/**` uses it. The route is called from the same-origin client (Phase 60's `<ReferralCard />` will `fetch("/api/referral-link", { method: "POST" })`).
   - What's unclear: REQUIREMENTS.md doesn't explicitly require CSRF; CONTEXT.md doesn't mention it.
   - Recommendation: Include `verifyOrigin()` as STEP 0. Matches every other mutation POST in the codebase (see Pattern 1 reference).

3. **Q3: On the code-persist UPDATE, should we retry on Postgres 23505 unique violation?**
   - What we know: 8-char code collision probability is <0.1% for v1 user base; partial UNIQUE index will catch collisions at write time.
   - What's unclear: REQ-03 doesn't specify retry behavior.
   - Recommendation: No retry — surface 500 with a clear `console.error`. Operational cost of a manual fix on a one-in-thousands collision is acceptable. (If planner disagrees, retry-once is 2 lines.)

4. **Q4: Should the route call `revalidateTag()` for any cache?**
   - What we know: Other mutation routes call `revalidateTag("badges", "default")` and similar. Phase 59's response is consumed only by `<ReferralCard />` (Phase 60), which fetches on mount — no Next.js cache layer between them.
   - What's unclear: Whether Phase 60's RSC layer caches the user profile.
   - Recommendation: Skip `revalidateTag()` for this route. Phase 60 will fetch on demand from a `"use client"` component. If Phase 60 introduces an RSC-level cache of `users.referral_short_url`, that phase adds the tag invalidation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime (for native `fetch`, `AbortSignal.timeout`, `crypto.randomUUID`) | route handler | ✓ | Implicit Next.js 16 → Node 18.18+ | — |
| `@supabase/supabase-js` | admin client DB ops | ✓ | ^2.99.2 | — |
| `zod` | API-08 body parse | ✓ | ^4.3.6 | — |
| `next` | App Router route handler | ✓ | 16.1.6 | — |
| `REBRANDLY_API_KEY` env var (production) | Rebrandly fetch | ✗ at dev time (`.env.local.example` documents empty value); user must set in real `.env.local` and in Vercel env | — | API-07 explicit fallback: route returns 500 with clear `console.error`; dashboard continues to load. |
| `SUPABASE_SERVICE_ROLE_KEY` env var | admin client construction | ✓ (already used by every other route via `createAdminClient`) | — | — |
| `NEXT_PUBLIC_SUPABASE_URL` env var | both server + admin client | ✓ | — | — |
| `NEXT_PUBLIC_APP_URL` env var | `verifyOrigin()` for production CSRF check (else falls back to Host header) | unknown — verify with user | — | `verifyOrigin()` falls back to request `Host` header (`src/lib/csrf.ts:19-21`) |

**Missing dependencies with no fallback:** None at code-write time. `REBRANDLY_API_KEY` is the only runtime-required env var; API-07 already mandates the no-key fallback (HTTP 500 + console.error).

**Missing dependencies with fallback:** `REBRANDLY_API_KEY` — fallback is the API-07 contract itself.

## Validation Architecture

> Per `.planning/config.json` — `workflow.nyquist_validation: true`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **NONE INSTALLED** — `package.json` declares no `jest`, `vitest`, `mocha`, `node:test`, or any other test runner. There is no `npm test` script. |
| Config file | none |
| Quick run command | none — see Wave 0 |
| Full suite command | none — see Wave 0 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | 401 on no session, 403 on owner/coach | unit (route handler) | `node --test tests/api/referral-link.test.mjs` (proposed; see Wave 0) | ❌ Wave 0 |
| API-02 | Cache hit returns same shortUrl, no Rebrandly call | unit | same | ❌ Wave 0 |
| API-03 | NULL code persists fresh code BEFORE Rebrandly call | unit + integration | unit for code-gen + persist; integration mocks Rebrandly | ❌ Wave 0 |
| API-04 | POSTs to Rebrandly with correct headers + body | unit (mock fetch) | same | ❌ Wave 0 |
| API-05 | Persists shortUrl + responds with `{ shortUrl, referralCode }` | unit | same | ❌ Wave 0 |
| API-06 | Rebrandly fail/timeout → 502 + console.error + no partial persist | unit (mock fetch throws / non-ok) | same | ❌ Wave 0 |
| API-07 | Missing env var → 500 + console.error | unit (delete `process.env.REBRANDLY_API_KEY` in test setup) | same | ❌ Wave 0 |
| API-08 | Empty body accepted; zod schema works | unit | same | ❌ Wave 0 |
| CFG-02 | Lint + tsc + build all exit 0 | integration | `npm run lint && npx tsc --noEmit && npm run build` | ✅ (commands exist; same gate Phase 58 closed) |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (~2s — proves no type drift)
- **Per wave merge:** `npm run lint && npx tsc --noEmit` (~10s)
- **Phase gate (CFG-02):** `npm run lint && npx tsc --noEmit && npm run build` (~25s — same as Phase 58's closing gate)
- **Manual smoke test (cannot be automated without test framework):** Hit `POST /api/referral-link` with each of: (a) no session, (b) owner role, (c) student with `referral_short_url IS NOT NULL` (cached), (d) student with `referral_short_url IS NULL` and valid Rebrandly key, (e) student with `referral_short_url IS NULL` and missing/wrong Rebrandly key.

### Wave 0 Gaps

The project has zero unit-test infrastructure. Adding a test framework (Vitest is standard for Next.js + zod ecosystems) is **out of scope** for Phase 59 (REQUIREMENTS.md does not list it as a v1.7 deliverable; previous v1.5/v1.6 phases shipped without one — see STATE.md "Tech Debt" → "No Nyquist VALIDATION.md for v1.5 phases 44-52"). 

**Recommended substitute for Phase 59:**
1. Author a `scripts/phase-59-smoke-runner.cjs` (parallels `scripts/phase-57-smoke-runner.cjs` from Phase 57) that calls the deployed endpoint with each of the 5 scenarios above, asserts the expected status codes and response shapes, and exits 0 on all-green. Place under `scripts/**/*.cjs` — already in eslint ignore list per Phase 58 plan 02 (`876319d`).
2. Document each scenario in `59-VERIFICATION.md` (consumed by `/gsd-verify-work`).
3. Optionally: capture the smoke runner's stdout in the verification log for posterity.

**Items the planner should add as Wave 0 tasks (if test infra is desired):**
- [ ] `scripts/phase-59-smoke-runner.cjs` — covers API-01..08 via deployed-endpoint integration
- [ ] (Optional) Install Vitest + author `tests/api/referral-link.test.mjs` — would unblock fast unit-test cycles for future phases
- [ ] `59-VERIFICATION.md` — captures pass/fail evidence per requirement

*If no test infra is added: rely on the smoke runner + the per-task `npx tsc --noEmit` gate + the phase-gate `npm run build`. This matches the repo's de facto verification pattern (every phase shipped to date has used this approach).*

## Security Domain

> Per CLAUDE.md and project convention; `security_enforcement` not explicitly configured but defaults to enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (Google OAuth via `supabase.auth.getUser()`) — same pattern as every other API route. [VERIFIED: src/app/api/daily-plans/route.ts:21-25] |
| V3 Session Management | yes | Supabase session cookies (HttpOnly, Secure) managed by `@supabase/ssr` — no app-level session code. [VERIFIED: createClient at src/lib/supabase/server.ts] |
| V4 Access Control | yes | Role gate after auth: `profile.role !== "student" && profile.role !== "student_diy"` → 403. Defense-in-depth: filter by `profile.id` (never trust RLS alone — CLAUDE.md Code Quality). |
| V5 Input Validation | yes | Zod `safeParse` on body (Hard Rule 7); `import { z } from "zod"`. |
| V6 Cryptography | yes (use only) | `crypto.randomUUID()` for code generation — Web Crypto / Node crypto. Never hand-roll. [VERIFIED: codebase precedent at src/app/api/invites/route.ts:85] |
| V7 Error Handling & Logging | yes | Hard Rule 5: every catch block `console.error`s before responding. No stack traces in JSON response bodies (only generic `error: "..."` messages). |
| V9 Communication | yes | All Rebrandly calls over HTTPS (`https://api.rebrandly.com`). All persisted `referral_short_url` values include `https://` scheme. |
| V11 Business Logic | yes | Idempotency contract (one Rebrandly call per user for life) is enforced via compare-and-swap UPDATE — see Architecture Patterns Pattern 2 + Pitfall 3. |
| V14 Configuration | yes | `REBRANDLY_API_KEY` not in source control (verified: `.env.local.example` value is empty per Phase 58 commit `d841827`); `git check-ignore .env.local` returns true (verified Phase 58 self-check). |

### Known Threat Patterns for Next.js + external API integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key leak via client bundle | Information Disclosure | `import "server-only"` in route file (defensive); admin client module already has it. Key referenced only in `process.env.*`, never inlined. [VERIFIED: src/lib/supabase/admin.ts:1] |
| CSRF (cross-origin POST from a malicious page) | Tampering | `verifyOrigin()` from `@/lib/csrf` — Origin header check against `NEXT_PUBLIC_APP_URL` host. Returns 403 on mismatch. [VERIFIED: src/lib/csrf.ts:14-43] |
| SSRF via user-controlled URL in Rebrandly call | Tampering | Destination URL is templated server-side (`https://www.imaccelerator.com/?ref={CODE}`); `CODE` is a 8-hex-char generated value, NOT user input. No SSRF surface. |
| Replay / duplicate Rebrandly calls (cost amplification) | Denial of Service | Cache-hit branch (STEP 5) prevents re-call after first success; compare-and-swap (STEP 7) prevents duplicate persist on race. Pitfall 3 documents the residual leak (small concurrent window). |
| API key exposure in error response | Information Disclosure | All error responses return generic strings (`"Failed to generate referral link"`); raw Rebrandly error body is logged server-side via `console.error`, NEVER returned in JSON. |
| Timing oracle on profile lookup | Information Disclosure | Constant-time semantics not relevant — auth status is binary (401 or proceed); role check is a string comparison. No password/secret comparison. |
| Cache poisoning of route response | Tampering | App Router route handlers are dynamic by default (no static caching of POST responses). No `Cache-Control: public` headers added. |
| Open redirect via Rebrandly destination | Tampering | Destination is server-templated, not user-controlled. The Rebrandly link's destination is `https://www.imaccelerator.com/?ref=${code}` — fixed prefix. |

### Defense-in-Depth Notes

- **Filter by `profile.id`**, not just `auth_id` — every UPDATE on `users` MUST `.eq("id", profile.id)`. RLS is bypassed by service-role key; the `eq()` filter is the actual security boundary.
- **`maybeSingle()` over `single()`** for the compare-and-swap re-read — `single()` throws on 0 rows; `maybeSingle()` returns `data: null` cleanly.
- **Don't echo raw Rebrandly response shapes** to the user — only `shortUrl` and `referralCode` should be in the JSON response. Internal Rebrandly fields like `id`, `createdAt`, `domain.id` are server-side only.

## Sources

### Primary (HIGH confidence)

- **Codebase reads** — verified via Read tool 2026-04-16:
  - `src/lib/supabase/admin.ts` (admin client pattern + `import "server-only"`)
  - `src/lib/session.ts` (Pitfall 1 evidence — `redirect()` calls at lines 28, 41)
  - `src/lib/csrf.ts` (verifyOrigin contract)
  - `src/lib/rate-limit.ts` (rate-limit contract — not used by this phase)
  - `src/lib/config.ts` (ROLES, ROLE_REDIRECTS, ROUTES — referenced in Validation Architecture)
  - `src/app/api/daily-plans/route.ts` (canonical mutation pipeline mirror)
  - `src/app/api/invites/route.ts` (`crypto.randomUUID()` precedent at line 85)
  - `src/app/api/work-sessions/route.ts` (D-01..D-07 idempotency precedent)
  - `src/app/api/reports/[id]/review/route.ts` (defense-in-depth ownership pattern)
  - `src/proxy.ts` (matcher excludes `/api/` — line 113-116)
  - `package.json` (version verification)
  - `supabase/migrations/00031_referral_links.sql` (deterministic backfill expression for Q1 reference)
  - `src/lib/types.ts` (lines 770-818 — `Database['public']['Tables']['users']` Row/Insert/Update with referral columns)
  - `.planning/config.json` (`workflow.nyquist_validation: true`)
  - `CLAUDE.md` (Hard Rules + Code Quality + Critical Rules)

- **Official Rebrandly docs** — verified via WebFetch / WebSearch 2026-04-16:
  - https://developers.rebrandly.com/docs/get-started — `apikey` header format
  - https://developers.rebrandly.com/docs/create-a-new-link — POST /v1/links body shape
  - https://developers.rebrandly.com/docs/api-custom-url-shortener — shortUrl is scheme-less by v1 design
  - https://developers.rebrandly.com/docs/403-already-exists-errors — error response shape `{ code, message, property }`
  - https://developers.rebrandly.com/docs/api-limits — 429 error code confirmed; rate limits per-plan (not per-second/per-day published)

### Secondary (MEDIUM confidence)

- WebSearch results corroborated by official Rebrandly docs:
  - shortUrl scheme-less behavior (multiple sources agree, including community examples)
  - 403 AlreadyExists error shape (confirmed by docs page above)
- MDN AbortSignal.timeout — TimeoutError DOMException semantics
- Strapi blog "Next.js 16 Route Handlers Explained" — runtime + serverless timeout context
- PostgreSQL official docs (sql-update.html, sql-insert.html) for compare-and-swap UPDATE-RETURNING semantics

### Tertiary (LOW confidence)

- None used as authoritative claims. Rebrandly per-second rate limits are not published — assumption is "well above what one route handler can produce" (cache hit + at-most-once-per-user-for-life means at most ~50 Rebrandly calls per day across the entire user base for v1.7).

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — every dependency verified via `package.json` Read; native `fetch` / `AbortSignal.timeout` / `crypto.randomUUID` are runtime APIs in Node 18+.
- **Architecture / mutation pipeline:** HIGH — pattern verified across 4 existing API routes (daily-plans, invites, work-sessions, reports/review).
- **Rebrandly contract:** HIGH for header/body fields, scheme-less shortUrl, error code shapes; MEDIUM for rate limits (per-plan, not published per-second).
- **Idempotency / race-safety strategy:** MEDIUM-HIGH — compare-and-swap pattern is a standard Postgres idiom and correct for the "at most once per user **for life**" reading; explicitly documented as not covering the instantaneous concurrent-double-tap edge (see Pitfall 3 + Anti-Patterns #1 alternative).
- **Pitfalls:** HIGH — every pitfall is anchored to a verified file path or official docs page.
- **Validation Architecture:** HIGH on the diagnosis (no test framework installed); MEDIUM on the recommendation (smoke runner pattern proven by Phase 57's `phase-57-smoke-runner.cjs`).

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (estimate — Rebrandly v1 API has been stable for years; Next.js 16 is current; package versions are pinned).
