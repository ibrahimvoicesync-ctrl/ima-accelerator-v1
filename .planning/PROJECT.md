# IMA Accelerator V1

## What This Is

A student performance and coaching management platform for Abu Lahya's halal influencer marketing mentorship program. Four roles — owner (platform admin), coaches (mentors), students (full-program learners), and student_diy (self-service learners) — each with dedicated dashboards to track work sessions, roadmap progress, daily reports, coach-student chat, and shared resources. Built as a clean rebuild from a more complex previous version, now at v1.4 with chat, resources, and expanded role system.

## Core Value

Students can track their daily work, follow the 10-step roadmap from joining the course to closing their first brand deal, and submit daily reports that coaches review — the core accountability loop that drives student progress.

## Requirements

### Validated

<!-- Shipped and confirmed working in v1.0. -->

- ✓ Google OAuth login with invite-only registration — v1.0
- ✓ Role-based routing and access control (owner/coach/student) — v1.0
- ✓ Student work tracker (45-min cycles, 4 per day, start/complete/abandon) — v1.0, updated in Phase 14
- ✓ Student 10-step roadmap (locked → active → completed progression) — v1.0
- ✓ Student daily reports (hours, star rating 1-5, outreach count, wins, improvements) — v1.0
- ✓ Ask Abu Lahya AI chat (iframe embed, Coming Soon state) — v1.0
- ✓ Coach dashboard with assigned students overview — v1.0
- ✓ Coach report review (mark reports as reviewed) — v1.0
- ✓ Coach student invites (email whitelist model) — v1.0
- ✓ Coach basic analytics (report rates, student activity) — v1.0
- ✓ Owner platform-wide stats dashboard — v1.0
- ✓ Owner student and coach management (list, detail, search) — v1.0
- ✓ Owner invite system (coach + student invites, magic links) — v1.0
- ✓ Owner coach-student assignments — v1.0
- ✓ Owner alerts (inactive students, unreviewed reports, coach underperformance) — v1.0
- ✓ Shared UI components matching old codebase visual style — v1.0
- ✓ Loading skeletons, error boundaries, empty states — v1.0
- ✓ Mobile responsiveness and accessibility (44px touch targets, ARIA) — v1.0
- ✓ Flexible work sessions — student-selectable durations (30/45/60 min), breaks, no cycle cap — v1.1
- ✓ Progress tracker / email KPIs — granular outreach tracking, sticky progress banner, RAG colors — v1.1
- ✓ Coach/owner student KPI visibility — read-only KPI summary on coach and owner detail pages — v1.1
- ✓ Calendar view — month grid on student detail pages replacing work sessions + reports tabs — v1.1
- ✓ Roadmap date KPIs — deadline status chips per roadmap step, completed_at display — v1.1
- ✓ Database indexes + admin client singleton + RLS initplan fix + monitoring baseline — v1.2
- ✓ RPC consolidation (owner 8→2 round trips) + React cache() + unstable_cache + server-side pagination — v1.2
- ✓ pg_cron nightly KPI pre-aggregation + optimistic UI on report submission — v1.2
- ✓ DB-backed rate limiting (30 req/min/user) on all mutation routes — v1.2
- ✓ Security audit: auth/RLS verification, CSRF Origin headers, cross-student isolation — v1.2
- ✓ Infrastructure validation: local Docker k6 load tests confirm P95<1s at 5k students — v1.2
- ✓ Roadmap step description updates + stage headers in all views — v1.3
- ✓ Coach/owner roadmap undo with cascade re-lock and audit logging — v1.3
- ✓ Daily session planner (API + client) — 4h cap, auto breaks, planned execution — v1.3
- ✓ Post-plan motivational card (Arabic + English) + ad-hoc session picker — v1.3
- ✓ Student_DIY role — 4th role (dashboard + work tracker + roadmap only) — v1.4
- ✓ Skip tracker — "X days skipped this week" badges on coach/owner dashboards — v1.4
- ✓ Coach assignments — coaches get same assignment power as owner — v1.4
- ✓ Report comments — single coach comment per daily report, student read-only view — v1.4
- ✓ Chat system — polling-based 1:1 + broadcast, sidebar unread badges — v1.4
- ✓ Resources tab — URL links + Discord WidgetBot embed + searchable glossary — v1.4
- ✓ Invite link configurable max_uses — default 10, usage count display — v1.4

### Active

<!-- Current scope. Building toward these. -->

## Current Milestone: v1.5 Student Deals

**Goal:** Students can track closed deals with revenue and profit; coaches and owners can view and manage deal history on student detail pages.

**Target features:**
- Deals table with auto-incremented deal_number per student
- Student Deals page — add (revenue + profit), edit, delete, view history
- Dashboard stats for both student and student_diy: Deals Closed, Total Revenue, Total Profit
- Both student and student_diy roles get the Deals page
- Coach/Owner Deals tab on student detail pages — summary + paginated list (25/page)
- Coach can delete assigned student deals; owner can delete any
- Performance: index, RLS initplan, rate limiting, useOptimistic, paginated

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Tier system (Bronze/Silver/Gold/Special) — gamification is V2+
- Leaderboard and rankings — gamification is V2+
- Player cards and collectibles — gamification is V2+
- Streaks and streak milestones — gamification is V2+
- Focus mode / Pomodoro — simplifying work tracker to basic cycles
- Deals tracking pipeline — V2+ feature
- Influencer tracking pipeline — V2+ feature
- Call scheduling — V2+ feature
- In-app notifications system — V2+ feature
- Email notifications (Resend) — V2+ feature
- Settings pages for any role — no name/niche editing in V1
- PostHog analytics — V2+ feature
- Cron jobs (inactive-check, streak-check) — V2+ feature
- Supavisor/connection pooler setup — PostgREST has built-in connection pooler
- Redis/Upstash cache — evaluate only if Phase 24 load testing proves Next.js cache insufficient

## Context

**Shipped v1.0** on 2026-03-18 with 12,742 LOC TypeScript across 298 files.
Tech stack: Next.js 16 (App Router), Supabase (Auth + Postgres + RLS), Tailwind CSS 4, TypeScript strict.
12 phases, 38 plans, 218 commits over 3 days.

**v1.1 Phase 13 complete** (2026-03-27): Schema & config foundation — migration adds session_minutes, drops cycle cap, adds 5 KPI columns. Config exports session duration options, KPI targets, roadmap target_days, and getTodayUTC utility.

**v1.1 Phase 14 complete** (2026-03-27): Flexible work sessions — session_minutes on types/API, breakOptions config, formatHoursMinutes utility, state-machine WorkTracker UI (idle/setup/working/break), duration picker, break countdown, hours-based progress bars, dynamic session list, no cycle cap.

**v1.1 Phase 17 complete** (2026-03-28): Calendar view — CalendarTab with react-day-picker month grid, green/amber activity dots, inline day detail panel. Gap closure fixed UTC/local timezone off-by-one in day selection and replaced server-side month navigation with client-side fetch to /api/calendar endpoint. Replaced Work Sessions + Reports tabs on coach and owner student detail pages.

**v1.1 Phase 18 complete** (2026-03-28): Roadmap date KPIs & completion logging — `getDeadlineStatus()` utility with 5-state discriminated union (none/completed/on-track/due-soon/overdue), UTC-safe date math. Badge chips on student RoadmapStep and shared coach/owner RoadmapTab. Progress bar fixed from /10 to /15.

**v1.1 milestone complete** (2026-03-28): 6 phases (13-18), 16 plans. Flexible work sessions, outreach KPI banner, coach/owner KPI visibility, calendar view, roadmap date KPIs all shipped. Supabase Pro plan active.

**v1.2 Phase 21 complete** (2026-03-30): Write path & pre-aggregation — student_kpi_summaries table with nightly pg_cron refresh (advisory lock, incremental skip, streak computation), get_student_detail reads from summary table with fallback. React 19 useOptimistic on report submission for instant feedback. Write path audit confirms both endpoints optimal at 4 DB calls each.

**v1.2 Phase 22 complete** (2026-03-30): Spike protection & rate limiting — rate_limit_log table (migration 00012) with covering index, RLS, pg_cron 2-hour cleanup. checkRateLimit() helper with atomic COUNT + INSERT. All 10 mutation routes (9 files) rate-limited at 30 req/min per user per endpoint with 429 + Retry-After responses.

**v1.2 Phase 23 complete** (2026-03-30): Security audit — 3-layer audit of all 12 API routes (auth, proxy, RLS), verifyOrigin() CSRF helper on all 10 mutation routes, reports/[id]/review ownership leak fixed (404 instead of 403). Gap closure: optimistic session state update eliminates timer startup delay, CycleCard shows "In progress" instead of redundant countdown for active sessions.

**v1.2 milestone complete** (2026-03-31): 6 phases (19-24), 18 plans. Database indexes, RPC consolidation, server-side pagination, pg_cron pre-aggregation, rate limiting, security audit, load testing all shipped. Local Docker k6 confirms P95<1s at 5k students. Pro Small compute confirmed adequate.

**v1.3 Phase 25 complete** (2026-03-31): Roadmap config & stage headers — ROADMAP_STEPS updated with parenthetical time guidance on steps 1-8, Step 5 unlock URL set to skool CRM, Step 6 URL cleared, Step 6/7 descriptions rewritten, Step 8 target_days set to 14. Stage headers (Setup & Preparation, Influencer Outreach, Brand Outreach) added to student, coach, and owner roadmap views.

**v1.3 Phase 28 complete** (2026-03-31): Daily session planner API — planJsonSchema Zod module (version:1, 240-min cap, config-driven session options), POST/GET /api/daily-plans with idempotent 23505 conflict handling, plan-aware cap enforcement in POST /api/work-sessions (block without plan, enforce cap while unfulfilled, lift after completion).

**v1.3 milestone complete** (2026-04-03): 5 phases (25-29), 11 plans. Roadmap config & stage headers, coach/owner undo, daily session planner (API + client), motivational card + ad-hoc sessions all shipped.

**v1.4 milestone complete** (2026-04-06): 8 phases (30-37), 19 plans, 143 commits over 2 days. Student_DIY role, skip tracker, coach assignments, report comments, chat system, resources tab, invite max_uses all shipped. Codebase at 50,816 LOC TypeScript.

**v1.5 Phase 38 complete** (2026-04-06): Database foundation — deals table (00021_deals.sql) with numeric(12,2) revenue/profit, auto-increment deal_number trigger (FOR UPDATE race-safe), 8 RLS policies (initplan pattern), composite index. Deal type added to types.ts. Migration applied to live Supabase.

**Platform purpose:** Abu Lahya runs an influencer marketing accelerator. Students learn to become influencer marketing agents — finding influencers, signing them, then closing brand deals. The platform tracks their daily work discipline and progress through a structured 10-step roadmap.

**Invite system (v1.0):** Email whitelist model — no registration URL generated. Coach/owner enters email, auth callback auto-registers whitelisted users on Google sign-in. Magic links available as alternative.

**Known pending items:**
- AI chat iframe URL not yet provided by Abu Lahya (infra wired, Coming Soon displayed)
- `types.ts` is hand-crafted placeholder (regenerate when Docker + local Supabase running)
- `POST /api/auth/signout` is dead code (Sidebar uses client SDK signOut directly)

## Constraints

- **Tech stack**: Next.js App Router + Supabase + Tailwind CSS + TypeScript strict
- **Auth**: Google OAuth only, no password flows — Supabase Auth handles OAuth
- **Architecture**: Server components for all reads (async pages, no useEffect), small "use client" components only for interactivity, createAdminClient() for server queries
- **Database**: Supabase Postgres with RLS + server-side user ID filtering (defense in depth), 14 tables (users, invites, magic_links, work_sessions, roadmap_progress, daily_reports, report_comments, messages, resources, glossary_terms, alert_dismissals, daily_plans, roadmap_undo_log, student_kpi_summaries) + rate_limit_log
- **Styling**: Light theme, blue primary (#2563EB), Inter font, ima-* design tokens, CVA-based UI primitives
- **Validation**: Zod on all API inputs, safeParse pattern
- **Access**: Invite-only registration, role-based route guards via proxy (not middleware)

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clean rebuild vs. migrate old code | Old codebase too tangled with cut features; rebuild is faster and cleaner | ✓ Good — 3-day build, clean architecture |
| 6 tables only (cut 5 from old schema) | Removed deals, influencers, call_schedule, notifications, leaderboard_snapshots to match V1 scope | ✓ Good — minimal schema, all V1 features supported |
| Google OAuth only | Simplifies auth flow, no password management needed | ✓ Good — single auth path, no security surface area |
| Iframe for AI chat | Abu Lahya has existing chatbot, just embed it | ✓ Good — infra wired, awaiting URL |
| Match old visual style | Continuity for users, proven design patterns in reference-old/ | ✓ Good — ima-* tokens consistent throughout |
| Supabase CLI for local dev | Version-controlled migrations, local Postgres + Auth + Studio | ✓ Good — single migration file covers all V1 |
| Email whitelist model for invites | Avoids broken registration URLs; auth callback auto-registers | ✓ Good — simplified flow, resolved Phase 11 gap |
| proxy.ts not middleware.ts | Next.js 16 breaking change; route guard runs in proxy | ✓ Good — works correctly with App Router |
| Resume shifts started_at forward | Client timer needs no elapsed accumulator; Date.now() - started_at always equals active work time | ✓ Good — simple timer math |
| alert_dismissals with time-windowed keys | Dismissed alerts re-trigger in new window (daily/weekly/monthly) | ✓ Good — prevents stale dismissals masking new issues |
| Phase 24 | Compute sizing: STAY on Pro Small — local Docker k6 load tests with 5k students show P95=929.76ms read-mix (100 VUs), P95=6.74ms write-spike (500 VUs), P95=240.51ms combined (350 VUs). All under 1s threshold. Connection usage low. Write ops extremely fast; read aggregation RPCs are the bottleneck but pass. Cloud Pro Small has lower max_connections (60 vs local 100) — monitor if cloud P95 exceeds 1s. | 2026-03-30 |
| v1.4 D-01 | "This week" = Monday-Sunday (ISO week) for skip tracker | Owner preference | ✓ Good |
| v1.4 D-02 | Coaches get full assignment power (any student → any coach) | Same UX as owner | ✓ Good |
| v1.4 D-03 | Report comments: single comment per report, coach-only | Keep simple | ✓ Good |
| v1.4 D-04 | Student_DIY: NO coach assignment, fully independent | DIY = self-service | ✓ Good |
| v1.4 D-05 | Student_DIY: NO Ask Abu Lahya, NO Daily Report, NO Resources tab | Reduced feature set | ✓ Good |
| v1.4 D-06 | Student_DIY: YES dashboard, YES work tracker, YES roadmap | Core tools kept | ✓ Good |
| v1.4 D-07 | Chat: polling-based (5s interval), not Supabase Realtime | Avoids 500 peak connection limit on Pro plan | ✓ Good |
| v1.4 D-08 | Chat: coach↔individual student + coach→all broadcast | Two chat modes | ✓ Good |
| v1.4 D-09 | Chat: students CAN reply to coaches | Two-way async | ✓ Good |
| v1.4 D-10 | Discord: WidgetBot iframe embed | Full Discord experience, no npm package | ✓ Good |
| v1.4 D-11 | Resources visible to owner, coach, student — NOT student_diy | Per requirement | ✓ Good |
| v1.4 D-12 | Glossary managed by owner + coaches | Both roles can CRUD | ✓ Good |
| v1.4 D-13 | Invite link default max_uses: 10 (was null/unlimited) | Per requirement | ✓ Good |
| v1.4 D-14 | Role type expands to 4: owner, coach, student, student_diy | New 4th role | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after Phase 39 complete — deal CRUD API route handlers*
