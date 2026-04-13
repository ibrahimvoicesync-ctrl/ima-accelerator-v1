# Architecture: v1.5 Analytics Pages, Coach Dashboard & Deal Logging

**Domain:** Performance platform at 5k concurrent students — Next.js 16 App Router + Supabase
**Researched:** 2026-04-13
**Mode:** Subsequent-milestone integration architecture
**Overall confidence:** HIGH (all recommendations grounded in existing migrations 00001–00020 + v1.2 Phase 19–24 baselines)

Migration numbers assume deals landed as `00021_deals.sql` per ROADMAP Phase 38. First v1.5 migration is therefore **00022**.

---

## 1. Analytics Query Architecture

### 1.1 Reuse `student_kpi_summaries` vs compute-on-read

**Recommendation:** Read **lifetime totals** from `student_kpi_summaries` (v1.2 Phase 21). Compute **time-series windows** (trailing 30/90 days) live from `daily_reports` / `work_sessions` / `deals` with supporting indexes. Do **not** extend `student_kpi_summaries` with window fields — it is schema-intentionally lifetime-only (see `00011_write_path.sql` Section 0 scope note).

**Why this split:**

| Metric family | Freshness need | Source | Rationale |
|---------------|----------------|--------|-----------|
| Lifetime totals (outreach, hours, deals count/revenue/profit) | 24h stale OK | `student_kpi_summaries` + deals rollup | Nightly `refresh_student_kpi_summaries` already does the work; P95 < 1s proven at 5k |
| Trailing windows (last 7/30/90 days) | Must be live | `daily_reports` + `work_sessions` indexes | Windows slide daily; stale snapshot would miss yesterday's data |
| Chart series (weekly buckets over N weeks) | Live | `daily_reports` + `deals` with `date_trunc('week', ...)` | Aggregation is cheap at single-student scope (<200 rows/student lifetime) |

**At 5k students scale:** Per-student analytics page is a single user's view — aggregating 90 days of one student's reports (~90 rows) + work_sessions (~400 rows) + deals (<50 rows) is cheap (<50ms) if indexes exist. No pre-aggregation needed for per-student pages.

**Anti-recommendation — do NOT add `analytics_daily_snapshots`:**
- Write amplification: every report submit would need a trigger to write the snapshot
- Storage: 5k students × 180 days × 5 metrics = 4.5M rows for marginal read gain
- v1.2 Phase 21 already proved the single-summary-row approach handles the only expensive case (lifetime aggregates across all students' reports)

### 1.2 One RPC per chart vs batch RPC

**Recommendation:** **One batch RPC per page** (`get_student_analytics`, `get_coach_analytics`). Return a `jsonb` envelope with named keys per chart. Precedent: `get_student_detail` (00011_write_path Section 4) returns `sessions / roadmap / reports / lifetime_outreach / today_outreach / ...` in one round trip.

**Why batch:**
- 1 network round trip vs 4–6
- Single RLS check, single auth check, single `SET search_path`
- Matches v1.2 Phase 20 "RPC consolidation" pattern (owner 8→2 round trips)
- Easier to wrap in `unstable_cache` with one cache key

**Signatures:**

```sql
-- v1.5 Phase: student analytics
CREATE FUNCTION public.get_student_analytics(
  p_student_id uuid,
  p_window_days integer DEFAULT 90,   -- trailing window for trends
  p_today date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;
-- Returns:
-- {
--   lifetime: { outreach_total, hours_total, deals_count, revenue_total, profit_total },
--   outreach_weekly: [{ week_start, brands, influencers, total }, ...],
--   deals_history: [{ deal_number, revenue, profit, margin_pct, closed_at }, ...],
--   hours_weekly: [{ week_start, hours }, ...],
--   roadmap: [{ step_number, status, completed_at, target_days, deadline_status }, ...]
-- }

-- v1.5 Phase: coach homepage stats + leaderboard (single call)
CREATE FUNCTION public.get_coach_dashboard(
  p_coach_id uuid,
  p_week_start date,     -- Monday of current ISO week (computed in TS)
  p_today date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;
-- Returns:
-- {
--   stats: { deals_closed, revenue_total, profit_total, avg_roadmap_step, total_emails },
--   recent_reports: [{ report_id, student_id, student_name, date, star_rating, ... }], -- 3 rows
--   top_hours_week: [{ student_id, student_name, hours_this_week }, ...] -- top 3
-- }

-- v1.5 Phase: full coach analytics page
CREATE FUNCTION public.get_coach_analytics(
  p_coach_id uuid,
  p_window_days integer DEFAULT 30,
  p_today date DEFAULT CURRENT_DATE,
  p_leaderboard_limit integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public;
-- Returns:
-- {
--   totals: { active_students, inactive_students, deals_closed_window, revenue_window },
--   leaderboard_deals: [{ student_id, student_name, deals_count, revenue, profit }, ...],
--   leaderboard_emails: [{ student_id, student_name, outreach_total }, ...],
--   deals_trend_weekly: [{ week_start, deals_count, revenue }, ...],
--   active_inactive_split: { active_7d, inactive_3_to_7d, inactive_7_plus }
-- }
```

All three are `SECURITY DEFINER STABLE` — same pattern as `get_student_detail`, `get_weekly_skip_counts`, `get_sidebar_badges`. All called via admin client from server components.

### 1.3 Caching strategy

**Recommendation:** `unstable_cache` with 60s TTL (v1.5 D-02) and user-scoped tags. Invalidate via `revalidateTag` from relevant mutation routes.

```ts
// src/lib/analytics.ts (new)
import { unstable_cache, revalidateTag } from "next/cache";

export const getStudentAnalytics = unstable_cache(
  async (studentId: string) => {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_student_analytics", {
      p_student_id: studentId,
      p_window_days: 90,
      p_today: getTodayUTC(),
    });
    return data;
  },
  ["student-analytics"],                         // base key
  { tags: (studentId) => [`analytics-student-${studentId}`], revalidate: 60 }
);
```

**Invalidation triggers (add to existing routes):**

| Mutation | Routes to modify | Tags to revalidate |
|----------|------------------|--------------------|
| Submit/update daily report | `src/app/api/reports/route.ts` | `analytics-student-${studentId}` |
| Complete work session | `src/app/api/work-sessions/[id]/route.ts` | `analytics-student-${studentId}` |
| Create/edit/delete deal | `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/route.ts` | `analytics-student-${studentId}`, `analytics-coach-${coachIdOfStudent}` |
| Complete/undo roadmap step | `src/app/api/roadmap/...` (existing) | `analytics-student-${studentId}` |

The deals POST route already calls `revalidateTag("deals-${profile.id}")` — extend with the new analytics tags.

**Do NOT use React `cache()` for analytics** — it deduplicates within a single render but not across requests. `unstable_cache` is required for 60s TTL.

### 1.4 Indexes needed

**Already present (from 00009_database_foundation.sql):** `daily_reports(student_id, date)`, `work_sessions(student_id, date)`. These cover 95% of analytics reads. Confirm before assuming; migration 00022 should audit.

**New indexes required for v1.5 queries:**

```sql
-- Coach fan-out: "my students' deals in last N days" (leaderboard + trend)
-- deals(student_id) PK already on id; v1.2 pattern suggests:
CREATE INDEX IF NOT EXISTS idx_deals_student_created
  ON public.deals(student_id, created_at DESC);

-- Coach weekly top-3 hours: "SUM(work_sessions.session_minutes) WHERE student_id IN (...) AND date BETWEEN ..."
-- Covered by existing (student_id, date) but only for status='completed' rows; add partial if hot:
CREATE INDEX IF NOT EXISTS idx_work_sessions_completed_student_date
  ON public.work_sessions(student_id, date)
  WHERE status = 'completed';
```

**Milestone-notification support index:**
```sql
-- Supports fan-out in get_coach_milestones over coach's students' roadmap states
CREATE INDEX IF NOT EXISTS idx_roadmap_progress_student_status
  ON public.roadmap_progress(student_id, step_number, status);
```

---

## 2. Coach Homepage Stats

### 2.1 Single batch RPC — `get_coach_dashboard`

Already proposed in §1.2. Returns 4 stat card values + 3 recent reports + top-3 hours in one JSON envelope. This replaces the current 4-query Promise.all in `src/app/(dashboard)/coach/page.tsx` (lines 46–68: sessions + reports + roadmap + skip_counts) with a single RPC — same consolidation pattern as v1.2 Phase 20.

**Migrated coach page flow:**

```ts
// src/app/(dashboard)/coach/page.tsx (rewritten, post-Phase X)
const user = await requireRole("coach");
const admin = createAdminClient();
const weekStart = getISOWeekStartUTC(new Date()); // Monday, same as skip tracker D-01
const { data: dashboard } = await admin.rpc("get_coach_dashboard", {
  p_coach_id: user.id,
  p_week_start: weekStart,
  p_today: getTodayUTC(),
});
// dashboard.stats, dashboard.recent_reports, dashboard.top_hours_week
```

Keep the existing enriched student card grid (at-risk detection) — that logic is orthogonal to the new stats and can continue using its 4 queries, OR be folded into `get_coach_dashboard` in a follow-up. Recommendation: **fold into `get_coach_dashboard` now** to consolidate all coach-home reads into one RPC (extend the return envelope with `students` array containing the at-risk enrichment data).

### 2.2 Scoping to coach's assigned students

**Recommendation:** Single JOIN at the top of the RPC, not a prep array.

```sql
-- Inside get_coach_dashboard — recent_reports example
SELECT jsonb_agg(jsonb_build_object(
  'report_id', dr.id, 'student_id', dr.student_id, 'student_name', s.name,
  'date', dr.date, 'star_rating', dr.star_rating, 'hours_worked', dr.hours_worked
) ORDER BY dr.submitted_at DESC)
FROM daily_reports dr
JOIN users s ON s.id = dr.student_id
WHERE s.coach_id = p_coach_id
  AND s.status = 'active'
  AND dr.submitted_at IS NOT NULL
LIMIT 3;
```

**Why JOIN over `IN (SELECT …)`:** Postgres planner handles both fine with `idx_users_coach_id` (exists from 00001 — verify), but JOIN is idiomatic and composes with the other aggregations in the same CTE chain. The `get_sidebar_badges` coach block (00014 line 81–89) uses JOIN — match that pattern.

**Do NOT prep a TS array of student_ids and pass to RPC** — it adds a round trip and reduces planner visibility. The skip tracker RPC accepts `p_student_ids uuid[]` only because the caller (coach page) already had the array in-memory from its own student query; analytics RPCs compute the set server-side.

### 2.3 Weekly top-3 hours (Mon-Sun ISO week)

**Recommendation:** Pass `p_week_start date` (Monday) computed in TS, same as skip tracker convention (v1.4 D-01, 00016_skip_tracker.sql).

```sql
-- Inside get_coach_dashboard
SELECT jsonb_agg(x ORDER BY hours_this_week DESC)
FROM (
  SELECT
    ws.student_id,
    s.name AS student_name,
    ROUND(SUM(ws.session_minutes)::numeric / 60.0, 2) AS hours_this_week
  FROM work_sessions ws
  JOIN users s ON s.id = ws.student_id
  WHERE s.coach_id = p_coach_id
    AND s.status = 'active'
    AND ws.status = 'completed'
    AND ws.date >= p_week_start
    AND ws.date <= p_week_start + 6
  GROUP BY ws.student_id, s.name
  ORDER BY hours_this_week DESC
  LIMIT 3
) x;
```

Index `idx_work_sessions_completed_student_date` (proposed §1.4) covers this predicate. At 5k students / ~50 per coach × 7 days × ~4 sessions/day = ~1,400 rows scanned per coach — trivial.

---

## 3. Milestone Notifications

### 3.1 Architecture decision: **Hybrid (on-read compute + existing dismissal table)** — extends the 100h pattern from 00014

**Rejecting the three alternatives as proposed, combining their best parts:**

| Option | Reject reason |
|--------|---------------|
| (a) Pure DB triggers writing to `coach_notifications` | Triggers fire on every `daily_reports` / `work_sessions` / `roadmap_progress` / `deals` INSERT — adds write-path latency on the hottest tables; violates v1.2 write-path audit (4 DB calls optimal) |
| (b) Scheduled pg_cron nightly | 24h stale for "Closed Deal" notifications that D-07 requires be visible immediately |
| (c) Hybrid on-write flag + cache | Closest to correct — refined below |

**Recommended hybrid:**

1. **Computed at read time** in a new `get_coach_milestones(p_coach_id)` RPC that fans out the 4 milestone types across the coach's assigned students (same pattern as 00014 lines 93–109). Already proven: 100h milestone loops ~50 students × ~400 work_session rows each, fast.
2. **Dismissals tracked in existing `alert_dismissals` table** with new `alert_key` prefixes:
   - `milestone_tech_setup:{student_id}` — Tech/Email Setup (roadmap step TBC per D-06)
   - `milestone_5_influencers:{student_id}` — Step 11 completed
   - `milestone_brand_response:{student_id}` — Step 13 completed
   - `milestone_closed_deal:{student_id}:{deal_id}` — per-deal (D-07: every deal, so idempotency key includes deal_id)
3. **RPC invoked from** (a) `get_sidebar_badges` (extend coach block) for badge count; (b) `/coach/alerts` page for list; (c) a new tiny widget on `/coach` dashboard if "at a glance" visibility is wanted.
4. **Invalidation:** `unstable_cache` with 60s TTL on `get_coach_milestones` + `revalidateTag('coach-milestones-${coachId}')` from `POST /api/deals` (deal closed), `POST /api/reports` (only if a report submission triggers a milestone path — none currently), `POST /api/roadmap/steps` (step completion). The 60s TTL matches v1.5 D-02.

**Cost at 5k scale:** 200 checks per coach dashboard view is fine. Per coach: 50 students × 4 milestone types = 200 predicate evaluations, each O(1) against indexed columns (`roadmap_progress(student_id, step_number, status)`, `deals(student_id, created_at)`). 60s cache means a coach viewing dashboard then analytics tab pays the cost once, not twice.

**Why no new `coach_notifications` table:** The existing `alert_dismissals` table (00004_alert_dismissals.sql + coach policies in 00014) already models exactly this use case — dismissible computed alerts with idempotent keys. Adding a separate notifications table duplicates the pattern, doubles the RLS policy surface, and forces a triggers-everywhere write path. The v1.5 D-08 decision explicitly says "reuse existing pattern" — honor it.

### 3.2 Idempotency

Idempotency is enforced by the `alert_key` shape itself:

| Milestone | Key format | Re-fires? |
|-----------|-----------|-----------|
| Tech/Email Setup | `milestone_tech_setup:{student_id}` | No — once dismissed, gone |
| 5 Influencers (Step 11) | `milestone_5_influencers:{student_id}` | No |
| First Brand Response (Step 13) | `milestone_brand_response:{student_id}` | No |
| Closed Deal (D-07: every deal) | `milestone_closed_deal:{student_id}:{deal_id}` | **Yes** per new deal — unique deal_id in key |

The computed-minus-dismissed pattern (00014 line 120: `GREATEST(0, v_milestone_count - v_milestone_dismissed)`) handles the subtraction automatically.

**Config sync (already precedented in 00014 Section 2 header):**

Add to `src/lib/config.ts` new block:
```ts
export const MILESTONE_CONFIG = {
  techSetupStep: 6,            // TBC per D-06 — Abu Lahya confirms Monday
  influencersClosedStep: 11,
  brandResponseStep: 13,
  // 100h is already COACH_CONFIG.milestoneMinutesThreshold / milestoneDaysWindow
} as const;
```

And SYNC comments in the RPC matching 00014's style.

### 3.3 Sidebar badge count

**Recommendation:** Extend existing `get_sidebar_badges` (00014) coach branch. Do **not** create a separate RPC.

```sql
-- Inside get_sidebar_badges, coach branch, after existing 100h milestone block:
-- Add counts for the 4 new milestone types (deduped by alert_key shape).
-- Return becomes:
RETURN jsonb_build_object(
  'unreviewed_reports', v_unreviewed_count,
  'coach_milestone_alerts', GREATEST(0,
    v_milestone_100h_count
    + v_milestone_tech_setup_count
    + v_milestone_5_influencers_count
    + v_milestone_brand_response_count
    + v_milestone_closed_deal_count
    - v_dismissed_count
  )
);
```

Single badge key `coach_milestone_alerts` already exists in NAVIGATION (`src/lib/config.ts` line 300). No new badge wiring — UI is a free extension.

---

## 4. `deals.logged_by` Column

### 4.1 Migration shape (migration **00022_deals_logged_by.sql**)

```sql
-- ALTER TABLE — nullable (null = student self-logged, legacy rows preserved)
ALTER TABLE public.deals
  ADD COLUMN logged_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deals.logged_by IS
  'User who logged the deal. NULL = student self-logged (includes legacy v1.4 rows). Set = coach or owner who logged on student''s behalf. See v1.5 D-09.';

-- Attribution query support
CREATE INDEX IF NOT EXISTS idx_deals_logged_by ON public.deals(logged_by) WHERE logged_by IS NOT NULL;
```

**`ON DELETE SET NULL` (not RESTRICT):** If a coach is deleted/deactivated, their attribution becomes anonymous but the deal survives. RESTRICT would block coach deletion, an unacceptable UX coupling. The `users(id) ON DELETE CASCADE` on `deals.student_id` remains — students still own their deals.

**Nullable:** All pre-existing deal rows from Phases 38–43 have no `logged_by`; nullable default NULL + interpretation "NULL = student self-logged" avoids a data backfill and matches D-09.

### 4.2 RLS policy changes

Current RLS (migration 00021, per ROADMAP Phase 38) restricts students to own-INSERT via `student_id = (SELECT auth.uid())`. Add two new INSERT policies side-by-side (don't modify existing — keeps student path unchanged):

```sql
-- Coach INSERT: can log deals for their assigned students only
CREATE POLICY "coach_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) = 'coach'
    AND logged_by = (SELECT get_user_id())
    AND student_id IN (
      SELECT id FROM public.users
      WHERE coach_id = (SELECT get_user_id())
        AND status = 'active'
    )
  );

-- Owner INSERT: can log deals for any student
CREATE POLICY "owner_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT get_user_role()) = 'owner'
    AND logged_by = (SELECT get_user_id())
  );
```

Initplan pattern `(SELECT get_user_role())` / `(SELECT get_user_id())` matches v1.2 Phase 19 (D-03 locked). Precedent: 00015_v1_4_schema.sql Section 8 coach_insert_report_comments.

**Note:** Per CLAUDE.md rule 4, API routes use admin client which bypasses RLS — RLS here is defense in depth. The actual gate is in `/api/deals` route handler logic.

### 4.3 API route update (`src/app/api/deals/route.ts` POST)

Current POST is student-only (lines 49–52). Refactor to accept an optional `student_id` in body when caller is coach/owner:

```ts
// New Zod schema
const postDealSchema = z.object({
  revenue: z.number().min(...).max(...),
  profit: z.number().min(...).max(...),
  student_id: z.string().uuid().optional(), // required if caller is coach/owner
});

// Role branch after profile lookup
const isStudent = ["student", "student_diy"].includes(profile.role);
const targetStudentId = isStudent ? profile.id : parsed.data.student_id;

if (!isStudent) {
  if (!targetStudentId) return 400 "student_id required for coach/owner";
  if (profile.role === "coach") {
    // Verify student is assigned to this coach
    const { data: student } = await admin.from("users")
      .select("id").eq("id", targetStudentId).eq("coach_id", profile.id).eq("status", "active").maybeSingle();
    if (!student) return 403;
  }
}

const insertPayload = {
  student_id: targetStudentId,
  revenue: parsed.data.revenue,
  profit: parsed.data.profit,
  logged_by: isStudent ? null : profile.id, // D-09 semantics
};
```

**Revalidation:** If coach logs, additionally `revalidateTag('deals-${targetStudentId}')` (already there) AND `revalidateTag('analytics-student-${targetStudentId}')` AND `revalidateTag('coach-milestones-${profile.id}')`.

### 4.4 Attribution display — JOIN vs denormalize

**Recommendation:** JOIN to `users` table on read. Do **not** denormalize `logged_by_name`.

```ts
// src/app/(dashboard)/coach/students/[studentId]/DealsTab reads
const { data } = await admin
  .from("deals")
  .select("id, deal_number, revenue, profit, created_at, logged_by, logged_by_user:users!deals_logged_by_fkey(id, name, role)")
  .eq("student_id", studentId)
  .order("created_at", { ascending: false });
```

**Why:** (1) Name changes on users won't get stale. (2) `deals` at 5k students × ~5 deals/student = 25k rows total — FK JOIN is cheap with `idx_deals_logged_by`. (3) Avoids trigger-to-sync-name write-path complexity. Precedent: student name shows by JOIN throughout codebase, no denorm anywhere.

**UI attribution indicator:**
```tsx
{deal.logged_by && deal.logged_by_user && (
  <Badge variant="info" size="sm">
    Logged by {deal.logged_by_user.name} ({deal.logged_by_user.role})
  </Badge>
)}
```

---

## 5. New Files / Components Expected

### 5.1 New routes (server components)

| Route | File | Purpose |
|-------|------|---------|
| `/student/analytics` | `src/app/(dashboard)/student/analytics/page.tsx` + `loading.tsx` + `error.tsx` | Student self-view analytics |
| `/student_diy/analytics` | `src/app/(dashboard)/student_diy/analytics/page.tsx` (+loading/error) | Same RPC, student_diy variant (if in scope — confirm) |
| `/coach/analytics` (expansion) | Modify existing `src/app/(dashboard)/coach/analytics/page.tsx` | Full-page leaderboards/trends |
| `/coach/students/[studentId]` (extend) | Existing — add `Add Deal` button, attribution column | Coach can log deals |
| `/owner/students/[studentId]` (extend) | Existing — add `Add Deal` button | Owner can log deals for any student |

**Not needed:** `/coach/students` (already exists, is the card grid). The "recent reports See All" link points to existing `/coach/reports`.

### 5.2 New client components

| Component | File | Purpose |
|-----------|------|---------|
| `StudentAnalyticsClient` | `src/components/student/StudentAnalyticsClient.tsx` | Renders chart library; receives RPC payload |
| `CoachAnalyticsClient` | `src/components/coach/CoachAnalyticsClient.tsx` | Leaderboard tables + trend charts + pagination |
| `OutreachTrendChart` | `src/components/analytics/OutreachTrendChart.tsx` | Reusable weekly-bucket line chart |
| `DealsHistoryChart` | `src/components/analytics/DealsHistoryChart.tsx` | Bar chart (revenue/profit per month) |
| `HoursWorkedChart` | `src/components/analytics/HoursWorkedChart.tsx` | Weekly hours bar chart |
| `RoadmapProgressChart` | `src/components/analytics/RoadmapProgressChart.tsx` | Horizontal timeline with deadline markers |
| `LogDealModal` | `src/components/coach/LogDealModal.tsx` | Coach variant of existing `DealFormModal` — adds `student_id` picker |
| `TopHoursLeaderboard` | `src/components/coach/TopHoursLeaderboard.tsx` | 3-student podium card on `/coach` |
| `RecentReportsCard` | `src/components/coach/RecentReportsCard.tsx` | 3 most recent reports + "See All →" link |
| `MilestoneNotificationsCard` | `src/components/coach/MilestoneNotificationsCard.tsx` | Optional — feed-style list on `/coach/alerts` |

All wrapped in tiny `"use client"` shells; server components fetch data via RPC and pass payload as props. Matches existing `StudentCard` / `CalendarTab` pattern.

### 5.3 New database migrations (in order)

| Migration | Scope |
|-----------|-------|
| `00022_deals_logged_by.sql` | ADD COLUMN `logged_by`, FK+index, coach+owner INSERT policies |
| `00023_analytics_rpcs.sql` | `get_student_analytics`, `get_coach_analytics`, plus new indexes (`idx_deals_student_created`, `idx_work_sessions_completed_student_date`) |
| `00024_coach_dashboard_rpc.sql` | `get_coach_dashboard` + folded student enrichment |
| `00025_milestone_alerts.sql` | `get_coach_milestones` RPC + extend `get_sidebar_badges` coach branch + `idx_roadmap_progress_student_status` |

**All migrations follow existing header conventions** (Phase number, section comments, `IF NOT EXISTS` guards for local dev, `DO $$ IF EXISTS cron` blocks where applicable, `SECURITY DEFINER SET search_path = public`).

### 5.4 New config entries (`src/lib/config.ts`)

```ts
// MILESTONE_CONFIG — new block (referenced in §3.2)
export const MILESTONE_CONFIG = {
  techSetupStep: 6,          // TBC per D-06
  influencersClosedStep: 11,
  brandResponseStep: 13,
} as const;

// ANALYTICS_CONFIG — new block
export const ANALYTICS_CONFIG = {
  defaultWindowDays: 90,     // student analytics trailing window
  coachTrendWindowDays: 30,  // coach analytics trend window
  coachLeaderboardLimit: 10,
  topHoursLimit: 3,
  recentReportsLimit: 3,
  chartColors: {
    primary: "ima-primary",
    success: "ima-success",
    warning: "ima-warning",
    error: "ima-error",
  },
} as const;

// ROUTES — add
routes.student.analytics = "/student/analytics";
// routes.student_diy.analytics = "/student_diy/analytics"; // if scoped in

// NAVIGATION — add Analytics entry to student nav array
```

### 5.5 Chart library (D-11 evaluation)

**Recommendation:** Add **recharts** (`recharts@^2.15`). Currently no chart lib is installed (grep of `package.json` returns no `recharts|nivo|chart.js|visx|apexcharts`). Rationale: declarative React components, tree-shakeable (~60KB gzipped for typical bundle), SVG-based (accessible with ARIA), matches existing project style of composable primitives. Alternative `visx` is more flexible but requires more scratch-building; not worth the time for v1.5 scope. See STACK.md for deeper comparison.

### 5.6 Data flow summary

```
DB (daily_reports + work_sessions + deals + roadmap_progress + student_kpi_summaries)
  ↓  (SECURITY DEFINER RPC via admin client)
RPC: get_student_analytics / get_coach_analytics / get_coach_dashboard / get_coach_milestones
  ↓  (unstable_cache wrapper, 60s TTL, user-scoped tag)
Server component (async page.tsx in (dashboard)/…)
  ↓  (prop drill typed jsonb payload)
Client component ("use client" wrapper)
  ↓  (pass subsliced data)
recharts primitives (LineChart, BarChart, …) with ima-* stroke/fill colors
```

Mutation path (e.g., coach logs deal):
```
LogDealModal → POST /api/deals (body: revenue, profit, student_id)
  → CSRF + auth + role + rate-limit + Zod
  → admin.insert({ ..., logged_by: coach.id })
  → revalidateTag('deals-${studentId}') + revalidateTag('analytics-student-${studentId}') + revalidateTag('coach-milestones-${coach.id}')
  → return 201
  → useOptimistic rollback cleared, router.refresh()
```

---

## 6. Suggested Build Order

Honors v1.5 D-10 (sequential) but refines the feature numbering with phase-level dependencies. Each step is a phase-sized unit.

| # | Phase topic | Depends on | Migration | Rationale |
|---|-------------|-----------|-----------|-----------|
| 1 | **`deals.logged_by` migration + API + RLS** | 00021 deals | **00022** | Unblocks "coach logs deal" UI; pure data-layer work — safest first step. Milestone "Closed Deal" identification key uses deal_id (created by this phase) |
| 2 | **Analytics indexes + Student Analytics RPC** | migrations only | **00023** | Build the read-foundation first. Student analytics is the simplest consumer (1 student, no fan-out) — validates query shapes before coach fan-out complexity |
| 3 | **Student Analytics page + charts** (recharts install) | #2 + recharts dep | — | Install recharts once, reuse across all analytics. Student page is self-contained — easy win ships observable user value |
| 4 | **Coach Dashboard RPC** (consolidation) | #2 (reuses indexes) | **00024** | Fold the 4 existing coach page queries + new stats + recent reports + top hours into one RPC |
| 5 | **Coach homepage stats UI** | #4 | — | Replace `/coach/page.tsx` queries with the new RPC; add stat cards + `RecentReportsCard` + `TopHoursLeaderboard` |
| 6 | **Coach Analytics page full expansion** | #2 + #4 (shared index work) | part of 00023 or follow-up 00023b | Leaderboards + deal trends + active/inactive — reuses `get_coach_analytics` RPC. Paginates via URL `?page=N` following v1.2 Phase 20 server-side pagination precedent |
| 7 | **Coach deals logging UI** | #1 + existing coach student detail page | — | Add "Log Deal" button on `/coach/students/[studentId]` deals tab + attribution column. Reuses DealFormModal with added student picker |
| 8 | **Milestone notifications RPC + extension to get_sidebar_badges** | #1, #2 | **00025** | Last because "Closed Deal" milestone key format depends on #1's `logged_by` + deal_id, and should not block simpler features |
| 9 | **Coach Alerts page milestone list UI** | #8 | — | New list on `/coach/alerts` + sidebar badge updates automatically via existing `get_sidebar_badges` path. Config `MILESTONE_CONFIG.techSetupStep` finalized once D-06 TBC step is confirmed Monday |

**Parallelizable:** #3 and #7 can run in parallel after #2 and #1 respectively. #6 can run in parallel with #5 after #4. But the safe serial order above is recommended given the solo-dev + GSD phase model.

**Critical path for user value:** #1 → #4 → #5 (coach dashboard lights up) takes priority; #2 → #3 (student analytics) can ship independently; #8 → #9 closes out.

---

## Integration Points Summary

### Tables touched (existing)

| Table | v1.5 touch |
|-------|-----------|
| `deals` | `logged_by` column ADD, new INSERT RLS policies, new composite index |
| `work_sessions` | Read-only — new partial index `idx_work_sessions_completed_student_date` |
| `daily_reports` | Read-only — aggregation target for trends |
| `roadmap_progress` | Read-only — milestone triggers read status transitions; new supporting index |
| `student_kpi_summaries` | Read-only — lifetime totals |
| `users` | Read-only JOINs for name/role attribution |
| `alert_dismissals` | NEW alert_key namespaces: `milestone_tech_setup:*`, `milestone_5_influencers:*`, `milestone_brand_response:*`, `milestone_closed_deal:*:*` |

### Functions touched (existing)

| RPC | v1.5 touch |
|-----|-----------|
| `get_sidebar_badges` | Coach branch extends milestone count from 1 (100h) to 5 (100h + 4 new) |
| `get_student_detail` | Unchanged — analytics is a separate RPC |
| `refresh_student_kpi_summaries` | Unchanged — nightly cron already populates lifetime totals used by analytics |

### New API routes

None strictly required — extend `/api/deals` POST for coach/owner logging (§4.3). Existing `/api/alerts/dismiss` route accepts generic `alert_key` strings, so new milestone dismissal works without code change (inspect to confirm — 1-line Zod allow-list may need extending).

### Rate limiting

Every new API change point (`/api/deals` POST) already has `checkRateLimit`. The analytics pages are server component reads — no mutation, no rate limit needed. Only `/api/alerts/dismiss` needs to continue having its limit (already does).

---

## Performance Envelope (5k students)

| Query | Estimated cost | Mitigation |
|-------|---------------|-----------|
| `get_student_analytics(s)` | ~90 rows reports + ~400 sessions + <50 deals for 1 student | Index covers; <50ms expected |
| `get_coach_dashboard(c)` | 50 students × (recent reports + today's stats) | Single RPC with `s.coach_id = p_coach_id` filter; 60s cache |
| `get_coach_analytics(c)` | 50 students × 30 days of reports/deals | Indexes `(student_id, date)` + `(student_id, created_at)` cover; 60s cache |
| `get_coach_milestones(c)` | 50 students × 4 milestone checks | Loop pattern matches 00014 which proved fast at scale |
| Top-3 hours | 50 × 7 × ~4 sessions = ~1,400 rows | Partial index on completed sessions |

**Concurrency:** Per v1.2 Phase 24 baseline (P95 = 929ms at 100 VU read-mix), adding 4 new RPCs of similar shape keeps us under the 1s threshold. Pro Small compute remains adequate — monitor cloud P95 after deploy per existing decision log.

---

## Sources

- `supabase/migrations/00001_create_tables.sql` through `00020_add_eyoub_owner.sql` — all existing schema and RPCs
- `supabase/migrations/00011_write_path.sql` — student_kpi_summaries + pg_cron pattern (v1.2 Phase 21)
- `supabase/migrations/00014_coach_alert_dismissals.sql` — coach 100h milestone precedent (reuse target per D-08)
- `supabase/migrations/00016_skip_tracker.sql` — ISO week + student_ids array RPC pattern
- `src/lib/config.ts` — COACH_CONFIG, NAVIGATION, VALIDATION.deals
- `src/lib/rate-limit.ts` — rate limit helper (all mutations)
- `src/app/api/deals/route.ts` — current deals POST/GET, revalidateTag precedent
- `src/app/(dashboard)/coach/page.tsx` — current 4-query Promise.all pattern (consolidation target)
- `.planning/PROJECT.md` — v1.5 D-01 through D-13 locked decisions
- `.planning/ROADMAP.md` Phase 38 — deals migration 00021 reference

**Confidence:** HIGH on all recommendations. Each pattern has a migration or file precedent in the existing codebase; no speculative technology introduced except recharts (standard React ecosystem choice, flagged for stack review).
