# Phase 11: Fix Invite Registration URL - Research

**Researched:** 2026-03-18
**Domain:** Next.js App Router URL routing, invite registration flow
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COACH-05 | Coach can invite new students | Fix `registerUrl` in `POST /api/invites` route.ts line 92 so URL matches `/register/[code]` page |
| OWNER-06 | Owner can send invite codes (coach + student) | Same one-line fix in the same route file covers both roles — owner uses the same `POST /api/invites` endpoint |
</phase_requirements>

## Summary

The email invite registration flow is broken by a single mismatched URL format. `POST /api/invites` returns `registerUrl = /register?code=X` (query-param format) but the registration page that handles invite codes lives at `src/app/(auth)/register/[code]/page.tsx`, which expects the code as a path segment `/register/X`. When a student clicks the copied URL, Next.js routes them to `src/app/(auth)/register/page.tsx` — the magic link page — which shows "No Magic Link Provided" because there is no `?magic=` param.

The fix is exactly one string change on line 92 of `src/app/api/invites/route.ts`: replace `` `${baseUrl}/register?code=${code}` `` with `` `${baseUrl}/register/${code}` ``. No schema changes, no new files, no component changes.

The magic link flow is confirmed correct: `POST /api/magic-links` returns `` `${baseUrl}/register?magic=${code}` `` which routes to `src/app/(auth)/register/page.tsx` (MagicLinkCard), and the auth callback reads `?magic=` correctly. That flow is not broken and must not be changed.

**Primary recommendation:** One-line fix in `src/app/api/invites/route.ts` — change query param to path segment.

## Root Cause Analysis

### The Bug (HIGH confidence — verified by direct code inspection)

**Location:** `src/app/api/invites/route.ts`, line 92

**Current (broken):**
```typescript
const registerUrl = `${baseUrl}/register?code=${code}`;
```

**Fixed:**
```typescript
const registerUrl = `${baseUrl}/register/${code}`;
```

**Why it breaks:** Next.js App Router routes are file-system based. The file at `src/app/(auth)/register/[code]/page.tsx` handles the path `/register/{anything}`. The file at `src/app/(auth)/register/page.tsx` handles the path `/register` (with optional query params). When the URL is `/register?code=X`, Next.js routes to `register/page.tsx` (RegisterMagicPage), not `register/[code]/page.tsx` (RegisterInvitePage). The magic link page then renders an error because there is no `?magic=` query param.

### Both Requirements Share One Root Cause

COACH-05 and OWNER-06 are both broken by the same line. The owner and coach invite flows both call `POST /api/invites`, which produces the broken URL. Fixing line 92 resolves both requirements simultaneously.

## Standard Stack

### Core (no new dependencies needed)
| Component | Version | Purpose | Notes |
|-----------|---------|---------|-------|
| `src/app/api/invites/route.ts` | N/A | Invite creation API | Single line change |
| `src/app/(auth)/register/[code]/page.tsx` | N/A | Path-segment invite registration page | Already correct, no changes needed |
| `src/app/(auth)/register/page.tsx` | N/A | Magic link registration page | Already correct, no changes needed |
| `src/app/api/auth/callback/route.ts` | N/A | OAuth callback — invite/magic link handling | Already correct, no changes needed |

**No new packages, no migrations, no schema changes required.**

### URL Format Inventory (HIGH confidence)

| API route | Returns | Destination page | Status |
|-----------|---------|-----------------|--------|
| `POST /api/invites` | `/register?code=${code}` | Routes to magic link page (wrong) | **BROKEN** |
| `POST /api/magic-links` | `/register?magic=${code}` | Routes to magic link page (correct) | WORKING |

After fix:

| API route | Returns | Destination page | Status |
|-----------|---------|-----------------|--------|
| `POST /api/invites` | `/register/${code}` | Routes to `/register/[code]/page.tsx` (correct) | FIXED |
| `POST /api/magic-links` | `/register?magic=${code}` | Routes to magic link page (correct) | WORKING |

## Architecture Patterns

### Invite Registration Flow (full E2E)

```
Coach/Owner → POST /api/invites { email, role }
  → API creates invite record in DB with code
  → API returns { data, registerUrl: "${baseUrl}/register/${code}" }  ← FIXED
  → Coach/Owner copies registerUrl and sends to invitee

Invitee clicks URL → /register/{code}
  → Next.js routes to src/app/(auth)/register/[code]/page.tsx
  → Page reads code from params, fetches invite from DB
  → Validates: exists, not used, not expired
  → Renders RegisterCard with invite.code, invite.role, invite.email

Invitee clicks "Sign in with Google"
  → RegisterCard calls supabase.auth.signInWithOAuth with
    redirectTo: `${origin}/api/auth/callback?invite_code=${invite.code}`
  → Google OAuth → /api/auth/callback?invite_code=...&code=...
  → Callback: exchanges code, validates invite, creates user profile, seeds roadmap
  → Redirects to role dashboard
```

### Files and Their Responsibilities

```
src/app/api/invites/route.ts           ← THE ONE CHANGE (line 92)
src/app/(auth)/register/[code]/        ← Already correct (path-segment invite)
  page.tsx                             ← Reads params.code, renders RegisterCard
  RegisterCard.tsx                     ← OAuth redirect uses invite_code param
src/app/(auth)/register/               ← Magic link handler (don't touch)
  page.tsx                             ← Reads searchParams.magic
  MagicLinkCard.tsx                    ← OAuth redirect uses magic_code param
src/app/api/auth/callback/route.ts     ← Already correct (reads invite_code + magic_code)
```

### Anti-Patterns to Avoid

- **Changing RegisterCard or MagicLinkCard:** These are correct. The bug is only in the API returning the URL.
- **Changing the callback route:** The callback already reads `invite_code` as a query param to the callback URL (not the register URL). This is correct and separate from the registerUrl format.
- **Changing magic-links route:** Magic links use query-param format `/register?magic=X` which is correct for their page at `/register/page.tsx`. Do not change it.
- **Adding a redirect:** Do not add a redirect in `/register/page.tsx` to handle `?code=` — fixing the source URL is the right approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL routing | Custom redirect logic | Fix the source URL string | Adding redirects to patch a broken URL adds complexity; fix the root cause |
| Path segment encoding | Manual encoding | Template literal directly | Invite codes use `[a-zA-Z0-9]{16}` — no special characters, no encoding needed |

**Key insight:** This is a one-line URL string correction. The registration page, auth callback, and all components are already wired correctly.

## Common Pitfalls

### Pitfall 1: Changing the Wrong File
**What goes wrong:** Modifying `/register/page.tsx` to handle `?code=` instead of fixing the API route.
**Why it happens:** The error manifests on the register page, so it looks like a page bug.
**How to avoid:** The bug source is the API returning the wrong URL format. Fix the source.
**Warning signs:** If you find yourself adding a redirect or conditional in `register/page.tsx`, you are fixing the wrong file.

### Pitfall 2: Breaking Magic Link URL
**What goes wrong:** Also changing the magic-links route from `?magic=X` to `/register/X` because it "looks similar."
**Why it happens:** Pattern matching across similar-looking code.
**How to avoid:** Magic link registration page is at `/register/page.tsx` (root, with `?magic=` query param). Invite registration page is at `/register/[code]/page.tsx` (path segment). These are intentionally different pages with different URL formats.
**Warning signs:** If you change `POST /api/magic-links`, you are out of scope.

### Pitfall 3: Invite Code Validation Mismatch
**What goes wrong:** The path-segment code would fail the regex validation in `register/[code]/page.tsx`.
**Why it happens:** Code charset or length could theoretically mismatch the validation regex.
**How to avoid:** Verify the generated code format matches the validation. In `api/invites/route.ts` line 68: `crypto.randomUUID().replace(/-/g, "").slice(0, 16)` — produces 16 hex chars `[0-9a-f]`. The validation at `register/[code]/page.tsx` line 42: `/^[a-zA-Z0-9_-]{8,64}$/` — hex chars are a subset of `[a-zA-Z0-9]`, length 16 is within 8-64. This is already correct.

## Code Examples

### The Fix (verified from live source)

```typescript
// src/app/api/invites/route.ts — line 91-93
// Before (broken):
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? APP_CONFIG.url;
const registerUrl = `${baseUrl}/register?code=${code}`;

// After (fixed):
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? APP_CONFIG.url;
const registerUrl = `${baseUrl}/register/${code}`;
```

### Generated Code Format (line 68 of same file)

```typescript
// Invite code: 16 hex chars, matches /^[a-zA-Z0-9_-]{8,64}$/ validation in register/[code]/page.tsx
const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
```

### RegisterCard OAuth Redirect (already correct, no change)

```typescript
// src/app/(auth)/register/[code]/RegisterCard.tsx
redirectTo: `${window.location.origin}/api/auth/callback?invite_code=${invite.code}`,
// Callback reads: searchParams.get("invite_code") — correct
```

### Magic Link URL (correct, must not change)

```typescript
// src/app/api/magic-links/route.ts line 79 — DO NOT CHANGE
const registerUrl = `${baseUrl}/register?magic=${code}`;
// Routes to /register/page.tsx (magic link page) which reads searchParams.magic — correct
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| `/register?code=X` (query param) | `/register/${code}` (path segment) | Routes to correct `/register/[code]/page.tsx` |

## Open Questions

None. The bug is fully diagnosed from source code. The fix is unambiguous.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None established (nyquist_compliant: false for all phases) |
| Config file | None |
| Quick run command | `npx tsc --noEmit && npm run lint` |
| Full suite command | `npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COACH-05 | `POST /api/invites` returns `registerUrl` with path `/register/{code}` | manual-only (OAuth flow) | `npx tsc --noEmit` | N/A |
| OWNER-06 | Owner-generated invite URL format identical to coach | manual-only (OAuth flow) | `npx tsc --noEmit` | N/A |

**Manual-only justification:** The invite registration flow requires Google OAuth, which cannot be automated in unit/integration tests without a real Google account and OAuth redirect infrastructure. TypeScript and lint checks validate the code compiles correctly.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** Build passes + manual URL format verification before `/gsd:verify-work`

### Wave 0 Gaps
None — no test files needed. TypeScript compilation is the only automated check available for this one-line string fix.

## Sources

### Primary (HIGH confidence)
- `src/app/api/invites/route.ts` — direct source inspection, line 92 contains the broken URL
- `src/app/(auth)/register/[code]/page.tsx` — direct source inspection, path-segment route confirmed
- `src/app/(auth)/register/page.tsx` — direct source inspection, magic link route confirmed
- `src/app/api/auth/callback/route.ts` — direct source inspection, callback reads `invite_code` query param
- `.planning/v1.0-MILESTONE-AUDIT.md` — audit identifies exact line and expected fix

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated context — confirms audit findings independently

## Metadata

**Confidence breakdown:**
- Bug diagnosis: HIGH — verified by direct source code inspection, confirmed by audit report
- Fix approach: HIGH — one-line string change, no ambiguity, no side effects
- Scope boundary: HIGH — magic links confirmed working, only invite URL is broken

**Research date:** 2026-03-18
**Valid until:** Until phase 11 executes (changes only one line)
