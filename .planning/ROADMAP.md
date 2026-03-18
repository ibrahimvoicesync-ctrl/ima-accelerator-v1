# Roadmap: IMA Accelerator V1

## Overview

Build a three-role coaching platform (owner, coach, student) centered on a daily accountability loop: students track 45-minute work sessions, submit daily reports, and advance through a 10-step roadmap. Coaches monitor their assigned students and review submitted reports. The owner monitors platform health and intervenes via an alert system. The build order is strictly dependency-driven: secure foundation first, then auth, then student features (they produce the data), then coach features (they consume student data), then owner features (they aggregate everything), then polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffold, schema, Supabase clients, config, and route proxy (completed 2026-03-16)
- [ ] **Phase 2: Authentication & Access** - Google OAuth login, invite registration, role-based routing
- [x] **Phase 3: Student Work Tracker** - 45-minute work cycles with timer state persistence (completed 2026-03-16)
- [x] **Phase 4: Student Roadmap** - 10-step sequential roadmap with locked/active/completed states (completed 2026-03-16)
- [ ] **Phase 5: Student Daily Reports & AI Chat** - Report submission with auto-filled hours and AI chat embed
- [x] **Phase 6: Coach Dashboard & Student Views** - Coach home, assigned student list, and student detail (completed 2026-03-16)
- [x] **Phase 7: Coach Report Review, Invites & Analytics** - Report inbox, mark-as-reviewed, invite flow, basic analytics (completed 2026-03-17)
- [x] **Phase 8: Owner Stats & People Management** - Platform stats dashboard and student/coach list views (completed 2026-03-17)
- [x] **Phase 9: Owner Invites, Assignments & Alerts** - Invite system, coach-student assignments, alert system (completed 2026-03-17)
- [x] **Phase 10: UI Polish & Production Hardening** - Loading skeletons, error boundaries, empty states, mobile pass (completed 2026-03-17)
- [ ] **Phase 11: Fix Invite Registration URL** - Fix broken invite URL format that prevents email invite registration flow
- [ ] **Phase 12: CLAUDE.md Hard Rule Compliance** - Replace raw Tailwind tokens with ima-* tokens, fix response.ok checks, touch targets, UTC date bug

## Phase Details

### Phase 1: Foundation
**Goal**: The project compiles, connects to Supabase, and enforces role-based routing before any feature is built
**Depends on**: Nothing (first phase)
**Requirements**: (no direct v1 requirement IDs — this phase is the prerequisite that makes all other phases possible)
**Success Criteria** (what must be TRUE):
  1. `npm run dev` starts without errors and the app loads at localhost:3000
  2. Database schema (6 tables: users, invites, magic_links, work_sessions, roadmap_progress, daily_reports) exists in Supabase with RLS enabled and correct policies
  3. `proxy.ts` redirects unauthenticated visitors to /login and wrong-role visitors to /no-access
  4. `createAdminClient()` is service-role guarded (server-only) and accessible from page components
  5. `lib/config.ts` exports all roles, routes, roadmap steps, thresholds, and validation rules with no runtime errors
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Project scaffold (Next.js 16, TypeScript strict, Tailwind v4, ima-* tokens, all dependencies)
- [x] 01-02-PLAN.md — Supabase schema (6-table migration, RLS policies, seed data, three client tiers, type generation)
- [ ] 01-03-PLAN.md — Config and proxy (V1 config.ts, proxy.ts route guard, dashboard layout shell, Sidebar, placeholder pages)

### Phase 2: Authentication & Access
**Goal**: Users can securely enter the platform via Google OAuth with invite gating, and land on the correct role dashboard
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. User visits /login and is redirected to Google OAuth; after approving, they land on their role-specific dashboard (/student, /coach, or /owner)
  2. User with no invite code who tries to register sees a rejection and cannot create an account
  3. User with a valid 72-hour invite code can complete registration and is assigned the correct role
  4. User with a valid magic link can complete registration as an alternative to the invite code
  5. User who refreshes the browser remains logged in and stays on the correct dashboard
  6. User who navigates directly to /owner while authenticated as a student is redirected to /no-access
**Plans:** 2/3 plans executed

Plans:
- [ ] 02-01-PLAN.md — OAuth callback handler + session helper (code exchange, invite consumption, magic link claim, roadmap seeding, getSessionUser)
- [ ] 02-02-PLAN.md — Auth pages (login, register/[code], register magic link, no-access upgrade, auth layout)
- [ ] 02-03-PLAN.md — Dashboard auth wiring (per-page auth checks with requireRole, sign-out endpoint)

### Phase 3: Student Work Tracker
**Goal**: A student can run and track their daily 45-minute work cycles, and the timer survives navigation and browser refresh
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06
**Success Criteria** (what must be TRUE):
  1. Student can start a 45-minute cycle timer on their dashboard and watch it count down
  2. Student can pause a running cycle and return later to find the timer at the correct remaining time
  3. Student can mark a cycle as complete; it counts toward today's progress (max 4 cycles)
  4. Student can abandon a cycle; if less than 5 minutes have elapsed a confirmation is required, after 5 minutes abandon is immediate
  5. Student who navigates away mid-cycle and returns finds the timer restored with correct remaining time based on started_at
  6. Today's cycle count (e.g., 2/4 complete) is visible on the student dashboard
**Plans:** 3/3 plans complete

Plans:
- [ ] 03-01-PLAN.md — DB migration (pause support), TypeScript types, utility functions, and work session API routes (POST start, PATCH complete/pause/resume/abandon)
- [ ] 03-02-PLAN.md — Work tracker client components (WorkTimer SVG ring, CycleCard status cards, WorkTrackerClient orchestrator, /student/work page)
- [ ] 03-03-PLAN.md — Student dashboard rewrite (personalized greeting, work progress card with adaptive CTA, placeholder cards)

### Phase 4: Student Roadmap
**Goal**: A student can see their progress through the 10-step program roadmap and advance steps in sequence
**Depends on**: Phase 2
**Requirements**: ROAD-01, ROAD-02, ROAD-03
**Success Criteria** (what must be TRUE):
  1. Newly registered student sees Step 1 (Join the Course) already marked completed and Step 2 as the active step
  2. Student can see all 10 steps with correct locked/active/completed visual states
  3. Student can click "Mark Complete" on their active step; the step moves to completed and the next step becomes active
  4. Student cannot interact with locked steps (no button, or button is disabled)
**Plans:** 2/2 plans complete

Plans:
- [ ] 04-01-PLAN.md — UI primitives (Button, Badge, Modal, Toast, Spinner) + PATCH /api/roadmap route with sequential unlock logic
- [ ] 04-02-PLAN.md — Roadmap page (RoadmapStep, RoadmapClient, server page with lazy seeding), dashboard live roadmap card, ToastProvider wiring

### Phase 5: Student Daily Reports & AI Chat
**Goal**: A student can submit a daily report with hours auto-filled from their sessions, view past reports, and access the AI coach chat
**Depends on**: Phase 3 (for auto-filled hours)
**Requirements**: REPT-01, REPT-02, REPT-03, AICHAT-01
**Success Criteria** (what must be TRUE):
  1. Student opens the daily report form and sees today's hours pre-populated from their completed work sessions
  2. Student can submit a report with star rating (1-5), outreach count, and optional wins/improvements text
  3. Student who has already submitted today's report sees a confirmation state and cannot submit again
  4. Student can view a list of their past daily reports
  5. Student can navigate to /student/ask and see the Ask Abu Lahya iframe embed (placeholder URL during development)
**Plans:** 2/3 plans executed

Plans:
- [ ] 05-01-PLAN.md — UI primitives (Card, Input, Textarea, Skeleton, StarRating) + POST /api/reports route with Zod validation and upsert logic
- [ ] 05-02-PLAN.md — Report form page (ReportForm + ReportFormWrapper client islands, server page with date/hours/status, past reports history, dashboard card wiring)
- [ ] 05-03-PLAN.md — AI chat page (AskIframe client component with skeleton loader + Coming Soon fallback, /student/ask server page)

### Phase 6: Coach Dashboard & Student Views
**Goal**: A coach can see an overview of their assigned students and drill into any student's full activity history
**Depends on**: Phase 5 (student data must exist to display)
**Requirements**: COACH-01, COACH-02, COACH-03
**Success Criteria** (what must be TRUE):
  1. Coach lands on /coach and sees a summary card for each assigned student (name, last active, report submission status)
  2. Students who meet the at-risk threshold (3 days inactive or avg rating < 2) are visually flagged on the dashboard
  3. Coach can click a student to reach a detail page showing their roadmap progress, recent sessions, and submitted reports
  4. Coach sees only their own assigned students — no data from students assigned to other coaches
**Plans:** 2/2 plans complete

Plans:
- [ ] 06-01-PLAN.md — Coach dashboard page (StudentCard component, server component with parallel data fetch, stat cards, at-risk banner, student card grid, /coach/students redirect)
- [ ] 06-02-PLAN.md — Student detail page (StudentHeader, StudentDetailTabs, StudentDetailClient, RoadmapTab, WorkSessionsTab, ReportsTab, server page with defense-in-depth coach_id filter)

### Phase 7: Coach Report Review, Invites & Analytics
**Goal**: A coach can review and acknowledge student reports, invite new students, and see basic analytics on their cohort
**Depends on**: Phase 6
**Requirements**: COACH-04, COACH-05, COACH-06
**Success Criteria** (what must be TRUE):
  1. Coach can view a report inbox showing unreviewed reports from assigned students in the last 7 days
  2. Coach can mark a report as reviewed; it moves out of the unreviewed inbox
  3. Coach can generate a student invite link (72-hour expiry) from the coach dashboard
  4. Coach can see a summary of report submission rates and student activity trends for their cohort
**Plans:** 4/4 plans complete

Plans:
- [ ] 07-01-PLAN.md — Report review API and inbox page (PATCH toggle review, report inbox with stat cards, filter tabs, expandable rows, optimistic review toggle)
- [ ] 07-02-PLAN.md — Coach invite flow (POST /api/invites, POST+PATCH /api/magic-links, invite page with email invite form, magic link generation, clipboard copy, invite history)
- [ ] 07-03-PLAN.md — Coach analytics and sidebar badge (analytics page with 4 metric stat cards and student breakdown, sidebar badge wiring for unreviewed report count)
- [ ] 07-04-PLAN.md — UAT gap closure (fix report filter tabs stale state, add existing-user email check to invite API)

### Phase 8: Owner Stats & People Management
**Goal**: The owner can see platform-wide health metrics and navigate any student or coach's profile
**Depends on**: Phase 7 (all role data must be populated)
**Requirements**: OWNER-01, OWNER-02, OWNER-03, OWNER-04, OWNER-05
**Success Criteria** (what must be TRUE):
  1. Owner lands on /owner and sees aggregate platform stats (total students, total coaches, active today, reports submitted today)
  2. Owner can view a searchable list of all students on the platform
  3. Owner can click into any student's detail page and see their sessions, reports, and roadmap progress
  4. Owner can view a list of all coaches with their assigned student count and average student rating
  5. Owner can click into any coach's detail page and see their assigned students and performance metrics
**Plans:** 4/4 plans complete

Plans:
- [ ] 08-01-PLAN.md — Owner dashboard stats + StudentCard basePath (4 aggregate stat cards with admin queries, clickable Students/Coaches cards, display-only Active Today/Reports Today, basePath prop on StudentCard for cross-role reuse)
- [ ] 08-02-PLAN.md — Owner student list and detail pages (searchable student list with debounced URL param search, student detail with tabbed view reusing coach tab components, /owner path prefix)
- [ ] 08-03-PLAN.md — Owner coach list and detail pages (coach card grid with student count and avg 7-day rating, coach detail with 4 stat cards and assigned students via StudentCard basePath)
- [ ] 08-04-PLAN.md — UAT gap closure (add missing email to student detail headers, restructure CoachCard to stacked layout)

### Phase 9: Owner Invites, Assignments & Alerts
**Goal**: The owner can onboard coaches and students via invites, assign students to coaches, and be alerted to at-risk situations
**Depends on**: Phase 8
**Requirements**: OWNER-06, OWNER-07, OWNER-08, OWNER-09
**Success Criteria** (what must be TRUE):
  1. Owner can generate and copy an invite link for a new coach or student (72-hour expiry, magic link option)
  2. Owner can assign or reassign any student to any coach from the student detail page
  3. Owner sees an alert list for: students inactive 3+ days, students who haven't logged in for 7+ days, unreviewed reports, and coaches with avg student rating below 2.5 for 14+ days
  4. Owner can acknowledge or dismiss an alert; dismissed alerts no longer appear in the list
**Plans:** 5/5 plans complete

Plans:
- [x] 09-01-PLAN.md — Owner invite system (extend invite/magic-link APIs for owner role, OwnerInvitesClient with role selector, /owner/invites page)
- [x] 09-02-PLAN.md — Coach-student assignment (PATCH /api/assignments, coach dropdown on student detail page, /owner/assignments redirect)
- [x] 09-03-PLAN.md — Owner alert system (alert_dismissals migration, POST /api/alerts/dismiss, computed alerts page with 4 alert types, OwnerAlertsClient with filter tabs and dismiss, sidebar badge)
- [ ] 09-04-PLAN.md — UAT gap closure: dedicated assignments page (replace redirect with full page, coach capacity cards, student list with inline coach dropdowns, filter by coach/unassigned)
- [ ] 09-05-PLAN.md — UAT gap closure: fix new student false-positive dropoff alerts (add joined_at grace period to alert classification and sidebar badge)

### Phase 10: UI Polish & Production Hardening
**Goal**: Every page has loading states, graceful error handling, motivating empty states, and works on mobile — and the production deployment is verified end-to-end
**Depends on**: Phase 9
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. Every page shows a skeleton loading state (matching page layout) while data is fetching via Suspense boundaries
  2. Any page that encounters a server or client error shows a user-friendly error message with a retry action instead of a crash
  3. Every list or dashboard that has no data shows an empty state with contextual copy and a relevant CTA
  4. All pages are usable on a 375px-wide mobile screen with no horizontal scroll and no overlapping elements
  5. All buttons and interactive elements have at least 44px touch targets
  6. All UI components use ima-* design tokens, blue primary (#2563EB), and Inter font — matching the reference codebase visual style
**Plans**: TBD

Plans:
- [ ] 10-01: Shared UI primitives (CVA-based Button, Card, Badge, Input components with ima-* tokens; Skeleton component)
- [ ] 10-02: Loading skeletons and error boundaries (Suspense wrappers on all data-fetching pages, error.tsx files, ErrorBoundary components)
- [ ] 10-03: Empty states and mobile pass (empty state components with copy/CTAs, responsive layout audit across all pages, touch target audit)

### Phase 11: Fix Invite Registration URL
**Goal**: Email invite registration works end-to-end — clicking a copied invite URL lands on the correct registration page
**Depends on**: Phase 7, Phase 9 (invite system)
**Requirements**: COACH-05, OWNER-06
**Gap Closure:** Closes requirement, integration, and flow gaps from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `POST /api/invites` returns `registerUrl` with path-segment format `/register/{code}` (not query param)
  2. Coach-generated invite URL lands on `/register/[code]/page.tsx` (not magic link page)
  3. Owner-generated invite URL lands on `/register/[code]/page.tsx` (not magic link page)
**Plans:** 1 plan

Plans:
- [ ] 11-01-PLAN.md — Fix registerUrl format in invite API route

### Phase 12: CLAUDE.md Hard Rule Compliance
**Goal**: All code complies with CLAUDE.md hard rules — no raw Tailwind color tokens, all fetches check response.ok, all interactive elements have 44px touch targets
**Depends on**: Phase 3, Phase 2, Phase 8 (affected code)
**Requirements**: (no direct requirement IDs — closes tech debt from audit)
**Gap Closure:** Closes tech debt items from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `WorkTrackerClient.tsx` and `CycleCard.tsx` use only ima-* design tokens (no raw bg-green-50, text-red-600, etc.)
  2. Auth pages (login, register) use ima-* tokens for error states (no raw bg-red-50/text-red-700)
  3. `WorkTrackerClient.tsx` stale-session abandon fetch checks `response.ok` before proceeding
  4. `StudentCard` Link wrapper has explicit `min-h-[44px]` class
  5. `getToday()` returns local date, not UTC
**Plans:** TBD

Plans:
- [ ] 12-01-PLAN.md — Replace raw Tailwind tokens with ima-* tokens across work tracker, cycle cards, and auth pages
- [ ] 12-02-PLAN.md — Fix response.ok check, StudentCard touch target, and getToday() UTC bug

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-16 |
| 2. Authentication & Access | 2/3 | In Progress|  |
| 3. Student Work Tracker | 3/3 | Complete   | 2026-03-16 |
| 4. Student Roadmap | 2/2 | Complete   | 2026-03-16 |
| 5. Student Daily Reports & AI Chat | 2/3 | In Progress|  |
| 6. Coach Dashboard & Student Views | 2/2 | Complete   | 2026-03-16 |
| 7. Coach Report Review, Invites & Analytics | 4/4 | Complete   | 2026-03-17 |
| 8. Owner Stats & People Management | 4/4 | Complete   | 2026-03-17 |
| 9. Owner Invites, Assignments & Alerts | 5/5 | Complete   | 2026-03-17 |
| 10. UI Polish & Production Hardening | 4/4 | Complete    | 2026-03-17 |
| 11. Fix Invite Registration URL | 0/1 | Pending | |
| 12. CLAUDE.md Hard Rule Compliance | 0/2 | Pending | |
