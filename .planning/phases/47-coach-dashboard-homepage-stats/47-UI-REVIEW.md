---
phase: 47-coach-dashboard-homepage-stats
status: passed
reviewed: 2026-04-13
score_overall: 22/24
---

# Phase 47 — UI Review (6-Pillar Audit)

## Scope

Audited the three new feature components and their integration on `/coach`:
- `src/components/coach/KPICard.tsx`
- `src/components/coach/RecentSubmissionsCard.tsx`
- `src/components/coach/WeeklyLeaderboardCard.tsx`
- `src/app/(dashboard)/coach/page.tsx` (KPI grid + Recent + Leaderboard insertion)

Scoring: 1 = fail, 2 = below bar, 3 = passes spec, 4 = excellent.

---

## Pillar 1 — Copywriting (4 / 4)

- KPI labels match UI-SPEC exactly: `Deals Closed`, `Revenue Generated`, `Avg Roadmap Step`, `Emails Sent`.
- Card aria-labels follow the prescribed sentence form: `"{label}: {value}. View in analytics."` — e.g., `"Deals Closed: 12. View in analytics."`. The roadmap card spells out "Average" in the aria-label for clarity ("Average Roadmap Step…") even though the visible label is abbreviated, which is screen-reader-friendly.
- Recent Submissions header `Recent Submissions` + sub `3 most recent reports from your students`; "See all reports" link wording matches.
- Leaderboard header `Top 3 This Week` + sub `Hours worked since Monday`.
- Empty states use the spec'd copy verbatim ("No submissions yet" + body, "No hours logged this week" + body).
- Zero-state numeric values render as `0`, `$0`, `0.0`, `0` — no `—` or `N/A` placeholders.
- No marketing fluff, no emoji.

**No deductions.**

---

## Pillar 2 — Visuals (4 / 4)

- All three components compose existing `<Card>` + `<CardContent>` primitives — no new primitive introduced.
- KPI card structure (icon box `w-10 h-10 rounded-lg {tint}/10` + text stack with `text-2xl` value over `text-xs` label) is byte-for-byte the same shape as the legacy 3 stat cards (Users / AlertTriangle / FileText) on the same page. Visual coherence is total.
- Star rating uses 5 lucide `<Star>` icons — filled vs unfilled by class only, no swapping icon variants.
- Leaderboard avatar circle reuses the at-risk-list pattern (`w-8 h-8 rounded-full bg-ima-primary text-white text-xs font-semibold`) — no design drift.
- Empty states use the existing `<EmptyState variant="compact">`, with appropriate icons (`FileText` for submissions, `Trophy` for leaderboard).

**No deductions.**

---

## Pillar 3 — Color (4 / 4)

- Every color routes through `ima-*` tokens. Verified via grep on the changed files: zero hits for `text-(gray|slate|zinc|neutral)-*`, zero hex literals.
- KPI tint mapping is 1:1 with UI-SPEC: primary → Deals, success → Revenue, info → Roadmap, warning → Emails. Each is used for a single KPI only.
- `text-white` only appears on the rank #1 pill and the avatar circle — both colored backgrounds, both consistent with the existing at-risk list pattern.
- Filled stars use `text-ima-warning fill-ima-warning`; unfilled use `text-ima-border` (token-clean).
- Hover states use `hover:bg-ima-surface-light` (rows) and `hover:shadow-md` (cards) — no color invented.

**No deductions.**

---

## Pillar 4 — Typography (4 / 4)

- KPI value class is `text-2xl font-bold text-ima-text tabular-nums` — identical to the legacy 3 stat cards.
- KPI label is `text-xs text-ima-text-secondary`, matching spec.
- Section headings use `text-base font-semibold text-ima-text`.
- Student names use `text-sm font-medium text-ima-text`; relative timestamps use `text-xs text-ima-text-secondary`.
- All numeric values (KPIs and leaderboard hours) carry `tabular-nums` to prevent jitter.
- Currency formatted server-side via `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })`; integers via `Intl.NumberFormat("en-US")` (thousands separators); roadmap step via `Number.toFixed(1)`. All formatted on the server — no hydration drift.

**No deductions.**

---

## Pillar 5 — Spacing (3 / 4)

- KPI grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6` — matches spec.
- Recent + Leaderboard grid: `grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6` — matches spec.
- Card inner padding: `p-4` (KPI card, RecentSubmissionsCard, WeeklyLeaderboardCard) — matches spec.
- Row internal padding `p-3 rounded-lg`, gaps `gap-3` — all on the 4px scale.
- Page wrapper `px-4` is inherited from the existing `coach/page.tsx`.

Minor deduction: KPICard root `<Link>` uses `rounded-xl` (matching the underlying `<Card>` `rounded-xl`), where the UI-SPEC text mentions `rounded-lg` in passing for the link wrapper. Both are valid 4px-multiple radii (xl=12px, lg=8px); `rounded-xl` is the correct choice here because it must visually match the wrapped Card's outer radius — using `rounded-lg` on the link would create a double-radius outline on focus. Documented as an intentional spec refinement, not a violation.

**−1 for the spec/code radius mismatch (intentional but undocumented in code).**

---

## Pillar 6 — Registry Safety (3 / 4)

- No shadcn, no third-party registry, no new libraries added.
- All UI composes existing internal primitives (`<Card>`, `<CardContent>`, `<EmptyState>`).
- `<Badge variant="primary">` from the spec was substituted with a custom `bg-ima-primary text-white` pill because the existing `Badge` primitive does not have a `"primary"` variant (it has `default`, `success`, `warning`, `error`, `info`, `outline`). The substitution preserves the visual contract (blue pill, white text) while honoring the registry-safety contract (no new primitive added). Documented in 47-01-SUMMARY.md and 47-VERIFICATION.md.

**−1 for the spec→code drift on the Badge variant. Resolution options: (a) extend `<Badge>` to support a `primary` variant in a future polish phase, or (b) update the UI-SPEC to call out the inline pill as the canonical pattern. Recommend (a) for v1.5 polish.**

---

## Interaction & A11y audit

| Check | Result |
|---|---|
| Every interactive element has `min-h-[44px]` | PASS — KPI link, See-all link, row link all carry it; leaderboard rows also (no link, but `min-h-[44px]` still applied for visual cadence) |
| `motion-safe:` on transitions | PASS — `motion-safe:transition-shadow` (KPI), `motion-safe:transition-colors` (rows) |
| `aria-label` on dynamic content | PASS — KPI link, report row link |
| `aria-hidden="true"` on decorative icons | PASS — every lucide icon, every Star, both EmptyState icons |
| Focus visible | PASS — `focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2` on KPI link, See-all link, row link |
| Native keyboard nav | PASS — all clickable elements are `<Link>`, no `<div onClick>` |
| Currency / number formatting on server | PASS — `Intl.NumberFormat` and `toFixed(1)` invoked in server-component scope |

---

## Score

| Pillar | Score |
|---|---|
| 1. Copywriting | 4 |
| 2. Visuals | 4 |
| 3. Color | 4 |
| 4. Typography | 4 |
| 5. Spacing | 3 |
| 6. Registry Safety | 3 |
| **Total** | **22 / 24** |

**Status: passed** (>= 20/24, no individual pillar < 3).

---

## Recommendations (non-blocking)

1. Extend `<Badge>` to add a `primary` variant in a future polish phase so the UI-SPEC and code converge.
2. Document the `rounded-xl` choice on the KPI link wrapper inline in the component (one-line comment) so the next reviewer doesn't flag it.
