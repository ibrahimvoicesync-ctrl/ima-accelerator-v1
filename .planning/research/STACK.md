# Stack Research — Milestone v1.5

**Domain:** Student coaching / analytics platform — adding analytics pages, coach dashboard KPI stat cards, deal logging, and milestone notifications to an existing Next.js 16 + Supabase system.
**Researched:** 2026-04-13 (v1.5 — narrow scope: charts, aggregation, notifications, date utilities)
**Overall confidence:** HIGH — all critical findings verified against npm registry, official docs, or direct package.json inspection.

---

## Milestone Scope Context

v1.5 extends an existing, production-validated stack. It adds UI surfaces (analytics pages with trends, coach KPI cards, expanded analytics tab) and backend plumbing (deal attribution via `logged_by`, 4 new milestone notification triggers). The existing stack already includes all auth, RLS, rate-limiting, caching, and aggregation primitives. This milestone needs only **one net-new runtime dependency**.

**Core pre-existing stack (do NOT re-add or change):**
- Next.js 16.1.6, React 19.2.3, TypeScript strict
- Supabase (`@supabase/ssr@0.9`, `@supabase/supabase-js@2.99`)
- Tailwind CSS 4 with ima-* design tokens
- Zod 4.3.6, lucide-react 0.576, motion 12.37
- react-day-picker 9.14, react-hook-form 7.71
- class-variance-authority, clsx, tailwind-merge
- **date-fns 4.1.0 already installed** (critical — see Q4)
- pg_cron + `student_kpi_summaries` nightly pre-aggregation (v1.2 Phase 21)
- DB-backed rate limiting + `verifyOrigin()` CSRF helper
- `unstable_cache` 60s TTL pattern + React 19 `useOptimistic` + React `cache()`

---

## Answers to Priority Questions

### Q1. Charts library → **Recharts 3.8.x** (add)

**Recommendation:** Add `recharts@^3.8.1` as the only chart dependency.

**Rationale (why recharts over alternatives):**

| Criterion | Recharts 3.8.1 | Tremor Raw | Nivo | visx | Apache ECharts |
|-----------|----------------|------------|------|------|----------------|
| React 19 compat | Yes (3.x) | Built on recharts — inherits | Partial | Peer deps still lag; unofficial only | Via echarts-for-react wrapper (not React-first) |
| Tailwind 4 styling | Fully style-able via `fill`/`stroke` props → use ima-* hex | Copy-paste components, tied to Tremor tokens (conflicts with ima-*) | CSS-in-JS + theme object (friction with ima-*) | Unstyled primitives — full ima-* control but verbose | Canvas-rendered; styled via JS config, not CSS |
| Bundle (minzipped) | ~95–105 KB (single import) | Equivalent to recharts + Radix overhead | ~90–130 KB per chart type | 15–50 KB per chart (modular) | ~170 KB core |
| SSR model | **Client-only** — host wrapper needs `"use client"` | Same (wraps recharts) | Client-only | Client-only (SVG) | Client-only (DOM/Canvas) |
| Accessibility | `accessibilityLayer` prop (keyboard nav, ARIA roles) | Inherits recharts a11y | Manual ARIA | Manual (low-level) | `aria` config block |
| Maintainer activity | Very active (3.8.1 released ~2026-03) | Active but small; layered on recharts | Slower cadence | React 19 still open | Very active but not React-first |
| Learning curve | Low — declarative `<LineChart><Line/></LineChart>` | Low | Medium | High (low-level) | Medium |
| Codebase fit | Declarative JSX = matches existing ima-accelerator component style | Duplicates our CVA/ima-* system | Theme system duplicates Tailwind | Too much glue code for 4 chart surfaces | Config-object API is foreign |

**Why NOT Tremor Raw:** It is built on top of recharts and ships its own Tailwind tokens that conflict with our ima-* design system. We'd end up fighting overrides. If we want Tremor's patterns (KPI cards, trend cards), we can copy the *layout* patterns without the runtime dependency — we already have CVA primitives.

**Why NOT visx:** Low-level primitives library. Excellent control, smallest bundle, but requires ~3× the code to build a styled line chart. React 19 peer dependency still unresolved at the time of this research. Not worth the glue-code overhead for v1.5's modest chart surface (outreach trend line, deal history bar, roadmap progress, hours).

**Why NOT Nivo / ECharts:** Nivo's theme object and ECharts' config-object API are both foreign to our declarative JSX pattern. ECharts is Canvas-rendered which makes DOM-level accessibility and ima-* styling harder. Neither offers enough over recharts to justify the ecosystem mismatch.

**React 19 caveat (MEDIUM confidence, requires verification at install time):** Community reports note that some recharts 3.x versions require a `react-is` override to match React 19. If install warns about a peer dep mismatch, add to `package.json`:
```json
"overrides": { "react-is": "19.2.3" }
```
If recharts 3.8.1+ has resolved this natively, the override is unnecessary. Verify on first install.

**SSR integration pattern (HIGH confidence — enforced project rule):**
- Page (server component) fetches aggregated data via RPC through admin client
- Data passed as props to a thin client wrapper component with `"use client"`
- Wrapper renders `<ResponsiveContainer><LineChart>…</LineChart></ResponsiveContainer>`
- Accessibility: pass `accessibilityLayer` prop on every chart + `role="img"` and `aria-label` on the wrapping `<div>`

**Styling integration with ima-***
Recharts accepts raw color strings via `stroke`, `fill`, `className`. Since Tailwind 4 tokens are CSS variables, either:
1. Hard-code resolved hex values in a central `src/lib/chart-colors.ts` constants file (recommended — SSR-safe, stable), or
2. Read CSS variables at runtime with `getComputedStyle(document.documentElement).getPropertyValue('--ima-primary')` inside a `useEffect` (adds client round-trip; not recommended).

**Install:**
```bash
npm install recharts@^3.8.1
```
Expected bundle impact on analytics pages: ~35 KB gzipped (after tree-shaking + code split to only those routes). Acceptable for a gated, role-scoped page.

**Sources (Q1):**
- [recharts npm (3.8.1)](https://www.npmjs.com/package/recharts) — HIGH
- [recharts releases](https://github.com/recharts/recharts/releases) — HIGH
- [Recharts and accessibility wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility) — HIGH (describes `accessibilityLayer`, `role="application"`, keyboard nav)
- [Support React 19 · Issue #4558](https://github.com/recharts/recharts/issues/4558) — MEDIUM (ongoing, may be resolved in 3.8.x)
- [Next.js Charts with Recharts guide](https://app-generator.dev/docs/technologies/nextjs/integrate-recharts.html) — MEDIUM (confirms "use client" requirement)
- [visx issue #1883 — React 19 support](https://github.com/airbnb/visx/issues/1883) — HIGH (documents visx's React 19 gap)
- [Tremor GitHub](https://github.com/tremorlabs/tremor) — MEDIUM (confirms recharts underpinning)

---

### Q2. Analytics aggregation → **Keep existing pg_cron + summary-table pattern. Extend it; do not adopt TimescaleDB.**

**Recommendation:** NO new extension, NO new library. Extend the existing v1.2 Phase 21 pattern (`student_kpi_summaries` + pg_cron nightly refresh). For v1.5 analytics trends, add new summary columns or new summary tables (e.g., `student_weekly_trends`) keyed by `(user_id, iso_week)` and refresh via existing pg_cron.

**Why not TimescaleDB continuous aggregates:**
- Supabase cloud ships **TimescaleDB Apache 2 Edition only** — continuous aggregates are a TSL (Timescale License) feature and are **NOT supported on cloud Supabase**.
- TimescaleDB is **deprecated on Supabase Postgres 17** (new projects no longer get it by default). Adopting it today would be adopting a sunsetting dependency.
- Confidence: **HIGH** — confirmed by Supabase docs and the Supabase deprecation announcement.

**Why the existing pattern is the right pattern:**
- v1.2 load test confirmed P95 < 1s at 5k concurrent students with pg_cron + summary tables.
- The pattern composes with our existing write path (incremental skip, advisory lock, fallback read) already shipped in Phase 21.
- Materialized views were the alternative considered; the team already deliberately chose **summary tables over materialized views** because:
  - `REFRESH MATERIALIZED VIEW` recomputes the entire view from scratch (cost scales with total rows, not changed rows).
  - Incremental summary updates via UPSERT in pg_cron are cheaper at our scale and allow partial refresh logic (already implemented).

**Practical v1.5 extensions (no new deps):**

1. **Weekly rollup for coach top-3 leaderboard (Mon–Sun):**
   Add a `work_sessions_weekly` summary table with `(user_id, iso_year, iso_week, total_minutes)` primary key. Refresh via pg_cron nightly (or on-demand in the top-3 RPC using `date_trunc('week', ...)` directly — lazy eval against existing `work_sessions` with covering index is fine at 5k students).

2. **Outreach trend time-series for student analytics:**
   Use Postgres built-in `generate_series()` + `date_trunc('week', reported_for)` + `LEFT JOIN` against `daily_reports`. This is a window-function-free aggregation, runs in milliseconds with the existing `(user_id, reported_for)` index, and yields zero-filled weekly buckets for the chart.

3. **Deal history over time:**
   Aggregate `deals` by `date_trunc('month', closed_at)` grouped by `user_id`. Index `deals(user_id, closed_at)` already exists or is trivial to add.

**Native Postgres tools to lean on (all HIGH confidence, no new deps):**
- `date_trunc('week'|'month', timestamp)` — bucketing
- `generate_series()` — zero-fill for sparse trend data
- Window functions (`ROW_NUMBER()`, `LAG()`, `PARTITION BY`) — built into Postgres 15/17
- `pg_cron` — already installed
- `unstable_cache` 60s TTL + React `cache()` — already the pattern

**Anti-recommendation:** Do NOT introduce a separate ClickHouse, DuckDB, or hosted analytics DB. At 5k concurrent students with weekly/monthly rollups, Postgres + summary tables is 10× below the capacity where column-store OLAP systems start paying off.

**Sources (Q2):**
- [Supabase TimescaleDB docs](https://supabase.com/docs/guides/database/extensions/timescaledb) — HIGH
- [TimescaleDB continuous aggregates not supported · Issue #12342](https://github.com/supabase/supabase/issues/12342) — HIGH
- [Supabase Postgres 17 release discussion #35851](https://github.com/orgs/supabase/discussions/35851) — HIGH (deprecation of TimescaleDB on PG17)
- [PostgreSQL REFRESH MATERIALIZED VIEW docs](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) — HIGH
- Internal: v1.2 Phase 21 summary table pattern (PROJECT.md) — HIGH

---

### Q3. Notification system → **No library. Reuse the existing computed-notifications pattern.**

**Recommendation:** NO new library. Continue the pattern already established by quick task 260401-cwd (Coach 100h/45d milestone alert): compute notifications on-the-fly in a route handler, render into a sidebar badge + dismissable list.

**Why no library:**
- Project is explicitly polling-based, not realtime (v1.4 D-07 already codified this for chat to avoid Supabase Realtime's 500-connection cap on Pro plan).
- The 4 new v1.5 milestone triggers (Tech/Email Setup, 5 Influencers Closed, First Brand Response, Closed Deal) are all **derivable from existing tables** (`roadmap_progress`, `deals`, `work_sessions`). No persistent `notifications` table is needed.
- Rendering = a list component + lucide icon + CVA badge primitive. We have all of these.
- Adding a library (`react-hot-toast`, `sonner`, `novu`, `knock`, etc.) brings runtime cost, state-management coupling, and lock-in for zero incremental UX benefit.

**Pattern to follow (from 260401-cwd, already validated):**

1. **Compute** — a single RPC `get_coach_milestone_alerts(coach_id)` returns a JSON array of `{ type, student_id, student_name, triggered_at, payload }`. Each row is derived from a LEFT JOIN / window function on roadmap/deals/work_sessions. Cached server-side with `unstable_cache` (60s TTL).
2. **Render** — a server component in the coach sidebar reads the RPC, shows a count badge. A client-side dismiss list (already present in `alert_dismissals` table + `time-windowed keys` pattern per v1.0 decision) filters out dismissed alerts.
3. **Dismiss** — POST to `/api/alerts/dismiss` writes a row into `alert_dismissals` with a time-windowed key. The same `time-windowed keys` pattern already cited in Key Decisions table ensures stale dismissals don't mask new occurrences.

**Anti-recommendations (explicit DO NOT ADD):**
- **sonner / react-hot-toast** — we already have a toast pattern; milestone alerts are persistent/dismissable, not toasts.
- **Novu / Knock / Courier** — overkill; SaaS dependency for features you can model in Postgres.
- **Supabase Realtime** — explicitly excluded by v1.4 D-07 (connection cap).
- **Web Push / Service Workers** — out of scope (v1.4 D-10 implicitly; notifications system is V2+ per PROJECT.md Out of Scope line 85).

**One nuance worth flagging for phase planning:**
The "Closed Deal" milestone fires **on every deal** (v1.5 D-07). Because deals accumulate, the dismissal key must include the deal_id (not just `student_id + deal_closed`), otherwise dismissing one deal alert will suppress all future deal alerts for that student. This is a concrete variation on the time-windowed-key pattern that phase-specific planning should cover.

**Sources (Q3):**
- Internal: PROJECT.md line 85 ("In-app notifications system — V2+") and Key Decision on `alert_dismissals with time-windowed keys` — HIGH
- Internal: quick task 260401-cwd (referenced in milestone context) — HIGH
- v1.4 D-07 decision (polling over Realtime) — HIGH

---

### Q4. Date/time utilities → **Already installed: date-fns 4.1.0. Use it. Do NOT add dayjs.**

**Recommendation:** Use the existing `date-fns@^4.1.0` dependency (already in `package.json`) for all v1.5 date operations. Do NOT add dayjs. Do NOT add moment. Keep `getTodayUTC()` where it is already used for UTC-safe daily boundaries.

**Rationale:**
- `date-fns@4.1.0` is already a dependency. Adding dayjs would be a redundant 7 KB with overlapping functionality — strictly regression.
- date-fns v4 is **modular and tree-shakeable**. Importing only `startOfWeek`, `endOfWeek`, `addDays`, `format`, `differenceInDays` brings ~4–8 KB gzipped, not the whole library.
- date-fns v4 supports **time zones natively** (no `date-fns-tz` peer dep needed — this changed in v4), eliminating a whole class of "forgot to install tz" bugs.

**Functions v1.5 will need (all direct date-fns imports):**

| Need | Import | Purpose |
|------|--------|---------|
| ISO week boundaries (Mon–Sun) | `startOfISOWeek, endOfISOWeek` | v1.4 D-01 week convention; weekly top-3 leaderboard; skip tracker |
| Week trend buckets | `eachWeekOfInterval, startOfISOWeek` | Outreach trend chart X-axis |
| Month trend buckets | `eachMonthOfInterval, startOfMonth` | Deal history chart X-axis |
| Deadline math | `differenceInDays, addDays, isAfter` | Roadmap deadline chips (already used in v1.1 Phase 18) |
| Display formatting | `format` | "Mon, Apr 13" chip labels, tooltip dates |
| Relative time | `formatDistanceToNow` | "2h ago" on recent reports |

**Import pattern (tree-shaking-safe):**
```ts
import { startOfISOWeek, endOfISOWeek, format } from "date-fns";
// NOT: import * as dateFns from "date-fns"   ← defeats tree-shaking
```

**Keep using `getTodayUTC()`** — project already has this utility. It's idiomatic for the UTC-boundary work that underpins work_sessions/daily_reports day-level grouping. `date-fns` is for local-timezone *display* and for *week/month bucketing* in analytics queries that the RPC already buckets on the server. This split (server = Postgres `date_trunc`, client = date-fns display formatting) is the clean separation.

**Bundle impact:** ~0 KB net. date-fns is already in the bundle; v1.5 analytics imports 5–6 named exports (all within the existing chunk).

**Anti-recommendations (explicit DO NOT ADD):**
- **dayjs** — redundant with date-fns; do not add.
- **moment** — ~67 KB min+gzip; deprecated for new work by its own maintainers.
- **luxon** — bigger than date-fns, no incremental value for v1.5.
- **date-fns-tz** — NOT needed; v4 includes tz primitives natively.
- **Temporal polyfill** — Temporal is stage-3 and lands natively in modern runtimes; polyfilling for this milestone is premature.

**Sources (Q4):**
- Direct inspection of `package.json` (line 16): `"date-fns": "^4.1.0"` — HIGH
- date-fns v4 changelog (built-in tz support) — HIGH

---

## Summary: Net Changes to package.json

| Action | Package | Version | Role | Justification |
|--------|---------|---------|------|---------------|
| **ADD** | `recharts` | `^3.8.1` | prod | Only new runtime dep; backs all v1.5 chart surfaces |
| (optional) | `react-is` override | `19.2.3` | overrides | Only if peer-dep warning appears at install time |
| **Keep** | `date-fns` | `^4.1.0` | prod | Already present; use tree-shaken imports |
| **Keep** | `lucide-react` | `^0.576.0` | prod | Icons for stat cards, notification badges |
| **Keep** | `motion` | `^12.37.0` | prod | Motion-safe animations on cards |
| **Keep** | `class-variance-authority`, `clsx`, `tailwind-merge` | current | prod | CVA primitives for stat cards, chart wrappers |

**Do NOT add:**
- Any other chart library (nivo, visx, tremor, echarts, chart.js, victory, react-vis, plotly)
- dayjs, moment, luxon, date-fns-tz
- Any notifications SaaS or library (novu, knock, courier, sonner, react-hot-toast for milestone alerts)
- TimescaleDB / continuous-aggregates extension (deprecated on Supabase PG17; TSL features not supported)
- Supabase Realtime (v1.4 D-07 excludes it)
- Redis / Upstash (PROJECT.md Out of Scope line 91)
- New analytics DB (ClickHouse, DuckDB, hosted OLAP)

---

## Integration Notes (feed-through to ARCHITECTURE & PITFALLS)

1. **Chart host pattern:** server page fetches RPC data → passes to `"use client"` chart wrapper → wrapper renders recharts. Data layer must not leak server-only admin client into chart components.
2. **ima-* color pipeline:** create `src/lib/chart-colors.ts` exporting resolved hex constants (e.g., `IMA_PRIMARY = "#2563EB"`). Charts consume these constants via `stroke={IMA_PRIMARY}`. Rationale: Tailwind CSS 4 tokens are CSS variables; SSR charts need concrete hex at render time.
3. **Accessibility on charts:** every chart requires:
   - `accessibilityLayer` prop
   - Wrapping `<div role="img" aria-label="...">` with a meaningful description
   - `<title>` and `<desc>` via `Customized` SVG children if VoiceOver support matters
4. **Bundle budget:** load recharts only on analytics/dashboard routes. Next.js App Router code-splits per-route by default; keep charts inside the `(dashboard)` segment to avoid leaking into auth pages.
5. **motion-safe rule still applies** — any stat-card entrance animation must use `motion-safe:animate-*` per CLAUDE.md Hard Rule #1.
6. **`"use client"` boundary is the recharts wrapper only** — page, layout, and data fetch stay server components.
7. **RPC extensions over table additions** — for v1.5 analytics queries, prefer adding new `get_*_analytics()` RPC functions to existing summary tables rather than creating new tables. Only create a new weekly-rollup table if an RPC against existing data runs > 100ms in load test.

---

## Confidence Summary

| Area | Confidence | Reason |
|------|-----------|--------|
| Recharts 3.8.1 selection | HIGH | Multiple independent sources, active maintainer, alternatives clearly inferior for our constraints |
| React 19 + recharts compat | MEDIUM | 3.x supports it; `react-is` override may be needed — verify at install |
| date-fns v4 already satisfies needs | HIGH | Direct package.json inspection + known v4 capabilities |
| TimescaleDB rejection | HIGH | Supabase docs explicit; deprecation confirmed on PG17 |
| Keep existing pg_cron pattern | HIGH | Validated at 5k students in v1.2 load test |
| No notification library | HIGH | Existing 260401-cwd pattern already works; scope is explicitly V1 only |

---

## Sources (aggregate)

- [recharts npm](https://www.npmjs.com/package/recharts)
- [recharts GitHub releases](https://github.com/recharts/recharts/releases)
- [Recharts accessibility wiki](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility)
- [recharts React 19 issue #4558](https://github.com/recharts/recharts/issues/4558)
- [Next.js Charts with Recharts guide](https://app-generator.dev/docs/technologies/nextjs/integrate-recharts.html)
- [visx React 19 issue #1883](https://github.com/airbnb/visx/issues/1883)
- [Tremor GitHub](https://github.com/tremorlabs/tremor)
- [Supabase TimescaleDB docs](https://supabase.com/docs/guides/database/extensions/timescaledb)
- [Supabase TimescaleDB continuous aggregates issue #12342](https://github.com/supabase/supabase/issues/12342)
- [Supabase Postgres 17 discussion #35851](https://github.com/orgs/supabase/discussions/35851)
- [PostgreSQL REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html)
- Internal: `C:\Users\ibrah\ima-accelerator-v1\package.json` (dependency inspection)
- Internal: `C:\Users\ibrah\ima-accelerator-v1\.planning\PROJECT.md` (v1.4 decisions, v1.5 pending decisions, v1.2 load-test validation)
- Internal: `C:\Users\ibrah\ima-accelerator-v1\CLAUDE.md` (hard rules, stack constraints)
