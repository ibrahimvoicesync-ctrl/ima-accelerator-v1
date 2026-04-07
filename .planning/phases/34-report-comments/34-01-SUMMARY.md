---
phase: 34-report-comments
plan: "01"
subsystem: api-and-shared-components
tags: [comments, api, shared-components, upsert]
dependency_graph:
  requires: []
  provides:
    - POST /api/reports/[id]/comment (upsert endpoint)
    - CommentForm (reusable comment textarea + save client component)
    - CoachFeedbackCard (read-only feedback card for student history)
  affects:
    - src/lib/types.ts (report_comments table type + student_diy role added)
tech_stack:
  added: []
  patterns:
    - Supabase upsert with onConflict: report_id (one comment per report)
    - Two-step ownership check (fetch report, then conditional coach check)
    - toastRef stable ref pattern for useCallback deps
key_files:
  created:
    - src/app/api/reports/[id]/comment/route.ts
    - src/components/shared/CommentForm.tsx
    - src/components/shared/CoachFeedbackCard.tsx
  modified:
    - src/lib/types.ts (added report_comments Row/Insert/Update, student_diy role)
decisions:
  - "Owner skips ownership check — conditional on profile.role === coach only"
  - "report_comments types added to types.ts (worktree missing phase 30 migration types)"
  - "student_diy role added to users table type for COMMENT-05 enforcement"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 34 Plan 01: Report Comments — API and Shared Components Summary

**One-liner:** POST upsert API with CSRF/auth/role/ownership guards + CommentForm textarea client component + CoachFeedbackCard read-only feedback card.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create POST /api/reports/[id]/comment API route | 40e186d | src/app/api/reports/[id]/comment/route.ts, src/lib/types.ts |
| 2 | Create CommentForm and CoachFeedbackCard shared components | 741ca88 | src/components/shared/CommentForm.tsx, src/components/shared/CoachFeedbackCard.tsx |

## What Was Built

**API Route** (`src/app/api/reports/[id]/comment/route.ts`):
- POST endpoint following exact CSRF > Auth > Admin > Role > RateLimit > Parse > Zod > Params > Report > Ownership > Upsert order
- Zod commentSchema: `z.string().min(1).max(1000)` on comment field
- Role check: only coach and owner can comment; student/student_diy receive 403 (COMMENT-04, COMMENT-05)
- Two-step ownership: fetch report to verify it exists, then conditional coach check (owner skips it)
- Upsert with `onConflict: "report_id"` guarantees one comment per report (COMMENT-01, COMMENT-02)
- 404 for ownership failures to prevent report-ID probing (Pitfall 4 from RESEARCH.md)

**CommentForm** (`src/components/shared/CommentForm.tsx`):
- "use client" component with `reportId` and `initialComment` props
- Reuses `Textarea` primitive (accessible, min-h-[44px], ima-* tokens)
- 1000 char max with live char counter (`{value.length}/1000`)
- toastRef stable ref pattern (consistent with CoachReportsClient, CoachAlertsClient, etc.)
- `response.ok` check before JSON parse (CLAUDE.md hard rule #6)
- Non-empty catch block (CLAUDE.md hard rule #5)
- Button label adapts: "Save Comment" for new, "Update Comment" for existing

**CoachFeedbackCard** (`src/components/shared/CoachFeedbackCard.tsx`):
- Presentational server-compatible component
- `bg-ima-surface-accent` background (decision D-03)
- Coach initials avatar circle (`bg-ima-primary`, `text-white`)
- `getInitials()` and `formatCommentDate()` helper functions
- MessageSquare icon with `aria-hidden="true"`
- `role="region" aria-label="Coach feedback"` for accessibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Type] Added report_comments table type to types.ts**
- **Found during:** Task 1
- **Issue:** The worktree's types.ts did not contain `report_comments` table types (Row/Insert/Update). The research claimed they were already present in types.ts but the phase 30 migration (00015) that creates the table was not applied to the worktree's types.ts.
- **Fix:** Added full `report_comments` Row/Insert/Update/Relationships types to types.ts. Also added `student_diy` to the users.role union type so the role check in the API route compiles correctly.
- **Files modified:** src/lib/types.ts
- **Commit:** 40e186d

## Verification Results

- `npx tsc --noEmit`: Passes with zero errors (verified after Task 1 and Task 2)
- `npm run build`: Succeeds — all routes and components compile
- All 3 new files exist and export their named exports (POST, CommentForm, CoachFeedbackCard)
- API route follows exact CSRF > Auth > Admin > Role > RateLimit > Parse > Zod > Params > Report > Ownership > Upsert order

## Known Stubs

None — all components are fully functional with real API calls and proper data flow.

## Self-Check: PASSED

- FOUND: src/app/api/reports/[id]/comment/route.ts
- FOUND: src/components/shared/CommentForm.tsx
- FOUND: src/components/shared/CoachFeedbackCard.tsx
- FOUND commit 40e186d (feat(34-01): create POST /api/reports/[id]/comment endpoint)
- FOUND commit 741ca88 (feat(34-01): create CommentForm and CoachFeedbackCard shared components)
