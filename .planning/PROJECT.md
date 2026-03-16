# IMA Accelerator V1

## What This Is

A student performance and coaching management platform for Abu Lahya's halal influencer marketing mentorship program. Three roles — owner (platform admin), coaches (mentors), and students (aspiring influencer marketing agents) — each with dedicated dashboards to track work sessions, roadmap progress, daily reports, and coaching relationships. This is a clean rebuild from a more complex previous version, stripped down to essentials.

## Core Value

Students can track their daily work, follow the 10-step roadmap from joining the course to closing their first brand deal, and submit daily reports that coaches review — the core accountability loop that drives student progress.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Google OAuth login with invite-only registration
- [ ] Role-based routing and access control (owner/coach/student)
- [ ] Student work tracker (45-min cycles, 4 per day, start/complete/abandon)
- [ ] Student 10-step roadmap (locked → active → completed progression)
- [ ] Student daily reports (hours, star rating 1-5, outreach count, wins, improvements)
- [ ] Ask Abu Lahya AI chat (iframe embed, URL TBD)
- [ ] Coach dashboard with assigned students overview
- [ ] Coach report review (mark reports as reviewed)
- [ ] Coach student invites
- [ ] Coach basic analytics (report rates, student activity)
- [ ] Owner platform-wide stats dashboard
- [ ] Owner student and coach management (list, detail, search)
- [ ] Owner invite system (coach + student invites, magic links)
- [ ] Owner coach-student assignments
- [ ] Owner alerts (inactive students, unreviewed reports, coach underperformance)
- [ ] Shared UI components matching old codebase visual style
- [ ] Loading skeletons, error boundaries, empty states
- [ ] Mobile responsiveness and accessibility (44px touch targets, ARIA)

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

**Previous version:** A full-featured codebase exists in `reference-old/` with complete implementation of all cut features. Reference it for visual patterns, component structure, and implementation approaches — but don't copy wholesale.

**Platform purpose:** Abu Lahya runs an influencer marketing accelerator. Students learn to become influencer marketing agents — finding influencers, signing them, then closing brand deals. The platform tracks their daily work discipline and progress through a structured 10-step roadmap.

**Roadmap steps (from config):**
1. Join the Course (auto-complete on signup)
2. Plan Your Work
3. Pick Your Niche
4. Build Your Website
5. Send Your First Email
6. Get Your First Response
7. Close Your First Influencer
8. Close 5 Influencers
9. Brand Outreach
10. Close Your First Brand Deal

**Work tracker rules:**
- 45-minute sessions with 15-minute breaks
- 4 cycles per day (4-hour daily goal)
- Sessions can be started, completed, or abandoned
- 5-minute grace period before abandon

**Daily report fields:**
- Hours worked (auto-filled from work sessions)
- Star rating (1-5, required)
- Outreach count (required)
- Wins (optional, max 500 chars)
- Improvements (optional, max 500 chars)
- Deadline: 11 PM

**Invite system:**
- Invite codes expire after 72 hours
- Owner can invite coaches and students
- Coaches can invite students only
- Students cannot invite anyone
- Magic links as alternative registration path

**Alert triggers (owner):**
- Student inactive: no work session for 3 days
- Student dropoff: no login for 7 days
- Coach underperforming: avg student rating < 2.5 for 14 days
- Unreviewed reports

**AI chat:** Existing hosted chatbot — embed via iframe. URL to be provided later, use placeholder for now.

**Coach config:**
- At-risk threshold: 3 days inactive or rating < 2
- Max 50 students per coach
- Report inbox shows last 7 days

## Constraints

- **Tech stack**: Next.js App Router + Supabase + Tailwind CSS + TypeScript strict — matching old codebase stack
- **Auth**: Google OAuth only, no password flows — Supabase Auth handles OAuth, credentials in Supabase Dashboard
- **Architecture**: Server components for all reads (async pages, no useEffect), small "use client" components only for interactivity, createAdminClient() for server queries
- **Database**: Supabase Postgres with RLS + server-side user ID filtering (defense in depth), 6 tables only (users, invites, magic_links, work_sessions, roadmap_progress, daily_reports)
- **Styling**: Must match old codebase visual style — light theme, blue primary (#2563EB), Inter font, ima-* design tokens, CVA-based UI primitives
- **Validation**: Zod on all API inputs, safeParse pattern
- **Access**: Invite-only registration, role-based route guards via proxy (not middleware)

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Clean rebuild vs. migrate old code | Old codebase too tangled with cut features; rebuild is faster and cleaner | — Pending |
| 6 tables only (cut 5 from old schema) | Removed deals, influencers, call_schedule, notifications, leaderboard_snapshots to match V1 scope | — Pending |
| Google OAuth only | Simplifies auth flow, no password management needed | — Pending |
| Iframe for AI chat | Abu Lahya has existing chatbot, just embed it | — Pending |
| Match old visual style | Continuity for users, proven design patterns in reference-old/ | — Pending |
| Supabase CLI for local dev | Version-controlled migrations, local Postgres + Auth + Studio | — Pending |

---
*Last updated: 2026-03-16 after initialization*
