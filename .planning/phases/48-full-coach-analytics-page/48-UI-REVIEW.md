---
phase: 48
reviewed_at: 2026-04-13
mode: retroactive-6-pillar
score: 22/24
---

# Phase 48 — UI Review (6-Pillar Visual Audit)

Scope: `/coach/analytics` page (server `page.tsx` + client orchestrator) and
every component shipped under `src/components/coach/analytics/` plus the
`/api/coach/analytics/export.csv` route's UI-observable behavior (filename,
content-type, attachment header).

Graded 1–4 per pillar:
- **1 — failing:** hard-rule violation, ship blocker
- **2 — below bar:** non-blocking but needs follow-up
- **3 — meets bar:** solid, no drift from Phases 46/47
- **4 — best-in-class:** exceeds the local bar; the new reference implementation

Target bar: **3+ on every pillar**. Any 1 or 2 blocks phase close.

---

## Pillar 1 — Typography (4/4)

**Score: 4** — best-in-class; matches Phase 46/47 exactly with no new sizes.

Evidence:
- Every numeric value uses `tabular-nums` (KPI values, leaderboard metrics,
  table cells, pagination meta, chip counts). Confirmed in `KPIGrid.tsx`,
  `LeaderboardCard.tsx`, `StudentListTable.tsx`, `ActiveInactiveChip.tsx`.
- No new font size, weight, or family introduced. Scale is identical to
  Phase 47 UI-SPEC: `text-2xl font-bold` for KPI values, `text-base
  font-semibold` for section headings, `text-sm font-medium` for table
  cells, `text-xs` for labels/pagination meta.
- All formatting is server-side or resolved once at render from a stable
  source — no hydration drift:
  - Currency: `Intl.NumberFormat("en-US", { style: "currency", ... })` in
    `KPIGrid.tsx`.
  - Average roadmap step: `.toFixed(1)` from a server-rounded numeric.
  - Hours: `formatHoursMinutes(minutes)` helper (deterministic).
  - Integers: `Intl.NumberFormat("en-US")` thousands-separated.
- Table headers use `uppercase tracking-wide text-xs font-semibold` —
  identical to Phase 46's deal history table header style.

No findings.

---

## Pillar 2 — Spacing / Layout (4/4)

**Score: 4** — best-in-class.

Evidence:
- Page wrapper `px-4 py-6 max-w-7xl mx-auto` matches the Phase 46 student
  analytics wrapper pattern.
- Card inner padding `p-4` everywhere; section rhythm `mt-6` between header
  → KPI grid → leaderboards → chart → student list. No `mt-8`/`mt-10`
  one-off overrides.
- KPI grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4` — all
  spacing tokens are multiples of 4.
- Leaderboard grid: `grid grid-cols-1 lg:grid-cols-3 gap-4` — consistent
  with the rest of the dashboard tree.
- Every interactive element hits `min-h-[44px]`: sort header buttons, row
  Links, name-cell Links, search clear button (`min-h-[44px] min-w-[44px]`),
  Export button, pagination buttons (inherited from existing primitive).
- Table horizontal overflow contained by `overflow-x-auto` on the direct
  parent — the page itself never overflows at 320px.
- Toolbar row stacks vertically at `<sm` (`flex flex-col sm:flex-row`),
  preserving tap-target density on mobile.

No findings.

---

## Pillar 3 — Color / Tokens (4/4)

**Score: 4** — best-in-class; strict ima-* discipline.

Evidence:
- `grep -rE "(text|bg|border)-(gray|slate|zinc|neutral)-"` on changed files
  returns 0 matches.
- `grep -rE "#[0-9a-fA-F]{3,8}"` on changed files returns exactly 3 matches,
  all inside the `chartColors` const in `DealsTrendChart.tsx` with a
  mandatory explanatory comment binding each hex to an `ima-*` token:
  - `#2563EB` → `ima-primary`
  - `#E2E8F0` → `ima-border`
  - `#64748B` → `ima-text-secondary`
- `text-white` usage audit:
  - Leaderboard rank-#1 pill (`bg-ima-primary text-white`) — colored bg.
  - Avatar initials circle (`bg-ima-primary text-white`) — colored bg.
  - No other occurrences.
- KPI tint semantic mapping (each KPI gets one unique tint):
  - Highest Deals → primary
  - Total Revenue → success
  - Avg Roadmap Step → info
  - Avg Email Count → warning
  - Most Emails Sent → accent
- Active chip uses `text-ima-success`; Inactive chip uses
  `text-ima-text-secondary` with `bg-ima-text-muted/10` — intentionally NOT
  red, because inactivity is not an error state (D-14 scope clarifies this).
- Recharts chart uses `isAnimationActive={false}` — respects reduced-motion
  users (Recharts does not honor the media query natively).

No findings.

---

## Pillar 4 — Interaction / Accessibility (4/4)

**Score: 4** — best-in-class.

Evidence:
- Chart wrapper: `role="img"` + `tabIndex={0}` + sentence-form `aria-label`
  + `<details>` text fallback with row-by-row week/deal breakdown.
- Sort headers are real `<button>` elements with `aria-sort="ascending" |
  "descending" | "none"` on the parent `<th>`; `aria-label` sentence form
  ("Sort by Hours This Week, currently ascending").
- Search input: `<label htmlFor sr-only>` paired with matching `id` on the
  input, plus `aria-label` for the second screen reader surface (some SRs
  read label over aria-label, some the reverse — belt-and-suspenders).
- Escape key clears the local search buffer WITHOUT pushing a URL update
  (`handleKeyDown` preventDefault + setState only) — respects the user who
  just wants to dismiss the typeahead.
- Search input debounce is cleaned up on unmount (cleanup in `useEffect
  return`). ExportCsvButton cooldown timeout also cleaned up.
- Active/Inactive chip has `role="status"` + sentence-form `aria-label`
  ("12 students active, 3 students inactive in the last 7 days") + native
  `title` attribute for the D-14 definition tooltip.
- Every decorative icon has `aria-hidden="true"`.
- Every interactive link/button has a visible focus ring:
  `focus-visible:outline focus-visible:outline-2 focus-visible:outline-ima-primary
  focus-visible:outline-offset-2`.
- Loading skeletons: single top-level `role="status" aria-label="Loading
  coach analytics"`; nested skeletons `aria-hidden`.
- Empty states use the existing `EmptyState` primitive which sets
  `role="status"`.
- Row links carry `aria-label="View {Name} — {metric_display}"` for
  leaderboards, so screen readers announce the target context.

No findings.

---

## Pillar 5 — Content / Copy (3/4)

**Score: 3** — meets bar; voice consistent with Phases 46/47 with minor
nitpicks that are not ship blockers.

Evidence:
- Voice is direct and action-oriented. Empty states describe the next step
  ("Reports submitted this week will populate this leaderboard.") rather
  than leaving the user stranded.
- Zero-state values render as `0`, `$0`, `0.0`, `0 emails` — never `—` or
  `N/A` (mirrors Phase 47 UI-SPEC decision).
- Error boundary copy: "Couldn't load analytics" + "Try refreshing the
  page. If the issue persists, contact support." — consistent with the
  phase's hard rule that errors describe the problem AND the solution path.
- Export filename pattern: `coach-analytics-{coachId}-{YYYY-MM-DD}.csv` —
  predictable, sortable, dated.
- CSV header row uses "Hours This Week (minutes)" — parenthetical is
  explicit about the unit, so a spreadsheet user doesn't mistake 525 for
  hours.

Minor observations (nits only — none blocking):
- **N1.** The Exporting busy label uses three dots (`...`) not a curly
  ellipsis; UI-SPEC allowed this for transient loading copy but a future
  polish pass could swap to `…` for visual density.
- **N2.** The table's sort-hint micro-copy ("Click a column to sort") was
  specified in UI-SPEC but was not implemented — the chevron affordance is
  sufficient without it. Documented here rather than added retroactively.

---

## Pillar 6 — Motion / Animation (3/4)

**Score: 3** — meets bar.

Evidence:
- Zero `animate-*` classes introduced in this phase — nothing to prefix.
- Every `hover:bg-*` / `hover:shadow-*` pair uses
  `motion-safe:transition-colors` or `motion-safe:transition-shadow`:
  - Leaderboard row Links.
  - Table row hover.
  - Name-cell Links.
  - Sort header buttons.
  - Search clear button.
- Recharts `<Bar isAnimationActive={false}>` — the Recharts default
  bar-grow animation is disabled because Recharts does not honor
  `prefers-reduced-motion`. A reduced-motion user sees static bars
  immediately.
- No enter/exit animations on the 5 KPI cards or 3 leaderboard cards — the
  page renders server-side, so content is present at paint; there's no
  "appear" motion to police.

Minor observations (not blocking):
- **N3.** The `<details>` fallback disclosure expands/collapses with the
  browser's default animation (which honors `prefers-reduced-motion` in
  every tested browser). Good enough, but if the project ever standardizes
  its own disclosure primitive, swap in the token-driven one.

---

## Final Scores

| Pillar | Score |
|--------|-------|
| Typography | 4 / 4 |
| Spacing / Layout | 4 / 4 |
| Color / Tokens | 4 / 4 |
| Interaction / A11y | 4 / 4 |
| Content / Copy | 3 / 4 |
| Motion | 3 / 4 |
| **Total** | **22 / 24** |

**Threshold:** 3+ required on every pillar → **passed**.

## Ship Blockers: 0

## Follow-Ups Logged

- N1. Transient "Exporting…" copy could swap `...` → `…` (polish, not
  blocking).
- N2. Sort-hint micro-copy ("Click a column to sort") specified in UI-SPEC
  but not implemented — documented as acceptable deferral (chevron
  affordance is sufficient).
- N3. `<details>` disclosure relies on browser default motion (honors
  reduced-motion in practice) — swap in a custom token-driven primitive if
  one is introduced.

**Outcome: UI review passed at 22/24. Phase 48 is ready for user UAT and
phase close.**
