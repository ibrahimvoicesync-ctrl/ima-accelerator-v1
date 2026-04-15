# Feature Landscape — v1.6 Owner Analytics, Announcements & Roadmap Update

**Domain:** Student performance & coaching platform — admin analytics, broadcast communication, sequential roadmap
**Researched:** 2026-04-15
**Milestone:** v1.6 (Owner Analytics / Replace Chat with Announcements / Roadmap Step Insertion)

---

## Feature 1 — Owner Analytics at /owner/analytics

### Table Stakes

These are the minimum for the page to feel functional to an owner:

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Three top-3 leaderboard cards (Hours, Profit, Deals) | Owner already sees top-3 hours on coach dashboard; natural expectation to see platform-wide equivalent | S | Reuse `LeaderboardCard` from `src/components/coach/analytics/LeaderboardCard.tsx` verbatim — identical props shape |
| Lifetime totals (no time windowing) | Owner context is platform health, not weekly activity; lifetime is the canonical measure at this scale | S | RPC returns aggregated totals; no date filter param needed v1.6 |
| Student name + metric value per row | Minimum readable leaderboard row | S | Already in `LeaderboardRow` type |
| Empty state per leaderboard | Zero students = no data yet | S | Use existing `EmptyState` primitive |
| Page accessible from owner nav and from dashboard teaser cards | Owner must be able to get there from both entry points | S | Add `/owner/analytics` to `ROUTES.owner` in config.ts |
| Teaser stat cards on owner dashboard homepage | Three leaderboard peeks that link to full analytics page | M | Modeled exactly on Phase 47 `KPICard` + `href` prop pattern (see `src/app/(dashboard)/coach/page.tsx` lines 350-383) |
| 60s `unstable_cache` on RPC | Consistent with every other analytics surface in v1.5 | S | Tag: `owner-analytics` (platform-wide, not per-user since all students feed it) |
| Link from leaderboard rows to `/owner/students/[studentId]` | Owner can drill into any student from the analytics list | S | Coach version links to `/coach/students/[id]`; owner maps to `/owner/students/[id]` |

### Differentiators

Features that go beyond minimum — not expected for MVP but add clear value:

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tie-breaking display (e.g. "(tied)") | Prevents confusion when two students share the exact same value | S | RPC ORDER BY metric DESC, student_name ASC for determinism; "(tied)" suffix is optional display |
| "See all →" footer link on teaser cards | Clear affordance to navigate to full `/owner/analytics` page | S | Text link below each teaser card |
| Section heading with "All-time" label | Makes the lifetime scope explicit — owner knows this is not weekly | XS | Static copy in subheading |

### Anti-Features (NOT doing in v1.6)

1. **Time windowing / date-range picker** — Owner context is platform-wide lifetime; weekly/monthly filters are V2. The coach homepage already covers weekly (Mon-Sun). Mixing time windows at owner level adds a filter UI and complicates the RPC for no MVP gain.
2. **Top-N > 3 on homepage teaser** — The teaser cards show top-3 only. A top-10 or paginated leaderboard belongs on the analytics page itself, not the dashboard homepage.
3. **Per-coach breakdown** — Owner analytics is student-centric. Aggregating by coach ("which coach's students perform best") is a V2 management feature requiring a different query shape.
4. **CSV export from owner analytics** — Coach analytics already has CSV (Phase 48/53). Owner export, if needed, is V2; the existing student list page covers bulk views.
5. **Charts / trend lines** — Coach analytics (Phase 48) has the 12-week deal trend chart. Owner analytics in v1.6 is leaderboard-only; trend charts would require additional recharts columns and are out of scope.
6. **Rank history / movement arrows** — "Student went from #3 to #1 this week" requires snapshot comparison. V2+ feature.

### Complexity Assessment: S-M overall

The page is structurally identical to the coach analytics leaderboard section (Phase 48). The delta is:
- New `get_owner_analytics` RPC (platform-wide, not coach-scoped) — M
- Owner dashboard teaser card section (3 small stat cards linking to analytics) — S
- Route registration + nav update in config.ts — XS
- Leaderboard component reuse — XS (zero new component code)

### Dependencies on Existing Code

| Dependency | File | How Used |
|-----------|------|----------|
| `LeaderboardCard` | `src/components/coach/analytics/LeaderboardCard.tsx` | Direct reuse — identical prop shape for owner-scoped rows |
| `KPICard` | `src/components/coach/KPICard.tsx` | Teaser card on owner dashboard homepage |
| `unstable_cache` pattern | `src/app/(dashboard)/coach/analytics/page.tsx` lines 47-55 | Same 60s cache wrapper pattern |
| `ROUTES.owner` | `src/lib/config.ts` line 59-69 | Add `analytics: "/owner/analytics"` |
| `NAVIGATION.owner` | `src/lib/config.ts` line 285-294 | Add Analytics nav item |
| `OWNER_CONFIG` | `src/lib/config.ts` line 209-222 | May extend with leaderboard config |

### Owner-Level Leaderboard Behavior: Key Decisions

**Scope: Lifetime, not windowed.** The coach dashboard already owns "this week" (Mon-Sun ISO). The owner page is a different audience — Abu Lahya wants to see who his best overall students are across the entire program lifetime. Time windowing requires a filter UI and complicates the RPC for no MVP gain.

**Top 3 only.** Consistent with the coach homepage `WeeklyLeaderboardCard` (Phase 47) and the spec context. Top-3 is the conventional podium. The full analytics page shows all three leaderboards side-by-side at top-3 each — not paginated — because the set is bounded.

**Tie-breaking:** When two students share the same metric value, the RPC must break ties deterministically (ORDER BY metric DESC, student_name ASC). No user-visible tie indicator is required for MVP but the RPC must never produce non-deterministic ordering.

**Teaser card pattern:** The established pattern (Phase 47 coach homepage) is KPICard with `href` prop wrapping the entire card in a `<Link>`. Three teaser cards on the owner dashboard homepage — one per leaderboard — each link to `/owner/analytics`.

---

## Feature 2 — Replace Chat with Announcements

### Removal Surface Area (Chat OUT)

Before building anything new, these must be cleanly removed:

| Surface | Location | Removal Action |
|---------|----------|----------------|
| Coach chat page | `src/app/(dashboard)/coach/chat/page.tsx` | Delete route |
| Student chat page | `src/app/(dashboard)/student/chat/page.tsx` | Delete route |
| Chat components | `src/components/chat/` (6 files: BroadcastCard, ChatComposer, ConversationList, DaySeparator, MessageBubble, MessageThread) | Delete directory |
| Chat API route | `src/app/api/messages/route.ts` | Delete |
| Messages read API | `src/app/api/messages/read/route.ts` | Delete |
| Chat utilities | `src/lib/chat-utils.ts` | Delete |
| `messages` table | New migration | `DROP TABLE IF EXISTS public.messages CASCADE` |
| `chat` nav item (coach) | `src/lib/config.ts` NAVIGATION.coach | Remove entry with `href: "/coach/chat"` |
| `chat` nav item (student) | `src/lib/config.ts` NAVIGATION.student | Remove entry with `href: "/student/chat"` |
| `ROUTES.coach.chat` | `src/lib/config.ts` line 79 | Remove route key |
| `ROUTES.student.chat` | `src/lib/config.ts` line 88 | Remove route key |
| `unread_messages` badge branch | `src/app/(dashboard)/layout.tsx` lines 47-49 | Remove badge consumer |
| `unread_messages` in `get_sidebar_badges` RPC | New DB migration | Remove that branch from the RPC function; replace with no-op or remove from RETURNS shape |
| `SidebarBadgesResult.unread_messages` | `src/lib/rpc/types.ts` | Remove field |
| `messages` table types | `src/lib/types.ts` | Remove Insert/Row/Update triplet |

### Table Stakes (Announcements IN)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `announcements` table: `id uuid PK, author_id uuid FK→users, content text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()` | Minimal schema for persistent broadcast feed | S | One migration; RLS: students SELECT only, owner+coach INSERT/UPDATE/DELETE any row |
| `/announcements` route per role (owner, coach, student, student_diy) | Each role has its own namespaced route prefix | S | 4 page files; student + student_diy are read-only views; all 4 render the same feed |
| List view: most recent first, paginated 25/page | Per v1.5 D-04 (paginate anything > 25) | S | Server component + searchParams `page` param; same URL pagination pattern as coach analytics student list |
| Author name + role chip on each announcement | Students need to know who is speaking | S | JOIN `users.name` and `users.role` in query; display "Abu Lahya (Owner)" or "Coach Name (Coach)" |
| Relative timestamp ("2 hours ago", "Apr 14") | Standard for announcement feeds | S | Reuse existing date formatting utilities |
| Owner + Coach: Create new announcement (textarea + submit) | Primary write action | S | POST `/api/announcements` with Zod-validated content |
| Owner + Coach: Edit any announcement (not just their own) | Multi-author system — owner should be able to fix coach typos | M | PATCH `/api/announcements/[id]`; updates content + sets `updated_at`; show "(edited)" indicator |
| Owner + Coach: Delete any announcement with confirmation | Clean up outdated announcements | S | DELETE `/api/announcements/[id]`; confirmation dialog to prevent accidental loss |
| "(edited)" indicator on modified announcements | Transparency — readers know content changed | S | Render when `updated_at > created_at + interval '5 seconds'`; show as small chip next to timestamp |
| Empty state when no announcements exist | First-use state | XS | Use existing `EmptyState` primitive |
| Sidebar nav item "Announcements" for all 4 roles | Replaces "Chat" entry | S | Update `NAVIGATION` in config.ts; no badge on this item |
| No sidebar badge on announcements | No read/unread tracking in v1.6 | XS | Explicitly no badge — primary simplification over chat system |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Character count feedback on compose textarea | Prevents overlong announcements; gives author real-time feedback | XS | Max 2000 chars recommended; Zod max enforced; display "X / 2000" counter |
| "Edited at [time]" tooltip on the "(edited)" chip | Full transparency for curious readers | XS | `title` attribute on the chip element |
| Optimistic add (announcement appears immediately after POST) | Eliminates "did it send?" dead wait | M | Use React state prepend on successful POST response; server re-validates on next load |

### Anti-Features (NOT doing in v1.6)

1. **Pinned announcements** — No pin/unpin toggle. All announcements are chronological only. Pinning requires a `pinned boolean` column and sort-priority changes in the query. V2.
2. **Reactions / likes / emoji responses** — No reaction system. Students read, do not interact. Adding reactions requires a separate `announcement_reactions` table. V2.
3. **Read receipts / unread badge** — No tracking of which students have seen which announcements. This is the primary simplification over chat. The chat system's `unread_messages` badge required per-user-per-message read state; removing that complexity is a core goal of this migration.
4. **Rich text / markdown formatting** — Plain text only in v1.6. Rich text requires a WYSIWYG editor (Tiptap, Quill) and HTML sanitization. V2.
5. **Student replies / comments on announcements** — Read-only for students. Two-way discussion is chat behavior, which is being removed. Students have Ask Abu Lahya for questions.
6. **Announcement expiry / auto-archive** — No `expires_at` column. Announcements persist indefinitely. Per spec: "no expiry."
7. **Email notifications on new announcements** — Out of scope per PROJECT.md constraints (email notifications are V2+ via Resend).
8. **Per-coach scoped announcements** — All announcements are platform-wide. There is no coach-to-their-own-students-only targeting in v1.6. One feed, all readers.

### Complexity Assessment: M

The write side (3 CRUD API routes) is straightforward. The removal surface area is the larger risk. Key complexity:
- Atomic migration: drop `messages`, create `announcements`, rewrite `get_sidebar_badges` RPC to remove `unread_messages` branch — all in one `BEGIN/COMMIT` block
- 4 route page files (owner/coach/student/student_diy) sharing common read logic
- Edit flow: tracking `updated_at` and "(edited)" indicator

### Multi-Author Edit Semantics

**Who can edit/delete:** Owner and coaches can CRUD any announcement — not just their own. RLS must reflect this: `FOR ALL TO owner, coach` (or via role check), `FOR SELECT TO student, student_diy`.

**What "edited" shows to readers:** A small `(edited)` text chip next to the timestamp, conditionally rendered when `updated_at - created_at > interval '5 seconds'`. No original-version preservation in v1.6. Full change history is V2 (consistent with v1.5 D-17 philosophy).

### Dependencies on Existing Code

| Dependency | File | How Used |
|-----------|------|----------|
| Pagination pattern | `src/components/coach/analytics/StudentListTable.tsx` | Page/prev/next URL param pattern to replicate for announcements list |
| `unstable_cache` + revalidateTag | `src/app/(dashboard)/coach/analytics/page.tsx` | Same 60s cache on announcement list reads |
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Empty feed state |
| `NAVIGATION` config | `src/lib/config.ts` lines 285-325 | Remove Chat entries, add Announcements for coach, student, student_diy; add to owner nav |
| Auth + Zod guard pattern | Any existing API route | All announcement mutations follow same auth+role+Zod pattern |
| `get_sidebar_badges` RPC | Previously `supabase/migrations/00027_*` | New migration rewrites to remove `unread_messages` branch |
| `layout.tsx` badge consumer | `src/app/(dashboard)/layout.tsx` lines 47-49 | Remove `unread_messages` lines |

---

## Feature 3 — New Roadmap Step 8 (Influencer Q&A Session)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| New entry in `ROADMAP_STEPS` config | Config is truth (CLAUDE.md Rule 1) | XS | Insert at index 7 (0-based): `{ step: 8, stage: 1, stageName: "Setup & Preparation", title: "Join at least one Influencer Q&A session (CPM + pricing)", target_days: 5 }` |
| Renumber existing config steps 8-15 → 9-16 | All step references must stay consistent | XS | Mechanical config edit: 8 entries change their `step` value |
| Atomic DB migration: renumber existing rows then insert new step | No duplicate `step_number` UK violation mid-migration | M | Renumber in DESCENDING order (15→16, 14→15, …, 8→9) to avoid constraint collision, then INSERT new step 8; wrapped in `BEGIN/COMMIT` |
| Auto-complete new step 8 for students who completed old step 7 | Students past step 7 must not be blocked by new step | M | Migration INSERT with `status='completed', completed_at=now()` WHERE `student_id IN (SELECT student_id FROM roadmap_progress WHERE step_number=7 AND status='completed')` |
| Insert new step 8 as `locked` for students on step 7 or earlier | Students who haven't finished step 7 should proceed normally | S | Migration INSERT with `status='locked'` for remaining active students |
| Progress bar denominator updated from /15 to /16 everywhere | Shows correct total step count | S | Grep `src/` for `/15`, `"15"`, `of 15`; update to 16 |
| Student self-mark complete on new step 8 | Standard step completion UX | XS | No new API needed — existing `POST /api/roadmap` handles any step number; step 8 is identical to any other step |
| Stage header remains "Setup & Preparation" for new step 8 | Step 8 is end of Stage 1, not start of Stage 2 | XS | `stage: 1` in new config entry; old step 8 (now step 9 "Send Your First Email") is first step of Stage 2 |
| Update `MILESTONE_CONFIG.influencersClosedStep` from 11 → 12 | Old "Close 5 Influencers" was step 11, now step 12 after renumber | S | Config.ts edit + new DB migration that rewrites `get_coach_milestones` RPC |
| Update `MILESTONE_CONFIG.brandResponseStep` from 13 → 14 | Old "Get Brand Response" was step 13, now step 14 after renumber | S | Same config.ts edit + same DB migration |
| New DB migration rewrites `get_coach_milestones` RPC with updated step numbers | RPC currently hardcodes 11 and 13 in multiple places | M | Migration 00028 or next: `CREATE OR REPLACE FUNCTION get_coach_milestones` with 12 and 14 in place of 11 and 13 |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Migration assertion: validate step count = 16 after migration | Catch migration bugs before production | S | `DO $$ BEGIN ASSERT (SELECT COUNT(*) FROM roadmap_progress WHERE step_number = 8) > 0; END $$` |
| Coach/owner roadmap view automatically shows updated step titles | Config-driven rendering means no extra code needed | XS | Automatic — components read from `ROADMAP_STEPS` config array |

### Anti-Features (NOT doing in v1.6)

1. **Gap numbering (e.g., step 7 → step 10 with gaps 8-9 empty)** — This codebase uses dense sequential step numbers. Gap numbering would break all "step X of N" progress bars, the `MILESTONE_CONFIG` step references, and the RPC step comparisons. Hard-renumber is the only correct approach for this schema.
2. **Undo support specific to the new step 8** — The roadmap undo system (v1.3) handles undo/cascade-relock for any step uniformly. The new step 8 inherits undo support automatically. No new undo logic needed.
3. **Retroactive deadline enforcement for past-step-7 students** — Auto-completed students get `completed_at = now()` at migration time. Do not backfill `completed_at` with a fake date relative to `joined_at` — it would produce false "on-track" or "late" deadline status for historical students.
4. **In-app notification to students about new step insertion** — No in-app notification system in V1 (V2+ per PROJECT.md). Students see the updated roadmap on next visit.
5. **Generic "insert step" admin tool** — This is a one-time migration. No tooling investment justified.
6. **Renaming stage 2 start** — Old step 8 "Send Your First Email" becomes new step 9 and remains the first step of Stage 2. Stage boundary does not move.

### Complexity Assessment: M (migration complexity dominates)

TypeScript changes are mechanical (config edit + grep/replace in ~10 files). The migration is the risk surface:
- Must not violate `(student_id, step_number)` unique key during renumbering
- Must correctly classify "past step 7" students for auto-complete
- Must check `roadmap_undo_log` for stored step_number references (audit records are not renumbered, but the undo RPC must tolerate that)
- Must update `get_coach_milestones` RPC step number literals (step 11 → 12, step 13 → 14) in a new migration

### Invariants That Must Hold

| Invariant | Verification |
|-----------|-------------|
| No student blocked at new step 8 who already passed step 7 | All students with step 7 `status='completed'` get new step 8 as `completed` |
| `step_number` unique constraint never violated mid-migration | Renumber in descending order (15→16 first), then insert new step 8 |
| `ROADMAP_STEPS` config array length changes from 15 to 16 | Assert `ROADMAP_STEPS.length === 16` |
| `MILESTONE_CONFIG.influencersClosedStep` updated 11 → 12 | Config.ts change; SYNC comment updated |
| `MILESTONE_CONFIG.brandResponseStep` updated 13 → 14 | Config.ts change; SYNC comment updated |
| `get_coach_milestones` RPC hardcoded step numbers updated | New migration rewrites RPC body; `rp.step_number = 11` → `12`, `rp.step_number = 13` → `14` in all locations in migration 00027 pattern |
| Progress bars show /16 not /15 | Grep `src/` for literal `/15` or `"15"` in .tsx files; update to 16 |
| `roadmap_undo_log` historical rows are NOT renumbered | Undo log rows are audit records tied to historical step_number values; acceptable; undo RPC reads live `roadmap_progress` rows, not undo log step_number for comparison |

### Student UX Mid-Step: Detailed Breakdown

**Student currently active on old step 8 "Send Your First Email" (soon-to-be step 9):**
- Their old step 8 row is renumbered to step 9 — they remain active on it
- New step 8 "Join Influencer Q&A" inserts as `completed` (because they completed step 7 to unlock step 8)
- UX after migration: roadmap shows new step 8 as complete, step 9 as active — no disruption

**Student currently active on step 7 "Draft Your First Outreach Emails":**
- New step 8 inserts as `locked`
- They complete step 7 → step 8 (Influencer Q&A) unlocks → they complete step 8 → step 9 (Send Your First Email) unlocks
- This is the only cohort that actually "does" the new step

**Student on steps 1-6 (before step 7):**
- New step 8 inserts as `locked` — correct, they have not reached the prerequisite

**Students on steps 9-16 (already past old step 8):**
- All old steps 8-15 are renumbered 9-16
- New step 8 inserts as `completed` (they completed step 7 to get here)
- No disruption to their current active step

### Dependencies on Existing Code

| Dependency | File | Impact |
|-----------|------|--------|
| `ROADMAP_STEPS` | `src/lib/config.ts` lines 155-174 | New entry at index 7; entries at indices 7-14 each increment their `step` value by 1; `stage` values update: old steps 8-11 (now 9-12) stay stage 2, old steps 12-15 (now 13-16) stay stage 3 |
| `MILESTONE_CONFIG.influencersClosedStep` | `src/lib/config.ts` line 393 | Change value from 11 to 12 |
| `MILESTONE_CONFIG.brandResponseStep` | `src/lib/config.ts` line 397 | Change value from 13 to 14 |
| `get_coach_milestones` RPC | `supabase/migrations/00027_get_coach_milestones_and_backfill.sql` | New migration (00028 or next) rewrites entire RPC with updated step references; does NOT modify 00027 (migrations are immutable) |
| Progress bar `/15` references | All roadmap-rendering .tsx components | Grep and update |
| `roadmap_undo_log` table | Check migrations for step_number column | Historical rows are not renumbered; undo RPC must tolerate stale step_number values in audit log |

---

## Cross-Feature Dependencies

| Feature | Blocked By | Notes |
|---------|-----------|-------|
| Owner Analytics RPC | None | Standalone new RPC; no dependency on Features 2 or 3 |
| Owner Analytics page | Owner Analytics RPC | Page is a thin wrapper over the RPC |
| Owner dashboard teaser cards | Owner Analytics RPC | Teaser cards read from same RPC result |
| Announcements table migration | Chat removal in same migration | Drop `messages`, create `announcements`, rewrite `get_sidebar_badges` — atomic |
| Announcements CRUD API | Announcements table migration | Cannot build API before schema exists |
| Announcements nav items | Chat nav removal | Remove Chat, add Announcements in same config.ts commit |
| Roadmap step 8 DB migration | Config.ts step update | Migration and config.ts edit must ship together |
| `MILESTONE_CONFIG` step updates | Roadmap step 8 migration | Step number references in config + RPC must stay in sync; new migration updates both |

---

## Build Order Recommendation

1. **Feature 3 (Roadmap Step 8)** — smallest UI surface area; clears step-number debt before other features potentially reference step numbers in any new analytics queries
2. **Feature 2 (Announcements)** — medium surface area; removal and creation can be two sequential phases; announcements schema is independent of owner analytics
3. **Feature 1 (Owner Analytics)** — builds on stable foundation; reuses established leaderboard + RPC + cache patterns; no blockers from Features 2 or 3

Features 1 and 3 have no shared dependencies and can be parallelized if needed.

---

## Sources

- `src/lib/config.ts` — `ROADMAP_STEPS` (15 steps, 3 stages), `NAVIGATION` (chat items on coach + student), `MILESTONE_CONFIG` (step 11, 13), `ROUTES`, `OWNER_CONFIG`
- `src/app/(dashboard)/coach/analytics/page.tsx` — unstable_cache pattern, revalidate=60, RPC wrapper
- `src/components/coach/analytics/LeaderboardCard.tsx` — reusable leaderboard component shape (`LeaderboardRow` type, rank-1 badge, avatar initials, linked rows)
- `src/components/coach/WeeklyLeaderboardCard.tsx` — top-3 leaderboard variant on coach homepage
- `src/app/(dashboard)/coach/page.tsx` — KPICard + href teaser pattern (Phase 47, lines 350-383)
- `src/app/(dashboard)/owner/page.tsx` — existing owner dashboard structure (4 stat cards, Link-wrapped cards)
- `src/app/(dashboard)/layout.tsx` — badge RPC integration; `unread_messages` branch at lines 47-49 to remove
- `src/app/(dashboard)/coach/chat/page.tsx` — full chat removal surface (polling, 3 API endpoints, broadcast + direct modes)
- `src/components/chat/` — 6 components to delete (BroadcastCard, ChatComposer, ConversationList, DaySeparator, MessageBubble, MessageThread)
- `supabase/migrations/00027_get_coach_milestones_and_backfill.sql` — hardcoded step 11 and 13 references that require update after renumber; migration pattern to follow for new milestones RPC rewrite
- `.planning/PROJECT.md` — v1.6 scope definition, out-of-scope list, key decisions log
- `.planning/MILESTONES.md` — v1.5 accomplishments (analytics pattern baseline, phase 47-48 leaderboard precedent)
