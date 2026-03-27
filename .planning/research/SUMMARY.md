# Project Research Summary

**Project:** IMA Accelerator v1.1 — Flexible Sessions, KPI Banner, Calendar View, Roadmap Deadlines
**Domain:** Student performance and coaching platform (Next.js App Router + Supabase)
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

IMA Accelerator v1.1 is an incremental feature release on top of a validated v1.0 coaching platform. The work is entirely additive — no new route groups, no new layout layers, no new auth patterns. All five feature areas (flexible work sessions, outreach KPI banner, coach/owner KPI visibility, calendar view, roadmap deadline tracking) integrate cleanly into the existing server-component-first architecture. The recommended build strategy is strict dependency order: schema and config first, shared library second, student-facing features third, then coach/owner views, and calendar last. The entire release requires only one new npm dependency (`react-day-picker@^9.14.0`).

The primary architectural principle is to keep computation on the server. Lifetime outreach totals must use a Postgres SUM aggregate — never a JavaScript `.reduce()` over fetched rows. Calendar month data should be fetched with `?month=YYYY-MM` search params so the server scopes queries with `gte`/`lte` date bounds, rather than over-fetching with a row limit and filtering client-side. Break countdowns live entirely in React client state and must never be persisted to the database. These three patterns, done wrong, represent the highest implementation risk in this release — two of them cause silent data loss that only appears weeks later at scale.

The most critical pre-implementation action is to audit and update all references to `WORK_TRACKER.cyclesPerDay` before writing any feature code. This single config field has six consumers spread across API routes, client components, and a database CHECK constraint. Missing any one of them produces silent runtime failures that are difficult to trace. A `grep -r "cyclesPerDay" src/` audit and a `npx tsc --noEmit` check must gate entry into the flexible sessions phase. The timezone pitfall in roadmap deadline comparisons — mixing UTC `joined_at` timestamps with local-time `getToday()` calls — is the second highest risk and is addressed by adding a `getTodayUTC()` utility before writing any deadline comparison logic.

## Key Findings

### Recommended Stack

The v1.0 stack is unchanged and remains appropriate. The only new dependency for v1.1 is `react-day-picker@^9.14.0`, which provides the month-grid calendar with WCAG 2.1 AA compliance, 24 swappable component slots for custom day rendering, and uses `date-fns` (already installed) as a peer dependency. Circular progress rings use SVG `<circle>` with `strokeDashoffset` animated via `motion.circle` (motion is already installed). Break countdown timers use the same `setInterval` + `useEffect` pattern already in `WorkTrackerClient`. Date arithmetic for deadlines uses `addDays` / `differenceInDays` from `date-fns v4`. Schema additions use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with constant defaults.

**Core technologies:**
- `Next.js 16.1.6`: Full-stack framework — route protection via `src/proxy.ts`, not `middleware.ts`
- `React 19.2.3` + `TypeScript ^5 (5.9.x)`: strict mode; Server/Client Component boundary discipline required
- `Supabase (hosted)`: Postgres + Auth + RLS; admin client (service role) for all server-side cross-user reads
- `Tailwind CSS ^4 (4.2.1)`: ima-* token system via `@theme` in `globals.css`; never hardcoded hex
- `motion@^12.37.0`: `motion.circle` for animated SVG KPI rings; all animate-* classes use `motion-safe:`
- `date-fns@^4.1.0`: all deadline arithmetic (`addDays`, `differenceInDays`, `isSameDay`, `startOfMonth`, etc.)
- `react-day-picker@^9.14.0` (NEW): month-grid calendar with custom `DayButton` slot for dot indicators

**Critical version notes:**
- `react-day-picker` React 19 compatibility fixed in v9.4.3; require `^9.14.0`
- Zod: always `import { z } from "zod"` — never `"zod/v4"`
- Supabase migrations: use `IF NOT EXISTS` on every `ADD COLUMN` for idempotency on re-run
- Postgres 15 (Supabase): `ADD COLUMN ... NOT NULL DEFAULT <constant>` is metadata-only (no table rewrite); volatile defaults like `now()` still require a full rewrite

Full version manifest and alternatives considered: see `.planning/research/STACK.md`.

### Expected Features

All six v1.1 features are in scope and sufficiently interdependent that shipping them together is lower risk than a partial release.

**Must have (table stakes — P1):**
- Flexible work sessions: duration selector (30/45/60 min), break countdown after session completion, skip break, remove 4-cycle daily cap
- KPI progress banner: sticky lifetime (0/2,500) and daily (0/50) outreach bars with RAG color coding on student dashboard
- Coach/owner KPI visibility: read-only KPI summary card on student detail pages for both roles
- Calendar month grid: 7-column grid on coach/owner student detail pages, session/report dot indicators, prev/next navigation
- Calendar day detail panel: sessions list and daily report for the selected date in a panel below the grid
- Roadmap deadline status chips: on-track/due-soon/overdue per step, days remaining, completed_at display on student roadmap and coach/owner roadmap tab

**Should have (P2 — add within v1.1 scope):**
- Granular outreach breakdown: new `brands_contacted` / `influencers_contacted` fields on daily reports, updated report form, updated KPI banner
- Break duration proportional to session length (shorter sessions get shorter breaks; break = session / 3 rounded to 5 min)
- Session count badge replacing the "4/4 cycles" display

**Defer to v1.2+:**
- Days-to-target projection on KPI banner (needs 7+ days of data to be meaningful)
- Roadmap completion velocity label
- Session volume intensity shading on calendar (GitHub heat-map style)
- Year/heat-map calendar view

Key dependency: the `cycle_number UNIQUE` constraint on `work_sessions` and the Zod `max(cyclesPerDay)` in the POST route both block flexible sessions — schema and API route changes are strict prerequisites for all student-facing work.

Full feature matrix, UX patterns, and dependency graph: see `.planning/research/FEATURES.md`.

### Architecture Approach

v1.1 makes no structural changes to the application. Every new feature follows the existing pattern: async server component reads data via `createAdminClient()`, computes derived values, passes typed props down to "use client" islands for interactivity. The two new display components (`ProgressBanner`, `StudentKPIBar`) are server-renderable — no `"use client"` needed. The one genuinely interactive new component (`CalendarTab`) owns only UI state (current month, selected day) and performs zero network requests after initial page load. The existing at-risk computation logic duplicated between coach and owner detail pages is extracted into a new shared pure-function library at `src/lib/kpi.ts` — v1.1 is the right moment to eliminate this duplication before it diverges further.

**Major components:**
1. `src/lib/kpi.ts` (new) — pure functions: `computeAtRisk`, `computeLifetimeOutreach`, `computeRoadmapDeadlineStatus`; shared by coach and owner pages
2. `src/components/student/ProgressBanner.tsx` (new) — sticky outreach KPI bar, server-rendered, inserted in `(dashboard)/layout.tsx` for student role only
3. `src/components/shared/StudentKPIBar.tsx` (new) — read-only KPI summary rendered in coach/owner student detail page headers
4. `src/components/coach/CalendarTab.tsx` (new) — month grid + day detail panel; replaces `WorkSessionsTab` + `ReportsTab`
5. `WorkTrackerClient.tsx` (modified) — duration selector, break timer in React state, dynamic cycle grid without cap
6. `RoadmapStep.tsx` (modified) — deadline status badge + completed_at timestamp display
7. `(dashboard)/layout.tsx` (modified) — adds two Postgres SUM aggregate queries + ProgressBanner for student role
8. Migrations 00006 + 00007 — additive schema changes for flexible sessions and outreach KPI columns

**Data flow principles:**
- Aggregate queries: use PostgREST `outreach_count.sum()` — never JS `.reduce()` over full result sets
- Calendar data: fetch all sessions + reports (no limit) once on page load; filter client-side for month navigation; zero network requests on month change
- Break timer: client-only `useState` + `useEffect` countdown; never write break state to the database
- KPI targets in `config.ts` as `KPI_TARGETS = { lifetimeOutreach: 2500, dailyOutreach: 50 }`; never hardcoded in components

Full architecture with migration SQL, component-by-component integration analysis, anti-patterns, and suggested build order: see `.planning/research/ARCHITECTURE.md`.

### Critical Pitfalls

Twelve pitfalls documented; the following five are the highest-impact risks for v1.1.

1. **Break timer corrupts `started_at` resume math** — The PATCH route shifts `started_at` forward to preserve elapsed time on resume. A break that touches `paused_at` will cause resume logic to subtract break duration from remaining work time, making sessions appear shorter than selected. Track break state entirely in React state (`breakSecondsRemaining`). Never write break state to the DB. Verification: after a break completes, `duration_minutes` on the completed session must exactly match the selected session duration.

2. **`cyclesPerDay` cap has six consumers** — The config field `WORK_TRACKER.cyclesPerDay: 4` drives a Zod `max()` in the POST route, `allComplete` logic, a progress bar denominator, a WorkTimer ARIA label, a `getNextAction` state machine branch, and a DB CHECK constraint `cycle_number BETWEEN 1 AND 4`. All six must be updated atomically. Run `grep -r "cyclesPerDay" src/` and enumerate every location before writing the first line of flexible sessions code.

3. **NOT NULL migration fails on live data** — `ADD COLUMN ... NOT NULL` without a constant default fails on the populated production database (passes locally because `supabase db reset` starts clean). Use the three-step pattern in a single migration: add as nullable, backfill with `UPDATE`, then `ALTER COLUMN SET NOT NULL`. Alternatively, use `NOT NULL DEFAULT <constant>` for constant defaults only — no functions like `now()` or `gen_random_uuid()`.

4. **Calendar silently shows empty data beyond the 120-row limit** — The coach detail page fetches sessions with `.limit(120)`. Students active 4+ months exceed this. Month navigation is client-side, so there is no second-chance fetch. Solution: pass `?month=YYYY-MM` as a URL search param; server component reads it and applies `gte`/`lte` date bounds. Next.js App Router triggers a server re-render when search params change.

5. **Timezone mismatch in deadline comparisons** — `users.joined_at` is `timestamptz` (UTC). The existing `getToday()` utility returns a local-time date string using `new Date()` local methods. Comparing a UTC deadline against a local "today" creates off-by-one errors for students in UTC+ timezones. Add `getTodayUTC()` — `new Date().toISOString().split("T")[0]` — and use it exclusively for all deadline comparisons. Compute deadlines entirely on the server (Vercel runs in UTC).

Additional pitfalls to review: `restrict_coach_report_update` trigger must be updated in the same migration as any `daily_reports` column change (Pitfall 8); Step 1 `completed_at` seed must use `user.joined_at` not `Date.now()` (Pitfall 12); sticky banner must use `sticky top-0` inside `<main>`, not `position: fixed` (Pitfall 7).

Full pitfall list with code-level citations, warning signs, and recovery strategies: see `.planning/research/PITFALLS.md`.

## Implications for Roadmap

The architecture research defines a clear dependency graph that maps directly to phases. Build order is non-negotiable — later phases have hard dependencies on earlier ones completing correctly. The ARCHITECTURE.md build order is the recommended phase sequence.

### Phase 1: Schema and Config Foundation

**Rationale:** All UI, API, and library work depends on the correct database schema. Running schema changes last is the most common cause of blocked work mid-feature. Config changes must precede API route updates to avoid TypeScript compilation failures.
**Delivers:** Migration 00006 (flexible sessions: `session_minutes` column, relaxed `cycle_number` CHECK, added `paused` to status CHECK), Migration 00007 (5 new outreach KPI columns on `daily_reports` + updated `restrict_coach_report_update` trigger), `config.ts` updated with `sessionDurationOptions`, `defaultSessionMinutes`, `KPI_TARGETS`, `target_days` per roadmap step, and `VALIDATION.outreachKpi.max`.
**Addresses:** Flexible sessions schema, outreach KPI columns, roadmap deadline config.
**Avoids:** Pitfalls 2 (cyclesPerDay audit), 3 (NOT NULL migration pattern — three-step), 4 (unique index semantics decision before writing migration), 8 (trigger update in same migration as column additions).

### Phase 2: API Route Updates

**Rationale:** API routes are the contract between client and database. Updating them immediately after schema migrations lets all subsequent UI work target the correct API surface from the start.
**Delivers:** `POST /api/work-sessions` accepting `session_minutes: z.union([z.literal(30), z.literal(45), z.literal(60)])` and auto-computing `cycle_number` server-side via `MAX(cycle_number) + 1`; `PATCH /api/work-sessions/[id]` reading stored `session.session_minutes` for `duration_minutes` on completion; `POST /api/reports` accepting and storing all 5 new KPI fields.
**Avoids:** Pitfall 2 (Zod `max(cyclesPerDay)` removed from POST route; API validation now uses literal union), Pitfall 11 (TypeScript audit via `npx tsc --noEmit` after every config reference change).

### Phase 3: Shared KPI Library

**Rationale:** `src/lib/kpi.ts` is a pure-function module with zero dependencies on other new features. Extracting it before building UI eliminates the current at-risk logic duplication and gives all subsequent UI phases a tested, shared utility. `getTodayUTC()` is established here for all deadline logic.
**Delivers:** `computeAtRisk`, `computeLifetimeOutreach`, `computeRoadmapDeadlineStatus` pure functions; `getTodayUTC()` added to `src/lib/utils.ts`.
**Avoids:** Pitfall 9 (timezone mismatch — `getTodayUTC()` established here, not improvised per-component).

### Phase 4: Student-Facing Features

**Rationale:** Student-facing features (work tracker, report form, roadmap) are independent of coach/owner views and calendar infrastructure. They can be built in focused sequence after Phase 3 without blockers.
**Delivers:** `WorkTrackerClient` with duration selector (30/45/60 min), break timer in React state, dynamic cycle grid without cap; `ReportForm` with 5 new KPI number inputs (grouped as "Outreach KPIs" section); `RoadmapStep` + `RoadmapClient` with deadline status badges and completed_at display; `student/roadmap/page.tsx` passing `user.joined_at` to `RoadmapClient`.
**Addresses:** Flexible sessions UX, granular outreach form fields, roadmap deadline visibility for students.
**Avoids:** Pitfall 1 (break timer in React state only, never touches `paused_at`), Pitfall 12 (Step 1 `completed_at` seed fixed to use `user.joined_at` + backfill migration applied before deadline display ships).

### Phase 5: Progress Banner

**Rationale:** The banner lives in the dashboard layout and requires the aggregate query pattern established in Phase 3. It is architecturally simple but must be placed correctly in `layout.tsx` to avoid z-index conflicts with the sidebar.
**Delivers:** `ProgressBanner` component (`src/components/student/ProgressBanner.tsx`, server-rendered); `(dashboard)/layout.tsx` modified to run two Postgres SUM aggregate queries in `Promise.all` for student role; `sticky top-0` placement inside `<main>`, not `position: fixed`; `KPI_TARGETS` from config drives all thresholds.
**Implements:** Server-side aggregate pattern; RAG color utility (reused by Phase 6 coach views).
**Avoids:** Pitfall 5 (Postgres SUM aggregate, not JS `.reduce()`), Pitfall 7 (sticky placement verified on 375px mobile with sidebar open before marking complete).

### Phase 6: Coach/Owner KPI Visibility and Roadmap Tab Updates

**Rationale:** Coach/owner detail pages need `lib/kpi.ts` utilities from Phase 3, the RAG color logic from Phase 5, and `completed_at` / `joined_at` threading from Phase 4. This is the convergence point before adding the calendar view.
**Delivers:** `StudentKPIBar` component; coach and owner student detail pages updated with lifetime aggregate queries, `lib/kpi.ts` at-risk computation replacing inline logic, `StudentKPIBar` rendered in student header area; `RoadmapTab` accepting `completed_at` and `joined_at` for deadline display on coach/owner views.
**Implements:** Coach/owner KPI visibility; at-risk duplication eliminated.

### Phase 7: Calendar View

**Rationale:** Calendar depends on the query changes in Phase 6 (which remove hard row limits on sessions/reports fetches) and on `session_minutes` being in the schema (Phase 1). Tab structure changes here — `WorkSessionsTab` and `ReportsTab` are deleted in this phase, not earlier, to avoid leaving dead code during development.
**Delivers:** `CalendarTab.tsx` with MonthGrid + DayDetailPanel; `StudentDetailTabs` tab structure updated to `calendar | roadmap`; `StudentDetailClient` and `OwnerStudentDetailClient` updated; `WorkSessionsTab.tsx` and `ReportsTab.tsx` deleted; `?month=YYYY-MM` search param architecture for bounded server queries.
**Addresses:** Full calendar view feature area with day detail panel, multi-indicator cells, month navigation.
**Avoids:** Pitfall 6 (calendar over-fetch via `?month` param + `gte`/`lte` date bounds, not limited prop filtering).

### Phase Ordering Rationale

- Schema before everything: Postgres constraints are enforced at runtime; an unmodified CHECK constraint will reject valid requests the moment flexible sessions UI ships
- Config update atomic with schema: TypeScript compilation breaks if a config field is removed without updating all consumers; doing both in Phase 1 prevents mid-phase build failures
- `lib/kpi.ts` before any UI that uses it: three separate diverging implementations of at-risk logic is the current problem; one shared utility prevents the same divergence on deadline logic
- `getTodayUTC()` established in Phase 3: if it's added per-component in Phase 4 or 7, it will be inconsistent; establishing it in the shared library phase forces consistency
- Calendar query changes happen in Phase 6: the row-limit removal on sessions/reports is a prerequisite for correct calendar display; Phase 7 can rely on complete data without worrying about the 120-row truncation
- Break timer, aggregate queries, and sticky banner placement are the three highest-risk implementation areas — each has an explicit verification step in the PITFALLS.md "Looks Done But Isn't" checklist

### Research Flags

Phases with well-documented patterns (standard implementation — skip `research-phase`):
- **Phase 1 (Schema + Config):** Standard Postgres DDL. Three-step NOT NULL migration pattern and `IF NOT EXISTS` pattern fully documented in PITFALLS.md and STACK.md.
- **Phase 2 (API Routes):** Direct mechanical update following existing patterns. Zod schema changes are straightforward.
- **Phase 3 (KPI Library):** Pure TypeScript functions with no external dependencies or integration complexity.
- **Phase 5 (Progress Banner):** PostgREST aggregate syntax confirmed in ARCHITECTURE.md. Placement pattern specified with exact code.
- **Phase 6 (Coach/Owner KPI):** Follows established server component + admin client pattern. `StudentKPIBar` is a read-only display component.

Phases that may benefit from targeted research during planning:
- **Phase 4 (Flexible Sessions — break timer state model):** The interaction between the existing `paused_at` resume-shift logic and the new break state is non-obvious. Re-read `PATCH /api/work-sessions/[id]/route.ts` lines 91-97 before writing any timer code. The break timer must use a separate state variable (`breakSecondsRemaining`) that is entirely independent of `paused_at`.
- **Phase 7 (Calendar — search param navigation):** Verify that `router.push("?month=YYYY-MM")` on the coach/owner student detail page does not trigger `proxy.ts` to re-evaluate auth on every month change. Next.js 16 App Router search param behavior with `proxy.ts` should be smoke-tested early in the phase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm and official changelogs. react-day-picker React 19 compat confirmed via changelog. One new dependency only. All other v1.1 features use existing libraries. |
| Features | MEDIUM | UX patterns cross-validated against Pomofocus, CoachAccountable, GitHub calendar, ClearPoint RAG standards. Primary source is v1.0 codebase inspection and project requirements. Target day values for roadmap steps are placeholders — need owner confirmation. |
| Architecture | HIGH | Derived entirely from direct codebase inspection of all affected files with file-and-line citations. Component-by-component integration analysis complete. No inferred patterns — all observed from source. |
| Pitfalls | HIGH | All 12 pitfalls identified through direct codebase analysis. Not inferred from general knowledge — each has a specific file and line number reference in the source. |

**Overall confidence:** HIGH

### Gaps to Address

- **Roadmap `target_days` values need Abu Lahya confirmation:** The specific day values per step (Step 3 = 7 days, Step 7 = 60 days, etc.) in ARCHITECTURE.md are architectural placeholders. The `config.ts` structure is ready to receive real values, but the program timeline must be confirmed by the owner before the roadmap deadline feature ships. This is not a technical gap — it is an operational dependency.
- **Granular outreach breakdown (P2) — scope decision pending:** FEATURES.md identified `brands_contacted` / `influencers_contacted` as P2. Migration 00007 adds these columns. The daily report form update and KPI banner breakdown display are open scope questions — whether they ship in v1.1 or are deferred depends on owner priority.
- **Calendar `?month` search param + `proxy.ts` interaction:** Confirm that search param changes on student detail pages do not cause the route guard to re-evaluate auth in a way that adds latency or triggers unexpected redirects. Low risk but worth a smoke test at the start of Phase 7.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/app/api/work-sessions/route.ts`, `[id]/route.ts`, `src/components/student/WorkTrackerClient.tsx`, `WorkTimer.tsx`, `supabase/migrations/00001_create_tables.sql`, `src/lib/config.ts`, `src/lib/utils.ts`, `src/app/(dashboard)/layout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/coach/StudentDetailClient.tsx`, `src/components/coach/StudentDetailTabs.tsx`, `src/components/coach/WorkSessionsTab.tsx`, `src/components/coach/ReportsTab.tsx`, `src/components/owner/OwnerStudentDetailClient.tsx`, coach and owner student detail pages, `student/roadmap/page.tsx`, `RoadmapClient.tsx`
- react-day-picker changelog (daypicker.dev) — v9.14.0 confirmed latest (2026-02-26); React 19 compat fixed in v9.4.3
- react-day-picker custom components guide — `DayButton` slot confirmed; 24 component slots available
- PostgreSQL docs: ALTER TABLE — constant DEFAULT = metadata-only operation on Postgres 11+ (no table rewrite)
- motion SVG animation docs (motion.dev) — `motion.circle`, `pathLength`, `strokeDashoffset` fully supported in motion v12
- date-fns npm — v4.1.0 current stable, 100% TypeScript, `differenceInDays`, `addDays`, `isSameDay`, `startOfMonth`, `endOfMonth` all available

### Secondary (MEDIUM confidence)
- ClearPoint Strategy: RAG Status Thresholds — amber at 80% of target used for daily outreach threshold
- UX Patterns for Developers: Calendar View Pattern — month grid with dot indicators is dominant pattern
- Zapier: Best Pomodoro Timer Apps 2025 — duration selector and break/skip UX conventions
- Pomofocus.io — break countdown visual differentiation and skip break button UX observed directly
- Qooper / Simply.Coach / CoachAccountable — read-only coach progress view patterns
- Eleken: Calendar UI Examples — day detail panel conventions (slide-in on desktop, bottom sheet on mobile)

### Tertiary (LOW confidence, corroborated by primary sources)
- WebSearch: react-day-picker React 19 compatibility — multiple sources confirm; elevated to MEDIUM via changelog verification
- WebSearch: circular SVG progress React pattern — community implementations confirm `strokeDashoffset` approach without additional library

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
