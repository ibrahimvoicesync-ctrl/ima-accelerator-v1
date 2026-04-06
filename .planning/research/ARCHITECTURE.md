# Architecture Research

**Domain:** Deal tracking integration into existing Next.js 16 + Supabase coaching platform
**Researched:** 2026-04-06
**Confidence:** HIGH (based on direct codebase analysis of v1.4 codebase; no speculation)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Browser Layer                                  │
│  /student/deals         /student_diy/deals    Coach/Owner Detail      │
│  DealsClient (CRUD)     DealsClient (CRUD)    DealsTab (read-only)    │
│  useOptimistic add/del  same component        paginated, 25/page      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                     Next.js 16 App Router                             │
│  src/proxy.ts — no change needed                                      │
│  /student/* and /student_diy/* already protected                      │
│  /api/* excluded from proxy                                           │
│                                                                       │
│  Server Components (reads)       Route Handlers (mutations + GETs)   │
│  ─────────────────────────       ─────────────────────────────────   │
│  /student/deals/page.tsx         POST   /api/deals                    │
│  /student_diy/deals/page.tsx     PATCH  /api/deals/[id]               │
│  /student/page.tsx (stats)       DELETE /api/deals/[id]               │
│  /student_diy/page.tsx (stats)   GET    /api/deals?student_id=X&page=N│
│  /coach/students/[id]/page.tsx                                        │
│  /owner/students/[id]/page.tsx                                        │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│                      Supabase Postgres                                │
│                                                                       │
│  NEW: deals                                                           │
│    id, student_id, deal_number (per-student auto-inc), revenue,       │
│    profit, date, notes, created_at, updated_at                        │
│                                                                       │
│  MODIFIED: student_kpi_summaries                                      │
│    + total_deals integer, total_revenue numeric, total_profit numeric │
│    (refreshed nightly by existing pg_cron job)                        │
│                                                                       │
│  UNCHANGED: rate_limit_log (reused for /api/deals)                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Type |
|-----------|----------------|------|
| `deals` table | Source of truth for all student deal records | DB |
| `student_kpi_summaries` (cols added) | Pre-aggregated totals for dashboard stats | DB |
| `POST /api/deals` | Create a deal (student, student_diy only) | Route Handler |
| `PATCH /api/deals/[id]` | Edit revenue/profit/notes on own deal | Route Handler |
| `DELETE /api/deals/[id]` | Delete deal — scoped by role | Route Handler |
| `GET /api/deals` | Paginated deal list for coach/owner viewing a student | Route Handler |
| `DealsClient` | Student-facing CRUD UI — add/edit/delete + useOptimistic | Client Component |
| `DealsTab` | Read-only tab for coach and owner student detail — paginated table | Client Component (pagination) |
| Dashboard stat cards | "Deals Closed", "Total Revenue", "Total Profit" — rendered in server component | Server Component |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── deals/
│   │       ├── route.ts               # GET (paginated coach/owner list) + POST (student create)
│   │       └── [id]/
│   │           └── route.ts           # PATCH (student edit own) + DELETE (scoped by role)
│   └── (dashboard)/
│       ├── student/
│       │   └── deals/
│       │       └── page.tsx           # Server shell: fetch initial deals + totals → DealsClient
│       └── student_diy/
│           └── deals/
│               └── page.tsx           # Identical structure to student/deals/page.tsx
├── components/
│   ├── student/
│   │   └── DealsClient.tsx            # "use client" — CRUD UI, useOptimistic, add/edit/delete
│   └── coach/
│       └── DealsTab.tsx               # "use client" — paginated read-only table, fetch on tab activate
└── lib/
    └── config.ts                      # ADD: /student/deals + /student_diy/deals routes
                                       # ADD: "Deals" nav items for student + student_diy
                                       # ADD: DEALS validation constants (revenue max, notes max)
supabase/
└── migrations/
    └── 00021_deals.sql                # deals table + RLS + indexes + student_kpi_summaries ALTERs
                                       # + refresh_student_kpi_summaries() function update
```

### Structure Rationale

- **`/api/deals/route.ts` for GET + POST:** GET serves coach/owner viewing a student's paginated deals; POST serves student/student_diy creating deals. Single URL, split by HTTP verb + role check inside handler. This matches how `/api/reports` handles different roles on the same endpoint.
- **`/api/deals/[id]/route.ts` for PATCH + DELETE:** Dynamic segment per the existing pattern (e.g., `work-sessions/[id]`, `roadmap/[id]`). Record-specific mutations always use a `[id]` route.
- **`DealsClient.tsx` in `components/student/`:** Matches where `WorkTrackerClient.tsx`, `ReportForm.tsx`, `RoadmapClient.tsx` live. Student-facing interactive components belong here. Both `/student/deals` and `/student_diy/deals` import the same component.
- **`DealsTab.tsx` in `components/coach/`:** Matches where `CalendarTab.tsx`, `RoadmapTab.tsx` live. Shared tab components used by coach + owner detail pages go here. The coach and owner detail pages already share `StudentDetailTabs.tsx` and `CalendarTab.tsx` from this folder.
- **Single migration file `00021_deals.sql`:** Follows the `00021_` sequence (next after `00020_add_eyoub_owner.sql`). Puts deals table, RLS, indexes, and `student_kpi_summaries` column additions all in one migration — same approach as `00015_v1_4_schema.sql` which covered 4 tables in a single file.

---

## Architectural Patterns

### Pattern 1: Server Component Shell + Client Island

**What:** Every page is an `async` Server Component that fetches initial data with `createAdminClient()`, then passes serialized data as props to a small `"use client"` child only for interactive state.
**When to use:** Both `/student/deals` and `/student_diy/deals` pages. The server component fetches the first 25 deals and current totals; `DealsClient` handles add/edit/delete/pagination transitions.
**Trade-offs:** Initial render requires no client-side fetch. Mutations go through `/api/deals` route handlers. Data serialization at the RSC boundary means no functions, no Dates (use strings).

**Example (matching existing student page pattern):**
```typescript
// src/app/(dashboard)/student/deals/page.tsx
export default async function StudentDealsPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const [{ data: deals, count }, kpiResult] = await Promise.all([
    admin.from("deals").select("*", { count: "exact" })
      .eq("student_id", user.id)
      .order("deal_number", { ascending: false })
      .range(0, 24),
    admin.from("student_kpi_summaries")
      .select("total_deals, total_revenue, total_profit")
      .eq("student_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <DealsClient
      initialDeals={deals ?? []}
      totalCount={count ?? 0}
      studentId={user.id}
      kpi={kpiResult.data ?? { total_deals: 0, total_revenue: 0, total_profit: 0 }}
    />
  );
}
```

### Pattern 2: useOptimistic for Add and Delete

**What:** React 19 `useOptimistic` applies the expected UI change immediately, then reconciles with server state after the mutation settles. Already used in `ReportFormWrapper.tsx`.
**When to use:** Adding a deal (optimistic insert with placeholder `deal_number`), deleting a deal (optimistic remove from list). Not needed for edit since the form is inline.
**Trade-offs:** Slightly more code complexity. Rollback on error requires a toast + state reset. The pattern is already established in the codebase.

**Example:**
```typescript
const [optimisticDeals, addOptimistic] = useOptimistic(
  deals,
  (state, action: { type: "add"; deal: Deal } | { type: "delete"; id: string }) => {
    if (action.type === "add") return [action.deal, ...state];
    if (action.type === "delete") return state.filter(d => d.id !== action.id);
    return state;
  }
);
```

### Pattern 3: Role-Split API Handler

**What:** A single route file handles multiple roles; an auth + role check at the top branches on `profile.role`.
**When to use:** `GET /api/deals` (coach/owner reading) and `POST /api/deals` (student/student_diy writing) share the same URL. `DELETE /api/deals/[id]` must branch on role to determine ownership scope.
**Trade-offs:** Keeps URL surface minimal. Handler must return explicit 403 for unauthorized role/operation combos. Follows the pattern in `/api/reports` and `/api/resources`.

**Example (DELETE with role-based ownership):**
```typescript
export async function DELETE(request, { params }) {
  // ... auth, rate limit, parse id ...

  if (profile.role === "student" || profile.role === "student_diy") {
    // Own deal only
    const { error } = await admin.from("deals")
      .delete().eq("id", id).eq("student_id", profile.id);
  } else if (profile.role === "coach") {
    // Verify deal belongs to an assigned student
    const { data: deal } = await admin.from("deals")
      .select("student_id").eq("id", id).single();
    const { data: student } = await admin.from("users")
      .select("id").eq("id", deal.student_id).eq("coach_id", profile.id).single();
    if (!student) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await admin.from("deals").delete().eq("id", id);
  } else if (profile.role === "owner") {
    // Can delete any deal
    await admin.from("deals").delete().eq("id", id);
  }
}
```

### Pattern 4: Tab Extension on Student Detail Pages

**What:** Both coach and owner student detail pages already use `StudentDetailTabs` (a "use client" component with a `TabKey` union type). Adding a Deals tab means extending this union and rendering `DealsTab` when active.
**When to use:** Exactly here — adding the third tab alongside Calendar and Roadmap.
**Trade-offs:** The tab key union (`"calendar" | "roadmap"`) becomes `"calendar" | "roadmap" | "deals"`. The `initialTab` prop in `StudentDetailClient` and `OwnerStudentDetailClient` needs to accept `"deals"`. Initial deals data is fetched server-side in the page component and passed as props to avoid client-side loading state when the Deals tab is clicked first.

**Required changes to `StudentDetailTabs.tsx`:**
```typescript
export type TabKey = "calendar" | "roadmap" | "deals";  // add "deals"

const tabs: { key: TabKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
  { key: "deals", label: "Deals" },  // new
];
```

### Pattern 5: Paginated GET Endpoint

**What:** Server-side pagination via `?student_id=X&page=N`. Supabase `.range(offset, offset + PAGE_SIZE - 1)` with `{ count: "exact" }`. PAGE_SIZE = 25 per requirements.
**When to use:** `GET /api/deals` for coach/owner viewing a student's history. The `DealsTab` component fetches page 1 on mount (or when tab becomes active) and handles "Load more" / page navigation client-side.
**Trade-offs:** Simpler than cursor-based for fixed-order lists. Already used in coach reports list. `count: "exact"` is one extra DB operation but needed for showing "Showing X of Y deals."

---

## Data Flow

### Deal Creation (Student)

```
Student fills "Add Deal" form in DealsClient
    ↓
useOptimistic adds placeholder deal immediately (deal_number = "...")
    ↓
fetch POST /api/deals { revenue, profit, date, notes? }
    ↓
API: verifyOrigin → auth → role check (student/student_diy only)
  → checkRateLimit(profile.id, "/api/deals")
  → Zod validate (revenue >= 0, profit <= revenue, date valid)
  → INSERT into deals (trigger sets deal_number)
  → return { data: { id, deal_number, ... } }
    ↓
Client reconciles optimistic state with real deal_number
revalidateTag("deals") busts Next.js cache for server re-renders
```

### Deal Deletion (Coach)

```
Coach opens Deals tab on /coach/students/[studentId]
    ↓
DealsTab renders table (initial data from SSR props or client fetch)
    ↓
Coach clicks Delete on a deal row
    ↓
fetch DELETE /api/deals/[id]
    ↓
API: auth → role="coach" → verify deal.student_id has coach_id = coach.id
  → DELETE FROM deals WHERE id = $id
  → return { success: true }
    ↓
Client removes deal from local list (optimistic or post-response)
```

### Dashboard Deal Stats (Student Dashboard)

```
/student/page.tsx renders (server component)
    ↓
admin.from("student_kpi_summaries")
  .select("total_deals, total_revenue, total_profit")
  .eq("student_id", user.id)
    ↓
Render 3 new stat cards alongside existing KPI cards
    ↓
pg_cron refreshes totals nightly — 1-day staleness is acceptable
    ↓
On /student/deals page: use live COUNT(*) for exact accuracy
```

### Coach/Owner Viewing Deals (Lazy Tab Load)

```
Coach opens /coach/students/[studentId] — server component loads
    ↓
Page fetches deals.range(0, 24) + count in Promise.all alongside RPC
    ↓
Passes initialDeals + initialCount to StudentDetailClient
    ↓
Coach clicks "Deals" tab (activeTab becomes "deals")
    ↓
DealsTab renders with SSR-provided initial data (no flash)
    ↓
Coach clicks "Next Page" → DealsTab fetches GET /api/deals?student_id=X&page=2
```

---

## Integration Points: New vs Modified

### New Routes

| Route | Method | Actor | Notes |
|-------|--------|-------|-------|
| `/student/deals` | Page | student | Server shell → DealsClient |
| `/student_diy/deals` | Page | student_diy | Same structure as student/deals |
| `/api/deals` | GET | coach, owner | Paginated list; requires `student_id` query param |
| `/api/deals` | POST | student, student_diy | Create deal |
| `/api/deals/[id]` | PATCH | student, student_diy | Edit own deal only |
| `/api/deals/[id]` | DELETE | student/student_diy (own), coach (assigned), owner (any) | Role-split ownership check |

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DealsClient.tsx` | `src/components/student/` | CRUD UI with useOptimistic — shared by student and student_diy pages |
| `DealsTab.tsx` | `src/components/coach/` | Read-only paginated deals table — shared by coach and owner detail pages |

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `src/lib/config.ts` | Add `ROUTES.student.deals` + `ROUTES.student_diy.deals`, add "Deals" nav items for both roles, add `DEALS` validation constants (revenue min/max, profit min, notes max) | Config is truth (CLAUDE.md rule 1) |
| `src/proxy.ts` | No change — `/student/deals` protected by `/student` prefix; `/api/*` excluded | Existing matchers cover it |
| `src/components/coach/StudentDetailTabs.tsx` | Add `"deals"` to `TabKey` union; add `{ key: "deals", label: "Deals" }` to tabs array | Third tab |
| `src/components/coach/StudentDetailClient.tsx` | Accept `initialDeals`, `dealsCount` props; render `<DealsTab>` when `activeTab === "deals"`; update tab URL push | Coach view |
| `src/components/owner/OwnerStudentDetailClient.tsx` | Same as coach — add Deals tab, accept deal props | Owner view |
| `src/app/(dashboard)/coach/students/[studentId]/page.tsx` | Add deals fetch to `Promise.all()` — range(0, 24) + count; pass to `StudentDetailClient` | SSR initial data |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | Same as coach detail page | SSR initial data |
| `src/app/(dashboard)/student/page.tsx` | Add 3 deal stat cards (Deals Closed, Total Revenue, Total Profit) reading from `student_kpi_summaries` | Dashboard |
| `src/app/(dashboard)/student_diy/page.tsx` | Same 3 deal stat cards | Dashboard |
| `src/lib/rpc/types.ts` | No change — deals fetched via direct table query, not via `get_student_detail` RPC | Keep RPC stable |

### New Database Objects

| Object | Type | Notes |
|--------|------|-------|
| `deals` table | Table | Primary entity — `id, student_id, deal_number, revenue, profit, date, notes, created_at, updated_at` |
| Deal number trigger | Trigger | `SELECT COALESCE(MAX(deal_number), 0) + 1 FROM deals WHERE student_id = NEW.student_id FOR UPDATE` — row lock prevents race conditions |
| `idx_deals_student_id` | Index | Primary query path: all queries filter by student_id |
| `idx_deals_student_id_deal_number` | Index | Supports ORDER BY deal_number DESC pagination |
| `student_kpi_summaries.total_deals` | Column (ALTER TABLE) | Pre-aggregated deal count |
| `student_kpi_summaries.total_revenue` | Column (ALTER TABLE) | Pre-aggregated revenue sum |
| `student_kpi_summaries.total_profit` | Column (ALTER TABLE) | Pre-aggregated profit sum |
| RLS on `deals` (5 policies) | Policies | student/student_diy: own rows only; coach: assigned student rows; owner: all |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `DealsClient` → `/api/deals` | fetch() POST | JSON body, check response.ok, Zod validates server-side |
| `DealsClient` → `/api/deals/[id]` | fetch() PATCH/DELETE | Ownership verified server-side |
| `DealsTab` → `/api/deals` | fetch() GET with page param | Pagination state in component; initial data from SSR |
| `student/deals/page.tsx` → DB | admin client SELECT deals + kpi_summaries | Server component, no API hop for initial load |
| `student dashboard` → DB | admin client SELECT kpi_summaries | Pre-aggregated; 1-day staleness is fine |
| pg_cron → `student_kpi_summaries` | Nightly refresh function | `refresh_student_kpi_summaries()` must aggregate new columns |

---

## Anti-Patterns

### Anti-Pattern 1: Fetching Deals via the `get_student_detail` RPC

**What people do:** Add deal data to the existing `get_student_detail` Postgres RPC by adding a `p_include_deals` parameter.
**Why it's wrong:** The RPC is used for calendar/roadmap rendering and already returns sessions, roadmap, and reports for the current month. Adding 100s of deal records bloats a multi-purpose response. The Deals tab loads lazily (only when clicked); bundling it in the always-present RPC call wastes bandwidth on every page load. The existing `StudentDetailResult` type in `src/lib/rpc/types.ts` is hand-crafted and fragile.
**Do this instead:** Fetch deals directly in the server component alongside the RPC call using `Promise.all()`. Keep the RPC interface unchanged.

### Anti-Pattern 2: Live COUNT on Dashboard Stats

**What people do:** Add a `COUNT(*) FROM deals WHERE student_id = X` query to the student dashboard server component to show real-time deal totals.
**Why it's wrong:** The dashboard already reads outreach KPIs from `student_kpi_summaries` specifically to avoid per-load aggregation queries. Adding a live COUNT here creates inconsistency (some stats from summary, some live) and adds an unnecessary DB round trip on every dashboard visit.
**Do this instead:** Read `total_deals`, `total_revenue`, `total_profit` from `student_kpi_summaries` on the dashboard. Use a live COUNT only on the dedicated `/student/deals` page where accuracy is expected.

### Anti-Pattern 3: Application-Level deal_number Increment

**What people do:** `SELECT MAX(deal_number) + 1 FROM deals WHERE student_id = X` in application code before each insert.
**Why it's wrong:** Race condition — two concurrent inserts can produce the same `deal_number` since there is no lock between the SELECT and INSERT in application code.
**Do this instead:** Use a Postgres trigger on `BEFORE INSERT` that executes `SELECT COALESCE(MAX(deal_number), 0) + 1 FROM deals WHERE student_id = NEW.student_id FOR UPDATE`. The `FOR UPDATE` row-level lock serializes concurrent inserts per student safely within the transaction.

### Anti-Pattern 4: Skipping Rate Limiting on `/api/deals`

**What people do:** Omit `checkRateLimit()` on new deal endpoints because it seems low-priority.
**Why it's wrong:** Every one of the 10 existing mutation routes uses `checkRateLimit()`. Missing it on new routes breaks the established security baseline and allows spam inserts. The hard rule in `CLAUDE.md` requires rate limiting on all mutation routes.
**Do this instead:** `checkRateLimit(profile.id, "/api/deals")` in `route.ts` POST; `checkRateLimit(profile.id, "/api/deals/" + id)` in `[id]/route.ts` PATCH and DELETE.

### Anti-Pattern 5: Separate Page Components for Student and Student_DIY

**What people do:** Create two entirely separate `DealsClient` components — one for student, one for student_diy — to handle the minor differences in API calls.
**Why it's wrong:** The deals CRUD UI is identical for both roles. Both call the same `/api/deals` endpoint. The only difference is the role checked server-side in the API handler.
**Do this instead:** Single `DealsClient.tsx` in `src/components/student/`. Both `student/deals/page.tsx` and `student_diy/deals/page.tsx` are thin server shells that import the same component. This matches how student_diy reuses `WorkTrackerClient` and `RoadmapClient` from the student components folder.

### Anti-Pattern 6: Adding DealsTab Logic Inline in StudentDetailClient

**What people do:** Put the paginated deals table JSX directly inside `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` rather than extracting a shared component.
**Why it's wrong:** The two detail clients already share `CalendarTab`, `RoadmapTab`, and `StudentDetailTabs` as extracted components. Inlining deals logic in both places means duplicating pagination state, fetch logic, and render markup.
**Do this instead:** Extract `DealsTab.tsx` in `src/components/coach/` — same pattern as `CalendarTab.tsx` which is imported by both coach and owner detail clients.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (50-500 students) | Direct table queries + `student_kpi_summaries` for dashboard stats. Indexed by `student_id`. No changes from existing infrastructure. |
| 1k-5k students | Already validated at P95 < 1s in Phase 24 load tests. Deals adds one simple indexed query path — `SELECT ... WHERE student_id = X ORDER BY deal_number DESC LIMIT 25`. This is not a bottleneck. |
| Aggregate staleness | pg_cron refresh runs nightly. Totals on dashboard can be up to 24h stale. This is explicitly acceptable for KPI summary cards. |

---

## Suggested Build Order

Dependencies are explicit — each step unblocks the next.

**Step 1 — Database migration** (`00021_deals.sql`)
Creates the `deals` table, trigger for `deal_number`, RLS policies, indexes, and `ALTER TABLE student_kpi_summaries` to add the three new aggregate columns. Updates `refresh_student_kpi_summaries()` function to include deal aggregation. Nothing else can proceed without this.

**Step 2 — Config update** (`src/lib/config.ts`)
Add `ROUTES.student.deals`, `ROUTES.student_diy.deals`, "Deals" nav items for student and student_diy, `DEALS` validation constants. This is a prerequisite for TypeScript to not complain during page/component creation.

**Step 3 — API route handlers** (`/api/deals` + `/api/deals/[id]`)
POST/PATCH/DELETE for student mutations; GET for coach/owner paginated list. Self-contained — no component depends on them except via fetch(). Must verify rate limiting, CSRF, Zod validation, ownership checks are all in place before other work proceeds.

**Step 4 — Student Deals pages** (`/student/deals` + `/student_diy/deals` + `DealsClient`)
The student-facing CRUD flow. Both pages use the same `DealsClient` component. Self-contained; does not depend on coach/owner tab changes.

**Step 5 — Dashboard stat cards** (`/student/page.tsx` + `/student_diy/page.tsx`)
Add the 3 deal KPI stat cards. Reads from `student_kpi_summaries` (available after Step 1). Can be done in parallel with Step 4.

**Step 6 — Coach/Owner Deals tab** (`DealsTab`, `StudentDetailTabs` + both detail clients + both detail pages)
Extend `TabKey`, add `DealsTab` component, update both detail clients to render the tab, update both detail pages to fetch initial deals data in `Promise.all`. This is the most touch-heavy step — affects 6 files — but each change is surgical.

**Parallelization:** Steps 4 and 5 can be done in parallel after Steps 1–3 are complete. Step 6 must come after Step 3 (needs the GET API).

---

## Sources

- Direct codebase analysis: `src/app/(dashboard)/`, `src/components/coach/`, `src/components/student/`, `src/lib/config.ts`, `src/proxy.ts`, `src/lib/rate-limit.ts`, `src/lib/csrf.ts`
- Migration history: `supabase/migrations/00001_create_tables.sql` through `00020_add_eyoub_owner.sql`
- Existing tab pattern: `StudentDetailTabs.tsx`, `StudentDetailClient.tsx`, `OwnerStudentDetailClient.tsx`, `CalendarTab.tsx`
- Pre-aggregation pattern: `supabase/migrations/00011_write_path.sql`, `student_kpi_summaries` table design
- API route pattern: `src/app/api/reports/route.ts` (role-split handler, full pipeline)
- RPC types: `src/lib/rpc/types.ts`
- Project requirements: `.planning/PROJECT.md` (v1.5 milestone target features)

---
*Architecture research for: IMA Accelerator v1.5 — Student Deal Tracking Integration*
*Researched: 2026-04-06*
