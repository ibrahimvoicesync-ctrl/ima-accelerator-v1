# Project Research Summary

**Project:** IMA Accelerator V1 — Influencer Marketing Academy Coaching Platform
**Domain:** Multi-role coaching / student accountability platform
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

IMA Accelerator V1 is a three-role coaching platform (owner, coach, student) built around a daily accountability loop: students track 45-minute work sessions, submit daily reports, and advance through a structured 10-step roadmap. Coaches monitor assigned students and review reports. The owner (Abu Lahya) monitors program health and intervenes proactively via an alert system. All research is HIGH confidence — derived from a working reference codebase (`reference-old/`), verified npm versions, official Supabase and Next.js documentation, and cross-validated against competitor platforms.

The recommended approach is a server-first Next.js 16 + Supabase monolith. Pages are async server components that fetch all data before render, passing populated state to small `"use client"` islands for interactivity. All mutations go through API route handlers. This eliminates client-side loading waterfalls and keeps auth token handling secure on the server. The stack — Next.js 16.1.6, React 19, Tailwind v4, Supabase (hosted), `@supabase/ssr`, Zod v4, react-hook-form — is exactly what the reference codebase used in production and is pinned to current stable releases.

The critical risk category is authentication security: the platform requires defense-in-depth auth (proxy + server page + API route), role storage in the `users` table (never JWT `user_metadata`), `getUser()` over `getSession()` in all server code, and atomic invite-code consumption. Five of the eight documented critical pitfalls are Phase 1 concerns — the foundation must be built correctly or every subsequent feature inherits the flaw. The work session timer (Phase 2) has a non-obvious state-restoration requirement that is the top Phase 2 risk.

---

## Key Findings

### Recommended Stack

The stack is established and verified against the working reference codebase. No speculative or unproven technology is required. Next.js 16 introduced breaking changes from 15 (`middleware.ts` is now `proxy.ts`, `serverRuntimeConfig` removed, `next lint` removed, Node 20.9+ required) — these are all already accounted for in the architecture. Tailwind v4 uses CSS-first config via `@theme` in `globals.css`; there is no `tailwind.config.js`. Zod v4 should be imported from `"zod"` not `"zod/v4"`.

**Core technologies:**
- **Next.js 16.1.6**: Full-stack React framework — LTS release with Turbopack default, App Router + Server Components, `proxy.ts` replaces `middleware.ts`
- **React 19.2.3**: Ships with Next.js 16; no separate install decision
- **TypeScript 5.9.x (strict)**: Required by Next.js 16 (min 5.1); strict mode is non-negotiable per project constraints
- **Supabase (hosted)**: Postgres + Auth + RLS + Realtime — managed, zero infra ops, Google OAuth first-class
- **`@supabase/ssr` v0.9.0**: Cookie-based auth for SSR — replaces deprecated `auth-helpers-nextjs`; use `getAll/setAll` cookie handlers only
- **Tailwind CSS v4.2.1**: CSS-first config via `@theme` — no `tailwind.config.js`; `@tailwindcss/postcss` replaces old PostCSS plugin
- **Zod v4.3.6**: Schema validation — 14x faster string parsing; import from `"zod"`, never `"zod/v4"`
- **react-hook-form v7.71.2 + @hookform/resolvers v5.2.2**: Form state — resolvers v5+ required for Zod v4 compatibility
- **class-variance-authority v0.7.1**: CVA variant system for all UI primitives
- **date-fns v4.1.0**: Date formatting and threshold calculations (3-day, 7-day, 14-day inactivity windows)
- **recharts v3.7.0**: Owner analytics dashboard charts only
- **server-only v0.0.1**: Build-time guard preventing admin client from entering client bundles

Full version manifest and alternatives considered: see `.planning/research/STACK.md`.

---

### Expected Features

The core product is an accountability loop: session tracking feeds daily reports, daily reports feed coach review, coach review feeds owner alerts. Every feature either supports this loop directly or is deferred.

**Must have (table stakes — ship at V1 launch):**
- Google OAuth login with invite-only registration — the gate to everything
- Role-based access control (owner/coach/student) with RLS enforcement — unsafe without it
- Owner invite system (coach + student invites, magic links, 72h expiry) — prerequisite for onboarding
- Owner coach-student assignment — prerequisite for any coaching features
- Student work session tracker (45-min cycles, 4/day, start/complete/abandon with grace period) — core daily habit
- Student 10-step roadmap (locked/active/completed sequential progression) — structural progress artifact
- Student daily report submission (hours auto-filled from sessions, star rating, outreach count, wins, improvements, 11 PM deadline) — the accountability loop
- Coach dashboard with assigned student overview and at-risk flags — coaches need situational awareness
- Coach report review (mark as reviewed) — closes the accountability loop
- Owner platform-wide stats dashboard — Abu Lahya needs program health visibility
- Owner alert system (3-day inactivity, 7-day no-login, coach avg rating < 2.5 for 14 days, unreviewed reports) — proactive intervention
- Ask Abu Lahya AI chat (iframe embed of existing chatbot) — async coaching presence
- Mobile-responsive UI, loading states, error boundaries, empty states — table-stakes polish

**Should have (competitive differentiators, add after core loop validated):**
- Coach basic analytics (report rates, activity trends over time)
- Email notifications via Resend — add only after users confirm they want email nudges

**Defer to V2+:**
- Gamification tiers (Bronze/Silver/Gold) — demotivates bottom 90% of cohort; roadmap steps already provide progression
- Leaderboards / rankings — anxiety-inducing; at-risk alerts surface struggling students privately instead
- In-app notification system — disproportionate complexity for V1
- CRM deal/influencer pipeline — premature for students at Steps 2-4
- Streak tracking — requires cron infrastructure; punishes absences twice

Key dependency chain: Google OAuth → invite registration → role assignment → all dashboards → work tracker → daily reports → coach review → owner alerts. Roadmap progression is independent and can be built in parallel.

Full feature matrix, dependency graph, and competitor analysis: see `.planning/research/FEATURES.md`.

---

### Architecture Approach

The architecture follows a strict server-first pattern: async server components fetch all page data using `Promise.all()`, then pass the pre-populated data as props to small `"use client"` islands. Mutations from client islands go exclusively through `/api/*` route handlers — no client component ever calls Supabase directly. Route protection runs in three layers: `proxy.ts` (navigation guard), `getSessionUser()` (per-page server check), and explicit auth+role check at the top of every API route handler. `createAdminClient()` (service role) is used for all server-side DB queries with explicit user-ID filters applied on every query even though RLS is also active.

**Major components and responsibilities:**
1. **`proxy.ts`**: Route guard on every non-static request — reads auth cookie, checks role via admin client, redirects wrong-role or unauthenticated requests
2. **`api/auth/callback`**: OAuth exchange + profile creation + roadmap seeding — the most complex single handler; must use a DB transaction for invite consumption + user insert
3. **`(auth)` route group**: Login, register/[code], no-access pages — full-screen layout, no sidebar, invite-gated
4. **`(dashboard)` layout**: Sidebar shell for all authenticated pages — server component, calls `getSessionUser()`
5. **`createAdminClient()`**: Service-role DB client — `server-only` guarded; used in all server pages and API routes
6. **`lib/config.ts`**: Single source of truth — all roles, routes, roadmap steps, thresholds, validation rules; safe to import in both server and client
7. **Client islands** (`WorkTrackerClient`, `RoadmapClient`, `ReportForm`, etc.): Interactive UI — receive `initialData` as props; all mutations via `fetch()` to API routes

Architecture has a natural build order: Foundation (schema, config, Supabase clients, proxy) → Auth Shell (callback, auth pages, dashboard layout, UI primitives) → Student Features → Coach Features → Owner Features. Deviating from this order creates blocking dependencies.

Full architecture with data flow diagrams, code examples, anti-patterns, and scaling notes: see `.planning/research/ARCHITECTURE.md`.

---

### Critical Pitfalls

Eight critical pitfalls documented; five must be addressed in Phase 1 before any feature work begins.

1. **OAuth redirect URL mismatch** — Always pass dynamic `redirectTo: ${window.location.origin}/api/auth/callback` in `signInWithOAuth`. Add both localhost and production to Google Console Authorized Redirect URIs AND Supabase Additional Redirect URLs. Use `localhost` consistently, not `127.0.0.1`.

2. **`getSession()` instead of `getUser()` in server code** — `getSession()` reads cookies without re-validating with Supabase Auth servers; it can be spoofed. Use `getUser()` everywhere server-side. `getSession()` is only acceptable in display-only client components.

3. **Role stored in JWT `user_metadata`** — `user_metadata` is user-editable; any student can promote themselves to owner. Store roles only in the `users` table. RLS policies must join against the `users` table for role checks, never read `auth.jwt() -> 'user_metadata' -> 'role'`.

4. **RLS enabled with missing or incomplete policies** — Supabase default is "deny all" when RLS is enabled; missing policies return empty arrays with no error. Write all policies in migrations immediately alongside `ENABLE ROW LEVEL SECURITY`. Test with the anon-key client, not service_role.

5. **Cross-role data leakage in RLS policies** — Each table needs per-role policy clauses: student sees own data, coach sees assigned students' data only, owner sees all. The naive `student_id = auth.uid()` does not prevent coach-scoped access. Enforce `coach_id` relationship in all coach-facing policies.

6. **Invite race condition / orphaned state** — Mark `invites.used = true` and insert into `users` in a single Postgres transaction in the callback handler. Store invite code in OAuth `state` parameter through the Google round-trip so it is still available at the callback.

7. **Work session timer lost on navigation or refresh** — On page load, detect existing `in_progress` sessions and restore remaining time from `started_at`. Auto-abandon sessions where `started_at` exceeds 45 min + grace period. Enforce `UNIQUE(student_id, date, cycle_number)` DB constraint to prevent duplicate in-progress sessions.

8. **Deprecated `get/set/remove` cookie handler in `@supabase/ssr`** — Use only `getAll` and `setAll` methods. The old individual `get/set/remove` API causes silent session refresh failures. Await `cookies()` from `next/headers` in Next.js 15+.

Full pitfall detail with warning signs, recovery strategies, and security checklists: see `.planning/research/PITFALLS.md`.

---

## Implications for Roadmap

The architecture research defines a natural 5-layer build order. Features research confirms what belongs in each layer. Pitfalls research identifies which phases carry the most security and data-integrity risk. These combine into a clear phase structure.

### Phase 1: Foundation + Auth

**Rationale:** Everything downstream depends on a correct, secure foundation. Five of the eight critical pitfalls are Phase 1 concerns. A flaw here (insecure RLS, wrong cookie handler, role in user_metadata) propagates to every subsequent feature and is expensive to fix after coach and student pages are built.

**Delivers:** Working Google OAuth login, invite-only registration, role assignment, route protection, Supabase schema with RLS, and a navigable but empty dashboard shell for all three roles.

**Addresses (from FEATURES.md):** Google OAuth + invite registration, role-based access control, owner invite system (initial), `(auth)` pages, `(dashboard)` layout shell.

**Avoids (from PITFALLS.md):** Pitfalls 1, 2, 3, 4, 5, 6, 8 — all auth/schema/RLS pitfalls must be resolved here.

**Architecture components (from ARCHITECTURE.md):** Layer 1 (schema, config, types, Supabase clients, session helper, proxy) + Layer 2 (auth callback, auth pages, dashboard layout, UI primitives).

---

### Phase 2: Student Features

**Rationale:** Students are the primary users and their data is the input to all coach and owner features. Coach pages are meaningless without student session and report data to read. The work tracker is the most complex client island and carries the timer state-restoration pitfall — it needs focused attention.

**Delivers:** A fully functional student experience — work session tracking with timer, 10-step roadmap with gated progression, daily report submission with auto-filled hours from sessions, and the Ask Abu Lahya AI chat embed.

**Addresses (from FEATURES.md):** Student work session tracker, student 10-step roadmap, student daily report submission, Ask Abu Lahya AI chat, mobile-responsive UI with loading/empty states.

**Avoids (from PITFALLS.md):** Pitfall 7 (timer state lost on navigation) — detect in-progress sessions and restore remaining time on page load; auto-abandon stale sessions; enforce unique constraint on `(student_id, date, cycle_number)`.

**Architecture components (from ARCHITECTURE.md):** Layer 3 — student dashboard, work tracker client island, roadmap client island, report form, AI iframe.

---

### Phase 3: Coach Features

**Rationale:** Coach features are the second layer of the accountability loop — they close the loop that students open. Coach pages read from the student data built in Phase 2 and require the coach-student assignment infrastructure from Phase 1 (invites). Cross-role RLS correctness for coach-scoped access must be verified here.

**Delivers:** Coach dashboard with assigned student overview and at-risk flags, student list and detail view, report inbox with mark-as-reviewed, coach invite flow, and basic coach analytics.

**Addresses (from FEATURES.md):** Coach dashboard with student overview, coach report review, coach basic analytics, coach at-risk threshold configuration, report inbox scoped to last 7 days.

**Avoids (from PITFALLS.md):** Pitfall 5 (cross-role data leakage) — verify Coach A cannot access Coach B's students via raw SQL test; verify RLS coach policies scope to `users WHERE coach_id = coach.id`.

**Architecture components (from ARCHITECTURE.md):** Layer 4 — coach dashboard, coach student list + detail, coach reports inbox, coach analytics, coach invites.

---

### Phase 4: Owner Features

**Rationale:** Owner features aggregate across all users and coaches, making them dependent on data from all prior phases. Owner alert computation requires accumulated student activity data. This is also the most read-heavy phase — owner dashboard queries scan the full users, work_sessions, and daily_reports tables.

**Delivers:** Owner platform-wide stats dashboard, full student and coach management (list + detail + assignments), owner invite system for coach invites, and owner alert system for proactive intervention.

**Addresses (from FEATURES.md):** Owner platform-wide stats dashboard, owner alerts (inactive/drop-off/unreviewed/coach underperformance), owner coach-student assignment, owner student and coach lists.

**Uses (from STACK.md):** recharts for owner analytics charts; date-fns for threshold window calculations (3-day, 7-day, 14-day).

**Architecture components (from ARCHITECTURE.md):** Layer 5 — owner dashboard, owner student/coach lists, owner invites, owner assignments, owner alerts (computed on server at render time from derived queries; no separate alerts storage in V1).

**Performance note:** Owner dashboard stats queries scan full tables. Add `unstable_cache()` with short TTL or a DB view if page load is slow — do not optimize prematurely but flag this for measurement after Phase 4 ships.

---

### Phase 5: Polish + Production Hardening

**Rationale:** Final phase addresses cross-cutting concerns that can only be validated after the full feature set exists: schema migration parity between local and production, complete auth flow testing in the production environment, RLS audit with anon-key queries, and UI consistency pass.

**Delivers:** Production-ready deployment, verified OAuth flows in both environments, confirmed schema parity (`supabase db diff`), full "Looks Done But Isn't" checklist from PITFALLS.md verified, and any critical UX polish items (empty states, error boundaries, mobile layout).

**Addresses (from PITFALLS.md):** Full checklist — OAuth in production tested, invite registration with expired invites tested, role-based routing tested with wrong-role credentials, RLS policies tested with anon-key from outside the app, `SUPABASE_SERVICE_ROLE_KEY` confirmed not in any `NEXT_PUBLIC_` env var.

---

### Phase Ordering Rationale

- **Auth before features:** Auth is not a feature — it is the precondition for all features. OAuth redirect misconfigurations and insecure RLS cannot be retrofitted cheaply.
- **Student before coach:** Coach features are read-only views into student data. A coach dashboard built before student data exists will be empty during development, making it harder to validate.
- **Coach before owner:** Owner features aggregate across coaches and students. Full data model needs to be populated before owner aggregation queries make sense.
- **Schema decisions are Phase 1, not Phase 3:** RLS policy design for cross-role access must be decided at schema creation time. Retrofitting `coach_id`-scoped RLS policies after coach pages are built requires a migration and re-testing.
- **Roadmap is independent of reports:** Per FEATURES.md dependency graph, roadmap progression advances by explicit student action independent of daily reports or sessions. It can be built any time in Phase 2 without blocking the report flow.

---

### Research Flags

Phases where deeper research may be needed during planning:

- **Phase 1 (Foundation + Auth):** The invite registration flow — specifically the atomic invite consumption + user creation transaction pattern and the Before User Created Auth Hook — may need implementation-time research. The pattern is documented in PITFALLS.md but Supabase's exact hook API should be verified at build time.
- **Phase 4 (Owner Features):** Alert computation logic — the exact SQL queries to derive "inactive 3 days," "no login 7 days," and "coach avg rating < 2.5 over 14 days" from the schema should be prototyped early. These are read-only derived queries, not stored state, but correctness requires SQL planning.

Phases with well-documented patterns (can skip `research-phase`):

- **Phase 2 (Student Features):** All patterns are fully documented in the reference codebase with code examples. Work tracker, roadmap, and report form follow the server-first + client island pattern with no ambiguity.
- **Phase 3 (Coach Features):** Reads from existing student data using the same established patterns. No new integration points.
- **Phase 5 (Polish + Hardening):** Checklist-driven phase; no research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against working reference codebase (`reference-old/package.json`) and current npm stable releases. Breaking changes from Next.js 15→16 are enumerated and accounted for. |
| Features | HIGH | Cross-validated against 4 competitor platforms and project requirements. Anti-features documented with rationale to prevent scope creep under pressure. Feature dependency graph is explicit. |
| Architecture | HIGH | Derived directly from reference codebase source inspection (not inference). All patterns have working code examples from production. Five architectural anti-patterns documented. |
| Pitfalls | HIGH | Most pitfalls verified via official Supabase docs, Supabase GitHub discussions, and Vercel blog. Pitfall-to-phase mapping and recovery cost/steps provided for all 8 critical pitfalls. |

**Overall confidence: HIGH**

### Gaps to Address

- **AI chat iframe URL:** The `Ask Abu Lahya` feature embeds an existing hosted chatbot via iframe. The URL is not defined in research — it must be obtained from the owner and configured in `lib/config.ts` before the ask page is shipped. This is not a technical gap but an operational dependency.
- **Email invite delivery mechanism:** The invite system generates invite codes and magic links, but how those codes are communicated to invited users is not specified. V1 likely uses manual distribution (owner/coach copies the link). If email delivery is needed at V1 launch, Resend integration should be scoped explicitly — research puts this at P2 (add after validation), not P1.
- **Owner alert thresholds (exact SQL):** The alert computation logic (queries for inactivity windows, avg rating calculations, unreviewed report counts) is specified in terms of business logic but the exact Supabase SQL was not prototyped. These should be drafted as part of Phase 4 planning or Phase 1 schema design to confirm the schema supports them with reasonable query plans.
- **Supabase plan selection:** Research assumes Supabase free tier is sufficient for V1 (0-500 users per architecture scaling notes). If the cohort is larger at launch, connection pooling (pgBouncer) may be needed from day one. Confirm cohort size before deploying.

---

## Sources

### Primary (HIGH confidence)
- `reference-old/package.json` — exact working versions from previous production codebase
- `reference-old/src/proxy.ts`, `session.ts`, `admin.ts`, `callback/route.ts`, `config.ts` — direct source inspection of all major architectural patterns
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) + [16.1 Blog Post](https://nextjs.org/blog/next-16-1) — release notes, breaking changes, Turbopack status
- [Next.js v16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — `proxy.ts` rename, async API changes, Node.js 20.9+ requirement
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — `getAll/setAll` cookie handler pattern, `getUser()` vs `getSession()`
- [Supabase RLS Performance Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — index requirements, subquery direction
- [Supabase Custom Claims / RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — role storage security (`user_metadata` vs `users` table)
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, `@theme` directive
- [Zod v4 Release Notes](https://zod.dev/v4) — import path, performance improvements

### Secondary (MEDIUM confidence)
- [CoachAccountable](https://www.coachaccountable.com/), [GoalsWon](https://www.goalswon.com/), [Together Platform](https://www.togetherplatform.com/) — competitor feature analysis
- [Growth Engineering: Dark Side of Gamification](https://www.growthengineering.co.uk/dark-side-of-gamification/) — anti-feature rationale for leaderboards
- [Vercel Blog: Common mistakes with Next.js App Router](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them) — server component patterns
- [Supabase GitHub Discussion #20353](https://github.com/orgs/supabase/discussions/20353) — localhost vs 127.0.0.1 OAuth issue
- [Supabase GitHub Discussion #26483](https://github.com/orgs/supabase/discussions/26483) — dynamic `redirectTo` pattern
- [Supabase GitHub Issue #107 (ssr)](https://github.com/supabase/ssr/issues/107) — `getUser` vs `getSession` behavior in SSR

### Tertiary (LOW confidence)
- [Futuremarketinsights: Coaching Platform Market 2026](https://www.futuremarketinsights.com/reports/coaching-platform-market) — market sizing context only, not used for feature decisions

---
*Research completed: 2026-03-16*
*Ready for roadmap: yes*
