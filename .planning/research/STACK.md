# Stack Research

**Domain:** Coaching / student performance management platform
**Researched:** 2026-03-27 (v1.1 update — new features only), 2026-03-29 (v1.2 update — performance, scale, security), 2026-03-31 (v1.3 update — roadmap text/undo, session planner, motivational card), 2026-04-03 (v1.4 update — student_diy role, chat, resources tab, Discord embed, glossary, skip tracker, coach assignments, report comments, configurable invite limits), 2026-04-06 (v1.5 update — deal tracking: revenue + profit per student)
**Confidence:** HIGH — versions verified against installed node_modules and existing codebase patterns

---

## v1.5 Additions (Deal Tracking)

The validated v1.0–v1.4 stacks remain unchanged. This section documents what is **added or changed** for the v1.5 deal tracking feature.

---

### No New npm Dependencies Needed

All v1.5 features are implementable with the libraries already installed. Zero new packages required.

| Feature | Required Capability | Covered By |
|---------|--------------------|-----------:|
| Deal CRUD form (revenue + profit) | Form state, validation, submission | `react-hook-form` ^7.71.2 + `zod` ^4.3.6 — already installed |
| Deal modal (add / edit) | Accessible dialog, focus trap, portal | `Modal` component in `src/components/ui/Modal.tsx` — already exists |
| Optimistic deal list (add/delete) | Immediate UI feedback before API round trip | React 19 `useOptimistic` + `startTransition` — built into React 19.2.3 |
| Paginated deal history (25/page) | URL-driven page state, prev/next links | `PaginationControls` component + `searchParams` in Server Components — already exists |
| Currency / numeric display | Format numbers as currency strings | `Intl.NumberFormat` — built into all modern browsers, no library |
| Dashboard stats (deals closed, revenue, profit) | Aggregate queries | Supabase Postgres + admin client — already in stack |
| Auto-increment deal_number per student | Sequence scoped to student | Postgres `ROW_NUMBER()` on insert or trigger-based counter — no npm package |
| Rate limiting on deal mutations | 30 req/min per user | `checkRateLimit()` from `src/lib/rate-limit.ts` — already in stack |
| CSRF on deal mutations | Origin header verification | `verifyOrigin()` from `src/lib/csrf.ts` — already in stack |
| RLS on deals table | Student reads own; coach reads assigned; owner reads all | Supabase RLS policies — already in stack pattern |

**Confirmed: zero new npm installs for v1.5.**

---

### New Database Table: `deals`

One new table is required. It follows the same pattern as all v1.x tables: UUID primary key, `student_id` FK, `created_at` / `updated_at` timestamps, RLS policies.

```sql
-- Migration: 00021_deals.sql
CREATE TABLE public.deals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deal_number   integer     NOT NULL,  -- auto-incremented per student (see below)
  revenue       numeric(12, 2) NOT NULL CHECK (revenue >= 0),
  profit        numeric(12, 2) NOT NULL CHECK (profit >= 0),
  closed_at     date        NOT NULL DEFAULT CURRENT_DATE,
  notes         text        CHECK (char_length(notes) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, deal_number)
);

-- Index: student_id is the dominant query predicate (all reads filter by student)
CREATE INDEX idx_deals_student_id ON public.deals(student_id, closed_at DESC);

-- Trigger: auto-update updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
```

**Why `numeric(12, 2)` not `integer` for revenue/profit:** Deal values can include cents (e.g., $1,250.50). `numeric(12, 2)` stores up to 10 digits before the decimal with exact precision — no floating-point rounding errors. This is the correct Postgres type for monetary amounts. `integer` would truncate fractional values; `float` would introduce IEEE 754 rounding errors that affect sum/avg aggregates. `numeric` is slower than `float` for pure arithmetic but at deal-tracking scale (hundreds of rows per student at most) this is irrelevant.

**Why `CHECK (revenue >= 0)` not `CHECK (revenue > 0)`:** Allows $0 deals to be recorded (e.g., a deal that turned out to be a trade/barter with no cash component). A deal_number = 1 with revenue = 0 is a legitimate tracking entry.

**Why `closed_at date` not `created_at` for date display:** The student records when the deal actually closed — which may differ from when they entered it in the platform. `created_at` is the database insert time; `closed_at` is the business date. Dashboard stats should aggregate by `closed_at`, not `created_at`.

**deal_number auto-increment per student:**

Use a before-insert trigger to assign the next sequential number scoped to the student:

```sql
CREATE OR REPLACE FUNCTION assign_deal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(deal_number), 0) + 1
    INTO NEW.deal_number
    FROM public.deals
   WHERE student_id = NEW.student_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_deal_number
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION assign_deal_number();
```

**Why trigger not application-layer sequence:** Application-layer `MAX(deal_number) + 1` is vulnerable to a race condition when two inserts arrive concurrently — both could read the same max and produce a duplicate. The trigger runs inside the INSERT transaction under a row-level lock on the new row, so it is safe. The `UNIQUE (student_id, deal_number)` constraint is a final safety net if the trigger somehow races (Postgres will raise a 23505 conflict error, which the API route handles).

**RLS policies:**

```sql
-- Students read/write their own deals
CREATE POLICY "students_own_deals" ON public.deals
  FOR ALL
  USING (student_id = get_user_id())
  WITH CHECK (student_id = get_user_id());

-- Coaches read deals of their assigned students
CREATE POLICY "coaches_read_assigned_deals" ON public.deals
  FOR SELECT
  USING (
    get_user_role() = 'coach' AND
    student_id IN (
      SELECT id FROM public.users WHERE coach_id = get_user_id()
    )
  );

-- Owner reads all deals
CREATE POLICY "owner_read_all_deals" ON public.deals
  FOR SELECT
  USING (get_user_role() = 'owner');

-- Owner can delete any deal; coach can delete assigned student deals
CREATE POLICY "coach_owner_delete_deals" ON public.deals
  FOR DELETE
  USING (
    get_user_role() = 'owner'
    OR (
      get_user_role() = 'coach' AND
      student_id IN (SELECT id FROM public.users WHERE coach_id = get_user_id())
    )
  );
```

**RLS initplan fix (critical — matches v1.2 pattern):** The `get_user_id()` and `get_user_role()` functions must use `STABLE` and the pattern established in migration `00009_database_foundation.sql` to avoid per-row re-evaluation. All existing RLS policies in this codebase follow this pattern — the deals table must match it exactly.

---

### Currency Formatting — `Intl.NumberFormat` (No Library)

The codebase currently formats numbers inline with `.toLocaleString()` and `.toFixed()`. For deal revenue/profit amounts, use a shared utility function in `src/lib/utils.ts`:

```typescript
/**
 * Format a numeric value as a currency string.
 * Uses Intl.NumberFormat for locale-aware formatting.
 * Default: USD with 2 decimal places.
 *
 * Examples:
 *   formatCurrency(1250)     → "$1,250.00"
 *   formatCurrency(1250.5)   → "$1,250.50"
 *   formatCurrency(0)        → "$0.00"
 */
export function formatCurrency(
  amount: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

**Why `Intl.NumberFormat` not manual string formatting:** `Intl.NumberFormat` handles thousands separators, decimal formatting, and currency symbol placement correctly for all locales — zero configuration needed for the common `en-US` case. Manual formatting (`"$" + (amount / 100).toFixed(2)`) breaks on non-US locales and is harder to read. `Intl` is built into V8/Node.js and all modern browsers — confirmed available in Node.js 20+ and Next.js 16 server environment.

**Why not `dinero.js` or `currency.js`:** The platform handles display-only monetary values. There are no multi-currency conversions, no arithmetic on currency amounts that could compound rounding errors, and no internationalization beyond a single locale. `Intl.NumberFormat` covers 100% of the requirement. Adding a currency library for a display formatting function is unnecessary complexity.

**Storing amounts from the form:** The deal form collects revenue and profit as text inputs (type="number"). Before sending to the API, parse with `parseFloat()` and round to 2 decimal places:

```typescript
revenue: Math.round(parseFloat(rawRevenue) * 100) / 100
```

The Zod schema on the API route validates:

```typescript
const dealSchema = z.object({
  revenue:   z.number().min(0).max(9_999_999_999.99),
  profit:    z.number().min(0).max(9_999_999_999.99),
  closed_at: z.string().refine(isValidDateString, "Invalid date (YYYY-MM-DD)"),
  notes:     z.string().max(500).optional(),
});
```

---

### useOptimistic for Deal List CRUD

The codebase currently uses `useOptimistic` only for a single-item pattern (report submission banner in `ReportFormWrapper`). Deal tracking needs list CRUD — add, delete, and edit items optimistically.

**Pattern for optimistic list add:**

```typescript
"use client";
import { useOptimistic, startTransition } from "react";

type Deal = { id: string; deal_number: number; revenue: number; profit: number; closed_at: string };

// Initial deals come from the Server Component via props
const [optimisticDeals, dispatchOptimistic] = useOptimistic(
  deals,  // server-fetched initial state
  (state: Deal[], action: { type: "add"; deal: Deal } | { type: "delete"; id: string }) => {
    if (action.type === "add") return [action.deal, ...state];
    if (action.type === "delete") return state.filter((d) => d.id !== action.id);
    return state;
  }
);

// On form submit — show immediately, roll back on API failure
const handleAdd = async (formData: DealFormData) => {
  const optimisticDeal: Deal = {
    id: crypto.randomUUID(),  // temporary client-side ID
    deal_number: (optimisticDeals[0]?.deal_number ?? 0) + 1,
    ...formData,
  };

  startTransition(() => {
    dispatchOptimistic({ type: "add", deal: optimisticDeal });
  });

  const res = await fetch("/api/deals", { method: "POST", ... });
  if (!res.ok) {
    // No manual rollback needed — useOptimistic reverts when server state
    // is re-fetched via router.refresh(). The optimistic state is tied to
    // the underlying `deals` prop — when the page re-renders with updated
    // server data, the optimistic overlay is replaced.
  }
  router.refresh();
};
```

**Why `useOptimistic` over `useState` for the list:** `useState` would require manually syncing the client list with the server on every mutation (add/delete). `useOptimistic` automatically reverts to the server-provided `deals` prop on the next render after `router.refresh()` — so successful mutations replace the optimistic placeholder with the real DB row, and failed mutations automatically discard the temporary entry. No error-case rollback logic required.

**Deal number for optimistic add:** The optimistic deal_number is an estimate (`max + 1`). After `router.refresh()` the server-assigned real number replaces it. This is acceptable — the list is sorted by `closed_at DESC`, so the optimistic row's position in the list is correct even if the deal_number is briefly wrong.

---

### Pagination for Deal History (Existing Pattern)

Coach/owner student detail pages show the deal list with 25 items per page. The existing `PaginationControls` component and `searchParams`-based pagination pattern from `src/components/ui/PaginationControls.tsx` is reused exactly.

The Deals tab on the student detail page is a Server Component that receives `searchParams.page`, queries with `.range(from, to)` on the admin client, and passes `totalPages` + `page` to `PaginationControls`.

```typescript
const PAGE_SIZE = 25;
const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
const from = (page - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

const { data: deals, count } = await admin
  .from("deals")
  .select("*", { count: "estimated" })
  .eq("student_id", studentId)
  .order("closed_at", { ascending: false })
  .range(from, to);

const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
```

**Why `count: "estimated"` not `count: "exact"`:** Matches the existing pattern. For a few-hundred-row deal table, `estimated` is identical to `exact` in practice, and it avoids a separate `COUNT(*)` scan.

---

### Dashboard Stats Aggregation (No New Pattern)

The student dashboard (and student_diy dashboard) gains three new stat cards: Deals Closed, Total Revenue, Total Profit. These are computed with a single Supabase aggregate query in the Server Component — the same pattern as the existing outreach KPI aggregation:

```typescript
const { data: dealStats } = await admin
  .from("deals")
  .select("revenue, profit")
  .eq("student_id", user.id);

const dealsCount   = dealStats?.length ?? 0;
const totalRevenue = dealStats?.reduce((sum, d) => sum + Number(d.revenue), 0) ?? 0;
const totalProfit  = dealStats?.reduce((sum, d) => sum + Number(d.profit),  0) ?? 0;
```

**Why no RPC for this:** The deal stats are computed from a single table filtered by `student_id`. A direct `.select()` with `.reduce()` is simpler than an RPC and adequate for a student's own deal history (bounded by their deal count — never a full-table scan). Use an RPC only if the query joins multiple tables or needs to aggregate across all students.

**Why `Number(d.revenue)` not direct addition:** Supabase returns `numeric` columns as JavaScript strings when using the auto-generated types to prevent precision loss. Wrapping with `Number()` converts safely for display aggregation. The same pattern applies to `profit`.

---

### New API Routes

All new routes follow the established auth sequence:
`verifyOrigin → auth → admin profile → role check → checkRateLimit → Zod safeParse → business logic`

| Route | Methods | Roles | Purpose |
|-------|---------|-------|---------|
| `/api/deals` | POST | student, student_diy | Create a deal (student's own) |
| `/api/deals/[id]` | PATCH | student, student_diy | Edit a deal (own only) |
| `/api/deals/[id]` | DELETE | student, student_diy, coach, owner | Delete a deal (own for student; assigned for coach; any for owner) |

**No GET route needed:** Deal reads happen in Server Components via the admin client. GET API routes exist only for client-driven polling (chat) — deals use server-rendered pages.

**Authorization on DELETE:** The API route must verify ownership explicitly — do not rely solely on RLS:

```typescript
// Defense-in-depth: verify the deal belongs to a student the caller can manage
const { data: deal } = await admin.from("deals").select("student_id").eq("id", dealId).single();
if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

const isOwner        = profile.role === "owner";
const isStudentOwner = profile.role === "student" && deal.student_id === profile.id;
const isDiyOwner     = profile.role === "student_diy" && deal.student_id === profile.id;
const isCoachAssigned = profile.role === "coach" && /* verify coach_id on student row */ ...;

if (!isOwner && !isStudentOwner && !isDiyOwner && !isCoachAssigned) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

### Config Changes

Add a `DEALS_CONFIG` constant to `src/lib/config.ts`:

```typescript
export const DEALS_CONFIG = {
  pageSize:           25,     // items per page on coach/owner deal history tab
  maxRevenue:         9_999_999_999.99,  // matches Zod schema max
  maxProfit:          9_999_999_999.99,
  maxNotesLength:     500,    // matches DB CHECK constraint
  defaultCurrency:    "USD",
  currencyLocale:     "en-US",
} as const;
```

Add the Deals page route to `ROUTES`:

```typescript
// Student and student_diy both get the Deals route
student: {
  // ... existing routes
  deals: "/student/deals",
},
student_diy: {
  // ... existing routes
  deals: "/student-diy/deals",
},
```

Add "Deals" to the nav items for both `student` and `student_diy` roles in `NAV_ITEMS`.

---

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `dinero.js` | Monetary arithmetic library — overkill for display-only formatting | `Intl.NumberFormat` in `formatCurrency()` utility |
| `currency.js` | Same reason as dinero.js | `Intl.NumberFormat` |
| `@tanstack/react-table` | Full table library with sorting/filtering — no requirement for sortable columns in v1.5 | Plain `<table>` with Tailwind CSS and server-side ordering by `closed_at DESC` |
| `react-number-format` | Masked input library for currency fields | `<input type="number" step="0.01">` with Zod validation on submit |
| `@hookform/resolvers` + zodResolver | Connects Zod to react-hook-form at field level | Manual `trigger()` + `setError()` on submit, or inline Zod parse in `onSubmit` — matches existing ReportForm pattern |
| Supabase Realtime for deal updates | Not needed — deal list is not multi-user concurrent | Server Component + `router.refresh()` after mutation |
| Separate deal_number sequence (Postgres `SEQUENCE`) | Global sequence doesn't scope per student | Before-insert trigger reading `MAX(deal_number)` scoped to `student_id` |

---

### Version Compatibility

No new packages. All deal tracking code uses installed versions.

| Package | Installed Version | v1.5 Usage | Notes |
|---------|------------------|-----------|-------|
| `react` | 19.2.3 | `useOptimistic` with reducer function for list CRUD | `useOptimistic` with a reducer (2-arg form) confirmed stable in React 19 |
| `zod` | ^4.3.6 (installed: 4.3.6) | `dealSchema` with `z.number().min(0)` for revenue/profit | Same `z.object().safeParse()` pattern; import from `"zod"` not `"zod/v4"` |
| `react-hook-form` | ^7.71.2 (installed: 7.71.2) | Deal add/edit form — `useForm`, `register`, `handleSubmit` | No `zodResolver` needed; validate in `onSubmit` handler matching existing ReportForm pattern |
| `lucide-react` | ^0.576.0 | New icons: `DollarSign`, `TrendingUp`, `Briefcase`, `Plus`, `Pencil`, `Trash2` | All icons confirmed present in lucide-react 0.576.0 |
| `@supabase/supabase-js` | ^2.99.2 | New `deals` table queries, `.range()` pagination | Same `.from()` patterns as existing tables |
| `next` | 16.1.6 | New API routes `/api/deals` and `/api/deals/[id]`; new pages for Deals | Same App Router route handler and page pattern |
| `date-fns` | ^4.1.0 | `closed_at` date display in deal list | No new functions beyond existing usage |

---

### Sources

- Verified installed versions via `node_modules/*/package.json` — all versions current as of 2026-04-06
- [MDN Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — `style: "currency"` confirmed available in all modern browsers and Node.js 20+
- [React 19 useOptimistic docs](https://react.dev/reference/react/useOptimistic) — reducer (2-argument) form confirmed for list mutations; reverts automatically on `router.refresh()`
- [Postgres numeric type](https://www.postgresql.org/docs/current/datatype-numeric.html) — `numeric(p,s)` for exact decimal storage; recommended over `float` for monetary values
- [Postgres trigger-based sequences](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — before-insert trigger pattern for per-group sequence counters

---

*Stack research for: coaching / student performance management platform (v1.5 additions only)*
*Researched: 2026-04-06*

---

## v1.4 Additions (Roles, Chat & Resources)

The validated v1.0, v1.1, v1.2, and v1.3 stacks remain unchanged. This section documents what is **added or changed** for the nine v1.4 features.

---

### No New npm Dependencies Needed

All v1.4 features are implementable with libraries already installed. Zero new packages required.

| Feature | Required Capability | Covered By |
|---------|--------------------|-----------:|
| Polling chat (5s interval) | `setInterval` + `clearInterval` cleanup | `useEffect` / `useRef` — built into React 19, no library |
| Chat message state | Local state + fetch | React 19 `useState` — no library |
| Chat unread badge | Count-based derived state | React 19 state — no library |
| Discord WidgetBot embed | `<iframe>` with `src="https://e.widgetbot.io/channels/SERVER_ID/CHANNEL_ID"` | Native HTML iframe — no npm package (D-10 confirmed) |
| Glossary search | `Array.filter` + `String.includes` (case-insensitive) | Pure JavaScript — no search library needed for in-memory data |
| Glossary CRUD | Form state + fetch | `react-hook-form` ^7.71.2 — already installed |
| Resource link CRUD | Form state + fetch | `react-hook-form` ^7.71.2 — already installed |
| student_diy role (4th role) | Role type extension in config + proxy + types | `src/lib/config.ts` + `src/proxy.ts` — config-only changes |
| Skip tracker (ISO week days) | Postgres `date_trunc('week', ...)` + RPC | Supabase / Postgres — already in stack |
| Report comments | Single text column on daily_reports or separate table | Supabase / Postgres — already in stack |
| Coach assignment power | Existing assignments pattern extended to coach role | Next.js route handlers + Supabase — already in stack |
| Configurable invite max_uses | Integer column on invites table | Supabase / Postgres — already in stack |

**Confirmed: zero new npm installs for v1.4.**

---

### Why No Search Library for Glossary

The glossary is an owner/coach-managed list of terms — at V1 scale this is a few dozen to a few hundred entries, loaded once per page view. Client-side filtering with `Array.filter()` and `String.toLowerCase().includes()` handles this perfectly:

```typescript
const filtered = glossaryTerms.filter(
  (term) =>
    term.title.toLowerCase().includes(query.toLowerCase()) ||
    term.definition.toLowerCase().includes(query.toLowerCase())
)
```

Fuse.js (14 KB min+gzip) and similar fuzzy-search libraries solve a different problem: typo-tolerant search across thousands of records. For a glossary of coaching terms that students search by exact word, substring match is more predictable and requires no configuration. Add Fuse.js only if fuzzy matching becomes a user complaint in V2.

---

### Why No npm Package for Discord WidgetBot

Decision D-10 specifies iframe embed. The `@widgetbot/react-embed` npm package (v1.10.0) is **effectively unmaintained** — last GitHub commit was 2+ years ago, Snyk health analysis rates it as Inactive. The package itself is just a thin React wrapper around the same `<iframe src="https://e.widgetbot.io/...">` element; there is no additional functionality the package provides beyond what a plain iframe gives.

Plain iframe approach:

```tsx
// src/components/discord-embed.tsx
// "use client" — required because iframe dimensions may need ResizeObserver

export function DiscordEmbed({
  serverId,
  channelId,
}: {
  serverId: string
  channelId: string
}) {
  return (
    <iframe
      src={`https://e.widgetbot.io/channels/${serverId}/${channelId}`}
      allow="clipboard-write; fullscreen"
      className="w-full h-[600px] rounded-lg border border-ima-border"
      title="Discord community channel"
    />
  )
}
```

**CSP requirement:** The `next.config.ts` headers must include `frame-src 'self' https://e.widgetbot.io` to allow the WidgetBot iframe to load. Without this, browsers with a strict CSP will block the embed. Add to the `headers()` config in `next.config.ts`:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://e.widgetbot.io;",
          },
        ],
      },
    ]
  },
}
```

Note: The existing `next.config.ts` is currently empty (`/* config options here */`). The CSP header is a new addition — not a change to any existing header.

---

### Polling Chat Architecture (No New Libraries)

Decision D-07 specifies polling (not Supabase Realtime) to avoid the 500 peak connection limit on Supabase Pro.

**Pattern: `useInterval` custom hook**

```typescript
// src/lib/hooks/use-interval.ts
import { useEffect, useRef } from "react"

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback)

  // Keep ref current without resetting the interval
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return
    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}
```

**Usage in chat component:**

```typescript
// Poll every 5 seconds while tab is visible
useInterval(fetchMessages, 5000)
```

**Why `useRef` pattern over plain `useEffect`:** A naive `useEffect(() => { setInterval(fetch, 5000) }, [fetch])` re-registers the interval every time `fetch` is recreated. The `useRef` approach keeps a stable interval registration while always calling the latest version of the callback. This is especially important here because `fetch` depends on `conversationId` which can change.

**Fetch pattern:**

```typescript
// Only fetch messages newer than the last-seen message
const params = new URLSearchParams({
  conversation_id: conversationId,
  after: lastMessageTimestamp ?? "",  // ISO string or empty
})
const res = await fetch(`/api/chat/messages?${params}`)
if (!res.ok) return  // fail silently on network error — next poll will retry
```

Polling fetches only new messages (using `after` timestamp) to keep payloads small. The API route returns an empty array when there are no new messages. No backoff or exponential retry needed at this scale — 5s fixed interval is stable.

---

### student_diy Role Integration Points (Config + Proxy Only)

Decision D-14 expands the role type to four values. Changes touch three files:

**`src/lib/config.ts`:**
- Add `STUDENT_DIY: "student_diy"` to `ROLES` constant
- Update `Role` type to include `"student_diy"`
- Add `ROLE_HIERARCHY` entry: `student_diy: 1` (same tier as student)
- Add `ROLE_REDIRECTS` entry pointing to student_diy dashboard route
- Add student_diy nav items (dashboard + work tracker + roadmap only — no reports, no AI, no resources, no chat)
- Add student_diy routes to `ROUTES` constant

**`src/proxy.ts`:**
- Add `student_diy` to the role guard routing table
- Route `student_diy` requests to `/student-diy/...` paths
- Student_diy cannot access `/student/...`, `/coach/...`, or `/owner/...`

**`src/lib/types.ts`:**
- Add `"student_diy"` to `users.Row.role` union: `"owner" | "coach" | "student" | "student_diy"`
- Update Insert and Update types to match

**Database:**
- `users.role` column: add `"student_diy"` to the CHECK constraint in a migration
- No new tables required for the role itself

**Features student_diy has (D-06):** dashboard, work tracker, roadmap
**Features student_diy does NOT have (D-05):** Ask Abu Lahya, daily report, resources tab, chat
**No coach assignment (D-04):** `coach_id` is NULL for all student_diy users

---

### Skip Tracker — RPC Function (No New Libraries)

Decision D-01: "This week" = Monday-Sunday ISO week.

The skip tracker shows "X days skipped this week" on coach/owner dashboards. A skip = a calendar day in the current ISO week where the student has no completed work sessions.

**Implementation: Postgres RPC function**

```sql
-- Count "active" days in the current ISO week where a student has no
-- completed work sessions. Returns an integer 0-7.
CREATE OR REPLACE FUNCTION get_skip_count_this_week(p_student_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Monday of the current ISO week (date_trunc('week') returns Monday)
  week_start AS (
    SELECT date_trunc('week', now())::date AS monday
  ),
  -- All calendar days in this week up to (not including) today
  -- Only count days that have passed — today is not a skip yet
  week_days AS (
    SELECT generate_series(
      (SELECT monday FROM week_start),
      LEAST(now()::date - interval '1 day', (SELECT monday FROM week_start) + interval '6 days'),
      interval '1 day'
    )::date AS day
  ),
  -- Days with at least one completed session
  active_days AS (
    SELECT DISTINCT started_at::date AS day
    FROM work_sessions
    WHERE student_id = p_student_id
      AND status = 'completed'
      AND started_at >= (SELECT monday FROM week_start)
      AND started_at < (SELECT monday FROM week_start) + interval '7 days'
  )
  SELECT count(*)::integer
  FROM week_days
  WHERE day NOT IN (SELECT day FROM active_days)
$$;
```

**Why RPC not a computed column:** Skip count is derived from `work_sessions`, not stored. Computing it in Postgres avoids sending all work session rows to the application layer just to count calendar gaps. The `STABLE` marker allows Postgres to cache the result within the same transaction.

**Call from Server Component:**
```typescript
const { data: skipCount } = await adminClient.rpc("get_skip_count_this_week", {
  p_student_id: studentId,
})
```

---

### Report Comments Table (No New Libraries)

Decision D-03: Single comment per report, coach-only write, students can read on history.

**New table** `report_comments`:

```sql
CREATE TABLE public.report_comments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      uuid        NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
  coach_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment_text   text        NOT NULL CHECK (char_length(comment_text) <= 1000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id)  -- one comment per report
);
```

**Alternative considered:** Adding a `comment_text` column directly to `daily_reports`. Rejected because: (a) it mixes the student's report data with the coach's feedback in one row, (b) the comment has its own author (`coach_id`) and timestamp that belong on the comment, not the report, (c) a separate table enables future multi-comment threading (V2+) without a schema change.

**RLS:** Coach can INSERT/UPDATE only their own comments (`coach_id = auth_user_id`). Students can SELECT comments on their own reports. Owner can read all.

---

### Glossary Table (No New Libraries)

Decision D-12: Owner + coaches can CRUD glossary entries.

**New table** `glossary_terms`:

```sql
CREATE TABLE public.glossary_terms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  term        text        NOT NULL CHECK (char_length(term) <= 100),
  definition  text        NOT NULL CHECK (char_length(definition) <= 1000),
  created_by  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** Owner and coach can INSERT/UPDATE/DELETE. All authenticated users (owner/coach/student) can SELECT — student_diy cannot (no Resources tab per D-11). Enforce at the proxy level by not exposing the Resources tab to student_diy.

---

### Resource Links Table (No New Libraries)

**New table** `resource_links`:

```sql
CREATE TABLE public.resource_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL CHECK (char_length(title) <= 200),
  url         text        NOT NULL CHECK (url ~* '^https?://'),
  description text        CHECK (char_length(description) <= 500),
  created_by  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**RLS:** Owner and coach can INSERT/DELETE. All authenticated users (owner/coach/student) can SELECT.

---

### Chat Tables (No New Libraries)

Two tables for polling-based 1:1 + broadcast chat.

**`chat_conversations`** — groups messages by participant pair or broadcast channel:

```sql
CREATE TABLE public.chat_conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text        NOT NULL CHECK (type IN ('direct', 'broadcast')),
  -- For 'direct': coach_id + student_id both non-null
  -- For 'broadcast': coach_id non-null, student_id null
  coach_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id      uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, student_id)  -- one direct conversation per coach-student pair
);
```

**`chat_messages`** — individual messages within a conversation:

```sql
CREATE TABLE public.chat_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         text        NOT NULL CHECK (char_length(content) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**Index for polling:** Add `CREATE INDEX ON chat_messages (conversation_id, created_at DESC)` — the poll query always filters by `conversation_id` and orders by `created_at` to get only messages after the last-seen timestamp.

**Unread count:** Derive client-side from messages loaded since the chat tab was opened. No `read_at` column needed for V1 — unread badge resets on tab open.

**RLS:** A student can only read messages from conversations they are a participant in (their `student_id` matches). A coach can read messages from their conversations. Broadcast conversations are readable by all students linked to that coach.

---

### Invite max_uses Change (No New Tables)

Decision D-13: `invites.max_uses` defaults to 10 (was NULL/unlimited).

**Migration change only** — `ALTER TABLE public.invites ALTER COLUMN max_uses SET DEFAULT 10` if the column already exists, or add it if missing:

```sql
-- Check if max_uses already exists (it was added in an earlier migration)
-- If not: ALTER TABLE public.invites ADD COLUMN max_uses integer NOT NULL DEFAULT 10;
-- If yes: ALTER TABLE public.invites ALTER COLUMN max_uses SET DEFAULT 10;
--          UPDATE public.invites SET max_uses = 10 WHERE max_uses IS NULL;
```

The UI shows usage count — `current_uses` is a computed count of rows in a `invite_usages` table or a counter column on `invites`. The simpler V1 approach: add `use_count integer NOT NULL DEFAULT 0` to `invites` and increment on each use.

---

### API Route Additions (No New Libraries)

New routes follow the exact same auth sequence as all existing mutation routes:
`verifyOrigin → auth → admin profile → role check → checkRateLimit → Zod safeParse → business logic`

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat/conversations` | GET | List conversations for current user |
| `/api/chat/messages` | GET | Poll messages for a conversation (accepts `after` param) |
| `/api/chat/messages` | POST | Send a message |
| `/api/reports/[id]/comment` | POST/PATCH | Add or update coach comment on a report |
| `/api/glossary` | GET | List all terms (paginated) |
| `/api/glossary` | POST | Create a term (owner/coach only) |
| `/api/glossary/[id]` | PATCH | Update a term (owner/coach only) |
| `/api/glossary/[id]` | DELETE | Delete a term (owner/coach only) |
| `/api/resources` | GET | List resource links |
| `/api/resources` | POST | Create a resource link (owner/coach only) |
| `/api/resources/[id]` | DELETE | Delete a resource link (owner/coach only) |
| `/api/assignments` | POST/DELETE | Coach creates/removes student assignments (extended from owner-only) |
| `/api/invites/[id]` | PATCH | Update `max_uses` on an invite |

GET routes for chat polling do not need `verifyOrigin` (reads, no mutation). All POST/PATCH/DELETE routes must include `verifyOrigin`.

---

### Config Changes (No Migration)

**`src/lib/config.ts` additions for v1.4:**

```typescript
// 4th role
export const ROLES = {
  OWNER: "owner",
  COACH: "coach",
  STUDENT: "student",
  STUDENT_DIY: "student_diy",
} as const

// Chat polling interval
export const CHAT_CONFIG = {
  pollIntervalMs: 5000,       // 5-second polling interval
  maxMessageLength: 2000,     // matches DB CHECK constraint
  pageSize: 50,               // messages loaded per poll
} as const

// Invite defaults
export const INVITE_CONFIG = {
  defaultMaxUses: 10,
  expiryDays: 30,
} as const
```

---

### What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@widgetbot/react-embed` | Unmaintained (last commit 2+ years ago). It is a thin wrapper over the same `<iframe>` tag — no additional value. | Native `<iframe src="https://e.widgetbot.io/channels/...">` |
| `fuse.js` / `microfuzz` | Overkill for a few-hundred-row glossary. Fuzzy matching isn't needed for coaching terms. | `Array.filter` + `String.toLowerCase().includes()` |
| `socket.io` / `pusher-js` | Supabase Realtime avoided (D-07) due to 500 connection limit on Pro. WebSocket libraries solve the same problem. | `setInterval` polling via `useInterval` hook |
| `@supabase/realtime-js` (standalone) | Same reason as above — polling is the explicit decision to avoid connection pressure. | `useInterval` hook + `fetch` |
| `swr` / `react-query` | Chat polls every 5s; the custom `useInterval` + `fetch` pattern is 10 lines and has no caching indirection. | `useInterval` + `useState` |
| `lru-cache` (for chat) | Rate limiting already uses DB-backed `rate_limit_log` as of v1.2; the in-memory approach in v1.2 STACK.md was superseded by the DB implementation actually shipped. No in-memory cache needed for chat. | `checkRateLimit()` from `src/lib/rate-limit.ts` |
| `react-virtualized` / `react-window` | Chat messages are paginated (50 per fetch); virtualization is not needed at this scale. | Standard scrolling `<ul>` with `overflow-y-auto` |
| `marked` / `react-markdown` | Chat messages are plain text. Markdown rendering is not in scope. | Plain `<p>` with whitespace-preserved CSS |

---

## Version Compatibility

All new code uses libraries already installed. No compatibility risk from new additions.

| Package | Version in package.json | v1.4 Usage | Notes |
|---------|------------------------|-----------|-------|
| `react` | 19.2.3 | `useState`, `useEffect`, `useRef`, `useCallback` for polling hook | All hooks used are stable in React 19 |
| `zod` | ^4.3.6 | New schemas for chat messages, glossary terms, resource links | No new patterns — same `z.object().safeParse()` used throughout |
| `react-hook-form` | ^7.71.2 | Glossary CRUD form, resource link form | Already used for daily report; same pattern |
| `lucide-react` | ^0.576.0 | New icons: `MessageSquare`, `BookOpen`, `ExternalLink`, `Hash` | All icons confirmed present in 0.576.0 |
| `@supabase/supabase-js` | ^2.99.2 | New tables: chat_conversations, chat_messages, report_comments, glossary_terms, resource_links | Same `.from()` / `.rpc()` patterns as existing tables |
| `next` | 16.1.6 | New API routes for chat/glossary/resources; CSP header in `next.config.ts` | Same App Router route handler pattern |
| `date-fns` | ^4.1.0 | Chat message timestamps, ISO week boundaries for skip tracker display | No new functions beyond existing usage |

---

## Sources

- [WidgetBot iframe docs](https://docs.widgetbot.io/tutorial/iframes) — confirmed iframe URL format `https://e.widgetbot.io/channels/SERVER_ID/CHANNEL_ID`, required `allow="clipboard-write; fullscreen"` attributes
- [@widgetbot/react-embed npm](https://www.npmjs.com/package/@widgetbot/react-embed) — confirmed package is inactive (last npm publish 5 months ago, last GitHub commit 2+ years ago); plain iframe is the better choice
- [Snyk @widgetbot/react-embed health](https://snyk.io/advisor/npm-package/@widgetbot/react-embed) — Inactive maintenance status confirmed
- [MDN frame-src CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src) — `frame-src 'self' https://e.widgetbot.io` required to allow WidgetBot iframe
- [Next.js headers config](https://nextjs.org/docs/advanced-features/security-headers) — `headers()` in `next.config.ts` is the correct place for CSP
- [PostgreSQL date_trunc ISO week](https://weeknumber.com/how-to/postgres) — `date_trunc('week', now())` returns Monday of the current ISO week; `generate_series` for day enumeration
- [React useInterval pattern](https://www.davegray.codes/posts/usepolling-custom-hook-for-auto-fetching-in-nextjs) — `useRef` + `useEffect` pattern for stable polling without re-registration
- [Fuse.js](https://www.fusejs.io/) — evaluated and rejected; `Array.filter` is sufficient for glossary at this scale

---

*Stack research for: coaching / student performance management platform (v1.4 additions only)*
*Researched: 2026-04-03*

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

**Pattern:** Follows the existing `PATCH /api/roadmap` route exactly — same auth check, admin client, rate-limit check, verifyOrigin CSRF, Zod safeParse, try-catch with console.error.

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

### What NOT to Add (v1.3)

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

## Sources (v1.3)

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

**Note:** The v1.2 STACK.md documented `lru-cache` as the rate-limiting implementation. The actual shipped implementation in `src/lib/rate-limit.ts` uses DB-backed rate limiting via the `rate_limit_log` table instead. The `lru-cache` package may not be in `package.json`. New v1.4 code should use `checkRateLimit()` from `src/lib/rate-limit.ts` (DB-backed), not an in-memory LRU store.

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

**Approach: DB-backed rate limiting via `rate_limit_log` table**

The `src/lib/rate-limit.ts` uses the `rate_limit_log` table (added in migration 00012) with a covering index. `checkRateLimit(userId, endpoint)` counts recent requests within the rolling window and inserts a log row on success.

```typescript
// Usage in every API mutation route:
const { allowed, remaining, retryAfterSeconds } = await checkRateLimit(
  profile.id,
  "/api/route-name"
)
if (!allowed) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  )
}
```

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
