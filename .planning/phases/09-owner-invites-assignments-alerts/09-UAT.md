---
status: diagnosed
phase: 09-owner-invites-assignments-alerts
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-03-17T12:00:00Z
updated: 2026-03-17T12:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from scratch. Server boots without errors, no migration or build failures. Navigate to the app in browser — homepage or dashboard loads with live data.
result: pass

### 2. Owner Invites Page — Role Selector & Email Invite
expected: Navigate to /owner/invites. Page shows 4 stat cards (Total Invites, Used, Active Links, Expired/Inactive). A role selector dropdown with "student" and "coach" options appears above tabs, defaulting to "student". Select "coach", switch to Email tab, enter an email and submit. Invite is created successfully for coach role.
result: pass

### 3. Owner Magic Link Creation with Role
expected: On /owner/invites, select a role (student or coach) from the dropdown, switch to the Magic Link tab, and generate a link. A magic link URL appears with a copy-to-clipboard button. The link is created for the selected role.
result: pass

### 4. Owner Magic Link Toggle
expected: On /owner/invites in the Magic Links history section, click the activate/deactivate toggle on an existing magic link. The link status changes immediately (optimistic update). The toggle persists on page refresh.
result: pass

### 5. Invite & Link History Shows Role Labels
expected: On /owner/invites, the invite history and magic links history tables display a role label (student/coach) for each row, distinguishing which role the invite or link was created for.
result: pass

### 6. Owner Student Detail — Coach Assignment Dropdown
expected: Navigate to /owner/students and click into a student's detail page. A coach assignment dropdown appears in the header area showing available coaches in "Coach Name (N students)" format, with the currently assigned coach pre-selected (or "Unassigned" if none).
result: pass

### 7. Coach Assignment Change
expected: On the owner student detail page, change the coach dropdown selection. The assignment updates immediately with a success toast. On page refresh, the new coach is still selected. Changing to "Unassigned" removes the coach assignment.
result: pass

### 8. /owner/assignments Navigation Redirect
expected: Click "Assignments" in the owner sidebar navigation. The browser redirects to /owner/students (no dedicated assignments page).
result: issue
reported: "this does make no sense there should be a dedicated page"
severity: major

### 9. Owner Alerts Page — Alert Cards
expected: Navigate to /owner/alerts. Alert cards display for at-risk conditions: inactive students (3-6 days, warning), dropoff students (7+ days, critical), unreviewed daily reports (summary with count), and/or coach underperformance (avg rating < 2.5). Each card shows severity icon, badge, time-ago info, and a "View Details" link.
result: issue
reported: "when someone is new he automatically is a drop off and that shouldn't be the case"
severity: major

### 10. Dismiss an Alert
expected: On /owner/alerts, click "Dismiss" on an active alert card. The alert moves to dismissed state immediately (optimistic). On page refresh, the alert remains dismissed. The sidebar badge count decreases.
result: pass

### 11. Alert Filter Tabs
expected: On /owner/alerts, three filter tabs appear: All, Active, Dismissed. "Active" tab shows an active count badge. Clicking each tab filters the alert cards accordingly — Active shows only undismissed alerts, Dismissed shows only dismissed ones, All shows everything.
result: pass

### 12. Sidebar Alerts Badge
expected: The owner sidebar shows a numeric badge next to "Alerts" indicating the count of active (undismissed) alerts. When all alerts are dismissed, the badge disappears or shows 0.
result: pass

## Summary

total: 12
passed: 10
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Assignments should have a dedicated page, not redirect to /owner/students"
  status: failed
  reason: "User reported: this does make no sense there should be a dedicated page"
  severity: major
  test: 8
  root_cause: "/owner/assignments is a redirect-only page per locked decision in 09-02. Assignment functionality is embedded in student detail view but has no standalone management page."
  artifacts:
    - path: "src/app/(dashboard)/owner/assignments/page.tsx"
      issue: "Contains only a redirect to /owner/students"
  missing:
    - "Build dedicated assignments page showing all students with coach dropdown, filter by coach/unassigned, coach load balancing view"
  debug_session: ""

- truth: "New students should not be flagged as dropoff alerts"
  status: failed
  reason: "User reported: when someone is new he automatically is a drop off and that shouldn't be the case"
  severity: major
  test: 9
  root_cause: "Dropoff alert logic checks !last (no activity) without checking account age. Students with no work_sessions get last=undefined, triggering dropoff with 999 days inactive. No grace period for newly created accounts."
  artifacts:
    - path: "src/app/(dashboard)/owner/alerts/page.tsx"
      issue: "Lines 81-88: !last condition classifies new students as dropoff without checking created_at"
  missing:
    - "Add created_at to student query, skip dropoff alert if account age < studentDropoffDays (7 days)"
  debug_session: ""
