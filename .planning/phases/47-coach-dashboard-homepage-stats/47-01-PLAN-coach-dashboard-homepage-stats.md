---
phase: 47-coach-dashboard-homepage-stats
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00024_get_coach_dashboard.sql
  - src/lib/rpc/coach-dashboard-types.ts
  - src/lib/rpc/coach-dashboard.ts
  - src/app/(dashboard)/coach/page.tsx
  - src/components/coach/KPICard.tsx
  - src/components/coach/RecentSubmissionsCard.tsx
  - src/components/coach/WeeklyLeaderboardCard.tsx
  - src/app/api/deals/route.ts
  - src/app/api/reports/route.ts
  - src/app/api/work-sessions/route.ts
autonomous: true
requirements:
  - COACH-DASH-01
  - COACH-DASH-02
  - COACH-DASH-03
  - COACH-DASH-04
  - COACH-DASH-05
  - COACH-DASH-06
  - COACH-DASH-07

must_haves:
  truths:
    - "supabase/migrations/00024_get_coach_dashboard.sql creates function public.get_coach_dashboard(p_coach_id uuid, p_week_start date, p_today date) RETURNS jsonb, LANGUAGE plpgsql, STABLE, SECURITY DEFINER, SET search_path = public"
    - "get_coach_dashboard rejects callers whose (SELECT auth.uid()) IS NOT NULL AND IS DISTINCT FROM p_coach_id with EXCEPTION 'not_authorized' USING ERRCODE = '42501' — matches Phase 46 RPC pattern so service_role (admin client with null auth.uid()) passes while an authenticated non-matching coach cannot read another coach's data"
    - "get_coach_dashboard returns a single jsonb object with exact top-level keys: stats, recent_reports, top_hours_week — no other keys"
    - "stats jsonb object has exact keys: deals_closed (int), revenue_cents (bigint) or revenue (numeric), avg_roadmap_step (numeric rounded to 1dp), emails_sent (int) — all scoped to users where role='student' AND coach_id=p_coach_id AND status='active'"
    - "recent_reports is a jsonb array of at most 3 rows ordered by submitted_at DESC (NULLS LAST), each row has: id, student_id, student_name, date, star_rating, submitted_at — scoped to assigned-student IDs only"
    - "top_hours_week is a jsonb array of at most 3 rows ordered by minutes DESC, each row has: student_id, student_name, minutes (int) — computed from work_sessions WHERE status='completed' AND date >= p_week_start AND date <= p_today AND student_id IN (assigned students)"
    - "src/lib/rpc/coach-dashboard-types.ts exports pure TypeScript types + the coachDashboardTag(coachId) helper — ZERO server-only imports so it can be imported by client components if ever needed"
    - "src/lib/rpc/coach-dashboard.ts imports createAdminClient and exports fetchCoachDashboard(coachId, weekStart, today) that awaits admin.rpc('get_coach_dashboard', ...), console.errors on failure and rethrows (never swallows)"
    - "coachDashboardTag(coachId) returns the literal string `coach-dashboard:${coachId}`"
    - "/coach page wraps fetchCoachDashboard call in unstable_cache with key ['coach-dashboard', user.id], revalidate: 60, tags: [coachDashboardTag(user.id)]"
    - "/coach page renders 4 KPI cards (Deals Closed / Revenue Generated / Avg Roadmap Step / Emails Sent) via <KPICard> below the existing 3 stat cards, inside a grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 wrapper"
    - "/coach page renders a grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 containing <RecentSubmissionsCard> and <WeeklyLeaderboardCard>, placed after the KPI row and before the at-risk banner"
    - "KPICard root is <Link href={href}> with class includes 'block min-h-[44px] rounded-lg motion-safe:transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2' and carries the provided aria-label"
    - "Each KPI card aria-label follows the pattern 'Deals Closed: 12. View in analytics.' — label, colon, value, period, 'View in analytics.' — values server-formatted"
    - "KPI icon tints: Deals Closed uses bg-ima-primary/10 + text-ima-primary; Revenue uses bg-ima-success/10 + text-ima-success; Avg Roadmap Step uses bg-ima-info/10 + text-ima-info; Emails Sent uses bg-ima-warning/10 + text-ima-warning — identical tint pattern to existing coach stat cards"
    - "Revenue formatted via Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) server-side only; integers use Intl.NumberFormat('en-US') for thousands separator; roadmap step uses Number(...).toFixed(1); zero-state values render as '0', '$0', '0.0', '0' — never '—' or 'N/A'"
    - "All 4 KPI values render with class 'text-2xl font-bold text-ima-text tabular-nums'"
    - "RecentSubmissionsCard header reads 'Recent Submissions' with sub-heading '3 most recent reports from your students' and a right-aligned <Link href='/coach/reports'>See all reports</Link> that has min-h-[44px] inline-flex items-center text-ima-primary hover:underline"
    - "Each recent report row is a <Link href={`/coach/reports#${reportId}`}> with class 'flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-ima-surface-light motion-safe:transition-colors min-h-[44px]' and carries aria-label in sentence form including student name, star rating count and relative timestamp"
    - "Star rating renders as 5 lucide-react <Star> icons; filled ones use 'text-ima-warning fill-ima-warning', unfilled use 'text-ima-border'; every Star icon has aria-hidden='true'"
    - "RecentSubmissionsCard empty state uses <EmptyState> primitive with title 'No submissions yet' and description 'Reports from your students will appear here as soon as they log their day.'"
    - "WeeklyLeaderboardCard header reads 'Top 3 This Week' with sub-heading 'Hours worked since Monday'"
    - "Leaderboard row for rank 1 uses <Badge variant='primary'>#1</Badge>; ranks 2 and 3 render '#2' / '#3' as a span with class 'text-ima-text-muted font-semibold'; avatar circle uses 'w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0' matching at-risk list"
    - "Leaderboard hours format: derived from minutes via `${Math.floor(m/60)}h ${m%60}m` — e.g., 525 minutes renders '8h 45m' — uses tabular-nums class"
    - "WeeklyLeaderboardCard empty state uses <EmptyState> primitive with title 'No hours logged this week' and description 'Once your students start work sessions, the weekly leader will appear here.'"
    - "If fewer than 3 students have logged hours, render only the existing rows — NEVER render placeholder '—' rows for missing ranks"
    - "Zero-assigned-students empty state for the KPI+Submissions+Leaderboard block: render an <EmptyState> wrapper instead of KPI/cards when studentIds.length === 0, so no broken/zero scaffolding shows"
    - "Week start computed server-side via `date_trunc('week', p_today)::date` inside the RPC (ISO Monday, matches Phase 44 convention); TypeScript caller passes getTodayUTC() as p_today and the same value as p_week_start is derived inside the SQL — caller passes date_trunc result OR the RPC internally computes it; caller MAY pass p_week_start = null and RPC falls back to date_trunc('week', p_today)::date when null"
    - "revalidateTag(coachDashboardTag(coachId)) is called inside src/app/api/deals/route.ts POST/PATCH handlers for every assigned student's coach_id (lookup via users.coach_id) whenever a deal mutation occurs"
    - "revalidateTag(coachDashboardTag(coachId)) is called inside src/app/api/reports/route.ts POST/PATCH handlers for the submitting student's coach_id"
    - "revalidateTag(coachDashboardTag(coachId)) is called inside src/app/api/work-sessions/route.ts POST/PATCH handlers for the acting student's coach_id"
    - "Every mutation handler that revalidates coachDashboardTag guards against a null coach_id — skips the call silently without throwing (students without a coach are a valid state)"
    - "All .from() queries in route handlers use createAdminClient (rule 4 in CLAUDE.md) — no new non-admin .from() introduced in routes"
    - "Zero hardcoded hex colors or gray tokens added in this phase — grep for (text|bg|border)-(gray|slate|zinc|neutral)- or '#[0-9a-fA-F]{3,8}' in the modified files must return 0 matches"
    - "Every animate-* class added in this phase is prefixed motion-safe: (grep for unprefixed animate- in changed files returns 0 matches)"
    - "Every interactive element added (KPI Link, row Link, See-all Link) has min-h-[44px] class present"
    - "Every try/catch and every admin-client error object either console.errors or shows a toast — no empty catch blocks introduced"
    - "No new API route file is created; all revalidation is added inside existing route.ts files"
    - "npm run lint && npx tsc --noEmit && npm run build all exit 0"
  artifacts:
    - supabase/migrations/00024_get_coach_dashboard.sql
    - src/lib/rpc/coach-dashboard-types.ts
    - src/lib/rpc/coach-dashboard.ts
    - src/components/coach/KPICard.tsx
    - src/components/coach/RecentSubmissionsCard.tsx
    - src/components/coach/WeeklyLeaderboardCard.tsx
  key_links:
    - "get_coach_dashboard consumes idx_deals_student_created, idx_work_sessions_completed_student_date, idx_roadmap_progress_student_status from Phase 44 migration 00021 — do not re-declare them"
    - "Authorization guard pattern (service_role bypass when auth.uid() IS NULL, reject when present and mismatched) is copied verbatim from Phase 46 migration 00023 — do not drift"
    - "coachDashboardTag(coachId) is the ONLY cache tag for this page; mutations in deals / reports / work-sessions routes must invalidate it alongside existing studentAnalyticsTag invalidations"
    - "UI-SPEC 47-UI-SPEC.md governs every label, color, spacing, typography — plan implements it 1:1"
    - "Existing /coach page structure (greeting, 3 stat cards, at-risk banner, student grid) must remain intact — new blocks are inserted between the existing 3-stat-card grid and the at-risk banner"
---

<objective>
Ship the Coach Dashboard Homepage Stats additions — 4 KPI cards + a Recent Submissions card + a Top-3 Weekly Hours leaderboard on `/coach`, all sourced from one new SQL RPC `get_coach_dashboard`, wrapped in `unstable_cache` with a single `coach-dashboard:${coachId}` tag invalidated by mutations in deals / reports / work-sessions route handlers. UI composes existing `Card` / `Badge` / `EmptyState` / `Skeleton` primitives; every color routes through `ima-*` tokens; every interactive element hits 44px; every animation is `motion-safe:` prefixed.

Purpose: Delivers COACH-DASH-01 through COACH-DASH-07 in a single wave. Backend (SQL RPC) + thin server RPC helper + UI (3 new components + 1 page edit) + cross-cutting cache invalidation (3 existing API routes). Everything is one logical unit; splitting creates artificial seams.
Output: 1 new migration (00024), 2 new RPC helper files, 3 new React components, 1 edited coach page, 3 edited API route files (cache tag adds only).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/47-coach-dashboard-homepage-stats/47-CONTEXT.md
@.planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md
@CLAUDE.md
@supabase/migrations/00021_analytics_foundation.sql
@supabase/migrations/00022_deals_logged_by.sql
@supabase/migrations/00023_get_student_analytics.sql
@src/lib/config.ts
@src/lib/utils.ts
@src/lib/supabase/admin.ts
@src/lib/session.ts
@src/lib/types.ts
@src/lib/rpc/student-analytics.ts
@src/lib/rpc/student-analytics-types.ts
@src/components/ui/Card.tsx
@src/components/ui/Badge.tsx
@src/components/ui/Button.tsx
@src/components/ui/EmptyState.tsx
@src/components/ui/Skeleton.tsx
@src/components/coach/StudentCard.tsx
@src/app/(dashboard)/coach/page.tsx
@src/app/api/deals/route.ts
@src/app/api/reports/route.ts
@src/app/api/work-sessions/route.ts
@tailwind.config.ts

<interfaces>
Relevant existing exports — executor MUST NOT break:

From src/lib/session.ts:
- requireRole('coach'): Promise<User> — returns authed coach user; redirects on mismatch

From src/lib/supabase/admin.ts:
- createAdminClient(): SupabaseClient — module-level singleton (Phase 19)

From src/lib/utils.ts:
- getToday(): string (YYYY-MM-DD, local)
- getTodayUTC(): string (YYYY-MM-DD, UTC)
- getGreeting(): string

From src/lib/config.ts:
- COACH_CONFIG.atRiskInactiveDays, COACH_CONFIG.reportInboxDays, COACH_CONFIG.atRiskRatingThreshold
- ACTIVITY.inactiveAfterDays = 7 (Phase 44 D-14)
- ROUTES.coach.dashboard / reports / analytics
- default export aggregate `config` must continue to include every named export

From src/components/ui/Card.tsx:
- <Card variant?>, <CardContent>

From src/components/ui/EmptyState.tsx:
- <EmptyState variant='compact'|'default' icon title description action>

From src/components/ui/Badge.tsx:
- <Badge variant='primary'|'error'|... size='sm'|'md'>

From src/lib/rpc/student-analytics-types.ts (Phase 46):
- Pattern reference — coach-dashboard-types.ts must mirror its shape: pure types + tag helper, zero runtime imports.

From supabase/migrations/00021_analytics_foundation.sql (Phase 44):
- public.week_start(date) — ISO Monday helper
- idx_deals_student_created, idx_work_sessions_completed_student_date, idx_roadmap_progress_student_status

From supabase/migrations/00022_deals_logged_by.sql (Phase 45):
- public.deals.logged_by uuid NOT NULL

From supabase/migrations/00023_get_student_analytics.sql (Phase 46):
- Authorization guard pattern — exact copy for get_coach_dashboard
- SECURITY DEFINER + STABLE + SET search_path = public + plpgsql style
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create migration 00024_get_coach_dashboard.sql — batch RPC</name>
  <read_first>
    - supabase/migrations/00023_get_student_analytics.sql (authorization pattern + jsonb_build_object composition + service_role bypass idiom)
    - supabase/migrations/00021_analytics_foundation.sql (week_start helper + index names)
    - supabase/migrations/00022_deals_logged_by.sql (deals.logged_by shape)
    - supabase/migrations/00001_create_tables.sql (users / daily_reports / work_sessions / roadmap_progress / deals shapes)
    - .planning/phases/47-coach-dashboard-homepage-stats/47-CONTEXT.md
    - .planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md
    - CLAUDE.md (Critical Rules + Hard Rules)
  </read_first>
  <files>supabase/migrations/00024_get_coach_dashboard.sql</files>
  <action>
Create `supabase/migrations/00024_get_coach_dashboard.sql`. Before writing, run `ls supabase/migrations/ | grep -E '^0002[4-9]'` — if `00024_*.sql` already exists, bump to the next free number and update every cross-file reference (plan SQL name, truths, artifacts).

Required structure:

1. Header comment describing phase, inputs, outputs, and dependencies on Phase 44 / 45 / 46 artifacts.

2. `CREATE OR REPLACE FUNCTION public.get_coach_dashboard(
     p_coach_id  uuid,
     p_week_start date DEFAULT NULL,
     p_today     date DEFAULT CURRENT_DATE
   ) RETURNS jsonb
   LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ ... $$;`

3. Inside the function:
   - `v_caller uuid := (SELECT auth.uid());`
   - If `v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_coach_id` → `RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';` (copy Phase 46 comment explaining why service_role bypasses).
   - `v_week_start := COALESCE(p_week_start, date_trunc('week', p_today)::date);`
   - Build `v_student_ids uuid[]` via `SELECT array_agg(id) INTO v_student_ids FROM users WHERE role='student' AND coach_id = p_coach_id AND status='active';`
   - If array is null or empty, short-circuit: return `jsonb_build_object('stats', jsonb_build_object('deals_closed', 0, 'revenue', 0, 'avg_roadmap_step', 0, 'emails_sent', 0), 'recent_reports', '[]'::jsonb, 'top_hours_week', '[]'::jsonb);`

4. Stats aggregate (single jsonb object):
   - `deals_closed`: `COALESCE((SELECT COUNT(*) FROM deals WHERE student_id = ANY(v_student_ids)), 0)::int`
   - `revenue`: `COALESCE((SELECT SUM(revenue) FROM deals WHERE student_id = ANY(v_student_ids)), 0)::numeric` (NUMERIC to preserve precision; caller formats)
   - `avg_roadmap_step`: compute per-student current step as `MAX(step_number) FILTER (WHERE status IN ('completed','active'))` grouped by student, then AVG over students → round to 1 decimal place (`round(..., 1)::numeric`). If zero students, return 0.
   - `emails_sent`: `COALESCE((SELECT SUM(emails_sent) FROM daily_reports WHERE student_id = ANY(v_student_ids)), 0)::int` — use whichever column exists in daily_reports; inspect 00001_create_tables.sql + 00006_v1_1_schema.sql to confirm the exact column name (likely `emails_sent int`). If the column is named differently (e.g., `outreach_count`), use the actual column and mirror that name in the response key — update plan truths accordingly. IMPORTANT: read the migration before writing to avoid guessing.

5. Recent reports (jsonb array of <=3):
   ```
   SELECT coalesce(jsonb_agg(row), '[]'::jsonb)
   FROM (
     SELECT jsonb_build_object(
       'id', r.id,
       'student_id', r.student_id,
       'student_name', u.name,
       'date', r.date,
       'star_rating', r.star_rating,
       'submitted_at', r.submitted_at
     ) AS row
     FROM daily_reports r
     JOIN users u ON u.id = r.student_id
     WHERE r.student_id = ANY(v_student_ids)
       AND r.submitted_at IS NOT NULL
     ORDER BY r.submitted_at DESC NULLS LAST
     LIMIT 3
   ) sub
   INTO v_recent_reports;
   ```

6. Top-3 weekly hours (jsonb array of <=3):
   ```
   SELECT coalesce(jsonb_agg(row ORDER BY minutes DESC), '[]'::jsonb)
   FROM (
     SELECT jsonb_build_object(
       'student_id', u.id,
       'student_name', u.name,
       'minutes', COALESCE(SUM(ws.duration_minutes), 0)::int
     ) AS row,
     COALESCE(SUM(ws.duration_minutes), 0)::int AS minutes
     FROM users u
     LEFT JOIN work_sessions ws
       ON ws.student_id = u.id
      AND ws.status = 'completed'
      AND ws.date >= v_week_start
      AND ws.date <= p_today
     WHERE u.id = ANY(v_student_ids)
     GROUP BY u.id, u.name
     HAVING COALESCE(SUM(ws.duration_minutes), 0) > 0
     ORDER BY COALESCE(SUM(ws.duration_minutes), 0) DESC
     LIMIT 3
   ) sub
   INTO v_top_hours_week;
   ```
   (Adjust syntax if the `jsonb_agg(... ORDER BY ...)` requires the expression to reference the sub-query alias; cleanest pattern is to run an outer `SELECT jsonb_agg(row) FROM (inner SELECT … ORDER BY … LIMIT 3) sub`. Mirror the exact SQL pattern used in 00023 for ordering within jsonb_agg — copy, don't invent.)

7. Return:
   ```
   RETURN jsonb_build_object(
     'stats', jsonb_build_object(
       'deals_closed', v_deals_closed,
       'revenue', v_revenue,
       'avg_roadmap_step', v_avg_step,
       'emails_sent', v_emails_sent
     ),
     'recent_reports', v_recent_reports,
     'top_hours_week', v_top_hours_week
   );
   ```

8. Grants block at end:
   ```
   GRANT EXECUTE ON FUNCTION public.get_coach_dashboard(uuid, date, date) TO service_role;
   GRANT EXECUTE ON FUNCTION public.get_coach_dashboard(uuid, date, date) TO authenticated;
   ```

9. Inline assertion comments (`-- ASSERT: ...`) documenting the acceptance truths for future maintainers.

No index changes in this migration — Phase 44 indexes cover all hot paths. Do not re-declare them.
  </action>
  <verify>
  - File `supabase/migrations/00024_get_coach_dashboard.sql` exists.
  - `grep -E "CREATE OR REPLACE FUNCTION public\.get_coach_dashboard" supabase/migrations/00024_get_coach_dashboard.sql` returns one match.
  - `grep -E "SECURITY DEFINER" supabase/migrations/00024_get_coach_dashboard.sql` returns a match.
  - `grep -E "STABLE" supabase/migrations/00024_get_coach_dashboard.sql` returns a match.
  - `grep -E "SET search_path = public" supabase/migrations/00024_get_coach_dashboard.sql` returns a match.
  - `grep -E "not_authorized" supabase/migrations/00024_get_coach_dashboard.sql` returns a match.
  - `grep -E "GRANT EXECUTE" supabase/migrations/00024_get_coach_dashboard.sql` returns at least two matches (service_role + authenticated).
  </verify>
</task>

<task type="auto">
  <name>Task 2: Create src/lib/rpc/coach-dashboard-types.ts — pure types + tag helper</name>
  <read_first>
    - src/lib/rpc/student-analytics-types.ts (pattern to mirror — pure types, zero runtime deps, tag helper)
  </read_first>
  <files>src/lib/rpc/coach-dashboard-types.ts</files>
  <action>
Create `src/lib/rpc/coach-dashboard-types.ts` with these exports (no server-only imports — safe for any runtime):

```ts
export type CoachDashboardStats = {
  deals_closed: number;
  revenue: number;           // numeric in USD; NOT cents
  avg_roadmap_step: number;  // rounded to 1dp server-side
  emails_sent: number;
};

export type CoachRecentReport = {
  id: string;
  student_id: string;
  student_name: string;
  date: string;              // YYYY-MM-DD
  star_rating: number | null;
  submitted_at: string;      // ISO timestamp
};

export type CoachTopHoursRow = {
  student_id: string;
  student_name: string;
  minutes: number;
};

export type CoachDashboardPayload = {
  stats: CoachDashboardStats;
  recent_reports: CoachRecentReport[];
  top_hours_week: CoachTopHoursRow[];
};

/**
 * revalidateTag key for the coach's cached dashboard batch RPC result.
 * Every mutation on an assigned student's deals / reports / work_sessions
 * MUST call revalidateTag(coachDashboardTag(coachId)) — see route handlers.
 */
export function coachDashboardTag(coachId: string): string {
  return `coach-dashboard:${coachId}`;
}
```

No defaults, no runtime code beyond the pure function. Zero external imports.
  </action>
  <verify>
  - File exists at `src/lib/rpc/coach-dashboard-types.ts`.
  - `grep -E "^import" src/lib/rpc/coach-dashboard-types.ts` returns 0 matches.
  - `grep -E "export function coachDashboardTag" src/lib/rpc/coach-dashboard-types.ts` returns 1 match.
  - `grep -E "coach-dashboard:\\\$" src/lib/rpc/coach-dashboard-types.ts` returns a match (template literal).
  </verify>
</task>

<task type="auto">
  <name>Task 3: Create src/lib/rpc/coach-dashboard.ts — server RPC wrapper</name>
  <read_first>
    - src/lib/rpc/student-analytics.ts (exact pattern to mirror)
    - src/lib/supabase/admin.ts
  </read_first>
  <files>src/lib/rpc/coach-dashboard.ts</files>
  <action>
Create `src/lib/rpc/coach-dashboard.ts`:

```ts
/**
 * Phase 47: Coach Dashboard RPC wrapper (server-only).
 *
 * Calls public.get_coach_dashboard (migration 00024) via the admin client.
 * Used by /coach server component wrapped in unstable_cache.
 *
 * IMPORTANT: imports createAdminClient — server-only. Client components must
 * import types from "@/lib/rpc/coach-dashboard-types" instead.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CoachDashboardPayload } from "@/lib/rpc/coach-dashboard-types";

export {
  coachDashboardTag,
} from "@/lib/rpc/coach-dashboard-types";
export type {
  CoachDashboardStats,
  CoachRecentReport,
  CoachTopHoursRow,
  CoachDashboardPayload,
} from "@/lib/rpc/coach-dashboard-types";

/**
 * Runs public.get_coach_dashboard for the given coach.
 * p_week_start = null → RPC computes date_trunc('week', p_today) internally.
 * Never swallows errors — logs and rethrows (CLAUDE.md rule #5).
 */
export async function fetchCoachDashboard(
  coachId: string,
  today: string,
): Promise<CoachDashboardPayload> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_coach_dashboard", {
    p_coach_id: coachId,
    p_week_start: null,
    p_today: today,
  });

  if (error) {
    console.error("[coach-dashboard] RPC failed:", error);
    throw new Error("Failed to load coach dashboard");
  }
  if (!data) {
    console.error("[coach-dashboard] RPC returned no data for", coachId);
    throw new Error("Failed to load coach dashboard");
  }

  return data as unknown as CoachDashboardPayload;
}
```

No `unstable_cache` wrapping here — the caller in page.tsx owns caching (so each call site can own its key).
  </action>
  <verify>
  - File exists at `src/lib/rpc/coach-dashboard.ts`.
  - `grep -E "export async function fetchCoachDashboard" src/lib/rpc/coach-dashboard.ts` returns 1 match.
  - `grep -E "createAdminClient" src/lib/rpc/coach-dashboard.ts` returns at least 1 import and 1 call.
  - `grep -E "console\\.error" src/lib/rpc/coach-dashboard.ts` returns at least 2 matches.
  - `grep -E "throw new Error" src/lib/rpc/coach-dashboard.ts` returns at least 2 matches.
  </verify>
</task>

<task type="auto">
  <name>Task 4: Create src/components/coach/KPICard.tsx</name>
  <read_first>
    - src/app/(dashboard)/coach/page.tsx (existing 3 stat cards, lines 247–307 — exact structure to compose)
    - src/components/ui/Card.tsx
    - .planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md ("Component-Level Contracts" → KPICard)
  </read_first>
  <files>src/components/coach/KPICard.tsx</files>
  <action>
Create a server component (no `"use client"`) file:

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export type KPITint = "primary" | "success" | "info" | "warning";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  tint: KPITint;
  href: string;
  ariaLabel: string;
};

const TINTS: Record<KPITint, { bg: string; text: string }> = {
  primary: { bg: "bg-ima-primary/10", text: "text-ima-primary" },
  success: { bg: "bg-ima-success/10", text: "text-ima-success" },
  info:    { bg: "bg-ima-info/10",    text: "text-ima-info" },
  warning: { bg: "bg-ima-warning/10", text: "text-ima-warning" },
};

export function KPICard({ label, value, icon: Icon, tint, href, ariaLabel }: Props) {
  const t = TINTS[tint];
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="block min-h-[44px] rounded-lg motion-safe:transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2"
    >
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${t.text}`} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-ima-text tabular-nums">{value}</p>
            <p className="text-xs text-ima-text-secondary">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

No useState/useEffect; pure presentational server component. No client JS needed.
  </action>
  <verify>
  - File exists at `src/components/coach/KPICard.tsx`.
  - `grep -E "motion-safe:transition-shadow" src/components/coach/KPICard.tsx` → 1 match.
  - `grep -E "min-h-\[44px\]" src/components/coach/KPICard.tsx` → 1 match.
  - `grep -E "tabular-nums" src/components/coach/KPICard.tsx` → 1 match.
  - `grep -E "aria-label" src/components/coach/KPICard.tsx` → 1 match.
  - `grep -E "\"use client\"" src/components/coach/KPICard.tsx` → 0 matches.
  - `grep -E "(text|bg|border)-(gray|slate|zinc|neutral)-" src/components/coach/KPICard.tsx` → 0 matches.
  </verify>
</task>

<task type="auto">
  <name>Task 5: Create src/components/coach/RecentSubmissionsCard.tsx</name>
  <read_first>
    - src/app/(dashboard)/coach/page.tsx (at-risk list structure for the row link pattern)
    - src/components/ui/Card.tsx, src/components/ui/EmptyState.tsx
    - src/lib/rpc/coach-dashboard-types.ts
    - .planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md (Component-Level Contracts → RecentSubmissionsCard)
  </read_first>
  <files>src/components/coach/RecentSubmissionsCard.tsx</files>
  <action>
Create a server component file (no `"use client"` — purely presentational):

Imports:
- `Link from "next/link"`
- `{ Star, FileText } from "lucide-react"`
- `{ Card, CardContent } from "@/components/ui/Card"`
- `{ EmptyState } from "@/components/ui/EmptyState"`
- `type { CoachRecentReport } from "@/lib/rpc/coach-dashboard-types"`

Props: `{ reports: CoachRecentReport[] }`.

Relative time helper: implement inline as a pure function `formatRelative(iso: string, nowMs: number): string`:
  - Compute diff in milliseconds, return "Just now" if < 60s, "Nm ago" if < 60m, "Nh ago" if < 24h, "Yesterday" if < 48h, else `new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })`.
  - Accept `nowMs` as a parameter so callers pass a server-derived clock (no `Date.now()` inside; caller in page.tsx passes `new Date(today + "T23:59:59Z").getTime()`).

Card structure:

```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-ima-text">Recent Submissions</h2>
        <p className="text-xs text-ima-text-secondary">3 most recent reports from your students</p>
      </div>
      <Link
        href="/coach/reports"
        className="text-sm text-ima-primary hover:underline min-h-[44px] inline-flex items-center"
      >
        See all reports
      </Link>
    </div>

    {reports.length === 0 ? (
      <EmptyState
        variant="compact"
        icon={<FileText className="h-5 w-5" aria-hidden="true" />}
        title="No submissions yet"
        description="Reports from your students will appear here as soon as they log their day."
      />
    ) : (
      <ul className="space-y-1">
        {reports.map((r) => {
          const rating = r.star_rating ?? 0;
          const rel = formatRelative(r.submitted_at, nowMs);
          return (
            <li key={r.id}>
              <Link
                href={`/coach/reports#${r.id}`}
                aria-label={`${r.student_name} submitted a report, rated ${rating} of 5 stars, ${rel}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-ima-surface-light motion-safe:transition-colors min-h-[44px]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ima-text truncate">{r.student_name}</p>
                  <p className="text-xs text-ima-text-secondary">{rel}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={
                        n <= rating
                          ? "h-4 w-4 text-ima-warning fill-ima-warning"
                          : "h-4 w-4 text-ima-border"
                      }
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </CardContent>
</Card>
```

Accept `nowMs` as a second prop `{ reports: CoachRecentReport[]; nowMs: number }` so the page component injects its server-derived now timestamp — never use `Date.now()` at render time.
  </action>
  <verify>
  - File exists at `src/components/coach/RecentSubmissionsCard.tsx`.
  - `grep -E "min-h-\[44px\]" src/components/coach/RecentSubmissionsCard.tsx` → at least 2 matches (see-all link + row link).
  - `grep -E "motion-safe:transition-colors" src/components/coach/RecentSubmissionsCard.tsx` → 1 match.
  - `grep -E "EmptyState" src/components/coach/RecentSubmissionsCard.tsx` → at least 2 matches (import + usage).
  - `grep -E "aria-label" src/components/coach/RecentSubmissionsCard.tsx` → 1 match.
  - `grep -E "aria-hidden" src/components/coach/RecentSubmissionsCard.tsx` → at least 3 matches.
  - `grep -E "(text|bg|border)-(gray|slate|zinc|neutral)-" src/components/coach/RecentSubmissionsCard.tsx` → 0 matches.
  - `grep -E "Date\\.now\\(\\)" src/components/coach/RecentSubmissionsCard.tsx` → 0 matches.
  </verify>
</task>

<task type="auto">
  <name>Task 6: Create src/components/coach/WeeklyLeaderboardCard.tsx</name>
  <read_first>
    - src/app/(dashboard)/coach/page.tsx (at-risk avatar circle lines 339–346)
    - src/components/ui/Card.tsx, Badge.tsx, EmptyState.tsx
    - src/lib/rpc/coach-dashboard-types.ts
    - .planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md (Component-Level Contracts → WeeklyLeaderboardCard)
  </read_first>
  <files>src/components/coach/WeeklyLeaderboardCard.tsx</files>
  <action>
Create a server component file:

Imports:
- `Link from "next/link"` (only if needed — no per-row link this phase; rows are static)
- `{ Trophy } from "lucide-react"` for the empty-state icon
- `{ Card, CardContent } from "@/components/ui/Card"`
- `{ Badge } from "@/components/ui/Badge"`
- `{ EmptyState } from "@/components/ui/EmptyState"`
- `type { CoachTopHoursRow } from "@/lib/rpc/coach-dashboard-types"`

Props: `{ rows: CoachTopHoursRow[] }`.

Helper:
```ts
function formatHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
function initials(name: string): string {
  return name.split(" ").map(n => n[0] ?? "").join("").slice(0, 2).toUpperCase();
}
```

Structure:

```tsx
<Card>
  <CardContent className="p-4">
    <div className="mb-4">
      <h2 className="text-base font-semibold text-ima-text">Top 3 This Week</h2>
      <p className="text-xs text-ima-text-secondary">Hours worked since Monday</p>
    </div>
    {rows.length === 0 ? (
      <EmptyState
        variant="compact"
        icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
        title="No hours logged this week"
        description="Once your students start work sessions, the weekly leader will appear here."
      />
    ) : (
      <ul className="space-y-1">
        {rows.map((r, i) => {
          const rank = i + 1;
          return (
            <li
              key={r.student_id}
              className="flex items-center gap-3 p-3 rounded-lg min-h-[44px]"
            >
              <div className="shrink-0 w-10 flex items-center justify-center">
                {rank === 1 ? (
                  <Badge variant="primary">#1</Badge>
                ) : (
                  <span className="text-ima-text-muted font-semibold text-sm">#{rank}</span>
                )}
              </div>
              <div className="w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0">
                {initials(r.student_name)}
              </div>
              <p className="text-sm font-medium text-ima-text truncate flex-1">{r.student_name}</p>
              <p className="text-sm font-semibold text-ima-text tabular-nums shrink-0">
                {formatHoursLabel(r.minutes)}
              </p>
            </li>
          );
        })}
      </ul>
    )}
  </CardContent>
</Card>
```

Remove the `Link` import if unused (no destination this phase; leaderboard is informational). Do NOT render placeholder rows for missing ranks — UI-SPEC forbids it.
  </action>
  <verify>
  - File exists at `src/components/coach/WeeklyLeaderboardCard.tsx`.
  - `grep -E "min-h-\[44px\]" src/components/coach/WeeklyLeaderboardCard.tsx` → 1 match.
  - `grep -E "tabular-nums" src/components/coach/WeeklyLeaderboardCard.tsx` → 1 match.
  - `grep -E "EmptyState" src/components/coach/WeeklyLeaderboardCard.tsx` → at least 2 matches.
  - `grep -E "Badge variant=\"primary\"" src/components/coach/WeeklyLeaderboardCard.tsx` → 1 match.
  - `grep -E "bg-ima-primary" src/components/coach/WeeklyLeaderboardCard.tsx` → at least 1 match (avatar circle).
  - `grep -E "(text|bg|border)-(gray|slate|zinc|neutral)-" src/components/coach/WeeklyLeaderboardCard.tsx` → 0 matches.
  </verify>
</task>

<task type="auto">
  <name>Task 7: Extend src/app/(dashboard)/coach/page.tsx — wire RPC + render new blocks</name>
  <read_first>
    - src/app/(dashboard)/coach/page.tsx (full file — will insert new sections between existing 3-stat-card grid and at-risk banner)
    - src/lib/rpc/coach-dashboard.ts (newly created Task 3)
    - src/lib/rpc/coach-dashboard-types.ts (newly created Task 2)
    - src/components/coach/KPICard.tsx, RecentSubmissionsCard.tsx, WeeklyLeaderboardCard.tsx (newly created Tasks 4-6)
    - .planning/phases/47-coach-dashboard-homepage-stats/47-UI-SPEC.md
  </read_first>
  <files>src/app/(dashboard)/coach/page.tsx</files>
  <action>
Modify the coach page to fetch + render the new blocks. Keep existing greeting, 3 stat cards, at-risk banner, and student grid exactly as-is.

1. Add imports at the top:
   ```ts
   import { unstable_cache } from "next/cache";
   import { Briefcase, DollarSign, Map, Mail } from "lucide-react";
   import { fetchCoachDashboard, coachDashboardTag } from "@/lib/rpc/coach-dashboard";
   import { KPICard } from "@/components/coach/KPICard";
   import { RecentSubmissionsCard } from "@/components/coach/RecentSubmissionsCard";
   import { WeeklyLeaderboardCard } from "@/components/coach/WeeklyLeaderboardCard";
   ```

2. After `const today = getToday();` (around line 29), before the existing students fetch, add:
   ```ts
   const getCachedCoachDashboard = unstable_cache(
     async (coachId: string, t: string) => fetchCoachDashboard(coachId, t),
     ["coach-dashboard", user.id],
     { revalidate: 60, tags: [coachDashboardTag(user.id)] },
   );
   const dashboard = await getCachedCoachDashboard(user.id, today);
   ```
   (Inline the `unstable_cache` wrapper per-render — the tag keeps it correct. `unstable_cache`'s second argument is a key array; prefixing with coachId ensures no cross-coach bleed.)

3. Derive server-formatted KPI values:
   ```ts
   const intFormat = new Intl.NumberFormat("en-US");
   const currencyFormat = new Intl.NumberFormat("en-US", {
     style: "currency",
     currency: "USD",
     maximumFractionDigits: 0,
   });

   const dealsClosedLabel = intFormat.format(dashboard.stats.deals_closed);
   const revenueLabel = currencyFormat.format(dashboard.stats.revenue);
   const avgStepLabel = Number(dashboard.stats.avg_roadmap_step).toFixed(1);
   const emailsSentLabel = intFormat.format(dashboard.stats.emails_sent);
   ```

4. Derive `nowMs` once for RecentSubmissionsCard (reuse the existing `nowMs` variable already computed in page.tsx around line 110 — verify it exists; if not, declare it before the JSX).

5. Insert the new JSX AFTER the existing `{/* 3 Stat Cards */}` grid (closing `</div>` around line 307) and BEFORE `{/* At-risk banner */}` (line 309):
   ```tsx
   {/* KPI cards (Phase 47) */}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
     <KPICard
       label="Deals Closed"
       value={dealsClosedLabel}
       icon={Briefcase}
       tint="primary"
       href="/coach/analytics#deals"
       ariaLabel={`Deals Closed: ${dealsClosedLabel}. View in analytics.`}
     />
     <KPICard
       label="Revenue Generated"
       value={revenueLabel}
       icon={DollarSign}
       tint="success"
       href="/coach/analytics#revenue"
       ariaLabel={`Revenue Generated: ${revenueLabel}. View in analytics.`}
     />
     <KPICard
       label="Avg Roadmap Step"
       value={avgStepLabel}
       icon={Map}
       tint="info"
       href="/coach/analytics#roadmap"
       ariaLabel={`Average Roadmap Step: ${avgStepLabel}. View in analytics.`}
     />
     <KPICard
       label="Emails Sent"
       value={emailsSentLabel}
       icon={Mail}
       tint="warning"
       href="/coach/analytics#emails"
       ariaLabel={`Emails Sent: ${emailsSentLabel}. View in analytics.`}
     />
   </div>

   {/* Recent Submissions + Weekly Leaderboard (Phase 47) */}
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
     <RecentSubmissionsCard reports={dashboard.recent_reports} nowMs={nowMs} />
     <WeeklyLeaderboardCard rows={dashboard.top_hours_week} />
   </div>
   ```

6. If `nowMs` is currently declared inside the enrichment block (after the students fetch), hoist its declaration to BEFORE the new JSX (but after `today` is computed). Make sure only one `nowMs` declaration exists.

7. Zero-assigned-students fallback: if `studentIds.length === 0` AND all three dashboard arrays/counts are empty, the existing "No students assigned yet" EmptyState below still appears — the new KPI/Submissions/Leaderboard grid will simply render zeros + two EmptyStates. That is acceptable per UI-SPEC ("Zero-state values render as 0, $0, 0.0, 0 — never — or N/A") AND per the Recent/Leaderboard EmptyState contracts. Do NOT add an extra wrapper conditional.

8. Do NOT change requireRole, do NOT change the existing 3 stat card markup, do NOT change the at-risk banner or student grid. Only ADD the RPC fetch + two new grids.
  </action>
  <verify>
  - `grep -E "unstable_cache" src/app/\\(dashboard\\)/coach/page.tsx` → at least 1 match (import + call).
  - `grep -E "fetchCoachDashboard" src/app/\\(dashboard\\)/coach/page.tsx` → at least 2 matches (import + call).
  - `grep -E "coachDashboardTag" src/app/\\(dashboard\\)/coach/page.tsx` → at least 2 matches.
  - `grep -E "<KPICard" src/app/\\(dashboard\\)/coach/page.tsx` → 4 matches.
  - `grep -E "<RecentSubmissionsCard" src/app/\\(dashboard\\)/coach/page.tsx` → 1 match.
  - `grep -E "<WeeklyLeaderboardCard" src/app/\\(dashboard\\)/coach/page.tsx` → 1 match.
  - `grep -E "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" src/app/\\(dashboard\\)/coach/page.tsx` → at least 1 match.
  - `grep -E "grid-cols-1 lg:grid-cols-2" src/app/\\(dashboard\\)/coach/page.tsx` → at least 1 match.
  - `grep -E "(text|bg|border)-(gray|slate|zinc|neutral)-" src/app/\\(dashboard\\)/coach/page.tsx` → 0 matches (none newly added; existing file is already gray-free).
  </verify>
</task>

<task type="auto">
  <name>Task 8: Add coach-dashboard cache invalidation to API routes</name>
  <read_first>
    - src/app/api/deals/route.ts (existing revalidateTag pattern for studentAnalyticsTag)
    - src/app/api/reports/route.ts
    - src/app/api/work-sessions/route.ts
    - src/lib/rpc/coach-dashboard-types.ts (tag helper)
  </read_first>
  <files>
    - src/app/api/deals/route.ts
    - src/app/api/reports/route.ts
    - src/app/api/work-sessions/route.ts
  </files>
  <action>
For each of the three API routes:

1. Add import: `import { coachDashboardTag } from "@/lib/rpc/coach-dashboard-types";`

2. Wherever the existing code already determines the affected student id (`effectiveStudentId` in deals/route.ts; `profile.id` in reports/route.ts; `profile.id` in work-sessions/route.ts), immediately after the existing `revalidateTag(studentAnalyticsTag(...))` call, add a conditional coach-tag invalidation:

   For **deals/route.ts** (the effectiveStudentId already exists at the revalidate site; also have `admin` available):
   ```ts
   // Also invalidate the coach's dashboard cache, if the student has a coach.
   try {
     const { data: studentRow } = await admin
       .from("users")
       .select("coach_id")
       .eq("id", effectiveStudentId)
       .maybeSingle();
     if (studentRow?.coach_id) {
       revalidateTag(coachDashboardTag(studentRow.coach_id), "default");
     }
   } catch (err) {
     console.error("[deals] failed to invalidate coach-dashboard tag:", err);
   }
   ```
   Insert alongside both the POST success path (line ~180–182) and any PATCH success path (line ~194–196). Mirror the existing structure exactly — the try/catch pattern is needed so a missing student/coach lookup cannot break the mutation response.

   For **reports/route.ts** (profile.id is the acting student; admin exists via createAdminClient):
   ```ts
   try {
     const admin2 = createAdminClient();
     const { data: studentRow } = await admin2
       .from("users")
       .select("coach_id")
       .eq("id", profile.id)
       .maybeSingle();
     if (studentRow?.coach_id) {
       revalidateTag(coachDashboardTag(studentRow.coach_id), "default");
     }
   } catch (err) {
     console.error("[reports] failed to invalidate coach-dashboard tag:", err);
   }
   ```
   Add alongside EACH existing `revalidateTag(studentAnalyticsTag(profile.id), "default")` call (there are two: one in the PATCH path around line 107–109 and one in the POST path around line 139–141). If `admin` is already in scope in the enclosing function, reuse it instead of creating `admin2`.

   For **work-sessions/route.ts**: same pattern as reports, keyed on `profile.id`, added after the existing `revalidateTag(studentAnalyticsTag(profile.id), "default")` call (around line 185–187).

3. NEVER swallow errors — every catch logs via console.error. NEVER let the invalidation failure bubble up and kill the mutation response (the tag miss is recoverable; the mutation is not).

4. If the admin client is already imported in each file (`createAdminClient` already appears), reuse it. Only add the coach_id lookup if the module does not already fetch `coach_id` somewhere before this point.

5. Do not change the rest of the handler logic, do not modify validation schemas, do not change status codes.
  </action>
  <verify>
  - `grep -E "coachDashboardTag" src/app/api/deals/route.ts` → at least 2 matches (import + at least one call).
  - `grep -E "coachDashboardTag" src/app/api/reports/route.ts` → at least 2 matches.
  - `grep -E "coachDashboardTag" src/app/api/work-sessions/route.ts` → at least 2 matches.
  - `grep -E "console\\.error.*coach-dashboard" src/app/api/deals/route.ts` → at least 1 match.
  - `grep -E "\\.from\\(" src/app/api/deals/route.ts src/app/api/reports/route.ts src/app/api/work-sessions/route.ts | grep -v "admin"` shows only admin-prefixed from() — no non-admin .from() newly introduced.
  </verify>
</task>

<task type="auto">
  <name>Task 9: Post-phase gate — lint, typecheck, build</name>
  <read_first>
    - CLAUDE.md (commands section)
  </read_first>
  <files>none</files>
  <action>
Run these three commands in order and ensure each exits 0:

```
npm run lint
npx tsc --noEmit
npm run build
```

If lint fails on unused imports (e.g., if you imported `Link` into WeeklyLeaderboardCard.tsx but didn't use it), remove the unused import. If tsc fails, the most likely cause is a mismatch between the SQL-return shape and the TypeScript type — re-read the migration and the types file and align field names exactly.

If build fails with a "module not found" error on `@/lib/rpc/coach-dashboard-types` inside a client component, confirm: (1) types file has no runtime imports, (2) the server wrapper `coach-dashboard.ts` is only imported by server components.

Commit message (autonomous commit, per GSD workflow):
```
feat(47): coach dashboard homepage stats — 4 KPIs, recent reports, weekly leaderboard

- Add migration 00024 get_coach_dashboard batch RPC (stats + recent_reports + top_hours_week)
- Add src/lib/rpc/coach-dashboard(-types).ts — pure types + admin-client wrapper
- Add KPICard, RecentSubmissionsCard, WeeklyLeaderboardCard under src/components/coach
- Wire /coach page with unstable_cache 60s tagged coach-dashboard:${coachId}
- Invalidate tag from deals / reports / work-sessions API routes on mutations

Closes COACH-DASH-01..07
```
  </action>
  <verify>
  - `npm run lint` exit code 0.
  - `npx tsc --noEmit` exit code 0.
  - `npm run build` exit code 0.
  </verify>
</task>

</tasks>

<completion_criteria>
All nine tasks pass their individual verify blocks, the post-phase gate (lint + tsc + build) exits 0, and the commit is created. Manual DB verification (running the RPC against a live coach id and inspecting the jsonb shape) is deferred to verification phase.
</completion_criteria>
