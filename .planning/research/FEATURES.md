# Feature Research

**Domain:** Coaching / Accelerator Platform — v1.2 Performance, Scale & Security
**Researched:** 2026-03-29
**Confidence:** HIGH — patterns verified against Next.js 16 official docs, Supabase official docs, React 19 release notes, and multiple cross-referenced sources

---

## Scope Note

This document supersedes the v1.1 FEATURES.md for the v1.2 milestone. It covers nine technical capability areas needed to support 5,000 concurrent students. v1.0 and v1.1 features are already shipped — they appear only where they create dependencies for v1.2 optimizations.

---

## v1.2 Feature Landscape

The nine capability areas are:

1. Postgres RPC functions for query consolidation
2. React `cache()` for server component deduplication
3. Next.js route-level revalidation (`export const revalidate`)
4. Server-side pagination with Supabase `.range()`
5. `pg_cron` scheduled jobs for pre-aggregation
6. Optimistic UI patterns in React 19
7. API route rate limiting without middleware
8. Load testing approaches for Supabase-backed apps
9. Security auditing: RLS verification, CSRF, cross-user isolation

---

## Feature Area 1: Postgres RPC Functions for Query Consolidation

### What this does

A Postgres function exposed via Supabase's PostgREST `/rpc/` endpoint replaces multiple sequential PostgREST table queries with a single network round trip. The function runs entirely in the database, returning a `json`/`jsonb` object assembled from sub-queries. The caller receives one payload; the server issues zero additional requests.

The owner dashboard currently makes 8 separate Supabase calls. Each PostgREST call is: auth header verification + connection acquisition + query + serialization + HTTP round trip. At 5,000 students, 8 calls per page load is 40,000 connections per page render cycle.

### Expected behavior patterns

```sql
-- Example: owner dashboard summary as a single RPC
CREATE OR REPLACE FUNCTION get_owner_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_students',    (SELECT count(*) FROM users WHERE role = 'student'),
    'active_today',      (SELECT count(DISTINCT student_id) FROM work_sessions WHERE date = CURRENT_DATE),
    'unreviewed_reports',(SELECT count(*) FROM daily_reports WHERE reviewed_at IS NULL),
    'inactive_7d',       (SELECT count(*) FROM users WHERE role = 'student'
                           AND id NOT IN (SELECT DISTINCT student_id FROM work_sessions
                                          WHERE started_at > NOW() - INTERVAL '7 days'))
  ) INTO result;
  RETURN result;
END;
$$;
```

Caller: `const { data } = await supabase.rpc('get_owner_dashboard')`

PostgREST wraps each RPC call in a transaction automatically. `SECURITY DEFINER` makes the function run as the defining role, bypassing RLS where intentional (owner queries need full visibility). Always add auth-check logic inside the function body or verify the caller's role before calling.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single RPC replacing 8 owner dashboard calls | 8 round trips × 5k page loads = 40k connections; RPC brings it to 1 per load | MEDIUM | One function per consolidated path; owner dashboard and coach dashboard each get their own RPC |
| JSON return type with typed TypeScript interface | The caller must be able to destructure the response with confidence; untyped `any` defeats the purpose | LOW | `RETURNS jsonb`; add matching TypeScript interface in `src/types.ts` |
| `SECURITY DEFINER` with explicit auth role check | Owner and coach RPCs must verify the calling user's role; bypassing RLS without role verification creates privilege escalation | MEDIUM | Check `auth.uid()` in function body; OR limit `EXECUTE` permission to specific Postgres roles |
| Error propagation from RPC | If a sub-query fails, the whole RPC must fail cleanly, not silently return null | LOW | Postgres exceptions propagate through PostgREST as 500 errors; catch in client and toast |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| RPC accepts a `p_limit` parameter for pagination | Owner dashboard top-N lists (inactive students, unreviewed reports) stay bounded; caller controls slice size | LOW | Pass `p_limit INT DEFAULT 10` as parameter; prevents full-table scans even at 5k students |
| RPC returns pre-sorted arrays | Sorting in the database avoids client-side sort on large datasets; ensures consistent ordering across page loads | LOW | `ORDER BY` inside the sub-query that populates each array field |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| One mega-RPC for entire app | Single function is simpler to maintain | One 500ms function blocks the entire page render; partial failures invalidate everything; cache granularity is lost | One RPC per logical dashboard route (owner summary, coach summary, student detail) |
| RPC for write paths (mutations) | Reduces API route code | Bypasses the existing Zod validation, auth checks, and role guards in API routes | Keep mutations in Next.js API routes; use RPC for reads only |
| `SECURITY INVOKER` on owner RPCs | Simpler permission model | Owner queries intentionally cross student boundaries; `SECURITY INVOKER` with student-scoped RLS blocks legitimate owner queries | Use `SECURITY DEFINER` for cross-role queries; add explicit `auth.uid()` check |

---

## Feature Area 2: React `cache()` for Server Component Deduplication

### What this does

React's `cache()` wraps a data-fetching function so that within a single RSC render tree, identical calls (same function reference + same serialized arguments) return the cached result instead of hitting the database again. The cache is per-request, not persistent — it resets between page navigations.

The existing codebase calls `createAdminClient()` and then issues Supabase queries directly in server component files. If two components in the same render tree need the same student record, they issue two Supabase queries. `cache()` deduplicates this.

This is NOT `unstable_cache` (which persists across requests) — `cache()` is only request-scoped deduplication.

### Expected behavior patterns

```typescript
// src/lib/data/students.ts
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export const getStudentById = cache(async (studentId: string) => {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', studentId)
    .single()
  return data
})

// Now two RSC components calling getStudentById('abc') within the same
// render tree will only issue one Supabase query.
```

For the admin client singleton: `createAdminClient()` using `createClient` from `@supabase/supabase-js` (not the SSR client) with `persistSession: false` IS safe as a module-level singleton. The service-role key has no user session to leak. The SSR client (`createServerClient`) must NOT be a module-level singleton because it reads `cookies()` which is request-scoped.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Data access functions wrapped with `cache()` | Without it, parallel RSC children each fire independent Supabase queries; 9 components on coach detail page = 9 queries for the same student record | LOW | One-line change per data function; wrap at the export level |
| Admin client as module-level singleton | `createAdminClient()` is currently called on every query; module-level singleton reuses the underlying HTTP connection pool | LOW | `export const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })` — safe because no user session involved |
| Request-scope deduplication is the goal (not persistence) | `cache()` prevents duplicate in-flight queries within one render; it is not a substitute for `unstable_cache` or `revalidate` | LOW | Document this distinction in code comments to prevent future misuse |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Preload pattern for critical data | Call `void getStudentById(id)` at the top of a layout before any blocking work; data is warm by the time child components request it | LOW | Useful on coach/owner student detail pages where 9–11 parallel queries resolve to fewer underlying fetches |
| `unstable_cache` for cross-request persistence | Dashboard aggregate data (total student count, platform stats) changes infrequently; caching for 60–300 seconds reduces DB load significantly | MEDIUM | `unstable_cache` wraps the fetch; `revalidateTag` busts it on mutation; separate from `cache()` |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `cache()` on write functions (mutations) | Consistency | `cache()` on a mutation would return stale data from the first call; inserts/updates must never be cached | `cache()` on read functions only; mutations always go through API routes |
| Module-level singleton for SSR client (`createServerClient`) | Performance (create once) | `createServerClient` reads `cookies()` which is request-scoped; a module-level singleton leaks one user's cookies into another user's request on warm instances | Use `cache()` to deduplicate per request; create fresh SSR client per request |
| `unstable_cache` on per-user data | Reduces DB calls | Per-user data (student's own progress, sessions, reports) must not be cached at the server level across requests — User A's data leaking into User B's cache key is a security violation | `unstable_cache` only on aggregate/platform-wide data; per-user data must be dynamic |

---

## Feature Area 3: Next.js Route-Level Revalidation

### What this does

`export const revalidate = N` in a page or layout file sets the ISR revalidation interval: Next.js will serve a cached version of the page for up to N seconds, then regenerate it in the background on the next request after the interval expires (stale-while-revalidate).

For the IMA platform, the relevant choice is between:
- `revalidate = 0` (always dynamic — current behavior, appropriate for student-specific pages)
- `revalidate = 60` (1-minute ISR — appropriate for owner stats dashboards)
- `revalidate = false` (cache indefinitely — appropriate for static content)
- On-demand revalidation via `revalidateTag()` or `revalidatePath()` after mutations

The owner dashboard shows aggregate statistics that update when students submit reports (typically at 11 PM). Serving a 1-minute-old count of "total students" is acceptable; serving a stale student-specific report is not.

### Expected behavior patterns

```typescript
// app/(dashboard)/owner/page.tsx — aggregate stats, stale-ok for 60 seconds
export const revalidate = 60

// app/(dashboard)/student/page.tsx — live data, never cache
export const revalidate = 0

// After report submission in API route:
import { revalidatePath } from 'next/cache'
revalidatePath('/owner')  // bust owner dashboard cache on new report
```

Key constraints from Next.js 16 docs:
- The `revalidate` value must be statically analyzable. `revalidate = 60 * 10` is invalid; write `revalidate = 600`.
- The lowest `revalidate` across all layouts and pages in a route determines the actual revalidation frequency.
- In development, pages always render on-demand; `revalidate` only applies to production builds.
- `revalidate = 0` is equivalent to `dynamic = 'force-dynamic'` — always server-rendered per request.

For Supabase queries (non-fetch), use `unstable_cache` instead of the `fetch` cache option. Both respect `revalidateTag`.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `revalidate = 0` on all student-specific pages | Student pages show their own live session, report, and progress data; stale data breaks the core UX | LOW | Default to dynamic; only opt into caching where data staleness is acceptable |
| `revalidate = 60` on owner aggregate stats | Platform stats (total active students, unreviewed reports) can be 60 seconds stale without impact; reduces DB load on owner page loads | LOW | Apply to owner layout or page; not to coach/student layouts |
| `revalidatePath('/owner')` after mutations | When a student submits a report, the owner dashboard cache should update within the next request cycle | LOW | Call `revalidatePath` in the API route handler after successful DB write |
| Tag-based revalidation for fine-grained cache busting | Report submission should bust the owner dashboard but not the student's own page | MEDIUM | Use `revalidateTag('owner-stats')` instead of path-based if multiple routes show the same aggregate |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `unstable_cache` for Supabase aggregate queries with tags | Platform stats wrapped in `unstable_cache({ tags: ['platform-stats'], revalidate: 300 })` persist across requests, reducing DB load by serving cached aggregates | MEDIUM | Cache total_students, active_week counts; bust on user creation/deletion |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `revalidate = 60` on coach/student detail pages | Reduce per-request DB calls | Student detail pages show live session status, today's report, current roadmap step — 60-second stale data would show wrong timer state, missed reports | Keep student pages dynamic (`revalidate = 0`); cache only platform-wide aggregates |
| Long revalidation intervals (> 300 seconds) on any dashboard data | Less DB load | At 5,000 students with the 11 PM submission spike, a 5-minute stale count of "unreviewed reports" means the owner sees the wrong alert count for up to 5 minutes — actionable data requires short TTLs | Max 60–120 seconds for dashboard aggregates; on-demand invalidation is the better tool for mutation-driven freshness |
| Global `revalidate` in root layout | One setting covers everything | Root layout `revalidate` propagates to ALL routes; student write paths need live data; a global cache breaks the work tracker and report submission | Set `revalidate` per page/segment, not in root layout |

---

## Feature Area 4: Server-Side Pagination with Supabase `.range()`

### What this does

The owner list pages currently fetch ALL students and ALL coaches from the database with no pagination. At 5,000 students, a single `SELECT * FROM users WHERE role = 'student'` returns 5,000 rows over the wire for every page load.

Supabase `.range(from, to)` maps to PostgreSQL's `LIMIT` and `OFFSET`. Combined with `{ count: 'exact' }` or `{ count: 'estimated' }`, it returns a paginated slice plus the total count needed to render page controls.

### Expected behavior patterns

```typescript
// Server component or API route
const PAGE_SIZE = 25
const page = Number(searchParams.page ?? 1)
const from = (page - 1) * PAGE_SIZE
const to = from + PAGE_SIZE - 1

const { data, count, error } = await supabase
  .from('users')
  .select('*', { count: 'estimated' })
  .eq('role', 'student')
  .order('created_at', { ascending: false })
  .range(from, to)

// count = total matching rows (for page count calculation)
// data = 25 rows for current page
```

Pagination state lives in URL search params (`?page=2`), not component state, so it survives navigation and can be bookmarked. Server components read from `searchParams` prop; Next.js re-renders the page on URL change.

`count: 'estimated'` uses Postgres statistics and is faster than `count: 'exact'` which runs a full COUNT(*). At 5,000 rows, `'estimated'` is accurate enough for page count display.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 25 rows per page on owner students list | Fetching 5,000 rows into a server component and rendering them is a guaranteed page timeout at scale; pagination is non-negotiable for any list over ~50 items | LOW | `.range()` is a single chained method; the complexity is in the UI pagination controls |
| URL-param-based page state (`?page=N`) | Refresh-stable, shareable, back-button compatible; component state pagination is lost on navigation | LOW | Read from `searchParams` in page component; `Link` components update the URL |
| Sort + filter preserved across pagination | If the owner is filtering by coach or searching by name, the filter must persist when changing pages | MEDIUM | Pass filter params alongside `page` in URL: `?page=2&coach=abc&q=sarah` |
| `.order()` on every paginated query | Without explicit ordering, Postgres returns rows in undefined order; page 2 can contain rows already shown on page 1 | LOW | Always chain `.order('created_at', { ascending: false })` before `.range()` |
| Total count for page controls | Rendering "Page 2 of 200" requires knowing the total; `.range()` without count makes this impossible | LOW | `{ count: 'estimated' }` on the select; use count in `Math.ceil(count / PAGE_SIZE)` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cursor-based pagination for infinite scroll (future) | Offset pagination degrades at high page numbers (page 200 = OFFSET 5000); cursor pagination is O(1) regardless of page | HIGH | Not needed at 5,000 students + 25 per page (200 pages max); evaluate if student count exceeds 50,000 |
| `count: 'estimated'` for display with `count: 'exact'` only on last page | Saves a COUNT(*) on every page load while still showing exact total on the final page | MEDIUM | Optimization; the performance difference at 5k rows is ~10ms — likely not worth the code complexity at this scale |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Client-side pagination (fetch all, paginate in JS) | Simpler component logic | Fetches all 5,000 rows on every page load; the network transfer and JSON parse cost defeats the purpose | Server-side `.range()` only; client receives exactly the 25 rows it needs |
| Infinite scroll with `useIntersectionObserver` | Modern UX pattern | Infinite scroll requires `use client` + `useState` + `useEffect` — moves the entire list out of server components; loses SSR benefits; also harder to bookmark/share a position | URL-param pagination stays fully server-rendered; infinite scroll is a v2+ pattern |
| Loading all students into a server-side cache | Avoids DB query on every page | 5,000 user records in Next.js server memory is ~5–50MB depending on fields; invalidation complexity is high; pages 2–200 still require a fresh query anyway | Cache only aggregate counts; always paginate the list itself |

---

## Feature Area 5: `pg_cron` Scheduled Jobs for Pre-Aggregation

### What this does

`pg_cron` is a PostgreSQL extension (enabled on Supabase Pro) that runs SQL jobs on a cron schedule, entirely inside the database. Pre-aggregation means computing expensive query results (e.g., "how many outreach calls did each student do this week?") once nightly and writing them into a summary table, so dashboard queries read the summary instead of aggregating on demand.

At 5,000 students, a query like `SELECT student_id, SUM(outreach_count) FROM daily_reports GROUP BY student_id` scans all daily_reports rows every time the owner loads the dashboard. Pre-aggregation turns this into a primary key lookup.

### Expected behavior patterns

```sql
-- 1. Create a summary table
CREATE TABLE student_kpi_snapshots (
  student_id UUID REFERENCES users(id),
  snapshot_date DATE DEFAULT CURRENT_DATE,
  lifetime_outreach INT,
  sessions_this_week INT,
  reports_this_week INT,
  avg_star_rating NUMERIC(3,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (student_id, snapshot_date)
);

-- 2. Create the aggregation function
CREATE OR REPLACE FUNCTION refresh_student_kpi_snapshots()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO student_kpi_snapshots (student_id, snapshot_date, lifetime_outreach,
    sessions_this_week, reports_this_week, avg_star_rating)
  SELECT
    u.id,
    CURRENT_DATE,
    COALESCE((SELECT SUM(outreach_count) FROM daily_reports WHERE student_id = u.id), 0),
    COALESCE((SELECT COUNT(*) FROM work_sessions WHERE student_id = u.id
              AND started_at > NOW() - INTERVAL '7 days'), 0),
    COALESCE((SELECT COUNT(*) FROM daily_reports WHERE student_id = u.id
              AND created_at > NOW() - INTERVAL '7 days'), 0),
    COALESCE((SELECT AVG(star_rating) FROM daily_reports WHERE student_id = u.id
              AND created_at > NOW() - INTERVAL '7 days'), 0)
  FROM users u WHERE u.role = 'student'
  ON CONFLICT (student_id, snapshot_date) DO UPDATE
    SET lifetime_outreach = EXCLUDED.lifetime_outreach,
        sessions_this_week = EXCLUDED.sessions_this_week,
        reports_this_week = EXCLUDED.reports_this_week,
        avg_star_rating = EXCLUDED.avg_star_rating,
        updated_at = NOW();
END;
$$;

-- 3. Schedule nightly at 2 AM UTC (after 11 PM submission spike)
SELECT cron.schedule(
  'refresh-student-kpi-snapshots',
  '0 2 * * *',
  'SELECT refresh_student_kpi_snapshots()'
);
```

Supabase Cron recommends no more than 8 concurrent jobs and each job should run no longer than 10 minutes. At 5,000 students, this aggregation is well within those bounds.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Nightly pre-aggregation of per-student KPI summaries | Owner dashboard aggregate queries that scan all 5,000 students on every page load are a scalability cliff; pre-computed summaries are standard practice at this scale | MEDIUM | One `pg_cron` job; one summary table; owner dashboard reads summary instead of aggregating live |
| `ON CONFLICT DO UPDATE` (upsert pattern) | The job must be idempotent — running it twice should not double-count | LOW | `ON CONFLICT (student_id, snapshot_date) DO UPDATE` handles reruns safely |
| Job scheduled after 11 PM submission spike | The 11 PM spike is the peak write window; running aggregation at 2 AM UTC means data is settled before snapshot | LOW | `'0 2 * * *'` in UTC; verify UTC offset for Abu Lahya's timezone (UAE = UTC+4, so 2 AM UTC = 6 AM UAE — no conflict) |
| Monitor `cron.job_run_details` for failures | If the aggregation job fails silently, the owner sees stale KPIs; visibility is critical | LOW | Supabase Dashboard > Integrations > Cron shows execution history; optionally alert on failure via pg_notify or Edge Function webhook |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `updated_at` on snapshot table | Owner can see when the snapshot was last refreshed ("Stats as of 2 AM") — sets expectation that these are not real-time | LOW | Display `updated_at` as a subtle footnote on owner dashboard |
| Incremental update (only changed students) | Instead of recomputing all 5,000, update only students who had activity since last snapshot | MEDIUM | `WHERE student_id IN (SELECT DISTINCT student_id FROM daily_reports WHERE created_at > NOW() - INTERVAL '25 hours')` — reduces job runtime at scale |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Replace live queries entirely with snapshots | Once pre-aggregation works, use it everywhere | Snapshots are stale by design; student's own dashboard, active session tracking, and today's report submission must always read live data | Pre-aggregation for owner-facing aggregates only; student-facing data stays live |
| Materialized views instead of summary table | Postgres-native pattern; auto-refresh with `REFRESH MATERIALIZED VIEW` | Supabase's PostgREST cannot query materialized views in the same way as tables; manual summary table with upsert is the established Supabase pattern | Summary table with `pg_cron` upsert is more transparent, debuggable, and PostgREST-compatible |
| Real-time aggregation via Supabase Realtime | Push updates to owner dashboard instantly | Realtime subscriptions at 5k concurrent students trigger massive fanout; owner dashboard does not need sub-second freshness for aggregate counts | Nightly snapshot + 60-second route revalidation gives acceptable freshness at zero connection cost |

---

## Feature Area 6: Optimistic UI Patterns in React 19

### What this does

`useOptimistic` (React 19 stable) lets a `use client` component immediately reflect an action's expected outcome in the UI before the server responds. If the server request fails, React automatically rolls back to the previous state.

For IMA, the highest-value target is the daily report submission: currently, submitting a report shows a loading spinner for the full round trip (3 DB writes). With optimistic UI, the report form collapses and the "submitted" state appears immediately, while the writes happen in the background.

### Expected behavior patterns

```typescript
// ReportForm.tsx (use client)
'use client'
import { useOptimistic, startTransition } from 'react'

type ReportState = { submitted: boolean; data: ReportData | null }

export function ReportForm({ initialState }: { initialState: ReportState }) {
  const [optimisticState, setOptimistic] = useOptimistic(
    initialState,
    (current, newData: ReportData) => ({ submitted: true, data: newData })
  )

  async function handleSubmit(formData: FormData) {
    const payload = parseFormData(formData)
    startTransition(async () => {
      setOptimistic(payload)  // immediate UI update
      try {
        await submitReport(payload)  // server action or fetch
      } catch (err) {
        toast.error('Failed to submit report. Please try again.')
        // React automatically rolls back optimisticState on error
      }
    })
  }

  if (optimisticState.submitted) return <ReportSubmittedView data={optimisticState.data} />
  return <form action={handleSubmit}>...</form>
}
```

Key behaviors (React 19 stable):
- `setOptimistic` must be called inside a `startTransition` or React Server Action
- On error: base state is unchanged, React reverts `optimisticState` to the real value automatically
- On success: parent rerenders with real server state, `optimisticState` converges
- No manual rollback logic needed — the reducer handles it

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Optimistic "submitted" state on report form | 3 DB writes take 200–500ms; the student sees a spinner while nothing appears to happen; immediate feedback is standard UX for form submission | LOW | Show submitted state immediately; toast error on failure; no manual rollback needed |
| `startTransition` wrapper is required | Calling `setOptimistic` outside a transition shows a React warning and may not behave correctly | LOW | Wrap the handler in `startTransition(async () => { ... })` |
| Error rollback with user-facing toast | When the server rejects the submission, the UI must return to the form and show an error | LOW | React rolls back automatically; add `toast.error()` in catch block (per project hard rules: never swallow errors) |
| Disabled submit button during in-flight transition | User should not be able to submit twice while the first submission is in flight | LOW | Use `useFormStatus().pending` or track transition state to disable the submit button |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Optimistic session complete/abandon in work tracker | The work tracker already has start/complete/abandon; completing a session currently waits for the server write before showing the "completed" state | LOW | Same `useOptimistic` pattern; payload is the new session status |
| Stale-while-submit indicator | A subtle spinner or opacity change on the submitted state while the server write completes, so power users can see the write is still in flight | LOW | `isPending` from `useTransition` drives a small loading indicator on the submitted card |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Optimistic updates for all mutations | Consistency | Optimistic UI for low-frequency, high-stakes mutations (admin actions, invites, role changes) creates dangerous false confidence if the server rejects them | Optimistic UI only for high-frequency student write paths (report submit, session complete); keep admin mutations synchronous with explicit success/error states |
| Custom rollback logic with manual state tracking | Full control over rollback behavior | React 19's automatic rollback is the correct primitive; manual tracking adds state complexity and gets out of sync | Trust React's rollback; add only user-facing toast notification |
| Optimistic UI without error handling | Simpler code | The project hard rules require that every catch block toasts or console.errors; an optimistic update without error handling silently loses data | Always pair `setOptimistic` with a try/catch that surfaces the error to the user |

---

## Feature Area 7: API Route Rate Limiting Without Middleware

### What this does

Rate limiting prevents a single user from overwhelming the write paths (report submission, session completion) with rapid repeated requests. The target is 30 requests per minute per user.

Since the project uses `proxy.ts` (not `middleware.ts`) and middleware-based rate limiting requires edge middleware, the rate limiter lives inside each API route handler. The simplest production-appropriate approach for a single-instance Next.js deployment is an in-memory `Map` keyed by `userId + endpoint` with a sliding window or token bucket algorithm.

**Critical caveat:** In-memory rate limiting does not work correctly across multiple server instances (e.g., Vercel serverless = one instance per function invocation). For a self-hosted or single-process deployment, it works correctly. For Vercel serverless, each invocation has fresh memory — rate limiting is per-cold-start, not per-user.

For IMA's current deployment context: Supabase Pro + likely single-server Next.js (not Vercel serverless), in-memory is acceptable. If Vercel/serverless deployment is adopted, evaluate Upstash Redis (the established solution).

### Expected behavior patterns

```typescript
// src/lib/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000  // 1 minute
const MAX_REQUESTS = 30

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (entry.resetAt < now) rateLimitMap.delete(key)
  }
}, WINDOW_MS)

export function checkRateLimit(userId: string, endpoint: string): boolean {
  const key = `${userId}:${endpoint}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true  // allowed
  }

  if (entry.count >= MAX_REQUESTS) return false  // blocked

  entry.count++
  return true  // allowed
}

// In API route handler:
// const allowed = checkRateLimit(userId, 'POST:/api/daily-reports')
// if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

Key: rate limit check goes AFTER auth verification but BEFORE Zod validation (no point validating a blocked request).

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 429 response with `Retry-After` header | The HTTP spec for rate limiting; clients can back off correctly; logging shows when limits are hit | LOW | `return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })` |
| Rate limit keyed by `userId` not IP | The IMA platform has authenticated-only routes; user ID is more accurate than IP (students may share IPs at university) | LOW | `userId` from verified session; IP as fallback if somehow unauthenticated |
| Rate limit applied to write paths only | GET requests serve data; only POST/PATCH/DELETE paths are abuse vectors | LOW | Apply to: `POST /api/daily-reports`, `POST /api/work-sessions`, `PATCH /api/work-sessions/[id]` |
| Rate limit check AFTER auth, BEFORE validation | Checking rate limit before auth wastes cycles; checking after Zod parsing is inefficient if blocked | LOW | Order: auth → rate limit → Zod validation → DB write |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-endpoint limits (not one global limit) | Report submission (1/day expected) should have a tighter limit than session start (multiple/day expected); blanket 30/min is correct for sessions but too loose for reports | LOW | `checkRateLimit(userId, 'POST:/api/daily-reports')` with `MAX_REQUESTS = 5`; separate key prevents pollution between endpoints |
| Rate limit header on allowed requests | `X-RateLimit-Remaining: 27` on every response lets the client know how close it is to the limit | LOW | Add header to every response, not just 429s |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rate limiting all routes including GET | Comprehensive protection | GET routes are student dashboard loads — legitimate users navigating tabs would hit the limit; read-heavy apps punish normal browsing | Rate limit write paths only; GET paths are protected by RLS and auth checks |
| Too-tight limits (e.g., 5 req/min for session endpoints) | Prevent abuse | Students doing multiple sessions per day with break skips and session completes legitimately hit 10+ API calls in a few minutes; too-tight limits break normal use | 30 req/min for session endpoints covers all legitimate use cases with room; report endpoint gets tighter limit since 1/day is expected |
| Upstash Redis rate limiting (now) | Production-grade distributed rate limiting | Redis adds external dependency, latency, and cost; the platform is single-server; in-memory handles the load | Implement in-memory now; document Upstash as the upgrade path if Vercel serverless deployment occurs |

---

## Feature Area 8: Load Testing Approaches for Supabase-Backed Apps

### What this does

Load testing runs simulated concurrent users against the live application to identify where performance degrades under realistic load. For IMA, the critical scenario is the 11 PM submission spike: 5,000 students potentially submitting reports within a 1–2 hour window.

**k6** is the standard tool for this (used by Supabase's own benchmarking). It runs JavaScript test scripts that issue HTTP requests with configurable VU (virtual user) counts and ramp patterns.

### Expected behavior patterns

```javascript
// load-test.js — k6 script
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // ramp up to 100 VUs
    { duration: '5m', target: 500 },   // hold at 500
    { duration: '5m', target: 2000 },  // ramp to 2000 (spike)
    { duration: '10m', target: 5000 }, // peak load
    { duration: '2m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],     // < 1% error rate
  },
}

const BASE_URL = 'https://your-staging-app.com'
const SESSION_TOKEN = __ENV.SESSION_TOKEN  // pre-authed token for test user

export default function () {
  // Test report submission (11 PM spike scenario)
  const reportRes = http.post(
    `${BASE_URL}/api/daily-reports`,
    JSON.stringify({ hours_worked: 2, star_rating: 4, outreach_count: 30 }),
    { headers: { 'Content-Type': 'application/json',
                 'Cookie': `sb-token=${SESSION_TOKEN}` } }
  )
  check(reportRes, { 'report submitted': (r) => r.status === 200 })
  sleep(1)
}
```

Realistic test design for Supabase-backed apps requires:
1. A staging environment (not production — load tests can exhaust DB connections)
2. Pre-seeded test data matching production scale (5,000 user rows, 90 days of reports)
3. Authenticated requests (Supabase requires auth; unauthenticated tests miss the real bottleneck)
4. Testing the Postgres connection pool behavior (Supabase Pro: 60 direct connections by default; PostgREST pools these)

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Staged ramp-up to 5,000 VUs | Cold-hit testing does not reveal real bottlenecks; gradual ramp reveals where performance starts degrading | LOW | k6 `stages` config; start at 100 VUs, reach 5,000 over 20 minutes |
| Test against staging with production-scale seed data | Testing against empty DB is meaningless; query planner, indexes, and cache behavior all differ with real data volume | MEDIUM | Seed 5,000 users, 90 days of reports, sessions — ~500k rows of daily_reports |
| Authenticated test requests | Unauthenticated requests hit a different code path (rejected at auth check before DB query); real bottleneck is the authenticated path | MEDIUM | Pre-generate test session tokens for k6 scenarios; store in environment variables |
| Measure p95 latency, not just mean | Mean hides tail latency; at 5,000 concurrent users, the p95 matters more than the average | LOW | k6's default metrics include `http_req_duration{p(95)}` — set threshold at < 2s |
| Test the 11 PM spike scenario specifically | Uniform load ≠ spike load; the submission window creates bursty writes that uniform VU tests do not replicate | MEDIUM | Add a "spike" stage: ramp to 2,000 VUs within 1 minute, hold for 10 minutes |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Test write paths and read paths separately | Dashboard reads (owner page load) and report writes have different bottlenecks; mixed tests obscure which is the problem | LOW | Two k6 scripts: one for reads (GET /owner, GET /student), one for writes (POST /api/daily-reports) |
| Capture Supabase connection pool metrics during test | The Postgres connection limit is the most common Supabase scalability wall; monitoring `pg_stat_activity` during test reveals connection exhaustion before it hits production | MEDIUM | Query `SELECT count(*), state FROM pg_stat_activity GROUP BY state` from Supabase SQL editor during test run |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Load testing against production | Most realistic environment | Risk of real data corruption, rate limits, and alerting production users; also violates test data isolation | Always test against staging; use a staging branch of Supabase (Supabase Pro supports branching) |
| Browser-based load testing (Playwright/Cypress at load) | Tests the full stack including frontend | Browser tests at 5,000 VUs are prohibitively expensive (CPU/memory); measures browser rendering, not server capacity | HTTP-level k6 tests measure server capacity correctly; browser tests are for functional testing only |
| Load testing without pre-seeded data | Faster test setup | An empty database with no query results is a best-case scenario that does not represent real query plans, index behavior, or cache hit rates | Seed data before every load test run; automate seeding as part of the test setup |

---

## Feature Area 9: Security Auditing (RLS, CSRF, Cross-User Isolation)

### What this does

A security audit verifies that the existing auth and data access patterns cannot be exploited to read or modify another user's data. The specific threats for IMA are:

1. **RLS bypass**: Supabase's anon key + direct REST API could expose data if RLS policies are misconfigured
2. **Cross-user isolation**: Can User A read User B's work sessions or daily reports by guessing UUIDs?
3. **CSRF**: Can an attacker trick an authenticated student into submitting a forged report?
4. **Privilege escalation**: Can a student make requests that should only succeed for coaches or owners?
5. **Admin client leakage**: Is the service-role key ever exposed to the client?

The existing architecture has defense in depth: admin client (service-role, bypasses RLS) + explicit user ID filter in every query. This is the correct pattern, but every query must be verified.

### Expected behavior patterns

**RLS audit checklist:**
```sql
-- 1. Verify RLS is enabled on all 6 tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- All 6 should show rowsecurity = true

-- 2. Verify policies exist for anon and authenticated roles
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- 3. Test cross-user SELECT with a student's anon key
-- (test from Supabase SQL editor using RLS-enabled client, not admin)
-- Expected: returns 0 rows for other students' data
SELECT * FROM daily_reports WHERE student_id = '[other-user-uuid]';
```

**Cross-user isolation test:**
Every API route that reads or writes user-specific data must verify that the requesting user ID matches the resource's owner. The pattern already in the codebase:
```typescript
// After verifying session, before any DB query:
if (params.studentId !== session.user.id && session.user.role === 'student') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**CSRF protection:** Next.js API routes using `POST` with `Content-Type: application/json` are not vulnerable to traditional CSRF (browsers cannot send `application/json` from a cross-origin form without CORS preflight). The existing cookie-based Supabase session adds the `SameSite` attribute. Verify `SameSite=Lax` or `Strict` is set on the auth cookie.

**Admin client leakage:** Search the entire codebase for any import of `createAdminClient` in files under `src/app/(dashboard)` or `src/components`. Zero results expected — the admin client must only appear in `src/app/api/` and `src/lib/supabase/`.

### Table stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| RLS enabled on all 6 tables | The Supabase anon key is in the client bundle; without RLS, any user can query any table directly from the browser | LOW | SQL query against `pg_tables` to verify; one-time check |
| No direct `anon` access to sensitive tables | Work sessions, daily reports, and user data should not be readable via the anon key without auth | LOW | Verify with `pg_policies`; test by issuing a request with only the anon key |
| Every API route checks auth before any DB operation | A route that queries the DB before checking auth could return data to an unauthenticated caller on error path | LOW | Code review: every route handler must have `const session = await getSession()` as the first operation |
| User ID filter in every query (defense in depth) | RLS alone is defense; user ID filter in the query is the second layer; admin client bypasses RLS, so the filter is the ONLY protection on admin-client queries | MEDIUM | Audit all API routes; every `supabase.from('...').select()` must include `.eq('user_id', session.user.id)` or equivalent |
| No service-role key with `NEXT_PUBLIC_` prefix | `NEXT_PUBLIC_` variables are bundled into the client-side JavaScript; the service-role key there = full public database access | LOW | `grep -r "NEXT_PUBLIC_" .env*` should never return the service key |
| Role check before privileged operations | Coach endpoints must verify `role === 'coach'`; owner endpoints must verify `role === 'owner'`; not just authentication | LOW | Every API route in `/api/owner/` and `/api/coach/` must check role after auth |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automated RLS smoke test in CI | Run a SQL test (pgTAP or plain SQL) that proves cross-user SELECT returns 0 rows after each migration | HIGH | Supabase supports pgTAP tests locally; valuable long-term but complex to set up |
| Security headers audit (CSP, HSTS, X-Frame-Options) | Prevents XSS and clickjacking; common omission in Next.js apps | LOW | Add to `next.config.ts` headers config; CSP is the highest-value header for this app |

### Anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Relying on RLS alone without user ID filters on admin-client queries | RLS is the "real" protection; the filter is redundant | Admin client (`SECURITY DEFINER` or service-role) **bypasses RLS entirely**. Without the explicit filter, any admin query can access any row for any user. The filter is not redundant — it is the only protection on admin paths | Maintain double-layer: RLS for anon/authenticated clients + user ID filter for admin client queries |
| CSRF tokens for all forms | Comprehensive protection | Next.js App Router + `Content-Type: application/json` + `SameSite` cookies provides CSRF protection inherently; adding CSRF tokens requires infrastructure (token generation, storage, validation) with marginal benefit for this architecture | Verify `SameSite` cookie setting; document why CSRF tokens are not needed for JSON APIs |
| Security audit as a one-time event | Ship once, audit once | Schema migrations, new API routes, and role changes introduce new attack surface; audit must be part of the phase transition checklist | Add 5-item security checklist to the phase transition process for every phase that adds API routes or migrations |

---

## Feature Dependencies (v1.2)

```
[Database indexes on high-traffic columns]
    └──required by──> RPC consolidation (indexes make RPC sub-queries fast)
    └──required by──> Server-side pagination (ORDER BY + LIMIT needs index support)
    └──required by──> pg_cron aggregation (aggregation scans need index support)

[Admin client singleton (module-level)]
    └──required by──> React cache() deduplication (cache() wraps the singleton call)

[React cache() for data access functions]
    └──enhances──> RSC render tree efficiency (deduplicates parallel component queries)
    └──independent of──> unstable_cache (different scope: request vs cross-request)

[unstable_cache + revalidateTag]
    └──required by──> Route-level revalidation on owner dashboard (persistent cache layer)
    └──requires──> revalidatePath/revalidateTag calls in API routes after mutations

[RPC consolidation (owner dashboard)]
    └──requires──> Database indexes (slow sub-queries make RPC worse, not better)
    └──enhances──> Route-level revalidation (fewer cached calls = simpler invalidation)

[pg_cron pre-aggregation]
    └──requires──> summary table creation (migration)
    └──enhances──> RPC performance (RPCs read summary instead of aggregating live)
    └──independent of──> client-side caching (runs server-side on schedule)

[Server-side pagination]
    └──requires──> URL-param routing (searchParams on server component)
    └──independent of──> caching (each page is a distinct URL, cached separately)

[Optimistic UI (useOptimistic)]
    └──requires──> existing write API routes (wraps the same fetch calls)
    └──independent of──> server-side caching (client-side pattern only)

[Rate limiting]
    └──requires──> userId from verified session (rate limit key)
    └──placed after──> auth check in every API route handler

[Security audit]
    └──requires──> all previous features complete (audits final state)
    └──requires──> human review gate (HALT after audit before applying fixes)
    └──informs──> load testing scenarios (test the security-hardened paths)

[Load testing]
    └──requires──> staging environment with production-scale seed data
    └──requires──> optimizations complete (test the optimized system)
    └──provides──> evidence for HALT gate (human confirms results before v1.2 ship)
```

### Dependency Notes

- **Indexes before RPCs:** An RPC that runs 4 un-indexed sub-queries is slower than 4 separate PostgREST calls with indexes. Add indexes first; then consolidate into RPCs.
- **Admin singleton before `cache()`:** `cache()` wraps the function that calls `createAdminClient()`; if `createAdminClient()` is per-call, wrapping it with `cache()` still creates a new client per unique call signature. The singleton must exist first.
- **`unstable_cache` requires mutation busting:** Any route that writes data must call `revalidateTag` or `revalidatePath` after a successful write, or the cache serves stale data. Missing this creates subtle bugs that are hard to reproduce.
- **pg_cron runs AFTER 11 PM spike:** The aggregation job timing is not arbitrary. Running it at 2 AM UTC ensures the nightly reports are settled before snapshot. Running it at 9 PM (before the spike) would miss the day's reports.
- **Security audit is the final gate before load testing:** Load testing a system with a security hole validates the wrong thing. Audit first, fix issues, then test under load.

---

## MVP Definition (v1.2)

### Build First (Phase 19: Foundations)

These unblock everything else and have zero risk of breaking existing functionality:

- [ ] Database indexes on `daily_reports`, `work_sessions`, `roadmap_progress` — query performance prerequisite for all optimizations
- [ ] Admin client singleton at module level — safety verified: service-role client has no user session to leak
- [ ] Query performance monitoring baseline — need latency baseline before measuring improvement

### Build Second (Phase 20: Dashboard Performance)

Optimizations that reduce DB load on the highest-traffic paths:

- [ ] RPC consolidation for owner dashboard (8 → ≤2 round trips)
- [ ] Server-side pagination on owner student/coach list pages
- [ ] React `cache()` on data access functions + route-level `revalidate = 60` on owner dashboard
- [ ] `pg_cron` nightly pre-aggregation job + summary table

**HALT after Phase 20** — load test results reviewed by human before proceeding.

### Build Third (Phase 21: Write Path UX)

User-facing improvement that lands after the read-path optimizations are validated:

- [ ] Optimistic UI on student report submission and session completion
- [ ] API route rate limiting (30 req/min/user) on all write paths

### Build Fourth (Phase 22–23: Security)

Security audit is last because it audits the final state of all code:

- [ ] Security audit: RLS verification, cross-user isolation, privilege escalation, admin client exposure
- [ ] Apply security fixes identified in audit

**HALT after Phase 23** — audit results require human review before shipping.

### Build Fifth (Phase 24: Validation)

- [ ] Infrastructure validation under 5k simulated load with k6
- [ ] Performance regression baseline documented

### Defer to v2+

- [ ] Upstash Redis rate limiting — only if Vercel serverless deployment adopted
- [ ] Cursor-based pagination — only if student count exceeds 50,000
- [ ] Automated RLS CI tests (pgTAP) — valuable but complex; add in v2 maintenance cycle
- [ ] Real-time Supabase Realtime for owner dashboard — adds connection overhead; snapshots + ISR are sufficient

---

## Feature Prioritization Matrix (v1.2)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| DB indexes | HIGH (prevents query timeouts at scale) | LOW | P1 |
| Admin client singleton | HIGH (connection reuse) | LOW | P1 |
| Server-side pagination | HIGH (prevents OOM on owner list) | LOW | P1 |
| RPC consolidation | HIGH (8→2 round trips on owner) | MEDIUM | P1 |
| pg_cron pre-aggregation | HIGH (eliminates spike-time aggregation) | MEDIUM | P1 |
| Route-level revalidation | MEDIUM (reduces repeat DB calls) | LOW | P1 |
| React cache() dedup | MEDIUM (eliminates within-render dups) | LOW | P1 |
| Optimistic report submission | HIGH (UX improvement on critical path) | LOW | P2 |
| Rate limiting (write paths) | HIGH (security/stability) | LOW | P2 |
| Security audit | HIGH (required before 5k launch) | MEDIUM | P2 |
| Load testing | HIGH (validates everything else) | MEDIUM | P2 |
| unstable_cache for aggregates | MEDIUM (complements RPC consolidation) | MEDIUM | P2 |
| Cursor pagination | LOW (not needed at 5k students) | HIGH | P3 |
| Automated RLS CI | LOW (operational excellence, v2+) | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.2 launch
- P2: Required for v1.2 but can come after P1 items
- P3: Nice to have, future consideration

---

## Sources

- Next.js 16 official docs: [Caching (Previous Model)](https://nextjs.org/docs/app/guides/caching) — HIGH confidence (docs version 16.2.1, last updated 2026-03-25)
- Next.js 16 official docs: [unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache) — HIGH confidence
- React 19 official docs: [useOptimistic](https://react.dev/reference/react/useOptimistic) — HIGH confidence
- Supabase official docs: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence
- Supabase official docs: [Database Functions](https://supabase.com/docs/guides/database/functions) — HIGH confidence
- Supabase official docs: [Cron](https://supabase.com/docs/guides/cron) — HIGH confidence
- Supabase community discussion: [createServerClient singleton pattern](https://github.com/orgs/supabase/discussions/26936) — MEDIUM confidence
- Supabase community discussion: [Service Role in Next.js](https://github.com/orgs/supabase/discussions/30739) — MEDIUM confidence
- freeCodeCamp: [In-Memory Rate Limiter in Next.js](https://www.freecodecamp.org/news/how-to-build-an-in-memory-rate-limiter-in-nextjs/) — MEDIUM confidence
- DEV.to: [Supabase RLS Hidden Dangers](https://dev.to/fabio_a26a4e58d4163919a53/supabase-security-the-hidden-dangers-of-rls-and-how-to-audit-your-api-29e9) — MEDIUM confidence
- Supabase benchmarks repository: [k6 load testing](https://github.com/orgs/supabase/discussions/4826) — MEDIUM confidence
- Grafana k6 official docs: [k6.io](https://k6.io/) — HIGH confidence
- Project context: `.planning/PROJECT.md` — HIGH confidence (primary source)

---

*Feature research for: IMA Accelerator v1.2 — Performance, Scale & Security*
*Researched: 2026-03-29*
