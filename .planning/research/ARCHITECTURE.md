# Architecture Patterns — v1.8 Integration Analysis

**Domain:** IMA Accelerator — Analytics Expansion, Notification Pruning & DIY Parity
**Researched:** 2026-04-16
**Confidence:** HIGH — based entirely on direct codebase inspection
**Researcher role:** Integration points for 6 feature blocks in an existing Next.js 16 + Supabase platform

---

## Existing Architecture Summary (Verified)

**Stack invariants** (unchanged in v1.8):
- Next.js 16 App Router; `src/proxy.ts` replaces `middleware.ts` for route guards
- Server components for all reads (async pages, no `useEffect`); `"use client"` only for interactivity
- `createAdminClient()` from `src/lib/supabase/admin.ts` is imported ONLY in server components / API routes; `import "server-only"` at the top of RPC wrappers hard-fails any client bundle that drags them in
- `unstable_cache` with 60s TTL + `revalidateTag` on every mutation that touches cached data
- 10 tables + `alert_dismissals` + `daily_plans` + `roadmap_undo_log` + `announcements` (v1.6) + `referral_*` columns (v1.7); all RLS-enforced
- Migration numbering: next available is **00033** (00032 already exists as the `get_sidebar_badges` legacy 4-arg hotfix from 2026-04-16)

**Cache tag directory** (verified in `src/lib/rpc/*-types.ts`):
| Tag helper | Scope | Invalidated by |
|------------|-------|----------------|
| `studentAnalyticsTag(studentId)` | Per-student | Deals POST/PATCH/DELETE, work-sessions completion, reports submit, roadmap mutations |
| `coachDashboardTag(coachId)` | Per-coach | Deals mutations, work-sessions, reports |
| `coachAnalyticsTag(coachId)` | Per-coach | Deals mutations, work-sessions, reports |
| `coachMilestonesTag(coachId)` | Per-coach | Deals POST (coach's student), reports review, roadmap progress updates, alert dismiss |
| `ownerAnalyticsTag()` (GLOBAL) | Single key `"owner-analytics"` | Deals POST/PATCH/DELETE, work-sessions completion |
| `"badges"` (GLOBAL) | Single key | Alert dismissals, deal mutations, any sidebar-badge-affecting event |

**Noteworthy v1.8 correction:** the next migration number is **00033** (not 00032 as the brief states). Migration `00032_drop_get_sidebar_badges_legacy_4arg.sql` already exists locally (the Rebrandly/PGRST203 hotfix from 2026-04-16). The roadmap should reference 00033+.

---

## Feature-by-Feature Integration Map

### F1 — Student Analytics: Outreach KPI Relabel + Re-Split (BREAKING RPC)

**What changes:** `get_student_analytics` currently returns `total_emails` (= `SUM(brands + influencers)` — a double-count of influencers AND mislabeled) and `total_influencers` (= `SUM(influencers_contacted)`). v1.8 replaces both with `total_brand_outreach` and `total_influencer_outreach`.

**Files touched:**

| File | Change | Type |
|------|--------|------|
| `supabase/migrations/00033_fix_student_analytics_outreach_split.sql` | NEW migration — `CREATE OR REPLACE FUNCTION get_student_analytics` with new keys | NEW |
| `src/lib/rpc/student-analytics-types.ts` | Lines 22-23: `total_emails` → `total_brand_outreach`, `total_influencers` → `total_influencer_outreach` | MODIFIED |
| `src/app/(dashboard)/student/analytics/AnalyticsClient.tsx` | Lines 201-210: KPI card labels + value bindings | MODIFIED |
| `src/app/(dashboard)/student/analytics/page.tsx` | Line 50: bump `unstable_cache` key from `["student-analytics"]` to `["student-analytics", "v2"]` | MODIFIED |
| `src/app/(dashboard)/student_diy/analytics/page.tsx` | Same cache-key bump | MODIFIED |

**Safe swap sequence — user brief recommends (b) single migration + all consumers updated in same phase. CONFIRMED SAFE. Rationale:**

1. `get_student_analytics` is invoked in exactly 2 places server-side: `fetchStudentAnalytics` (in `src/lib/rpc/student-analytics.ts`) used by both student analytics pages.
2. The RPC is invoked via `SECURITY DEFINER` + service-role grant — no authenticated-client callers hitting PostgREST directly with the old envelope shape.
3. After migration applies, `fetchStudentAnalytics` returns the new payload. Old TypeScript code referencing `totals.total_emails` = compile-time error (strict TS). Migration + code must ship in the same commit.
4. **Cache busting is the real concern** — CLAUDE.md v1.8 constraint #1 is literally about this: "bump `unstable_cache` key for student analytics — breaking RPC change will crash SSR on stale cache." The `unstable_cache` entry key `["student-analytics"]` in both `page.tsx` files MUST change (e.g. `["student-analytics", "v2"]`). Without the bump, a 60-second stale entry with the old shape will be served to AnalyticsClient, which expects the new shape → render crash in production.
5. **Do NOT use option (a) "add new columns alongside old"** — doubles payload size, requires deprecation dance, and the wrong KPI is still bug #1 that the user explicitly wants fixed. Option (b) is cleaner.

**Data-flow change:** no new fields; existing `brands_contacted` / `influencers_contacted` in `daily_reports` are simply summed separately rather than combined. Zero index changes required (same `daily_reports(student_id, submitted_at)` predicate).

---

### F2 + F3 — Owner Analytics: Coach Leaderboards + Window Selector (single RPC, 24 slots)

**What changes:** `get_owner_analytics` — currently returns 3 lifetime student leaderboards (hours/profit/deals) — expands to return **6 leaderboards × 4 time windows = 24 pre-computed slots**, plus a second tier of 3 coach leaderboards (revenue, avg brand outreach/student/day, deals).

**Files touched:**

| File | Change | Type |
|------|--------|------|
| `supabase/migrations/00033_...` OR `00034_expand_owner_analytics.sql` | DROP + CREATE `get_owner_analytics()` with 24-slot envelope | MODIFIED |
| `src/lib/rpc/owner-analytics-types.ts` | Payload shape expands from `OwnerLeaderboards {3 keys}` to `{6 categories × 4 windows}` | MODIFIED |
| `src/lib/rpc/owner-analytics.ts` | Bump cache key from `["owner-analytics"]` to `["owner-analytics", "v2"]` to avoid the same SSR crash as F1 | MODIFIED |
| `src/app/(dashboard)/owner/analytics/page.tsx` | Server component stays server; renders new `OwnerAnalyticsClient` wrapper | MODIFIED |
| `src/components/owner/analytics/OwnerAnalyticsClient.tsx` | NEW — `"use client"`, holds 6 independent window-selector state slots, picks slice from payload | NEW |
| `src/components/owner/analytics/WindowSelector.tsx` | NEW — `<fieldset><legend>` / `role="radiogroup"`, 44px touch targets | NEW |
| `src/components/owner/analytics/OwnerAnalyticsTeaser.tsx` | Change `payload.leaderboards.hours_alltime[0]` path to new shape (`payload.leaderboards.students.hours.alltime[0]`) | MODIFIED |
| `src/components/analytics/LeaderboardCard.tsx` | Extend `hrefPrefix` default to handle coach leaderboards (`"/owner/coaches/"` — though this links to non-existent coach detail page per scope); or pass `href: null` for coach rows to disable links | MODIFIED |

**Cache-compatibility at 6× payload size:** CONFIRMED COMPATIBLE.

- Current `get_owner_analytics` returns ~0.5 KB of jsonb (3 top-3 rows × ~100 bytes). 6× = ~3 KB. `unstable_cache` is a Next.js disk-or-memory cache with no hard payload size limit; supabase-js `rpc()` has no envelope cap. Zero concern at this size.
- 60s TTL stays the same — stale payload for 60 seconds across 24 slots is identical cost to 3 slots.
- The single global key `["owner-analytics"]` remains — one cache entry, shared by `/owner/analytics` + `OwnerAnalyticsTeaser` on `/owner`. Still exactly one Postgres RPC call per minute regardless of surface or window selection (because all 24 slots are pre-computed).

**RLS / index implications at 4 window filters:** LOW RISK, minor index concerns.

- Students: existing indexes (`idx_deals_student_created`, `idx_work_sessions_completed_student_date`, `daily_reports(student_id, submitted_at, date)` from 00021) cover date-range filtering. All 4 windows (`CURRENT_DATE - 7`, `-30`, `-365`, `alltime`) use the same indexed columns — Postgres will use bitmap index scans with date predicates.
- Coaches: `users.coach_id` is indexed (00021 analytics_foundation). The coach aggregation joins `deals → users.coach_id`. This shape was not stressed in Phase 54 load tests. New RPC must verify the coach-hours/outreach aggregation stays under the 1s P95 bar at 5k students (reuse k6 scenario from Phase 24).
- Coaches → brand outreach/day: requires `daily_reports(student_id, date, brands_contacted)` — `daily_reports_student_date` index already exists; `brands_contacted` is just a selected column, not a predicate.
- **SECURITY DEFINER guard unchanged** — the RPC still rejects `auth.uid() IS NOT NULL`. Only admin-client callers pass. No new RLS policies required.

**F3 client-side state — local component state is fine. CONFIRMED.**

- Brief states: "URL sharing wasn't requested". State should live in `OwnerAnalyticsClient.tsx` as 6 independent `useState<WindowKey>("alltime")` hooks (or a single `Record<LeaderboardKey, WindowKey>`).
- No `searchParams`, no `router.replace`, no persistence. Defaults to "All Time" per OA-spec §3.
- This is simpler than the student-analytics pattern (which DOES use `searchParams` for range + page because those are paginated server-side). Owner leaderboards have no pagination and no re-fetch — pure client-side payload slicing.

**Tie-break discipline:** per Phase 54 D-01 (`metric DESC, LOWER(name) ASC, id::text ASC`). Apply identically to all 6 × 4 = 24 ranked lists. Deterministic output is critical so cache repeats render identically.

**Active coaches only:** filter `WHERE u.role = 'coach' AND u.status = 'active' AND EXISTS (SELECT 1 FROM users s WHERE s.coach_id = u.id AND s.role IN ('student','student_diy'))` — the "exclude coaches with zero assigned students" rule from the v1.8 spec.

---

### F4 — Owner Alerts: Prune to `deal_closed` Only

**What changes:** `/owner/alerts` currently computes 4 alert types inline from 6 parallel DB queries. v1.8 replaces the entire alert computation with a single `deals` query → one alert per deal.

**Files touched:**

| File | Change | Type |
|------|--------|------|
| `src/app/(dashboard)/owner/alerts/page.tsx` | Rewrite — remove 180 lines of inactive/dropoff/unreviewed/coach-underperform logic; replace with a single deals query | MODIFIED |
| `src/components/owner/OwnerAlertsClient.tsx` | `AlertItem.type` union shrinks to `"deal_closed"`; `TYPE_CONFIG` updated; `getDetailHref` always returns `/owner/students/{id}` | MODIFIED |
| `src/app/api/deals/route.ts` | Add `revalidateTag("badges", "default")` is ALREADY called. `/owner/alerts` page is SSR-dynamic (no `unstable_cache`, no `export const revalidate`) — it re-computes on every request. No cache invalidation change needed for the alerts surface itself | NO CHANGE needed for cache |
| `supabase/migrations/00033_...` or bundled migration | Update `get_sidebar_badges` OWNER branch (migration 00029 lines 115-183) — replace the multi-signal alert_count with `COUNT(*) FROM deals d JOIN users u ON u.id = d.student_id WHERE u.role IN ('student','student_diy') MINUS dismissals` | MODIFIED |

**(a) query `deals` directly vs (b) materialize a view — user brief implies (a). CONFIRMED (a).**

Evidence:
1. `deals` is a small table (single-digit-thousands of rows max at 5k students over lifetime). Full-table count + join on `students` is <10ms with the existing `idx_deals_student_created` index.
2. Owner alerts page is SSR-dynamic (confirmed: `src/app/(dashboard)/owner/alerts/page.tsx` has NO `export const revalidate`, NO `unstable_cache` wrapper — it re-runs on every request).
3. Materializing a view adds migration complexity, requires cron refresh, and duplicates storage for no measured performance gain. Option (a) is correct.
4. Reuse `alert_dismissals` verbatim: dismissal key shape `deal_closed:${deal_id}` (per spec §4). On POST to `/api/alerts/dismiss`, the existing route accepts any `alert_key` string up to 200 chars — zero API change required.

**Sidebar badge count update — CRITICAL:** `get_sidebar_badges` OWNER branch in migration 00029 (lines 115-183) currently counts inactive + dropoff + unreviewed + coach-underperform. This must be rewritten in the same v1.8 migration to count `deals - dismissed_deal_keys`. Without this update, the sidebar `active_alerts` badge will diverge from the `/owner/alerts` page.

**Deal POST cache invalidation:** `/api/deals/route.ts` already calls `revalidateTag("badges", "default")` on insert (verified lines 184 + 219 in route.ts). The `get_sidebar_badges` cache is wrapped in `unstable_cache(..., ["sidebar-badges"], { tags: ["badges"] })` in `src/app/(dashboard)/layout.tsx`. So the new `deal_closed` badge count will update correctly on every deal insert. **No new invalidation call needed.**

**Data-flow simplification:**

```
BEFORE (v1.7):
  /owner/alerts → [6 DB queries: students, coaches, dismissals, work_sessions, daily_reports, daily_reports count, coach ratings]
  → in-memory classification (inactive/dropoff/unreviewed/coach-underperform)
  → 180 lines of alert-building logic

AFTER (v1.8):
  /owner/alerts → [2 DB queries: deals JOIN users + dismissals]
  → 1:1 map deal → alert
  → ~30 lines of alert-building
```

---

### F5 — Coach Alerts: `tech_setup` Activation (CRITICAL BACKFILL REQUIRED)

**What changes:** Flip `MILESTONE_CONFIG.techSetupStep` from `null` → `4`, flip `MILESTONE_FEATURE_FLAGS.techSetupEnabled` from `false` → `true`, update `MILESTONE_META["tech_setup"].label` from wherever it currently is → `"Set Up Your Agency"`.

**Files touched:**

| File | Change | Type |
|------|--------|------|
| `src/lib/config.ts` lines 390, 412 | `techSetupStep: 4`, `techSetupEnabled: true` | MODIFIED |
| `src/components/coach/alerts-types.ts` line 119 | `MILESTONE_META["tech_setup"].label = "Set Up Your Agency"` | MODIFIED |
| `supabase/migrations/00033_activate_tech_setup.sql` | **REQUIRED** — rewrite `tech_setup` CTE in `get_coach_milestones` from `rp.step_number = 0` (PLACEHOLDER) to `rp.step_number = 4`, AND backfill `alert_dismissals` for every historical Step-4 completion | NEW |

**Initialization-order concerns — YES, BACKFILL IS REQUIRED. Do not skip.**

Evidence found in migrations 00027 + 00030:

```sql
-- supabase/migrations/00030_roadmap_step_8_insertion.sql lines 160-175
tech_setup AS (
    SELECT ('milestone_tech_setup:' || rp.student_id::text), ...
    FROM roadmap_progress rp
    WHERE p_tech_setup_enabled = true
      AND rp.student_id = ANY(v_student_ids)
      AND rp.step_number = 0   -- PLACEHOLDER — replace when D-06 resolves
      AND rp.status = 'completed'
```

Without a migration to change `step_number = 0` → `step_number = 4`, flipping `techSetupEnabled = true` in TypeScript has ZERO effect (no Step-0 completions exist, the `roadmap_progress` CHECK constraint enforces 1-16).

**Retroactive firing — YES, every non-dismissed Step-4 completer will fire an alert the moment the feature activates.** Per Phase 52 precedent (`00027_get_coach_milestones_and_backfill.sql` lines 403-450), the migration MUST pre-insert dismissal rows for all historical Step-4 completions to avoid spamming coaches with 40+ retroactive alerts.

**Required backfill pattern** (mirror migration 00027 lines 409-420 for `5_influencers`):

```sql
INSERT INTO alert_dismissals (owner_id, alert_key, dismissed_at)
SELECT DISTINCT u.coach_id,
       'milestone_tech_setup:' || rp.student_id::text,
       now()
FROM roadmap_progress rp
JOIN users u ON u.id = rp.student_id
WHERE rp.step_number = 4
  AND rp.status = 'completed'
  AND u.coach_id IS NOT NULL
  AND u.status = 'active'
  AND u.role IN ('student', 'student_diy')
ON CONFLICT (owner_id, alert_key) DO NOTHING;
```

**Why the internal key `tech_setup` MUST NOT rename** (v1.8 spec §5 already locks this, but architectural rationale):

1. `MILESTONES.techSetup()` composer in `src/lib/config.ts` (line 429) emits `milestone_tech_setup:${studentId}` — LIKE pattern `milestone_tech_setup:%` in `MILESTONE_KEY_PATTERNS.techSetup` (line 445).
2. `get_coach_milestones` RPC literal string `'tech_setup'::text` (migration 00030 line 165).
3. `alerts-types.ts` `MILESTONE_META["tech_setup"]` keyed by the same string.
4. Any in-flight dismissal rows (none expected since flag is currently false — but orphaned rows preserved per v1.8 §out-of-scope).

Renaming would require a DELETE + re-backfill of `alert_dismissals` plus simultaneous RPC + TypeScript + config changes. Label-only change is 3 trivial edits.

**Idempotency contract preserved:** tech_setup is ONE-SHOT per student (key `milestone_tech_setup:${student_id}` — no deal_id suffix per `MILESTONES.techSetup` composer). Second Step-4 completion for the same student = no new notification.

---

### F6 — student_diy Owner Detail Page Parity

**What changes:** `/owner/students/[studentId]/page.tsx` currently queries `.eq("role", "student")` (line 35), rejecting any DIY student with `notFound()`. Extend to `.in("role", ["student","student_diy"])`. Propagate through `/owner/students` list page, calendar API, and any related queries.

**Files touched:**

| File | Change | Type |
|------|--------|------|
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | Line 35: `.eq("role", "student")` → `.in("role", ["student","student_diy"])`; gate Calendar report-indicator rendering on `student.role === "student"`; gate at-risk recent-ratings computation on role | MODIFIED |
| `src/app/(dashboard)/owner/students/page.tsx` | Line 30: same `.eq` → `.in`; add "DIY" badge next to status chip | MODIFIED |
| `src/app/api/calendar/route.ts` | Line 54: same `.eq` → `.in`; DIY calendar response should return empty `reports` array (DIY has no reports) | MODIFIED |
| `src/components/coach/CalendarTab.tsx` | Accept optional `showReportIndicators: boolean` prop (default true); when false, skip green dots + "No report" tooltips | MODIFIED |
| `src/components/owner/OwnerStudentDetailClient.tsx` | Pass `role` prop downstream to CalendarTab, hide `StudentKpiSummary` rows that reference `daily_reports` data (brands/influencers contacted, rating) for DIY | MODIFIED |

**`get_student_detail` RPC — CONFIRMED: no matching change required.**

Inspected migration 00010 lines 195-250. `get_student_detail(p_student_id, p_month_start, p_month_end, p_include_coach_mgmt)` does NOT validate `users.role`. It simply queries by `student_id` on `work_sessions`, `roadmap_progress`, `daily_reports`, etc. For a DIY student, the `daily_reports` query returns an empty array (DIY submits no reports). No RPC change needed.

**Also verified no role filter in:**
- `get_weekly_skip_counts` RPC (used on owner students list) — takes `p_student_ids` array, no role filter
- `get_student_analytics` RPC — role-agnostic (DIY analytics page uses it identically)
- `deals` queries in `/api/deals` — already accepts both roles (line 149: `["student", "student_diy"].includes(student.role)`)

**"Reports tab" nuance — there is NO separate Reports tab.** The `StudentDetailTabs` component (`src/components/coach/StudentDetailTabs.tsx` lines 13-17) only defines 3 tabs: `calendar | roadmap | deals`. The v1.8 spec wording "hides Reports tab" is imprecise — the actual requirement is:
1. Within `CalendarTab`, suppress the per-day report dot + submission indicator + "No report submitted" text for DIY students.
2. Within the sidebar `StudentKpiSummary`, hide outreach rate/rating rows for DIY students (they have no daily reports to aggregate).

**Coach route (`/coach/students/[studentId]`) NOT touched** — per v1.8 Ambiguity §3, scope-locked to owner-only for v1.8. Coach has no DIY students assigned (v1.4 D-04: DIY = no coach). `/coach/*` routes continue to `.eq("role", "student")`.

---

## Build Order (Dependencies + Risk)

| Order | Feature | Rationale | Blocks | Blocked By |
|-------|---------|-----------|--------|------------|
| **1** | **F1** — Student Analytics RPC replace | Breaking RPC must land first. Single migration + type + UI change + cache-key bump. Smallest blast radius; sets the "breaking RPC swap" discipline the next phases follow. | — | — |
| **2** | **F5** — tech_setup activation | Isolated to coach milestones subsystem; uses established Phase 52 backfill pattern; doesn't touch owner analytics. Can parallelize with F1 if desired but independent order. | — | — |
| **3** | **F2 + F3** — Owner Analytics expansion (MUST bundle) | F2 (coach leaderboards) and F3 (window selectors) both modify the same `get_owner_analytics` RPC + same payload shape. Splitting them requires 2 breaking RPC swaps. Build together. | OwnerAnalyticsTeaser update (same payload shape change) | — |
| **4** | **F4** — Owner Alerts prune | Touches sidebar `get_sidebar_badges` OWNER branch AND `/owner/alerts` page. Independent of F1/F2/F3/F5 but touches a shared migration (can bundle into the same 00033 migration as F2+F3 if desired to reduce migration count, OR stay separate for clarity). | — | — |
| **5** | **F6** — DIY Owner Detail Page | Pure route-layer change; no RPC, no migration. Smallest feature. Build last so it can be UAT-tested against the stabilized F1/F2/F3/F4 data. | — | — |

**Parallelization opportunity:** F1, F5, F6 are fully independent. F2+F3 MUST build together. F4 is independent of all others. A 4-phase split would be:

- **Phase A:** F1 (Student Analytics outreach split + RPC swap)
- **Phase B:** F2 + F3 (Owner Analytics coach leaderboards + window selector — combined, single migration)
- **Phase C:** F4 (Owner Alerts prune + sidebar badge rewrite)
- **Phase D:** F5 + F6 (tech_setup activation + DIY owner detail page — combined, low-risk cleanup phase)

OR collapse to 3 phases by merging A+D (both are small, touch mostly-orthogonal files):

- **Phase 1 (merged):** F1 + F5 + F6
- **Phase 2:** F2 + F3
- **Phase 3:** F4

**Critical sequencing rule** (applies to every phase): run `npm run lint && npx tsc --noEmit && npm run build` before commit — the breaking RPC type changes (F1, F2+F3) will catch stale consumers via TS strict mode.

---

## Data Flow Changes Summary

### Before v1.8

```
/student/analytics → get_student_analytics → totals { total_emails (WRONG), total_influencers, ... }
/owner/analytics   → get_owner_analytics   → leaderboards { hours_alltime[3], profit_alltime[3], deals_alltime[3] }
/owner/alerts      → 6 parallel admin queries → 4 alert-type classification → OwnerAlertsClient
/coach/alerts      → get_coach_milestones(p_tech_setup_enabled=false) → tech_setup CTE returns 0 rows
```

### After v1.8

```
/student/analytics → get_student_analytics v2 → totals { total_brand_outreach, total_influencer_outreach, ... }
/owner/analytics   → get_owner_analytics v2   → leaderboards { students: {hours: {7d, 30d, 365d, alltime}, profit: {...}, deals: {...}},
                                                                coaches:  {revenue: {...}, brand_outreach_per_day: {...}, deals: {...}} }
/owner/alerts      → 1 deals query + 1 dismissals query → 1:1 deal→alert map → OwnerAlertsClient
/coach/alerts      → get_coach_milestones(p_tech_setup_enabled=true) → tech_setup CTE joins on step_number=4
```

---

## Scalability Considerations

| Concern | At 100 users | At 5k students (load-tested envelope) | Mitigation |
|---------|--------------|---------------------------------------|------------|
| F2+F3 `get_owner_analytics` 24-slot RPC | <50ms | Untested but O(n) with 5k × 4 windows × 2 entity types — estimate <500ms cold; 60s cache absorbs | Add k6 read-mix scenario for new RPC before merge; verify P95 < 1s at 100 VUs per Phase 24 pattern |
| F4 owner alerts `deals` count | <10ms | ~5k deals × 1-row-per-deal → ~5k alerts in memory; 500 KB payload | Add hard limit (`LIMIT 200`) + pagination if deal count > 200; defer to follow-up if needed |
| F5 retroactive tech_setup fan-out | 0 rows | ~5k Step-4 completers × 1 coach each = 5k dismissal rows in 1 INSERT | Backfill migration uses `ON CONFLICT DO NOTHING`; single transaction acceptable at this scale |
| Sidebar `get_sidebar_badges` owner branch (F4 rewrite) | <50ms | Simpler after F4 (deals COUNT vs 4-signal loop) — net perf WIN | No action needed |

---

## Sources

- `.planning/PROJECT.md` — v1.8 scope, constraints, ambiguities (lines 224-261)
- `src/lib/config.ts` — MILESTONE_CONFIG (lines 385-413), MILESTONES composers (lines 427-451), role lists (lines 26-47)
- `src/lib/rpc/owner-analytics-types.ts` — cache tag + payload shape
- `src/lib/rpc/owner-analytics.ts` — unstable_cache wrapper
- `src/lib/rpc/student-analytics-types.ts` — StudentAnalyticsTotals (lines 20-27)
- `src/lib/rpc/coach-milestones.ts` — techSetupEnabled wiring (line 52)
- `src/app/(dashboard)/owner/alerts/page.tsx` — current alert computation (240 lines, fully read)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — `.eq("role", "student")` at line 35
- `src/app/api/calendar/route.ts` — `.eq("role", "student")` at line 54
- `src/app/api/deals/route.ts` — cache invalidation pattern (lines 184-210, 219-245)
- `src/app/api/alerts/dismiss/route.ts` — alert_key text ≤ 200 chars (line 12), already role-agnostic
- `src/app/(dashboard)/layout.tsx` — sidebar badges cache (lines 9-27, 36-46)
- `supabase/migrations/00004_alert_dismissals.sql` — table schema (5k-line unique `(owner_id, alert_key)`)
- `supabase/migrations/00023_get_student_analytics.sql` — current RPC (`total_emails` bug at line 100)
- `supabase/migrations/00028_get_owner_analytics.sql` — Phase 54 lifetime RPC, fully read
- `supabase/migrations/00027_get_coach_milestones_and_backfill.sql` — backfill pattern to mirror for F5 (lines 403-450)
- `supabase/migrations/00029_chat_removal_announcements.sql` — current `get_sidebar_badges` OWNER branch (lines 115-183)
- `supabase/migrations/00030_roadmap_step_8_insertion.sql` — tech_setup PLACEHOLDER at step_number=0 (line 172) — **THIS IS WHY F5 REQUIRES A MIGRATION**
- `supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql` — already exists; next migration is **00033**
