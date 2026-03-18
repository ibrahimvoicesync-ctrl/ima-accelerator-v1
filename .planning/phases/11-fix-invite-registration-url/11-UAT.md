---
status: diagnosed
phase: 11-fix-invite-registration-url
source: 11-01-SUMMARY.md
started: 2026-03-18T15:10:00Z
updated: 2026-03-18T15:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Invite Link URL Format
expected: Create an invite (as coach or owner). The generated invite link should use path-segment format /register/{code} — NOT /register?code={code}. Copy the invite link and check the URL format.
result: pass

### 2. Invite Link Lands on RegisterCard
expected: Open an invite link (e.g. /register/abc123) in a browser where you are NOT logged in. You should see the RegisterCard (invite registration form with Google OAuth) — NOT the MagicLinkCard.
result: issue
reported: "404 page not found when opening invite link. Also invites shouldn't generate links at all — invites should just whitelist the email. Magic links are for generating shareable links."
severity: blocker

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Invites whitelist an email — no link generated. User registers via normal Google OAuth and auth callback auto-registers if a valid invite exists for their email."
  status: failed
  reason: "User reported: 404 page not found when opening invite link. Invites shouldn't generate links — invites should just whitelist the email. Magic links are for generating shareable links."
  severity: blocker
  test: 2
  root_cause: "Invites were built as link-generators when they should be email whitelists. Three problems: (1) POST /api/invites returns registerUrl it shouldn't, (2) UI shows copy-link card instead of 'whitelisted' confirmation, (3) auth callback has no whitelist lookup — before redirecting to /no-access it should check if an unexpired unused invite exists for user.email and auto-register."
  artifacts:
    - path: "src/app/api/invites/route.ts"
      issue: "Lines 91-94 generate registerUrl that should not exist"
    - path: "src/app/api/auth/callback/route.ts"
      issue: "No whitelist lookup — if no profile and no invite_code param, goes straight to /no-access without checking invites table"
    - path: "src/components/owner/OwnerInvitesClient.tsx"
      issue: "Displays invite registerUrl in copy card — should show 'whitelisted' confirmation"
    - path: "src/components/coach/CoachInvitesClient.tsx"
      issue: "Displays invite registerUrl in copy card — should show 'whitelisted' confirmation"
  missing:
    - "Add whitelist lookup to auth callback: before /no-access redirect, check for unexpired unused invite for user.email, consume it and create profile"
    - "Remove registerUrl from POST /api/invites response"
    - "Update UI to show 'Email whitelisted' confirmation instead of copy-link card for invites"
  debug_session: ".planning/debug/invite-link-architecture.md"
