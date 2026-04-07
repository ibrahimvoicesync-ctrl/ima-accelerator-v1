# Phase 28: Daily Session Planner API - Research

**Researched:** 2026-03-31
**Domain:** Next.js App Router API routes, Supabase Postgres upsert / conflict handling, plan-aware cap enforcement
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** No plan yet today → block. Student must create a daily plan before starting any work session. POST /api/work-sessions returns 400 if no daily_plans row exists for the student + today's date.
- **D-02:** Plan exists, planned sessions not all completed → enforce cap. POST /api/work-sessions rejects if adding the requested session_minutes would cause total completed minutes + requested minutes to exceed the plan's total_work_minutes (240 max).
- **D-03:** Plan exists, all planned sessions completed → cap lifted. Student can start unlimited ad-hoc sessions with no time restriction.
- **D-04:** "Plan complete" detection: compare count of completed work_sessions for today against the number of sessions in plan_json. If completed >= planned count, the plan is fulfilled.
- **D-05:** API enforces cap only (total minutes), not session ordering. Client (Phase 29) handles sequential session execution.
- **D-06:** POST /api/daily-plans with UNIQUE(student_id, date) — on conflict, return the existing plan (no duplicate insert). Zod validates total_work_minutes <= 240 server-side.
- **D-07:** plan_json must include `version: 1` field for schema evolution safety. Always Zod safeParse at read, never TypeScript cast. Treat parse failure as "no plan today."

### Claude's Discretion

- plan_json Zod schema shape (fields per session entry, top-level structure)
- API response shapes (status codes, payloads, error messages)
- How to detect "plan complete" efficiently (query strategy)
- Rate limiting and CSRF patterns (reuse existing checkRateLimit + verifyOrigin)
- Auth + role check patterns (follow existing work-sessions route)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAN-08 | POST /api/daily-plans validates 4h work cap server-side; returns existing plan on conflict (idempotent) | D-06, D-07; Supabase upsert with `onConflict` + `ignoreDuplicates: false` returns existing row; Zod `total_work_minutes <= 240` |
| PLAN-09 | POST /api/work-sessions enforces 4h daily cap when a plan exists for the day | D-01 through D-05; cap check = sum completed session_minutes + requested session_minutes vs plan total_work_minutes |
</phase_requirements>

## Summary

Phase 28 adds two new API endpoints (`POST /api/daily-plans`, `GET /api/daily-plans`) and modifies the existing `POST /api/work-sessions` route. All three handlers are server-only Next.js App Router route handlers following the established CSRF → auth → role → rate-limit → Zod → admin client chain already present throughout the codebase.

The database schema (daily_plans table with UNIQUE(student_id, date)) was created in Phase 26. There are no new npm packages, no schema changes, and no external services required. All primitives — verifyOrigin, checkRateLimit, createAdminClient, getTodayUTC — already exist and are fully tested in production.

The most nuanced part of this phase is the cap-enforcement logic in POST /api/work-sessions. Three cases must be handled: (1) no plan exists → 400 block, (2) plan exists and not fulfilled → enforce 240-minute cap, (3) plan exists and all sessions completed → let through unconditionally. "Plan fulfilled" is detected by comparing the count of today's completed work_sessions against the session count in plan_json.

**Primary recommendation:** Create `src/app/api/daily-plans/route.ts` exporting `POST` and `GET`, then add plan-aware cap logic to the existing `src/app/api/work-sessions/route.ts` POST handler, inserting the plan query after the active-session conflict check.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | Already installed | Schema validation, safeParse on every input and every plan_json read | Project rule: `import { z } from "zod"`, never `"zod/v4"` |
| next/server (NextResponse) | Already installed | Response helpers | All existing route handlers use it |
| @supabase/ssr + admin client | Already installed | Auth + Postgres queries | createAdminClient() required for all route handler DB work |
| next/cache (revalidateTag) | Already installed | Cache invalidation after mutations | Pattern present in every mutation route |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| src/lib/csrf (verifyOrigin) | Local | CSRF protection | First check in every mutation handler |
| src/lib/rate-limit (checkRateLimit) | Local | 30 req/min per user+endpoint | After auth, before body parse |
| src/lib/utils (getTodayUTC) | Local | UTC-safe today date string | All daily_plans date comparisons |
| src/lib/config (WORK_TRACKER) | Local | sessionDurationOptions, dailyGoalHours | Zod refinements for session_minutes, total cap |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
src/app/api/
├── daily-plans/
│   └── route.ts        # POST (create plan) + GET (today's plan)
└── work-sessions/
    └── route.ts        # MODIFIED: add plan-aware cap enforcement
```

### Pattern 1: Idempotent Plan Creation (POST /api/daily-plans)

**What:** Insert daily plan; if UNIQUE(student_id, date) conflicts, return the existing row instead of erroring.

**When to use:** Plan creation is called once per day but the client may retry.

Supabase-js upsert approach:
```typescript
// Source: Supabase JS client docs — upsert with onConflict
const { data, error } = await admin
  .from("daily_plans")
  .upsert(
    { student_id: profile.id, date: today, plan_json: planJson },
    { onConflict: "student_id,date", ignoreDuplicates: true }
  )
  .select()
  .single();
```

`ignoreDuplicates: true` means: if a row with the same (student_id, date) already exists, skip the insert and return nothing. The caller must then do a follow-up SELECT to retrieve the existing row. The alternative — `ignoreDuplicates: false` (default) — performs an UPDATE on conflict, which would overwrite the existing plan (not desired per D-06).

**Preferred two-step pattern** (cleaner for return-existing semantics):
```typescript
// Step 1: try insert
const { data: inserted, error: insertErr } = await admin
  .from("daily_plans")
  .insert({ student_id: profile.id, date: today, plan_json: planJson })
  .select()
  .single();

if (insertErr) {
  // Postgres unique violation code
  if (insertErr.code === "23505") {
    // Return existing plan
    const { data: existing } = await admin
      .from("daily_plans")
      .select()
      .eq("student_id", profile.id)
      .eq("date", today)
      .single();
    return NextResponse.json({ data: existing }, { status: 200 });
  }
  console.error("[daily-plans POST] Insert failed:", insertErr);
  return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
}
return NextResponse.json({ data: inserted }, { status: 201 });
```

This is the same pattern used by `POST /api/work-sessions` for its `23505` unique conflict handling. HIGH confidence — verified in existing codebase.

### Pattern 2: GET Today's Plan

**What:** Return today's daily_plans row or null; no rate limiting needed (read-only).

```typescript
export async function GET(request: NextRequest) {
  // CSRF not needed for GET (safe method)
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("id, role").eq("auth_id", authUser.id).single();
  if (!profile || profile.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = getTodayUTC();
  const { data: plan } = await admin
    .from("daily_plans")
    .select()
    .eq("student_id", profile.id)
    .eq("date", today)
    .maybeSingle();

  return NextResponse.json({ data: plan ?? null });
}
```

`maybeSingle()` returns null (not an error) when no row exists. This is correct — the spec says "null if no plan exists."

### Pattern 3: Plan-Aware Cap Enforcement (POST /api/work-sessions modification)

**Insertion point:** After the active-session conflict check, before the insert. Uses `getTodayUTC()` — not the client-supplied `date` field — for the plan lookup, so the cap can never be bypassed by sending a different date.

```typescript
// After active-session check, before insert:
const today = getTodayUTC();

// Step 1: Fetch today's plan
const { data: todayPlan } = await admin
  .from("daily_plans")
  .select()
  .eq("student_id", profile.id)
  .eq("date", today)
  .maybeSingle();

if (!todayPlan) {
  return NextResponse.json(
    { error: "You must create a daily plan before starting a work session." },
    { status: 400 }
  );
}

// Step 2: Parse plan_json safely — treat parse failure as "plan complete" bypass
const planParseResult = planJsonSchema.safeParse(todayPlan.plan_json);
if (!planParseResult.success) {
  // D-07: Treat parse failure as "no plan today" → actually: per D-03 logic,
  // if we can't read the plan we should treat it as fulfilled (cap lifted).
  // See Pitfall 2 for rationale.
} else {
  const planData = planParseResult.data;
  const plannedCount = planData.sessions.length;

  // Step 3: Count today's completed sessions
  const { count: completedCount } = await admin
    .from("work_sessions")
    .select("*", { count: "exact", head: true })
    .eq("student_id", profile.id)
    .eq("date", today)
    .eq("status", "completed");

  const fulfilled = (completedCount ?? 0) >= plannedCount;

  if (!fulfilled) {
    // Step 4: Cap check — sum completed minutes + requested minutes
    const { data: completedSessions } = await admin
      .from("work_sessions")
      .select("session_minutes")
      .eq("student_id", profile.id)
      .eq("date", today)
      .eq("status", "completed");

    const completedMinutes = (completedSessions ?? []).reduce(
      (sum, s) => sum + s.session_minutes, 0
    );
    const capMinutes = planData.total_work_minutes; // max 240

    if (completedMinutes + session_minutes > capMinutes) {
      return NextResponse.json(
        { error: `Daily work cap of ${capMinutes} minutes reached. Total planned: ${capMinutes} min, already completed: ${completedMinutes} min.` },
        { status: 400 }
      );
    }
  }
  // fulfilled === true → cap lifted, fall through to insert
}
```

### Pattern 4: plan_json Zod Schema

**Discretionary design** (Claude's discretion per CONTEXT.md):

```typescript
const sessionEntrySchema = z.object({
  session_minutes: z.number().int().refine(
    (v) => (WORK_TRACKER.sessionDurationOptions as readonly number[]).includes(v),
    { message: "session_minutes must be 30, 45, or 60" }
  ),
  break_type: z.enum(["short", "long", "none"]),
  break_minutes: z.number().int().min(0),
});

const planJsonSchema = z.object({
  version: z.literal(1),           // D-07: required for schema evolution
  total_work_minutes: z.number().int().min(1).max(240),
  sessions: z.array(sessionEntrySchema).min(1),
});

type PlanJson = z.infer<typeof planJsonSchema>;
```

The `total_work_minutes` field is the server-authoritative cap value. The POST handler validates it is <= 240 and matches the sum of session durations (optional but good defense).

### Pattern 5: Request Handler Chain Order

Established pattern from existing routes (csrf.ts comment: "Order in mutation handlers: CSRF -> Auth -> Role -> RateLimit -> Body -> Zod -> Ownership -> Logic"):

```
POST /api/daily-plans:  verifyOrigin → auth → role:student → rate-limit → body → Zod → insert/conflict-return
GET  /api/daily-plans:  auth → role:student → admin query → return plan|null
POST /api/work-sessions (modified): verifyOrigin → auth → role:student → rate-limit → body → Zod → active-session-check → plan-cap-check → insert
```

### Anti-Patterns to Avoid

- **TypeScript cast on plan_json:** `plan_json as PlanJson` bypasses runtime safety. Always `planJsonSchema.safeParse(todayPlan.plan_json)`.
- **Using client-supplied `date` for plan lookup:** The request body's `date` is for the work session record; cap enforcement must always use `getTodayUTC()` so a malicious client can't bypass the cap.
- **Fetching completed sessions for fulfilled-plan path:** Don't run the cap-minute-sum query when the plan is already fulfilled. Short-circuit with `fulfilled === true → skip cap check`.
- **Using `.single()` for optional row:** Use `.maybeSingle()` for daily_plans lookups — `.single()` throws an error when no row exists.
- **Rate-limiting GET:** Read-only endpoints in this codebase do not apply checkRateLimit. Consistent with `/api/calendar` pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent insert | Custom SELECT + conditional INSERT logic spread across multiple try-catches | Postgres error code `23505` caught from `.insert()` → follow-up `.select()` | Already proven in work-sessions route; two round-trips but clean and readable |
| CSRF protection | Custom header checking | `verifyOrigin()` from `src/lib/csrf.ts` | Project-standard; handles localhost fallback |
| Rate limiting | In-memory counter | `checkRateLimit()` from `src/lib/rate-limit.ts` | DB-backed, survives serverless restarts |
| UTC date | `new Date().toLocaleDateString()` | `getTodayUTC()` from `src/lib/utils.ts` | Matches `DEFAULT CURRENT_DATE` on the Supabase instance (UTC) |
| Session duration validation | Hardcoded `[30, 45, 60]` | `WORK_TRACKER.sessionDurationOptions` from `src/lib/config.ts` | Config-is-truth rule; phase 29 uses same constant |

**Key insight:** Every helper needed for this phase already exists in the project. The entire implementation is wiring together established patterns — no new infrastructure.

## Common Pitfalls

### Pitfall 1: Date Mismatch Between Session Insert and Plan Lookup
**What goes wrong:** POST /api/work-sessions receives `date` in the body (which the client generates). The plan lookup uses this client-supplied date. A student whose local clock says "today" but whose Supabase server clock (UTC) shows "yesterday" would fail the lookup.
**Why it happens:** `DEFAULT CURRENT_DATE` on `daily_plans.date` uses the server's UTC clock. The client may be in a timezone where it's still the previous day.
**How to avoid:** Cap enforcement must use `getTodayUTC()` (server-side UTC) for the plan lookup, independent of the client's `date` field. The `date` field in the request body is stored as the work session's date; the plan lookup always uses server UTC.
**Warning signs:** Students in UTC+x timezones reporting "must create a plan" errors early in the morning.

### Pitfall 2: plan_json Parse Failure Interpretation (D-07)
**What goes wrong:** If `plan_json` fails Zod parse (corrupt data, future schema version), the business logic branches incorrectly.
**Why it happens:** D-07 says "treat parse failure as 'no plan today.'" But D-01 says "no plan → block." These two decisions together would block a student with a corrupted plan record permanently until manual DB intervention.
**How to avoid:** Apply D-07 strictly as written: treat parse failure as "no plan today." This means the student is blocked from starting sessions (D-01) — which surfaces the data corruption immediately so it can be investigated, rather than silently letting the student bypass the cap. Document this in the handler with a comment so future maintainers don't accidentally flip the behavior.
**Warning signs:** 400 responses with "You must create a daily plan" for a student who already submitted a plan.

### Pitfall 3: Off-By-One in Plan Fulfillment Count
**What goes wrong:** `completed >= planned_count` uses the wrong session count: counting ALL statuses (in_progress, paused, completed) instead of only `completed`.
**Why it happens:** A `COUNT(*)` on work_sessions without the `.eq("status", "completed")` filter includes active/paused sessions.
**How to avoid:** The fulfillment check must use `.eq("status", "completed")` explicitly. An in-progress session that hasn't finished yet does not count as fulfilling the plan.
**Warning signs:** Plan appears fulfilled while a session is still running, lifting the cap prematurely.

### Pitfall 4: Double DB Round-Trips in Cap Check
**What goes wrong:** Fetching plan + completed count + completed session rows = 3 separate queries in the hot path of POST /api/work-sessions.
**Why it happens:** Each piece of cap logic is queried independently.
**How to avoid:** The count query and the sum query can be collapsed: fetch `session_minutes` for all completed sessions today (1 query), then `array.length` gives the count and `array.reduce(...)` gives the sum. This reduces 3 queries to 2 (plan + sessions).
**Warning signs:** Slow POST /api/work-sessions responses.

### Pitfall 5: Forgetting revalidateTag After POST /api/daily-plans
**What goes wrong:** Badge/cache state goes stale after plan creation.
**Why it happens:** New mutation handler without `revalidateTag("badges", "default")`.
**How to avoid:** Every mutation route in this project calls `revalidateTag("badges", "default")` after a successful write. Add it to POST /api/daily-plans as well.

### Pitfall 6: Zod Import Path
**What goes wrong:** `import { z } from "zod/v4"` — TypeScript error, project enforces `"zod"`.
**Why it happens:** Editor autocomplete may suggest `zod/v4` in some versions.
**How to avoid:** Always `import { z } from "zod"`. This is a Hard Rule in CLAUDE.md.

## Code Examples

Verified patterns from existing codebase:

### Unique Conflict (23505) Handling Pattern
```typescript
// Source: src/app/api/work-sessions/route.ts lines 99-106
if (insertError) {
  if (insertError.code === "23505") {
    return NextResponse.json({ error: "Cycle already exists for this date" }, { status: 409 });
  }
  console.error("[work-sessions POST] Insert failed:", insertError);
  return NextResponse.json({ error: "Failed to start session" }, { status: 500 });
}
```
For daily-plans, replace the 409 response with a SELECT to return the existing plan.

### maybeSingle() for Optional Row
```typescript
// Source: src/app/api/reports/route.ts line 82
const { data: existing } = await admin
  .from("daily_reports")
  .select("id")
  .eq("student_id", profile.id)
  .eq("date", date)
  .maybeSingle();
```

### Count Query Pattern
```typescript
// Source: src/lib/rate-limit.ts lines 38-43
const { count } = await admin
  .from("rate_limit_log")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("endpoint", endpoint)
  .gte("called_at", windowStart);
const callCount = count ?? 0;
```
Apply same pattern with `.eq("status", "completed")` for fulfilled-plan detection.

### Full Auth + Role Chain
```typescript
// Source: src/app/api/work-sessions/route.ts lines 19-39
const csrfError = verifyOrigin(request);
if (csrfError) return csrfError;
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();
if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const admin = createAdminClient();
const { data: profile } = await admin
  .from("users").select("id, role").eq("auth_id", authUser.id).single();
if (!profile || profile.role !== "student") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### getTodayUTC Usage
```typescript
// Source: src/lib/utils.ts line 19
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}
// Usage in route handler:
const today = getTodayUTC(); // e.g. "2026-03-31"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| middleware.ts for route guards | proxy.ts (Next.js 16) | Phase 1 | Do not use middleware.ts |
| Client Supabase in route handlers | createAdminClient() always | v1.0 | Admin client is required for all DB queries in route handlers |
| Hardcoded role strings | ROLES constant from config.ts | v1.0 | Config-is-truth rule |

**No deprecated patterns introduced in this phase.** All patterns are current as of the existing codebase.

## Open Questions

1. **plan_json parse failure → should it block or lift the cap?**
   - What we know: D-07 says "treat parse failure as 'no plan today'"; D-01 says "no plan → block"
   - What's unclear: Was this combination intentional (force visible corruption) or an oversight?
   - Recommendation: Implement as specified (parse failure → block, D-07 + D-01 combined). Add a clear error message: "Your daily plan data is invalid. Please contact support." This surfaces corruption immediately. Document the decision in the code.

2. **Should GET /api/daily-plans also include today's completed session count in the response?**
   - What we know: Phase 29 will need to know if the plan is fulfilled to show the post-completion card
   - What's unclear: Whether the Phase 29 client wants this computed server-side or computes it from the work_sessions it already fetches
   - Recommendation: Return plan only from GET /api/daily-plans (keep it simple); Phase 29 client already fetches work_sessions separately and can compute fulfillment client-side. Avoid premature coupling.

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes (new route handlers + modification of existing route handler). No new external tools, services, runtimes, databases, or CLIs are introduced. All dependencies (Supabase, Node, npm) are already operational as Phase 27 was recently completed on this machine.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test framework installed (no jest.config, no vitest.config, no test scripts in package.json) |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

No automated test framework exists in this project. Validation is via TypeScript type-checking, ESLint, build, and UAT.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-08 | POST /api/daily-plans creates plan with cap validation and returns existing on conflict | manual UAT | `npx tsc --noEmit` (type-check) | ❌ Wave 0 — no test file |
| PLAN-08 | GET /api/daily-plans returns today's plan or null | manual UAT | `npx tsc --noEmit` | ❌ Wave 0 — no test file |
| PLAN-09 | POST /api/work-sessions blocks when no plan exists | manual UAT | `npx tsc --noEmit` | ❌ Wave 0 — no test file |
| PLAN-09 | POST /api/work-sessions enforces cap when plan exists and not fulfilled | manual UAT | `npx tsc --noEmit` | ❌ Wave 0 — no test file |
| PLAN-09 | POST /api/work-sessions allows sessions when plan is fulfilled | manual UAT | `npx tsc --noEmit` | ❌ Wave 0 — no test file |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` — catches type errors immediately
- **Per wave merge:** `npm run build && npx tsc --noEmit && npm run lint`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
No test files need to be created — project has no test framework. All validation is TypeScript + lint + manual UAT (curl or browser). This is intentional per the project's established pattern across all prior phases.

*(Wave 0 gap: "None — project has no automated test framework; type-check + build + lint + manual UAT is the established validation pattern")*

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance against:

| Directive | Applies To | How to Comply |
|-----------|-----------|---------------|
| `import { z } from "zod"` never `"zod/v4"` | planJsonSchema, postSchema in new route | Use bare `"zod"` import |
| Admin client only in server code | route.ts files | createAdminClient() already server-only |
| Auth + role check before validation on every API route | POST /api/daily-plans, GET /api/daily-plans, modified POST /api/work-sessions | Auth → role → rate-limit → Zod order |
| Filter by user ID in queries, never rely on RLS alone | All daily_plans queries | `.eq("student_id", profile.id)` on every query |
| Never swallow errors — every `catch` block must toast or `console.error` | Insert error handling | `console.error("[daily-plans POST]...", err)` |
| Check response.ok — every `fetch()` must check before parsing | N/A (server routes, no fetch calls) | Not applicable |
| Zod safeParse on all API inputs, try-catch on request.json() | POST body parsing | `try { body = await request.json() } catch {...}` then `schema.safeParse(body)` |
| ima-* tokens only, never hardcoded hex | N/A (API-only phase, no UI) | Not applicable |
| 44px touch targets, ARIA labels | N/A (API-only phase, no UI) | Not applicable |
| motion-safe: on animations | N/A (API-only phase, no UI) | Not applicable |
| Proxy.ts NOT middleware.ts | N/A (new route handlers, not middleware) | Not applicable |
| Config is truth — import from src/lib/config.ts | sessionDurationOptions, dailyGoalHours | Use `WORK_TRACKER.sessionDurationOptions` and `WORK_TRACKER.dailyGoalHours * 60` |

## Sources

### Primary (HIGH confidence)
- Existing codebase — `src/app/api/work-sessions/route.ts` — established handler pattern
- Existing codebase — `src/app/api/reports/route.ts` — maybeSingle(), idempotent insert pattern
- Existing codebase — `src/app/api/calendar/route.ts` — GET handler without CSRF/rate-limit
- Existing codebase — `src/lib/csrf.ts` — verifyOrigin implementation
- Existing codebase — `src/lib/rate-limit.ts` — checkRateLimit implementation
- Existing codebase — `src/lib/utils.ts` — getTodayUTC()
- Existing codebase — `src/lib/config.ts` — WORK_TRACKER constants
- `supabase/migrations/00013_daily_plans_undo_log.sql` — daily_plans schema, UNIQUE index, RLS policies

### Secondary (MEDIUM confidence)
- Supabase JS client docs (via WebFetch) — upsert onConflict behavior; NOT used because two-step insert+select on 23505 is already proven in codebase and more explicit

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified from codebase
- Architecture: HIGH — patterns copied from existing, proven route handlers
- Pitfalls: HIGH — derived from reading actual code and schema constraints
- plan_json schema: MEDIUM — discretionary design, reasonable interpretation of REQUIREMENTS.md PLAN-02 through PLAN-04

**Research date:** 2026-03-31
**Valid until:** 2026-06-30 (stable APIs and patterns)
