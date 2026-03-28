# IMA Accelerator V1

## What This Is

A student performance and coaching management platform for Abu Lahya's halal influencer marketing mentorship program. Three roles — owner (platform admin), coaches (mentors), and students (aspiring influencer marketing agents) — each with dedicated dashboards to track work sessions, roadmap progress, daily reports, and coaching relationships. Built as a clean rebuild from a more complex previous version, shipped as v1.0 with full accountability loop.

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

### Active

<!-- Current scope. Building toward these for v1.1. -->

- ✓ Flexible work sessions — student-selectable durations (30/45/60 min), breaks between cycles, no cycle cap — Validated in Phase 14
- [ ] Progress tracker / email KPIs — granular outreach tracking, sticky progress banner, 2,500 lifetime / 50 daily targets
- [ ] Coach/owner student KPI visibility — read-only progress on coach and owner detail pages
- ✓ Calendar view — month grid replacing work sessions + reports tabs on student detail pages — Validated in Phase 17
- [ ] Roadmap date KPIs — target deadlines per step relative to joined_at, on-track/due-soon/overdue status
- [ ] Roadmap completion date logging — display completed_at timestamps on roadmap steps

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

## Context

**Shipped v1.0** on 2026-03-18 with 12,742 LOC TypeScript across 298 files.
Tech stack: Next.js 16 (App Router), Supabase (Auth + Postgres + RLS), Tailwind CSS 4, TypeScript strict.
12 phases, 38 plans, 218 commits over 3 days.

**v1.1 Phase 13 complete** (2026-03-27): Schema & config foundation — migration adds session_minutes, drops cycle cap, adds 5 KPI columns. Config exports session duration options, KPI targets, roadmap target_days, and getTodayUTC utility.

**v1.1 Phase 14 complete** (2026-03-27): Flexible work sessions — session_minutes on types/API, breakOptions config, formatHoursMinutes utility, state-machine WorkTracker UI (idle/setup/working/break), duration picker, break countdown, hours-based progress bars, dynamic session list, no cycle cap.

**v1.1 Phase 17 complete** (2026-03-28): Calendar view — CalendarTab with react-day-picker month grid, green/amber activity dots, inline day detail panel. Gap closure fixed UTC/local timezone off-by-one in day selection and replaced server-side month navigation with client-side fetch to /api/calendar endpoint. Replaced Work Sessions + Reports tabs on coach and owner student detail pages.

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
- **Database**: Supabase Postgres with RLS + server-side user ID filtering (defense in depth), 6 tables (users, invites, magic_links, work_sessions, roadmap_progress, daily_reports) + alert_dismissals
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

## Current Milestone: v1.1 V2 Feature Build

**Goal:** Add flexible work sessions, granular outreach KPIs, coach/owner KPI visibility, calendar view, and roadmap deadline tracking.

**Target features:**
- Flexible work sessions (student-selectable durations, breaks, no cycle cap)
- Progress tracker / email KPIs (granular outreach, sticky banner, 2,500/50 targets)
- Coach/owner student KPI visibility (read-only progress views)
- Calendar view (month grid on student detail pages)
- Roadmap date KPIs (deadlines relative to joined_at)
- Roadmap completion date logging (completed_at display)

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
*Last updated: 2026-03-28 after Phase 17 completion*
