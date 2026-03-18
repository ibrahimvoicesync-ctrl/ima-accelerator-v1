# Phase 6: Coach Dashboard & Student Views - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A coach can see an overview of their assigned students and drill into any student's full activity history. The coach dashboard shows stat cards, an at-risk banner, and a full student card grid. The student detail page shows roadmap progress, recent work sessions, and submitted reports. Coach sees ONLY their own assigned students (filtered by coach_id). This phase does NOT include: report review/mark-as-reviewed (Phase 7), coach invites (Phase 7), coach analytics (Phase 7), or any owner views.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Personalized greeting: "Good morning/afternoon/evening, [FirstName]!" + subtitle "Here's how your students are doing"
- 3 stat cards across top: Total Students, At-Risk count, Reports Pending Review (count of unreviewed reports from assigned students)
- At-risk banner below stat cards (only if flagged students exist): warning-styled card listing each at-risk student with reason and link to detail page
- Full student list below as 2-column card grid (1-col mobile), showing ALL assigned students — not a preview
- /coach/students page shows the same full list (or redirects to dashboard) — dashboard IS the primary student view
- Student cards clickable — link to /coach/students/[studentId] detail page

### Student card content
- Initials avatar (first letters of name)
- Student name
- "Last active" computed from data (see at-risk detection)
- Today's report status: green checkmark "Submitted" or amber "Pending"
- Current roadmap step: "Step N/10"
- At-risk badge (red) when flagged

### Student detail page
- Claude's Discretion — sections for roadmap progress, recent sessions, and submitted reports (from success criteria). Layout, tabs vs scrollable sections, history depth, and styling are implementation decisions.

### At-risk detection
- No last_active_at column in V1 — compute "last active" as MAX(latest work_session.date, latest daily_report.date)
- Inactive threshold: 3 days with no activity (from COACH_CONFIG.atRiskInactiveDays)
- Rating threshold: average star_rating < 2 from reports in the last 7 days (from COACH_CONFIG.atRiskRatingThreshold, window matches COACH_CONFIG.reportInboxDays)
- New students (zero work sessions AND zero reports) get a "New" badge instead of "At Risk" — only flag as at-risk after 3 days since joined_at
- At-risk reasons shown in banner: "Inactive Xd" and/or "Avg rating X.X"
- Double visibility: dedicated at-risk banner at top + "At Risk" badge on individual student card

### Claude's Discretion
- Student detail page layout (tabs vs scrollable sections, history depth)
- Exact stat card styling and icons
- Student card hover/interaction states
- Empty state when coach has no assigned students
- Loading skeleton designs
- Sort order of student list (at-risk first, alphabetical, or by activity)
- How to handle /coach/students page (redirect to /coach or duplicate the list)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Coach requirements
- `.planning/REQUIREMENTS.md` — COACH-01 (dashboard with student overview), COACH-02 (student list), COACH-03 (student detail with reports/sessions/roadmap)
- `.planning/ROADMAP.md` — Phase 6 success criteria (4 acceptance tests)
- `.planning/PROJECT.md` — Coach config (at-risk thresholds, max students, report inbox days)

### Configuration
- `src/lib/config.ts` — COACH_CONFIG (atRiskInactiveDays: 3, atRiskRatingThreshold: 2, maxStudentsPerCoach: 50, reportInboxDays: 7)
- `src/lib/config.ts` — ROUTES.coach (dashboard, students, studentDetail, reports, analytics, invites)
- `src/lib/config.ts` — NAVIGATION.coach (5 nav items with separator and badge config)

### Reference implementation
- `reference-old/src/app/(dashboard)/coach/page.tsx` — Full coach dashboard with stat cards, at-risk banner, reports preview, calls section (strip V2: deals, calls, revenue, leaderboard, settings)
- `reference-old/src/components/coach/StudentCard.tsx` — Student card with progress grid, at-risk badge, initials avatar
- `reference-old/src/components/coach/CoachStudentsList.tsx` — Student list component with search
- `reference-old/src/components/coach/CoachStudentDetailClient.tsx` — Student detail page with tabs
- `reference-old/src/components/coach/StudentHeader.tsx` — Student detail header
- `reference-old/src/components/coach/StudentDetailTabs.tsx` — Tab navigation for detail sections
- `reference-old/src/components/coach/ReportsTab.tsx` — Reports list in student detail
- `reference-old/src/components/coach/WorkSessionsTab.tsx` — Work sessions in student detail
- `reference-old/src/components/coach/RoadmapTab.tsx` — Roadmap progress in student detail

### Database schema
- `supabase/migrations/00001_create_tables.sql` — users table (coach_id FK for assignment), work_sessions, daily_reports, roadmap_progress tables
- `supabase/migrations/00001_create_tables.sql` — RLS policies: coach can SELECT work_sessions/daily_reports/roadmap_progress for assigned students (WHERE student_id IN users WHERE coach_id = coach.id)

### Auth & session
- `src/lib/session.ts` — requireRole("coach") for server components, SessionUser includes coachId
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries (bypasses RLS)

### Existing patterns
- `src/app/(dashboard)/student/page.tsx` — Student dashboard pattern (greeting, stat display, card grid, adaptive CTAs)
- `src/app/(dashboard)/coach/page.tsx` — Current placeholder to replace

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/components/coach/StudentCard.tsx` — Student card with progress grid and at-risk badge. Strip V2 fields (niche, streak, deals, cash). Add V1 fields (report status, roadmap step).
- `reference-old/src/components/coach/CoachStudentsList.tsx` — Student list with search. Adapt for V1 data shape.
- `reference-old/src/components/coach/CoachStudentDetailClient.tsx` — Student detail client component. Strip V2 tabs (deals, calls).
- `src/components/ui/` — Card, Badge, Button, Skeleton, Spinner, Toast already exist. No new primitives needed for Phase 6.
- `src/lib/config.ts` — COACH_CONFIG already defined with all needed thresholds and limits.
- `src/lib/utils.ts` — getGreeting(), formatHours(), getToday() already exist (used in student dashboard).

### Established Patterns
- Server components for reads, "use client" only for interactivity (student detail tabs may need client for tab switching)
- Admin client for all server queries, user ID filtering for defense-in-depth (coach_id = user.id)
- Greeting + stat display + card grid pattern (student dashboard is the template)
- motion-safe: prefix on all animations, 44px touch targets, ARIA labels
- ima-* tokens only, no hardcoded colors

### Integration Points
- `src/app/(dashboard)/coach/page.tsx` — Replace placeholder with full dashboard
- `src/app/(dashboard)/coach/students/` — New directory for student list (if separate) and detail pages
- `src/app/(dashboard)/coach/students/[studentId]/` — New dynamic route for student detail
- Coach nav already configured: "My Students" -> "/coach/students", "Dashboard" -> "/coach"

</code_context>

<specifics>
## Specific Ideas

- Dashboard follows the same visual DNA as student dashboard — greeting, stats, then content cards
- At-risk banner should feel urgent but not alarming — warning yellow, not error red, with clear action path (click to view student)
- "New" badge for freshly joined students with no activity is a friendlier signal than immediately marking them at-risk
- Full student list on dashboard keeps things simple — coach max is 50 students, so pagination isn't needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-coach-dashboard-student-views*
*Context gathered: 2026-03-16*
