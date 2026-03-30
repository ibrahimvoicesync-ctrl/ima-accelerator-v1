# Roadmap: IMA Accelerator V1

## Milestones

- ✅ **v1.0 IMA Accelerator V1** — Phases 1-12 (shipped 2026-03-18)
- ✅ **v1.1 V2 Feature Build** — Phases 13-18 (shipped 2026-03-28)
- 🚧 **v1.2 Performance, Scale & Security** — Phases 19-24 (in progress)

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

**v1.2 Performance, Scale & Security**

- [x] **Phase 19: Database Foundation** — Composite indexes, admin client singleton, RLS initplan fix, monitoring baseline (completed 2026-03-29)
- [ ] **Phase 20: Query Consolidation & Caching** — RPC consolidation (8 → ≤2 round trips), React cache(), unstable_cache, server-side pagination
- [ ] **Phase 21: Write Path & Pre-Aggregation** — pg_cron nightly KPI summaries, optimistic UI on report submission, write path audit
- [ ] **Phase 22: Spike Protection & Rate Limiting** — DB-backed rate limiting (30 req/min/user) on all mutation routes
- [ ] **Phase 23: Security Audit** — Auth check verification, CSRF Origin headers, cross-student isolation audit [requires-human-review]
- [ ] **Phase 24: Infrastructure & Validation** — k6 load test (5k students), capacity documentation, compute right-sizing

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
**Plans:** 0/4 plans executed
Plans:
- [ ] 20-01-PLAN.md — Migration 00010 (3 RPC functions), RPC types, React cache() on getSessionUser
- [ ] 20-02-PLAN.md — Owner dashboard RPC swap, layout.tsx cached badges, badge invalidation in 5 API routes
- [ ] 20-03-PLAN.md — Student detail RPC swap (coach + owner pages)
- [ ] 20-04-PLAN.md — Server-side pagination on student list and coach list pages

### Phase 21: Write Path & Pre-Aggregation
**Goal**: Nightly KPI aggregations are pre-computed so the owner dashboard reads from a summary table instead of scanning all reports, and report submission shows instant feedback to the student
**Depends on**: Phase 20
**Requirements**: WRITE-01, WRITE-02, WRITE-03
**Success Criteria** (what must be TRUE):
  1. A student_kpi_summaries table exists; a pg_cron job runs at 2 AM UTC (6 AM UAE) and calls refresh_student_kpi_summaries() which upserts per-student KPI aggregates; the function uses pg_try_advisory_lock() to prevent overlapping runs
  2. Student daily report submission updates the UI optimistically via useOptimistic before the API call returns; on API failure, the UI rolls back to server ground truth and the submit button re-enables
  3. A write path audit document records the exact DB call count for report submission and work session complete paths, and confirms no unnecessary round trips exist
**Plans**: TBD

### Phase 22: Spike Protection & Rate Limiting
**Goal**: All mutation API routes enforce a 30 requests/minute per-user limit backed by the database, so the limit is consistent across all serverless container instances
**Depends on**: Phase 19
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. A rate_limit_log Supabase table exists with a cleanup pg_cron job; a checkRateLimit() async helper reads and writes to this table using an atomic INSERT + COUNT pattern
  2. All POST/PATCH/DELETE route handlers for work sessions, daily reports, and roadmap progress call checkRateLimit() after auth verification and before Zod validation
  3. A user who exceeds 30 requests/minute receives a 429 response with a Retry-After header; the limit is enforced consistently regardless of which serverless container handles the request
**Plans**: TBD

### Phase 23: Security Audit
**Goal**: Every API route's auth and ownership checks are verified correct, all mutation handlers have CSRF protection, and cross-student data isolation is confirmed

> **FLAG: requires-human-review** — Do not auto-merge. Surface the full audit report for human approval before applying any changes. This phase produces a report first; changes are applied only after explicit human sign-off.

**Depends on**: Phase 22
**Requirements**: SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Every API route has been audited for the pattern: auth check → role verification → resource ownership check → query; any gaps are documented and fixed
  2. Every POST/PATCH/DELETE route handler verifies the Origin header matches the expected host and returns 403 on mismatch; CSRF protection is not assumed from Next.js (only Server Actions get it automatically)
  3. Cross-student isolation is verified: no student can retrieve another student's data by manipulating route params; every admin-client query that touches student data filters by the authenticated user's ID
**Plans**: TBD

### Phase 24: Infrastructure & Validation
**Goal**: The platform is validated under realistic 5,000-student load, connection and query capacity headroom is documented, and compute sizing is confirmed or adjusted
**Depends on**: Phase 21, Phase 22, Phase 23
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. A k6 load test runs against a staging environment seeded with 5,000 students and 90 days of reports (~500k rows); the test covers the owner dashboard read mix and the 11 PM write spike scenario; P95 latency and connection counts are recorded
  2. A capacity document records connection usage (must stay below 70% of max_connections during spike), P50/P95/P99 query latencies, and rate limiter trigger counts during the simulated spike
  3. Supabase compute add-on tier is confirmed adequate or upgraded based on load test data; the decision (stay/upgrade + rationale) is written into PROJECT.md Key Decisions
**Plans**: TBD

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
| 19. Database Foundation | v1.2 | 2/2 | Complete    | 2026-03-29 |
| 20. Query Consolidation & Caching | v1.2 | 0/4 | Planned    |  |
| 21. Write Path & Pre-Aggregation | v1.2 | 0/? | Not started | - |
| 22. Spike Protection & Rate Limiting | v1.2 | 0/? | Not started | - |
| 23. Security Audit | v1.2 | 0/? | Not started | - |
| 24. Infrastructure & Validation | v1.2 | 0/? | Not started | - |
