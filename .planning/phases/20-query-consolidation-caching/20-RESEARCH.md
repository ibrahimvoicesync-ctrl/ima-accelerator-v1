# Phase 20: Query Consolidation & Caching - Research

**Researched:** 2026-03-30
**Domain:** Next.js 16 server-side caching (React cache + unstable_cache), Postgres RPC consolidation, Supabase .range() pagination
**Confidence:** HIGH — all findings sourced from direct codebase analysis, v1.2 ARCHITECTURE.md (verified against Next.js 16 official docs), v1.2 PITFALLS.md, and STACK.md

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**RPC Consolidation Scope**
- D-01: Create `get_owner_dashboard_stats()` Postgres RPC — returns all 4 owner dashboard counts (active students, active coaches, sessions today, reports today) in a single call. Owner dashboard page currently fires 4 parallel queries — consolidate into 1 RPC.
- D-02: Create `get_sidebar_badges(p_role text, p_user_id uuid)` Postgres RPC — computes badge counts server-side with role-based branching (owner: 7 queries → 1; coach: 2 queries → 1).
- D-03: Create `get_student_detail(p_student_id uuid, p_month_start date, p_month_end date)` RPC — returns all student detail data as a composite JSON response (coach: 9 queries → 1; owner: 11 queries → 1; one shared RPC or two with optional owner-only fields).
- D-04: All RPC functions in new migration `00010_query_consolidation.sql`, `SECURITY DEFINER` with `SET search_path = public`.

**Caching Strategy**
- D-05: Sidebar badge counts use `unstable_cache()` with 60-second TTL and `revalidateTag('badges')`. Cache key includes user ID and role.
- D-06: React `cache()` wraps `getSessionUser()` and each RPC-calling server function for per-request RSC render-tree dedup. NOT cross-request.
- D-07: Owner dashboard stats do NOT get `unstable_cache` — React cache() dedup only.
- D-08: Invalidate badge cache (`revalidateTag('badges')`) in mutations: report submission, report review, session start/complete, student invite acceptance.

**Pagination Design**
- D-09: Owner student list: 25 per page, `.range()`, `count: 'estimated'`, URL `?page=1`.
- D-10: Owner coach list: same pattern as student list.
- D-11: Server-side search with `.ilike()` + pagination, replaces client-side `OwnerStudentSearchClient`. Search resets to page 1.
- D-12: Pagination UI: "Previous / Next" + current page indicator. No page number buttons.

**Migration & Rollout**
- D-13: Single migration file `00010_query_consolidation.sql` for all RPC functions.
- D-14: Big-bang swap per page — all individual queries on a page switch to RPC in the same plan.
- D-15: Verify RPC output matches current query output before swapping.

### Claude's Discretion

- RPC function return types (JSON vs composite row types) — use whatever is cleanest for TypeScript consumption.
- Exact `unstable_cache` key structure and tag naming conventions.
- Whether `get_student_detail` is one function with role branching or two separate functions.
- React cache() wrapper placement — whether to wrap individual functions or create a cached data layer module.
- Pagination component implementation details.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUERY-01 | Dashboard layout owner path consolidated to ≤2 DB round trips via Postgres RPC functions (down from 8) | D-01 + D-02: get_owner_dashboard_stats() + get_sidebar_badges() RPCs replace 4+7=11 queries. With React cache() on getSessionUser(), total drops to ≤2 RPC calls + 1 auth call. |
| QUERY-02 | Student detail pages (coach/owner views) consolidated via Postgres RPC (down from 9-11 parallel queries) | D-03: get_student_detail() RPC — code audit shows coach page: 9 queries, owner page: 11 queries. Owner-only extras: coaches list + student counts (2 additional queries). |
| QUERY-03 | React cache() wrappers on server component data fetches deduplicate within RSC render tree | D-06: Wrap getSessionUser() and each RPC-calling function with React cache(). Layout calls getSessionUser() then page calls requireRole() which calls getSessionUser() again — currently 2 round trips, cache() makes it 1. |
| QUERY-04 | Dashboard badge count computations use unstable_cache with 60s TTL | D-05: unstable_cache wraps get_sidebar_badges() RPC call, per-user cache key, revalidateTag invalidation on mutations. |
| QUERY-05 | Owner student list page is server-side paginated with Supabase .range() and total count | D-09 + D-11: Replace OwnerStudentSearchClient + full load with .range() + count:'estimated' + URL-driven page param. |
| QUERY-06 | Owner coach list page is server-side paginated with Supabase .range() and total count | D-10: Same pagination pattern as student list. |
</phase_requirements>

---

## Summary

Phase 20 is a pure optimization phase — no new features, no UI redesign. The codebase has been audited directly and the current query counts confirmed: the owner dashboard layout fires 8+ Postgres round trips (4 in `owner/page.tsx` + 7+ in `layout.tsx` for owner badge logic + 1 auth call + 1 profile lookup). The coach sidebar fires 2 badge queries. The two student detail pages fire 9 (coach) and 11 (owner) parallel queries respectively. Both list pages perform full-table fetches with client-side filtering.

The optimization strategy uses three complementary tools: (1) Postgres RPC functions to collapse N parallel queries into 1 round trip on the database server, (2) `unstable_cache` for persistent cross-request TTL caching of the expensive badge computation, and (3) React `cache()` for per-request deduplication of `getSessionUser()` which is currently called redundantly by both `layout.tsx` and each child page via `requireRole()`.

The v1.2 research documents (PITFALLS.md, ARCHITECTURE.md, STACK.md) are thorough and directly applicable — they were written for exactly this phase. All patterns are verified. The primary recommendation is to implement in migration-first order: write and test each RPC function against live data before swapping the page.

**Primary recommendation:** Follow ARCHITECTURE.md Pattern 4 (RPC) + Pattern 2 (React cache) + Pattern 3 (unstable_cache) + Pattern 5 (pagination) in sequence. Each pattern is independently verifiable before the next begins.

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `cache()` | Built into React 19 (installed) | Per-request RSC render tree deduplication | Zero cost — already in project. Wraps async functions. Cache scope = one request. |
| `unstable_cache` | Built into Next.js 16.1.6 (installed) | Cross-request TTL caching for non-fetch async functions | The only correct tool for caching Supabase JS client calls across requests. `export const revalidate = N` does not work (cookies() makes routes dynamic). |
| `revalidateTag` | Built into Next.js 16.1.6 (installed) | On-demand cache invalidation after mutations | Called from API route handlers after badge-affecting mutations. |
| Supabase `.rpc()` | `@supabase/supabase-js` (installed) | Execute Postgres RPC functions | Single round trip replaces N parallel `.from()` calls. PostgREST wraps each call in a transaction. |
| Supabase `.range()` | `@supabase/supabase-js` (installed) | Server-side pagination | `count: 'estimated'` avoids full scan cost of `count: 'exact'`. |

**Installation:** No new npm packages required. All capabilities are in the existing installed stack.

---

## Architecture Patterns

### Recommended File Changes

```
src/
├── lib/
│   ├── session.ts              # MODIFIED — wrap getSessionUser with React.cache()
│   └── rpc/
│       └── types.ts            # NEW — hand-typed RPC response shapes
│
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # MODIFIED — single cached RPC replaces 7+ owner queries
│   │   ├── owner/
│   │   │   ├── page.tsx        # MODIFIED — single RPC replaces 4 parallel queries
│   │   │   ├── students/
│   │   │   │   └── page.tsx    # MODIFIED — server-side pagination + search
│   │   │   └── coaches/
│   │   │       └── page.tsx    # MODIFIED — server-side pagination
│   │   ├── coach/
│   │   │   └── students/
│   │   │       └── [studentId]/page.tsx  # MODIFIED — single RPC replaces 9 queries
│   │   └── owner/
│   │       └── students/
│   │           └── [studentId]/page.tsx  # MODIFIED — single RPC replaces 11 queries
│   │
│   └── api/
│       ├── reports/route.ts              # MODIFIED — add revalidateTag('badges')
│       ├── reports/[id]/review/route.ts  # MODIFIED — add revalidateTag('badges')
│       └── work-sessions/route.ts        # MODIFIED — add revalidateTag('badges')
│
supabase/
└── migrations/
    └── 00010_query_consolidation.sql     # NEW — all RPC functions
```

### Pattern 1: React cache() on getSessionUser

**What:** Wrap the exported `getSessionUser()` function with React's `cache()` import.

**When to use:** Any async function called from multiple components in the same RSC render tree.

**Current problem:** `layout.tsx` calls `createClient()` + admin profile lookup (2 DB calls). Then every child page calls `requireRole()` which calls `getSessionUser()` again — another 2 DB calls. Same user, same request, same data fetched twice.

**Fix:**
```typescript
// src/lib/session.ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ROLE_REDIRECTS, type Role } from "@/lib/config";

export type SessionUser = {
  authId: string;
  id: string;
  email: string;
  name: string;
  role: Role;
  coachId: string | null;
};

// cache() = per-request dedup. Second call in same render tree returns memoized result.
// NOT cross-request. Cache discarded at end of each request.
export const getSessionUser = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, email, name, role, coach_id")
    .eq("auth_id", user.id)
    .single();

  if (error) console.error("[session] Failed to load profile:", error);
  if (!profile) redirect("/no-access");

  return {
    authId: user.id,
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    coachId: profile.coach_id,
  };
});
```

**Important:** `requireRole()` calls `getSessionUser()` internally — no changes needed to `requireRole()`. The `cache()` wrapper on the called function is sufficient.

**Impact on layout.tsx:** The layout currently does its own `createClient()` + profile lookup. After this change, layout can call `getSessionUser()` directly, and any child page calling `requireRole()` will hit the cache (not the DB). The separate `createClient()` + profile block in `layout.tsx` can be removed in favor of `getSessionUser()`.

### Pattern 2: unstable_cache for Badge Counts

**What:** Wrap the badge-computing function with `unstable_cache` to cache the result cross-request with a 60-second TTL.

**Why unstable_cache, not `export const revalidate`:** The dashboard layout uses `cookies()` via `createClient()`, which makes the route dynamic. ISR `export const revalidate = N` has no effect on dynamic routes — confirmed in PITFALLS.md Pitfall 7 and REQUIREMENTS.md Out of Scope.

**Pattern:**
```typescript
// src/app/(dashboard)/layout.tsx (simplified)
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// Define outside the layout component — unstable_cache returns a cached function
const getSidebarBadges = unstable_cache(
  async (userId: string, role: string) => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_sidebar_badges", {
      p_user_id: userId,
      p_role: role,
    });
    if (error) console.error("[layout] Failed to load sidebar badges:", error);
    return (data as { active_alerts?: number; unreviewed_reports?: number }) ?? {};
  },
  ["sidebar-badges"],           // stable key prefix (array)
  {
    tags: ["badges"],           // tag for revalidateTag('badges')
    revalidate: 60,             // 60-second max staleness
  }
);
```

**Cache key strategy:** `unstable_cache` key is the stable prefix array PLUS the function arguments. With `["sidebar-badges"]` as prefix and `(userId, role)` as args, each user gets their own cache entry. The `tags: ["badges"]` allows bulk invalidation with `revalidateTag("badges")` which clears ALL badge cache entries across all users — correct behavior for mutations that affect badges globally.

**If per-user invalidation is needed:** Use a user-scoped tag like `tags: [\`badges-${userId}\`]` and call `revalidateTag(\`badges-${ownerId}\`)`. For this platform, global `revalidateTag("badges")` is simpler and sufficient.

### Pattern 3: Postgres RPC Functions (SECURITY DEFINER)

**What:** Postgres functions defined with `SECURITY DEFINER SET search_path = public` run with the definer's privileges (service_role) rather than the caller's. This is required because the admin client bypasses RLS.

**SQL signature pattern:**
```sql
-- supabase/migrations/00010_query_consolidation.sql

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_students',    (SELECT count(*) FROM users WHERE role = 'student' AND status = 'active'),
    'total_coaches',     (SELECT count(*) FROM users WHERE role = 'coach' AND status = 'active'),
    'active_today_count',(SELECT count(DISTINCT student_id) FROM work_sessions WHERE date = v_today),
    'reports_today',     (SELECT count(*) FROM daily_reports WHERE date = v_today AND submitted_at IS NOT NULL)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

**TypeScript call pattern:**
```typescript
// Manual type until `npx supabase gen types` is re-run against local Supabase
type OwnerDashboardStats = {
  total_students: number;
  total_coaches: number;
  active_today_count: number;
  reports_today: number;
};

const { data, error } = await admin.rpc("get_owner_dashboard_stats");
if (error) console.error("[owner dashboard] RPC failed:", error);
const stats = data as OwnerDashboardStats | null;
```

**Return type choice:** `RETURNS jsonb` is correct for composite multi-field results consumed by TypeScript. Supabase JS client returns the parsed JSON directly as the `data` value. Prefer `jsonb` over `json` — `jsonb` is binary-parsed and deduplicated in Postgres.

**STABLE vs VOLATILE:** Functions that only read data (no writes) should be marked `STABLE`. This allows Postgres to cache the result within a single transaction and enables better query planning. All three RPC functions in this phase are read-only → `STABLE`.

### Pattern 4: get_student_detail — One Shared RPC With Optional Owner Fields

**Recommendation:** One shared function with a `p_include_coach_mgmt boolean` parameter (default false). The owner detail page passes `true` to get the coaches list + student counts; the coach detail page passes `false`. This avoids maintaining two nearly-identical 80-line SQL functions.

**Rationale:** The coach view (9 queries) and owner view (11 queries) are identical except for 2 owner-specific queries:
1. `coachesResult` — all active coaches list (for reassignment UI)
2. `studentCountsResult` — student count per coach (for reassignment UI)

A single function with a boolean flag is the cleanest approach. The flag is a plpgsql `IF` that conditionally populates two fields in the returned JSON. TypeScript types handle the optional fields with `?`.

### Pattern 5: Server-Side Pagination

**What:** Pass `?page=N` in URL. Server component reads `searchParams`, computes `.range(from, to)`, returns `count` alongside data.

**count: 'estimated' vs 'exact':**
- `count: 'exact'` triggers a full table scan via `COUNT(*)` before the LIMIT is applied — expensive at scale.
- `count: 'estimated'` uses `pg_class.reltuples` which Postgres auto-updates via VACUUM. For pagination purposes (estimating total pages), this is accurate enough. CONFIRMED in REQUIREMENTS.md QUERY-05 decision and CONTEXT.md D-09.

**Pagination calculation:**
```typescript
const PAGE_SIZE = 25;
const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
const from = (page - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

let query = admin
  .from("users")
  .select("id, name, email, status, joined_at, coach_id", { count: "estimated" })
  .eq("role", "student")
  .order("name")
  .range(from, to);

if (search) {
  query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
}

const { data: students, count, error } = await query;
const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
```

**URL state:** The `OwnerStudentSearchClient` component currently manages search state client-side. Replace it with a server-side approach: the search input submits via `<form action="">` (GET) with `name="search"`, which appends `?search=X` to the URL. This triggers a full server re-render — no client state needed.

**Search + page interaction:** When search changes, page resets to 1. Implement by the search form not including a hidden `page` field — leaving it absent defaults to page 1.

### Pattern 6: revalidateTag in Mutation Routes

**Which routes need `revalidateTag("badges")`:**

| Route | Mutation | Badge Impact |
|-------|---------|--------------|
| `POST /api/reports` | Student submits report | `unreviewed_reports` (coach), `active_alerts` (owner) |
| `PATCH /api/reports/[id]/review` | Coach reviews report | `unreviewed_reports` (coach), `active_alerts` (owner) |
| `POST /api/work-sessions` | Student starts session | `active_today` influences badge logic |
| `PATCH /api/work-sessions/[id]` | Student completes/abandons session | Session status affects badge computation |
| `POST /api/alerts/dismiss` | Owner dismisses alert | `active_alerts` directly |

**Already existing:** `POST /api/alerts/dismiss` exists and needs the invalidation added.

**Import:** `import { revalidateTag } from "next/cache";` — built-in, no package needed.

**Placement:** After successful mutation, before `return NextResponse.json(...)`:
```typescript
// After successful DB write:
revalidateTag("badges");
return NextResponse.json({ data: updated });
```

### Anti-Patterns to Avoid

- **`export const revalidate = 60` on auth routes:** Has zero effect because `cookies()` makes the route dynamic. Use `unstable_cache` instead. Already documented in REQUIREMENTS.md Out of Scope.
- **RPC mega-function:** Do NOT consolidate all dashboard data into one function. Split by logical group per PITFALLS.md Pitfall 8 — `get_owner_dashboard_stats` handles page counts, `get_sidebar_badges` handles alert logic.
- **`count: 'exact'` on paginated lists:** Causes full table scan. Use `count: 'estimated'` per REQUIREMENTS.md QUERY-05 and CONTEXT.md D-09.
- **Applying `cache()` to `createAdminClient()`:** The admin client is already a module-level singleton. Adding `cache()` is redundant and wrong (cache() is for async functions that fetch data, not for client constructors).
- **Applying `cache()` to `createServerClient()`:** This IS the correct pattern per PITFALLS.md Pitfall 2, but `createServerClient()` already lives in `src/lib/supabase/server.ts` as a standalone function. Wrap `getSessionUser()` in `session.ts` instead — that's the function that makes the DB call.
- **`unstable_cache` with dynamic cache keys computed inside the wrapped function:** Cache keys must be derivable from the outer scope. Pass `userId` and `role` as function parameters, not read them inside the cached function body.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-query consolidation | Custom query batching layer | Postgres RPC (`SECURITY DEFINER` function) | DB handles joins without network round trips between sub-queries |
| Cross-request caching | In-memory Map keyed by user | `unstable_cache` from `next/cache` | In-memory is per-process and not shared across serverless instances |
| Per-request deduplication | Manual memoization with WeakMap | `React.cache()` | Handles request scoping automatically, cleared after each request |
| Pagination total count | `COUNT(*)` on every paginated query | `count: 'estimated'` in Supabase query options | pg_class.reltuples is O(1), `COUNT(*)` is O(n) full scan |
| Cache invalidation | Manual cache key tracking | `revalidateTag()` with stable tag names | Framework handles cache lookup and deletion atomically |
| TypeScript RPC types | Inline `as any` casts everywhere | `src/lib/rpc/types.ts` with hand-typed interfaces | Centralized, findable, replaceable when `supabase gen types` runs |

**Key insight:** This phase adds zero new npm dependencies. Every needed capability is a built-in of the existing React 19 + Next.js 16 + Supabase JS stack.

---

## Current State Audit (What Gets Changed)

### Owner Dashboard Path: Current Round Trips

The dashboard layout (`layout.tsx`) + owner dashboard page (`owner/page.tsx`) together currently fire:

**In `layout.tsx` (runs on EVERY page load for owner):**
1. `createClient().auth.getUser()` — auth check
2. `admin.from("users").select(...).eq("auth_id")` — profile lookup
3. `admin.from("users").select("id, joined_at").eq("role", "student")` — all active students
4. `admin.from("work_sessions").select(...)` — recent sessions (dropoff window)
5. `admin.from("daily_reports").select(...)` — recent reports (dropoff window)
6. `admin.from("daily_reports").select(...).is("reviewed_by", null)` — unreviewed count
7. `admin.from("users").select("id").eq("role", "coach")` — coaches list
8. `admin.from("users").select("id, coach_id").eq("role", "student").in("coach_id")` — coach students
9. `admin.from("daily_reports").select(...).in("student_id")` — window reports for rating
10. `admin.from("alert_dismissals").select(...)` — dismissed alerts count
**Total layout: 10 round trips (1 auth + 1 profile + 8 badge queries)**

**In `owner/page.tsx` (runs on dashboard page):**
11. `admin.from("users").select().eq("role","student").eq("status","active")` — student count
12. `admin.from("users").select().eq("role","coach").eq("status","active")` — coach count
13. `admin.from("work_sessions").select()` — active sessions today
14. `admin.from("daily_reports").select()` — reports today count
**Total page: 4 round trips**

**Also: `requireRole("owner")` in page calls `getSessionUser()` again:**
15. `createClient().auth.getUser()` — duplicate auth check
16. `admin.from("users").select().eq("auth_id")` — duplicate profile lookup

**Total unique round trips: ~14-16** (some may be deduplicated by browser/HTTP layer but all fire from Next.js server perspective)

**After Phase 20: ≤2 RPC calls + React cache() dedup on auth**
- `getSessionUser()` cached: 1 auth + 1 profile lookup (first call), 0 additional (layout + page share)
- `get_sidebar_badges(userId, role)` via `unstable_cache`: 0-1 Postgres calls (cached 60s)
- `get_owner_dashboard_stats()`: 1 Postgres call (not cached, React cache dedup)
- **Total per navigation: 2 Postgres calls + 1 auth call** (down from 14-16)

### Student Detail Pages: Current Round Trips

**Coach view (`coach/students/[studentId]/page.tsx`):**
- 1 student fetch (sequential, before Promise.all)
- 9 parallel queries in Promise.all
- **Total: 10 round trips** (or 2 if `getSessionUser()` is cached: 1 student + 1 RPC)

**Owner view (`owner/students/[studentId]/page.tsx`):**
- 1 student fetch (sequential)
- 11 parallel queries in Promise.all (same 9 + coaches list + student counts)
- **Total: 12 round trips** (after: 1 student + 1 RPC)

### List Pages: Current State

**Owner students (`owner/students/page.tsx`):** Full fetch of ALL students with optional `.or()` filter. No pagination. `OwnerStudentSearchClient` does client-side filtering from the full dataset.

**Owner coaches (`owner/coaches/page.tsx`):** Full fetch of ALL coaches + ALL active students + 7-day reports. No pagination. Client-side aggregation in the component.

---

## Common Pitfalls

### Pitfall 1: unstable_cache Does Not Cache Supabase JS Errors
**What goes wrong:** If `admin.rpc("get_sidebar_badges")` returns an error, the `null` or error result gets cached for 60 seconds. Every badge render during that window shows wrong counts.
**Why it happens:** `unstable_cache` caches the return value of the wrapped function regardless of content. It does not know about Supabase error conventions.
**How to avoid:** In the cached function, return a safe fallback (`{}`) on error rather than returning `null` or re-throwing. Log the error but return the fallback:
```typescript
const getSidebarBadges = unstable_cache(
  async (userId: string, role: string) => {
    const { data, error } = await admin.rpc("get_sidebar_badges", {...});
    if (error) {
      console.error("[layout] Badge RPC failed:", error);
      return {};  // Safe fallback — don't cache an error state
    }
    return data as BadgeCounts;
  },
  ...
);
```
**Warning signs:** Sidebar shows 0 badges persistently for 60 seconds after a DB connectivity blip.

### Pitfall 2: React cache() Scope — Layout and Page Must Share the Same Import
**What goes wrong:** If `getSessionUser` is imported from different paths (e.g., `@/lib/session` in one file and `../../lib/session` in another), bundling may create two module instances with two separate `cache()` instances. The deduplication doesn't work.
**Why it happens:** Node.js module system deduplicates by resolved file path. If both imports resolve to the same absolute path, they share the same module instance and the cache works. This is not a concern in practice with TypeScript path aliases (`@/lib/session`) — just don't mix `@/` aliases with relative paths to the same file.
**How to avoid:** Always import session functions with `@/lib/session`, never with relative paths.
**Warning signs:** DB logs show 2 profile lookups per request even after adding `cache()`.

### Pitfall 3: unstable_cache Key Collision Between Users
**What goes wrong:** If the cache key prefix is the same for all users but the function arguments don't vary (e.g., accidentally calling the cached function with a constant instead of `userId`), all users share one cache entry and see each other's badge counts.
**Why it happens:** `unstable_cache` computes the actual cache key from the stable prefix array + the JSON-serialized function arguments. If `userId` is passed as `undefined` due to a bug, all calls with `undefined` share one cache entry.
**How to avoid:** Verify in layout that `profile.id` is always a valid UUID before calling the cached function. TypeScript strict mode catches `undefined` in most cases. Test with two different user sessions.
**Warning signs:** User A dismisses an alert; User B's badge count also drops immediately (shared cache).

### Pitfall 4: Pagination Page Param Injection
**What goes wrong:** `parseInt(searchParams.page, 10)` returns `NaN` if `page` is a string like `"abc"` or `"1; DROP TABLE"`. Passing `NaN` to `.range()` causes a Supabase error or returns unexpected results.
**Why it happens:** URL params are unvalidated strings.
**How to avoid:** Always clamp: `const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1)`. The `|| 1` handles `NaN`. The `Math.max(1, ...)` handles negative numbers.

### Pitfall 5: Missing revalidateTag on Invite Acceptance
**What goes wrong:** When a student accepts an invite and registers, the owner's `active_alerts` badge may be stale for 60 seconds (new student count doesn't trigger badge recomputation immediately).
**Why it happens:** D-08 in CONTEXT.md lists "student invite acceptance" as a mutation needing `revalidateTag('badges')` — but the invite acceptance flow happens in `POST /api/auth/callback` (OAuth) and `POST /api/invites` (invite creation), not in a direct badge-affecting route. The student count change affects badge thresholds.
**How to avoid:** Identify and add `revalidateTag("badges")` to the invite acceptance path. This is low-priority (60s staleness is acceptable for new user registration) but should be documented.

### Pitfall 6: STABLE Function Marking with Side Effects
**What goes wrong:** If `get_sidebar_badges` is marked `STABLE` but internally calls a volatile function or uses `NOW()` with non-deterministic results across transactions, Postgres may cache a stale result within the same transaction.
**Why it happens:** `STABLE` tells Postgres the function returns the same result for same inputs within a single transaction. `NOW()` is transaction-stable in Postgres (returns the transaction start time), so it IS safe. `CURRENT_DATE` is also transaction-stable.
**How to avoid:** All three RPCs in this phase are pure reads with `CURRENT_DATE` / `NOW()` date computations — `STABLE` is correct. If any future RPC writes data or uses truly volatile functions, use `VOLATILE` (default).

---

## Code Examples

### get_owner_dashboard_stats() — Full SQL

```sql
-- Source: v1.2 STACK.md Pattern + direct codebase analysis of owner/page.tsx
-- Replaces 4 parallel queries in owner/page.tsx
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_students',     (
      SELECT count(*) FROM users
      WHERE role = 'student' AND status = 'active'
    ),
    'total_coaches',      (
      SELECT count(*) FROM users
      WHERE role = 'coach' AND status = 'active'
    ),
    'active_today_count', (
      SELECT count(DISTINCT student_id) FROM work_sessions
      WHERE date = v_today
    ),
    'reports_today',      (
      SELECT count(*) FROM daily_reports
      WHERE date = v_today AND submitted_at IS NOT NULL
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

Note: `owner/page.tsx` currently uses `count: "exact"` head queries for students/coaches and fetches all session student_ids to compute distinct count. The RPC computes `count(DISTINCT student_id)` directly — equivalent. Reports count uses `date = v_today` + `submitted_at IS NOT NULL` — matches current filter.

### get_sidebar_badges() — SQL Skeleton

```sql
-- Source: v1.2 ARCHITECTURE.md Pattern 4 + direct analysis of layout.tsx owner badge logic
-- Consolidates: allStudents query, recentSessions, recentReports, unreviewedCount,
--               coaches, coachStudents, windowReports, alertDismissals (8 queries → 1)
CREATE OR REPLACE FUNCTION public.get_sidebar_badges(
  p_user_id uuid,
  p_role    text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result         jsonb;
  v_alert_count    integer := 0;
  v_unreviewed     integer := 0;
  v_dismissed      integer := 0;
  -- Thresholds from OWNER_CONFIG.alertThresholds in config.ts
  v_inactive_days  integer := 3;
  v_dropoff_days   integer := 7;
  v_coach_window   integer := 14;
  v_coach_rating   numeric := 2.5;
BEGIN
  IF p_role = 'owner' THEN
    -- Inactive + dropoff student alerts
    -- ... (see full implementation in migration)
    -- Unreviewed reports alert
    -- Coach underperformance alerts
    -- Subtract dismissed alerts
    SELECT count(*) INTO v_dismissed
    FROM alert_dismissals WHERE owner_id = p_user_id;

    v_result := jsonb_build_object(
      'active_alerts', GREATEST(0, v_alert_count - v_dismissed)
    );

  ELSIF p_role = 'coach' THEN
    SELECT count(*) INTO v_unreviewed
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

**Key implementation detail for owner alert logic:** The existing `layout.tsx` logic has a "grace period" for new students — students whose account age is below the dropoff/inactive threshold are skipped. This must be preserved exactly in the RPC SQL. See `layout.tsx` lines 115-126 for the exact logic.

### TypeScript RPC Types

```typescript
// src/lib/rpc/types.ts
// Hand-typed until npx supabase gen types runs against local instance

export type SidebarBadgesResult = {
  active_alerts?: number;       // owner only
  unreviewed_reports?: number;  // coach only
};

export type OwnerDashboardStats = {
  total_students: number;
  total_coaches: number;
  active_today_count: number;
  reports_today: number;
};

// Shape of get_student_detail() return
// Fields marked optional are owner-only (when p_include_coach_mgmt = true)
export type StudentDetailResult = {
  // Student profile
  student: {
    id: string;
    name: string;
    email: string;
    status: string;
    joined_at: string;
    coach_id: string | null;
  };
  // Calendar data (month-scoped)
  sessions: Array<{
    id: string;
    date: string;
    cycle_number: number;
    status: string;
    duration_minutes: number;
    session_minutes: number;
  }>;
  roadmap: Array<{
    step_number: number;
    status: string;
    completed_at: string | null;
  }>;
  reports: Array<{
    id: string;
    date: string;
    hours_worked: number;
    star_rating: number | null;
    brands_contacted: number;
    influencers_contacted: number;
    calls_joined: number;
    wins: string | null;
    improvements: string | null;
    reviewed_by: string | null;
  }>;
  // KPI aggregates
  kpi: {
    lifetime_outreach: number;
    today_outreach: number;
    today_minutes_worked: number;
    latest_session_date: string | null;
    latest_report_date: string | null;
    recent_ratings: number[];
  };
  // Owner-only fields (null when p_include_coach_mgmt = false)
  coaches?: Array<{ id: string; name: string; student_count: number }>;
};
```

### Pagination UI Component

```typescript
// src/components/ui/PaginationControls.tsx (NEW)
// Simple Previous/Next per D-12
"use client";
import Link from "next/link";

type Props = {
  page: number;
  totalPages: number;
  searchParams?: Record<string, string>;
};

export function PaginationControls({ page, totalPages, searchParams = {} }: Props) {
  const buildHref = (p: number) => {
    const params = new URLSearchParams({ ...searchParams, page: String(p) });
    return `?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-6 gap-4">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="min-h-[44px] px-4 py-2 ...">
          Previous
        </Link>
      ) : (
        <span className="min-h-[44px] px-4 py-2 opacity-40 cursor-not-allowed">Previous</span>
      )}
      <span className="text-sm text-ima-text-secondary">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="min-h-[44px] px-4 py-2 ...">
          Next
        </Link>
      ) : (
        <span className="min-h-[44px] px-4 py-2 opacity-40 cursor-not-allowed">Next</span>
      )}
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `export const revalidate = N` for Supabase route caching | `unstable_cache` with TTL | Next.js 13+ — `revalidate` never worked for cookie-dependent routes | Must use `unstable_cache` for any auth route wanting TTL caching |
| `count: 'exact'` for all paginated queries | `count: 'estimated'` for large tables | Supabase JS v2 added `estimated` option | Avoids full table scan O(n) on pagination — uses pg_class.reltuples O(1) |
| Per-call `createAdminClient()` | Module-level singleton (Phase 19) | Phase 19 complete | Already done — admin.ts has `let _adminClient` singleton |
| Separate `getUser()` calls in layout + page | React `cache()` on `getSessionUser()` | React 18/19 added `cache()` | Eliminates duplicate auth DB call per navigation |

**Deprecated/outdated:**
- `OwnerStudentSearchClient` client-side search: replaced by server-side `.ilike()` + URL params
- Per-call `createAdminClient()` pattern: already replaced by singleton in Phase 19, no change needed

---

## Open Questions

1. **alert_dismissals table structure**
   - What we know: `layout.tsx` queries `alert_dismissals` with `eq("owner_id", profile.id)` and gets a count. The `POST /api/alerts/dismiss` upserts `{ owner_id, alert_key }`.
   - What's unclear: The `get_sidebar_badges` RPC must subtract dismissed alerts. The current dismissal count logic (lines 177-181 in layout.tsx) subtracts total dismissals from total alert count — this is described as an "approximation." The RPC must replicate this approximation exactly.
   - Recommendation: Replicate the approximation exactly in SQL. Do not change the dismissal semantics during this phase.

2. **`get_student_detail` RPC: coach ownership check**
   - What we know: The coach student detail page currently fetches student with `.eq("coach_id", user.id)` as a defense-in-depth check. The RPC will be called with the student ID — the ownership check must move into the RPC or stay in the calling code.
   - What's unclear: Should the RPC return null/empty if the student doesn't belong to the calling coach (requiring `p_coach_id` parameter), or should ownership be verified by the caller before invoking the RPC?
   - Recommendation: Keep ownership check in the calling server component (fetch student first with `eq("coach_id", user.id)`, call `notFound()` if null, then call RPC with confirmed `student.id`). The RPC is owner-authenticated (SECURITY DEFINER / service_role) and does not need to enforce coaching relationships.

3. **`get_student_detail` for owner: first student fetch**
   - What we know: Owner detail page fetches student first (sequential) then fires 11 parallel queries. The student fetch includes `.eq("role", "student")` as a guard.
   - Clarification (not a question): The initial student fetch should NOT be included in the RPC — it gates the `notFound()` check and must happen before the RPC call. The RPC replaces only the 9/11 enrichment queries in the `Promise.all`.

---

## Environment Availability

Step 2.6: This phase is code changes + one new SQL migration file. External dependencies are the already-running Supabase project (used by Phase 19).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase db push` for migration | Yes | 2.78.1 | Manual SQL in Supabase dashboard |
| Node.js | Next.js dev + build | Yes | v24.13.0 | — |
| Next.js | App Router + unstable_cache | Yes | 16.1.6 | — |
| React | cache() import | Yes | 19.x (bundled with Next) | — |

**No missing dependencies.** This phase is pure code + one SQL migration.

---

## Validation Architecture

`nyquist_validation` is enabled (per `.planning/config.json`).

### Test Framework

No automated test framework is installed (no jest.config, vitest.config, or test scripts in package.json). This is consistent with the existing project — testing has been manual/build verification throughout v1.0 and v1.1.

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | `npm run build && npm run lint && npx tsc --noEmit` |
| Full suite command | Same — manual verification via `npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| QUERY-01 | Owner dashboard fires ≤2 Postgres round trips | Manual — pg_stat_statements query log | `npm run build` (smoke) | Verify via Supabase SQL: `SELECT query, calls FROM pg_stat_statements` |
| QUERY-01 | `get_owner_dashboard_stats()` + `get_sidebar_badges()` RPCs exist and return correct data | Manual — SQL Editor test | `npm run build` | Test RPCs in Supabase SQL Editor before page swap |
| QUERY-02 | Student detail pages use `get_student_detail()` RPC | Manual — browser smoke test | `npm run build` | Navigate to a student detail page as coach/owner |
| QUERY-03 | `getSessionUser()` dedup — second call in same render tree hits cache | Manual — add console.log in getSessionUser body | `npm run build` | Log should fire once per navigation, not twice |
| QUERY-04 | Badge counts cached for 60s, invalidated on mutation | Manual — submit report, verify badge updates | `npm run build` | Watch browser network tab and Supabase logs |
| QUERY-05 | Student list shows 25/page with working Previous/Next | Manual — browser test with >25 students | `npm run build` | Check page 1, page 2, search, search reset |
| QUERY-06 | Coach list shows 25/page with working Previous/Next | Manual — browser test with >25 coaches | `npm run build` | Same as QUERY-05 |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full `npm run build` green + manual browser smoke test of all 6 modified pages before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework installed — all validation is manual + build verification. This is consistent with the existing project approach and acceptable for this phase.
- [ ] RPC functions should be tested in Supabase SQL Editor before page integration: `SELECT get_owner_dashboard_stats(); SELECT get_sidebar_badges('owner-uuid', 'owner');`

*(No new test infrastructure needed — existing build-level verification is the established project pattern.)*

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are directly relevant to this phase. The planner MUST ensure all tasks comply.

| Directive | Applies To | Compliance Check |
|-----------|------------|-----------------|
| **Proxy not middleware** — `src/proxy.ts`, NOT `middleware.ts` | No route changes in this phase — N/A | N/A |
| **Admin client only in server code** — never in client components | All RPC calls go through admin client in server components | All new `admin.rpc()` calls are in async server pages and layout |
| **Config is truth** — import from `src/lib/config.ts` | `OWNER_CONFIG.alertThresholds` values used in RPC hardcoded constants | Planner must ensure RPC SQL thresholds match `OWNER_CONFIG.alertThresholds` exactly from config.ts |
| **Never swallow errors** — every `catch` block must toast or `console.error` | All new data-fetch functions | unstable_cache wrapper must `console.error` on RPC error |
| **Zod import** — `import { z } from "zod"`, never `"zod/v4"` | No new Zod schemas in this phase | N/A |
| **ima-* tokens only** — no hardcoded hex/gray | PaginationControls component | Use `text-ima-text`, `text-ima-text-secondary`, `bg-ima-primary` in pagination UI |
| **44px touch targets** — `min-h-[44px]` on all interactive elements | PaginationControls Previous/Next buttons | Both buttons need `min-h-[44px]` |
| **Accessible labels** — every input needs aria-label or label | Search input on student/coach list pages | Server-side search `<input>` needs `aria-label="Search students"` |
| **motion-safe:** — every `animate-*` class uses `motion-safe:animate-*` | No animations added in this phase | N/A |
| **Check response.ok** — every `fetch()` must check `response.ok` | No new `fetch()` calls in this phase | N/A |

**Critical constraint for planner:** The alert threshold values in `get_sidebar_badges` SQL MUST use the exact same values as `OWNER_CONFIG.alertThresholds` in `src/lib/config.ts`:
- `studentInactiveDays: 3`
- `studentDropoffDays: 7`
- `coachUnderperformingRating: 2.5`
- `coachUnderperformingWindowDays: 14`
- `reportInboxDays: 7` (from `COACH_CONFIG`)

These are hardcoded into the SQL function body. If the config values change in the future, the migration must be updated. Document this coupling clearly in the SQL function comments.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis — `src/app/(dashboard)/layout.tsx` (exact query count: 10 round trips for owner)
- Direct codebase analysis — `src/app/(dashboard)/owner/page.tsx` (4 queries)
- Direct codebase analysis — `src/app/(dashboard)/coach/students/[studentId]/page.tsx` (9 queries in Promise.all)
- Direct codebase analysis — `src/app/(dashboard)/owner/students/[studentId]/page.tsx` (11 queries in Promise.all)
- `.planning/research/ARCHITECTURE.md` — Patterns 2, 3, 4, 5 directly applicable
- `.planning/research/PITFALLS.md` — Pitfalls 7, 8 directly applicable (unstable_cache scope, RPC over-consolidation)
- `.planning/research/STACK.md` — RPC pattern, no new npm deps required
- `supabase/migrations/00001_create_tables.sql` — Table schemas, existing helper functions
- `.planning/phases/20-query-consolidation-caching/20-CONTEXT.md` — All locked decisions

### Secondary (MEDIUM confidence)
- Next.js 16 `unstable_cache` behavior confirmed in REQUIREMENTS.md Out of Scope (revalidate=N broken on auth routes)
- Supabase `count: 'estimated'` confirmed in REQUIREMENTS.md QUERY-05 and CONTEXT.md D-09

### Tertiary (LOW confidence)
- None — all findings sourced from HIGH confidence direct codebase analysis and verified v1.2 research docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all built-ins verified in existing project
- Architecture: HIGH — patterns directly sourced from v1.2 ARCHITECTURE.md verified against codebase
- Pitfalls: HIGH — sourced from v1.2 PITFALLS.md written for exactly this phase

**Research date:** 2026-03-30
**Valid until:** 2026-05-30 (stable APIs — React cache(), unstable_cache, Supabase .rpc())
