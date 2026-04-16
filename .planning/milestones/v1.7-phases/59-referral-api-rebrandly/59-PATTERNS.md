# Phase 59: Referral API + Rebrandly - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 2 (1 route handler + 1 smoke runner)
**Analogs found:** 2 / 2 (both exact)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/api/referral-link/route.ts` (CREATE) | route handler (App Router POST) | request-response + external HTTP integration + idempotent CRUD | `src/app/api/daily-plans/route.ts` | **exact** (same role: student/student_diy gate, same pipeline: CSRF → auth → role → body → zod → DB idempotency; adds outbound `fetch` which has no prior analog) |
| `scripts/phase-59-smoke-runner.cjs` (CREATE, optional per RESEARCH Wave 0) | smoke verification runner (CommonJS CLI) | batch / read-only assertions against deployed DB | `scripts/phase-57-smoke-runner.cjs` | **exact** (same shape: shebang, env loader, supabase-js client, record() helper, record-and-exit pattern) |

**Secondary references (not primary analogs, but consulted):**
- `src/app/api/invites/route.ts` — confirms `crypto.randomUUID().replace(/-/g, "").slice(0, 16)` precedent (line 85). Phase 59 uses the same idiom but `.slice(0, 8)` per REQ-03.
- `src/app/api/work-sessions/route.ts` — confirms the pipeline verbatim (CSRF → auth+role → rate-limit → body → zod → DB) for a second student/student_diy-gated POST.
- `src/lib/csrf.ts` — authoritative source of the `verifyOrigin()` contract (returns `NextResponse` on fail, `null` on pass).
- `src/lib/supabase/admin.ts` — admin client with `import "server-only"` guard already in place.

---

## Pattern Assignments

### `src/app/api/referral-link/route.ts` (route handler, request-response + external HTTP)

**Analog:** `src/app/api/daily-plans/route.ts`

#### Imports pattern (daily-plans:1-9)

```typescript
import { z } from "zod";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";            // ◄── Phase 59 DROPS this (no cache tag per RESEARCH Q4)
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";     // ◄── Phase 59 DROPS (per REQUIREMENTS "Out of Scope")
import { verifyOrigin } from "@/lib/csrf";
```

**Phase 59 import list:**
```typescript
import "server-only";                                   // ◄── ADD defensively (Pitfall 4)
import { z } from "zod";                                // Hard Rule 7 — never "zod/v4"
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOrigin } from "@/lib/csrf";
```

#### CSRF gate pattern (daily-plans:16-18)

```typescript
// 1. CSRF — cheapest check first
const csrfError = verifyOrigin(request);
if (csrfError) return csrfError;
```

**Copy verbatim.** Same first-step ordering.

#### Auth + role pipeline (daily-plans:20-36)

```typescript
// 2. Auth
const supabase = await createClient();
const {
  data: { user: authUser },
} = await supabase.auth.getUser();
if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 3. Role check — student only
const admin = createAdminClient();
const { data: profile } = await admin
  .from("users")
  .select("id, role")                                   // ◄── Phase 59 EXPANDS: "id, name, role, referral_code, referral_short_url"
  .eq("auth_id", authUser.id)
  .single();
if (!profile || (profile.role !== "student" && profile.role !== "student_diy")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Copy verbatim**, then widen the `.select()` to include `name, referral_code, referral_short_url` so the cache-hit branch can respond without a second DB round-trip. Role gate list (`student` + `student_diy`) is identical.

**CRITICAL — Pitfall 1 from RESEARCH:** Do NOT use `getSessionUser()` from `src/lib/session.ts`. It `redirect()`s and will break the 401 contract. Use the inline `supabase.auth.getUser()` + admin lookup above.

#### Body parse + Zod pattern (daily-plans:50-65)

```typescript
// 5. Parse body
let body: unknown;
try {
  body = await request.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}

// 6. Zod validation
const parsed = postBodySchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: "Invalid input", details: parsed.error.flatten() },
    { status: 400 }
  );
}
```

**Copy with one deviation for Phase 59** (Pitfall 8 — empty body allowed):

```typescript
const bodySchema = z.object({}).strict();
let body: unknown = {};
try { body = await request.json(); } catch { body = {}; }
const parsed = bodySchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid input" }, { status: 400 });
}
```

The `catch { body = {} }` (not `return 400`) is the key deviation: Phase 60's `fetch("/api/referral-link", { method: "POST" })` sends no body.

#### DB idempotency pattern (daily-plans:67-92 — unique-violation re-read)

```typescript
const { data: inserted, error: insertError } = await admin
  .from("daily_plans")
  .insert({ student_id: profile.id, date: today, plan_json: parsed.data.plan_json })
  .select()
  .single();

if (insertError) {
  if (insertError.code === "23505") {
    // Unique constraint violation — return existing plan
    const { data: existing } = await admin
      .from("daily_plans")
      .select()
      .eq("student_id", profile.id)
      .eq("date", today)
      .single();
    return NextResponse.json({ data: existing }, { status: 200 });
  }
  console.error("[daily-plans POST] Insert failed:", insertError);
  return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
}
```

**Adapt the "on conflict, re-read, return existing" idiom for Phase 59's compare-and-swap UPDATE** (RESEARCH Pattern 2):

```typescript
// STEP 7 — race-safe persist using CAS (WHERE referral_short_url IS NULL)
const { data: persisted, error: persistError } = await admin
  .from("users")
  .update({ referral_short_url: shortUrl })
  .eq("id", profile.id)
  .is("referral_short_url", null)                       // ◄── CAS predicate
  .select("referral_short_url")
  .maybeSingle();                                        // ◄── maybeSingle (not single) — 0 rows is a valid branch

if (persistError) {
  console.error("[POST /api/referral-link] Persist failed:", persistError);
  return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
}

if (!persisted) {
  // Concurrent writer won — re-read and return their value (same shape as daily-plans' re-read branch)
  const { data: winner } = await admin
    .from("users")
    .select("referral_short_url")
    .eq("id", profile.id)
    .single();
  if (winner?.referral_short_url) {
    return NextResponse.json({ shortUrl: winner.referral_short_url, referralCode }, { status: 200 });
  }
  console.error("[POST /api/referral-link] Lost CAS but no winner found");
  return NextResponse.json({ error: "Failed to save referral link" }, { status: 500 });
}
```

#### Error handling pattern (daily-plans:90-91)

```typescript
console.error("[daily-plans POST] Insert failed:", insertError);
return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
```

**Log prefix convention:** `[<route-name> <METHOD>]` or `[<METHOD> <path>]` — both forms present in codebase. Phase 59 use `[POST /api/referral-link]` (matches invites/route.ts:104 `[POST /api/invites]`). **Copy verbatim:** every catch block `console.error`s with context BEFORE returning the error response (Hard Rule 5).

#### Success response pattern (daily-plans:95)

```typescript
return NextResponse.json({ data: inserted }, { status: 201 });
```

**Phase 59 DEVIATES from `{ data: ... }` envelope** because the REQ-05 contract is exactly `{ shortUrl, referralCode }` (no envelope):

```typescript
return NextResponse.json({ shortUrl, referralCode }, { status: 200 });
```

Status is `200` for both cache-hit and fresh-create branches (idempotent success, no "new resource" semantics).

---

#### Secondary reference — `crypto.randomUUID()` precedent from `src/app/api/invites/route.ts:85`

```typescript
const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
```

**Phase 59 adapts to 8 chars + uppercase** (REQ-03 wording `upper(uuid.slice(0, 8))`):

```typescript
const referralCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
```

Already in the codebase — no new pattern to invent.

---

### `scripts/phase-59-smoke-runner.cjs` (smoke runner, batch read-only)

**Analog:** `scripts/phase-57-smoke-runner.cjs`

#### Shebang + header pattern (phase-57-smoke-runner.cjs:1-9)

```javascript
#!/usr/bin/env node
/**
 * Phase 57 smoke runner — executes the verification queries from
 * scripts/phase-57-smoke.sql against the linked Supabase project using
 * supabase-js (no psql required).
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Outputs JSON to stdout that can be pasted into the SMOKE-RESULTS.md.
 */
```

**Copy verbatim, adapt title.** CommonJS `.cjs` extension is critical — already in eslint ignore per Phase 58 commit `876319d`.

#### Env loader pattern (phase-57-smoke-runner.cjs:10-29)

```javascript
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
```

**Copy verbatim** + `REBRANDLY_API_KEY` if the smoke runner needs to call the deployed endpoint directly (not just DB). **Adaptation:** Phase 59's runner can be pure-DB (read `users.referral_short_url` for test fixtures and assert shape) OR HTTP (POST to deployed `/api/referral-link` with test-user cookies). **Recommended:** pure-DB assertions (simpler, no auth-cookie ceremony), with HTTP-level checks performed via the manual checklist in `59-VERIFICATION.md`.

#### Record + exit pattern (phase-57-smoke-runner.cjs:31-36, 265-268)

```javascript
const results = [];

function record(name, expected, observed, pass, extra) {
  results.push({ name, expected, observed, result: pass ? "PASS" : "FAIL", ...(extra || {}) });
}

// ... per-check async blocks that call record() ...

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.result === "FAIL").length;
process.exit(failed > 0 ? 1 : 0);
```

**Copy verbatim.** Same JSON-array-to-stdout + non-zero-exit-on-any-FAIL contract lets a CI step grep for `"result": "FAIL"` and fail the phase gate.

#### Per-check async block pattern (phase-57-smoke-runner.cjs:38-51)

```javascript
(async () => {
  // SMOKE 1: MAX(step_number) = 16
  try {
    const { data, error } = await sb
      .from("roadmap_progress")
      .select("step_number")
      .order("step_number", { ascending: false })
      .limit(1);
    if (error) throw error;
    const max = data?.[0]?.step_number ?? null;
    record("SMOKE 1: max_step_number", 16, max, max === 16);
  } catch (e) {
    record("SMOKE 1: max_step_number", 16, null, false, { error: String(e.message || e) });
  }
  // ... more checks ...
})();
```

**Copy verbatim.** Each check wrapped in its own try/catch so one failing check doesn't abort the others — matches phase-57's defensive pattern.

#### Phase 59 smoke checks (suggested, following phase-57's numbered style)

| Check | Expected | Method |
|-------|----------|--------|
| SMOKE 1: referral_code backfill complete | all `student` + `student_diy` rows have non-null `referral_code` | `.from("users").select("id, role, referral_code").in("role", ["student","student_diy"])` then assert none are null |
| SMOKE 2: referral_code uniqueness | zero duplicate `referral_code` values in `users` | fetch non-null codes, check `Set.size === array.length` |
| SMOKE 3: referral_code length | every non-null code is exactly 8 upper-hex chars | regex `/^[0-9A-F]{8}$/` on each backfilled code |
| SMOKE 4: referral_short_url scheme (post-deploy) | every non-null `referral_short_url` starts with `https://` | filter rows with non-null short_url, assert prefix |
| SMOKE 5: owner/coach untouched | owner + coach rows have null `referral_code` AND null `referral_short_url` | Phase 58 invariant — re-verify here |

Checks 1-3 + 5 verify Phase 58's backfill held; check 4 verifies Phase 59's own persistence invariant.

---

## Shared Patterns

### Pattern A: Admin client only for DB touches in API routes

**Source:** `src/lib/supabase/admin.ts` (+ every file in `src/app/api/**`)
**Apply to:** all three DB operations in Phase 59's route (profile read, referral_code persist, referral_short_url persist)

```typescript
const admin = createAdminClient();
const { data, error } = await admin
  .from("users")
  .select(...)
  .eq("id", profile.id)   // ◄── ALWAYS filter by profile.id — never rely on RLS alone
  .single();
```

Hard Rule 4 enforcement. The admin module already has `import "server-only"` at line 1.

### Pattern B: Log-before-respond for every error

**Source:** `src/app/api/daily-plans/route.ts:90`, `src/app/api/invites/route.ts:104`, `src/lib/csrf.ts:31-33`
**Apply to:** every catch block and every `if (error)` branch in Phase 59

```typescript
console.error("[POST /api/referral-link] <what failed>:", err);
return NextResponse.json({ error: "<generic user-facing message>" }, { status: <code> });
```

Hard Rule 5 enforcement. Always log the raw error server-side; never leak its details in the JSON response body.

### Pattern C: CSRF as step 0 for every mutation POST

**Source:** `src/lib/csrf.ts` + `src/app/api/daily-plans/route.ts:16-18` + every other POST in `src/app/api/**`
**Apply to:** Phase 59's POST handler

```typescript
const csrfError = verifyOrigin(request);
if (csrfError) return csrfError;
```

Every existing mutation POST includes this. RESEARCH Q2 recommends keeping it — matches the codebase convention.

### Pattern D: `response.ok` gate before JSON parse (outbound fetch)

**Source:** CLAUDE.md Hard Rule 6 (no existing analog — this is the first outbound HTTP call in the codebase)
**Apply to:** the Rebrandly fetch in Phase 59

```typescript
const rbResponse = await fetch(url, { ... });
if (!rbResponse.ok) {
  const errText = await rbResponse.text().catch(() => "<unreadable>");
  console.error("[POST /api/referral-link] Rebrandly non-OK:", rbResponse.status, rbResponse.statusText, errText);
  return NextResponse.json({ error: "Failed to generate referral link" }, { status: 502 });
}
const rbBody = await rbResponse.json();
```

**No codebase analog exists** — this phase introduces the pattern for future external-API integrations. The pattern is fully specified in RESEARCH.md Pattern 3 (lines 322-367).

---

## Pitfalls to Avoid When Mirroring Analogs

These deviations from the analog are required — the planner must NOT blindly copy-paste daily-plans:

1. **Do NOT import `checkRateLimit`** (present in daily-plans:6). Phase 59 drops it per RESEARCH "Out of Scope."
2. **Do NOT import `revalidateTag`** (present in daily-plans:3). Phase 59 drops it per RESEARCH Q4 — Phase 60's `"use client"` component fetches on demand, no RSC cache to invalidate.
3. **Do NOT use the `{ data: ... }` envelope** in the 200 response (daily-plans:88, 95). Phase 59 response shape is exactly `{ shortUrl, referralCode }` per REQ-05.
4. **Do NOT use status 201** (daily-plans:95). Phase 59 always returns 200 — "at most one Rebrandly call per user for life" means both cache-hit and fresh-create have idempotent semantics.
5. **Do NOT `return 400` on empty body** (daily-plans:55 does this via rethrown SyntaxError). Phase 59's UI sends no body — catch the SyntaxError and treat as `{}` (Pitfall 8 from RESEARCH).
6. **Do NOT use `.single()` on the CAS UPDATE** re-read — use `.maybeSingle()`. `.single()` throws on 0 rows; the CAS branch explicitly expects `data: null` when another writer won.
7. **Do NOT use `getSessionUser()` from `@/lib/session`** — it `redirect()`s on no-session (src/lib/session.ts:28) and breaks the 401 contract. Every existing API route (including daily-plans) inlines `supabase.auth.getUser()` + admin profile lookup instead. REQ-01's `getSessionUser()` mention is conceptual, not literal (RESEARCH Pitfall 1).
8. **Do NOT persist `rbBody.shortUrl` as-is** — it is scheme-less per Rebrandly v1 design (`rebrand.ly/abc` not `https://rebrand.ly/abc`). Prepend `https://` before the UPDATE (RESEARCH Pitfall 2).
9. **Do NOT use `process.env.REBRANDLY_API_KEY!`** (non-null assertion). TypeScript strict types it as `string | undefined` — explicitly guard and early-return 500 (RESEARCH Pitfall 7).
10. **Do NOT omit `AbortSignal.timeout(8000)`** on the Rebrandly fetch. Missing timeout + Vercel hobby 10s platform timeout = user sees TCP reset instead of your 502 (RESEARCH Pitfall 6).

For the smoke runner:

11. **Do NOT use `.mjs` or `.js` extension** — eslint ignore from Phase 58 commit `876319d` is scoped to `scripts/**/*.cjs` only. Use `.cjs`.
12. **Do NOT `import { createClient }`** — use `const { createClient } = require("@supabase/supabase-js")` (CommonJS). Matches phase-57-smoke-runner.cjs:12.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(Rebrandly fetch block within `route.ts`)* | external HTTP client | request-response outbound | **No prior outbound HTTP call in the codebase.** The full pattern (timeout + ok check + try/catch + scheme prepend) is specified in RESEARCH.md Pattern 3 (lines 322-367) and must be implemented from that spec rather than from a codebase analog. |

This is the only net-new sub-pattern Phase 59 introduces; everything else mirrors existing code.

---

## Metadata

**Analog search scope:** `src/app/api/**/route.ts` (all 9 existing route handlers checked), `src/lib/csrf.ts`, `src/lib/supabase/admin.ts`, `src/lib/session.ts` (for Pitfall 1 evidence), `scripts/**/*.cjs` (1 existing — phase-57 runner).
**Files scanned (via Read):** 5 (daily-plans/route.ts, invites/route.ts, work-sessions/route.ts head, csrf.ts, admin.ts, phase-57-smoke-runner.cjs).
**Pattern extraction date:** 2026-04-16
**Primary analog confidence:** HIGH — daily-plans/route.ts is the canonical student/student_diy-gated mutation POST; every step of Phase 59's pipeline has a line-number-anchored origin in the file.
