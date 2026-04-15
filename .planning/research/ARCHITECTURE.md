# Architecture Patterns — v1.6 Integration Analysis

**Domain:** IMA Accelerator — Owner Analytics, Announcements, Roadmap Step 8
**Researched:** 2026-04-15
**Confidence:** HIGH — based entirely on direct codebase inspection

---

## Existing Architecture Summary (Verified)

```
src/app/(dashboard)/layout.tsx      — unstable_cache(60s) wrapping get_sidebar_badges RPC
src/app/(dashboard)/owner/page.tsx  — direct admin.rpc("get_owner_dashboard_stats") (no cache yet)
src/app/(dashboard)/coach/page.tsx  — unstable_cache(60s) wrapping get_coach_dashboard RPC
src/app/(dashboard)/coach/analytics/page.tsx — unstable_cache(60s) wrapping get_coach_analytics RPC

src/lib/rpc/                        — server-only fetchers (import "server-only") + pure type modules
src/lib/rpc/types.ts                — SidebarBadgesResult, OwnerDashboardStats, StudentDetailResult
supabase/migrations/                — 00001–00027, next is 00028
```

The RPC pattern is locked: SECURITY DEFINER, STABLE, `(SELECT auth.uid())` initplan auth guard,
service_role bypass for admin client, jsonb return, 60s `unstable_cache` on the Next.js side,
`revalidateTag` on every mutation route.

---

## Feature 1: Owner Analytics

### RPC Shape

**Name:** `public.get_owner_analytics`
**Migration:** `00028_get_owner_analytics.sql`

**Params:**

```sql
CREATE OR REPLACE FUNCTION public.get_owner_analytics(
  p_week_start date DEFAULT NULL,
  p_today      date DEFAULT CURRENT_DATE,
  p_limit      int  DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
```

No `p_owner_id` needed — owner is a singleton role. Auth guard: check `(SELECT auth.uid())`
resolves to a user with `role = 'owner'` in the users table, OR allow `auth.uid() IS NULL`
(service-role admin client, same bypass as all other RPCs).

**Return envelope:**

```jsonb
{
  "top_hours":  [{ "student_id", "student_name", "minutes" }, ...],  -- top 3 by completed minutes all-time
  "top_profit": [{ "student_id", "student_name", "profit" }, ...],   -- top 3 by sum(deals.profit)
  "top_deals":  [{ "student_id", "student_name", "deals" }, ... ],   -- top 3 by count(deals)
  "totals": {
    "total_students": int,
    "total_revenue":  numeric,
    "total_profit":   numeric,
    "total_deals":    int,
    "avg_roadmap_step": numeric
  }
}
```

Leaderboard rows are platform-wide (all students, all roles), not coach-scoped.
`p_limit` defaults to 3 (teaser on homepage uses same RPC with same limit).

**Indexes:** Already exist from Phase 44 (00021_analytics_foundation.sql):
- `idx_deals_student_created` — covers `SUM(profit)` and `COUNT(deals)` per student
- `idx_work_sessions_completed_student_date` — covers `SUM(duration_minutes)` per student (partial index on `status='completed'`)

No new indexes needed for this RPC.

### File Structure

**New files:**

```
src/app/(dashboard)/owner/analytics/page.tsx          -- server component, revalidate=60
src/lib/rpc/owner-analytics-types.ts                  -- pure types, no server-only deps
src/lib/rpc/owner-analytics.ts                        -- import "server-only", fetcher + cache
supabase/migrations/00028_get_owner_analytics.sql     -- RPC + embedded asserts
```

**Modified files:**

```
src/app/(dashboard)/owner/page.tsx    -- add analytics teaser section + wrap existing RPC in unstable_cache
src/lib/config.ts                     -- add ROUTES.owner.analytics, NAVIGATION owner entry
```

### Owner Dashboard Teaser Integration

Current `owner/page.tsx` calls `admin.rpc("get_owner_dashboard_stats")` directly with no cache.
Two changes needed:

1. Wrap `get_owner_dashboard_stats` in `unstable_cache(60s, { tags: ["owner-dashboard"] })` — deferred from v1.2. v1.6 is the right time since we are touching this file anyway.

2. Add a second RPC call to `get_owner_analytics` (also cached 60s, tag `owner-analytics`) and
   render a "View Full Analytics" teaser section below the existing 4 stat cards. The teaser shows
   the top-3 rows per leaderboard in a compact 3-column grid with a `Link href="/owner/analytics"`.
   Do NOT replace the existing stat cards — they serve a different purpose (today-scoped activity).

```
owner/page.tsx layout after change:
  [Greeting]
  [4 stat cards — total_students, total_coaches, active_today, reports_today]
  [Analytics Preview section — 3 compact leaderboard columns]
    Top Hours  |  Top Profit  |  Top Deals
    [Row 1]    |  [Row 1]     |  [Row 1]
    [Row 2]    |  [Row 2]     |  [Row 2]
    [Row 3]    |  [Row 3]     |  [Row 3]
    "View full analytics" Link
```

The existing stat cards that are already `Link`-wrapped (Total Students to /owner/students,
Total Coaches to /owner/coaches) stay as-is. Active Today and Reports Today are display-only.

### Cache Tag Strategy

```
owner-dashboard   — tag for get_owner_dashboard_stats; no mutation route invalidates it (today-scoped, 60s TTL sufficient)
owner-analytics   — invalidated by: POST /api/deals and PATCH /api/deals and PATCH /api/deals/[id]
```

Add `revalidateTag("owner-analytics", "default")` to `src/app/api/deals/route.ts` (POST + PATCH)
and `src/app/api/deals/[id]/route.ts` (PATCH) — same pattern as `coachDashboardTag`.

Tag helper in `owner-analytics-types.ts`:
```ts
export function ownerAnalyticsTag(): string {
  return "owner-analytics"; // singleton — no owner ID scoping needed
}
```

### Route Config Changes

```ts
// src/lib/config.ts — ROUTES.owner add:
analytics: "/owner/analytics",

// NAVIGATION owner — insert between Alerts and Resources:
{ label: "Analytics", href: "/owner/analytics", icon: "BarChart3", separator: true }
```

The proxy does not need changes — `/owner/analytics` falls under the existing `/owner` prefix
in `ROLE_ROUTE_ACCESS`.

---

## Feature 2: Chat to Announcements

### New Table DDL

**Migration:** `00029_announcements.sql`

```sql
CREATE TABLE public.announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot-path index: paginated list newest-first
CREATE INDEX idx_announcements_created_at ON public.announcements(created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated roles (owner, coach, student, student_diy)
CREATE POLICY "announcements_select_all"
  ON public.announcements FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert: owner and coach only
CREATE POLICY "announcements_insert_owner_coach"
  ON public.announcements FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE auth_id = (SELECT auth.uid())) IN ('owner', 'coach')
  );

-- Update: author only
CREATE POLICY "announcements_update_author"
  ON public.announcements FOR UPDATE
  USING (author_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())))
  WITH CHECK (author_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())));

-- Delete: author only
CREATE POLICY "announcements_delete_author"
  ON public.announcements FOR DELETE
  USING (author_id = (SELECT id FROM users WHERE auth_id = (SELECT auth.uid())));

-- Drop messages table atomically in the same migration
DROP TABLE IF EXISTS public.messages CASCADE;
```

`CASCADE` on `DROP TABLE messages` handles the 3 indexes on the messages table automatically.
The messages table has no outbound foreign keys to other tables — only inbound FKs from `users`
via `coach_id`, `sender_id`, `recipient_id`. Those FKs are ON DELETE CASCADE on the messages
side, not the users side, so dropping messages does not affect users rows.

### get_sidebar_badges Rewrite

The current `get_sidebar_badges` (4-arg version in 00027) references `messages` table in both the
coach branch and the student branch. The 00029 migration must include a DROP + CREATE OR REPLACE
of `get_sidebar_badges` that removes both `unread_messages` branches.

Drop pattern is necessary because the function signature stays the same but the body changes.
Use `CREATE OR REPLACE` — do not drop + recreate (avoids grant loss during deployment window).

**Changes to the function body:**

Coach branch — remove:
```sql
-- REMOVE this entire block:
SELECT count(*) INTO v_unread_count
FROM messages
WHERE coach_id = p_user_id
  AND recipient_id = p_user_id
  AND read_at IS NULL;
```
And remove `'unread_messages', v_unread_count` from the coach RETURN statement.

Student branch — replace the entire `IF p_role = 'student'` block with:
```sql
IF p_role = 'student' THEN
  RETURN '{}'::jsonb;
END IF;
```

Owner branch — remove `'unread_messages', 0` from the RETURN.

Remove the `v_unread_count integer := 0` variable declaration from DECLARE block.

**layout.tsx change (src/app/(dashboard)/layout.tsx):**
```ts
// Remove this block entirely:
if (badges.unread_messages !== undefined && badges.unread_messages > 0) {
  badgeCounts.unread_messages = badges.unread_messages;
}
```

**SidebarBadgesResult type change (src/lib/rpc/types.ts):**
```ts
// Remove:
unread_messages?: number;
```

### API Routes

**Delete entirely:**
```
src/app/api/messages/route.ts
src/app/api/messages/read/route.ts
```

**New routes:**
```
src/app/api/announcements/route.ts         (GET paginated, POST create)
src/app/api/announcements/[id]/route.ts    (PATCH update, DELETE)
```

`GET /api/announcements` — no CSRF, no rate limit (read-only, consistent with GET /api/calendar
pattern). Query params: `?page=1` (default, 1-indexed). Returns 25 rows per page, newest-first.
Auth: any authenticated role. Admin client query with `ORDER BY created_at DESC LIMIT 25 OFFSET
(page-1)*25`. Also joins `users` to return `author_name` and `author_role` for attribution.

`POST /api/announcements` — CSRF + rate limit (30 req/min). Role: owner or coach only (403 for
student/student_diy). Zod: `{ content: z.string().min(1).max(2000) }`. Inserts row with
`author_id = profile.id`. Invalidates `revalidateTag("announcements", "default")`.

`PATCH /api/announcements/[id]` — CSRF + rate limit. Role: owner or coach. Dual-layer: route
checks `announcement.author_id === profile.id` (admin query) before updating. Zod: `{ content }`.
Updates content + updated_at. Invalidates `revalidateTag("announcements", "default")`.

`DELETE /api/announcements/[id]` — CSRF + rate limit. Role: owner or coach. Dual-layer: same
author_id check. Invalidates `revalidateTag("announcements", "default")`.

### Page Routes

Single shared client component, four server page files (one per role):

```
src/app/(dashboard)/owner/announcements/page.tsx      -- canCreate=true
src/app/(dashboard)/coach/announcements/page.tsx      -- canCreate=true
src/app/(dashboard)/student/announcements/page.tsx    -- canCreate=false
src/app/(dashboard)/student_diy/announcements/page.tsx -- canCreate=false
```

These four pages share `AnnouncementsClient` with `canCreate: boolean` prop.

Server page fetches first page via `unstable_cache(60s, { tags: ["announcements"] })`.
Client component handles page 2+ via fetch to `GET /api/announcements?page=N`.

```
src/components/announcements/AnnouncementsClient.tsx
src/components/announcements/AnnouncementCard.tsx
src/components/announcements/AnnouncementForm.tsx     (rendered only when canCreate=true)
```

### Sidebar Navigation

**Remove from config.ts NAVIGATION:**
```ts
// coach — remove:
{ label: "Chat", href: "/coach/chat", icon: "MessageSquare", badge: "unread_messages", separator: true }

// student — remove:
{ label: "Chat", href: "/student/chat", icon: "MessageSquare", badge: "unread_messages" }
```

**Add to config.ts NAVIGATION:**
```ts
// owner (add before Resources, consistent with having Announcements near the bottom of nav):
{ label: "Announcements", href: "/owner/announcements", icon: "Megaphone", separator: true }

// coach (replace Chat entry, keep separator: true):
{ label: "Announcements", href: "/coach/announcements", icon: "Megaphone", separator: true }

// student (replace Chat entry, no badge):
{ label: "Announcements", href: "/student/announcements", icon: "Megaphone" }

// student_diy (new entry — announcements are accessible to student_diy per requirements):
{ label: "Announcements", href: "/student_diy/announcements", icon: "Megaphone" }
```

**ROUTES config:**
```ts
owner:       { ..., announcements: "/owner/announcements" }
coach:       { ..., announcements: "/coach/announcements" }   // remove chat key
student:     { ..., announcements: "/student/announcements" } // remove chat key
student_diy: { ..., announcements: "/student_diy/announcements" }
```

### Proxy Changes

No changes to `proxy.ts` needed. All new announcement routes fall under existing prefix guards.

### Chat Removal Surface (Complete Checklist)

**Files to DELETE:**
```
src/app/(dashboard)/coach/chat/page.tsx
src/app/(dashboard)/student/chat/page.tsx
src/app/api/messages/route.ts
src/app/api/messages/read/route.ts
src/lib/chat-utils.ts
src/components/chat/BroadcastCard.tsx
src/components/chat/ChatComposer.tsx
src/components/chat/ConversationList.tsx
src/components/chat/DaySeparator.tsx
src/components/chat/MessageBubble.tsx
src/components/chat/MessageThread.tsx
```

**Files to MODIFY:**
```
src/lib/config.ts               — NAVIGATION (remove Chat entries), ROUTES (remove chat keys), add announcements entries
src/app/(dashboard)/layout.tsx  — remove unread_messages badge handling block
src/lib/rpc/types.ts            — remove unread_messages from SidebarBadgesResult
src/lib/types.ts                — remove messages table type block (~lines 534-590)
supabase/migrations/00029_*     — DROP TABLE messages CASCADE + rewrite get_sidebar_badges
```

Note on `src/lib/types.ts`: this file is hand-crafted (acknowledged in project docs). Remove the
`messages` table block from the Database type union. The `unread_messages` comment on line ~751
in the sidebar badges type should also be removed.

---

## Feature 3: Roadmap Step 8 Insertion

### Migration Strategy — Atomic Renumber

**Migration:** `00030_roadmap_step8.sql`

Use negative-number temp-shift strategy. Safer than DEFERRABLE constraints because Supabase cloud
may not support `SET CONSTRAINTS DEFERRED` reliably in all migration contexts, and requires no
schema alteration.

```sql
BEGIN;

-- Step 1: Shift existing steps 8-15 to negative temporaries (-8 through -15)
UPDATE roadmap_progress
   SET step_number = -step_number
 WHERE step_number >= 8;

-- Step 2: Shift negatives to final positions (step 8 becomes 9, ..., step 15 becomes 16)
UPDATE roadmap_progress
   SET step_number = (-step_number) + 1
 WHERE step_number < 0;

-- Step 3: Auto-complete new Step 8 for students who completed old Step 7 (which stays Step 7)
INSERT INTO roadmap_progress (student_id, step_number, status, completed_at)
SELECT DISTINCT rp.student_id, 8, 'completed', now()
  FROM roadmap_progress rp
 WHERE rp.step_number = 7
   AND rp.status = 'completed'
ON CONFLICT (student_id, step_number) DO NOTHING;

-- Step 4: Rewrite get_coach_milestones with updated step number references
CREATE OR REPLACE FUNCTION public.get_coach_milestones(...)
-- (same signature and body as 00027, only step_number = 11 -> 12 and step_number = 13 -> 14)
-- Re-issue GRANT EXECUTE after CREATE OR REPLACE

COMMIT;
```

The unique constraint on `(student_id, step_number)` prevents duplicates. Negative numbers cannot
collide with existing positive steps 1-7 during the transition window.

### Milestone Config Impact (CRITICAL — two cascading changes)

After step renumbering, old step 11 (Close 5 Influencers) becomes step 12, and old step 13
(Get Brand Response) becomes step 14.

**src/lib/config.ts MILESTONE_CONFIG:**
```ts
influencersClosedStep: 12,   // was 11
brandResponseStep: 14,       // was 13
// Update SYNC comments to reference new step numbers
```

**Migration 00030 must also rewrite get_coach_milestones** (originally in 00027) to use updated
step_number predicates:
```sql
-- In five_inf CTE:
AND rp.step_number = 12   -- was 11, SYNC: MILESTONE_CONFIG.influencersClosedStep

-- In brand_resp CTE:
AND rp.step_number = 14   -- was 13, SYNC: MILESTONE_CONFIG.brandResponseStep
```

The function signature and all other logic (auth guard, backfill logic, GRANT statements) stay
identical. Only the two step_number predicates change.

**Backfill correctness:** The backfill in 00027 inserted alert_dismissals rows using alert_keys
of the form `milestone_5_influencers:{student_id}` — these keys embed no step number. They remain
valid after renumber. No corrective backfill is needed.

**tech_setup placeholder** in get_coach_milestones uses `step_number = 0` as a no-op. This does
not change.

### Config Array Update

New ROADMAP_STEPS array (16 steps total):

```
Step 1-7:  unchanged (stage 1, Setup & Preparation)
Step 8:    NEW — "Join at least one Influencer Q&A session (CPM + pricing)"
           stage: 1, stageName: "Setup & Preparation", target_days: 5, unlock_url: null
Step 9:    was step 8 (Send Your First Email, stage 2 start, target_days: 14)
Step 10:   was step 9 (Get First Reply)
Step 11:   was step 10 (Close First Influencer)
Step 12:   was step 11 (Close 5 Influencers) — MILESTONE_CONFIG.influencersClosedStep
Step 13:   was step 12 (Enter Brand Outreach, stage 3 start)
Step 14:   was step 13 (Get Brand Response) — MILESTONE_CONFIG.brandResponseStep
Step 15:   was step 14 (Receive First Brand Rejection)
Step 16:   was step 15 (Close First Deal)
```

Stage boundary: new step 8 is the last step of Stage 1 (stage: 1). Stage 2 begins at step 9
(was step 8 "Send Your First Email"). Stage 3 begins at step 13 (was step 12 "Enter Brand
Outreach"). Update the `stage:` and `stageName:` fields on every renumbered entry.

### Hardcoded Step Number Grep Surface

Every occurrence requiring manual review:

| File | Line reference | Current value | Action |
|------|---------------|---------------|--------|
| `src/app/(dashboard)/student/layout.tsx` | `.eq("step_number", 7)` | 7 | No change — step 7 stays step 7 |
| `src/lib/config.ts` | `MILESTONE_CONFIG.influencersClosedStep` | 11 | Change to 12 |
| `src/lib/config.ts` | `MILESTONE_CONFIG.brandResponseStep` | 13 | Change to 14 |
| `src/lib/config.ts` | `ROADMAP_STEPS` array | steps 8-15 | Renumber + insert new step 8 |
| `supabase/migrations/00027_*.sql` | `step_number = 11` in five_inf CTE | 11 | Rewrite in 00030 migration via CREATE OR REPLACE |
| `supabase/migrations/00027_*.sql` | `step_number = 13` in brand_resp CTE | 13 | Rewrite in 00030 migration via CREATE OR REPLACE |

Dynamic references that will self-correct once config is updated (no manual change needed):

- `ROADMAP_STEPS.length` — used for progress bars in student/page.tsx, student/roadmap/loading.tsx;
  becomes 16 automatically
- `ROADMAP_STEPS.map(...)` — used in AnalyticsClient.tsx for roadmap progress display
- `ROADMAP_STEPS.filter(...)` — used in student/roadmap/page.tsx for auto-complete logic

Progress bars displaying "/15" are driven by `{roadmapCompleted}/{ROADMAP_STEPS.length}` — confirmed
dynamic at line 280 of student/page.tsx. Will display "/16" after config update with no string
changes.

---

## Component Boundaries

### Owner Analytics

```
owner/analytics/page.tsx (server component, revalidate: 60)
  └─ unstable_cache(60s, tag:"owner-analytics") → get_owner_analytics RPC
  └─ OwnerAnalyticsClient (client — recharts leaderboard visualization)

owner/page.tsx (server, modified)
  └─ unstable_cache(60s, tag:"owner-dashboard") → get_owner_dashboard_stats (add cache)
  └─ unstable_cache(60s, tag:"owner-analytics") → get_owner_analytics (teaser)
  └─ [existing 4 stat cards — unchanged]
  └─ AnalyticsTeaser — 3 compact leaderboard columns + "View full analytics" Link
```

### Announcements

```
(role)/announcements/page.tsx (4 server files)
  └─ unstable_cache(60s, tag:"announcements") → admin.from("announcements").select(...)
  └─ AnnouncementsClient (client, canCreate prop)
       └─ AnnouncementCard (display + edit/delete for matching author_id)
       └─ AnnouncementForm (owner/coach only, conditional on canCreate)

src/app/api/announcements/route.ts           (GET paginated + POST)
src/app/api/announcements/[id]/route.ts      (PATCH + DELETE)
```

### Roadmap Step 8

No new page or component files. All changes are:
- `src/lib/config.ts` — ROADMAP_STEPS + MILESTONE_CONFIG
- `supabase/migrations/00030_roadmap_step8.sql` — DB renumber + get_coach_milestones rewrite

---

## Data Flow Changes

### Owner Dashboard (before vs after)

```
BEFORE:
  owner/page.tsx → admin.rpc("get_owner_dashboard_stats") [uncached]
  → 4 stat cards

AFTER:
  owner/page.tsx → unstable_cache(60s, "owner-dashboard") → get_owner_dashboard_stats
                → unstable_cache(60s, "owner-analytics")  → get_owner_analytics [new]
  → 4 stat cards + analytics teaser section
```

### Sidebar Badges (before vs after)

```
BEFORE:
  layout.tsx → get_sidebar_badges(userId, role, today, techSetupEnabled)
  → { active_alerts?, unreviewed_reports?, coach_milestone_alerts?, unread_messages? }
  badgeCounts: active_alerts, unreviewed_reports, coach_milestone_alerts, unread_messages

AFTER:
  layout.tsx → get_sidebar_badges(userId, role, today, techSetupEnabled)
  → { active_alerts?, unreviewed_reports?, coach_milestone_alerts? }
  badgeCounts: active_alerts, unreviewed_reports, coach_milestone_alerts
```

### Announcements Cache Invalidation

```
POST   /api/announcements       → revalidateTag("announcements")
PATCH  /api/announcements/[id]  → revalidateTag("announcements")
DELETE /api/announcements/[id]  → revalidateTag("announcements")
```

Single global tag covers all four role pages — announcements are not role-scoped.

---

## Build Order with Dependency Rationale

### Phase A: Owner Analytics (ship first — additive, no blockers)

No table drops, no existing feature disruption, no cross-feature dependencies. The
`get_owner_analytics` RPC reuses indexes from Phase 44 already in production.

Delivery sequence:
1. Migration `00028_get_owner_analytics.sql` — RPC + embedded asserts
2. `src/lib/rpc/owner-analytics-types.ts` + `owner-analytics.ts` — types + cached fetcher
3. `src/app/(dashboard)/owner/analytics/page.tsx` + `OwnerAnalyticsClient` — full analytics page
4. Modify `src/app/(dashboard)/owner/page.tsx` — add unstable_cache + teaser section
5. Modify `src/lib/config.ts` — add ROUTES.owner.analytics + nav entry
6. Add `revalidateTag("owner-analytics")` to `/api/deals/route.ts` and `/api/deals/[id]/route.ts`

### Phase B: Announcements (ship second — atomic swap, moderate risk)

The chat removal and announcements scaffold must be atomic — cannot delete the chat pages without
the announcements pages going live in the same deploy, and cannot drop the messages table without
rewriting get_sidebar_badges in the same migration.

Delivery sequence (all in one phase, single migration):
1. Migration `00029_announcements.sql` — CREATE announcements table + RLS + rewrite
   get_sidebar_badges (remove messages references) + DROP TABLE messages CASCADE
2. New API routes: `/api/announcements/route.ts` + `/api/announcements/[id]/route.ts`
3. New components: `AnnouncementCard`, `AnnouncementForm`, `AnnouncementsClient`
4. New pages: owner, coach, student, student_diy announcements pages
5. Modify `src/lib/config.ts` — swap Chat for Announcements in NAVIGATION and ROUTES
6. Modify `src/app/(dashboard)/layout.tsx` — remove unread_messages badge block
7. Modify `src/lib/rpc/types.ts` — remove unread_messages from SidebarBadgesResult
8. Modify `src/lib/types.ts` — remove messages table type block
9. Delete: all chat page files, all api/messages files, all components/chat files, chat-utils.ts

The deletion of chat files and the migration dropping messages MUST ship together. If the migration
runs before chat pages are deleted, chat pages will 500 (table missing). If chat pages are deleted
before the migration, get_sidebar_badges still references the messages table causing the sidebar
to error.

### Phase C: Roadmap Step 8 (ship last — data migration, highest risk)

This migration touches all existing students' roadmap_progress rows and rewrites
get_coach_milestones (validated with 9 embedded asserts in v1.5). Doing this last means
Phases A and B are stable before touching the most sensitive migration.

Delivery sequence:
1. Migration `00030_roadmap_step8.sql` — negative-shift renumber + auto-complete INSERT +
   CREATE OR REPLACE get_coach_milestones with updated step predicates + re-issue GRANTs +
   embedded asserts
2. Modify `src/lib/config.ts` — ROADMAP_STEPS array (new step 8, renumber 8-15 to 9-16) +
   MILESTONE_CONFIG (influencersClosedStep: 12, brandResponseStep: 14)
3. Verify no remaining hardcoded step numbers using the grep surface table above
4. Build gate: `npm run lint && npx tsc --noEmit && npm run build`

---

## Pitfall: get_coach_milestones Rewrite in Phase C

The 00027 migration has 9 embedded assert blocks, some of which temporarily modify live data
(ASSERTs 4, 7 — they DELETE/UPDATE roadmap_progress rows and restore them within the DO block).
The 00030 migration must use `CREATE OR REPLACE`, not `DROP + CREATE`, to avoid any window where
the function does not exist. `CREATE OR REPLACE` on a SECURITY DEFINER function preserves grants
on Supabase (verified pattern from 00025/00026 which used the same approach). Re-issuing the
`GRANT EXECUTE` lines in 00030 is harmless and makes the migration self-contained.

The backfill in 00027 used `step_number = 11` and `step_number = 13` in INSERT statements. After
the renumber migration runs in 00030, those DB rows are at step 12 and 14. The alert_dismissals
rows produced by the 00027 backfill use keys like `milestone_5_influencers:{student_id}` — no
step number in the key. They remain valid after renumber. The only correction needed is the RPC
scan predicate, which is handled by the `CREATE OR REPLACE` in 00030.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Owner Analytics RPC shape | HIGH | Direct inspection of get_coach_analytics and get_coach_dashboard patterns in 00024 and 00025 |
| Owner dashboard teaser integration | HIGH | Direct inspection of owner/page.tsx (uncached, 4 stat cards) |
| Index coverage for owner analytics | HIGH | 00021_analytics_foundation.sql confirmed both indexes exist with correct filters |
| Announcements DDL and RLS | HIGH | Direct inspection of 00015 messages DDL and 00027 RLS policy patterns |
| Chat removal surface | HIGH | All files confirmed by ls and grep; no hidden chat references outside listed files |
| get_sidebar_badges rewrite scope | HIGH | 00027 SQL read in full; messages table referenced in coach branch (lines 282-285) and student branch (lines 300-308) |
| Atomic renumber SQL | HIGH | Standard Postgres pattern; negative-shift avoids unique constraint violation during transition |
| Milestone config renumber impact | HIGH | MILESTONE_CONFIG.influencersClosedStep and brandResponseStep confirmed hardcoded in config and in 00027 SQL |
| Cache tag strategy | HIGH | Matches existing revalidateTag patterns verified in api/deals/route.ts |
| Build order rationale | HIGH | Dependency analysis from direct file inspection; Phase B atomicity requirement verified by examining messages table references in get_sidebar_badges |
