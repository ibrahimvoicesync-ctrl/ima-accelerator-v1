# Phase 42: Dashboard Stat Cards - Research

**Researched:** 2026-04-07
**Domain:** Next.js 16 App Router server component data fetching, inline React UI patterns
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add a new 3-column grid row below the existing KPI cards (student) or below the work+roadmap grid (student_diy). Same `grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6` pattern as the existing KPI outreach row on the student dashboard.
- **D-02:** Each card uses the same inline card pattern as existing KPI cards: `bg-ima-surface border border-ima-border rounded-xl p-4` with icon, label, value, and subtitle.
- **D-03:** Icons: `Handshake` (Deals Closed), `DollarSign` (Total Revenue), `TrendingUp` (Total Profit) from lucide-react.
- **D-04:** Server-side query in page.tsx using admin client — fetch all deals for the student with `.select("revenue, profit")` and compute count/sum in the server component. No new RPC needed for a simple aggregation.
- **D-05:** Single query fetching revenue and profit columns, added to the existing `Promise.all` in the dashboard page. Count = array length, revenue = sum of revenue, profit = sum of profit.
- **D-06:** Use `Number()` coercion on revenue/profit before arithmetic (matching Phase 41 pattern for `string | number` types).
- **D-07:** Display revenue/profit with `toLocaleString()` for thousand separators and 2 decimal places. No currency symbol — just the number.
- **D-08:** Deals Closed displays as integer count, no decimals.
- **D-09:** Keep cards inline in page.tsx — no config registration.

### Claude's Discretion
- Exact subtitle text under each card value (e.g., "from X deals" or "all time")
- Whether to show a "View Deals" link on the cards
- Loading skeleton shape for the new row
- Color choices for card values (ima-primary vs ima-text)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 42 adds 3 stat cards to both student dashboard pages: Deals Closed (count), Total Revenue (sum), Total Profit (sum). All data is fetched server-side inside the existing `Promise.all` by querying the `deals` table for the authenticated student. Computed values — count via array length, sums via `reduce` with `Number()` coercion — are rendered inline in a new `grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6` row below existing cards.

The implementation is a pure UI addition with no new routes, no new components, no schema changes, and no new dependencies. All patterns (card markup, grid layout, icon imports, token usage, Promise.all data fetching) are already proven in the codebase and directly reusable.

**Primary recommendation:** Replicate the existing KPI outreach card structure verbatim (lines 143–224 of student/page.tsx) as the template for the 3 new stat cards, swapping RAG dots/progress bars for a static icon layout since deals stats have no threshold targets.

---

## Standard Stack

### Core (all already installed)
| Library | Installed Version | Purpose | Source |
|---------|------------------|---------|--------|
| next | 16.1.6 | App Router server components, page.tsx | [VERIFIED: package.json] |
| react | 19.2.3 | JSX rendering | [VERIFIED: package.json] |
| lucide-react | ^0.576.0 | Handshake, DollarSign, TrendingUp icons | [VERIFIED: package.json + runtime check] |
| @supabase/supabase-js | installed | Admin client for server-side queries | [VERIFIED: codebase] |

**No new installations required.** [VERIFIED: codebase scan — all needed libraries already present]

---

## Architecture Patterns

### Files Modified (two files, no new files)
```
src/app/(dashboard)/student/page.tsx       # Add deals query + 3-card row
src/app/(dashboard)/student_diy/page.tsx   # Add deals query + 3-card row
```

### Pattern 1: Adding a query to Promise.all
**What:** The dashboard pages use `await Promise.all([...])` for parallel data fetching. Add the deals query as a new entry.

**student/page.tsx** — currently 5 parallel queries, becomes 6:
```typescript
// Source: src/app/(dashboard)/student/page.tsx line 38–50 (verified)
const [
  { data: sessions, error: sessionsError },
  { data: roadmapRows, error: roadmapError },
  reportResult,
  lifetimeResult,
  userResult,
  { data: deals, error: dealsError },   // NEW
] = await Promise.all([
  admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today).order("cycle_number", { ascending: true }),
  admin.from("roadmap_progress").select("step_number, status").eq("student_id", user.id).order("step_number", { ascending: true }),
  admin.from("daily_reports").select("submitted_at, brands_contacted, influencers_contacted").eq("student_id", user.id).eq("date", today).maybeSingle(),
  admin.from("daily_reports").select("brands_contacted, influencers_contacted").eq("student_id", user.id),
  admin.from("users").select("joined_at").eq("id", user.id).single(),
  admin.from("deals").select("revenue, profit").eq("student_id", user.id),  // NEW
]);
```

**student_diy/page.tsx** — currently 2 parallel queries, becomes 3.

### Pattern 2: Number() coercion aggregation
**What:** The `deals` table stores `revenue` and `profit` as `string | number` (Postgres numeric columns surface as strings in JS). Use `Number()` at each arithmetic site.

```typescript
// Source: Phase 41 D-06 pattern (verified in 41-CONTEXT.md)
const dealsData = deals ?? [];
const dealsClosed = dealsData.length;
const totalRevenue = dealsData.reduce((sum, d) => sum + Number(d.revenue), 0);
const totalProfit = dealsData.reduce((sum, d) => sum + Number(d.profit), 0);
```

### Pattern 3: Inline card markup
**What:** The new stat cards follow the identical structure of the existing KPI outreach cards but without the RAG dot or progress bar (no thresholds for deals stats).

```tsx
{/* Source: student/page.tsx lines 143–224 (verified) — adapted without RAG */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
  {/* Deals Closed */}
  <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
    <div className="flex items-center gap-2">
      <Handshake className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
      <h3 className="text-sm font-medium text-ima-text-secondary">Deals Closed</h3>
    </div>
    <p className="text-2xl font-bold mt-2 text-ima-primary">{dealsClosed}</p>
    <p className="text-xs text-ima-text-muted mt-1">all time</p>
  </div>

  {/* Total Revenue */}
  <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
    <div className="flex items-center gap-2">
      <DollarSign className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
      <h3 className="text-sm font-medium text-ima-text-secondary">Total Revenue</h3>
    </div>
    <p className="text-2xl font-bold mt-2 text-ima-primary">
      {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
    <p className="text-xs text-ima-text-muted mt-1">from {dealsClosed} deal{dealsClosed !== 1 ? "s" : ""}</p>
  </div>

  {/* Total Profit */}
  <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
    <div className="flex items-center gap-2">
      <TrendingUp className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
      <h3 className="text-sm font-medium text-ima-text-secondary">Total Profit</h3>
    </div>
    <p className="text-2xl font-bold mt-2 text-ima-primary">
      {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
    <p className="text-xs text-ima-text-muted mt-1">all time</p>
  </div>
</div>
```

### Pattern 4: Error logging for new query
**What:** Follow the established error logging pattern already used for sessions, roadmap, etc.

```typescript
// Source: student/page.tsx lines 53–66 (verified)
if (dealsError) {
  console.error("[student dashboard] Failed to load deals:", dealsError);
}
```

### Anti-Patterns to Avoid
- **Arithmetic without Number():** `d.revenue` is typed `string | number` — always coerce with `Number()` before summing. Direct `+` will string-concatenate on string values.
- **Importing admin client in client components:** The deals query is server-only in page.tsx. No client component involved here.
- **Hardcoded hex colors:** All card text must use `text-ima-*` tokens. Do not use `text-blue-500` or any Tailwind color classes.
- **Missing aria-hidden on decorative icons:** All lucide icons in these cards are decorative; each needs `aria-hidden="true"`.
- **animate-* without motion-safe:** Not applicable here — these cards have no animation classes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thousand separators | Custom number formatter | `toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` | Built-in, locale-aware, matches existing KPI card pattern (line 151 of student/page.tsx) |
| Parallel data fetching | Sequential awaits | `Promise.all([...])` | Already established pattern — keeps page fast, server-rendered in one pass |
| Admin DB access | `createClient()` | `createAdminClient()` | All server component queries use admin client per CLAUDE.md rule 4 |

---

## Common Pitfalls

### Pitfall 1: String arithmetic on revenue/profit
**What goes wrong:** `deals.reduce((sum, d) => sum + d.revenue, 0)` produces `"012.5024.00"` (string concatenation) instead of the numeric sum when Postgres returns numeric columns as strings.
**Why it happens:** Supabase JS client returns numeric Postgres columns as strings in some configurations. The TypeScript type is `string | number`, signaling both are possible.
**How to avoid:** Always wrap with `Number()`: `sum + Number(d.revenue)`.
**Warning signs:** Revenue/profit values display as very large numbers or NaN in the UI.

### Pitfall 2: Forgetting the error log for the new query
**What goes wrong:** Deals query fails silently (network/RLS issue), cards show 0/0/0 with no diagnostic.
**Why it happens:** Promise.all destructuring adds a new entry but error logging must be added manually.
**How to avoid:** Add `if (dealsError) { console.error(...) }` immediately after the Promise.all block.

### Pitfall 3: Wrong placement in student_diy page
**What goes wrong:** Cards placed inside the existing `grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6` block, making 5 cards span 2 columns incorrectly.
**Why it happens:** student_diy uses a 2-col grid for Work+Roadmap; the 3 deals cards need their own separate 3-col grid row.
**How to avoid:** Close the existing 2-col grid `</div>` before opening a new `<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">`.

### Pitfall 4: select("*") instead of select("revenue, profit")
**What goes wrong:** Fetching all columns when only `revenue` and `profit` are needed wastes bandwidth.
**Why it happens:** Default instinct to select all.
**How to avoid:** Use `.select("revenue, profit")` per D-04 — only the columns needed for aggregation.

---

## Code Examples

### Query structure for student/page.tsx
```typescript
// Source: Verified against student/page.tsx Promise.all pattern (lines 38–50)
const [
  { data: sessions, error: sessionsError },
  { data: roadmapRows, error: roadmapError },
  reportResult,
  lifetimeResult,
  userResult,
  { data: deals, error: dealsError },
] = await Promise.all([
  // ... existing 5 queries unchanged ...
  admin.from("deals").select("revenue, profit").eq("student_id", user.id),
]);
```

### Aggregation computation
```typescript
// Source: Phase 41 D-06 (Number() coercion) + standard JS reduce pattern
const dealsData = deals ?? [];
const dealsClosed = dealsData.length;
const totalRevenue = dealsData.reduce((sum, d) => sum + Number(d.revenue), 0);
const totalProfit = dealsData.reduce((sum, d) => sum + Number(d.profit), 0);
```

### Number formatting (D-07)
```typescript
// Source: Verified against existing usage — student/page.tsx line 151 uses toLocaleString()
totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
dealsClosed.toString()   // integer, no decimals per D-08
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a pure code edit to existing server component pages. No external tools, CLIs, databases, or services beyond what is already running for the Next.js dev server.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in project (no jest.config, no vitest.config, no test/ directory outside node_modules) |
| Config file | None — Wave 0 must address if tests are planned |
| Quick run command | `npm run build` (TypeScript compile + Next.js build as proxy for correctness) |
| Full suite command | `npm run build && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | 3 stat cards appear on student dashboard | smoke/visual | `npm run build` (build passes = no TS errors) | N/A — no test infra |
| SC-2 | Values computed from authenticated student's deals | integration | Manual: log in as student, verify card values match deals | Manual-only |
| SC-3 | Cards use ima-* tokens, match existing card style | visual | Manual: inspect rendered HTML | Manual-only |
| SC-4 | Both student and student_diy dashboards show cards | smoke | `npm run build` + manual route check | Manual-only |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check, fast)
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** `npm run build` green before `/gsd-verify-work`

### Wave 0 Gaps
None — no test infrastructure exists in this project; validation is done via TypeScript build + manual UAT. No test files to create.

---

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireRole("student")` / `requireRole("student_diy")` already called at page top |
| V3 Session Management | no | Server component, session handled by Supabase auth |
| V4 Access Control | yes | `requireRole` enforces role gate; `.eq("student_id", user.id)` scopes query to authenticated user |
| V5 Input Validation | no | No user input — read-only aggregation |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on deals query | Information Disclosure | `.eq("student_id", user.id)` filters to authenticated user's own deals — already the pattern per CLAUDE.md rule "Filter by user ID in queries, never rely on RLS alone" |

**Security note:** No new API routes, no new mutations, no user input. Risk surface is minimal — server component read with user-scoped filter.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `deals` table `revenue` and `profit` columns return as `string \| number` from Supabase JS (not always numeric) | Architecture Patterns / Pitfall 1 | If always numeric, `Number()` coercion is a harmless no-op — no risk |
| A2 | Subtitle text "all time" and "from X deals" (Claude's discretion items) will be acceptable to the user | Code Examples | Minor — easily changed in one line during UAT |

**All critical claims (icons available, query pattern, card markup, Promise.all structure) were VERIFIED directly against the codebase.**

---

## Open Questions

1. **"View Deals" link on cards (Claude's discretion)**
   - What we know: D-09 says no config registration, but a link is possible inline.
   - What's unclear: Whether adding a small "View Deals →" link below the subtitle would be useful.
   - Recommendation: Add it — costs 1 line, improves navigation. Link to `/student/deals` or `/student_diy/deals` respectively.

2. **Color for stat card values**
   - What we know: Existing KPI cards use `ragToColorClass()` (conditional red/amber/green). Deals stats have no thresholds.
   - What's unclear: Whether to use `text-ima-primary` (blue) or `text-ima-text` (neutral dark).
   - Recommendation: Use `text-ima-primary` — consistent with the progress card's `<span className="text-2xl font-bold text-ima-primary">` pattern for key metrics.

---

## Sources

### Primary (HIGH confidence)
- `src/app/(dashboard)/student/page.tsx` — verified Promise.all structure, KPI card markup, error logging pattern, grid classes
- `src/app/(dashboard)/student_diy/page.tsx` — verified Promise.all structure, 2-col grid, placement point for new row
- `src/lib/types.ts` (lines 662–694) — verified `deals` table Row type with `revenue: string | number`, `profit: string | number`
- `src/app/api/deals/route.ts` — confirmed `deals` table has `revenue`, `profit`, `student_id` columns; server-side query pattern confirmed
- `.planning/phases/42-dashboard-stat-cards/42-CONTEXT.md` — all locked decisions sourced from here
- `.planning/phases/41-student-deals-pages/41-CONTEXT.md` — confirmed Number() coercion pattern (D-06)
- `package.json` — verified lucide-react ^0.576.0 installed
- Runtime node check — verified `Handshake`, `DollarSign`, `TrendingUp` all exported from installed lucide-react

### Secondary (MEDIUM confidence)
- None needed — all findings directly verified in codebase.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against package.json and runtime
- Architecture: HIGH — patterns copied verbatim from verified existing code
- Pitfalls: HIGH — derived from TypeScript type definitions and existing code analysis
- Icons: HIGH — runtime-confirmed present in installed lucide-react version

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase — no moving parts)
