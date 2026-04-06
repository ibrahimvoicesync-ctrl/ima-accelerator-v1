---
phase: 34-report-comments
verified: 2026-04-03T00:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 34: Report Comments Verification Report

**Phase Goal:** Coaches can leave a single comment on any of their students' daily reports; students see the feedback inline on their report history
**Verified:** 2026-04-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/reports/{id}/comment accepts {comment: string} and upserts into report_comments table | VERIFIED | route.ts line 102-109: `.upsert({ report_id: id, ... }, { onConflict: "report_id" })` |
| 2 | Coach can only comment on their own students' reports; owner can comment on any report | VERIFIED | route.ts lines 87-99: conditional `if (profile.role === "coach")` ownership check; owner bypasses it |
| 3 | Student and student_diy roles receive 403 from the comment API | VERIFIED | route.ts lines 42-44: `if (profile.role !== "coach" && profile.role !== "owner") return 403` |
| 4 | Resubmitting a comment replaces the existing one (upsert, not insert) | VERIFIED | route.ts line 106: `{ onConflict: "report_id" }` — single comment per report enforced at DB level |
| 5 | CommentForm renders textarea with 1000 char max, char counter, and Save button | VERIFIED | CommentForm.tsx lines 48-64: `maxLength={1000}`, `{value.length}/1000`, Button with `aria-label="Save comment"` |
| 6 | CoachFeedbackCard renders read-only card with coach initials avatar, name, timestamp, and comment text | VERIFIED | CoachFeedbackCard.tsx lines 26-39: `bg-ima-surface-accent`, `getInitials()`, `formatCommentDate()`, all fields rendered |
| 7 | Coach sees a comment textarea inside each expanded ReportRow on /coach/reports | VERIFIED | ReportRow.tsx lines 174-177: `<CommentForm reportId={report.id} initialComment={report.existingComment} />` inside `<details>` |
| 8 | Coach sees a comment textarea below report data in CalendarTab on student detail | VERIFIED | CalendarTab.tsx lines 267-271: `<CommentForm reportId={selectedReport.id} initialComment={displayComments[selectedReport.id]?.comment ?? null} />` |
| 9 | Owner sees a comment textarea in CalendarTab on owner student detail | VERIFIED | OwnerStudentDetailClient.tsx line 246: `comments={calendarComments}` passed to CalendarTab with `role="owner"` |
| 10 | Existing comments pre-fill the textarea (D-04) | VERIFIED | CalendarTab.tsx line 64: `displayComments` state initialized from `comments` prop; coach/reports page builds `commentMap` passed as `existingComment` |
| 11 | Student sees a CoachFeedbackCard below each report on /student/report/history | VERIFIED | history/page.tsx lines 132-138: `{feedbackComment && feedbackComment.comment && <CoachFeedbackCard ... />}` |
| 12 | Reports without comments show no feedback card | VERIFIED | history/page.tsx line 90: `const feedbackComment = report.report_comments?.[0] ?? null` — conditional render only when comment exists |
| 13 | Comments persist across CalendarTab month changes | VERIFIED | CalendarTab.tsx line 129: `setDisplayComments(data.comments ?? {})` in `handleMonthChange`; calendar/route.ts lines 103-119: comments included in API response |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/api/reports/[id]/comment/route.ts` | POST upsert endpoint for report comments | VERIFIED | 117 lines, exports `POST`, full CSRF > Auth > Admin > Role > RateLimit > Parse > Zod > Params > Report > Ownership > Upsert order |
| `src/components/shared/CommentForm.tsx` | Reusable comment textarea + save button client component | VERIFIED | 67 lines, exports `CommentForm`, "use client", full implementation |
| `src/components/shared/CoachFeedbackCard.tsx` | Read-only feedback card for student history | VERIFIED | 40 lines, exports `CoachFeedbackCard`, presentational, no "use client" |
| `src/components/coach/ReportRow.tsx` | CommentForm rendered inside expanded details section | VERIFIED | imports `CommentForm` from shared, renders inside `<details>` |
| `src/components/coach/CalendarTab.tsx` | CommentForm rendered below report detail panel | VERIFIED | `comments` prop accepted, `displayComments` state, `CommentForm` rendered inside Daily Report card |
| `src/app/(dashboard)/student/report/history/page.tsx` | CoachFeedbackCard rendered below each report with comment | VERIFIED | imports `CoachFeedbackCard`, nested join on `report_comments`, conditional render |
| `src/app/api/calendar/route.ts` | Comments included in calendar API response | VERIFIED | post-query fetch of `report_comments`, returns `comments: commentsMap` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CommentForm.tsx` | `/api/reports/[id]/comment` | fetch POST on save | VERIFIED | line 24: `fetch(\`/api/reports/${reportId}/comment\`, { method: "POST" ... })` |
| `comment/route.ts` | `report_comments` table | Supabase upsert with onConflict: report_id | VERIFIED | lines 102-109: `.from("report_comments").upsert(..., { onConflict: "report_id" })` |
| `ReportRow.tsx` | `CommentForm.tsx` | import and render with reportId + initialComment props | VERIFIED | line 6: `import { CommentForm } from "@/components/shared/CommentForm"`, line 176 render |
| `CalendarTab.tsx` | `CommentForm.tsx` | import and render with reportId + initialComment from comments prop | VERIFIED | line 9: `import { CommentForm }`, lines 267-271 render |
| `history/page.tsx` | `CoachFeedbackCard.tsx` | import and render for each report with a comment | VERIFIED | line 10: `import { CoachFeedbackCard }`, lines 132-138 conditional render |
| `history/page.tsx` | `report_comments` table | Supabase select with nested join on report_comments + users | VERIFIED | lines 40-47: `.select(... report_comments ( ... coach:users!report_comments_coach_id_fkey ( name ) ) )` |
| `calendar/route.ts` | `report_comments` table | Parallel fetch added for comments keyed by report_id | VERIFIED | lines 103-114: post-query fetch returning `commentsMap` keyed by `report_id` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CommentForm.tsx` | `value` (textarea state) | `initialComment` prop initialized from DB-fetched `existingComment` | Yes — fed by real Supabase `report_comments` query in coach/reports page and CalendarTab | FLOWING |
| `CoachFeedbackCard.tsx` | `comment`, `coachName`, `updatedAt` props | `history/page.tsx` nested join: `report_comments ( ... coach:users!report_comments_coach_id_fkey ( name ) )` | Yes — real DB query with FK join | FLOWING |
| `CalendarTab.tsx` | `displayComments` state | `comments` prop from coach/owner student detail pages; refreshed via `/api/calendar` which queries `report_comments` | Yes — both initial SSR load and month-change API fetch from real DB | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (no runnable entry points without starting the dev server; all checks require HTTP requests to a live Next.js server).

TypeScript type check serves as a proxy build validation:
`npx tsc --noEmit` exits 0 — all 3 new files and 10 modified files type-check cleanly.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMMENT-01 | 34-01, 34-02 | Coach can submit a text comment (max 1000 chars) on any of their students' daily reports | SATISFIED | API route validates `z.string().min(1).max(1000)`; CommentForm wired in ReportRow and CalendarTab for coaches |
| COMMENT-02 | 34-01, 34-02 | Only one comment per report is allowed (upsert behavior — resubmitting updates the existing comment) | SATISFIED | `onConflict: "report_id"` in upsert; button adapts to "Update Comment" when `initialComment` exists |
| COMMENT-03 | 34-02 | Student sees coach comment on their report history page as a read-only feedback card | SATISFIED | `history/page.tsx` renders `CoachFeedbackCard` below each report that has a comment |
| COMMENT-04 | 34-01, 34-02 | Owner can also comment on any student's report | SATISFIED | API role check allows `owner`; ownership check conditional on `coach` role only; `OwnerStudentDetailClient` threads `calendarComments` to CalendarTab |
| COMMENT-05 | 34-01 | API returns 403 for student and student_diy roles attempting to comment | SATISFIED | route.ts lines 42-44: `profile.role !== "coach" && profile.role !== "owner"` returns 403 |

No orphaned requirements — all 5 COMMENT IDs from both plans are accounted for and verified.

### Anti-Patterns Found

No anti-patterns found. Scan results:

- No TODO/FIXME/PLACEHOLDER comments in any phase 34 files
- No `return null`, `return {}`, `return []` empty implementations (the `{ data: [] }` in conditional queries is a safe default for zero-ID case, not a stub)
- No hardcoded empty props passed to CoachFeedbackCard or CommentForm
- Catch blocks are non-empty (CommentForm: `toastRef.current({ type: "error", title: "Network error" })`)
- `response.ok` checked before JSON parse in CommentForm (line 29)
- Zod imported as `import { z } from "zod"` (not "zod/v4")
- All colors use `ima-*` tokens — no hardcoded hex values
- Admin client used for all DB queries in API route
- Button component `sm` size already provides `min-h-[44px]`; `Textarea` primitive provides accessible `label` prop
- `aria-hidden="true"` on decorative MessageSquare icon in CoachFeedbackCard
- `role="region" aria-label="Coach feedback"` on CoachFeedbackCard for screen reader context

### Human Verification Required

#### 1. End-to-end Comment Submit Flow

**Test:** Log in as a coach. Go to /coach/reports, expand a report row, type a comment in the textarea, click "Save Comment".
**Expected:** Toast shows "Comment saved". Refreshing the page shows the same comment pre-filled ("Update Comment" label).
**Why human:** Requires live Supabase connection and browser session.

#### 2. Student Sees CoachFeedbackCard

**Test:** After a coach saves a comment via the above flow, log in as the student. Go to /student/report/history.
**Expected:** Below the matching report card, a `bg-ima-surface-accent` card appears with the coach's initials, name, timestamp, and comment text.
**Why human:** Cross-session state and UI rendering require a browser.

#### 3. Calendar Month Change Preserves Pre-fill

**Test:** Log in as a coach. Open student detail, go to Calendar tab. Navigate to a month that has a report with an existing comment, select that day.
**Expected:** CommentForm textarea shows the existing comment. Navigate to a different month and back; the comment still pre-fills correctly.
**Why human:** Requires multi-step calendar navigation in a live browser session.

#### 4. 403 for Student Role

**Test:** Log in as a student. Attempt `POST /api/reports/{any-report-id}/comment` with a valid JSON body.
**Expected:** Response is `{ "error": "Forbidden" }` with HTTP 403.
**Why human:** Verifying cross-role enforcement requires authenticated HTTP requests with a student session.

### Gaps Summary

No gaps found. All 13 truths are verified, all artifacts exist and are substantive and wired, all key links confirmed, all 5 requirement IDs satisfied, TypeScript type check passes with zero errors. The phase goal is fully achieved in code.

---

_Verified: 2026-04-03T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
