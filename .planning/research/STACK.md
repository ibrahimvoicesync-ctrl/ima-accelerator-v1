# Stack Research

**Domain:** Coaching / student performance management platform
**Researched:** 2026-03-27 (v1.1 update — new features only), 2026-03-29 (v1.2 update — performance, scale, security), 2026-03-31 (v1.3 update — roadmap text/undo, session planner, motivational card)
**Confidence:** HIGH — versions verified against npm, official changelogs, and official docs

---

## v1.3 Additions (Roadmap Updates, Coach Undo, Session Planner, Motivational Card)

The validated v1.0, v1.1, and v1.2 stacks remain unchanged. This section documents what is **added or changed** for the four v1.3 features.

---

### No New npm Dependencies Needed

All v1.3 features are implementable with libraries already installed. Zero new packages.

| Feature | Required Capability | Covered By |
|---------|--------------------|-----------:|
| daily_plans JSONB storage | JSONB column in Postgres migration | Supabase / Postgres — already in stack |
| plan_json typed schema | Runtime validation | `zod` ^4.3.6 — already installed |
| Coach undo audit log | Append-only log table | Supabase / Postgres — already in stack |
| Undo PATCH endpoint | Route handler PATCH | Next.js 16 App Router — already in stack |
| Motivational card animation | `AnimatePresence` entrance | `motion` ^12.37.0 — already installed |
| Arabic text in motivational card | Unicode text + CSS direction | CSS `dir="rtl"` attribute + Inter font Unicode coverage |
| 4h work-time cap enforcement | Client-side sum + server validation | React 19 state + Zod schema on API |
| Alternating break type logic | Deterministic sequence | Pure TypeScript utility function |
| Stage headers in roadmap view | Grouping logic | `ROADMAP_STEPS` config already has `stage` + `stageName` |

---

### Database Changes (Migration Only — No npm Packages)

#### daily_plans Table

```sql
CREATE TABLE public.daily_plans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_date    date        NOT NULL,
  plan_json    jsonb       NOT NULL DEFAULT '[]',
  total_work_minutes integer NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'completed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, plan_date)
);
```

**Why JSONB for plan_json:** The plan is a structured array of session blocks (`[{ session_minutes, break_type, break_minutes, work_session_id | null }]`). The schema is fixed at build time (validated by Zod on every write) but varies in array length per student per day. JSONB avoids 3-4 join tables, allows the plan to be read and written as a single atomic unit, and is fast for the access pattern (always fetch entire plan for one student+date — never queried across students). GIN index not needed because query is always by `(student_id, plan_date)` primary key.

**Why total_work_minutes as a column:** The 4h cap (240 minutes, breaks excluded) is enforced on the server. Storing the pre-computed total as a regular column allows a simple `WHERE total_work_minutes <= 240` check without parsing JSONB on the DB side. The column is updated on every PATCH to the plan.

**RLS policy:** Students can only read/write their own row. Coaches and owners can read (no write). Admin client used in API routes as per existing pattern.

#### roadmap_undo_log Table

```sql
CREATE TABLE public.roadmap_undo_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  step_number  integer     NOT NULL CHECK (step_number BETWEEN 1 AND 15),
  reverted_by  uuid        NOT NULL REFERENCES public.users(id),
  reverted_at  timestamptz NOT NULL DEFAULT now(),
  prev_status  text        NOT NULL,   -- 'completed' (what it was before undo)
  new_status   text        NOT NULL    -- 'active' (what it became after undo)
);
```

**Why a separate log table:** The undo action is an irreversible administrative act (coach/owner reverting a student's completed step). An append-only log makes the audit trail explicit without polluting `roadmap_progress` with metadata columns. The log is queried only for admin-visible audit displays; it never affects the read path for students.

**RLS policy:** Insert allowed for coach/owner roles (via admin client in API route). Read allowed for coach/owner. Students cannot read or write this table.

---

### API Route Additions (No New Libraries)

#### PATCH /api/roadmap/undo

New route file: `src/app/api/roadmap/undo/route.ts`

**Pattern:** Follows the existing `PATCH /api/roadmap` route exactly — same auth check, admin client, rate-limit check, verifyOrigin CSRF, Zod safeParse, try/catch with console.error.

**Body schema:**
```typescript
const undoSchema = z.object({
  student_id: z.string().uuid(),
  step_number: z.number().int().min(1).max(15),
})
```

**Authorization:** Caller must be `coach` or `owner`. Coaches must have an assignment to the target student (query `users.coach_id` to verify). Owners can undo for any student.

**Steps:**
1. Verify step is currently `completed`
2. UPDATE `roadmap_progress` set `status = 'active'`, `completed_at = NULL`
3. If `step_number + 1` exists and is `active`, set it back to `locked`
4. INSERT into `roadmap_undo_log`
5. Return updated progress rows

**Why no next-step lock-back in step 3:** Only revert the next step if it is still `active` (student has not already completed it too). If student completed step N+1 after N, the coach must undo each step independently. This prevents accidental data loss on partial undos.

---

### Session Planner Architecture (No New Libraries)

#### Plan State in React

The planner uses React 19 `useState` for the plan array. The 4h cap is enforced both:
- **Client-side:** Computed from `plan.reduce((sum, block) => sum + block.session_minutes, 0)` before allowing "Add Session" — button is disabled when `totalWorkMinutes >= 240`
- **Server-side:** Zod schema validates `total_work_minutes <= 240` on every PATCH to `/api/daily-plans`

No `useOptimistic` needed for the planner — the plan is the source of truth, not a dashboard feed. Changes to the plan array are local until explicitly saved/confirmed.

#### Automatic Break Alternation

Pure TypeScript utility in `src/lib/session.ts` (or inline in config):

```typescript
// Deterministic: short → long → short → long based on session index
export function getNextBreakType(sessionIndex: number): "short" | "long" {
  return sessionIndex % 2 === 0 ? "short" : "long";
}
```

No library. Session index 0 = first session in the plan (short break after), index 1 = second session (long break after), etc.

#### Plan Execution via Existing WorkTracker

The daily session planner generates a plan but execution is handed off to the existing `WorkTrackerClient`. When a student starts a planned session, the planner passes `session_minutes` and the suggested `breakType` as props or URL params to the work tracker. The work session is created via the existing `POST /api/work-sessions` route. After completion, the plan's `work_session_id` is patched to link the completed session to the plan block.

---

### Motivational Card (No New Libraries)

#### Animation

`motion` is already installed at ^12.37.0. Use `AnimatePresence` + `motion.div` for the card entrance:

```typescript
import { AnimatePresence, motion } from "motion/react"

// Card slides in from bottom, fades out when dismissed
<AnimatePresence>
  {showCard && (
    <motion.div
      key="motivational-card"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* card content */}
    </motion.div>
  )}
</AnimatePresence>
```

All `animate-*` classes must use `motion-safe:` prefix per CLAUDE.md Hard Rules. When using motion.div props (not CSS classes), the `motion-safe:` prefix does not apply — the motion library respects `prefers-reduced-motion` via `useReducedMotion()` if needed.

#### Arabic Text Rendering

**No new library needed.** The motivational card includes Arabic text (motivational quotes from Abu Lahya). The approach:

1. Wrap Arabic text in a `<span lang="ar" dir="rtl">` element inline
2. Inter font (already loaded via next/font) includes Unicode coverage for Arabic characters — verified against the Inter font specimen
3. If Inter renders Arabic with poor ligature support at design review, add Noto Sans Arabic via `next/font/google` at the page level (no npm package — it is part of `next/font`)

**CSS pattern (no extra library):**
```tsx
<p className="text-center text-ima-text-secondary italic">
  <span lang="ar" dir="rtl" className="font-medium not-italic">
    العمل الصادق يفتح الأبواب
  </span>
</p>
```

The `dir="rtl"` scoped to the span prevents the surrounding LTR layout from being affected. Full-page RTL (`<html dir="rtl">`) is not needed since Arabic appears only in the motivational card — not sitewide.

**Tailwind 4 RTL/LTR variants:** Tailwind CSS 4 ships with `rtl:` and `ltr:` variants and logical property utilities (`ms-`, `me-`, `ps-`, `pe-`). These are available if layout adjustments are needed around the Arabic span. No plugin required for Tailwind 4. Verified: Tailwind CSS 4 includes built-in support for logical properties from v3.3+ onward.

---

### Zod v4 Import Clarification (CLAUDE.md Hard Rule)

The project has `zod` ^4.3.6 installed. The CLAUDE.md Hard Rule states: **`import { z } from "zod"` — never `"zod/v4"`**.

This is correct. Zod 4's main export from `"zod"` provides the full v4 API. The `"zod/v4"` subpath was a transitional compatibility shim during the v3→v4 migration window. For this project, always use `import { z } from "zod"`. Verified against the Zod v4 migration guide at zod.dev/v4/changelog.

**String validators in Zod v4:** `z.string().email()` and `z.string().uuid()` remain valid in Zod 4 (legacy method syntax still works). The top-level `z.email()` and `z.uuid()` forms are new aliases, not replacements. Either form works. Prefer the established method-chain form to match existing code in the project.

---

### Config Changes (No Migration)

**ROADMAP_STEPS in `src/lib/config.ts`:** The v1.3 roadmap text updates are pure config changes — no migration needed. The `roadmap_progress` table stores only `step_number` and `status`; `step_name` and `description` are display values rendered from config at runtime. Updating config automatically updates all displays for all students.

**Session planner config:** Add `PLANNER_CONFIG` constant to `src/lib/config.ts`:

```typescript
export const PLANNER_CONFIG = {
  maxWorkMinutes: 240,        // 4h cap, breaks excluded
  defaultSessionMinutes: 45,  // matches WORK_TRACKER.defaultSessionMinutes
  breakAlternation: {
    even: "short" as const,   // after session index 0, 2, 4...
    odd: "long" as const,     // after session index 1, 3, 5...
  },
} as const;
```

---

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-beautiful-dnd` or `@dnd-kit/core` | Drag-to-reorder sessions is V2+; v1.3 planner uses fixed ordered list | None — static add/remove UI |
| `react-query` / `swr` for plan sync | Overkill for a form-based plan that saves on explicit action | `useState` + `fetch` + `revalidatePath` |
| `i18next` / `next-intl` | Only the motivational card has Arabic; full i18n is V2+ | `lang="ar" dir="rtl"` inline span |
| `@supabase/realtime` subscriptions for planner | Plan is per-student, one editor — no concurrent edit problem | Plain PATCH + `revalidatePath` |
| Redis/Upstash for plan caching | Plan is user-specific, small (<1 KB), and mutated frequently — caching adds complexity with no benefit | `revalidatePath` after PATCH clears Next.js cache |
| `jsonwebtoken` for plan tokens | Already installed for magic links; planner does not need separate tokens | None |
| Noto Sans Arabic (npm install) | Not an npm package — if needed, load via `next/font/google` with no install step | `next/font/google` import |

---

## Version Compatibility

All new code uses libraries already installed. No compatibility risk from new additions.

| Package | Version in package.json | v1.3 Usage | Notes |
|---------|------------------------|-----------|-------|
| `motion` | ^12.37.0 | `AnimatePresence`, `motion.div` | React 19 compatible (verified: motion 12.1.0 fixed AnimatePresence strict mode issues with React 19) |
| `zod` | ^4.3.6 | `z.object()`, `z.string().uuid()`, `z.number().int()` | Full v4 API via `import { z } from "zod"` |
| `date-fns` | ^4.1.0 | No new usage in v1.3 | date-fns v4 has no breaking changes for existing format/parse utilities used in the project |
| `lucide-react` | ^0.576.0 | New icons for planner UI (`CalendarPlus`, `Undo2`, `CheckCircle2`) | All required icons confirmed present in 0.576.0 |
| `@supabase/supabase-js` | ^2.99.2 | New `daily_plans` and `roadmap_undo_log` table queries | No API changes needed — same `.from()` / `.rpc()` patterns |
| `next` | 16.1.6 | New `PATCH /api/roadmap/undo` and `POST|PATCH /api/daily-plans` routes | Same App Router route handler pattern as all existing mutation routes |

---

## Sources

- [Zod v4 changelog](https://zod.dev/v4/changelog) — confirmed `import { z } from "zod"` is correct for v4; "zod/v4" is a transitional shim only
- [Supabase JSONB docs](https://supabase.com/docs/guides/database/json) — JSONB recommended for semi-structured data; GIN index when querying across keys (not needed here)
- [Motion React docs](https://motion.dev/docs/react) — AnimatePresence, motion.div, React 19 compatibility confirmed
- [Tailwind CSS RTL support](https://ryanschiang.com/tailwindcss-direction-rtl) — `rtl:` / `ltr:` variants and logical properties built into Tailwind 4; no plugin needed
- [date-fns v4 release notes](https://blog.date-fns.org/v40-with-time-zone-support/) — v4 breaking changes are type-only; no behavioral changes affecting existing usage
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — PATCH route handler pattern confirmed for App Router

---

*Stack research for: coaching / student performance management platform (v1.3 additions only)*
*Researched: 2026-03-31*

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

**`unstable_cache()` from Next.js** — cross-request persistent cache (replaces `fetch` cache for Supabase):

```typescript
import { unstable_cache } from "next/cache"

export const getOwnerDashboardStats = unstable_cache(
  async () => {
    const admin = createAdminClient()
    const { data } = await admin.rpc('get_owner_dashboard_stats')
    return data
  },
  ['owner-dashboard-stats'],    // cache key
  {
    revalidate: 300,             // 5-minute TTL
    tags: ['dashboard-owner'],   // invalidation tag
  }
)
```

Call `revalidateTag('dashboard-owner')` from a mutation route to flush.

---

### Security Pattern (API Routes)

Every mutation route (`POST`, `PATCH`, `DELETE`) must follow this exact sequence:

```typescript
export async function PATCH(request: NextRequest) {
  // 1. CSRF — Origin header must match
  const csrfError = verifyOrigin(request)
  if (csrfError) return csrfError

  // 2. Auth — Supabase session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 3. Profile + role — admin client bypasses RLS
  const admin = createAdminClient()
  const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", user.id).single()
  if (!profile || profile.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // 4. Rate limit
  const { allowed, retryAfterSeconds } = await checkRateLimit(profile.id, "/api/route-name")
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } })

  // 5. Parse + validate body
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  // 6. Business logic
  // ...
}
```

---

## v1.1 Additions (Flexible Sessions, KPI Tracking, Calendar View, Roadmap Dates)

The validated v1.0 stack remains unchanged. This section documents what is **added** for v1.1 features.

---

### No New npm Dependencies Needed for v1.1

| Feature | Capability | Covered By |
|---------|-----------|-----------|
| Session duration selector | UI state, config-driven options | React state + `WORK_TRACKER.sessionDurationOptions` config |
| Break countdown timer | Interval-based countdown | `setInterval` / `useEffect` — no library |
| Calendar month view | Month grid with activity dots | `react-day-picker` ^9.x — already in stack |
| KPI progress banners | Percentage calculations, RAG colors | Pure math + Tailwind CSS color classes |
| Roadmap deadline status | Date comparison, status enum | `date-fns` ^4.x — already in stack |

`react-day-picker` was already included in the v1.0 stack for the calendar feature. No new packages are needed for any v1.1 feature.

---

### react-day-picker Usage Pattern

```typescript
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"  // required base styles

// Month grid with custom day content
<DayPicker
  mode="single"
  month={displayMonth}
  onMonthChange={setDisplayMonth}
  components={{
    Day: ({ date, ...props }) => (
      <td {...props}>
        <button className="relative">
          {date.getDate()}
          {hasActivity(date) && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
          )}
        </button>
      </td>
    )
  }}
/>
```

**Version note:** `react-day-picker` v9 (installed) has a breaking API from v8. It no longer exports `format` from date-fns internally — pass `formatters` prop if custom date formatting is needed. The `DayPicker` component is the primary export; `Calendar` wrapper from shadcn is not used in this project.

---

### date-fns Usage for Roadmap Deadlines

```typescript
import { differenceInCalendarDays, parseISO, addDays } from "date-fns"

// Determine deadline status for a roadmap step
export function getDeadlineStatus(
  joinedAt: string,
  targetDays: number | null,
  completedAt: string | null
): "none" | "completed" | "on-track" | "due-soon" | "overdue" {
  if (targetDays === null) return "none"
  if (completedAt) return "completed"

  const deadline = addDays(parseISO(joinedAt), targetDays)
  const daysUntilDue = differenceInCalendarDays(deadline, new Date())

  if (daysUntilDue < 0) return "overdue"
  if (daysUntilDue <= 2) return "due-soon"
  return "on-track"
}
```

---

## Baseline v1.0 Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | App Router with Server Components eliminates separate API layer for reads; route handlers handle mutations. `src/proxy.ts` replaces middleware for route guarding in Next.js 16. |
| React | 19.2.3 | UI library | Concurrent features, `useOptimistic`, `cache()` built-in. Required by Next.js 16. |
| TypeScript | ^5 | Type safety | Strict mode enabled. Catches Supabase type mismatches at compile time. |
| Supabase | `@supabase/supabase-js` ^2.99.2, `@supabase/ssr` ^0.9.0 | Auth + Postgres + RLS | Three client types: `createClient` (server, cookie-based), `createAdminClient` (server, service_role, bypasses RLS), browser client for auth callbacks. SSR package handles cookie management in App Router. |
| Tailwind CSS | ^4 | Styling | CSS-first config in v4 — no `tailwind.config.js`. `ima-*` design tokens defined in CSS. CVA-based component primitives. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | CVA component variants | All `src/components/ui/` primitives — Button, Badge, Card variants |
| `clsx` + `tailwind-merge` | ^2.1.1 + ^3.5.0 | Class merging | `cn()` utility used everywhere for conditional class composition |
| `zod` | ^4.3.6 | Schema validation | Every API route input — `safeParse` pattern, never `parse` (throws) |
| `lucide-react` | ^0.576.0 | Icons | All UI icons — tree-shaken, consistent stroke style |
| `react-hook-form` | ^7.71.2 | Form state management | Any form with >2 fields — daily report, invite forms |
| `react-day-picker` | ^9.14.0 | Calendar month grid | Student calendar view on coach/owner detail pages |
| `date-fns` | ^4.1.0 | Date utilities | Roadmap deadline calculations, calendar date formatting |
| `motion` | ^12.37.0 | Animation | Work tracker phase transitions, motivational card entrance |
| `jsonwebtoken` | ^9.0.3 | JWT signing | Magic link token generation and verification only |
| `server-only` | ^0.0.1 | Server boundary enforcement | Import in any file that must never be bundled client-side (admin client, server queries) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `supabase` CLI | ^2.78.1 | Local Postgres, Auth, Studio, migrations | `npx supabase start` spins up Docker containers. `npx supabase migration new` creates migration files. |
| ESLint + `eslint-config-next` | ^9 + 16.1.6 | Linting | Next.js rules included. `npm run lint` runs it. |
| TypeScript strict | ^5 | Type checking | `npx tsc --noEmit` — must pass with zero errors before any commit. |

---

### Integration Points Summary

**Admin client rule:** Every `.from()` query in an API route handler must use `createAdminClient()`. Never use the cookie-based `createClient()` for database queries in route handlers — it relies on RLS which can fail during profile resolution.

**Route handler auth sequence:** CSRF check → Supabase auth → admin client profile → role check → rate limit → Zod validation → business logic. Never reorder these steps.

**Config is truth:** `src/lib/config.ts` is the single source for roles, nav items, roadmap steps, session options, KPI targets. Never hardcode these values in components.

**`server-only` imports:** Any file that imports `createAdminClient` must either live in `src/app/api/` or import `server-only` at the top. This prevents accidental client bundle inclusion.
