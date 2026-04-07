# Phase 23: Security Audit - Research

**Researched:** 2026-03-30
**Domain:** API route security — auth/role/ownership verification, CSRF protection, cross-student data isolation, RLS policy audit
**Confidence:** HIGH (direct codebase analysis of all 12 routes + migrations + proxy; PITFALLS.md and ARCHITECTURE.md are project-internal HIGH-confidence sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-pass approach. First pass produces the audit report — every route documented, every gap identified, no code changes. Second pass applies fixes only after explicit human approval.
- **D-02:** This maps to two separate plans: Plan 1 = audit report (read-only), Plan 2 = remediation (code changes). The HALT gate lives between Plan 1 and Plan 2.
- **D-03:** Rationale: combining report and fixes defeats the `requires-human-review` flag — you'd be approving changes you haven't seen yet.
- **D-04:** Three-layer audit covering the full defense-in-depth chain: route handlers -> proxy route guard -> RLS policies.
- **D-05:** All 12 API routes audited (auth/signout, auth/callback, calendar, reports, reports/[id]/review, work-sessions, work-sessions/[id], roadmap, invites, magic-links, assignments, alerts/dismiss).
- **D-06:** Server components excluded — they run server-side only and are less critical than the three audited layers.
- **D-07:** Each finding in the audit report gets a severity level: Critical / High / Medium / Info.
- **D-08:** Severity guidance: missing auth check on mutation = Critical; missing CSRF on mutation = High; missing CSRF on read-only GET = Info; missing ownership filter with RLS backup = Medium.
- **D-09:** DB-03 ("All RLS policies use `(SELECT auth.uid())` instead of `auth.uid()` for initplan optimization") is folded into this phase's RLS audit layer.

### Claude's Discretion

- CSRF Origin header implementation details (env-based host matching, dev/prod handling, helper function design)
- Cross-student isolation edge cases — the audit should discover these, not pre-define them
- Audit report document format and structure (beyond severity classification)
- Specific remediation code patterns for each finding

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | Every API route's auth check and role verification is documented and verified correct | Direct read of all 12 routes; findings documented in Pre-Audit section below |
| SEC-03 | All mutation route handlers verify Origin header for CSRF protection | PITFALLS.md Pitfall 12 confirms CSRF is manual on route handlers; pattern documented in Code Examples |
| SEC-04 | Cross-student data isolation verified — no student can access another student's data via param manipulation | All student-data routes audited; gaps and ownership patterns documented below |
| DB-03 | All RLS policies use `(SELECT auth.uid())` for initplan optimization (folded into this phase per D-09) | All policies in 00001_create_tables.sql and 00004_alert_dismissals.sql already use `(select get_user_role())` and `(select get_user_id())` wrappers — claim verified |
</phase_requirements>

---

## Summary

Phase 23 audits defense-in-depth security across three layers: the 12 API route handlers, the proxy route guard (`src/proxy.ts`), and all RLS policies in the migration files. This research reads every source file directly — no assumptions from training data.

The routes were added across v1.0/v1.1/v1.2 phases without a dedicated security pass. Every mutation route now has rate limiting (Phase 22) and basic auth/role checks, but **no route has CSRF Origin header verification**. This is the single universal gap. Ownership filtering varies by route: student-mutation routes consistently filter by `profile.id`; coach/owner routes have mixed patterns that need case-by-case review. RLS policies already use the `(select get_user_role())` initplan wrapper throughout — DB-03 is effectively already satisfied at the SQL level.

**Primary recommendation:** Plan 1 is pure analysis producing `23-AUDIT-REPORT.md`. Plan 2 adds a shared CSRF helper function and inserts one `verifyOrigin(request)` call near the top of every mutation handler (POST, PATCH, DELETE) across 10 routes. No schema changes required.

---

## Pre-Audit Findings (from Direct Code Inspection)

This section documents what the audit plan MUST verify and the gaps already visible from research. These are inputs to the audit report template, not conclusions.

### Layer 1: Route Handler Analysis

#### Route-by-Route Auth/Role/Ownership Map

| Route | Method | Auth Check | Role Check | Ownership / Isolation | CSRF Check | Rate Limited |
|-------|--------|------------|------------|----------------------|------------|--------------|
| `auth/signout` | POST | None — calls `supabase.auth.signOut()` directly | None | N/A — signout is idempotent | None | No |
| `auth/callback` | GET | Via `exchangeCodeForSession` + `getUser()` | Implicit — routes by role after profile lookup | Invite/magic code validated | N/A (GET) | No |
| `calendar` | GET | `createClient().auth.getUser()` | coach or owner only | Coach: verifies `student.coach_id === profile.id`; Owner: unrestricted | N/A (GET) | No |
| `reports` | POST | `createClient().auth.getUser()` | student only | Inserts with `student_id: profile.id` — never from body | None | Yes |
| `reports/[id]/review` | PATCH | `createClient().auth.getUser()` | coach only | Verifies `report.student_id` matches a student with `coach_id = profile.id` | None | Yes |
| `work-sessions` | POST | `createClient().auth.getUser()` | student only | Inserts with `student_id: profile.id`; checks `student_id = profile.id` on existing session lookup | None | Yes |
| `work-sessions/[id]` | PATCH | `createClient().auth.getUser()` | student only | Fetches session with `.eq("student_id", profile.id)` — ownership enforced before mutation | None | Yes |
| `roadmap` | PATCH | `createClient().auth.getUser()` | student only | Fetches step with `.eq("student_id", profile.id)` before update; next-step unlock also uses `profile.id` | None | Yes |
| `invites` | POST | `createClient().auth.getUser()` | coach or owner | No per-invite ownership check needed (creates new, no ID param) | None | Yes |
| `magic-links` (POST) | POST | `createClient().auth.getUser()` | coach or owner | No ID param; creates new record with `created_by: profile.id` | None | Yes |
| `magic-links` (PATCH) | PATCH | `createClient().auth.getUser()` | coach or owner | Fetches link by ID then checks `link.created_by === profile.id OR role === 'owner'` | None | Yes |
| `assignments` | PATCH | `createClient().auth.getUser()` | owner only | Verifies `studentId` param points to a student row before updating; coach_id verified as active coach | None | Yes |
| `alerts/dismiss` | POST | `createClient().auth.getUser()` | owner only | `owner_id` always from `profile.id`, never body; upsert is scoped | None | Yes |

#### Confirmed Gaps

**Gap 1 — No CSRF protection on any mutation route (SEC-03):**
Zero of the 10 mutation routes (POST/PATCH/DELETE) check the `Origin` header. The `auth/signout` route is also a POST with no CSRF check, though it has no auth check either (signout is safe to call unauthenticated — see Gap 2). Severity: **High** for all mutation routes that are authenticated.

**Gap 2 — `auth/signout` has no auth guard (SEC-02):**
`src/app/api/auth/signout/route.ts` calls `supabase.auth.signOut()` without checking whether the caller is authenticated. An unauthenticated POST to `/api/auth/signout` succeeds (Supabase signOut on a non-session is a no-op, not an error). Impact is low — the action is idempotent and non-destructive — but it is a documentation finding. The route is noted in CONTEXT.md as "dead code per PROJECT.md." Severity: **Info** (dead code; document but no fix required unless activated).

**Gap 3 — `auth/callback` GET has no rate limiting:**
The OAuth callback is an unauthenticated GET that does DB writes (creating user profiles). It is not a mutation route in the conventional sense (browser-initiated OAuth redirect), so CSRF does not apply. But it has no rate limiting. The route can create users at unbounded speed if the OAuth provider allows it. Severity: **Medium** — document as finding; not in scope to fix in Plan 2 (rate limiting on OAuth callback would break legitimate flows since the user has no profile yet).

**Gap 4 — `calendar` GET has no rate limiting:**
Not a mutation, no CSRF required, but unbounded reads. Severity: **Info** — document; no fix required.

**Gap 5 — `reports/[id]/review` PATCH: coach ownership check is correct but relies on two sequential queries:**
Step 1: fetch report by `id`. Step 2: verify `report.student_id` matches a student with `coach_id = profile.id`. If the report is not found (step 1 returns null), a 404 is returned before step 2. The coach cannot infer another student's data from a 404 vs 403 difference because step 1 is `admin` client with no filter — it will always find the report if the ID exists. But there is no ownership check *on the report itself* before returning 404. A coach can probe report IDs to discover whether a report exists for an ID that isn't their student. Severity: **Medium** — fix by adding `eq("student_id", profile_student_ids)` subquery or reordering to check student ownership first.

#### Routes with Strong Isolation (No Action Needed)

- `reports` POST: `student_id` always from `profile.id`, body-supplied value is impossible (not in schema)
- `work-sessions` POST/PATCH: `student_id` inserted from `profile.id`; session fetch filters by `student_id = profile.id`
- `roadmap` PATCH: step fetch + updates all filter by `student_id = profile.id`
- `magic-links` PATCH: ownership check via `created_by === profile.id OR role === 'owner'`
- `alerts/dismiss` POST: `owner_id` from `profile.id`, never from body

### Layer 2: Proxy Route Guard (`src/proxy.ts`)

| Check | Status | Notes |
|-------|--------|-------|
| Auth check on protected routes | Pass | `supabase.auth.getUser()` called; unauthenticated → redirect `/login` |
| Role-based route protection | Pass | `ROLE_ROUTE_ACCESS` map: owner→`/owner`, coach→`/coach`, student→`/student` |
| API routes excluded from proxy | Pass | Matcher excludes `api/` prefix — route handlers do their own auth |
| Singleton admin client | Gap | Proxy uses `createClient()` directly (not `createAdminClient()` singleton) — creates a new service-role client per proxy invocation. This is a performance concern (Phase 19 singleton was in `admin.ts`; proxy bypasses it). Severity: **Info** — not a security gap, but inconsistency worth documenting |
| Public routes redirect when authenticated | Pass | `/login`, `/register`, `/no-access` redirect to role dashboard if user has a profile |
| `no-access` page: no role required | Pass | `/no-access` correctly allows unauthenticated access |

**Proxy gap — no `/api` route protection:**
The proxy explicitly excludes `api/` from its matcher (`"/((?!_next/static|_next/image|favicon.ico|api/).*)"`) — this is intentional and correct. API routes do their own auth. Not a gap.

### Layer 3: RLS Policies

Direct read of `supabase/migrations/00001_create_tables.sql` and `supabase/migrations/00004_alert_dismissals.sql`:

| Table | Policies Present | initplan Pattern Used | Notes |
|-------|-----------------|----------------------|-------|
| `users` | SELECT (owner/coach/student), UPDATE (owner/coach/student) | `(select get_user_role())` / `(select get_user_id())` | Pass |
| `invites` | SELECT (owner/coach), INSERT (owner/coach) | Same | Pass |
| `magic_links` | SELECT/INSERT/UPDATE (owner/coach) | Same | Pass |
| `work_sessions` | SELECT (owner/coach/student), INSERT/UPDATE/DELETE (student) | Same | Pass |
| `roadmap_progress` | SELECT/UPDATE (owner/coach/student) | Same | Pass |
| `daily_reports` | SELECT (owner/coach/student), INSERT/UPDATE (student), UPDATE (coach) | Same | Pass |
| `alert_dismissals` | SELECT/INSERT (owner only) | Same | Pass |

**DB-03 status: SATISFIED.** All policies already use `(select get_user_role())` and `(select get_user_id())` throughout. No `auth.uid()` direct calls exist in RLS policies. The Phase 19 context claim is verified.

**RLS gap — admin client bypasses RLS entirely:**
All 10 mutation route handlers use `createAdminClient()` (service_role) for their DB queries. RLS policies are irrelevant for these queries. The application-level checks (auth + role + ownership filter) are the ONLY security gate. This is intentional (per REQUIREMENTS.md "Switching API routes from admin to user client" is Out of Scope) but must be formally documented in the audit report. Every admin-client query that touches student data MUST include `eq("student_id", profile.id)` — audit must verify each one.

---

## Standard Stack

This phase adds no new libraries. All tools needed exist in the project.

### Core (existing)
| Library | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `next` | 16.1.6 | `NextRequest`, `NextResponse`, route handler types | All API routes |
| `@supabase/supabase-js` | ^2.99.2 | Admin client queries | `src/lib/supabase/admin.ts` |
| `@supabase/ssr` | ^0.9.0 | Auth-aware server client | `src/lib/supabase/server.ts` |
| `zod` | ^4.3.6 | Input validation (`import { z } from "zod"`) | All routes |

### New (Phase 23 only)
| Item | Purpose | Location |
|------|---------|---------|
| `src/lib/csrf.ts` | Shared CSRF Origin check helper | New file — called from all mutation handlers |
| `23-AUDIT-REPORT.md` | Structured audit findings doc | Phase directory — produced by Plan 1 |

**No npm installs required.**

---

## Architecture Patterns

### Recommended Project Structure (Phase 23 additions)

```
src/
├── lib/
│   └── csrf.ts          # NEW — verifyOrigin(request) helper
├── app/api/
│   ├── auth/
│   │   ├── signout/route.ts    # Audit: dead code finding documented
│   │   └── callback/route.ts   # Audit: GET — no CSRF needed
│   ├── calendar/route.ts       # Audit: GET — no CSRF needed
│   ├── reports/route.ts        # CSRF fix: POST
│   ├── reports/[id]/review/route.ts  # CSRF fix: PATCH; ownership finding
│   ├── work-sessions/route.ts  # CSRF fix: POST
│   ├── work-sessions/[id]/route.ts   # CSRF fix: PATCH
│   ├── roadmap/route.ts        # CSRF fix: PATCH
│   ├── invites/route.ts        # CSRF fix: POST
│   ├── magic-links/route.ts    # CSRF fix: POST + PATCH
│   ├── assignments/route.ts    # CSRF fix: PATCH
│   └── alerts/dismiss/route.ts # CSRF fix: POST
.planning/phases/23-security-audit/
└── 23-AUDIT-REPORT.md          # NEW — Plan 1 output
```

### Pattern 1: CSRF Origin Verification Helper

**What:** A shared helper that reads the `Origin` header and compares it against the known app host. Returns a 403 `NextResponse` on mismatch, or `null` on pass (allowing the caller to continue).

**When to use:** Called at the top of every POST, PATCH, DELETE route handler, immediately after the auth check (or before, since CSRF check doesn't need auth data).

**Implementation (Claude's discretion — env-based host):**

```typescript
// src/lib/csrf.ts
import { NextResponse } from "next/server";

/**
 * Verifies the Origin header matches the app host to prevent CSRF.
 * CSRF is NOT automatic for route handlers — only Server Actions get it.
 * Returns a 403 NextResponse if Origin is missing or mismatched.
 * Returns null if Origin is valid (caller should continue).
 *
 * Dev: NEXT_PUBLIC_APP_URL is http://localhost:3000
 * Prod: NEXT_PUBLIC_APP_URL is https://ima-accelerator.com (or similar)
 */
export function verifyOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (!origin) {
    // No Origin header — could be curl/Postman in dev.
    // In production, all browser requests include Origin on cross-origin.
    // Same-origin fetch() from browser always sends Origin.
    // Reject if no origin in all environments for strict compliance.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const originHost = new URL(origin).host;
    const appHost = new URL(appUrl).host;
    if (originHost !== appHost) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    // Malformed origin or appUrl — reject
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // Pass
}
```

**Insertion point in mutation handlers:**

```typescript
export async function POST(request: NextRequest) {
  // CSRF check — must precede all business logic
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;

  // Auth check
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ... rest of handler unchanged
}
```

**Note on `NEXT_PUBLIC_APP_URL` in dev:** The env is `http://localhost:3000`. Browser fetch from `http://localhost:3000` sends `Origin: http://localhost:3000`. The check passes. Direct API calls from curl/Postman without an Origin header will be rejected — this is acceptable behavior for a production app. If local testing tools need access, they must set the Origin header explicitly.

### Pattern 2: Audit Report Document Structure

**What:** `23-AUDIT-REPORT.md` produced by Plan 1. Structured with exactly what the human reviewer needs to approve Plan 2.

```markdown
# Security Audit Report — Phase 23

**Audited:** {date}
**Routes:** 12 / 12 covered
**Layers:** Route handlers, proxy guard, RLS policies

## Executive Summary

[Overall posture, number of findings by severity]

## Findings

### [FIND-01] — {Severity} — {Route} — {Short title}
- **Layer:** Route handler / Proxy / RLS
- **File:** src/app/api/.../route.ts (line N)
- **Description:** [what is missing/wrong]
- **Attack vector:** [what a malicious actor could do]
- **Proposed fix:** [one-line description]

## Layer 3: RLS Policy Audit
[Table-by-table summary of initplan wrapper usage]

## DB-03 Status
[Formal close-out of DB-03 requirement]

## Approval Instructions
[What the human must do to approve Plan 2]
```

### Pattern 3: Insertion Order in Mutation Routes

**Standard order after remediation (enforced by audit):**

```
1. CSRF check (verifyOrigin)
2. Auth check (getUser)
3. Profile + role check (admin client)
4. Rate limit check (checkRateLimit)
5. Body parse (request.json with try-catch)
6. Zod validation (safeParse)
7. Ownership verification (if ID param involved)
8. Business logic query
```

This order is already used by all routes for steps 2-8. Step 1 (CSRF) is the universal addition.

### Anti-Patterns to Avoid

- **CSRF via custom header only:** Using `X-Requested-With: XMLHttpRequest` instead of Origin header check is weaker — the Origin header is the OWASP-recommended standard. Do not substitute.
- **CSRF check after body parse:** If the body is large, parsing before CSRF check wastes compute on malicious requests. CSRF check must be first.
- **Using `request.headers.get('host')` for comparison:** The `Host` header can be spoofed in some proxy configurations. Use `NEXT_PUBLIC_APP_URL` (controlled by deploy config) as the source of truth.
- **Skipping CSRF on PATCH/DELETE because "it's not a form":** CSRF applies to any state-changing request. JSON API endpoints are equally vulnerable to cross-origin attacks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSRF token generation/validation | Custom token store | Origin header check | Token-based CSRF requires server-side storage; Origin check is stateless and sufficient for same-origin API calls with cookie auth |
| Auth session re-validation in CSRF helper | Re-calling getUser inside verifyOrigin | Separate concerns — CSRF helper only checks Origin | Auth is already checked separately; mixing them creates coupling and double DB calls |
| RLS policy audit tooling | Custom SQL introspection scripts | Direct read of migration SQL files | All policies are in `00001_create_tables.sql` and `00004_alert_dismissals.sql` — readable directly |

**Key insight:** The CSRF fix is intentionally minimal — one helper function, one call per handler. Any more complexity (tokens, sessions, nonces) would be over-engineering for a cookie-auth app where Origin header check is the OWASP-accepted solution.

---

## Common Pitfalls

### Pitfall 1: CSRF Check Breaks Legitimate Dev Requests

**What goes wrong:** After adding `verifyOrigin`, local development curl commands and API clients without Origin headers return 403. Developers think the feature is broken.

**Why it happens:** Browser fetch from `http://localhost:3000` sends `Origin: http://localhost:3000`. Direct API calls from curl do not. The check correctly rejects curl — but this surprises developers.

**How to avoid:** Document in code comment that non-browser requests must set `Origin: http://localhost:3000` in development. Do not add a dev-mode bypass that could be accidentally deployed.

**Warning signs:** 403 on every POST during development — check whether Origin header is being sent.

### Pitfall 2: Null Origin on Same-Site Requests

**What goes wrong:** Requests from the same origin via `<form>` submit send `Origin: null` in some browsers (Firefox, older Safari) when the page is loaded from a file URL or certain cross-origin redirects.

**Why it happens:** The browser sends `Origin: null` as a privacy protection in some contexts (e.g., data: URIs, sandboxed iframes).

**How to avoid:** The IMA app uses JavaScript fetch() for all mutations — not HTML form submits. All fetch() calls from the same origin send the full origin URL, not null. This pitfall does not apply here but is worth noting in the audit report.

**Warning signs:** 403 errors with `Origin: null` in request headers — only occurs if form-submit-based mutations are ever added.

### Pitfall 3: reports/[id]/review — Report ID Probing

**What goes wrong:** A coach can POST `PATCH /api/reports/{any_uuid}/review` and distinguish between "report not found" (404) and "not your student" (403). This leaks information about whether a report ID exists, even if the coach cannot read the data.

**Why it happens:** The current code fetches the report first (step 1), returns 404 if not found, then checks coach-student relationship (step 2). The 404 vs 403 distinction is information disclosure.

**How to avoid:** Reorder so ownership is checked first, or combine both checks into a single query that joins `daily_reports` and `users` on `student_id` with `coach_id = profile.id`. Return 404 for all failure modes to avoid leaking information.

**Warning signs:** An attacker systematically probing `/api/reports/{uuid}/review` with PATCH requests could enumerate existing report IDs.

### Pitfall 4: NEXT_PUBLIC_APP_URL Not Set in Production

**What goes wrong:** If `NEXT_PUBLIC_APP_URL` is missing in the production environment, `new URL("")` throws an exception, the catch block returns 403 for ALL requests.

**Why it happens:** The CSRF helper uses `NEXT_PUBLIC_APP_URL` as the authoritative host. If this env var is missing, URL parsing fails.

**How to avoid:** The helper must have a safe fallback. Option A: use `request.headers.get('host')` as a secondary fallback when `NEXT_PUBLIC_APP_URL` is missing. Option B: assert the env var exists at startup. The implementation above returns 403 on URL parse failure — this is safe but will cause a production outage if the env var is absent.

**Warning signs:** All mutation requests returning 403 in production immediately after deploy.

### Pitfall 5: Admin Client in proxy.ts Uses Direct createClient() Not Singleton

**What goes wrong:** `src/proxy.ts` calls `createClient(url, serviceRoleKey)` directly (not `createAdminClient()`). This creates a new service-role client instance on every request that hits the proxy, bypassing the Phase 19 singleton optimization.

**Why it happens:** The proxy was written before the singleton pattern was established in Phase 19. The singleton lives in `src/lib/supabase/admin.ts` but proxy.ts imports from `@supabase/supabase-js` directly.

**How to avoid:** The audit should note this as an Info-level finding. Fix: import `createAdminClient` from `src/lib/supabase/admin` in proxy.ts. Impact is low since the proxy only runs on page loads (not API calls), but it's inconsistent.

**Warning signs:** Each page load (protected route) opens a new DB connection instead of reusing the singleton.

---

## Code Examples

Verified patterns from direct codebase read:

### Current Auth Pattern (consistent across all routes)

```typescript
// Source: src/app/api/reports/route.ts (representative)
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();
if (!authUser) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const admin = createAdminClient();
const { data: profile } = await admin
  .from("users")
  .select("id, role")
  .eq("auth_id", authUser.id)
  .single();

if (!profile) {
  return NextResponse.json({ error: "User profile not found" }, { status: 404 });
}
if (profile.role !== "student") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Current Ownership Pattern — Student Route (strong)

```typescript
// Source: src/app/api/work-sessions/[id]/route.ts
const { data: session, error: fetchError } = await admin
  .from("work_sessions")
  .select("*")
  .eq("id", id)                          // URL param
  .eq("student_id", profile.id)          // ownership filter
  .single();

if (fetchError || !session) {
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
```

### Current Ownership Pattern — Coach Route (needs review)

```typescript
// Source: src/app/api/reports/[id]/review/route.ts
// Step 1: Fetch report (no ownership filter — leaks existence via 404 vs 403)
const { data: report, error: reportError } = await admin
  .from("daily_reports")
  .select("id, student_id")
  .eq("id", id)
  .single();

if (reportError || !report) {
  return NextResponse.json({ error: "Report not found" }, { status: 404 });
}

// Step 2: Coach-student relationship check
const { data: studentMatch, error: studentError } = await admin
  .from("users")
  .select("id")
  .eq("id", report.student_id)
  .eq("coach_id", profile.id)          // ownership verified here
  .single();

if (studentError || !studentMatch) {
  return NextResponse.json({ error: "Not your student" }, { status: 403 });
}
```

### RLS initplan Pattern (confirmed in migrations)

```sql
-- Source: supabase/migrations/00001_create_tables.sql (all policies)
-- Pattern: (select get_user_role()) not auth.uid() directly
CREATE POLICY "student_select_work_sessions" ON public.work_sessions
  FOR SELECT TO authenticated
  USING ((select get_user_role()) = 'student' AND student_id = (select get_user_id()));
```

---

## State of the Art

| Old Approach | Current Approach | Impact on This Phase |
|--------------|------------------|---------------------|
| CSRF via synchronizer token | Origin header check (OWASP recommended for same-origin API) | Stateless — no session storage needed |
| Per-route admin client creation | Module-level singleton `_adminClient` (Phase 19) | Reduces connection load; proxy.ts still uses old pattern |
| Direct `auth.uid()` in RLS | `(select get_user_role())` / `(select get_user_id())` wrappers | DB-03 already satisfied |

---

## Open Questions

1. **signout route: dead code or active?**
   - What we know: CONTEXT.md says "dead code per PROJECT.md." The route exists in the codebase and handles POST correctly.
   - What's unclear: Whether any client code still calls `/api/auth/signout` directly, or whether signout is handled entirely client-side.
   - Recommendation: Audit task should grep for usages of `/api/auth/signout`. If dead, document as Info finding; no fix required.

2. **Should CSRF check use `host` header fallback when `NEXT_PUBLIC_APP_URL` is missing?**
   - What we know: `NEXT_PUBLIC_APP_URL=http://localhost:3000` is set in `.env.local`. Production deployment must set it.
   - What's unclear: Whether the production deployment has this env var set in Vercel/other host.
   - Recommendation: Claude's discretion per CONTEXT.md. Include a safe fallback: if `NEXT_PUBLIC_APP_URL` is not set, fall back to comparing against `request.headers.get('host')`. Document in code that the env var is strongly preferred.

3. **reports/[id]/review: combine queries or just return 404 for all failures?**
   - What we know: Leaking 404 vs 403 is information disclosure, but the data exposed is only "this report ID exists."
   - What's unclear: Whether returning 404 for all failure modes (including "not your student") is preferable to the single combined query.
   - Recommendation: Return 404 for all failure modes in the ownership check chain. This is the simpler fix and closes the information disclosure without a complex JOIN query.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase only reads and modifies existing TypeScript source files and produces a Markdown document; no new CLI tools, databases, or services required beyond the existing project).

---

## Validation Architecture

### Test Framework

No test framework is installed in this project (`package.json` has no jest, vitest, playwright, or test scripts). The validation approach for this phase is:

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` (type safety only) |
| Full suite command | `npm run lint && npx tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| SEC-02 | All routes have auth + role checks documented | Manual audit | Code review of `23-AUDIT-REPORT.md` | Structural — requires human review |
| SEC-03 | Mutation routes return 403 on missing/wrong Origin | Manual smoke test | `curl -X POST /api/reports -H "Content-Type: application/json" -d '{}'` → expect 403 | No test framework; curl verification |
| SEC-04 | Student cannot access another student's data | Manual smoke test | Requires two authenticated sessions — not automatable without test framework | Human approval required |
| DB-03 | RLS policies use initplan wrapper | SQL read | Direct grep of migration files: `grep "select get_user_role" supabase/migrations/` | Already confirmed PASS |

### Sampling Rate
- **Per task commit:** `npm run build && npx tsc --noEmit` — ensures no TypeScript errors introduced by CSRF helper
- **Per wave merge:** `npm run lint && npx tsc --noEmit`
- **Phase gate:** Full lint + typecheck green; human reviews `23-AUDIT-REPORT.md` and signs off before Plan 2 executes

### Wave 0 Gaps

No test framework is installed. The validation strategy for this phase is:
- **Plan 1 output:** `23-AUDIT-REPORT.md` is itself the validation artifact — reviewed by human before Plan 2 starts
- **Plan 2 validation:** TypeScript compilation confirms CSRF helper types are correct; lint confirms code style; manual curl test confirms 403 on missing Origin
- Framework install is not in scope for this phase (no test framework requirement in REQUIREMENTS.md)

---

## Project Constraints (from CLAUDE.md)

Directives that apply to Phase 23 code changes:

| Directive | Applies To | How |
|-----------|------------|-----|
| `import { z } from "zod"` — never `"zod/v4"` | Any new validation code | No new Zod usage in csrf.ts; existing routes unchanged |
| Admin client only in server code | `src/lib/csrf.ts` | csrf.ts must have no `createAdminClient()` — it only reads headers |
| `proxy.ts` not `middleware.ts` | Architecture reference | Proxy audit must read `src/proxy.ts` |
| `Never swallow errors` — every catch must toast or console.error | csrf.ts catch block | Log URL parse error before returning 403 |
| `Check response.ok` — every fetch() must check response.ok | Client components that call mutation routes | Not directly in scope; existing fetch calls are not changed |
| `Zod safeParse on all API inputs` | Existing routes | Routes already comply; CSRF helper adds no new inputs |
| `Auth + role check before validation on every API route` | Order of checks | CSRF check is before auth check — this is intentional (CSRF is cheaper than a DB round-trip and the PITFALLS.md example puts it first) |
| `Filter by user ID in queries, never rely on RLS alone` | Admin client queries | Audit verifies this is true for all student-data queries |
| `ima-* tokens only` / `44px touch targets` / `motion-safe:` | UI components | Not applicable — this phase has no UI changes |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/app/api/*/route.ts` (all 12 routes read and analyzed)
- Direct codebase read — `src/proxy.ts`
- Direct codebase read — `supabase/migrations/00001_create_tables.sql`, `00004_alert_dismissals.sql`
- Direct codebase read — `src/lib/supabase/admin.ts`, `src/lib/session.ts`
- `.planning/research/PITFALLS.md` §Pitfall 12 — CSRF is NOT automatic for route handlers (project-internal research, HIGH confidence)
- `.planning/research/PITFALLS.md` §Security Mistakes table — admin client without user ID filter risk
- `CLAUDE.md` — project coding conventions

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — auth flow diagram and component responsibilities
- `supabase/migrations/00006_v1_1_schema.sql` — v1.1 schema additions (no new RLS policies)
- [Next.js Security: Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — cited in PITFALLS.md as source for CSRF scope

### Tertiary (LOW confidence)
- None — all claims are supported by PRIMARY or SECONDARY sources

---

## Metadata

**Confidence breakdown:**
- Pre-audit findings (route gaps): HIGH — every route read directly from source
- CSRF pattern: HIGH — confirmed in PITFALLS.md with Next.js official source cited
- RLS audit (DB-03): HIGH — all policies read from migration SQL
- Proxy audit: HIGH — proxy.ts read directly
- Recommended helper implementation: MEDIUM — implementation details are Claude's discretion (per CONTEXT.md); URL comparison approach is standard OWASP pattern

**Research date:** 2026-03-30
**Valid until:** Indefinite — all findings are from direct source code read; only invalidated if routes are modified before Plan 1 executes
