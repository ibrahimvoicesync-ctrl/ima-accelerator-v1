# Roadmap: IMA Accelerator V1

## Milestones

- ✅ **v1.0 IMA Accelerator V1** — Phases 1-12 (shipped 2026-03-18)
- ✅ **v1.1 V2 Feature Build** — Phases 13-18 (shipped 2026-03-28)
- ✅ **v1.2 Performance, Scale & Security** — Phases 19-24 (shipped 2026-03-31)
- 🚧 **v1.3 Roadmap Update, Session Planner & Coach Controls** — Phases 25-29 (in progress)

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

**v1.3 Roadmap Update, Session Planner & Coach Controls**

- [x] **Phase 25: Roadmap Config & Stage Headers** - Update step descriptions, unlock URLs, target_days, and add stage grouping headers to all roadmap views (completed 2026-03-31)
- [x] **Phase 26: Database Schema Foundation** - Add daily_plans and roadmap_undo_log tables with RLS, indexes, and UTC-safe constraints (completed 2026-03-31)
- [x] **Phase 27: Coach/Owner Roadmap Undo** - PATCH /api/roadmap/undo with confirmation dialog, N+1 cascade re-lock, and audit logging (completed 2026-03-31)
- [x] **Phase 28: Daily Session Planner API** - POST/GET /api/daily-plans with 4h cap enforcement, Zod plan_json schema, server-side cap on work-sessions (completed 2026-03-31)
- [x] **Phase 29: Daily Session Planner Client** - DailyPlannerClient wizard, WorkTrackerClient plan-mode, PlanCompletionCard with ad-hoc session picker (completed 2026-03-31)

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
  5. After all planned sessions complete, a motivational card appears showing Arabic "اللهم بارك" (large, centered, dir="rtl") and English "You have done the bare minimum! Continue with your next work session"; the card shows once per day
  6. The card offers "Start Next Session" (opens ad-hoc duration picker) and "Dismiss" (returns to work tracker idle); ad-hoc sessions allow free duration and break type selection with no daily cap
**Plans:** 3/3 plans complete
Plans:
- [x] 29-01-PLAN.md — Server-side plan fetch in page.tsx + PlannerUI session builder component
- [x] 29-02-PLAN.md — WorkTrackerClient plan-mode integration with PlannedSessionList and handleStartWithConfig
- [x] 29-03-PLAN.md — MotivationalCard post-completion + ad-hoc mode wiring
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
| 25. Roadmap Config & Stage Headers | v1.3 | 2/2 | Complete    | 2026-03-31 |
| 26. Database Schema Foundation | v1.3 | 1/1 | Complete    | 2026-03-31 |
| 27. Coach/Owner Roadmap Undo | v1.3 | 2/2 | Complete    | 2026-03-31 |
| 28. Daily Session Planner API | v1.3 | 3/3 | Complete    | 2026-03-31 |
| 29. Daily Session Planner Client | v1.3 | 3/3 | Complete    | 2026-03-31 |
