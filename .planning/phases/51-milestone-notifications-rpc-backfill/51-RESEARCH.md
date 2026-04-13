# Phase 51: Milestone Notifications RPC + Backfill — Research

**Researched:** 2026-04-13
**Domain:** Postgres RPC (SECURITY DEFINER STABLE) + alert_dismissals backfill + sidebar-badge extension + Next.js `unstable_cache` + `revalidateTag` fan-out across 3 mutation routes
**Confidence:** HIGH — all claims verified against in-repo code/migrations; no external libraries introduced

## Summary

Phase 51 extends an already-shipping pattern (Phase quick/260401-cwd's 100h coach milestone alert) with 4 new milestone triggers. Everything the phase needs already exists in-tree: the `alert_dismissals` table + coach RLS policies (00004 + 00014), the `get_sidebar_badges` RPC (current shape lives in 00017 not 00014), the `(SELECT auth.uid())` initplan + `SECURITY DEFINER STABLE` RPC convention (Phase 44/47/48), `unstable_cache` + `revalidateTag` tag-per-coach cache layer (Phase 47/48 wrappers), and the Phase 50 config surface (`MILESTONE_CONFIG`, `MILESTONES`, `MILESTONE_FEATURE_FLAGS`, `MILESTONE_KEY_PATTERNS`).

The core work is: (1) write migration **00027** containing `get_coach_milestones(p_coach_id, p_today)` + a backfill block + one extension of `get_sidebar_badges`'s coach branch to sum the new milestone count; (2) add a `src/lib/rpc/coach-milestones.ts` wrapper following the Phase 48 `coach-analytics.ts` template (`fetchX` + `getXCached` with `unstable_cache(60s)` + tag `coach-milestones:${coachId}`); (3) inject `revalidateTag(coachMilestonesTag(coachId))` into three mutation routes — `POST /api/deals`, `POST /api/reports`, `PATCH /api/roadmap` — alongside the existing `coachDashboardTag` / `coachAnalyticsTag` calls; (4) update `SidebarBadgesResult` type + `src/lib/types.ts` generated RPC signature so the sidebar cast stays honest.

**Primary recommendation:** Single migration **00027_get_coach_milestones_and_backfill.sql** containing RPC + backfill + `get_sidebar_badges` rewrite in one transaction so either everything lands or nothing does (atomicity beats clarity here because the backfill MUST complete before the extended sidebar badge goes live — otherwise every coach gets flooded on the first sidebar render). Next available migration number is **00027** (00025 and 00026 are already used for Phase 48's `get_coach_analytics`).

<user_constraints>
## User Constraints (from 51-CONTEXT.md)

### Locked Decisions

**From ROADMAP / Phase 50:**

- **D-06** — Tech/Email Setup trigger pending, gated by `MILESTONE_FEATURE_FLAGS.techSetupEnabled` (currently `false`). Code path is wired but does not fire until D-06 resolves at Monday stakeholder meeting. Phase 51 NOTIF-01 is deferred.
- **D-07** — Closed-deal alert key includes `deal_id` (per-deal granularity); every deal fires a fresh notification.
- **D-08** — Reuse the existing `alert_dismissals` table pattern (260401-cwd / 100h_milestone); do NOT introduce a new notifications table.
- **D-16** — Coach-logged AND owner-logged deals must trigger the closed-deal milestone (not just student-logged).
- **New RPC name:** `get_coach_milestones(p_coach_id, p_today)`.
- **Cache:** `unstable_cache` with 60s TTL, tag = `coach-milestones-${coachId}` (note CONTEXT.md spells this with a hyphen between `milestones` and `${coachId}`; Phase 47/48 precedent uses a colon, e.g., `coach-dashboard:${coachId}`. **Recommend colon to match precedent** — flag during planning).
- Existing `get_sidebar_badges` coach branch must include the new milestone count alongside the 100h legacy count.
- **Migration 00025 = combined (RPC + backfill + indexes if needed).** ⚠ CONTEXT.md says 00025, but 00025 is already consumed by `get_coach_analytics` (Phase 48). The real next-available number is **00027**. Planner must reconcile this.

### Claude's Discretion

- Implementation details (helper function structure, query shape, predicate composition).
- Whether to write a single migration (00027) or split (e.g., 00027 RPC, 00028 backfill) — decide based on atomicity vs. clarity. **Recommend single migration** for atomicity (see Pitfall 3 below).
- Specific `revalidateTag` call sites in API routes (`POST /api/deals`, `POST /api/reports`, roadmap-step completion route) — locate via codebase scan.

### Deferred Ideas (OUT OF SCOPE)

- **NOTIF-01** (Tech/Email Setup activation) — code path wired but feature flag stays false until D-06 resolves at Monday stakeholder meeting. Phase 51 ships with the `tech_setup` branch fully coded but short-circuited by `MILESTONE_FEATURE_FLAGS.techSetupEnabled === false`.
- `/coach/alerts` page UI (NOTIF-09) — that is Phase 52, not this one. Phase 51 only produces the RPC + backfill + sidebar badge extension. Existing `/coach/alerts` page in `src/app/(dashboard)/coach/alerts/page.tsx` (lines 1–60 read) currently handles only the 100h alert; extending it is Phase 52's job.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-02 | Coach alert when assigned student reaches Roadmap Step 11 (5 Influencers) | `MILESTONE_CONFIG.influencersClosedStep === 11` (config.ts:391); detect via `roadmap_progress WHERE step_number=11 AND status='completed'`; key `milestone_5_influencers:{student_id}` (one-shot). |
| NOTIF-03 | Coach alert when assigned student reaches Roadmap Step 13 (Brand Response) | `MILESTONE_CONFIG.brandResponseStep === 13` (config.ts:395); same detection shape as NOTIF-02; key `milestone_brand_response:{student_id}`. |
| NOTIF-04 | Coach alert on every closed deal by assigned student (student/coach/owner logged per D-16) | Every row in `deals` (table referenced in 00022) is "closed" in this schema — there is no status column; an inserted row = a closed deal. Key `milestone_closed_deal:{student_id}:{deal_id}` (per-deal, D-07). Count includes all `deals` rows regardless of `logged_by` value. |
| NOTIF-05 | Each milestone fires exactly once per qualifying event, idempotent via `alert_key` namespaces | `alert_dismissals` has `UNIQUE(owner_id, alert_key)` (00004:11). Phase 51 RPC returns `qualifying_key - dismissed_key` using `NOT EXISTS` semijoin on `alert_dismissals`. Pre-dismissal backfill (NOTIF-10) seeds `alert_dismissals` for every already-qualifying event before the sidebar-badge extension goes live. |
| NOTIF-06 | Notification includes student name + achievement description; clicking navigates to student detail page | UI concern. RPC MUST return `student_id`, `student_name`, `milestone_type`, and (for `closed_deal`) `deal_id` so Phase 52 can compose `/coach/students/${student_id}` links. |
| NOTIF-07 | Coach sidebar badge count extended to include new milestones alongside existing 100+ hrs alert, via single source `get_sidebar_badges` | Modify coach branch of `get_sidebar_badges` (current shape in 00017_chat_badges.sql:53–103) to add `new_milestone_count - new_milestone_dismissed` to whatever it returns for `coach_milestone_alerts`, OR add a separate `coach_new_milestone_alerts` key. **Recommend folding into existing `coach_milestone_alerts` key** (the UI already reads it via `badgeCounts.coach_milestone_alerts` in layout.tsx:44 and config.ts:302). |
| NOTIF-08 | Existing 100+ hrs/45 days alert continues to work unchanged (D-08) | The 100h loop in 00017_chat_badges.sql:66–89 stays verbatim. Phase 51 adds a second loop/query in the same coach branch; does not touch 100h code. Backfill key pattern `100h_milestone:%` stays untouched — Phase 51 backfill uses `milestone_%` namespace (from `MILESTONE_KEY_PATTERNS.allV15Milestones` = `'milestone_%'`, config.ts:443). |
| NOTIF-10 | Migration pre-dismisses historical qualifying events so rollout does not flood coaches | Backfill block inside 00027. For each coach, INSERT INTO `alert_dismissals(owner_id=coach_id, alert_key=…)` ONE row per existing qualifying event (Step 11 completed, Step 13 completed, every deal). ON CONFLICT DO NOTHING on the UNIQUE(owner_id, alert_key). Only skip if `MILESTONE_FEATURE_FLAGS.techSetupEnabled` is true (not applicable here — tech setup is gated off, so no tech-setup backfill rows are written). |
| NOTIF-11 | Milestone compute RPC performant at 5k students — single batch per coach, `unstable_cache` 60s, invalidated on deal/report/roadmap mutations | Phase 44 indexes (00021:93–103) already cover all hot paths: `idx_deals_student_created`, `idx_work_sessions_completed_student_date`, `idx_roadmap_progress_student_status`. Cache wrapper mirrors `src/lib/rpc/coach-analytics.ts:96–105`. Invalidation call sites: `POST /api/deals` (route.ts:182, 210), `POST /api/reports` (route.ts:109–128, 155–173), `PATCH /api/roadmap` (route.ts:112–116 — currently only invalidates student-analytics tag; Phase 51 adds coach-milestones). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These hard rules apply to every file touched in Phase 51. Planner MUST verify each in per-plan `must_haves`.

| Rule | Application to Phase 51 |
|------|-------------------------|
| **Admin client in API routes** | Every `.from()` in the three mutation routes already uses `admin` (createAdminClient). No new API routes added — just `revalidateTag` calls appended to existing routes. |
| **Never swallow errors** | The new `revalidateTag(coachMilestonesTag(...))` calls must be wrapped in the same `try { … } catch (e) { console.error(…) }` pattern already present for `studentAnalyticsTag`/`coachDashboardTag` at deals/route.ts:182–187. |
| **Zod import** | `import { z } from "zod"` — not applicable to the migration, but the sidebar type in `src/lib/types.ts` must be updated without introducing any Zod dependency (it's a raw TS type). |
| **Config is truth** | RPC body must reference `MILESTONE_CONFIG.influencersClosedStep` / `.brandResponseStep` values VIA SYNC COMMENT (SQL cannot import TS). The migration header must include a SYNC comment naming `src/lib/config.ts` MILESTONE_CONFIG section, mirroring 00021:21 (`SYNC: student_activity_status inactive threshold (7 days) mirrors ACTIVITY.inactiveAfterDays`). Changing `MILESTONE_CONFIG` numeric values requires a new migration — pinned in the SYNC comment. |
| **motion-safe, 44px, aria** | Not applicable to this phase — no UI work. Phase 52 will enforce when building `/coach/alerts`. |

## Standard Stack

### Core (already installed and load-bearing)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 (package.json:20) [VERIFIED] | App Router + `unstable_cache` + `revalidateTag` | Already the app framework. `unstable_cache` tagged caches + `revalidateTag` on mutations is the project-wide pattern (layout.tsx:9–27; coach-analytics.ts:96–105). |
| `@supabase/supabase-js` | ^2.99.2 (package.json:13) [VERIFIED] | RPC calls via admin client | Existing RPC call pattern: `(admin as any).rpc("get_coach_analytics", { p_coach_id, … })` at coach-analytics.ts:59. |
| Postgres (Supabase) | — | RPC host (SECURITY DEFINER STABLE plpgsql) | All analytics/dashboard RPCs are plpgsql SECURITY DEFINER STABLE SET search_path = public. Embedded `DO $$ … ASSERT … $$` correctness checks run at migration time (00021:117–142, 00025:550–599). |
| `zod` | ^4.3.6 (package.json:28) [VERIFIED] | API input validation | Only used by the three existing API routes this phase touches; Phase 51 adds NO new Zod schemas — just `revalidateTag` calls. |

### Supporting (already in use)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | ^0.0.1 (package.json:26) [VERIFIED] | Crash-at-build guard for server-side modules | New `src/lib/rpc/coach-milestones.ts` must start with `import "server-only";` (mirrors coach-analytics.ts:14). |
| date-fns | ^4.1.0 (package.json:16) [VERIFIED] | Date utilities | Not needed in Phase 51 — RPC receives `p_today date` from the caller (getTodayUTC pattern, analytics page.tsx:45). |

### Alternatives Considered

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Separate `notifications` table | dedicated notifications table | **D-08 locked**: reuse alert_dismissals. No new table. |
| Supabase Realtime | push notifications to live clients | **REQUIREMENTS.md:121**: explicitly out of scope (500 connection limit, v1.4 D-07). |
| PL/pgSQL trigger on `deals`/`roadmap_progress` INSERT/UPDATE | auto-insert notification rows on mutation | Rejected by D-08 (no new table) + computed-alert architecture. Triggers would need an events table. Sticking with "compute at read time + dismissal-key pattern" matches 100h precedent. |
| New npm test dep (vitest/jest) | runtime test framework | None installed (confirmed by `Glob **/vitest.config.*` = no files; `package.json` has no `test` script). Project convention = embedded `DO $$ ASSERT $$` blocks in the migration itself (00021:117–142; 00025:550–599). Keep that convention. |

**Installation:** **No new runtime or dev dependencies.** Phase 51 adds zero lines to `package.json`.

**Version verification skipped:** Nothing to verify — no new packages.

## Architecture Patterns

### Recommended File Structure for Phase 51

```
supabase/migrations/
  00027_get_coach_milestones_and_backfill.sql   # NEW (single file, atomic)

src/lib/rpc/
  coach-milestones-types.ts                     # NEW — pure types + tag helper (client-safe)
  coach-milestones.ts                           # NEW — server-only fetcher + unstable_cache wrapper

src/lib/
  types.ts                                      # MODIFIED — extend SidebarBadgesResult shape + generated RPC signature

src/app/api/deals/route.ts                      # MODIFIED — add coachMilestonesTag revalidate (both success + retry paths)
src/app/api/reports/route.ts                    # MODIFIED — add coachMilestonesTag revalidate (both insert + update paths)
src/app/api/roadmap/route.ts                    # MODIFIED — add coachMilestonesTag revalidate (after step unlock)

src/app/(dashboard)/layout.tsx                  # MODIFIED — (minor) read new badge key if folding as separate field
```

No changes to `/coach/alerts` page in Phase 51 (that is Phase 52).

### Pattern 1: RPC Skeleton (copied from Phase 48 `get_coach_analytics`)

**What:** SECURITY DEFINER STABLE plpgsql RPC with auth guard + student-id resolution + zero-student short-circuit + jsonb envelope output.
**When to use:** Every v1.5 batch RPC (46, 47, 48, 51).
**Example (from 00025:58–99, adapted for Phase 51):**

```sql
-- Source: supabase/migrations/00025_get_coach_analytics.sql:58–99 (pattern mirrored)
CREATE OR REPLACE FUNCTION public.get_coach_milestones(
  p_coach_id uuid,
  p_today    date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller      uuid := (SELECT auth.uid());
  v_student_ids uuid[];
  v_milestones  jsonb;
BEGIN
  -- 1. Authorization guard (mirrors 00025:97–99 verbatim)
  IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_coach_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- 2. Resolve assigned active students (mirrors 00025:115–120)
  SELECT array_agg(id) INTO v_student_ids
  FROM users
  WHERE role = 'student' AND status = 'active' AND coach_id = p_coach_id;

  -- 3. Zero-student short-circuit (mirrors 00025:125–162)
  IF v_student_ids IS NULL OR array_length(v_student_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('milestones', '[]'::jsonb, 'count', 0);
  END IF;

  -- 4. Compute qualifying events NOT yet dismissed (see Pattern 2)
  -- ...

  RETURN jsonb_build_object('milestones', v_milestones, 'count', jsonb_array_length(v_milestones));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_milestones(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_coach_milestones(uuid, date) TO authenticated;
```

### Pattern 2: Qualifying-Event Semi-Join (NEW — specific to Phase 51)

**What:** For each of 4 milestone types, build a CTE of `(alert_key, student_id, student_name, milestone_type, dealloc_payload)` from the source table, then `LEFT JOIN` alert_dismissals to exclude already-dismissed keys.

**Why this shape:** Computed-alert architecture — no notifications table, dismissals are the source of truth for "already notified." Exactly matches the 100h pattern at 00017:84–89 (`alert_key LIKE '100h_milestone:%'`), but generalized to 4 key shapes.

**Example (logical, to be concretized by planner):**

```sql
-- 5_influencers (Step 11 completed)
WITH five_inf AS (
  SELECT
    ('milestone_5_influencers:' || rp.student_id::text) AS alert_key,
    rp.student_id,
    u.name AS student_name,
    '5_influencers'::text AS milestone_type,
    NULL::uuid AS deal_id,
    rp.completed_at AS occurred_at
  FROM roadmap_progress rp
  JOIN users u ON u.id = rp.student_id
  WHERE rp.student_id = ANY(v_student_ids)
    AND rp.step_number = 11  -- SYNC: MILESTONE_CONFIG.influencersClosedStep
    AND rp.status = 'completed'
),
-- brand_response (Step 13 completed) — same shape with step_number=13
-- closed_deal (per-deal) — one row per row in deals table (all logged_by values)
-- tech_setup — ONLY evaluated when MILESTONE_FEATURE_FLAGS.techSetupEnabled is true
--   (In SQL: gate via config comparison, or omit entirely when flag=false.)
all_events AS (
  SELECT * FROM five_inf
  UNION ALL SELECT * FROM brand_response
  UNION ALL SELECT * FROM closed_deals
)
SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC)
INTO v_milestones
FROM all_events e
LEFT JOIN alert_dismissals ad
  ON ad.owner_id = p_coach_id AND ad.alert_key = e.alert_key
WHERE ad.alert_key IS NULL;  -- NOT yet dismissed
```

**Feature-flag handling (NOTIF-01 deferred):** Two options:

1. **Bake the flag into the SQL:** the RPC omits the tech-setup CTE entirely, and Phase 52 flipping the flag will require another migration. Clean but rigid.
2. **Plumb flag as RPC arg:** `get_coach_milestones(p_coach_id, p_today, p_tech_setup_enabled boolean DEFAULT false)` — server-side wrapper reads `MILESTONE_FEATURE_FLAGS.techSetupEnabled` and passes it. Flipping the flag in TS alone activates the branch on the next mutation/deploy. **Recommend option 2** — matches the Phase 50 intent ("flip the flag in the same commit that confirms D-06 and sets techSetupStep").

### Pattern 3: Backfill Block (NEW — specific to Phase 51)

**What:** A second `DO $$ … $$` block at the bottom of 00027 that seeds `alert_dismissals` for every historical qualifying event. Runs once at migration time.

**Why critical:** Without this, every coach with 50 assigned students sees a flood on the first post-deploy sidebar render. The existing 100h_milestone pattern didn't need backfill because it was shipped when the student cohort was small.

**Shape (logical):**

```sql
DO $backfill$
BEGIN
  -- 5_influencers
  INSERT INTO alert_dismissals (owner_id, alert_key, dismissed_at)
  SELECT DISTINCT u.coach_id, 'milestone_5_influencers:' || rp.student_id::text, now()
  FROM roadmap_progress rp
  JOIN users u ON u.id = rp.student_id
  WHERE rp.step_number = 11 AND rp.status = 'completed'
    AND u.coach_id IS NOT NULL AND u.status = 'active' AND u.role = 'student'
  ON CONFLICT (owner_id, alert_key) DO NOTHING;

  -- brand_response (step_number=13) — same shape
  -- closed_deal — one row per (coach_id, deal_id) for every existing deal
  --   (deals has NO status column — every row is a closed deal; includes all logged_by values per D-16)

  -- tech_setup: intentionally NOT backfilled because MILESTONE_FEATURE_FLAGS.techSetupEnabled=false.
  -- When D-06 resolves and the flag flips, a SEPARATE follow-on migration must backfill tech_setup.
END $backfill$;
```

**ON CONFLICT contract:** `alert_dismissals` has `UNIQUE(owner_id, alert_key)` (00004:11). `ON CONFLICT (owner_id, alert_key) DO NOTHING` makes the backfill idempotent — re-running the migration is safe.

### Pattern 4: `unstable_cache` Wrapper (verbatim from Phase 48)

**What:** Server-only module exports `fetchCoachMilestones` (uncached, for mutation paths or fresh reads) + `getCoachMilestonesCached` (60s TTL, tagged).
**When to use:** Every v1.5 RPC consumer (Phases 46, 47, 48, 51).
**Example (copied from src/lib/rpc/coach-analytics.ts:53–105, abridged):**

```typescript
// Source: src/lib/rpc/coach-analytics.ts:14–16, 53–105 (pattern mirrored)
import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { coachMilestonesTag, type CoachMilestonesPayload } from "@/lib/rpc/coach-milestones-types";

export async function fetchCoachMilestones(
  coachId: string,
  today: string,
): Promise<CoachMilestonesPayload> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_coach_milestones", {
    p_coach_id: coachId,
    p_today:    today,
  });
  if (error) { console.error("[coach-milestones] RPC failed:", error); throw new Error("Failed to load coach milestones"); }
  if (!data)  { console.error("[coach-milestones] RPC returned no data for", coachId); throw new Error("Failed to load coach milestones"); }
  return data as unknown as CoachMilestonesPayload;
}

export async function getCoachMilestonesCached(
  coachId: string,
  today: string,
): Promise<CoachMilestonesPayload> {
  const cached = unstable_cache(
    async (id: string, t: string) => fetchCoachMilestones(id, t),
    ["coach-milestones", coachId, today],
    { revalidate: 60, tags: [coachMilestonesTag(coachId)] },
  );
  return cached(coachId, today);
}
```

### Pattern 5: Sidebar Badge Extension

**What:** Modify the coach branch of `get_sidebar_badges` to add the new milestone count to the existing `coach_milestone_alerts` return field (or add a new field; recommend folding in).

**Source of current shape:** `supabase/migrations/00017_chat_badges.sql:53–103` — this is the latest `CREATE OR REPLACE`; 00014 is superseded. The **full function body must be reproduced** in 00027 per D-08's "reuse pattern" mandate and per 00017's own `CREATE OR REPLACE` convention.

**Behavioral contract:**

- BEFORE: `coach_milestone_alerts` = count of `v_milestone_count - v_milestone_dismissed` where the count is 100h milestones (students with 6000+ session minutes within 45 days of joined_at) and dismissed keys match `LIKE '100h_milestone:%'`.
- AFTER: `coach_milestone_alerts` = (same 100h value) + (new milestones: count of qualifying events for Step 11 / Step 13 / each deal) − (dismissals matching `LIKE 'milestone_%'` — from `MILESTONE_KEY_PATTERNS.allV15Milestones`, config.ts:443).

**Sidebar TS type:** `src/lib/types.ts:14–19` (`SidebarBadgesResult`) already has `coach_milestone_alerts?: number` — no shape change needed, just comment-level doc update. The `Functions.get_sidebar_badges` return type in types.ts:740–748 currently only lists `active_alerts` + `unreviewed_reports`; planner should extend it (this is a pre-existing drift from 00017 not yet reflected in the generated types — low-priority cleanup).

### Anti-Patterns to Avoid

- **Don't build a notifications table.** D-08 locks the `alert_dismissals` pattern. Every new mechanism (polling, Redis, Realtime, Resend) is explicitly out of scope (REQUIREMENTS.md:117–124).
- **Don't use `CURRENT_DATE` inside the RPC body.** Phase 44 Pitfall 1 (STATE.md:98): "Pass `p_today date` to every RPC; never use `CURRENT_DATE` / `now()` in function body — timezone drift risk for week bucketing." `get_coach_milestones` MUST accept `p_today` and use it.
- **Don't put `auth.uid()` bare.** Always `(SELECT auth.uid())` for initplan (PERF-03, D-03). Mirrors Phase 44 convention (00021 comment at line 18–20).
- **Don't omit the backfill.** Critical Pitfall 13 (STATE.md:106): "Migration 00025 [sic: 00027] must pre-dismiss historical qualifying events — otherwise every coach gets flooded on rollout."
- **Don't scope one-shot keys `(student, milestone, coach)`.** STATE.md:105: "one-shot keys for NOTIF-01/02/03 scoped to `(student, milestone)` not `(student, milestone, coach)` — avoid double-fire on reassignment." Alert-key composers in config.ts:420–432 already enforce `(student)` scoping — do NOT append coach_id to the key.
- **Don't skip `try/catch` around `revalidateTag`.** Existing pattern at deals/route.ts:183–187: every `revalidateTag` except the primary one is wrapped in try/catch so a cache-layer miss doesn't 500 the mutation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Has this coach been notified?" dedup | In-memory dedup, new status column | `alert_dismissals` UNIQUE(owner_id, alert_key) + `ON CONFLICT DO NOTHING` | Matches 100h pattern exactly. Idempotent at DB layer, no app-state drift. |
| Per-deal notification row generation | Trigger on `deals` INSERT | Computed at read time: every `deals` row that lacks `milestone_closed_deal:{student_id}:{deal_id}` in dismissals | No events table needed; cache invalidation already handled via `revalidateTag` on POST /api/deals. |
| Cache key versioning | Manual cache-bust mechanism | `coachMilestonesTag(coachId)` + `revalidateTag()` on mutations | Phase 47/48 precedent; `next/cache` handles it. |
| Counting "qualifying events" client-side | Client-side aggregation | SECURITY DEFINER STABLE plpgsql function returning jsonb envelope | PERF-04 mandate; SQL is 100× faster at 5k students. |
| Tech-setup flag check in SQL | Hardcoded `IF flag_const THEN …` baked into migration | Pass `p_tech_setup_enabled` as RPC param, populate in TS wrapper from `MILESTONE_FEATURE_FLAGS.techSetupEnabled` | Flipping the flag alone (no migration) activates the branch. |

**Key insight:** Every primitive this phase needs is already in-tree. This is a composition phase, not a new-pattern phase.

## Runtime State Inventory

> This is a greenfield feature addition (new RPC + backfill). No rename/refactor, but the backfill IS a data-migration-equivalent. Documenting explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `alert_dismissals` table — existing rows use `alert_key LIKE '100h_milestone:%'`. Phase 51 backfill inserts rows with `alert_key LIKE 'milestone_%'`. The two namespaces do NOT overlap. | Backfill block at bottom of 00027 inserts one dismissal per historical qualifying event. ON CONFLICT DO NOTHING makes it idempotent. |
| Live service config | None — this is internal to Postgres + Next.js runtime. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no new Supabase URL, no new Service role key, no new `SUPABASE_*` vars. | None. |
| Build artifacts | None — `package.json` unchanged, no new deps. | None. |

**Backfill side-effects to confirm with planner:**

1. Backfill runs for ALL coaches (active + inactive). Consider whether inactive coaches should be excluded — conservatively, include them (their dismissals don't matter until they're re-activated).
2. Students in `status = 'active'` AND `role = 'student'` only — `student_diy` students still produce qualifying events for their coach if they have one (they CAN have coach_id; the Phase 45 RLS coach_insert_deals policy treats student_diy the same for INSERT purposes based on the coach_id FK). Planner should confirm D-16 intent: does closed-deal for student_diy trigger coach alert? **Default recommendation: YES — treat any student role identically for milestone eligibility.** Flag for user review.

## Common Pitfalls

### Pitfall 1: Missing backfill ⇒ coach alert flood
**What goes wrong:** Deploy 00027 without the backfill block. On next sidebar render, every coach with existing assigned students sees 50+ milestones queued up (5 for Step 11, 5 for Step 13, ~N for deals).
**Why it happens:** Compute-at-read-time architecture means the first query sees every historical event as "qualifying, not yet dismissed."
**How to avoid:** 00027 contains the RPC AND the backfill block in the same file. Migration is atomic — both land or neither does.
**Warning signs:** `SELECT count(*) FROM alert_dismissals WHERE alert_key LIKE 'milestone_%'` should equal "# of historical Step 11 completions for assigned students + # of Step 13 completions + # of deals × distinct coach_ids" at migration completion. Embed this as a `DO $$ ASSERT $$` block at end of 00027.

### Pitfall 2: Confusing 00025 vs 00027 migration number
**What goes wrong:** Planner follows CONTEXT.md literally ("Migration 00025 = combined") and tries to create a second 00025, overwriting Phase 48.
**Why it happens:** CONTEXT.md was drafted before Phase 48's 00025 + 00026 landed (same day).
**How to avoid:** **Next-available migration number is 00027.** Confirmed by `ls supabase/migrations/` — highest existing is 00026_fix_coach_analytics_wk_ambiguity.sql. Update Phase 51 CONTEXT.md (or just proceed with 00027 and note the deviation).
**Warning signs:** `supabase db push` errors "migration 00025 already applied" or silently skipped.

### Pitfall 3: RPC vs backfill split across two migrations
**What goes wrong:** Migration 00027 creates the RPC, 00028 adds the backfill. Between `supabase db push` running 00027 and 00028, any sidebar render sees the unbackfilled flood.
**Why it happens:** Intuition says "separate concerns = separate files."
**How to avoid:** Single migration file (00027) containing RPC + backfill + sidebar RPC rewrite. Transaction atomicity guarantees all-or-nothing. Claude's Discretion area in CONTEXT.md permits either; pick single-file for safety.
**Warning signs:** Separation of concerns looks clean on paper but operational risk is real. Don't.

### Pitfall 4: Badge double-counting
**What goes wrong:** Extended `get_sidebar_badges` adds the new milestone count to existing `coach_milestone_alerts` without subtracting dismissals correctly — coach sees `v_milestone_count + v_new_milestone_count - v_dismissed_100h_only`.
**Why it happens:** The 100h dismissal count uses `LIKE '100h_milestone:%'` (00017:88); forgetting that the new milestones need a SEPARATE dismissal count using `LIKE 'milestone_%'`.
**How to avoid:** Add `v_new_milestone_dismissed` as a separate var, using `LIKE 'milestone_%'`. Return `(v_milestone_count - v_milestone_dismissed) + (v_new_milestone_count - v_new_milestone_dismissed)`. Document the two namespaces in the SYNC comment.
**Warning signs:** Badge shows 0 after dismissing one milestone but should show N-1; or badge shows N after dismissing all (should be 0).

### Pitfall 5: `p_today` drift between sidebar RPC and milestones RPC
**What goes wrong:** `get_sidebar_badges` uses `CURRENT_DATE` (00017:24), `get_coach_milestones` takes `p_today` — user in PST sees a Step-11 completion at 11pm local that the sidebar counts but the detail page doesn't (date crossed UTC midnight).
**Why it happens:** Mixed conventions — 00017 predates Phase 44's "always accept p_today" rule.
**How to avoid:** When Phase 51 rewrites `get_sidebar_badges`, add `p_today date DEFAULT CURRENT_DATE` as a new 3rd parameter. The Next.js layout.tsx:12 caller already has `today = getTodayUTC()` available; thread it through.  **OR** accept the pre-existing drift for this phase and flag for future cleanup. Recommend: add the param now since 00027 is rewriting the function anyway.
**Warning signs:** Off-by-one sidebar count right at UTC midnight boundary.

### Pitfall 6: Tech-setup backfill silently omitted forever
**What goes wrong:** D-06 resolves, someone flips `techSetupEnabled = true`, and every historical student who already completed the confirmed tech-setup step produces a retroactive alert for their coach.
**Why it happens:** Phase 51 backfill intentionally skips tech_setup (flag = false); but nobody remembers to write a tech-setup-only backfill migration when the flag flips.
**How to avoid:** Migration header comment in 00027 must explicitly call this out as a future-work item: "When MILESTONE_FEATURE_FLAGS.techSetupEnabled flips to true, a NEW migration (00028 or later) MUST pre-dismiss every historical completion of MILESTONE_CONFIG.techSetupStep for assigned students."
**Warning signs:** D-06 resolves, flag flips, coaches see surprise alert floods.

### Pitfall 7: Over-broad LIKE pattern match
**What goes wrong:** Sidebar badge calculates new-milestone dismissals as `LIKE 'milestone_%'` and accidentally matches future milestone types added in v1.6+ (unexpected namespace collision).
**Why it happens:** Using the broad `MILESTONE_KEY_PATTERNS.allV15Milestones = 'milestone_%'` pattern.
**How to avoid:** Match each type's specific pattern: `alert_key LIKE 'milestone_tech_setup:%' OR LIKE 'milestone_5_influencers:%' OR LIKE 'milestone_brand_response:%' OR LIKE 'milestone_closed_deal:%'`. OR use the broad pattern but document that any new milestone type added in v1.6+ MUST either extend this RPC or use a non-`milestone_` prefix.
**Warning signs:** Dismissal counts off when a future phase adds a new `milestone_xyz:` namespace.

### Pitfall 8: Coach reassignment edge case
**What goes wrong:** Student completes Step 11 under Coach A → Coach A gets notified → student reassigned to Coach B → Coach B never sees the Step 11 notification.
**Why it happens:** Alert-key is scoped `(student, milestone)` not `(student, milestone, coach)`; A's dismissal doesn't apply to B, BUT the qualifying event from A's era is pre-dismissed on Phase 51 rollout (backfill pre-dismissed it for EVERY current coach including whoever the student was assigned to at backfill time).
**Why this is INTENDED behavior:** STATE.md:105 locks this: "avoid double-fire on reassignment." The decision was: on reassignment, the new coach does NOT get retroactive notifications about prior milestones. Only future milestones fire.
**How to avoid:** Planner: don't over-engineer this. The backfill pre-dismisses for all current coaches of assigned students at migration time, AND keys are student-scoped, so reassignment doesn't re-fire. If user changes mind, that's a Phase 52+ follow-up.

## Code Examples

Verified reusable patterns from existing migrations:

### Example 1: SECURITY DEFINER RPC with auth guard + zero-student short-circuit

```sql
-- Source: supabase/migrations/00025_get_coach_analytics.sql:93–125
IF v_caller IS NOT NULL AND v_caller IS DISTINCT FROM p_coach_id THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
END IF;

SELECT array_agg(id) INTO v_student_ids
FROM users
WHERE role = 'student' AND coach_id = p_coach_id AND status = 'active';

IF v_student_ids IS NULL OR array_length(v_student_ids, 1) IS NULL THEN
  RETURN jsonb_build_object(/* fully-zeroed envelope */);
END IF;
```

### Example 2: Dismissal-exclusion semi-join (100h precedent, to be generalized)

```sql
-- Source: supabase/migrations/00017_chat_badges.sql:84–89
SELECT count(*)
  INTO v_milestone_dismissed
  FROM alert_dismissals
 WHERE owner_id = p_user_id
   AND alert_key LIKE '100h_milestone:%';
```

For Phase 51's `get_coach_milestones` envelope building, flip this to `NOT EXISTS`:

```sql
-- Phase 51 adaptation (new)
WHERE NOT EXISTS (
  SELECT 1 FROM alert_dismissals ad
  WHERE ad.owner_id = p_coach_id AND ad.alert_key = qualifying_event.alert_key
)
```

### Example 3: Embedded `DO $$ ASSERT $$` correctness checks

```sql
-- Source: supabase/migrations/00025_get_coach_analytics.sql:566–588
DO $$
DECLARE
  v_fake    uuid := '00000000-0000-0000-0000-000000000000';
  v_payload jsonb;
BEGIN
  v_payload := public.get_coach_milestones(v_fake, CURRENT_DATE);
  ASSERT v_payload ? 'milestones', 'envelope missing milestones key';
  ASSERT v_payload ? 'count',       'envelope missing count key';
  ASSERT (v_payload->>'count')::int = 0,
    format('zero-student coach expected count=0, got %s', v_payload->>'count');
  ASSERT jsonb_array_length(v_payload->'milestones') = 0,
    'milestones array expected empty for unknown coach';
END $$;
```

This is the idempotency check demanded by the CONTEXT.md "Specifics" section ("A unit test must confirm `get_coach_milestones` returns zero new notifications immediately after the migration runs").

### Example 4: Next.js `revalidateTag` on mutation (existing pattern to extend)

```typescript
// Source: src/app/api/deals/route.ts:181–201 (existing; Phase 51 adds one line)
revalidateTag(`deals-${effectiveStudentId}`, "default");
try {
  revalidateTag(studentAnalyticsTag(effectiveStudentId), "default");
} catch (e) { console.error("[revalidate-tag]", e); }
try {
  const { data: studentRow } = await admin
    .from("users")
    .select("coach_id")
    .eq("id", effectiveStudentId)
    .maybeSingle();
  if (studentRow?.coach_id) {
    revalidateTag(coachDashboardTag(studentRow.coach_id), "default");
    revalidateTag(coachAnalyticsTag(studentRow.coach_id), "default");
    // PHASE 51 ADDITION — one line:
    revalidateTag(coachMilestonesTag(studentRow.coach_id), "default");
  }
} catch (err) {
  console.error("[deals] failed to invalidate coach-dashboard tag:", err);
}
```

### Example 5: `unstable_cache` wrapper module (complete template)

See `src/lib/rpc/coach-analytics.ts:14–105` — copy wholesale, rename `CoachAnalytics*` → `CoachMilestones*`, simplify params (only `coachId` + `today`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-feature middleware.ts | `src/proxy.ts` | Next.js 16 migration | Phase 51 doesn't touch routing — non-issue, flagged for general awareness. |
| Client-side aggregation of deals/sessions | `SECURITY DEFINER STABLE` plpgsql RPCs | Phase 44 (00021) | Phase 51 strictly follows. |
| `CURRENT_DATE` / `now()` inside RPC body | Explicit `p_today date` param | Phase 44 Pitfall 1 (STATE.md:98) | 00017's `get_sidebar_badges` uses `CURRENT_DATE` — legacy; Phase 51 should correct this when rewriting. |
| Hand-rolled notifications table | `alert_dismissals` computed alerts | quick/260401-cwd + Phase 44+ | Phase 51 extends precedent. |
| `auth.uid()` bare | `(SELECT auth.uid())` initplan wrap | v1.2 Phase 19 | Verified across 00021, 00022, 00024, 00025. |

**Deprecated/outdated:**

- **`middleware.ts`** — deprecated on Next 16; use `src/proxy.ts`. N/A to Phase 51.
- **Direct `admin.from().select()` in analytics/dashboard server pages** — deprecated per D-01; all new reads go through RPCs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] `student_diy` role students trigger coach milestones identically to `student` | Pattern 2 / Runtime State Inventory | Low — planner should confirm via explicit D-16 re-read; if only `student` role counts, add `role = 'student'` to the qualifying-event CTEs. Recommended default: include both. |
| A2 | [ASSUMED] `deals` table has NO `status` column — every row = a closed deal | Pattern 2 (closed_deal branch) | Medium — verified by inspection of migration 00022 (which references `deals.student_id` and `deals.logged_by` but never `status`); the Phase 44/48 RPCs all COUNT(*) deals without filter. If a `status` column exists in a production-only migration not in local supabase/migrations/, the "every deal fires" semantic changes. **Verify at planning time by running `SELECT column_name FROM information_schema.columns WHERE table_name='deals'` against dev DB.** |
| A3 | [ASSUMED] Backfill should run for inactive coaches too | Runtime State Inventory | Low — their dismissals are harmless no-ops if they're never re-activated. |
| A4 | [ASSUMED] Single-migration (RPC + backfill + sidebar rewrite) is safer than split | Pattern 4 / Pitfall 3 | Low — atomicity argument is strong; Claude's Discretion explicitly permits this choice. |
| A5 | [ASSUMED] `coach-milestones:${coachId}` colon separator matches precedent; CONTEXT.md's `coach-milestones-${coachId}` is a typo | User Constraints | Low — verified against 3 existing tag constants (studentAnalyticsTag, coachDashboardTag, coachAnalyticsTag) all using colon. Planner should use colon. |
| A6 | [ASSUMED] `deals` table exists in production (no migration creates it locally; 00022 ALTERs it) | Architecture Patterns | Low — entire Phase 45 + 48 work depends on this table existing; it ships in production. Local dev may use `supabase db reset` + seed from a different source. If running migrations fresh on a clean DB, 00022 will fail at `ALTER TABLE public.deals`. Out of Phase 51's scope to fix. |

## Open Questions

1. **RPC return envelope shape — single flat array or grouped-by-student?**
   - What we know: NOTIF-06 requires student name + achievement description; Phase 52 `/coach/alerts` page requires grouped-by-student feed (NOTIF-09).
   - What's unclear: Does the RPC return `[{milestone}, {milestone}, …]` and Phase 52 groups client-side, OR does it return `{studentId: [{milestone}, …]}`?
   - Recommendation: Flat array + rich `{student_id, student_name, milestone_type, alert_key, deal_id?, occurred_at, step_number?, step_name?}` per row. Phase 52 groups in React. Matches Phase 48's flat `students[]` envelope pattern. Sidebar badge just needs `count` — derivable from `jsonb_array_length`.

2. **Should `get_sidebar_badges` expose a separate `coach_new_milestone_alerts` key alongside `coach_milestone_alerts`, or fold them together?**
   - What we know: `NavItem.badge = "coach_milestone_alerts"` (config.ts:302) points at a single key.
   - What's unclear: Does Abu Lahya / user want to distinguish 100h alerts from new-milestone alerts in any UX?
   - Recommendation: Fold into one `coach_milestone_alerts` field — simpler sidebar, no UI change needed in Phase 51. Phase 52 can split if/when `/coach/alerts` wants distinct sections.

3. **Does the `roadmap_progress` CHECK constraint permit step_number=11 and 13?**
   - What we know: 00001 has `CHECK (step_number BETWEEN 1 AND 10)`; 00008 expands to 15 steps via `DROP CONSTRAINT roadmap_progress_step_number_check` + `ADD CONSTRAINT` with new bound.
   - What's unclear: None — verified at 00008:10–15. Steps 1–15 are valid. No action needed.

4. **Is the `deals` table CREATE in a migration somewhere I didn't find, or is it in a Phase 38 production-only script?**
   - What we know: `grep -l "CREATE TABLE.*deals"` returns nothing across local `supabase/migrations/`, yet 00022 ALTERs `public.deals` without complaint in Phase 45's summary.
   - Hypothesis: `deals` table was created in a production-only SQL run (pre-migration-dir era, or Phase 38's migration was cherry-applied and not checked in).
   - Recommendation: Out of scope for Phase 51. Planner should confirm `deals` schema via `\d public.deals` in the dev DB if uncertain. Phase 51 only needs `deals.student_id` + `deals.id` + `deals.created_at` + `deals.logged_by`, all of which are verified in 00022 and downstream RPCs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase db push`) | Migration runner | ✓ (package.json:37 `supabase` ^2.78.1) [VERIFIED] | 2.78.1 | — |
| PostgreSQL | RPC host | ✓ (Supabase managed) | 15+ [ASSUMED — standard Supabase] | — |
| Node.js + Next.js 16 | RPC wrapper + `revalidateTag` | ✓ (package.json:20) | 16.1.6 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **In-migration `DO $$ ASSERT $$` blocks** (plpgsql) + **manual build gate** (`npm run lint && npx tsc --noEmit && npm run build`) |
| Config file | None (no vitest/jest/playwright installed; verified by `Glob **/vitest.config.*` = empty) |
| Quick run command | `supabase db push` runs the migration INCLUDING embedded asserts. |
| Full suite command | `supabase db reset` to re-apply every migration (nuclear) OR run 00027 only + `npx tsc --noEmit && npm run build`. |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-02 | Step 11 completion ⇒ milestone row in RPC output | `DO $$ ASSERT $$` in 00027 | `supabase db push` | ❌ Wave 0 (will be embedded in 00027) |
| NOTIF-03 | Step 13 completion ⇒ milestone row in RPC output | `DO $$ ASSERT $$` in 00027 | `supabase db push` | ❌ Wave 0 |
| NOTIF-04 | Each deal ⇒ one `milestone_closed_deal:{student_id}:{deal_id}` row | `DO $$ ASSERT $$` in 00027 | `supabase db push` | ❌ Wave 0 |
| NOTIF-05 | Idempotency: second Step 11 for same student = no new notification | `DO $$ ASSERT $$` in 00027 — insert 2 Step-11 completions, assert 1 row in RPC output | `supabase db push` | ❌ Wave 0 |
| NOTIF-05 | Per-deal granularity: two deals for same student = two notifications | `DO $$ ASSERT $$` in 00027 — insert 2 deals, assert 2 closed_deal rows in RPC output | `supabase db push` | ❌ Wave 0 |
| NOTIF-07 | Extended `get_sidebar_badges` returns summed count | `DO $$ ASSERT $$` in 00027 — call the function, assert `coach_milestone_alerts` ≥ 100h count + new count | `supabase db push` | ❌ Wave 0 |
| NOTIF-08 | 100h alert still fires correctly | `DO $$ ASSERT $$` in 00027 — set up a 100h-qualifying student, assert count ≥ 1 BEFORE new-milestone rows exist | `supabase db push` | ❌ Wave 0 |
| NOTIF-10 | Backfill pre-dismisses historical events → RPC returns zero post-migration | `DO $$ ASSERT $$` at END of 00027 — SELECT count(*) from RPC for test coach (with pre-existing Step 11 + deal history), assert 0 | `supabase db push` | ❌ Wave 0 |
| NOTIF-11 | Performance — 5k student × 50 per coach target | Manual `EXPLAIN (ANALYZE, BUFFERS)` during planning; verify all 3 index scans present | Manual | ❌ Wave 0 (document queries in plan) |
| PERF-02 / PERF-05 / PERF-07 (cross-cutting) | Build gate | Manual | `npm run lint && npx tsc --noEmit && npm run build` | ✓ existing |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (fast feedback on types)
- **Per wave merge:** `supabase db push` (runs migration + embedded asserts) + `npm run build`
- **Phase gate:** full gate `npm run lint && npx tsc --noEmit && npm run build` + `supabase db reset && supabase db push` (optional re-run to prove idempotency)

### Wave 0 Gaps

- [ ] **No gaps** — the project uses embedded PL/pgSQL asserts and the TS build as its validation layer. Phase 51 plan SHOULD list the specific `ASSERT` blocks to embed in 00027 (one per requirement above). The existing `00021` + `00025` migrations are the precedent templates.
- [ ] If the planner wants stronger isolation (e.g., a proper pgTAP suite or vitest), that is a Wave 0 setup task that requires a new dependency and is OUT OF SCOPE unless user approves. Default: stay with the embedded assert pattern.

**Recommendation:** Planner should NOT install vitest/pgTAP for this phase. The embedded-assert pattern at 00021:117–142 and 00025:550–599 is the project's validated convention.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth + `getUser()` at top of every API route handler (reports/route.ts:31, deals/route.ts:41, roadmap/route.ts:23). Phase 51 adds no new routes; reuses existing auth. |
| V3 Session Management | yes | Cookie-based session via `createClient()` from `@/lib/supabase/server`; no session code added in Phase 51. |
| V4 Access Control | yes | Dual-layer: route-handler role check + RLS policies. `alert_dismissals` has coach RLS (00014:22–29); the new RPC uses `(SELECT auth.uid())` auth guard (00025:97–99 pattern). Backfill runs at migration time as service_role — bypasses RLS intentionally. |
| V5 Input Validation | yes | New RPC args are `uuid` + `date` — Postgres type system enforces. TS wrapper takes validated `coachId: string` from `requireRole("coach")` (session.ts helper). No user-facing input added. |
| V6 Cryptography | no | No crypto. UUIDs are opaque identifiers. |

### Known Threat Patterns for Postgres+Supabase+Next.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `alert_key` composition | Tampering | `alert_key` is built from UUIDs stamped by the backend (`${studentId}:${dealId}`); MILESTONES composers in config.ts:420–432 use template literals with `as const`. No user-supplied string ever reaches the key. Negligible risk. |
| RLS bypass via admin client | Elevation of Privilege | Admin client is server-only (`import "server-only"` guards). Phase 51 `coach-milestones.ts` must include `import "server-only"`. Verified by existing coach-analytics.ts:14. |
| Cross-coach milestone read (coach A reads coach B's students' milestones) | Information Disclosure | `(SELECT auth.uid())` guard in RPC raises `not_authorized` (42501) when caller ≠ p_coach_id. Pattern at 00025:97–99. |
| Timing-oracle on dismissal count | Information Disclosure | Dismissal counts are coach-scoped by `owner_id`; no cross-coach leak via timing. N/A. |
| Cache poisoning via tag collision | Tampering | `coachMilestonesTag(coachId)` includes the coach UUID; collision would require UUID collision (statistically impossible). |
| CSRF on `POST /api/alerts/dismiss` (coach dismisses a milestone) | Tampering | Existing `verifyOrigin(request)` at alerts/dismiss/route.ts:14 covers this. Phase 51 does not change the dismiss route. |
| Backfill injecting wrong coach_id | Tampering | Backfill SELECT joins `users u ON u.id = rp.student_id WHERE u.coach_id IS NOT NULL` — `u.coach_id` is the authoritative source. Test assertion: `every backfilled alert_dismissals row has owner_id = u.coach_id` for the corresponding student. |

## Sources

### Primary (HIGH confidence — verified by inspection)

- `supabase/migrations/00001_create_tables.sql:100–113` — roadmap_progress schema
- `supabase/migrations/00004_alert_dismissals.sql:1–29` — alert_dismissals table + UNIQUE constraint + owner RLS
- `supabase/migrations/00008_expand_roadmap_to_15_steps.sql:10–15` — step 11/13 validity
- `supabase/migrations/00014_coach_alert_dismissals.sql:22–29` — coach RLS on alert_dismissals
- `supabase/migrations/00017_chat_badges.sql:53–103` — **current** `get_sidebar_badges` shape (supersedes 00014)
- `supabase/migrations/00021_analytics_foundation.sql:93–103` — Phase 44 indexes (covers all hot paths)
- `supabase/migrations/00022_deals_logged_by.sql:39–113` — deals.logged_by + deals_set_audit trigger + coach/owner INSERT RLS
- `supabase/migrations/00024_get_coach_dashboard.sql:29–60` — RPC skeleton template
- `supabase/migrations/00025_get_coach_analytics.sql:58–599` — RPC + embedded asserts template (richest precedent)
- `supabase/migrations/00026_fix_coach_analytics_wk_ambiguity.sql` — confirms 00026 is last-used migration number
- `src/lib/config.ts:376–444` — Phase 50 MILESTONE_CONFIG / MILESTONES / MILESTONE_FEATURE_FLAGS / MILESTONE_KEY_PATTERNS
- `src/lib/rpc/coach-analytics.ts:14–105` — **TS wrapper template** (copy wholesale for coach-milestones.ts)
- `src/lib/rpc/coach-analytics-types.ts:157–159` — `coachAnalyticsTag` helper (template for coachMilestonesTag)
- `src/lib/rpc/coach-dashboard-types.ts:37–43` — `coachDashboardTag` helper (template, simpler variant)
- `src/lib/types.ts:14–19` — `SidebarBadgesResult` shape
- `src/app/(dashboard)/layout.tsx:9–49` — sidebar-badges cache + consumer
- `src/app/api/deals/route.ts:3, 181–229` — revalidateTag call pattern (deals mutation)
- `src/app/api/reports/route.ts:3, 109–173` — revalidateTag call pattern (report mutation)
- `src/app/api/roadmap/route.ts:3, 112–116` — revalidateTag call pattern (roadmap mutation, currently only student-analytics; Phase 51 adds coach-milestones)
- `src/app/api/alerts/dismiss/route.ts:66–81` — existing alert_dismissals upsert pattern
- `src/app/(dashboard)/coach/alerts/page.tsx:1–60` — existing 100h alert page (Phase 52 will extend this)
- `.planning/REQUIREMENTS.md:72–82, 121–126` — NOTIF-01..11 + explicit out-of-scope list
- `.planning/STATE.md:98–108` — Phase 51 critical pitfalls (already enumerated by the roadmapper)
- `.planning/phases/50-milestone-config/50-01-SUMMARY.md:60–65` — Phase 50 delivered contracts + named migration 00027 as the expected consumer

### Secondary (MEDIUM confidence — consistent with above but not re-verified)

- Supabase CLI `supabase db push` behavior (runs SQL + stops on ASSERT failure) — standard, documented; matches observed behavior in 00021/00025.

### Tertiary (LOW confidence)

- None — no WebSearch results used; everything grounded in repo.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps are already installed; no new packages.
- Architecture: HIGH — every pattern has a specific existing precedent file:line cited above.
- Pitfalls: HIGH — Phase 44 STATE.md explicitly pre-enumerates the critical ones; 6 of the 8 listed above are repo-confirmed.
- Backfill design: MEDIUM — the shape is clear, but the exact SQL needs planning iteration (especially student_diy inclusion and tech_setup gating-by-param vs gating-by-omission).
- Migration number: HIGH — 00027 verified by `ls supabase/migrations/`.

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable — Supabase/Postgres/Next 16 unlikely to churn; main drift risk is if someone else lands a migration 00027 first)

---

## Quick-Reference Cheat Sheet (for planner)

1. **Migration file:** `supabase/migrations/00027_get_coach_milestones_and_backfill.sql`
2. **New TS files:** `src/lib/rpc/coach-milestones-types.ts` + `src/lib/rpc/coach-milestones.ts`
3. **Modified TS files:** `src/lib/types.ts` (badge shape), `src/app/api/deals/route.ts` (1 line × 2 branches), `src/app/api/reports/route.ts` (1 line × 2 branches), `src/app/api/roadmap/route.ts` (1 line)
4. **Tag helper:** `coachMilestonesTag(coachId) = \`coach-milestones:${coachId}\`` (colon, matching precedent)
5. **RPC signature:** `public.get_coach_milestones(p_coach_id uuid, p_today date DEFAULT CURRENT_DATE, p_tech_setup_enabled boolean DEFAULT false) RETURNS jsonb`
6. **Envelope:** `{milestones: [{student_id, student_name, milestone_type, alert_key, deal_id?, occurred_at, step_number?, step_name?}, …], count: int}`
7. **Extended `get_sidebar_badges` coach branch:** fold new count into existing `coach_milestone_alerts` key; add `p_today date DEFAULT CURRENT_DATE` param while rewriting.
8. **Backfill scope:** insert dismissals for every historical (Step 11 complete, Step 13 complete, every deal) × (assigned active coach). Skip `tech_setup` (flag=false). ON CONFLICT DO NOTHING.
9. **Validation:** 8+ embedded `DO $$ ASSERT $$` blocks in 00027 — one per requirement above.
10. **Build gate:** `npm run lint && npx tsc --noEmit && npm run build` + `supabase db push`.
