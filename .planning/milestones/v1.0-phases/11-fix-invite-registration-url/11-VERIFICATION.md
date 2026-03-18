---
phase: 11-fix-invite-registration-url
verified: 2026-03-18T18:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  previous_scope: "Plans 01 only (path-segment URL fix). New success criteria cover the whitelist architecture added by Plans 02 and 03."
  gaps_closed:
    - "POST /api/invites no longer returns registerUrl — invites are pure whitelists"
    - "Auth callback checks for unexpired unused invite by email (ilike) BEFORE /no-access redirect and auto-registers"
    - "Invite UI shows Email whitelisted confirmation card instead of copy-link card"
    - "Magic link tab still shows copyable link card (unchanged)"
  gaps_remaining: []
  regressions: []
---

# Phase 11: Fix Invite Registration URL — Verification Report

**Phase Goal:** Email invites work as pure email whitelists — no link is generated, auth callback auto-registers whitelisted users on Google sign-in
**Verified:** 2026-03-18T18:00:00Z
**Status:** passed
**Re-verification:** Yes — previous verification covered Plan 01 only (path-segment URL fix). This verification covers the full whitelist architecture from Plans 02 and 03 against revised success criteria.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/invites does NOT return registerUrl — invites are whitelists, not link generators | VERIFIED | `src/app/api/invites/route.ts` line 93: `return NextResponse.json({ data: invite }, { status: 201 })` — no `registerUrl` field. Zero grep matches for `registerUrl` or `APP_CONFIG` in this file. |
| 2 | Auth callback checks for unexpired unused invite matching user email BEFORE redirecting to /no-access, and auto-registers if found | VERIFIED | `src/app/api/auth/callback/route.ts` lines 338-446: whitelist lookup block using `.ilike("email", user.email).eq("used", false).gt("expires_at", ...)` inserted before the final `/no-access` redirect on line 446. Atomic consume + profile insert + roadmap seed all present. |
| 3 | After creating an email invite, the UI shows "Email whitelisted" confirmation — NOT a copyable URL card | VERIFIED | `OwnerInvitesClient.tsx` line 81: toast title `"Email whitelisted!"`; lines 290-306: `{lastWhitelistedEmail && <Card variant="accent">...<p>Email whitelisted</p>...}`. `CoachInvitesClient.tsx` identical pattern. The copy-link card at line 309 (Owner) and 291 (Coach) is gated by `lastUrl && activeTab === "magic"` — it cannot appear for email invites. |
| 4 | Magic link tab continues to show copyable link card (unchanged) | VERIFIED | `OwnerInvitesClient.tsx` line 105: `handleCreateMagicLink` still extracts `registerUrl` from `/api/magic-links` response and calls `setLastUrl(registerUrl)`. Copy card at line 309 renders when `lastUrl && activeTab === "magic"`. Magic-links route line 79: `` `${baseUrl}/register?magic=${code}` `` is unchanged. |
| 5 | Invite UI page descriptions say "Whitelist emails" not "Generate invite links" | VERIFIED | Owner page line 47: `"Whitelist emails and generate magic links for new coaches and students"`. Coach page line 47: `"Whitelist emails and generate magic links for new students"`. No occurrence of `"Generate invite links"` in either page. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/invites/route.ts` | Invite creation API — no registerUrl, email normalized to lowercase | VERIFIED | 94 lines. Line 49: `normalizedEmail = parsed.data.email.toLowerCase()`. Lines 60, 78: uses `normalizedEmail` for DB lookup and insert. Line 93: response is `{ data: invite }` only. No `APP_CONFIG` import. |
| `src/app/api/auth/callback/route.ts` | Auth callback with whitelist lookup before /no-access | VERIFIED | 447 lines. Lines 338-443: complete whitelist lookup block. `.ilike()` on line 346, `.eq("used", false)` on 347, `.gt("expires_at", ...)` on 348. Atomic consume on lines 355-361. Profile insert on lines 387-397. Roadmap seed on lines 417-434. Final `/no-access` on line 446 is the last resort. |
| `src/components/owner/OwnerInvitesClient.tsx` | Owner invite UI with whitelist confirmation, no copy-link for email invites | VERIFIED | 436 lines. `lastWhitelistedEmail` state on line 56. Whitelist confirmation card lines 289-306. Copy card gated `lastUrl && activeTab === "magic"` on line 309. `handleCreateInvite` parses `{ data }` only (no `registerUrl`). `CheckCircle` imported line 11. |
| `src/components/coach/CoachInvitesClient.tsx` | Coach invite UI with whitelist confirmation, no copy-link for email invites | VERIFIED | 414 lines. Same pattern as OwnerInvitesClient: `lastWhitelistedEmail` state line 55, whitelist card lines 271-288, copy card gated `lastUrl && activeTab === "magic"` line 291. |
| `src/app/(dashboard)/owner/invites/page.tsx` | Owner invites page with updated description copy | VERIFIED | Line 47: `"Whitelist emails and generate magic links for new coaches and students"` |
| `src/app/(dashboard)/coach/invites/page.tsx` | Coach invites page with updated description copy | VERIFIED | Line 47: `"Whitelist emails and generate magic links for new students"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/auth/callback/route.ts` | `invites` table | `admin.from("invites").ilike("email", user.email)` | WIRED | Lines 343-351: query for unexpired unused invite. Pattern `from.*invites.*ilike` confirmed on line 343-346. |
| `src/app/api/auth/callback/route.ts` | `users` table | `admin.from("users").insert(...)` for auto-registration | WIRED | Lines 387-397: inserts user profile with `auth_id`, `email`, `name`, `role`, `coach_id`. Result checked on line 399. |
| `src/components/owner/OwnerInvitesClient.tsx` | `/api/invites` | `fetch POST` — response no longer has registerUrl | WIRED | Line 66-76: `fetch("/api/invites", { method: "POST" })`, parses `{ data }` only. No `registerUrl` extraction from invite response. |
| `src/components/coach/CoachInvitesClient.tsx` | `/api/invites` | `fetch POST` — response no longer has registerUrl | WIRED | Lines 65-75: `fetch("/api/invites", { method: "POST" })`, parses `{ data }` only. |
| `src/components/owner/OwnerInvitesClient.tsx` | `/api/magic-links` | `fetch POST` — response still has registerUrl for magic links | WIRED | Lines 95-106: `handleCreateMagicLink` parses `{ data, registerUrl }`. `setLastUrl(registerUrl)` preserved. |
| `src/components/coach/CoachInvitesClient.tsx` | `/api/magic-links` | `fetch POST` — response still has registerUrl for magic links | WIRED | Lines 94-105: same pattern. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COACH-05 | 11-01-PLAN.md, 11-02-PLAN.md, 11-03-PLAN.md | Coach can invite new students | SATISFIED | `POST /api/invites` permits `profile.role === "coach"` (line 30). Email normalized and stored. Auth callback whitelist lookup auto-registers the invited student when they sign in with Google. Coach invite UI shows whitelist confirmation. REQUIREMENTS.md line 142: marked Complete / Phase 11. |
| OWNER-06 | 11-01-PLAN.md, 11-02-PLAN.md, 11-03-PLAN.md | Owner can send invite codes (coach + student) | SATISFIED | Same `POST /api/invites` permits `profile.role === "owner"` (line 30). Owner can invite both coach and student roles (line 52 blocks only coaches from inviting coach roles, not owners). Owner invite UI shows whitelist confirmation. REQUIREMENTS.md line 149: marked Complete / Phase 11. |

No orphaned requirements — REQUIREMENTS.md maps only COACH-05 and OWNER-06 to Phase 11, both claimed by all three plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No TODO/FIXME/PLACEHOLDER/stub patterns found in any modified file. No empty handlers. No responses ignoring DB results. All catch blocks log errors or toast. All fetch calls check `response.ok` before parsing JSON. |

---

### Human Verification Required

#### 1. End-to-end whitelist registration via Google OAuth

**Test:** As a coach or owner, create an email invite for a test email address. Do NOT copy any link. Open a private browser window, navigate to `/login`, and sign in with Google using the whitelisted email.
**Expected:** Auth callback finds the invite by email (ilike lookup), atomically marks it used, creates the user profile with the correct role, seeds roadmap progress if student, and redirects to the role dashboard. No `/no-access` page appears.
**Why human:** Requires a live Supabase instance, a real Google OAuth credential matching the whitelisted email, and a running Next.js server to execute the auth callback flow.

#### 2. Non-whitelisted email still hits /no-access

**Test:** Attempt Google sign-in with an email that has NOT been invited and has no existing profile.
**Expected:** Auth callback falls through the whitelist lookup (no matching invite), reaches line 446, and redirects to `/no-access`.
**Why human:** Requires live environment and a Google account not in the database.

#### 3. Magic link tab copy card unchanged

**Test:** As a coach or owner, switch to the Magic Link tab and generate a magic link.
**Expected:** A copyable URL card appears with the magic link URL. No whitelist confirmation card appears.
**Why human:** Requires verifying tab state rendering and that the two card types do not interfere — automated checks confirm the conditional logic is correct but cannot render the React component.

---

### Gaps Summary

No gaps. All 5 observable truths are verified against the actual codebase.

The full whitelist architecture is implemented across three plans:

- **Plan 01** — Fixed `registerUrl` to path-segment format (superseded by Plan 02 which removes `registerUrl` entirely).
- **Plan 02** — Auth callback now performs case-insensitive whitelist lookup (`.ilike()`) before the `/no-access` redirect. Atomically consumes invite, creates user profile with correct role and `coach_id`, seeds roadmap for students. `POST /api/invites` normalizes email to lowercase and returns `{ data: invite }` without `registerUrl`. `APP_CONFIG` import removed.
- **Plan 03** — Both invite client components replaced copy-link card with `"Email whitelisted"` confirmation card driven by `lastWhitelistedEmail` state. Copy-link card gated to `lastUrl && activeTab === "magic"`. Tab switch clears both states. Page descriptions updated to `"Whitelist emails and generate magic links"`.

Both COACH-05 and OWNER-06 are fully satisfied by this implementation.

---

_Verified: 2026-03-18T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
