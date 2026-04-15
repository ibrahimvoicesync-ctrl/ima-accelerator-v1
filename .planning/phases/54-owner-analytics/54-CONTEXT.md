---
phase: 54
name: Owner Analytics
status: ready_for_planning
gathered: 2026-04-15
---

# Phase 54: Owner Analytics — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Milestone:** v1.6 Owner Analytics, Announcements & Roadmap Update

<domain>
## Phase Boundary

The owner gets a dedicated `/owner/analytics` page with three lifetime top-3
leaderboards (Hours Worked, Profit Earned, Deals Closed), a compact teaser
section on the owner dashboard homepage, and reliable cache invalidation on
every mutation path that changes the underlying inputs.

**In scope:**
- New route: `/owner/analytics` (server component + client shell where needed)
- New teaser section on existing `/owner` dashboard homepage
- New Postgres RPC `get_owner_analytics` (single batch, no params)
- New `src/lib/rpc/owner-analytics.ts` wrapper (cached + uncached variants)
- New `src/lib/rpc/owner-analytics-types.ts` with `ownerAnalyticsTag()` helper
- Wire `revalidateTag("owner-analytics")` into POST `/api/deals`,
  PATCH `/api/deals/[id]`, DELETE `/api/deals/[id]`, PATCH `/api/work-sessions/[id]`
- Sidebar nav entry (owner role only) for `/owner/analytics`
- EXPLAIN ANALYZE verification on the RPC (no new indexes expected — reuse
  `idx_deals_student_created` + `idx_work_sessions_completed_student_date`)

**Out of scope (belongs elsewhere):**
- Weekly/monthly windowing (deferred, future milestone)
- Per-coach breakdown (deferred)
- CSV export of leaderboards (deferred)
- Trend charts / sparklines (deferred)
- Coach-scoped version of this page (already exists as `/coach/analytics`, Phase 48)

</domain>

<decisions>
## Implementation Decisions

User was presented with 4 gray areas and accepted all recommendations. All
decisions below are locked; no re-asking during planning.

### D-01: Tie-break ordering inside each leaderboard
`ORDER BY <metric> DESC, student_name ASC, student_id ASC`
- Primary: metric (hours / profit / deals closed)
- Secondary: student_name ASC — stable and readable if two students tie
- Tertiary: student_id ASC — guaranteed unique, prevents any non-determinism

This applies to all three leaderboards inside `get_owner_analytics`. Top-3
must be deterministic so the teaser and the full page never disagree and so
repeat renders within the 60s cache window don't produce different top-3.

### D-02: LeaderboardCard reuse — add `hrefPrefix` prop
`src/components/coach/analytics/LeaderboardCard.tsx` already has the exact
layout we need (rank-1 badge, avatar initials, 44px touch target, focus ring,
`ima-*` tokens, EmptyState on zero rows).

**Plan:** Add a `hrefPrefix: string` prop (default `"/coach/students/"` for
backward compatibility) and move the component to a shared location:
`src/components/analytics/LeaderboardCard.tsx`. Update the one existing
import site in `CoachAnalyticsClient.tsx`. Owner analytics passes
`hrefPrefix="/owner/students/"`.

**Not chosen:**
- Fork `OwnerLeaderboardCard` — duplicates ~60 LOC for one prop difference
- `buildHref(row)` callback — overkill, no current need for row-level logic

### D-03: Teaser layout on owner homepage
**Layout:** A single `Card` titled "Analytics" containing three compact
rows — one per leaderboard — each showing "#1 {student_name} — {metric_display}"
followed by a "View full analytics →" link at the bottom of the card.

- Desktop: one card, full width of its grid column
- Mobile: same card, stacked naturally (no horizontal scroll)
- Placement: inserted at the top of the homepage content, above the existing
  stat-card grid. Owner sees leaderboard signal first, then drills into
  operational lists.

**Not chosen:**
- 3 separate side-by-side cards — duplicates chrome; inconsistent with
  dashboard density
- Inline top-1 strip — too narrow; hides metric context
- Below existing content — signal-buried; defeats the point of a teaser

### D-04: Work-session tag invalidation scope (expanded beyond spec minimum)
OA-05 spec says "PATCH when status → completed." We extend this to three
patterns to prevent stale leaderboards:

1. **POST `/api/work-sessions`** when body.status is already `completed`
   (coach/owner can log completed sessions directly)
2. **PATCH `/api/work-sessions/[id]`** when:
   - status transitions to `completed` (spec minimum), OR
   - the row was already `completed` AND `minutes_worked` changed
3. **DELETE `/api/work-sessions/[id]`** when the deleted row had status `completed`

This closes the gap the v1.5 Phase 53 postmortem flagged: cache-tag wiring
that only covers "happy path" creates stale-leaderboard bugs on edit/delete.
Implementation reads the pre-mutation row to detect completed-status.

### Claude's Discretion
- Exact number formatting for `metric_display` (hours: "147.5 h" with 1
  decimal; profit: "$12,450" with thousands separator, integer; deals: "23")
  — match coach-analytics precedent where the RPC formats the string
- Empty state copy ("No students have logged hours yet" variants)
- Loading skeleton design for the server component
- Where the owner sidebar entry sits in the nav order — after `/owner/students`
  felt right based on information-density progression

### Folded Todos
None — no pending todos matched this phase scope (todos file is empty per
post-v1.5 cleanup).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Owner Analytics (OA) — OA-01 through OA-06
- `.planning/REQUIREMENTS.md` §Performance & Quality — PERF-01, PERF-02, PERF-03, PERF-04, PERF-06, PERF-07
- `.planning/ROADMAP.md` §"Phase 54: Owner Analytics" — goal + 5 success criteria

### Codebase patterns (clone/extend)
- `src/lib/rpc/coach-analytics.ts` — RPC wrapper (cached + uncached) template
- `src/lib/rpc/coach-analytics-types.ts` — tag helper + payload type pattern
- `src/components/coach/analytics/LeaderboardCard.tsx` — UI component to generalize
- `src/components/coach/analytics/CoachAnalyticsClient.tsx` — page layout reference
- `src/app/api/deals/route.ts` — multi-tag `revalidateTag` fan-out pattern
  (`POST` handler already wires studentAnalyticsTag, coachDashboardTag,
  coachAnalyticsTag, coachMilestonesTag — add `ownerAnalyticsTag()` alongside)
- `src/app/api/deals/[id]/route.ts` — PATCH + DELETE fan-out precedent
- `src/app/api/work-sessions/[id]/route.ts` — PATCH handler where status
  transitions are detected

### Config + conventions
- `src/lib/config.ts` — `ROUTES.owner` + `NAVIGATION.owner` arrays: add
  `/owner/analytics` entry
- `CLAUDE.md` Hard Rules — motion-safe, 44px targets, aria labels, admin
  client in API routes, response.ok, Zod import, ima-* tokens
- `CLAUDE.md` Code Quality — px-4 page wrapper, stable useCallback deps

### Migration precedent
- `supabase/migrations/00025*` — `get_coach_analytics` creation (search for
  the latest matching file) — template for `get_owner_analytics`
- `supabase/migrations/00027*` — Phase 50+ milestones precedent

### v1.5 postmortem (critical)
- STATE.md §"Critical Constraints for v1.6" — `ownerAnalyticsTag()` wiring
  requirement and why it matters (exact failure mode from Phase 53)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Card`, `CardContent`** (`src/components/ui/Card.tsx`) — used everywhere,
  CVA-based, `ima-*` tokens
- **`EmptyState`** (`src/components/ui/EmptyState.tsx`) — `variant="compact"`
  fits inside a leaderboard card, `variant="default"` for teaser fallback
- **`LeaderboardCard`** (see D-02 — will be generalized)
- **`createAdminClient`** (`src/lib/supabase/admin.ts`) — server-only,
  bypasses RLS, used inside RPC wrappers with `import "server-only"`
- **`unstable_cache`** (`next/cache`) — 60s TTL + tag pattern is the
  established norm for dashboard RPCs

### Established Patterns
- **RPC wrapper file structure:** `<feature>.ts` (server-only wrapper with
  cached + uncached variants), `<feature>-types.ts` (shared types + tag
  helper, client-safe). Owner mirrors: `owner-analytics.ts` +
  `owner-analytics-types.ts`.
- **Cache tag naming:** `owner-analytics` (global, not per-user — there is a
  single owner, so no `:${id}` suffix needed, unlike `coach-analytics:${coachId}`)
- **Mutation route stack:** CSRF (`verifyOrigin`) → auth → profile lookup
  (admin) → rate limit (30/min) → Zod `safeParse` → try/catch → route logic
  → fan-out `revalidateTag` calls → JSON response. All 5 touched handlers
  already follow this.
- **RPC parameter style:** `p_<name>` snake_case; RPC returns JSON payload
  matched to TypeScript type via `as unknown as Payload`

### Integration Points
- **Sidebar nav:** `src/lib/config.ts` `NAVIGATION.owner` array — add
  `{ label: "Analytics", href: "/owner/analytics", icon: <name> }`
- **Owner homepage:** `src/app/(dashboard)/owner/page.tsx` — insert teaser
  `<OwnerAnalyticsTeaser />` component above existing grid
- **Deals API fan-out:** `src/app/api/deals/route.ts` + `[id]/route.ts` —
  add `revalidateTag("owner-analytics", "default")` after successful
  mutations, alongside existing tag calls
- **Work-sessions API fan-out:** `src/app/api/work-sessions/[id]/route.ts`
  and `route.ts` — gate on status-completed conditions per D-04
- **Migration numbering:** Next migration is `00028` per STATE.md
  ("`00028 = get_owner_analytics RPC`")

</code_context>

<specifics>
## Specific Ideas

- User accepted GSD's recommended defaults without overriding any — trust the
  precedent set by Phase 48 (Coach Analytics) heavily
- Keep deterministic ordering visible in the SQL (explicit ORDER BY, not
  implicit through subquery) so EXPLAIN ANALYZE is readable
- Owner is a single user (not a role with many instances), so the cache tag
  is global (`owner-analytics`) rather than per-user — simplifies fan-out,
  no need to look up "which owner" before invalidating

</specifics>

<deferred>
## Deferred Ideas

- Time windowing (7d/30d/all) — future milestone
- Per-coach contribution breakdown — future milestone
- CSV export — future milestone
- Trend charts / sparklines for lifetime metrics — future milestone
- Drill-down page showing top-10 / top-50 — v1.6 only requires top-3

**Reviewed Todos (not folded):** None — no pending todos matched this phase.

</deferred>

---

*Phase: 54-owner-analytics*
*Context gathered: 2026-04-15*
