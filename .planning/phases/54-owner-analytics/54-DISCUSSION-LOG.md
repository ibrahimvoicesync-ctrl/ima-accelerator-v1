# Phase 54: Owner Analytics — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 54-owner-analytics
**Areas presented:** Tie-break ordering, Card reuse strategy, Teaser layout, Work-session tag invalidation scope
**User response:** "Skip all. GSD's Empfehlungen sind alle sinnvoll. Submit leer." (Accept all recommendations, no overrides.)

---

## Tie-break ordering (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| metric DESC, student_name ASC, student_id ASC | Readable + guaranteed stable via unique id tiebreaker | ✓ |
| metric DESC, student_id ASC | Stable but opaque if ties happen (alphabetical order hidden) | |
| metric DESC, earliest-completion ASC | "First to reach" narrative but requires an extra timestamp column | |

**User's choice:** Accepted recommendation.
**Notes:** Determinism requirement from OA-02; three-key ORDER BY guarantees stability without any additional columns.

---

## LeaderboardCard reuse strategy (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Add `hrefPrefix` prop + relocate to `src/components/analytics/` | Smallest diff; one callsite update; shared primitive | ✓ |
| Fork `OwnerLeaderboardCard` | Zero shared risk but duplicates ~60 LOC | |
| `buildHref(row)` callback | Most flexible, currently unneeded | |

**User's choice:** Accepted recommendation.
**Notes:** Phase 48 component has identical structural needs. Shared primitive avoids drift between owner and coach analytics.

---

## Teaser layout on owner homepage (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Single "Analytics" card with 3 compact rows + "View full analytics →" link, placed above stat grid | One unified block; signal-first placement | ✓ |
| 3 side-by-side cards | Duplicates chrome; inconsistent density | |
| Inline top-1 strip | Too narrow; metric context hidden | |
| Below existing content | Buries the signal | |

**User's choice:** Accepted recommendation.
**Notes:** Placement above the existing stat grid on `/owner` matches the "leaderboard first, drill later" narrative.

---

## Work-session tag invalidation scope (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Expanded: POST-completed + PATCH (status→completed OR hours edit on completed) + DELETE-completed | Closes the v1.5 Phase 53 cache-staleness failure mode | ✓ |
| Spec minimum: PATCH when status→completed only | Matches OA-05 literally but leaves three stale-data paths | |
| Global: invalidate on every work-session mutation | Over-invalidates; defeats 60s cache on non-completed writes | |

**User's choice:** Accepted recommendation.
**Notes:** STATE.md §"Critical Constraints for v1.6" explicitly flags the Phase 53 cache-tag failure mode. D-04 expands OA-05 beyond literal spec to prevent recurrence.

---

## Claude's Discretion

- Exact number formatting for `metric_display` (hours with 1 decimal, profit with thousands separator, deals as integer) — follow Phase 48 precedent
- Empty state copy variants
- Loading skeleton design
- Sidebar nav order position for `/owner/analytics` entry (recommending "after /owner/students")

## Deferred Ideas

- Time windowing (7d/30d/all)
- Per-coach contribution breakdown
- CSV export
- Trend charts / sparklines
- Drill-down top-10 / top-50 page
