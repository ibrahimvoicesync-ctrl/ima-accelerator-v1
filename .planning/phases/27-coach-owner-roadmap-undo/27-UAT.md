---
status: complete
phase: 27-coach-owner-roadmap-undo
source: [27-01-SUMMARY.md, 27-02-SUMMARY.md]
started: 2026-03-31T08:00:00Z
updated: 2026-03-31T08:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Undo Button on Completed Steps
expected: As a coach or owner viewing a student's roadmap, every completed step shows a small undo button (circular arrow icon) next to it. The button has a visible icon and is tappable (44px target).
result: pass

### 2. Confirmation Modal Opens
expected: Clicking the undo button opens a confirmation modal/dialog asking you to confirm the undo action. The modal shows which step will be reverted.
result: pass

### 3. Cascade Warning in Modal
expected: When the next step (N+1) after the one being undone is currently active/unlocked, the confirmation modal mentions that it will also be re-locked. When there is no active next step, the modal shows a simpler description without cascade warning.
result: pass

### 4. Undo Reverts Step Successfully
expected: Confirming the undo in the modal reverts the completed step back to incomplete. The page refreshes to reflect the new state. A success toast or visual confirmation appears.
result: pass

### 5. Cascade Re-lock of Next Step
expected: After undoing step N, if step N+1 was active/unlocked, it becomes locked again. The roadmap visually reflects this — the next step is no longer accessible.
result: pass

### 6. Error Toast on Failure
expected: If the undo API call fails (e.g., network error or server error), an error toast appears with a message. The error is never silently swallowed.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
