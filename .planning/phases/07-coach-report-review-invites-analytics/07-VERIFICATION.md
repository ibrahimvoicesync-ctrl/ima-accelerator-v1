---
phase: 07-coach-report-review-invites-analytics
verified: 2026-03-17T18:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 12/12
  gaps_closed:
    - "Report filter tabs correctly show only matching reports (key prop fix from 07-04)"
    - "Email invite API rejects existing-user emails with 409 (duplicate-email check from 07-04)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Log in as coach. Visit /coach/reports. Click Unreviewed tab, then Reviewed tab. Confirm each tab shows only matching reports with no overlap."
    expected: "Tab switch causes a full remount; only unreviewed reports show in Unreviewed tab and only reviewed reports show in Reviewed tab."
    why_human: "key prop remount behavior and visual correctness of filtered lists require a live browser session."
  - test: "Log in as coach. Visit /coach/reports. Click Mark Reviewed on an unreviewed report."
    expected: "Row immediately shows Reviewed badge and Un-review button without page reload. Toast 'Marked as reviewed' appears."
    why_human: "Optimistic UI state update and toast appearance require a live browser."
  - test: "Log in as coach. Visit /coach/invites. Try to generate an invite for an email that already belongs to a registered user."
    expected: "Error toast appears with 'A user with this email is already registered'. No invite is created."
    why_human: "Requires real DB state (existing user) and live browser interaction."
  - test: "Log in as coach. Visit /coach/invites. Generate an email invite. Click Copy button."
    expected: "URL is copied to clipboard. Toast 'Copied to clipboard!' appears. Paste elsewhere confirms full register URL."
    why_human: "navigator.clipboard requires a browser context."
  - test: "Log in as coach. Visit /coach/invites. Generate a magic link. Click Deactivate. Then Reactivate."
    expected: "Badge switches between Active (green) and Inactive (gray) immediately. Toast feedback shown. State persists after page refresh."
    why_human: "Optimistic toggle with revert-on-error requires live interaction."
  - test: "Log in as coach with unreviewed student reports in the last 7 days. Observe the Reports nav item in the sidebar."
    expected: "A numbered badge (e.g., '3') appears next to Reports. After reviewing all reports, badge disappears."
    why_human: "Requires real DB data and live browser rendering."
  - test: "Log in as coach with no students assigned. Visit /coach/analytics."
    expected: "Card with BarChart3 icon and 'No students assigned' message is shown instead of broken metric cards."
    why_human: "Requires a specific account state (coach with zero students)."
---

# Phase 7: Coach Report Review, Invites, and Analytics — Verification Report

**Phase Goal:** A coach can review and acknowledge student reports, invite new students, and see basic analytics on their cohort.
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** Yes — after 07-04 gap closure (filter tab fix + duplicate email check)

---

## Goal Achievement

### Observable Truths

All truths verified against actual files. No placeholders, no stubs.

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Coach can view unreviewed reports from assigned students in the last 7 days | VERIFIED | `coach/reports/page.tsx` lines 70-78: `.gte("date", sevenDaysAgo).not("submitted_at", "is", null)` scoped to coach's student IDs |
| 2  | Coach can mark a report as reviewed with single-click toggle | VERIFIED | `CoachReportsClient.tsx` line 89: `fetch(\`/api/reports/${reportId}/review\`, { method: "PATCH" })` with `{ reviewed: !currentlyReviewed }` |
| 3  | Coach can un-review a previously reviewed report | VERIFIED | `review/route.ts` line 86: `{ reviewed_by: null, reviewed_at: null }` on `reviewed === false`; `ReportRow.tsx` renders Un-review button when `isReviewed` |
| 4  | Coach can filter reports by Unreviewed / Reviewed / All tabs | VERIFIED | `CoachReportsClient.tsx` lines 124-128: 3 tab buttons calling `handleFilterTab` which calls `routerRef.current.push(buildUrl(...))` |
| 5  | Report filter tabs show only matching reports (no stale data) | VERIFIED | `coach/reports/page.tsx` line 198: `key={\`${sp.reviewed ?? "all"}-${sp.student_id ?? ""}\`}` forces remount on filter change; server-side filtering lines 101-110 |
| 6  | Coach can filter reports by student dropdown | VERIFIED | `CoachReportsClient.tsx` line 156-168: `<select aria-label="Filter by student">` wired to `handleStudentFilter` -> `router.push` |
| 7  | Coach can expand a report row to see wins/improvements text | VERIFIED | `ReportRow.tsx` lines 56-162: `<details>/<summary>` structure; expanded section renders `report.wins` and `report.improvements` |
| 8  | Coach can generate a student invite link with 72-hour expiry | VERIFIED | `invites/route.ts` lines 63-65: `INVITE_CONFIG.codeExpiryHours * 60 * 60 * 1000`; returns `registerUrl` with `?code=` |
| 9  | Email invite API rejects existing-user emails with 409 | VERIFIED | `invites/route.ts` lines 49-60: `admin.from("users").select("id").eq("email", ...).maybeSingle()` returns 409 if user exists |
| 10 | Coach can generate a magic link for easy student registration | VERIFIED | `magic-links/route.ts` lines 7-12: `generateMagicCode()` with `crypto.getRandomValues`; returns `registerUrl` with `?magic=` |
| 11 | Coach can copy the invite URL to clipboard | VERIFIED | `CoachInvitesClient.tsx` lines 114-123: `handleCopy` calls `navigator.clipboard.writeText(lastUrl)` with try-catch and toast |
| 12 | Coach can see a history of invites they have sent | VERIFIED | `coach/invites/page.tsx` lines 11-22: `Promise.all` fetch `.eq("invited_by", user.id)`; rendered in Invite History section with Used/Expired/Active badges |
| 13 | Coach can deactivate a magic link | VERIFIED | `CoachInvitesClient.tsx` lines 126-160: `handleToggleMagicLink` calls `PATCH /api/magic-links?id=X` with `{ is_active: newActive }`; optimistic revert on error |
| 14 | Generated invite auto-assigns coach_id so student is assigned to the creating coach | VERIFIED | `invites/route.ts` line 73: `coach_id: profile.id` in insert payload |
| 15 | Coach can see report submission rate percentage for their cohort | VERIFIED | `coach/analytics/page.tsx` lines 116-123: `Math.round((reports.length / (activeStudentIds.length * COACH_CONFIG.reportInboxDays)) * 100)` |
| 16 | Coach can see average star rating, hours/day, and outreach count for their cohort | VERIFIED | `coach/analytics/page.tsx` lines 126-150: `avgStarRating`, `avgHoursPerDay`, `avgOutreach` all computed from raw report rows; displayed in 4 stat cards |
| 17 | Coach can see student breakdown by activity category (active, at-risk, inactive, new) | VERIFIED | `coach/analytics/page.tsx` lines 186-231: `activeCount`, `atRiskCount`, `inactiveCount`, `newCount` computed using `COACH_CONFIG` thresholds; Student Breakdown card rendered |
| 18 | Sidebar Reports badge shows actual unreviewed report count instead of placeholder | VERIFIED | `Sidebar.tsx` line 260: `{item.badge && (badgeCounts[item.badge] ?? 0) > 0 && ...}` — no `(badge)` string present; `layout.tsx` line 70: `badgeCounts = { unreviewed_reports: count ?? 0 }` |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Notes |
|----------|-----------|--------------|--------|-------|
| `src/app/api/reports/[id]/review/route.ts` | — | 100 | VERIFIED | Exports `PATCH`; auth, Zod schema, ownership check, toggle logic, `import { z } from "zod"` |
| `src/app/(dashboard)/coach/reports/page.tsx` | 60 | 207 | VERIFIED | `requireRole("coach")`, 4 stat cards, searchParam filters, `key` prop on `CoachReportsClient` |
| `src/components/coach/CoachReportsClient.tsx` | 80 | 202 | VERIFIED | `"use client"`, 3 filter tabs, student dropdown, `handleToggleReview` with PATCH fetch, `setLocalReports` optimistic update |
| `src/components/coach/ReportRow.tsx` | 40 | 165 | VERIFIED | `<details>/<summary>`, `role="img"` on star display, `min-h-[44px]` on interactive wrapper |
| `src/app/api/invites/route.ts` | — | 89 | VERIFIED | Exports `POST`; Zod email schema, existing-user 409 check, `coach_id: profile.id` insert, `INVITE_CONFIG.codeExpiryHours` |
| `src/app/api/magic-links/route.ts` | — | 135 | VERIFIED | Exports `POST` and `PATCH`; `crypto.getRandomValues` code gen, ownership check before update |
| `src/app/(dashboard)/coach/invites/page.tsx` | 60 | 106 | VERIFIED | `requireRole("coach")`, `Promise.all` parallel fetch, 4 stat cards, `<CoachInvitesClient>` |
| `src/components/coach/CoachInvitesClient.tsx` | 80 | 394 | VERIFIED | `"use client"`, tab interface, clipboard copy, invite history, magic link toggle with optimistic revert |
| `src/app/(dashboard)/coach/analytics/page.tsx` | 80 | 392 | VERIFIED | `requireRole("coach")`, 4 metric cards, student breakdown, empty state for zero students |
| `src/app/(dashboard)/layout.tsx` | — | 84 | VERIFIED | `.select("id, role, name")` includes `id`; coach badge count query; `badgeCounts` passed to Sidebar |
| `src/components/layout/Sidebar.tsx` | — | 313 | VERIFIED | `badgeCounts?: Record<string, number>` prop; `(badgeCounts[item.badge] ?? 0) > 0` guard; no `(badge)` string |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|-----|-----|--------|----------|
| `CoachReportsClient.tsx` | `PATCH /api/reports/[id]/review` | `fetch` in `handleToggleReview` | WIRED | Line 89: `fetch(\`/api/reports/${reportId}/review\`, { method: "PATCH" })` |
| `coach/reports/page.tsx` | `daily_reports` table | `admin.from('daily_reports')` with 7-day scope | WIRED | Lines 70-78: `.gte("date", sevenDaysAgo).not("submitted_at", "is", null)` |
| `coach/reports/page.tsx` | `CoachReportsClient.tsx` | `key` prop derived from searchParams | WIRED | Line 198: `key={\`${sp.reviewed ?? "all"}-${sp.student_id ?? ""}\`}` |
| `CoachReportsClient.tsx` | URL filter state | `router.push` via `buildUrl` | WIRED | Lines 65, 74: `routerRef.current.push(buildUrl({...}))` |
| `CoachInvitesClient.tsx` | `POST /api/invites` | `fetch` in `handleCreateInvite` | WIRED | Line 63: `fetch("/api/invites", { method: "POST" })` |
| `CoachInvitesClient.tsx` | `POST /api/magic-links` | `fetch` in `handleCreateMagicLink` | WIRED | Line 91: `fetch("/api/magic-links", { method: "POST" })` |
| `CoachInvitesClient.tsx` | `PATCH /api/magic-links` | `fetch` in `handleToggleMagicLink` | WIRED | Line 133: `fetch(\`/api/magic-links?id=${link.id}\`, { method: "PATCH" })` |
| `invites/route.ts` | `users` table (existing-user check) | `admin.from("users").maybeSingle()` | WIRED | Lines 49-53: `.eq("email", parsed.data.email).maybeSingle()` |
| `invites/route.ts` | `invites` table | `admin.from("invites").insert` | WIRED | Lines 67-78: full insert with `coach_id: profile.id` |
| `coach/analytics/page.tsx` | `daily_reports` + `work_sessions` tables | `admin.from` parallel queries | WIRED | Lines 79-93: `Promise.all([admin.from("daily_reports")..., admin.from("work_sessions")...])` |
| `layout.tsx` | `daily_reports` table | `admin.from` count query for badge | WIRED | Lines 62-68: `.select("*", { count: "exact", head: true }).is("reviewed_by", null).not("submitted_at", "is", null)` |
| `layout.tsx` | `Sidebar.tsx` | `badgeCounts` prop | WIRED | Line 76: `<Sidebar role=... badgeCounts={badgeCounts} />` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COACH-04 | 07-01-PLAN.md, 07-04-PLAN.md | Coach can review/acknowledge submitted reports | SATISFIED | PATCH route with toggle; report inbox with filter tabs, student dropdown, expandable rows, single-click review; key prop remount fix for stale filter state |
| COACH-05 | 07-02-PLAN.md, 07-04-PLAN.md | Coach can invite new students | SATISFIED | POST /api/invites (72h expiry, coach_id auto-set, 409 duplicate check); POST /api/magic-links; /coach/invites with history and deactivation |
| COACH-06 | 07-03-PLAN.md | Coach sees basic analytics (report submission rates, student activity) | SATISFIED | /coach/analytics shows submission rate %, avg star rating, avg hours/day, avg outreach, student breakdown by activity category |

No orphaned requirements: REQUIREMENTS.md traceability table lists COACH-04, COACH-05, and COACH-06 as Phase 7 / Complete. All three are claimed by plan files (07-01, 07-02, 07-03, 07-04). No Phase 7 requirement in REQUIREMENTS.md is unclaimed.

---

### Anti-Patterns Found

No anti-patterns detected.

| Check | Result |
|-------|--------|
| `(badge)` placeholder in Sidebar | Not present — replaced with dynamic count at line 260 |
| TODO/FIXME/HACK in phase files | None (only `placeholder="student@example.com"` HTML attr — not a code stub) |
| Empty implementations (`return null`, `=> {}`) | None found in coach components or API routes |
| Hardcoded hex/gray color tokens | None — all use `ima-*` tokens |
| `import from "zod/v4"` | None — all routes use `import { z } from "zod"` |
| `animate-*` without `motion-safe:` prefix | None found in coach components |
| `navigator.clipboard` without try-catch | Wrapped: `CoachInvitesClient.tsx` lines 114-123 |

---

### Hard Rule Audit (CLAUDE.md)

| Rule | Files Checked | Status |
|------|--------------|--------|
| Admin client only in API routes | All 3 API routes use `createAdminClient()` for all `.from()` queries | PASS |
| Never swallow errors | All `catch` blocks call `console.error` or `toastRef.current`; no empty catches | PASS |
| Check `response.ok` before parsing JSON | `CoachReportsClient.tsx` line 94, `CoachInvitesClient.tsx` lines 68, 96, 138 — all check `if (!res.ok)` | PASS |
| Zod import from `"zod"` not `"zod/v4"` | Confirmed in all 3 API routes | PASS |
| `ima-*` tokens only | No hardcoded hex/gray found in any phase file | PASS |
| 44px touch targets | `min-h-[44px]` on buttons, tabs, select, and ReportRow summary wrapper | PASS |
| Auth + role check before validation | All 3 API routes: auth -> profile -> `role !== "coach"` -> Zod parse | PASS |
| `motion-safe:` on animations | `CoachReportsClient.tsx` line 142: `motion-safe:transition-colors`; `CoachInvitesClient.tsx` lines 183, 197 | PASS |

---

### Human Verification Required

#### 1. Report filter tabs — correct filtering with no overlap

**Test:** Log in as a coach with students who have both reviewed and unreviewed reports. Visit /coach/reports. Click Unreviewed tab, then Reviewed tab.
**Expected:** Each tab shows only the matching reports. No reviewed report appears in Unreviewed and vice versa.
**Why human:** The `key` prop remount fix requires a live browser to confirm React actually unmounts and remounts the component, and that the filtered data renders correctly.

#### 2. Report review toggle — optimistic UI

**Test:** Log in as a coach with at least one student who has submitted a report. Visit /coach/reports. Click "Mark Reviewed".
**Expected:** The row immediately shows "Reviewed" badge and "Un-review" button without a full page reload. Toast "Marked as reviewed" appears.
**Why human:** Optimistic UI state update and toast appearance cannot be verified programmatically.

#### 3. Email invite duplicate check — 409 error display

**Test:** Log in as a coach. Visit /coach/invites. Enter the email address of an already-registered user and click Generate Invite.
**Expected:** An error toast appears with the message "A user with this email is already registered". No invite card or URL is shown.
**Why human:** Requires real DB state with an existing registered user and live browser interaction.

#### 4. Invite URL clipboard copy

**Test:** Visit /coach/invites. Generate an email invite. Click the "Copy" button.
**Expected:** URL is copied to clipboard. Toast "Copied to clipboard!" appears. Pasting elsewhere confirms the full register URL.
**Why human:** `navigator.clipboard` behavior requires a browser context.

#### 5. Magic link deactivation toggle

**Test:** Visit /coach/invites. Generate a magic link. In the Magic Links section, click "Deactivate". Then click "Reactivate".
**Expected:** Badge switches between "Active" (green) and "Inactive" (gray) immediately. Toast feedback shown. After page refresh, state persists.
**Why human:** Optimistic toggle with revert-on-error behavior requires live interaction.

#### 6. Sidebar badge count

**Test:** Log in as a coach with unreviewed student reports in the last 7 days. Observe the "Reports" nav item in the sidebar.
**Expected:** A numbered badge (e.g., "3") appears next to "Reports". After reviewing all reports, the badge disappears.
**Why human:** Requires real DB data and live browser rendering to confirm badge appears/disappears correctly.

#### 7. Analytics empty state

**Test:** Log in as a coach with no students assigned. Visit /coach/analytics.
**Expected:** A card with BarChart3 icon and "No students assigned" message is shown instead of broken metric cards.
**Why human:** Requires a specific account state (coach with zero students).

---

### Summary

All 18 observable truths verified against the actual codebase. The 07-04 gap closure plan added two critical fixes — the `key` prop on `CoachReportsClient` to prevent stale filter data, and the 409 duplicate-email check in POST /api/invites — both confirmed present and correctly wired.

All 11 required artifacts exist with substantive content well above minimum line counts. All 12 key links confirmed wired. All 3 phase requirements (COACH-04, COACH-05, COACH-06) are fully satisfied. No anti-patterns, no placeholder code, no hard-rule violations. 7 items flagged for human verification because they depend on live browser behavior, real DB state, or clipboard APIs.

**Phase goal achieved:** A coach can review and acknowledge student reports, invite new students, and see basic analytics on their cohort.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
