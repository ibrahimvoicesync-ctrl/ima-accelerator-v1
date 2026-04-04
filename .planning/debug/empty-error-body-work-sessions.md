---
status: diagnosed
trigger: "POST /api/work-sessions 400 error returns empty body {} to client instead of {error: '...'}"
created: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Focus

hypothesis: The server-side code is correct and returns valid JSON. The root cause is the client-side error-handling code at WorkTrackerClient.tsx:135 which silently swallows the response.json() parse error via .catch(() => ({})), combined with no user-facing error display. The {} seen in the console IS the .catch fallback, not the server response. The actual response body is most likely valid JSON but may be an HTML error page from Turbopack dev server (compile error or HMR stale module) OR the response.json() is succeeding with the correct body but the user is misreading the console output.
test: Add explicit error logging in the .catch to surface the actual parse error
expecting: Either SyntaxError (body is HTML/empty) or the error body is actually correct and displayed fine
next_action: Fix client-side code to properly handle and display errors

## Symptoms

expected: Client receives `{ error: "You must create a daily plan before starting a work session." }` in the 400 response body
actual: Client receives empty object `{}` from `.catch(() => ({}))` fallback on `response.json()` call
errors: response.json() fails on line 135, .catch fallback fires
reproduction: POST /api/work-sessions when no daily plan exists for the student
started: After phase 28 plan-check code was added

## Eliminated

- hypothesis: proxy.ts intercepts or rewrites the 400 response
  evidence: proxy.ts config.matcher explicitly excludes api/ routes with negative lookahead "/((?!_next/static|_next/image|favicon.ico|api/).*)"
  timestamp: 2026-03-31

- hypothesis: CSRF check (verifyOrigin) is the one blocking instead of plan check
  evidence: verifyOrigin returns 403 not 400. Also tested NextResponse.json({error:"Forbidden"},{status:403}) - body is valid JSON. Even if CSRF fired, response.json() should succeed.
  timestamp: 2026-03-31

- hypothesis: middleware.ts is intercepting the response
  evidence: No middleware.ts exists anywhere in src/
  timestamp: 2026-03-31

- hypothesis: NextResponse.json() produces invalid or empty response body
  evidence: Direct Node.js test confirms NextResponse.json({error:"..."},{status:400}) produces valid JSON body of 72 bytes with correct content-type
  timestamp: 2026-03-31

- hypothesis: fetch interceptors or service workers modify the response
  evidence: No global.fetch override, no window.fetch override, no service worker files found
  timestamp: 2026-03-31

- hypothesis: next.config.ts rewrites or redirects API routes
  evidence: next.config.ts is bare with no config options
  timestamp: 2026-03-31

- hypothesis: Unhandled exception in route handler before reaching plan check
  evidence: All supabase-js queries use {data,error} pattern (never throw). All imports resolve. TypeScript compiles with zero errors. Every code path returns NextResponse.json().
  timestamp: 2026-03-31

- hypothesis: Zod v4 incompatibility causes runtime errors
  evidence: Tested Zod v4 (^4.3.6) - z.object, z.literal, z.enum, z.array, safeParse, flatten all work correctly
  timestamp: 2026-03-31

- hypothesis: Environment variable misconfiguration causes CSRF mismatch
  evidence: .env.local has NEXT_PUBLIC_APP_URL=http://localhost:3000, CSRF origin check would match localhost:3000 for same-origin requests
  timestamp: 2026-03-31

## Evidence

- timestamp: 2026-03-31
  checked: proxy.ts config.matcher pattern
  found: Matcher "/((?!_next/static|_next/image|favicon.ico|api/).*)" excludes all /api/ paths
  implication: proxy.ts never touches API route responses

- timestamp: 2026-03-31
  checked: NextResponse.json() output for 400 status
  found: Produces status:400, content-type:application/json, body:{"error":"You must create a daily plan before starting a work session."} (72 bytes)
  implication: Server-side response generation is correct

- timestamp: 2026-03-31
  checked: All return paths in POST route handler
  found: 13 return statements, ALL use NextResponse.json(). No path returns {} or falls through.
  implication: Server code cannot produce an empty {} response

- timestamp: 2026-03-31
  checked: Client error handling at WorkTrackerClient.tsx:134-137
  found: .catch(() => ({})) silently swallows JSON parse errors. console.error logs result but NO user-facing error display (no toast, no state update, no alert)
  implication: (1) Parse errors are invisible -- can't distinguish "body was empty" from "body was HTML" from "body was correct JSON". (2) No UI feedback for ANY API error in handleStart.

- timestamp: 2026-03-31
  checked: TypeScript compilation
  found: npx tsc --noEmit passes with zero errors
  implication: No type-level issues in the codebase

- timestamp: 2026-03-31
  checked: Zod v4 runtime behavior
  found: safeParse, flatten, z.literal, z.enum all work correctly in Zod 4.3.6
  implication: Schema validation in route handler works correctly

## Resolution

root_cause: Two issues found -- (1) PRIMARY: The .catch(() => ({})) on WorkTrackerClient.tsx:135 silently swallows the actual error from response.json(), making it impossible to diagnose whether the body was empty, HTML, or something else. This is a diagnostic black hole. (2) SECONDARY: There is NO user-facing error display in the handleStart error path (lines 134-137). The error is only logged to console.error, so users never see the plan-check error message regardless of whether response.json() succeeds or fails.
fix:
verification:
files_changed: []
