---
phase: 48
slug: full-coach-analytics-page
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-13
---

# Phase 48 — UI Design Contract

> Visual and interaction contract for `/coach/analytics`: 5 aggregate KPIs, 3 top-5 leaderboards (hours-this-week, emails-this-week, all-time-deals), one 12-week "Deals Closed Over Time" Recharts bar chart, an Active vs Inactive header chip, a paginated/searchable/sortable student list (25/page), and a CSV export action. All data flows from one batch RPC `get_coach_analytics` wrapped in `unstable_cache` 60s. Visual style must align exactly with Phase 46 (`/student/analytics`) and Phase 47 (coach dashboard) — no theme drift.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn, no new deps) |
| Preset | not applicable |
| Component library | Internal CVA primitives in `src/components/ui/*` (Card, Badge, Button, EmptyState, Skeleton, Input, PaginationControls) |
| Charts | `recharts` (already installed, used in Phase 46) — `BarChart` only on this page |
| Icon library | `lucide-react` (already a dep) |
| Font | Inherited from `src/app/layout.tsx` system font stack — no font change |

Reuse only. No new libraries, no new primitives, no new animations. The student-list table reuses the `<Card>` frame; cells use plain `<table>` semantics (no new TableComponent primitive). PaginationControls is the existing primitive (`src/components/ui/PaginationControls.tsx`) used in Phase 46 deal history.

---

## Spacing Scale

Declared values (multiples of 4, matching Phase 46/47 and Tailwind defaults):

| Token | Value | Usage |
|-------|-------|-------|
| xs  | 4px  (`gap-1`, `p-1`)   | Inline icon-to-label gaps inside badges/chips |
| sm  | 8px  (`gap-2`, `p-2`)   | Compact cell padding, search-icon to input gap |
| md  | 16px (`gap-4`, `p-4`)   | Default card inner padding, grid gaps, table cell padding |
| lg  | 24px (`gap-6`, `mt-6`)  | Section vertical rhythm (header → KPIs → leaderboards → chart → table) |
| xl  | 32px (`mt-8`)           | Reserved — not used on this page |
| 2xl | 48px                    | Not used |
| 3xl | 64px                    | Not used |

**Page wrapper:** `px-4 py-6 max-w-7xl mx-auto` — matches Phase 46 student analytics page wrapper exactly.

**Header row:** `flex flex-wrap items-center justify-between gap-4` — `<h1>` + Active/Inactive chip on the left, `Export CSV` button on the right.

**KPI card grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6` — 5 KPIs as cards:
1. Highest Deals Closed (top student name + count)
2. Total Revenue Generated
3. Avg Roadmap Step
4. Avg Email Count
5. Most Emails Sent (top student name + count)

On `<sm` breakpoints the grid collapses to 1 column; on `sm`–`lg` it shows 2 columns × 3 rows (last cell spans normally, no orphan styling); on `≥lg` it shows 5 columns × 1 row.

**Leaderboard grid:** `grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6` — three top-5 cards side-by-side on desktop, stacked on tablet/mobile.

**Chart card:** `mt-6 p-4` — full-width Card containing the Deals Closed Over Time bar chart at fixed height `h-72` (288px) inside `<ResponsiveContainer>`.

**Student list section:** `mt-6` — Card containing toolbar row (search + sort hint), then `<table>` with `min-w-full divide-y divide-ima-border`, then `PaginationControls` row at the bottom (`px-4 py-3 border-t border-ima-border`).

**Inside KPI card:** `p-4 flex items-center gap-4`; tinted icon box `w-10 h-10 rounded-lg bg-{tint}/10` with icon `h-5 w-5 text-{tint}`.

**Inside leaderboard card:** `p-4`. Header `flex items-center justify-between mb-4`. Rows each `flex items-center gap-3 p-3 rounded-lg min-h-[44px]`.

**Search input row:** `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-ima-border`. Search input `w-full sm:w-72`.

Exceptions: none.

---

## Typography

Matches Phase 46/47 exactly. No new sizes, weights, or families.

| Role | Size | Weight | Line Height | Tailwind Classes |
|------|------|--------|-------------|------------------|
| Page H1 | 24px | 700 bold | 1.25 | `text-2xl font-bold text-ima-text` |
| Section heading | 16px | 600 semibold | 1.5 | `text-base font-semibold text-ima-text` |
| KPI value (numeric) | 24px | 700 bold | 1.25 | `text-2xl font-bold text-ima-text tabular-nums` |
| KPI value (top-student name + count) | 16px | 600 semibold | 1.5 | `text-base font-semibold text-ima-text truncate` |
| KPI label | 12px | 400 normal | 1.33 | `text-xs text-ima-text-secondary` |
| Leaderboard student name | 14px | 500 medium | 1.43 | `text-sm font-medium text-ima-text truncate` |
| Leaderboard metric | 14px | 600 semibold | 1.43 | `text-sm font-semibold text-ima-text tabular-nums` |
| Rank #1 badge | 12px | 600 | 1.33 | `text-xs font-semibold` (inside `<Badge variant="primary">`) |
| Rank #2–5 number | 12px | 600 | 1.33 | `text-xs font-semibold text-ima-text-muted tabular-nums` |
| Table header | 12px | 600 semibold uppercase tracking-wide | 1.33 | `text-xs font-semibold text-ima-text-secondary uppercase tracking-wide` |
| Table cell | 14px | 400 | 1.43 | `text-sm text-ima-text` |
| Table cell numeric | 14px | 500 | 1.43 | `text-sm font-medium text-ima-text tabular-nums` |
| Active/Inactive chip text | 12px | 600 | 1.33 | `text-xs font-semibold` |
| Pagination meta ("Page 2 of 7") | 12px | 400 | 1.33 | `text-xs text-ima-text-secondary tabular-nums` |
| Empty state heading | 16px | 600 | 1.5 | inherited from `EmptyState` primitive |

**Rules:**
- All numeric values use `tabular-nums` to prevent column jitter.
- Currency: `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })` — formatted server-side.
- Average roadmap step: `Number.toFixed(1)` (e.g., `3.2`) — formatted server-side.
- Average email count: `Number.toFixed(0)` integer with thousands separator — formatted server-side.
- Hours: rendered as `{h}h {m}m` (e.g., `8h 45m`) — formatted server-side.
- Relative time / "Last active": `formatDistanceToNowStrict` from `date-fns` (already a dep) — formatted server-side via shared helper.

---

## Color

All colors map to existing `ima-*` tokens in `tailwind.config.ts`. Never hardcode hex outside the `chartColors` constant required by Recharts.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-ima-bg` (#F8FAFC) | Page background (from layout) |
| Secondary (30%) | `bg-ima-surface` (#FFFFFF) | Card backgrounds via `<Card>` primitive |
| Accent — primary | `bg-ima-primary/10` + `text-ima-primary` | KPI #1 (Highest Deals) icon tint; rank-#1 badge `bg-ima-primary text-white`; chart bar fill |
| Accent — success | `bg-ima-success/10` + `text-ima-success` | KPI #2 (Revenue) icon tint; Active chip fg/bg |
| Accent — info | `bg-ima-info/10` + `text-ima-info` | KPI #3 (Avg Roadmap Step) icon tint |
| Accent — warning | `bg-ima-warning/10` + `text-ima-warning` | KPI #4 (Avg Email Count) icon tint |
| Accent — accent | `bg-ima-accent/10` + `text-ima-accent` | KPI #5 (Most Emails) icon tint |
| Inactive chip | `bg-ima-text-muted/10` + `text-ima-text-secondary` | Inactive chip (no destructive red — inactivity is not an error) |
| Border | `border-ima-border` | Table dividers, card frames, pagination separator |
| Text primary | `text-ima-text` | All primary copy |
| Text secondary | `text-ima-text-secondary` | Labels, table headers, pagination meta |
| Text muted | `text-ima-text-muted` | Rank #2–5 numbers, empty cells |
| Destructive | `text-ima-error` | Reserved for error toasts only — no destructive UI on this page |

**Accent reserved for:**
1. The 5 KPI icon tinted boxes (one tint per KPI, semantic mapping above).
2. Rank #1 badge (`bg-ima-primary text-white`) in each of the 3 leaderboards.
3. Recharts chart bar fill (`#2563EB` literal in `chartColors.primary` const, mirroring the `ima-primary` token).
4. Sort-direction indicator chevron in the active sort column (`text-ima-primary`).

**Banned on this page:**
- Any hex literal **outside** the explicit `chartColors` const (mandated comment required at the const declaration).
- Any `text-gray-*`, `bg-gray-*`, `border-gray-*`, `text-slate-*`, etc.
- `text-white` anywhere except on colored backgrounds (rank #1 badge, student avatar initials).
- New color creation; new tints; new opacity values besides `/10`.

**Recharts color constant (required, copied from Phase 46):**

```ts
// Mirrors tailwind.config.ts ima-* tokens. Recharts requires literal hex
// for stroke/fill props, so a single audited constant lives at the top of
// the chart component file. Any additions go through ima-token review.
const chartColors = {
  primary: "#2563EB",      // ima-primary
  border: "#E2E8F0",       // ima-border
  textSecondary: "#64748B" // ima-text-secondary
} as const;
```

---

## Copywriting Contract

Voice: direct, action-oriented, same tone as Phase 46/47. No marketing fluff, no emoji, no exclamation marks.

### Page Header

- H1: `Coach Analytics`
- Sub-line (under H1): `Aggregate stats across your assigned students.` (`text-sm text-ima-text-secondary mt-1`)
- Active/Inactive chip: `{N} active · {M} inactive` — single combined chip, e.g., `12 active · 3 inactive`. Pill shape, two halves: green-tinted left half (active count + dot), muted right half (inactive count). Reuse `<Badge>` with custom inline content; no new primitive.
  - Tooltip / `title` attribute: `Active = work session or report in last 7 days. Inactive = no activity in last 7 days.`
- Export button (right): `Export CSV` (icon `Download` from lucide-react). `aria-label="Export student list as CSV"`.

### KPI Cards (5)

| # | Label | Value Format | Sub-line | Icon |
|---|-------|--------------|----------|------|
| 1 | `Highest Deals` | `{count} deals` (e.g., `7 deals`) | `{Student Name}` (truncated, semibold) | `Trophy` |
| 2 | `Total Revenue` | `$12,400` | (none) | `DollarSign` |
| 3 | `Avg Roadmap Step` | `3.2` | `out of {ROADMAP_STEPS.length}` | `TrendingUp` |
| 4 | `Avg Email Count` | `1,240` | `per student` | `Mail` |
| 5 | `Most Emails Sent` | `{count} emails` (e.g., `2,400 emails`) | `{Student Name}` (truncated, semibold) | `Send` |

Zero-state values: `0 deals`, `$0`, `0.0`, `0`, `0 emails`. Sub-line for empty top-student: `No data yet`. Never `—`, `N/A`, or `null`.

### Leaderboards (3)

Each leaderboard is a separate Card.

| Card heading | Sub-heading | Metric format | Empty heading | Empty body |
|--------------|-------------|---------------|---------------|------------|
| `Top 5 — Hours This Week` | `Since Monday {weekStartLabel}` (e.g., `Since Monday Apr 13`) | `8h 45m` | `No hours logged this week` | `Once your students start work sessions, the weekly leaderboard will appear here.` |
| `Top 5 — Emails This Week` | `Since Monday {weekStartLabel}` | `1,240` | `No emails logged this week` | `Reports submitted this week will populate this leaderboard.` |
| `Top 5 — All-Time Deals` | `Lifetime closed-deal count` | `12 deals` | `No deals closed yet` | `Closed deals will appear here as your students log them.` |

Per-row: `#{rank}` • `{Student Name}` • `{metric}` (right-aligned, tabular).

If fewer than 5 rows exist, render only the rows that exist (no placeholder rows).

### Deals Closed Over Time Chart Card

- Card heading: `Deals Closed Over Time`
- Sub-heading: `Last 12 weeks (week starting Monday)`
- X axis: short label `MMM d` for each Monday week-start.
- Y axis: integer deal count (no decimals).
- Tooltip: `{week label}: {N} deals closed`
- Empty state heading: `No deals in the last 12 weeks`
- Empty state body: `Once a student closes a deal, it'll show up here.`
- Hidden `<details>` fallback (a11y, mirrors Phase 46 pattern):
  - Summary: `View chart data as text`
  - Body: `<ul>` of "Week of {date}: {N} deals" rows.

### Student List Section

- Section heading (inside Card header): `All Students` (no sub-heading needed — the toolbar communicates filters)
- Search input: placeholder `Search by name`. `aria-label="Search students by name"`.
  - Empty search clear button (`X` icon, only when value present): `aria-label="Clear search"`.
  - Debounce: 300ms before pushing to URL `?search=`.
- Sort hint (right-aligned next to search on `≥sm`): `Click a column to sort` (`text-xs text-ima-text-secondary` — only shown when sort is at default).
- Table columns (in order):
  1. `Name` (sortable)
  2. `Hours This Week` (sortable, numeric)
  3. `Emails This Week` (sortable, numeric)
  4. `All-Time Deals` (sortable, numeric)
  5. `Roadmap Step` (sortable, numeric)
  6. `Last Active` (sortable, relative time)
  7. `Status` (not sortable — static chip column)
- Cell formats:
  - Name cell: `<Link href="/coach/students/{id}">` with student name, `text-sm font-medium text-ima-primary hover:underline min-h-[44px] inline-flex items-center`.
  - Numeric cells: right-aligned, `tabular-nums`.
  - Last Active cell: relative time string ("2d ago" / "Yesterday" / "Mar 14") with `<time dateTime={iso}>` wrapper.
  - Status cell: small chip — Active (`bg-ima-success/10 text-ima-success`) or Inactive (`bg-ima-text-muted/10 text-ima-text-secondary`).
- Sort direction indicator: chevron icon (`ChevronUp` / `ChevronDown`) next to the active column header in `text-ima-primary`. Inactive sort columns show no chevron (or a faint `ChevronsUpDown` `text-ima-text-muted` for affordance — pick `ChevronsUpDown`, consistent across all sortable columns).
- Empty (no students): heading `No assigned students yet`, body `Once an owner assigns students to you, they'll appear here.`
- Empty (search returned nothing): heading `No matches for "{query}"`, body `Try a different name or clear the search.` Includes a `<Button variant="outline" size="sm">Clear search</Button>`.
- Pagination footer: existing `<PaginationControls>` primitive — page X of Y, prev/next buttons.
- Page size: fixed at 25 (D-04 requirement). No page-size selector exposed.

### Export CSV

- Button label: `Export CSV` (icon `Download`).
- On click: server-streamed download via GET `/api/coach/analytics/export.csv?search=...&sort=...` (NOT the same RPC — separate route handler that paginates internally to dump all matching rows).
- File name: `coach-analytics-{coachId}-{YYYY-MM-DD}.csv`.
- Columns (header row, in this order): `Name,Hours This Week (minutes),Emails This Week,All-Time Deals,Roadmap Step,Last Active (ISO),Status`.
- Status column values: `Active` / `Inactive`.
- Loading state: button shows inline `<Spinner size="sm" />` and label `Exporting…` (single curly-quote ellipsis allowed in transient loading copy only); button disabled (`aria-disabled="true"` plus actual `disabled`).
- Error toast (via existing toast helper): `Couldn't export CSV. Try again.`
- Success: browser download initiated; no toast (the file is the feedback).

### Loading States

Use the existing `Skeleton` primitive (`src/components/ui/Skeleton.tsx`).

- KPI grid skeleton: 5 card skeletons, each `p-4 flex items-center gap-4` with `w-10 h-10 rounded-lg` icon skeleton + value/label skeletons (`h-8 w-20`, `h-3 w-24`).
- Leaderboard skeleton: 3 cards × 5 rows of `h-11` (44px) skeleton each.
- Chart skeleton: `h-72 w-full rounded-lg` single skeleton block, role `status`, aria-label `Loading deals trend chart`.
- Table skeleton: 25 rows × 7 columns of `h-11` row skeletons inside the table body.
- Top-level wrapper: `<div role="status" aria-label="Loading coach analytics">` — single announcement; nested skeletons get `aria-hidden="true"`.
- File `loading.tsx` at `src/app/(dashboard)/coach/analytics/loading.tsx` renders this composite skeleton screen.

### Error States

- Page-level: existing `error.tsx` boundary at `src/app/(dashboard)/coach/analytics/error.tsx` shows `EmptyState` with heading `Couldn't load analytics`, body `Try refreshing the page. If the issue persists, contact support.`, and a `Try again` button that calls `reset()`.
- Per-fetch failure inside the page is impossible (single batch RPC); RPC failure throws and is caught by `error.tsx`.
- Search/sort URL-param validation failure (Zod safeParse): redirect to clean URL (`/coach/analytics`) — never render an error UI for that.

### Destructive

There are no destructive actions on this page.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | (none — not initialized on this project) | not required |
| Internal `src/components/ui/*` (Card, Badge, Button, Skeleton, EmptyState, Input, PaginationControls, Spinner) | All UI for this phase composes these existing primitives | Plan must reject any new primitive proposal |
| `recharts` (already a dep) | `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` | Already used in Phase 46; no new chart type introduced |
| `lucide-react` | `Trophy`, `DollarSign`, `TrendingUp`, `Mail`, `Send`, `Download`, `Search`, `X`, `ChevronUp`, `ChevronDown`, `ChevronsUpDown` | already a dep |
| Third-party | none | n/a |

No new files in `src/components/ui/`. All new components live under `src/components/coach/analytics/` (feature components, not primitives):
- `CoachAnalyticsClient.tsx` (orchestrator client component, "use client")
- `KPIGrid.tsx` (composes 5 existing-style KPI cards inline — or reuses Phase 47's `KPICard.tsx` if compatible; prefer reuse)
- `LeaderboardCard.tsx` (single component, instanced 3× with different props)
- `DealsTrendChart.tsx` (Recharts wrapper)
- `StudentListTable.tsx` (table + sort + search + pagination)
- `ExportCsvButton.tsx` (download button)
- `ActiveInactiveChip.tsx` (single header chip)

---

## Component-Level Contracts

### CoachAnalyticsPage (server component, `page.tsx`)

- Path: `src/app/(dashboard)/coach/analytics/page.tsx`
- Server component — no `"use client"`.
- Reads searchParams (Next.js 16: `searchParams` is a `Promise`), Zod-validates them via `coachAnalyticsSearchParamsSchema` (page, pageSize, sort, search). Invalid → redirect to clean URL.
- Auth check: `getSessionUser()` + role-gate (`coach` or `owner`); unauthenticated → redirect to login; non-coach → redirect to `/no-access`.
- Calls cached helper `getCoachAnalyticsCached(coachId, params)` that wraps the admin-client RPC call in `unstable_cache` with key `["coach-analytics", coachId, JSON.stringify(params)]`, tag `coach-analytics-${coachId}`, revalidate `60`.
- Renders `<CoachAnalyticsClient payload={...} initialParams={...} />`.

### CoachAnalyticsClient ("use client")

- Wraps the entire interactive surface (search, sort, pagination, export button click, chart render).
- Uses `useRouter` + `useTransition` to push URL updates for sort/search/page changes (mirrors Phase 46 pattern).
- Receives full payload as prop — does NOT re-fetch (server already fetched via cache wrapper).
- For search input: 300ms debounce via `useRef<NodeJS.Timeout>`; on submit, push `?search=...&page=1`.
- Resets to page 1 on any sort or search change.

### KPIGrid

- Stateless presentational component.
- Props: `{ highestDeals, totalRevenue, avgRoadmapStep, avgEmailCount, mostEmails }` (all pre-formatted strings).
- Layout: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4`.
- Reuses Phase 47 `<KPICard>` if compatible; otherwise inline-renders 5 `<Card>` blocks identical in spacing/typography to Phase 47.

### LeaderboardCard

- Props: `{ heading: string; subheading: string; rows: { rank: number; name: string; studentId: string; metric: string }[]; emptyHeading: string; emptyBody: string }`.
- Renders Card → header → 5-row list (or empty state). Each row is a `<Link href="/coach/students/{studentId}">` for navigation, with `min-h-[44px]` and focus-visible outline.
- Rank 1: `<Badge variant="primary">#1</Badge>`. Ranks 2–5: `text-ima-text-muted font-semibold`.
- Avatar: `w-8 h-8 rounded-full bg-ima-primary text-white text-xs font-semibold` initials circle (matches Phase 47 leaderboard).

### DealsTrendChart

- "use client" (Recharts requires browser).
- Props: `{ buckets: { weekStart: string; iso: string; deals: number }[] }` — exactly 12 entries, oldest → newest, padded with zero buckets server-side so the chart never has fewer than 12.
- Renders inside `<ResponsiveContainer width="100%" height={288}>` (== `h-72`).
- `<BarChart>` with `<CartesianGrid stroke={chartColors.border} strokeDasharray="3 3" />`, `<XAxis dataKey="weekStart" stroke={chartColors.textSecondary} fontSize={12} />`, `<YAxis allowDecimals={false} stroke={chartColors.textSecondary} fontSize={12} />`, `<Tooltip />`, `<Bar dataKey="deals" fill={chartColors.primary} radius={[4,4,0,0]} />`.
- Wrapper `<div role="img" tabIndex={0} aria-label="Bar chart: Deals closed per week, last 12 weeks">`.
- `<details>` fallback below the chart with `summary="View chart data as text"` and a list of week-by-week values.
- Empty state (all-zero buckets): replace chart with `<EmptyState heading="No deals in the last 12 weeks" body="Once a student closes a deal, it'll show up here." />`.

### StudentListTable

- Props: `{ students: StudentRow[]; total: number; page: number; pageSize: 25; sort: SortKey; search: string }`.
- Toolbar (above table): `<Input>` with leading `<Search>` icon (decorative, `aria-hidden`), trailing `<X>` clear button when value present.
- Table: semantic `<table><thead><tr><th>...` with `scope="col"` on each `<th>`; sortable headers wrap the label in a `<button>` (per a11y) with `aria-sort="none|ascending|descending"` and `min-h-[44px]`.
- Row link: name cell wraps `<Link>`; entire row is NOT a link (avoids button-in-link nesting issue with the chip column). Row hover: `motion-safe:transition-colors hover:bg-ima-surface-light`.
- PaginationControls: existing primitive, props `{ currentPage, totalPages, onPageChange }` — `onPageChange` pushes `?page=N`.

### ExportCsvButton

- "use client".
- `<Button variant="outline" size="md">` with `Download` icon + label `Export CSV`.
- On click: `window.location.href = '/api/coach/analytics/export.csv?' + new URLSearchParams({ search, sort })`. Browser handles the download — no fetch+blob complexity needed since this is a coach-only authenticated endpoint with `Content-Disposition: attachment`.
- Disabled state during a 1-second cooldown (prevents double-click double-download). Cooldown set via `useState` + `setTimeout` cleared on unmount.
- `aria-label="Export student list as CSV"`.

### ActiveInactiveChip

- Props: `{ activeCount: number; inactiveCount: number }`.
- Renders single rounded-full pill with two halves separated by a `1px` divider.
- Both counts use `tabular-nums`.
- Title attribute carries the definition string (no JS tooltip — native `title` is sufficient and a11y-friendly).

---

## Interaction & Accessibility Contract

Every one of these is non-negotiable (hard rules from `CLAUDE.md`):

1. **Touch targets:** Every interactive control — column header sort buttons, search input, search clear button, every leaderboard row link, every name-cell link, pagination buttons, Export CSV button — has `min-h-[44px]` (and `min-w-[44px]` for icon-only buttons).
2. **Motion safety:** Every `hover:bg-*`, `hover:shadow-*`, `transition-*` uses `motion-safe:transition-colors` / `motion-safe:transition-shadow`. Recharts default animations are disabled by passing `isAnimationActive={false}` on `<Bar>` (matches Phase 46 — respects users with `prefers-reduced-motion`).
3. **ARIA labels:**
   - Page wrapper: top-level `<main>` already provided by layout; this page is `<section aria-labelledby="coach-analytics-h1">` with the H1 carrying `id="coach-analytics-h1"`.
   - Active/Inactive chip: `aria-label="{N} students active, {M} students inactive in the last 7 days"`.
   - Each KPI card: `aria-label` like `"Highest deals: 7 by Sarah"` — full sentence form.
   - Each leaderboard card: `aria-labelledby` pointing to its heading id; row links carry `aria-label="View {Name} — {metric}"`.
   - Chart wrapper: `role="img"` + `tabIndex={0}` + `aria-label="Bar chart: Deals closed per week, last 12 weeks. Use the data table below for screen-reader access."`.
   - Sort buttons: `aria-sort="none|ascending|descending"` on the parent `<th>`, plus per-button `aria-label="Sort by Hours This Week, currently unsorted/ascending/descending"`.
   - Search input: `<label htmlFor="coach-analytics-search" className="sr-only">Search students by name</label>` + matching `id` on the input; placeholder is supplemental, not the only label.
   - Export button: `aria-label="Export student list as CSV"`. While exporting: `aria-busy="true"`.
   - Loading skeletons: single `role="status"` wrapper, individual `aria-hidden="true"`.
   - Empty states: rendered via `EmptyState` primitive (already has `role="status"` per Phase 46 review).
   - Decorative lucide icons: `aria-hidden="true"`.
4. **Keyboard:**
   - All sortable headers are real `<button>` elements — Tab/Enter/Space work natively.
   - Chart wrapper is `tabIndex={0}` so keyboard users land on it; `<details>` fallback is keyboard-operable.
   - Pagination buttons are real `<button>`s.
   - Search input clears with `Escape` (keydown handler — prevents re-querying when the user just wants to dismiss).
5. **Focus visible:** Every interactive element applies `focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2`. Default browser focus ring suppressed via the existing `outline-none focus-visible:outline-...` pattern only — never `outline-none` without the visible alternative.
6. **Error handling:** Every server-side fetch in the RPC route uses the admin client. Every `catch` block `console.error`s the error. No empty `catch {}`. Toast on user-facing failures (CSV export). Page error.tsx catches render failures.
7. **Server-side formatting:** Currency, decimal, hours-and-minutes, and relative time all formatted server-side (in the page component or in a shared util) before passing to client — prevents hydration drift.
8. **URL is the source of truth:** Sort, search, and page state live in URL search params. Reload preserves state. Back/forward navigates between sort/search states. Client never holds canonical state; `useRouter().push()` is the only way to mutate.
9. **Zod safeParse on every input boundary:** searchParams (server), CSV export query string (server route handler), RPC response shape (server). Zod errors → redirect to clean URL (UI) or 400 (API).
10. **Admin client only in server code:** RPC call uses `createAdminClient()` from `src/lib/supabase/admin.ts`; never imported in client components.

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| `<640px` (mobile) | Header chip wraps below H1. KPI grid: 1 column × 5 rows. Leaderboards: stacked 1 column. Chart: full-width, `h-72`. Table: horizontally scrolls inside its Card (`overflow-x-auto`); search input is full-width above the table. |
| `640–1023px` (tablet) | KPI grid: 2 columns. Leaderboards: still stacked (one card per row to keep top-5 readable). Table: fits without horizontal scroll on most cells; allow `overflow-x-auto` as fallback. |
| `≥1024px` (desktop) | KPI grid: 5 columns × 1 row. Leaderboards: 3 columns side-by-side. Table: full width inside `max-w-7xl mx-auto` wrapper. |

No horizontal page-level scroll at any breakpoint down to 320px. Table is the only horizontally-scrollable region (its parent has `overflow-x-auto`); column widths use `whitespace-nowrap` on numeric and date columns, `max-w-[200px] truncate` on the name column.

---

## URL Search Param Contract

Schema (Zod):

```ts
const coachAnalyticsSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.literal(25).default(25),  // Fixed per D-04
  sort: z.enum([
    "name_asc", "name_desc",
    "hours_asc", "hours_desc",
    "emails_asc", "emails_desc",
    "deals_asc", "deals_desc",
    "step_asc", "step_desc",
    "lastActive_asc", "lastActive_desc",
  ]).default("name_asc"),
  search: z.string().trim().max(100).default(""),
});
```

- `page` clamped server-side to `[1, totalPages]` when totalPages is known.
- `pageSize` is a literal `25` — the URL param is rejected if it differs (defense in depth against URL tampering).
- `sort` defaults to `name_asc`. Invalid → redirect to `?sort=name_asc`.
- `search` is trimmed to 100 chars and lowercased server-side before being passed to the RPC (RPC uses `ILIKE '%' || $arg || '%'` on `users.full_name`).

---

## CSV Export Contract

- Endpoint: `GET /api/coach/analytics/export.csv`
- Auth: requires authenticated coach session; rejects 401 if not logged in, 403 if not a coach.
- Query params: `search` and `sort` only — page/pageSize ignored (export dumps all matching rows).
- Internally calls the same RPC with `p_page_size = 5000` (sentinel cap matching Phase 44 max-page-size guardrail) and asserts `total <= 5000`; otherwise returns 400 with body `Export too large. Refine your search.` (defensive — coach has at most a few hundred assigned students in production, well under the cap).
- Response headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="coach-analytics-{coachId}-{YYYY-MM-DD}.csv"`.
- Response body: header row + data rows, RFC 4180 compliant (commas in names quoted, double-quotes escaped). Use a tiny inline serializer — no new csv dep.

---

## Cache Contract

- Helper: `getCoachAnalyticsCached(coachId, params)` in `src/lib/cache/coach-analytics.ts` (new file, server-only — top of file `import "server-only";`).
- `unstable_cache(fn, [stableKey], { tags: [tag], revalidate: 60 })` where `stableKey = ["coach-analytics", coachId, JSON.stringify(params)]` and `tag = ["coach-analytics", \`coach-analytics-${coachId}\`]`.
- Invalidation hooks (added in Phase 49 / 51 — out of scope here, but document the contract):
  - On any `deals` insert/update/delete touching this coach's students → `revalidateTag(\`coach-analytics-${coachId}\`)`
  - On any `daily_reports` insert by an assigned student → same.
  - On any `work_sessions` complete → same.
  - These hooks are owned by Phase 49/51; this phase only writes the cache wrapper and tag.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — all 5 KPIs, 3 leaderboards, chart, table, search, export, error/empty/loading copy fully specified; voice consistent with Phases 46/47; no ambiguous strings; no emoji; a11y labels are sentence-form.
- [x] Dimension 2 Visuals: PASS — only existing primitives used (Card, Badge, Button, EmptyState, Skeleton, Input, PaginationControls, Spinner); no new UI primitive proposed; new files live in `src/components/coach/analytics/` as feature components; Recharts already a project dep.
- [x] Dimension 3 Color: PASS — every color routed through `ima-*` tokens; the only hex literals are inside the `chartColors` const which mirrors tokens with a mandatory comment; no `text-gray-*`, `text-slate-*`, or raw hex elsewhere; `text-white` only on rank-#1 badge and avatar circles; opacity restricted to `/10` for tints.
- [x] Dimension 4 Typography: PASS — no new sizes, weights, or families; `tabular-nums` locked on every numeric value; formatting (currency, hours, relative time) explicitly server-side; same scale as Phase 46/47.
- [x] Dimension 5 Spacing: PASS — every value is a multiple of 4 from the declared scale; page wrapper `px-4 py-6 max-w-7xl mx-auto`; card inner `p-4`; section rhythm `mt-6`; grid gaps `gap-4`; row min-height `min-h-[44px]`.
- [x] Dimension 6 Registry Safety: PASS — no shadcn, no new third-party registry block, no new npm dep; Recharts and lucide-react already installed; only existing internal primitives composed.

**Approval:** approved 2026-04-13 (auto-generated via skipped discuss + inline UI-SPEC; mirrors Phase 46/47 precedent and conforms to all hard rules in CLAUDE.md)
