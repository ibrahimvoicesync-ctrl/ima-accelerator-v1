# Pitfalls Research

**Domain:** Adding deal/revenue tracking (v1.5) to an existing Next.js 16 + Supabase coaching platform with 4 roles and 14 tables
**Researched:** 2026-04-06
**Confidence:** HIGH — grounded in direct codebase audit of existing migrations, API route patterns, RLS policies, and verified against Supabase/Postgres issue trackers

> **Scope:** These pitfalls are specific to adding a `deals` table with auto-incremented `deal_number` per student, revenue/profit numeric fields, asymmetric delete permissions (coach deletes own students' deals, owner deletes any), paginated coach/owner views, and dashboard stats integration to a system that already has RLS, rate limiting, `useOptimistic`, and a pre-aggregation pattern (`student_kpi_summaries`). The existing system patterns are known-good; these pitfalls are about what breaks when this particular feature set is added on top.

---

## Critical Pitfalls

### Pitfall 1: Per-Student `deal_number` Race Condition Under Concurrent Inserts

**What goes wrong:**
The `deal_number` must auto-increment per student (not globally). A naive implementation reads `MAX(deal_number) + 1` in the API route, then inserts with that value. Under concurrent requests — a student double-tapping the submit button or a flaky mobile retry — two requests race to read the same MAX and both attempt to insert with the same `deal_number`. One INSERT succeeds; the other fails with a unique constraint violation. The user sees an error on a valid submission.

**Why it happens:**
The admin client in API routes does not hold a transaction lock between the SELECT MAX and the INSERT. Two inflight requests to `/api/deals` execute SELECT MAX concurrently before either INSERT completes. This is not theoretical — the existing rate limiter pattern (30 req/min) still allows 2 requests within the same second.

**How to avoid:**
Use a Postgres function with `SELECT ... FOR UPDATE` or advisory lock scoped to the student UUID:

```sql
-- In a SECURITY DEFINER function called from the INSERT trigger or RPC:
SELECT pg_advisory_xact_lock(hashtext(p_student_id::text));
SELECT COALESCE(MAX(deal_number), 0) + 1 INTO v_next FROM deals WHERE student_id = p_student_id;
INSERT INTO deals (..., deal_number) VALUES (..., v_next);
```

Alternatively, store `deal_number` as a computed column via `ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY created_at)` and never write it explicitly — let it be a view-time calculation. This trades write simplicity for read correctness and eliminates the race entirely.

The simplest production-safe approach: define a UNIQUE constraint on `(student_id, deal_number)` and use a trigger function to set `deal_number` from a per-student advisory lock before insert.

**Warning signs:**
- Unique constraint violation errors appearing in server logs on `/api/deals` POST
- Duplicate `deal_number` values in the table for the same `student_id`
- Error rate spikes on the deals endpoint during peak usage

**Phase to address:**
Database migration phase — the UNIQUE constraint `(student_id, deal_number)` MUST exist in the migration SQL before any application code is written. The sequence generation function or trigger should be part of the same migration.

---

### Pitfall 2: NUMERIC Columns Returned as Strings by Supabase JS Client

**What goes wrong:**
PostgreSQL `NUMERIC` / `numeric(12,2)` columns are serialized as strings by PostgREST (the underlying REST layer Supabase uses). The Supabase JS client returns `revenue: "12500.00"` as a string, not the TypeScript `number` that hand-written `types.ts` declares. Arithmetic like `total += row.revenue` produces `"012500.00"` (string concatenation) instead of addition. Dashboard stats display `"NaN"` or concatenated strings instead of summed totals.

**Why it happens:**
PostgREST serializes NUMERIC as JSON strings to prevent precision loss for values exceeding JavaScript's `Number.MAX_SAFE_INTEGER`. The existing `types.ts` is hand-crafted (noted in PROJECT.md: "regenerate when Docker + local Supabase running"). If the type is declared as `number` but the runtime value is a string, TypeScript won't catch it — the types file says `number`, the real value is `"12500.00"`.

This is confirmed by `supabase/postgrest-js` issue #419 and `supabase/cli` issue #582 (both open/unresolved as of 2025).

**How to avoid:**
Two-layer defense:

1. In `types.ts`, declare revenue/profit fields as `string | number` (or just `string`) to force explicit conversion at every call site.
2. At every read site, wrap with `Number(row.revenue)` or `parseFloat(String(row.revenue))` before arithmetic.

For Zod validation on API inputs (POST body), use `z.number()` — the client sends a JS number, the server receives it as number in JSON. The round-trip issue is on the READ path (Supabase → JS), not the write path (JS → Supabase).

Example safe pattern:
```typescript
const revenue = Number(row.revenue ?? 0);
const profit = Number(row.profit ?? 0);
```

Add a utility function `toMoney(val: unknown): number` that handles both string and number inputs.

**Warning signs:**
- Dashboard total revenue shows `"0125002500"` (string concatenation artifact)
- `typeof row.revenue === 'string'` is true at runtime despite `types.ts` saying `number`
- `isNaN(totalRevenue)` returns `true` after summing

**Phase to address:**
Database migration phase — declare column types accurately in `types.ts` as part of the migration. API route phase — validate with Zod that incoming values are `z.number()` and write test assertions that revenue from a `.select()` call is coerced before arithmetic.

---

### Pitfall 3: RLS `initplan` Missing on the `deals` Table

**What goes wrong:**
The existing codebase uses `(SELECT get_user_role())` initplan wrapping in RLS policies (established in migration `00001_create_tables.sql`) to prevent per-row re-evaluation of the role function. If the `deals` table RLS policy is written as:

```sql
-- WRONG — function called once per row:
USING (student_id = get_user_id() OR get_user_role() IN ('owner', 'coach'))
```

instead of:

```sql
-- CORRECT — function called once per query plan:
USING (student_id = (SELECT get_user_id()) OR (SELECT get_user_role()) IN ('owner', 'coach'))
```

Then for a coach viewing a student with 500 deals paginated over 20 pages, `get_user_role()` executes 500 times per page load instead of once. At 5,000 students this becomes a performance cliff.

**Why it happens:**
New migrations written in isolation can miss the initplan pattern even though it is established in `00001`. RLS policy SQL is not linted by TypeScript or ESLint — the mistake is invisible until the table is large.

**How to avoid:**
Copy the exact RLS policy structure from an existing table (e.g., `daily_reports` in `00001_create_tables.sql`) verbatim, replacing only the table and column names. Add a `-- initplan wrapped` comment on every `(SELECT get_user_id())` call to make the pattern explicit. Include a `EXPLAIN (ANALYZE, FORMAT JSON)` test in the migration validation checklist that confirms "InitPlan" appears in the query plan for a deals SELECT.

**Warning signs:**
- `EXPLAIN ANALYZE` on `SELECT * FROM deals WHERE student_id = $1` shows `get_user_role` in the function call list without "InitPlan"
- P95 latency on coach student detail pages increases after the migration
- Supabase slow query log shows `deals` SELECT queries taking >100ms

**Phase to address:**
Database migration phase — RLS policy SQL must be reviewed before migration is applied. The initplan pattern check should be a named checklist item in the migration plan.

---

### Pitfall 4: Asymmetric Delete Authorization — Coach Cross-Student Delete Bypass

**What goes wrong:**
The delete permission is: coach can delete deals for their **assigned** students; owner can delete any. A common mistake is writing the RLS DELETE policy as:

```sql
-- WRONG — any coach can delete any deal:
USING ((SELECT get_user_role()) IN ('owner', 'coach'))
```

This allows a coach to call `DELETE /api/deals/[dealId]` for a student assigned to a **different** coach and succeed. The API route's server-side check also commonly fails here — developers check `profile.role === 'coach'` without verifying `student.coach_id === profile.id`.

**Why it happens:**
The role check and the assignment check are two separate conditions that are both required. Under time pressure, the assignment check is omitted from either the API route or the RLS policy, and the role check alone looks correct at a glance.

**How to avoid:**
The API route must perform a two-step check before delete:

```typescript
// 1. Fetch the deal with its student_id
const { data: deal } = await admin.from("deals").select("student_id").eq("id", dealId).single();

// 2. If coach, verify they are assigned to that student
if (profile.role === "coach") {
  const { data: student } = await admin
    .from("users")
    .select("coach_id")
    .eq("id", deal.student_id)
    .single();
  if (student?.coach_id !== profile.id) return 403;
}

// 3. Owner skips the assignment check (can delete any)
```

The RLS DELETE policy should be defense-in-depth (not the primary check), using a subquery join to `users` to verify `coach_id` assignment:

```sql
USING (
  (SELECT get_user_role()) = 'owner'
  OR (
    (SELECT get_user_role()) = 'coach'
    AND student_id IN (
      SELECT id FROM users WHERE coach_id = (SELECT get_user_id())
    )
  )
)
```

**Warning signs:**
- Unit test: coach A can delete a deal belonging to a student assigned to coach B
- `DELETE /api/deals/[foreignDealId]` returns 200 instead of 403 for a coach

**Phase to address:**
API route phase — the delete route must include the assignment verification as a named checklist step. The RLS DELETE policy must be reviewed for this exact scenario.

---

### Pitfall 5: Dashboard Stats Not Updating After Deal Add/Delete

**What goes wrong:**
The student dashboard shows "Deals Closed", "Total Revenue", and "Total Profit" stats. After a student adds or deletes a deal, the server component re-renders with stale data because:

1. The API route calls `revalidateTag("deals")` but the student dashboard page is not tagged with `"deals"` — it uses a different cache strategy or no tag at all.
2. The `student_kpi_summaries` pre-aggregation table (refreshed nightly by pg_cron) does NOT contain deal stats. If deal counts are added to this table later, they will always be 24h stale for live students.

**Why it happens:**
The existing dashboard (student, coach detail, owner detail) fetches KPIs in three different query paths: live server component fetches, the `get_student_detail` RPC, and `student_kpi_summaries`. Deal stats don't belong in any of these by default — they require a new data path. If a developer adds deal stats to the dashboard by reading from `student_kpi_summaries`, the numbers will lag by up to 24 hours after every deal submission.

**How to avoid:**
Deal stats on the dashboard MUST be fetched live (not from `student_kpi_summaries`). Use a dedicated fast aggregate query:

```sql
SELECT COUNT(*) AS deals_closed,
       COALESCE(SUM(revenue), 0) AS total_revenue,
       COALESCE(SUM(profit), 0) AS total_profit
FROM deals
WHERE student_id = $1;
```

Add this as a parallel `Promise.all` fetch in the student dashboard server component alongside the existing session/roadmap/report fetches. After every deal mutation (POST/DELETE), call `revalidateTag("deals-[studentId]")` or `revalidatePath("/student/deals")` to bust the correct cache segment.

Do NOT add deals to `refresh_student_kpi_summaries()` — that function runs nightly and would make deal counts stale by definition.

**Warning signs:**
- Student adds a deal, navigates to dashboard, sees "0 Deals Closed"
- Student deletes a deal, refreshes, deal count still shows old number
- `revalidateTag` is called with a tag not used in the corresponding `fetch()` or `unstable_cache()` call

**Phase to address:**
Dashboard stats phase — the cache tag used by the API route mutation MUST match the tag used by the server component data fetch. This is a named verification item.

---

### Pitfall 6: `useOptimistic` Delete Flash When Coach/Owner Removes a Deal

**What goes wrong:**
After a coach deletes a deal, `useOptimistic` immediately removes the row from the UI, then the server component re-validates and re-renders. If the `revalidateTag` call in the API route is missing or uses the wrong tag, the server component renders the stale list (with the deleted deal still present). React reconciles the optimistic state (deal gone) with the fresh server state (deal present), causing a visible flash where the deleted row re-appears briefly.

A second failure mode: the optimistic update removes the row at index N, but the paginated list is based on `OFFSET = (page - 1) * 25`. After deletion, the total count changes but the page variable stays at the same value, causing the last page to show fewer than 25 items without indicating "you're at the end" — this looks like a broken list to the user.

**Why it happens:**
`useOptimistic` is designed for the add path (add → optimistic render → server confirms). The delete path requires matching the optimistic remove with a guaranteed-consistent server re-fetch. The existing codebase uses `useOptimistic` on report submission (add only) — the delete pattern has not been established yet.

**How to avoid:**
For the delete action:
1. Call the API route DELETE.
2. On success (response.ok), call `router.refresh()` (not `revalidatePath` from client) to force the server component to re-render with fresh data.
3. Use `useOptimistic` only for the immediate remove animation — treat the refresh as the source of truth.
4. After deletion, reset the page to 1 if the deleted deal was the only item on the current page.

For optimistic state shape, filter by ID:
```typescript
const optimisticDeals = deals.filter(d => d.id !== pendingDeleteId);
```

**Warning signs:**
- Deleted deal row reappears for 200-500ms after deletion
- After deleting the last deal on a page, the page shows an empty list without pagination updating
- `router.refresh()` is missing from the delete success handler

**Phase to address:**
Client components phase — the delete handler must call `router.refresh()` after the API DELETE succeeds. This is a named checklist item in the plan.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store `deal_number` as a regular integer column, generate via `MAX + 1` in app code | Simple to implement | Race condition on concurrent inserts; duplicate deal numbers possible | Never — use a trigger or UNIQUE constraint from day one |
| Declare revenue/profit as `number` in `types.ts` without runtime coercion | Cleaner TypeScript | Silent arithmetic corruption when PostgREST returns string | Never — always coerce at read site |
| Skip RLS on `deals` table, rely only on API route checks | Faster implementation | Defense-in-depth gap; direct DB access bypasses authorization | Never on a Supabase project — RLS is a named architectural constraint |
| Add deal stats to `student_kpi_summaries` nightly cron | Single data source | Stats are up to 24h stale; students see wrong deal counts | Never for live user-facing stats |
| Use `revalidatePath("/student/deals")` only, skip dashboard revalidation | One call | Dashboard stats go stale after deal mutations | Acceptable if dashboard fetches deals live; unacceptable if it reads from cache |
| Offset pagination on deals list (`OFFSET 25 * page`) | Simple to implement | Slow on deep pages; rows shift when deal added/deleted mid-session | Acceptable for MVP at current scale (<1000 deals/student); switch to cursor if P95 degrades |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase JS client + NUMERIC columns | Treating `row.revenue` as JS `number` directly | Always coerce: `Number(row.revenue ?? 0)` at every arithmetic site |
| `revalidateTag` in Route Handler | Calling with a tag that no `fetch()` / `unstable_cache()` uses | Tag names must be agreed between the mutation route and the server component fetch |
| `student_kpi_summaries` pg_cron function | Adding deal aggregates to the nightly refresh function | Deal stats must be live queries, not cron-refreshed; the function only handles `daily_reports` aggregates |
| RLS `(SELECT get_user_role())` initplan | Writing bare `get_user_role()` in a new policy | Every role/user function call in RLS MUST use the `(SELECT fn())` wrapper — copy from existing policies verbatim |
| Admin client in API routes | Using `createClient()` (RLS-gated) instead of `createAdminClient()` for deal queries | All server-side DB operations in Route Handlers use `createAdminClient()` — this is a hard rule in CLAUDE.md |
| `useOptimistic` on delete | Missing `router.refresh()` after delete API success | Delete = optimistic remove + `router.refresh()` for source-of-truth sync; not just optimistic state |
| Zod validation on money inputs | Using `z.string()` for revenue/profit in the POST schema | Use `z.number().min(0)` — the client sends a JS number, server validates as number; coerce only on DB read |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `deals(student_id)` | Coach detail page slow; owner pagination slow | Add `CREATE INDEX idx_deals_student_id ON deals(student_id)` in migration | ~100+ deals per student |
| No index on `deals(student_id, created_at DESC)` | Paginated list requires full table scan per page | Composite index for pagination query | ~500 deals in table |
| Counting total deals with `SELECT COUNT(*)` on every page render | Pagination "total pages" number is expensive | Use a separate `COUNT(*)` query cached with short TTL, or accept approximate total | ~10k total rows |
| Missing `COALESCE` on SUM aggregates | `total_revenue` returns `null` when student has 0 deals; frontend `Number(null)` = 0 but displayed as blank | Always `COALESCE(SUM(revenue), 0)` in aggregate queries | First load for new students |
| Loading all deals into client component for totals | Large payload; totals computed in JS | Compute `SUM(revenue)`, `SUM(profit)`, `COUNT(*)` in DB aggregate query; return summary + paginated page separately | ~50+ deals per student |
| `N+1` on coach dashboard — fetching deal summaries per student in a loop | Coach dashboard slow when coach has 20+ students | Single query: `SELECT student_id, COUNT(*), SUM(revenue) FROM deals GROUP BY student_id WHERE student_id = ANY($ids)` | 5+ students per coach |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS DELETE policy allows any coach to delete any deal (missing assignment check) | Coach A deletes deals of students assigned to Coach B | RLS DELETE policy must join `users` table to verify `coach_id = get_user_id()`; API route must also verify before delete |
| API route checks role but not student ownership before delete | A student can delete another student's deal by crafting a request with a foreign `dealId` | Always fetch deal first, verify `deal.student_id === profile.id` before allowing student delete; admin client bypasses RLS so the explicit check is mandatory |
| Students can edit revenue/profit values of past deals arbitrarily | Revenue inflation / data manipulation | This is allowed per requirements — but validate max values in Zod schema (e.g., `z.number().max(10_000_000)`) to prevent absurdly large values that corrupt totals |
| Exposing deal data to `student_diy` role incorrectly | `student_diy` should have same access as `student` for their own deals per requirements | Ensure API routes check `profile.role === 'student' || profile.role === 'student_diy'` for student-facing operations; do not accidentally exclude one role |
| Missing `verifyOrigin` CSRF check on deals mutation routes | CSRF attack can trigger deal add/delete from malicious site | All mutation routes (POST `/api/deals`, DELETE `/api/deals/[id]`) must call `verifyOrigin(request)` as first line — this is an existing project hard rule |
| Rate limiting missing on `/api/deals` | Bot or broken client can flood deal submissions | Apply `checkRateLimit(profile.id, "/api/deals")` on POST and DELETE routes — same pattern as all existing mutation routes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No confirmation before deal delete | Student accidentally deletes a deal and has no way to recover | Show confirmation dialog or destructive button pattern (e.g., require double-click or confirm prompt) before DELETE API call |
| Revenue/profit input allows decimal typing but sends rounded integer to API | Student enters `1250.50`, server receives `1250` silently | Accept and store `NUMERIC(12,2)` — validate at Zod layer that value has at most 2 decimal places; display with 2 decimal places in UI |
| Deal history list has no empty state | New students see blank page with no guidance | Show "No deals yet — add your first closed deal" empty state matching existing empty state pattern in codebase |
| Deal number displayed as database UUID | Confusing for students expecting "Deal #1, Deal #2" | Always display `deal_number` in the UI, not the UUID `id` |
| Pagination controls hidden on mobile | Coach/owner cannot navigate deals pages on small screens | Pagination controls need `min-h-[44px]` and `min-w-[44px]` on all buttons per CLAUDE.md hard rules |
| Total revenue displayed without currency symbol or locale formatting | "12500" instead of "$12,500.00" | Use `Intl.NumberFormat` for display: `new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)` |

---

## "Looks Done But Isn't" Checklist

- [ ] **deal_number uniqueness:** Migration has `UNIQUE (student_id, deal_number)` constraint and a trigger or function to assign it atomically — verify with concurrent INSERT test
- [ ] **NUMERIC coercion:** Every read site that does arithmetic on `revenue` or `profit` uses `Number(val)` — verify by logging `typeof row.revenue` from actual Supabase query response
- [ ] **RLS initplan:** Every `get_user_role()` and `get_user_id()` call in the `deals` RLS policy uses `(SELECT fn())` wrapper — verify with `EXPLAIN (ANALYZE, BUFFERS)` that "InitPlan" appears
- [ ] **Coach delete scope:** API DELETE route verifies `student.coach_id === profile.id` before allowing coach delete — verify with a test that coach A cannot delete coach B's student's deal
- [ ] **Dashboard cache invalidation:** After deal POST/DELETE, `revalidateTag` tag matches the tag used in the server component fetch — verify by adding a deal and confirming dashboard stat updates without manual refresh
- [ ] **Both student roles covered:** All student-facing routes check `role === 'student' || role === 'student_diy'` — verify that a `student_diy` account can add, edit, and delete their own deals
- [ ] **Rate limiting on all deal routes:** `/api/deals` POST and DELETE both call `checkRateLimit` — verify 30th request within 60s returns 429
- [ ] **CSRF on all deal routes:** Both routes call `verifyOrigin(request)` as first operation — verify a request without Origin header returns 400
- [ ] **Empty state:** Student with zero deals sees an empty state UI, not a blank page — verify with a freshly-invited test account
- [ ] **Pagination boundary:** Page 2 of deals list renders correctly when total is exactly 25 (no page 2 needed) and when total is 26 (page 2 with 1 item) — verify both edge cases

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Race condition produced duplicate `deal_number` values | MEDIUM | Write a one-time migration to re-number deals per student by `created_at` order; add the UNIQUE constraint after renumbering |
| Revenue/profit displaying wrong totals due to string concatenation | LOW | Fix coercion at read sites; no data loss — DB values are correct, only display was wrong |
| Wrong coach deleting deals (authorization gap) | HIGH | Audit `deals` table for deletions by non-owning coaches (via audit log if present, or by comparing `deleted_by` with `coach_id`); restore from backup if needed; patch authorization immediately |
| Dashboard stats stale after deal mutations | LOW | Fix `revalidateTag` tag alignment in API route and server component; no data integrity issue |
| RLS without initplan causing performance regression | MEDIUM | Re-write RLS policy with initplan wrapping in a new migration; deploy during low-traffic window |
| Deals stats added to `student_kpi_summaries` (24h stale) | LOW | Remove from cron function; add live aggregate query to dashboard server component |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Per-student `deal_number` race condition | Database migration phase | Run concurrent INSERT test; verify UNIQUE constraint rejects duplicate deal_number for same student |
| NUMERIC returned as string | Database migration + API route phase | Log `typeof row.revenue` from test query; verify dashboard totals show correct numbers not concatenated strings |
| RLS missing initplan | Database migration phase | `EXPLAIN ANALYZE` on `SELECT * FROM deals WHERE student_id = $1` confirms InitPlan in output |
| Coach cross-student delete bypass | API route phase | Test: coach A DELETE request on coach B's student's deal returns 403 |
| Dashboard stats not updating | Dashboard stats phase | Add deal → verify dashboard stat increments without manual page reload |
| `useOptimistic` delete flash | Client components phase | Delete deal → confirm no row reappearance flash; confirm pagination total updates |
| N+1 on coach dashboard | Coach detail phase | Load coach dashboard with 10+ students; verify single aggregate query in DB logs, not one per student |
| Missing rate limiting/CSRF | API route phase | 31st POST within 60s returns 429; POST without Origin header returns 400 |

---

## Sources

- Supabase/CLI issue #582: NUMERIC type generated as `number` causing precision loss — https://github.com/supabase/cli/issues/582
- Supabase/postgrest-js issue #419: JavaScript library returns incorrect values for numeric columns — https://github.com/supabase/postgrest-js/issues/419
- PostgreSQL docs on sequences and gapless numbering — https://www.postgresql.org/docs/current/sql-createsequence.html
- PostgreSQL docs on explicit locking and advisory locks — https://www.postgresql.org/docs/current/explicit-locking.html
- Cybertec: Gaps in sequences in PostgreSQL — https://www.cybertec-postgresql.com/en/gaps-in-sequences-postgresql/
- Supabase RLS performance and best practices — https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Next.js revalidateTag docs — https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- React 19 useOptimistic rolls back state for no reason (issue #31967) — https://github.com/facebook/react/issues/31967
- vercel/next.js issue #49619: useOptimistic revert happens after serverAction but before revalidatePath render — https://github.com/vercel/next.js/issues/49619
- Direct codebase audit: `00001_create_tables.sql`, `00011_write_path.sql`, `src/app/api/reports/route.ts`, `src/lib/rate-limit.ts`, `src/lib/rpc/types.ts`

---

*Pitfalls research for: Adding deal/revenue tracking to existing IMA Accelerator v1.4 platform*
*Researched: 2026-04-06*
