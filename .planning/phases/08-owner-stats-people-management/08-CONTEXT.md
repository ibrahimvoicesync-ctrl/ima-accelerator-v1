# Phase 8: Owner Stats & People Management - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The owner can see platform-wide health metrics on a stats dashboard and browse/search any student or coach on the platform. Owner dashboard shows 4 aggregate stat cards. Owner can navigate to a searchable student list and click into any student's detail (sessions, reports, roadmap). Owner can navigate to a coach list and click into any coach's detail (assigned students, performance metrics). This phase does NOT include: invite system (Phase 9), coach-student assignments (Phase 9), alert system (Phase 9), or UI polish (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Dashboard stats page
- Greeting + subtitle ("Platform overview") + 4 stat cards only — clean and minimal
- 4 stat cards in a single row on desktop (grid-cols-4), 2x2 grid on mobile (grid-cols-2)
- Stats: Total Students, Total Coaches, Active Today, Reports Submitted Today (matching OWNER_CONFIG.statCards)
- "Active Today" = students who started at least one work session today
- Each stat card is clickable — links to its corresponding list page (Students → /owner/students, Coaches → /owner/coaches)
- "Active Today" and "Reports Today" are display-only (no link destination)
- No additional content below stat cards — sidebar handles navigation

### Student list page
- Claude's Discretion — layout, search/filter behavior, and card vs table presentation
- Must be searchable (OWNER-02 requirement)
- Students clickable to /owner/students/[studentId]

### Student detail page
- Claude's Discretion — reuse or adapt the coach's student detail page pattern (tabs for roadmap, sessions, reports)
- Owner can see any student, not just those assigned to a specific coach
- Must show sessions, reports, and roadmap progress (OWNER-03 requirement)

### Coach list page
- Card grid layout, 2-column on desktop, 1-column on mobile
- Each coach card shows: initials avatar, coach name, assigned student count, avg student rating (last 7 days)
- Coach cards clickable — link to /owner/coaches/[coachId]

### Coach detail page
- Header: back link, initials avatar, coach name, email
- 4 stat cards: Student Count, Avg Student Rating (7-day), Report Review Rate (%), At-Risk Count
- Assigned Students section below stat cards — reuses the same StudentCard component from the coach dashboard
- StudentCard links to /owner/students/[studentId] (not /coach/students/[studentId])

### Avg student rating
- Computed from the last 7 days of reports, matching COACH_CONFIG.reportInboxDays = 7
- Consistent with coach analytics window

### Claude's Discretion
- Student list layout (table vs cards), search UX, filter options
- Student detail page layout — may reuse coach's student detail with different auth/routing
- Stat card icons, styling, hover states (follow Phase 6 coach stat card pattern)
- Empty states for all pages
- Loading skeleton designs
- Sort order of coach and student lists
- "Report Review Rate" computation details on coach detail page

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Owner requirements
- `.planning/REQUIREMENTS.md` — OWNER-01 (platform stats), OWNER-02 (student list/search), OWNER-03 (student detail), OWNER-04 (coach list with stats), OWNER-05 (coach detail with students/performance)
- `.planning/ROADMAP.md` — Phase 8 success criteria (5 acceptance tests)
- `.planning/PROJECT.md` — Owner config, alert thresholds, invite rules, work tracker rules

### Configuration
- `src/lib/config.ts` — OWNER_CONFIG (statCards array, alertThresholds)
- `src/lib/config.ts` — ROUTES.owner (dashboard, students, studentDetail, coaches, coachDetail, invites, assignments, alerts)
- `src/lib/config.ts` — COACH_CONFIG (atRiskInactiveDays: 3, atRiskRatingThreshold: 2, reportInboxDays: 7)

### Reference implementations
- `reference-old/src/app/(dashboard)/owner/page.tsx` — Full owner dashboard with stat cards, charts, activity feed (strip V2: charts, deals, revenue, leaderboard, tier distribution)
- `reference-old/src/app/(dashboard)/owner/students/page.tsx` — Student list with search/filters
- `reference-old/src/app/(dashboard)/owner/students/[studentId]/page.tsx` — Owner student detail
- `reference-old/src/app/(dashboard)/owner/coaches/page.tsx` — Coach list with stats
- `reference-old/src/app/(dashboard)/owner/coaches/[coachId]/page.tsx` — Coach detail with assigned students
- `reference-old/src/components/owner/CoachCard.tsx` — Coach card with student count, rating
- `reference-old/src/components/owner/CoachDetailClient.tsx` — Coach detail client component
- `reference-old/src/components/owner/OwnerStudentCard.tsx` — Owner student card
- `reference-old/src/components/owner/OwnerStudentDetailClient.tsx` — Owner student detail client
- `reference-old/src/components/owner/OwnerStudentsList.tsx` — Student list with search

### Prior phase context
- `.planning/phases/06-coach-dashboard-student-views/06-CONTEXT.md` — Dashboard visual DNA, at-risk detection, StudentCard component, enrichment pattern
- `.planning/phases/07-coach-report-review-invites-analytics/07-CONTEXT.md` — Stat card pattern, 7-day window, simple stat cards only (no charts)

### Database schema
- `supabase/migrations/00001_create_tables.sql` — users table (role, coach_id, status, joined_at), work_sessions, daily_reports, roadmap_progress tables
- `supabase/migrations/00001_create_tables.sql` — RLS policies for owner access

### Auth & session
- `src/lib/session.ts` — requireRole("owner") for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries (bypasses RLS)

### Existing components
- `src/components/coach/StudentCard.tsx` — Reusable for coach detail page's assigned students section
- `src/app/(dashboard)/coach/page.tsx` — Coach dashboard pattern (greeting + stat cards + card grid) to follow for owner dashboard
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Student detail pattern to adapt for owner's student detail

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/coach/StudentCard.tsx` — Reuse on coach detail page for assigned students. Parameterize the link path (owner vs coach prefix).
- `src/components/ui/Card.tsx`, `Badge.tsx`, `Button.tsx`, `Skeleton.tsx` — All UI primitives already exist.
- `src/lib/utils.ts` — getGreeting(), getToday(), formatHours() already exist.
- `src/lib/config.ts` — OWNER_CONFIG.statCards defines the 4 metrics; COACH_CONFIG has at-risk thresholds.
- `reference-old/src/components/owner/` — Full set of owner components (CoachCard, CoachDetailClient, OwnerStudentCard, etc.) available as reference.

### Established Patterns
- Server components for reads, "use client" only for interactivity (search input, tab switching)
- Admin client for all queries — owner sees ALL data, no user-specific filtering needed (except defense-in-depth role check)
- Greeting + stat cards + content grid pattern (coach dashboard is the template)
- At-risk enrichment pattern from coach dashboard (compute from work_sessions + daily_reports)
- motion-safe: prefix on animations, 44px touch targets, ARIA labels, ima-* tokens only

### Integration Points
- `src/app/(dashboard)/owner/page.tsx` — Replace placeholder with full stats dashboard
- `src/app/(dashboard)/owner/students/` — New directory for student list and detail pages
- `src/app/(dashboard)/owner/coaches/` — New directory for coach list and detail pages
- Owner nav already configured in config.ts: Dashboard, Students, Coaches, Invites, Assignments, Alerts

</code_context>

<specifics>
## Specific Ideas

- Owner dashboard follows the same visual DNA as coach dashboard — greeting, stats, done. No extra sections.
- Stat cards as navigation shortcuts — tap the number to see the list. "Active Today" and "Reports Today" don't link anywhere.
- Coach cards follow the same card grid pattern as student cards on coach dashboard — consistent visual language.
- Coach detail is a mini-dashboard for that coach: their stats + their students using the same StudentCard component.
- 7-day window for avg rating keeps metrics current and consistent with coach-facing analytics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-owner-stats-people-management*
*Context gathered: 2026-03-17*
