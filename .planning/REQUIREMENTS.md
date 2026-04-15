# Requirements — Milestone v1.6 Owner Analytics, Announcements & Roadmap Update

**Milestone:** v1.6
**Status:** Active
**Target completion:** TBD
**Scale envelope:** 5,000 concurrent students

---

## v1.6 Requirements

### Owner Analytics (OA)

- [x] **OA-01** — Owner can view `/owner/analytics` page (separate route from owner dashboard homepage)
- [x] **OA-02** — Owner Analytics page shows 3 top-3 leaderboards: Top 3 Students by Hours Worked, Top 3 Students by Profit Earned, Top 3 Students by Deals Closed (lifetime scope, deterministic tie-break)
- [x] **OA-03** — Owner dashboard homepage shows teaser stat cards linking to `/owner/analytics`
- [x] **OA-04** — Owner Analytics served by a single batch Postgres RPC (`get_owner_analytics`) wrapped in `unstable_cache` with 60s TTL
- [ ] **OA-05** — `owner-analytics` cache tag is invalidated on every `deals` mutation (INSERT/UPDATE/DELETE) and on work-session completion (PATCH → completed)
- [x] **OA-06** — Leaderboard rows link to `/owner/students/[studentId]`

### Chat Removal (CHAT-REM)

- [ ] **CHAT-REM-01** — All chat routes (page + API) removed from `src/app/`
- [ ] **CHAT-REM-02** — All chat UI components removed from `src/components/chat/` and related files
- [ ] **CHAT-REM-03** — All chat entries removed from sidebar nav in `src/lib/config.ts` (all roles)
- [ ] **CHAT-REM-04** — All chat-related types, config entries, and utility files removed (`src/lib/chat-utils.ts` etc.)
- [ ] **CHAT-REM-05** — `messages` table dropped in migration (clean removal, no archive)
- [ ] **CHAT-REM-06** — `get_sidebar_badges` RPC rewritten to remove `unread_messages` branch — same migration and transaction as `DROP TABLE messages`
- [ ] **CHAT-REM-07** — `SidebarBadgesResult` TypeScript type no longer contains `unread_messages`; all call-sites updated
- [ ] **CHAT-REM-08** — `src/proxy.ts` route entries for `/coach/chat` and `/student/chat` removed (if present)

### Announcements (ANNOUNCE)

- [ ] **ANNOUNCE-01** — New `announcements` table: `id`, `author_id` FK→`users`, `content` (text), `created_at`, `updated_at`
- [ ] **ANNOUNCE-02** — Owner and coach can create announcements
- [ ] **ANNOUNCE-03** — Owner and coach can edit ANY announcement (not just their own)
- [ ] **ANNOUNCE-04** — Owner and coach can delete ANY announcement (not just their own)
- [ ] **ANNOUNCE-05** — All students (role `student`) see all announcements — read-only, not scoped to their assigned coach
- [ ] **ANNOUNCE-06** — `student_diy` role sees all announcements — read-only (same feed as students)
- [ ] **ANNOUNCE-07** — Each role has a dedicated `/announcements` page accessible from sidebar nav (owner, coach, student, student_diy)
- [ ] **ANNOUNCE-08** — Announcements list is paginated at 25 per page, most recent first
- [ ] **ANNOUNCE-09** — Announcements never expire (persist forever)
- [ ] **ANNOUNCE-10** — RLS policies: students + student_diy SELECT only; owner + coach have full CRUD on all rows; policies use `(SELECT auth.uid())` initplan pattern
- [ ] **ANNOUNCE-11** — Announcement mutation routes (POST / PATCH / DELETE) are auth-gated, role-checked, and rate-limited at 30 req/min per user
- [ ] **ANNOUNCE-12** — Edited announcements show an "(edited)" indicator based on `updated_at > created_at`

### Roadmap Step 8 Insertion (ROADMAP)

- [ ] **ROADMAP-01** — New step inserted at end of Stage 1 (after current Step 7, before current Step 8 "Send your First Email"): title "Join at least one Influencer Q&A session (CPM + pricing)", `target_days: 5`
- [ ] **ROADMAP-02** — Existing Steps 8–15 renumbered to 9–16 atomically in a single transaction with no duplicate `step_number` visible mid-transaction
- [ ] **ROADMAP-03** — Students who completed old Step 7 (or any step ≥ 7) have new Step 8 auto-marked `completed` so their progress is not blocked
- [ ] **ROADMAP-04** — Students can self-mark new Step 8 complete with the same flow as all other roadmap steps
- [ ] **ROADMAP-05** — `ROADMAP_STEPS` in `src/lib/config.ts` updated to 16 entries with correct stage headers
- [ ] **ROADMAP-06** — `MILESTONE_CONFIG.influencersClosedStep` updated from 11 → 12; `MILESTONE_CONFIG.brandResponseStep` updated from 13 → 14 — in both `src/lib/config.ts` AND `get_coach_milestones` RPC SQL, in the same migration
- [ ] **ROADMAP-07** — All progress-bar denominators show /16 (via dynamic `ROADMAP_STEPS.length`)
- [ ] **ROADMAP-08** — Full grep sweep across codebase for hardcoded step numbers (string literals like `/10`, `/15`, `step_number === 8`, step range guards); any found are updated
- [ ] **ROADMAP-09** — `CHECK (step_number BETWEEN 1 AND 15)` constraint dropped and recreated as `BETWEEN 1 AND 16` in the migration

### Performance & Quality (PERF — cross-cutting, applies to every phase)

- [x] **PERF-01** — All new hot-path queries have supporting indexes (reuse Phase 44 indexes where possible; add new indexes only if verified gap)
- [ ] **PERF-02** — Every new API route performs auth check + role verification + rate limiting (30 req/min/user) + Zod `safeParse` + `verifyOrigin()` for mutations
- [x] **PERF-03** — All new RLS policies use `(SELECT auth.uid())` initplan pattern
- [x] **PERF-04** — Dashboard aggregations served via Postgres RPC with 60s `unstable_cache` + tag-based invalidation
- [ ] **PERF-05** — Any list larger than 25 items is paginated
- [ ] **PERF-06** — Every phase ends with passing `npm run lint && npx tsc --noEmit && npm run build`
- [x] **PERF-07** — All features meet the 5,000 concurrent student stress envelope (query plans reviewed, no client-side aggregation on large sets)

---

## Future Requirements (Deferred)

<!-- Candidates for v1.7+. Not in v1.6 scope. -->

- Announcement pinning, reactions, read receipts, rich text, student replies, expiry
- Email notifications for new announcements (Resend pipeline)
- Owner analytics time windowing (weekly/monthly), per-coach breakdown, CSV export, trend charts
- Generic admin "insert roadmap step" tool
- Per-edit change-log for deals (v1.5 D-17 carry-over)
- Deal ownership transfer UI
- NOTIF-01 Tech/Email Setup trigger activation (pending D-06 stakeholder decision)

## Out of Scope

<!-- Explicit exclusions. Rationale prevents re-adding. -->

- **Real-time/push announcements** — page-load fetch is sufficient; no Supabase Realtime (would re-introduce the 500-connection cap issue that chat avoided)
- **Rich-text editor for announcements** — plain textarea with `whitespace-pre-wrap`; markdown/WYSIWYG is v2+
- **Per-user read tracking / unread badge for announcements** — explicit simplification over chat (no `announcements_read_log`)
- **Archive of messages table before drop** — clean removal per user spec; no migration export
- **Retroactive deadline backfill for new Step 8** — students past old Step 7 auto-complete; no `deadline_at` backfill
- **Time-windowed leaderboards in v1.6** — lifetime only; weekly/monthly deferred
- **Coach-scoped announcements feed** — owner/coach broadcast to ALL students platform-wide; not scoped to coach's assigned students
- **Student authorship of announcements** — one-way broadcast only

## Traceability

| REQ-ID | Phase | Success Criterion |
|--------|-------|-------------------|
| OA-01 | Phase 54 | Owner navigates to `/owner/analytics` and sees three leaderboard cards |
| OA-02 | Phase 54 | Three top-3 leaderboards render (hours, profit, deals) with deterministic tie-break |
| OA-03 | Phase 54 | Owner dashboard homepage shows analytics teaser with "View full analytics" link |
| OA-04 | Phase 54 | Single `get_owner_analytics` RPC wrapped in `unstable_cache` 60s TTL |
| OA-05 | Phase 54 | `revalidateTag("owner-analytics")` called in deals + work-session mutation routes |
| OA-06 | Phase 54 | Each leaderboard row links to `/owner/students/[studentId]` |
| CHAT-REM-01 | Phase 55 | Chat page + API routes deleted from `src/app/`; `npm run build` passes |
| CHAT-REM-02 | Phase 55 | Chat component files deleted from `src/components/chat/` |
| CHAT-REM-03 | Phase 55 | No chat entries in `ROUTES` or `NAVIGATION` in `src/lib/config.ts` |
| CHAT-REM-04 | Phase 55 | `src/lib/chat-utils.ts` and chat-related type entries deleted |
| CHAT-REM-05 | Phase 55 | `messages` table does not exist after migration 00029 |
| CHAT-REM-06 | Phase 55 | `get_sidebar_badges` rewritten before `DROP TABLE messages` in same transaction |
| CHAT-REM-07 | Phase 55 | `SidebarBadgesResult` has no `unread_messages` field; TypeScript build clean |
| CHAT-REM-08 | Phase 55 | `src/proxy.ts` has no `/coach/chat` or `/student/chat` entries |
| ANNOUNCE-01 | Phase 55 | `announcements` table created with correct schema and FK constraint |
| ANNOUNCE-02 | Phase 56 | Owner and coach can submit the create announcement form successfully |
| ANNOUNCE-03 | Phase 56 | Owner and coach can edit any announcement (not scoped to own rows) |
| ANNOUNCE-04 | Phase 56 | Owner and coach can delete any announcement with confirmation step |
| ANNOUNCE-05 | Phase 56 | Student role sees full announcement list, read-only, no edit/delete controls |
| ANNOUNCE-06 | Phase 56 | `student_diy` role sees full announcement list, same feed as students |
| ANNOUNCE-07 | Phase 56 | All four sidebar navs contain "Announcements" link to role-scoped page |
| ANNOUNCE-08 | Phase 56 | List paginates at 25/page ordered `created_at DESC` |
| ANNOUNCE-09 | Phase 55 | No `expires_at` column; announcements persist indefinitely |
| ANNOUNCE-10 | Phase 55 | RLS policies use `(SELECT auth.uid())` initplan pattern; students SELECT only |
| ANNOUNCE-11 | Phase 56 | Mutation routes enforce auth + role + `verifyOrigin()` + rate limit 30 req/min |
| ANNOUNCE-12 | Phase 56 | "(edited)" indicator visible when `updated_at > created_at` |
| ROADMAP-01 | Phase 57 | New Step 8 appears in student roadmap inside Stage 1 with `target_days: 5` |
| ROADMAP-02 | Phase 57 | Steps 9–16 are the renamed Steps 8–15; no duplicate step_number mid-migration |
| ROADMAP-03 | Phase 57 | Students past old Step 7 see new Step 8 already completed on first page load |
| ROADMAP-04 | Phase 57 | Students can self-mark new Step 8 complete using the standard roadmap flow |
| ROADMAP-05 | Phase 57 | `ROADMAP_STEPS` in `config.ts` has 16 entries with correct stage headers |
| ROADMAP-06 | Phase 57 | `influencersClosedStep: 12` and `brandResponseStep: 14` in both config.ts and RPC |
| ROADMAP-07 | Phase 57 | All progress bars show `/16`; derived from `ROADMAP_STEPS.length` |
| ROADMAP-08 | Phase 57 | Grep sweep finds zero hardcoded `/15` or step-number literals in `src/` |
| ROADMAP-09 | Phase 57 | `CHECK (step_number BETWEEN 1 AND 16)` constraint in place before renumber |
| PERF-01 | All phases | EXPLAIN ANALYZE confirms index scans on new hot-path queries |
| PERF-02 | All phases | Every new mutation route: auth + role + rate limit + Zod + verifyOrigin |
| PERF-03 | All phases | All new RLS policies use `(SELECT auth.uid())` initplan pattern |
| PERF-04 | Phase 54 | `get_owner_analytics` RPC with 60s `unstable_cache` + tag invalidation |
| PERF-05 | Phase 56 | Announcements list paginates at 25/page |
| PERF-06 | All phases | `npm run lint && npx tsc --noEmit && npm run build` passes at phase end |
| PERF-07 | All phases | No client-side aggregation on unbounded sets; query plans reviewed |

---

*Created: 2026-04-15 — milestone v1.6 kickoff after 4-dimension research synthesis.*
*Traceability filled: 2026-04-15 — roadmap Phases 54-57 defined.*
