---
phase: 46-student-analytics-page-recharts
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00023_get_student_analytics.sql
  - src/lib/types.ts
  - src/lib/config.ts
  - src/lib/rpc/student-analytics.ts
  - src/app/(dashboard)/student/analytics/page.tsx
  - src/app/(dashboard)/student/analytics/AnalyticsClient.tsx
  - src/app/(dashboard)/student/analytics/loading.tsx
  - src/app/(dashboard)/student/analytics/error.tsx
  - src/app/(dashboard)/student_diy/analytics/page.tsx
  - src/app/(dashboard)/student_diy/analytics/loading.tsx
  - src/app/(dashboard)/student_diy/analytics/error.tsx
  - src/app/api/deals/route.ts
  - src/app/api/reports/route.ts
  - src/app/api/work-sessions/route.ts
  - src/app/api/roadmap/route.ts
  - package.json
autonomous: true
requirements:
  - ANALYTICS-01
  - ANALYTICS-02
  - ANALYTICS-03
  - ANALYTICS-04
  - ANALYTICS-05
  - ANALYTICS-06
  - ANALYTICS-07
  - ANALYTICS-08
  - ANALYTICS-09
  - ANALYTICS-10

must_haves:
  truths:
    - "supabase/migrations/00023_get_student_analytics.sql creates function public.get_student_analytics(p_student_id uuid, p_range text, p_page int, p_page_size int) RETURNS jsonb, SECURITY DEFINER, STABLE, SET search_path = public"
    - "RPC rejects callers whose (SELECT auth.uid()) != p_student_id with EXCEPTION 'not_authorized' (ANALYTICS-07) — student cannot query another student's data even via direct RPC"
    - "RPC returns a single jsonb with keys: totals, streak, outreach_trend, hours_trend, deals, deal_summary, roadmap_deadlines, range, page, page_size, total_deal_count"
    - "Both /student/analytics and /student_diy/analytics routes exist and render the same AnalyticsClient component; both require requireRole('student') and requireRole('student_diy') respectively"
    - "NAVIGATION.student and NAVIGATION.student_diy in src/lib/config.ts include an 'Analytics' entry with icon 'BarChart3' pointing to the respective route (ANALYTICS-01)"
    - "Page uses unstable_cache with a user-scoped key ['student-analytics', user.id, range, page] and revalidate: 60 (ANALYTICS-08)"
    - "revalidateTag(`student-analytics:${studentId}`) is called inside src/app/api/deals/route.ts POST handler, src/app/api/reports/route.ts PATCH/POST handlers, src/app/api/work-sessions/route.ts POST/PATCH handlers, and src/app/api/roadmap/route.ts PATCH handler"
    - "Client renders exactly 6 KPI cards with labels matching UI-SPEC: Total Hours, Total Emails, Total Influencers, Total Deals, Total Revenue, Total Profit, plus streak indicator"
    - "Range selector is a <div role='group' aria-label='Select time range'> containing 4 <Button> elements with aria-pressed; default active = '30d'"
    - "Charts are wrapped in <div role='img' aria-label='...' tabIndex={0}> with a <details><summary>View data table</summary></details> fallback (ANALYTICS-09)"
    - "Recharts is added to package.json dependencies and imported only inside the client component (Next 16 App Router client boundary)"
    - "Every .from() query in API route handlers uses the admin client (createAdminClient) — grep must show no non-admin .from() inside /api routes"
    - "Every animate-* class in AnalyticsClient.tsx uses motion-safe: prefix (grep must show 0 hits of unprefixed animate-)"
    - "Every interactive element (range buttons, pagination, summary toggle) has min-h-[44px] min-w-[44px] explicit classes"
    - "Deal table attribution chip derives from deals.logged_by vs student_id/coach_id/owner_id — 'self' when logged_by == student_id, 'coach' when logged_by is a coach, 'owner' when logged_by is an owner"
    - "Empty state (no deals) uses the EmptyState primitive with copy from UI-SPEC"
    - "npm run lint && npx tsc --noEmit && npm run build all exit 0"
  artifacts:
    - supabase/migrations/00023_get_student_analytics.sql
    - src/app/(dashboard)/student/analytics/page.tsx
    - src/app/(dashboard)/student/analytics/AnalyticsClient.tsx
    - src/app/(dashboard)/student/analytics/loading.tsx
    - src/app/(dashboard)/student/analytics/error.tsx
    - src/app/(dashboard)/student_diy/analytics/page.tsx
    - src/app/(dashboard)/student_diy/analytics/loading.tsx
    - src/app/(dashboard)/student_diy/analytics/error.tsx
    - src/lib/rpc/student-analytics.ts
  key_links:
    - "get_student_analytics consumes week_start() and idx_* from Phase 44 migration 00021 — do not re-declare them"
    - "Deal attribution chip reads deals.logged_by from Phase 45 migration 00022 — column is guaranteed NOT NULL"
    - "AnalyticsClient is a Client Component ('use client'); server wrapper page.tsx calls RPC + unstable_cache and passes data as props"
    - "revalidateTag cross-cuts 4 existing API route files — when any mutation touches work_sessions/deals/reports/roadmap for student S, tag 'student-analytics:S' is invalidated"
    - "UI-SPEC.md governs all copy, color, spacing, typography — this plan implements it 1:1"
---

<objective>
Ship the Student Analytics Page — the first full end-user surface for v1.5 analytics. Students (student + student_diy) get one URL (`/student/analytics`, `/student_diy/analytics`) rendering six KPI cards, outreach + hours trend charts (Recharts), a paginated deal history table with attribution chips, and a roadmap deadline status list. All data flows through a single batch RPC `get_student_analytics`, wrapped in `unstable_cache` (60s TTL, user-scoped tag), and invalidated by deal/report/session/roadmap mutations. UI matches 46-UI-SPEC.md exactly — motion-safe animations, 44px touch targets, role="img" + details fallback on charts, ima-* tokens only.

Purpose: Delivers ANALYTICS-01 through ANALYTICS-10 in a single plan. Backend (RPC) + frontend (page + client component) + glue (config nav, API tag invalidation) — all tightly coupled enough that splitting them would just create scaffolding churn. Relies on Phase 44 foundation (week_start, indexes) and Phase 45 logged_by.
Output: One new SQL migration, two new route folders, one RPC TS helper, one config nav update, four API route edits for cache invalidation, one package.json update (add recharts).
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
@.planning/phases/46-student-analytics-page-recharts/46-CONTEXT.md
@.planning/phases/46-student-analytics-page-recharts/46-UI-SPEC.md
@CLAUDE.md
@supabase/migrations/00021_analytics_foundation.sql
@supabase/migrations/00022_deals_logged_by.sql
@src/lib/config.ts
@src/lib/kpi.ts
@src/lib/roadmap-utils.ts
@src/lib/supabase/admin.ts
@src/lib/session.ts
@src/lib/types.ts
@src/components/ui/Card.tsx
@src/components/ui/Button.tsx
@src/components/ui/Badge.tsx
@src/components/ui/EmptyState.tsx
@src/components/ui/Skeleton.tsx
@src/components/ui/PaginationControls.tsx
@src/app/(dashboard)/student/page.tsx
@src/app/(dashboard)/coach/analytics/page.tsx
@src/app/api/deals/route.ts
@src/app/api/reports/route.ts
@src/app/api/work-sessions/route.ts
@src/app/api/roadmap/route.ts
@tailwind.config.ts

<interfaces>
Relevant existing exports — executor MUST NOT break:

From src/lib/config.ts:
- ROUTES.student, ROUTES.student_diy — add `analytics` sub-path
- NAVIGATION.student, NAVIGATION.student_diy — add Analytics item
- ACTIVITY, ROADMAP_STEPS, KPI_TARGETS — reference only
- Default export `config` aggregates every named export

From src/lib/roadmap-utils.ts:
- getDeadlineStatus(target_days, joinedAt, status, completedAt) → DeadlineStatus discriminated union

From src/lib/types.ts (Database interface):
- public.deals.Row { id, student_id, deal_number, revenue, profit, created_at, logged_by, updated_by, ... }
- public.work_sessions.Row { student_id, date, duration_minutes, status, ... }
- public.daily_reports.Row { student_id, date, brands_contacted, influencers_contacted, submitted_at }
- public.roadmap_progress.Row { student_id, step_number, status, completed_at }
- public.users.Row { id, role, coach_id, joined_at }

Phase 44 SQL helpers available:
- public.week_start(date) → date (ISO Monday)
- public.student_activity_status(uuid, date) → text ('active'|'inactive')
- idx_deals_student_created (deals: student_id, created_at DESC)
- idx_work_sessions_completed_student_date (partial WHERE status='completed')
- idx_roadmap_progress_student_status

Phase 45 columns guaranteed:
- deals.logged_by uuid NOT NULL REFERENCES users(id)
- deals.updated_by, deals.updated_at
</interfaces>

<conventions>
- Admin client only in API routes (CLAUDE.md hard rule #4)
- motion-safe: on every animate-* (CLAUDE.md hard rule #1)
- 44px touch targets (CLAUDE.md hard rule #2)
- Zod safeParse + try/catch on request.json() in all API routes
- import { z } from "zod" — never "zod/v4"
- Colors: ima-* tokens only, no hardcoded hex (except chart JS constants mirroring tailwind values)
- revalidateTag pattern: `student-analytics:${student_id}` (one tag per student, cross-cut from 4 mutation routes)
- SQL: SECURITY DEFINER STABLE + SET search_path = public (Phase 44 pattern); always use (SELECT auth.uid()) not bare auth.uid() (PERF-03)
</conventions>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add recharts dependency</name>
  <files>package.json</files>
  <read_first>package.json</read_first>
  <action>Add `"recharts": "^2.13.0"` to dependencies. Run `npm install recharts` (it will update package-lock.json). Do NOT upgrade any other dependency — version pin recharts to a 2.x that supports React 19 peer (2.13+ is safe). If npm install fails due to peer conflict, use `npm install recharts --legacy-peer-deps` and note it in SUMMARY.md.</action>
  <verify>grep -q '"recharts"' package.json && test -d node_modules/recharts</verify>
  <acceptance_criteria>
    - package.json dependencies section contains `"recharts"` key
    - node_modules/recharts/package.json exists
  </acceptance_criteria>
  <done>recharts resolves and can be imported in a client component</done>
</task>

<task type="auto">
  <name>Task 2: Add analytics routes to ROUTES + NAVIGATION in config.ts</name>
  <files>src/lib/config.ts</files>
  <read_first>src/lib/config.ts</read_first>
  <action>
    In ROUTES.student (around line 82-90), add `analytics: "/student/analytics",` after `resources`.
    In ROUTES.student_diy (around line 92-98), add `analytics: "/student_diy/analytics",` after `resources`.
    In NAVIGATION.student (around line 304-313), add a new entry:
      `{ label: "Analytics", href: ROUTES.student.analytics, icon: "BarChart3" }` — insert AFTER the "Deals" item and BEFORE "Chat".
    In NAVIGATION.student_diy (around line 314-320), add:
      `{ label: "Analytics", href: ROUTES.student_diy.analytics, icon: "BarChart3" }` — insert AFTER "Deals" and BEFORE "Resources".
    Do NOT touch owner or coach navigation — Phase 47/48 own those.
    Verify the default export `config` aggregate at the bottom still includes navigation.
  </action>
  <verify>grep -n "\"Analytics\"" src/lib/config.ts | wc -l</verify>
  <acceptance_criteria>
    - src/lib/config.ts contains ROUTES.student.analytics = "/student/analytics"
    - src/lib/config.ts contains ROUTES.student_diy.analytics = "/student_diy/analytics"
    - NAVIGATION.student contains an entry with label "Analytics" and href "/student/analytics"
    - NAVIGATION.student_diy contains an entry with label "Analytics" and href "/student_diy/analytics"
    - npx tsc --noEmit exits 0
  </acceptance_criteria>
  <done>Sidebar renders Analytics link for both student roles</done>
</task>

<task type="auto">
  <name>Task 3: Create SQL RPC get_student_analytics migration</name>
  <files>supabase/migrations/00023_get_student_analytics.sql</files>
  <read_first>supabase/migrations/00021_analytics_foundation.sql, supabase/migrations/00022_deals_logged_by.sql, supabase/migrations/00001_create_tables.sql</read_first>
  <action>
    Create migration 00023_get_student_analytics.sql. File structure:

    Header comment block: "Phase 46: Student Analytics RPC" listing what it creates and dependencies on Phase 44/45.

    Create `CREATE OR REPLACE FUNCTION public.get_student_analytics(p_student_id uuid, p_range text DEFAULT '30d', p_page int DEFAULT 1, p_page_size int DEFAULT 25) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public`.

    Inside the function body:
      1. Authorization guard FIRST:
         `IF (SELECT auth.uid()) IS DISTINCT FROM p_student_id THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;`
      2. Validate p_range IN ('7d','30d','90d','all'); else RAISE EXCEPTION 'invalid_range'.
      3. Compute `v_start_date` from p_range: CURRENT_DATE - 6 / 29 / 89, or NULL for 'all'.
      4. Build `v_totals` CTE-equivalent:
         - total_hours  = SUM(duration_minutes) / 60.0 from work_sessions WHERE student_id = p_student_id AND status = 'completed'
         - total_emails = SUM(brands_contacted + influencers_contacted) from daily_reports WHERE student_id = p_student_id AND submitted_at IS NOT NULL
         - total_influencers = SUM(influencers_contacted) from same
         - total_deals = COUNT(*) from deals WHERE student_id = p_student_id
         - total_revenue = SUM(revenue) from same
         - total_profit  = SUM(profit) from same
      5. Compute `v_streak` (current day streak) — consecutive days ending on CURRENT_DATE with at least one submitted daily_report. Use a recursive CTE or a dense_rank trick. If no report today, streak = 0.
      6. Compute `v_outreach_trend` as jsonb array of { week_start, brands, influencers } grouped by `public.week_start(date)` from daily_reports where submitted_at IS NOT NULL AND date >= v_start_date (or all-time when NULL). Ordered ASC.
      7. Compute `v_hours_trend` as jsonb array of { bucket, hours } where bucket = date (for 7d/30d) or week_start(date) (for 90d/all). Only status='completed' work_sessions. Ordered ASC.
      8. Compute `v_deals` paginated: select id, deal_number, revenue, profit, (CASE WHEN revenue > 0 THEN round((profit/revenue)*100, 1) ELSE 0 END) AS margin, created_at, logged_by, (SELECT role FROM users WHERE id = d.logged_by) AS logger_role, (logged_by = p_student_id) AS is_self from deals d WHERE student_id = p_student_id ORDER BY created_at DESC OFFSET (p_page-1)*p_page_size LIMIT p_page_size.
         - Total count: `v_total_deal_count` = COUNT(*) from deals.
         - Summary: `v_deal_summary` = { count, revenue, profit } (ALL deals, not just page).
      9. Compute `v_roadmap` as jsonb array of { step_number, status, completed_at } from roadmap_progress WHERE student_id = p_student_id ORDER BY step_number. (Deadline math stays in TS via getDeadlineStatus — cheaper and already tested.)
      10. Return `jsonb_build_object('totals', v_totals, 'streak', v_streak, 'outreach_trend', v_outreach_trend, 'hours_trend', v_hours_trend, 'deals', v_deals, 'deal_summary', v_deal_summary, 'roadmap_progress', v_roadmap, 'range', p_range, 'page', p_page, 'page_size', p_page_size, 'total_deal_count', v_total_deal_count)`.

    After the function, `GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int) TO authenticated;`

    Add COMMENT ON FUNCTION documenting: auth guard, 60s cache layer in Next, depends on Phase 44 indexes and Phase 45 logged_by.

    Do NOT create new indexes — Phase 44 owns them. Do NOT embed deadline math in SQL — TS owns that via getDeadlineStatus.

    Use `(SELECT auth.uid())` never bare `auth.uid()` (PERF-03).
  </action>
  <verify>test -f supabase/migrations/00023_get_student_analytics.sql && grep -q "CREATE OR REPLACE FUNCTION public.get_student_analytics" supabase/migrations/00023_get_student_analytics.sql && grep -q "SECURITY DEFINER" supabase/migrations/00023_get_student_analytics.sql && grep -q "not_authorized" supabase/migrations/00023_get_student_analytics.sql && ! grep -E "^\s*auth\.uid\(\)" supabase/migrations/00023_get_student_analytics.sql | grep -v "SELECT auth.uid()"</verify>
  <acceptance_criteria>
    - File exists with correct header comment
    - Function signature matches: `get_student_analytics(uuid, text, int, int) RETURNS jsonb`
    - Contains `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
    - First statement inside body is the auth guard raising 'not_authorized'
    - Returns keys: totals, streak, outreach_trend, hours_trend, deals, deal_summary, roadmap_progress, range, page, page_size, total_deal_count
    - Uses `(SELECT auth.uid())` — no bare `auth.uid()` except inside the parenthesized SELECT
    - GRANT EXECUTE to authenticated present
    - `psql -f` or supabase migration apply would succeed (well-formed SQL)
  </acceptance_criteria>
  <done>Migration applies cleanly on a fresh DB with Phase 44 + 45 already applied</done>
</task>

<task type="auto">
  <name>Task 4: Create RPC TypeScript wrapper src/lib/rpc/student-analytics.ts</name>
  <files>src/lib/rpc/student-analytics.ts</files>
  <read_first>src/lib/rpc/types.ts, src/lib/supabase/admin.ts, src/lib/types.ts</read_first>
  <action>
    Create a typed wrapper that calls the RPC via the admin client and returns a strongly-typed result.

    Exports:
    - `export type StudentAnalyticsRange = '7d' | '30d' | '90d' | 'all';`
    - `export type StudentAnalyticsTotals = { total_hours: number; total_emails: number; total_influencers: number; total_deals: number; total_revenue: number; total_profit: number };`
    - `export type OutreachBucket = { week_start: string; brands: number; influencers: number };`
    - `export type HoursBucket = { bucket: string; hours: number };`
    - `export type DealRow = { id: string; deal_number: number; revenue: number; profit: number; margin: number; created_at: string; logged_by: string; logger_role: 'student'|'student_diy'|'coach'|'owner'|null; is_self: boolean };`
    - `export type RoadmapRow = { step_number: number; status: 'locked'|'active'|'completed'; completed_at: string | null };`
    - `export type StudentAnalyticsPayload = { totals: StudentAnalyticsTotals; streak: number; outreach_trend: OutreachBucket[]; hours_trend: HoursBucket[]; deals: DealRow[]; deal_summary: { count: number; revenue: number; profit: number }; roadmap_progress: RoadmapRow[]; range: StudentAnalyticsRange; page: number; page_size: number; total_deal_count: number };`
    - `export const STUDENT_ANALYTICS_PAGE_SIZE = 25;`
    - `export function studentAnalyticsTag(studentId: string): string` → returns `student-analytics:${studentId}`
    - `export async function fetchStudentAnalytics(studentId: string, range: StudentAnalyticsRange, page: number): Promise<StudentAnalyticsPayload>` — calls `admin.rpc('get_student_analytics', { p_student_id: studentId, p_range: range, p_page: page, p_page_size: STUDENT_ANALYTICS_PAGE_SIZE })`. If error: `console.error('[student-analytics]', error)` and `throw new Error('Failed to load analytics')` (never swallow per CLAUDE.md rule #5).

    Inside fetchStudentAnalytics, call `admin.rpc(...).single<StudentAnalyticsPayload>()` — supabase returns jsonb as object.

    Do NOT import React or Next here — pure data layer.
  </action>
  <verify>test -f src/lib/rpc/student-analytics.ts && npx tsc --noEmit</verify>
  <acceptance_criteria>
    - File exports all types listed above plus fetchStudentAnalytics and studentAnalyticsTag
    - fetchStudentAnalytics uses createAdminClient
    - Error path logs and throws — no silent catch
    - npx tsc --noEmit exits 0
  </acceptance_criteria>
  <done>Pages can import typed data layer without duplicating query logic</done>
</task>

<task type="auto">
  <name>Task 5: Build AnalyticsClient component (src/app/(dashboard)/student/analytics/AnalyticsClient.tsx)</name>
  <files>src/app/(dashboard)/student/analytics/AnalyticsClient.tsx</files>
  <read_first>.planning/phases/46-student-analytics-page-recharts/46-UI-SPEC.md, src/app/(dashboard)/student/page.tsx, src/components/ui/Card.tsx, src/components/ui/Button.tsx, src/components/ui/Badge.tsx, src/components/ui/EmptyState.tsx, src/components/ui/PaginationControls.tsx, src/lib/roadmap-utils.ts, src/lib/config.ts</read_first>
  <action>
    Create a Client Component ('use client' directive at top). Accepts props:
      - `initialData: StudentAnalyticsPayload`
      - `studentId: string`
      - `joinedAt: string`
      - `initialRange: StudentAnalyticsRange`
      - `initialPage: number`
      - `basePath: '/student/analytics' | '/student_diy/analytics'`

    Imports: React hooks (useState, useCallback, useTransition, useMemo), Recharts (LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine), lucide-react icons (Clock, Mail, Users, Handshake, DollarSign, TrendingUp, Flame, BarChart3), internal UI primitives (Card, Button, Badge, EmptyState, PaginationControls), getDeadlineStatus from roadmap-utils, ROADMAP_STEPS from config, types from student-analytics rpc module.

    Chart color constants at top:
      ```ts
      const chartColors = {
        primary: "#2563EB",      // ima-primary
        accent: "#3B82F6",       // ima-accent
        border: "#E2E8F0",       // ima-border
        textSecondary: "#64748B",// ima-text-secondary
        warning: "#F59E0B",      // ima-warning
      } as const;
      ```
      (These mirror tailwind.config.ts `ima-*` values — single source still tailwind; JS needs literal for Recharts props.)

    Layout matches UI-SPEC exactly:
      1. Header: `<h1 class="text-2xl font-bold text-ima-text">Analytics</h1>` + subtitle "Your performance at a glance" (text-ima-text-secondary text-sm mt-1).
      2. KPI grid: 6 Cards in `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn`. Each card: icon (aria-hidden), label (text-xs uppercase tracking-wide text-ima-text-secondary), value (text-3xl font-bold text-ima-text, leading-tight). Streak indicator sits on Total Hours card ("{N}-day streak" with Flame icon) or as its own mini-pill below the KPI value when streak > 0.
      3. Trend charts row: `grid grid-cols-1 lg:grid-cols-2 gap-6 motion-safe:animate-slideUp`. Each chart Card has:
         - header row: title ("Outreach Trend" / "Hours Worked") + range selector on the right.
         - Range selector: `<div role="group" aria-label="Select time range" class="flex gap-2">` with 4 Buttons (variant primary when active else secondary) each min-h-[44px] min-w-[60px], aria-pressed, aria-label "Last 7 days" etc. Shared state — selecting a range re-navigates with ?range=... preserving page reset to 1.
         - Chart wrapper: `<div role="img" aria-label="{prose summary}" tabIndex={0} class="focus-visible:outline-2 focus-visible:outline-ima-primary rounded">` then `<ResponsiveContainer width="100%" height={260}>`. Outreach: LineChart with 2 lines (brands=primary, influencers=accent) X=week_start formatted MM/DD, Y=count, CartesianGrid stroke={chartColors.border}, Legend. Hours: BarChart with bars fill=primary, plus ReferenceLine at y={WORK_TRACKER.dailyGoalHours} stroke={chartColors.warning} strokeDasharray="4 4" label="Daily goal".
         - Below chart: `<details class="mt-2"><summary class="min-h-[44px] text-sm text-ima-primary cursor-pointer">View data table</summary><table class="w-full text-xs mt-2">...</table></details>` (ANALYTICS-09).
         - Empty: if buckets.length === 0, swap chart for EmptyState "No activity in this range" / "Try a longer time range, or check back after your next session."
      4. Roadmap Progress Card: full-width Card titled "Roadmap Progress". Map over ROADMAP_STEPS; for each, find matching roadmap_progress row, call `getDeadlineStatus(step.target_days, joinedAt, row?.status ?? 'locked', row?.completed_at ?? null)`, render:
         `<li>` containing step number + label + status Badge. Badge variant/color by kind:
         - completed → ima-success
         - on-track → ima-success
         - due-soon → ima-warning
         - overdue → ima-error
         - none → ima-surface-light text-ima-text
         - (ahead/completed-with-daysLate=null but kind='completed' → show "Completed" + date)
         Include `<span class="sr-only">Status: {human label}</span>` on each Badge.
      5. Deal History Card: full-width Card titled "Deal History". Header line: `{summary.count} deals · ${summary.revenue.toLocaleString()} revenue · ${summary.profit.toLocaleString()} profit` styled as text-sm text-ima-text-secondary. Table: columns Deal # / Revenue / Profit / Margin / Logged / By. `<th scope="col">` each. Attribution chip using Badge: self = surface-light+text; coach = surface-accent+secondary; owner = primary+white. Empty: EmptyState "No deals logged yet" / "Once you close your first deal, it will show up here. Keep your outreach consistent." (copy from UI-SPEC). Below: PaginationControls using total_deal_count / page_size.

    State management:
      - `const [range, setRange] = useState(initialRange);`
      - `const [page, setPage] = useState(initialPage);`
      - `const [data, setData] = useState(initialData);`
      - `const [isPending, startTransition] = useTransition();`
      - When range or page changes: startTransition(() => fetch next segment via `/student/analytics?range=X&page=Y` — use Next router.push with scroll: false, and rely on server re-render. Simplest: use `useRouter().push(\`${basePath}?range=${r}&page=${p}\`)` and let the server component re-fetch (cached).

    Accessibility:
      - All icons marked `aria-hidden="true"`.
      - Interactive elements (all buttons, table header cells if sortable, details summary, pagination) ≥ 44px (min-h-[44px]).
      - Every animate-* MUST be prefixed with motion-safe:.
      - Focus rings use ima-primary.

    Error fallback: if a sub-section has error (e.g., streak null), render inline error banner "Couldn't load this section" rather than crashing.

    No hardcoded hex outside the chartColors const; all other colors use ima-* tailwind classes.
  </action>
  <verify>test -f "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx" && grep -q "'use client'" "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx" && ! grep -E "\banimate-" "src/app/(dashboard)/student/analytics/AnalyticsClient.tsx" | grep -v "motion-safe:animate-"</verify>
  <acceptance_criteria>
    - File starts with 'use client' directive
    - Imports recharts primitives
    - Contains exactly 6 KPI card renders matching UI-SPEC labels
    - role="group" aria-label="Select time range" present
    - role="img" wrapper around each <ResponsiveContainer>
    - <details><summary>View data table</summary> present twice (once per chart)
    - PaginationControls imported and rendered
    - EmptyState used for both no-deals and no-trend-data
    - Every animate-* is prefixed motion-safe:
    - Every interactive min-h-[44px]
    - No hardcoded color hex outside chartColors object
    - npx tsc --noEmit exits 0
  </acceptance_criteria>
  <done>Client component renders, interactive, a11y-compliant</done>
</task>

<task type="auto">
  <name>Task 6: Build /student/analytics server page + loading + error</name>
  <files>src/app/(dashboard)/student/analytics/page.tsx, src/app/(dashboard)/student/analytics/loading.tsx, src/app/(dashboard)/student/analytics/error.tsx</files>
  <read_first>src/app/(dashboard)/student/page.tsx, src/app/(dashboard)/student/loading.tsx, src/app/(dashboard)/student/error.tsx, src/lib/session.ts</read_first>
  <action>
    Create `page.tsx`:
      - `import { unstable_cache } from 'next/cache'`; import `requireRole` from '@/lib/session'; import `createAdminClient` from '@/lib/supabase/admin'; import the RPC wrapper from `@/lib/rpc/student-analytics`; import AnalyticsClient.
      - Accept searchParams: `{ range?: string; page?: string }` (Next 16 App Router passes as Promise in server components — `await` it).
      - `const user = await requireRole('student');`
      - Parse+validate range via a small Zod schema (`z.enum(['7d','30d','90d','all']).default('30d')`) using safeParse; fallback to '30d' on failure. Same for page (`z.coerce.number().int().min(1).default(1)`).
      - Fetch user.joined_at from users table (admin.from('users').select('joined_at').eq('id', user.id).single()). Handle error — toast not applicable server-side; throw so error.tsx catches.
      - Build a cached RPC caller:
        ```ts
        const fetchCached = unstable_cache(
          async (studentId: string, r: StudentAnalyticsRange, p: number) =>
            fetchStudentAnalytics(studentId, r, p),
          ['student-analytics'],
          { revalidate: 60, tags: [studentAnalyticsTag(user.id)] }
        );
        const data = await fetchCached(user.id, range, page);
        ```
      - Return `<div class="px-4 md:px-6 py-8 md:py-12 max-w-7xl mx-auto"><AnalyticsClient initialData={data} studentId={user.id} joinedAt={user.joined_at ?? ...} initialRange={range} initialPage={page} basePath="/student/analytics" /></div>`.

    Create `loading.tsx`: returns a skeleton matching the layout — header block, 6 skeleton KPI cards grid, 2 skeleton chart cards, 2 skeleton list cards. Use `Skeleton` primitive. Wrap each Card with `aria-busy="true"` and include `<span class="sr-only">Loading analytics</span>`.

    Create `error.tsx`: client component ('use client'), receives `{ error, reset }`. Displays EmptyState-like fallback: heading "We couldn't load your analytics", body "Refresh the page or try again in a moment.", plus a `<Button variant="primary" onClick={reset}>Retry</Button>` (min-h-[44px]). console.error(error) on mount to satisfy CLAUDE.md rule #5.
  </action>
  <verify>test -f "src/app/(dashboard)/student/analytics/page.tsx" && test -f "src/app/(dashboard)/student/analytics/loading.tsx" && test -f "src/app/(dashboard)/student/analytics/error.tsx" && grep -q "unstable_cache" "src/app/(dashboard)/student/analytics/page.tsx" && grep -q "requireRole" "src/app/(dashboard)/student/analytics/page.tsx"</verify>
  <acceptance_criteria>
    - page.tsx uses requireRole('student')
    - page.tsx wraps fetch in unstable_cache with tags including studentAnalyticsTag(user.id) and revalidate:60
    - page.tsx validates range/page with zod safeParse
    - loading.tsx uses Skeleton primitives and aria-busy
    - error.tsx is 'use client', calls console.error, has Retry button min-h-[44px]
    - npx tsc --noEmit exits 0
  </acceptance_criteria>
  <done>Visiting /student/analytics as a student renders the page with cached data</done>
</task>

<task type="auto">
  <name>Task 7: Build /student_diy/analytics mirror</name>
  <files>src/app/(dashboard)/student_diy/analytics/page.tsx, src/app/(dashboard)/student_diy/analytics/loading.tsx, src/app/(dashboard)/student_diy/analytics/error.tsx</files>
  <read_first>src/app/(dashboard)/student/analytics/page.tsx</read_first>
  <action>
    Mirror Task 6 exactly but swap `requireRole('student')` → `requireRole('student_diy')` and `basePath="/student/analytics"` → `basePath="/student_diy/analytics"`. Re-uses the SAME AnalyticsClient component (import path: `@/app/(dashboard)/student/analytics/AnalyticsClient`). Re-uses the SAME RPC wrapper. loading.tsx and error.tsx are identical content to the student ones (copy — keeping them co-located with the route per App Router conventions).
  </action>
  <verify>test -f "src/app/(dashboard)/student_diy/analytics/page.tsx" && grep -q "requireRole(\"student_diy\")" "src/app/(dashboard)/student_diy/analytics/page.tsx" && grep -q "AnalyticsClient" "src/app/(dashboard)/student_diy/analytics/page.tsx"</verify>
  <acceptance_criteria>
    - student_diy route exists with requireRole('student_diy')
    - Imports AnalyticsClient from the student/analytics path (single source)
    - basePath prop is "/student_diy/analytics"
  </acceptance_criteria>
  <done>Visiting /student_diy/analytics as a student_diy user renders identically</done>
</task>

<task type="auto">
  <name>Task 8: Wire revalidateTag into mutation API routes</name>
  <files>src/app/api/deals/route.ts, src/app/api/reports/route.ts, src/app/api/work-sessions/route.ts, src/app/api/roadmap/route.ts</files>
  <read_first>src/app/api/deals/route.ts, src/app/api/reports/route.ts, src/app/api/work-sessions/route.ts, src/app/api/roadmap/route.ts, src/lib/rpc/student-analytics.ts</read_first>
  <action>
    For each route above, after a successful mutation (insert/update/patch) that affects a specific student's deals, reports, work_sessions, or roadmap_progress row, call `revalidateTag(studentAnalyticsTag(studentId))`.

    Concretely:
      - `src/app/api/deals/route.ts` POST: after insert succeeds, `revalidateTag(studentAnalyticsTag(insertedRow.student_id))`. Also in any existing PATCH/DELETE for deals, same treatment.
      - `src/app/api/reports/route.ts`: POST/PATCH (submit report). After submit succeeds, revalidate for `report.student_id`.
      - `src/app/api/work-sessions/route.ts`: POST (create session) and PATCH (complete/abandon session). Revalidate on every status transition that affects totals — specifically when status becomes 'completed'.
      - `src/app/api/roadmap/route.ts`: PATCH (complete step / unlock). Revalidate on every status change.

    Import `revalidateTag` from 'next/cache' and `studentAnalyticsTag` from '@/lib/rpc/student-analytics' at the top of each file.

    Do NOT swallow errors from revalidateTag — it's synchronous and shouldn't throw, but wrap in try/catch and `console.error('[revalidate-tag]', e)` if it does.

    Do NOT change auth/role logic, Zod validation, or response shape — this is strictly additive.
  </action>
  <verify>grep -l "studentAnalyticsTag" src/app/api/deals/route.ts src/app/api/reports/route.ts src/app/api/work-sessions/route.ts src/app/api/roadmap/route.ts | wc -l</verify>
  <acceptance_criteria>
    - All 4 API route files import studentAnalyticsTag and revalidateTag
    - Each file calls revalidateTag(studentAnalyticsTag(studentId)) after successful mutation
    - No changes to existing auth/validation logic
    - npx tsc --noEmit exits 0
    - npm run build exits 0
  </acceptance_criteria>
  <done>A deal/report/session/roadmap mutation invalidates the student's analytics cache within one request</done>
</task>

<task type="auto">
  <name>Task 9: Apply migration locally and regenerate types (if supabase tooling available)</name>
  <files>src/lib/types.ts</files>
  <read_first>supabase/migrations/00023_get_student_analytics.sql, src/lib/types.ts</read_first>
  <action>
    Attempt `npx supabase db push` (or `npx supabase db reset` if local). If tooling isn't available in CI, skip the apply but ensure types.ts includes the new Functions entry:
      In `Database['public']['Functions']`, add:
      ```ts
      get_student_analytics: {
        Args: { p_student_id: string; p_range?: string; p_page?: number; p_page_size?: number };
        Returns: Json; // jsonb
      };
      ```
      (Or regenerated type if supabase gen types runs successfully.)

    Never break existing Functions entries. If type regeneration conflicts, prefer the manual addition to keep the build passing and note in SUMMARY.md that regen is pending for v1.5.
  </action>
  <verify>grep -q "get_student_analytics" src/lib/types.ts && npx tsc --noEmit</verify>
  <acceptance_criteria>
    - src/lib/types.ts Database['public']['Functions']['get_student_analytics'] exists
    - npx tsc --noEmit exits 0
  </acceptance_criteria>
  <done>TypeScript knows about the new RPC</done>
</task>

<task type="auto">
  <name>Task 10: Full build + lint + type check</name>
  <files>(verification-only)</files>
  <read_first>(n/a)</read_first>
  <action>
    Run in order, stopping at first failure:
      1. `npx tsc --noEmit`
      2. `npm run lint`
      3. `npm run build`
    If any fails, fix in the originating task file (don't band-aid). Common failures to expect:
      - Recharts peer-dep conflict with React 19 → add `--legacy-peer-deps` to install
      - Missing `'use client'` on AnalyticsClient → confirm first line
      - Unused imports → clean up
      - Zod v4 accidentally imported → use `import { z } from "zod"` (CLAUDE.md rule #7)
  </action>
  <verify>npm run build</verify>
  <acceptance_criteria>
    - All three commands exit 0
    - No new TypeScript errors vs baseline
    - No new ESLint errors vs baseline
  </acceptance_criteria>
  <done>Build is green end-to-end</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run build` exits 0
- [ ] `/student/analytics` renders with data as a student (manual smoke or via Next route manifest grep)
- [ ] `/student_diy/analytics` renders for student_diy role
- [ ] Migration 00023 applies and `SELECT get_student_analytics(<student-uuid>, '30d', 1, 25)` returns the expected jsonb shape when auth.uid() matches
- [ ] Calling the RPC with a DIFFERENT uid raises `not_authorized`
- [ ] Sidebar shows "Analytics" nav item for both student and student_diy roles
- [ ] Every chart wrapper has role="img" + aria-label + tabIndex={0} + <details> fallback
- [ ] Every interactive element in AnalyticsClient is ≥ 44px (min-h-[44px] present)
- [ ] All animate-* in new files are prefixed with motion-safe:
- [ ] No hardcoded hex outside the single chartColors constant
- [ ] revalidateTag('student-analytics:${studentId}') is called in 4 API routes
</verification>

<success_criteria>

- All 10 tasks completed
- ANALYTICS-01 through ANALYTICS-10 satisfied
- Build is green (lint + tsc + build)
- Phase 46 UI-SPEC compliance: 6/6 dimensions observed
- No regressions in existing /student dashboard, /student_diy dashboard, /coach/analytics
- RPC is authorization-safe (student can only query own data)
- Cache invalidation path proven end-to-end
  </success_criteria>

<output>
After completion, create `.planning/phases/46-student-analytics-page-recharts/46-01-SUMMARY.md` documenting: files touched, migration applied y/n, recharts install flags used, any deferred items, and the UI-SPEC checker sign-off status.
</output>
