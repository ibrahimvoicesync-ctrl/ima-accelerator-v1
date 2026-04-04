---
status: complete
phase: 36-resources-tab
source: [36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md]
started: 2026-04-04T07:00:00Z
updated: 2026-04-04T07:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev`. Server boots without errors on port 3000. Navigate to any page — it loads without crash.
result: pass

### 2. Resources Navigation in Sidebar
expected: Log in as owner, coach, or student. "Resources" link with a BookOpen icon appears in the sidebar navigation. It does NOT appear for student_diy role.
result: pass

### 3. Resources Page — Links Tab
expected: Click Resources in sidebar. A tabbed page loads with three tabs: Links, Community, Glossary. Links tab is active by default. If resources exist, they show as cards with title, URL, comment, poster name, and timestamp. Pinned resources appear first.
result: pass

### 4. Add Resource Link
expected: As owner or coach, click an "Add" button on the Links tab. A modal opens with fields for title, URL, optional comment, and a pin checkbox. Submit creates the resource and it appears in the list without page refresh.
result: pass

### 5. Delete Resource Link
expected: As owner or coach, a delete button appears on resource cards. Clicking it shows a confirmation, then removes the resource. Coach can only delete their own resources; owner can delete any.
result: pass

### 6. Community Tab — Discord Embed
expected: Click the Community tab. If Discord env vars (NEXT_PUBLIC_DISCORD_GUILD_ID, NEXT_PUBLIC_DISCORD_CHANNEL_ID) are set, a 600px Discord iframe loads. If not set, a friendly "not configured" fallback card appears.
result: pass

### 7. Glossary Tab — Alphabetical List with Search
expected: Click the Glossary tab. Terms display grouped alphabetically by first letter (A, B, C headings). A search input filters terms in real-time (case-insensitive). Terms use semantic dl/dt/dd markup.
result: pass

### 8. Add Glossary Term
expected: As owner or coach, click "Add" on Glossary tab. Modal with term and definition fields. Submit adds the term. If term name already exists, shows a "term already exists" error (409 handling).
result: pass

### 9. Edit Glossary Term
expected: As owner or coach, an edit button appears on glossary terms. Clicking opens the same modal pre-filled with existing term/definition. Submit updates the term in-place.
result: pass

### 10. Student Read-Only View
expected: Log in as student. Resources page loads with all three tabs visible. No "Add" buttons, no delete icons, no edit buttons. Content is fully readable but not editable.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

## Change Requests (from UAT)

- **CR-1:** Add Resources navigation and page for student_diy role (user request — overrides D-11/RES-02 exclusion)
- **CR-2:** Add NEXT_PUBLIC_DISCORD_GUILD_ID and NEXT_PUBLIC_DISCORD_CHANNEL_ID as placeholders in .env.local
