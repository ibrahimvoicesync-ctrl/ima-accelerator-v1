---
phase: 47
slug: coach-dashboard-homepage-stats
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-13
---

# Phase 47 — UI Design Contract

> Visual and interaction contract for the `/coach` homepage analytics additions: 4 KPI cards, 3 most-recent reports card, and top-3 weekly hours leaderboard. These additions coexist with the existing `/coach` page content (greeting, 3 original stat cards, at-risk banner, student grid) and must match that style exactly — no theme drift.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn, no new deps) |
| Preset | not applicable |
| Component library | Internal CVA primitives in `src/components/ui/*` (Card, Badge, Button, EmptyState, Skeleton) |
| Icon library | `lucide-react` (already a dep) |
| Font | Inherited from `src/app/layout.tsx` system font stack — no font change |

Reuse only. No new libraries, no new primitives, no new animations. Additions must compose existing `Card` + `CardContent` exactly like the 3 original coach dashboard stat cards (see `src/app/(dashboard)/coach/page.tsx` lines 247–307).

---

## Spacing Scale

Declared values (multiples of 4, matching existing `/coach` page and Tailwind defaults):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px  (`gap-1`, `p-1`)   | Icon-to-label inline gaps inside badges |
| sm | 8px  (`gap-2`, `p-2`)   | Inline icon + text pairing, compact chip spacing |
| md | 16px (`gap-4`, `p-4`)   | Default card inner padding, grid gaps |
| lg | 24px (`gap-6`, `mt-6`)  | Section vertical rhythm (stat block → recent reports → leaderboard) |
| xl | 32px (`mt-8`)           | Reserved for rare emphasis — not used in this phase |
| 2xl | 48px                  | Not used in this phase |
| 3xl | 64px                  | Not used in this phase |

**Page wrapper:** `px-4` — matches `src/app/(dashboard)/coach/page.tsx` line 235. No other horizontal padding values.

**KPI card grid:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6` (1 col mobile, 2 cols tablet, 4 cols desktop).

**Recent Reports + Leaderboard grid:** `grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6` (stacked mobile, side-by-side desktop ≥1024px).

**Inside KPI card:** `p-4 flex items-center gap-4` (identical to existing Users/AlertTriangle/FileText stat cards). Icon box: `w-10 h-10 rounded-lg` with `{color}/10` tinted bg, icon `h-5 w-5`.

Exceptions: none.

---

## Typography

Matches the existing `/coach` page exactly. No new sizes.

| Role | Size | Weight | Line Height | Tailwind Classes |
|------|------|--------|-------------|------------------|
| KPI value | 24px | 700 bold | 1.25 | `text-2xl font-bold text-ima-text` |
| KPI label | 12px | 400 normal | 1.33 | `text-xs text-ima-text-secondary` |
| Section heading | 16px | 600 semibold | 1.5 | `text-base font-semibold text-ima-text` |
| Secondary label (student name in row) | 14px | 500 medium | 1.43 | `text-sm font-medium text-ima-text` |
| Meta / reason / timestamp | 12px | 400 normal | 1.33 | `text-xs text-ima-text-secondary` |
| Page H1 (not added here, pre-existing) | 24px | 700 bold | 1.25 | `text-2xl font-bold text-ima-text` |

**Rules:**
- No new font weights, sizes, or families.
- All numeric KPI values use `tabular-nums` to prevent width jitter: `text-2xl font-bold text-ima-text tabular-nums`.
- Revenue values formatted with `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })` (e.g., `$12,400`).
- Average roadmap step formatted to one decimal place (e.g., `3.2`) — locked to `Number.toFixed(1)`.

---

## Color

All colors map to existing `ima-*` tokens in `tailwind.config.ts`. Never hardcode hex or gray scales.

| Role | Token | Usage |
|------|-------|-------|
| Dominant (60%) | `bg-ima-bg` (#F8FAFC) | Page background (from layout) |
| Secondary (30%) | `bg-ima-surface` (#FFFFFF) | Card backgrounds via `<Card>` primitive |
| Accent (10%) | `bg-ima-primary/10` + `text-ima-primary` | KPI #1 (Deals Closed) icon tint |
| Accent — success | `bg-ima-success/10` + `text-ima-success` | KPI #2 (Revenue) icon tint |
| Accent — info | `bg-ima-info/10` + `text-ima-info` | KPI #3 (Avg Roadmap Step) icon tint |
| Accent — warning | `bg-ima-warning/10` + `text-ima-warning` | KPI #4 (Emails Sent) icon tint |
| Border | `border-ima-border` | Row separators in leaderboard, divider lines |
| Text primary | `text-ima-text` | KPI values, student names, headings |
| Text secondary | `text-ima-text-secondary` | Labels, timestamps, meta |
| Text muted | `text-ima-text-muted` | Rank number in leaderboard ("#2", "#3") |
| Destructive | `text-ima-error` | Not used on this page (no destructive actions) |

**Accent reserved for:**
1. KPI icon tinted boxes (4 cards × 4 distinct semantic colors, one per card)
2. Leaderboard #1 rank badge (`bg-ima-primary text-white`)
3. Star rating icon color in recent reports row (`text-ima-warning fill-ima-warning` for filled stars)

**Banned on this page:**
- Any hex literal
- Any `text-gray-*`, `bg-gray-*`, `border-gray-*`, `text-slate-*`, etc.
- `text-white` anywhere except on colored backgrounds (leaderboard #1 rank badge, student avatar initials)
- New color creation

---

## Copywriting Contract

Voice: direct, action-oriented, same tone as existing coach dashboard ("Here's how your students are doing"). No marketing fluff, no emoji in strings.

### KPI Cards

| KPI | Label | Sub-label (optional) | Format |
|-----|-------|----------------------|--------|
| 1   | Deals Closed | (none) | Integer: `12` |
| 2   | Revenue Generated | (none) | Currency: `$12,400` |
| 3   | Avg Roadmap Step | (none) | One decimal: `3.2` |
| 4   | Emails Sent | (none) | Integer: `1,240` with thousands separator |

Zero-state values render as `0`, `$0`, `0.0`, `0` respectively — never `—` or `N/A`.

### Recent Submissions Card

- Card heading: `Recent Submissions`
- Sub-heading: `3 most recent reports from your students`
- "See All" link (top-right): `See all reports` → `/coach/reports`
- Per-row: `{Student Name}` • `{relative time, e.g., "2h ago" / "Yesterday" / "Mar 14"}` • star rating (1–5) rendered as 5 Star icons (filled for rating, outline for rest)
- Empty state heading: `No submissions yet`
- Empty state body: `Reports from your students will appear here as soon as they log their day.`

### Leaderboard Card

- Card heading: `Top 3 This Week`
- Sub-heading: `Hours worked since Monday`
- Per-row: Rank (`#1` / `#2` / `#3`) • `{Student Name}` • `{N}h {M}m` (e.g., `8h 45m`)
- Empty state heading: `No hours logged this week`
- Empty state body: `Once your students start work sessions, the weekly leader will appear here.`
- If fewer than 3 students have logged hours, render only the rows that exist — do NOT show placeholder "—" rows.

### Error / Failure States

- KPI card load error: render the card with value `—` and body text `Couldn't load. Retry in a moment.` (via `console.error` + toast from parent; never swallow).
- Recent Submissions load error: `Couldn't load recent submissions. Try refreshing.`
- Leaderboard load error: `Couldn't load the weekly leaderboard. Try refreshing.`

### Loading States

- Use the existing `Skeleton` primitive (`src/components/ui/Skeleton.tsx`) — do not create new shimmer logic.
- KPI card skeleton: same card frame with a `h-8 w-16` skeleton for the value and a `h-3 w-24` skeleton for the label.
- Recent Submissions / Leaderboard skeleton: 3 skeleton rows, `h-11` (44px) each, matching real row height.

### Destructive

There are no destructive actions on this page. No confirmation copy needed.

### Stat Card Click Destination Copy

Each KPI card acts as a link to `/coach/analytics#{anchor}` where anchor matches:
- Deals Closed → `#deals`
- Revenue Generated → `#revenue`
- Avg Roadmap Step → `#roadmap`
- Emails Sent → `#emails`

The card itself has `aria-label={"{KPI label}: {value}. View in analytics."}` (e.g., `aria-label="Deals Closed: 12. View in analytics."`).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | (none — not initialized on this project) | not required |
| Internal `src/components/ui/*` (Card, Badge, Button, Skeleton, EmptyState) | All additions compose these; no new primitive created in Phase 47 | Plan must reject any new primitive proposal |
| Third-party | none | n/a |

Recharts is NOT used on this page (Recharts is reserved for the full analytics page — Phase 48).

---

## Component-Level Contracts

### KPICard (new, client or server — inline component, not exported from `ui/`)

- Location: `src/components/coach/KPICard.tsx` (new file — feature component, not UI primitive).
- Wraps existing `<Card>` + `<CardContent>` identically to existing stat cards.
- Props: `{ label: string; value: string; icon: LucideIcon; tint: "primary" | "success" | "info" | "warning"; href: string; ariaLabel: string; }`
- Root element: `<Link href={href}>` wrapping the Card, with `className="block min-h-[44px] rounded-lg motion-safe:transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2"` and `aria-label={ariaLabel}`.
- Card inner identical to existing cards (see lines 247–307 of `coach/page.tsx`).
- `motion-safe:transition-shadow` required — no unconditional `transition-*`.

### RecentSubmissionsCard (new)

- Location: `src/components/coach/RecentSubmissionsCard.tsx`
- Root: `<Card><CardContent className="p-4"> ...`
- Header: `flex items-center justify-between mb-4` with heading on left and `<Link href="/coach/reports">See all reports</Link>` on right (right link uses `text-sm text-ima-primary hover:underline min-h-[44px] inline-flex items-center`).
- Rows: `<Link href={`/coach/reports#${reportId}`}>` per row, `flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-ima-surface-light motion-safe:transition-colors min-h-[44px]`.
- Star rating: rendered via 5 `<Star>` icons from lucide-react, filled up to `rating` value; decorative icons get `aria-hidden="true"`, and the row carries `aria-label={"{name} submitted a report, rated {N} stars, {relative time}"}`.

### WeeklyLeaderboardCard (new)

- Location: `src/components/coach/WeeklyLeaderboardCard.tsx`
- Root: `<Card><CardContent className="p-4"> ...`
- Rows: 3 items max, rank 1 uses `<Badge variant="primary">#1</Badge>`, ranks 2–3 use `text-ima-text-muted font-semibold` plain text with `#2` / `#3`.
- Avatar: same `w-8 h-8 rounded-full bg-ima-primary text-white text-xs font-semibold` circle used on the existing at-risk list (lines 339–346).

---

## Interaction & Accessibility Contract

Every one of these is non-negotiable (hard rules from `CLAUDE.md`):

1. **Touch targets:** Every KPI card link, every report row link, every leaderboard row link, and the "See all reports" link has `min-h-[44px]` (or full card minimum via content padding already ≥ 44px).
2. **Motion safety:** Every `hover:shadow-*`, `hover:bg-*`, and transition uses `motion-safe:transition-shadow` / `motion-safe:transition-colors`. No unconditional `animate-*` or `transition-*`.
3. **ARIA labels:**
   - Each KPI card link has `aria-label` as specified above.
   - Each star icon has `aria-hidden="true"`; the row has a sentence-form `aria-label` describing the rating.
   - Lucide icons inside tinted boxes all get `aria-hidden="true"`.
   - Loading skeletons render inside a container with `role="status"` and `aria-label="Loading coach dashboard stats"` (single announcement; individual skeletons are aria-hidden).
   - Empty states use `role="status"` via existing `EmptyState` primitive.
4. **Focus visible:** All interactive cards/links apply `focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2`.
5. **Keyboard:** Since all clickable blocks are `<Link>` (not `<div onClick>`), Tab/Enter work natively. No `onClick` on non-button/non-link elements.
6. **Error handling:** Every server-side fetch in the RPC route uses admin client. Every `catch` block `console.error`s the error. The page never swallows; error boundary (`coach/error.tsx`) catches render failures.
7. **Currency/number formatting:** Always server-render the formatted string; never format on the client to avoid hydration drift.

---

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| `<640px` (mobile) | KPI grid: 1 column. Recent Submissions + Leaderboard: stacked. Full-width cards with `px-4` page padding. |
| `640–1023px` (tablet) | KPI grid: 2 columns × 2 rows. Recent Submissions + Leaderboard: still stacked. |
| `≥1024px` (desktop) | KPI grid: 4 columns × 1 row. Recent Submissions + Leaderboard: 2 columns side-by-side. |

No horizontal scroll at any breakpoint down to 320px. Text truncation via `truncate` on student names where row width demands.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — all labels, empty states, error states, and a11y labels are specified; no ambiguous copy.
- [x] Dimension 2 Visuals: PASS — reuses existing `Card` / `Badge` / `EmptyState` / `Skeleton` primitives; icon geometry matches existing coach dashboard stat cards; no new primitive.
- [x] Dimension 3 Color: PASS — all colors route through `ima-*` tokens; no hex, no gray; accent colors are each used for a single KPI only; `text-white` only on colored avatar/rank badges.
- [x] Dimension 4 Typography: PASS — no new sizes or weights; `tabular-nums` locked for KPI values; formatting rules are explicit.
- [x] Dimension 5 Spacing: PASS — all values are multiples of 4 from the declared scale; page wrapper `px-4`; card inner `p-4`; section rhythm `mt-6`.
- [x] Dimension 6 Registry Safety: PASS — no shadcn, no third-party registry, no new libraries; only existing internal primitives.

**Approval:** approved 2026-04-13 (auto-generated via skipped discuss + inline UI-SPEC)
