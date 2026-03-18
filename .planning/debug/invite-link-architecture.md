---
status: diagnosed
trigger: "Invite link architecture mismatch - invites should NOT generate links, only magic links should"
created: 2026-03-18T12:00:00Z
updated: 2026-03-18T12:00:00Z
---

## Current Focus

hypothesis: POST /api/invites generates a registerUrl that 404s AND conflates two separate concepts (email whitelisting vs shareable links). Both mechanisms duplicate URL generation, but only magic links are the correct vehicle for shareable registration URLs.
test: Trace full data flow from API -> UI -> registration pages
expecting: Invites and magic links are architecturally tangled in UI, with invites generating unnecessary/broken URLs
next_action: Document all affected files and recommended changes

## Symptoms

expected: Invites whitelist an email (no link generated). Magic links generate shareable registration URLs.
actual: POST /api/invites generates a registerUrl (`/register/{code}`) that gets displayed in a copyable card in the UI. Both invites AND magic links show the same "Generated invite link" copy-to-clipboard UX. The invite registerUrl points to `/register/{inviteCode}` which works (page exists at `src/app/(auth)/register/[code]/page.tsx`), but the design intent is wrong - invites should not produce copyable links at all.
errors: Architecture mismatch - invites are behaving like link generators when they should be silent whitelist records
reproduction: 1) Go to /owner/invites or /coach/invites. 2) Enter email in "Email Invite" tab. 3) Click "Generate Invite". 4) A copyable URL card appears showing registerUrl. This URL works BUT it contradicts the intended architecture.
started: Built this way from the beginning. Design intent was never implemented correctly.

## Eliminated

- hypothesis: The registerUrl 404s because the route doesn't exist
  evidence: Route DOES exist at src/app/(auth)/register/[code]/page.tsx. The invite code page validates the code against the invites table, shows role/email info, and triggers Google OAuth with invite_code param. So the URL works technically - the problem is architectural, not a 404.
  timestamp: 2026-03-18T12:05:00Z

## Evidence

- timestamp: 2026-03-18T12:01:00Z
  checked: POST /api/invites route.ts (lines 68-94)
  found: Generates a random 16-char code, inserts invite record, then builds `registerUrl = baseUrl/register/{code}` and returns it in the JSON response alongside the invite data.
  implication: Invite API is designed as a link generator, not a whitelist-only operation.

- timestamp: 2026-03-18T12:02:00Z
  checked: POST /api/magic-links route.ts (lines 59-81)
  found: Generates 8-char code, inserts magic_link record, then builds `registerUrl = baseUrl/register?magic={code}` and returns it in JSON response.
  implication: Magic links correctly generate shareable URLs. This is the mechanism that SHOULD own link generation.

- timestamp: 2026-03-18T12:03:00Z
  checked: OwnerInvitesClient.tsx and CoachInvitesClient.tsx
  found: Both components have TWO tabs - "Email Invite" and "Magic Link". BOTH tabs extract `registerUrl` from their respective API responses and display it in an identical copyable URL card (`lastUrl` state). The UI treats email invites and magic links identically from a "copy link" UX perspective.
  implication: The UI makes invites and magic links look the same to the user. Under the intended architecture, email invites should just show a success confirmation ("Email whitelisted") with no copyable link.

- timestamp: 2026-03-18T12:04:00Z
  checked: Registration pages structure
  found: Two registration flows exist - `/register/[code]` (invite-based, validates against invites table, enforces email match) and `/register?magic={code}` (magic-link-based, validates against magic_links table, no email restriction). Auth callback handles both via `invite_code` and `magic_code` query params.
  implication: The registration page for invites (`/register/[code]`) enforces that the user's Google email matches the invite email. So even if someone else gets the link, they can't register unless they own that email. This is by design for invites. BUT - since invites whitelist a specific email, the link is redundant. The whitelisted user should just go to /login, sign in with Google, and the auth callback should detect their whitelisted email and register them.

- timestamp: 2026-03-18T12:05:00Z
  checked: Auth callback route.ts (lines 59-80)
  found: There IS already a mechanism to match by email without invite code. Lines 60-80 check for a `users` row with matching email and null auth_id, then links the auth_id. BUT this only works for PRE-CREATED user profiles, not for invite records. There is NO code path that says "user has no profile, no invite_code param, but an unexpired invite exists for their email - register them."
  implication: The auth callback is MISSING the key flow that would make invites work as pure whitelists. Currently, invites REQUIRE the user to visit `/register/{code}` to trigger Google OAuth with `invite_code` param. Without that param, the callback sends unknown users to `/no-access`.

- timestamp: 2026-03-18T12:06:00Z
  checked: Invites table schema
  found: Has `code varchar(64) NOT NULL UNIQUE`. The code column is integral to the current flow but would become vestigial if invites become pure whitelists. The `expires_at` column still makes sense (whitelist expiry). The `used` boolean still makes sense (tracks if email was consumed during registration).
  implication: DB schema has a `code` column that would no longer serve a purpose in the whitelist model. Could be kept for audit trail or removed.

- timestamp: 2026-03-18T12:07:00Z
  checked: UI copy text in both invites pages
  found: Coach page says "Generate invite links for new students to join your cohort". Owner page says "Generate invite links for new coaches and students to join the platform". Email invite tab says "Link expires in 72 hours." All of this language frames invites as link generators.
  implication: Copy/labels throughout the UI reinforce the link-generator model. Will need updating to reflect whitelist model.

## Resolution

root_cause: |
  The invite system was built as a link-generator when the intended design is for invites to be email whitelists.

  **Three interlocking problems:**

  1. **API returns a URL it shouldn't.** POST /api/invites (line 91-94) constructs and returns a `registerUrl`. Under the intended architecture, invites just whitelist an email - no URL should be returned.

  2. **UI displays and copies a link that shouldn't exist.** OwnerInvitesClient and CoachInvitesClient both extract `registerUrl` from the invite API response and display it in a copyable card. Under the whitelist model, creating an invite should just show "Email whitelisted" confirmation.

  3. **Auth callback lacks the whitelist lookup.** The auth callback (src/app/api/auth/callback/route.ts) has NO code path that checks: "This user has no profile and no invite_code param, but a valid unexpired invite exists for their email - auto-register them." This is the MISSING PIECE that would make the whitelist model work. Without it, invites REQUIRE the link-based flow.

fix: |
  **Changes needed (7 files):**

  **API Layer:**
  1. `src/app/api/invites/route.ts` - Remove registerUrl generation (lines 91-94). Return only `{ data: invite }`. The `code` generation (line 68) can optionally be removed or kept for internal tracking.

  **Auth Callback (the critical missing piece):**
  2. `src/app/api/auth/callback/route.ts` - Add a new code path BEFORE the final `no-access` redirect (around line 338). After checking for invite_code and magic_code params and finding neither, check: does an unexpired, unused invite exist for `user.email`? If yes, consume it and create the user profile (same logic as the invite_code branch, minus the code lookup). This makes invites work as pure whitelists - user just signs in with Google, callback detects their whitelisted email, registers them.

  **UI Layer:**
  3. `src/components/owner/OwnerInvitesClient.tsx` - Remove `registerUrl` extraction from handleCreateInvite response. Remove `setLastUrl(registerUrl)` for email invites. Show a simple success state instead ("Email whitelisted - they can now sign in with Google"). Keep the magic link tab's registerUrl behavior unchanged.
  4. `src/components/coach/CoachInvitesClient.tsx` - Same changes as OwnerInvitesClient.

  **Dashboard Pages (copy updates):**
  5. `src/app/(dashboard)/owner/invites/page.tsx` - Update description from "Generate invite links" to "Whitelist emails and generate magic links"
  6. `src/app/(dashboard)/coach/invites/page.tsx` - Update description similarly

  **Optional cleanup:**
  7. `src/app/(auth)/register/[code]/page.tsx` and `RegisterCard.tsx` - These become unreachable for NEW invites (no URL is generated to send users there). Could be removed, or kept as a fallback for any existing unexpired invites that were already shared as links.

verification: Not applied - diagnosis only

files_changed: []
