---
phase: 260401-tuq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/csrf.ts
  - src/app/api/work-sessions/route.ts
autonomous: true
requirements: [BUG-CSRF-LOGGING, BUG-DAILY-PLANS-ERROR]
must_haves:
  truths:
    - "CSRF hostname mismatch in production emits a console.error with both origin and expected host"
    - "daily_plans query failure returns 500 with clear error, not misleading 400 'create a plan'"
    - "No existing behavior is broken — happy-path logic unchanged"
  artifacts:
    - path: "src/lib/csrf.ts"
      provides: "CSRF verification with diagnostic logging on all rejection paths"
      contains: "console.error"
    - path: "src/app/api/work-sessions/route.ts"
      provides: "Work session creation with proper daily_plans error handling"
      contains: "dailyPlanError"
  key_links:
    - from: "src/app/api/work-sessions/route.ts"
      to: "src/lib/csrf.ts"
      via: "verifyOrigin import"
      pattern: "verifyOrigin"
---

<objective>
Fix two production bugs causing work sessions to fail silently:

1. CSRF origin check logs nothing on hostname mismatch, making production 403s invisible to debugging
2. daily_plans query silently swallows Supabase errors, returning a misleading "create a plan" error when the real problem is a missing table or query failure

Purpose: Make production failures diagnosable and stop misleading error messages from masking real issues.
Output: Two patched files with proper error logging and handling.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/lib/csrf.ts
@src/app/api/work-sessions/route.ts

<interfaces>
<!-- From src/lib/csrf.ts (full file, 39 lines): -->
```typescript
// Line 14: Main export
export function verifyOrigin(request: Request): NextResponse | null

// Line 16: reads NEXT_PUBLIC_APP_URL env var
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

// Line 19-20: falls back to request Host header
const expectedHost = appUrl
  ? new URL(appUrl).host
  : request.headers.get("host");

// Line 30-31: THE BUG — no logging on mismatch
if (originHost !== expectedHost) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Line 34: Only this path logs
console.error("CSRF check: malformed Origin header", origin);
```

<!-- From src/app/api/work-sessions/route.ts lines 90-104: THE BUG -->
```typescript
// Line 91-96: error field is IGNORED — only destructures data
const { data: todayPlan } = await admin
  .from("daily_plans")
  .select()
  .eq("student_id", profile.id)
  .eq("date", today)
  .maybeSingle();

// Line 99-104: if todayPlan is null (from error OR no row), same 400 message
if (!todayPlan) {
  return NextResponse.json(
    { error: "You must create a daily plan before starting a work session." },
    { status: 400 }
  );
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add diagnostic logging to CSRF origin mismatch</name>
  <files>src/lib/csrf.ts</files>
  <action>
In `src/lib/csrf.ts`, add a `console.error` log on the hostname mismatch path (line 30-31, inside the `if (originHost !== expectedHost)` block).

The log must include:
- A clear prefix: `"CSRF check: origin host mismatch"`
- The actual origin host: `originHost`
- The expected host: `expectedHost`
- The raw `NEXT_PUBLIC_APP_URL` value: `appUrl` (to show if env var is set or undefined)

Example format:
```typescript
if (originHost !== expectedHost) {
  console.error(
    "CSRF check: origin host mismatch",
    { originHost, expectedHost, NEXT_PUBLIC_APP_URL: appUrl }
  );
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

Do NOT change any other behavior — same 403 response, same null return on success, same malformed-origin log.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>CSRF hostname mismatch path logs both actual and expected host values plus the raw env var value, enabling instant diagnosis of production misconfigurations.</done>
</task>

<task type="auto">
  <name>Task 2: Handle daily_plans query errors in work-sessions POST</name>
  <files>src/app/api/work-sessions/route.ts</files>
  <action>
In `src/app/api/work-sessions/route.ts`, fix the daily_plans query (lines 91-104) to properly handle Supabase errors separately from "no plan exists".

Change the destructuring on line 91 from:
```typescript
const { data: todayPlan } = await admin
```
to:
```typescript
const { data: todayPlan, error: dailyPlanError } = await admin
```

Then, BEFORE the existing `if (!todayPlan)` check (line 99), add an error check:

```typescript
if (dailyPlanError) {
  console.error("[work-sessions POST] daily_plans query failed:", dailyPlanError);
  return NextResponse.json(
    { error: "Failed to check daily plan. Please try again." },
    { status: 500 }
  );
}
```

This ensures:
- If the daily_plans TABLE doesn't exist (migration not applied): returns 500 with server log showing the real Supabase error
- If the query succeeds but no plan exists: returns the existing 400 "You must create a daily plan" (unchanged)
- All other code after this block remains UNTOUCHED — plan_json parsing, cap enforcement, session insert

Do NOT change anything else in the file. The fix is strictly: destructure the error, check it, return 500 if present.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>daily_plans query failure returns 500 with diagnostic log instead of misleading 400 "create a plan" message. Happy path (no error, plan exists or not) unchanged.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `npm run lint` passes
3. In `src/lib/csrf.ts`: the `originHost !== expectedHost` branch now has a `console.error` with both host values
4. In `src/app/api/work-sessions/route.ts`: `dailyPlanError` is destructured and checked before the `!todayPlan` check
5. No other behavior changed in either file
</verification>

<success_criteria>
- CSRF mismatch in production now produces a server log with actionable diagnostic info (both hosts + env var value)
- daily_plans query failure (missing table, network error, etc.) returns 500 with server log, not misleading 400
- TypeScript compiles, lint passes, no regressions
</success_criteria>

<output>
After completion, create `.planning/quick/260401-tuq-bug-work-sessions-fail-in-production-dia/260401-tuq-SUMMARY.md`

IMPORTANT: Include in the summary a "Production Environment Checklist" section noting what the user must verify manually:
1. `NEXT_PUBLIC_APP_URL` must be set to the production URL (e.g., `https://yourdomain.com`) in Vercel environment variables — NOT `http://localhost:3000`
2. Migration 00013 (daily_plans table) must be applied in the production Supabase database
3. Migration 00006 (session_minutes column) must be applied in the production Supabase database
</output>
