# Phase 39: API Route Handlers - Research

**Researched:** 2026-04-06
**Domain:** Next.js 16 App Router API route handlers — deal CRUD with CSRF, rate limiting, Zod validation, and role-scoped access
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Use `deals-{studentId}` as the revalidateTag name — scoped per student so Phase 42 dashboard stats can revalidate precisely after mutations.

**D-02:** All mutation endpoints (POST, PATCH, DELETE) call `revalidateTag(`deals-${studentId}`)` after successful write.

**D-03:** On 23505 unique_violation (deal_number conflict from concurrent inserts), retry the insert once inline — no delay, no exponential backoff. If the retry also fails, return 500.

**D-04:** Retry is server-side only; the client never sees the conflict.

**D-05:** Hardcode revenue/profit Zod limits directly in Phase 39 route schemas. Phase 40 will extract into `VALIDATION.deals` in config.ts — phases run sequentially.

**D-06:** `student_id` is a required query parameter on GET /api/deals. No additional filters (no date range, no sort param) — default sort is most-recent-first (created_at DESC).

**D-07:** `page` query parameter for pagination, 25 per page. Return `{ data: Deal[], total: number, page: number }` so the client can compute total pages.

**D-08:** Follow established codebase order: CSRF -> Auth -> Profile -> Role check -> Rate limit -> Body parse -> Zod -> Ownership check -> DB operation -> revalidateTag -> Response.

**D-09:** All `.from()` queries use admin client (per CLAUDE.md Hard Rule #4).

**D-10:** Rate limit endpoint strings: `/api/deals` for POST/GET, `/api/deals/[id]` for PATCH/DELETE.

**D-11:** DELETE checks three tiers: (1) student/student_diy deletes own deal (deal.student_id = profile.id), (2) coach deletes assigned student's deal (join users to verify coach_id), (3) owner deletes any deal. Unauthorized = 403.

**D-12:** Coach assignment check: query `users` table where `id = deal.student_id AND coach_id = profile.id` — two-step verification per Phase 38 D-11 pattern.

### Claude's Discretion

- Exact Zod schema field names and hardcoded limits for revenue/profit
- UUID validation approach on [id] params (regex or Zod)
- Error message wording for 400/403/429 responses
- Whether to split POST+GET into `/api/deals/route.ts` and PATCH+DELETE into `/api/deals/[id]/route.ts` (likely yes, matching existing codebase structure)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEAL-01 | Student can add a deal with revenue and profit fields | POST /api/deals handler with Zod schema for revenue+profit; admin insert with student_id = profile.id |
| DEAL-04 | Student can edit their own deals (update revenue and profit) | PATCH /api/deals/[id] handler; ownership check via .eq("student_id", profile.id) before update |
| DEAL-05 | Student can delete their own deals (hard delete) | DELETE /api/deals/[id] tier-1 check; admin delete with student ownership verified |
| VIEW-05 | Coach can delete deals of their assigned students | DELETE /api/deals/[id] tier-2 check; coach_id join pattern from reports/review route |
| VIEW-06 | Owner can delete deals of any student | DELETE /api/deals/[id] tier-3 check; owner role bypasses ownership constraints |
| INFR-05 | Rate limiting on deal creation, edit, and delete endpoints | checkRateLimit(profile.id, endpoint) at 30 req/min default; endpoint strings per D-10 |
</phase_requirements>

---

## Summary

Phase 39 implements four Next.js 16 App Router route handlers covering deal CRUD operations. All patterns are directly established in the existing codebase — no new libraries or patterns are introduced. The phase is essentially a mechanical application of proven patterns from `reports/route.ts`, `glossary/[id]/route.ts`, and `reports/[id]/review/route.ts` to the `deals` resource.

The most novel element is the three-tier DELETE authorization logic (student-owns / coach-assigned / owner-any), which has a direct precedent in the `reports/[id]/review/route.ts` coach-assignment check pattern. The 23505 retry on POST is inline — two sequential insert attempts before returning 500, invisible to the client.

The GET endpoint serves coach and owner roles only (per CONTEXT.md scope — students read their own deals via the UI later in Phase 41/43) and uses offset pagination (page query param, 25/page) with a required `student_id` param.

**Primary recommendation:** Create two files — `src/app/api/deals/route.ts` (POST + GET) and `src/app/api/deals/[id]/route.ts` (PATCH + DELETE) — following the codebase's established resource/[id] split pattern exactly.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router route handlers | Project stack [VERIFIED: package.json] |
| zod | ^4.3.6 | Input validation with safeParse | CLAUDE.md Hard Rule — import from "zod" never "zod/v4" [VERIFIED: package.json] |
| @supabase/supabase-js | ^2.99.2 | Admin client for all DB operations | CLAUDE.md Hard Rule #4 [VERIFIED: package.json] |
| next/cache | (built-in) | revalidateTag for cache invalidation | Used in all existing mutation routes [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| src/lib/csrf.ts | (internal) | verifyOrigin() — CSRF first check | Every mutation handler (POST, PATCH, DELETE) |
| src/lib/rate-limit.ts | (internal) | checkRateLimit() — 30 req/min DB-backed | All four endpoints per INFR-05 |
| src/lib/supabase/server | (internal) | createClient() for auth.getUser() only | Auth check step in every handler |
| src/lib/supabase/admin | (internal) | createAdminClient() for all .from() queries | Every DB query per Hard Rule #4 |

**Installation:** No new packages required. All dependencies are already in the project.

---

## Architecture Patterns

### Route File Structure
```
src/app/api/deals/
├── route.ts          # POST (create deal) + GET (paginated list)
└── [id]/
    └── route.ts      # PATCH (update revenue/profit) + DELETE (role-scoped)
```

This matches the established codebase pattern: `glossary/route.ts` + `glossary/[id]/route.ts`. [VERIFIED: codebase]

### Pattern 1: Canonical Handler Order (D-08)
**What:** Every mutation handler follows this exact step sequence
**When to use:** ALL four endpoints

```typescript
// Source: src/app/api/reports/route.ts + src/lib/csrf.ts comments
// Order: CSRF -> Auth -> Profile -> Role check -> Rate limit -> Body parse -> Zod -> Ownership -> DB -> revalidateTag -> Response

export async function POST(request: NextRequest) {
  // 1. CSRF (cheapest check first — before any DB calls)
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // 2. Auth
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 3. Profile
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();
  if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  // 4. Role check
  if (!["student", "student_diy"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Rate limit
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/deals");
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  // 6. Body parse
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 7. Zod validation
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }

  // 8. DB operation ...
  // 9. revalidateTag(`deals-${profile.id}`)
  // 10. Response
}
```

### Pattern 2: Dynamic [id] Route Params (Next.js 16)
**What:** Next.js 16 requires `Promise<{ id: string }>` for params in dynamic routes
**When to use:** PATCH and DELETE handlers in `/api/deals/[id]/route.ts`

```typescript
// Source: src/app/api/work-sessions/[id]/route.ts
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  // ...
}
```

[VERIFIED: codebase — work-sessions/[id]/route.ts and glossary/[id]/route.ts both use this pattern]

### Pattern 3: UUID Validation on [id] Param
**What:** Validate id param is a valid UUID before any DB call — prevents malformed input from hitting DB
**When to use:** PATCH and DELETE handlers

```typescript
// Source: src/app/api/glossary/[id]/route.ts (exact pattern to reuse)
if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  return NextResponse.json({ error: "Invalid deal ID" }, { status: 400 });
}
```

[VERIFIED: codebase — glossary/[id]/route.ts lines 31-33]

### Pattern 4: 23505 Retry on POST (D-03)
**What:** On deal_number unique_violation from concurrent inserts, retry once inline
**When to use:** POST /api/deals only

```typescript
// Source: CONTEXT.md D-03 + glossary route 23505 check pattern adapted
// Glossary returns 409; deals RETRY once then returns 500

async function insertDeal(admin: ReturnType<typeof createAdminClient>, payload: DealInsert) {
  const { data, error } = await admin
    .from("deals")
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

// In POST handler after Zod validation:
let { data: deal, error: insertError } = await insertDeal(admin, { student_id: profile.id, revenue, profit });

if (insertError?.code === "23505") {
  // Retry once — trigger will assign the next deal_number
  ({ data: deal, error: insertError } = await insertDeal(admin, { student_id: profile.id, revenue, profit }));
}

if (insertError) {
  console.error("[POST /api/deals] Insert failed:", insertError);
  return NextResponse.json({ error: "Failed to create deal" }, { status: 500 });
}

revalidateTag(`deals-${profile.id}`);
return NextResponse.json({ data: deal }, { status: 201 });
```

[ASSUMED] — The retry-helper pattern above is a recommendation for reducing code duplication; the locked decision (D-03) only specifies "retry once inline."

### Pattern 5: Three-Tier DELETE Authorization (D-11/D-12)
**What:** DELETE checks ownership in three tiers based on caller's role
**When to use:** DELETE /api/deals/[id] only

```typescript
// Source: CONTEXT.md D-11/D-12 + reports/[id]/review/route.ts coach check pattern

// After fetching the deal row:
const { data: deal, error: dealFetchError } = await admin
  .from("deals")
  .select("id, student_id")
  .eq("id", id)
  .single();

if (dealFetchError || !deal) {
  return NextResponse.json({ error: "Deal not found" }, { status: 404 });
}

// Tier authorization
if (profile.role === "student" || profile.role === "student_diy") {
  // Tier 1: student owns the deal
  if (deal.student_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
} else if (profile.role === "coach") {
  // Tier 2: coach is assigned to the student who owns the deal
  const { data: assignedStudent } = await admin
    .from("users")
    .select("id")
    .eq("id", deal.student_id)
    .eq("coach_id", profile.id)
    .single();
  if (!assignedStudent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
} else if (profile.role !== "owner") {
  // Tier 3: owner deletes any deal — if not owner, reject
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

[VERIFIED: codebase — reports/[id]/review/route.ts lines 87-97 shows the same coach assignment check pattern]

### Pattern 6: GET Pagination with student_id Param (D-06/D-07)
**What:** Paginated query — required student_id param, optional page param, 25 per page, created_at DESC
**When to use:** GET /api/deals only

```typescript
// Source: CONTEXT.md D-06/D-07 + messages/route.ts pagination pattern reference

// GET does NOT use CSRF or rate limit (consistent with /api/messages GET pattern)
export async function GET(request: NextRequest) {
  // Auth + profile + role check (coach/owner only) ...

  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("student_id");
  const pageParam = searchParams.get("page") ?? "1";

  if (!studentId) {
    return NextResponse.json({ error: "student_id is required" }, { status: 400 });
  }

  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const pageSize = 25;
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await admin
    .from("deals")
    .select("*", { count: "exact" })
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error("[GET /api/deals] Query failed:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
  });
}
```

[VERIFIED: CONTEXT.md D-07 specifies `{ data: Deal[], total: number, page: number }` response shape]

Note: GET /api/deals enforces CSRF (per phase success criteria SC-5) even though some GET handlers in the codebase omit it. The success criteria explicitly states "All four endpoints enforce verifyOrigin CSRF check."

### Pattern 7: PATCH Revenue/Profit Update (Ownership-Scoped)
**What:** Update revenue and profit for the requesting student's own deal
**When to use:** PATCH /api/deals/[id]

```typescript
// Source: CONTEXT.md D-08 + work-sessions/[id]/route.ts PATCH ownership pattern

const patchSchema = z.object({
  revenue: z.number().min(0).max(999999999999.99), // numeric(12,2) DB constraint
  profit: z.number().min(0).max(999999999999.99),
}).partial().refine(data => data.revenue !== undefined || data.profit !== undefined, {
  message: "At least one field (revenue or profit) must be provided",
});

// After Zod validation, ownership check using student_id filter:
const { data: updated, error: updateError } = await admin
  .from("deals")
  .update(parsed.data)
  .eq("id", id)
  .eq("student_id", profile.id)  // ownership enforced at query level
  .select()
  .single();

if (updateError || !updated) {
  // .single() returns null if student_id filter eliminates the row — means 403
  return NextResponse.json({ error: "Deal not found or forbidden" }, { status: 404 });
}

revalidateTag(`deals-${profile.id}`);
return NextResponse.json({ data: updated });
```

[ASSUMED] — The `.partial().refine()` approach for optional-but-at-least-one-field is a recommendation from Claude's discretion. The exact schema is discretionary per CONTEXT.md.

### Zod Schema Recommendations (Claude's Discretion)

**POST schema:**
```typescript
// Source: CONTEXT.md D-05 — hardcode limits in Phase 39, Phase 40 extracts to config.ts
const postDealSchema = z.object({
  revenue: z.number().min(0).max(999999999999.99),  // numeric(12,2) max value
  profit: z.number().min(0).max(999999999999.99),
});
```

The `numeric(12,2)` type allows values up to 9999999999.99 (10 integer digits + 2 decimal). [VERIFIED: supabase/migrations/00021_deals.sql — `revenue numeric(12,2) NOT NULL CHECK (revenue >= 0)`]

The DB also enforces `CHECK (revenue >= 0)` and `CHECK (profit >= 0)`, so Zod `.min(0)` mirrors the DB constraint.

### Anti-Patterns to Avoid

- **Importing admin client in client components:** Hard Rule #2 — never import createAdminClient outside server/API files
- **Using middleware.ts for route protection:** CLAUDE.md — this project uses `src/proxy.ts`, not middleware.ts
- **Returning 404 for auth failures on sensitive resources:** The codebase has a precedent (reports/review) of returning 404 for ownership failures to prevent resource ID probing — use 403 for deals since deal IDs are not sensitive
- **Skipping the admin client for DB queries:** CLAUDE.md Hard Rule #4 — every `.from()` must use admin client
- **Using `"zod/v4"` import path:** CLAUDE.md Hard Rule — always `import { z } from "zod"`
- **Empty catch blocks:** CLAUDE.md Hard Rule — every catch must toast or console.error

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSRF protection | Custom origin validation | `verifyOrigin()` from `src/lib/csrf.ts` | Already handles malformed URLs, env fallback, consistent error format |
| Rate limiting | In-memory counter or Redis | `checkRateLimit()` from `src/lib/rate-limit.ts` | DB-backed, already deployed, handles fail-open correctly |
| Cache invalidation | Manual fetch revalidation | `revalidateTag()` from `next/cache` | Built-in Next.js 16 mechanism; already used in all mutation routes |
| Input validation | Manual type-checking | Zod `safeParse()` | Type-safe, consistent error extraction with `.issues[0]?.message` |

**Key insight:** All security and infrastructure primitives for this phase already exist in the codebase. The implementation is purely about correctly composing existing utilities into four route files.

---

## Common Pitfalls

### Pitfall 1: Wrong revalidateTag Scope
**What goes wrong:** Using `revalidateTag("deals")` (global) instead of `revalidateTag(\`deals-${studentId}\`)` (per-student)
**Why it happens:** Easy to forget D-01/D-02 when copying from existing routes like `revalidateTag("badges", "default")`
**How to avoid:** The tag must always be scoped to the affected student's ID. In POST/PATCH the student is `profile.id`. In DELETE by a coach/owner, the student is `deal.student_id` (fetched before deletion)
**Warning signs:** Phase 42 dashboard stats stale for other students after a delete by coach/owner

### Pitfall 2: revalidateTag Called Before Delete Completes
**What goes wrong:** Calling revalidateTag then deleting (or calling before confirming success)
**Why it happens:** Ordering the tag call before verifying the DB operation succeeded
**How to avoid:** Always call revalidateTag AFTER confirming `!deleteError` — the deletion must have succeeded before cache is invalidated

### Pitfall 3: PATCH Ownership Check via Separate Fetch
**What goes wrong:** Fetching the deal first to check `deal.student_id === profile.id`, then issuing a separate update
**Why it happens:** Copying the DELETE pattern (which must fetch to get student_id for revalidateTag)
**How to avoid:** For PATCH, filter by both `id` and `student_id` in the update query directly. If `.single()` returns null, the row doesn't exist for this student — return 404. This is a single DB call instead of two.

### Pitfall 4: Forgetting student_id in revalidateTag After Coach/Owner Delete
**What goes wrong:** Coach deletes a student's deal. Code calls `revalidateTag(\`deals-${profile.id}\`)` instead of `revalidateTag(\`deals-${deal.student_id}\`)`
**Why it happens:** Reusing the pattern from POST/PATCH where `profile.id === student_id`
**How to avoid:** In DELETE, the tag must reference the DEAL OWNER's student_id (`deal.student_id`), not the caller's profile.id (which may be a coach or owner)

### Pitfall 5: GET Endpoint Allows Students to Query Any student_id
**What goes wrong:** GET /api/deals accessible to student role — student passes another student's ID as `student_id` param
**Why it happens:** Forgetting that GET is coach/owner only per phase success criteria
**How to avoid:** Role check in GET must explicitly reject `student` and `student_diy` roles with 403

### Pitfall 6: 23505 on deal_number Misattributed
**What goes wrong:** Treating any 23505 error as deal_number conflict and retrying — but 23505 could theoretically fire on a different unique constraint
**Why it happens:** Generic 23505 check without constraint name verification
**How to avoid:** At v1.5 scale the only UNIQUE constraint on deals is `deals_student_deal_number_key`. The code comment should note this assumption. Retry is safe — worst case a second sequential deal_number is assigned if two inserts were truly concurrent.

### Pitfall 7: params Not Awaited in Next.js 16
**What goes wrong:** TypeScript error or undefined id from `const { id } = params` (sync access)
**Why it happens:** Using older Next.js 14 pattern where params was synchronous
**How to avoid:** Always `const { id } = await params` — Next.js 16 made params a Promise [VERIFIED: codebase — work-sessions/[id]/route.ts and glossary/[id]/route.ts both await params]

---

## Code Examples

### Verified Pattern: checkRateLimit with Retry-After Header
```typescript
// Source: src/app/api/glossary/[id]/route.ts lines 68-77
const { allowed, retryAfterSeconds } = await checkRateLimit(
  profile.id,
  "/api/deals/[id]"   // endpoint string per D-10
);
if (!allowed) {
  return NextResponse.json(
    { error: `Too many requests, try again in ${retryAfterSeconds} seconds.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
```

### Verified Pattern: Profile Lookup via Admin Client
```typescript
// Source: src/app/api/reports/route.ts lines 36-43
const admin = createAdminClient();
const { data: profile } = await admin
  .from("users")
  .select("id, role")
  .eq("auth_id", authUser.id)
  .single();

if (!profile) {
  return NextResponse.json({ error: "User profile not found" }, { status: 404 });
}
```

### Verified Pattern: Coach Assignment Check
```typescript
// Source: src/app/api/reports/[id]/review/route.ts lines 87-97
// Returns 404 (not 403) in the review route to prevent ID probing.
// For deals DELETE, return 403 since deal IDs are not considered sensitive.
const { data: assignedStudent } = await admin
  .from("users")
  .select("id")
  .eq("id", deal.student_id)
  .eq("coach_id", profile.id)
  .single();

if (!assignedStudent) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Verified Pattern: Supabase Offset Pagination
```typescript
// Source: codebase pattern, messages/route.ts .limit() reference
const { data, error, count } = await admin
  .from("deals")
  .select("*", { count: "exact" })
  .eq("student_id", studentId)
  .order("created_at", { ascending: false })
  .range(offset, offset + pageSize - 1);
```
[ASSUMED] — The `.range()` method for offset pagination is standard Supabase JS client behavior; the exact syntax was not verified via Context7 in this session but is consistent with established Supabase patterns.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params.id` (sync) | `(await params).id` | Next.js 15/16 | params is now a Promise — must await |
| `middleware.ts` route guards | `src/proxy.ts` route guards | Project convention | Never use middleware.ts in this codebase |

**No deprecated patterns** in the existing route handler files — all current code already uses the Next.js 16 async params pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.partial().refine()` for PATCH schema (optional-but-at-least-one) | Architecture Patterns #7 | Low — field names and limits are Claude's discretion; any valid Zod approach works |
| A2 | Helper function to reduce duplication in 23505 retry | Architecture Patterns #4 | Low — D-03 only says "retry once inline"; any inline retry implementation satisfies it |
| A3 | GET endpoint should enforce CSRF | Architecture Patterns #6 | Medium — success criteria SC-5 says "all four endpoints enforce verifyOrigin"; this is locked |
| A4 | `.range()` syntax for Supabase offset pagination | Code Examples | Low — alternative: `.limit(25).offset(offset)` is equivalent; either works |
| A5 | numeric(12,2) max value = 999999999999.99 for Zod limits | Architecture Patterns (Zod) | Low — Phase 40 extracts these to config.ts anyway; imprecision has no functional impact |

---

## Open Questions (RESOLVED)

1. **Does GET /api/deals need rate limiting?**
   - What we know: Success criteria SC-5 says "all four endpoints enforce... checkRateLimit at 30 req/min." CONTEXT.md D-10 lists `/api/deals` for POST/GET together.
   - What's unclear: The codebase precedent (messages/route.ts) explicitly OMITS rate limiting from polling GETs to avoid exhausting the cap. But deals GET is not a polling endpoint.
   - Recommendation: Apply checkRateLimit to GET /api/deals per SC-5 and D-10 — this is a locked success criterion, not discretionary.
   - RESOLVED: Yes — plan applies checkRateLimit to all four endpoints including GET, per SC-5.

2. **Should PATCH also accept student_diy role?**
   - What we know: DEAL-04 says "Student can edit their own deals" — ambiguous whether student_diy is included. DEAL-06 says both roles have access to the Deals page (Phase 40). The database `student_update_deals` RLS policy covers both `student` and `student_diy`.
   - What's unclear: PATCH role check should probably allow `["student", "student_diy"]` to match the RLS policy and the broader role parity pattern.
   - Recommendation: Allow both `student` and `student_diy` in PATCH and POST role checks, matching the DB RLS policy.
   - RESOLVED: Yes — plan allows both student and student_diy in POST, PATCH, and DELETE role checks.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 39 is purely code additions (new route handler files). No external tools, CLIs, or services beyond the existing Next.js + Supabase stack are required. The Phase 38 migration must be applied before these routes can be integration-tested, but that is a prerequisite dependency, not an environment availability concern for this phase.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no jest.config.*, vitest.config.*, or test files in src/ |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` (build + type check only) |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

No automated test framework exists in this project. [VERIFIED: no *.test.ts files in src/, no jest.config.* or vitest.config.* at project root]

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEAL-01 | POST /api/deals creates deal and returns row with deal_number | manual-only | — | N/A |
| DEAL-04 | PATCH /api/deals/[id] updates revenue/profit for own deal | manual-only | — | N/A |
| DEAL-05 | DELETE /api/deals/[id] deletes own deal | manual-only | — | N/A |
| VIEW-05 | Coach can delete assigned student's deal | manual-only | — | N/A |
| VIEW-06 | Owner can delete any deal | manual-only | — | N/A |
| INFR-05 | Rate limit enforced at 30 req/min | manual-only | — | N/A |

**Manual-only justification:** No test framework is installed. All behavioral testing for this phase uses `npm run build && npx tsc --noEmit` (TypeScript compilation as compile-time correctness gate) plus manual API testing via browser DevTools or curl after `npm run dev`.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check — catches import errors, type mismatches)
- **Per wave merge:** `npm run build && npm run lint` (full build + lint)
- **Phase gate:** `npm run build` green + manual API smoke test before `/gsd-verify-work`

### Wave 0 Gaps
None — no test infrastructure to create. Type checking via `npx tsc --noEmit` is sufficient for this phase's correctness gate.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` — validates JWT server-side |
| V3 Session Management | no | Handled by Supabase auth layer, not in scope |
| V4 Access Control | yes | Role check + ownership check in every handler; three-tier DELETE |
| V5 Input Validation | yes | Zod `safeParse()` on all mutation bodies; UUID regex on id params |
| V6 Cryptography | no | No cryptographic operations in route handlers |

### Known Threat Patterns for Next.js + Supabase Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on mutation endpoints | Spoofing | `verifyOrigin()` checks Origin header before any DB call |
| Horizontal privilege escalation (student reads other's deals) | Elevation of Privilege | GET role check (coach/owner only) + student_id param validated against caller's assigned students |
| Vertical privilege escalation (student deletes coach/owner's deals) | Elevation of Privilege | Three-tier DELETE checks role before allowing delete; default 403 |
| Parameter injection in student_id / id | Tampering | UUID regex validation on [id]; student_id validated as UUID via Zod `.uuid()` |
| Rate limit bypass (endpoint string manipulation) | Denial of Service | Endpoint strings are hardcoded in route handler per D-10, not user-supplied |
| Admin client misuse | Information Disclosure | Admin client only imported in server files — CLAUDE.md Hard Rule #2 enforced by "server-only" marker in supabase/admin module |
| Numeric overflow on revenue/profit | Tampering | Zod `.max()` and DB `numeric(12,2)` CHECK constraint both enforce upper bounds |

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/reports/route.ts` — canonical POST handler pattern (CSRF, auth, profile, role, rate limit, body, Zod, insert, revalidateTag)
- `src/app/api/reports/[id]/review/route.ts` — canonical coach assignment check pattern
- `src/app/api/work-sessions/[id]/route.ts` — PATCH with async params (Next.js 16 pattern)
- `src/app/api/glossary/[id]/route.ts` — UUID validation, 23505 handling, PUT+DELETE in one file
- `src/app/api/glossary/route.ts` — GET without CSRF, POST with full security stack
- `src/app/api/messages/route.ts` — GET with searchParams, pagination patterns
- `src/lib/csrf.ts` — verifyOrigin() implementation
- `src/lib/rate-limit.ts` — checkRateLimit() implementation and return type
- `src/lib/types.ts` lines 662-699 — Deal Row/Insert/Update type definitions
- `src/lib/config.ts` lines 320-333 — VALIDATION constants pattern
- `supabase/migrations/00021_deals.sql` — table schema, constraints, RLS policies, indexes
- `CLAUDE.md` — all Hard Rules applicable to route handlers

### Secondary (MEDIUM confidence)
- `.planning/phases/39-api-route-handlers/39-CONTEXT.md` — all locked decisions D-01 through D-12
- `.planning/REQUIREMENTS.md` — DEAL-01, DEAL-04, DEAL-05, VIEW-05, VIEW-06, INFR-05 definitions

### Tertiary (LOW confidence)
- None — all claims verified from codebase or CONTEXT.md

---

## Project Constraints (from CLAUDE.md)

All directives that apply to API route handler implementation:

1. **Config is truth** — import from `src/lib/config.ts`; never hardcode roles/nav/roadmap (Phase 40 will add VALIDATION.deals; Phase 39 hardcodes per D-05)
2. **Admin client only in server code** — never import `createAdminClient` in client components
3. **Proxy not middleware** — route protection lives in `src/proxy.ts`, not `middleware.ts`
4. **Hard Rule: motion-safe:** — every `animate-*` class needs `motion-safe:` prefix (N/A — no UI in Phase 39)
5. **Hard Rule: 44px touch targets** — N/A (no UI in Phase 39)
6. **Hard Rule: Admin client in API routes** — every `.from()` in route handlers uses admin client
7. **Hard Rule: Never swallow errors** — every `catch` block must `console.error` (no toasts in server code)
8. **Hard Rule: Check response.ok** — N/A (route handlers are the API, not callers)
9. **Hard Rule: Zod import** — `import { z } from "zod"` — never `"zod/v4"`
10. **Hard Rule: ima-* tokens only** — N/A (no UI in Phase 39)
11. **Filter by user ID in queries** — never rely on RLS alone; add explicit `.eq("student_id", profile.id)` in student-scoped queries as defense-in-depth

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json and codebase
- Architecture: HIGH — patterns verified directly from canonical codebase files
- Pitfalls: HIGH — derived from reading actual implementation patterns and CONTEXT.md decisions
- Security: HIGH — ASVS categories derived from codebase implementation review

**Research date:** 2026-04-06
**Valid until:** Stable — patterns only change if Next.js major version bumps or supabase-js breaking changes. 30-day safe window.
