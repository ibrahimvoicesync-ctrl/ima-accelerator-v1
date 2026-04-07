---
status: complete
phase: 37-invite-link-max-uses
source: [37-01-SUMMARY.md, 37-02-SUMMARY.md]
started: 2026-04-04T10:00:00Z
updated: 2026-04-04T10:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Max Uses Input on Coach Invites
expected: Navigate to /coach/invites. Next to the "Generate Invite Link" button, a number input labeled "Max uses" appears with a default value of 10. The input and button sit side by side in a flex row.
result: pass

### 2. Max Uses Input on Owner Invites
expected: Navigate to /owner/invites. Same layout as coach — a "Max uses" number input (default 10) sits beside the Generate button. Owner page also shows role display on link cards.
result: pass

### 3. Create Link with Custom Max Uses
expected: On either invites page, change max uses to 5, then click Generate Invite Link. A new link is created successfully (toast appears). The new link card shows "0 / 5 used".
result: pass

### 4. Usage Display Format
expected: Existing magic link cards show usage in "X / Y used" format (e.g., "0 / 10 used") instead of the old "0 uses" format.
result: pass

### 5. Exhausted Badge
expected: A magic link where use_count >= max_uses displays the usage text in red and shows an "Exhausted" badge next to it.
result: pass

### 6. Grandfathered Link Display
expected: Older links created before this feature (null max_uses) show usage as "X / ∞ used" with an infinity symbol — no Exhausted badge regardless of use count.
result: pass

### 7. Input Resets After Creation
expected: After successfully generating a new invite link, the "Max uses" number input automatically resets back to 10.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
