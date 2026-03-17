---
phase: 09-owner-invites-assignments-alerts
verified: 2026-03-17T12:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: true
  previous_status: passed
  previous_score: 4/4
  gaps_closed:
    - "Dedicated /owner/assignments page (not redirect) — added by gap closure plan 09-04"
    - "joined_at grace period preventing false-positive alerts for new students — added by gap closure plan 09-05"
    - "Sidebar badge computation also applies joined_at grace period — fixed in 09-05"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "Generate coach invite, copy URL, register as coach in browser"
    expected: "New coach account created with coach role, not student"
    why_human: "Cannot verify registration flow or role assignment end-to-end without a browser"
  - test: "From /owner/assignments, change a student's coach dropdown, observe 'Saving...' and success toast"
    expected: "Live coach capacity cards update counts immediately (optimistic); page refreshes to reflect persisted assignment"
    why_human: "Optimistic local-count update + router.refresh() wiring requires a live browser with real DB data"
  - test: "Dismiss an alert, then trigger the same condition again in a new time window (advance date)"
    expected: "Fresh alert appears (new key) even though old key remains dismissed"
    why_human: "Time-windowed keys require date manipulation that cannot be tested programmatically"
  - test: "Create a new student account, then navigate to /owner/alerts immediately"
    expected: "New student does NOT appear as a dropoff or inactive alert"
    why_human: "Grace period logic skips students with account age < threshold; confirmed in code but needs live data to validate end-to-end"
  - test: "Sidebar badge shows correct active alert count for owner"
    expected: "Badge number matches the count on /owner/alerts Active tab after dismiss/undismiss cycle"
    why_human: "Badge uses an approximation (total computed alerts minus dismissed count from DB); needs visual confirmation under real data"
---

# Phase 9: Owner Invites, Assignments, and Alerts — Verification Report

**Phase Goal:** Build owner invite system, coach-student assignment management, and owner alert system.
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** Yes — supersedes 2026-03-17 initial verification which did not cover gap closure plans 09-04 and 09-05

---

## Goal Achievement

This phase executed 5 plans total: 3 original (09-01, 09-02, 09-03) and 2 gap closure plans (09-04, 09-05). The initial VERIFICATION.md only verified against 4 truths derived from the original 3 plans. This re-verification covers all 9 must-have truths across all 5 plans.

### Observable Truths

| # | Truth | Source Plan | Status | Evidence |
|---|-------|-------------|--------|----------|
| 1 | Owner can generate an email invite for coach or student role with 72-hr expiry | 09-01 | VERIFIED | `invites/route.ts` has `role: z.enum(["coach","student"]).optional().default("student")`, coach restriction, 72-hr expiry via `INVITE_CONFIG.codeExpiryHours`; `OwnerInvitesClient.tsx` passes `role: selectedRole` in body |
| 2 | Owner can generate a magic link for coach or student role | 09-01 | VERIFIED | `magic-links/route.ts` POST accepts `request: NextRequest`, parses `magicRole` from body with coach restriction; `OwnerInvitesClient.tsx` passes `role: selectedRole` |
| 3 | Owner can assign or reassign any student to any coach from the student detail page | 09-02 | VERIFIED | `PATCH /api/assignments` validates owner role, verifies student and coach existence, updates `coach_id`; `OwnerStudentDetailClient.tsx` has `id="coach-assign"` dropdown wired to endpoint |
| 4 | Owner sees alert list for inactive 3+d, dropoff 7+d, unreviewed reports, coaches below 2.5 avg over 14 days | 09-03 | VERIFIED | `owner/alerts/page.tsx` computes all 4 alert types at request time; exclusive if/else if for inactive/dropoff |
| 5 | Owner can dismiss an alert; dismissed alerts disappear from Active tab and appear in Dismissed tab | 09-03 | VERIFIED | `POST /api/alerts/dismiss` upserts to `alert_dismissals`; `OwnerAlertsClient.tsx` does optimistic dismiss with revert on error |
| 6 | Owner can navigate to /owner/assignments and see a dedicated page (not a redirect) | 09-04 | VERIFIED | `owner/assignments/page.tsx` is a full server component (94 lines) with `requireRole("owner")`, parallel queries, stat cards, and `OwnerAssignmentsClient` — no `redirect()` import |
| 7 | Owner can see all students with inline coach dropdowns, filter by assignment status, and search by name/email | 09-04 | VERIFIED | `OwnerAssignmentsClient.tsx` (299 lines) has filter tabs (All/Assigned/Unassigned), `<Input>` search, and per-row `<select>` with `aria-label="Assign {name} to coach"` |
| 8 | Newly created students (account age < 7 days) do not appear as dropoff alerts | 09-05 | VERIFIED | `owner/alerts/page.tsx` lines 85-90: `accountAgeDays < thresholds.studentDropoffDays` guard with `continue` before creating dropoff alert |
| 9 | Sidebar badge count excludes new students from alert count | 09-05 | VERIFIED | `layout.tsx` lines 115-127: same grace period logic applied to badge computation loop over `allStudents` objects (with `joined_at`) |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/invites/route.ts` | Extended POST: owner + role param | VERIFIED | Contains `profile.role !== "coach" && profile.role !== "owner"`, `role: z.enum(["coach", "student"])`, coach restriction, conditional `coach_id` |
| `src/app/api/magic-links/route.ts` | Extended POST/PATCH: owner + role param | VERIFIED | POST has `request: NextRequest`, parses `magicRole`, coach restriction; PATCH has `link.created_by !== profile.id && profile.role !== "owner"` |
| `src/app/(dashboard)/owner/invites/page.tsx` | Owner invites server page | VERIFIED | 107 lines; `requireRole("owner")`, parallel `from("invites")` + `from("magic_links")` fetches, 4 stat cards, renders `<OwnerInvitesClient>` |
| `src/components/owner/OwnerInvitesClient.tsx` | Client with role selector, email/magic tabs, copy | VERIFIED | `selectedRole` state, `id="invite-role"` selector, `role: selectedRole` in both fetch bodies, `res.ok` checks, `min-h-[44px]` throughout |
| `src/app/api/assignments/route.ts` | PATCH endpoint updating users.coach_id | VERIFIED | 96 lines; owner-only guard, student + active coach existence checks, admin client throughout |
| `src/app/(dashboard)/owner/assignments/page.tsx` | Dedicated assignments page with server-side data | VERIFIED | 94 lines; `requireRole("owner")`, `Promise.all` with students + coaches queries, stat cards, `<OwnerAssignmentsClient>` — NOT a redirect |
| `src/components/owner/OwnerAssignmentsClient.tsx` | Client with capacity cards, filter tabs, search, student rows | VERIFIED | 299 lines; `role="progressbar"` capacity bars, filter tabs with `min-h-[44px]` and `motion-safe:transition-colors`, `<Input>` search, per-row `<select>` with dynamic `aria-label`, `res.ok` check, `routerRef.current.refresh()` |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | Extended server page fetching coaches list | VERIFIED | 5-query `Promise.all` including `coachesResult` and `studentCountsResult`; passes `coaches={coachOptions}` and `currentCoachId={student.coach_id ?? null}` |
| `src/components/owner/OwnerStudentDetailClient.tsx` | Extended with coach assignment dropdown | VERIFIED | Props include `coaches` and `currentCoachId`; `id="coach-assign"` dropdown; `handleAssign` fetches PATCH, checks `res.ok`, calls `routerRef.current.refresh()` |
| `supabase/migrations/00004_alert_dismissals.sql` | alert_dismissals table with RLS and grants | VERIFIED | `CREATE TABLE public.alert_dismissals`, `UNIQUE(owner_id, alert_key)`, RLS policies using `get_user_role()` initplan pattern, `GRANT ALL` |
| `src/app/api/alerts/dismiss/route.ts` | POST endpoint for dismissing alerts by key | VERIFIED | Owner-only guard, Zod validation (`alert_key` 1-200 chars), upsert with `ignoreDuplicates: true`, `owner_id` from profile not body |
| `src/app/(dashboard)/owner/alerts/page.tsx` | Server component computing alerts with joined_at grace period | VERIFIED | Selects `joined_at` in student query; `accountAgeDays < thresholds.studentDropoffDays` and `< thresholds.studentInactiveDays` guards present |
| `src/components/owner/OwnerAlertsClient.tsx` | Client with filter tabs, alert cards, dismiss action | VERIFIED | Filter tabs (All/Active/Dismissed), `role="alert"` on cards, `min-h-[44px]` on buttons, optimistic dismiss with revert |
| `src/lib/config.ts` | `badge: "active_alerts"` on Alerts nav item | VERIFIED | Line 234: `{ label: "Alerts", href: "/owner/alerts", icon: "Bell", badge: "active_alerts" }` |
| `src/app/(dashboard)/layout.tsx` | Owner badge computation with joined_at grace period | VERIFIED | Selects `id, joined_at` for students; loops over `allStudents` objects with `accountAgeDays` check before incrementing `alertCount` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OwnerInvitesClient.tsx` | `/api/invites` | `fetch POST` with `role: selectedRole` | WIRED | Line 64-68: body includes `role: selectedRole`; `res.ok` checked before parsing |
| `OwnerInvitesClient.tsx` | `/api/magic-links` | `fetch POST` with `role: selectedRole` | WIRED | Line 92-95: body includes `role: selectedRole`; `res.ok` checked |
| `owner/invites/page.tsx` | `OwnerInvitesClient` | Server passes `invites` + `magicLinks` props | WIRED | Line 103: `<OwnerInvitesClient invites={invitesList} magicLinks={magicLinksList} />` |
| `OwnerStudentDetailClient.tsx` | `/api/assignments` | `fetch PATCH` with `coach_id` and `?studentId=` | WIRED | Line 86-90; `res.ok` checked; `routerRef.current.refresh()` on success |
| `owner/students/[studentId]/page.tsx` | `OwnerStudentDetailClient` | Passes `coaches` and `currentCoachId` | WIRED | Lines 154-155: `coaches={coachOptions}` and `currentCoachId={student.coach_id ?? null}` |
| `OwnerAssignmentsClient.tsx` | `/api/assignments` | `fetch PATCH` with `coach_id` and `?studentId=` | WIRED | Line 75-80: `fetch(\`/api/assignments?studentId=${studentId}\`, ...)`; `res.ok` checked; `routerRef.current.refresh()` on success |
| `owner/assignments/page.tsx` | `OwnerAssignmentsClient` | Passes `students` and `coaches` | WIRED | Line 91: `<OwnerAssignmentsClient students={students} coaches={coachOptions} />` |
| `OwnerAlertsClient.tsx` | `/api/alerts/dismiss` | `fetch POST` with `alert_key` | WIRED | Optimistic dismiss calls `POST /api/alerts/dismiss` with `{ alert_key: alertKey }` |
| `owner/alerts/page.tsx` | `OwnerAlertsClient` | Passes computed `alerts` as `initialAlerts` | WIRED | Line 237: `<OwnerAlertsClient initialAlerts={alerts} />` |
| `owner/alerts/page.tsx` | `users` table | `joined_at` selected; grace period guards applied | WIRED | Line 38: `select("id, name, coach_id, joined_at")`; lines 85-90 and 108-110 apply grace period |
| `layout.tsx` | `users` table | `joined_at` selected; badge computation skips young accounts | WIRED | Line 85: `select("id, joined_at")`; lines 115-127 iterate `allStudents` with `accountAgeDays` check |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OWNER-06 | 09-01 | Owner can send invite codes (coach + student) | SATISFIED | `/owner/invites` with role selector; `POST /api/invites` and `POST /api/magic-links` both accept owner role with role param; 72-hr expiry |
| OWNER-07 | 09-02, 09-04 | Owner can assign/reassign students to coaches | SATISFIED | `PATCH /api/assignments` owner-only; coach dropdown on student detail page (09-02); dedicated `/owner/assignments` page with filter tabs and search (09-04) |
| OWNER-08 | 09-03, 09-05 | Owner sees alerts (inactive 3d, dropoff 7d, unreviewed reports, coach underperformance) | SATISFIED | All 4 alert types computed at request time with `OWNER_CONFIG.alertThresholds`; grace period fix (09-05) prevents false positives for new accounts |
| OWNER-09 | 09-03 | Owner can acknowledge/dismiss alerts | SATISFIED | `POST /api/alerts/dismiss` upserts to `alert_dismissals`; Active tab hides dismissed; Dismissed tab shows them; time-windowed keys allow re-trigger |

All 4 requirement IDs from phase 09 plans are satisfied. REQUIREMENTS.md traceability table marks OWNER-06 through OWNER-09 as Complete under Phase 9. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/owner/OwnerAssignmentsClient.tsx:216` | `placeholder="Search by name or email..."` on `<Input>` | Info | Legitimate UI placeholder attribute for the search input — not a code stub |
| `src/lib/config.ts:185` | `iframeUrl: ""` with TODO comment | Info | Pre-existing from Phase 5; unrelated to Phase 9 scope |

No blockers or warnings introduced by phase 09.

---

## Hard Rule Compliance Check

Spot-checked all phase 09 new/modified files against CLAUDE.md hard rules:

| Rule | Files Checked | Status |
|------|--------------|--------|
| `motion-safe:` on animate classes | `OwnerInvitesClient.tsx`, `OwnerAlertsClient.tsx`, `OwnerAssignmentsClient.tsx` | PASS — `motion-safe:transition-colors` on tab buttons and select elements |
| 44px touch targets | All 3 new client components + assignments page | PASS — `min-h-[44px]` on all interactive selects and buttons throughout |
| Accessible labels | `OwnerInvitesClient.tsx` (`id="invite-role"`), `OwnerStudentDetailClient.tsx` (`aria-label="Assign student to coach"`), `OwnerAssignmentsClient.tsx` (dynamic `aria-label="Assign {name} to coach"`) | PASS |
| Admin client in API routes | `invites/route.ts`, `assignments/route.ts`, `alerts/dismiss/route.ts`, `magic-links/route.ts` | PASS — all use `createAdminClient()` for `.from()` queries |
| Never swallow errors | All API routes | PASS — all catch blocks have `console.error` |
| Check `response.ok` | All 3 client components | PASS — `res.ok` checked before parsing in every fetch call |
| Zod import from `"zod"` | All route handlers | PASS — `import { z } from "zod"` throughout |
| ima-* tokens only | All new components | PASS — no hardcoded hex or gray classes |
| ARIA on dynamic content | `OwnerAssignmentsClient.tsx` progress bars | PASS — `role="progressbar"` with `aria-valuenow/min/max/label` |

---

## Human Verification Required

### 1. Coach Invite Registration Flow

**Test:** Generate a coach invite from `/owner/invites` with role set to "Coach", copy the URL, open in incognito, complete Google OAuth registration
**Expected:** New user account created with role=coach, redirected to coach dashboard
**Why human:** Registration flow and role assignment during OAuth callback cannot be verified by static analysis

### 2. Assignment Persistence After Refresh (Student Detail)

**Test:** From `/owner/students/[id]`, change the coach dropdown, observe the "Saving..." indicator and success toast, then hard-refresh the page
**Expected:** Dropdown shows the newly assigned coach after page refresh
**Why human:** `router.refresh()` triggers Next.js cache revalidation; requires a live browser with real DB data

### 3. Assignments Page — Optimistic Capacity Update

**Test:** From `/owner/assignments`, reassign a student from Coach A to Coach B
**Expected:** Coach A's capacity card count decrements immediately (optimistic), Coach B's increments; page refreshes to confirm persistence
**Why human:** Live count computation via `localAssignments` overrides needs browser interaction to verify visual update before server round-trip completes

### 4. Alert Re-Trigger After Dismiss in New Time Window

**Test:** Dismiss a `student_inactive` alert. The next day, if the student is still inactive, a new daily key is generated.
**Expected:** Fresh alert appears (different date suffix in key); old dismissed key is separate
**Why human:** Time-windowed key behavior requires advancing the system date or waiting for a real day to pass

### 5. New Student Grace Period (End-to-End)

**Test:** Create a new student account via invite. Navigate immediately to `/owner/alerts`.
**Expected:** New student does NOT appear as a dropoff or inactive alert
**Why human:** Grace period logic is correct in code but needs live Supabase data with real `joined_at` timestamps to confirm end-to-end

### 6. Sidebar Badge Count Accuracy

**Test:** As owner, note the Alerts badge count in the sidebar, dismiss two alerts, navigate away and back
**Expected:** Sidebar badge decrements by 2 (or disappears if zero)
**Why human:** Badge uses an approximation (total computed alerts minus total dismissed count from DB) — may diverge under edge cases

---

## Summary

Phase 9 fully achieves its goal across all 5 plans. The phase delivered:

1. **OWNER-06 (Invites):** `/owner/invites` page with role selector (coach/student), email invite tab with 72-hour expiry, magic link tab, clipboard copy — all wired to extended `POST /api/invites` and `POST /api/magic-links`.

2. **OWNER-07 (Assignments):** `PATCH /api/assignments` validates owner role, verifies student and coach existence, updates `coach_id`. Student detail page has a coach dropdown with student counts (09-02). A dedicated `/owner/assignments` page (replacing the original redirect) provides coach capacity overview with live-updating progress bars, filter tabs (All/Assigned/Unassigned), search, and inline assignment dropdowns across all students (09-04).

3. **OWNER-08 (Alerts):** `/owner/alerts` computes all 4 alert types at request time using `OWNER_CONFIG.alertThresholds`. Exclusive inactive/dropoff classification via if/else if. Grace period fix (09-05) adds `joined_at`-based checks to prevent false-positive alerts for newly created student accounts in both the alerts page and sidebar badge computation.

4. **OWNER-09 (Dismiss):** `POST /api/alerts/dismiss` upserts to `alert_dismissals` with owner_id from authenticated profile. `OwnerAlertsClient` optimistic dismiss with revert. Active tab filters out dismissed; Dismissed tab shows them. Time-windowed keys ensure re-trigger on new window.

All hard rules from CLAUDE.md satisfied. No stub implementations. No broken wiring. No blocker anti-patterns. 6 items flagged for human verification.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier) — re-verification covering all 5 plans including gap closure 09-04 and 09-05_
