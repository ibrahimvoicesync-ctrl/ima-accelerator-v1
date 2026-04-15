# Pitfalls Research — Milestone v1.6

**Domain:** Owner Analytics (Leaderboards), Chat Removal + Announcements Replacement, Roadmap Step Insert + Atomic Renumber
**Researched:** 2026-04-15
**Confidence:** HIGH — grounded in this specific codebase: v1.5 RETROSPECTIVE lessons, migration files 00015–00027, exact SQL RPC bodies, config.ts ROADMAP_STEPS, NAVIGATION map, get_sidebar_badges signature history, and Phase 53 tag-staleness postmortem.

Each pitfall maps to a specific phase concern and includes a concrete grep/SQL/assertion to verify prevention. Phase numbers are placeholders (54, 55, 56) aligned with the v1.6 sequential build order; the planner assigns final numbers.

---

## Feature 1: Owner Analytics — TOP-N LEADERBOARDS at 5k scale

### Pitfall 1-A: No supporting index on the leaderboard ORDER BY column

**What goes wrong:**
`SELECT student_id, SUM(profit) FROM deals GROUP BY student_id ORDER BY SUM(profit) DESC LIMIT 3` does a full table scan of `deals` at 5k students × N deals each. At the v1.2 Phase 24 stress envelope (5k students, Pro Small) this adds 200–400ms to the owner analytics RPC — enough to push P95 above 1s.

**Why it happens:**
The coach analytics RPC in 00025/00026 only added indexes for `deals` keyed on `(student_id, created_at)` (Phase 44: `idx_deals_student_created`). That index helps time-windowed queries but does NOT help a platform-wide SUM(profit) / SUM(revenue) / COUNT(*) grouping that spans all time.

**Consequences:**
Owner analytics page exceeds the 1s P95 threshold. The existing `idx_deals_student_created` will be chosen by the planner only for filtered queries; a GROUP BY all students with no date filter forces a seq scan or uses only the primary key index.

**Prevention:**
For profit/revenue leaderboard: verify that `EXPLAIN (ANALYZE, BUFFERS)` shows an Index Scan on `idx_deals_student_created` (or a purpose-built covering index). If the planner does a seq scan on `deals`, add `CREATE INDEX idx_deals_profit_student ON deals(student_id, profit DESC)` in the v1.6 analytics migration.

For hours leaderboard (work_sessions): the existing `idx_work_sessions_completed_student_date` covers `(student_id, status, date)`. A platform-wide all-time hours sum without a date filter will NOT use that partial index. Add `CREATE INDEX idx_work_sessions_completed_student ON work_sessions(student_id) WHERE status = 'completed'` if the query is unbounded by date.

**Detection / Verification:**
```sql
-- Run in Supabase SQL editor after migration ships:
EXPLAIN (ANALYZE, BUFFERS)
SELECT student_id, SUM(profit) as total_profit
FROM deals
GROUP BY student_id
ORDER BY total_profit DESC
LIMIT 3;
-- FAIL if plan shows "Seq Scan on deals" with estimated rows > 1000
```

**Phase:** v1.6 Owner Analytics (Phase 54). Index declarations must be in the same migration as the RPC.

---

### Pitfall 1-B: Ties silently drop names — LIMIT 3 without deterministic tiebreak

**What goes wrong:**
`ORDER BY SUM(profit) DESC LIMIT 3` when two students share the same profit total causes PostgreSQL to return an arbitrary subset. On rerenders (60s cache bust), the same leaderboard shows different students, which looks broken to the owner. At 5k students the probability of exact ties in integer deal counts is non-trivial.

**Why it happens:**
The coach analytics RPC in migration 00026 already solved this for its leaderboards:
```sql
ROW_NUMBER() OVER (ORDER BY minutes DESC, LOWER(student_name) ASC)::int AS rank
```
The tiebreak is `LOWER(student_name) ASC`. The owner analytics RPC must copy this pattern — it's easy to forget the secondary sort when writing a new RPC.

**Consequences:**
Leaderboard order flips on every cache expiry (60s), giving an illusion that rankings are unstable or that the page is buggy.

**Prevention:**
Every ORDER BY in the owner analytics RPC leaderboard CTEs must have a secondary `LOWER(student_name) ASC` tiebreak. Use `ROW_NUMBER() OVER (ORDER BY <metric> DESC, LOWER(student_name) ASC)` not a bare `ORDER BY <metric> DESC LIMIT 3`.

**Detection / Verification:**
```bash
# Grep the new owner analytics migration for LIMIT without a tiebreak:
grep -n "ORDER BY.*DESC" supabase/migrations/000XX_owner_analytics*.sql \
  | grep -v "student_name\|LOWER"
# Should return zero lines for leaderboard CTEs.
```

**Phase:** v1.6 Owner Analytics migration.

---

### Pitfall 1-C: Nullable profit field sorts students with null profit as bottom — or breaks ORDER BY entirely

**What goes wrong:**
`deals.profit` is a Postgres `numeric` column that is NOT NULL in the schema (00015 creates it as `NOT NULL DEFAULT 0`... but the Zod schema has `profitMin: 0` and the PATCH route allows `profit` to be optional). If profit was ever 0-filled as a placeholder, `SUM(profit) = 0` for students with no real profit lands them equally at the bottom. More critically: if any migration ever allowed NULL, `ORDER BY SUM(profit) DESC` puts NULLs last by default in Postgres (NULLS LAST is the default for DESC), which is correct — but `COALESCE(SUM(profit), 0)` must be used or a student with no deals at all (NULL from LEFT JOIN aggregate) disappears from the denominator.

**Why it happens:**
The owner analytics page adds a profit leaderboard that coach analytics does NOT have (coach analytics only does hours, emails, deals count). This is a new aggregation path. A JOIN-less approach is safe but a `LEFT JOIN` approach requires explicit `COALESCE`.

**Consequences:**
Students with zero deals appear in the leaderboard as rank 1 if the COALESCE is omitted and the NULL sorts unexpectedly, OR they disappear entirely if filtered to `> 0` without adding an explicit zero-deals empty state.

**Prevention:**
Always wrap deal aggregations in `COALESCE(SUM(profit), 0)` even for a HAVING-filtered leaderboard. The coach dashboard RPC (00024) already does this for `COALESCE(SUM(ws.duration_minutes), 0)` — copy that pattern.

**Detection / Verification:**
```sql
-- Confirm no NULL profits in leaderboard result with test data having one student with zero deals:
SELECT COALESCE(SUM(profit), 0) FROM deals WHERE student_id = '<student-with-no-deals>';
-- Must return 0, not NULL.
```

**Phase:** v1.6 Owner Analytics migration. Also verify in TypeScript: `total_profit: number` (not `number | null`) in the RPC type definition.

---

### Pitfall 1-D: Stale cache when mutations land — incomplete mutation-to-invalidation map for 3 metrics

**What goes wrong:**
The owner analytics page uses `unstable_cache` with a 60s TTL. If a deal INSERT, PATCH, or DELETE lands but the owner analytics cache tag is not invalidated, the leaderboard shows stale rankings for up to 60 seconds after a real change. This is the exact failure mode that caused the v1.5 Phase 53 gap: work-sessions PATCH was not busting the coach dashboard tag.

**Full mutation-to-invalidation map for the 3 ranked metrics:**

| Mutation Route | Metric Affected | Tag That Must Be Invalidated |
|---|---|---|
| `POST /api/deals` (student creates deal) | profit, deals count | `owner-analytics` |
| `PATCH /api/deals/[id]` (student/coach edits deal) | profit, deals count | `owner-analytics` |
| `POST /api/deals` (coach logs deal for student) | profit, deals count | `owner-analytics` |
| `PATCH /api/work-sessions/[id]` with `status=completed` | hours | `owner-analytics` |
| `POST /api/work-sessions` (session started — NOT completed yet) | NOT affected — leaderboard counts completed only | skip |
| `DELETE /api/deals/[id]` (if a delete route ever exists) | profit, deals count | `owner-analytics` |

**Why it happens:**
The existing `/api/deals/route.ts` already fires `revalidateTag(coachDashboardTag(...))` and `revalidateTag(coachAnalyticsTag(...))` but there is no owner-scoped analytics tag yet. The owner analytics page is new in v1.6 — its cache tag does not exist in the codebase and no mutation route busts it.

**Consequences:**
Owner sees deal leaderboard frozen for 60s after a student logs a deal. At demo time with live data, this looks like a bug.

**Prevention:**
1. Define `ownerAnalyticsTag = () => "owner-analytics"` in a new `src/lib/rpc/owner-analytics-types.ts` (mirroring `coachAnalyticsTag`, `coachDashboardTag`).
2. Add `revalidateTag(ownerAnalyticsTag())` calls to every mutation route listed above.
3. The owner analytics tag is NOT scoped per-user because there is only one owner; a global tag is correct.

**Detection / Verification:**
```bash
# After implementing: confirm every deals mutation route busts owner-analytics:
grep -rn "owner-analytics\|ownerAnalyticsTag" src/app/api/deals/
# Must appear in route.ts AND [id]/route.ts

# Confirm work-sessions PATCH also busts it:
grep -n "owner-analytics\|ownerAnalyticsTag" src/app/api/work-sessions/\[id\]/route.ts
```

**Phase:** v1.6 Owner Analytics. The tag must be defined and wired before shipping the cached page.

---

## Feature 2: Chat Removal + Announcements Replacement

### Pitfall 2-A: get_sidebar_badges still queries the dropped `messages` table

**What goes wrong:**
Migration drops `messages` table. But `get_sidebar_badges` (migration 00027, currently the live function) still has:
```sql
SELECT count(*) INTO v_unread_count FROM messages WHERE coach_id = p_user_id ...
SELECT count(*) INTO v_unread_count FROM messages m JOIN users u ...
```
After `DROP TABLE messages`, every sidebar render for every role throws a runtime error because the RPC body references a non-existent table. The dashboard layout crashes for all users simultaneously.

**Why it happens:**
`DROP TABLE messages` is a DDL statement that takes effect immediately, but the RPC body is stored as text and compiled at runtime. The function body survives the drop and fails with "relation 'messages' does not exist" on next execution.

**Consequences:**
Complete sidebar failure for all coach and student roles. Because `get_sidebar_badges` is called in `(dashboard)/layout.tsx` for every dashboard page, this breaks the entire app for every logged-in user.

**Prevention:**
The migration that drops `messages` MUST in the same transaction (a) rewrite `get_sidebar_badges` to remove the `unread_messages` branch and (b) drop the `messages` table AFTER the function rewrite. Order in the migration file:
1. `CREATE OR REPLACE FUNCTION get_sidebar_badges` — new body with `unread_messages` removed, `announcements_unread` added if needed
2. `DROP TABLE IF EXISTS messages CASCADE`

Never split these into separate migrations and never drop the table before rewriting the function.

**Detection / Verification:**
```bash
# After migration: confirm get_sidebar_badges body no longer references messages:
grep -n "messages" supabase/migrations/000XX_announcements*.sql \
  | grep -v "^--\|DROP TABLE messages\|unread_messages.*0"
# Should show only the DROP TABLE line, not any FROM/JOIN messages queries.

# SQL verification post-migration:
SELECT prosrc FROM pg_proc WHERE proname = 'get_sidebar_badges';
-- The output must NOT contain 'FROM messages' anywhere.
```

**Phase:** v1.6 Announcements (chat removal phase). This is the highest-priority pitfall in the feature.

---

### Pitfall 2-B: `unread_messages` badge key still consumed by layout.tsx and Sidebar after messages table drop

**What goes wrong:**
`layout.tsx` lines 47-49:
```typescript
if (badges.unread_messages !== undefined && badges.unread_messages > 0) {
  badgeCounts.unread_messages = badges.unread_messages;
}
```
`config.ts` NAVIGATION has `badge: "unread_messages"` on the Chat nav item for both coach and student. If the badge field persists in the RPC response but the Chat nav item is removed, `badgeCounts.unread_messages` is populated but never consumed. If the Chat nav item is removed but the field remains, no visible bug — but the RPC is doing pointless work and the contract is wrong.

**The actual risk:** The announcement nav item will need its OWN badge key (e.g., `announcements_unread`). If the developer reuses `unread_messages` as the badge key for announcements, the Sidebar component may render a badge on the wrong nav item or no badge at all, because Sidebar matches badge key strings to nav item `badge` property values.

**Prevention:**
1. Remove `badge: "unread_messages"` from both Chat entries in `config.ts` NAVIGATION when removing the Chat nav item.
2. Remove the `unread_messages` handling block from `layout.tsx`.
3. If Announcements gets a badge, add a new key `announcements_unread` to NAVIGATION and layout.tsx explicitly.
4. The `SidebarBadgesResult` type in `src/lib/rpc/types.ts` must be updated to remove `unread_messages` and add `announcements_unread` if used.

**Detection / Verification:**
```bash
# No Chat nav item should remain after removal:
grep -n '"Chat"\|/chat\|unread_messages' src/lib/config.ts
# Must return zero lines after removal phase.

# No orphaned badge handling in layout:
grep -n "unread_messages" src/app/\(dashboard\)/layout.tsx
# Must return zero lines after removal phase.
```

**Phase:** v1.6 Announcements removal phase.

---

### Pitfall 2-C: Orphaned chat route files still reachable, and proxy.ts does not 404 them cleanly

**What goes wrong:**
After removing `/coach/chat` and `/student/chat` page files, a user with a bookmarked or cached `/coach/chat` URL gets Next.js's default 404 page. This is acceptable, but the proxy.ts may still have `/chat` in its protected route pattern, causing an auth redirect loop rather than a clean 404 for unauthenticated users hitting the old URL.

More critically: the API routes `/api/messages` and `/api/messages/read` are not automatically deleted. They continue to be reachable by any authenticated user. If an old client (browser with cached JS) polls `/api/messages` after deployment, it hits the old route, which queries the now-dropped `messages` table, and the server throws a 500 with "relation 'messages' does not exist" — surfacing as a noisy error in logs.

**Why it happens:**
Rolling deploys and browser cache mean the old JavaScript bundle (with its 5-second polling interval) can run for minutes after the server has the new code. The API route deletion and table drop happen at deploy time, but the old client is still alive.

**Prevention:**
1. In the announcements migration, do NOT drop `messages` table in the same deploy as the initial announcements launch. Two-step deploy:
   - Deploy 1: Ship announcements UI + keep messages table + keep `/api/messages` route returning an empty result set (or a 410 Gone). This allows old clients to drain gracefully.
   - Deploy 2 (next migration): Drop `messages` table + delete `/api/messages` + remove chat pages.
   
   Alternatively, since this is a non-production app with no real users during deploy: do a single-migration drop but accept 5–60 seconds of 500 errors from any open browser tab hitting the old polling interval.

2. After deleting chat page files, verify proxy.ts does not reference `/chat`:
```bash
grep -n "chat\|messages" src/proxy.ts
# Must return zero lines.
```

3. The `/api/messages` route handler must be deleted (not just emptied) before migration 2 lands.

**Detection / Verification:**
```bash
# Confirm chat pages are deleted:
ls src/app/\(dashboard\)/coach/chat/ 2>/dev/null && echo "FAIL: still exists"
ls src/app/\(dashboard\)/student/chat/ 2>/dev/null && echo "FAIL: still exists"

# Confirm API routes are deleted:
ls src/app/api/messages/ 2>/dev/null && echo "FAIL: still exists"

# Confirm types file no longer exports Message types:
grep -n "MessageWith\|ConversationList\|ChatComposer\|chat-utils" src/lib/types.ts
# Should return zero lines.
```

**Phase:** v1.6 Announcements. The two-step deploy concern is specific to this phase.

---

### Pitfall 2-D: RLS policies on `messages` table survive `DROP TABLE` but block the new `announcements` table if reused incorrectly

**What goes wrong:**
`DROP TABLE messages CASCADE` will drop all RLS policies on the `messages` table automatically. This part is safe. The risk is the inverse: if the developer writes the `announcements` RLS policies by copy-pasting from the `messages` policies, they may inadvertently carry over the `is_broadcast` column concept (which does not exist on `announcements`) or the `coach_id` room-key concept. The announcements model is fundamentally different: one table, owner/coach can INSERT, all roles can SELECT, no recipient_id, no read_at.

A secondary risk: if `DROP TABLE messages CASCADE` also cascades to `alert_dismissals` somehow via a foreign key... it does NOT (alert_dismissals references only `users`), but this should be verified.

**Prevention:**
Write announcements RLS policies from scratch, not from chat policies. The minimal correct policy set:
```sql
-- Owner and coach can INSERT:
CREATE POLICY "staff_insert_announcements" ON announcements
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = (SELECT auth.uid())) IN ('owner', 'coach')
  );
-- All authenticated roles can SELECT:
CREATE POLICY "all_select_announcements" ON announcements
  FOR SELECT USING (true);
-- Only creator can UPDATE/DELETE (optional, scope to owner+coach):
CREATE POLICY "staff_manage_announcements" ON announcements
  FOR ALL USING (
    (SELECT role FROM users WHERE id = (SELECT auth.uid())) IN ('owner', 'coach')
  );
```
All policies must use `(SELECT auth.uid())` initplan pattern per v1.2/v1.5 D-03.

**Detection / Verification:**
```sql
-- After migration: confirm messages policies are gone:
SELECT policyname FROM pg_policies WHERE tablename = 'messages';
-- Must return zero rows.

-- Confirm announcements policies use (SELECT auth.uid()) not auth.uid():
SELECT policyname, qual, with_check
FROM pg_policies WHERE tablename = 'announcements';
-- Manually verify no direct auth.uid() call without SELECT wrapper.
```

**Phase:** v1.6 Announcements migration.

---

### Pitfall 2-E: Half-deleted TypeScript types — Message types removed but `chat-utils.ts` import survives in a non-chat component

**What goes wrong:**
`src/lib/chat-utils.ts` exports `MessageWithSender`, `ConversationListItem`, and polling helpers. These are imported by 4 files: `coach/chat/page.tsx`, `student/chat/page.tsx`, `MessageThread.tsx`, `ConversationList.tsx`. When chat pages are deleted, those imports die. But if any other component (e.g., a shared layout helper or a future analytics component) ever imported from `chat-utils.ts`, it will compile-fail after deletion.

More concretely: `src/lib/types.ts` defines the `Messages` table type as part of the `Database` interface (lines 668–690 based on grep). After dropping the `messages` table, `types.ts` still has the stale type — it will not cause a runtime error (types are erased) but TypeScript strict mode may flag unused types, and regenerating `types.ts` from Supabase CLI will remove it automatically.

**Prevention:**
1. Delete `src/lib/chat-utils.ts` as part of the removal phase.
2. Delete `src/components/chat/` directory (ConversationList, MessageThread, ChatComposer).
3. Run `npx tsc --noEmit` immediately after deletions — any surviving import will fail loudly.
4. Remove `Messages` table type from `src/lib/types.ts` manually (or regenerate from CLI if Docker is running).

**Detection / Verification:**
```bash
# After deletion, build gate must pass:
npx tsc --noEmit 2>&1 | grep -i "chat\|messages\|MessageWith\|ConversationList"
# Must return zero lines.

# Confirm no component imports from chat-utils:
grep -rn "chat-utils\|ChatComposer\|ConversationList\|MessageThread" src/
# Must return zero lines.
```

**Phase:** v1.6 Announcements removal phase. TypeScript check is the verification gate.

---

## Feature 3: Atomic Roadmap Renumber

### Pitfall 3-A: `get_coach_milestones` and `get_sidebar_badges` hard-code step 11 and step 13 — renumber makes them wrong

**What goes wrong:**
Migration 00027 contains:
```sql
WHERE rp.step_number = 11   -- SYNC: MILESTONE_CONFIG.influencersClosedStep
WHERE rp.step_number = 13   -- SYNC: MILESTONE_CONFIG.brandResponseStep
```
After renumber (8→9 through 15→16), "Close 5 Influencers" moves from step 11 to step 12, and "Get Brand Response" moves from step 13 to step 14. The milestone RPCs will stop firing those notifications entirely — students completing the new step 12 will not generate milestone alerts for their coaches.

`config.ts` also has:
```typescript
influencersClosedStep: 11,
brandResponseStep: 13,
```
These must be updated to 12 and 14 respectively. But the RPC is in a migration that cannot be retroactively edited — a NEW migration must `CREATE OR REPLACE FUNCTION get_coach_milestones` with updated step numbers AND rewrite the `get_sidebar_badges` function.

**Why it happens:**
The sync comment in 00027 says "SYNC: MILESTONE_CONFIG.influencersClosedStep" but it is a comment, not enforced. A developer updating config.ts may forget the SQL counterpart.

**Consequences:**
Coach milestone alerts for "Close 5 Influencers" and "Get Brand Response" silently stop firing after the renumber migration. This is invisible until a student completes step 12 (new) and the coach notices no alert.

**Prevention:**
The renumber migration (or a companion migration in the same PR) MUST:
1. `CREATE OR REPLACE FUNCTION get_coach_milestones` — update hardcoded 11→12 and 13→14
2. `CREATE OR REPLACE FUNCTION get_sidebar_badges` — same update (it calls get_coach_milestones but does not hardcode steps itself, so updating get_coach_milestones is sufficient for the badge count)
3. Update `config.ts`: `influencersClosedStep: 12`, `brandResponseStep: 14`
4. Add an embedded ASSERT to the new migration:
```sql
-- ASSERT: step numbers in get_coach_milestones match config expectations
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM roadmap_progress WHERE step_number = 11) = 0,
    'step 11 should be gone after renumber';
END $$;
```

**Detection / Verification:**
```bash
# Grep for hardcoded old step numbers in SQL (should only appear in DROP/historical comments):
grep -rn "step_number = 11\|step_number = 13" supabase/migrations/
# Post-renumber migrations must not contain these on WHERE clauses.

grep -n "influencersClosedStep\|brandResponseStep" src/lib/config.ts
# Values must be 12 and 14 after renumber.
```

**Phase:** v1.6 Roadmap Renumber migration. Must ship in the SAME migration file or atomic transaction as the step renumber.

---

### Pitfall 3-B: Unique constraint `(student_id, step_number)` on `roadmap_progress` blocks UPDATE-in-place renumber

**What goes wrong:**
The roadmap_progress table has a unique constraint on `(student_id, step_number)`. Attempting to shift step numbers with a naive UPDATE:
```sql
UPDATE roadmap_progress SET step_number = step_number + 1 WHERE step_number >= 8;
```
Will immediately collide: the first row updated from step 8 to step 9 violates the unique constraint if a step 9 row already exists for that student. The update fails and rolls back.

**Why it happens:**
Postgres enforces constraints IMMEDIATELY by default (not deferred). Even within a single UPDATE statement that touches multiple rows, each row is validated as it is processed.

**How to do it correctly:**
Option A — Two-pass update (safest, no DEFERRABLE needed):
```sql
BEGIN;
-- Step 1: shift existing 8-15 up by bumping to temporary high values (100+)
UPDATE roadmap_progress SET step_number = step_number + 100 WHERE step_number BETWEEN 8 AND 15;
-- Step 2: shift them from 108-115 back down to 9-16
UPDATE roadmap_progress SET step_number = step_number - 99 WHERE step_number BETWEEN 108 AND 115;
COMMIT;
```

Option B — DEFERRABLE constraint:
```sql
ALTER TABLE roadmap_progress ALTER CONSTRAINT roadmap_progress_student_id_step_number_key DEFERRABLE INITIALLY DEFERRED;
BEGIN;
SET CONSTRAINTS ALL DEFERRED;
UPDATE roadmap_progress SET step_number = step_number + 1 WHERE step_number >= 8;
COMMIT;
-- Must re-set constraint back to IMMEDIATE after or future constraints behave differently
```
Option B is risky because it changes the constraint behavior globally for the connection and must be carefully reversed.

**Recommendation:** Use Option A (two-pass via high-number space). It requires zero schema changes and is idempotent (re-running the migration on an already-migrated DB fails gracefully if step 108+ do not exist).

**Detection / Verification:**
```sql
-- After migration: confirm no step numbers in 8-gap or above 16:
SELECT DISTINCT step_number FROM roadmap_progress ORDER BY step_number;
-- Must NOT contain 8 (old). Must contain 9 (new). Must contain 16 as max.

-- Confirm no student has two rows with the same step_number:
SELECT student_id, step_number, count(*) FROM roadmap_progress
GROUP BY student_id, step_number HAVING count(*) > 1;
-- Must return zero rows.
```

**Phase:** v1.6 Roadmap Renumber migration.

---

### Pitfall 3-C: Auto-complete new Step 8 for students who have already passed old Step 7 — wrong student_id scope and off-by-one

**What goes wrong:**
The renumber plan includes: "auto-complete new step for students past old Step 7." After renumber, old step 7 is still step 7. The new step 8 (Q&A session) needs to be auto-completed for any student who has already completed old step 7 (= is currently past the stage 1 boundary). The migration must:
1. Insert a `roadmap_progress` row with `status='completed'` for the new step 8 for every qualifying student
2. The qualifying condition is: student has a COMPLETED row for step 7 currently

**Off-by-one risk:** If the migration first renumbers (8→9 through 15→16) and then inserts the auto-complete, the query for "students past old step 7" must look at step 7 (unchanged). But if the query mistakenly looks for "completed step 8" (the old step 8, now step 9 after renumber), it will find the wrong set.

**Correct migration order:**
1. Renumber 8–15 → 9–16 (two-pass via 100+ space)
2. Insert new step 8 rows for all students (default `status='locked'`, NOT auto-completed)
3. Auto-complete step 8 for students with `step_number = 7 AND status = 'completed'`

**Step 1 and Step 8 auto-complete (`autoComplete: true`) row seeding:** The existing roadmap seeding logic in `/student/roadmap/page.tsx` line 39 does: `if (!error && progress.length < ROADMAP_STEPS.length) { /* seed missing rows */ }`. After renumber ROADMAP_STEPS.length becomes 16. This auto-seed will insert a locked step 16 row for all students who previously had 15 rows, which is correct. The migration only needs to handle the auto-complete for students already past step 7 — the page-level seed handles the insertion of the new locked step 8 on first page visit for everyone else.

**But:** Students currently mid-step 8 (old) will have their row renumbered to step 9, which is correct. Students currently with step_number=8 status='active' → becomes step 9 status='active'. Their new step 8 needs to be inserted as auto-completed.

**Detection / Verification:**
```sql
-- After migration: every student who had completed step 7 should have step 8 completed:
SELECT u.id, u.name
FROM users u
WHERE u.role IN ('student', 'student_diy')
  AND u.status = 'active'
  AND EXISTS (
    SELECT 1 FROM roadmap_progress rp
    WHERE rp.student_id = u.id AND rp.step_number = 7 AND rp.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM roadmap_progress rp
    WHERE rp.student_id = u.id AND rp.step_number = 8 AND rp.status = 'completed'
  );
-- Must return zero rows.
```

**Phase:** v1.6 Roadmap Renumber migration, step 3 of migration order.

---

### Pitfall 3-D: `get_student_analytics` RPC uses `step_number` references — hardcoded step IDs become wrong after renumber

**What goes wrong:**
`get_student_analytics` (migration 00023) was searched for hardcoded step numbers. The roadmap section of that RPC fetches:
```sql
SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'step_number')::int), '[]'::jsonb)
```
This is a dynamic `ORDER BY step_number` — NOT hardcoded step values. Good. However, the analytics client (`AnalyticsClient.tsx`) may display step numbers to the user (e.g., "Currently on Step 8"). After renumber, old step 8 becomes step 9. If any display logic hardcodes "Step 8 = Send Your First Email" for display purposes rather than reading from ROADMAP_STEPS config, the label will be wrong.

The `get_coach_milestones` function is the only RPC with hardcoded step number comparisons (step 11 and 13, covered in Pitfall 3-A above).

**Secondary risk:** `config.ts` MILESTONE_CONFIG has `influencersClosedStep: 11` and `brandResponseStep: 13` as number constants. If any TypeScript code (not the SQL migration) does `ROADMAP_STEPS.find(s => s.step === MILESTONE_CONFIG.influencersClosedStep)` to get the step title for display, it will return the wrong step title if config is updated to 12/14 but the DB still has the old step numbers during a partial migration.

**Prevention:**
The config.ts update (`influencersClosedStep: 12`, `brandResponseStep: 14`) and the DB renumber migration MUST be deployed atomically (same deploy, same PR). Never update config.ts on a different deploy than the migration.

**Detection / Verification:**
```bash
# Grep for hardcoded step number comparisons in TypeScript:
grep -rn "=== 8\|=== 11\|=== 13\|step_number === " src/
# Any match that is not from config.ts itself is a potential hardcode bug.

# Verify the analytics client reads step labels from ROADMAP_STEPS config:
grep -n "step.*title\|ROADMAP_STEPS\[" src/app/\(dashboard\)/student/analytics/AnalyticsClient.tsx
# Should only reference config, not hardcoded strings.
```

**Phase:** v1.6 Roadmap Renumber. TypeScript grep is the preventive check.

---

### Pitfall 3-E: `roadmap_progress` cache tags not invalidated after renumber migration — students see stale progress bars

**What goes wrong:**
`unstable_cache` on the student analytics page is tagged `student-analytics:${studentId}`. The roadmap renumber migration changes `step_number` values in `roadmap_progress` for thousands of students. The Next.js server cache still holds pre-migration snapshots. On the next page visit (within 60s TTL), a student may see their progress as `/15` instead of `/16`, or see "Step 8 completed" pointing to the wrong step.

The `ROADMAP_STEPS.length` references in page components (confirmed: student page, roadmap page, coach RoadmapTab, roadmap undo API) will automatically reflect the new value once config.ts is updated to 16 steps — because these are compile-time constants. No runtime cache invalidation needed for those.

The runtime cache concern is the `get_student_analytics` RPC result which includes `roadmap` data with step_numbers. After migration, those step_numbers change, but the cached result retains the old values.

**Prevention:**
The renumber migration does not have a direct mechanism to bust Next.js `unstable_cache`. Options:
1. Accept up to 60s stale display — the next request after TTL expiry shows correct data. For a planned migration during off-hours, this is acceptable.
2. After migration, manually trigger a `revalidateTag("student-analytics*")` via a one-off admin API endpoint (complex, not worth it).
3. The migration itself cannot call `revalidateTag` — that is a Next.js API, not Postgres.

**Recommendation:** Accept 60s staleness. Document in the migration plan that the renumber must run off-hours. The progress bar denominator flip (/15 → /16) happens instantaneously when config.ts redeploys (compile-time), which is before any student visits the page.

**Detection / Verification:**
After migration deploys, wait 61 seconds and reload the student roadmap page. The progress bar should show X/16, not X/15.

**Phase:** v1.6 Roadmap Renumber. No code change needed; awareness is the prevention.

---

### Pitfall 3-F: Seed scripts and test fixtures hardcode step counts (/10 or /15) — break after renumber to /16

**What goes wrong:**
Any seed script, test fixture, or migration assert that does:
- `ASSERT count(*) FROM roadmap_progress WHERE student_id = X = 15`
- Seeds exactly 10 or 15 rows for a test student
- Seeds step 15 as the max step
- Checks `ROADMAP_STEPS.length === 15`

...will fail after the renumber adds step 16 and makes the total 16.

From searching the codebase, the embedded asserts in migration 00027 (ASSERT 4) work with `step_number = 11` which will be stale after renumber. Migration 00027 itself is historical and won't re-run, but if those asserts are used as a pattern for new migration asserts, the new ones must use the post-renumber step numbers.

**Prevention:**
1. Search for hardcoded `15` or `10` in any migration assert or seed context and update to `16`.
2. The roadmap seeding logic in page files uses `ROADMAP_STEPS.length` (config-driven) — this is safe and auto-updates.
3. Any new migration assert that references specific step numbers must comment `-- SYNC: config.ts ROADMAP_STEPS[X].step`.

**Detection / Verification:**
```bash
# Search for hardcoded step count in seeds or asserts:
grep -rn "= 15\b\|= 10\b\|length.*15\|15 steps\|10 steps" supabase/ src/
# Review matches for roadmap-step-count semantics.

# After renumber, verify total unique steps in DB:
SELECT count(DISTINCT step_number) FROM roadmap_progress;
-- Should be 16 for any student who has completed the full roadmap seeding.
```

**Phase:** v1.6 Roadmap Renumber.

---

## Cross-Feature Interaction Pitfalls

### Pitfall X-1: chat removal tags collide with announcements tags — or announcements borrows the wrong tag name

**What goes wrong:**
The "badges" tag (`revalidateTag("badges")`) is used by every mutation route to bust the sidebar badge cache. After chat removal, the badges RPC no longer queries `messages`, so the `badges` tag effectively becomes cheaper to bust. However: if the announcements feature adds an `announcements_unread` count to the sidebar badge RPC (e.g., "N new announcements" badge), the `badges` tag must ALSO be busted by any announcement INSERT. If this is forgotten, the sidebar badge count for announcements is always stale.

A secondary collision risk: if the announcements feature defines a cache tag with the same string as an existing tag (e.g., "announcements" coincidentally matching something used elsewhere), `revalidateTag` will bust all caches with that tag string globally. Audit the existing tag strings before introducing new ones.

**Existing tag inventory (from grep of codebase):**
- `"badges"` — sidebar badge count for all roles
- `"coach-dashboard:{coachId}"` — coach homepage stats
- `"coach-analytics:{coachId}"` — coach analytics page
- `"coach-milestones:{coachId}"` — coach milestone alerts
- `"student-analytics:{studentId}"` — student analytics page
- `"deals-{studentId}"` — orphaned tag (no consumer) — should be cleaned up

**New tags to introduce in v1.6 (safe names, no collision):**
- `"owner-analytics"` — owner analytics page (global, one owner)
- `"announcements"` — if announcements feed uses caching (only needed if list is cached)

**Prevention:**
Before defining any new cache tag string, grep the entire codebase to confirm no collision:
```bash
grep -rn 'tags:\s*\[.*\]\|revalidateTag(' src/ | grep -v "^--"
```

**Phase:** v1.6 Owner Analytics (owner-analytics tag) and Announcements (announcements tag). Define tag constants in `*-types.ts` files, never as raw strings in route handlers.

---

### Pitfall X-2: `student_kpi_summaries` pre-aggregation table uses old step numbers

**What goes wrong:**
The `student_kpi_summaries` table (migration 00011) pre-aggregates KPI data via `pg_cron` nightly. If this table caches `current_roadmap_step` or `roadmap_progress` as an integer step number, the renumber leaves stale step references in the summary table until the next nightly cron run.

From reading migration 00011 (`write_path.sql`), the `student_kpi_summaries` pre-aggregation computes `avg_star_rating`, work session counts, etc. It does NOT pre-aggregate the current roadmap step number as a denormalized value (confirmed: the `get_student_detail` query reads roadmap_progress live or from summary but does not store step_number in the summary table).

The coach analytics `get_coach_analytics` RPC in 00026 computes `avg_roadmap_step` live from `roadmap_progress`. This is safe — it reads current step numbers dynamically.

**However:** The `COACH_CONFIG.milestoneMinutesThreshold` and the 100h milestone logic in `get_sidebar_badges` do not touch step numbers, so they are unaffected.

**Status:** LOW RISK based on code inspection. No known denormalized step_number in kpi_summaries. Verify after renumber:
```sql
-- Confirm no step_number column in student_kpi_summaries:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'student_kpi_summaries';
-- Must NOT include 'step_number' or 'current_step'.
```

**Phase:** v1.6 Roadmap Renumber — verification only, likely no code change needed.

---

### Pitfall X-3: Announcements migration runs BEFORE the messages drop, leaving both tables live during a deploy window — double badge counting

**What goes wrong:**
If the deployment sequence is:
1. Ship announcements table migration (adds `announcements` table, new sidebar badge field)
2. Ship updated `get_sidebar_badges` that counts BOTH `messages.unread` AND `announcements.unread`
3. Ship chat UI removal and messages table drop (separate deploy)

Then during the window between step 1 and step 3, the sidebar badge RPC counts BOTH unread messages AND unread announcements. The owner/coach sees inflated badge counts and the UI shows both Chat and Announcements nav items simultaneously.

**Prevention:**
Package the entire feature (announcements table + sidebar badge rewrite + chat page deletion + messages table drop + chat API deletion) into a single deployment with a single migration. The migration contains one atomic transaction:
```sql
BEGIN;
-- 1. Add announcements table
-- 2. Rewrite get_sidebar_badges (removes unread_messages, adds announcements if needed)
-- 3. DROP TABLE messages CASCADE
COMMIT;
```
The TypeScript changes (remove chat pages, add announcements pages, update config.ts NAVIGATION) ship in the same git commit as the migration, deployed atomically.

**Detection / Verification:**
The deployment is a single git commit. Verify before merge:
```bash
# Single migration file contains both ADD and DROP:
grep -l "announcements\|DROP TABLE messages" supabase/migrations/
# Should be exactly ONE migration file containing both.
```

**Phase:** v1.6 Announcements — this is a deployment sequencing decision that the phase plan must specify.

---

### Pitfall X-4: Roadmap renumber happens AFTER owner analytics is deployed — `avg_roadmap_step` displays step 15 max instead of 16 max during the window

**What goes wrong:**
Owner analytics leaderboard includes `avg_roadmap_step` as a KPI (derived from the coach analytics RPC pattern). If owner analytics deploys first (correct — it is a read-only addition) and roadmap renumber deploys second, the analytics page displays `avg_roadmap_step` against a `/15` denominator for up to the 60s cache window after renumber.

This is cosmetic only — the stat card shows "Avg Step: 15.0/15" instead of "14.0/16" — but it briefly misleads the owner.

**Prevention:**
Deploy owner analytics and roadmap renumber in the same release window (same day, sequential migrations in the same PR). The 60s staleness window is acceptable; do not block release sequencing on this.

If owner analytics shows step numbers as `/16 total`, the denominator is derived from `ROADMAP_STEPS.length` (config.ts) which updates at compile time when the config changes. The numerator (`avg_roadmap_step`) comes from the live DB query. The denominator updates atomically with the deploy; the numerator is eventually consistent (60s).

**Phase:** v1.6 — phase ordering concern. Owner Analytics should be Phase 54, Roadmap Renumber should be Phase 56 or later, ensuring config.ts `ROADMAP_STEPS.length` is 16 before the analytics page ships.

---

## Phase-Specific Warning Summary

| Phase Topic | Pitfall | Mitigation |
|---|---|---|
| Owner Analytics RPC | Missing index for platform-wide SUM(profit) | EXPLAIN ANALYZE before shipping; add covering index if seq scan |
| Owner Analytics RPC | Ties with LIMIT 3 | Secondary `LOWER(name) ASC` tiebreak on every ORDER BY |
| Owner Analytics RPC | Cache tags not wired | ownerAnalyticsTag() in deals and work-sessions mutation routes |
| Announcements — Chat Removal | get_sidebar_badges queries dropped messages table | Rewrite function in SAME migration as DROP TABLE |
| Announcements — Chat Removal | unread_messages badge key left in layout.tsx | Grep + remove from layout.tsx and config.ts NAVIGATION |
| Announcements — Chat Removal | Old polling client hits deleted /api/messages | Single-deploy strategy; accept brief 500s on open tabs |
| Announcements — Chat Removal | TypeScript chat types survive deletion | npx tsc --noEmit as build gate |
| Roadmap Renumber | Milestone RPC hardcodes step 11 and 13 | New migration with CREATE OR REPLACE for get_coach_milestones |
| Roadmap Renumber | Unique constraint blocks UPDATE in place | Two-pass via 100+ temporary space |
| Roadmap Renumber | Auto-complete new step 8 for wrong student set | Query step 7 completions AFTER renumber; SQL verification |
| Roadmap Renumber | Seed/test fixtures hardcode /15 | Grep for hardcoded 15 or 10 before migration ships |
| Cross-feature | Chat tag collides with announcements tag | Tag inventory grep; define new tags as named constants |
| Cross-feature | Announcements + chat overlap during deploy window | Single-migration atomic approach |
| Cross-feature | Analytics avg_roadmap_step /15 vs /16 window | Accept 60s staleness; same-release deploy |

---

## Sources

- Direct codebase inspection: migrations 00015, 00017, 00023, 00024, 00025, 00026, 00027
- `src/lib/config.ts` ROADMAP_STEPS, MILESTONE_CONFIG, NAVIGATION
- `src/app/(dashboard)/layout.tsx` badge handling
- `.planning/RETROSPECTIVE.md` v1.5 lessons: orphaned cache tag (Phase 53 postmortem), pre-dismiss backfill, batch RPC pattern
- `CLAUDE.md` Hard Rules: admin client in API routes, unstable_cache 60s TTL, (SELECT auth.uid()) initplan pattern
- `.planning/PROJECT.md` Key Decisions: v1.5 D-02 (60s TTL), v1.5 D-03 (initplan), v1.4 D-07 (polling not Realtime)
