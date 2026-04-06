---
status: complete
phase: 32-skip-tracker
source: [32-01-SUMMARY.md, 32-02-SUMMARY.md]
started: 2026-04-03T13:00:00Z
updated: 2026-04-03T19:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Coach Dashboard Skip Badges
expected: On the coach dashboard, StudentCards for students who have skipped days this week show an "X skipped" warning badge (amber/warning style). Students with 0 skips show no skip badge.
result: pass

### 2. Coach Card Badge Stacking
expected: If a student has both a status badge (New or At Risk) AND skipped days, both badges are visible simultaneously — stacked vertically with the skip badge above the status badge.
result: pass

### 3. Owner Students List Skip Badges
expected: On the owner students list page (/owner/students), student cards show "X skipped" warning badges for students who have skipped days this week. Students with 0 skips show no skip badge.
result: pass

### 4. Owner Student Detail Skip Badge
expected: On the owner student detail page (/owner/students/[id]), the header area shows an "X skipped this week" warning badge when the student has skipped days > 0. When 0 skips, no badge appears.
result: pass

### 5. Skip Badge Coexistence on Owner Detail
expected: On the owner student detail page, if a student is both at-risk AND has skipped days, both the at-risk badge and the "X skipped this week" badge are visible simultaneously in the header.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
