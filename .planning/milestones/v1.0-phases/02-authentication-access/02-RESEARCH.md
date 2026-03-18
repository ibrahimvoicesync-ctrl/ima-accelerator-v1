# Phase 2: Authentication & Access - Research

**Researched:** 2026-03-16
**Domain:** Supabase Auth (Google OAuth), invite-gated registration, Next.js 16 App Router auth patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login page design:**
- Branded centered card layout: IMA Accelerator title, tagline ("Student Performance & Coaching Platform"), prominent "Sign in with Google" button
- Subtle "Invite-only access" note below the button
- Uses ima-* tokens, matches existing placeholder structure but polished
- Same full-height centered layout as current placeholder

**Register page design:**
- Invite details shown before sign-in: "You've been invited as a [Role]" with role badge, then "Sign in with Google to complete your registration" and the Google button
- Page validates invite code on load (server-side): if valid → show role + sign-in button; if invalid/expired/used → show error state with "Back to login" link
- Magic link registration uses same card layout with different copy: "Join as a [Role]" instead of "You've been invited as a [Role]"
- Both invite code and magic link pages share the same visual structure

**Error messaging:**
- Inline alert banner inside the auth card — red/warning style, contextual, stays visible until page changes
- Friendly + actionable error messages per error type:
  - `expired_invite`: "This invite has expired. Ask your coach for a new one."
  - `email_mismatch`: "This invite is for a different email address. Sign in with the email your coach invited."
  - `already_used`: "This invite has already been used."
  - `auth_failed`: "Something went wrong. Try again."
  - `already_registered`: "You already have an account. Sign in instead."
  - `magic_link_invalid`: "This link has expired or is no longer valid. Ask for a new one."
- Errors passed via query params from callback (e.g., `?error=expired_invite`) — auth pages read the param to display the inline alert

**No-access page:**
- Explain + guide approach: "Access Required" heading, explains IMA is invite-only, tells user to ask their coach or Abu Lahya for an invite, "Back to login" button
- Upgrade from current minimal "You do not have permission" page

### Claude's Discretion
- Exact Google sign-in button styling (Google branding guidelines vs custom)
- Loading states during invite validation on register page
- Session helper implementation pattern (getSessionUser utility design)
- Per-page auth check approach (server component pattern)
- Sign-out redirect behavior (straight to /login)
- last_active_at update frequency and pattern

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in via Google OAuth | `supabase.auth.signInWithOAuth({ provider: "google" })` from browser client; callback at `/api/auth/callback` exchanges code for session |
| AUTH-02 | User can register with invite code (invite-only) | Callback reads `invite_code` query param, validates invites table, atomically marks used=true, creates users row, seeds roadmap |
| AUTH-03 | User can register via magic link | Callback reads `magic_code` query param, validates magic_links table, optimistic-lock use_count increment, creates users row, seeds roadmap |
| AUTH-04 | User is routed to role-specific dashboard after login (owner/coach/student) | `ROLE_REDIRECTS` from config.ts maps role → route; callback redirects accordingly |
| AUTH-05 | Unauthorized user sees no-access page | proxy.ts already handles unauthenticated + no-profile cases; no-access page needs explain+guide upgrade |
| AUTH-06 | User session persists across browser refresh | Supabase SSR client stores session in cookies; proxy.ts refreshes session on every request via `createServerClient` cookie handlers |
</phase_requirements>

---

## Summary

This phase implements the complete authentication and access control system for the IMA Accelerator. The core flow is: Google OAuth via Supabase → `/api/auth/callback` route handler → invite/magic-link validation → user profile creation → role-based redirect. All infrastructure is already built in Phase 1 (proxy.ts route guard, all three Supabase clients, config.ts with ROLE_REDIRECTS and ROADMAP_STEPS). The callback handler logic exists verbatim in `reference-old/src/app/api/auth/callback/route.ts` and is ready to adapt.

The V1 design decision diverges from the reference-old project in one important way: login page uses the light ima-* token theme (bg-ima-bg, ima-surface, blue primary) rather than the dark warm-brown gradient theme in reference-old. The CONTEXT.md is explicit: "Uses ima-* tokens, matches existing placeholder structure but polished." The placeholder already establishes this pattern correctly.

The three plans map cleanly: (1) the callback API route — pure server logic with no UI; (2) the auth pages — login, register/[code], register (magic link), no-access; (3) session helpers — `getSessionUser` utility and per-page auth checks for server components in the dashboard. The proxy.ts route guard already handles the majority of access control; per-page auth checks serve as defense-in-depth for server components that need the user object.

**Primary recommendation:** Adapt `reference-old/src/app/api/auth/callback/route.ts` directly into `src/app/api/auth/callback/route.ts` — the logic is complete, tested, and handles all edge cases. The only V1 schema difference to verify is that `users` table has no `last_active_at` column (it was removed per migration comments). Auth pages should be written fresh following the ima-* token light theme, not ported from reference-old's dark theme.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/ssr | 0.9.0 | SSR-compatible Supabase client with cookie session management | Official Supabase package for Next.js App Router; handles cookie-based session persistence |
| @supabase/supabase-js | 2.99.2 | Base Supabase client (admin client uses this) | Required by @supabase/ssr and for createClient in admin.ts |
| next | 16.1.6 | App Router, Route Handlers (GET /api/auth/callback), Server Components | Project stack — App Router server components for register page server-side validation |
| react | 19.2.3 | Client components (login button needs onClick handler) | Project stack |
| lucide-react | 0.576.0 | Icons (AlertCircle for error banner, ShieldX for no-access, etc.) | Already installed, used in Phase 1 Sidebar |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwind-merge | 3.5.0 | Merge conditional Tailwind class strings | For conditional error/state class combinations in auth card components |
| zod | 4.3.6 | Input validation in API routes | Not needed in callback (no user input); used if sign-out route added |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase SSR cookie sessions | JWT-only stateless sessions | Supabase SSR is the officially supported pattern for Next.js; stateless would require custom refresh logic |
| Server component for register page validation | Client-side validation | Server validation prevents Google OAuth round-trip on invalid codes (user decision: validate server-side first) |

**Installation:** No new packages needed — all dependencies are already installed.

**Version verification:** Confirmed against npm registry 2026-03-16: @supabase/ssr@0.9.0, @supabase/supabase-js@2.99.2, next@16.1.6.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase creates:

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx          # "use client" — Google OAuth button
│   │   ├── register/
│   │   │   ├── [code]/
│   │   │   │   └── page.tsx      # Server component — invite validation + sign-in UI
│   │   │   └── page.tsx          # Server component — magic link validation + sign-in UI
│   │   └── no-access/
│   │       └── page.tsx          # Server component — explain+guide, no interactivity needed
│   └── api/
│       └── auth/
│           └── callback/
│               └── route.ts      # GET handler — OAuth code exchange + user creation
└── lib/
    └── session.ts                # getSessionUser() helper for server components
```

### Pattern 1: OAuth Callback Route Handler

The callback is a Next.js Route Handler (GET). It runs server-side only. The full flow:

1. Supabase redirects to `/api/auth/callback?code=XXX[&invite_code=YYY][&magic_code=ZZZ]`
2. `exchangeCodeForSession(code)` — exchanges the OAuth code for a session (sets cookies)
3. `supabase.auth.getUser()` — get the authenticated user from the just-created session
4. Check `users` table by `auth_id` — if profile exists, update `updated_at` (no `last_active_at` column in V1), redirect to role dashboard
5. If no profile by `auth_id`, check by email with `is("auth_id", null)` — link auth_id if found
6. If `invite_code` param: validate invite → atomic consume (`used=false` filter) → create user → seed roadmap if student
7. If `magic_code` param: validate magic link → optimistic-lock `use_count` → create user → seed roadmap if student
8. No code found, no profile: redirect to `/no-access`

**Critical V1 schema difference from reference-old:** The V1 `users` table does NOT have a `last_active_at` column (removed per migration comment: "streak_count and last_active_at removed from V1"). The reference-old callback updates `last_active_at` — this must be removed when adapting.

```typescript
// Source: reference-old/src/app/api/auth/callback/route.ts (adapted)
// Atomic invite consumption — prevents race condition
const { data: consumed } = await admin
  .from("invites")
  .update({ used: true })
  .eq("id", invite.id)
  .eq("used", false)   // optimistic lock — fails if already consumed
  .select("id")
  .single();

if (!consumed) {
  return NextResponse.redirect(`${origin}/register/${inviteCode}?error=already_used`);
}
```

```typescript
// Magic link optimistic-lock use_count increment
const { data: claimed } = await admin
  .from("magic_links")
  .update({ use_count: magicLink.use_count + 1 })
  .eq("id", magicLink.id)
  .eq("use_count", magicLink.use_count)  // fails if concurrent request beat us
  .eq("is_active", true)
  .select("id")
  .single();
```

### Pattern 2: Register Page — Server Component Validation

Register pages are async Server Components. They validate the invite/magic code before rendering any UI. This prevents the user from clicking "Sign in with Google", completing OAuth, and only then discovering their invite is expired.

```typescript
// Source: reference-old/src/app/(auth)/register/[code]/page.tsx (adapted)
export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const { error } = await searchParams;

  // Validate format before hitting DB
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(code)) {
    return <ErrorCard message="Invalid invite link." />;
  }

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, email, role, code, used, expires_at")
    .eq("code", code)
    .single();

  if (!invite || invite.used || new Date(invite.expires_at) < new Date()) {
    return <ErrorCard message="..." />;
  }

  return <RegisterCard invite={invite} error={error} />;
}
```

### Pattern 3: Login Page — Client Component

The login page needs a click handler to call `signInWithOAuth`, which requires `"use client"`. The Google OAuth redirect URL must pass `invite_code` or `magic_code` as params so the callback can identify registration context.

```typescript
// Source: reference-old/src/app/(auth)/login/page.tsx (adapted to ima-* tokens)
"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };
  // ...
}
```

For register pages, the redirectTo must carry the context code:
```typescript
// In RegisterCard (client component inside register/[code]/page.tsx)
redirectTo: `${window.location.origin}/api/auth/callback?invite_code=${invite.code}`
// In MagicLinkCard (client component inside register/page.tsx)
redirectTo: `${window.location.origin}/api/auth/callback?magic_code=${magicCode}`
```

### Pattern 4: getSessionUser Helper

A server-side utility for server components in the dashboard that need to know who the current user is. Uses the SSR client + admin client for defense-in-depth.

```typescript
// src/lib/session.ts — recommendation (Claude's discretion)
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/config";

export type SessionUser = {
  authId: string;
  id: string;
  email: string;
  name: string;
  role: Role;
  coachId: string | null;
};

/**
 * Gets the authenticated user with their platform profile.
 * Redirects to /login if not authenticated, /no-access if no profile.
 * Use in server components that require auth.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, email, name, role, coach_id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) redirect("/no-access");

  return {
    authId: user.id,
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    coachId: profile.coach_id,
  };
}

/**
 * Like getSessionUser but also enforces role access.
 * Redirects to ROLE_REDIRECTS[user.role] if role doesn't match.
 */
export async function requireRole(allowed: Role | Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(user.role)) {
    const { ROLE_REDIRECTS } = await import("@/lib/config");
    redirect(ROLE_REDIRECTS[user.role]);
  }
  return user;
}
```

### Anti-Patterns to Avoid

- **Using `supabase.auth.getSession()` instead of `getUser()`:** `getSession()` reads from the local cookie without server-side verification. `getUser()` sends a request to Supabase Auth server — it is the only truly secure check. Always use `getUser()` in server code.
- **Using the SSR client (not admin) for DB operations in the callback:** The SSR client uses the anon key and goes through RLS. At callback time the session may not be fully propagated. Always use `createAdminClient()` for all DB operations in the callback route.
- **Forgetting `invite_code` / `magic_code` in the OAuth `redirectTo`:** Without these params in the callback URL, registrations fail silently — the callback has no way to know which invite to consume.
- **Putting `createAdminClient()` in a client component:** admin.ts has `import "server-only"` — it will throw a build error if imported client-side.
- **Not rolling back invite consumption on user creation failure:** If user insert fails after invite is marked used, the invite is burned. The callback must rollback `used` to `false`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow | Custom OAuth redirect/exchange | `supabase.auth.signInWithOAuth()` + `exchangeCodeForSession()` | PKCE flow, state management, token storage handled by Supabase |
| Session cookie management | Custom cookie logic | `createServerClient` from @supabase/ssr | Handles cookie rotation, expiry, secure flags across SSR/client |
| Concurrency in invite consumption | Manual SELECT → UPDATE | `UPDATE ... WHERE used=false` optimistic lock | Prevents double-registration race condition without transactions |
| Route protection | Custom auth middleware | `proxy.ts` (already built) | Already handles all unauthenticated + role-based redirects |
| TypeScript DB types | Manual interface definitions | `src/lib/types.ts` (already written) | All table row/insert/update types already defined |

**Key insight:** Supabase's SSR client handles the entire session persistence problem (cookie-based, server-readable, automatically refreshed). The only custom code needed is the business logic: invite validation, user creation, roadmap seeding.

---

## Common Pitfalls

### Pitfall 1: last_active_at in V1 Schema
**What goes wrong:** The reference-old callback updates `last_active_at` on every login — but V1's `users` table does NOT have this column. Copying the callback verbatim will cause a runtime DB error.
**Why it happens:** Migration comment says "streak_count and last_active_at removed from V1" — the table definition confirms it (no `last_active_at` column).
**How to avoid:** When adapting the callback, remove all references to `last_active_at`. The `updated_at` column is auto-updated by trigger on any UPDATE.
**Warning signs:** Supabase returns error on the update query; TypeScript may not catch it since admin client bypasses typed schema in some operations.

### Pitfall 2: Supabase Redirect URL Not Configured
**What goes wrong:** Google OAuth redirects to a URL that Supabase hasn't allowlisted — OAuth fails with "redirect_uri_mismatch".
**Why it happens:** Supabase Auth requires explicit allowlisting of redirect URLs in the Dashboard (Auth > URL Configuration > Redirect URLs).
**How to avoid:** Document in plan that `http://localhost:3000/api/auth/callback` (dev) and the production URL must be added to Supabase redirect URL allowlist before testing. This is a Supabase Dashboard config step, not a code step.
**Warning signs:** OAuth redirect fails immediately, error visible in browser URL bar.

### Pitfall 3: Missing `(auth)` Layout File
**What goes wrong:** Next.js requires a `layout.tsx` in each route group. Without it, auth pages may inherit the dashboard layout (which includes the Sidebar).
**Why it happens:** The current `(auth)` group only has two page files — no layout.tsx.
**How to avoid:** Create `src/app/(auth)/layout.tsx` that renders children without the Sidebar layout. The reference-old version is a passthrough: `export default function AuthLayout({ children }) { return <>{children}</>; }`
**Warning signs:** Login page renders with a sidebar on the left.

### Pitfall 4: searchParams Requires `await` in Next.js 16
**What goes wrong:** Accessing `searchParams.error` directly (without await) throws in Next.js 16 — searchParams is now a Promise.
**Why it happens:** Next.js 16 changed params and searchParams to be async Promises in App Router server components.
**How to avoid:** Always `await params` and `await searchParams` before destructuring. The reference-old code does this correctly.
**Warning signs:** Runtime error: "searchParams.error is not readable as it is a Promise"; TypeScript errors if types are wrong.

### Pitfall 5: Proxy.ts Cannot Use server-only Imports
**What goes wrong:** Importing `createAdminClient` from `src/lib/supabase/admin.ts` in proxy.ts causes a build error because admin.ts has `import "server-only"`.
**Why it happens:** proxy.ts runs in a middleware-like context that is distinct from the server-only execution context.
**How to avoid:** In proxy.ts, use `createClient` from `@supabase/supabase-js` directly (not the admin wrapper). This is already done correctly in the existing proxy.ts.
**Warning signs:** Build error: "This module cannot be imported from a Client Component or similar contexts."

### Pitfall 6: Zod Import
**What goes wrong:** `import { z } from "zod/v4"` causes a module not found error.
**Why it happens:** The project rule is explicit: always `import { z } from "zod"`. The `/v4` sub-path does not exist as a valid import in zod@4.x.
**How to avoid:** Always use `import { z } from "zod"`.

### Pitfall 7: Register Page Route Structure
**What goes wrong:** Magic link register page lives at `/register?magic=XXX` (query param), but invite code page lives at `/register/[code]` (path param). These are different routes and require different files.
**Why it happens:** Invite codes use path params (`/register/abc123`) for clean URLs; magic links use query params (`/register?magic=abc`) because one magic link serves multiple users.
**How to avoid:** Create `src/app/(auth)/register/page.tsx` for magic links and `src/app/(auth)/register/[code]/page.tsx` for invite codes.

---

## Code Examples

Verified patterns from existing project code:

### OAuth Sign-In Trigger (Client Component)
```typescript
// Pattern from reference-old/src/app/(auth)/login/page.tsx
"use client";
import { createClient } from "@/lib/supabase/client";

const handleGoogleLogin = async () => {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  });
};
```

### Register Page with Invite Context Passed to OAuth
```typescript
// redirectTo carries invite_code so callback can identify registration context
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${window.location.origin}/api/auth/callback?invite_code=${invite.code}`,
  },
});
```

### Roadmap Seeding (from reference-old callback)
```typescript
// Source: reference-old/src/app/api/auth/callback/route.ts
if (invite.role === "student") {
  const roadmapRows = ROADMAP_STEPS.map((step) => ({
    student_id: newUser.id,
    step_number: step.step,
    step_name: step.title,
    status: step.step === 1 ? "completed" as const
           : step.step === 2 ? "active" as const
           : "locked" as const,
    completed_at: step.step === 1 ? new Date().toISOString() : null,
  }));
  await admin.from("roadmap_progress").insert(roadmapRows);
}
```

### Error Banner Component Pattern (inline in auth card)
```typescript
// Error param read from searchParams, displayed as inline alert
{error && (
  <div
    role="alert"
    className="rounded-lg bg-ima-error/10 border border-ima-error/20 p-3 text-sm text-ima-error"
  >
    {ERROR_MESSAGES[error] ?? "Something went wrong. Try again."}
  </div>
)}
```

### Google Sign-In Button SVG (inline, standard Google colors)
```typescript
// Standard Google "G" logo with official brand colors — Claude's discretion
<button onClick={handleGoogleLogin} className="... min-h-[44px] ...">
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92..." />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66..." />
    <path fill="#FBBC05" d="M5.84 14.09..." />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64..." />
  </svg>
  Sign in with Google
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` for route protection | `proxy.ts` (custom middleware-like) | Next.js 16 | proxy.ts already built in Phase 1 — don't touch it |
| `supabase.auth.getSession()` for auth checks | `supabase.auth.getUser()` | Supabase best practices 2024 | getUser() is server-verified; getSession() reads local cookie only |
| `searchParams.error` direct access | `await searchParams` then destructure | Next.js 15+ | Required in App Router server components — will throw without await |
| `createClient` from `@supabase/auth-helpers-nextjs` | `createServerClient` from `@supabase/ssr` | 2024 | auth-helpers deprecated; @supabase/ssr is the current package |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Deprecated, replaced by `@supabase/ssr` — do not use.
- `supabase.auth.getSession()` in server code: Reads local cookie without verification — use `getUser()` for all server-side auth checks.

---

## Open Questions

1. **Invite code format validation regex**
   - What we know: reference-old uses `/^[a-f0-9]{16,64}$/i` (hex only). V1 INVITE_CONFIG uses `crypto.randomUUID()` style codes or similar.
   - What's unclear: The invite code generation hasn't been implemented yet (Phase 7/9). The code format regex in the register page needs to match whatever format is generated.
   - Recommendation: Use a permissive regex `/^[a-zA-Z0-9_-]{8,64}$/` that accepts UUIDs, hex strings, and base64url variants. Tighten later when generation is known.

2. **`revalidateTag` usage in callback**
   - What we know: reference-old uses `revalidateTag("platform-stats", "max")` after user creation.
   - What's unclear: V1 has no cache tags set up yet. Calling `revalidateTag` with an unused tag is harmless but irrelevant.
   - Recommendation: Omit `revalidateTag` in V1 callback — no caching infrastructure exists yet. Add in Phase 8 when owner stats are built.

3. **Auth layout.tsx missing**
   - What we know: `src/app/(auth)/` has no `layout.tsx`.
   - What's unclear: Whether Next.js 16 requires an explicit layout in every route group or inherits the root layout.
   - Recommendation: Create `src/app/(auth)/layout.tsx` as a passthrough (renders children only) to be explicit and prevent any accidental Sidebar inheritance. Low-risk addition.

---

## Validation Architecture

### Test Framework

No test framework is installed in this project. `package.json` has no test scripts, no jest/vitest/playwright config, and no `tests/` directory.

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None — Wave 0 gap |
| Quick run command | N/A until framework installed |
| Full suite command | N/A until framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google OAuth redirect triggers and returns to callback | manual-only | N/A — requires live Google OAuth | Manual: click "Sign in with Google", verify redirect |
| AUTH-02 | Valid invite code → user created, roadmap seeded, role redirect | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| AUTH-03 | Valid magic link → user created, use_count incremented, role redirect | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| AUTH-04 | Role routing: owner→/owner, coach→/coach, student→/student | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| AUTH-05 | No-access redirect for unauthenticated + no-profile users | integration | N/A — Wave 0 gap | ❌ Wave 0 |
| AUTH-06 | Session persists after browser refresh | manual-only | N/A — requires browser session state | Manual: refresh page, verify stay logged in |

**Justification for manual-only tests:** AUTH-01 and AUTH-06 require live Google OAuth and browser session state — these cannot be automated without a full E2E test runner (Playwright) and Google OAuth test credentials, which are out of scope for V1.

### Sampling Rate
- **Per task commit:** Manual smoke test (open /login, verify page renders without errors)
- **Per wave merge:** Manual: full registration flow end-to-end (login, register, redirect)
- **Phase gate:** All 6 requirements manually verified before `/gsd:verify-work`

### Wave 0 Gaps

No automated test framework to install for this phase — manual testing is the verification strategy for auth flows. The following would be needed if automation were added:

- [ ] `tests/auth/callback.test.ts` — unit tests for callback route logic (mock Supabase admin)
- [ ] `tests/auth/session.test.ts` — unit tests for getSessionUser helper
- [ ] Framework: `npm install -D vitest @vitejs/plugin-react` if unit tests desired

---

## Sources

### Primary (HIGH confidence)
- `reference-old/src/app/api/auth/callback/route.ts` — Full callback implementation, read directly
- `src/proxy.ts` — Phase 1 route guard implementation, read directly
- `src/lib/config.ts` — ROLE_REDIRECTS, ROADMAP_STEPS, INVITE_CONFIG, AUTH_CONFIG, read directly
- `src/lib/types.ts` — V1 Database types including users table (no last_active_at), read directly
- `supabase/migrations/00001_create_tables.sql` — V1 schema, confirmed users table columns, read directly
- `src/lib/supabase/admin.ts`, `server.ts`, `client.ts` — All three client factories, read directly
- `src/app/(auth)/login/page.tsx`, `no-access/page.tsx` — Existing placeholders to replace/upgrade, read directly
- `.planning/phases/02-authentication-access/02-CONTEXT.md` — User decisions, read directly

### Secondary (MEDIUM confidence)
- `reference-old/src/app/(auth)/register/[code]/page.tsx` — Register page pattern (different theme, same logic)
- `reference-old/src/app/(auth)/register/page.tsx` — Magic link register page pattern
- `reference-old/src/app/(auth)/no-access/page.tsx` — No-access page pattern (different theme, same structure)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json and npm registry
- Architecture: HIGH — callback logic read directly from reference-old, schema confirmed from migration
- Pitfalls: HIGH — last_active_at issue confirmed by reading migration SQL; other pitfalls from direct code inspection
- Session helpers: MEDIUM — getSessionUser design is Claude's discretion; pattern follows established Supabase SSR conventions

**Research date:** 2026-03-16
**Valid until:** 2026-06-16 (stable auth libraries, 90-day estimate)
