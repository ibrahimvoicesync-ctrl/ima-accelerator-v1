# Phase 40: Config & Type Updates - Context

**Gathered:** 2026-04-07 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

src/lib/config.ts and proxy.ts coverage are updated so TypeScript compiles cleanly before any page files are created. Adds ROUTES, NAVIGATION entries, and VALIDATION constants for the deals feature. Types.ts Deal type already exists from Phase 38.

</domain>

<decisions>
## Implementation Decisions

### Route Definitions
- **D-01:** Add `ROUTES.student.deals = "/student/deals"` and `ROUTES.student_diy.deals = "/student_diy/deals"` to config.ts ROUTES object.
- **D-02:** No proxy.ts changes needed — `ROLE_ROUTE_ACCESS` uses prefix matching (`/student`, `/student_diy`), so deal routes are already covered.

### Navigation Entries
- **D-03:** Student nav: Deals appears after Daily Report and before Chat. Position index 5 (0-based) in the student nav array. Order: Dashboard, Work Tracker, Roadmap, Ask Abu Lahya, Daily Report, **Deals**, Chat, Resources.
- **D-04:** Student_diy nav: Deals appears after Roadmap and before Resources. Order: Dashboard, Work Tracker, Roadmap, **Deals**, Resources.
- **D-05:** Icon: `DollarSign` from lucide-react for both student and student_diy Deals nav entries.
- **D-06:** No separator before Deals — it's part of the main nav flow, not a section break.

### Validation Constants
- **D-07:** Add `VALIDATION.deals` object with `revenueMax: 9999999999.99` and `profitMax: 9999999999.99` — matching the values hardcoded in Phase 39 route handlers.
- **D-08:** No `NOTES_MAX_LENGTH` — the deals table has no notes column (Phase 38 D-01 explicitly excluded it). The roadmap success criteria #3 is outdated on this point.
- **D-09:** Phase 39 route handlers should be refactored to import from `VALIDATION.deals` instead of hardcoded values — this is part of this phase's scope per Phase 39 D-05.

### Types.ts
- **D-10:** No types.ts changes needed — Deal type (Row/Insert/Update) already exists from Phase 38 with `string | number` for revenue/profit.

### Claude's Discretion
- Whether to add `revenueMin: 0` and `profitMin: 0` alongside max values for completeness
- Exact key naming in VALIDATION.deals object (camelCase vs snake_case — follow existing pattern)
- Whether to add the deals entries to the default config export aggregate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config patterns
- `src/lib/config.ts` — Full config file; ROUTES (line 52), NAVIGATION (line 281), VALIDATION (line 322) sections show exact patterns to follow
- `src/lib/config.ts` lines 311-316 — Student_diy nav array (current state, Deals entry to be inserted)

### Route handler refactor targets
- `src/app/api/deals/route.ts` lines 14-15 — Hardcoded `max(9999999999.99)` to refactor to VALIDATION.deals import
- `src/app/api/deals/[id]/route.ts` lines 27-28 — Same hardcoded values in PATCH schema

### Route guard
- `src/proxy.ts` lines 12-17 — ROLE_ROUTE_ACCESS uses prefix matching; confirms no proxy changes needed

### Prior phase decisions
- `.planning/phases/38-database-foundation/38-CONTEXT.md` — D-01 (no notes column), D-07 (types.ts done)
- `.planning/phases/39-api-route-handlers/39-CONTEXT.md` — D-05 (hardcoded limits, Phase 40 extracts to config)

### Requirements
- `.planning/REQUIREMENTS.md` — DEAL-06 (both student and student_diy access Deals page)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VALIDATION` object pattern in config.ts — existing entries use `{ min, max }` structure
- `NavItem` type with `label`, `href`, `icon`, `separator?`, `badge?` properties
- `ROUTES` object with role-scoped route definitions

### Established Patterns
- Nav entries reference ROUTES constants for href (e.g., `href: ROUTES.student.resources`)
- VALIDATION keys use camelCase (e.g., `reportWins`, `outreachCount`)
- Route paths follow `/{role}/{feature}` convention

### Integration Points
- Phase 41 UI will import `ROUTES.student.deals` and `ROUTES.student_diy.deals` for page routing
- Phase 41 UI will read NAVIGATION for sidebar rendering (automatic — Sidebar reads from config)
- Phase 39 route handlers will be refactored to import `VALIDATION.deals.revenueMax` / `profitMax`
- `npx tsc --noEmit` must pass after all changes (success criteria #4)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard config updates following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 40-config-type-updates*
*Context gathered: 2026-04-07*
