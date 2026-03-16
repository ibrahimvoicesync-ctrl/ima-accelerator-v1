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
- [ ] **Phase 3: Student Work Tracker** - 45-minute work cycles with timer state persistence
- [ ] **Phase 4: Student Roadmap** - 10-step sequential roadmap with locked/active/completed states
- [ ] **Phase 5: Student Daily Reports & AI Chat** - Report submission with auto-filled hours and AI chat embed
- [ ] **Phase 6: Coach Dashboard & Student Views** - Coach home, assigned student list, and student detail
- [ ] **Phase 7: Coach Report Review, Invites & Analytics** - Report inbox, mark-as-reviewed, invite flow, basic analytics
- [ ] **Phase 8: Owner Stats & People Management** - Platform stats dashboard and student/coach list views
- [ ] **Phase 9: Owner Invites, Assignments & Alerts** - Invite system, coach-student assignments, alert system
- [ ] **Phase 10: UI Polish & Production Hardening** - Loading skeletons, error boundaries, empty states, mobile pass

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
**Plans:** 3 plans

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
**Plans**: TBD

Plans:
- [ ] 03-01: Work session API routes (start, complete, pause, abandon — with grace period logic and stale session auto-abandon)
- [ ] 03-02: Work tracker client island (countdown timer, cycle state display, start/pause/complete/abandon actions, timer restoration on mount)
- [ ] 03-03: Student dashboard integration (today's cycle progress display, server-component page with initialData pass-through)

### Phase 4: Student Roadmap
**Goal**: A student can see their progress through the 10-step program roadmap and advance steps in sequence
**Depends on**: Phase 2
**Requirements**: ROAD-01, ROAD-02, ROAD-03
**Success Criteria** (what must be TRUE):
  1. Newly registered student sees Step 1 (Join the Course) already marked completed and Step 2 as the active step
  2. Student can see all 10 steps with correct locked/active/completed visual states
  3. Student can click "Mark Complete" on their active step; the step moves to completed and the next step becomes active
  4. Student cannot interact with locked steps (no button, or button is disabled)
**Plans**: TBD

Plans:
- [ ] 04-01: Roadmap API route (mark step complete, with sequential unlock logic)
- [ ] 04-02: Roadmap client island (step list with locked/active/completed states, mark-complete action, auto-complete Step 1 on signup)

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
**Plans**: TBD

Plans:
- [ ] 05-01: Daily report API routes (submit, list own reports — with hours auto-fill from sessions)
- [ ] 05-02: Report form client island (react-hook-form + Zod validation, hours auto-fill display, submission confirmation state)
- [ ] 05-03: Past reports page and AI chat page (report history server component, iframe embed component)

### Phase 6: Coach Dashboard & Student Views
**Goal**: A coach can see an overview of their assigned students and drill into any student's full activity history
**Depends on**: Phase 5 (student data must exist to display)
**Requirements**: COACH-01, COACH-02, COACH-03
**Success Criteria** (what must be TRUE):
  1. Coach lands on /coach and sees a summary card for each assigned student (name, last active, report submission status)
  2. Students who meet the at-risk threshold (3 days inactive or avg rating < 2) are visually flagged on the dashboard
  3. Coach can click a student to reach a detail page showing their roadmap progress, recent sessions, and submitted reports
  4. Coach sees only their own assigned students — no data from students assigned to other coaches
**Plans**: TBD

Plans:
- [ ] 06-01: Coach dashboard page (server component, assigned students overview query, at-risk flag computation)
- [ ] 06-02: Coach student list and detail pages (student list server component, student detail page with roadmap/sessions/reports)

### Phase 7: Coach Report Review, Invites & Analytics
**Goal**: A coach can review and acknowledge student reports, invite new students, and see basic analytics on their cohort
**Depends on**: Phase 6
**Requirements**: COACH-04, COACH-05, COACH-06
**Success Criteria** (what must be TRUE):
  1. Coach can view a report inbox showing unreviewed reports from assigned students in the last 7 days
  2. Coach can mark a report as reviewed; it moves out of the unreviewed inbox
  3. Coach can generate a student invite link (72-hour expiry) from the coach dashboard
  4. Coach can see a summary of report submission rates and student activity trends for their cohort
**Plans**: TBD

Plans:
- [ ] 07-01: Report review API and inbox page (mark-as-reviewed API route, report inbox server component scoped to last 7 days)
- [ ] 07-02: Coach invite flow (invite generation API, invite link display UI)
- [ ] 07-03: Coach analytics page (report rates and activity summary queries, display component)

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
**Plans**: TBD

Plans:
- [ ] 08-01: Owner dashboard stats page (platform-wide aggregate queries, stats display with recharts)
- [ ] 08-02: Owner student list and detail pages (searchable student list, student detail server component)
- [ ] 08-03: Owner coach list and detail pages (coach list with stats, coach detail with students and performance)

### Phase 9: Owner Invites, Assignments & Alerts
**Goal**: The owner can onboard coaches and students via invites, assign students to coaches, and be alerted to at-risk situations
**Depends on**: Phase 8
**Requirements**: OWNER-06, OWNER-07, OWNER-08, OWNER-09
**Success Criteria** (what must be TRUE):
  1. Owner can generate and copy an invite link for a new coach or student (72-hour expiry, magic link option)
  2. Owner can assign or reassign any student to any coach from the student detail page
  3. Owner sees an alert list for: students inactive 3+ days, students who haven't logged in for 7+ days, unreviewed reports, and coaches with avg student rating below 2.5 for 14+ days
  4. Owner can acknowledge or dismiss an alert; dismissed alerts no longer appear in the list
**Plans**: TBD

Plans:
- [ ] 09-01: Owner invite system (coach + student invite generation API, magic link generation, invite management UI)
- [ ] 09-02: Coach-student assignment API and UI (assign/reassign flow on student detail page)
- [ ] 09-03: Owner alert system (alert computation queries, alert list page, acknowledge/dismiss API and UI)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-16 |
| 2. Authentication & Access | 0/3 | Not started | - |
| 3. Student Work Tracker | 0/3 | Not started | - |
| 4. Student Roadmap | 0/2 | Not started | - |
| 5. Student Daily Reports & AI Chat | 0/3 | Not started | - |
| 6. Coach Dashboard & Student Views | 0/2 | Not started | - |
| 7. Coach Report Review, Invites & Analytics | 0/3 | Not started | - |
| 8. Owner Stats & People Management | 0/3 | Not started | - |
| 9. Owner Invites, Assignments & Alerts | 0/3 | Not started | - |
| 10. UI Polish & Production Hardening | 0/3 | Not started | - |
