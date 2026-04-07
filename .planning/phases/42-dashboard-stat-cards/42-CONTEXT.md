# Phase 42: Dashboard Stat Cards - Context

**Gathered:** 2026-04-07 (discuss mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

3 new stat cards on the student and student_diy dashboards: Deals Closed (count), Total Revenue (sum), Total Profit (sum). Computed from the authenticated student's deals data, displayed alongside existing dashboard cards.

</domain>

<decisions>
## Implementation Decisions

### Card Placement & Layout
- **D-01:** Add a new 3-column grid row below the existing KPI cards (student) or below the work+roadmap grid (student_diy). Same `grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6` pattern as the existing KPI outreach row on the student dashboard.
- **D-02:** Each card uses the same inline card pattern as existing KPI cards: `bg-ima-surface border border-ima-border rounded-xl p-4` with icon, label, value, and subtitle.
- **D-03:** Icons: `Handshake` (Deals Closed), `DollarSign` (Total Revenue), `TrendingUp` (Total Profit) from lucide-react.

### Data Source & Query
- **D-04:** Server-side query in page.tsx using admin client — fetch all deals for the student with `.select("revenue, profit")` and compute count/sum in the server component. No new RPC needed for a simple aggregation.
- **D-05:** Single query fetching revenue and profit columns, added to the existing `Promise.all` in the dashboard page. Count = array length, revenue = sum of revenue, profit = sum of profit.
- **D-06:** Use `Number()` coercion on revenue/profit before arithmetic (matching Phase 41 pattern for `string | number` types).

### Number Formatting
- **D-07:** Display revenue/profit with `toLocaleString()` for thousand separators and 2 decimal places. No currency symbol — just the number (students track in their own currency).
- **D-08:** Deals Closed displays as integer count, no decimals.

### Config Registration
- **D-09:** Keep cards inline in page.tsx — no config registration. The student dashboard cards are all inline (no STUDENT_CONFIG exists), and adding one for 3 static cards is overengineering.

### Claude's Discretion
- Exact subtitle text under each card value (e.g., "from X deals" or "all time")
- Whether to show a "View Deals" link on the cards
- Loading skeleton shape for the new row
- Color choices for card values (ima-primary vs ima-text)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard pages (modify these)
- `src/app/(dashboard)/student/page.tsx` — Student dashboard with KPI outreach cards (pattern to replicate)
- `src/app/(dashboard)/student_diy/page.tsx` — Student_diy dashboard (simpler, no KPI cards yet)

### Data source
- `src/app/api/deals/route.ts` — GET endpoint (reference only, not used — server-side query instead)
- `src/lib/types.ts` — Deal type with `revenue: string | number`, `profit: string | number`

### Config & UI patterns
- `src/lib/config.ts` — OWNER_CONFIG.statCards pattern (reference only, not used for student cards)
- `src/lib/utils.ts` — `cn()`, `formatHoursMinutes()` helpers
- `src/lib/supabase/admin.ts` — `createAdminClient()` for server queries

### Prior phase decisions
- `.planning/phases/41-student-deals-pages/41-CONTEXT.md` — D-06 (Number() coercion pattern)
- `.planning/phases/40-config-type-updates/40-CONTEXT.md` — D-05 (DollarSign icon)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Inline KPI card pattern on student dashboard (lines 143-224) — 3-column grid with RAG dot, label, value, target, progress bar
- `cn()` utility for conditional class merging
- `createAdminClient()` for server-side data fetching
- lucide-react icons (`DollarSign`, `Handshake`, `TrendingUp`)

### Established Patterns
- Server component page.tsx fetches data via `Promise.all` with admin client
- Error logging with `console.error("[dashboard] message:", error)`
- Card styling: `bg-ima-surface border border-ima-border rounded-xl p-4`
- All text uses `text-ima-text`, `text-ima-text-secondary`, `text-ima-text-muted` tokens
- `motion-safe:` prefix on all transitions

### Integration Points
- Student dashboard `Promise.all` — add deals query alongside existing 5 parallel queries
- Student_diy dashboard `Promise.all` — add deals query alongside existing 2 parallel queries
- New grid row rendered after existing cards in both dashboards

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard stat cards following existing dashboard patterns. All decisions defaulted to Claude's discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-dashboard-stat-cards*
*Context gathered: 2026-04-07*
