---
status: complete
phase: 11-fix-invite-registration-url
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md
started: 2026-03-18T17:00:00Z
updated: 2026-03-18T17:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Email Invite Whitelists (No Link Generated)
expected: As owner or coach, go to the Invites page and create an email invite. After submitting, you should see an "Email whitelisted!" toast and a confirmation card showing the whitelisted email with a message that the person can sign in with Google. There should be NO copyable invite link shown for email invites.
result: pass

### 2. Magic Link Still Shows Copyable URL
expected: On the Invites page, switch to the Magic Link tab. Create a magic link invite. After submitting, you should see a copyable URL card with the magic link. The URL should be in format /register?magic={code}.
result: pass

### 3. Whitelist Auto-Registration via Google OAuth
expected: Create an email invite for a test email. Then sign in with that Google account (the whitelisted email). After Google OAuth, the auth callback should auto-register the user — they should land on their dashboard, NOT on /no-access. No invite link needs to be visited.
result: pass

### 4. Invite Page Descriptions Updated
expected: Check the owner Invites page description — it should say "Whitelist emails and generate magic links for new coaches and students". Check the coach Invites page description — it should say "Whitelist emails and generate magic links for new students". NOT "Generate invite links...".
result: pass

### 5. Tab Switch Clears Stale State
expected: Create an email invite (see whitelist confirmation). Switch to Magic Link tab and back to Email tab. The whitelist confirmation card from the previous invite should be gone — no stale state showing.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
