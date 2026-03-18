# Phase 1: Foundation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffold (Next.js 16, TypeScript strict, Tailwind v4, ESLint, path aliases), Supabase setup (local dev, schema migration for 6 tables, RLS policies, admin client, SSR client), and config + proxy (lib/config.ts, proxy.ts route guard, dashboard layout shell). No feature logic — just the infrastructure that makes all other phases possible.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout shell
- Collapsible sidebar: full sidebar with icons + labels on desktop, collapses to icon-only or hamburger drawer on mobile
- Sidebar bottom shows user name + role badge (Owner/Coach/Student) + sign-out button
- Page content area has a clean page title header on the left (no breadcrumbs)
- Sidebar always starts expanded on page load (no localStorage persistence of collapse state)
- Mobile sidebar: overlay with dark backdrop, tap backdrop to close (not push content)

### V1 navigation items
- **Owner (6 items with separator):** Dashboard, Coaches, Students | Invites, Assignments, Alerts
  - Visual separator between viewing pages (Dashboard/Coaches/Students) and action pages (Invites/Assignments/Alerts)
- **Coach (5 items with separator):** Dashboard, My Students, Reports | Invite Students, Analytics
  - Visual separator between daily work (Dashboard/My Students/Reports) and admin (Invite Students/Analytics)
  - Badge on Reports nav item showing unreviewed report count
- **Student (5 items):** Dashboard, Work Tracker, Roadmap, Ask Abu Lahya, Daily Report
  - Ask Abu Lahya positioned above Daily Report (4th position, not last)
  - No separators needed for student nav

### Config simplification
- Write a minimal fresh config.ts with only V1 sections (~300 lines, no V2 stubs)
- V1 sections: app meta, roles, routes, work tracker, roadmap steps, daily report, coach config, owner config, invite config, AI config, theme, navigation, validation
- No SCHEMA object in config — schema lives in SQL migrations only; TypeScript types generated via `supabase gen types typescript`
- No granular PERMISSIONS arrays — roles are sufficient for V1; route guards + RLS handle access
- Keep `niche` column on users table (useful context for coaches, can be set during registration or by coach/owner)
- No V2 sections: no tiers, leaderboard, player cards, streaks, focus mode, deals, notifications, analytics config, email templates

### Local dev seed data
- Full realistic seed: 1 owner, 2 coaches, 5 students with coach assignments
- Include varied data: some active/inactive students, various roadmap progress levels, sample work sessions, sample daily reports (some reviewed, some not)
- Owner email: `ibrahim@inityx.org` — seeded with null auth_id, linked after first Google OAuth login
- Seed user rows only (no auth users) — auth_id linked via OAuth callback on first login

### Claude's Discretion
- Exact sidebar width and collapse breakpoint
- Animation/transition style for sidebar collapse
- Specific Lucide icons for each nav item
- Tailwind v4 configuration approach (CSS-first config vs tailwind.config.ts)
- ESLint rule configuration details
- Path alias structure (@/ vs ~/src/)
- RLS policy naming and structure (can reference old migration patterns)
- Exact seed data values (student names, dates, progress levels)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, tech stack, key decisions, architecture principles
- `.planning/REQUIREMENTS.md` — All 37 V1 requirements with phase mapping
- `.planning/ROADMAP.md` — Phase 1 success criteria, plan breakdown, full phase dependency chain
- `IMA-V1-REBUILD-PLAN.md` — Rebuild rationale, V1 feature set, database schema, API routes, cut features list

### Reference implementation
- `reference-old/src/proxy.ts` — Route guard implementation pattern (proxy.ts not middleware.ts)
- `reference-old/src/lib/config.ts` — Full config structure (strip V2 sections for V1)
- `reference-old/src/lib/supabase/admin.ts` — createAdminClient() pattern (server-only, service-role)
- `reference-old/src/lib/supabase/server.ts` — SSR client pattern (@supabase/ssr)
- `reference-old/supabase/migrations/00001_create_tables.sql` — Schema, RLS policies, helper functions (strip V2 tables)
- `reference-old/tailwind.config.ts` — ima-* design tokens, color palette, animations
- `reference-old/CLAUDE.md` — Architecture rules, hard rules, code quality standards

### Supabase config
- `supabase/config.toml` — Local Supabase configuration (already initialized)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/proxy.ts` — Complete route guard implementation; needs V1 simplification (remove leaderboard access, adjust route maps)
- `reference-old/src/lib/supabase/` — All 3 client patterns (admin, server, browser) ready to adapt
- `reference-old/src/lib/config.ts` — Navigation structure, roadmap steps, work tracker config, validation rules — strip V2 sections
- `reference-old/tailwind.config.ts` — Full ima-* color token set; remove tier/brand/warm colors for V1
- `reference-old/supabase/migrations/00001_create_tables.sql` — RLS policy patterns, helper functions (get_user_id, get_user_role, handle_updated_at, restrict_self_update)

### Established Patterns
- Server components for reads, "use client" only for interactivity
- createAdminClient() with `server-only` import guard
- proxy.ts uses service-role client to bypass RLS for role lookups during auth flow
- RLS uses get_user_role() / get_user_id() SQL functions (SECURITY DEFINER)
- Defense in depth: RLS + server-side user ID filtering

### Integration Points
- `supabase/config.toml` already initialized (project_id: ima-accelerator-v1)
- `.env.local` needed for Supabase keys (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- Google OAuth configured in Supabase Dashboard (Auth > Providers > Google), not in .env

</code_context>

<specifics>
## Specific Ideas

- Navigation separators: owner separates viewing vs action pages, coach separates daily work vs admin tasks
- Coach Reports nav item gets a badge with unreviewed count — visual cue for pending work
- Student nav puts Ask Abu Lahya before Daily Report (4th position) to encourage AI chat usage
- Seed data should create realistic "day in the life" scenarios — some students mid-cycle, some at-risk, some with unreviewed reports

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-16*
