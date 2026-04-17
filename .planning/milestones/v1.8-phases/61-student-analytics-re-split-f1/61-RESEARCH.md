# Phase 61: Student Analytics Re-split (F1) — Research

**Researched:** 2026-04-17
**Domain:** Breaking jsonb payload change on `public.get_student_analytics` RPC + lockstep TypeScript type/consumer/cache-key update across `/student/analytics` and `/student_diy/analytics`
**Confidence:** HIGH — every claim verified by grep/Read against the checked-in source tree; no assumed knowledge used for consumer enumeration, migration history, or cache-key locations.

## Summary

This phase replaces a two-key slice of the `totals` jsonb returned by `public.get_student_analytics` — `total_emails` (currently `SUM(brands + influencers)`, mis-named and double-counting) and `total_influencers` (currently `SUM(influencers_contacted)`) — with `total_brand_outreach` (`SUM(brands_contacted)`) and `total_influencer_outreach` (`SUM(influencers_contacted)`). Every runtime consumer of the removed keys lives inside a single file (`AnalyticsClient.tsx`) and every `unstable_cache` call site lives inside two sibling route folders. No other TypeScript, API route, SQL migration, or sidebar widget references the removed keys — `tsc --noEmit` + a single grep cover the entire consumer surface.

The blast radius is **5 files + 1 migration**: migration `00033`, `student-analytics-types.ts` (type), `AnalyticsClient.tsx` (two `KpiCard` sites + icons + labels + DIY hide-guard), `/student/analytics/page.tsx` (cache key), `/student_diy/analytics/page.tsx` (cache key). No other file references `total_emails` or `total_influencers` anywhere in `src/`.

**Primary recommendation:** Ship migration 00033, type rename, both cache-key bumps, two KPI card updates, and DIY hide-guard removal in a **single commit** so `npx tsc --noEmit` is the authoritative breaking-consumer detector and the 60s `unstable_cache` TTL cannot rollover with a stale consumer reading new RPC output.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **SA-07 DIY KPI visibility**: SHOW the renamed cards to `student_diy` users (default v1.8 intent). Remove the `AnalyticsClient.tsx:198` hide-for-DIY guard for these two KPIs.
- **Migration numbering**: `00033_fix_student_analytics_outreach_split.sql` is the next migration.
- **Defensive RPC drop pattern**: use `DO $drop$ … pg_get_function_identity_arguments … DROP FUNCTION … (identity_args)` to avoid PGRST203 overload collisions (v1.7 lesson).
- **Cache-key bump**: bump `unstable_cache` keys for `/student/analytics/page.tsx` and `/student_diy/analytics/page.tsx` (e.g. `["student-analytics"]` → `["student-analytics-v2"]`) in the same commit as the migration to prevent 60s TTL rollover SSR crash.
- **Breaking-change posture**: no back-compat shims. Old `total_emails` / `total_influencers` payload keys are removed; `npx tsc --noEmit` must catch every stale consumer.

### Claude's Discretion

- Specific KPI card labels: "Total Brand Outreach" and "Total Influencer Outreach" (from ROADMAP success criteria).
- File-level placement of the two new cards (replace the single `total_emails` card, preserve adjacent card ordering).
- Whether to rename the `StudentAnalyticsTotals` type in place or introduce a v2 alias (prefer in-place rename — breaking is the point).

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped.

## Phase Requirements

| ID | Description (summary) | Research Support |
|----|----------------------|------------------|
| SA-01 | KPI card "Total Brand Outreach" = `SUM(COALESCE(brands_contacted,0))` | AnalyticsClient.tsx:200-204 replacement; RPC jsonb key `total_brand_outreach` |
| SA-02 | KPI card "Total Influencer Outreach" = `SUM(COALESCE(influencers_contacted,0))` | AnalyticsClient.tsx:205-209 replacement; RPC jsonb key `total_influencer_outreach` |
| SA-03 | Migration 00033 drops + recreates `get_student_analytics` (breaking jsonb shape) with defensive `DROP FUNCTION … (identity_args)` pattern | Current RPC: `supabase/migrations/00023_get_student_analytics.sql:29-263` (signature `(uuid, text, int, int) RETURNS jsonb`). Defensive drop template: PITFALLS.md:19-32 |
| SA-04 | `StudentAnalyticsTotals` type rename; tsc catches every stale consumer | Type defined at `src/lib/rpc/student-analytics-types.ts:20-27`; only two consumer lines in `src/` (AnalyticsClient.tsx:203, 208) |
| SA-05 | Bump `unstable_cache` key in `/student/analytics/page.tsx` | Call site: `src/app/(dashboard)/student/analytics/page.tsx:47-55`, key literal at line 50 |
| SA-06 | Bump `unstable_cache` key in `/student_diy/analytics/page.tsx` | Call site: `src/app/(dashboard)/student_diy/analytics/page.tsx:47-55`, key literal at line 50 |
| SA-07 | DIY KPI visibility resolved: SHOW renamed cards to `student_diy` | Current hide-guard: `AnalyticsClient.tsx:198-211` (wraps both cards in `viewerRole !== "student_diy"`); grid col-count ternary at line 182 must also update |
| SA-08 | Outreach trend chart NOT modified | Chart at AnalyticsClient.tsx:235-339 reads `data.outreach_trend[].brands` / `.influencers` — different fields (not `totals`), untouched by this phase |
| SA-09 | Daily report form NOT modified | `src/app/api/reports/route.ts:97,145` still writes `brands_contacted` + `influencers_contacted` as separate integers plus a `outreach_count` backward-compat column — unchanged |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lifetime outreach aggregation | Database / Storage (Postgres function) | — | `get_student_analytics` is a SECURITY DEFINER STABLE plpgsql function; aggregation stays in SQL for RLS auth + single round-trip |
| Cache layer | Frontend Server (SSR) | — | Next.js `unstable_cache` wrapper lives in each page.tsx server component; TTL 60s with `revalidateTag` bust on mutation |
| Type contract | Shared (imports safe on client + server) | — | `student-analytics-types.ts` has NO server-only marker; both `AnalyticsClient.tsx` (client) and `student-analytics.ts` (server) import it |
| Fetcher | Frontend Server (SSR) | — | `fetchStudentAnalytics()` uses `createAdminClient()` (server-only); never executed on client |
| KPI render | Browser / Client | Frontend Server | `AnalyticsClient.tsx` is a `"use client"` component; receives `initialData` prop from server page |
| Cache invalidation on mutation | API / Backend | — | `revalidateTag(studentAnalyticsTag(studentId))` is called from `api/deals/route.ts`, `api/reports/route.ts`, `api/roadmap/route.ts`, `api/work-sessions/route.ts`, `api/work-sessions/[id]/route.ts` — none of these touch the renamed keys, only tag busting |

**Tier sanity check for planners:** Every task in the plan MUST assign the SQL migration to the DB tier, both cache-key bumps to the SSR tier, the type rename to shared, and the two KPI card rewrites (plus icon/label/DIY-guard edits) to the client tier. No task should move aggregation logic out of the RPC.

## Standard Stack

### Core (already in place — verified via `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router + `unstable_cache` + server components | Already locked by project |
| react | 19.x | Client components | Already locked |
| typescript | ^5 | Strict type contract on RPC payload | tsc is the authoritative stale-consumer detector |
| @supabase/supabase-js | ^2.99.2 | RPC invocation via `admin.rpc("get_student_analytics", …)` | Already the only Postgres client in the project |
| zod | ^4.3.6 | `RangeSchema` / `PageSchema` on both page.tsx files | Not touched by this phase (range/page params unchanged) |
| lucide-react | (project-pinned) | Icons `Mail`, `Users` currently; plan should keep `Mail` + `Users` OR switch to `Send` + `UserPlus` — see Discretion note | Existing convention |

### Supporting — none new

No new library required. This is a pure contract / type / cache-key / label change.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cache-key string bump (`["student-analytics"]` → `["student-analytics-v2"]`) | `revalidatePath("/student/analytics")` on deploy via migration side-effect | Rejected — tag bust only fires on mutation, not on deploy; relying on TTL means up-to-60s rollover window where stale cache returns old shape to new consumer = runtime crash on `.toLocaleString()`. Key bump is atomic. |
| Zod schema runtime-validate the RPC payload in `fetchStudentAnalytics` | Type-only cast (current pattern `data as unknown as StudentAnalyticsPayload`) | Out of scope per CONTEXT.md (no back-compat shims requested). Noted as future hardening; NOT part of Phase 61. |
| Introduce `StudentAnalyticsTotalsV2` alongside old type for staged rollout | In-place rename of `StudentAnalyticsTotals` | CONTEXT explicitly prefers in-place rename; breaking-change posture IS the safety mechanism (tsc catches every stale consumer). |

### Installation

**No new packages.** Phase is pure code + SQL.

**Version verification:** Re-confirmed via `cat package.json`: `next@16.1.6`, `@supabase/supabase-js@^2.99.2`, `zod@^4.3.6` — all current as of the last v1.7 commit (2026-04-16).

## Architecture Patterns

### System Architecture Diagram (data flow for `/student/analytics`)

```
  Browser navigates to /student/analytics?range=30d&page=1
            │
            ▼
  page.tsx server component
    ├─ requireRole("student")                    ← auth guard
    ├─ createAdminClient() → profile.joined_at
    └─ unstable_cache(fetcher, ["student-analytics"],       ◄── KEY BUMPED IN 00033 COMMIT
                      { revalidate: 60,
                        tags: [studentAnalyticsTag(user.id)] })
            │
            ▼
  fetchStudentAnalytics(studentId, range, page)
            │
            ▼ (admin.rpc)
  public.get_student_analytics(uuid, text, int, int) RETURNS jsonb
    ├─ auth guard: v_caller = p_student_id OR NULL (service_role)
    ├─ v_totals = jsonb_build_object(
    │       'total_hours', ...,
    │       'total_brand_outreach',    SUM(brands_contacted),        ◄── RENAMED FROM total_emails
    │       'total_influencer_outreach', SUM(influencers_contacted), ◄── RENAMED FROM total_influencers
    │       'total_deals', 'total_revenue', 'total_profit', ...)
    └─ RETURNS { totals, streak, outreach_trend, hours_trend,
                 deals, deal_summary, roadmap_progress, range, page,
                 page_size, total_deal_count }
            │
            ▼
  page.tsx → <AnalyticsClient initialData={data} viewerRole="student" …>
            │ (or viewerRole="student_diy" for /student_diy/analytics sibling page)
            ▼
  "use client" AnalyticsClient
    └─ KPI strip (grid)
          ├─ Total Hours                  (unchanged)
          ├─ Total Brand Outreach         ◄── NEW CARD (replaces Total Emails; no longer hidden for DIY)
          ├─ Total Influencer Outreach    ◄── NEW CARD (replaces Total Influencers; no longer hidden for DIY)
          ├─ Total Deals / Revenue / Profit (unchanged)
  Outreach Trend chart reads data.outreach_trend[].brands/.influencers  ← UNTOUCHED (SA-08)
```

**Parallel /student_diy/analytics page.tsx** follows identical pattern, differs only in `requireRole("student_diy")` + `basePath="/student_diy/analytics"` + `viewerRole="student_diy"`. It imports `AnalyticsClient` from the sibling student route folder (`@/app/(dashboard)/student/analytics/AnalyticsClient`).

### Component Responsibilities

| File | Responsibility | Phase 61 edit |
|------|---------------|---------------|
| `supabase/migrations/00023_get_student_analytics.sql` | Current RPC (v1.5 Phase 46) | READ ONLY (reference only); superseded by 00033 |
| `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` | NEW: defensive DROP + CREATE of RPC with new jsonb keys | CREATE |
| `src/lib/rpc/student-analytics-types.ts` | Pure types module (client-safe) — `StudentAnalyticsTotals`, `StudentAnalyticsPayload`, `studentAnalyticsTag()` | EDIT lines 20-27 |
| `src/lib/rpc/student-analytics.ts` | Server-only fetcher (re-exports types from sibling) | NO EDIT (re-exports propagate automatically) |
| `src/app/(dashboard)/student/analytics/page.tsx` | SSR + cache wrapper for `/student/analytics` | EDIT line 50 (cache key bump) |
| `src/app/(dashboard)/student_diy/analytics/page.tsx` | SSR + cache wrapper for `/student_diy/analytics` | EDIT line 50 (cache key bump) |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | "use client" render — KPI strip, charts, deal table | EDIT grid-col ternary (line 182), hide-guard (line 198), two KpiCard blocks (lines 200-210), labels, icons |
| `src/lib/types.ts:929-937` | Supabase CLI-generated RPC args type (`get_student_analytics`) | NO EDIT — RPC Args signature `(p_student_id, p_range, p_page, p_page_size)` is unchanged; only the `Returns: Json` payload shape changes, and `Json` is opaque to tsc. |

### Pattern 1: Defensive RPC DROP before CREATE (mandatory per STATE.md)

**What:** Before every `CREATE OR REPLACE FUNCTION`, DROP every existing overload by iterating `pg_proc` + `pg_get_function_identity_arguments`. Prevents PGRST203 from future signature drift.
**When to use:** Every v1.8 migration that touches an existing RPC.
**Template:**
```sql
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics'
  LOOP
    EXECUTE format('DROP FUNCTION public.get_student_analytics(%s) CASCADE', r.args);
  END LOOP;
END $drop$;
```
**Source:** `.planning/research/PITFALLS.md:19-32` (authoritative v1.8 template). Pattern already used in migrations 00025, 00028, 00032.

**Post-migration assert** (belongs INSIDE the migration file as a `DO` block after the CREATE):
```sql
DO $assert$
BEGIN
  IF (SELECT COUNT(*) FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics') <> 1 THEN
    RAISE EXCEPTION 'get_student_analytics has <> 1 overload after migration';
  END IF;
END $assert$;
```

### Pattern 2: Cache-key bump in same commit as RPC shape change

**What:** When a breaking jsonb shape lands, the `unstable_cache` key literal MUST change in the same commit. This atomically orphans every stale entry; the new key is a fresh cache namespace.
**When to use:** Every breaking RPC shape change — F1 hits this.
**Example (page.tsx `unstable_cache` call):**
```typescript
// src/app/(dashboard)/student/analytics/page.tsx:47-55 BEFORE
const fetchCached = unstable_cache(
  async (studentId: string, r: StudentAnalyticsRange, p: number) =>
    fetchStudentAnalytics(studentId, r, p),
  ["student-analytics"],
  {
    revalidate: 60,
    tags: [studentAnalyticsTag(user.id)],
  },
);

// AFTER (both page.tsx files get identical bump)
const fetchCached = unstable_cache(
  async (studentId: string, r: StudentAnalyticsRange, p: number) =>
    fetchStudentAnalytics(studentId, r, p),
  ["student-analytics-v2"],
  {
    revalidate: 60,
    tags: [studentAnalyticsTag(user.id)],
  },
);
```
**Source:** `.planning/research/PITFALLS.md:57-70`; current call sites verified at `student/analytics/page.tsx:50` and `student_diy/analytics/page.tsx:50`.

### Pattern 3: In-place type rename + breaking-change discipline

**What:** Rename the two keys in `StudentAnalyticsTotals` in place. Do NOT introduce a v2 alias or make fields optional.
**When to use:** CONTEXT.md explicitly locks this — "breaking is the point".
**Example:**
```typescript
// src/lib/rpc/student-analytics-types.ts:20-27 BEFORE
export type StudentAnalyticsTotals = {
  total_hours: number;
  total_emails: number;
  total_influencers: number;
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};

// AFTER
export type StudentAnalyticsTotals = {
  total_hours: number;
  total_brand_outreach: number;       // was total_emails (correctly aggregated as SUM(brands_contacted))
  total_influencer_outreach: number;  // was total_influencers (renamed for symmetry + clarity)
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};
```
After this edit, `npx tsc --noEmit` is GUARANTEED to error at `AnalyticsClient.tsx:203` and `:208` — and ONLY at those two sites (grep-verified).

### Anti-Patterns to Avoid

- **Adding a back-compat shim** (`total_emails?: number` or a SQL `jsonb_build_object` that still emits old keys): hides the tsc signal, silently preserves the double-count bug for any unmigrated consumer.
- **Bumping ONE page's cache key but not both** (`/student/analytics` gets bumped but `/student_diy/analytics` doesn't, or vice versa): DIY users hit up-to-60s crash window.
- **Renaming the RPC function name** (`get_student_analytics` → `get_student_analytics_v2`): would require updating `fetchStudentAnalytics` + the Supabase-generated `Database["public"]["Functions"]` type in `src/lib/types.ts:929-937`. Out of scope; rename only the jsonb KEYS inside the return value.
- **Changing the RPC signature args** (`p_student_id uuid, p_range text, p_page int, p_page_size int`): would change `Args` shape and trigger overload collision risk. PITFALLS.md 1-A warns: any future extension must DROP old signature first — but this phase does NOT extend the signature.
- **Using `as any` to silence tsc** at the call site instead of fixing the consumer: PITFALLS.md 1-B direct warning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RPC shape migration | A custom jsonb-rewrite trigger or a view overlay | Migration 00033 with `DROP FUNCTION … (identity_args)` + `CREATE OR REPLACE` | Postgres function replacement is the native pattern; anything else diverges from 00023-00032 precedent |
| Cache invalidation on deploy | Scripted `revalidateTag` call on deploy or TTL=0 for 60s after deploy | Next.js `unstable_cache` key-literal bump (atomic namespace switch) | Tag-based invalidation fires only on user mutation, not deploy; TTL=0 needs runtime coordination |
| Breaking-change migration detection | Custom grep script in CI | `npx tsc --noEmit` (already in post-phase gate) | The `StudentAnalyticsTotals` type IS the breakage detector; tsc already runs at phase gate per CLAUDE.md |
| Runtime RPC-payload validation | Hand-rolled shape-check in `fetchStudentAnalytics` | Zod `safeParse` (future hardening; OUT OF SCOPE for Phase 61) | CONTEXT.md does not mandate runtime validation; type-level contract is sufficient for breaking-change posture |

**Key insight:** This phase is deliberately a minimum-surface breaking contract change. The "don't hand-roll" discipline here is to NOT add safety nets (back-compat shims, runtime schemas, dual-write) that would mask the breaking-change signal that `tsc` and a grep audit already provide.

## Common Pitfalls

### Pitfall 1: SSR crash on stale `unstable_cache` after breaking RPC shape (PITFALLS.md 1-A)

**What goes wrong:** After the migration is applied, any cached entry still holds the OLD payload shape with `total_emails` / `total_influencers`. The new client reads `data.totals.total_brand_outreach.toLocaleString()` — on a stale entry that field is `undefined`, and `.toLocaleString()` crashes SSR.
**Why it happens:** `unstable_cache` identifies entries by the literal key array. A deploy changes payload shape but NOT the key. Entries survive for up to 60s (TTL) plus on-disk `.next/cache` across the swap. The per-user `studentAnalyticsTag` bust only fires on mutation, not deploy.
**How to avoid:** Bump the literal cache-key string in `/student/analytics/page.tsx:50` AND `/student_diy/analytics/page.tsx:50` in the SAME commit as the migration.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'toLocaleString')` in SSR error log during the first 60s after deploy. The `error.tsx` boundary at `src/app/(dashboard)/student/analytics/error.tsx:15` would log it.
**Grep check:** After the phase, `rg -n '"student-analytics' src/` must show both call sites pointing at the NEW key (e.g. `"student-analytics-v2"`).

### Pitfall 2: Stale `as any` / `as unknown as StudentAnalyticsPayload` escape hatches (PITFALLS.md 1-B)

**What goes wrong:** The fetcher does `return data as unknown as StudentAnalyticsPayload` (`student-analytics.ts:70`). TypeScript trusts the cast. If any consumer also casts to `any` before touching `totals.total_emails`, tsc will NOT catch the rename.
**Grep audit** (planner MUST run and confirm ZERO unexpected hits):
```bash
rg -n 'total_emails\b|total_influencers\b' src/
```
**Expected hits at research time** (all must be addressed or explicitly whitelisted):
- `src/lib/rpc/student-analytics-types.ts:22-23` — THE TYPE (rename target)
- `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:203, 208` — TWO CONSUMERS (rename target)
- `src/lib/types.ts:728, 740, 752` — these reference `total_influencers_contacted` (different column on `student_kpi_summaries` table, NOT `total_influencers`). **Do not rename.** Verified as unrelated via Read tool.
**Post-phase expectation:** The grep `rg -n 'total_emails|total_influencers' src/` returns zero hits (the `total_influencers_contacted` hits in `types.ts` remain — they match the broader regex but are a different identifier; use `\b` boundary in the verification grep).
```bash
rg -n 'total_emails\b|total_influencers\b' src/  # must return 0 hits post-phase
```

### Pitfall 3: PGRST203 overload collision (PITFALLS.md X-0)

**What goes wrong:** The v1.7 hotfix (migration 00032) dropped an orphaned 4-arg `get_sidebar_badges` overload that Phase 55's `CREATE OR REPLACE` had failed to replace because it used a different arg list. For F1 the signature IS unchanged (`(uuid, text, int, int)`), so `CREATE OR REPLACE` does replace cleanly — **but** relying on that is fragile. Use the defensive `DO $drop$` block anyway (CONTEXT locks this).
**How to avoid:** Copy the defensive-drop template from `.planning/research/PITFALLS.md:19-32` (also used in migrations 00025, 00028, 00032).
**Post-migration assert:** `SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_student_analytics'` MUST return exactly `1`.

### Pitfall 4: Grid column-count ternary left pointing to old (4-col) DIY layout (SA-07)

**What goes wrong:** `AnalyticsClient.tsx:182` currently reads:
```tsx
viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6",
```
This was set because DIY users previously saw 4 KPIs (Total Hours, Total Deals, Total Revenue, Total Profit — the Emails/Influencers cards were hidden by the guard at line 198). After SA-07 resolves as SHOW, DIY users see all 6 KPIs. The grid ternary MUST be updated to `"lg:grid-cols-6"` unconditionally (or removed altogether) — otherwise DIY gets a cramped 6-into-4 overflow.
**How to avoid:** When removing the `viewerRole !== "student_diy"` conditional around the two KpiCards (lines 198-211), also simplify line 181-183 to a single class string `"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"`.
**Warning sign:** DIY user reports "cards are tiny" or "cards wrapped weirdly".

### Pitfall 5: `outreach_count` backward-compat column is orthogonal (PITFALLS.md 1-C)

**What goes wrong:** `src/app/api/reports/route.ts:97,145` writes `outreach_count: brands_contacted + influencers_contacted` as a backward-compat column on `daily_reports`. This column is consumed by `src/components/coach/ReportsTab.tsx:13,79`, `ReportRow.tsx:96`, `CoachReportsClient.tsx:17`, `src/app/(dashboard)/coach/reports/page.tsx:74`, `src/app/(dashboard)/student/report/history/page.tsx:112`.
**Why it's NOT a Phase 61 concern:** The `outreach_count` column is a FIELD on `daily_reports`, separate from the `totals.total_emails` JSONB KEY in the RPC payload. They are only coincidentally both `brands + influencers`. Renaming/removing the RPC key does NOT affect any `outreach_count` consumer. SA-09 explicitly preserves the daily report form schema.
**Action for planner:** Do NOT touch `outreach_count` writers or readers. This is documented tech debt for a future phase. Confirm tsc does not flag any `outreach_count` usage after the phase.

## Runtime State Inventory

> Phase 61 is a breaking contract change on a database function + its TypeScript consumer. Every relevant state category addressed below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `daily_reports.brands_contacted` and `daily_reports.influencers_contacted` columns (the underlying integers the RPC aggregates) are untouched. No historical row needs data migration — the RPC reads existing rows with the new SUM expressions. The `outreach_count` backward-compat column is also untouched (PITFALLS.md 1-C). | NONE — no data migration. |
| Live service config | No Supabase Studio dashboard, no pgAdmin snippet, no external service references the renamed JSONB keys. `get_student_analytics` is invoked ONLY from `src/lib/rpc/student-analytics.ts:52` via `admin.rpc()`. Confirmed by `Grep` `get_student_analytics` across entire repo. | NONE. |
| OS-registered state | None. Next.js dev server + `npm run build` are the only consumers; no cron, no task scheduler, no systemd unit references the RPC name or payload. | NONE. |
| Secrets / env vars | None. The RPC is invoked via the service-role-key admin client; the Supabase URL + key env vars are unchanged. | NONE. |
| Build artifacts | `.next/cache/` contains prerendered entries keyed on `["student-analytics"]`. After the cache-key bump to `["student-analytics-v2"]`, old entries become orphaned (ignored by lookup) and are evicted by LRU. `src/lib/types.ts:929-937` is Supabase-CLI-generated (`supabase gen types typescript`); its `Returns: Json` for `get_student_analytics` is already opaque to the payload shape — **no regeneration required** for this phase. | Cache bust: automatic after key rename. No `types.ts` regen needed. |

**Verified nothing found in category:** The RPC auth guard (`v_caller IS DISTINCT FROM p_student_id`) operates on uuids, not the renamed JSONB keys; no policy or grant references the keys. `GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int) TO authenticated, service_role` references the SIGNATURE (unchanged), not the payload.

## Consumer Enumeration — Complete File:Line List

Verified via `rg -n '\.total_emails|\.total_influencers' src/` (with word-boundary-ish heuristic; manually excluded `total_influencers_contacted` false positives — different identifier).

### Files that MUST change

| File | Line(s) | Current Reference | New Reference |
|------|---------|-------------------|---------------|
| `src/lib/rpc/student-analytics-types.ts` | 22 | `total_emails: number;` | `total_brand_outreach: number;` |
| `src/lib/rpc/student-analytics-types.ts` | 23 | `total_influencers: number;` | `total_influencer_outreach: number;` |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 182 | `viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6"` | `"lg:grid-cols-6"` (unconditional) |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 198 | `{viewerRole !== "student_diy" && ( <> …Emails…Influencers… </> )}` opening guard | Remove wrapper; keep two KpiCards unconditional |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 200-204 | `<KpiCard icon={<Mail …/>} label="Total Emails" value={data.totals.total_emails.toLocaleString()} />` | `<KpiCard icon={<Mail …/>} label="Total Brand Outreach" value={data.totals.total_brand_outreach.toLocaleString()} />` (icon discretion — see below) |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 205-209 | `<KpiCard icon={<Users …/>} label="Total Influencers" value={data.totals.total_influencers.toLocaleString()} />` | `<KpiCard icon={<Users …/>} label="Total Influencer Outreach" value={data.totals.total_influencer_outreach.toLocaleString()} />` |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 210 | `</>` closing fragment | Remove (fragment no longer needed) |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | 211 | `)}` closing conditional | Remove |
| `src/app/(dashboard)/student/analytics/page.tsx` | 50 | `["student-analytics"],` | `["student-analytics-v2"],` |
| `src/app/(dashboard)/student_diy/analytics/page.tsx` | 50 | `["student-analytics"],` | `["student-analytics-v2"],` (IDENTICAL bump) |
| `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` | NEW FILE | — | Defensive DROP + `CREATE OR REPLACE FUNCTION` with renamed jsonb keys + post-assert + re-grant |

### Files that MUST NOT change (verified out-of-scope)

| File | Reason |
|------|--------|
| `src/lib/rpc/student-analytics.ts` | Re-exports types; no direct reference to renamed keys |
| `src/lib/types.ts:728, 740, 752` | References `total_influencers_contacted` on `student_kpi_summaries` table — DIFFERENT identifier, DIFFERENT table |
| `src/lib/types.ts:929-937` | Supabase-CLI-generated `get_student_analytics` Args — signature unchanged; `Returns: Json` is payload-shape-opaque |
| `src/app/api/reports/route.ts`, `api/deals/route.ts`, `api/roadmap/route.ts`, `api/work-sessions/route.ts`, `api/work-sessions/[id]/route.ts` | Only import `studentAnalyticsTag` for cache bust — never touch renamed keys |
| Outreach trend chart (`AnalyticsClient.tsx:235-339`) | Reads `data.outreach_trend[].brands / .influencers` — DIFFERENT path (`outreach_trend`, not `totals`); SA-08 explicit "NOT modified" |
| Daily report form + `outreach_count` column writers/readers | SA-09 preserves form; `outreach_count` is orthogonal (PITFALLS.md 1-C) |
| `supabase/migrations/00023_get_student_analytics.sql` | Historical source; migration history is append-only |
| `supabase/migrations/00024_get_coach_dashboard.sql:113` | Comment only ("see total_emails in get_student_analytics") — stale reference to old key name. Non-functional; leave as-is (or silently update) per planner discretion |
| `src/app/(dashboard)/student/analytics/error.tsx`, `loading.tsx` | No payload references |

### Icon choice (Claude's Discretion)

Current icons:
- `Mail` (line 201) — historically paired with "Total Emails"
- `Users` (line 206) — historically paired with "Total Influencers"

Three options, in order of preference:

1. **Keep current icons.** `Mail` for "Total Brand Outreach" (outreach = emails to brands), `Users` for "Total Influencer Outreach" (influencers ARE users). Minimum churn; zero icon import changes.
2. **Swap to `Send` + `UserPlus`** (both already in lucide-react if used elsewhere — verify before importing). More semantically precise ("reaching out to" vs. "sending email to").
3. **Swap to `Briefcase` + `Users`**. Brand = business. Less precedent in codebase.

**Recommendation: Option 1.** Icon semantics are weak signal; the LABEL carries the meaning. Minimum churn keeps the diff auditable.

## Migration 00033 Structural Template

Based on 00023 structure + defensive-drop template from PITFALLS.md + grant pattern from 00023:261-262:

```sql
-- supabase/migrations/00033_fix_student_analytics_outreach_split.sql
-- Phase 61 (v1.8 F1): Re-split student analytics outreach KPIs.
-- Breaking jsonb shape change — removes total_emails, total_influencers;
-- adds total_brand_outreach, total_influencer_outreach.
-- Consumers updated in the same commit: student-analytics-types.ts,
-- AnalyticsClient.tsx, plus unstable_cache keys on both analytics pages.

BEGIN;

-- 1. Defensive drop every existing overload of get_student_analytics
--    (PGRST203 prevention per PITFALLS.md X-0 + 00032 lesson).
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics'
  LOOP
    EXECUTE format('DROP FUNCTION public.get_student_analytics(%s) CASCADE', r.args);
  END LOOP;
END $drop$;

-- 2. Recreate with new jsonb totals payload.
--    Body is identical to 00023 EXCEPT v_totals jsonb_build_object:
--      'total_emails' → REMOVED
--      'total_influencers' → REMOVED
--      'total_brand_outreach' = SUM(COALESCE(brands_contacted,0)) ← NEW
--      'total_influencer_outreach' = SUM(COALESCE(influencers_contacted,0)) ← NEW (was named total_influencers; math same)
CREATE OR REPLACE FUNCTION public.get_student_analytics(
  p_student_id uuid,
  p_range      text DEFAULT '30d',
  p_page       int  DEFAULT 1,
  p_page_size  int  DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
-- … (copy body from 00023 verbatim; change only section 5 "Lifetime totals")
-- Section 5 new jsonb_build_object keys:
--   'total_brand_outreach',
--     COALESCE((
--       SELECT SUM(COALESCE(brands_contacted,0))
--       FROM daily_reports
--       WHERE student_id = p_student_id AND submitted_at IS NOT NULL
--     ), 0),
--   'total_influencer_outreach',
--     COALESCE((
--       SELECT SUM(COALESCE(influencers_contacted,0))
--       FROM daily_reports
--       WHERE student_id = p_student_id AND submitted_at IS NOT NULL
--     ), 0),
$$;

COMMENT ON FUNCTION public.get_student_analytics(uuid, text, int, int) IS
  'Phase 61 (v1.8 F1): Breaking re-split — totals.total_brand_outreach + total_influencer_outreach replace total_emails + total_influencers. Cache keys bumped to "student-analytics-v2" in same commit. Supersedes 00023.';

GRANT EXECUTE ON FUNCTION public.get_student_analytics(uuid, text, int, int)
  TO authenticated, service_role;

-- 3. Post-migration assert — exactly one overload must exist.
DO $assert$
BEGIN
  IF (SELECT COUNT(*) FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics') <> 1 THEN
    RAISE EXCEPTION 'Migration 00033 post-assert failed: get_student_analytics has <> 1 overload';
  END IF;
END $assert$;

COMMIT;
```

**Body copy strategy:** The migration body is ~260 lines of plpgsql from 00023. Plan should direct the implementer to copy 00023 verbatim and change ONLY the `jsonb_build_object` call inside `v_totals` (lines 91-116 of 00023). Auth guard, range validation, outreach_trend, hours_trend, deals, deal_summary, roadmap_progress, assembly — all unchanged.

## Code Examples

### Example 1: Defensive RPC drop (verbatim v1.8 template)

```sql
-- Source: .planning/research/PITFALLS.md:19-32 (v1.8 authoritative template)
DO $drop$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_student_analytics'
  LOOP
    EXECUTE format('DROP FUNCTION public.get_student_analytics(%s) CASCADE', r.args);
  END LOOP;
END $drop$;
```

### Example 2: `unstable_cache` key bump

```typescript
// Source: src/app/(dashboard)/student/analytics/page.tsx:47-55 (verified via Read)
// BEFORE
const fetchCached = unstable_cache(
  async (studentId: string, r: StudentAnalyticsRange, p: number) =>
    fetchStudentAnalytics(studentId, r, p),
  ["student-analytics"],
  { revalidate: 60, tags: [studentAnalyticsTag(user.id)] },
);

// AFTER (apply to BOTH page.tsx files)
const fetchCached = unstable_cache(
  async (studentId: string, r: StudentAnalyticsRange, p: number) =>
    fetchStudentAnalytics(studentId, r, p),
  ["student-analytics-v2"],
  { revalidate: 60, tags: [studentAnalyticsTag(user.id)] },
);
```

### Example 3: KPI strip after SA-07 resolve-as-SHOW

```tsx
// Source: src/app/(dashboard)/student/analytics/AnalyticsClient.tsx:178-227 (verified via Read)
// BEFORE (current — DIY hidden)
<section
  aria-label="Lifetime totals"
  className={cn(
    "grid grid-cols-2 sm:grid-cols-3 gap-4 motion-safe:animate-fadeIn",
    viewerRole === "student_diy" ? "lg:grid-cols-4" : "lg:grid-cols-6",
  )}
>
  <KpiCard icon={<Clock … />} label="Total Hours" value={formatHours(data.totals.total_hours)} suffix={…} />
  {viewerRole !== "student_diy" && (
    <>
      <KpiCard icon={<Mail … />} label="Total Emails" value={data.totals.total_emails.toLocaleString()} />
      <KpiCard icon={<Users … />} label="Total Influencers" value={data.totals.total_influencers.toLocaleString()} />
    </>
  )}
  <KpiCard icon={<Handshake … />} label="Total Deals" value={data.totals.total_deals.toLocaleString()} />
  <KpiCard icon={<DollarSign … />} label="Total Revenue" value={formatMoney(data.totals.total_revenue)} />
  <KpiCard icon={<TrendingUp … />} label="Total Profit" value={formatMoney(data.totals.total_profit)} />
</section>

// AFTER (SA-07 = SHOW; two new cards; no DIY guard)
<section
  aria-label="Lifetime totals"
  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"
>
  <KpiCard icon={<Clock … />} label="Total Hours" value={formatHours(data.totals.total_hours)} suffix={…} />
  <KpiCard icon={<Mail … />} label="Total Brand Outreach" value={data.totals.total_brand_outreach.toLocaleString()} />
  <KpiCard icon={<Users … />} label="Total Influencer Outreach" value={data.totals.total_influencer_outreach.toLocaleString()} />
  <KpiCard icon={<Handshake … />} label="Total Deals" value={data.totals.total_deals.toLocaleString()} />
  <KpiCard icon={<DollarSign … />} label="Total Revenue" value={formatMoney(data.totals.total_revenue)} />
  <KpiCard icon={<TrendingUp … />} label="Total Profit" value={formatMoney(data.totals.total_profit)} />
</section>
```

Note: the `cn(…)` import (line 50) can remain — it's used elsewhere in the file for conditional classes on the outer `<div>` (line 163). Only the `cn(…)` usage wrapping the grid className is replaced with a literal string.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.5 Phase 46 — single `total_emails` KPI combining `SUM(brands + influencers)` (double-counted influencers + mis-labeled as "Emails") | v1.8 Phase 61 — two independent KPIs: `total_brand_outreach` + `total_influencer_outreach` | Phase 61 (this phase) | Fixes the double-count bug; renames for clarity; breaking RPC contract |
| Supabase migration `CREATE OR REPLACE` alone | `DO $drop$` loop over `pg_proc` + `CREATE OR REPLACE` | v1.5 migrations 00025, 00028; locked in v1.7 after 00032 PGRST203 hotfix | Prevents dual-overload collisions on future signature drift |
| Rely on `revalidateTag` alone for cache bust across deploys | Bump literal `unstable_cache` key string in same commit as breaking shape | v1.8 convention per PITFALLS.md | Atomic namespace switch; no TTL rollover crash window |

**Deprecated/outdated:**
- `totals.total_emails` jsonb key in `get_student_analytics` payload (removed by this phase).
- `totals.total_influencers` jsonb key (removed; name ambiguous — replaced by `total_influencer_outreach`).
- "Total Emails" KPI card label (replaced by "Total Brand Outreach").
- "Total Influencers" KPI card label (replaced by "Total Influencer Outreach").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Choosing `Mail` + `Users` icons for the two new cards (keeping current icons) is acceptable | Consumer Enumeration → Icon choice | LOW — purely cosmetic; planner or user can override |
| A2 | The grid simplification from `cn(..., ternary)` to literal `"lg:grid-cols-6"` string is the cleanest fix; planner may prefer keeping `cn()` if other classes join | Pitfall 4 / Code Example 3 | LOW — both render identically; style preference only |
| A3 | The comment at `supabase/migrations/00024_get_coach_dashboard.sql:113` ("see total_emails in get_student_analytics") is informational only and does not affect runtime | Consumer Enumeration → MUST NOT change | LOW — comment-only; can be updated or left as-is |
| A4 | `src/lib/types.ts:929-937` (Supabase-CLI-generated RPC Args for `get_student_analytics`) does NOT need regeneration because only the `Returns: Json` shape changes and `Json` is opaque | Component Responsibilities + Runtime State Inventory | MEDIUM — verify by running `npx tsc --noEmit` after the changes. If tsc flags anything in `types.ts`, re-run `supabase gen types typescript` (not needed otherwise) |

**Everything else in this research was verified directly against the source tree via Grep and Read tools.**

## Open Questions

None blocking planning.

Minor planner judgment calls (already flagged as Claude's Discretion in CONTEXT.md):

1. **Icon choice for the two new cards.** Recommendation: keep current `Mail` + `Users`. Alternative: `Send` + `UserPlus`. Impact: cosmetic.
2. **Whether to update the stale comment in `00024_get_coach_dashboard.sql:113`.** Recommendation: leave as-is (migration history is append-only). Impact: none.
3. **Whether to pre-declare `StudentAnalyticsTotalsV1` type alias for OUT-OF-SCOPE future consumers.** Recommendation: do NOT. CONTEXT locks in-place rename.

## Environment Availability

> Phase 61 is a code + SQL-only change. No new external tool, runtime, or service is required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (existing project runtime) | `next build`, `tsc --noEmit`, `eslint` | ✓ | (inherits from project) | — |
| Supabase local DB (for local migration apply) | `supabase db push` / `supabase migration up` | ✓ (project uses Supabase) | (inherits) | Alternatively: Supabase Studio SQL editor for manual apply |
| `@supabase/supabase-js` 2.99.2 | RPC invocation via `admin.rpc()` | ✓ | 2.99.2 (verified in package.json) | — |
| TypeScript 5.x + strict mode | `tsc --noEmit` to catch every stale consumer | ✓ | ^5 (verified in package.json) | — |
| lucide-react (`Mail`, `Users` icons) | KPI card icons | ✓ (already imported at `AnalyticsClient.tsx:36, 38`) | (inherits) | — |
| `next/cache` (`unstable_cache`) | Cache-key wrappers on both pages | ✓ | Next.js 16.1.6 built-in | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no `vitest`, `jest`, `playwright`, `__tests__/`, or `tests/` directory present (verified via filesystem scan and `package.json`) |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (authoritative; per CLAUDE.md Hard Rules) |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` (CLAUDE.md + STATE.md post-phase gate) |

Because no test framework exists, Nyquist validation for Phase 61 relies on: (a) tsc as the breaking-consumer oracle, (b) `npm run build` as the SSR / cache-wiring smoke test, (c) a handful of grep / psql assertions, (d) one manual render check per route.

### Phase Requirements → Validation Map

| Req ID | Behavior | Validation Type | Automated Command / Evidence | File Exists? |
|--------|----------|-----------------|------------------------------|-------------|
| SA-01 | KPI card "Total Brand Outreach" equals `SUM(COALESCE(brands_contacted,0))` | SQL shape check | `psql -c "SELECT jsonb_object_keys(public.get_student_analytics(<uuid>, '30d', 1, 25)->'totals')"` — output MUST include `total_brand_outreach` AND NOT include `total_emails`. Manual UI render: open `/student/analytics`, verify card present with correct label. | Wave 0: grep the new migration file; runtime check requires DB populated |
| SA-02 | KPI card "Total Influencer Outreach" equals `SUM(COALESCE(influencers_contacted,0))` | SQL shape check + UI render | Same psql check must include `total_influencer_outreach`; manual UI render on `/student/analytics` | Same as SA-01 |
| SA-03 | Migration 00033 drops + recreates with defensive pattern; no PGRST203 risk | SQL post-migration assert + migration file grep | Post-migration assert is embedded in the migration (`DO $assert$ … COUNT(*) = 1`). Grep verification: `rg -n "DO \\\$drop\\\$" supabase/migrations/00033_*.sql` — must find the defensive drop block | Migration file created in Wave 0 |
| SA-04 | Type rename; tsc catches every stale consumer | Compile-time | `npx tsc --noEmit` — must exit 0. Pre-phase, commenting out the rename before migrating consumers should produce exactly 2 errors at `AnalyticsClient.tsx:203, 208` | `npx tsc --noEmit` |
| SA-05 | Cache key bumped at `/student/analytics/page.tsx` | Grep | `rg -n '"student-analytics' src/app/\(dashboard\)/student/analytics/page.tsx` — must match the new literal (e.g., `"student-analytics-v2"`) and NOT match old literal | grep command |
| SA-06 | Cache key bumped identically at `/student_diy/analytics/page.tsx` | Grep | `rg -n '"student-analytics' src/app/\(dashboard\)/student_diy/analytics/page.tsx` — same new literal | grep command |
| SA-07 | DIY users see new cards; no hide-guard | UI render (DIY) + grep | `rg -n 'viewerRole !== "student_diy"' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` — must return 0 hits. Manual: log in as `student_diy` user, navigate to `/student_diy/analytics`, both new cards visible. | Post-edit grep |
| SA-08 | Outreach trend chart NOT modified | Grep invariant | `rg -n 'outreach_trend|data\.outreach_trend' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` — hits at lines 141, 147, 241, 256, 326 must remain; no edit in chart block (lines 235-339) | Post-edit grep |
| SA-09 | Daily report form NOT modified | Grep invariant | `rg -n 'brands_contacted\|influencers_contacted' src/app/api/reports/route.ts` — `brands_contacted` + `influencers_contacted` + `outreach_count` writes at lines 97, 145 remain unchanged | Post-edit grep |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (≤10s after warm cache)
- **Per wave merge:** `npm run lint && npx tsc --noEmit && npm run build` (full CLAUDE.md gate)
- **Phase gate:** Full suite green + SQL shape check (`jsonb_object_keys`) + manual render on `/student/analytics` AND `/student_diy/analytics` before `/gsd-verify-work`

### RED-flag (failure-mode) validations — explicit evidence each is caught

| RED flag | Failure signature | Validation evidence |
|----------|------------------|---------------------|
| PGRST203 overload collision | RPC call returns "Could not choose the best candidate function" | Post-migration `DO $assert$` exits with `EXCEPTION` if COUNT(*) ≠ 1; migration fails loudly |
| Stale TS consumer (any-cast, missing-property error) | `data.totals.total_emails` compiles but crashes at runtime | Grep audit: `rg -n 'total_emails\b\|total_influencers\b' src/` must return 0 (excluding the `total_influencers_contacted` kpi_summaries hits). tsc catches the 2 known consumer lines. No `as any` near `totals` (grep: `rg -n 'as any.*totals\|as unknown.*totals' src/`) |
| 60s cache TTL rollover crash on first deploy | New client reads `data.totals.total_brand_outreach`, stale entry has `total_emails` only, `.toLocaleString()` crashes SSR | `rg -n '"student-analytics"' src/app/\(dashboard\)` must return 0 hits (all instances bumped); `rg -n '"student-analytics-v2"' src/app/\(dashboard\)` must return 2 hits (one per page.tsx) |
| DIY route hide-guard not removed | DIY users see "Total Hours" + "Total Deals" only, missing new cards | `rg -n 'viewerRole !== "student_diy"' src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx` returns 0 hits; DIY grid class is `"lg:grid-cols-6"` not `"lg:grid-cols-4"` |

### GREEN-flag (success-criteria) validations

| GREEN flag | Evidence |
|------------|----------|
| RPC returns new jsonb shape | `psql> SELECT jsonb_object_keys(public.get_student_analytics('<uuid>'::uuid, '30d', 1, 25)->'totals');` yields exactly: `total_hours`, `total_brand_outreach`, `total_influencer_outreach`, `total_deals`, `total_revenue`, `total_profit` — and NOT `total_emails` or `total_influencers` |
| StudentAnalyticsTotals type matches | `npx tsc --noEmit` exits 0; manual Read of `src/lib/rpc/student-analytics-types.ts:20-27` confirms new field names |
| Both pages render both cards | Manual: log in as `student` → `/student/analytics` → 6 KPI cards visible with new labels. Log in as `student_diy` → `/student_diy/analytics` → same 6 cards visible |
| Both cache keys bumped in same commit as migration | `git show <phase-merge-commit> -- supabase/migrations/00033_*.sql src/app/\(dashboard\)/student/analytics/page.tsx src/app/\(dashboard\)/student_diy/analytics/page.tsx` shows all three files changed in one commit; key literal is identical across both pages |

### Wave 0 Gaps

- [ ] `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` — DOES NOT EXIST YET; must be created in Wave 0
- [ ] No test framework install required — validation relies on tsc + build + grep + psql + manual render
- [ ] No new shared fixture needed
- [ ] Planner should add a one-shot SQL assertion step to the verification task (`psql -c "SELECT jsonb_object_keys(…)"`) so the phase gate catches payload drift even if tsc is green

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirectly) | Existing — `requireRole("student")` / `requireRole("student_diy")` at both page.tsx entry points. Phase 61 does not touch auth. |
| V3 Session Management | no | Not affected |
| V4 Access Control | yes | Existing — RPC auth guard at `00023:60-62` / re-implemented in 00033 identically: `v_caller IS DISTINCT FROM p_student_id → RAISE EXCEPTION 'not_authorized'`. Authenticated role callers cannot read another student's analytics; service_role (admin) callers bypass because `v_caller` is NULL and the page's `requireRole` already resolved `user.id`. |
| V5 Input Validation | yes | Existing — `RangeSchema = z.enum(STUDENT_ANALYTICS_RANGES).catch("30d")` + `PageSchema = z.coerce.number().int().min(1).catch(1)` on both page.tsx files; RPC re-validates `p_range IN ('7d','30d','90d','all')` with `RAISE EXCEPTION 'invalid_range'`. Phase 61 does not change args. |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for Next.js 16 + Supabase RPC + Postgres

| Pattern | STRIDE | Standard Mitigation | Phase 61 posture |
|---------|--------|---------------------|------------------|
| Cross-user analytics read (IDOR) | Information Disclosure | RPC auth guard `v_caller = p_student_id` (existing, preserved in 00033); `requireRole` session check at page.tsx | Preserved unchanged |
| Cache key collision leaking other user's payload | Information Disclosure | `studentAnalyticsTag(user.id)` per-user tag + per-invocation args include `studentId`; cache entries are keyed on (key + args) so `["student-analytics-v2"]` + (studentA) is disjoint from (studentB) | Preserved; only the LITERAL string in the key array changes |
| SQL injection into range param | Tampering | `p_range` is an enum-validated plpgsql text with explicit `IF p_range NOT IN (…)` RAISE; no dynamic SQL against the param | Preserved |
| PGRST203 dual-overload dispatch | Denial of Service | Defensive `DO $drop$ … pg_get_function_identity_arguments` block + post-migration assert | NEW in 00033; was absent from 00023 |
| SSR crash on stale cache after breaking shape | Availability | Atomic cache-key bump in same commit | NEW in Phase 61 |

### Hard Rules Compliance (from CLAUDE.md)

Every rule below is a post-phase gate check:

| Rule | Applies | Compliance path |
|------|---------|------------------|
| 1. `motion-safe:` on `animate-*` | yes | Existing `motion-safe:animate-fadeIn` on KPI strip (line 181) + `motion-safe:animate-slideUp` / `motion-safe:animate-fadeIn` on trend + roadmap + deal sections remain unchanged |
| 2. `min-h-[44px]` on interactive elements | yes | No new interactive elements added (KpiCard is a non-interactive display). Existing buttons (RangeSelector, pagination, summary `<details>`) unchanged |
| 3. Accessible labels | yes | KpiCard already uses `<span>` label + `<p>` value; no form inputs added |
| 4. Admin client only in API routes | yes | Fetcher uses `createAdminClient()` ONLY inside server component page.tsx — this is allowed (server component is server code). No admin client import added to AnalyticsClient.tsx (which is "use client") |
| 5. Never-swallow errors | yes | Existing `console.error + throw` pattern in `fetchStudentAnalytics`; no new catch blocks added |
| 6. `response.ok` on `fetch()` | n/a | No `fetch()` calls added |
| 7. `import { z } from "zod"` | yes | Existing imports at both page.tsx:2 unchanged |
| 8. ima-* tokens only | yes | KpiCard already uses `text-ima-text-secondary` / `text-ima-text`; no new colors added |

## Sources

### Primary (HIGH confidence — direct file Read)

- `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00023_get_student_analytics.sql` (lines 29-263) — authoritative current RPC source
- `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00032_drop_get_sidebar_badges_legacy_4arg.sql` — PGRST203 root-cause documentation; cites the defensive pattern
- `C:\Users\ibrah\ima-accelerator-v1\src\lib\rpc\student-analytics-types.ts` (lines 20-27, 66-89) — `StudentAnalyticsTotals` + `StudentAnalyticsPayload` + `studentAnalyticsTag`
- `C:\Users\ibrah\ima-accelerator-v1\src\lib\rpc\student-analytics.ts` — fetcher re-export pattern
- `C:\Users\ibrah\ima-accelerator-v1\src\app\(dashboard)\student\analytics\page.tsx` (lines 47-55) — cache key call site 1
- `C:\Users\ibrah\ima-accelerator-v1\src\app\(dashboard)\student_diy\analytics\page.tsx` (lines 47-55) — cache key call site 2
- `C:\Users\ibrah\ima-accelerator-v1\src\app\(dashboard)\student\analytics\AnalyticsClient.tsx` (lines 178-227) — KPI strip + DIY guard
- `C:\Users\ibrah\ima-accelerator-v1\src\lib\types.ts` (lines 700-950) — Supabase-generated RPC Args + unrelated `total_influencers_contacted` column
- `C:\Users\ibrah\ima-accelerator-v1\.planning\REQUIREMENTS.md` — v1.8 SA-01..09 spec
- `C:\Users\ibrah\ima-accelerator-v1\.planning\STATE.md` — v1.8 constraints + migration numbering + RPC defensive-drop mandate
- `C:\Users\ibrah\ima-accelerator-v1\.planning\phases\61-student-analytics-re-split-f1\61-CONTEXT.md` — locked decisions
- `C:\Users\ibrah\ima-accelerator-v1\CLAUDE.md` — Hard Rules + phase gate commands

### Secondary (HIGH-MEDIUM — pre-existing project research)

- `C:\Users\ibrah\ima-accelerator-v1\.planning\research\PITFALLS.md` (lines 1-130) — F1 pitfall enumeration with exact line numbers; cross-verified against source
- `C:\Users\ibrah\ima-accelerator-v1\.planning\research\ARCHITECTURE.md` — subsystem diagram; 2026-04-16
- `C:\Users\ibrah\ima-accelerator-v1\.planning\research\FEATURES.md` — F1 description
- `C:\Users\ibrah\ima-accelerator-v1\.planning\research\STACK.md` — version matrix
- `C:\Users\ibrah\ima-accelerator-v1\.planning\ROADMAP.md:549-556` — Phase 61 success criteria

### Tertiary (LOW confidence, not used)

None — every claim in this research is source-verified against the local tree.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; package.json verified.
- Architecture: HIGH — all file/line references verified via Read and Grep tools.
- Pitfalls: HIGH — grounded in project-specific v1.7 PGRST203 hotfix (00032) and v1.5 migration 00023 body; cross-verified with `.planning/research/PITFALLS.md`.
- Consumer enumeration: HIGH — authoritative via `rg -n '\.total_emails\|\.total_influencers' src/` returning exactly 2 hits, plus type-definition site.
- Migration template: HIGH — body is a mechanical copy-with-jsonb-key-rename of 00023, with defensive drop appended from PITFALLS.md template; executed pattern in 00025, 00028, 00032.

**Research date:** 2026-04-17

**Valid until:** 2026-05-17 (30 days — stable; no fast-moving external dependencies). Invalidated earlier if: (a) another v1.8 phase lands a migration that touches `get_student_analytics` before Phase 61 ships, or (b) a new file adds a reference to `totals.total_emails` or `totals.total_influencers` (re-run the grep audit). Phase order (`STATE.md`) says 61 ships first, so (a) is unlikely.
