# Project Research Summary

**Project:** IMA Accelerator v1.6 -- Owner Analytics, Announcements and Roadmap Update
**Domain:** Student coaching platform -- admin analytics, broadcast communication, sequential roadmap mutation
**Researched:** 2026-04-15
**Confidence:** HIGH

## Executive Summary

v1.6 extends the v1.5 production-validated stack with three bounded features: an Owner Analytics leaderboard page, a full Chat-to-Announcements replacement, and an atomic roadmap step insertion with cascade renumber. All four researchers agree: zero new runtime dependencies are required. The existing stack (recharts, Zod, Supabase, unstable_cache, admin client) covers every v1.6 need. The hard work is correctness under constraints: unique constraint management during the renumber, atomic migration sequencing for the chat swap, and wiring cache invalidation tags before shipping.

The recommended build order is Owner Analytics first (additive, no disruption risk), Announcements second (atomic swap -- single migration and deploy), Roadmap Step 8 last (data migration touching every student row and rewriting two live RPCs). This order was independently reached by all four research threads. The analytics phase has zero blockers. The announcements phase has one hard atomicity constraint: get_sidebar_badges must be rewritten in the same migration that drops the messages table, or the entire dashboard breaks for all users. The roadmap phase carries the highest migration risk and must ship in one transaction with the get_coach_milestones RPC rewrite.

The two silent data-logic bugs with no TypeScript surface are the critical watch-outs: (1) MILESTONE_CONFIG.influencersClosedStep (11 to 12) and MILESTONE_CONFIG.brandResponseStep (13 to 14) must be updated in both config.ts AND get_coach_milestones SQL atomically -- missing either half silently breaks coach milestone alerts for the two highest-value triggers with no compile error and no lint warning. (2) The owner-analytics cache tag must be explicitly wired into deals and work-sessions mutation routes before the analytics page ships, or the owner sees frozen leaderboards -- the exact failure mode from v1.5 Phase 53.

---

## Key Findings

### Recommended Stack

ZERO new dependencies. Confirmed by direct inspection of package.json. recharts@^3.8.1 handles all leaderboard charts. Zod 4.3.6 handles all announcement validation. The existing unstable_cache + createAdminClient() + src/lib/rpc/ pattern handles all new server-side fetching.

Do not add: any rich-text editor (plain textarea with whitespace-pre-wrap is the spec), any real-time library (announcements are page-load fetches not push), any chart library beyond recharts, any ORM or schema diffing tool.

**Core technologies (unchanged from v1.5):**

- Next.js 16 App Router + server components: all new pages use unstable_cache(60s) + small client components for interactivity
- Supabase Postgres + RLS: three new migrations (00028, 00029, 00030); all RLS policies use (SELECT auth.uid()) initplan pattern per v1.5 D-03
- recharts@^3.8.1: direct reuse of LeaderboardCard from src/components/coach/analytics/; zero new chart configuration
- Zod: announcement CRUD schemas with title max(255), body/content max(2000), at-least-one-field refinement on PATCH
- createAdminClient() + unstable_cache: every new RPC follows the established src/lib/rpc/ fetcher and cache-tag pattern

### Expected Features

**Feature 1 -- Owner Analytics: table stakes**

- Three top-3 leaderboard cards (hours all-time, profit all-time, deals all-time) on /owner/analytics
- Lifetime scope only; deterministic tiebreak (ORDER BY metric DESC, LOWER(name) ASC)
- Analytics teaser section on owner dashboard homepage: 3 compact leaderboard columns + View full analytics Link
- 60s unstable_cache tagged owner-analytics; busted on every deals mutation and work-session completion
- Leaderboard rows link to /owner/students/[studentId]

**Feature 1 -- Defer to v2+:** Time windowing, per-coach breakdown, CSV export, trend charts, rank history

**Feature 2 -- Announcements: table stakes (removal)**

- Full chat removal: 11 files deleted, messages table dropped, get_sidebar_badges rewritten, unread_messages stripped from nav/layout/types/SidebarBadgesResult

**Feature 2 -- Announcements: table stakes (addition)**

- New announcements table; RLS: all authenticated roles SELECT; owner + coach manage any row
- Four per-role /announcements pages sharing AnnouncementsClient with canCreate boolean prop
- Paginated 25/page, newest-first, author name + role chip, relative timestamp, (edited) indicator
- No sidebar badge (explicit simplification over chat)

**Feature 2 -- Defer to v2+:** Pinned announcements, reactions, read receipts, rich text, student replies, expiry, email notifications

**Feature 3 -- Roadmap Step 8: table stakes**

- New step 8 in Stage 1 (target_days: 5): Join at least one Influencer Q&A session (CPM + pricing)
- Atomic renumber: steps 8-15 to 9-16 via two-pass UPDATE to avoid unique constraint collision
- Auto-complete new step 8 for students who completed step 7; locked for all others; both student and student_diy roles
- influencersClosedStep: 11 to 12; brandResponseStep: 13 to 14 -- in both config.ts and get_coach_milestones RPC (same deploy)
- Progress bars auto-update to /16 via ROADMAP_STEPS.length (dynamic at compile time, no string grep needed)

**Feature 3 -- Defer:** Generic insert-step admin tool, retroactive deadline enforcement, in-app notifications

### Architecture Approach

All three features follow the locked v1.5 architecture: SECURITY DEFINER RPCs, unstable_cache(60s) + revalidateTag, small client components, createAdminClient() in all route handlers, Zod safeParse + auth + role check on every mutation. No new patterns are introduced.

**Major new components:**

1. src/lib/rpc/owner-analytics.ts + owner-analytics-types.ts -- server-only fetcher + ownerAnalyticsTag() helper; mirrors coach-analytics.ts
2. src/app/(dashboard)/owner/analytics/page.tsx + OwnerAnalyticsClient -- reuses LeaderboardCard verbatim from coach analytics
3. src/components/announcements/AnnouncementsClient.tsx + AnnouncementCard.tsx + AnnouncementForm.tsx -- shared across 4 role pages via canCreate prop
4. src/app/api/announcements/route.ts + src/app/api/announcements/[id]/route.ts -- CRUD following resources/glossary patterns
5. Migrations 00028, 00029, 00030 -- each atomic with embedded asserts

**Key modified files:**

- src/lib/config.ts: ROUTES + NAVIGATION (chat out / announcements in for all 4 roles, analytics for owner), ROADMAP_STEPS (new step 8, renumber), MILESTONE_CONFIG (11 to 12, 13 to 14)
- src/app/(dashboard)/owner/page.tsx: add unstable_cache wrapper + analytics teaser section
- src/app/(dashboard)/layout.tsx: remove unread_messages badge block
- src/lib/rpc/types.ts: remove unread_messages from SidebarBadgesResult
- src/lib/types.ts: remove messages table type block

### Critical Pitfalls

1. **get_sidebar_badges queries dropped messages table (app-breaking for all users)** -- Live RPC references messages in coach and student branches. If DROP TABLE messages runs before CREATE OR REPLACE FUNCTION get_sidebar_badges, every dashboard render fails for every user. Prevention: CREATE OR REPLACE the function FIRST within the same migration transaction, then DROP TABLE messages CASCADE.

2. **Milestone RPC hardcodes step 11 and step 13 -- renumber makes them wrong (silent failure)** -- After renumber, Close 5 Influencers moves to step 12 and Get Brand Response to step 14. Migration 00027 WHERE predicates stop matching. Coach milestone alerts for the two highest-value triggers silently stop firing. No compile error, no lint warning. Prevention: migration 00030 must CREATE OR REPLACE FUNCTION get_coach_milestones with updated predicates, and config.ts must update in the same deploy.

3. **Unique constraint blocks naive UPDATE renumber (migration failure)** -- (student_id, step_number) unique constraint fires per-row. SET step_number = step_number + 1 WHERE step_number >= 8 collides immediately. Prevention: two-pass shift -- move 8-15 to 108-115 first, then shift to 9-16.

4. **owner-analytics cache tag not wired to mutation routes (stale leaderboard -- identical to Phase 53 failure)** -- POST/PATCH /api/deals and PATCH /api/work-sessions/[id] must call revalidateTag(ownerAnalyticsTag()) before the analytics page ships.

5. **Announcements + messages overlap during deploy window (badge double-count)** -- Single-migration atomic approach required: CREATE announcements, REWRITE get_sidebar_badges, DROP messages -- all in one BEGIN/COMMIT with matching TypeScript changes in the same git commit.

---

## Implications for Roadmap

All four research files independently converged on the same three-phase build order.

### Phase A: Owner Analytics

**Rationale:** Purely additive -- zero disruption to live features. get_owner_analytics RPC reuses indexes already in production (migration 00021). If this phase ships with a bug, only the new analytics page is affected.

**Delivers:** /owner/analytics with three top-3 leaderboards + analytics teaser on owner homepage + unstable_cache added to previously-uncached owner dashboard stats call.

**Addresses:** FEATURES.md Feature 1 table stakes. Pitfalls 1-A (index coverage via EXPLAIN ANALYZE), 1-B (deterministic tiebreak), 1-C (COALESCE on profit), 1-D (ownerAnalyticsTag wired to mutation routes).

**Key constraint:** ownerAnalyticsTag() must be defined in owner-analytics-types.ts (not a raw string) and wired to POST/PATCH /api/deals and PATCH /api/work-sessions/[id] in this same phase.

**Research flag:** No deeper research needed. All patterns verified against live codebase.

---

### Phase B: Chat Removal + Announcements

**Rationale:** Largest surface area but medium risk when atomicity is followed. Cannot be done incrementally. Doing this second keeps the analytics phase clean and independent.

**Delivers:** Announcements feed (owner and coach write, all roles read), per-role pages, chat fully removed from codebase and database.

**Addresses:** FEATURES.md Feature 2 table stakes. Pitfalls 2-A (sidebar badges app-break), 2-B (orphaned badge key), 2-C (proxy.ts cleanup), 2-D (RLS from scratch), 2-E (TypeScript build gate), X-3 (single-deploy atomicity).

**Hard migration order (non-negotiable):**

1. CREATE OR REPLACE FUNCTION get_sidebar_badges -- remove all messages references
2. CREATE TABLE announcements + RLS + index on created_at DESC
3. DROP TABLE messages CASCADE

All within one BEGIN/COMMIT. All TypeScript changes (11 deletions, 4 new pages, 3 components, 2 API routes, config.ts updates) ship in the same git commit.

**Open questions to resolve before planning:**

- Column name: STACK.md uses body; ARCHITECTURE.md uses content. Recommendation: content.
- Edit permissions: STACK.md author-only; FEATURES.md any owner/coach. Recommendation: FEATURES.md wins.

**Research flag:** No deeper research needed. Exact migration SQL and deletion checklist documented in ARCHITECTURE.md Phase B.

---

### Phase C: Roadmap Step 8 Insertion

**Rationale:** Highest migration risk -- data mutation on all active student rows and rewrite of a production RPC with 9 embedded asserts. Shipping last ensures phases A and B are stable and verified.

**Delivers:** New step 8 in Stage 1; steps 8-15 renumbered to 9-16; coach milestone alerts corrected; progress bars show /16.

**Addresses:** FEATURES.md Feature 3 table stakes. Pitfalls 3-A (milestone step refs), 3-B (unique constraint), 3-C (auto-complete scope), 3-D (TypeScript hardcode grep), 3-E (cache staleness -- acceptable), 3-F (fixture hardcodes), X-2 (student_kpi_summaries).

**Migration sequence (00030_roadmap_step8.sql):**

1. Expand CHECK constraint to BETWEEN 1 AND 16
2. Shift steps 8-15 to negative space or +100 offset
3. Shift back to 9-16
4. INSERT new step 8: completed for students with step 7 complete, locked for others; both student and student_diy roles
5. CREATE OR REPLACE FUNCTION get_coach_milestones -- step_number 11 to 12, step_number 13 to 14; re-issue GRANTs
6. Embedded asserts: max step = 16, no duplicates, no step 11 rows remain

**config.ts changes (same deploy):**

- Insert step at ROADMAP_STEPS index 7: step 8, stage 1, Setup and Preparation, target_days 5, unlock_url null
- Renumber entries 8-15 to 9-16 (Stage 2 starts at new step 9, Stage 3 at new step 13)
- influencersClosedStep: 12 (was 11); brandResponseStep: 14 (was 13)

**Pre-ship mandatory grep surface:**

- grep for step_number 11 and 13 in supabase/migrations/ (post-00030 must only be in historical files)
- grep influencersClosedStep and brandResponseStep in src/lib/config.ts (must show 12 and 14)
- Read migration 00027 in full before writing 00030

**Research flag:** No deeper research needed. Reading 00027 before writing 00030 is a known required step.

---

### Phase Ordering Rationale

- Phase A first: additive-only, zero regression risk, validates v1.6 cache/leaderboard pattern
- Phase B second: hard atomicity means its own focused phase; follows A so cache pattern is established
- Phase C last: data migration on all student rows + live RPC rewrite -- ships when A and B are verified
- All three phases are DB-independent and can be developed in parallel but must deploy A then B then C

### Research Flags

No phase requires /gsd-research-phase. All features are fully designed.

- **Phase A (Owner Analytics):** Standard pattern. Verify index coverage with EXPLAIN (ANALYZE, BUFFERS) before migration ships.
- **Phase B (Announcements):** Atomic migration sequencing is the only non-obvious requirement. Fully documented.
- **Phase C (Roadmap Step 8):** Migration risk is well-characterized. Two-pass renumber and get_coach_milestones rewrite are designed. Execution discipline is all that remains.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps confirmed by direct package.json inspection; all v1.6 needs mapped to existing assets |
| Features | HIGH | Table stakes confirmed from PROJECT.md scope and v1.5 Phases 46-53 pattern baseline |
| Architecture | HIGH | All file paths, SQL shapes, component boundaries, and cache strategies verified against live codebase |
| Pitfalls | HIGH | Grounded in exact migration SQL bodies (00015-00027), v1.5 Phase 53 postmortem, confirmed file greps |

**Overall confidence: HIGH**

### Gaps to Address

- **Column name conflict (body vs. content):** STACK.md uses body; ARCHITECTURE.md uses content for the announcement body. Resolve before Phase B planning. Recommendation: content.

- **Announcement edit permissions (author-only vs. any staff):** STACK.md restricts PATCH/DELETE to author_id; FEATURES.md says owner and coach can edit any announcement. Resolve before Phase B planning. Recommendation: FEATURES.md wins.

- **Read migration 00027 before writing 00030:** Both STACK.md and ARCHITECTURE.md flag this as required. The get_coach_milestones body contains hardcoded step references, embedded asserts, and GRANT statements that must be preserved in the CREATE OR REPLACE. Known read task.

- **student_diy auto-complete in Phase C:** INSERT must use WHERE s.role IN (student, student_diy) -- documented but should be confirmed in the migration embedded assert.

- **owner-analytics tag and work-sessions path:** Verify PATCH /api/work-sessions/[id] is the correct route path for the status-to-completed mutation before wiring revalidateTag in Phase A.

---

## Sources

### Primary (HIGH confidence -- direct codebase inspection)

- package.json -- dependency versions confirmed
- src/lib/config.ts -- ROADMAP_STEPS, MILESTONE_CONFIG, NAVIGATION, ROUTES
- supabase/migrations/00025_get_coach_analytics.sql -- leaderboard RPC pattern baseline
- supabase/migrations/00027_get_coach_milestones_and_backfill.sql -- step 11/13 hardcodes, 9 embedded asserts
- supabase/migrations/00017_chat_badges.sql -- full get_sidebar_badges with unread_messages branches
- supabase/migrations/00008_expand_roadmap_to_15_steps.sql -- prior roadmap expansion pattern
- src/lib/rpc/coach-analytics.ts -- unstable_cache and tag pattern
- src/lib/rpc/types.ts -- SidebarBadgesResult.unread_messages
- src/app/(dashboard)/owner/page.tsx -- owner dashboard (uncached, 4 stat cards)
- src/app/(dashboard)/coach/analytics/page.tsx -- leaderboard page structure baseline
- src/components/coach/analytics/LeaderboardCard.tsx -- reusable component shape
- .planning/PROJECT.md -- v1.6 scope, constraints, key decisions, carry-overs
- .planning/MILESTONES.md -- v1.5 accomplishments
- CLAUDE.md -- hard rules

### Secondary (v1.5 retrospective lessons)

- .planning/RETROSPECTIVE.md -- Phase 53 postmortem: orphaned cache tag; directly informs owner-analytics tag wiring requirement in Phase A

---
*Research completed: 2026-04-15*
*Ready for roadmap: yes*
