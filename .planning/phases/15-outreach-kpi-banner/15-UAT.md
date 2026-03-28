---
status: complete
phase: 15-outreach-kpi-banner
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md]
started: 2026-03-28T12:00:00Z
updated: 2026-03-28T12:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Report Form — Granular Outreach Fields
expected: Navigate to the student report page. The old single "Outreach Count" field should be gone. Instead you see granular outreach fields in the form.
result: pass
note: User changed from 5 to 3 fields by preference

### 2. Report Form — Submit Outreach Data
expected: Fill in the outreach fields with test values and submit a daily report. The form submits successfully without errors and you see a success confirmation.
result: pass

### 3. Progress Banner — Visible on All Student Pages
expected: Navigate to /student. A sticky KPI summary banner is visible at the top of the content area. Navigate to /student/work, /student/roadmap, /student/report — the same banner appears on all student pages and stays pinned when you scroll.
result: pass

### 4. Progress Banner — KPI Metrics Display
expected: The banner shows 6 metrics: Lifetime Outreach, Daily Outreach, Daily Hours (each with a colored RAG dot — green, amber, or red), plus Calls Joined, Brands Contacted, Influencers Contacted (plain numbers, no RAG dot).
result: pass

### 5. KPI Breakdown Cards — Student Homepage
expected: On /student homepage, below the Work Progress section, there are 3 KPI cards: Lifetime Outreach, Daily Outreach, and Hours Worked. Each card shows a large number and a colored progress bar indicating RAG status.
result: pass

### 6. RAG Color Accuracy
expected: KPI progress bars and dots reflect actual data: green when on/above target, amber when slightly behind, red when far behind. If the student account is brand new (day zero), RAG indicators show neutral (not red).
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
