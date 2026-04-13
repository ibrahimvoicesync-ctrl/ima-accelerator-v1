---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Analytics Pages, Coach Dashboard & Deal Logging
status: defining_requirements
stopped_at: Milestone v1.5 initialized
last_updated: "2026-04-13T00:00:00.000Z"
last_activity: 2026-04-13
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.
**Current focus:** Milestone v1.5 — defining requirements

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-13 — Milestone v1.5 started

Progress: [░░░░░░░░░░] 0% (v1.5)

## Performance Metrics

**v1.0 completed:** 2026-03-18 | 12 phases | 38 plans | 218 commits | 12,742 LOC
**v1.1 completed:** 2026-03-28 | 6 phases | 16 plans
**v1.2 completed:** 2026-03-31 | 6 phases | 18 plans
**v1.3 completed:** 2026-04-03 | 5 phases | 11 plans
**v1.4 completed:** 2026-04-07 | 14 phases (30-37, 40-43) | 30+ plans
**v1.5 started:** 2026-04-13 | Analytics Pages, Coach Dashboard & Deal Logging

## Accumulated Context

### Decisions (v1.5 locked)

- D-01: Analytics aggregation via Postgres RPC (not client-side row pulls)
- D-02: `unstable_cache` 60s TTL on dashboard stats
- D-03: (SELECT auth.uid()) initplan RLS pattern on all new policies
- D-04: Paginate any list > 25 items
- D-05: Perf target 5,000 concurrent students
- D-06: "Tech/Email Setup Finished" roadmap step TBC (Monday stakeholder meeting, placeholder Step 5 or 6)
- D-07: "Closed Deal" milestone notification fires on EVERY deal (not first-only)
- D-08: Milestone notifications reuse 260401-cwd pattern (100+ hrs/45 days)
- D-09: `deals.logged_by` nullable UUID — null = student self, set = coach/owner
- D-10: Build order sequential (Feat 1 → 2 → 3 → 4 → 5)
- D-13: Top-3 hours leaderboard weekly reset (Mon-Sun, ISO week — reuses v1.4 D-01)

### Decisions (v1.4 shipped — archived for reference)

- v1.4 D-07: Chat polling 5s interval — NOT Supabase Realtime (avoid 500 connection limit on Pro)
- v1.4 D-14: Role type expands to 4: owner, coach, student, student_diy
- v1.4 D-01: "This week" = Monday-Sunday ISO week for skip tracker
- v1.4 D-10: Discord WidgetBot iframe embed — no npm package
- v1.4 D-04: student_diy has NO coach assignment (fully independent, self-service)
- v1.4 D-05: student_diy has NO Ask Abu Lahya, NO Daily Report, NO Resources, NO Chat
- v1.4 D-13: Invite link default max_uses = 10 (was null/unlimited)

### Critical Pitfalls (from research — address during execution)

- Phase 30/31: Update all 8 role gate locations atomically (proxy, config x6, DB) — partial update causes redirect loops
- Phase 32: Pass getTodayUTC() as p_today to skip RPC — never use CURRENT_DATE inside Postgres function
- Phase 34: Two-step ownership check on comment API (fetch report → verify student.coach_id) — same pattern as v1.2 Phase 23 fix
- Phase 35: Never call checkRateLimit() in GET /api/messages polling endpoint
- Phase 35: useInterval hook with useRef prevents stale closures and memory leaks
- Phase 36: CSP header (frame-src https://e.widgetbot.io) must be added to next.config.ts BEFORE writing DiscordEmbed component

### Wave Execution Order

- Wave 1: Phase 30 → Phase 31 (sequential, foundation)
- Wave 2: Phase 32 + Phase 33 + Phase 34 + Phase 37 (parallel, after Phase 30)
- Wave 3: Phase 35 + Phase 36 (parallel, after Phase 31)

- [v1.3 research]: Zero new npm dependencies — motion, lru-cache, zod, lucide-react all cover v1.3 needs at installed versions
- [v1.3 research]: plan_json needs a version: 1 field for schema evolution safety; always Zod safeParse at read, never TypeScript cast; treat parse failure as "no plan today"
- [v1.3 research]: Ad-hoc sessions after plan completion bypass the 4h cap server-side — cap enforcement in POST /api/work-sessions applies only when a daily plan exists for the day
- [v1.3 research]: Arabic text requires dir="rtl" lang="ar" attribute wrapper, not just text-right Tailwind class
- [v1.3 research]: WorkTracker phase-reset useEffect guard must be updated atomically with plan-mode changes — any new derived condition not exempted causes planner UI to silently reset on refresh
- [v1.3 research]: Coach undo must cascade re-lock step N+1 in the same request — single-row UPDATE leaves two concurrent active steps, breaking sequential progression
- [Phase 25-roadmap-config-stage-headers]: isLast prop is per-stage (stageSteps.length - 1) not global, so connecting lines stop at each stage boundary
- [Phase 25-roadmap-config-stage-headers]: stages array derived from ROADMAP_STEPS config at render time (not hardcoded) per Config-is-truth rule
- [Phase 26-database-schema-foundation]: D-01: Single migration 00013 for both tables — cohesive schema migration pattern
- [Phase 26-database-schema-foundation]: D-02: DEFAULT CURRENT_DATE on daily_plans.date; UTC enforcement is application-level via getTodayUTC()
- [Phase 26-database-schema-foundation]: D-03: Append-only roadmap_undo_log via RLS-only (no UPDATE/DELETE policies)
- [Phase 26-database-schema-foundation]: D-04: No DB-level JSONB constraints on plan_json; Zod safeParse enforcement at application layer (Phase 28)
- [Phase 27-coach-owner-roadmap-undo]: Cascade re-lock guards against completed N+1 steps using .eq('status','active') — only active steps are re-locked
- [Phase 27-coach-owner-roadmap-undo]: Audit log INSERT placed after successful revert — ensures log only records actual state transitions, never phantom undo events
- [Phase 28-01]: plan_json uses version:1 literal for schema evolution safety (D-07)
- [Phase 28-01]: GET /api/daily-plans omits CSRF and rate limit, consistent with /api/calendar read pattern
- [Phase 28-01]: 23505 conflict returns existing plan with status 200 (idempotent D-06) rather than erroring
- [Phase 28-02]: Plan-cap block inserted AFTER active-session conflict check and BEFORE insert — preserves all existing logic untouched
- [Phase 28-02]: getTodayUTC() used for plan lookup, never client-supplied date field — prevents cap bypass via date manipulation (Pitfall 1)
- [Phase 28-02]: Single query for completed sessions (select session_minutes) provides both count (fulfillment) and sum (cap check) — collapses 2 queries into 1 (Pitfall 4)
- [Phase 28-03]: useRef(useToast()) for stable ref pattern — keeps toast out of useCallback deps, consistent with existing routerRef convention
- [Phase 29-daily-session-planner-client]: initialPlan prop added to WorkTrackerClient with eslint-disable — consumed by plan 29-02 for conditional PlannerUI rendering
- [Phase 29-daily-session-planner-client]: rebuildBreaks() helper ensures last-session=none invariant on every add/remove mutation
- [Phase 29-daily-session-planner-client]: PlannerUI is standalone with onPlanConfirmed callback — no server data, calls router.refresh() + onPlanConfirmed after successful POST
- [Phase 29]: mode derived from server props (parsedPlan + completedCount) — never useState so it survives refresh without re-initialization race conditions
- [Phase 29]: handleStartWithConfig stores break config into state before setPhase(working) so handleComplete reads planned break duration correctly
- [Phase 35-01]: GET /api/messages has no rate limit — polling every 5s would exhaust 30 req/min cap in 2.5 min
- [Phase 35-01]: messages table TypeScript types added to types.ts manually to unblock compilation while migration 00015 is owned by parallel plan

- [Phase 30]: Single migration 00015 for all 4 tables and role CHECK ALTERs (D-03); student_diy blocked at app layer only, no RLS exclusion (D-04)
- [Phase 30]: report_comments UNIQUE on report_id for upsert pattern; messages uses is_broadcast + NULL recipient_id for broadcasts (D-01); read_at on messages for unread tracking (D-02)
- [Phase 33-coach-assignments]: D-04: Reuse existing /api/assignments route — expand role check to owner+coach, no separate endpoint

### Pending Todos

- Abu Lahya must add WidgetBot bot to Discord server before Phase 36 Discord embed can be tested in production
- Abu Lahya must confirm NEXT_PUBLIC_DISCORD_GUILD_ID and NEXT_PUBLIC_DISCORD_CHANNEL_ID in Vercel env before Phase 36 goes live
- Verify /api/auth/callback max_uses enforcement before writing Phase 37 migration (may already have cap check)
- Abu Lahya must supply AI chat iframe URL (carried from v1.0; non-blocking)

### Blockers/Concerns

- v1.5 D-06: "Tech/Email Setup Finished" roadmap step needs stakeholder confirmation at Monday meeting (placeholder Step 5 or 6). Non-blocking for requirements/roadmap phase — will resolve before Feature 5 execution.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260401-cwd | Coach 100h milestone alert (computed, coach-only) | 2026-04-01 | 4477e3f | [260401-cwd-add-coach-notification-for-100-hours-in-](./quick/260401-cwd-add-coach-notification-for-100-hours-in-/) |
| 260401-tuq | Fix work sessions production bugs: CSRF logging + daily_plans error handling | 2026-04-01 | e534448 | [260401-tuq-bug-work-sessions-fail-in-production-dia](./quick/260401-tuq-bug-work-sessions-fail-in-production-dia/) |
| Phase 31 P01 | 15 | 3 tasks | 4 files |
| Phase 31 P03 | 3 | 2 tasks | 4 files |
| Phase 31-student-diy-role P02 | 3min | 2 tasks | 4 files |
| Phase 32-skip-tracker P02 | 10 | 2 tasks | 3 files |
| Phase 33-coach-assignments P01 | 2 | 2 tasks | 2 files |
| Phase 33-coach-assignments P02 | 6min | 2 tasks | 2 files |
| Phase 34-report-comments P01 | 2 | 2 tasks | 4 files |
| Phase 34-report-comments P02 | 10 minutes | 2 tasks | 10 files |
| Phase 35 P01 | 25 | 2 tasks | 5 files |
| Phase 35 P02 | 160 | 2 tasks | 4 files |
| Phase 35-chat-system P04 | 312 | 1 tasks | 3 files |
| Phase 36-resources-tab P02 | 4m 24s | 2 tasks | 3 files |
| Phase 36-resources-tab P01 | 5 minutes | 2 tasks | 4 files |
| Phase 36-resources-tab P03 | 25min | 1 tasks | 9 files |
| Phase 37-invite-link-max-uses P01 | 8min | 1 tasks | 2 files |
| Phase 37 P02 | 5min | 2 tasks | 2 files |
| 260404-hgo | Fix student_diy role label display | 2026-04-04 | a5da893 | [260404-hgo-fix-student-diy-role-label-display](./quick/260404-hgo-fix-student-diy-role-label-display/) |

## Session Continuity

Last session: 2026-04-13
Stopped at: Milestone v1.5 initialized — defining requirements
Resume: run `/gsd-plan-phase [N]` after roadmap approved
