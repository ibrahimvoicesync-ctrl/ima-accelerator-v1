# Phase 2: Authentication & Access - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely enter the platform via Google OAuth with invite gating, and land on the correct role dashboard. Covers: OAuth callback handler, invite code consumption, magic link registration, auth page UI (login, register, no-access), session helpers, and per-page auth checks. Does NOT cover: invite generation UI (Phase 7/9), user management, or onboarding flows.

</domain>

<decisions>
## Implementation Decisions

### Login page design
- Branded centered card layout: IMA Accelerator title, tagline ("Student Performance & Coaching Platform"), prominent "Sign in with Google" button
- Subtle "Invite-only access" note below the button
- Uses ima-* tokens, matches existing placeholder structure but polished
- Same full-height centered layout as current placeholder

### Register page design
- Invite details shown before sign-in: "You've been invited as a [Role]" with role badge, then "Sign in with Google to complete your registration" and the Google button
- Page validates invite code on load (server-side): if valid → show role + sign-in button; if invalid/expired/used → show error state with "Back to login" link
- Magic link registration uses same card layout with different copy: "Join as a [Role]" instead of "You've been invited as a [Role]"
- Both invite code and magic link pages share the same visual structure

### Error messaging
- Inline alert banner inside the auth card — red/warning style, contextual, stays visible until page changes
- Friendly + actionable error messages per error type:
  - `expired_invite`: "This invite has expired. Ask your coach for a new one."
  - `email_mismatch`: "This invite is for a different email address. Sign in with the email your coach invited."
  - `already_used`: "This invite has already been used."
  - `auth_failed`: "Something went wrong. Try again."
  - `already_registered`: "You already have an account. Sign in instead."
  - `magic_link_invalid`: "This link has expired or is no longer valid. Ask for a new one."
- Errors passed via query params from callback (e.g., `?error=expired_invite`) — auth pages read the param to display the inline alert

### No-access page
- Explain + guide approach: "Access Required" heading, explains IMA is invite-only, tells user to ask their coach or Abu Lahya for an invite, "Back to login" button
- Upgrade from current minimal "You do not have permission" page

### Claude's Discretion
- Exact Google sign-in button styling (Google branding guidelines vs custom)
- Loading states during invite validation on register page
- Session helper implementation pattern (getSessionUser utility design)
- Per-page auth check approach (server component pattern)
- Sign-out redirect behavior (straight to /login)
- last_active_at update frequency and pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth implementation
- `reference-old/src/app/api/auth/callback/route.ts` — Complete callback handler with invite consumption, magic link handling, email matching, roadmap seeding, and rollback logic
- `src/proxy.ts` — Route guard already built (Phase 1) — handles auth redirects and role-based access
- `src/lib/supabase/admin.ts` — Server-only admin client (service-role, bypasses RLS)
- `src/lib/supabase/server.ts` — SSR client for server components
- `src/lib/supabase/client.ts` — Browser client for client components

### Configuration
- `src/lib/config.ts` — ROUTES.auth, AUTH_CONFIG, INVITE_CONFIG, ROLE_REDIRECTS, ROADMAP_STEPS (for seeding)
- `.planning/PROJECT.md` — Auth constraints (Google OAuth only, invite-only, roles in users table not JWT)

### Existing auth pages
- `src/app/(auth)/login/page.tsx` — Placeholder login page (replace with real implementation)
- `src/app/(auth)/no-access/page.tsx` — Placeholder no-access page (upgrade with explain+guide copy)

### Database
- `supabase/migrations/` — Schema for users, invites, magic_links tables with RLS policies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/app/api/auth/callback/route.ts` — Full callback implementation ready to adapt for V1 (invite consumption with optimistic locking, magic link with use_count, email matching, roadmap seeding, rollback on failure)
- `src/lib/supabase/admin.ts` — createAdminClient() already built with server-only guard
- `src/lib/supabase/server.ts` — SSR client already built
- `src/lib/config.ts` — ROUTES.auth.callback, AUTH_CONFIG, ROLE_REDIRECTS, ROADMAP_STEPS all ready

### Established Patterns
- proxy.ts uses inline createClient (not createAdminClient) because it runs in middleware-like context — cannot use server-only import
- Admin client used in callback for all DB operations (bypasses RLS)
- Defense in depth: RLS + server-side user ID filtering
- Error passing via query params (?error=error_type) on redirects

### Integration Points
- `src/app/(auth)/` route group — auth pages live here, no sidebar layout
- `src/app/(dashboard)/` route group — dashboard pages with sidebar layout
- `src/app/api/auth/callback/route.ts` — needs to be created (no API routes exist yet)
- Google OAuth configured in Supabase Dashboard (Auth > Providers > Google), not in code
- Supabase handles the OAuth redirect flow; callback route exchanges code for session

</code_context>

<specifics>
## Specific Ideas

- Register page validates invite server-side before showing the sign-in button — prevents confusion from clicking "Sign in" only to get an error after OAuth
- Error copy is warm and actionable — always tells the user what to do next ("Ask your coach for a new one", "Sign in with the email your coach invited")
- No-access page specifically mentions Abu Lahya by name — this is a mentorship program, not a generic SaaS
- Magic link and invite code pages share the same visual structure but with different copy to keep the implementation DRY

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-authentication-access*
*Context gathered: 2026-03-16*
