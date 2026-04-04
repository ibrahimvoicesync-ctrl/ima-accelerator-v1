# IMA Accelerator V1 — Rebuild Plan

**Date:** March 16, 2026
**Approach:** Clean rebuild from scratch using GSD framework + Supabase CLI
**Stack:** Next.js (App Router) + Supabase + Tailwind CSS + Google OAuth

---

## What Was Cut (vs. the old codebase)

### Features Removed
- **Tier System** (Bronze/Silver/Gold/Special) — all tier logic, badges, celebrations, progress bars
- **Leaderboard** — podium, rankings, snapshots, period tabs
- **Player Cards** — front/back, mini, preview, collectible card system
- **Streaks** — streak counter, milestones, streak-check cron
- **Focus Mode** — Pomodoro timer, goal input, break screens
- **Deals Tracking** — brand deals pipeline (pipeline/negotiating/closed/lost)
- **Call Scheduling** — coach-student call schedule, call cards, schedule modal
- **Notifications** — in-app notification system, mark-read, notification types
- **Email Notifications** — Resend integration, email templates
- **Settings Pages** — removed for all 3 roles (no name/niche editing in V1)
- **Influencer Tracking** — contacted/responded/signed pipeline
- **Cron Jobs** — inactive-check, streak-check
- **PostHog Analytics** — analytics tracking integration

### Database Tables Removed
- `deals`
- `influencers`
- `call_schedule`
- `notifications`
- `leaderboard_snapshots`

### Database Tables Kept
- `users` (simplified — remove streak_count, last_active_at)
- `invites`
- `magic_links`
- `work_sessions`
- `roadmap_progress`
- `daily_reports`

### Roles Kept (all 3, simplified)
- **Owner** — platform overview, manage coaches/students, invites, assignments, alerts
- **Coach** — view assigned students, review reports, invite students, basic analytics
- **Student** — work tracker, roadmap, daily reports, Ask Abu Lahya AI

---

## V1 Feature Set

### Auth & Access
- Google OAuth only (no password flows)
- Invite-only registration (invite codes)
- Magic link registration (alternative path)
- Role-based routing: `/owner`, `/coach`, `/student`
- No-access page for unauthorized users

### Owner Pages (7 pages)
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/owner` | Platform stats (total students, coaches, reports, active users) |
| Students | `/owner/students` | List all students with search/filter |
| Student Detail | `/owner/students/[id]` | View individual student progress |
| Coaches | `/owner/coaches` | List all coaches with stats |
| Coach Detail | `/owner/coaches/[id]` | View coach's assigned students and performance |
| Invites | `/owner/invites` | Send invite codes (coach + student) |
| Assignments | `/owner/assignments` | Assign/reassign students to coaches |
| Alerts | `/owner/alerts` | View alerts (inactive students, etc.) |

### Coach Pages (5 pages)
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/coach` | Overview of assigned students |
| Students | `/coach/students` | List assigned students |
| Student Detail | `/coach/students/[id]` | View student's reports, work sessions, roadmap |
| Reports | `/coach/reports` | Review submitted daily reports |
| Invites | `/coach/invites` | Invite new students |
| Analytics | `/coach/analytics` | Basic performance stats (report rates, student activity) |

### Student Pages (4 pages)
| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/student` | Overview (today's cycles, roadmap progress, report status) |
| Work Tracker | `/student/work` | Cycle-based work timer (start/complete 45-min sessions) |
| Roadmap | `/student/roadmap` | 10-step progress tracker (locked → active → completed) |
| Daily Report | `/student/report` | Submit daily report (hours, star rating, wins, improvements) |
| Ask Abu Lahya | `/student/ask` | AI chat iframe |

### API Routes (mutation-only, server components handle reads)
- `POST /api/invites` — create invite
- `POST /api/invites/[id]/resend` — resend invite
- `POST /api/magic-links` — create magic link
- `DELETE /api/magic-links/[id]` — delete magic link
- `POST /api/work-sessions` — start work session
- `PATCH /api/work-sessions/[id]` — complete/abandon session
- `POST /api/reports` — submit daily report
- `PATCH /api/reports/[id]/review` — coach reviews report
- `POST /api/roadmap` — update roadmap step status
- `PATCH /api/students/[id]` — update student (coach assignment)
- `POST /api/assignments` — assign students to coaches
- `PATCH /api/alerts/[id]/acknowledge` — acknowledge alert
- `GET /api/auth/callback` — OAuth callback

---

## Tech Stack & Tooling

### Development Workflow
- **GSD Framework** for Claude Code — spec-driven development with fresh sub-agent contexts
  - Install: `npx get-shit-done-cc@latest`
  - Flow: `/gsd:new-project` → `/gsd:discuss-phase` → `/gsd:plan-phase` → `/gsd:execute-phase` → `/gsd:verify-work`
- **Supabase CLI** for local development
  - `supabase init` → `supabase start` for local Postgres + Auth + Studio
  - Version-controlled migrations in `supabase/migrations/`
  - `supabase gen types typescript` for auto-generated TypeScript types
  - `supabase db push` to deploy to production

### Stack Details
| Layer | Tech |
|-------|------|
| Framework | Next.js (App Router, server components) |
| Language | TypeScript (strict) |
| Database | Supabase Postgres + RLS |
| Auth | Supabase Auth (Google OAuth) |
| Styling | Tailwind CSS with design tokens |
| Hosting | Vercel (or similar) |

### Architecture Principles (carried over, simplified)
- Server components for all data fetching (async pages, no useEffect)
- `createAdminClient()` for server-side queries
- Small `"use client"` components only for interactivity (forms, modals, timers)
- Filters/search/pagination via URL `searchParams`
- Zod validation on all API inputs
- RLS + server-side user ID filtering (defense in depth)

---

## Database Schema (V1 — simplified)

### `users`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
auth_id uuid UNIQUE
email varchar(255) NOT NULL UNIQUE
name varchar(255) NOT NULL
role varchar(20) NOT NULL CHECK (role IN ('owner', 'coach', 'student'))
coach_id uuid REFERENCES users(id)
niche varchar(255)
status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'))
joined_at timestamptz DEFAULT now()
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### `invites`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
email varchar(255) NOT NULL
role varchar(20) NOT NULL CHECK (role IN ('coach', 'student'))
invited_by uuid NOT NULL REFERENCES users(id)
coach_id uuid REFERENCES users(id)
code varchar(64) NOT NULL UNIQUE
used boolean DEFAULT false
expires_at timestamptz NOT NULL
created_at timestamptz DEFAULT now()
```

### `magic_links`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
invite_id uuid NOT NULL REFERENCES invites(id)
token varchar(128) NOT NULL UNIQUE
used boolean DEFAULT false
expires_at timestamptz NOT NULL
created_at timestamptz DEFAULT now()
```

### `work_sessions`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id uuid NOT NULL REFERENCES users(id)
date date NOT NULL
cycle_number integer NOT NULL CHECK (cycle_number BETWEEN 1 AND 4)
started_at timestamptz NOT NULL
completed_at timestamptz
duration_minutes integer DEFAULT 0
status varchar(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
created_at timestamptz DEFAULT now()
```

### `roadmap_progress`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id uuid NOT NULL REFERENCES users(id)
step_number integer NOT NULL CHECK (step_number BETWEEN 1 AND 10)
step_name varchar(255) NOT NULL
status varchar(20) DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'completed'))
completed_at timestamptz
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### `daily_reports`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id uuid NOT NULL REFERENCES users(id)
date date NOT NULL
hours_worked decimal(4,2) DEFAULT 0
star_rating integer CHECK (star_rating BETWEEN 1 AND 5)
outreach_count integer DEFAULT 0
wins text
improvements text
submitted_at timestamptz
reviewed_by uuid REFERENCES users(id)
reviewed_at timestamptz
created_at timestamptz DEFAULT now()
```

---

## GSD Milestone Phases (suggested)

### Phase 1 — Foundation
- Supabase CLI setup (`supabase init`, migrations for all 6 tables, RLS policies, seed data)
- Next.js project setup (App Router, Tailwind, TypeScript)
- Supabase client helpers (browser client, server client, admin client)
- Auth flow (Google OAuth, callback, invite-code registration, magic links)
- Proxy/middleware for route protection
- Shared UI components (Button, Card, Input, Modal, Badge, Table, Skeleton)

### Phase 2 — Student Pages
- Student dashboard (today's overview)
- Work tracker (cycle timer — start, complete, abandon)
- Roadmap (10-step progress, update status)
- Daily report form (submit hours, rating, wins, improvements)
- Ask Abu Lahya (AI iframe embed)

### Phase 3 — Coach Pages
- Coach dashboard (assigned students overview)
- Student list (search, view assigned)
- Student detail (view reports, work sessions, roadmap for a student)
- Report review (mark reports as reviewed)
- Coach invites (send student invite codes)
- Basic analytics (report submission rates, student activity)

### Phase 4 — Owner Pages
- Owner dashboard (platform-wide stats)
- Student list + detail views
- Coach list + detail views
- Invite system (send coach + student invites)
- Coach-student assignments
- Alerts (inactive students, unreviewed reports)

### Phase 5 — Polish & Deploy
- Loading skeletons for all pages
- Error boundaries
- Empty states with CTAs
- Mobile responsiveness pass
- Accessibility pass (44px touch targets, ARIA labels)
- Production deployment

---

## Setup Instructions (for Claude Code with GSD)

```bash
# 1. Create new project directory
mkdir ima-accelerator-v1 && cd ima-accelerator-v1

# 2. Install GSD
npx get-shit-done-cc@latest
# Choose: Claude Code, local install

# 3. Initialize Supabase
npx supabase init

# 4. Start local Supabase (requires Docker)
npx supabase start

# 5. Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# 6. Start GSD workflow
# In Claude Code:
/gsd:new-project
# Describe IMA Accelerator V1, reference this plan
```

---

## Notes
- This plan deliberately keeps things simple. Features like leaderboards, tiers, player cards, and streaks can be added as a future milestone via `/gsd:new-milestone`.
- The old codebase in `ima-accelerator-v2.zip` can be referenced for implementation patterns but should NOT be copied wholesale.
- All gamification is V2+ scope.
