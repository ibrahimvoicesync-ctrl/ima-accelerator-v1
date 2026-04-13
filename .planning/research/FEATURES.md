# Feature Landscape

**Domain:** Coaching / performance-tracking platform for an influencer-marketing accelerator (student, student_diy, coach, owner)
**Milestone:** v1.5 — Analytics Pages, Coach Dashboard & Deal Logging
**Researched:** 2026-04-13
**Overall confidence:** MEDIUM-HIGH (ecosystem patterns well-established; specifics tuned to project constraints in PROJECT.md)

---

## Scope Note

This research is scoped to the five v1.5 target features. The platform already has:
- Student work tracker, 10-step roadmap, daily reports, deals tab, AI chat (stub), chat, resources
- Coach: assigned students overview, report review, at-risk flagging, invites, basic analytics, skip tracker, report comments, chat, read-only deals
- Owner: platform-wide stats, student/coach mgmt, assignments, alerts, deals tab
- A notification pattern ("100+ hours in 45 days" coach alert) computed coach-side with `alert_dismissals`
- `deals` table with revenue/profit/margin/deal_count/logged_date
- RPC-first aggregation convention (v1.2 D-decisions), unstable_cache 60s, paginate > 25, target 5k students

Rules below respect: light theme + ima-* tokens, 44px touch targets, motion-safe, admin client in route handlers, RLS `(SELECT auth.uid())` initplan pattern, `student_diy` has NO coach and reduced feature set.

---

## Feature 1 — Student Self-Analytics Page (`/student/analytics`, `/student_diy/analytics`)

### Table stakes

| # | Feature | Complexity | Why it's table stakes |
|---|---------|------------|-----------------------|
| 1.1 | **Lifetime totals strip** — Total Hours, Total Emails Sent, Influencers Closed, Deals Closed, Total Revenue, Total Profit (6 stat cards, same card component already used on student dashboard) | Simple | Every self-analytics view leads with the "what have I accomplished" summary. Mirrors Phase 42 deals cards. |
| 1.2 | **Hours worked trend** — line chart, last 30 days by default, weekday buckets. Empty days shown as 0 (not gaps) | Moderate | Standard in learning / fitness / sales platforms. Empty days communicate discipline honestly. |
| 1.3 | **Outreach trend (emails/DMs sent per day)** — same time range as hours chart, stacked or dual-series if we track emails vs DMs separately | Moderate | Primary leading indicator in this business (emails → influencers → deals). Already tracked in daily_reports. |
| 1.4 | **Deal history table** — chronological list (most recent first), columns: date, deal #, revenue, profit, margin %, logged_by indicator (from Feature 4). Paginated at 25 | Simple | Already have `DealsTable` from Phase 41/43 — reuse. |
| 1.5 | **Roadmap progress vs deadlines** — show current step, days-on-step, target_days, chip status (on-track / due-soon / overdue) reusing `getDeadlineStatus()` from Phase 18. Not a new chart; a single row summary with a link to `/student/roadmap` | Simple | Deadlines already exist; analytics surfaces the "am I pacing?" question. |
| 1.6 | **Time range selector** — 7d / 30d / 90d / All-time (default 30d). Applies to hours + outreach charts; lifetime totals are always all-time | Simple | Universal convention; trivial on the query side (RPC parameter). |
| 1.7 | **Loading skeleton + empty state** for each chart | Simple | Matches v1.0 quality bar. "No activity yet — complete your first session" etc. |
| 1.8 | **RPC-driven aggregation** — `get_student_analytics(user_id, range)` returns all series in one call, wrapped in `unstable_cache` 60s | Moderate | v1.5 D-01, D-02. Avoids N queries per page load at 5k scale. |

### Differentiators

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 1.9 | **"Best day" callout** — highlight the student's highest-hours day and highest-emails day in the visible range ("Your best day: Mar 28 — 4.5 hrs") | Simple | Cheap morale boost tied to real data. Not a streak, not a leaderboard — just celebrating self. |
| 1.10 | **Roadmap cumulative timeline** — small horizontal progress band showing when each completed step finished vs target (retrospective, not forward-looking) | Moderate | Shows the journey, useful for step-behind students to see they did make progress. |
| 1.11 | **Target vs actual hours for today/week** — "You've planned 4h today, logged 2.5h so far." Integrates daily planner (Phase 28/29) with actuals | Moderate | Uses data we already compute. Closes the planner feedback loop. |
| 1.12 | **Margin % trend on deals** — sparkline on deal history showing margin drift | Simple (once chart lib chosen) | Actionable coaching signal, unique to this product's profit-focused framing. |

### Anti-features — DO NOT BUILD

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|-----------|
| **Peer comparison / percentile rank** ("You're in the top 30% of students") | Violates v1.0 "no leaderboards, no gamification" out-of-scope, induces anxiety (Wiley 2023 confirms gamified comparison dashboards cause measurable negative affect in subset of students) | Comparison to self: "vs your 30-day average" |
| **Streak counter with flames/milestones** | Already explicitly out of scope ("Streaks and streak milestones — gamification is V2+"); streak loss is a top anxiety driver in learning analytics research | Show skip count factually (already done in skip tracker) without streak framing |
| **Color-coded "grade" or letter rating** for overall performance | Reductive; "D" grades tank motivation for students already struggling | Use existing RAG deadline chips on specific steps only |
| **Predictive "you will close your first deal in X days"** | Likely wrong; when wrong, erodes trust; halal-mentorship tone should not make probabilistic promises | Show trajectory factually: "at this pace, you've averaged 2 emails/day" |
| **Heat-map calendar of activity** (GitHub contributions style) | Duplicates the existing Phase 17 CalendarTab; adds visual clutter; tiny squares fail 44px touch target | Reuse the Phase 17 calendar via a link from analytics page |
| **Over-granular hourly breakdown** ("your most productive hour is 2–3pm") | Sample sizes too small to be meaningful at individual level; borders on surveillance | Day-level is enough |
| **Public or shared profile** | Scope creep, privacy risk in a small cohort | Self-only view |

### Streak display guidance (since it will be asked)
- ISO Mon-Sun week already used by skip tracker (v1.4 D-01). Reuse.
- Display as `3 active days this week / 1 skipped` — factual, no fire emoji, no cumulative streak counter.
- Do NOT break-streak-animate or send "you lost your streak" notifications.

### Dependencies
- **Requires:** New RPC `get_student_analytics`, chart library decision (see STACK.md), existing deals/work_sessions/daily_reports/roadmap_progress tables.
- **Blocks:** Feature 2 (coach dashboard) — coach homepage reuses the student RPC signature per build-order decision v1.5 D-10.
- **Student_diy variant:** Identical structure; just lives at `/student_diy/analytics`. No change to RPC — same query filters by user_id.

---

## Feature 2 — Coach Dashboard Homepage Stats

### Table stakes

| # | Feature | Complexity | Why it's table stakes |
|---|---------|------------|-----------------------|
| 2.1 | **4–6 "at-a-glance" stat cards** — confirmed set from PROJECT.md Active: **Deals Closed (this week)**, **Revenue (this week)**, **Avg Roadmap Step (all assigned students)**, **Total Emails (this week)**. Suggest adding **Active Students (7d)** and **Unreviewed Reports** to hit the high end of the 4–6 range | Simple | "4–6 KPIs above the fold" is the canonical sales-dashboard pattern (Salesforce, HubSpot, Gong all converge on this). |
| 2.2 | **Each stat card clickable → drill-down** — Revenue → coach analytics deal trend; Unreviewed → existing reports view filtered; Active Students → analytics active/inactive tab | Simple | Expected UX per every modern dashboard survey. |
| 2.3 | **Period label on every card** — "This week (Mon–Sun)" or "All students". No unlabeled numbers | Simple | Unlabeled numbers are the #1 dashboard anti-pattern (HubSpot, Salesforce docs both call this out). |
| 2.4 | **3 recent reports card** — newest first, each row: student name, date, star rating, hours, "Review" pill if unreviewed. "See all" → existing reports view | Simple | Already in scope per PROJECT.md. |
| 2.5 | **Top-3 hours leaderboard (weekly Mon–Sun)** — ranked by hours logged this ISO week across coach's assigned students. Show name, hours, small delta vs previous week | Moderate | In scope per PROJECT.md + v1.5 D-13. See leaderboard guidance below. |
| 2.6 | **Deltas / direction arrows on stat cards** — "↑ 12% vs last week" or "↓ 2 deals" in ima-green/ima-red. Requires previous-period fetch in the RPC | Moderate | Color-coded deltas are 2026 standard. Green/yellow/red must use ima-* tokens. |
| 2.7 | **Skeleton loaders** for cards + recent reports while RPC resolves | Simple | v1.0 quality bar. |
| 2.8 | **Single RPC `get_coach_dashboard(coach_id)`** returning all sections (stats, recent reports, top-3). Cached 60s | Moderate | Per v1.5 D-01/D-02 and v1.2 consolidation pattern. Prevents N+1 across cards. |

### Differentiators

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 2.9 | **"Needs attention" activity feed** — merges unreviewed reports, at-risk (existing logic), and new milestone-notification events into one reverse-chron list on the dashboard (NOT replacing existing tabs) | Moderate | Collapses 3 existing signals into one scannable feed. Inline-on-dashboard is the pattern that out-performs notification centers for small-team coaches (TrueCoach, CoachAccountable both do this). |
| 2.10 | **"This week's average"** comparison on top-3 leaderboard — show cohort average hours underneath the top 3 so middle/bottom-ranked students see a positive reference point rather than feeling excluded | Simple | Mitigates the "top-3-only" demotivation effect documented in leaderboard-fatigue research. |
| 2.11 | **Stat card compact/expanded toggle** — coaches with >20 students want to collapse the cards to a dense strip | Moderate | Nice-to-have; defer unless owner requests. |

### Anti-features

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|-----------|
| **Bottom-3 / "at-risk" leaderboard** displayed publicly anywhere | Publicly naming laggards = demotivation, resentment, and violates the "no public rankings" spirit of the v1.0 out-of-scope list | Keep at-risk as existing private coach-only alerts; use the existing skip-tracker for "who's slipping" signal |
| **Leaderboard visible to students** | Out of scope (no rankings in V1); research confirms consistently-low rankings destroy motivation | Top-3 is coach-only; individual students see only their own analytics |
| **Revenue / deal goals displayed as big gauges** | Implies the coach has a quota — they don't, they mentor. Wrong affordance | Show absolute numbers + week-over-week delta |
| **10+ metrics on the homepage** | Every sales-dashboard guide from 2023–2026 flags "metric overload" as the top failure mode | Enforce 4–6 cards; push extras to /coach/analytics |
| **Auto-refresh / live polling on the stats** | Adds DB load at 5k scale, no real-time requirement for weekly metrics | 60s cache is plenty; manual refresh button if needed |
| **Trendline sparklines on every stat card** | Visual clutter + chart lib rendered N times per card = perf hit | Either number + delta arrow, OR full chart on analytics page — not both |

### Leaderboard guidance (calling out what competitors get wrong)

**Pattern research (Spinify, cluelabs, Medium):**
- Top-3 with cohort average shown underneath = motivates winners, doesn't demotivate middle.
- Reset weekly (already decided, v1.5 D-13) — rolling leaderboards prevent the "locked out forever" feeling.
- Do NOT show ordinal rank (1st/2nd/3rd medal icons) — show hours numeric with names.
- Do NOT send notifications when someone drops off the top-3.
- Coach-only visibility — students never see this board (project already rules this out).

### Dependencies
- Requires: coach_id → assigned_student_ids join (already exists via assignments table); the `get_student_analytics` RPC pattern from Feature 1.
- Reuses: ISO Mon-Sun week helper from v1.4 skip tracker.

---

## Feature 3 — Coach Analytics Tab / Page (Full) (`/coach/analytics`)

### Table stakes

| # | Feature | Complexity | Why it's table stakes |
|---|---------|------------|-----------------------|
| 3.1 | **Paginated student list with sorting** — 25 per page (v1.5 D-04). Columns: Name, Current Roadmap Step, Hours (this week), Emails (this week), Deals Closed (total), Last Active (relative), Status (active/inactive/at-risk chip) | Moderate | Sortable list is the core artifact coaches spend 80% of their time on. |
| 3.2 | **Sort by each column, asc/desc**; default sort = "Last Active desc" | Moderate | Expected UX. Server-side sort (ORDER BY in RPC) for pagination correctness. |
| 3.3 | **Active / Inactive breakdown** — top-of-page summary: "18 active · 3 inactive · 2 at-risk" with active = activity in last 7 days. See "inactive definition" below | Simple | Primary question a coach opens this page to answer. |
| 3.4 | **Deal trend chart** — line or bar, count of deals per week across all assigned students, last 12 weeks. Second series (optional toggle): revenue per week | Moderate | Expected on any sales-coach view. Aggregate-only (no per-student lines at this scale — becomes unreadable). |
| 3.5 | **Leaderboards: top 5 by hours (weekly), top 5 by emails (weekly), top 5 by deals (all-time)** — three separate top-5s, each clickable to student detail | Moderate | Per PROJECT.md. Use top-5 here (not top-3) because this is the deep view, not the homepage. |
| 3.6 | **Search / filter by student name** on the student list | Simple | Tables >15 rows need this. |
| 3.7 | **Pagination controls** with total count, page X of Y, 25/page | Simple | v1.5 D-04. |
| 3.8 | **Time range selector on trends + leaderboards** — 7d / 30d / 90d / All. Student list respects period for "hours this period" / "emails this period" columns | Moderate | Standard. |
| 3.9 | **Export CSV** of the student list (current filters applied) | Simple | Table-stakes for manager-type users; serve as attachment from API route. |

### Differentiators

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 3.10 | **Cohort comparison** — group students by signup-week cohort, show avg roadmap step by cohort age | Complex | Only valuable once multiple cohorts exist. Defer unless owner explicitly wants it. Flag for v1.6. |
| 3.11 | **Funnel view** — Total Students → Completed Setup → First Outreach → First Influencer Signed → First Brand Reply → First Deal. Counts + conversion rate per step | Moderate | High-signal visualization for an influencer-marketing accelerator. Directly maps to roadmap steps — data already exists. |
| 3.12 | **At-risk student list panel** — students with skip_count >= 3 in current week OR no activity in 7d. Separate from the main table, surfaced as a callout | Simple | Reuses existing skip-tracker logic; just aggregates. |
| 3.13 | **Revenue + margin trend** as second panel under deal trend | Simple | Same RPC, different series. |
| 3.14 | **Per-student mini-profile on row-hover** (or row-click → expand) — shows skip count, last report date, AI-chat-used flag | Moderate | Reduces trips to student detail page. |

### Anti-features

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|-----------|
| **Predictive "likelihood to close" scoring** | ML-free platform; building a scoring model is out of scope and ethically fraught for mentorship | Funnel counts + deadline chips |
| **"Grade" each student A–F** | Reductive, demotivating when leaked to student via screen-share | Status chip: active / inactive / at-risk — factual only |
| **Per-student line series on the deal trend chart** at >10 students | Becomes unreadable (spaghetti chart); doesn't scale to 5k | Aggregate, then drill into individual student detail page |
| **Download all students' raw daily reports as one CSV** | PII + report comments leak; not needed for analytics | Summary CSV only |
| **Email digests / scheduled PDFs of analytics** | Out of scope ("Email notifications — V2+") | Rely on the in-app notification feed from Feature 5 |
| **Real-time refresh / WebSocket** | Contradicts v1.4 D-07 decision (chat intentionally polled, not realtime) | 60s cache, manual refresh button |

### "Inactive" definition — recommend this, flag for owner confirmation
- **Active** = ≥1 work session started OR ≥1 daily report OR ≥1 outreach update in last **7 days**
- **Inactive** = no activity of any kind in **7+ days**
- **At-risk** = existing skip-tracker logic (≥3 skipped weekdays this ISO week)

Rationale: 7 days matches the Mon-Sun cadence already chosen. 30-day SaaS default is too loose for a daily-accountability program. Mark as **v1.5 D-14 pending** — needs Abu Lahya confirmation.

### Common-columns research (sales/coach platforms)
Most consistent set across Salesforce, HubSpot, TrueCoach, Coach Catalyst coach-list tables: `Name · Status · Key Activity Metric · Deals/Outcomes · Last Active · Row Action`. Our column set above matches this pattern exactly.

### Dependencies
- Requires: `get_coach_analytics(coach_id, range, page, sort)` RPC with server-side pagination + sort; deal-trend RPC (can be same or separate).
- Reuses: Feature 1's aggregation helpers; existing at-risk / skip-tracker logic.

---

## Feature 4 — Staff-Logged Deals (coach/owner log on behalf of student)

### Table stakes

| # | Feature | Complexity | Why it's table stakes |
|---|---------|------------|-----------------------|
| 4.1 | **`logged_by uuid` column on `deals`** (nullable) — per v1.5 D-09. Null = student self-logged, set = coach/owner user_id. Migration also adds `logged_by` index for attribution queries | Simple | Foundation. |
| 4.2 | **RLS update** — coach/owner INSERT allowed with constraint that `logged_by` must equal `auth.uid()` and `user_id` (student) must be in their assigned-students set (coach) or any student (owner). Use `(SELECT auth.uid())` initplan pattern (v1.5 D-03) | Moderate | Defense in depth. |
| 4.3 | **"Add Deal" button on coach deals tab** (and owner) — opens the same form used by students in Phase 41, prefilled with student_id from the URL context | Simple | Consistent UI with student flow. |
| 4.4 | **Attribution chip on deal rows** — when `logged_by IS NOT NULL AND logged_by != user_id`, show `Logged by {coach_name}` pill next to the date. Student sees this chip too on their own analytics/deals list | Simple | Non-negotiable transparency. Users must always know who entered data about them. |
| 4.5 | **Audit-trail columns** — add `created_at` (if not already), `updated_at`, `updated_by` to deals. Trigger on UPDATE sets `updated_at = now()` and records the `auth.uid()` into `updated_by` | Moderate | Audit-trail research (CRM convention): creator + last-editor + timestamps is the minimum expected set. |
| 4.6 | **Edit/Delete permissions** — **recommend:** coach/owner who created the deal can edit/delete it; student can edit/delete deals they themselves logged. Student **cannot** edit coach-logged deals (can request correction via chat). Owner can always edit anything | Moderate | Matches CRM norm: "only the logger or an admin can mutate" prevents students from rewriting revenue numbers their coach verified. |
| 4.7 | **Attribution also surfaces on coach dashboard stats** — "Coach-logged deals: 12 · Student-logged deals: 38" small breakdown on `/coach/analytics` | Simple | Keeps the coach honest about how much they're entering vs the student. |
| 4.8 | **Rate limiting** on the new INSERT path (30 req/min, existing pattern) | Simple | v1.2 convention. |

### Differentiators

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 4.9 | **"Verified" flag** — coach can mark a student-logged deal as verified (separate from logged_by). Shows a check icon. Owner aggregate can filter to "verified only" | Moderate | Addresses the self-reporting trust problem inherent in accelerators. High value. |
| 4.10 | **Soft delete** (archived_at) instead of hard delete | Simple | Preserves audit trail; standard CRM pattern. |
| 4.11 | **Change log per deal** — small "history" popover showing every edit | Complex | Useful but maintenance cost non-trivial. Defer unless disputes become a pattern. |
| 4.12 | **Bulk import CSV** for coaches migrating data from elsewhere | Complex | Only if an actual migration need surfaces. |

### Anti-features

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|-----------|
| **Hiding `logged_by` from the student** | Erodes trust; students will eventually notice deals they didn't enter and feel surveilled | Always show attribution to the student whose deal it is |
| **Letting coach edit deals they didn't create** (without explicit owner permission) | Two coaches overwriting each other = data corruption. Violates "who owns this record" CRM discipline | Owner-only for cross-coach edits |
| **Silent overwrite on concurrent edits** | Lost-update bug | Display `updated_at` — stale-form warnings if timestamp changes |
| **"Enter deal as student" impersonation** (setting `logged_by = null` to look self-entered) | Fraudulent attribution, breaks analytics | `logged_by` defaults to `auth.uid()` on insert; enforce at RLS |
| **Deleting deals without confirmation** | Losing revenue records destroys analytics retroactively | Modal confirm + soft delete |
| **Notifying the student every time a coach edits their deal** | Notification fatigue on small corrections | Only notify on create; edits visible in attribution chip on next view |

### Dependencies
- Requires: migration for `logged_by`, `updated_at`, `updated_by` + trigger; RLS policy updates; share deal form component between student/coach/owner.
- Affects: Feature 1 (student analytics table shows chip), Feature 3 (coach analytics breakdown), Feature 5 (notifications fire on coach-logged deals too).
- Student_diy: no coach → always self-logged → `logged_by` will always be null or equal to user_id. No UI change needed for student_diy.

---

## Feature 5 — Milestone Notifications for Coaches

### Table stakes

| # | Feature | Complexity | Why it's table stakes |
|---|---------|------------|-----------------------|
| 5.1 | **Reuse the existing 100+ hrs / 45 days notification pattern** (v1.5 D-08). Same surface: coach-side computed, dismissable via `alert_dismissals`, badge in sidebar | Moderate | Don't rebuild plumbing. |
| 5.2 | **Four new milestone triggers per PROJECT.md:** Tech/Email Setup Finished (step TBC — v1.5 D-06 flagged); 5 Influencers Closed (Step 11); First Brand Response (Step 13); Closed Deal (EVERY deal — v1.5 D-07) | Moderate | Explicit spec. |
| 5.3 | **Idempotency per (student, milestone_type, optional_nonce)** — Tech Setup / 5 Influencers / First Brand Response fire ONCE per student ever; Closed Deal fires once per deal_id | Moderate | Prevents duplicate toasts on re-aggregation. Standard idempotent-consumer pattern (record processed event IDs). |
| 5.4 | **Storage table `milestone_events`** — `id, student_id, coach_id, type, payload jsonb, created_at, deal_id nullable`. RLS: coach sees events for their students, owner sees all, students do NOT see this table | Simple | Makes idempotency checkable (`ON CONFLICT (student_id, type, deal_id)`). |
| 5.5 | **Dismiss per event** — reuses `alert_dismissals` with a key like `milestone:{event_id}`. Dismissed events don't show in badge count but stay in feed history | Simple | v1.0 pattern. |
| 5.6 | **Sidebar badge updated** — integer count of undismissed milestone events across all assigned students; navigates to the feed (see 5.8) | Simple | In scope per PROJECT.md. |
| 5.7 | **Event payload** contains student name, milestone type, deal info (if applicable), and a deep link to that student's detail page | Simple | Click → action. |
| 5.8 | **Notification feed inline on coach dashboard** — reverse-chron list, ~10 most recent, "See all" link to a `/coach/notifications` page (or a modal). Grouped by student when 3+ events from same student | Moderate | See pattern guidance below. |

### Differentiators

| # | Feature | Complexity | Value |
|---|---------|------------|-------|
| 5.9 | **Owner sees an aggregate roll-up** — count of milestones hit platform-wide this week on owner dashboard | Simple | Reuses same events table, different query. |
| 5.10 | **Milestone chip on student detail page** — timeline of achieved milestones at the top of coach/owner student detail | Simple | Context when coaching. |
| 5.11 | **Mark-all-read** on the feed page | Simple | UX nicety. |
| 5.12 | **Per-milestone-type mute** (coach preference: "don't notify me on every deal, only first-of-month") | Complex | Wait for a coach to actually ask. |
| 5.13 | **Per-event comment thread** (coach leaves a congratulations note that feeds into chat) | Complex | Bridges to existing chat system — interesting but defer. |

### Anti-features

| Anti-feature | Why avoid | Do instead |
|--------------|-----------|-----------|
| **Email or push notifications** | Out of scope ("Email notifications — V2+"); no push infra exists | In-app only |
| **Firing the "First Brand Response" notification multiple times if the roadmap step is undone/redone** | Duplicate-fire annoyance | Idempotency key `(student_id, 'first_brand_response')` unique constraint |
| **Notifying student of their own milestone** | Risks gamification creep which is explicitly out of scope for v1.5 (and v2 territory); the point is coaches celebrate with students, not the app gamifying | Coach-only; coaches can manually message students to congratulate via existing chat |
| **Silent aggregation** (events exist but nothing visibly changes) | Defeats the purpose | Badge MUST increment on new event |
| **Firing milestones retroactively on the migration that creates the feature** | Would flood coaches with historical events on launch day | Backfill with `created_at` capped at migration timestamp OR skip backfill — only fire forward |
| **Notification-center-only** (no inline feed on dashboard) | Research: coaches with <30 students prefer inline feeds because they see signals in context; notification center is a second click | Both inline top-10 AND dedicated feed page |
| **Notification-inline-only-on-each-student-row** | Forces coach to scan every row | Central feed + optional chip on student row |

### Notification center vs inline — recommendation
**Ship both.** Inline "needs attention" feed on coach dashboard (newest 10), plus `/coach/notifications` feed page for history. Badge count on sidebar drives both. Dismiss works on either. This matches TrueCoach and CoachAccountable.

### Idempotency implementation sketch
```
milestone_events (
  id uuid primary key,
  student_id uuid,
  type text,        -- 'tech_setup' | '5_influencers' | 'first_brand_response' | 'closed_deal' | '100hr_45d'
  deal_id uuid null,
  created_at timestamptz,
  unique (student_id, type, coalesce(deal_id, '00000000-0000-0000-0000-000000000000'::uuid))
)
```
Detection runs nightly (pg_cron, reuse v1.2 pattern) AND on-write (deal insert trigger, roadmap step complete trigger). Both paths `INSERT ... ON CONFLICT DO NOTHING`.

### Dependencies
- Requires: new `milestone_events` table + RLS; detection logic (triggers or pg_cron); reuse existing `alert_dismissals` table; sidebar badge query update.
- Blocks: nothing downstream in v1.5.
- **Open decision D-06:** which roadmap step is "Tech/Email Setup Finished"? Flagged for Monday stakeholder meeting. Do not code until confirmed.

---

## Cross-feature Dependency Graph

```
Feature 1 (student analytics RPC)
   │
   ├──► Feature 2 (coach dashboard reuses aggregation shape)
   │        │
   │        └──► Feature 3 (coach analytics — superset of dashboard queries)
   │
   ├──► Feature 4 (deals tables read by both 1 and 3; logged_by chip shown in 1)
   │
   └──► Feature 5 (milestone events reference deals from F4, roadmap steps)
               │
               └──► Badge + feed surfaces on F2 dashboard
```

Build order per v1.5 D-10 (sequential): **F1 → F2 → F3 → F4 → F5**. Confirmed — each depends on the prior one's RPCs or data.

---

## MVP Recommendation (if scope has to shrink)

Ship tier by tier:
1. **Must ship (MVP):** 1.1–1.8, 2.1–2.8, 3.1–3.9, 4.1–4.8, 5.1–5.8 — the full table-stakes column.
2. **Ship if time allows:** 2.9 "needs attention" feed (huge coach UX win), 3.11 funnel view, 4.9 verified flag.
3. **Defer to v1.6:** 1.9–1.12, 2.10–2.11, 3.10 cohort, 3.12–3.14, 4.10–4.12, 5.9–5.13.

---

## Open questions for stakeholder

| # | Question | Needed by |
|---|----------|-----------|
| Q1 | "Tech/Email Setup Finished" = which roadmap step? (v1.5 D-06) | Feature 5 coding |
| Q2 | "Inactive" = 7 days of zero activity — confirm? | Feature 3 coding |
| Q3 | Should deal edits by coach trigger any student-side notification? Current recommendation: no. | Feature 4 coding |
| Q4 | Chart library final pick — recharts vs shadcn/charts wrapper (see STACK.md, v1.5 D-11) | Feature 1 coding |
| Q5 | Closed-Deal milestone on coach-logged deals too, or only student-logged? Recommendation: ALL deals (simplest + consistent with v1.5 D-07). | Feature 5 coding |

---

## Confidence by section

| Section | Confidence | Basis |
|---------|------------|-------|
| Table-stakes lists | HIGH | Converge across Salesforce, HubSpot, TrueCoach, Coach Catalyst, learning-analytics research |
| Differentiators | MEDIUM | Product-specific judgment; confirmed compatible with existing architecture |
| Anti-features | HIGH | Backed by explicit PROJECT.md out-of-scope items and published research on dashboard anti-patterns (Wiley 2023 on gamification anxiety; Spinify/cluelabs on leaderboard demotivation) |
| Inactive-user threshold (7d) | MEDIUM | Standard SaaS is 30d; 7d is a judgment call matching daily-accountability cadence — flagged for stakeholder |
| Idempotency pattern for notifications | HIGH | Context-standard idempotent-consumer pattern (microservices.io, bytebytego) |
| Logged-by / audit-trail conventions | MEDIUM | CRM convention well-established; no single canonical spec — recommendation grounded in principle |

---

## Sources

- [Sales Performance Dashboard Guide for 2026 — Everstage](https://www.everstage.com/sales-performance/sales-performance-dashboard)
- [10 Sales Performance Dashboard Examples — CaptivateIQ](https://www.captivateiq.com/blog/sales-performance-dashboard-examples)
- [Sales performance dashboard: 13 examples — HubSpot](https://blog.hubspot.com/sales/sales-dashboard)
- [8 innovative sales dashboard examples — Gong](https://www.gong.io/blog/sales-dashboard-example)
- [What is a Sales Dashboard? — Salesforce](https://www.salesforce.com/sales/analytics/sales-dashboard-examples/)
- [Investigating the impact of a gamified learning analytics dashboard — Wiley (Alam 2023)](https://onlinelibrary.wiley.com/doi/10.1111/jcal.12853)
- [A Tale of Two Institutions: gamified student response systems and student anxiety — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8734391/)
- [Investigating the impact of gamification components on online learners' engagement — Smart Learning Environments](https://slejournal.springeropen.com/articles/10.1186/s40561-024-00336-3)
- [Could Gamification Designs Enhance Online Learning Through Personalization? — INFORMS](https://pubsonline.informs.org/doi/10.1287/isre.2022.1123)
- [Leaderboard Fatigue Is Real — Spinify](https://spinify.com/blog/leaderboard-fatigue-is-real-heres-how-to-fix-it/)
- [The Psychology of Leaderboards in Instructional Design — cluelabs](https://cluelabs.com/blog/the-psychology-of-leaderboards-in-instructional-design/)
- [Top 10 Best Practices for Gamification and Sales Leaderboard — Spinify](https://spinify.com/blog/top-10-sales-leaderboard-best-practices/)
- [11 SaaS Milestone Emails to Celebrate User Wins — Encharge](https://encharge.io/saas-milestone-emails/)
- [Idempotent requests in notification infrastructure — Fyno](https://www.fyno.io/blog/idempotent-requests-in-notification-infrastructure-cm4s7axck002x9jffvml6fx1y)
- [Microservices Pattern: Idempotent Consumer — microservices.io](https://microservices.io/patterns/communication-style/idempotent-consumer.html)
- [Mastering Idempotency: Building Reliable APIs — ByteByteGo](https://blog.bytebytego.com/p/mastering-idempotency-building-reliable)
- [What makes a user active vs inactive? — Fullstory](https://help.fullstory.com/hc/en-us/articles/360020624734-What-makes-a-user-active-vs-inactive)
- [Active Users are a Vanity Metric — Sixteen Ventures](https://sixteenventures.com/active-users-vanity-metric)
- [Coach's Notification Settings — TrueCoach](https://help.truecoach.co/en/articles/2403627-coach-s-notification-settings)
- [Notification Center — Coach Catalyst](https://coachcatalyst.com/solutions/notification-center)
- [8 Top React Chart Libraries for Data Visualization in 2026 — Querio](https://querio.ai/articles/top-react-chart-libraries-data-visualization)
- [My Take on React Chart Libraries — Kyle Gill](https://www.kylegill.com/essays/react-chart-libraries)
