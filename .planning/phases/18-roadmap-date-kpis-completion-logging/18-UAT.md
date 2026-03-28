---
status: complete
phase: 18-roadmap-date-kpis-completion-logging
source: [18-01-SUMMARY.md, 18-02-SUMMARY.md]
started: 2026-03-28T18:15:00Z
updated: 2026-03-28T18:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Student Roadmap — Active Step Deadline Chips
expected: Steps with target_days that are not yet completed show colored Badge chips — green "On Track", amber "Due Soon", or red "Overdue" depending on days remaining relative to the deadline.
result: pass

### 2. Student Roadmap — No Chip on Null Target Days
expected: Steps where target_days is null (no deadline configured) show NO deadline chip at all — just the step content without any badge.
result: pass

### 3. Student Roadmap — Completed Step Badge
expected: Completed steps show a green "Completed" Badge with the formatted completion date (e.g., "Completed Mar 28, 2026").
result: pass

### 4. Student Roadmap — Late Completion Suffix
expected: If a step was completed after its deadline, the completed Badge includes a "(Xd late)" suffix showing how many days late (e.g., "Completed Mar 20, 2026 (3d late)"). On-time completions show no late suffix.
result: pass

### 5. Coach View — Deadline Chips on Student Roadmap
expected: Navigate to coach view > student detail > Roadmap tab. The same deadline chips (on-track/due-soon/overdue/completed) display for each step, matching the student's own view. No "Mark Complete" button — coach view is read-only.
result: pass

### 6. Owner View — Deadline Chips on Student Roadmap
expected: Navigate to owner view > student detail > Roadmap tab. Same deadline chips display as coach view. Read-only — no Mark Complete button.
result: pass

### 7. Progress Bar Shows /15 Denominator
expected: The roadmap progress bar (coach/owner view) shows "X / 15" (not /10). The progress bar fill, aria-valuemax, and aria-label all reflect the correct 15-step total.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
