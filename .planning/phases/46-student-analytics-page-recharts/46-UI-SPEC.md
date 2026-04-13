---
phase: 46
slug: student-analytics-page-recharts
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-13
---

# Phase 46 — UI Design Contract

> Visual and interaction contract for the Student Analytics Page. Generated inline (UI workflow).
> Scope: `/student/analytics` and `/student_diy/analytics` — 6 KPI cards, outreach + hours trend charts (Recharts), deal history table (paginated 25/page), roadmap deadline status list.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (existing CVA primitives in `src/components/ui/`) |
| Preset | not applicable |
| Component library | none (custom primitives: Card, Button, Badge, EmptyState, Skeleton, PaginationControls) |
| Icon library | lucide-react (already in use) |
| Font | Inherits from root layout (system sans-serif via Tailwind defaults) |
| Charts | Recharts (new dependency for this phase) |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gaps, badge inner padding (`gap-1`, `p-1`) |
| sm | 8px | Compact stack spacing inside KPI cards (`gap-2`, `p-2`) |
| md | 16px | Default card padding, between KPI label/value (`p-4`, `gap-4`) |
| lg | 24px | Section padding inside Card containers, table cell padding (`p-6`, `gap-6`) |
| xl | 32px | Layout gaps between major analytics sections (KPI strip → trend charts → table) (`gap-8`) |
| 2xl | 48px | Page top/bottom padding on desktop (`py-12`) |
| 3xl | 64px | Reserved — not used on this page |

Page wrapper: `px-4` mobile / `px-6` tablet+ (mandated by CLAUDE.md).
Touch targets: every interactive element (range selector buttons, pagination, table sort headers if any, "View data table" `<summary>`) uses `min-h-[44px]` and `min-w-[44px]`.

Exceptions: none.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 (`font-normal`) | 1.5 (`leading-normal`) |
| Label (KPI label, table header, axis label) | 12px (`text-xs`) | 500 (`font-medium`, uppercase tracking-wide for headers) | 1.25 |
| Heading (section titles "Outreach Trend", "Deal History") | 18px (`text-lg`) | 600 (`font-semibold`) | 1.4 |
| Display (KPI value: "1,247 hrs", "$12,400") | 30px (`text-3xl`) | 700 (`font-bold`) | 1.1 (`leading-tight`) |
| Page title ("Analytics") | 24px (`text-2xl`) | 700 (`font-bold`) | 1.2 |

Streak indicator within KPI card: 14px body weight 600, paired with flame icon `aria-hidden="true"`.

---

## Color

All values pulled from `tailwind.config.ts` `ima-*` tokens — never hardcoded hex.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `ima-bg` (#F8FAFC) | Page background |
| Secondary (30%) | `ima-surface` (#FFFFFF) | Card backgrounds, table rows; `ima-surface-light` (#F1F5F9) for table header row + zebra/hover |
| Accent (10%) | `ima-primary` (#2563EB) | Active range selector, primary trend line (outreach total), pagination active page, "View data table" link |
| Destructive | `ima-error` (#EF4444) | Overdue roadmap status badge only |

Accent reserved for: active range selector button, primary chart series stroke (outreach line / hours bar), active pagination page indicator, and links inside `<details>` data table fallback. **Never** applied to: KPI card borders (use `ima-border`), inactive table rows, decorative chart gridlines (`ima-border`).

Status colors (deadline + RAG):
- on-track / completed → `ima-success` (#10B981)
- due-soon → `ima-warning` (#F59E0B)
- overdue → `ima-error` (#EF4444)
- ahead → `ima-info` (#3B82F6)

Chart series:
- Outreach trend chart: brands = `ima-primary` (#2563EB), influencers = `ima-accent` (#3B82F6), grid = `ima-border`, axis text = `ima-text-secondary`
- Hours trend chart: bars = `ima-primary`, target reference line = `ima-warning`

Attribution chips on Deal History table:
- self → `ima-surface-light` background, `ima-text` foreground
- coach → `ima-surface-accent` background, `ima-secondary` foreground
- owner → `ima-primary` background, white foreground (one of the rare `text-white` cases — colored background)

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | "Analytics" |
| Page subtitle | "Your performance at a glance" |
| KPI labels | "Total Hours" · "Total Emails" · "Total Influencers" · "Total Deals" · "Total Revenue" · "Total Profit" |
| Streak indicator | "{N}-day streak" (singular: "1-day streak") |
| Range selector labels | "7d" · "30d" · "90d" · "All" (default selected: "30d") |
| Range selector aria-label | "Select time range" (group), each button: "Last 7 days", "Last 30 days", "Last 90 days", "All time" |
| Outreach chart heading | "Outreach Trend" |
| Outreach chart prose summary (screen reader) | "Weekly outreach for the selected range. Brands sent: {total}. Influencers sent: {total}." |
| Hours chart heading | "Hours Worked" |
| Hours chart prose summary | "Hours worked per {day|week} for the selected range. Total: {N} hours." |
| Deal History heading | "Deal History" |
| Deal table column headers | "Deal #" · "Revenue" · "Profit" · "Margin" · "Logged" · "By" |
| Deal table summary footer | "{N} deals · ${revenue} revenue · ${profit} profit" |
| Roadmap section heading | "Roadmap Progress" |
| Roadmap step status badges | "Completed" · "On track" · "Due soon" · "Overdue" · "Ahead of schedule" |
| Empty state heading (no deals yet) | "No deals logged yet" |
| Empty state body (no deals yet) | "Once you close your first deal, it will show up here. Keep your outreach consistent." |
| Empty state heading (no data in range) | "No activity in this range" |
| Empty state body (no data in range) | "Try a longer time range, or check back after your next session." |
| Error state | "We couldn't load your analytics. Refresh the page or try again in a moment." (toast variant: error) |
| Loading state (skeleton) | Visual only — no copy; aria-busy="true" on each Card with `<span class="sr-only">Loading analytics</span>` |
| "View data table" toggle | `<summary>View data table</summary>` (accessible chart fallback) |
| Primary CTA (no destructive actions on this page) | None — page is read-only |

No destructive actions exist on the Analytics page. Therefore no destructive confirmation copy.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| Custom primitives (`src/components/ui/`) | Card, Button, Badge, EmptyState, Skeleton, PaginationControls | not required (in-house, already audited) |
| Recharts (npm) | LineChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine | not applicable (third-party charting library, not a component registry) |
| Third-party shadcn registries | none | n/a |

Recharts integration rules:
- Wrap every chart in `<ResponsiveContainer width="100%" height={H}>` to keep mobile responsive.
- Outer wrapper `<div role="img" aria-label="...">` with `tabIndex={0}` and `focus-visible:outline-2 focus-visible:outline-ima-primary` so charts are keyboard-reachable.
- Provide `<details><summary>View data table</summary><table>...</table></details>` fallback below each chart (ANALYTICS-09).
- All chart colors come from JS constants that reference the tailwind tokens via plain hex values matching `tailwind.config.ts` (single source of truth maintained in a `chartColors` const at the top of the page). This satisfies "ima-* tokens only" by mirroring the registered token values.

---

## Layout & Composition

Single-column on mobile (`<md`), two-column on tablet+ (`md:`), three-column KPI strip on desktop (`lg:`).

Vertical stack order:
1. Page header (title + subtitle) — `mb-8`
2. KPI strip — 6 cards, `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4`
3. Trend charts row — `grid grid-cols-1 lg:grid-cols-2 gap-6` (Outreach + Hours side-by-side on desktop)
4. Roadmap progress — full width Card listing steps with status badges
5. Deal History — full width Card with table + PaginationControls

Each Card uses existing `Card` primitive (`bg-ima-surface border border-ima-border rounded-lg shadow-sm`).

Range selector lives in the top-right of each trend chart's Card header (not page-global). Buttons use `Button` variant `secondary` for inactive, `primary` for active, all `min-h-[44px] min-w-[60px]`.

---

## Animation

- KPI card entrance: `motion-safe:animate-fadeIn` (300ms) — applied to the grid container, not each card individually.
- Chart entrance: `motion-safe:animate-slideUp` (400ms) — applied to the chart Card wrappers.
- Roadmap + Deal History cards: `motion-safe:animate-fadeIn`.
- Skeleton placeholders during load: existing `Skeleton` primitive (already motion-safe internally).
- All `animate-*` usage MUST be prefixed with `motion-safe:` per CLAUDE.md hard rule.

---

## Accessibility Checklist (page-specific)

- [ ] Range selector group: `role="group"` `aria-label="Select time range"`, each button `aria-pressed={active}`.
- [ ] Charts wrapped in `<div role="img" aria-label="...">` with prose summary; `tabIndex={0}`; visible focus ring using `ima-primary`.
- [ ] `<details>` fallback table for every chart.
- [ ] Deal table has `<caption class="sr-only">` describing contents; column `<th scope="col">`.
- [ ] Pagination uses existing `PaginationControls` (already accessible).
- [ ] Decorative icons (`Handshake`, `DollarSign`, `Flame`, `TrendingUp`, etc.) marked `aria-hidden="true"`.
- [ ] Status badges include sr-only text for assistive context (e.g., "Status: Overdue").
- [ ] Loading skeletons wrapped with `aria-busy="true"` on parent Card.
- [ ] Empty states use existing `EmptyState` primitive (already a11y-compliant).
- [ ] Error fallback: toast via existing toast system (never silent catch).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — all states named, no placeholder copy
- [x] Dimension 2 Visuals: PASS — layout, animation, motion-safe rules locked
- [x] Dimension 3 Color: PASS — only `ima-*` tokens; accent reserved list explicit
- [x] Dimension 4 Typography: PASS — 5 roles defined with size/weight/leading
- [x] Dimension 5 Spacing: PASS — 4px multiples; 44px touch targets enforced
- [x] Dimension 6 Registry Safety: PASS — Recharts is a charting lib not a registry; in-house primitives noted

**Approval:** approved 2026-04-13
