# Roadmap: IMA Accelerator V1

## Milestones

- ✅ **v1.0 IMA Accelerator V1** — Phases 1-12 (shipped 2026-03-18)
- ✅ **v1.1 V2 Feature Build** — Phases 13-18 (shipped 2026-03-28)
- ✅ **v1.2 Performance, Scale & Security** — Phases 19-24 (shipped 2026-03-31)
- ✅ **v1.3 Roadmap Update, Session Planner & Coach Controls** — Phases 25-29 (shipped 2026-04-03)
- ✅ **v1.4 Roles, Chat, Resources & Student Deals** — Phases 30-37, 40-43 (shipped 2026-04-07)
- 🚧 **v1.5 Analytics Pages, Coach Dashboard & Deal Logging** — Phases 44-52 (in progress)

> Phases 38–39 were retired during v1.4 scope consolidation. v1.5 continues numbering from Phase 44.

## Phases

<details>
<summary>✅ v1.0 IMA Accelerator V1 (Phases 1-12) — SHIPPED 2026-03-18</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-16
- [x] Phase 2: Authentication & Access (3/3 plans) — completed 2026-03-16
- [x] Phase 3: Student Work Tracker (3/3 plans) — completed 2026-03-16
- [x] Phase 4: Student Roadmap (2/2 plans) — completed 2026-03-16
- [x] Phase 5: Student Daily Reports & AI Chat (3/3 plans) — completed 2026-03-16
- [x] Phase 6: Coach Dashboard & Student Views (2/2 plans) — completed 2026-03-16
- [x] Phase 7: Coach Report Review, Invites & Analytics (4/4 plans) — completed 2026-03-17
- [x] Phase 8: Owner Stats & People Management (4/4 plans) — completed 2026-03-17
- [x] Phase 9: Owner Invites, Assignments & Alerts (5/5 plans) — completed 2026-03-17
- [x] Phase 10: UI Polish & Production Hardening (4/4 plans) — completed 2026-03-17
- [x] Phase 11: Fix Invite Registration URL (3/3 plans) — completed 2026-03-18
- [x] Phase 12: CLAUDE.md Hard Rule Compliance (2/2 plans) — completed 2026-03-18

</details>

<details>
<summary>✅ v1.1 V2 Feature Build (Phases 13-18) — SHIPPED 2026-03-28</summary>

- [x] **Phase 13: Schema & Config Foundation** — completed 2026-03-27
- [x] **Phase 14: Flexible Work Sessions** — completed 2026-03-27
- [x] **Phase 15: Outreach KPI Banner** — completed 2026-03-28
- [x] **Phase 16: Coach/Owner KPI Visibility** — completed 2026-03-28
- [x] **Phase 17: Calendar View** — completed 2026-03-28
- [x] **Phase 18: Roadmap Date KPIs & Completion Logging** — completed 2026-03-28

</details>

<details>
<summary>✅ v1.2 Performance, Scale & Security (Phases 19-24) — SHIPPED 2026-03-31</summary>

- [x] **Phase 19: Database Foundation** — completed 2026-03-29
- [x] **Phase 20: Query Consolidation & Caching** — completed 2026-03-30
- [x] **Phase 21: Write Path & Pre-Aggregation** — completed 2026-03-30
- [x] **Phase 22: Spike Protection & Rate Limiting** — completed 2026-03-30
- [x] **Phase 23: Security Audit** — completed 2026-03-30
- [x] **Phase 24: Infrastructure & Validation** — completed 2026-03-31

</details>

<details>
<summary>✅ v1.3 Roadmap Update, Session Planner & Coach Controls (Phases 25-29) — SHIPPED 2026-04-03</summary>

- [x] **Phase 25: Roadmap Config & Stage Headers** — completed 2026-03-31
- [x] **Phase 26: Database Schema Foundation** — completed 2026-03-31
- [x] **Phase 27: Coach/Owner Roadmap Undo** — completed 2026-03-31
- [x] **Phase 28: Daily Session Planner API** — completed 2026-03-31
- [x] **Phase 29: Daily Session Planner Client** — completed 2026-03-31

</details>

<details>
<summary>✅ v1.4 Roles, Chat, Resources & Student Deals (Phases 30-37, 40-43) — SHIPPED 2026-04-07</summary>

- [x] **Phase 30: Database Migration** — completed 2026-04-03
- [x] **Phase 31: Student_DIY Role** — completed 2026-04-03
- [x] **Phase 32: Skip Tracker** — completed 2026-04-03
- [x] **Phase 33: Coach Assignments** — completed 2026-04-03
- [x] **Phase 34: Report Comments** — completed 2026-04-03
- [x] **Phase 35: Chat System** — completed 2026-04-04
- [x] **Phase 36: Resources Tab** — completed 2026-04-04
- [x] **Phase 37: Invite Link max_uses** — completed 2026-04-04
- [x] **Phase 40: Deals Database Foundation** — completed 2026-04-06
- [x] **Phase 41: Deals API Route Handlers** — completed 2026-04-06
- [x] **Phase 42: Student Deals Pages + Dashboard Stat Cards** — completed 2026-04-07
- [x] **Phase 43: Coach & Owner Deals Tab** — completed 2026-04-07

</details>

**v1.5 Analytics Pages, Coach Dashboard & Deal Logging**

- [ ] **Phase 44: Analytics RPC Foundation & Shared Helpers** — shared `week_start` / `student_activity_status` helpers, ACTIVITY config, hot-path indexes
- [ ] **Phase 45: `deals.logged_by` Migration + API + RLS** — attribution column, audit trigger, dual-layer authorization for coach/owner inserts
- [ ] **Phase 46: Student Analytics Page + Recharts** — `/student/analytics` + `/student_diy/analytics` with 6 KPI cards, 2 charts, paginated deal history
- [ ] **Phase 47: Coach Dashboard Homepage Stats** — 4 stat cards, recent submissions card, weekly top-3 hours leaderboard on `/coach`
- [ ] **Phase 48: Full Coach Analytics Page** — `/coach/analytics` with leaderboards, 12-week deal trend, active/inactive split, paginated student list with search + CSV export
- [ ] **Phase 49: Coach & Owner Deals Logging UI** — Add Deal button on coach/owner deals tab, attribution chip, shared modal reuse
- [x] **Phase 50: Milestone Config** — `MILESTONES` / `MILESTONE_CONFIG` constants; `tech_setup` feature flag pending D-06 (completed 2026-04-13)
- [ ] **Phase 51: Milestone Notifications RPC + Backfill** — 4 new alert types, extended `get_sidebar_badges`, historical pre-dismissal migration
- [ ] **Phase 52: Coach Alerts Page** — `/coach/alerts` grouped feed with dismiss + bulk-dismiss, 9+ badge cap

## Phase Details

### Phase 19: Database Foundation
**Goal**: The database is structurally ready for 5,000 students — indexes on hot paths, RLS policies use initplan optimization, connection pooling is singleton-based, and a query performance baseline is captured
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. EXPLAIN ANALYZE confirms composite indexes on daily_reports(student_id, date), work_sessions(student_id, date, status), and roadmap_progress(student_id) are used by hot query paths (index scans, not seq scans)
  2. All 36 createAdminClient() call sites have been replaced with a module-level getAdminClient() singleton; the admin client is instantiated once per process, not once per request
  3. All RLS policies in current migrations use (SELECT auth.uid()) instead of bare auth.uid(); EXPLAIN on a policy-covered query shows initplan not per-row evaluation
  4. pg_stat_statements is enabled and a baseline of the top 10 slowest queries is captured and recorded before and after the index migration
**Plans:** 2/2 plans complete
Plans:
- [x] 19-01-PLAN.md — Migration SQL (composite index + pg_stat_statements) and admin client singleton conversion
- [x] 19-02-PLAN.md — RLS audit, BASELINE.md scaffold, human applies migration and captures query stats

### Phase 20: Query Consolidation & Caching
**Goal**: The owner dashboard path drops from 8 round trips to ≤2, badge counts are served from a 60-second cache, and all owner list pages are server-side paginated
**Depends on**: Phase 19
**Requirements**: QUERY-01, QUERY-02, QUERY-03, QUERY-04, QUERY-05, QUERY-06

> **HALT GATE**: Do not auto-advance past Phase 20. After plans complete, a human must confirm load test results have been reviewed before Phase 21 begins.

**Success Criteria** (what must be TRUE):
  1. Owner dashboard layout fires ≤2 Postgres round trips (verified by query log); the RPC functions get_sidebar_badges() and get_owner_dashboard_stats() exist and return correct data
  2. Student detail pages (coach and owner views) use an RPC consolidation function that replaces 9-11 parallel queries with a single call
  3. getSessionUser() and data-fetching server functions are wrapped with React cache() so duplicate calls within a single RSC render tree fire only once
  4. Owner sidebar badge counts are served by unstable_cache with a 60-second TTL; the cache is invalidated correctly on mutations
  5. Owner student list page shows 25 students per page with server-side .range() pagination; total count uses count: 'estimated'; URL search params drive page state
  6. Owner coach list page has the same server-side pagination as the student list page
**Plans:** 4/4 plans complete
Plans:
- [x] 20-01-PLAN.md — Migration 00010 (3 RPC functions), RPC types, React cache() on getSessionUser
- [x] 20-02-PLAN.md — Owner dashboard RPC swap, layout.tsx cached badges, badge invalidation in 5 API routes
- [x] 20-03-PLAN.md — Student detail RPC swap (coach + owner pages)
- [x] 20-04-PLAN.md — Server-side pagination on student list and coach list pages

### Phase 21: Write Path & Pre-Aggregation
**Goal**: Nightly KPI aggregations are pre-computed so the owner dashboard reads from a summary table instead of scanning all reports, and report submission shows instant feedback to the student
**Depends on**: Phase 20
**Requirements**: WRITE-01, WRITE-02, WRITE-03
**Success Criteria** (what must be TRUE):
  1. A student_kpi_summaries table exists; a pg_cron job runs at 2 AM UTC (6 AM UAE) and calls refresh_student_kpi_summaries() which upserts per-student KPI aggregates; the function uses pg_try_advisory_lock() to prevent overlapping runs
  2. Student daily report submission updates the UI optimistically via useOptimistic before the API call returns; on API failure, the UI rolls back to server ground truth and the submit button re-enables
  3. A write path audit document records the exact DB call count for report submission and work session complete paths, and confirms no unnecessary round trips exist
**Plans:** 2/2 plans complete
Plans:
- [x] 21-01-PLAN.md — Migration 00011 (student_kpi_summaries table, refresh function, pg_cron job, get_student_detail RPC update)
- [x] 21-02-PLAN.md — Optimistic UI on ReportForm (useOptimistic + startTransition) and write path audit document

### Phase 22: Spike Protection & Rate Limiting
**Goal**: All mutation API routes enforce a 30 requests/minute per-user limit backed by the database, so the limit is consistent across all serverless container instances
**Depends on**: Phase 19
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. A rate_limit_log Supabase table exists with a cleanup pg_cron job; a checkRateLimit() async helper reads and writes to this table using an atomic INSERT + COUNT pattern
  2. All POST/PATCH/DELETE route handlers for work sessions, daily reports, and roadmap progress call checkRateLimit() after auth verification and before Zod validation
  3. A user who exceeds 30 requests/minute receives a 429 response with a Retry-After header; the limit is enforced consistently regardless of which serverless container handles the request
**Plans:** 2/2 plans complete
Plans:
- [x] 22-01-PLAN.md — Migration 00012 (rate_limit_log table, covering index, pg_cron cleanup) and checkRateLimit() helper module
- [x] 22-02-PLAN.md — Integrate checkRateLimit() into all 10 mutation API routes (9 files, 10 endpoints)

### Phase 23: Security Audit
**Goal**: Every API route's auth and ownership checks are verified correct, all mutation handlers have CSRF protection, and cross-student data isolation is confirmed

> **FLAG: requires-human-review** — Do not auto-merge. Surface the full audit report for human approval before applying any changes. This phase produces a report first; changes are applied only after explicit human sign-off.

**Depends on**: Phase 22
**Requirements**: SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Every API route has been audited for the pattern: auth check → role verification → resource ownership check → query; any gaps are documented and fixed
  2. Every POST/PATCH/DELETE route handler verifies the Origin header matches the expected host and returns 403 on mismatch; CSRF protection is not assumed from Next.js (only Server Actions get it automatically)
  3. Cross-student isolation is verified: no student can retrieve another student's data by manipulating route params; every admin-client query that touches student data filters by the authenticated user's ID
**Plans:** 3/3 plans complete
Plans:
- [x] 23-01-PLAN.md — Security audit report: all 12 routes, proxy guard, RLS policies documented with severity-classified findings
- [x] 23-02-PLAN.md — CSRF helper + integration into all mutation routes, reports/[id]/review ownership leak fix (requires human approval of audit report first)
- [x] 23-03-PLAN.md — UAT gap closure: optimistic timer start + hide CycleCard countdown from student view

### Phase 24: Infrastructure & Validation
**Goal**: The platform is validated under realistic 5,000-student load, connection and query capacity headroom is documented, and compute sizing is confirmed or adjusted
**Depends on**: Phase 21, Phase 22, Phase 23
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. A k6 load test runs against a staging environment seeded with 5,000 students and 90 days of reports (~500k rows); the test covers the owner dashboard read mix and the 11 PM write spike scenario; P95 latency and connection counts are recorded
  2. A capacity document records connection usage (must stay below 70% of max_connections during spike), P50/P95/P99 query latencies, and rate limiter trigger counts during the simulated spike
  3. Supabase compute add-on tier is confirmed adequate or upgraded based on load test data; the decision (stay/upgrade + rationale) is written into PROJECT.md Key Decisions
**Plans:** 5/5 plans complete
Plans:
- [x] 24-01-PLAN.md — Seed SQL (5k students, 500k reports), JWT pre-gen script, CAPACITY.md template, .gitignore
- [x] 24-02-PLAN.md — k6 scenario scripts (read-mix, write-spike, combined)
- [x] 24-03-PLAN.md — Load test execution, capacity doc completion, compute sizing decision
- [x] 24-04-PLAN.md — Gap closure: fix owner token format bug + revert premature INFRA requirement markings
- [x] 24-05-PLAN.md — Gap closure: provision staging, execute k6 tests, update capacity docs with measured data

### Phase 25: Roadmap Config & Stage Headers
**Goal**: Students and coaches see accurate, stage-grouped roadmap steps with correct descriptions, unlock URLs, and completion targets
**Depends on**: Phase 24
**Requirements**: ROAD-01, ROAD-02, ROAD-03, ROAD-04, ROAD-05, ROAD-06
**Success Criteria** (what must be TRUE):
  1. All 8 active roadmap steps (1-8) display parenthetical time guidance appended to their descriptions in the student view
  2. Step 5 shows the skool CRM link as its unlock URL; step 6 has no unlock URL
  3. Step 6 description reads "Build 100 Influencer Lead List, and Watch 3 Influencer Roast My Email"; step 7 description reflects drafting emails only
  4. Step 8 displays a 14-day target and the deadline chip responds correctly to that target
  5. Student roadmap page groups steps under three visible stage headers: Setup & Preparation, Influencer Outreach, Brand Outreach
  6. Coach and owner roadmap tab shows the same three stage headers grouping the same step ranges
**Plans:** 2/2 plans complete
Plans:
- [x] 25-01-PLAN.md — Config updates (descriptions, URLs, target_days) and student RoadmapClient stage headers
- [x] 25-02-PLAN.md — Coach/owner RoadmapTab stage headers
**UI hint**: yes

### Phase 26: Database Schema Foundation
**Goal**: The daily_plans and roadmap_undo_log tables exist in the database with correct constraints, indexes, and RLS policies, unblocking all v1.3 API work
**Depends on**: Phase 25
**Requirements**: PLAN-07, UNDO-05
**Success Criteria** (what must be TRUE):
  1. The daily_plans table exists with columns: id, student_id, date (DEFAULT CURRENT_DATE), plan_json (JSONB), created_at; a UNIQUE(student_id, date) constraint prevents duplicate plans per day
  2. The roadmap_undo_log table exists with columns: id, actor_id, actor_role, student_id, step_number, undone_at; it is append-only with no UPDATE/DELETE RLS policy
  3. Both tables have RLS enabled; daily_plans uses (SELECT auth.uid()) initplan pattern on student_id; roadmap_undo_log allows INSERT for coach/owner roles and SELECT for actors on their own rows
  4. The daily_plans table has an index on (student_id, date) to support the 5k inserts/day hot query path
**Plans:** 1/1 plans complete
Plans:
- [x] 26-01-PLAN.md — Migration 00013 (daily_plans + roadmap_undo_log tables, indexes, RLS policies) and deployment verification

### Phase 27: Coach/Owner Roadmap Undo
**Goal**: Coaches and owners can revert any completed roadmap step to active, with a confirmation dialog, sequential-progression enforcement, and a permanent audit trail
**Depends on**: Phase 26
**Requirements**: UNDO-01, UNDO-02, UNDO-03, UNDO-04
**Success Criteria** (what must be TRUE):
  1. A completed roadmap step in the coach or owner roadmap tab shows an undo button; clicking it opens a confirmation dialog reading "Are you sure you want to reset Step X back to active?"
  2. After confirming, the step reverts from completed to active and the roadmap tab re-renders showing the step as in-progress; no page reload required
  3. If step N+1 was active (not yet completed) at the time step N was undone, step N+1 is locked back to its pre-active state in the same server request
  4. A coach can only undo steps for students assigned to them; an owner can undo steps for any student; attempting to undo an unassigned student's step returns 403
  5. Every undo action is visible in the roadmap_undo_log table with the actor's ID, role, target student, step number, and timestamp
**Plans:** 2/2 plans complete
Plans:
- [x] 27-01-PLAN.md — PATCH /api/roadmap/undo route with auth, cascade re-lock, and audit logging
- [x] 27-02-PLAN.md — RoadmapTab undo button + confirmation modal, studentId prop thread from parent components
**UI hint**: yes

### Phase 28: Daily Session Planner API
**Goal**: The daily plans API is live with server-enforced 4-hour cap, idempotent plan creation, and the existing work-sessions endpoint enforces the cap when a plan exists
**Depends on**: Phase 26
**Requirements**: PLAN-08, PLAN-09
**Success Criteria** (what must be TRUE):
  1. POST /api/daily-plans accepts a plan_json payload, validates total_work_minutes <= 240 server-side via Zod, stores the plan, and returns the created plan; submitting a second plan for the same day returns the existing plan (idempotent, no duplicate insert)
  2. GET /api/daily-plans returns today's plan for the authenticated student, or null if no plan exists; the date comparison uses UTC to match the daily_plans.date column default
  3. POST /api/work-sessions checks the student's total planned minutes and actual minutes worked today when a daily plan exists; a request that would exceed 4 hours of work time returns 400 with a clear cap-exceeded message
  4. Both endpoints enforce the full CSRF → auth → role → rate-limit → Zod → admin client chain; plan_json is always read back through Zod safeParse, never TypeScript cast
**Plans:** 3/3 plans complete
Plans:
- [x] 28-01-PLAN.md — Zod plan_json schema module + POST/GET /api/daily-plans route (idempotent create, today's plan retrieval)
- [x] 28-02-PLAN.md — Plan-aware cap enforcement in POST /api/work-sessions (no-plan block, minute cap, fulfilled bypass)
- [x] 28-03-PLAN.md — Gap closure: fix WorkTrackerClient error handling to show server errors via toast

### Phase 29: Daily Session Planner Client
**Goal**: Students see a pre-session planner on their first visit each day, execute planned sessions sequentially via WorkTracker, and receive a motivational completion card with access to ad-hoc sessions afterward
**Depends on**: Phase 28
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-10, COMP-01, COMP-02, COMP-03, COMP-04
**Success Criteria** (what must be TRUE):
  1. On first visit to Work Tracker with no plan for today, a planner UI appears where the student can add sessions (30/45/60 min), see running work-time total (breaks excluded), and confirm when total is at or below 4 hours
  2. Break types auto-assign without student input: odd-numbered sessions (1st, 3rd, 5th) get a short break (5 or 10 min choice), even sessions (2nd, 4th, 6th) get a long break (15/20/25/30 min choice), and the last session has no break
  3. The confirm button is disabled until the planned total reaches exactly 4h or the nearest valid total at or below 4h; the student cannot add sessions that would push the total above 4 hours
  4. After confirming, the planner disappears and WorkTracker executes the planned sessions in sequence; the phase-reset useEffect guard preserves plan-mode state across page refreshes
  5. After all planned sessions complete, a motivational card appears showing Arabic and English text; the card shows once per day
  6. The card offers "Start Next Session" (opens ad-hoc duration picker) and "Dismiss" (returns to work tracker idle); ad-hoc sessions allow free duration and break type selection with no daily cap
**Plans:** 3/3 plans complete
Plans:
- [x] 29-01-PLAN.md — Server-side plan fetch in page.tsx + PlannerUI session builder component
- [x] 29-02-PLAN.md — WorkTrackerClient plan-mode integration with PlannedSessionList and handleStartWithConfig
- [x] 29-03-PLAN.md — MotivationalCard post-completion + ad-hoc mode wiring
**UI hint**: yes

### Phase 30: Database Migration
**Goal**: The database is ready for all v1.4 features — 4 new tables created, role constraints expanded to include student_diy, RLS policies written, and TypeScript types updated
**Depends on**: Phase 29
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04
**Success Criteria** (what must be TRUE):
  1. Migration 00015 executes cleanly and creates report_comments, messages, resources, and glossary_terms tables with correct columns, foreign keys, and indexes
  2. The users, invites, and magic_links role CHECK constraints all accept 'student_diy' as a valid value without rejecting existing 'owner', 'coach', or 'student' values
  3. RLS is enabled on all 4 new tables with policies that restrict reads and writes to appropriate roles; student_diy-specific policies are included in the same migration
  4. TypeScript types file includes Row/Insert/Update types for all 4 new tables and the Role union type reads `'owner' | 'coach' | 'student' | 'student_diy'`
**Plans**: 1 plan
Plans:
- [x] 30-01-PLAN.md — Migration 00015 (4 new tables, role CHECK ALTERs, RLS policies, indexes, triggers) and TypeScript types update

### Phase 31: Student_DIY Role
**Goal**: The student_diy role is fully wired across all 8 integration points — users can register, be routed correctly, and access only the three permitted features
**Depends on**: Phase 30
**Requirements**: ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05, ROLE-06, ROLE-07
**Success Criteria** (what must be TRUE):
  1. A user invited with a student_diy invite link completes Google OAuth registration and is assigned role 'student_diy' in the users table; no other role is assigned
  2. After login, a student_diy user is immediately redirected to /student_diy/dashboard with no redirect loop or blank screen; all other roles continue routing correctly
  3. The student_diy sidebar renders exactly 3 navigation items — Dashboard, Work Tracker, and Roadmap — with no other items visible regardless of URL manipulation
  4. Work Tracker and Roadmap pages function identically for student_diy as for student; no regressions in session start/complete/abandon or roadmap step progression
  5. Navigating directly to /student_diy/report, /student_diy/chat, or /student_diy/resources redirects to the dashboard with a 403 or equivalent guard response
  6. Owner and coach invite creation forms include student_diy as a selectable role option; created invites insert with role = 'student_diy'
**Plans**: 3 plans
Plans:
- [x] 31-01-PLAN.md — Config + proxy + auth callback atomic expansion (8 integration points)
- [x] 31-02-PLAN.md — Student_DIY route group (dashboard, work tracker, roadmap pages)
- [x] 31-03-PLAN.md — Invite surface (API Zod schemas, coach guards, frontend dropdowns)
**UI hint**: yes

### Phase 32: Skip Tracker
**Goal**: Coaches and owners can see at a glance how many days each student has skipped this week, enabling proactive intervention
**Depends on**: Phase 30
**Requirements**: SKIP-01, SKIP-02, SKIP-03, SKIP-04, SKIP-05
**Success Criteria** (what must be TRUE):
  1. Every student card on the coach dashboard shows a "X skipped" badge where X is the count of days (Mon-Sun of the current ISO week, all 7 days per D-01) with zero completed work sessions AND zero submitted reports, counting only past days and today
  2. The skip count resets to 0 on Monday morning — a student with 3 skips on Friday shows 0 skips the following Monday
  3. The skip badge correctly reflects today as a skip day only after the day has passed without activity; it does not count future weekdays in the current week
  4. Owner student list and student detail views display the same skip count badge using the same computation as the coach view
  5. The skip count is computed by a Postgres RPC function (get_student_skip_count or equivalent) that accepts a p_today DATE parameter; the application passes getTodayUTC() as that parameter, never relying on CURRENT_DATE inside the function
**Plans**: 2 plans
Plans:
- [x] 32-01-PLAN.md — Migration 00016 (get_weekly_skip_counts RPC) + coach dashboard integration with skip badge on StudentCard
- [x] 32-02-PLAN.md — Owner students list skip badge + owner student detail skip count display
**UI hint**: yes

### Phase 33: Coach Assignments
**Goal**: Coaches can assign, reassign, and unassign students independently — same power as owner — without exposing cross-platform student data
**Depends on**: Phase 30
**Requirements**: ASSIGN-01, ASSIGN-02, ASSIGN-03, ASSIGN-04, ASSIGN-05, ASSIGN-06
**Success Criteria** (what must be TRUE):
  1. A coach can navigate to /coach/assignments and see all unassigned students plus their own currently-assigned students in a searchable list
  2. A coach can assign an unassigned student to any active coach (including themselves) and the student's coach_id updates immediately in the UI without page reload
  3. A coach can reassign one of their own students to a different coach; the student disappears from the coach's list and appears under the target coach
  4. A coach can unassign a student (set coach_id to null); the student moves to the unassigned pool
  5. A student or student_diy user attempting to call the assignment API receives a 403 response; the assignment API does not modify the coach view for owner (ASSIGN-06)
**Plans**: 2 plans
Plans:
- [x] 33-01-PLAN.md — Config registration (ROUTES + NAVIGATION) and API role guard expansion (owner+coach)
- [x] 33-02-PLAN.md — Coach assignments server page and CoachAssignmentsClient component
**UI hint**: yes

### Phase 34: Report Comments
**Goal**: Coaches can leave a single comment on any of their students' daily reports; students see the feedback inline on their report history
**Depends on**: Phase 30
**Requirements**: COMMENT-01, COMMENT-02, COMMENT-03, COMMENT-04, COMMENT-05
**Success Criteria** (what must be TRUE):
  1. A coach viewing a student's daily report sees a comment textarea (max 1000 chars) and a Save button; submitting creates or updates the single comment for that report (upsert — no duplicates)
  2. Resubmitting a comment on the same report replaces the existing comment rather than creating a second one; the report_comments table never has more than one row per report_id
  3. A student viewing their report history sees a read-only "Coach feedback" card below each report that has a comment; reports without comments show nothing
  4. An owner can comment on any student's report using the same textarea and Save button visible on the coach view
  5. A student or student_diy calling POST /api/reports/[id]/comment receives a 403; the API performs a two-step ownership check (fetch report → verify student.coach_id matches requesting coach) before writing, matching the v1.2 Phase 23 pattern
**Plans**: 2 plans
Plans:
- [x] 34-01-PLAN.md — Comment API endpoint + CommentForm + CoachFeedbackCard components
- [ ] 34-02-PLAN.md — Wire CommentForm into coach/owner views + student history feedback display
**UI hint**: yes

### Phase 35: Chat System
**Goal**: Coaches and students can exchange messages in 1:1 conversations and coaches can broadcast to all assigned students, with messages appearing within 5 seconds via polling
**Depends on**: Phase 31
**Requirements**: CHAT-01..CHAT-13
**Success Criteria** (what must be TRUE):
  1. A coach sees a conversation list at /coach/chat showing all assigned students with the last message preview, relative timestamp, and an unread indicator dot for conversations with unread messages
  2. Opening a conversation loads message history in WhatsApp-style bubbles; the view auto-scrolls to the newest message on open and on each new incoming message
  3. A message sent by a coach appears in the student's conversation within 5 seconds and vice versa; the polling interval does not call checkRateLimit()
  4. A coach can send a broadcast message that delivers to all assigned students as a distinct card with a megaphone icon
  5. The sidebar shows an unread message badge count for coach and student roles; student_diy has no chat navigation item
  6. Scrolling to the top of a conversation loads older messages via cursor-based pagination without losing the current scroll position
  7. The chat composer enforces a 2000-character limit with a visible remaining-character counter
**Plans**: 4 plans
Plans:
- [x] 35-01-PLAN.md — API routes (GET/POST/PATCH) + usePolling hook + chat utilities
- [x] 35-02-PLAN.md — Navigation config + badge migration (00017) + layout wiring
- [x] 35-03-PLAN.md — Chat UI components + coach chat page (split panel + mobile toggle)
- [x] 35-04-PLAN.md — Student chat page (single thread view with polling)
**UI hint**: yes

### Phase 36: Resources Tab
**Goal**: Owners, coaches, and students have a unified Resources tab with curated links, an embedded Discord community, and a searchable glossary; student_diy cannot access it
**Depends on**: Phase 31
**Requirements**: RES-01..RES-09
**Success Criteria** (what must be TRUE):
  1. Owner, coach, and student sidebars show a "Resources" navigation item; student_diy sidebar does not show it
  2. The Resources page has three tabs — Links, Community, Glossary — controlled by React state
  3. Owner and coach can add resource links and delete them; students see the same list in read-only mode
  4. The Community tab renders a Discord WidgetBot iframe with the configured guild and channel; CSP header includes `frame-src 'self' https://e.widgetbot.io`
  5. Owner and coach can add, edit, and delete glossary terms; all eligible roles can search terms
  6. The glossary_terms table enforces a case-insensitive unique constraint on term name
**Plans**: 3 plans
Plans:
- [x] 36-01-PLAN.md — Foundation: migration, types, CSP header, nav config
- [x] 36-02-PLAN.md — API routes: /api/resources + /api/glossary
- [x] 36-03-PLAN.md — UI: ResourcesClient components + 3 page files
**UI hint**: yes

### Phase 37: Invite Link max_uses
**Goal**: Magic link invites default to 10 uses and display a live usage count; registration via an exhausted link is rejected
**Depends on**: Phase 30
**Requirements**: INVITE-01, INVITE-02, INVITE-03
**Success Criteria** (what must be TRUE):
  1. Creating a new magic link without specifying max_uses produces a link with max_uses = 10; existing null-max_uses rows are grandfathered
  2. Each magic link card on the invite management page displays "X / Y used" where X is use_count and Y is max_uses
  3. A user attempting to register via a magic link where use_count >= max_uses receives a clear rejection response
**Plans**: 2 plans
Plans:
- [x] 37-01-PLAN.md — Migration 00019 (DEFAULT 10 on max_uses) + POST route Zod schema consolidation
- [x] 37-02-PLAN.md — Max uses number input + "X / Y used" display format on coach + owner invite pages

### Phase 40: Deals Database Foundation
**Goal**: The deals table exists in the database with correct schema, constraints, indexes, RLS policies, and TypeScript types, unblocking all deals API and UI work
**Depends on**: Phase 37
**Success Criteria** (what must be TRUE):
  1. Migration 00021_deals.sql creates the deals table with columns: id, student_id, deal_number, revenue, profit, created_at, updated_at
  2. RLS is enabled with policies restricting students to their own deals; admin client bypasses RLS for coach/owner queries
  3. TypeScript types.ts includes Deal Row/Insert/Update types matching the migration schema
**Plans**: 1/1 plans complete
Plans:
- [x] 40-01-PLAN.md — Migration 00021_deals.sql + Deal types in types.ts

### Phase 41: Deals API Route Handlers
**Goal**: Full CRUD API for deals is live with auth, CSRF, rate limiting, and Zod validation on all endpoints
**Depends on**: Phase 40
**Success Criteria** (what must be TRUE):
  1. POST /api/deals creates a deal for the authenticated student with Zod-validated revenue/profit
  2. GET /api/deals returns deals for the authenticated student sorted by created_at DESC
  3. PATCH /api/deals/[id] updates revenue/profit with ownership verification; DELETE /api/deals/[id] removes the deal with ownership verification
  4. All endpoints enforce the full CSRF > auth > role > rate-limit > Zod > admin client chain
**Plans**: 1/1 plans complete

### Phase 42: Student Deals Pages + Dashboard Stat Cards
**Goal**: Students and student_diy users can add, view, edit, and delete deals; dashboards show 3 new stat cards
**Depends on**: Phase 41
**Success Criteria** (what must be TRUE):
  1. DealsClient + DealFormModal let students create/edit/delete deals with useOptimistic feedback
  2. Both /student/deals and /student_diy/deals routes render DealsClient
  3. Student + student_diy dashboards display Deals Closed, Total Revenue, Total Profit stat cards
**Plans**: 2/2 plans complete
**UI hint**: yes

### Phase 43: Coach & Owner Deals Tab
**Goal**: Coaches and owners can view a student's deals from a new "Deals" tab on student detail pages
**Depends on**: Phase 42
**Success Criteria** (what must be TRUE):
  1. Coach and owner student detail pages have a "Deals" tab next to Calendar and Roadmap
  2. The Deals tab displays the student's deals in a read-only table with deal #, revenue, profit, margin %, and date
  3. A summary row shows totals for deals, revenue, profit across the student's deals
**Plans**: 1/1 plans complete
**UI hint**: yes

### Phase 44: Analytics RPC Foundation & Shared Helpers
**Goal**: Database and shared TypeScript helpers are ready for every v1.5 analytics consumer — week-start math, activity-status rules, ACTIVITY config, and hot-path indexes are all in place before any feature RPC is written
**Depends on**: Phase 43
**Requirements**: PERF-01, PERF-03, PERF-04 (PERF-02, 05, 06, 07, 08 apply cross-cuttingly from Phase 44 onward — enforced in every subsequent phase's acceptance criteria)
**Success Criteria** (what must be TRUE):
  1. A shared SQL helper `week_start(p_today date)` returns the Monday of the given date's ISO week; unit-tested against Sunday/Monday/mid-week inputs; reused by skip tracker, leaderboard, and trend buckets
  2. A shared SQL helper `student_activity_status(student_id, p_today)` returns `'active' | 'inactive'` where inactive = no completed work session AND no submitted report in the last 7 days (D-14)
  3. `ACTIVITY` config block (`inactiveAfterDays: 7`) exists in `src/lib/config.ts` with SYNC comments mirroring the SQL helper
  4. Migration 00022 (or follow-up) creates `idx_deals_student_created`, `idx_work_sessions_completed_student_date` (partial WHERE status='completed'), `idx_roadmap_progress_student_status`; EXPLAIN ANALYZE on representative queries shows index scans, not seq scans
  5. `(SELECT auth.uid())` initplan pattern is the only RLS auth-check form used anywhere in the new migration (no bare `auth.uid()`)
  6. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD

### Phase 45: `deals.logged_by` Migration + API + RLS
**Goal**: Deals carry creator attribution, audit columns, and dual-layer authorization so that a coach or owner can insert a deal for an assigned student without ever touching another coach's students
**Depends on**: Phase 44
**Requirements**: DEALS-01, DEALS-02, DEALS-03, DEALS-04, DEALS-05, DEALS-06, DEALS-11
**Success Criteria** (what must be TRUE):
  1. Migration 00022 adds `logged_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL` (after backfill `logged_by = student_id`), plus `updated_at TIMESTAMPTZ` and `updated_by UUID` with a trigger that sets both on every UPDATE
  2. A composite unique index `(student_id, deal_number)` exists; concurrent coach+student inserts that would collide retry with `deal_number+1` on 23505 conflict and both succeed
  3. A coach calling POST /api/deals with a student_id they are NOT assigned to receives 403 from the route handler AND the RLS `WITH CHECK` would also reject (dual-layer); a negative E2E test documents both layers
  4. A student calling POST /api/deals with `logged_by` set to another user receives 403; student self-insert with `logged_by = self` continues to succeed
  5. An owner can insert a deal for any student; `logged_by` is set to the owner's user_id; `student_id` is set to the viewed student
  6. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD

### Phase 46: Student Analytics Page + Recharts
**Goal**: A student (or student_diy user) can open a new Analytics page and see their lifetime KPIs, outreach and hours trends over a chosen time window, their deal history, and roadmap deadline status — all from a single cached RPC, all keyboard-accessible
**Depends on**: Phase 45
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06, ANALYTICS-07, ANALYTICS-08, ANALYTICS-09, ANALYTICS-10
**Success Criteria** (what must be TRUE):
  1. A student navigates to `/student/analytics` (and a student_diy to `/student_diy/analytics`) via a new sidebar nav item and sees 6 lifetime KPI cards (Hours, Emails, Influencers, Deals, Revenue, Profit) plus a streak indicator, rendered by a single batch `get_student_analytics` RPC scoped to the authenticated student
  2. The page shows a weekly outreach trend chart splitting brands-sent vs influencers-sent AND an hours-worked trend chart, both responding to a time-range selector (7d / 30d / 90d / All, default 30d)
  3. The deal history table is paginated 25/page with deal #, revenue, profit, margin %, logged date, attribution chip (self / coach / owner); summary totals show deals, revenue, profit
  4. Roadmap progress vs deadlines shows per-step status (on-track / due-soon / overdue / completed) using the existing `getDeadlineStatus()` utility — no duplicated logic
  5. All aggregation happens server-side in a `SECURITY DEFINER STABLE` RPC wrapped in `unstable_cache` 60s TTL with tag `analytics-student-${id}`; report/session/deal/roadmap mutation routes call `revalidateTag` for the same tag; a grep of analytics page files shows zero `.from(` calls
  6. Every chart is keyboard-accessible (`tabIndex={0}`), wrapped in `<div role="img" aria-label="...">` with a prose summary, and has a `<details><summary>View data table</summary>` fallback; animations use `motion-safe:`; all interactive elements meet 44px touch target
  7. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD
**UI hint**: yes

### Phase 47: Coach Dashboard Homepage Stats
**Goal**: A coach opening `/coach` sees a quick-scan performance snapshot of their assigned students — 4 KPI cards, 3 most-recent reports, and a weekly top-3 hours leaderboard — served from one batch RPC and one cache tag, so the page loads under one second at 5k scale
**Depends on**: Phase 44
**Requirements**: COACH-DASH-01, COACH-DASH-02, COACH-DASH-03, COACH-DASH-04, COACH-DASH-05, COACH-DASH-06, COACH-DASH-07
**Success Criteria** (what must be TRUE):
  1. A coach lands on `/coach` and sees 4 stat cards — Total Deals Closed, Total Revenue Generated, Average Roadmap Step, Total Emails Sent — each computed across the coach's assigned students only, each 44px-tap-target clickable into `/coach/analytics` with the relevant metric scrolled into view
  2. A "Recent Submissions" card shows the 3 most recent daily reports from assigned students with a "See All" link to the reports page
  3. A "Top 3 Students This Week" leaderboard ranks by hours worked during the current ISO week (Monday 00:00 → Sunday 23:59, computed via the shared `week_start` helper from Phase 44) and resets every Monday
  4. A single batch RPC `get_coach_dashboard(p_coach_id, p_week_start, p_today)` returns `{stats, recent_reports, top_hours_week}` in one JSONB envelope; scoped via `coach_id` JOIN so the coach never sees data for non-assigned students
  5. Result is wrapped in `unstable_cache` 60s TTL keyed `coach-dashboard-${coachId}`; assigned-student deal/report/session writes call `revalidateTag` for the same key
  6. Loading skeletons display while stats load; empty state renders when the coach has 0 assigned students
  7. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD
**UI hint**: yes

### Phase 48: Full Coach Analytics Page
**Goal**: A coach can drill into `/coach/analytics` and answer every leaderboard/trend/search/export question about their assigned students from one paginated page served by one RPC, with CSV export for offline review
**Depends on**: Phase 47
**Requirements**: COACH-ANALYTICS-01, COACH-ANALYTICS-02, COACH-ANALYTICS-03, COACH-ANALYTICS-04, COACH-ANALYTICS-05, COACH-ANALYTICS-06, COACH-ANALYTICS-07
**Success Criteria** (what must be TRUE):
  1. `/coach/analytics` shows aggregate stats — Highest Deals Closed, Total Revenue Generated, Average Roadmap Step, Average Email Count, Most Emails Sent — computed across assigned students only
  2. Three top-5 leaderboards render: hours this week (Mon-Sun), emails this week, all-time deals closed
  3. A "Deals Closed Over Time" chart shows weekly buckets for the last 12 weeks; an Active vs Inactive header uses the 7-day rule from Phase 44's `student_activity_status` helper (D-14)
  4. A paginated student list (25/page, Zod-validated `page`/`pageSize` + sort params for name, hours, emails, deals, roadmap step, last active) with name search that hits the server (no client-side filter over partial results) — URL search params drive state
  5. A CSV export endpoint downloads the current filter/search view as CSV scoped to assigned students only
  6. One batch RPC `get_coach_analytics(p_coach_id, p_window_days, p_today, p_leaderboard_limit, p_page, p_page_size, p_sort, p_search)` returns a paginated envelope; wrapped in `unstable_cache` 60s TTL with tag `coach-analytics-${coachId}`; mutations revalidate the tag
  7. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD
**UI hint**: yes

### Phase 49: Coach & Owner Deals Logging UI
**Goal**: A coach on the student-detail Deals tab can click "Add Deal", fill the same modal the student uses, and the resulting deal is attributed back to the coach in every table — UI ships only after Phase 45 authorization is verified so a coach can never log a deal for an unassigned student
**Depends on**: Phase 45, Phase 43
**Requirements**: DEALS-07, DEALS-08, DEALS-09, DEALS-10
**Success Criteria** (what must be TRUE):
  1. An "Add Deal" button appears on the coach student-detail Deals tab (44px touch target) and opens the same modal used for student deal creation — revenue + profit inputs, shared component, zero UI duplication
  2. An equivalent "Add Deal" button appears on the owner student-detail Deals tab with identical behavior
  3. Creating a deal as coach or owner sets `logged_by` to the creator's user_id and `student_id` to the viewed student; `deal_number` auto-increments; the new row appears in all three role views (student, coach, owner) within one cache TTL
  4. Every deals table (student's own, coach's view, owner's view, analytics history) shows an attribution chip per row: "You" for self-logged, coach name for coach-logged, "Owner: {name}" for owner-logged — gated by a shared `formatDealLoggedBy(deal, viewerRole, viewerId)` helper
  5. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans**: TBD
**UI hint**: yes

### Phase 50: Milestone Config
**Goal**: The roadmap-step references and alert-key namespaces for the 4 new milestone notifications exist in `src/lib/config.ts` as constants so Phase 51's RPC can reference named values — not magic numbers — while the Tech/Email Setup step stays behind a feature flag until Abu Lahya confirms D-06
**Depends on**: Phase 44
**Requirements**: NOTIF-01 (placeholder only — full activation in Phase 51 pending D-06)
**Success Criteria** (what must be TRUE):
  1. `MILESTONE_CONFIG` exists in `src/lib/config.ts` with fields `techSetupStep` (nullable/feature-flagged), `influencersClosedStep: 11`, `brandResponseStep: 13`
  2. `MILESTONES` alert-key namespace constants exist: `milestone_tech_setup`, `milestone_5_influencers`, `milestone_brand_response`, `milestone_closed_deal` (the last includes `deal_id` in the composed key per D-07)
  3. SYNC comments match the 00014 style, so when the Phase 51 RPC is written it can reference the config as the single source of truth
  4. A feature flag (constant or env check) disables `milestone_tech_setup` evaluation until D-06 resolves; code path is wired but no notifications fire
  5. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans:** 1/1 plans complete
Plans:
- [x] 50-01-PLAN-milestone-config.md — Append MILESTONE_CONFIG + MILESTONES composers + MILESTONE_FEATURE_FLAGS + SYNC comments to src/lib/config.ts (D-06 gated, D-07 per-deal key)

> **Blocker note**: Phase 50 can ship with placeholder values. **Phase 51 cannot execute the Tech/Email Setup trigger until D-06 is resolved at the Monday stakeholder meeting.** The other 3 milestone triggers (NOTIF-02/03/04) are unblocked.

### Phase 51: Milestone Notifications RPC + Backfill
**Goal**: Coaches receive a visible notification exactly once for each qualifying event across assigned students — Tech/Email Setup Finished, 5 Influencers Closed (Step 11), First Brand Response (Step 13), and every Closed Deal — without a flood of retroactive alerts on rollout, and with the sidebar badge as the single source of truth
**Depends on**: Phase 45, Phase 50
**Requirements**: NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, NOTIF-10, NOTIF-11 (NOTIF-01 Tech/Email Setup trigger activates only after D-06 Monday confirmation)
**Success Criteria** (what must be TRUE):
  1. A coach sees a notification when any assigned student reaches Roadmap Step 11 (5 Influencers Closed), Step 13 (First Brand Response), or closes any new deal — including coach-logged and owner-logged deals (D-07, D-16)
  2. Each notification fires exactly once per qualifying event: idempotency enforced by alert_key shape — one-shot keys `milestone_{type}:{student_id}` for Step 11 / Step 13 / Tech Setup; per-deal key `milestone_closed_deal:{student_id}:{deal_id}` so a high-performer's second deal still fires
  3. Migration 00025 pre-dismisses every historical qualifying event at rollout time — a backfill INSERT into `alert_dismissals` for every already-completed Step 11, Step 13, and already-closed deal — so coaches are not flooded with retroactive alerts on first load; a unit test confirms the RPC returns zero new notifications immediately after migration
  4. The existing 100+ hrs / 45 days coach alert (260401-cwd) continues to work unchanged; new milestones reuse the same `alert_dismissals` pattern, not a new notifications table (D-08)
  5. `get_sidebar_badges` coach branch returns one combined count that includes 100h + 4 new milestones; clicking a notification navigates to the student detail page
  6. `get_coach_milestones(p_coach_id, p_today)` is wrapped in `unstable_cache` 60s TTL with tag `coach-milestones-${coachId}`; POST /api/deals, POST /api/reports, and roadmap-step completion routes call `revalidateTag` for that tag
  7. Performance: at 5k students / 50 per coach × 4 milestone types = ~200 predicate evaluations per dashboard view, all index-backed (Phase 44 indexes); P95 under 1s confirmed
  8. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors

> **Blocker**: D-06 (Tech/Email Setup roadmap step reference) must resolve at the Monday stakeholder meeting before NOTIF-01 can be activated. All other triggers (NOTIF-02/03/04) ship in this phase regardless.

**Plans:** 1/2 plans executed

Plans:
- [x] 51-01-PLAN.md — Migration 00027: get_coach_milestones + backfill + get_sidebar_badges rewrite (atomic SQL + embedded asserts)
- [ ] 51-02-PLAN.md — TS wrapper (fetch/cache 60s) + revalidateTag fan-out in deals/reports/roadmap + sidebar types drift fix

### Phase 52: Coach Alerts Page
**Goal**: A coach can review every active milestone notification in one place at `/coach/alerts`, dismiss them individually or in bulk, and see the sidebar badge cap at "9+" so a burst of closed-deal notifications never clutters the UI
**Depends on**: Phase 51
**Requirements**: NOTIF-09
**Success Criteria** (what must be TRUE):
  1. A coach navigates to `/coach/alerts` and sees a grouped-by-student feed showing every active (not-yet-dismissed) milestone notification with the student name, milestone type, and timestamp
  2. Each row has a Dismiss action (44px touch target) that writes to `alert_dismissals` and removes the row optimistically; a "Bulk dismiss" action at the top of a student group dismisses all notifications for that student in one server round trip
  3. The sidebar badge shows "9+" whenever the active count is 10 or more, preventing UI clutter when a single high-performer closes many deals in one week
  4. Loading skeletons display while the feed loads; empty state renders when the coach has zero active notifications
  5. Post-phase gate passes: `npm run lint && npx tsc --noEmit && npm run build` with zero errors
**Plans:** 2 plans
Plans:
- [ ] 52-01-PLAN.md — Shared alerts-types module, dismiss-route coach-milestones revalidation, and Sidebar 9+ badge cap
- [ ] 52-02-PLAN.md — Rewrite coach/alerts page.tsx + CoachAlertsClient.tsx: merged 100h + milestone RPC feed, grouped-by-student UI, per-row and bulk dismiss with Promise.allSettled
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-16 |
| 2. Authentication & Access | v1.0 | 3/3 | Complete | 2026-03-16 |
| 3. Student Work Tracker | v1.0 | 3/3 | Complete | 2026-03-16 |
| 4. Student Roadmap | v1.0 | 2/2 | Complete | 2026-03-16 |
| 5. Student Daily Reports & AI Chat | v1.0 | 3/3 | Complete | 2026-03-16 |
| 6. Coach Dashboard & Student Views | v1.0 | 2/2 | Complete | 2026-03-16 |
| 7. Coach Report Review, Invites & Analytics | v1.0 | 4/4 | Complete | 2026-03-17 |
| 8. Owner Stats & People Management | v1.0 | 4/4 | Complete | 2026-03-17 |
| 9. Owner Invites, Assignments & Alerts | v1.0 | 5/5 | Complete | 2026-03-17 |
| 10. UI Polish & Production Hardening | v1.0 | 4/4 | Complete | 2026-03-17 |
| 11. Fix Invite Registration URL | v1.0 | 3/3 | Complete | 2026-03-18 |
| 12. CLAUDE.md Hard Rule Compliance | v1.0 | 2/2 | Complete | 2026-03-18 |
| 13. Schema & Config Foundation | v1.1 | 2/2 | Complete | 2026-03-27 |
| 14. Flexible Work Sessions | v1.1 | 3/3 | Complete | 2026-03-27 |
| 15. Outreach KPI Banner | v1.1 | 2/2 | Complete | 2026-03-28 |
| 16. Coach/Owner KPI Visibility | v1.1 | 4/4 | Complete | 2026-03-28 |
| 17. Calendar View | v1.1 | 3/3 | Complete | 2026-03-28 |
| 18. Roadmap Date KPIs & Completion Logging | v1.1 | 2/2 | Complete | 2026-03-28 |
| 19. Database Foundation | v1.2 | 2/2 | Complete | 2026-03-29 |
| 20. Query Consolidation & Caching | v1.2 | 4/4 | Complete | 2026-03-30 |
| 21. Write Path & Pre-Aggregation | v1.2 | 2/2 | Complete | 2026-03-30 |
| 22. Spike Protection & Rate Limiting | v1.2 | 2/2 | Complete | 2026-03-30 |
| 23. Security Audit | v1.2 | 3/3 | Complete | 2026-03-30 |
| 24. Infrastructure & Validation | v1.2 | 5/5 | Complete | 2026-03-31 |
| 25. Roadmap Config & Stage Headers | v1.3 | 2/2 | Complete | 2026-03-31 |
| 26. Database Schema Foundation | v1.3 | 1/1 | Complete | 2026-03-31 |
| 27. Coach/Owner Roadmap Undo | v1.3 | 2/2 | Complete | 2026-03-31 |
| 28. Daily Session Planner API | v1.3 | 3/3 | Complete | 2026-03-31 |
| 29. Daily Session Planner Client | v1.3 | 3/3 | Complete | 2026-03-31 |
| 30. Database Migration | v1.4 | 1/1 | Complete | 2026-04-03 |
| 31. Student_DIY Role | v1.4 | 3/3 | Complete | 2026-04-03 |
| 32. Skip Tracker | v1.4 | 2/2 | Complete | 2026-04-03 |
| 33. Coach Assignments | v1.4 | 2/2 | Complete | 2026-04-03 |
| 34. Report Comments | v1.4 | 2/2 | Complete | 2026-04-03 |
| 35. Chat System | v1.4 | 4/4 | Complete | 2026-04-04 |
| 36. Resources Tab | v1.4 | 3/3 | Complete | 2026-04-04 |
| 37. Invite Link max_uses | v1.4 | 2/2 | Complete | 2026-04-04 |
| 40. Deals Database Foundation | v1.4 | 1/1 | Complete | 2026-04-06 |
| 41. Deals API Route Handlers | v1.4 | 1/1 | Complete | 2026-04-06 |
| 42. Student Deals Pages + Dashboard Stat Cards | v1.4 | 2/2 | Complete | 2026-04-07 |
| 43. Coach & Owner Deals Tab | v1.4 | 1/1 | Complete | 2026-04-07 |
| 44. Analytics RPC Foundation & Shared Helpers | v1.5 | 0/TBD | Not started | — |
| 45. `deals.logged_by` Migration + API + RLS | v1.5 | 0/TBD | Not started | — |
| 46. Student Analytics Page + Recharts | v1.5 | 0/TBD | Not started | — |
| 47. Coach Dashboard Homepage Stats | v1.5 | 0/TBD | Not started | — |
| 48. Full Coach Analytics Page | v1.5 | 0/TBD | Not started | — |
| 49. Coach & Owner Deals Logging UI | v1.5 | 0/TBD | Not started | — |
| 50. Milestone Config | v1.5 | 1/1 | Complete   | 2026-04-13 |
| 51. Milestone Notifications RPC + Backfill | v1.5 | 1/2 | In Progress|  |
| 52. Coach Alerts Page | v1.5 | 0/TBD | Not started | — |
