# Architecture Research

**Domain:** Performance optimization and security hardening — Next.js 16 App Router + Supabase
**Researched:** 2026-03-29
**Confidence:** HIGH (Next.js 16.2.1 official docs + Supabase docs + direct codebase analysis)

---

## Standard Architecture

### System Overview (Current + v1.2 Changes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Browser / Client                               │
│  React hydrated components — "use client" only for interactivity        │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP
┌─────────────────────────────▼───────────────────────────────────────────┐
│                       Next.js 16 App Router (Node.js serverless)        │
│                                                                          │
│  src/proxy.ts ──────────────── route guard (NOT middleware.ts)          │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Server Components (async pages / layouts)                       │   │
│  │                                                                   │   │
│  │  React cache() ─── per-request dedup only (NOT cross-request)   │   │
│  │  unstable_cache ── cross-request TTL cache (NEW in v1.2)        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  API Route Handlers  (src/app/api/**/route.ts)                   │   │
│  │                                                                   │   │
│  │  checkRateLimit() ── Supabase-backed counter (NEW in v1.2)      │   │
│  │  Auth check ──────── createClient().auth.getUser()              │   │
│  │  Profile lookup ──── getAdminClient() → users table             │   │
│  │  Business logic ──── getAdminClient() queries / mutations        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  src/lib/supabase/admin.ts                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Module-level singleton (NEW in v1.2)                            │   │
│  │  let _adminClient: SupabaseClient | null = null                  │   │
│  │  export function getAdminClient() { return _adminClient ??= ... }│   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ PostgREST (HTTPS)
┌─────────────────────────────▼───────────────────────────────────────────┐
│                           Supabase Pro                                   │
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │  Postgres DB      │  │  RPC Functions (NEW) │  │  pg_cron (NEW)  │  │
│  │                  │  │                      │  │                  │  │
│  │  users           │  │  get_sidebar_badges  │  │  nightly 2 AM   │  │
│  │  work_sessions   │  │  get_owner_dashboard │  │  → refresh_kpi  │  │
│  │  daily_reports   │  │  get_student_detail  │  │    _summaries() │  │
│  │  roadmap_progress│  │                      │  │                  │  │
│  │  invites         │  └──────────────────────┘  └──────────────────┘  │
│  │  magic_links     │                                                    │
│  │  alert_dismissals│  ┌──────────────────────┐                         │
│  │  rate_limit_log  │  │  Summary table (NEW) │                         │
│  │  student_kpi_    │  │  student_kpi_summaries│                        │
│  │   summaries(NEW) │  │  computed_date, TTL  │                         │
│  └──────────────────┘  └──────────────────────┘                         │
│                                                                          │
│  RLS on all tables — service_role key bypasses, anon key respects RLS  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Key v1.2 Change |
|-----------|----------------|-----------------|
| `src/proxy.ts` | Route guard — redirect unauthenticated/unauthorized | No change |
| `src/lib/supabase/admin.ts` | Service-role Supabase client | Singleton pattern replaces per-call instantiation |
| `src/lib/supabase/server.ts` | User-scoped Supabase client (respects RLS) | No change |
| `src/lib/session.ts` | `getSessionUser()` / `requireRole()` helpers | Wrap with `React.cache()` to dedup per-render |
| `src/app/(dashboard)/layout.tsx` | Sidebar badge computation — 8 DB calls for owner, 2 for coach | Replace with single RPC call wrapped in `unstable_cache` |
| `src/app/api/**/route.ts` | Auth + role + validation + mutation | Add `checkRateLimit()` before business logic |
| `supabase/migrations/` | Schema, RLS, helper functions | Add indexes, RPC functions, pg_cron, summary table, rate_limit_log |

---

## Recommended Project Structure (v1.2 additions)

```
src/
├── lib/
│   ├── supabase/
│   │   ├── admin.ts          # MODIFIED — singleton getAdminClient()
│   │   └── server.ts         # no change
│   ├── session.ts            # MODIFIED — wrap getSessionUser with React.cache()
│   ├── rate-limit.ts         # NEW — Supabase-backed rate limiter helper
│   └── rpc/
│       └── types.ts          # NEW — hand-typed RPC response shapes
│
├── app/
│   ├── (dashboard)/
│   │   └── layout.tsx        # MODIFIED — single RPC + unstable_cache
│   │
│   └── api/
│       ├── work-sessions/    # MODIFIED — add checkRateLimit()
│       ├── reports/          # MODIFIED — add checkRateLimit()
│       └── roadmap/          # MODIFIED — add checkRateLimit()
│
supabase/
└── migrations/
    ├── 00009_indexes.sql          # NEW — composite indexes for hot paths
    ├── 00010_rpc_functions.sql    # NEW — get_sidebar_badges, get_owner_dashboard
    ├── 00011_summary_table.sql    # NEW — student_kpi_summaries + pg_cron job
    └── 00012_rate_limit_log.sql   # NEW — rate_limit_log table + cleanup cron
```

---

## Architectural Patterns

### Pattern 1: Admin Client Singleton

**What:** Module-level initialization instead of `createClient()` on every call. Node.js module scope is per-process. In Next.js serverless, the function container is kept warm for repeated requests (typically 5-25 minutes), so the singleton survives warm invocations.

**When to use:** Always — 36 files currently import and call `createAdminClient()`, each creating a new `SupabaseClient` with HTTP client setup on every invocation.

**Trade-offs:**
- Pro: Amortizes client initialization overhead across warm-container invocations
- Pro: One less object allocation per request in the hot path
- Neutral: Cold starts still pay the initialization cost — no help there
- Important: The singleton is per-process/container, NOT shared across concurrent serverless instances. No race condition risk because Node.js is single-threaded and module initialization is synchronous.

**Pattern:**
```typescript
// src/lib/supabase/admin.ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

let _adminClient: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> {
  if (!_adminClient) {
    _adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}
```

**Migration:** All 36 `createAdminClient()` call sites change to `getAdminClient()`. The rename signals "get existing or create" vs "always create new". The old `createAdminClient` export is removed — no deprecation period needed since it is internal.

---

### Pattern 2: React cache() for Per-Request Deduplication

**What:** Wrap data-fetching functions with `React.cache()` to deduplicate calls within a single server render pass. This is request-scoped — the cache is discarded at the end of each request. It does NOT cache across requests.

**Scope clarification:**
- `React.cache()` = per-request dedup (one render tree, one request)
- `unstable_cache` = cross-request with configurable TTL

These solve different problems and are often used together.

**When to use `React.cache()`:**
- `getSessionUser()` in `session.ts` — called from `(dashboard)/layout.tsx` (renders first) and then again from `requireRole()` inside a child page (same render tree). Currently triggers two round trips to Supabase per request. With `cache()`, the second call returns the memoized result from the first.

**When to use `unstable_cache`:**
- Dashboard badge counts (owner: 60-second staleness is acceptable)
- Owner dashboard stat counts (total students/coaches — changes rarely)

**Pattern for session dedup:**
```typescript
// src/lib/session.ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export const getSessionUser = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const admin = getAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, email, name, role, coach_id")
    .eq("auth_id", user.id)
    .single();
  if (error) console.error("[session] Failed to load profile:", error);
  if (!profile) redirect("/no-access");
  return { authId: user.id, id: profile.id, /* ... */ };
});
```

**Important constraint for Next.js 16:** The app does NOT enable `cacheComponents: true`. Therefore:
- The `"use cache"` directive is not available
- `React.cache()` is the correct tool for per-render dedup
- `unstable_cache` is the correct tool for persistent cross-request caching
- `export const revalidate = N` does NOT apply to cookie-reading authenticated routes (see Anti-Pattern 3 below)

---

### Pattern 3: Persistent Cross-Request Caching with unstable_cache

**What:** Wrap expensive read functions with `unstable_cache` to cache results server-side across requests, with a TTL and optional tag-based invalidation.

**Application in this codebase:**

The owner sidebar badge computation in `(dashboard)/layout.tsx` currently runs 8 sequential + parallel DB queries on every page navigation for the owner. The badge count is acceptable to be 60 seconds stale.

```typescript
// src/lib/data/badges.ts
import { unstable_cache } from "next/cache";
import { getAdminClient } from "@/lib/supabase/admin";

export const getOwnerBadgeCounts = unstable_cache(
  async (ownerId: string) => {
    const admin = getAdminClient();
    const { data } = await admin.rpc("get_sidebar_badges", {
      p_user_id: ownerId,
      p_role: "owner",
    });
    return data as { active_alerts: number } | null;
  },
  ["owner-sidebar-badges"],    // stable key prefix
  {
    tags: ["owner-badges"],    // for on-demand revalidation
    revalidate: 60,            // max staleness: 60 seconds
  }
);
```

**Tag-based invalidation:** When the owner dismisses an alert (`POST /api/alerts/dismiss`), call `revalidateTag("owner-badges")` in the route handler to expire the cache immediately:

```typescript
// In POST /api/alerts/dismiss route handler, after successful upsert:
import { revalidateTag } from "next/cache";
revalidateTag("owner-badges");
```

---

### Pattern 4: RPC Function Consolidation

**What:** Move multi-table join logic from Next.js server components into Postgres functions. Call via `admin.rpc("function_name", args)`. One PostgREST round trip instead of N.

**Where to define:** Supabase migration files, version-controlled with the schema. Deploy via `supabase db push`.

**TypeScript typing for RPC returns:**

The hand-crafted `src/lib/types.ts` does not include RPC functions. Until types are regenerated from a running local Supabase (`npx supabase gen types typescript --local`), define response shapes manually:

```typescript
// src/lib/rpc/types.ts

// Return type of get_sidebar_badges(p_user_id uuid, p_role text) → jsonb
export type SidebarBadgesResult = {
  active_alerts?: number;          // owner only
  unreviewed_reports?: number;     // coach only
};

// Return type of get_owner_dashboard_stats() → jsonb
export type OwnerDashboardStats = {
  total_students: number;
  total_coaches: number;
  active_today_count: number;
  reports_today: number;
};
```

**Calling pattern with type cast:**
```typescript
const admin = getAdminClient();
const { data, error } = await admin.rpc("get_sidebar_badges", {
  p_user_id: profile.id,
  p_role: profile.role,
});
// data is typed as `unknown` until types.ts is regenerated
const badges = data as SidebarBadgesResult | null;
```

Once `npx supabase gen types typescript` runs against local Supabase with the new functions defined, the `Database["public"]["Functions"]` section will include fully typed RPC signatures and the cast can be removed.

**RPC migration pattern:**
```sql
-- supabase/migrations/00010_rpc_functions.sql

CREATE OR REPLACE FUNCTION public.get_sidebar_badges(
  p_user_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE          -- read-only; Postgres can cache result in same transaction
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_alert_count integer := 0;
  v_unreviewed integer := 0;
BEGIN
  IF p_role = 'owner' THEN
    -- All 8 former layout.tsx queries consolidated here
    -- (inactive students, dropoff students, unreviewed reports, coach ratings,
    --  dismissed alerts) → returns single active_alerts integer
    -- ... full implementation ...
    v_result := jsonb_build_object('active_alerts', v_alert_count);

  ELSIF p_role = 'coach' THEN
    SELECT COUNT(*) INTO v_unreviewed
    FROM daily_reports dr
    JOIN users u ON u.id = dr.student_id
    WHERE u.coach_id = p_user_id
      AND dr.reviewed_by IS NULL
      AND dr.submitted_at IS NOT NULL
      AND dr.date >= CURRENT_DATE - 7;
    v_result := jsonb_build_object('unreviewed_reports', v_unreviewed);

  ELSE
    v_result := jsonb_build_object();
  END IF;
  RETURN v_result;
END;
$$;
```

---

### Pattern 5: Server-Side Pagination

**What:** Add `page` query param to list pages. Use Supabase `.range(from, to)` with `{ count: "exact" }` to get one page of results plus the total row count. Pass both to a pagination UI component.

**How searchParams work in Next.js 16 server components:**

Server components receive `searchParams` as a `Promise<Record<string, string>>` that must be awaited. This is the pattern already in use in `owner/students/page.tsx` for the `search` param.

```typescript
// src/app/(dashboard)/owner/students/page.tsx (MODIFIED)
export default async function OwnerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  await requireRole("owner");
  const { search, page: pageStr } = await searchParams;

  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const pageSize = 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = getAdminClient();
  let query = admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id", { count: "exact" })
    .eq("role", "student")
    .order("name")
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students, count, error } = await query;
  const totalPages = Math.ceil((count ?? 0) / pageSize);

  // Pass to client component: students, page, totalPages, totalCount
}
```

**URL-driven pagination:** The `<PaginationControls page={page} totalPages={totalPages} />` client component uses `useRouter().push()` or `<Link>` to update the `?page=N` query param, triggering a full server component re-render. No client state is needed for the current page — the URL is the source of truth.

**Important:** The Supabase `.range(from, to)` uses 0-based offsets but the UI uses 1-based page numbers. `from = (page - 1) * pageSize`, `to = from + pageSize - 1`.

---

### Pattern 6: pg_cron Nightly Aggregation

**What:** A pg_cron job runs nightly at 2 AM UTC, computing per-student KPI aggregates and storing them in `student_kpi_summaries`. Dashboard pages read from the summary table during the day, falling back to live queries when today's summary row does not yet exist.

**Enabling pg_cron:**

Supabase Pro plans have pg_cron available. Enable it in a migration (idempotent):

```sql
-- supabase/migrations/00011_summary_table.sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
```

Note: On Supabase, pg_cron requires the extension to exist in `extensions` schema. Jobs are scheduled via `cron.schedule()` which writes to the `cron.job` table managed by Supabase.

**Summary table and cron job:**
```sql
CREATE TABLE public.student_kpi_summaries (
  student_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  computed_date  date NOT NULL,
  lifetime_outreach      integer NOT NULL DEFAULT 0,
  lifetime_hours         decimal(8,2) NOT NULL DEFAULT 0,
  days_active_last_30    integer NOT NULL DEFAULT 0,
  avg_star_rating_last_7 decimal(3,2),
  current_step_number    integer,
  computed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, computed_date)
);

CREATE INDEX idx_kpi_summaries_student ON public.student_kpi_summaries(student_id);
CREATE INDEX idx_kpi_summaries_date ON public.student_kpi_summaries(computed_date);

-- Aggregation function
CREATE OR REPLACE FUNCTION public.refresh_student_kpi_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.student_kpi_summaries (
    student_id, computed_date, lifetime_outreach, lifetime_hours,
    days_active_last_30, avg_star_rating_last_7, current_step_number
  )
  SELECT
    u.id,
    CURRENT_DATE,
    COALESCE(SUM(dr.brands_contacted + dr.influencers_contacted), 0),
    COALESCE(SUM(dr.hours_worked), 0),
    COUNT(DISTINCT CASE WHEN dr.date >= CURRENT_DATE - 30 THEN dr.date END),
    AVG(CASE WHEN dr.date >= CURRENT_DATE - 7 AND dr.star_rating IS NOT NULL
             THEN dr.star_rating END),
    (SELECT step_number FROM public.roadmap_progress
     WHERE student_id = u.id AND status = 'active' LIMIT 1)
  FROM public.users u
  LEFT JOIN public.daily_reports dr
    ON dr.student_id = u.id AND dr.submitted_at IS NOT NULL
  WHERE u.role = 'student' AND u.status = 'active'
  GROUP BY u.id
  ON CONFLICT (student_id, computed_date) DO UPDATE SET
    lifetime_outreach      = EXCLUDED.lifetime_outreach,
    lifetime_hours         = EXCLUDED.lifetime_hours,
    days_active_last_30    = EXCLUDED.days_active_last_30,
    avg_star_rating_last_7 = EXCLUDED.avg_star_rating_last_7,
    current_step_number    = EXCLUDED.current_step_number,
    computed_at            = now();
END;
$$;

-- Schedule: nightly at 2 AM UTC
SELECT cron.schedule(
  'nightly-kpi-refresh',
  '0 2 * * *',
  'SELECT public.refresh_student_kpi_summaries()'
);
```

**Read path — summary first, live fallback:**
```typescript
// In student detail page server component:
const admin = getAdminClient();
const today = getTodayUTC();

const { data: summary } = await admin
  .from("student_kpi_summaries")
  .select("lifetime_outreach, lifetime_hours, avg_star_rating_last_7, current_step_number")
  .eq("student_id", studentId)
  .eq("computed_date", today)
  .maybeSingle();

// If summary exists, skip 3-4 expensive live aggregate queries
const lifetimeOutreach = summary
  ? summary.lifetime_outreach
  : await computeLifetimeOutreachLive(studentId, admin);
```

**pg_cron constraints on Supabase Pro:**
- Max 8 concurrent jobs (Supabase recommendation)
- Per-job limit: 10 minutes (Supabase recommendation)
- With 5k active students, the nightly aggregation touching all reports runs one SQL statement with a GROUP BY — should complete in seconds, well within limits

---

### Pattern 7: Supabase-Backed Rate Limiter

**What:** A `rate_limit_log` table in Postgres tracks API call timestamps per user per endpoint. The rate limiter counts rows in the sliding window and inserts the current call. Old rows are cleaned up by a pg_cron job.

**Why not in-memory:** In-memory rate limiting in Next.js serverless is architecturally broken. Each serverless function container is isolated. A user making 60 requests per minute can hit multiple warm containers, each with its own counter that sees only a fraction of the traffic. There is no shared in-memory state between containers.

**Why not Redis/Upstash:** The project scope explicitly defers Redis evaluation until post-load testing proves the DB counter adds unacceptable latency. Supabase Pro is already the infrastructure.

**Table design:**
```sql
-- supabase/migrations/00012_rate_limit_log.sql
CREATE TABLE public.rate_limit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  called_at   timestamptz NOT NULL DEFAULT now()
);

-- Covering index for the sliding window count query
CREATE INDEX idx_rate_limit_user_endpoint_time
  ON public.rate_limit_log(user_id, endpoint, called_at DESC);

-- Cleanup old rows nightly (2-hour retention is more than enough for 1-min windows)
SELECT cron.schedule(
  'cleanup-rate-limit-log',
  '30 3 * * *',
  $$ DELETE FROM public.rate_limit_log WHERE called_at < now() - interval '2 hours' $$
);
```

**Rate limiter helper:**
```typescript
// src/lib/rate-limit.ts
import { getAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = { allowed: boolean; remaining: number };

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests = 30,
  windowMinutes = 1
): Promise<RateLimitResult> {
  const admin = getAdminClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count } = await admin
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("called_at", windowStart);

  const callCount = count ?? 0;
  if (callCount >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  await admin.from("rate_limit_log").insert({ user_id: userId, endpoint });
  return { allowed: true, remaining: maxRequests - callCount - 1 };
}
```

**Usage in API routes** (after profile lookup, before Zod validation):
```typescript
const { allowed } = await checkRateLimit(profile.id, "/api/reports");
if (!allowed) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again in 60 seconds." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
```

**Latency cost:** 1 COUNT query + 1 INSERT = 2 DB round trips per rate-limited API call, adding ~4-8ms overhead on warm Supabase connections. Acceptable for write endpoints (reports, work sessions, roadmap). Do not apply to GET endpoints or to server component reads.

---

## Data Flow

### Request Flow: Dashboard Layout Badge Counts (Before → After)

**Before (8 round trips for owner, per page navigation):**
```
Browser: GET /owner/students
    ↓
layout.tsx
    createAdminClient() — creates new client
    await admin.from("users").select() — get all students         RTT 1
    await Promise.all([
      admin.from("work_sessions").select() — recent sessions,    RTT 2
      admin.from("daily_reports").select() — recent reports,     RTT 3
    ])
    await admin.from("daily_reports").select count — unreviewed  RTT 4
    await admin.from("users").select() — coaches                 RTT 5
    await admin.from("users").select() — coach students          RTT 6
    await admin.from("daily_reports").select() — window reports  RTT 7
    await admin.from("alert_dismissals").select count            RTT 8
    ────────────────────────────────────────────────────────────────
    Total: 8 × ~20-40ms PostgREST RTT = 160-320ms for layout alone
```

**After (1 RPC + unstable_cache):**
```
Browser: GET /owner/students
    ↓
layout.tsx
    getAdminClient() — returns cached singleton
    unstable_cache hit (within 60s)? → 0 DB round trips, return cached badges
    unstable_cache miss?
      admin.rpc("get_sidebar_badges", { p_user_id, p_role })    RTT 1
      (Postgres executes 8-query logic in-database, single network hop)
    ────────────────────────────────────────────────────────────────
    Cache hit:  0ms DB latency
    Cache miss: 1 × ~20-40ms PostgREST RTT
```

### Request Flow: Student Detail Page (11 queries → RPC consolidation)

**Before:**
```
Promise.all([
  sessions (month-scoped),           RTT group A (all fire concurrently)
  roadmap,
  reports (month-scoped),
  coaches list,
  student counts,
  lifetime reports (ALL rows),       <-- full table scan, no date filter
  today report,
  today sessions,
  latest session date,
  latest report date,
  recent ratings (7 days),
])
Slowest query determines wall time.
"lifetime reports" fetches every report row for KPI sum.
```

**After:**
```
admin.rpc("get_student_detail_data", {              RTT 1 — all data
  p_student_id, p_month, p_today, p_seven_days_ago
})
Postgres handles joins + aggregations in-database.

OR: Use summary table for KPI fields (if within 24h of nightly refresh):
  admin.from("student_kpi_summaries").select()      RTT 1 — KPI fields
  admin.from("work_sessions/roadmap_progress/       RTT 2 — calendar + roadmap
             daily_reports").select() (month-scoped)
Total: 2 concurrent round trips instead of 11.
```

### Request Flow: Rate-Limited API Write

```
Client: POST /api/reports { date, hours_worked, ... }
    ↓
createClient() → supabase.auth.getUser()     validates JWT (user-scoped client)
    ↓
getAdminClient().from("users").select()      profile lookup (admin, no RLS)
    ↓
checkRateLimit(profile.id, "/api/reports")
  → SELECT COUNT from rate_limit_log         sliding window count
  → INSERT into rate_limit_log               record this call
  → allowed? continue  |  not allowed? 429
    ↓
Zod safeParse(body)
    ↓
getAdminClient().from("daily_reports").upsert()
    ↓
200/201 response
```

### Data Flow: pg_cron → Summary Table → Dashboard Read

```
2:00 AM UTC (pg_cron)
    ↓
refresh_student_kpi_summaries()
  SELECT from users + daily_reports (GROUP BY student_id)
  UPSERT into student_kpi_summaries WHERE computed_date = CURRENT_DATE
    ↓
Throughout the day:
  Owner/coach visits student detail page
  SELECT from student_kpi_summaries WHERE student_id = X AND computed_date = today
    → hit: return pre-aggregated KPIs (no live aggregation needed)
    → miss (before 2 AM, or new student): fall back to live aggregate queries
```

---

## Files Modified vs New

| File | Action | Change Summary |
|------|--------|----------------|
| `src/lib/supabase/admin.ts` | MODIFY | `getAdminClient()` singleton replaces `createAdminClient()` |
| `src/lib/session.ts` | MODIFY | Wrap `getSessionUser` body with `React.cache()` |
| `src/app/(dashboard)/layout.tsx` | MODIFY | Replace 8 raw queries with `unstable_cache(rpc("get_sidebar_badges"))` |
| `src/app/(dashboard)/owner/students/page.tsx` | MODIFY | Add `.range()` + `{ count: "exact" }` + `totalPages` prop |
| `src/app/(dashboard)/owner/coaches/page.tsx` | MODIFY | Same pagination pattern |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | MODIFY | Replace lifetime aggregate queries with summary table lookup + live fallback |
| `src/app/api/reports/route.ts` | MODIFY | Add `checkRateLimit()` after profile lookup |
| `src/app/api/work-sessions/route.ts` | MODIFY | Add `checkRateLimit()` after profile lookup |
| `src/app/api/roadmap/route.ts` | MODIFY | Add `checkRateLimit()` after profile lookup |
| **All 36 `createAdminClient()` call sites** | MODIFY | Import `getAdminClient` instead |
| `src/lib/rate-limit.ts` | NEW | Supabase-backed `checkRateLimit()` helper |
| `src/lib/rpc/types.ts` | NEW | Hand-typed RPC response interfaces |
| `supabase/migrations/00009_indexes.sql` | NEW | Composite covering indexes for hot paths |
| `supabase/migrations/00010_rpc_functions.sql` | NEW | `get_sidebar_badges`, `get_owner_dashboard_stats`, `get_student_detail_data` |
| `supabase/migrations/00011_summary_table.sql` | NEW | `student_kpi_summaries` table + `refresh_student_kpi_summaries()` + pg_cron schedule |
| `supabase/migrations/00012_rate_limit_log.sql` | NEW | `rate_limit_log` table + cleanup cron job |

---

## Admin Client vs User Client — Route-by-Route Analysis

**Core distinction:**
- `createClient()` with user JWT (anon key + session cookie) — respects RLS, Postgres knows who the user is
- `getAdminClient()` (service_role key) — bypasses RLS entirely, all data is accessible

**Why admin client is used everywhere today:**

The comment in `layout.tsx` and `session.ts` explains the bootstrapping problem: "RLS policies use `get_user_role()` which can fail during profile resolution." To look up the user's profile (which maps `auth_id` → `id` + `role`), the query must run outside of RLS. Once the profile is resolved, the role is known and all subsequent authorization is done explicitly in application code.

**Route-by-route verdict:**

| Route | Current | Can Switch to User Client? | Verdict |
|-------|---------|----------------------------|---------|
| `POST /api/reports` | Admin all queries | Profile lookup must stay admin. Report insert/update could use user client — RLS `student_insert_reports` + `student_update_reports` exist. | Keep admin. Marginal security gain does not justify refactor risk. |
| `POST /api/work-sessions` | Admin all queries | Same as reports — RLS policies exist for student writes. | Keep admin. Same reasoning. |
| `PATCH /api/roadmap` | Admin all queries | Student update RLS exists. | Keep admin. Step-unlock logic writes next step — application code already handles authorization. |
| `PATCH /api/reports/[id]/review` | Admin all queries | Coach review requires cross-student ownership check: `student.coach_id = profile.id`. Difficult to express purely in RLS without a multi-table join policy. | Keep admin. Explicit ownership check in application code is correct. |
| `PATCH /api/assignments` | Admin all queries | Owner-only operation. | Keep admin. |
| `POST /api/alerts/dismiss` | Admin all queries | Owner-only operation. | Keep admin. |
| `GET /api/calendar` | Admin all queries | Requires cross-role access (coach reading student data). RLS `coach_select_work_sessions` and `coach_select_reports` policies exist but the route also does the coach-student assignment check. | Keep admin. Defense-in-depth is correct here. |
| `POST /api/invites` | Admin all queries | Owner/coach insert. Admin required for owner-wide invite management. | Keep admin. |

**Security posture is already correct.** The service_role key is server-only (no `NEXT_PUBLIC_` prefix, never reaches the browser). The admin client is the right tool for server-side code that implements its own authorization. The defense-in-depth pattern (admin query + explicit `eq("auth_id", user.id)` + role check) is correct and should be maintained.

**What to verify in the security audit (not change):**
- Confirm no route skips the `auth_id = authUser.id` filter on the initial profile lookup — verified in all current routes
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_` — verified correct
- Confirm `get_user_role()` and `get_user_id()` have `SECURITY DEFINER` + `SET search_path = public` — confirmed in migration 00001

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 students (current) | Current architecture is fine. Admin singleton reduces per-call overhead. |
| 500-5k students (v1.2 target) | Composite indexes + RPC consolidation + nightly KPI summaries. The 11 PM daily report spike (all students submitting simultaneously) is the primary concern. Indexes + rate limiting contain it. |
| 5k-50k students | Materialized views with `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Add Supabase read replica for coach/owner analytics paths. Summary table becomes essential. |
| 50k+ students | Separate OLAP store for historical analytics. Real-time dashboard reads from summary tables only. Consider Supabase branching for heavy analytical queries. |

### Scaling Priorities

1. **First bottleneck: Dashboard layout query count.** The owner layout runs 8 queries on every navigation event, even when just switching tabs. With 5k students and multiple active owners this is the top DB load multiplier. Fix: RPC consolidation + `unstable_cache`.

2. **Second bottleneck: 11 PM write spike on `daily_reports` + `work_sessions`.** Students submitting end-of-day reports in a 1-2 hour window. Without indexes on `(student_id, date)`, each insert triggers a table scan to enforce the unique constraint. Fix: Ensure composite covering indexes exist on `(student_id, date)` for both tables.

3. **Third bottleneck: Student detail page (11 parallel queries).** Each owner or coach viewing a student detail page fires 11 concurrent PostgREST requests. The "lifetime reports" query scans all rows to compute a SUM. Fix: RPC consolidation + summary table for KPI values.

---

## Anti-Patterns

### Anti-Pattern 1: createAdminClient() Per Call With Singleton Available

**What people do:** Keep calling `createAdminClient()` in every function, creating a new `SupabaseClient` on each invocation.

**Why it's wrong:** Each `SupabaseClient` initialization allocates objects and sets up HTTP client config. In a warm serverless container serving 30 req/min at 5k users, this is repeated unnecessary work.

**Do this instead:** `getAdminClient()` — returns the module-level singleton, initializing it only once per container lifetime.

---

### Anti-Pattern 2: React cache() as a Cross-Request Cache

**What people do:** Wrap expensive data functions with `React.cache()` and assume the result persists across multiple page loads.

**Why it's wrong:** `React.cache()` scope is exactly one server render pass. The memo table is reset at the end of every request. A subsequent request by the same user re-executes the function from scratch.

**Do this instead:** `React.cache()` for within-render dedup (layout + page calling `getSessionUser()` in the same render tree). `unstable_cache` with a TTL for data acceptable to be stale across requests.

---

### Anti-Pattern 3: export const revalidate = 60 on Authenticated Routes

**What people do:** Add `export const revalidate = 60` to authenticated dashboard pages expecting ISR (Incremental Static Regeneration) behavior.

**Why it's wrong:** Any route that reads `cookies()` from `next/headers` — which `createClient()` does via `@supabase/ssr` — is inherently dynamic. Next.js cannot cache a response that depends on per-request cookie data. The `revalidate` export is silently ignored or can produce unexpected behavior when mixed with dynamic functions.

**Do this instead:** Use `unstable_cache` with TTL on specific data functions within the route handler. The route itself remains dynamic (executed per-request), but the expensive sub-queries return cached results.

---

### Anti-Pattern 4: In-Memory Rate Limiting in Serverless

**What people do:** Use a `Map<string, {count: number; resetAt: number}>` at module level to track per-user request rates.

**Why it's wrong:** Next.js serverless containers run in isolation. A user making 31 requests/minute can land on multiple warm containers, each with its own counter showing only its fraction of total traffic. The limit is trivially bypassed.

**Do this instead:** Supabase-backed `rate_limit_log` table — shared state across all containers. At 5k users with 30 req/min/user, the log cleanup cron keeps the table small and the covering index makes the window count query fast.

---

### Anti-Pattern 5: Relying on RLS as the Only Authorization in API Routes

**What people do:** Switch to the user client (anon key + user JWT) in API routes and remove the admin-based role check, trusting RLS to handle authorization.

**Why it's wrong for this app:** The bootstrapping problem requires admin access for the initial profile lookup. Additionally, ownership checks like "this report belongs to a student assigned to this coach" are complex to write correctly in RLS and fragile to maintain. Application-level authorization is more explicit and auditable.

**Do this instead:** Maintain the current defense-in-depth: admin client for all server queries + explicit `eq("auth_id", user.id)` filter + role check in application code. RLS remains as a backup safety net. Do not change this pattern.

---

### Anti-Pattern 6: Fetching All Rows for Client-Side Aggregation

**What people do:** Fetch all `daily_reports` rows for a student (hundreds of rows) and compute `SUM(outreach_count)` in JavaScript.

**Why it's wrong:** The `owner/students/[studentId]/page.tsx` currently does exactly this (`lifetimeReportsResult` in the 11-query `Promise.all`). Every page load transfers all historical report data just for one integer.

**Do this instead:** Use a Postgres aggregate (`.select("brands_contacted.sum()")` via PostgREST) or read from `student_kpi_summaries.lifetime_outreach` which is pre-computed nightly.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase PostgREST | `supabase.from().select/insert/update/rpc()` | No change — still via `@supabase/supabase-js` |
| Supabase pg_cron | SQL in migration file, managed by Supabase infrastructure | Pro plan required — already active |
| Supabase Auth | `createClient().auth.getUser()` — user-scoped | No change |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server Components → Supabase | `getAdminClient()` singleton | Module-level, per-container |
| API Routes → Rate Limiter | `checkRateLimit(userId, endpoint)` helper | Adds 2 DB round trips per write request |
| pg_cron → Summary Table | In-database `UPSERT` via scheduled Postgres function | No network hop |
| Dashboard Layout → RPC | `unstable_cache(admin.rpc("get_sidebar_badges"))` | 60s TTL; `revalidateTag` on alert dismiss |
| Student Detail → Summary Table | Direct `admin.from("student_kpi_summaries").select()` | Fallback to live query if today's row absent |

---

## Build Order for v1.2

Dependencies flow top-to-bottom. Each phase unblocks the next.

1. **Admin client singleton** — zero functional risk, pure refactor. Rename export, update all 36 call sites. Everything else in v1.2 uses this.

2. **Database indexes** (`00009_indexes.sql`) — pure migration additions, no code changes, immediate query performance improvement.

3. **React cache() on session** — wrap `getSessionUser` in `cache()`. Reduces per-render Supabase calls from 2 to 1 on all authenticated routes.

4. **Server-side pagination** — modify owner students/coaches pages + add pagination UI component. Self-contained, no RPC dependency.

5. **RPC functions + layout consolidation** (`00010_rpc_functions.sql`) — write migrations first, then update `layout.tsx` to call `rpc("get_sidebar_badges")` wrapped in `unstable_cache`. Add `revalidateTag` in `POST /api/alerts/dismiss`.

6. **pg_cron + summary table** (`00011_summary_table.sql`) — migration adds everything. Then update student detail pages to read from summary with live fallback. Cron runs nightly; no immediate testing is possible without manual invocation.

7. **Rate limiter** (`00012_rate_limit_log.sql`) — add table migration, implement `checkRateLimit()` helper, add to `POST /api/reports`, `POST /api/work-sessions`, `PATCH /api/roadmap`.

8. **Security audit** — review all routes for auth check gaps, verify RLS policy coverage, check for cross-student data leaks, confirm no secret key exposure. Human review required (HALT gate).

9. **Load testing** — 5k simulated users hitting write endpoints. HALT gate before this step — requires human review of load test plan. Validates that indexes + rate limiting contain the 11 PM spike.

---

## Sources

- [Next.js 16.2.1 Caching (Previous Model) — official docs](https://nextjs.org/docs/app/guides/caching-without-cache-components) — `unstable_cache`, `React.cache()`, `revalidate` semantics, revalidation frequency rules
- [Next.js 16.2.1 Getting Started: Caching (Cache Components)](https://nextjs.org/docs/app/getting-started/caching) — `"use cache"` directive, PPR model, contrast with `React.cache()`
- [React cache() vs unstable_cache — bugfree.dev](https://www.bugfree.dev/post/nextjs-caching-unstable-cache-vs-react-cache) — per-request vs cross-request scope clarification
- [Supabase API Keys — official docs](https://supabase.com/docs/guides/api/api-keys) — service_role vs anon key, when each is appropriate, bootstrapping considerations
- [Supabase JavaScript RPC reference](https://supabase.com/docs/reference/javascript/rpc) — `supabase.rpc()` calling convention and TypeScript support
- [Supabase Cron — official docs](https://supabase.com/docs/guides/cron) — pg_cron scheduling, 8-job concurrency limit, 10-minute per-job recommendation
- [Singleton pattern in Node.js serverless](https://copyprogramming.com/howto/singleton-pattern-in-nodejs-is-it-needed) — per-process scope, warm container reuse, thread safety
- [Next.js App Router pagination — official learn](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) — `searchParams` in server components, `.range()` pattern
- Codebase analysis: `src/lib/supabase/admin.ts`, `src/app/(dashboard)/layout.tsx`, `src/lib/session.ts`, all 12 API routes, `supabase/migrations/00001_create_tables.sql`, all 36 `createAdminClient()` consumers

---
*Architecture research for: IMA Accelerator v1.2 Performance, Scale & Security*
*Researched: 2026-03-29*
