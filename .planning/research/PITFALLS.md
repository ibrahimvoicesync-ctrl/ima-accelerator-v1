# Pitfalls Research

**Domain:** Adding performance optimization and security hardening to existing Next.js 16 + Supabase App Router platform (v1.2)
**Researched:** 2026-03-29
**Confidence:** HIGH — primary sources: Supabase official docs, Next.js official security blog, PostgREST docs, Postgres advisory lock docs, pg_cron Supabase discussions

> **Scope:** This document covers pitfalls specific to the v1.2 features being ADDED to an existing system. The app already ships and has real data. Every pitfall here is about what breaks when you bolt optimization and hardening onto a running platform, not about building from scratch. The system uses PostgREST (not direct Postgres connections), Next.js 16 App Router (not Pages Router), and Supabase Pro plan.

---

## Critical Pitfalls

### Pitfall 1: Admin Client Per-Call Instantiation Exhausts Connections at Scale

**What goes wrong:**
`createAdminClient()` is called inside every API route handler and server component — once per request. Each call creates a new Supabase JS client instance with its own connection pool. Under 5,000 students submitting during the 11 PM spike, each concurrent Lambda spins up and calls `createAdminClient()`, opening new DB connections. The Supabase Pro plan database has a finite max_connections (typically 100–200 direct connections for standard Pro compute). The connection limit is hit and subsequent requests receive `FATAL: too many connections` or time out.

**Why it happens:**
In serverless, functions are stateless by design. Developers write `createAdminClient()` at the top of each handler the same way they'd initialize any dependency — per invocation. The development database never shows this problem because local dev never has 50+ concurrent requests. The production database only shows the failure under real load.

**How to avoid:**
Two-part fix: (1) For `createAdminClient()` (service_role, no cookies dependency), create a true module-level singleton:
```typescript
// lib/supabase/admin.ts
let adminClient: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return adminClient;
}
```
The singleton works for `createAdminClient()` because it has NO cookies dependency — the service_role key is static. (2) For `createServerClient()` (auth-aware, depends on request cookies), do NOT use a global singleton — the cookies() call must happen within a request scope. Use React's `cache()` wrapper instead for request-level deduplication in server components.

**Warning signs:**
- `FATAL: too many connections` in Supabase database logs during traffic spikes
- Supabase dashboard connection count chart spikes above 70% of max_connections
- Load test shows 503 errors that correlate with connection exhaustion, not CPU

**Phase to address:** Admin client singleton (Phase 19 — database indexes + singleton + monitoring).

---

### Pitfall 2: createServerClient Cannot Use a Global Singleton (Cookies Scope Error)

**What goes wrong:**
Attempting to apply the same module-level singleton pattern to `createServerClient()` (the auth-aware Supabase SSR client) throws: `Error: cookies was called outside a request scope`. This is a fatal runtime error, not a warning. The entire page crashes. Developers discover this after applying what appears to be an identical singleton fix to the admin client.

**Why it happens:**
`createServerClient()` from `@supabase/ssr` reads the request's cookie jar via Next.js's `cookies()` function internally. This function is only available within the scope of a request handler — it cannot be called at module initialization time (which is what a `globalThis` singleton does). The admin client does not have this constraint because it uses a static service_role key with no cookie dependency.

**How to avoid:**
Use React's `cache()` to memoize per-request, not per-module:
```typescript
// lib/supabase/server.ts
import { cache } from 'react';

export const createServerClient = cache(() => {
  const cookieStore = cookies();
  return _createServerClient(url, anonKey, { cookies: { ... cookieStore } });
});
```
`cache()` deduplicates calls per-request render tree. Calling `createServerClient()` ten times in the same render only creates one client. The cache is discarded when the request finishes — no cross-request contamination.

**Warning signs:**
- Runtime error: `cookies was called outside a request scope`
- Error appears only under load (singleton initialized on cold start before first real request)
- Works in development (Next.js dev mode handles scope differently) but fails in production

**Phase to address:** Admin client singleton (Phase 19) — handle the two client types with different patterns in the same phase.

---

### Pitfall 3: In-Memory Rate Limiting Is Silently Broken in Serverless

**What goes wrong:**
An in-memory LRU cache for rate limiting (e.g., `Map<userId, RequestRecord[]>`) appears to work in development and unit tests. In production on Vercel (or any serverless platform), each Lambda instance has its own isolated memory. With 100 concurrent users, there may be 100 Lambda instances — each with an empty rate limit map. A single user can hammer the API 30 times per second by having their requests routed to different Lambda instances, all of which see "0 requests from this user." The rate limit is never triggered. No error is thrown — the feature silently provides zero protection.

**Why it happens:**
Serverless functions are horizontally scaled by the platform. `module`-level variables persist only within a single function instance, not across the fleet. Developers test with `npm run dev` (single Node.js process, shared memory) and the rate limiter correctly blocks on the second burst. Production has no such guarantee.

**How to avoid:**
For this stack (Supabase already available, Redis not in scope per PROJECT.md), use database-backed rate limiting via an `api_rate_limits` table with a function:
```sql
CREATE TABLE api_rate_limits (
  user_id uuid REFERENCES users(id),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);
```
Use a Postgres function with `INSERT ... ON CONFLICT DO UPDATE` to atomically increment and check the count within the current 1-minute window. The overhead is one extra DB query per API call — acceptable for 30 req/min enforcement. Alternative: Use a Supabase Edge Function as a rate-limit gateway (runs in a persistent Deno process, not a stateless Lambda).

**Warning signs:**
- Rate limiter never triggers during load testing despite bursts well above the threshold
- Logs show "rate limit: 0 requests in window" for the same user across multiple requests in the same second
- `wrk` or k6 load test returns HTTP 200 for all requests regardless of request rate

**Phase to address:** API rate limiting (Phase 22 — rate limiting phase).

---

### Pitfall 4: RLS Policies with auth.uid() Called Per-Row Cause Full Table Scans

**What goes wrong:**
A policy written as `user_id = auth.uid()` calls the `auth.uid()` PostgreSQL function for every row evaluated. On `daily_reports` with 5,000 students × 180 reports = 900,000 rows, a query for one student's reports triggers `auth.uid()` on every row, disabling index use. Query time goes from 2ms (with index scan) to 50ms+ (full sequential scan). The Supabase advisor flags this as the `auth_rls_initplan` lint — but developers often build policies without checking the advisor.

**Why it happens:**
The Postgres query planner treats `auth.uid()` as a volatile function. Volatile functions are re-evaluated per row, which prevents the planner from using an index scan. This is a counterintuitive Supabase-specific RLS gotcha — the policy looks correct and passes all tests, but becomes a performance disaster at scale.

**How to avoid:**
Wrap ALL `auth.uid()` calls in RLS policies with a subquery:
```sql
-- BAD (volatile, per-row evaluation):
CREATE POLICY "student_select" ON daily_reports FOR SELECT
  USING (student_id = auth.uid());

-- GOOD (initplan: evaluated once per statement, enables index scan):
CREATE POLICY "student_select" ON daily_reports FOR SELECT
  USING (student_id = (SELECT auth.uid()));
```
The `SELECT` wrapper causes Postgres to create an `initPlan` — a one-time evaluation cached for the lifetime of the query. Check existing policies in the current migration for any `auth.uid()` or `auth.jwt()` calls NOT wrapped in `(SELECT ...)`. Also applies to custom functions like `get_user_id()` — verify the existing implementations already use this pattern.

**Warning signs:**
- Supabase dashboard Performance Advisor shows `auth_rls_initplan` violations
- `EXPLAIN ANALYZE` on a student query shows `Seq Scan` instead of `Index Scan` on a large table
- Query times are 10-100x slower than expected after adding RLS

**Phase to address:** Database indexes + RLS audit (Phase 19).

---

### Pitfall 5: pg_cron Runs in UTC — Nightly Aggregation Runs at Wrong Local Time

**What goes wrong:**
A nightly pre-aggregation job scheduled as `'0 2 * * *'` intending "2 AM Gulf Standard Time (UTC+4)" actually runs at 2 AM UTC — which is 6 AM GST. For an 11 PM deadline, the aggregation needs to complete after midnight local time but before the morning coaching review. Getting the UTC offset wrong means summary tables are either stale during the coaching review period or updated too late to capture the previous night's reports.

**Why it happens:**
pg_cron uses UTC internally regardless of the PostgreSQL session timezone setting. Setting `SET timezone = 'Asia/Dubai'` in a migration affects `NOW()` outputs in that session but has no effect on cron schedule interpretation. The Supabase cron UI does not display the execution time in local timezone. Community reports confirm this consistently across multiple timezones.

**How to avoid:**
Always write pg_cron schedules in UTC explicitly and document the intended local time in a comment:
```sql
-- Runs at 01:00 UTC = 05:00 GST (UTC+4) — after midnight daily reports deadline
SELECT cron.schedule('nightly-aggregation', '0 1 * * *', $$
  SELECT aggregate_daily_kpis();
$$);
```
For the 11 PM GST student deadline (23:00 GST = 19:00 UTC), schedule the aggregation at `30 19 * * *` UTC (30 minutes after deadline). Verify by querying `cron.job` and checking the schedule field, then manually confirming against UTC-to-local conversion.

**Warning signs:**
- Owner dashboard KPI summaries show yesterday's data well into the next morning
- Aggregation appears to "miss" some students' reports from the previous deadline window
- `cron.job_run_details` shows job executions at unexpected UTC hours

**Phase to address:** pg_cron pre-aggregation (Phase 21 — nightly aggregation phase).

---

### Pitfall 6: pg_cron Jobs Have No Overlap Protection by Default

**What goes wrong:**
If the nightly aggregation query takes longer than its scheduled interval (e.g., the job runs at `0 1 * * *` but takes 70+ minutes under full load), the next day's run starts while the first is still executing. Both instances write to the same summary table simultaneously. The result is double-counted aggregates, partial overwrites, or deadlock errors in `cron.job_run_details`. Supabase imposes a hard recommendation of maximum 8 concurrent jobs and max 10 minutes per job — but does not enforce overlap prevention automatically.

**Why it happens:**
pg_cron fires a new job at the scheduled time regardless of whether the previous run is still active. There is no built-in "skip if already running" mode (unlike systemd timers or cron alternatives). The failure only manifests under load — in development, aggregation completes in seconds.

**How to avoid:**
Use `pg_try_advisory_lock()` as a guard at the top of the aggregation function:
```sql
CREATE OR REPLACE FUNCTION aggregate_daily_kpis()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Acquire advisory lock (key: any stable integer for this job)
  IF NOT pg_try_advisory_lock(12345) THEN
    RAISE NOTICE 'aggregate_daily_kpis: already running, skipping';
    RETURN;
  END IF;

  -- ... do aggregation work ...

  PERFORM pg_advisory_unlock(12345);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(12345);
  RAISE;
END;
$$;
```
Session-level advisory locks are automatically released if the Postgres session ends (crash-safe). Also: keep aggregation idempotent — use `INSERT ... ON CONFLICT DO UPDATE` for summary tables, not `DELETE + INSERT`, so a partial run does not corrupt data.

**Warning signs:**
- `cron.job_run_details` shows two overlapping runs with the same job name
- Summary table counts are 2x expected for affected date windows
- Deadlock errors appearing in Postgres logs around the cron execution window

**Phase to address:** pg_cron pre-aggregation (Phase 21).

---

### Pitfall 7: React cache() Does Not Persist Between Requests — Stale Data Confusion

**What goes wrong:**
React's `cache()` function memoizes within a single render tree for a single request. Developers sometimes conflate it with Next.js Data Cache (which persists across requests and needs explicit revalidation). When `cache()` wraps a DB query, the first request fetches fresh data. The second request is a separate render tree — it hits the DB again. This is correct behavior, but it confuses developers who expect caching to reduce DB load across requests. They then add `revalidate = 60` expecting to get 60-second caching across requests, without realizing this activates the Next.js Data Cache (not React cache), which only works with `fetch()` calls — not with Supabase JS client queries.

**Why it happens:**
Next.js has four overlapping cache layers: Request Memoization (React `cache()`, per-request), Data Cache (Next.js, across requests, fetch-only), Full Route Cache (static pages), and Router Cache (client-side navigation). The Supabase JS client does NOT go through `fetch()` — it uses its own HTTP client. Therefore Next.js Data Cache does NOT apply to Supabase JS queries. The `export const revalidate = 60` route segment config has no effect on Supabase JS client calls.

**How to avoid:**
Use `cache()` for request deduplication (calling the same query from multiple components in one render), not for cross-request caching. For cross-request caching of Supabase data, use `revalidatePath()` / `revalidateTag()` after mutations (cache invalidation strategy) rather than time-based `revalidate`. If time-based caching is needed, wrap Supabase calls in a standard `fetch()` call with a custom cache key, or use `unstable_cache` from Next.js which works for non-fetch async functions. The 8 round-trip owner dashboard problem is solved by RPC consolidation (fewer DB calls), not by caching stale aggregates.

**Warning signs:**
- `export const revalidate = 60` added to a page with Supabase JS queries, expecting reduced DB load — DB call count is unchanged
- Dashboard shows stale data after a mutation (mutation triggered revalidation but Supabase cache is unaffected)
- `cache()` removed "to fix stale data" when the real problem is Next.js Data Cache, not React cache

**Phase to address:** React cache() + revalidation (Phase 20 — caching phase).

---

### Pitfall 8: RPC Over-Consolidation Creates an Unmaintainable Mega-Function

**What goes wrong:**
The owner layout makes 8 DB calls. The reflex is to consolidate ALL of them into a single `get_owner_dashboard_data()` RPC that returns every piece of data in one JSON blob. When a new feature adds a new data point, the only way to include it is to modify this central function. When one part of the dashboard fails to render, the entire layout's data is unavailable. The function becomes a 200-line SQL function that nobody wants to touch. Error handling is also harder: if the function errors, you lose all 8 data points at once.

**Why it happens:**
The optimization target is "fewer round trips." Zero-to-one round trip feels like the obvious solution — just put everything in one function. The operational cost of that consolidation is not visible during development.

**How to avoid:**
Consolidate by logical group, not by "one function for all." Split into two RPCs along the owner dashboard's natural data boundaries:
- `get_owner_stats()` → platform-wide counts (total students, coaches, active today) — changes rarely, same shape every load
- `get_owner_alerts()` → alert badges (inactive students, unreviewed reports) — changes frequently, separate revalidation lifecycle

Run both in parallel with `Promise.all([getOwnerStats(), getOwnerAlerts()])` — 2 round trips instead of 8, but each function is independently deployable and testable. Set clear return type contracts in TypeScript. Never create a function whose signature contains more than 5-6 distinct data domains.

**Warning signs:**
- A single RPC function has more than 8 JOIN operations
- Adding a new dashboard widget requires modifying a shared RPC function
- The function's TypeScript return type is a deeply nested object with optional fields added over time

**Phase to address:** RPC consolidation (Phase 20 — dashboard caching and RPC phase).

---

### Pitfall 9: PostgREST Uses Constraints, Not Indexes, for Upsert — Different from Direct Postgres

**What goes wrong:**
PostgREST's upsert (`supabase.from('table').upsert(...)`) requires an explicit unique index or unique constraint to detect conflicts. PostgREST does NOT support passing the conflict column name the same way direct Postgres INSERT ... ON CONFLICT (column) does. If the unique constraint and the unique index are different objects on the same column, PostgREST may not use the index for conflict detection — it defers to the constraint. Additionally, composite indexes created without a corresponding composite UNIQUE constraint will not be used by PostgREST for upsert conflict resolution.

**Why it happens:**
PostgREST is a REST layer over Postgres, not a Postgres client. It translates HTTP operations to SQL but uses a specific subset of Postgres features. Composite unique indexes work for conflict detection in direct SQL but may behave differently when PostgREST constructs the INSERT statement. This is a PostgREST-specific behavior not present when using the Postgres JS driver directly.

**How to avoid:**
For any table used with PostgREST upsert, create BOTH a UNIQUE constraint AND an index:
```sql
-- For pg_cron summary table upsert:
ALTER TABLE daily_kpi_summaries ADD CONSTRAINT daily_kpi_summaries_student_date_unique
  UNIQUE (student_id, report_date);
-- The constraint implicitly creates a unique index
```
Do not rely on a unique index alone for PostgREST upsert — add the explicit constraint. Verify upsert behavior with `.explain()` on the Supabase client to see the actual query generated.

**Warning signs:**
- Upsert creates duplicate rows instead of updating existing ones
- HTTP 409 Conflict responses from upsert when no duplicate should exist
- `EXPLAIN` shows the query using a different index than expected

**Phase to address:** pg_cron pre-aggregation (Phase 21) — the summary table for KPI aggregates will use upsert patterns.

---

### Pitfall 10: PostgREST Pool Size Capped at 40% of Max Connections — Ignored During Index Phase

**What goes wrong:**
Supabase official docs state: "if you are heavily using the PostgREST database API, you should be conscientious about raising your pool size past 40% of the Database Max Connections." The current app uses PostgREST for all queries. Adding indexes and RPC functions increases query throughput, which increases concurrent connection demand from PostgREST's internal pool. If the pool ceiling was not explicitly configured during setup, it defaults to a conservative value. Under the 11 PM write spike, PostgREST may queue requests internally, causing latency increases that look like "slow queries" but are actually connection wait time.

**Why it happens:**
PostgREST maintains its own connection pool to Postgres. This pool size is configured separately from application-level connection pooling (Supavisor). Increasing query throughput (via indexes and RPCs) without reviewing PostgREST pool settings creates a throughput ceiling at the PostgREST layer before Postgres itself becomes saturated.

**How to avoid:**
During the performance baseline phase, check the PostgREST pool configuration in the Supabase dashboard (Database Settings → Connection Pooling). For a Pro plan database, PostgREST should be allocated ~40% of max_connections. Monitor both Postgres connections AND PostgREST queue depth during load testing. If response times are high but CPU/memory are low, the bottleneck is likely the connection queue, not query execution.

**Warning signs:**
- Load test shows p95 response time >> p50 (connection queuing, not slow queries)
- `EXPLAIN ANALYZE` shows fast queries (2-5ms) but actual HTTP response time is 200ms+
- Supabase dashboard shows connections near max during spike but CPU is below 30%

**Phase to address:** Infrastructure validation (Phase 24 — load testing phase); configure during Phase 19 baseline.

---

### Pitfall 11: Admin Client Bypasses RLS — Service Role Key Exposes Cross-Student Data

**What goes wrong:**
The current codebase uses `createAdminClient()` (service_role key) in ALL server-side queries — by design per CLAUDE.md architecture note. The service role key bypasses RLS entirely. If any API route or server component passes a `student_id` from a URL parameter or request body without re-verifying that the authenticated user is that student (or is an authorized coach/owner), any student can read or modify another student's data by supplying a different `student_id` in the request. The RLS safety net that would normally prevent this does not exist with the admin client.

**Why it happens:**
The admin client is used for "defense in depth" — application-level filtering is supposed to enforce access control. But this requires EVERY query to include the appropriate `WHERE user_id = authenticatedUserId` clause. If even one route omits this check (e.g., `GET /api/reports/[id]` that looks up by report ID without verifying ownership), the data is exposed.

**How to avoid:**
During the security audit phase, audit every API route and server component for three things:
1. Auth check first: `const user = await requireRole("student")` before any DB operation
2. Every query filters by the authenticated user's ID: `.eq("student_id", user.id)`, not `.eq("student_id", params.studentId)` from URL params alone
3. For coach/owner access to student data: verify the relationship (`WHERE coach_id = authenticatedCoachId`) before exposing student data

Add an explicit note to the security audit checklist: "Service role client used — RLS not enforced — application code is the only gate."

**Warning signs:**
- API route reads `studentId` from URL params and uses it directly in DB query without cross-checking against `auth.user.id`
- A logged-in student can access `/api/reports/[otherstudentReportId]` and receive HTTP 200 with data
- Routes missing the `requireRole()` call at the top

**Phase to address:** Security audit (Phase 23 — security audit phase).

---

### Pitfall 12: Route Handler CSRF Protection Is Not Automatic — Only Server Actions Get It

**What goes wrong:**
This app uses Next.js API route handlers (`src/app/api/*/route.ts`), NOT Server Actions. Server Actions in Next.js 14+ get automatic CSRF protection via Origin header comparison. Route handlers do NOT get this protection. A malicious website can send a POST request to `/api/reports/[id]/review` from a logged-in coach's browser. If the coach's authentication cookie is `SameSite=Lax` (Next.js Supabase auth default), cross-site POST requests from a foreign origin WILL include the auth cookie on modern browsers.

**Why it happens:**
The Next.js security documentation clearly states: "When Custom Route Handlers (route.tsx) are used instead, extra auditing can be necessary since CSRF protection has to be done manually there. The traditional rules apply there." This app uses route handlers for all mutations. Most security tutorials demonstrate CSRF via Server Actions (which are protected) — developers assume the same applies to route handlers.

**How to avoid:**
Add CSRF protection to all mutation route handlers (POST, PATCH, DELETE):
```typescript
// In each mutation handler:
export async function POST(request: Request) {
  // CSRF check: verify Origin or use custom header
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !origin.includes(host ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // ... rest of handler
}
```
Alternative: Require a custom request header (`X-Requested-With: XMLHttpRequest`) on all mutation fetch calls from the client. Cross-site form submissions cannot set custom headers; JavaScript fetch calls from the same origin can. Note: this does NOT replace auth checks — it adds a second layer.

**Warning signs:**
- Mutation route handlers have no Origin header check
- All POST/PATCH/DELETE routes rely solely on cookie authentication with no secondary verification
- Security audit finds that visiting a malicious URL while logged in can trigger coach/owner mutations

**Phase to address:** Security audit (Phase 23).

---

### Pitfall 13: Pagination count: 'exact' Causes Full Table Scans at Scale

**What goes wrong:**
The default Supabase pagination pattern uses `.range(from, to)` with `{ count: 'exact' }`. The `exact` count runs a `SELECT COUNT(*)` over the entire filtered result set — not just the current page. On `daily_reports` with 900,000 rows for 5,000 students, a coach querying "all unreviewed reports" triggers a full scan for every page change. The count itself can take 500ms+, negating all pagination performance benefits. The total count display ("Showing 1-25 of 847") becomes a performance bottleneck.

**Why it happens:**
`{ count: 'exact' }` is the default example in Supabase documentation. It looks like a minor option flag. The performance implication is only visible when the table is large and the filter matches many rows.

**How to avoid:**
Use `{ count: 'estimated' }` for large tables — it uses Postgres statistics and is O(1) regardless of table size. The estimated count is accurate to within ~10% for normally distributed data. For pagination UI, "approximately 847 results" is acceptable. The off-by-one issue in Supabase's range is: `.range(0, 24)` returns 25 rows (0-based inclusive). `.range(from, from + pageSize - 1)` is the correct formula. Always include an `.order()` clause — without explicit ordering, page N may contain different rows on different requests as Postgres returns rows in an undefined order.

**Warning signs:**
- Pagination loads fast on the first page but slows progressively on deeper pages
- Coach dashboard takes 800ms+ to load report lists
- `EXPLAIN ANALYZE` on paginated query shows `Seq Scan` with a row count equal to the full filtered set (not just the page size)

**Phase to address:** Server-side pagination (Phase 20 — dashboard optimization phase).

---

### Pitfall 14: Load Testing Supabase Triggers Auth Rate Limits on Test Accounts

**What goes wrong:**
Load testing with k6 or similar tools that authenticate via Supabase Auth triggers the auth endpoint rate limits. Supabase Auth enforces rate limits per IP and per email on `/auth/v1/token`, `/auth/v1/signup`, and session refresh endpoints. A load test that creates fresh sessions for each virtual user hits these limits quickly and starts receiving 429 responses — not from the application under test, but from the Auth service. The test results show failures and latency that do not reflect real application behavior, leading to incorrect capacity conclusions.

**Why it happens:**
Auth rate limits exist at the Supabase infrastructure layer, not at the application layer. Load tests that simulate login flows will hit these limits regardless of application performance. Test frameworks retry 429s, masking the real issue in summary statistics.

**How to avoid:**
Create JWT tokens for load testing using the service_role key directly, bypassing the Auth login flow:
```typescript
// Supabase allows creating JWT tokens for testing with the service role secret
// OR: Pre-create sessions and reuse static bearer tokens for all test virtual users
```
Alternatively, create one session per test user type (one "student" session, one "coach" session, one "owner" session) and reuse the JWT across all virtual users of that type. The goal is to load test the API routes and database, not the Auth service. Document the test methodology clearly: "load testing API layer with pre-authenticated static tokens."

**Warning signs:**
- k6 results show >5% error rate on HTTP 429 responses
- Error rate correlates with virtual user count, not request rate
- Test failures reference `/auth/v1/` URLs, not application API URLs

**Phase to address:** Infrastructure validation (Phase 24 — load testing phase).

---

### Pitfall 15: Optimistic UI Rollback Leaves Duplicate Submission State

**What goes wrong:**
On student daily report submission, the optimistic update immediately shows the report as submitted. The actual API call fails (network error, 500, validation error). The rollback restores the "not submitted" state. But if the student pressed submit twice (double-tap, network delay), two optimistic updates may have fired. The rollback logic only reverts the most recent snapshot. The UI shows the report as submitted (from the first optimistic update that was not rolled back) even though neither API call succeeded. State diverges from reality silently — no error is displayed.

**Why it happens:**
React 19's `useOptimistic()` hook rolls back to the pre-update state on error. If two overlapping updates fire, the rollback point for the second update may be the already-optimistically-updated state from the first, not the original server state. The window of inconsistency is especially dangerous when the user navigates away and comes back — the router cache shows the optimistic state.

**How to avoid:**
Disable the submit button after first click (set `isSubmitting: true`) until the API call resolves. This eliminates double-submission entirely. Use `useOptimistic()` with a request identity pattern — tag each mutation with a UUID; only the response matching the most recent UUID commits state. On any failure: call `router.refresh()` to force a server re-render that replaces all optimistic state with ground truth data from the database. Never rely purely on client-side rollback for critical state like report submission.

**Warning signs:**
- Student reports page shows "submitted" but Supabase database has no row for today's report
- Double-tap on submit button creates duplicate entries OR shows submitted incorrectly
- After a failed submission, refresh shows different state than the pre-refresh UI

**Phase to address:** Optimistic UI (Phase 21 — optimistic UI phase).

---

### Pitfall 16: Missing Composite Index Column Ordering Kills Multi-Column Query Performance

**What goes wrong:**
A composite index on `(student_id, date)` is created to optimize "get this student's reports for a date range." But if a query filters by `date` alone (e.g., "all reports submitted today across all students"), the composite index `(student_id, date)` is NOT used — because Postgres B-tree indexes can only use a prefix of the index columns. The query falls back to a full table scan. Conversely, an index on `(date, student_id)` is used for "all reports today" but not efficiently for "this student's reports by date."

**Why it happens:**
Composite index design requires knowing the actual query patterns at index creation time. Developers often create indexes based on table structure ("these columns are related") rather than query patterns ("this is the WHERE clause order"). PostgREST translates the Supabase JS query to SQL and applies filters in a platform-specific order that may not match the index column order.

**How to avoid:**
Before creating indexes, enumerate the actual queries using the tables:
1. `WHERE student_id = $1 AND date >= $2 ORDER BY date DESC` → index on `(student_id, date)`
2. `WHERE date = $1` → separate index on `(date)` alone OR include as second column if student_id always present
3. `WHERE coach_id = $1` on users table → index on `(coach_id)` for coach dashboard student lists

Create separate targeted indexes rather than one composite that tries to cover multiple query shapes. Run `EXPLAIN ANALYZE` on the top 5 slowest queries (from slow query log) to verify each uses an index scan, not a sequential scan.

**Warning signs:**
- `EXPLAIN ANALYZE` shows `Seq Scan` on a table that has a composite index
- Index exists but is never shown in `pg_stat_user_indexes.idx_scan` counter
- Query is fast for "specific student" but slow for "all students today" using the same index

**Phase to address:** Database indexes (Phase 19 — indexes and monitoring phase).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Per-call `createAdminClient()` | Simpler code, no singleton management | Connection exhaustion under load | Never in production |
| In-memory rate limiting | No external dependency | Zero protection in serverless | Development/testing only |
| `count: 'exact'` on paginated queries | Accurate "showing X of Y" | Full table scan on every page change | Tables < 10,000 rows |
| Single mega-RPC for dashboard | Fewest round trips | Unmaintainable, all-or-nothing failures | Never — use logical groupings |
| Optimistic UI without disable-on-submit | Perceived speed | Duplicate submission risk on slow networks | Never on write-once operations (report submission) |
| Skipping advisory lock on pg_cron job | Simpler function | Overlapping runs corrupt summary data | Never |
| `export const revalidate = 60` on Supabase JS pages | Looks like caching | Has no effect — Supabase JS bypasses Next.js Data Cache | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase + Next.js serverless | Module-level singleton for auth-aware client | Module-level singleton for admin client; `cache()` wrapper for auth-aware client |
| Supabase + PostgREST upsert | Unique index only | Unique CONSTRAINT (which creates an index) for PostgREST conflict detection |
| Supabase RLS + admin client | Trust RLS for access control when using admin client | Application-level filtering is the ONLY gate when using admin client |
| pg_cron + Supabase | Assume schedule time is local timezone | All cron expressions are UTC — document local-time intent in comments |
| Next.js route handlers + CSRF | Assume Server Action CSRF protection applies | Route handlers have NO automatic CSRF protection — add Origin header check manually |
| React cache() + Supabase JS | Expect cross-request data caching | cache() is per-request dedup only; Supabase JS bypasses Next.js Data Cache |
| k6 load test + Supabase | Authenticate per virtual user during test | Pre-create static JWT tokens; load test API layer, not Auth layer |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-request admin client instantiation | Connection exhaustion at >50 concurrent requests | Module-level singleton for service_role client | ~50 concurrent users (Pro plan limit) |
| auth.uid() in RLS without initplan | Sequential scan on all tables; 10-100x query slowdown | `(SELECT auth.uid())` wrapper in all policies | Tables > 50,000 rows |
| In-memory rate limiting | No protection; all requests succeed in production | Database-backed rate limits table | Any serverless deployment (0 concurrent instances needed) |
| Pagination with count: 'exact' | 500ms+ page loads on report lists | count: 'estimated' for large tables | Tables > 100,000 rows with complex filters |
| 8 sequential layout DB calls | Owner dashboard takes 1-2 seconds to load | `Promise.all()` for parallel + RPC consolidation | Cumulative at launch with any users |
| Missing composite index column order | Query ignores index; sequential scan on filtered data | Index column order matches WHERE clause left-to-right | Tables > 10,000 rows |
| pg_cron without overlap protection | Double-counted aggregates in summary tables | Advisory lock guard in aggregation function | When job duration > schedule interval |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin client used without user ID filter in queries | Cross-student data exposure — any user reads any student's data | Every query with admin client must include `.eq("student_id", authenticatedUser.id)` |
| Route handler mutations without CSRF check | CSRF attack — attacker triggers mutations on behalf of logged-in users | Origin header check on all POST/PATCH/DELETE handlers |
| `studentId` taken from URL params without ownership verification | IDOR — student A reads student B's data via URL manipulation | Verify ownership: `WHERE id = urlParam AND student_id = auth.user.id` |
| Service_role key in client component or NEXT_PUBLIC_ env | Complete RLS bypass exposed to browser; all data readable/writable | Audit all `NEXT_PUBLIC_SUPABASE_` env vars — never expose service_role key |
| pg_cron function accessible via PostgREST | Aggregation job can be triggered on demand via REST call | Aggregation functions should be `SECURITY DEFINER` and NOT exposed via PostgREST schema |
| Rate limit bypass via distributed serverless | Abuse of report submission API | Database-backed rate limits, not in-memory |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Submit button not disabled during optimistic update | Student double-submits report; confusing state | Disable button immediately on first click; re-enable only on error |
| Rate limit error shown as generic 500 | Student thinks the system is broken, not that they're rate-limited | Return HTTP 429 with a human-readable message: "Too many requests. Try again in X seconds." |
| Pagination without stable ordering | Student sees same report on page 1 and page 2 | Always include `.order('created_at', { ascending: false })` before `.range()` |
| Summary table shows data from before 11 PM deadline | KPI summary for "today" doesn't include late submissions | Schedule nightly aggregation AFTER the latest expected submission, not at midnight |
| Owner dashboard "loading" for 1-2 seconds on every nav | Owner feels the app is slow; avoids using dashboard | RPC consolidation + parallel loading cuts this to <300ms |

---

## "Looks Done But Isn't" Checklist

- [ ] **Admin client singleton:** Verify the singleton is at module level and the same instance is returned across calls — check with a request counter log in development
- [ ] **RLS initplan:** Run Supabase advisor and confirm zero `auth_rls_initplan` violations after adding indexes
- [ ] **Rate limiting:** Verify via load test that a single user is blocked after 30 req/min even with 10 Lambda instances handling the requests
- [ ] **pg_cron timezone:** Query `cron.job` and confirm scheduled time × UTC offset = intended local execution time
- [ ] **pg_cron overlap:** Manually run the aggregation function twice simultaneously (via two psql sessions) and confirm only one executes
- [ ] **CSRF on route handlers:** Confirm that a cross-origin POST to a mutation endpoint returns 403, not 200
- [ ] **Cross-student isolation:** As a student, attempt to GET another student's report by ID — confirm 404 or 403, not 200
- [ ] **Pagination count:** Load the coach student list with >100 students and confirm page 2 loads in <200ms
- [ ] **Composite index order:** Run `EXPLAIN ANALYZE` on the top 3 query patterns and confirm `Index Scan` (not `Seq Scan`) in output
- [ ] **Optimistic UI:** Simulate network failure during report submit — confirm rollback, error toast, and correct state after refresh

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Connection exhaustion in production | HIGH | Emergency: restart Next.js deploy to kill warm Lambda pool; apply singleton fix; redeploy immediately |
| In-memory rate limiter shipped to production | MEDIUM | Deploy database-backed rate limit table + new handler logic; no data migration needed |
| pg_cron double-counted aggregates | MEDIUM | Delete and recalculate affected summary rows; fix function with advisory lock; verify via manual reconciliation against source tables |
| RLS initplan violations causing slow queries | LOW | Apply migration updating policy syntax; no data changes; immediate effect after migration |
| CSRF vulnerability discovered in security audit | MEDIUM | Add Origin header checks to all route handlers; deploy as hotfix; no data migration |
| Cross-student data exposure via missing user_id filter | HIGH | Audit all routes immediately; add missing filters; rotate Supabase service_role key if exposure confirmed |
| Optimistic UI duplicate report submissions | LOW | One-time migration to deduplicate reports by (student_id, date); add submit button disable logic |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Per-call admin client connection exhaustion | Phase 19 — Admin singleton | Connection count stays flat during simulated burst; no `FATAL: too many connections` |
| createServerClient singleton scope error | Phase 19 — Admin singleton | No `cookies called outside request scope` errors in production logs |
| In-memory rate limiting broken in serverless | Phase 22 — Rate limiting | Load test with 10+ concurrent VUs: single user is rate-limited at 30 req/min |
| RLS auth.uid() per-row causing sequential scans | Phase 19 — Indexes + RLS audit | Supabase advisor shows zero `auth_rls_initplan` violations |
| pg_cron timezone offset | Phase 21 — pg_cron aggregation | `cron.job_run_details` shows executions at correct UTC time |
| pg_cron overlapping runs | Phase 21 — pg_cron aggregation | Double manual execution produces no duplicate data in summary tables |
| React cache() cross-request stale data confusion | Phase 20 — Caching + RPC | Dashboard reflects mutations within one navigation cycle |
| RPC over-consolidation | Phase 20 — Caching + RPC | Each RPC covers exactly one logical domain; can be modified independently |
| PostgREST upsert + constraint vs index | Phase 21 — pg_cron aggregation | Summary table upsert creates no duplicate rows under concurrent load |
| PostgREST pool ceiling | Phase 19 baseline + Phase 24 load test | p95 response time < 500ms with 200 concurrent users |
| Admin client bypasses RLS — no user filter | Phase 23 — Security audit | Cross-student data access test returns 403; audit checklist complete |
| Route handler CSRF protection gap | Phase 23 — Security audit | Cross-origin POST returns 403 |
| Pagination count: 'exact' table scan | Phase 20 — Dashboard optimization | Coach report list page 2 loads in <200ms with 5,000 students |
| Load test triggering Auth rate limits | Phase 24 — Load testing | Test uses static JWT; zero HTTP 429 responses in k6 results |
| Optimistic UI duplicate submission | Phase 21 — Optimistic UI | Double-tap on submit: one report created, one error shown |
| Composite index wrong column order | Phase 19 — Indexes | `EXPLAIN ANALYZE` shows `Index Scan` on top 5 slow query paths |

---

## Sources

- [Supabase Connection Management Docs](https://supabase.com/docs/guides/database/connection-management) — PostgREST 40% pool limit guidance
- [Supabase Singleton Discussion #26936](https://github.com/orgs/supabase/discussions/26936) — cookies scope error with createServerClient singleton
- [Supabase Service Role in Next.js Discussion #30739](https://github.com/orgs/supabase/discussions/30739) — admin client configuration, persistSession: false
- [Supabase RLS Performance — auth_rls_initplan lint](https://supabase.com/docs/guides/database/database-advisors) — per-row auth.uid() evaluation
- [Supabase pg_cron Docs](https://supabase.com/docs/guides/cron) — UTC scheduling, max 8 concurrent jobs, 10 min limit
- [Supabase pg_cron Timezone Discussion #7892](https://github.com/orgs/supabase/discussions/7892) — timezone offset UTC-only behavior
- [PostgREST Functions as RPC Docs](https://docs.postgrest.org/en/stable/references/api/functions.html) — constraint vs index for upsert
- [Next.js Security: Server Components and Actions](https://nextjs.org/blog/security-nextjs-server-components-actions) — CSRF protection scope (Server Actions only), route handler manual CSRF requirement
- [Next.js Caching Guide](https://nextjs.org/docs/app/building-your-application/caching) — React cache() per-request scope, Data Cache fetch-only
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html) — pg_try_advisory_lock() for overlap prevention
- [NeedThisDone: Supabase Connection Pooling](https://needthisdone.com/blog/supabase-connection-pooling-production-nextjs) — 60 per-call connections vs 15-20 with singleton
- [React 19 useOptimistic Deep Dive](https://dev.to/a1guy/react-19-useoptimistic-deep-dive-building-instant-resilient-and-user-friendly-uis-49fp) — rollback state inconsistency, request identity pattern
- [Supabase Index Advisor Docs](https://supabase.com/docs/guides/database/extensions/index_advisor) — composite index guidance

---
*Pitfalls research for: IMA Accelerator v1.2 — performance optimization and security hardening on existing Next.js 16 + Supabase platform*
*Researched: 2026-03-29*
