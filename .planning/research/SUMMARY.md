# Project Research Summary — Milestone v1.5

**Project:** IMA Accelerator V1 — Milestone v1.5 (Analytics Pages, Coach Dashboard & Deal Logging)
**Domain:** Student coaching / performance-tracking platform — Next.js 16 App Router + Supabase at 5k concurrent student scale
**Researched:** 2026-04-13
**Confidence:** HIGH

## Executive Summary

v1.5 extends an already production-validated stack with analytics surfaces (student self-analytics, coach dashboard KPI cards, full coach analytics page), staff-logged deals via a `logged_by` attribution column, and four new milestone notifications for coaches. Research converges on a **single net-new runtime dependency (`recharts@^3.8.1`)** layered on top of the existing pg_cron + summary-table aggregation pattern, the existing `alert_dismissals` notification pattern (260401-cwd), and date-fns 4.1.0 which is already installed. No new infrastructure, no TimescaleDB, no notification SaaS, no real-time layer.

The recommended approach follows the sequential build order locked in v1.5 D-10 (Feature 1 → 2 → 3 → 4 → 5) because each feature depends on the prior's RPC shape or data column. All aggregation happens server-side in `SECURITY DEFINER` RPCs wrapped in `unstable_cache` 60s TTL with user-scoped `revalidateTag` invalidation — the exact pattern proven at 5k scale in v1.2 Phase 20–24.

Key risks cluster around three axes: (1) **chart integration** — React 19 hydration mismatch on `ResponsiveContainer` and WCAG color-only failure; (2) **authorization regressions on the coach-logged deal path** — classic role-without-assignment-check bypass, mitigated by dual-layer route handler + RLS `WITH CHECK`; (3) **notification idempotency and noise** — D-07 "Closed Deal on every deal" requires `deal_id` in dismissal key, and migration must pre-dismiss historical qualifiers. **D-06 (Tech/Email Setup roadmap step)** is a hard blocker for Feature 5 pending Monday's stakeholder meeting.

## Key Findings

### Top 5 Stack Additions / Decisions

- **`recharts@^3.8.1`** (ADD, sole new runtime dep) — declarative React 19 chart lib, ~35 KB gzipped route-scoped. May require `"overrides": { "react-is": "19.2.3" }` if peer-dep warning.
- **`date-fns@^4.1.0`** (KEEP, already installed) — tree-shaken imports for week/month bucketing; v4 has native tz, no `date-fns-tz` peer needed.
- **Existing pg_cron + `student_kpi_summaries`** (KEEP) — lifetime totals from summary table; trailing windows computed live with `date_trunc` + `generate_series`. Do NOT extend summary table schema (Pitfall 20).
- **Existing `alert_dismissals` pattern** (KEEP per D-08) — new alert_key prefixes; no new notification table.
- **Existing `unstable_cache` 60s TTL + `revalidateTag`** (KEEP) — every new RPC wrapped; every mutation route calls `revalidateTag` with user-scoped keys.

**Explicit anti-recommendations (DO NOT ADD):** Tremor Raw / visx / Nivo / ECharts / Chart.js / Victory; TimescaleDB (TSL blocked on Supabase Cloud + deprecated on PG17); dayjs / moment / luxon / date-fns-tz; Novu / Knock / Courier / Fyno / sonner / react-hot-toast; Supabase Realtime (v1.4 D-07 excludes it); Redis / ClickHouse / DuckDB.

### Expected Features — Table Stakes vs Differentiators (5 features)

**Feature 1 — Student Self-Analytics (`/student/analytics`, `/student_diy/analytics`)**
- *Table stakes:* 6-card lifetime totals strip (hours, emails, influencers, deals, revenue, profit); hours-worked trend chart (zero-filled); outreach trend chart; deal history table (paginated 25, attribution chip); roadmap progress vs deadlines summary; time range selector (7/30/90/All, default 30d); loading skeletons + empty states; single batch `get_student_analytics` RPC.
- *Differentiators:* "Best day" callout; roadmap cumulative retrospective timeline; target vs actual hours for today/week; margin % sparkline on deals.

**Feature 2 — Coach Dashboard Homepage Stats (`/coach`)**
- *Table stakes:* 4–6 stat cards with period labels (Deals Closed / Revenue / Avg Roadmap Step / Total Emails this week + recommended Active Students 7d + Unreviewed Reports); each card clickable → drill-down; ima-green/ima-red delta arrows; 3 recent reports card; Top-3 hours leaderboard (ISO Mon–Sun); skeleton loaders; single batch `get_coach_dashboard` RPC.
- *Differentiators:* "Needs attention" merged feed (unreviewed + at-risk + milestones); cohort average shown under top-3; compact/expanded stat strip.

**Feature 3 — Full Coach Analytics (`/coach/analytics`)**
- *Table stakes:* Paginated student list (25/page per D-04) with Zod-validated server-side sort; active/inactive/at-risk breakdown header; aggregate deal trend chart (12 weeks); three top-5 leaderboards (hours weekly, emails weekly, deals all-time); name search; time range selector; CSV export; pagination with total count.
- *Differentiators:* Funnel view (Students → Setup Done → First Outreach → First Influencer → First Brand Reply → First Deal); at-risk panel; revenue + margin trend panel; per-student mini-profile on hover.
- *Defer to v1.6+:* Cohort comparison by signup-week; per-student line series.

**Feature 4 — Staff-Logged Deals**
- *Table stakes:* `logged_by uuid` column (ON DELETE SET NULL, backfilled + NOT NULL); coach/owner INSERT RLS with `(SELECT get_user_role())` + `(SELECT get_user_id())` initplan + student-assignment check; "Add Deal" button on coach/owner tabs (reuses `DealFormModal`); role-gated attribution chip; audit columns `updated_at`/`updated_by` + trigger; creator-or-owner edit permissions; coach-logged vs student-logged breakdown on `/coach/analytics`; existing 30 req/min rate limit.
- *Differentiators:* "Verified" flag for student-logged deals; soft delete `archived_at`.
- *Defer:* Per-deal change-log popover; bulk CSV import.

**Feature 5 — Milestone Notifications for Coaches**
- *Table stakes:* Reuse 260401-cwd pattern (D-08); four new triggers — Tech/Email Setup (step TBC D-06), 5 Influencers Closed (Step 11), First Brand Response (Step 13), Closed Deal (every deal per D-07); idempotency via alert_key shape (one-shot for first three, `closed_deal:{student_id}:{deal_id}` for per-deal); extend `get_sidebar_badges` coach branch (single source of truth); inline feed on dashboard + dedicated `/coach/alerts` page; backfill pre-dismisses historical qualifiers; 9+ badge cap + bulk-dismiss.
- *Differentiators:* Owner roll-up; milestone chip timeline on student detail; mark-all-read.
- *Defer:* Per-type mute preferences; per-event comment thread.

**Anti-features across all 5 (DO NOT BUILD):** Peer/percentile comparisons; streak counters with flames; letter-grade ratings; predictive "you will close in X days"; leaderboards visible to students; public bottom-3 at-risk lists; auto-refresh polling; email/push notifications (V2+); notifying students of their own milestones; firing milestones retroactively without dismissal-seeding.

### Architecture — Integration Points / Build Order

Pattern: **server-component page → `SECURITY DEFINER STABLE` RPC via admin client → `unstable_cache` 60s → prop-drill to `"use client"` chart shell → recharts with `ima-*` hex constants**. All mutation routes call `revalidateTag` with user-scoped keys.

| # | Phase topic | Depends on | Migration |
|---|-------------|-----------|-----------|
| 1 | Analytics RPC Foundation + shared helpers (`week_start`, `student_activity_status`) | existing | 00023 indexes only |
| 2 | `deals.logged_by` migration + API + RLS | 00021 deals | **00022** |
| 3 | Student Analytics RPC + page + recharts install | #1 | part of **00023** |
| 4 | Coach Dashboard RPC + homepage stats UI (consolidation) | #1 | **00024** |
| 5 | Full Coach Analytics page (leaderboards + deal trend + pagination) | #1, #4 | 00023 or follow-up |
| 6 | Coach Deals Logging UI (Add Deal + attribution column) | #2 | — |
| 7 | Milestone Config (`MILESTONES` constant + D-06 value) | #2 | — |
| 8 | Milestone Notifications RPC + extend `get_sidebar_badges` + backfill | #2, #7 | **00025** |
| 9 | Coach Alerts Page (feed UI + bulk-dismiss + 9+ cap) | #8 | — |

**Critical path:** #2 → #4 → #5 (coach dashboard lights up) has highest leverage; #1 → #3 (student analytics) can ship independently in parallel.

### Watch Out For — Top 10 Pitfalls Mapped to Phases

1. **Client-side row pulls on analytics** (Feat 1/3) — all aggregation in RPCs (D-01); grep `.from(` in analytics pages = 0 hits.
2. **Chart hydration mismatch under React 19 RSC** — `"use client"` + `next/dynamic({ ssr: false })`; establish pattern once, copy thereafter.
3. **Timezone drift in week/day bucketing** — pass `p_today date` to every RPC; never `now()`/`CURRENT_DATE` in function body; shared `week_start` helper used by BOTH skip tracker and leaderboard.
4. **Coach logs deal for unassigned student — authz bypass** — dual-layer check (route handler asserts `users.coach_id` match; RLS `WITH CHECK` with `(SELECT get_user_id())`); negative E2E test mandatory.
5. **Milestone notification double-fires on reassignment / backfill** — keys scoped to `(student, milestone)` not `(student, milestone, coach)`; seed pre-dismissal rows at migration time; unit test compute-runs-twice returns zero new.
6. **Closed-Deal firing 50× for high performers** — per-deal key `closed_deal:{deal_id}`; 9+ badge cap; bulk-dismiss; fallback digest mode as tune-knob.
7. **`deal_number` race on concurrent coach+student insert** — composite unique index `(student_id, deal_number)` + retry on 23505; ship index in same migration as `logged_by`.
8. **Stat-card fan-out (N RPCs for N cards)** — single `get_coach_dashboard` batch RPC with JSONB envelope; one `unstable_cache` tag.
9. **Cache stale after mutation** — every mutation route calls `revalidateTag` for `analytics-student-${id}`, `coach-dashboard-${coachId}`, `coach-analytics-${coachId}`, `coach-milestones-${coachId}`; missing revalidate fails UAT.
10. **Chart accessibility failures** — every chart wrapped `<div role="img" aria-label="...">` with prose summary + `<details><summary>View data table</summary><table>` fallback; shape + label + color (never color-alone); `tabIndex={0}`; `motion-safe:` on animations.

Full 22-pitfall list in PITFALLS.md.

## Implications for Roadmap — Suggested Phases (Phase 44 onward)

**Phase 44: Analytics RPC Foundation + Shared Helpers.** `week_start(p_today)`, `student_activity_status(student_id, p_today)`, `ACTIVITY` config (`inactiveAfterDays: 7` pending D-14), partial indexes, Phase 19 `users.coach_id` audit. Avoids Pitfalls 1, 3.

**Phase 45: `deals.logged_by` Migration + API + RLS.** `00022_deals_logged_by.sql` (column, backfill `logged_by = student_id`, NOT NULL, composite unique index, partial index, coach+owner INSERT policies), route handler refactor with Zod optional `student_id` + dual-layer ownership check + 23505 retry. Gate: negative E2E test passes. Avoids Pitfalls 4, 7.

**Phase 46: Student Analytics RPC + Page + Recharts Install.** `get_student_analytics` RPC, `src/app/(dashboard)/student/analytics/page.tsx` + loading/error, `src/components/analytics/*Chart.tsx` wrappers, `src/lib/chart-colors.ts`, recharts install (conditional react-is override), `revalidateTag` wiring on mutations. Avoids Pitfalls 1, 2, 9, 10.

**Phase 47: Coach Dashboard RPC + Homepage Stats UI.** `get_coach_dashboard` RPC consolidating existing 4-query Promise.all, rewritten `/coach/page.tsx`, `TopHoursLeaderboard` + `RecentReportsCard` + stat cards with deltas. Avoids Pitfalls 8, 9.

**Phase 48: Full Coach Analytics Page.** `get_coach_analytics` RPC with pagination + Zod-validated sort, `CoachAnalyticsClient.tsx` with URL-backed pagination, CSV export endpoint, `COACH_ANALYTICS_SORT_KEYS` Zod enum. Avoids Pitfalls 1, 8, 9.

**Phase 49: Coach Deals Logging UI.** Separated from Phase 45 so UI cannot ship before authorization is verified. `LogDealModal`, attribution chip column, `formatDealLoggedBy(deal, viewerRole, viewerId)` role-gated helper.

**Phase 50: Milestone Config.** `MILESTONE_CONFIG` + `MILESTONES` constants in `src/lib/config.ts`; feature flag `tech_setup` until D-06 confirmed. **Blocker: D-06 must resolve at Monday stakeholder meeting.**

**Phase 51: Milestone Notifications RPC + Backfill Migration.** `00025_milestone_alerts.sql` (alert_key namespaces, index, backfill pre-dismissals, ON DELETE CASCADE), `get_coach_milestones` RPC, extended `get_sidebar_badges` (single-source count), `revalidateTag('coach-milestones-${id}')` in deal/report/roadmap POSTs. Avoids Pitfalls 5, 6.

**Phase 52: Coach Alerts Page.** `/coach/alerts` with grouped-by-student view, inline "needs attention" dashboard card, 9+ badge cap, bulk-dismiss for Closed Deal. Avoids Pitfall 6.

**Phase Ordering Rationale:**
- Foundation before consumers (Phase 44 helpers precede all RPCs)
- Authorization before UI (Phase 45 RLS precedes Phase 49 UI)
- Student-first analytics (Phase 46 validates patterns for 47/48)
- Config before compute (Phase 50 precedes Phase 51)
- Backfill-migration last (Phase 51 needs Phase 45 `deal_id` and Phase 50 `tech_setup.stepRef`)

### Research Flags

- **Phase 46:** Verify recharts 3.8.1 + React 19 peer-dep at install time; confirm `accessibilityLayer` prop behavior as template.
- **Phase 51:** Backfill policy — validate pre-dismissal strategy against real data volume before committing migration.
- **Phase 52:** UX grouping pattern review (TrueCoach / CoachAccountable references).

**Standard patterns (skip research-phase):** Phases 44, 45, 47, 48, 49, 50.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Multiple sources converge on recharts; `package.json` directly inspected; Supabase docs explicit on TimescaleDB. React 19 peer-dep is MEDIUM with known workaround. |
| Features | MEDIUM-HIGH | Salesforce/HubSpot/TrueCoach/Coach Catalyst/Gong convergence; Wiley 2023 + Spinify research; 7d inactive threshold is judgment call (D-14 pending). |
| Architecture | HIGH | Every recommendation grounded in existing migration or shipped RPC; v1.2 Phase 20/21/23/24 patterns proven at 5k scale. |
| Pitfalls | HIGH | 22 pitfalls each map to a specific prior-phase precedent with concrete avoid-strategy, warning signs, and phase-to-address. |

**Overall confidence:** HIGH.

### Open Questions (with D-references) Blocking or Flagging Downstream Phases

| ID | Question | Research recommendation | Phase blocked | When needed |
|----|----------|--------------------------|---------------|-------------|
| **D-06** | "Tech/Email Setup Finished" = which roadmap step? (Placeholder Step 5 or 6.) | Requires stakeholder input | **Phase 50 + Phase 51** | **Monday stakeholder meeting** — hard blocker. Feature-flag `tech_setup` until confirmed. |
| **D-11** | Chart library final pick. | **recharts@^3.8.1** — HIGH convergence | Phase 46 | Install time. Add `"overrides": { "react-is": "19.2.3" }` conditionally. |
| **D-14 (proposed)** | "Inactive student" definition. | **7 days** zero activity (reports OR sessions); matches daily-accountability cadence | Phases 44, 48 | Before Phase 44 ships. Confirm with Abu Lahya. |
| **Q-DIY** | `student_diy` analytics in scope? | **Scope in** — same RPC, new route `/student_diy/analytics`; zero incremental cost | Phase 46 | Before Phase 46 scaffolding. |
| **Q-EDIT** | Edit audit trail (`edited_by`/`edited_at`) for coach-logged deals? | **NO for v1.5** — `updated_at` + `updated_by` trigger is sufficient; defer full change-log to v1.6+ | Phase 45 | Before migration 00022 lands. Confirm with Abu Lahya. |

Additional downstream flag: **Q-CLOSED-DEAL** — does "Closed Deal" milestone fire on coach-logged deals or only student-logged? Recommend **all deals** (simplest, consistent with D-07); confirm during Phase 50 config work.

### Ready for Requirements

This summary feeds `REQUIREMENTS.md` scoping and the `gsd-roadmapper` phase-planning pass.
