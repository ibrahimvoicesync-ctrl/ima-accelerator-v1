---
phase: 48-full-coach-analytics-page
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00025_get_coach_analytics.sql
  - src/lib/rpc/coach-analytics-types.ts
  - src/lib/rpc/coach-analytics.ts
  - src/lib/schemas/coach-analytics-params.ts
  - src/app/(dashboard)/coach/analytics/page.tsx
  - src/app/(dashboard)/coach/analytics/loading.tsx
  - src/app/(dashboard)/coach/analytics/error.tsx
  - src/components/coach/analytics/CoachAnalyticsClient.tsx
  - src/components/coach/analytics/KPIGrid.tsx
  - src/components/coach/analytics/LeaderboardCard.tsx
  - src/components/coach/analytics/DealsTrendChart.tsx
  - src/components/coach/analytics/StudentListTable.tsx
  - src/components/coach/analytics/ExportCsvButton.tsx
  - src/components/coach/analytics/ActiveInactiveChip.tsx
  - src/app/api/coach/analytics/export.csv/route.ts
  - src/app/api/deals/route.ts
  - src/app/api/reports/route.ts
  - src/app/api/work-sessions/route.ts
autonomous: true
requirements:
  - COACH-ANALYTICS-01
  - COACH-ANALYTICS-02
  - COACH-ANALYTICS-03
  - COACH-ANALYTICS-04
  - COACH-ANALYTICS-05
  - COACH-ANALYTICS-06
  - COACH-ANALYTICS-07

must_haves:
  truths:
    # --- SQL RPC ---------------------------------------------------------------
    - "supabase/migrations/00025_get_coach_analytics.sql creates function public.get_coach_analytics(p_coach_id uuid, p_window_days int, p_today date, p_leaderboard_limit int, p_page int, p_page_size int, p_sort text, p_search text) RETURNS jsonb, LANGUAGE plpgsql, STABLE, SECURITY DEFINER, SET search_path = public"
    - "get_coach_analytics rejects callers whose (SELECT auth.uid()) IS NOT NULL AND IS DISTINCT FROM p_coach_id with RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501' — matches Phase 46 and 47 RPC pattern exactly (service_role admin client bypasses; authenticated mismatch rejected)"
    - "get_coach_analytics clamps inputs defensively: p_page := GREATEST(COALESCE(p_page, 1), 1); p_page_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 5000); p_leaderboard_limit := LEAST(GREATEST(COALESCE(p_leaderboard_limit, 5), 1), 50); p_window_days := LEAST(GREATEST(COALESCE(p_window_days, 7), 1), 365); p_search := COALESCE(NULLIF(TRIM(p_search), ''), NULL)"
    - "get_coach_analytics computes v_week_start := date_trunc('week', p_today)::date (ISO Monday, matches Phase 44 week_start()/Phase 47 convention)"
    - "get_coach_analytics resolves assigned active-student ids in one shot: SELECT array_agg(id) FROM users WHERE role='student' AND coach_id=p_coach_id AND status='active' — zero-student short-circuits to a fully zeroed envelope with empty arrays (no NULL leakage)"
    - "get_coach_analytics returns a single jsonb object with EXACT top-level keys: stats, leaderboards, deals_trend, active_inactive, students, pagination — no other keys"
    - "stats jsonb has exact keys: highest_deals {student_id, student_name, count}, total_revenue (numeric), avg_roadmap_step (numeric rounded to 1dp), avg_email_count (numeric rounded to 0dp), most_emails {student_id, student_name, count} — every *_deals/*_emails count is an int, never null"
    - "When there is no top-student (tie / zero data), highest_deals and most_emails return {student_id: null, student_name: null, count: 0} — never null objects"
    - "leaderboards jsonb has exact keys: hours_week (array, ordered minutes DESC, up to p_leaderboard_limit rows, each row {rank, student_id, student_name, minutes}), emails_week (array, ordered emails DESC, each row {rank, student_id, student_name, emails}), deals_alltime (array, ordered deals DESC, each row {rank, student_id, student_name, deals}) — all three windowed to assigned-active students only; hours_week/emails_week are windowed to [v_week_start, p_today]; deals_alltime is unbounded time"
    - "Every leaderboard filters HAVING metric > 0 so a zero-metric student is NEVER a ranked row (no placeholder rows); rank is computed via ROW_NUMBER() OVER (ORDER BY metric DESC) — stable, monotonic 1..N"
    - "deals_trend jsonb is an array of EXACTLY 12 entries representing the last 12 ISO weeks ending at v_week_start, oldest first, each entry {week_start: 'YYYY-MM-DD', deals: int} — weeks with zero deals present explicitly with deals:0 (no sparse gaps); computed via generate_series(v_week_start - interval '11 weeks', v_week_start, interval '1 week') LEFT JOIN aggregated deals counts"
    - "active_inactive jsonb has exact keys: active (int), inactive (int) — computed via public.student_activity_status(student_id, p_today) from Phase 44 (00021), summed across assigned active students only; no other statuses (D-14 defines only 'active'|'inactive')"
    - "students jsonb is an array of up to p_page_size rows for page p_page, each row with EXACT keys: student_id, name, hours_this_week_minutes (int), emails_this_week (int), deals_alltime (int), roadmap_step (int, MAX per-student step_number where status IN ('completed','active'), 0 if none), last_active_date (text YYYY-MM-DD or null), activity_status (text 'active'|'inactive' via student_activity_status)"
    - "students ordering is driven by p_sort ∈ ('name_asc','name_desc','hours_asc','hours_desc','emails_asc','emails_desc','deals_asc','deals_desc','step_asc','step_desc','lastActive_asc','lastActive_desc') with NULLS LAST on DESC and NULLS FIRST on ASC only for lastActive; name sort is ci (LOWER(name)); every other sort is tabular numeric"
    - "students search is applied server-side via: WHERE (p_search IS NULL OR u.name ILIKE '%' || p_search || '%') — the p_search argument is already trimmed by the RPC; the SQL ILIKE is ci and does NOT escape % or _ (acceptable: Phase 44 D-04 scope says no partial-regex search); the callers trim/lowercase before passing"
    - "pagination jsonb has EXACT keys: page (int), page_size (int), total (int, post-search total), total_pages (int, CEIL(total / page_size))"
    - "GRANT EXECUTE ON FUNCTION public.get_coach_analytics(...) TO service_role; GRANT EXECUTE ON FUNCTION public.get_coach_analytics(...) TO authenticated"
    - "Migration file ends with DO $$ ... END $$ ASSERT blocks that (a) verify the function exists with exactly 8 params, (b) verify service_role can call it and receives the zero envelope for a non-existent coach uuid, (c) verify p_page clamping keeps the function from returning a NULL envelope"

    # --- Type + wrapper layer --------------------------------------------------
    - "src/lib/rpc/coach-analytics-types.ts exports pure TypeScript types (CoachAnalyticsPayload, CoachAnalyticsStats, CoachLeaderboardRow, CoachDealsTrendBucket, CoachActiveInactive, CoachStudentRow, CoachAnalyticsPagination) + the coachAnalyticsTag(coachId) helper (returns literal `coach-analytics:${coachId}`) + the CoachAnalyticsSort union type + the COACH_ANALYTICS_PAGE_SIZE constant (25) — ZERO server-only imports so client components may safely import"
    - "src/lib/rpc/coach-analytics.ts imports createAdminClient and exports fetchCoachAnalytics(coachId, params) that awaits admin.rpc('get_coach_analytics', ...); console.errors and rethrows on error (never swallows)"
    - "src/lib/rpc/coach-analytics.ts ALSO exports getCoachAnalyticsCached(coachId, params) that wraps fetchCoachAnalytics in next/cache unstable_cache with key ['coach-analytics', coachId, JSON.stringify(params)], revalidate: 60, tags: [coachAnalyticsTag(coachId)] — file top begins with import 'server-only' so client components crash loudly on misuse"
    - "src/lib/rpc/coach-analytics.ts re-exports coachAnalyticsTag and every type alias from ./coach-analytics-types so server code has a single canonical import path"

    # --- Zod schema ------------------------------------------------------------
    - "src/lib/schemas/coach-analytics-params.ts exports coachAnalyticsSearchParamsSchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().pipe(z.literal(25)).default(25), sort: z.enum([12 sort keys]).default('name_asc'), search: z.string().trim().max(100).default('') }) — import { z } from 'zod', NEVER 'zod/v4'"
    - "coachAnalyticsSearchParamsSchema also exports a CoachAnalyticsSearchParams TypeScript type via z.infer and a parseCoachAnalyticsSearchParams(input) helper that runs safeParse and returns { ok: true, value } | { ok: false } — never throws"

    # --- Page (server component) ----------------------------------------------
    - "src/app/(dashboard)/coach/analytics/page.tsx is a Next.js 16 server component (NO 'use client') whose default export accepts props: { searchParams: Promise<Record<string, string | string[] | undefined>> } — awaits searchParams first (Next 16 convention)"
    - "page.tsx calls requireRole('coach') first (auth + role gate in one call); rejects by redirect — copies the call pattern from the existing coach/analytics/page.tsx (line 21)"
    - "page.tsx calls parseCoachAnalyticsSearchParams on the awaited searchParams; on { ok: false } redirect('/coach/analytics') using next/navigation redirect — never renders an error UI for bad params"
    - "page.tsx calls getCoachAnalyticsCached(user.id, { page, pageSize: 25, sort, search, windowDays: 7, today: getTodayUTC(), leaderboardLimit: 5 }) — then renders <CoachAnalyticsClient payload={...} initialParams={...} /> inside a <div className='px-4 py-6 max-w-7xl mx-auto'> page wrapper"
    - "page.tsx does NOT do its own Supabase queries any more — ALL student, deal, report, session data flows through the cached RPC; the legacy in-page student/reports/sessions Promise.all fetch (current lines 32–110) is DELETED"
    - "If the RPC returns 0 assigned students, page.tsx renders the existing no-students EmptyState (<Card> + <EmptyState title='No students assigned' description='Analytics will appear once students join your cohort.' />) with the Invite Students CTA link — preserve the current no-students empty state verbatim (lines 49–72)"
    - "page.tsx emits an export const revalidate = 60 so route-level cache and RPC-level cache stay aligned"

    # --- loading.tsx + error.tsx ----------------------------------------------
    - "src/app/(dashboard)/coach/analytics/loading.tsx renders a composite Skeleton screen: page wrapper + header skeleton + 5-card KPI skeleton grid + 3-card leaderboard skeleton grid + chart-skeleton (h-72) + table skeleton (7-col × 25-row h-11 rows) — single role='status' aria-label='Loading coach analytics' wrapper; nested skeletons aria-hidden='true'; composes existing <Skeleton /> primitive"
    - "src/app/(dashboard)/coach/analytics/error.tsx is a client component with 'use client' that accepts { error: Error & { digest?: string }; reset: () => void }; renders <Card><EmptyState title='Couldn\\'t load analytics' description='Try refreshing the page. If the issue persists, contact support.' action={<Button onClick={reset}>Try again</Button>} /></Card> inside the page wrapper; console.errors the error in useEffect per CLAUDE.md rule #5"

    # --- Client component ------------------------------------------------------
    - "src/components/coach/analytics/CoachAnalyticsClient.tsx is 'use client', receives { payload: CoachAnalyticsPayload; initialParams: CoachAnalyticsSearchParams } as props, and orchestrates rendering of all sub-components: header (H1 + sub + ActiveInactiveChip + ExportCsvButton), KPIGrid, three LeaderboardCards (hours/emails/deals), DealsTrendChart, StudentListTable"
    - "CoachAnalyticsClient uses useRouter + useTransition (Phase 46 pattern) for every URL mutation; holds NO canonical state beyond transient input text — URL search params are the only source of truth"
    - "CoachAnalyticsClient debounces the search input by 300ms via useRef<NodeJS.Timeout | null> cleared on unmount; every sort change and every search submit pushes page=1; every page change preserves sort+search"
    - "CoachAnalyticsClient composes existing Card, Badge, Button, EmptyState, Skeleton, Input, PaginationControls, Spinner primitives from src/components/ui — does NOT import any new primitive, does NOT create one"

    # --- Sub-components --------------------------------------------------------
    - "KPIGrid.tsx renders a grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 of 5 KPI cards with props { label, value, subLabel?, icon, tint } where tint ∈ ('primary'|'success'|'info'|'warning'|'accent'); each card uses <Card><CardContent className='p-4 flex items-center gap-4'> layout and an inner <div className='w-10 h-10 rounded-lg bg-ima-{tint}/10 flex items-center justify-center shrink-0'> icon box — matching Phase 47 KPICard geometry EXACTLY; lucide icons have aria-hidden='true'"
    - "KPIGrid KPI tints: Highest Deals=primary, Total Revenue=success, Avg Roadmap Step=info, Avg Email Count=warning, Most Emails Sent=accent — no other tint mappings allowed"
    - "KPIGrid numeric value classes are 'text-2xl font-bold text-ima-text tabular-nums'; sub-label (student name) class is 'text-base font-semibold text-ima-text truncate'; secondary label class is 'text-xs text-ima-text-secondary'; each card carries aria-label in sentence form e.g. 'Highest deals: 7 by Sarah Ahmed'"
    - "LeaderboardCard.tsx accepts { heading, subheading, rows: {rank, student_id, student_name, metric_display}[], emptyHeading, emptyBody } — rows up to 5; each row is a <Link href={`/coach/students/${student_id}`}> with classes 'flex items-center gap-3 p-3 rounded-lg hover:bg-ima-surface-light motion-safe:transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2' and carries aria-label='View {name} — {metric_display}'"
    - "LeaderboardCard rank 1 renders <Badge variant='primary'>#1</Badge>; ranks 2–5 render '#N' as <span className='text-xs font-semibold text-ima-text-muted tabular-nums w-6 text-center'>'; avatar circle is 'w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0' (copied verbatim from Phase 47)"
    - "LeaderboardCard empty state composes <EmptyState title={emptyHeading} description={emptyBody} /> — never inline-renders its own markup"
    - "DealsTrendChart.tsx is 'use client' and declares a top-of-file chartColors const = { primary: '#2563EB' /* ima-primary */, border: '#E2E8F0' /* ima-border */, textSecondary: '#64748B' /* ima-text-secondary */ } with a mandatory explanatory comment stating Recharts requires literal hex and these mirror tailwind ima-* tokens"
    - "DealsTrendChart renders inside <div role='img' tabIndex={0} aria-label='Bar chart: Deals closed per week, last 12 weeks. A text summary follows.' className='focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 rounded-lg'> wrapping <ResponsiveContainer width='100%' height={288}> <BarChart data={buckets}> <CartesianGrid stroke={chartColors.border} strokeDasharray='3 3' /> <XAxis dataKey='weekLabel' stroke={chartColors.textSecondary} fontSize={12} /> <YAxis allowDecimals={false} stroke={chartColors.textSecondary} fontSize={12} /> <Tooltip /> <Bar dataKey='deals' fill={chartColors.primary} radius={[4,4,0,0]} isAnimationActive={false} /> </BarChart> </ResponsiveContainer>"
    - "DealsTrendChart renders a <details> element immediately below the chart with <summary>View chart data as text</summary> and a <ul> of 'Week of {weekLabel}: {N} deals' — a11y fallback for screen readers, matches Phase 46 chart pattern"
    - "DealsTrendChart empty state (all 12 buckets deals===0) replaces the chart with <EmptyState title='No deals in the last 12 weeks' description='Once a student closes a deal, it\\'ll show up here.' /> — never renders a zero-bar chart"

    # --- Student list ----------------------------------------------------------
    - "StudentListTable.tsx is 'use client' and accepts { rows: CoachStudentRow[]; pagination: CoachAnalyticsPagination; sort: CoachAnalyticsSort; search: string; onSortChange: (next) => void; onSearchChange: (next) => void; onPageChange: (next) => void }"
    - "StudentListTable renders a toolbar row (search + clear) above, then <table className='min-w-full divide-y divide-ima-border'> with <thead> row containing 7 <th scope='col'> cells: Name, Hours This Week, Emails This Week, All-Time Deals, Roadmap Step, Last Active, Status"
    - "Each sortable <th> contains a <button type='button' onClick={() => onSortChange(toggled)} className='flex items-center gap-1 min-h-[44px] focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2'> with the column label + a <ChevronUp/>, <ChevronDown/>, or <ChevronsUpDown className='text-ima-text-muted'/> icon reflecting current sort state; every icon is aria-hidden; the <th> carries aria-sort='ascending'|'descending'|'none' reflecting state"
    - "Status column is NOT sortable (no <button>, no aria-sort); it renders a small chip — Active: <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ima-success/10 text-ima-success'>Active</span>, Inactive: <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-ima-text-muted/10 text-ima-text-secondary'>Inactive</span>"
    - "Name cell is a <Link href={`/coach/students/${id}`}> with classes 'text-sm font-medium text-ima-primary hover:underline min-h-[44px] inline-flex items-center focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2' (rule 2 compliant)"
    - "Numeric cells (hours / emails / deals / step) have class 'text-sm font-medium text-ima-text tabular-nums text-right px-4 py-3'; hours formatted server-side via shared helper as '{h}h {m}m' (and zero renders as '0h 0m' not '—')"
    - "Last Active cell wraps the relative time string in <time dateTime={iso}>{relative}</time> via formatDistanceToNowStrict from date-fns (already a dep); null last_active_date renders as the string 'Never'; no hardcoded hex/gray"
    - "StudentListTable search input has <label htmlFor='coach-analytics-search' className='sr-only'>Search students by name</label> paired with <Input id='coach-analytics-search' placeholder='Search by name' value={local} onChange={...} aria-label='Search students by name' /> and an inline <X> clear button (min-h-[44px] min-w-[44px] aria-label='Clear search') only when local is non-empty; Escape key clears the input (keydown handler) without re-querying"
    - "StudentListTable pagination renders <PaginationControls page={pagination.page} totalPages={pagination.total_pages} basePath='/coach/analytics' searchParams={ sort, search }> at the bottom — reuses the existing primitive unchanged"
    - "StudentListTable empty-no-students renders <EmptyState title='No assigned students yet' description='Once an owner assigns students to you, they\\'ll appear here.' />; empty-search renders <EmptyState title={`No matches for \"${search}\"`} description='Try a different name or clear the search.' action={<Button variant='outline' size='sm' onClick={clear}>Clear search</Button>} />"

    # --- Header sub-components ------------------------------------------------
    - "ActiveInactiveChip.tsx renders one pill: <span role='status' aria-label='{A} students active, {I} students inactive in the last 7 days' className='inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-ima-surface border border-ima-border'> with two halves: left half class 'inline-flex items-center gap-1 text-ima-success' showing a colored dot + '{A} active'; right half class 'inline-flex items-center gap-1 text-ima-text-secondary pl-2 border-l border-ima-border' showing '{I} inactive'; title attribute 'Active = work session or report in last 7 days. Inactive = no activity in last 7 days.'; counts use tabular-nums"
    - "ExportCsvButton.tsx is 'use client' and renders <Button variant='outline' size='md' onClick={handleClick} disabled={busy} aria-busy={busy} aria-label='Export student list as CSV'> with <Download className='h-4 w-4 mr-2' aria-hidden='true' /> + label 'Export CSV' (or 'Exporting…' + <Spinner size='sm' className='mr-2'/> during busy state)"
    - "ExportCsvButton handleClick sets busy=true, constructs href = '/api/coach/analytics/export.csv?' + new URLSearchParams({ sort, search }).toString(), triggers the browser download via window.location.href = href, then starts a 1500ms setTimeout to set busy=false; the timeout id is cleared on unmount (useEffect return)"

    # --- CSV export route ------------------------------------------------------
    - "src/app/api/coach/analytics/export.csv/route.ts is a Next.js route handler whose GET async function requires role='coach' via getSessionUser + role gate; returns 401 JSON if not authenticated, 403 JSON if not a coach"
    - "export.csv GET applies Zod safeParse on Object.fromEntries(url.searchParams) using coachAnalyticsSearchParamsSchema (subset: sort, search); safeParse failure returns Response with status 400 and body text 'Invalid export parameters.' (never empty catch)"
    - "export.csv GET fetches data via fetchCoachAnalytics(coach.id, { windowDays: 7, today, leaderboardLimit: 5, page: 1, pageSize: 5000, sort, search }) — uses the admin client per rule #4; enforces total <= 5000 else returns Response status 400, body 'Export too large. Refine your search.'"
    - "export.csv GET constructs CSV with exact header row: 'Name,Hours This Week (minutes),Emails This Week,All-Time Deals,Roadmap Step,Last Active (ISO),Status' and writes each row from payload.students; Name field wrapped in double quotes with internal quotes doubled (RFC 4180 escaping) via a tiny inline csvEscape helper; Last Active uses ISO timestamp or empty string; Status uses capitalized 'Active'|'Inactive'"
    - "export.csv GET returns new Response(body, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename=\"coach-analytics-${coach.id}-${today}.csv\"`, 'Cache-Control': 'no-store' } })"
    - "export.csv GET wraps the RPC call in try/catch; on error console.error's and returns Response status 500 body 'Export failed.'; never swallows"

    # --- Cache invalidation (existing routes) ---------------------------------
    - "src/app/api/deals/route.ts POST and PATCH (and DELETE if present) each call revalidateTag(coachAnalyticsTag(coachId)) whenever a deal mutation touches a student whose coach_id is non-null; added alongside (not replacing) the existing coachDashboardTag + studentAnalyticsTag revalidations from Phase 46/47; null coach_id short-circuits silently"
    - "src/app/api/reports/route.ts POST and PATCH handlers call revalidateTag(coachAnalyticsTag(coachId)) in the same spot they call coachDashboardTag — one more line per invalidation point"
    - "src/app/api/work-sessions/route.ts POST and PATCH handlers call revalidateTag(coachAnalyticsTag(coachId)) alongside the existing coachDashboardTag revalidation"
    - "All new revalidateTag calls use the imported coachAnalyticsTag from @/lib/rpc/coach-analytics-types (pure types file — no server-only import chain through the mutation route)"

    # --- Hard rules (CLAUDE.md) -----------------------------------------------
    - "Zero hardcoded hex colors OR gray/slate/zinc/neutral tokens added anywhere in this phase OUTSIDE the single chartColors const in DealsTrendChart.tsx — grep '(text|bg|border)-(gray|slate|zinc|neutral)-' in changed files returns 0; grep '#[0-9a-fA-F]{3,8}' in changed files returns exactly 3 matches (the 3 entries in chartColors)"
    - "Every animate-* class introduced in this phase is prefixed motion-safe: — grep 'animate-' in changed files and every match has 'motion-safe:' immediately before OR is inside a comment"
    - "Every new interactive element (KPI card if linked, leaderboard row Link, name cell Link, sort header button, search Input, clear button, pagination button, Export button) has min-h-[44px] class"
    - "Every new <input> has either aria-label or a matching <label htmlFor={id}> with id on the input (rule 3)"
    - "Every .from() query introduced in any route handler uses createAdminClient (rule 4); the export.csv route uses fetchCoachAnalytics which already uses admin client — no new non-admin .from() is introduced"
    - "Every try/catch and every admin-client error path console.errors or toasts — no empty catch blocks (rule 5)"
    - "Every fetch() in ExportCsvButton — N/A because download uses window.location.href, not fetch(); the route handler validates independently (rule 6 still passes: no new fetch introduced)"
    - "import { z } from 'zod' is used; no 'zod/v4' anywhere (rule 7)"
    - "All colors routed through ima-* tokens; text-white appears ONLY on colored backgrounds (rank-1 Badge, avatar circles) — no other text-white usage added (rule 8)"

    # --- Page wrapper + responsive --------------------------------------------
    - "page.tsx wrapper is exactly '<div className=\"px-4 py-6 max-w-7xl mx-auto\">' with the header row inside at 'flex flex-wrap items-center justify-between gap-4'; KPI grid uses 'mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'; leaderboards use 'mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4'; chart and student list sections use 'mt-6' section rhythm"
    - "Table parent <Card> wraps <div className='overflow-x-auto'> around the <table> so horizontal overflow scrolls the table alone; name column uses 'max-w-[200px] truncate'; numeric+date columns use 'whitespace-nowrap'"

    # --- Type safety & build ---------------------------------------------------
    - "npm run lint && npx tsc --noEmit && npm run build all exit 0 after changes; no new ESLint disables introduced unless already present in the copied patterns (e.g. the @typescript-eslint/no-explicit-any suppression on admin.rpc calls, mirroring Phase 47's coach-dashboard.ts)"

  artifacts:
    - supabase/migrations/00025_get_coach_analytics.sql
    - src/lib/rpc/coach-analytics-types.ts
    - src/lib/rpc/coach-analytics.ts
    - src/lib/schemas/coach-analytics-params.ts
    - src/app/(dashboard)/coach/analytics/page.tsx
    - src/app/(dashboard)/coach/analytics/loading.tsx
    - src/app/(dashboard)/coach/analytics/error.tsx
    - src/components/coach/analytics/CoachAnalyticsClient.tsx
    - src/components/coach/analytics/KPIGrid.tsx
    - src/components/coach/analytics/LeaderboardCard.tsx
    - src/components/coach/analytics/DealsTrendChart.tsx
    - src/components/coach/analytics/StudentListTable.tsx
    - src/components/coach/analytics/ExportCsvButton.tsx
    - src/components/coach/analytics/ActiveInactiveChip.tsx
    - src/app/api/coach/analytics/export.csv/route.ts
  key_links:
    - "get_coach_analytics reuses public.student_activity_status(uuid,date) from Phase 44 (00021) for the active/inactive chip + students.activity_status column — do NOT re-implement"
    - "Authorization guard pattern copies Phase 46 (00023) + Phase 47 (00024) verbatim; service_role (admin client, auth.uid() IS NULL) passes while mismatched authenticated coach is rejected"
    - "Cache tag is `coach-analytics:${coachId}` — mutations in existing deals / reports / work_sessions routes must invalidate it alongside the Phase 47 coachDashboardTag and Phase 46 studentAnalyticsTag"
    - "UI-SPEC 48-UI-SPEC.md governs every label, color, spacing, typography, a11y label — this plan implements it 1:1"
    - "Existing coach/analytics/page.tsx (no-students EmptyState branch at lines 49–72) is preserved verbatim; the legacy in-page aggregation (lines 79–232) is DELETED and replaced by the cached RPC"
    - "Recharts is already installed (used by Phase 46 student analytics) — no new npm dep; BarChart + Bar + XAxis + YAxis + CartesianGrid + Tooltip + ResponsiveContainer only"
    - "PaginationControls primitive accepts { page, totalPages, basePath, searchParams } — passing current sort+search in searchParams keeps URL state intact across page changes"
    - "Next.js 16 searchParams is a Promise — must be awaited; searchParams: Promise<...> in the props signature"
---

<objective>
Ship the Full Coach Analytics Page: `/coach/analytics` replaces its legacy in-page SQL with ONE batch RPC `get_coach_analytics(p_coach_id, p_window_days, p_today, p_leaderboard_limit, p_page, p_page_size, p_sort, p_search)` returning a single JSON envelope consumed by a 5-KPI header, 3 top-5 leaderboards (hours-this-week, emails-this-week, all-time-deals), a 12-week "Deals Closed Over Time" Recharts bar chart, an Active/Inactive header chip driven by Phase 44's `student_activity_status`, and a 25/page searchable + sortable student list with server-side Zod-validated URL params, plus a CSV export via GET `/api/coach/analytics/export.csv`. All reads are wrapped in `unstable_cache` 60s with tag `coach-analytics:${coachId}`; every `ima-*` token, every `min-h-[44px]`, every `motion-safe:`, every `aria-label` is preserved per UI-SPEC 48.

Purpose: delivers COACH-ANALYTICS-01 through COACH-ANALYTICS-07 in a single wave — backend (SQL RPC) + type/cache helper + Zod schema + page rewrite + 7 feature components + 1 new CSV route + 3 route-handler cache-tag adds. Splitting would create artificial seams (the chart, leaderboards, list, and CSV all share the same RPC envelope; separating them either duplicates the RPC or introduces partial-refresh bugs).

Output: 1 new migration (00025), 2 new RPC helper files (types + server wrapper), 1 new Zod schema file, 1 fully rewritten page.tsx, 1 new loading.tsx, 1 new error.tsx, 7 new feature components under `src/components/coach/analytics/`, 1 new CSV route handler, 3 existing API route files gain a single revalidateTag line each.
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
@.planning/phases/48-full-coach-analytics-page/48-CONTEXT.md
@.planning/phases/48-full-coach-analytics-page/48-UI-SPEC.md
@CLAUDE.md
</context>

<pattern_references>
- supabase/migrations/00021_analytics_foundation.sql — `student_activity_status(uuid, date)` + `week_start(date)` helpers + hot-path indexes (reuse, do not redeclare)
- supabase/migrations/00023_get_student_analytics.sql — SECURITY DEFINER auth guard pattern; single-envelope return shape
- supabase/migrations/00024_get_coach_dashboard.sql — verbatim authorization guard + zero-student short-circuit + per-student name join shape
- src/lib/rpc/coach-dashboard.ts — exact RPC wrapper idiom (admin.rpc + console.error + rethrow; eslint-disable for the typed rpc call)
- src/lib/rpc/coach-dashboard-types.ts — pure-types + tag helper idiom with no server-only imports
- src/app/(dashboard)/student/analytics/page.tsx + AnalyticsClient.tsx — Next 16 searchParams Promise handling; Recharts chartColors const idiom; role=img tabIndex={0} chart wrapper; <details> fallback
- src/components/coach/RecentSubmissionsCard.tsx + WeeklyLeaderboardCard.tsx — Card-inside-Card spacing; avatar circle classes; row Link classes
- src/components/ui/PaginationControls.tsx — existing pagination primitive contract
- src/components/ui/EmptyState.tsx + Card.tsx + Badge.tsx + Input.tsx + Button.tsx + Skeleton.tsx + Spinner.tsx — UI primitives this phase composes (never replaces)
- CLAUDE.md Hard Rules — motion-safe:, 44px targets, aria-labels, admin client in API, error handling, fetch.ok, Zod vX import, ima-* tokens only
- .planning/phases/48-full-coach-analytics-page/48-UI-SPEC.md — visual/interaction contract, 1:1
</pattern_references>

<implementation_waves>

## Wave 1 (single wave — everything)

All work in this phase is one logical unit: the RPC defines the payload shape, the types mirror it, the cache wrapper keys on it, the Zod schema validates URL params that become RPC args, the page consumes the cache, the 7 components render slices of the envelope, and the CSV route calls the same RPC with page_size=5000. Splitting waves would force either a throwaway stub payload shape (breaking waves 2+) or duplicated SQL.

### Step 1 — SQL migration

Create `supabase/migrations/00025_get_coach_analytics.sql`:

1. Header comment block documenting purpose, dependencies (Phase 44 helpers + indexes, Phase 47 auth guard pattern), cache layer tag, invalidation hooks.
2. `CREATE OR REPLACE FUNCTION public.get_coach_analytics(...)` with 8 params per the must_have: all clamped, all defaulted.
3. Auth guard: `IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_coach_id THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501'; END IF;`
4. Clamp all numeric inputs, trim `p_search` to NULL if empty.
5. Compute `v_week_start := date_trunc('week', p_today)::date` and `v_trend_start := v_week_start - interval '11 weeks'`.
6. Collect `v_student_ids uuid[]` of assigned active students; zero-short-circuit returns fully zeroed envelope.
7. Compute `v_stats jsonb` (5 KPIs):
   - `highest_deals`: `SELECT student_id, name, COUNT(*) FROM deals JOIN users GROUP BY student_id, name ORDER BY count DESC LIMIT 1` → pack into `{student_id, student_name, count}` or `{nulls, 0}` if empty.
   - `total_revenue`: `SELECT COALESCE(SUM(revenue), 0)::numeric FROM deals WHERE student_id = ANY(v_student_ids)`.
   - `avg_roadmap_step`: copy Phase 47 formula (`AVG(per-student MAX(step_number) FILTER status IN ('completed','active'))` rounded to 1dp).
   - `avg_email_count`: `AVG(per-student SUM(brands_contacted + influencers_contacted))` rounded to 0dp.
   - `most_emails`: `SELECT student_id, name, SUM(brands_contacted+influencers_contacted) FROM daily_reports JOIN users GROUP BY ... ORDER BY sum DESC LIMIT 1`.
8. Compute `v_leaderboards jsonb` with 3 sub-arrays, each `ROW_NUMBER() OVER (ORDER BY metric DESC) AS rank`, each filtered `HAVING metric > 0`, each `LIMIT p_leaderboard_limit`.
9. Compute `v_deals_trend jsonb`: `generate_series(v_trend_start, v_week_start, interval '1 week')` LEFT JOIN aggregated weekly deal counts, yielding exactly 12 rows.
10. Compute `v_active_inactive jsonb`: count `student_activity_status(id, p_today) = 'active'` vs `'inactive'` across v_student_ids.
11. Compute `v_students jsonb` + `v_total int`:
    - Sub-query SELECT per-student aggregates (hours_this_week_minutes, emails_this_week, deals_alltime, roadmap_step, last_active_date, activity_status).
    - Filter by `p_search ILIKE`.
    - `SELECT COUNT(*) INTO v_total` over filtered set (before pagination).
    - ORDER BY clause built via CASE on `p_sort` (12 branches).
    - OFFSET `(p_page - 1) * p_page_size` LIMIT `p_page_size`.
12. Return `jsonb_build_object('stats', v_stats, 'leaderboards', v_leaderboards, 'deals_trend', v_deals_trend, 'active_inactive', v_active_inactive, 'students', v_students, 'pagination', jsonb_build_object('page', p_page, 'page_size', p_page_size, 'total', v_total, 'total_pages', CEIL(v_total::numeric / p_page_size)::int))`.
13. `GRANT EXECUTE ... TO service_role, authenticated`.
14. `DO $$ ... END $$` ASSERT blocks: function exists with 8 params, zero-student envelope well-formed, p_page clamping non-null.

### Step 2 — TS types + tag helper

Create `src/lib/rpc/coach-analytics-types.ts` (pure, zero server imports):

- `CoachAnalyticsStats`, `CoachLeaderboardRow { rank; student_id; student_name; … }`, `CoachDealsTrendBucket { week_start; deals }`, `CoachActiveInactive { active; inactive }`, `CoachStudentRow`, `CoachAnalyticsPagination`, `CoachAnalyticsPayload`.
- `CoachAnalyticsSort` string-literal union (12 values).
- `COACH_ANALYTICS_PAGE_SIZE = 25` const.
- `coachAnalyticsTag(coachId: string): string` returns `` `coach-analytics:${coachId}` ``.

### Step 3 — Server RPC wrapper + cache

Create `src/lib/rpc/coach-analytics.ts` starting with `import "server-only";`:

- Import `createAdminClient`, `unstable_cache` from `next/cache`, all types + tag helper from `./coach-analytics-types`.
- Export `fetchCoachAnalytics(coachId, params)` — mirrors `coach-dashboard.ts` idiom (admin.rpc, eslint-disable for the typed any, console.error + throw on error, console.error + throw if no data).
- Export `getCoachAnalyticsCached(coachId, params)` — wraps fetchCoachAnalytics in unstable_cache with key `['coach-analytics', coachId, JSON.stringify(params)]`, revalidate 60, tags `[coachAnalyticsTag(coachId)]`.
- Re-export every type + `coachAnalyticsTag` + `COACH_ANALYTICS_PAGE_SIZE` from the types file so server code has one import.

### Step 4 — Zod schema

Create `src/lib/schemas/coach-analytics-params.ts`:

- `import { z } from "zod";`
- `coachAnalyticsSearchParamsSchema` per spec — `page` coerced int [1, 10000] default 1, `pageSize` coerced-to-literal 25 default 25, `sort` enum (12 values) default `name_asc`, `search` trimmed max 100 default empty.
- Export `type CoachAnalyticsSearchParams = z.infer<typeof schema>`.
- Export `parseCoachAnalyticsSearchParams(input)` — runs `schema.safeParse(input)` and returns `{ ok: true, value } | { ok: false }`.

### Step 5 — Rewrite page.tsx

`src/app/(dashboard)/coach/analytics/page.tsx`:

1. `"use server"` is default for this file — do NOT add `"use client"`.
2. Export `revalidate = 60`.
3. Default export async function `CoachAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })`.
4. `const user = await requireRole("coach");`
5. `const raw = await searchParams;` then `const parsed = parseCoachAnalyticsSearchParams(raw);` — on `!parsed.ok` redirect to `/coach/analytics`.
6. `const today = getTodayUTC();`
7. `const payload = await getCoachAnalyticsCached(user.id, { ...parsed.value, windowDays: 7, today, leaderboardLimit: 5 });`
8. If `payload.pagination.total === 0 && !parsed.value.search` AND zero assigned students flag (detectable because leaderboards are empty + active+inactive === 0) — render the existing `<Card><EmptyState title="No students assigned" ... action={Invite link} /></Card>` branch preserved verbatim from current file lines 49–72.
9. Otherwise render `<div className="px-4 py-6 max-w-7xl mx-auto">` → `<CoachAnalyticsClient payload={payload} initialParams={parsed.value} />`.

### Step 6 — loading.tsx + error.tsx

- `loading.tsx`: page wrapper + composite skeleton (header skeleton, 5-card KPI skeleton grid, 3-card leaderboard skeleton grid, `h-72 w-full rounded-lg` chart skeleton, table skeleton with 7 columns × 25 rows of `h-11` cells). Top-level `role="status"` `aria-label="Loading coach analytics"`; inner skeletons `aria-hidden="true"`.
- `error.tsx`: `"use client"`, props `{ error, reset }`, `useEffect(() => console.error(error), [error])`, renders `<Card><EmptyState title="Couldn't load analytics" description="Try refreshing the page. If the issue persists, contact support." action={<Button onClick={reset}>Try again</Button>} /></Card>` inside page wrapper.

### Step 7 — CoachAnalyticsClient orchestrator

`src/components/coach/analytics/CoachAnalyticsClient.tsx`:

- `"use client"`.
- Accepts `{ payload, initialParams }`.
- Uses `useRouter`, `useTransition`, `useRef`, `useState` for local search input buffer.
- `onSortChange(key)` → `router.push('/coach/analytics?' + qs({ sort: key, search, page: 1 }))` via `startTransition`.
- `onSearchChange(value)` → debounced 300ms, then push `?search=value&page=1&sort=...`; `Escape` clears local buffer without pushing.
- `onPageChange(p)` → push `?page=p&search=...&sort=...`.
- Renders header (H1 + sub + `ActiveInactiveChip` + `ExportCsvButton`), then `KPIGrid`, then three `LeaderboardCard` instances, then `DealsTrendChart`, then `StudentListTable`.
- Section spacing via `mt-6` on each subsequent block.

### Step 8 — Feature components

Create 7 files under `src/components/coach/analytics/`:

1. `KPIGrid.tsx` — stateless presentational; 5 cards.
2. `LeaderboardCard.tsx` — props per must_haves; row Links to `/coach/students/{id}`; empty state via `EmptyState`.
3. `DealsTrendChart.tsx` — `"use client"`; chartColors const with mandatory comment; role=img wrapper; `<details>` fallback; empty state replaces chart.
4. `StudentListTable.tsx` — `"use client"`; sortable `<th>` buttons with `ChevronsUpDown` default; `<Input>` search with `X` clear; wraps `<table>` in `overflow-x-auto`; renders `<PaginationControls>`.
5. `ExportCsvButton.tsx` — `"use client"`; `window.location.href` download + 1500ms busy cooldown.
6. `ActiveInactiveChip.tsx` — pill with two halves; `title` attribute with definition.

### Step 9 — CSV route handler

`src/app/api/coach/analytics/export.csv/route.ts`:

- `export const dynamic = "force-dynamic"` (no ISR on CSV export — always fresh-ish within the 60s cache).
- `export async function GET(request: NextRequest)`:
  1. Auth: `getSessionUser` or equivalent; 401 if missing; 403 if `user.role !== "coach"`.
  2. Parse URL searchParams via `coachAnalyticsSearchParamsSchema` (pageSize/page ignored, sort+search used).
  3. Call `fetchCoachAnalytics(user.id, { sort, search, page: 1, pageSize: 5000, windowDays: 7, today: getTodayUTC(), leaderboardLimit: 5 })`.
  4. If `total > 5000` return 400 with body `Export too large. Refine your search.`.
  5. Build CSV body with RFC 4180 escaping via a local `csvEscape(s)` helper (wrap in `"`, double internal `"`).
  6. Return `Response` with `text/csv; charset=utf-8` content-type and `Content-Disposition: attachment; filename="coach-analytics-{id}-{today}.csv"`, `Cache-Control: no-store`.
  7. try/catch around steps 3–5; on error `console.error` and return 500.

### Step 10 — Cache invalidation additions

Edit `src/app/api/deals/route.ts`, `src/app/api/reports/route.ts`, `src/app/api/work-sessions/route.ts`:

- For each mutation handler (POST / PATCH / DELETE where present), where `coachDashboardTag(coachId)` is already being `revalidateTag`ged (added in Phase 47), add one more line: `revalidateTag(coachAnalyticsTag(coachId))`.
- Import `coachAnalyticsTag` from `@/lib/rpc/coach-analytics-types` (pure types file — no server-only chain introduced).
- Null-coach guard is already present from Phase 47 — reuse the same `if (coachId) { ... }` block.

### Step 11 — Build + lint + type check

- `npm run lint` → 0 errors.
- `npx tsc --noEmit` → 0 errors.
- `npm run build` → 0 errors.
- Hard-rule grep checks (run from project root):
  - `grep -rE "(text|bg|border)-(gray|slate|zinc|neutral)-" <changed files>` → 0 matches.
  - `grep -rE "#[0-9a-fA-F]{3,8}" <changed files>` → exactly 3 matches (chartColors in DealsTrendChart.tsx).
  - `grep -rE "animate-[a-z]+" <changed files>` → every match preceded by `motion-safe:`.

</implementation_waves>

<verification>

## Verification Plan

### Code-level verification (automated — Claude runs)

1. **Build passes:** `npm run lint && npx tsc --noEmit && npm run build` exits 0.
2. **Hard-rule greps:**
   - No gray/slate/zinc/neutral tokens in changed files.
   - No hex literals outside the chartColors const (exactly 3 `#RRGGBB` occurrences).
   - Every `animate-` prefixed with `motion-safe:`.
   - Every `<input>` has `aria-label` or matching `<label htmlFor>`.
   - Every interactive link/button has `min-h-[44px]`.
3. **Migration shape assert:** `DO $$ … $$` blocks inside the migration verify RPC signature, zero-student envelope, and param clamping; `supabase db push` (or local psql run) exits 0.
4. **Auth guard test (negative):** calling `get_coach_analytics(other_uuid, ...)` as an authenticated non-coach caller raises `not_authorized`; as service_role it returns a payload. Test via psql or by an integration spec.
5. **Zod safeParse coverage:** page.tsx redirect-on-failure reachable for `?page=abc`, `?sort=bogus`, `?pageSize=50`, `?search=<101 chars>`.
6. **Cache tag invariant:** `grep coachAnalyticsTag src/app/api/*/route.ts` returns three hits (deals, reports, work-sessions) matching the phase 47 tag pattern.

### UAT (manual — human runs)

1. Visit `/coach/analytics` as a coach with ≥1 assigned student, ≥1 deal, ≥1 report this week.
   - 5 KPI cards render with correct values and tints.
   - Active/Inactive chip shows plausible split.
   - Export CSV button present; clicking triggers a file download.
2. Leaderboards:
   - Each of 3 leaderboards shows up to 5 real rows (no placeholder #N rows).
   - Clicking a row navigates to `/coach/students/{id}`.
3. Deals trend chart:
   - Renders 12 weekly bars with latest week on the right.
   - Tab-focuses onto the chart (visible focus ring); `<details>` disclosure reveals the text table.
   - All-zero state shows the empty state, not a blank chart.
4. Student list:
   - 25 rows max per page.
   - Sort by each column toggles asc/desc (chevron updates; URL updates; data re-fetches via server round-trip).
   - Search debounces to 300ms; Escape clears input.
   - Pagination preserves sort+search across pages.
5. CSV export:
   - Downloads `coach-analytics-{id}-{YYYY-MM-DD}.csv` with 7 columns, RFC-4180 escaped names.
   - Export respects current search+sort (all matching rows, not just current page).
6. Empty/error:
   - Coach with zero assigned students sees the preserved "No students assigned" card with the Invite Students CTA.
   - Throw inside the RPC (simulated) triggers error.tsx — "Couldn't load analytics" + Try again button.
7. Cache invalidation:
   - After creating a new deal (student or coach POST), navigate to `/coach/analytics` within 60s — new deal is reflected because the cache tag was revalidated by the mutation handler.
8. Accessibility:
   - VoiceOver / NVDA announces the Active/Inactive chip as "{A} students active, {I} students inactive in the last 7 days".
   - Screen reader reaches the chart's role=img + `<details>` fallback.
   - Every sort header announces its sort state ("Sort by Hours This Week, currently ascending").

</verification>

<acceptance_criteria>

- [ ] Migration 00025 applies cleanly; RPC function exists with 8 params; SECURITY DEFINER; auth guard rejects mismatched authenticated caller and allows service_role.
- [ ] `get_coach_analytics` returns the exact envelope shape defined in the must_haves; zero-student coach returns fully zeroed envelope + empty arrays; 12-week trend is always length 12 with padded zero buckets.
- [ ] `src/lib/rpc/coach-analytics-types.ts` is pure (no server-only imports); `src/lib/rpc/coach-analytics.ts` starts with `import "server-only"` and exports both `fetchCoachAnalytics` and `getCoachAnalyticsCached`.
- [ ] `src/lib/schemas/coach-analytics-params.ts` exports the Zod schema + `parseCoachAnalyticsSearchParams` helper; uses `import { z } from "zod"`.
- [ ] `/coach/analytics` renders 5 KPIs, 3 top-5 leaderboards, a 12-week bar chart, an active/inactive chip, a 25/page student list, and an Export CSV button — all styled per UI-SPEC 48.
- [ ] URL search params drive page/sort/search state; invalid params redirect to clean URL; page resets to 1 on sort/search change.
- [ ] CSV export downloads a valid RFC-4180 file with the exact 7-column header row; respects current search+sort; auth-gated to coach role.
- [ ] Every interactive element hits 44px; every animation is `motion-safe:`; every icon is `aria-hidden`; every chart/table has role + aria-label per UI-SPEC; chart has tab focus + `<details>` fallback.
- [ ] No new hex literal outside the single chartColors const in DealsTrendChart.tsx; no `gray/slate/zinc/neutral` tokens; `text-white` only on Badge #1 + avatar circles.
- [ ] Cache-invalidation lines added to 3 existing mutation routes; `coachAnalyticsTag` imported from the pure types file.
- [ ] `npm run lint && npx tsc --noEmit && npm run build` all exit 0; hard-rule greps pass.
- [ ] COACH-ANALYTICS-01 through COACH-ANALYTICS-07 all satisfied and tickable.

</acceptance_criteria>
