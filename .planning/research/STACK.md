# Stack Research

**Domain:** Coaching / student performance management platform
**Researched:** 2026-03-27 (v1.1 update — new features only), 2026-03-29 (v1.2 update — performance, scale, security)
**Confidence:** HIGH — versions verified against npm, official changelogs, and official docs

---

## v1.2 Additions (Performance, Scale & Security)

The validated v1.0 and v1.1 stacks remain unchanged. This section documents what is **added** for performance monitoring, query consolidation, caching, rate limiting, load testing, and security hardening.

---

### New Dependencies

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| lru-cache | ^11.0.0 | In-memory sliding-window rate limiter store | Current stable is 11.2.7 (2026-03). Written in TypeScript natively — no separate `@types/`. LRU eviction ensures the store never grows unbounded. TTL support built-in. Used to build a per-user request counter that auto-expires after the rate-limit window. No external service required. Works correctly with Next.js module-level singleton pattern. |

`lru-cache` is the **only new npm dependency** for v1.2. Everything else is either a Supabase Platform feature (pg_cron, pg_stat_statements), a Next.js 16 built-in (React `cache()`, `use cache` directive, `revalidatePath`), or a standalone CLI tool (k6).

---

### No New Libraries Needed For

| Capability | Approach | Why No New Library |
|-----------|----------|-------------------|
| React cache() deduplication | `import { cache } from "react"` — built into React 19 | Deduplicates identical Supabase queries within a single render pass (one request). No library needed. Use this for any async function that may be called by multiple Server Components in the same tree. |
| Next.js `use cache` directive + `cacheLife` + `cacheTag` | Built into Next.js 16 when `cacheComponents: true` in `next.config.ts` | The new unified caching primitive introduced in Next.js 15/16. Replaces `unstable_cache`. Wraps data-fetch functions or entire components. `cacheLife('hours')` sets TTL. `cacheTag('dashboard-owner')` enables targeted invalidation via `revalidateTag()`. Requires opt-in via `next.config.ts`. |
| Route-level cache invalidation | `revalidatePath()` / `revalidateTag()` from `"next/cache"` | Built into Next.js. Call from Server Actions or API routes after mutations. `revalidatePath('/dashboard/owner')` clears the cached render for that route. No library. |
| pg_cron nightly pre-aggregation | Supabase platform extension — enable via Dashboard → Database → Extensions → pg_cron | Pre-aggregates KPI summaries nightly. Version 1.6.4 on Supabase. `SELECT cron.schedule('job-name', '0 23 * * *', $$INSERT INTO kpi_snapshots ... SELECT ... FROM daily_reports$$)` syntax. Wrapped in a transaction automatically. Max 8 concurrent jobs; keep under 10 min per job. No npm package needed. |
| pg_stat_statements query monitoring | Supabase platform extension — enable via Dashboard → Database → Extensions → pg_stat_statements | Already available on Supabase Pro. Query `pg_stat_statements` view in SQL Editor to find slow queries: `SELECT query, calls, mean_exec_time FROM pg_stat_statements WHERE calls > 50 AND mean_exec_time > 2.0 ORDER BY total_exec_time DESC LIMIT 10`. No npm package needed. |
| Supabase RPC (stored procedures) | `supabase.rpc('function_name', { arg1: value })` — part of `@supabase/supabase-js` already installed | Consolidates N round trips into 1. Define a `SECURITY DEFINER` Postgres function that JOINs or aggregates across tables and returns a JSON object. Called from Server Components using the existing admin client. PostgREST wraps each `rpc()` in a transaction. No new library. |
| Optimistic UI (report submission) | React's `useOptimistic` hook — built into React 19 | Updates UI immediately before the API round trip completes. Roll back on failure. No library needed. |
| Security headers | `next.config.ts` `headers()` function — built into Next.js | Add CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy in the Next.js config response headers. No library needed (though `nosecone` is an option if headers become complex). |
| Load testing | k6 v1.7.0 — standalone CLI tool, install via Homebrew/package manager | `brew install k6` or `choco install k6`. Write JS test scripts in `.load-tests/` directory. Not an npm dependency — runs as a separate process against the deployed URL. Produces P95/P99 latency, throughput, and error rate metrics. |

---

### Rate Limiting Architecture (API Routes)

**Approach: In-memory sliding window with `lru-cache`**

This is an invite-only platform with a known small user base (the 5k target is a *load test scenario*, not the current active count). In-memory rate limiting in a module-level singleton is correct for this deployment profile.

**Why not Redis/Upstash:** The PROJECT.md explicitly defers Redis to "evaluate only if Phase 24 load testing proves Next.js cache insufficient." Single-instance Next.js on Vercel (or any single host) keeps the in-memory store consistent across requests on the same worker. At the scale of this platform, in-memory is sufficient and avoids adding an external service dependency.

**Implementation pattern:**

```typescript
// src/lib/rate-limit.ts
import { LRUCache } from "lru-cache"

type RateLimitEntry = { count: number; windowStart: number }

// Module-level singleton — persists across requests on the same Node.js worker
const rateLimitStore = new LRUCache<string, RateLimitEntry>({
  max: 5000,          // max number of unique users tracked
  ttl: 60 * 1000,    // 60-second TTL — auto-evict stale entries
})

const WINDOW_MS = 60 * 1000  // 1 minute window
const MAX_REQUESTS = 30       // 30 req/min/user

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitStore.set(userId, { count: 1, windowStart: now })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  rateLimitStore.set(userId, { count: entry.count + 1, windowStart: entry.windowStart })
  return { allowed: true, remaining: MAX_REQUESTS - entry.count - 1 }
}
```

**Integration point:** Call `checkRateLimit(user.id)` at the start of every API route handler, *after* the auth check but *before* business logic. Return 429 with `Retry-After` header on rejection.

---

### Supabase RPC Consolidation Pattern

**Problem:** Owner dashboard currently makes 8+ individual `.from()` queries to render the stats page. Each is a separate HTTP round trip through PostgREST.

**Solution:** Define a `SECURITY DEFINER` Postgres function that aggregates all owner dashboard data in a single query and returns a typed JSON object. Call it with `supabase.rpc()`.

```sql
-- In a Supabase migration file
CREATE OR REPLACE FUNCTION get_owner_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_students', (SELECT count(*) FROM users WHERE role = 'student'),
    'total_coaches',  (SELECT count(*) FROM users WHERE role = 'coach'),
    'active_today',   (SELECT count(DISTINCT user_id) FROM work_sessions
                       WHERE date_trunc('day', started_at) = date_trunc('day', now())),
    'reports_today',  (SELECT count(*) FROM daily_reports
                       WHERE created_at::date = now()::date)
    -- ... additional aggregates
  ) INTO result;
  RETURN result;
END;
$$;
```

**Client call:**

```typescript
// Server Component
const { data, error } = await adminClient.rpc('get_owner_dashboard_stats')
```

PostgREST wraps the entire function call in a transaction. The 8 sub-queries inside execute on the database server without network round trips between them, reducing latency from ~8 * N ms to ~1 * N ms.

---

### pg_cron Pre-Aggregation Pattern

**When to use:** Dashboard queries that aggregate over all daily_reports or work_sessions across all students are expensive. Pre-aggregate nightly into a summary table so dashboard reads hit pre-computed rows instead of scanning raw data.

**Setup:** Enable via Supabase Dashboard → Database → Extensions → pg_cron. Version 1.6.4.

```sql
-- Create summary table (one-time migration)
CREATE TABLE IF NOT EXISTS public.kpi_daily_snapshots (
  snapshot_date  date NOT NULL,
  total_reports  integer NOT NULL DEFAULT 0,
  avg_star_rating numeric(3,2),
  total_hours    numeric(10,2),
  PRIMARY KEY (snapshot_date)
);

-- Schedule nightly job at 11:30 PM UTC (after the 11 PM write spike)
SELECT cron.schedule(
  'nightly-kpi-snapshot',
  '30 23 * * *',
  $$
  INSERT INTO public.kpi_daily_snapshots (snapshot_date, total_reports, avg_star_rating, total_hours)
  SELECT
    created_at::date,
    count(*),
    avg(star_rating),
    sum(hours_worked)
  FROM public.daily_reports
  WHERE created_at::date = (now() - interval '1 day')::date
  GROUP BY created_at::date
  ON CONFLICT (snapshot_date) DO UPDATE
    SET total_reports  = EXCLUDED.total_reports,
        avg_star_rating = EXCLUDED.avg_star_rating,
        total_hours    = EXCLUDED.total_hours
  $$
);
```

**Constraints:** Max 8 concurrent pg_cron jobs. Each job must complete within 10 minutes. For the scale of this platform (hundreds to low thousands of daily_reports rows), the nightly aggregation will complete in milliseconds.

---

### React `cache()` + `use cache` Deduplication Pattern

Next.js 16 provides two caching mechanisms. Use both:

**`cache()` from React** — request-scoped deduplication (no library):

```typescript
// src/lib/queries/get-student-profile.ts
import { cache } from "react"
import { createAdminClient } from "@/lib/supabase/admin"

// If two Server Components in the same render tree call this with the same id,
// only one Supabase query executes.
export const getStudentProfile = cache(async (studentId: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from("users")
    .select("*")
    .eq("id", studentId)
    .single()
  return data
})
```

**`use cache` directive** — cross-request persistent caching (Next.js 16 built-in, requires `cacheComponents: true`):

```typescript
// Cache owner dashboard stats for 5 minutes; invalidate on mutation
import { cacheLife, cacheTag } from "next/cache"

export async function getOwnerDashboardStats() {
  "use cache"
  cacheLife("minutes")        // 5-minute stale time
  cacheTag("owner-dashboard") // invalidation key

  const admin = createAdminClient()
  // ... queries
}
```

**Invalidation after mutation:**

```typescript
// In API route handler after a write succeeds
import { revalidateTag } from "next/cache"
revalidateTag("owner-dashboard")
```

**Decision rule:**
- Use `cache()` when: same data is accessed by multiple Server Components in one request, data must be fresh per-request (user-specific), or `use cache` is not enabled.
- Use `use cache` when: data is shared across users (owner stats, platform-wide KPIs), acceptable to serve slightly stale data, or the computation is expensive enough to justify cross-request persistence.
- Use `revalidatePath()` when: you know exactly which page to invalidate after a mutation.
- Use `revalidateTag()` when: multiple pages share the same cached data and need simultaneous invalidation.

---

### Load Testing with k6

**Tool:** k6 v1.7.0 (latest as of 2026-03-25). Standalone CLI — not an npm package. Install on the machine running the test.

**Why k6 over alternatives:**
- Supabase themselves use k6 for their internal benchmarks
- JavaScript/TypeScript test scripts — familiar syntax for this stack
- Built-in `ramping-vus` executor exactly matches the "ramp to 5k users" scenario
- Outputs P50/P95/P99 latency, throughput (req/s), error rate — the metrics needed to validate infrastructure
- Free and open source with no cloud account required for local runs

**Installation (CI or developer machine):**

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Script structure for 5k concurrent user test:**

```javascript
// .load-tests/owner-dashboard.js
import http from "k6/http"
import { check, sleep } from "k6"

export const options = {
  stages: [
    { duration: "2m", target: 500  },   // ramp up
    { duration: "5m", target: 5000 },   // hold at 5k
    { duration: "2m", target: 0    },   // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],  // 95th percentile under 2s
    http_req_failed:   ["rate<0.01"],   // <1% error rate
  },
}

export default function () {
  const res = http.get("https://ima-accelerator.vercel.app/dashboard/owner", {
    headers: { Cookie: `sb-access-token=${__ENV.TEST_TOKEN}` },
  })
  check(res, { "status 200": (r) => r.status === 200 })
  sleep(1)
}
```

**Key metrics to capture:**
- `http_req_duration` (P50, P95, P99) — latency targets
- `http_req_failed` — error rate
- Supabase Dashboard → Reports → Database CPU and connection count during the test

---

### Security Hardening (No New Libraries)

**What to audit (all built-in, no library needed):**

1. **`server-only` import guard** — already installed (`server-only@^0.0.1`). Verify every file that imports `createAdminClient` has `import "server-only"` at the top. The package throws a build-time error if a server-only module is accidentally imported in a client bundle.

2. **RLS verification** — use Supabase SQL Editor to run test queries *as a student user* (using `SET ROLE authenticated; SET request.jwt.claim.sub = '<student-id>'`) and verify they cannot read other students' rows. No library needed.

3. **Auth + role check order in API routes** — audit that every route handler: (a) calls `getUser()`, (b) checks role, (c) validates input with Zod `safeParse`, (d) runs the query. Steps (a) and (b) must precede (c) and (d) on every route.

4. **CSRF protection** — Next.js App Router API routes using `POST` with `Content-Type: application/json` are not susceptible to classical form-based CSRF (browsers cannot set `Content-Type: application/json` in a cross-origin form). The auth cookie is `SameSite=Lax` (Supabase default). No CSRF library needed, but verify the cookie settings haven't been overridden.

5. **Security headers** — add to `next.config.ts` in the `headers()` async function. Minimum set:
   - `Content-Security-Policy` (restrict script/frame sources)
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=()`

6. **CVE-2025-29927 (middleware bypass)** — this project uses `proxy.ts` not `middleware.ts`, so it is NOT affected by the x-middleware-subrequest header injection CVE. The proxy pattern provides the same protection without the vulnerability.

7. **Cross-student data isolation** — audit every API route that accepts a student ID parameter to ensure it filters by the authenticated user's ID (or checks that the requester is a coach/owner with access to that student). RLS is defense-in-depth, not the only guard.

**Optional library (`nosecone`) for complex CSP:** If the Content-Security-Policy header grows complex, `nosecone` (from Arcjet) simplifies composition. Skip for v1.2 unless the CSP string exceeds 5+ directives.

---

### Admin Client Singleton Pattern

**Current issue (pre-v1.2):** Each API route may call `createAdminClient()` which instantiates a new `@supabase/supabase-js` client. This is wasteful — each client creates an HTTP pool.

**Fix (no new library):** Hoist the admin client to module scope.

```typescript
// src/lib/supabase/admin.ts
import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Module-level singleton — initialized once per Node.js worker process
const adminClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export function createAdminClient() {
  return adminClient  // returns the singleton, not a new instance
}
```

This pattern is safe because the admin client is stateless (no session stored between requests). Module-level initialization means it survives across multiple requests on the same Node.js worker.

---

## Installation

```bash
# v1.2 addition — only one new npm dependency
npm install lru-cache@^11.0.0

# k6 — standalone CLI, not npm
brew install k6          # macOS
# or: choco install k6   # Windows

# pg_cron, pg_stat_statements — Supabase Dashboard → Database → Extensions
# (no npm install needed)
```

---

## Alternatives Considered (v1.2)

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| In-memory rate limiting (lru-cache) | @upstash/ratelimit + Redis/Upstash | Adds an external service dependency and ~$10-20/month cost. Appropriate if load tests show multi-instance deployment needed. PROJECT.md explicitly defers Redis until after load tests. |
| In-memory rate limiting (lru-cache) | @vercel/kv | Vercel-specific. Locks platform choice. Same deferral rationale as Upstash. |
| React `cache()` + `use cache` | `unstable_cache` | `unstable_cache` is deprecated in Next.js 15+. `use cache` is the replacement. |
| k6 | Artillery | Both are solid. k6 is written in Go (low overhead), uses JS scripts, has better Supabase community precedent, and Grafana integration for metrics dashboards. |
| k6 | Locust | Python-based; TypeScript team will find k6's JS API more natural. |
| k6 | Apache JMeter | XML-based config, GUI-heavy, Java runtime. Overkill for a developer-run benchmark. |
| Postgres RPC functions | N+1 individual `.from()` queries | Each `.from()` is a separate HTTP round trip through PostgREST. At 8+ queries per page load, consolidation to 1-2 RPC calls has significant latency impact. |
| pg_cron aggregation | Supabase Edge Functions on schedule | Edge functions for aggregation require pg_net + HTTP invocation overhead. pg_cron runs pure SQL inside Postgres — faster, simpler, no extra billing. |

---

## What NOT to Add (v1.2)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Redis / Upstash | Adds external service, cost, and latency until load tests prove in-memory is insufficient. PROJECT.md explicit decision. | In-memory `lru-cache` rate limit store |
| Supavisor / PgBouncer | PostgREST already handles connection pooling. PROJECT.md explicit decision. | Existing PostgREST pool |
| `nosecone` security headers library | Adds a dependency for a `next.config.ts` `headers()` function that takes 20 lines. Bring in only if CSP grows complex. | `next.config.ts` `headers()` built-in |
| `express-rate-limit` | Designed for Express apps; requires wrapping Next.js route handlers in Express-compatible middleware adapter. Not idiomatic for App Router. | `lru-cache` + custom `checkRateLimit()` |
| `helmet` | Express/Node middleware for security headers. Not compatible with Next.js App Router's `headers()` config. | `next.config.ts` `headers()` |
| `artillery` | Redundant with k6. Two load testing tools in one project create confusion about canonical test suite. | k6 only |
| `@types/k6` | k6 ships its own TypeScript definitions via `@grafana/k6-types`. Install that if IDE type support needed for test scripts. | `npm install -D @grafana/k6-types` |

---

## Version Compatibility (v1.2 additions)

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| lru-cache@^11.0.0 | Node.js 18+, TypeScript ^5 | Written in TypeScript natively. No `@types/` package needed. ESM-first but ships CJS compat. TTL and `max` options supported. |
| `cache()` from react@19.2.3 | Next.js 16, TypeScript ^5 | Built-in. No install. Deduplicates within one render pass only (not cross-request). |
| `use cache` directive | Next.js 16.1.6 with `cacheComponents: true` | Requires opt-in in `next.config.ts`. Stable in Next.js 16. Replaces `unstable_cache`. |
| `revalidateTag` / `revalidatePath` | Next.js 16, must call from Server Actions or Route Handlers | Cannot call from Client Components. Import from `"next/cache"`. |
| pg_cron@1.6.4 | Supabase Pro plan | Available on Supabase hosted platform. Max 8 concurrent jobs. Enable via Dashboard. |
| pg_stat_statements | Supabase Pro plan | Enable via Dashboard → Extensions. Last 5,000 statements tracked. |
| k6@1.7.0 | Any OS (standalone binary) | Not an npm dependency. Run against deployed URL. Current as of 2026-03-25. |

---

## Stack Patterns (v1.2 specific)

**Rate limiting integration pattern:**

```typescript
// Every API route handler — after auth check, before business logic
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 2. Rate limit check (uses user.id as key)
  const { allowed, remaining } = checkRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    )
  }

  // 3. Zod validation
  // 4. Business logic
}
```

**Database index pattern (no library — pure SQL migration):**

```sql
-- Add indexes on high-traffic query paths
-- Only index columns used in WHERE clauses or JOINs

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_reports_user_date
  ON public.daily_reports (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_sessions_user_date
  ON public.work_sessions (user_id, started_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roadmap_progress_user
  ON public.roadmap_progress (user_id);
```

`CONCURRENTLY` prevents table locks during index creation. Safe to run on production without downtime.

---

## Sources

**v1.2 specific sources:**

- [lru-cache npm (11.2.7)](https://libraries.io/npm/lru-cache) — version 11.2.7 current, TypeScript-native confirmed (HIGH confidence)
- [Next.js 16 Caching docs](https://nextjs.org/docs/app/getting-started/caching) — `use cache` directive, `cacheLife`, `cacheTag`, `revalidateTag` patterns verified against live docs (version 16.2.1, updated 2026-03-25) (HIGH confidence)
- [Supabase JS rpc() reference](https://supabase.com/docs/reference/javascript/rpc) — `.rpc()` API confirmed, PostgREST wraps in transaction (HIGH confidence)
- [Supabase pg_cron docs](https://supabase.com/docs/guides/database/extensions/pg_cron) — version 1.6.4, schedule syntax, 8-job limit, 10-min execution limit (HIGH confidence)
- [Supabase Cron guide](https://supabase.com/docs/guides/cron) — Dashboard enablement path confirmed (HIGH confidence)
- [pg_stat_statements Supabase docs](https://supabase.com/docs/guides/database/extensions/pg_stat_statements) — slow query detection queries, enablement via Dashboard (HIGH confidence)
- [k6 GitHub releases](https://github.com/grafana/k6/releases) — v1.7.0 latest release, 2026-03-25 (HIGH confidence)
- [k6 documentation](https://grafana.com/docs/k6/latest/) — `ramping-vus` executor, `thresholds`, JS script API (HIGH confidence)
- [Arcjet Next.js security checklist](https://blog.arcjet.com/next-js-security-checklist/) — security headers, server-only pattern, auth audit checklist (MEDIUM confidence)
- WebSearch: CVE-2025-29927 middleware bypass — proxy.ts not affected, confirmed via multiple sources (MEDIUM confidence)
- WebSearch: pg_cron aggregation INSERT syntax — INSERT ... SELECT ... ON CONFLICT pattern confirmed via community examples (MEDIUM confidence)

---

## v1.1 Additions (New Feature Stack)

The validated v1.0 stack remains unchanged. This section documents what is **added** for flexible work sessions, KPI progress tracking, calendar view, and roadmap deadline features.

### New Library: react-day-picker

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-day-picker | ^9.14.0 | Month-grid calendar view | Actively maintained (v9.14.0 released 2026-02-26). Confirmed React 19 compatibility (fixed in 9.4.3). Relies on date-fns already in the project — no new peer dependency. WCAG 2.1 AA compliant out of the box. 24 swappable component slots via `components` prop including `DayButton` for custom day rendering (dot indicators for sessions/reports). Minimal CSS footprint — works with Tailwind. |

react-day-picker is the **only new dependency** needed for v1.1. Everything else is built from the existing stack.

### No New Libraries Needed For

| Feature | Approach | Why No New Library |
|---------|----------|-------------------|
| Circular progress (KPI rings) | SVG `<circle>` with `strokeDasharray` / `strokeDashoffset` + `motion.circle` for animation | `motion` is already installed at ^12.37.0. SVG path animation via `pathLength` is first-class in motion v12. No extra library. |
| Linear progress bars | `<div>` with Tailwind width utility + `motion.div` for animated fill | Already have motion + Tailwind. Native HTML progress or a simple div is sufficient. |
| Break countdown timer | `setInterval` in `useEffect` + state — same pattern as existing work session timer | The existing timer component already uses this pattern. No timer library needed. |
| Date arithmetic (deadlines, offsets) | `date-fns` functions already installed at ^4.1.0 | `differenceInDays`, `addDays`, `addWeeks`, `isBefore`, `isAfter`, `isSameDay`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `format` — all present in date-fns v4. |
| Supabase schema changes | SQL migrations with `ALTER TABLE … ADD COLUMN` | Standard Postgres DDL, no library needed. See migration patterns below. |

---

## Existing Stack (v1.0 — unchanged)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | Stable LTS release (Oct 2025). App Router + Server Components. Turbopack default bundler. Breaking: uses `proxy.ts` not `middleware.ts`. Node.js 20.9+ required. |
| React | 19.2.3 | UI rendering | Ships with Next.js 16. React 19.2 adds View Transitions and useEffectEvent. |
| TypeScript | ^5 (5.9.x) | Type safety | Next.js 16 requires TS 5.1+. Strict mode required. |
| Supabase (hosted) | — | Postgres + Auth + RLS | Managed Postgres with built-in Auth, RLS. Google OAuth first-class. |
| Tailwind CSS | ^4 (4.2.1) | Utility-first CSS | v4 stable since Jan 2025. CSS-first config via `@theme` directive. |

### Supabase Client Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @supabase/supabase-js | ^2.99.2 | Core Supabase client | Admin client (service role) in server-only contexts. |
| @supabase/ssr | ^0.9.0 | Cookie-based auth for SSR | `createServerClient` / `createBrowserClient` for App Router. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation | All API route inputs via `safeParse`. Import as `import { z } from "zod"` — never `"zod/v4"`. |
| react-hook-form | ^7.71.2 | Form state management | All multi-field forms. |
| class-variance-authority | ^0.7.1 | CVA variant system | All UI primitive components. |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes | Used in `cn()` utility. |
| clsx | ^2.1.1 | Conditional class builder | Used inside `cn()`. |
| lucide-react | ^0.576.0 | Icon set | Tree-shakable icon library. |
| date-fns | ^4.1.0 | Date formatting and arithmetic | Calendar grid, deadline computation, session timestamps. |
| recharts | ^3.7.0 | Data visualization | Owner analytics dashboard only. |
| server-only | ^0.0.1 | Import guard | Files with service role key. |
| motion | ^12.37.0 | Animation | UI transitions, circular progress rings, timer animations. |

---

## Installation

```bash
# v1.2 addition
npm install lru-cache@^11.0.0

# v1.1 addition
npm install react-day-picker@^9.14.0

# k6 (load testing CLI — not npm)
brew install k6   # macOS
# choco install k6  # Windows

# pg_cron + pg_stat_statements — enable via Supabase Dashboard → Database → Extensions
```

---

## Implementation Patterns for v1.1 Features

### 1. Calendar Month Grid

Use react-day-picker in read-only (non-interactive) display mode. No `selected` or `onSelect` props — just `month`, `onMonthChange`, and `components.DayButton` for custom day rendering.

```tsx
import { DayPicker } from "react-day-picker"

<DayPicker
  mode="default"
  month={currentMonth}
  onMonthChange={setCurrentMonth}
  components={{
    DayButton: CustomDayButton,  // adds dot indicators for sessions/reports
  }}
/>
```

The `CustomDayButton` component receives `props.day.date` — use `isSameDay` from date-fns to match against fetched session/report dates and render dot indicators.

Style overrides via `classNames` prop — map react-day-picker class names to ima-* Tailwind token classes (never hardcoded hex). The library ships with zero default CSS so Tailwind integration is clean.

### 2. Circular Progress Ring (KPI)

Build as a small Server-Component-safe primitive using SVG. No additional library.

```tsx
// Circumference formula: 2 * Math.PI * r
// strokeDashoffset = circumference * (1 - percentage / 100)
<svg viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-ima-border" strokeWidth="3" />
  <motion.circle
    cx="18" cy="18" r="15.9" fill="none"
    className="stroke-ima-primary"
    strokeWidth="3"
    strokeDasharray="100"
    animate={{ strokeDashoffset: 100 - percentage }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    strokeLinecap="round"
    transform="rotate(-90 18 18)"
  />
</svg>
```

The `motion` package's `motion.circle` provides the animated fill. Wrap in `motion-safe:` for accessibility per CLAUDE.md hard rules.

### 3. Break Countdown Timer

The existing work session timer pattern already uses `setInterval` + `useEffect`. Reuse the same pattern for inter-cycle break countdowns. No additional library.

```tsx
useEffect(() => {
  if (!breakActive) return
  const id = setInterval(() => {
    setSecondsLeft(s => {
      if (s <= 1) { clearInterval(id); onBreakComplete(); return 0 }
      return s - 1
    })
  }, 1000)
  return () => clearInterval(id)
}, [breakActive])
```

### 4. Date Deadline Computation

All deadline math uses date-fns functions already in the project:

```typescript
import { addDays, addWeeks, differenceInDays, isBefore, isAfter } from "date-fns"

// Compute target deadline for roadmap step relative to joined_at
const targetDate = addDays(joinedAt, stepOffsetDays)

// Determine status
const daysRemaining = differenceInDays(targetDate, today)
const status =
  daysRemaining < 0 ? "overdue" :
  daysRemaining <= 3 ? "due-soon" :
  "on-track"
```

### 5. Supabase Migration — ALTER TABLE ADD COLUMN

**Postgres 11+ behavior:** Adding a column with a constant (immutable) default does NOT rewrite the table — it is a metadata-only operation completing in ~1ms. Volatile defaults (e.g., `clock_timestamp()`) still require a full table rewrite.

Safe pattern for v1.1 schema additions:

```sql
-- Safe: constant default, no table rewrite (Postgres 11+)
ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer NOT NULL DEFAULT 45;

-- Safe: nullable, no default needed, no table rewrite
ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS break_duration_minutes integer;

-- Safe: constant string default
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS outreach_emails integer NOT NULL DEFAULT 0;
```

Avoid `clock_timestamp()` or `gen_random_uuid()` as defaults in `ADD COLUMN` — these are volatile and will trigger a full table rewrite.

Use `IF NOT EXISTS` in every `ADD COLUMN` so the migration is idempotent and safe to re-run.

**Migration file naming** — Supabase CLI requires `YYYYMMDDHHmmss_description.sql` format:

```
supabase/migrations/20260327120000_v1_1_schema_updates.sql
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| react-day-picker v9 | Build custom month grid from scratch | Custom grid is ~100 lines of date-fns logic plus keyboard navigation, accessibility, and internationalization. react-day-picker handles all of this with a tiny API surface. No new peer dependencies since date-fns is already installed. |
| react-day-picker v9 | FullCalendar / react-big-calendar | Both are heavyweight (FullCalendar ~150KB+ gzip, react-big-calendar requires moment.js or date-fns adapter). Over-engineered for a simple month-grid-with-dots view. |
| SVG circular progress | react-circular-progressbar | Additional dependency for functionality achievable in 15 lines of SVG + motion. Not worth the dependency cost. |
| SVG circular progress | daisyUI radial-progress | Project uses Tailwind v4 + ima-* tokens, not daisyUI. Mixing component frameworks creates token conflicts. |
| setInterval countdown | react-countdown / use-countdown | Additional dependency for a ~10-line `useEffect`. The existing timer component already uses this pattern — no new library is justified. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| FullCalendar / react-big-calendar | 150KB+ bundles, designed for event scheduling not simple read-only month grids | react-day-picker v9 with custom DayButton |
| react-circular-progressbar | Adds a dependency for functionality native to SVG + motion (already installed) | SVG `<circle>` with `strokeDashoffset` + `motion.circle` |
| date-fns-tz / @date-fns/tz | v1.1 features operate in local/server time only, no cross-timezone deadline displays needed | date-fns v4 base (already installed) |
| moment.js | Mutable, 72KB minified, deprecated in most modern projects | date-fns v4 (already installed, tree-shakable) |
| Any state management library (zustand, jotai) | Sticky progress banner and KPI state are local component state — no cross-component global state needed | React `useState` + `useReducer` in Server/Client Component boundaries |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-day-picker@^9.14.0 | react@19.2.3, date-fns@^4.1.0 | Confirmed React 19 compatible (fixed in 9.4.3). Uses date-fns as peer dependency — already installed. |
| motion@^12.37.0 | react@19.2.3, next@16.1.6 | motion v12 is rebranded framer-motion. SVG `motion.circle` + `pathLength` fully supported. |
| date-fns@^4.1.0 | TypeScript@^5 | v4 is 100% TypeScript with handcrafted types. `eachDayOfInterval`, `startOfMonth`, `endOfMonth`, `getDay`, `isSameDay`, `differenceInDays`, `addDays` all available. |
| lru-cache@^11.0.0 | Node.js 18+, TypeScript@^5 | TypeScript-native. ESM-first with CJS compat. TTL and max-size options. |

---

## Stack Patterns for This Project (v1.0 + v1.1 + v1.2)

**Auth guard pattern (App Router, Next.js 16):**
- Route protection lives in `src/proxy.ts` (not middleware)
- `proxy.ts` reads cookies via `createServerClient`, calls `getUser()`, redirects unauthenticated users
- Individual pages do a secondary check via admin client for role-based access

**Server Component data access:**
- Use `createServerClient` from `@supabase/ssr` for authenticated user-scoped reads
- Use `createAdminClient` (service role) for cross-user queries (coach seeing student data, owner seeing all)
- All admin client files must have `import 'server-only'` at the top
- Admin client is a module-level singleton — one instance per worker process

**Form pattern:**
- `react-hook-form` + `zodResolver` for client-side forms
- API route validates again with `zod.safeParse()` — never trust client-side validation alone

**Design token pattern (Tailwind v4):**
- All tokens defined in `globals.css` under `@theme` as `--ima-*` custom properties
- Never use hardcoded hex values or `text-gray-*` — always `text-ima-*`
- This applies to react-day-picker's `classNames` prop — override with ima-* classes

**Calendar integration pattern:**
- Fetch session/report dates as Server Component (async page), pass down as serialized date arrays
- react-day-picker is a Client Component (needs `"use client"` for month navigation state)
- Custom `DayButton` uses `isSameDay` from date-fns to match pre-fetched date arrays — no client-side Supabase calls

**Motion/animation rules:**
- Every `animate-*` class MUST use `motion-safe:animate-*` wrapper (CLAUDE.md hard rule)
- SVG circular progress animation via `motion.circle` — include `motion-safe:` on the wrapper div if using Tailwind animate classes alongside

**Rate limiting pattern (v1.2):**
- `checkRateLimit(user.id)` in every API route, after auth check, before Zod validation
- Return 429 with `Retry-After: 60` and `X-RateLimit-Remaining: 0` headers
- Module-level `lru-cache` singleton — no external service

**Caching decision tree (v1.2):**
- Per-request dedup (same user, same render): `cache()` from React
- Cross-request shared data (platform stats, owner dashboard): `use cache` directive
- Invalidate after write: `revalidateTag()` or `revalidatePath()` from `"next/cache"`

---

## Sources

**v1.2 sources:**
- [lru-cache (11.2.7 on Libraries.io)](https://libraries.io/npm/lru-cache) — current version, TypeScript-native (HIGH confidence)
- [Next.js 16 Caching docs](https://nextjs.org/docs/app/getting-started/caching) — `use cache`, `cacheLife`, `cacheTag`, `revalidateTag` (HIGH confidence, docs dated 2026-03-25)
- [Supabase JS rpc() docs](https://supabase.com/docs/reference/javascript/rpc) — `.rpc()` API, transaction semantics (HIGH confidence)
- [Supabase pg_cron docs](https://supabase.com/docs/guides/database/extensions/pg_cron) — v1.6.4, scheduling syntax (HIGH confidence)
- [Supabase pg_stat_statements docs](https://supabase.com/docs/guides/database/extensions/pg_stat_statements) — slow query detection (HIGH confidence)
- [k6 GitHub releases](https://github.com/grafana/k6/releases) — v1.7.0 latest, 2026-03-25 (HIGH confidence)
- [k6 documentation](https://grafana.com/docs/k6/latest/) — executor types, metrics (HIGH confidence)
- [Arcjet Next.js security checklist](https://blog.arcjet.com/next-js-security-checklist/) — security audit items (MEDIUM confidence)
- WebSearch: CVE-2025-29927 middleware bypass — proxy.ts not affected (MEDIUM confidence, cross-referenced multiple sources)

**v1.1 sources:**
- [react-day-picker changelog](https://daypicker.dev/changelog) — v9.14.0 confirmed latest (2026-02-26), React 19 compat fixed in 9.4.3 (HIGH confidence)
- [react-day-picker custom components guide](https://daypicker.dev/guides/custom-components) — DayButton slot confirmed, 24 component slots available (HIGH confidence)
- [react-day-picker custom modifiers guide](https://daypicker.dev/guides/custom-modifiers) — `modifiers` + `modifiersClassNames` props confirmed (HIGH confidence)
- [PostgreSQL docs: ALTER TABLE](https://www.postgresql.org/docs/current/ddl-alter.html) — Constant DEFAULT = no table rewrite (Postgres 11+); volatile DEFAULT = full rewrite (HIGH confidence)
- [motion SVG animation docs](https://motion.dev/docs/react-svg-animation) — `motion.circle`, `pathLength`, `strokeDashoffset` animation supported in motion v12 (HIGH confidence)
- [date-fns npm](https://www.npmjs.com/package/date-fns) — v4.1.0 current stable, 100% TypeScript (HIGH confidence)
- WebSearch: react-day-picker React 19 compatibility — multiple sources confirm 9.4.3+ fixes (MEDIUM confidence, corroborated by changelog)
- WebSearch: circular progress SVG React pattern — multiple community implementations confirm SVG + strokeDashoffset approach without library (MEDIUM confidence)

---
*Stack research for: IMA Accelerator v1.0, v1.1 — calendar, KPI progress, deadline features; v1.2 — performance, scale, security*
*Researched: v1.0 initial, v1.1 2026-03-27, v1.2 2026-03-29*
