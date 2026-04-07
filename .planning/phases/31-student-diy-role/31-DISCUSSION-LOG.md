# Phase 31: Student_DIY Role - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 31-student-diy-role
**Areas discussed:** Page architecture, Dashboard content, Invite creation UX, Blocked route behavior

---

## Page Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Own route group | Separate `/student_diy/` directory with its own page.tsx files, reuse student components via imports | ✓ |
| Share student pages | Use `/student/` pages with conditional rendering based on role | |

**User's choice:** Own route group `/student_diy/` with separate page files
**Notes:** Keeps proxy routing clean and avoids conditional rendering complexity. Components (WorkTrackerClient, RoadmapClient) are reused via imports, but page.tsx files are separate with `requireRole("student_diy")`.

---

## Dashboard Content

| Option | Description | Selected |
|--------|-------------|----------|
| Stripped-down student | Work progress card + roadmap progress card only, no reports/coach/KPI cards | ✓ |
| Custom layout | Purpose-built layout different from student dashboard | |

**User's choice:** Stripped-down student dashboard
**Notes:** Show work progress card + roadmap progress card only. No daily report card, no coach info, no KPI outreach cards (student_diy doesn't submit reports).

---

## Invite Creation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Add to existing dropdown | "Student DIY" added as option in existing role dropdown on coach/owner invite forms | ✓ |
| Separate invite flow | New dedicated invite flow for student_diy invites | |

**User's choice:** Add "Student DIY" to existing role dropdown
**Notes:** Same form, just one more option. Both coach and owner invite forms.

---

## Blocked Route Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent redirect | Redirect to /student_diy dashboard with no message, matching existing proxy pattern | ✓ |
| Toast message | Redirect with a brief explanation toast about access | |

**User's choice:** Silent redirect to /student_diy dashboard
**Notes:** Same pattern as existing proxy behavior. No toast needed.

---

## Claude's Discretion

- Dashboard card layout and spacing for the reduced 2-card layout
- Exact requireRole helper pattern
- Order of config.ts changes

## Deferred Ideas

None — all discussion stayed within phase scope
