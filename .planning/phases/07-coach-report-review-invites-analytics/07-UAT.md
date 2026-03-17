---
status: complete
phase: 07-coach-report-review-invites-analytics
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md]
started: 2026-03-17T14:55:00Z
updated: 2026-03-17T15:35:00Z
retest_started: 2026-03-17T15:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Coach Reports Inbox Page
expected: Navigate to /coach/reports while logged in as a coach. You should see 4 stat cards at the top (Total Reports, Pending Review, Reviewed, Avg Hours) and a list of student reports from the last 7 days below.
result: pass

### 2. Report Filter Tabs and Student Dropdown
expected: On /coach/reports, click the filter tabs (Unreviewed / Reviewed / All) — the report list updates to show only matching reports. Use the student dropdown to filter reports by a specific student.
result: pass (retest)
original_issue: "the filter is not working. I can see an unreviewed report in unreviewed and reviewed"
fix: "Key prop added to CoachReportsClient (07-04, commit 1d24ccc)"

### 3. Expand Report Row
expected: Click on a report row to expand it. You should see the full report details including star rating display, wins, and improvements sections. Click again to collapse.
result: pass

### 4. Toggle Report Review Status
expected: Click the review button on an unreviewed report. The button should update immediately (optimistic) to show "Un-review" and the report moves to the Reviewed tab. Click "Un-review" to reverse it. A toast notification confirms each action.
result: pass

### 5. Coach Invites Page
expected: Navigate to /coach/invites. You should see 4 stat cards (Total Invites, Used, Active Links, Expired/Inactive) and a tabbed interface with "Email Invite" and "Magic Link" tabs.
result: pass

### 6. Create Email Invite
expected: On the Email Invite tab, enter a student's email address and submit. An invite code is generated. A "Copy" button copies the invite URL to your clipboard. The invite appears in the history list below with an "Active" badge.
result: pass (retest)
original_issue: "I am able to invite already existing email. I was able to invite ibrahimvoicesync@gmail.com, who already is in the system. This shouldn't be possible"
fix: "409 duplicate-email guard added to POST /api/invites (07-04, commit c2ba6ed)"

### 7. Generate Magic Link
expected: On the Magic Link tab, click the generate button (no email needed). A shareable URL with an 8-character code is generated and displayed. Copy it to clipboard. The link appears in the magic link history.
result: pass

### 8. Deactivate and Reactivate Magic Link
expected: In the magic link history, click "Deactivate" on an active link. The status updates immediately to inactive. Click "Reactivate" to re-enable it. Toast notifications confirm each action.
result: pass

### 9. Coach Analytics Page
expected: Navigate to /coach/analytics. You should see 4 metric stat cards (Report Submission Rate %, Avg Star Rating, Avg Hours/Day, Avg Outreach Count) computed from the last 7 days. Below that, a Student Breakdown card shows counts of Active, At-Risk, Inactive, and New students.
result: pass

### 10. Sidebar Reports Badge
expected: In the sidebar, the "Reports" nav item shows a numeric badge with the actual count of unreviewed reports (not a placeholder "(badge)" text). If all reports are reviewed, no badge appears. The count updates when you review/un-review reports (after page refresh).
result: pass

## Summary

total: 10
passed: 10
issues: 0 (2 retested and passed)
pending: 0
skipped: 0

## Gaps

- truth: "Report filter tabs correctly show only matching reports (Unreviewed shows only unreviewed, Reviewed shows only reviewed)"
  status: failed
  reason: "User reported: the filter is not working. I can see an unreviewed report in unreviewed and reviewed"
  severity: major
  test: 2
  root_cause: "useState(reports) in CoachReportsClient.tsx only initializes on first mount. Client navigation via router.push does not remount the component, so localReports stays stale from the initial render even though the server passes correctly-filtered reports prop."
  artifacts:
    - path: "src/components/coach/CoachReportsClient.tsx"
      issue: "useState(reports) ignores prop updates after mount — localReports never re-syncs on client navigation"
  missing:
    - "Add key prop to CoachReportsClient in page.tsx based on filter+student params to force remount on navigation"
  debug_session: ".planning/debug/coach-reports-filter-tabs-bug.md"

- truth: "Email invite API validates that the email does not belong to an existing user in the system"
  status: failed
  reason: "User reported: I am able to invite already existing email. I was able to invite ibrahimvoicesync@gmail.com, who already is in the system. This shouldn't be possible"
  severity: major
  test: 6
  root_cause: "POST /api/invites has no SELECT check against users table before INSERT. After Zod validation it jumps straight to generating code and inserting into invites. Admin client bypasses RLS so no DB-level guard exists either."
  artifacts:
    - path: "src/app/api/invites/route.ts"
      issue: "Missing existing-user check between validation (line 46) and code generation (line 48)"
  missing:
    - "Add users table lookup by email before insert, return 409 Conflict if user exists"
  debug_session: ".planning/debug/invites-duplicate-email-check.md"
