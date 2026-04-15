# Stack Research — Milestone v1.6

**Domain:** Student coaching platform — adding owner analytics leaderboards, replacing chat with announcements, and inserting a new roadmap step with atomic renumber.
**Researched:** 2026-04-15 (v1.6 — narrow scope: verify existing stack covers all three features; identify any net-new deps)
**Overall confidence:** HIGH — all critical findings verified against direct codebase inspection (package.json, migrations, RPC patterns, config.ts).

---

## Milestone Scope Context

v1.6 extends the same production-validated stack as v1.5. Three features:

1. **Owner Analytics** — `/owner/analytics` with 3 top-3 leaderboards (hours this week, profit all-time, deals all-time) + teaser stat cards on owner homepage
2. **Announcements replacing Chat** — remove `messages` table + all chat routes/UI/nav, add `announcements` table with owner+coach CRUD, all students read-only, paginated 25/page
3. **Roadmap Step 8 insertion** — insert new step at end of Stage 1, renumber existing steps 8–15 → 9–16 atomically, auto-complete new step for qualifying students

**Bottom line: ZERO new runtime dependencies required for v1.6.**

All three features are served by the existing stack. The detailed rationale follows.

---

## Net Change to package.json

| Action | Package | Version | Justification |
|--------|---------|---------|---------------|
| **None** | — | — | All v1.6 features covered by existing deps |

**Do NOT add:**
- Any rich-text editor (Tiptap, Quill, Slate, ProseMirror) — announcements use plain `<textarea>`, 2000-char cap
- Any new chart library — recharts@^3.8.1 already installed and backs all leaderboard rendering
- Any real-time library (Supabase Realtime, Socket.io, Pusher) — announcements are read-on-page-load, not push
- Any migration runner beyond the existing `supabase db push` workflow — Supabase CLI (`supabase@^2.78.1` in devDeps) already handles atomic SQL migrations
- Any ORM or schema diffing tool (Prisma, Drizzle) — hand-written SQL migrations are the established pattern

---

## Feature 1: Owner Analytics

### What the existing stack covers

| Need | Existing asset | Status |
|------|---------------|--------|
| Leaderboard RPC (hours, deals, profit) | `get_coach_analytics` (migration 00025) has the exact same 3-leaderboard pattern scoped to a coach's students | Pattern is the template; write a new `get_owner_analytics` RPC scoped to ALL active students |
| Batch RPC + 60s cache | `unstable_cache` + `coachAnalyticsTag()` pattern in `src/lib/rpc/coach-analytics.ts` | Copy pattern verbatim; create `src/lib/rpc/owner-analytics.ts` |
| Leaderboard chart rendering | `recharts@^3.8.1` already installed | Reuse existing `recharts` imports and `src/lib/chart-colors.ts` constants |
| Teaser stat cards on owner homepage | Owner homepage `src/app/(dashboard)/owner/page.tsx` already renders 4 CVA stat cards | Add 3 more teaser cards (top student by hours, profit, deals) and a "View Analytics" CTA link |
| Auth + role guard | `requireRole("owner")` already used on every owner page | Use same call |
| Admin client singleton | `createAdminClient()` in `src/lib/supabase/admin.ts` | Same pattern |
| RPC types file | `src/lib/rpc/types.ts` + per-feature types files | Create `src/lib/rpc/owner-analytics-types.ts` mirroring `coach-analytics-types.ts` |

### New RPC design

```sql
-- New migration: 00028_get_owner_analytics.sql
CREATE OR REPLACE FUNCTION public.get_owner_analytics(
  p_today             date    DEFAULT CURRENT_DATE,
  p_leaderboard_limit int     DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
```

Returns one envelope `{ leaderboards: { hours_week, profit_alltime, deals_alltime } }`.

- **hours_week** — `SUM(work_sessions.duration_minutes)` for the current Mon–Sun week (reuse `date_trunc('week', p_today)` pattern from 00025)
- **profit_alltime** — `SUM(deals.profit)` lifetime per student across ALL active students (no coach scope filter — this is the key difference from coach analytics)
- **deals_alltime** — `COUNT(deals.*)` lifetime per student

**Authorization pattern (same as get_coach_analytics):** `SECURITY DEFINER` + `GRANT EXECUTE TO service_role, authenticated`. No in-function auth guard needed because (a) the admin client always sets `auth.uid() IS NULL` and (b) the Next.js page has already called `requireRole("owner")`.

**Indexes already in place** (migration 00021):
- `idx_deals_student_created` covers `deals(student_id, created_at)` — profit/deals leaderboard queries hit this
- `idx_work_sessions_completed_student_date` covers `work_sessions(student_id, date) WHERE status='completed'` — hours leaderboard hits this

No new indexes needed.

### Cache tag

Use `owner-analytics` (static tag — owner has no scoping, unlike coach-per-coachId). `revalidateTag("owner-analytics")` from deal mutation routes (`/api/deals` POST/PATCH/DELETE) and work-session completion (`/api/work-sessions/[id]` PATCH) when status → `completed`.

---

## Feature 2: Announcements replacing Chat

### Removal checklist (no new stack needed, pure deletion)

| Asset to remove | Location |
|----------------|----------|
| Chat page routes | `src/app/(dashboard)/coach/chat/page.tsx`, `src/app/(dashboard)/student/chat/page.tsx` |
| Messages API routes | `src/app/api/messages/route.ts`, `src/app/api/messages/read/route.ts` |
| Chat utility file | `src/lib/chat-utils.ts` (verify existence; imported by messages route) |
| `messages` table | Drop in new migration |
| Sidebar nav entries | `NAVIGATION` in `src/lib/config.ts` — remove `{ label: "Chat", href: "/coach/chat", ... }` (coach) and `{ label: "Chat", href: "/student/chat", ... }` (student) |
| `unread_messages` badge key | `get_sidebar_badges` RPC — strip from coach + student + owner branches |
| Route guard entries | `src/proxy.ts` — if `/coach/chat` and `/student/chat` are allowlisted, remove them |
| `SidebarBadgesResult.unread_messages` | `src/lib/rpc/types.ts` — remove the field |
| `ROUTES.coach.chat` and `ROUTES.student.chat` | `src/lib/config.ts` |

### New announcements table

```sql
CREATE TABLE public.announcements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      varchar(255) NOT NULL,
  body       text         NOT NULL CHECK (char_length(body) <= 2000),
  created_by uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);
```

**Design decisions (plain text, no expiry, no per-role scoping on the row itself):**
- Plain `text` column, no markdown or HTML — page renders in `<p>` with `whitespace-pre-wrap`. No rich text editor dep needed.
- No `expires_at` column — per requirement "no expiry". If expiry is ever needed, add a nullable column later.
- No `role` or `audience` column — all announcements are visible to all roles. Access is controlled by RLS + the API route, not by a discriminator column.
- `CHECK (char_length(body) <= 2000)` mirrors the existing `messages.content` cap in the removed table.

**RLS policies:**
- `SELECT`: all authenticated users (owner, coach, student, student_diy)
- `INSERT`: authenticated user whose role is `owner` OR `coach`
- `UPDATE`: authenticated user who is `created_by` AND role is `owner` or `coach`
- `DELETE`: same as UPDATE

All policies use `(SELECT auth.uid())` initplan pattern per v1.5 D-03.

**Indexes:**
- `CREATE INDEX idx_announcements_created_at ON public.announcements(created_at DESC)` — pagination query is `ORDER BY created_at DESC LIMIT 25 OFFSET n`

### API routes

| Route | Method | Who | Body | Pattern |
|-------|--------|-----|------|---------|
| `/api/announcements` | GET | all roles | — | No rate limit (read), auth + role check, `?page=1&page_size=25` |
| `/api/announcements` | POST | owner, coach | `{ title, body }` | CSRF + rate limit + Zod safeParse — mirrors `/api/resources/route.ts` exactly |
| `/api/announcements/[id]` | PATCH | creator only | `{ title?, body? }` | CSRF + rate limit + Zod + ownership check — mirrors `/api/glossary/[id]/route.ts` |
| `/api/announcements/[id]` | DELETE | creator only | — | CSRF + rate limit + ownership check |

**Zod schemas (no new deps — `import { z } from "zod"`):**
```ts
const createSchema = z.object({
  title: z.string().min(1).max(255),
  body:  z.string().min(1).max(2000),
});
const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  body:  z.string().min(1).max(2000).optional(),
}).refine(d => d.title !== undefined || d.body !== undefined);
```

### `get_sidebar_badges` RPC update

The migration that drops `messages` must also `CREATE OR REPLACE FUNCTION public.get_sidebar_badges` with the `unread_messages` branches removed from:

1. Coach branch — remove the `v_unread_count` computation and the `'unread_messages', v_unread_count` field in the returned JSONB
2. Student branch — remove the entire `IF p_role = 'student'` block (it only returned `unread_messages`) and replace with `RETURN '{}'::jsonb` (student_diy already returns empty object)
3. Owner branch — remove `'unread_messages', 0` from the returned JSONB

**The coach_milestone_alerts and unreviewed_reports fields are UNAFFECTED.**

### No polling, no realtime needed

Chat was polling at 5s. Announcements are fetched once on page load (server component). No polling infrastructure to build or remove. This simplifies the codebase.

### Per-role `/announcements` page

| Role | Page path | Capabilities |
|------|-----------|--------------|
| owner | `/owner/announcements` | List (read) + Create + Edit own + Delete own |
| coach | `/coach/announcements` | List (read) + Create + Edit own + Delete own |
| student | `/student/announcements` | List (read) only |
| student_diy | `/student_diy/announcements` | List (read) only |

All four pages share a single server component for the list (passes `canWrite: boolean` prop). Owner + coach see a "New Announcement" button. Edit/Delete buttons visible only on rows where `created_by === currentUser.id`.

**Navigation updates to `NAVIGATION` in `src/lib/config.ts`:**
- Remove `{ label: "Chat", href: "/coach/chat", icon: "MessageSquare", badge: "unread_messages", separator: true }` from coach nav
- Remove `{ label: "Chat", href: "/student/chat", icon: "MessageSquare", badge: "unread_messages" }` from student nav
- Add `{ label: "Announcements", href: "/coach/announcements", icon: "Megaphone" }` to coach nav (after Alerts, before Resources — separator before Resources stays)
- Add `{ label: "Announcements", href: "/student/announcements", icon: "Megaphone" }` to student nav
- Add `{ label: "Announcements", href: "/student_diy/announcements", icon: "Megaphone" }` to student_diy nav
- Add `{ label: "Announcements", href: "/owner/announcements", icon: "Megaphone" }` to owner nav (after Alerts, before Resources)

**ROUTES config additions:**
```ts
owner:   { ..., announcements: "/owner/announcements" }
coach:   { ..., announcements: "/coach/announcements" }
student: { ..., announcements: "/student/announcements" }
student_diy: { ..., announcements: "/student_diy/announcements" }
```

---

## Feature 3: Roadmap Step 8 Insertion

This is the most technically sensitive feature. The core challenge is the atomic renumber: inserting a new step 8 at the END of Stage 1 and renumbering existing database rows for steps 8–15 → 9–16 without violating the `UNIQUE(student_id, step_number)` constraint on `roadmap_progress`.

### Migration strategy: two-phase UPDATE within a single transaction

**Why NOT deferred constraints:**
Supabase Postgres migrations run as implicit transactions via `supabase db push`. Adding `SET CONSTRAINTS ALL DEFERRED` within a migration is supported in Postgres, but requires the unique constraint to be declared `DEFERRABLE INITIALLY IMMEDIATE` — modifying the existing constraint (from 00001) in this migration adds complexity and rollback risk.

**Recommended approach: shift up to a safe offset, then shift back — all in one transaction.**

```sql
BEGIN;

-- Step 1: Expand the CHECK constraint from 1..15 to 1..16
ALTER TABLE public.roadmap_progress
  DROP CONSTRAINT IF EXISTS roadmap_progress_step_number_check;
ALTER TABLE public.roadmap_progress
  ADD CONSTRAINT roadmap_progress_step_number_check CHECK (step_number BETWEEN 1 AND 16);

-- Step 2: Shift existing steps 8–15 up by 100 (avoids unique collision with 9–16)
UPDATE public.roadmap_progress
  SET step_number = step_number + 100
WHERE step_number BETWEEN 8 AND 15;

-- Step 3: Shift them back to 9–16
UPDATE public.roadmap_progress
  SET step_number = step_number - 91
WHERE step_number BETWEEN 108 AND 115;

-- Step 4: Insert the new step 8 row for every student who does NOT already have one
INSERT INTO public.roadmap_progress (student_id, step_number, step_name, status, completed_at)
SELECT
  s.id,
  8,
  'Join at least one Influencer Q&A session',
  CASE
    -- Students past old Step 7 (now have completed step 8 in new numbering, i.e. old 7)
    -- Auto-complete: if student has completed what is now step 8 (old step 7), mark as completed
    WHEN EXISTS (
      SELECT 1 FROM public.roadmap_progress rp
      WHERE rp.student_id = s.id
        AND rp.step_number = 9  -- old step 8 is now step 9 (first of stage 2)
        AND rp.status IN ('completed', 'active')
    ) THEN 'completed'
    WHEN EXISTS (
      SELECT 1 FROM public.roadmap_progress rp
      WHERE rp.student_id = s.id
        AND rp.step_number = 8  -- wait, this is the row we're inserting...
    ) THEN 'active'  -- this branch never fires (ON CONFLICT handles it)
    ELSE 'locked'
  END,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.roadmap_progress rp
      WHERE rp.student_id = s.id
        AND rp.step_number = 9
        AND rp.status IN ('completed', 'active')
    ) THEN now()
    ELSE NULL
  END
FROM public.users s
WHERE s.role IN ('student', 'student_diy')
  AND s.status = 'active'
ON CONFLICT (student_id, step_number) DO NOTHING;

COMMIT;
```

**Why this approach:**

| Approach | Risk | Why rejected / accepted |
|----------|------|------------------------|
| Deferred UNIQUE constraint | Requires altering constraint definition in the same migration; adds schema diff complexity | Rejected — adds rollback complexity |
| Single UPDATE with `step_number = step_number + 1` in step order | Unique violation: when row with step=8 exists and you update it to 9, but step=9 already exists | Rejected — fails even in a transaction |
| Two-phase shift (100 offset, then back) | None — offset of 100 is safely outside 1–16; no collision possible | **Accepted** |
| CTE with RETURNING + re-INSERT | Requires DELETE + INSERT, loses `created_at` / `completed_at` history | Rejected — data loss |

**Auto-complete logic for new step 8:**
Per the requirement: "auto-complete new step for students past old Step 7". After renumbering, "past old Step 7" means the student has a row at new step_number = 9 (formerly step 8, "Send Your First Email") with status `completed` or `active`. If so, set new step 8 to `completed` with `completed_at = now()`.

**Step name update:**
After the renumber, update `step_name` for steps 9–16 to match the current config titles (the step_name column is a cache of the config title; the source of truth is `ROADMAP_STEPS` in config.ts). Do this with targeted `UPDATE … WHERE step_number = N` statements, mirroring the pattern in migration 00008.

### Config updates

`src/lib/config.ts` ROADMAP_STEPS array must be updated:

1. **Insert new step** at index 7 (0-based) — between current step 7 and step 8:
```ts
{ step: 8, stage: 1, stageName: "Setup & Preparation",
  title: "Join at least one Influencer Q&A session",
  description: "Join at least one Influencer Q&A session (CPM + pricing) (target_days: 5)",
  target_days: 5, unlock_url: null }
```

2. **Renumber existing entries** — steps 8–15 become 9–16 with their stage/stageName values unchanged (Stage 2 starts at step 9, Stage 3 starts at step 13).

3. **Update MILESTONE_CONFIG step references** — this is a critical SYNC point:
```ts
// Before (v1.5):
influencersClosedStep: 11,   // "Close 5 Influencers" — step 11 in old numbering
brandResponseStep: 13,       // "Get Brand Response" — step 13 in old numbering

// After (v1.6):
influencersClosedStep: 12,   // "Close 5 Influencers" — step 12 in new numbering
brandResponseStep: 14,       // "Get Brand Response" — step 14 in new numbering
```

**Failure to update these fields will cause the coach milestone notification RPC (`get_coach_milestones`) to check the wrong step numbers.** This is a silent data-logic bug — no TypeScript error, no lint warning. Must be caught by grep + human review.

4. **Update progress bars from /15 to /16** — every place that renders `step N of 15` becomes `step N of 16`. Grep pattern: `of 15`, `/ 15`, `ROADMAP_STEPS.length` (this is the safe pattern — use `ROADMAP_STEPS.length` throughout instead of hardcoded `15`).

### Hardcoded step number audit

Run before and after the migration:

```bash
grep -r "step.*15\|15.*step\|length.*15\|= 15\b" src/ --include="*.ts" --include="*.tsx"
grep -rn "influencersClosedStep\|brandResponseStep\|techSetupStep" src/
grep -rn "step_number.*11\|step_number.*13" supabase/
```

Files known to contain step-count references (from v1.3 Phase 25 which did the same kind of update):
- `src/app/(dashboard)/student/roadmap/page.tsx` (progress bar)
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` (roadmap tab)
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` (roadmap tab)
- `src/lib/config.ts` (ROADMAP_STEPS, MILESTONE_CONFIG)
- Any migration that hardcodes `step_number = 11` or `step_number = 13` for milestone checks

The `get_coach_milestones` RPC in migration 00027 likely references step numbers directly — **read 00027 before writing 00028** and update the milestone step references there too or supersede the function in the new migration.

---

## Existing Stack Coverage Summary

| v1.6 Need | Existing asset | New dep needed? |
|-----------|---------------|-----------------|
| Leaderboard charts (Feature 1) | `recharts@^3.8.1` installed | NO |
| Batch RPC + 60s cache (Feature 1) | `unstable_cache`, `createAdminClient()`, `src/lib/rpc/` pattern | NO |
| Owner RPC (Feature 1) | New SQL function in new migration — no library | NO |
| Plain text CRUD (Feature 2) | Zod 4.3.6, admin client, existing route handler pattern | NO |
| Announcements table (Feature 2) | New SQL in new migration — mirrors resources/glossary tables | NO |
| Paginated list (Feature 2) | Existing server-side pagination pattern (v1.2) | NO |
| Chat removal (Feature 2) | Delete files + SQL DROP TABLE | NO |
| Sidebar badge strip (Feature 2) | `CREATE OR REPLACE FUNCTION get_sidebar_badges` in new migration | NO |
| Roadmap step renumber (Feature 3) | SQL migration with two-phase UPDATE | NO |
| Config step update (Feature 3) | Edit `src/lib/config.ts` directly | NO |
| Milestone step ref update (Feature 3) | Edit `src/lib/config.ts` + supersede `get_coach_milestones` RPC | NO |

---

## Integration Gotchas

### Gotcha 1: `get_coach_milestones` RPC step numbers

Migration 00027 (`get_coach_milestones`) references `roadmap_progress.step_number` values for `influencersClosedStep` (11) and `brandResponseStep` (13). After the renumber, these are wrong (should be 12 and 14). The v1.6 migration that performs the renumber MUST also `CREATE OR REPLACE FUNCTION public.get_coach_milestones` with the corrected step numbers, OR the v1.6 roadmap migration must be sequenced BEFORE any migration that ships the updated coach milestones RPC.

**Sequence constraint:** migration 00028 (or whichever does the renumber) must include a `CREATE OR REPLACE` of `get_coach_milestones` to keep step references in sync, or the roadmap migration and the milestones-RPC fix must ship in the same transaction.

### Gotcha 2: `roadmap_progress.step_number` CHECK constraint

The current constraint is `CHECK (step_number BETWEEN 1 AND 15)` (set in migration 00008). This MUST be dropped and recreated as `BETWEEN 1 AND 16` BEFORE the renumber UPDATE that produces step_number = 16. Doing it after will fail. The two-phase approach above does this first.

### Gotcha 3: Announcements content — plain text, not markdown

The milestone context says "plain textarea is fine". Confirming: do NOT add a markdown renderer (`react-markdown`, `marked`, `remark`). Render `body` with CSS `whitespace-pre-wrap` in a `<p>` or `<div>` to preserve newlines. This avoids XSS vectors, bundle bloat, and a new dependency entirely.

### Gotcha 4: `unread_messages` TypeScript type

`src/lib/rpc/types.ts` exports `SidebarBadgesResult` with `unread_messages?: number`. When removing chat, delete this field. Any code reading `badges.unread_messages` will then produce a TypeScript error at compile time — this is the desired behavior, as it surfaces all remaining usages that need cleanup.

### Gotcha 5: proxy.ts route allowlist

If `src/proxy.ts` has explicit allowlist entries for `/coach/chat` or `/student/chat`, they must be removed to avoid 404 routes being publicly accessible. Check proxy.ts before closing the phase.

### Gotcha 6: `ROUTES` config and `NAVIGATION` MUST stay in sync

The announcements routes must be added to both `ROUTES` and `NAVIGATION` in `config.ts`. Using `ROUTES.owner.announcements` inside the `NAVIGATION` literal (same pattern as `ROUTES.owner.resources`) prevents the two from drifting.

### Gotcha 7: `student_diy` auto-complete for roadmap step 8

`student_diy` role uses the same `roadmap_progress` table. The INSERT in the migration uses `WHERE s.role IN ('student', 'student_diy')`. The auto-complete logic (check step 9 status) also applies to `student_diy` students. Confirm the migration handles both roles — the `users` table `role` CHECK constraint already includes `student_diy` (added in migration 00015).

---

## Validation (post-phase gate)

For each v1.6 phase, the gate is:
```bash
npm run lint && npx tsc --noEmit && npm run build
```

For the roadmap renumber migration specifically, add embedded migration-time assertions (same pattern as migration 00025):
```sql
-- Assert: exactly 16 distinct step_number values exist for any active student with full roadmap
DO $$ DECLARE v_max int; BEGIN
  SELECT MAX(step_number) INTO v_max FROM roadmap_progress;
  ASSERT v_max = 16, format('expected max step 16, got %s', v_max);
END $$;

-- Assert: no student has two rows with the same step_number
DO $$ DECLARE v_dup int; BEGIN
  SELECT COUNT(*) INTO v_dup FROM (
    SELECT student_id, step_number, COUNT(*) FROM roadmap_progress
    GROUP BY student_id, step_number HAVING COUNT(*) > 1
  ) t;
  ASSERT v_dup = 0, format('duplicate (student, step) rows found: %s', v_dup);
END $$;
```

---

## Sources

- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\package.json` — dependency versions confirmed
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\src\lib\config.ts` — ROADMAP_STEPS (15 steps), MILESTONE_CONFIG step refs (11, 13), NAVIGATION (chat entries), ROUTES
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00025_get_coach_analytics.sql` — leaderboard RPC pattern
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00017_chat_badges.sql` — full get_sidebar_badges with unread_messages branches
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00008_expand_roadmap_to_15_steps.sql` — prior roadmap expansion pattern
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\supabase\migrations\00015_v1_4_schema.sql` — messages table schema
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\src\lib\rpc\coach-analytics.ts` — unstable_cache + tag pattern
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\src\lib\rpc\types.ts` — SidebarBadgesResult type
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\src\app\api\messages\route.ts` — chat route pattern to be removed
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\.planning\PROJECT.md` — v1.6 scope, key decisions, milestone context
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\.planning\MILESTONES.md` — v1.5 shipped summary
- Direct inspection: `C:\Users\ibrah\ima-accelerator-v1\CLAUDE.md` — hard rules (Zod import, ima-* tokens, rate limiting, admin client)

---

*Stack research for: IMA Accelerator v1.6 — Owner Analytics, Announcements & Roadmap Update*
*Researched: 2026-04-15*
