# Requirements: IMA Accelerator v1.5

**Defined:** 2026-04-13
**Milestone:** v1.5 — Analytics Pages, Coach Dashboard & Deal Logging
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.
**Scale target:** 5,000 concurrent students (P95 < 1s per v1.2 Phase 24 baseline)

## v1.5 Requirements

Requirements for v1.5 milestone. Each maps to roadmap phases. Build order is sequential (Feat 1 → 2 → 3 → 4 → 5) per D-10.

### Student Analytics

<!-- Feature 1 — /student/analytics and /student_diy/analytics self-visibility page -->

- [ ] **ANALYTICS-01**: Student and student_diy roles can navigate to `/student/analytics` (or `/student_diy/analytics`) via a new sidebar nav item
- [ ] **ANALYTICS-02**: Student sees a 6-card lifetime totals strip (Total Hours, Total Emails, Total Influencers, Total Deals, Total Revenue, Total Profit) with current streak indicator
- [ ] **ANALYTICS-03**: Student sees an outreach trend chart splitting brands-sent vs influencers-sent per week, with time range selector (7d / 30d / 90d / All, default 30d)
- [ ] **ANALYTICS-04**: Student sees an hours-worked trend chart (daily bars or weekly totals based on range) respecting the same time range selector
- [ ] **ANALYTICS-05**: Student sees a deal history table (paginated 25/page) with deal #, revenue, profit, margin %, logged date, attribution chip (self / coach / owner), and summary totals (deals, revenue, profit)
- [ ] **ANALYTICS-06**: Student sees roadmap progress vs deadlines — per-step status indicator (on-track / due-soon / overdue / completed / ahead) reusing existing `getDeadlineStatus()` utility
- [ ] **ANALYTICS-07**: All analytics data is fetched via a single batch Postgres RPC function (`get_student_analytics`), scoped to the authenticated student (never another student's data)
- [ ] **ANALYTICS-08**: Analytics page data is wrapped in `unstable_cache` with 60s TTL and a user-scoped `revalidateTag` key, invalidated by deal/report/session/roadmap mutations
- [ ] **ANALYTICS-09**: Charts are keyboard-accessible (tabIndex=0), use `<div role="img" aria-label="...">` wrappers with a prose summary, and include a `<details><summary>View data table</summary>` fallback
- [ ] **ANALYTICS-10**: Chart entrance animations use `motion-safe:` wrapper; all interactive elements meet 44px touch target

### Coach Dashboard Homepage Stats

<!-- Feature 2 — /coach homepage quick-scan KPIs -->

- [ ] **COACH-DASH-01**: Coach sees 4 stat cards on `/coach` showing combined KPIs across assigned students — Total Deals Closed, Total Revenue Generated, Average Roadmap Step, Total Emails Sent
- [ ] **COACH-DASH-02**: Each stat card is clickable (min 44px touch target) and navigates to `/coach/analytics` with the relevant metric scrolled into view
- [ ] **COACH-DASH-03**: Coach sees a "Recent Submissions" card showing the 3 most recent daily report submissions from assigned students with a "See All" link to the reports/submissions page
- [ ] **COACH-DASH-04**: Coach sees a "Top 3 Students This Week" leaderboard ranked by hours worked during the current ISO week (Monday–Sunday), showing student name + hours; resets weekly at Monday 00:00 local
- [ ] **COACH-DASH-05**: All coach dashboard data is fetched via a single batch RPC (`get_coach_dashboard`), scoped via `coach_id` filter to the coach's assigned students only
- [ ] **COACH-DASH-06**: Dashboard RPC result is wrapped in `unstable_cache` with 60s TTL keyed by coach_id; invalidated on assigned-student deal/report/session writes
- [ ] **COACH-DASH-07**: Loading skeletons display while stats load; empty state shown when coach has 0 assigned students

### Full Coach Analytics

<!-- Feature 3 — /coach/analytics expanded comprehensive view -->

- [ ] **COACH-ANALYTICS-01**: Existing `/coach/analytics` page is expanded to show: Highest Deals Closed (top student by deal count), Total Revenue Generated (all assigned students), Average Roadmap Step, Average Email Count, Most Emails Sent (top performer)
- [ ] **COACH-ANALYTICS-02**: Coach sees three top-5 student leaderboards — by hours this week, by emails this week, by all-time deals closed
- [ ] **COACH-ANALYTICS-03**: Coach sees aggregate "Deals Closed Over Time" trend chart covering the last 12 weeks
- [ ] **COACH-ANALYTICS-04**: Coach sees Active vs Inactive breakdown where "Inactive" = no completed work session AND no submitted report in the last 7 days (D-14)
- [ ] **COACH-ANALYTICS-05**: Coach sees a paginated student list (25/page per D-04) with Zod-validated server-side sort parameters (sortable columns: name, hours, emails, deals, roadmap step, last active)
- [ ] **COACH-ANALYTICS-06**: Coach can search the student list by name (server-side match, no client-side filter over partial results)
- [ ] **COACH-ANALYTICS-07**: All coach analytics data scoped to assigned students only; single batch RPC (`get_coach_analytics`) returning paginated envelope; wrapped in `unstable_cache` 60s TTL

### Coaches Log Deals for Students

<!-- Feature 4 — logged_by attribution + coach/owner INSERT -->

- [ ] **DEALS-01**: `deals` table gains a nullable `logged_by UUID` column with FK to `users(id)` ON DELETE SET NULL; existing rows backfilled to `logged_by = student_id`; after backfill column is NOT NULL
- [ ] **DEALS-02**: `deals` table gains `updated_at TIMESTAMPTZ` and `updated_by UUID` audit columns with a trigger that sets them on every UPDATE (per Q-EDIT resolution — no per-edit history table)
- [ ] **DEALS-03**: Composite unique index `(student_id, deal_number)` exists, and the POST /api/deals path retries with deal_number+1 on 23505 conflict to handle concurrent coach+student inserts
- [ ] **DEALS-04**: New RLS INSERT policy allows coach role to insert a deal only when `logged_by = auth.uid()` AND `student_id` is in the coach's assigned students (using `(SELECT auth.uid())` initplan pattern)
- [ ] **DEALS-05**: New RLS INSERT policy allows owner role to insert a deal for any student (using `(SELECT auth.uid())` initplan pattern)
- [ ] **DEALS-06**: Existing student self-insert RLS continues to work; student attempts to insert with `logged_by != self` are rejected
- [ ] **DEALS-07**: Coach sees an "Add Deal" button on the coach student-detail Deals tab that opens the same modal used for student deal creation (revenue + profit inputs)
- [ ] **DEALS-08**: Owner sees an "Add Deal" button on the owner student-detail Deals tab with equivalent behavior
- [ ] **DEALS-09**: Creating a deal as coach/owner sets `logged_by` to the creator's user_id and `student_id` to the viewed student; `deal_number` auto-increments correctly
- [ ] **DEALS-10**: Deals table UI (all 3 role views) shows an attribution indicator per row: "You" for self-logged, coach name for coach-logged, "Owner: {name}" for owner-logged
- [ ] **DEALS-11**: POST /api/deals endpoint enforces dual-layer authorization — route handler asserts coach's assignment to student, AND RLS WITH CHECK enforces the same; negative test (coach targeting unassigned student) returns 403

### Milestone Notifications for Coaches

<!-- Feature 5 — extends existing 100hr alert pattern with 4 new triggers -->

- [ ] **NOTIF-01**: Coach receives a notification when an assigned student completes the "Tech/Email Setup Finished" milestone (roadmap step reference configured in `MILESTONE_CONFIG`, placeholder until D-06 confirmed Monday meeting)
- [ ] **NOTIF-02**: Coach receives a notification when an assigned student reaches Roadmap Step 11 (5 Influencers Closed)
- [ ] **NOTIF-03**: Coach receives a notification when an assigned student reaches Roadmap Step 13 (First Brand Response)
- [ ] **NOTIF-04**: Coach receives a notification for every closed deal by an assigned student — including coach-logged and owner-logged deals (per Q-CLOSED-DEAL resolution and D-07)
- [ ] **NOTIF-05**: Each milestone notification fires exactly once per qualifying event, idempotent via `alert_key` namespaces — one-shot keys for NOTIF-01/02/03 (`milestone:{type}:{student_id}`), per-deal key for NOTIF-04 (`closed_deal:{student_id}:{deal_id}`)
- [ ] **NOTIF-06**: Notification message includes student name and achievement description; clicking navigates to the student detail page
- [ ] **NOTIF-07**: Coach sidebar badge count is extended to include new milestone notifications alongside the existing 100+ hrs/45 days alert, via a single source (`get_sidebar_badges` RPC)
- [ ] **NOTIF-08**: Existing 100+ hours/45 days coach alert (quick task 260401-cwd) continues to work unchanged — notifications reuse the same pattern, not a rebuild (per D-08)
- [ ] **NOTIF-09**: New `/coach/alerts` page shows grouped-by-student feed with dismiss and bulk-dismiss actions; sidebar badge caps at "9+"
- [ ] **NOTIF-10**: Migration pre-dismisses historical qualifying events so adding a new milestone does not flood all existing coaches with retroactive alerts
- [ ] **NOTIF-11**: Milestone compute RPC is performant at 5k students — single batch per coach, wrapped in `unstable_cache` 60s, invalidated on deal/report/roadmap mutations

### Cross-Cutting Performance & Quality

<!-- Applies to every new table, query, API endpoint, and UI surface in v1.5 -->

- [ ] **PERF-01**: All new queries have indexes on hot paths (student_id, coach_id, date, logged_by where filtered)
- [ ] **PERF-02**: All new API endpoints enforce auth + role verification + rate limiting (30 req/min/user via existing `checkRateLimit`) + CSRF `verifyOrigin` on mutations
- [ ] **PERF-03**: All new RLS policies use the `(SELECT auth.uid())` initplan pattern (v1.2 Phase 19 convention)
- [ ] **PERF-04**: All analytics/dashboard aggregation happens inside `SECURITY DEFINER STABLE` Postgres RPC functions, never as client-side row pulls or JavaScript reductions
- [ ] **PERF-05**: All server-rendered stats/analytics reads are wrapped in `unstable_cache` 60s TTL with user-scoped `revalidateTag` keys; every mutation route calls `revalidateTag` for affected keys
- [ ] **PERF-06**: Any list over 25 items is server-side paginated with a Zod-validated `page`/`pageSize` schema (no client-side slice over all rows)
- [ ] **PERF-07**: Each phase's final commit passes `npm run lint && npx tsc --noEmit && npm run build` with zero errors
- [ ] **PERF-08**: All v1.5 code uses `ima-*` design tokens (no hardcoded hex/gray), `motion-safe:` wrappers on animations, 44px min touch targets, `aria-label`/`<label htmlFor>` on every input, `aria-hidden="true"` on decorative icons

## Future Requirements (Deferred)

- Per-deal edit history log (dedicated `deal_edit_log` table) — deferred from Q-EDIT to v1.6+
- "Verified" flag for student-logged deals
- Soft delete on deals (`archived_at`)
- Bulk CSV deal import
- Student-facing cohort comparison or peer benchmarking (explicitly out of scope — see Anti-features)
- Per-milestone mute preferences per coach
- Per-event comment thread on milestone notifications
- Owner-level milestone roll-up dashboard
- Funnel view (Students → Setup Done → First Outreach → First Influencer → First Brand Reply → First Deal) — differentiator, not table stakes
- Compact vs expanded stat strip toggle on coach dashboard

## Out of Scope

<!-- Explicit exclusions with reasoning to prevent re-adding -->

- Peer/percentile comparisons, streak counters with flame icons, letter-grade ratings, predictive "you will close in X days" text — gamification anti-patterns, conflicts with v1.0 "no gamification" ruling
- Leaderboards visible to students (students seeing peers) — privacy / motivation research shows harm for daily-accountability products
- Public bottom-3 at-risk lists — shaming anti-pattern
- Auto-refresh polling on analytics/dashboard — rely on cache invalidation via `revalidateTag`, no extra load
- Email notifications for milestones (Resend integration) — V2+
- Push notifications for milestones — V2+
- Notifying students about their own milestones in-app — coach-only per requirement scope
- Firing milestones retroactively without pre-dismissal seeding — Pitfall 13
- Supabase Realtime for notifications — excluded per v1.4 D-07 (500 connection limit)
- Redis/Upstash notification queue — rejected per PROJECT.md Out of Scope
- TimescaleDB continuous aggregates — not supported on Supabase Cloud (TSL-licensed, deprecated on PG17)
- New notification/messaging SaaS (Novu, Knock, Courier) — D-08 reuse mandate
- Chart libraries other than recharts (visx, Nivo, Tremor Raw, ECharts, Chart.js, Victory) — rejected in STACK.md with concrete reasons
- New npm dependencies beyond recharts — date-fns 4.1 already covers date utilities

## Traceability

<!-- Filled by gsd-roadmapper during phase creation -->

| REQ-ID | Phase # | Phase Name |
|--------|---------|------------|
| (pending — roadmapper will populate) | | |
