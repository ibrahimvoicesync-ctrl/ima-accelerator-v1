# Phase 43: Coach & Owner Deals Tab - Research

**Researched:** 2026-04-07
**Domain:** Next.js tab component extension, read-only data display, server-side data fetching
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tab Integration**
- D-01: Expand `TabKey` union in `StudentDetailTabs.tsx` from `"calendar" | "roadmap"` to `"calendar" | "roadmap" | "deals"` and add `{ key: "deals", label: "Deals" }` to the `tabs` array.
- D-02: Both `StudentDetailClient` (coach) and `OwnerStudentDetailClient` (owner) already share `StudentDetailTabs` — the new tab appears in both automatically.
- D-03: URL param handling follows existing pattern: `?tab=deals` in `window.history.replaceState`.
- D-04: `initialTab` prop parsing expands to recognize `"deals"` alongside `"calendar"` and `"roadmap"`.

**Deals Table Display**
- D-05: Reuse the Phase 41 table-style row layout (deal number, revenue, profit, date) — read-only, no edit/delete actions for coach/owner.
- D-06: Add profit margin % column inline per roadmap success criteria #4: `((profit / revenue) * 100).toFixed(1)%`. Handle division-by-zero (revenue=0 → show "—").
- D-07: `Number()` coercion on revenue/profit before arithmetic (Phase 41 D-06 pattern).
- D-08: `toLocaleString()` with 2 decimal places for revenue/profit formatting (Phase 42 D-07 pattern).
- D-09: Empty state when student has no deals — use EmptyState component (compact variant) with "No deals yet" message, no CTA button (read-only view).
- D-10: Sorted most-recent first (created_at DESC), matching GET /api/deals default sort.

**Data Fetching**
- D-11: Server-side fetch in both page.tsx files (coach/owner student detail) using admin client query — same pattern as existing calendar/roadmap data fetching in those pages. Add deals query to existing `Promise.all`.
- D-12: No pagination needed initially — fetch all deals for the student in the server component.
- D-13: Pass deals array as prop to a new `DealsTab` component rendered when `activeTab === "deals"`.

**Component Structure**
- D-14: New `DealsTab` component in `src/components/coach/` (shared by coach and owner, same as CalendarTab/RoadmapTab pattern). Read-only, no client interactivity needed beyond tab switching.

### Claude's Discretion
- Exact table header labels and column widths
- Mobile responsive behavior for the table (horizontal scroll vs stacked layout)
- Whether to show a summary row (total revenue/profit) at the bottom of the table
- Loading skeleton shape for the deals tab content

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 43 is a pure UI extension phase with no new API routes, database changes, or business logic. The work is adding a third tab ("Deals") to the existing two-tab (Calendar, Roadmap) student detail pages used by coaches and owners.

The existing codebase provides all required primitives: `StudentDetailTabs` handles the tab bar and ARIA roles, `CalendarTab`/`RoadmapTab` set the pattern for tab panel components, `DealsClient` (Phase 41) provides the exact table markup to replicate without the edit/delete actions, and `EmptyState` (compact variant) handles the zero-deals case. Both server pages (`coach/students/[studentId]/page.tsx` and `owner/students/[studentId]/page.tsx`) already follow the `Promise.all` pattern for parallel server-side data fetching.

The only net-new code is: (1) `DealsTab` component in `src/components/coach/`, (2) deals column expansion in `StudentDetailTabs.tsx` + `TabKey` union, (3) `deals` prop added to both client components + conditional render, and (4) deals admin query added to both `page.tsx` files.

**Primary recommendation:** Implement as three sequential sub-tasks — expand `StudentDetailTabs` first (no dependencies), create `DealsTab` second, then wire server pages and client components together.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16 (project) | Server components + page.tsx | Project stack [VERIFIED: CLAUDE.md] |
| React 19 | 19 (project) | Client components | Project stack [VERIFIED: CLAUDE.md] |
| TypeScript strict | — | Type safety | Project-enforced [VERIFIED: CLAUDE.md] |
| Supabase admin client | — | Server-side DB queries bypassing RLS | Already used in both page.tsx files [VERIFIED: codebase] |
| Tailwind CSS 4 + ima-* tokens | — | All styling | Project-enforced [VERIFIED: CLAUDE.md] |

**No new npm dependencies required.** [VERIFIED: codebase scan — all needed components already exist]

---

## Architecture Patterns

### Recommended Project Structure

```
src/components/coach/
├── DealsTab.tsx         # NEW — read-only deals table for coach/owner
├── StudentDetailTabs.tsx  # MODIFY — add "deals" TabKey + tab entry
├── StudentDetailClient.tsx  # MODIFY — add deals prop + DealsTab render
├── CalendarTab.tsx        # REFERENCE — tab panel pattern
└── RoadmapTab.tsx         # REFERENCE — tab panel pattern

src/components/owner/
└── OwnerStudentDetailClient.tsx  # MODIFY — add deals prop + DealsTab render

src/app/(dashboard)/coach/students/[studentId]/
└── page.tsx  # MODIFY — add deals admin query

src/app/(dashboard)/owner/students/[studentId]/
└── page.tsx  # MODIFY — add deals admin query
```

### Pattern 1: TabKey Union Expansion
**What:** Extending the discriminated union and static array in `StudentDetailTabs.tsx`.
**When to use:** Every time a new tab is added to the student detail view.
**Current state:**
```typescript
// CURRENT (StudentDetailTabs.tsx line 6)
export type TabKey = "calendar" | "roadmap";

const tabs: { key: TabKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
];
```
**After change:**
```typescript
// Source: codebase — StudentDetailTabs.tsx [VERIFIED]
export type TabKey = "calendar" | "roadmap" | "deals";

const tabs: { key: TabKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
  { key: "deals", label: "Deals" },
];
```

### Pattern 2: initialTab Prop Expansion
**What:** Both client components parse `initialTab` string to typed `TabKey`. Currently only recognize "roadmap".
**Current state (both clients, identical):**
```typescript
// Source: StudentDetailClient.tsx line 74, OwnerStudentDetailClient.tsx line 92 [VERIFIED]
const [activeTab, setActiveTab] = useState<TabKey>(
  (initialTab === "roadmap" ? "roadmap" : "calendar") as TabKey
);
```
**After change:**
```typescript
const validTabs: TabKey[] = ["calendar", "roadmap", "deals"];
const [activeTab, setActiveTab] = useState<TabKey>(
  (validTabs.includes(initialTab as TabKey) ? initialTab as TabKey : "calendar")
);
```

### Pattern 3: Server-side Deals Query
**What:** Admin client direct table query added to existing `Promise.all` in both server pages.
**Pattern reference:** Existing `report_comments` query in both pages [VERIFIED: codebase].
**Note:** The existing GET /api/deals route is pagination-aware (page size 25) but D-12 says fetch all. Use admin client direct query — no HTTP round-trip, no pagination needed.
```typescript
// Source: pattern from coach/students/[studentId]/page.tsx lines 72-78 [VERIFIED]
const { data: dealsData } = await admin
  .from("deals")
  .select("id, deal_number, revenue, profit, created_at")
  .eq("student_id", student.id)
  .order("created_at", { ascending: false });

const deals = dealsData ?? [];
```

### Pattern 4: DealsTab Component Structure
**What:** Read-only tab panel matching the structure of RoadmapTab for empty state and CalendarTab for `role="tabpanel"` wrapper.
**Key elements from codebase [VERIFIED]:**
- `role="tabpanel"` div wrapping all content
- `id="tabpanel-deals"` and `aria-labelledby="tab-deals"` on the wrapper
- `EmptyState` with `variant="compact"` and DollarSign icon for zero-deals case
- Column headers hidden on mobile (`hidden sm:flex`) matching DealsClient pattern
- Row structure: deal number (`w-24`) | revenue (`flex-1`) | profit (`flex-1`) | margin % (new, `w-20`) | date (`w-28`)

### Pattern 5: Profit Margin Calculation
**What:** Inline computation per D-06.
```typescript
// Source: D-06 from 43-CONTEXT.md [VERIFIED: decision]
function formatMargin(revenue: string | number, profit: string | number): string {
  const rev = Number(revenue);
  const prof = Number(profit);
  if (rev === 0) return "—";
  return `${((prof / rev) * 100).toFixed(1)}%`;
}
```

### Pattern 6: Currency Formatting
**What:** Reuse exact same helper from DealsClient (Phase 41).
```typescript
// Source: src/components/student/DealsClient.tsx lines 36-41 [VERIFIED]
function formatCurrency(value: string | number): string {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

### Anti-Patterns to Avoid
- **Importing admin client in a client component:** DealsTab must be a server component OR receive data as props. Decision D-14 confirms prop pattern — no admin client in DealsTab [CLAUDE.md rule #2].
- **Using GET /api/deals HTTP endpoint from server page:** This adds auth overhead and pagination complexity. Use direct admin client query instead (same as how comments are fetched).
- **Hardcoding tab keys as strings:** Always use the `TabKey` type. TypeScript will catch if `initialTab` comparison misses a case.
- **Direct arithmetic on `revenue`/`profit` without `Number()` coercion:** The Deal type has `revenue: string | number` and `profit: string | number` — raw arithmetic produces NaN or string concatenation [VERIFIED: types.ts line 665-666].
- **Empty `catch` blocks:** CLAUDE.md hard rule — every catch must toast or `console.error`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab bar with ARIA | Custom tab bar | `StudentDetailTabs` (already exists) | Has `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` [VERIFIED] |
| Empty state | Custom empty div | `EmptyState` component, compact variant | Consistent styling, `role="status"` [VERIFIED] |
| Currency formatting | Custom format fn | `formatCurrency` pattern from DealsClient | Handles `string \| number` type, locale-aware [VERIFIED] |
| Table row layout | New markup | Copy column structure from DealsClient | Responsive `hidden sm:flex` headers already solved |

---

## Common Pitfalls

### Pitfall 1: TypeScript Error on `initialTab` Comparison
**What goes wrong:** After expanding `TabKey` to 3 values, the original ternary `initialTab === "roadmap" ? "roadmap" : "calendar"` silently ignores `"deals"` — URL `?tab=deals` lands on Calendar tab.
**Why it happens:** The guard was written for 2 tabs and not generalized.
**How to avoid:** Use an explicit allowlist check: `["calendar", "roadmap", "deals"].includes(initialTab as TabKey)`.
**Warning signs:** `?tab=deals` in URL always shows Calendar content.

### Pitfall 2: Deals Data Not Passed Through Component Chain
**What goes wrong:** Fetching deals in `page.tsx` but forgetting to add `deals` prop to client component interface and JSX, causing TypeScript error or deals never rendering.
**Why it happens:** Two-step prop addition — interface AND JSX call site must both be updated.
**How to avoid:** Update interface first, let TypeScript error guide JSX prop addition. Both `StudentDetailClientProps` and `OwnerStudentDetailClientProps` must be expanded.
**Warning signs:** TypeScript errors on the `page.tsx` return JSX.

### Pitfall 3: Margin % Column with revenue=0
**What goes wrong:** Division by zero produces `Infinity%` or `NaN%`.
**Why it happens:** Numeric edge case — a deal with revenue=0 is technically valid (profit=0 deal).
**How to avoid:** Guard: `if (rev === 0) return "—"` before dividing [D-06].
**Warning signs:** "Infinity%" or "NaN%" visible in table rows.

### Pitfall 4: Missing `role="tabpanel"` ARIA Wiring
**What goes wrong:** Screen readers don't associate the Deals tab button with its content panel.
**Why it happens:** Copying from CalendarTab/RoadmapTab but missing the `id` and `aria-labelledby` attributes.
**How to avoid:** Wrapper must have `role="tabpanel" id="tabpanel-deals" aria-labelledby="tab-deals"` — matching the `id="tab-deals"` set by `StudentDetailTabs` on the button.
**Warning signs:** Accessibility audit flags orphaned tabpanel.

### Pitfall 5: Coach Page Only Sees Own Students (Defense-in-Depth)
**What goes wrong:** Coach page uses `.eq("coach_id", user.id)` filter when fetching the student. The deals query uses `student.id` — no additional filter needed. But if student fetch fails and `student` is null, `notFound()` is already called. Safe pattern.
**Why it happens:** Not a pitfall if the existing `notFound()` guard is preserved — do not restructure the page flow.
**How to avoid:** Add deals query AFTER the existing `notFound()` guard, using the already-verified `student.id`.

---

## Code Examples

Verified patterns from codebase analysis:

### DealsTab Wrapper (ARIA pattern)
```typescript
// Source: RoadmapTab.tsx line 89, CalendarTab.tsx line 153 [VERIFIED]
<div role="tabpanel" id="tabpanel-deals" aria-labelledby="tab-deals" className="space-y-4">
  {/* content */}
</div>
```

### Table Column Headers (responsive pattern from DealsClient)
```typescript
// Source: DealsClient.tsx lines 226-231 [VERIFIED]
<div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-ima-surface-light border-b border-ima-border text-xs font-medium text-ima-text-secondary uppercase tracking-wider">
  <span className="w-24">Deal</span>
  <span className="flex-1">Revenue</span>
  <span className="flex-1">Profit</span>
  <span className="w-20">Margin</span>
  <span className="w-28 text-right">Date</span>
</div>
```

### Table Row (read-only, no actions column)
```typescript
// Source: adapted from DealsClient.tsx lines 236-259 [VERIFIED pattern]
<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-4 min-h-[44px]">
  <span className="text-sm font-medium text-ima-text w-24 shrink-0">
    Deal #{deal.deal_number}
  </span>
  <span className="text-sm text-ima-text flex-1">
    {formatCurrency(deal.revenue)}
  </span>
  <span className="text-sm text-ima-text-secondary flex-1">
    {formatCurrency(deal.profit)}
  </span>
  <span className="text-sm text-ima-text-secondary w-20 shrink-0">
    {formatMargin(deal.revenue, deal.profit)}
  </span>
  <span className="text-xs text-ima-text-muted w-28 sm:text-right shrink-0">
    {new Date(deal.created_at).toLocaleDateString()}
  </span>
</div>
```

### Admin Query in Server Page (deals addition)
```typescript
// Source: pattern from both page.tsx files [VERIFIED]
const { data: dealsData } = await admin
  .from("deals")
  .select("id, deal_number, revenue, profit, created_at")
  .eq("student_id", student.id)
  .order("created_at", { ascending: false });

const deals = dealsData ?? [];
```

### Rendering DealsTab (in both client components)
```typescript
// Source: pattern from StudentDetailClient.tsx line 127 [VERIFIED]
{activeTab === "deals" && <DealsTab deals={deals} />}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fetch deals via GET /api/deals HTTP from server page | Direct admin client `.from("deals")` query | Phase 43 design | No auth overhead, no pagination limit, cleaner |

**No deprecated patterns in scope for this phase.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DealsTab` needs no `"use client"` directive (pure display of passed props, no useState/hooks) | Architecture Patterns | If summary row totals are implemented as Claude's Discretion, no state is needed either — computed inline. Low risk. |

**Nearly all claims verified against codebase.** A1 is the only assumed design detail — all locked decisions are drawn from CONTEXT.md and verified against live code.

---

## Open Questions

1. **Mobile layout for the Deals table**
   - What we know: DealsClient uses `flex-col sm:flex-row` stacked rows on mobile with label suppression via `hidden sm:flex` headers.
   - What's unclear: Claude's Discretion allows "horizontal scroll vs stacked layout" choice.
   - Recommendation: Use the same stacked layout as DealsClient — proven, already in codebase, no new CSS needed.

2. **Summary row (total revenue/profit)**
   - What we know: Marked as Claude's Discretion. Would require summing all deals.
   - What's unclear: Whether to include it.
   - Recommendation: Include a simple summary row showing total revenue and total profit — adds meaningful context for coach reviewing a student's performance. Margin % at summary level: total profit / total revenue. Guard for all-zero revenue.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is pure UI component code changes with no new CLI tools, services, or runtimes required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no Jest/Vitest configured [VERIFIED: package.json has no test script] |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Coach student detail page has a "Deals" tab | Build + manual browser | `npx tsc --noEmit` | N/A |
| SC-2 | Owner student detail page has a "Deals" tab | Build + manual browser | `npx tsc --noEmit` | N/A |
| SC-3 | Deals tab shows read-only table with deal number, revenue, profit, date | Manual browser | `npm run build` | N/A |
| SC-4 | Profit margin % shown inline per deal | Manual browser | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build && npx tsc --noEmit && npm run lint`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
None — existing infrastructure (TypeScript + build) covers all phase requirements. No new test files needed.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no new auth surface |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | Server pages use `requireRole("coach")` / `requireRole("owner")` — already enforced. Deals query uses `student.id` from server-validated student fetch. |
| V5 Input Validation | no | Read-only display, no user input |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized deal viewing (student seeing other student's deals) | Information Disclosure | Student fetch in coach page uses `.eq("coach_id", user.id)` — deals query inherits `student.id` from that validated fetch. Owner page uses `requireRole("owner")`. Already handled. |
| IDOR via `?tab=deals` URL param | Information Disclosure | Tab param only controls UI state (which tab is active) — no data fetching is gated by the tab param. Already safe pattern. |

**Security assessment: No new attack surface introduced.** All data access uses the existing validated `student.id` from server-side role-gated page functions.

---

## Sources

### Primary (HIGH confidence)
- `src/components/coach/StudentDetailTabs.tsx` — TabKey union, tabs array, ARIA pattern [VERIFIED]
- `src/components/coach/StudentDetailClient.tsx` — props interface, initialTab parsing, tab rendering [VERIFIED]
- `src/components/owner/OwnerStudentDetailClient.tsx` — identical patterns for owner [VERIFIED]
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — Promise.all pattern, admin query, notFound guard [VERIFIED]
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — same as coach page [VERIFIED]
- `src/app/api/deals/route.ts` — GET endpoint shape, response format, sort order [VERIFIED]
- `src/components/student/DealsClient.tsx` — table markup, formatCurrency helper, column structure [VERIFIED]
- `src/components/coach/CalendarTab.tsx` — tabpanel ARIA pattern [VERIFIED]
- `src/components/coach/RoadmapTab.tsx` — tabpanel ARIA pattern, EmptyState compact usage [VERIFIED]
- `src/components/ui/EmptyState.tsx` — variant="compact" interface, role="status" [VERIFIED]
- `src/lib/types.ts` — Deal Row type with `revenue: string | number`, `profit: string | number` [VERIFIED]
- `src/lib/config.ts` — VALIDATION.deals constants [VERIFIED]
- `./CLAUDE.md` — hard rules: ima-* tokens, 44px touch targets, aria labels, admin client in API routes only [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/phases/43-coach-owner-deals-tab/43-CONTEXT.md` — all locked decisions D-01 through D-14

### Tertiary (LOW confidence)
- None

---

## Project Constraints (from CLAUDE.md)

These are enforced during EVERY build and must be respected in all Phase 43 code:

1. **motion-safe:** — every `animate-*` class MUST use `motion-safe:animate-*` (no animations planned for this phase — not applicable)
2. **44px touch targets** — every interactive element needs `min-h-[44px]`. DealsTab rows use `min-h-[44px]` on row divs (same as DealsClient).
3. **Accessible labels** — every input needs `aria-label` or `<label>`. No inputs in DealsTab (read-only).
4. **Admin client in API routes only** — `DealsTab` is a pure display component receiving props. Admin client used in `page.tsx` server components only (not in route handlers for this phase).
5. **Never swallow errors** — deals query error logged with `console.error` if it fails (same pattern as other queries in page.tsx).
6. **Check response.ok** — no `fetch()` calls in DealsTab (data passed as props from server).
7. **Zod import** — `import { z } from "zod"` — not applicable (no new API routes).
8. **ima-* tokens only** — all colors use ima-* design tokens. `text-ima-text`, `text-ima-text-secondary`, `text-ima-text-muted`, `bg-ima-surface`, `border-ima-border`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — exact files verified, exact line numbers cited, patterns directly from codebase
- Pitfalls: HIGH — derived from actual code state (e.g., line 74 of StudentDetailClient confirms the ternary that must be fixed)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase, no external API dependencies)
