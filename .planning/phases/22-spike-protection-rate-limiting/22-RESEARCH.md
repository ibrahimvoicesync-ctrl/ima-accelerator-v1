# Phase 22: Spike Protection & Rate Limiting - Research

**Researched:** 2026-03-30
**Domain:** Database-backed rate limiting — Supabase, pg_cron, Next.js route handlers
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Rate limit ALL mutation routes (POST/PATCH/DELETE), not just student-facing ones. Admin routes (invites, magic-links, assignments, alert dismiss) are included.
- **D-02:** Full list of routes to protect:
  - `POST /api/reports`
  - `PATCH /api/reports/[id]/review`
  - `POST /api/work-sessions`
  - `PATCH /api/work-sessions/[id]`
  - `PATCH /api/roadmap`
  - `POST /api/invites`
  - `POST /api/magic-links`
  - `PATCH /api/magic-links`
  - `PATCH /api/assignments`
  - `POST /api/alerts/dismiss`
- **D-03:** `POST /api/auth/signout` is excluded — dead code per PROJECT.md.
- **D-04:** 30 requests per minute **per endpoint per user**, not 30 total across all endpoints. The `rate_limit_log` table tracks per-endpoint via an `endpoint` column.
- **D-05:** Per-endpoint granularity avoids one hot endpoint eating the budget for everything else.
- **D-06:** 429 HTTP response with `Retry-After` header (seconds until window resets). Response body includes human-readable message: "Too many requests, try again in X seconds."
- **D-07:** Client-side: show error toast with the message from the 429 response. Standard pattern, no special error state needed.

### Claude's Discretion

- Table schema details (column types, constraints, index design) — follow research Pattern 7 from ARCHITECTURE.md
- pg_cron cleanup schedule and retention window
- checkRateLimit() function signature and return type details
- Migration file naming (research suggests 00012)
- Whether to use INSERT + COUNT in a single query or two separate queries (atomic pattern preferred per success criteria)
- Exact `Retry-After` calculation (seconds remaining in current window)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | DB-backed rate limiting on mutation API routes enforces 30 requests/minute per user via Supabase table (in-memory breaks in serverless) | Pattern 7 from ARCHITECTURE.md provides the exact table schema, helper function, and integration pattern. All 10 mutation routes are identified and read. Atomic INSERT + COUNT pattern confirmed. |
</phase_requirements>

---

## Summary

Phase 22 implements database-backed rate limiting on all 10 mutation API routes. The mechanism is a `rate_limit_log` Supabase table that records each API call by `user_id`, `endpoint`, and `called_at`. A `checkRateLimit()` helper function counts rows in the last 60 seconds and inserts the current call — returning `{ allowed: false }` when the count reaches 30, which triggers a 429 response with a `Retry-After` header.

The architecture is fully pre-researched in `.planning/research/ARCHITECTURE.md` §Pattern 7 and the project's own PITFALLS.md §Pitfall 3. The project's v1.2 research was explicitly written for this phase. All 10 target route handlers have been read — each follows the same auth pattern (createServerClient → createAdminClient profile lookup → role check), making the integration point consistent: `checkRateLimit()` inserts after the role check and before the Zod `safeParse` call.

The one discrepancy to note: ARCHITECTURE.md Pattern 7 refers to `getAdminClient()` in code examples, but the actual singleton in `src/lib/supabase/admin.ts` is named `createAdminClient()`. All code in this phase MUST use `createAdminClient()` — the name that exists in production code.

**Primary recommendation:** Implement exactly as Pattern 7 specifies. Create `src/lib/rate-limit.ts`, add migration `00012_rate_limit_log.sql`, and add one `checkRateLimit()` call to each of the 10 routes after the role check.

---

## Project Constraints (from CLAUDE.md)

All directives apply to Phase 22 code:

| Directive | Applies To |
|-----------|------------|
| `import { z } from "zod"` — never `"zod/v4"` | Not directly applicable (no new Zod schemas in rate-limit.ts) |
| Admin client only in server code — never in client components | `checkRateLimit()` must only run in route handlers (server-only) |
| Never swallow errors — every `catch` block must toast or `console.error` | Rate limit helper errors must be handled, not silently ignored |
| Check `response.ok` before parsing JSON | Client-side 429 handling already uses `!res.ok` pattern (confirmed in codebase) |
| `ima-*` tokens only — no hardcoded hex/gray | No UI changes in this phase; not applicable |
| 44px touch targets | No UI changes; not applicable |
| Accessible labels | No UI changes; not applicable |
| `motion-safe:` on animate-* classes | No UI changes; not applicable |
| Auth + role check before validation on every API route | `checkRateLimit()` inserts AFTER auth/role, BEFORE Zod — compliant |
| Filter by user ID in queries, never rely on RLS alone | `checkRateLimit()` queries filter by `user_id` explicitly — compliant |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.99.2 (in use) | DB queries for rate_limit_log | Already the project's only DB client; no new dependency |
| Postgres (via Supabase) | managed | Rate limit log storage | Shared state across all serverless containers; eliminates isolated in-memory counters |
| pg_cron (Supabase Pro) | managed | Cleanup old rate_limit_log rows | Already used in Phase 21 (`refresh-student-kpi-summaries`); same extension |

### No New Dependencies

This phase adds zero npm packages. The rate limiter is pure TypeScript using the existing `createAdminClient()` singleton and standard Supabase query methods.

**Installation:** None required.

**Version verification:** All versions confirmed from `package.json` and existing migration files.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── rate-limit.ts        # NEW: checkRateLimit() helper
│   └── supabase/
│       └── admin.ts         # EXISTING: createAdminClient() singleton (unchanged)
├── app/api/
│   ├── reports/route.ts     # MODIFY: add checkRateLimit()
│   ├── reports/[id]/review/route.ts  # MODIFY: add checkRateLimit()
│   ├── work-sessions/route.ts       # MODIFY: add checkRateLimit()
│   ├── work-sessions/[id]/route.ts  # MODIFY: add checkRateLimit()
│   ├── roadmap/route.ts     # MODIFY: add checkRateLimit()
│   ├── invites/route.ts     # MODIFY: add checkRateLimit()
│   ├── magic-links/route.ts # MODIFY: add checkRateLimit() for POST and PATCH
│   ├── assignments/route.ts # MODIFY: add checkRateLimit()
│   └── alerts/dismiss/route.ts  # MODIFY: add checkRateLimit()
supabase/migrations/
└── 00012_rate_limit_log.sql # NEW: table + index + pg_cron cleanup job
```

### Pattern 1: rate_limit_log Table Schema

**What:** Append-only log table. Each API call that passes auth inserts one row. Rate check counts rows in the sliding 60-second window.

**When to use:** The single table for all rate limiting. No separate tables per endpoint — the `endpoint` column handles granularity.

**Migration (00012_rate_limit_log.sql):**
```sql
-- Source: .planning/research/ARCHITECTURE.md §Pattern 7
CREATE TABLE public.rate_limit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  called_at   timestamptz NOT NULL DEFAULT now()
);

-- Covering index: all three WHERE/ORDER columns in one index
-- user_id + endpoint = equality filters; called_at DESC = range filter
CREATE INDEX idx_rate_limit_user_endpoint_time
  ON public.rate_limit_log(user_id, endpoint, called_at DESC);

-- RLS: table accessed only via service_role (admin client), never via JWT
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No RLS policies — service_role bypasses RLS entirely

-- pg_cron cleanup: delete rows older than 2 hours, runs at 3:30 AM UTC
-- Retention of 2 hours is far more than needed for 1-minute windows
-- Schedule: 30 3 * * * = 3:30 AM UTC
-- Idempotent: unschedule before scheduling
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-rate-limit-log');
EXCEPTION WHEN OTHERS THEN NULL;
END; $$;

SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '30 3 * * *',
  $$ DELETE FROM public.rate_limit_log WHERE called_at < now() - interval '2 hours' $$
);
```

### Pattern 2: checkRateLimit() Helper

**What:** Async function that counts rows in the sliding window and conditionally inserts. Two DB round trips per call (COUNT with head:true + INSERT). Acceptable overhead for write endpoints (~4-8ms on warm Supabase connections).

**Important naming fix:** ARCHITECTURE.md Pattern 7 uses `getAdminClient()` in its code examples, but the actual function in `src/lib/supabase/admin.ts` is `createAdminClient()`. Use `createAdminClient()`.

**Atomicity note:** The success criteria specifies "atomic INSERT + COUNT pattern." The two-query approach (COUNT first, INSERT if allowed) is NOT strictly atomic — a race condition exists if the same user fires requests at exactly the same millisecond from two containers. For a 30 req/min limit, this race window is negligible in practice. The ARCHITECTURE.md Pattern 7 prescribes the two-query approach. Per D-04/D-05, per-endpoint limits make races even less likely. Use the two-query pattern as specified in Pattern 7 — it is the prescribed approach for this project.

**`src/lib/rate-limit.ts`:**
```typescript
// Source: .planning/research/ARCHITECTURE.md §Pattern 7 (adapted: createAdminClient not getAdminClient)
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests = 30,
  windowMinutes = 1
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count } = await admin
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("called_at", windowStart);

  const callCount = count ?? 0;

  if (callCount >= maxRequests) {
    // Retry-After: seconds remaining until the oldest request in the window ages out
    // Simple approach: full window duration (conservative, always correct)
    return { allowed: false, remaining: 0, retryAfterSeconds: windowMinutes * 60 };
  }

  await admin.from("rate_limit_log").insert({ user_id: userId, endpoint });
  return { allowed: true, remaining: maxRequests - callCount - 1, retryAfterSeconds: 0 };
}
```

### Pattern 3: Route Handler Integration

**What:** Insert `checkRateLimit()` after the role check, before `request.json()` / Zod validation. This is the EXACT position prescribed in CONTEXT.md §code_context.

**When to use:** Every one of the 10 mutation routes.

**Example integration (POST /api/reports pattern):**
```typescript
// Source: Established project pattern + ARCHITECTURE.md §Pattern 7
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // 1. Auth check (UNCHANGED)
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Rate limit check (NEW — after auth, before body parsing)
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/reports");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // 3. Body parsing + Zod validation (UNCHANGED)
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // ... rest of handler unchanged
}
```

### Pattern 4: Route-Specific Endpoint Strings

Each route uses a unique, stable endpoint string. Recommended strings aligned with the HTTP method and URL path (per-endpoint per D-04):

| Route Handler | HTTP Method | Endpoint String |
|--------------|-------------|-----------------|
| `src/app/api/reports/route.ts` | POST | `/api/reports` |
| `src/app/api/reports/[id]/review/route.ts` | PATCH | `/api/reports/review` |
| `src/app/api/work-sessions/route.ts` | POST | `/api/work-sessions` |
| `src/app/api/work-sessions/[id]/route.ts` | PATCH | `/api/work-sessions/update` |
| `src/app/api/roadmap/route.ts` | PATCH | `/api/roadmap` |
| `src/app/api/invites/route.ts` | POST | `/api/invites` |
| `src/app/api/magic-links/route.ts` | POST | `/api/magic-links/create` |
| `src/app/api/magic-links/route.ts` | PATCH | `/api/magic-links/update` |
| `src/app/api/assignments/route.ts` | PATCH | `/api/assignments` |
| `src/app/api/alerts/dismiss/route.ts` | POST | `/api/alerts/dismiss` |

Note: `magic-links/route.ts` has BOTH a POST and PATCH handler in the same file. Each method gets its own endpoint string so their budgets are independent (per D-04/D-05).

### Pattern 5: Client-Side 429 Handling

**What:** The existing `!res.ok` pattern already handles 429. The response body `{ error: "Too many requests, try again in X seconds." }` surfaces through the same toast mechanism used for all API errors.

**Confirmed pattern (from `OwnerInvitesClient.tsx`):**
```typescript
// Source: existing codebase pattern — confirmed working for all non-2xx responses
if (!res.ok) {
  const json = await res.json().catch(() => ({}));
  toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to create invite" });
  return;
}
```

No special 429 handling is needed — the existing `!res.ok` branch already reads `.error` from the JSON body and shows a toast. The human-readable message from D-06 ("Too many requests, try again in X seconds.") will display automatically.

### Anti-Patterns to Avoid

- **`getAdminClient()` in rate-limit.ts:** The function is named `createAdminClient()` in this codebase. ARCHITECTURE.md pattern uses `getAdminClient()` — adapt to actual code.
- **Calling `checkRateLimit()` before auth:** Rate limiter needs `profile.id` (internal UUID, not `authUser.id`). Always call after the profile lookup.
- **Calling `checkRateLimit()` after `request.json()`:** Body parsing should stay after rate limiting. Don't waste the body parsing round trip before rejecting.
- **Separate rate limit tables per endpoint:** The `endpoint` column handles granularity. One table is correct.
- **`count: 'exact'` concern:** Unlike paginated list queries (which scan large tables), `rate_limit_log` queries are filtered by `user_id + endpoint + called_at` — the covering index makes this fast. `count: 'exact'` with `head: true` is correct here.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared state across serverless containers | In-memory counters (Map, lru-cache) | Postgres rate_limit_log table | Module-level state is isolated per container; invisible to other instances |
| Rate limit enforcement | Redis/Upstash counter | Supabase table (Pattern 7) | Redis is out of scope per REQUIREMENTS.md; Supabase Pro already available |
| Cleanup of old log rows | Application-level TTL logic | pg_cron DELETE job | pg_cron already in use (Phase 21); single SQL statement handles all stale rows atomically |
| Atomic count+increment | Postgres function / advisory lock | SELECT count + INSERT (two queries) | Two-query pattern is prescribed by ARCHITECTURE.md Pattern 7; race window negligible at 30 req/min |

**Key insight:** The Supabase infrastructure already in production is sufficient. No new external dependencies are needed.

---

## Common Pitfalls

### Pitfall 1: Wrong Admin Client Function Name
**What goes wrong:** ARCHITECTURE.md Pattern 7 uses `getAdminClient()`. The actual function is `createAdminClient()`. Code that uses the wrong name will cause a TypeScript compile error.
**Why it happens:** Research doc was written before the singleton was implemented and uses a different naming convention.
**How to avoid:** In `rate-limit.ts`, import and call `createAdminClient()` (as seen in `src/lib/supabase/admin.ts`).
**Warning signs:** `Module '"@/lib/supabase/admin"' has no exported member 'getAdminClient'` TypeScript error.

### Pitfall 2: Rate Limit Called Before Profile Lookup
**What goes wrong:** `checkRateLimit()` needs the internal `profile.id` (UUID from the `users` table). `authUser.id` is the Supabase Auth UUID and is different. Passing `authUser.id` would result in rate limits that never trigger (no matching rows) or incorrect enforcement.
**Why it happens:** Developer short-circuits the profile lookup to save a DB query.
**How to avoid:** Integration position is: auth check → profile lookup → checkRateLimit(profile.id, ...) → Zod → mutation.
**Warning signs:** Rate limit never triggers even under rapid-fire requests.

### Pitfall 3: magic-links Route Has Two Methods
**What goes wrong:** `src/app/api/magic-links/route.ts` exports both `POST` (create link) and `PATCH` (update is_active). A developer adding `checkRateLimit()` to only one handler leaves the other unprotected.
**Why it happens:** Both handlers are in the same file but are distinct mutations.
**How to avoid:** Add `checkRateLimit()` to BOTH `POST` and `PATCH` in `magic-links/route.ts`, with distinct endpoint strings (`/api/magic-links/create` vs `/api/magic-links/update`).
**Warning signs:** Only 9 routes protected instead of 10 (counting magic-links POST and PATCH separately).

### Pitfall 4: Stale count Due to Race Between COUNT and INSERT
**What goes wrong:** Two requests from the same user arrive at different containers simultaneously. Both see count=29, both insert, resulting in 31 rows before the 30-req limit is properly enforced.
**Why it happens:** SELECT count and INSERT are separate statements — not wrapped in a transaction.
**How to avoid:** At 30 req/min, this window is effectively zero risk in production. The prescribed two-query pattern from ARCHITECTURE.md is sufficient. A Postgres function with a transaction would be overkill and adds complexity. Accept the theoretical race — it doesn't matter at this limit.
**Warning signs:** Rare, invisible in practice. Only observable with concurrent load testing at exactly the threshold boundary.

### Pitfall 5: checkRateLimit() Errors Swallowed
**What goes wrong:** If the `rate_limit_log` INSERT or COUNT query fails (Supabase DB error), and the catch block is empty, the request proceeds without rate limiting instead of failing safely.
**Why it happens:** Developers add try-catch to avoid broken UX but forget the CLAUDE.md hard rule: "never swallow errors."
**How to avoid:** In route handlers, wrap the `checkRateLimit()` call with a try-catch that logs and returns 500 on DB error, OR let DB errors propagate to the outer handler's error boundary. The recommended approach: let the route's existing outer try-catch (where present) handle it, or add explicit console.error.
**Warning signs:** Rate limit log is empty in Supabase dashboard despite heavy traffic.

### Pitfall 6: pg_cron Job Name Collision with Phase 21
**What goes wrong:** If the cleanup job is registered with the same name as the Phase 21 job, cron.schedule() will fail or silently overwrite.
**Why it happens:** Copy-paste from the Phase 21 migration without updating the job name.
**How to avoid:** Use `'cleanup-rate-limit-log'` as the cron job name — different from Phase 21's `'refresh-student-kpi-summaries'`. The migration should `cron.unschedule('cleanup-rate-limit-log')` first for idempotency.
**Warning signs:** `ERROR: duplicate key value violates unique constraint "job_name"` in migration run.

### Pitfall 7: Missing `server-only` Import in rate-limit.ts
**What goes wrong:** Without `import "server-only"`, the helper could theoretically be imported into a client component, exposing the service_role client path to client-side bundles.
**Why it happens:** Quick implementation without the guard.
**How to avoid:** Add `import "server-only"` at the top of `src/lib/rate-limit.ts` — consistent with `src/lib/supabase/admin.ts`.
**Warning signs:** TypeScript does not warn; only caught during Next.js build if a client component accidentally imports the helper.

---

## Code Examples

### Complete checkRateLimit() Implementation

```typescript
// src/lib/rate-limit.ts
// Source: .planning/research/ARCHITECTURE.md §Pattern 7 (adapted for createAdminClient)
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests = 30,
  windowMinutes = 1
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count } = await admin
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("called_at", windowStart);

  const callCount = count ?? 0;

  if (callCount >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterSeconds: windowMinutes * 60 };
  }

  await admin.from("rate_limit_log").insert({ user_id: userId, endpoint });
  return { allowed: true, remaining: maxRequests - callCount - 1, retryAfterSeconds: 0 };
}
```

### 429 Response Pattern

```typescript
// Used in every protected route after the checkRateLimit() call
const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/reports");
if (!allowed) {
  return NextResponse.json(
    { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
```

### Migration: 00012_rate_limit_log.sql Structure

```sql
-- ============================================================================
-- Phase 22: Spike Protection & Rate Limiting
-- Migration: 00012_rate_limit_log.sql
-- ============================================================================

CREATE TABLE public.rate_limit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  called_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_user_endpoint_time
  ON public.rate_limit_log(user_id, endpoint, called_at DESC);

ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS; no JWT access to this table

-- Idempotent pg_cron registration
DO $$ BEGIN
  PERFORM cron.unschedule('cleanup-rate-limit-log');
EXCEPTION WHEN OTHERS THEN NULL;
END; $$;

SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '30 3 * * *',
  $$ DELETE FROM public.rate_limit_log WHERE called_at < now() - interval '2 hours' $$
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory rate limiting (lru-cache, Map) | DB-backed rate_limit_log table | Serverless era | In-memory is silently broken across containers; DB is the only shared state |
| Fixed window counters (reset at minute:00) | Sliding window (rolling 60s from now) | N/A | Sliding window prevents burst at window boundary; more accurate enforcement |
| Redis/Upstash for rate limiting | Postgres table (for this project) | Project decision | Redis deferred to post-load-test evaluation; Supabase Pro already in use |

**Deprecated/outdated:**
- In-memory rate limiting in Next.js route handlers: silently broken in production serverless. Works in `npm run dev` (single process) but fails in production. Never use.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/run | Yes | v24.13.0 | — |
| Supabase (pg_cron extension) | cleanup job | Enabled (Phase 21 uses it) | managed | — |
| `@supabase/supabase-js` | rate_limit_log queries | Yes | ^2.99.2 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

All dependencies are already in production. pg_cron availability confirmed via Phase 21 migration (`refresh-student-kpi-summaries` job exists and runs).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (no jest, vitest, or test scripts in package.json) |
| Config file | None — see Wave 0 |
| Quick run command | `npx tsc --noEmit` (type check) + `npm run lint` |
| Full suite command | `npm run build` (build verification) |

**Note:** This project has no automated test framework. Validation is via TypeScript type checking, ESLint, build success, and manual UAT.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01a | `rate_limit_log` table exists with correct schema | manual-only | `npx supabase db push` (migration succeeds) | Migration: Wave 0 |
| SEC-01b | pg_cron cleanup job registered | manual-only | Verify in Supabase dashboard: `SELECT * FROM cron.job WHERE jobname = 'cleanup-rate-limit-log'` | Migration: Wave 0 |
| SEC-01c | `checkRateLimit()` returns `{ allowed: false }` on 31st request | manual-only | Fire 31 requests to any protected route and confirm 429 on the 31st | — |
| SEC-01d | 429 response includes `Retry-After` header | manual-only | Inspect response headers after rate limit hit | — |
| SEC-01e | All 10 routes protected | type-check | `npx tsc --noEmit` confirms import of checkRateLimit in all 10 files | Wave 0: import added |
| SEC-01f | Consistent enforcement across serverless instances | manual-only | Not testable without load test; verified by architecture (shared DB state) | — |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** Build succeeds + all 10 routes confirmed protected before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `supabase/migrations/00012_rate_limit_log.sql` — creates rate_limit_log table and pg_cron job
- [ ] `src/lib/rate-limit.ts` — checkRateLimit() helper

*(No test framework gaps — project uses build/lint/type-check only)*

---

## Open Questions

1. **Exact `Retry-After` value: fixed 60s vs. dynamic remaining-window calculation**
   - What we know: D-06 says "seconds until window resets." The simple approach returns `windowMinutes * 60` (60 seconds, always). The precise approach would query the oldest row in the window and compute `60 - (now - oldest_row_time)`.
   - What's unclear: The dynamic calculation requires a third DB query (SELECT MIN(called_at) WHERE...), adding latency to already-rate-limited requests.
   - Recommendation: Use fixed 60 seconds. It's always correct (never lies about wait time), requires no extra query, and is the standard approach for simple sliding-window rate limiters. The ARCHITECTURE.md example also uses the fixed approach implicitly.

2. **checkRateLimit() error behavior: fail-open vs. fail-closed**
   - What we know: If the Supabase INSERT fails (e.g., DB overload), the function will throw. Route handlers have varying error handling — some have outer try-catch, some don't.
   - What's unclear: Should a DB error on the rate limit check block the request (fail-closed) or allow it (fail-open)?
   - Recommendation: Fail-open (allow the request if rate limit check fails). Rate limiting is a protection mechanism, not business logic. A DB error on the rate check should not block a legitimate user from submitting a report. Add `console.error` to log the failure. The outer route handler's error boundary handles unexpected throws.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/ARCHITECTURE.md` §Pattern 7 — Supabase-backed rate limiter: table design, helper function, integration pattern, latency cost. Written specifically for this phase.
- `.planning/research/PITFALLS.md` §Pitfall 3 — In-memory rate limiting is silently broken in serverless; DB-backed alternative prescription.
- `.planning/research/PITFALLS.md` §Pitfall 14 — Load testing auth rate limits (context only).
- Existing route handler source files (all 10 read directly) — integration point confirmed.
- `src/lib/supabase/admin.ts` — confirmed function name is `createAdminClient()`, not `getAdminClient()`.
- `supabase/migrations/00011_write_path.sql` — pg_cron pattern confirmed; next migration is `00012`.
- `package.json` — confirmed no test framework; build/lint/tsc are the only automated checks.

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` §Out of Scope — confirms Redis/Upstash and in-memory rate limiting are excluded.
- `.planning/STATE.md` §Accumulated Context — confirms "In-memory rate limiting is silently broken in serverless" as a v1.2 research decision.

### Tertiary (LOW confidence)

- None. All critical claims are sourced from project-internal research documents and direct code inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and existing codebase; no new dependencies
- Architecture: HIGH — Pattern 7 from ARCHITECTURE.md is the prescriptive design; all route handlers read and integration point confirmed
- Pitfalls: HIGH — sourced from project-internal PITFALLS.md and direct code inspection; one naming discrepancy confirmed (createAdminClient vs getAdminClient)
- Validation: HIGH — no test framework exists; confirmed from package.json scripts; build/lint/tsc are the only automated checks

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable stack, internal project conventions don't change)
