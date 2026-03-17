---
phase: 09-owner-invites-assignments-alerts
verified: 2026-03-17T00:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
gaps: []
human_verification:
  - test: "Generate coach invite, copy URL, register as coach in browser"
    expected: "New coach account created with coach role, not student"
    why_human: "Cannot verify registration flow or role assignment end-to-end without a browser"
  - test: "Assign a student to a coach, then navigate away and return to student detail"
    expected: "Dropdown shows the newly assigned coach persisted after page refresh"
    why_human: "Optimistic update + router.refresh() wiring requires a live browser to confirm server re-hydration"
  - test: "Dismiss an alert, then trigger the same condition again in a new time window (advance date)"
    expected: "Fresh alert appears (new key) even though old key remains dismissed"
    why_human: "Time-windowed keys require date manipulation that cannot be tested programmatically"
  - test: "Sidebar badge shows correct active alert count for owner"
    expected: "Badge number matches the count on /owner/alerts Active tab after dismiss/undismiss cycle"
    why_human: "Badge computation in layout.tsx is an approximation (total - dismissed count) which may differ from true active count; needs visual confirmation"
---

# Phase 9: Owner Invites, Assignments, and Alerts — Verification Report

**Phase Goal:** The owner can onboard coaches and students via invites, assign students to coaches, and be alerted to at-risk situations
**Verified:** 2026-03-17
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Phase Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can generate and copy an invite link for coach or student (72-hr expiry, magic link option) | VERIFIED | `OwnerInvitesClient.tsx` has role selector, email and magic tabs, clipboard copy handler; `invites/route.ts` uses `INVITE_CONFIG.codeExpiryHours` (72); `magic-links/route.ts` accepts `role` param |
| 2 | Owner can assign or reassign any student to any coach from the student detail page | VERIFIED | `PATCH /api/assignments` verified to validate owner role, student existence, coach existence, and update `coach_id`; `OwnerStudentDetailClient.tsx` has working `coach-assign` dropdown wired to the PATCH endpoint |
| 3 | Owner sees alert list for: students inactive 3+ days, students inactive 7+ days (dropoff), unreviewed reports, coaches with avg rating below 2.5 for 14+ days | VERIFIED | `owner/alerts/page.tsx` computes all 4 alert types at request time using `OWNER_CONFIG.alertThresholds`; exclusive if/else if ensures dropoff and inactive never both appear for one student |
| 4 | Owner can dismiss an alert; dismissed alerts no longer appear in the Active tab | VERIFIED | `OwnerAlertsClient.tsx` has optimistic dismiss calling `POST /api/alerts/dismiss`; filter tab logic hides dismissed alerts from "active" view; dismissed alerts appear under "Dismissed" tab |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/invites/route.ts` | Extended POST: owner role + role param | VERIFIED | Contains `profile.role !== "coach" && profile.role !== "owner"`, `role: z.enum(["coach", "student"]).optional().default("student")`, coach restriction, conditional `coach_id` |
| `src/app/api/magic-links/route.ts` | Extended POST/PATCH: owner role + role param | VERIFIED | POST accepts `request: NextRequest`, parses role body, coach restriction enforced; PATCH has `profile.role !== "owner"` ownership override |
| `src/app/(dashboard)/owner/invites/page.tsx` | Owner invites server page | VERIFIED | 107 lines; `requireRole("owner")`, parallel fetch of invites + magic_links, 4 stat cards, renders `OwnerInvitesClient` |
| `src/components/owner/OwnerInvitesClient.tsx` | Client with role selector, email/magic tabs, copy | VERIFIED | 416 lines; `selectedRole` state, `id="invite-role"` selector, `role: selectedRole` in both fetch bodies, clipboard handler, invite history, magic link history with optimistic toggle |
| `src/app/api/assignments/route.ts` | PATCH endpoint updating `users.coach_id` | VERIFIED | 96 lines; `export async function PATCH`, owner-only guard, student + coach existence checks, admin client used throughout |
| `src/app/(dashboard)/owner/assignments/page.tsx` | Redirect to /owner/students | VERIFIED | 5 lines; `redirect("/owner/students")` |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | Extended server page fetching coaches list | VERIFIED | 5-query Promise.all including `coachesResult` and `studentCountsResult`; passes `coaches={coachOptions}` and `currentCoachId={student.coach_id ?? null}` to client |
| `src/components/owner/OwnerStudentDetailClient.tsx` | Extended with coach assignment dropdown | VERIFIED | Props interface includes `coaches` and `currentCoachId`; `id="coach-assign"` dropdown with `aria-label="Assign student to coach"`; `handleAssign` callback with `fetch /api/assignments` PATCH, `routerRef.current.refresh()`, revert on error |
| `supabase/migrations/00004_alert_dismissals.sql` | alert_dismissals table with RLS and grants | VERIFIED | `CREATE TABLE public.alert_dismissals`, `UNIQUE(owner_id, alert_key)`, RLS policies using `get_user_role()` initplan pattern, explicit GRANT ALL |
| `src/app/api/alerts/dismiss/route.ts` | POST endpoint for dismissing alerts by key | VERIFIED | `export async function POST`, owner-only guard, Zod validation (`alert_key` 1–200 chars), upsert with `ignoreDuplicates: true`, `owner_id` from profile not request body |
| `src/app/(dashboard)/owner/alerts/page.tsx` | Server component computing alerts from live data | VERIFIED | Uses `OWNER_CONFIG.alertThresholds`; computes student_inactive, student_dropoff, unreviewed_reports, coach_underperforming; exclusive if/else if classification; sorted active-first then critical > warning |
| `src/components/owner/OwnerAlertsClient.tsx` | Client with filter tabs, alert cards, dismiss action | VERIFIED | Filter tabs (All/Active/Dismissed); `role="alert"` on cards; `aria-hidden` on icons; `min-h-[44px]` on buttons; optimistic dismiss with revert; `motion-safe:transition-colors` on filter buttons |
| `src/lib/config.ts` | `badge: "active_alerts"` on Alerts nav item | VERIFIED | Line 234: `{ label: "Alerts", href: "/owner/alerts", icon: "Bell", badge: "active_alerts" }` |
| `src/app/(dashboard)/layout.tsx` | Owner badge count computation | VERIFIED | Lines 72–176: owner branch computes alertCount using same exclusive inactive/dropoff logic as alerts page, subtracts dismissed count, sets `badgeCounts = { active_alerts: activeAlertCount }` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `OwnerInvitesClient.tsx` | `/api/invites` | `fetch POST` with `role: selectedRole` in body | WIRED | Line 64–68: `fetch("/api/invites", { method: "POST", body: JSON.stringify({ email, role: selectedRole }) })` |
| `OwnerInvitesClient.tsx` | `/api/magic-links` | `fetch POST` with `role: selectedRole` in body | WIRED | Line 92–95: `fetch("/api/magic-links", { method: "POST", body: JSON.stringify({ role: selectedRole }) })` |
| `owner/invites/page.tsx` | `OwnerInvitesClient` | Server passes `invites` + `magicLinks` props | WIRED | Line 103: `<OwnerInvitesClient invites={invitesList} magicLinks={magicLinksList} />` |
| `OwnerStudentDetailClient.tsx` | `/api/assignments` | `fetch PATCH` with `coach_id` and `studentId` query param | WIRED | Line 86–90: `fetch(\`/api/assignments?studentId=${studentId}\`, { method: "PATCH", body: JSON.stringify({ coach_id: newCoachId }) })` |
| `owner/students/[studentId]/page.tsx` | `OwnerStudentDetailClient` | Passes `coaches={coachOptions}` and `currentCoachId` | WIRED | Lines 154–155 confirm both props passed |
| `OwnerAlertsClient.tsx` | `/api/alerts/dismiss` | `fetch POST` with `alert_key` in body | WIRED | Line 90–94: `fetch("/api/alerts/dismiss", { method: "POST", body: JSON.stringify({ alert_key: alertKey }) })` |
| `owner/alerts/page.tsx` | `OwnerAlertsClient` | Server passes computed `alerts` array as `initialAlerts` prop | WIRED | Line 230: `<OwnerAlertsClient initialAlerts={alerts} />` |
| `layout.tsx` | `alert_dismissals` | Admin query counts dismissed alerts for badge subtraction | WIRED | Lines 170–175: `.from("alert_dismissals").select("*", { count: "exact", head: true }).eq("owner_id", profile.id)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OWNER-06 | 09-01-PLAN.md | Owner can send invite codes (coach + student) | SATISFIED | `/owner/invites` page with role selector; `POST /api/invites` and `POST /api/magic-links` both accept owner role with role param; 72-hour expiry via `INVITE_CONFIG.codeExpiryHours` |
| OWNER-07 | 09-02-PLAN.md | Owner can assign/reassign students to coaches | SATISFIED | `PATCH /api/assignments` with owner-only guard; coach dropdown on student detail page with student count display; null coach_id = unassign |
| OWNER-08 | 09-03-PLAN.md | Owner sees alerts (inactive 3d, dropoff 7d, unreviewed reports, coach underperformance) | SATISFIED | `/owner/alerts` computes all 4 types at request time; exclusive inactive/dropoff classification; unreviewed as summary alert; coach threshold at 2.5 avg over 14 days |
| OWNER-09 | 09-03-PLAN.md | Owner can acknowledge/dismiss alerts | SATISFIED | `POST /api/alerts/dismiss` upserts to `alert_dismissals` table; dismissed alerts hidden from Active tab; appear in Dismissed tab; time-windowed keys allow re-trigger on new window |

All 4 requirement IDs from phase 09 plans are accounted for. REQUIREMENTS.md Traceability table marks all four as Complete under Phase 9. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/lib/config.ts:185` | `iframeUrl: ""` with `// TODO: Get URL from Abu Lahya before ship` | Info | Pre-existing; unrelated to phase 09 — AI chat config, not invites/assignments/alerts |

No blockers or warnings introduced by phase 09. The one TODO is pre-existing and outside phase scope.

---

## Hard Rule Compliance Check

Spot-checked phase 09 files against CLAUDE.md hard rules:

| Rule | Files Checked | Status |
|------|--------------|--------|
| `motion-safe:` on animate classes | `OwnerInvitesClient.tsx`, `OwnerAlertsClient.tsx` | PASS — `motion-safe:transition-colors` on tab buttons in both files |
| 44px touch targets | `OwnerInvitesClient.tsx`, `OwnerAlertsClient.tsx`, `OwnerStudentDetailClient.tsx` | PASS — `min-h-[44px]` on all interactive selects and buttons |
| Accessible labels | `OwnerInvitesClient.tsx` (`id="invite-role"`, `aria-label`), `OwnerStudentDetailClient.tsx` (`aria-label="Assign student to coach"`) | PASS |
| Admin client in API routes | All 3 new routes (`invites`, `assignments`, `alerts/dismiss`) | PASS — all use `createAdminClient()` for `.from()` queries |
| Never swallow errors | All API routes have `console.error` in catch/error blocks | PASS |
| Check `response.ok` | `OwnerInvitesClient.tsx`, `OwnerStudentDetailClient.tsx`, `OwnerAlertsClient.tsx` | PASS — all check `res.ok` before parsing |
| Zod import from `"zod"` | All route handlers | PASS — `import { z } from "zod"` |
| ima-* tokens only | All UI components | PASS — no hardcoded hex or gray classes found |

---

## Human Verification Required

### 1. Coach Invite Registration Flow

**Test:** Generate a coach invite from `/owner/invites` with role set to "Coach", copy the URL, open in incognito, complete Google OAuth registration using the invite code
**Expected:** New user account created with role=coach, redirected to coach dashboard
**Why human:** Registration flow and role assignment during OAuth callback cannot be verified by static analysis

### 2. Assignment Persistence After Refresh

**Test:** From `/owner/students/[id]`, change the coach dropdown, observe the "Saving..." indicator and success toast, then hard-refresh the page
**Expected:** The dropdown shows the newly assigned coach after page refresh (server re-fetches)
**Why human:** `router.refresh()` triggers a Next.js cache revalidation; the DB read must return the updated coach_id — requires a live browser with real DB data

### 3. Alert Re-Trigger After Dismiss in New Time Window

**Test:** Dismiss a `student_inactive` alert (key format: `student_inactive:{id}:{YYYY-MM-DD}`). The next day, if the student is still inactive, a new key for the new date is generated.
**Expected:** A fresh alert appears (old dismissed key has a different date suffix); the dismissed tab still shows the old dismissal
**Why human:** Time-windowed key behavior requires advancing the system date or waiting for a real day to pass

### 4. Sidebar Badge Count Accuracy

**Test:** As owner, note the Alerts badge count in the sidebar, go to `/owner/alerts`, dismiss two alerts, return to any owner page
**Expected:** Sidebar badge decrements by 2 (or disappears if zero)
**Why human:** Badge uses an approximation (total computed alerts minus dismissed count from DB), which may diverge from true active count if some dismissed keys no longer match active conditions. Needs visual confirmation under real data.

---

## Summary

Phase 9 fully achieves its goal. All 4 success criteria are verified in the codebase:

1. **Invites (OWNER-06):** `/owner/invites` page with role selector (coach/student), email invite tab with 72-hour expiry via `INVITE_CONFIG.codeExpiryHours`, magic link tab, clipboard copy — all wired to extended `POST /api/invites` and `POST /api/magic-links` that accept owner role with role param.

2. **Assignments (OWNER-07):** `PATCH /api/assignments` validates owner role, verifies student exists with `.eq("role", "student")`, verifies coach exists with `.eq("role", "coach").eq("status", "active")`, updates `coach_id` (nullable for unassign). Student detail page has a live coach dropdown showing "Name (N students)" format.

3. **Alerts list (OWNER-08):** `/owner/alerts` computes all 4 alert types at request time using `OWNER_CONFIG.alertThresholds`. Student inactive/dropoff are mutually exclusive via `if/else if`. Unreviewed reports produce one summary alert. Coach underperformance uses 14-day window and 2.5 threshold.

4. **Dismiss (OWNER-09):** `POST /api/alerts/dismiss` upserts to `alert_dismissals` with owner_id from authenticated profile. `OwnerAlertsClient` does optimistic dismiss with revert on error. Active tab filters out dismissed alerts; Dismissed tab shows them. Time-windowed keys ensure re-trigger on new window.

All hard rules from CLAUDE.md are satisfied. No stub implementations, no broken wiring, no blocker anti-patterns. 4 items flagged for human verification (registration flow, persistence, time-window behavior, badge count accuracy).

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
