# Phase 40: Config & Type Updates - Research

**Researched:** 2026-04-07
**Domain:** TypeScript config — src/lib/config.ts additions (ROUTES, NAVIGATION, VALIDATION)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `ROUTES.student.deals = "/student/deals"` and `ROUTES.student_diy.deals = "/student_diy/deals"` to config.ts ROUTES object.
- **D-02:** No proxy.ts changes needed — `ROLE_ROUTE_ACCESS` uses prefix matching (`/student`, `/student_diy`), so deal routes are already covered.
- **D-03:** Student nav: Deals appears after Daily Report and before Chat. Position index 5 (0-based). Order: Dashboard, Work Tracker, Roadmap, Ask Abu Lahya, Daily Report, **Deals**, Chat, Resources.
- **D-04:** Student_diy nav: Deals appears after Roadmap and before Resources. Order: Dashboard, Work Tracker, Roadmap, **Deals**, Resources.
- **D-05:** Icon: `DollarSign` from lucide-react for both student and student_diy Deals nav entries.
- **D-06:** No separator before Deals — it's part of the main nav flow, not a section break.
- **D-07:** Add `VALIDATION.deals` object with `revenueMax: 9999999999.99` and `profitMax: 9999999999.99`.
- **D-08:** No `NOTES_MAX_LENGTH` — the deals table has no notes column.
- **D-09:** Phase 39 route handlers should be refactored to import from `VALIDATION.deals` instead of hardcoded values — this is within Phase 40's scope.
- **D-10:** No types.ts changes needed — Deal type (Row/Insert/Update) already exists from Phase 38.

### Claude's Discretion

- Whether to add `revenueMin: 0` and `profitMin: 0` alongside max values for completeness
- Exact key naming in VALIDATION.deals object (camelCase vs snake_case — follow existing pattern)
- Whether to add the deals entries to the default config export aggregate

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEAL-06 | Both student and student_diy roles have access to Deals page | ROUTES entries + NAVIGATION entries ensure sidebar links appear and route paths are defined; proxy.ts prefix matching already covers these paths (D-02 confirmed via code inspection) |
</phase_requirements>

---

## Summary

Phase 40 is a pure config expansion: add ROUTES keys, insert NAVIGATION entries, add a VALIDATION.deals object, and refactor Phase 39 route handlers to import from config rather than using hardcoded numbers. No new files are created. No proxy.ts changes are required. TypeScript must compile clean after all edits.

The codebase already follows highly consistent patterns for all three touched areas (ROUTES, NAVIGATION, VALIDATION), and the `as const` constraint on the entire config export means the planner only needs to ensure new entries are syntactically correct in the right positions — TypeScript will enforce the rest automatically.

**Primary recommendation:** Follow the exact structural patterns already present in config.ts. Add `deals` key to both `ROUTES.student` and `ROUTES.student_diy`, insert `NavItem` entries at the decided positions (index 5 in student, index 3 in student_diy), and add `VALIDATION.deals = { revenueMin: 0, profitMin: 0, revenueMax: 9999999999.99, profitMax: 9999999999.99 }`. Then update both route handler files to import `VALIDATION` from `@/lib/config` and replace hardcoded literals.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | Project-wide | Type safety, compile-time validation | Codebase uses strict mode; all config uses `as const` for literal types |
| Next.js 16 App Router | Project-wide | Framework | Config is consumed by server and client components throughout |

No additional libraries needed for this phase. It is a pure editing task.

**Installation:** None required.

---

## Architecture Patterns

### Verified File Structure

The single file touched is `src/lib/config.ts`. The two route handlers being refactored are:
- `src/app/api/deals/route.ts`
- `src/app/api/deals/[id]/route.ts`

`src/proxy.ts` and `src/lib/types.ts` require no changes (confirmed by code inspection).

### Pattern 1: ROUTES object extension

**What:** The `ROUTES` object uses `as const` at the top level. Sub-objects per role (`student`, `student_diy`) hold route paths as string literals.

**Current state of `ROUTES.student` (lines 83–90):**
```typescript
// Source: src/lib/config.ts lines 83-90 [VERIFIED: codebase]
student: {
  dashboard: "/student",
  workTracker: "/student/work",
  roadmap: "/student/roadmap",
  askAI: "/student/ask",
  report: "/student/report",
  chat: "/student/chat",
  resources: "/student/resources",
},
```

**Current state of `ROUTES.student_diy` (lines 91–95):**
```typescript
// Source: src/lib/config.ts lines 91-95 [VERIFIED: codebase]
student_diy: {
  dashboard: "/student_diy",
  workTracker: "/student_diy/work",
  roadmap: "/student_diy/roadmap",
  resources: "/student_diy/resources",
},
```

**Pattern to follow:** Append a `deals` key at the end of each sub-object (before the closing brace), consistent with other trailing entries like `resources`.

### Pattern 2: NAVIGATION array insertion

**What:** `NAVIGATION` is `Record<Role, NavItem[]>`. `NavItem` type:
```typescript
// Source: src/lib/config.ts lines 273-279 [VERIFIED: codebase]
export type NavItem = {
  label: string;
  href: string;
  icon: string;
  separator?: boolean; // render divider BEFORE this item
  badge?: string;      // key for dynamic badge count
};
```

**Current student nav (lines 302–310):**
```typescript
student: [
  { label: "Dashboard",     href: "/student",         icon: "LayoutDashboard" },
  { label: "Work Tracker",  href: "/student/work",    icon: "Timer" },
  { label: "Roadmap",       href: "/student/roadmap", icon: "Map" },
  { label: "Ask Abu Lahya", href: "/student/ask",     icon: "MessageSquare" },
  { label: "Daily Report",  href: "/student/report",  icon: "FileText" },
  // index 5 → Deals goes here (D-03)
  { label: "Chat",          href: "/student/chat",    icon: "MessageSquare", badge: "unread_messages" },
  { label: "Resources",     href: ROUTES.student.resources, icon: "BookOpen" },
],
```

**Current student_diy nav (lines 311–316):**
```typescript
student_diy: [
  { label: "Dashboard",    href: "/student_diy",         icon: "LayoutDashboard" },
  { label: "Work Tracker", href: "/student_diy/work",    icon: "Timer" },
  { label: "Roadmap",      href: "/student_diy/roadmap", icon: "Map" },
  // index 3 → Deals goes here (D-04)
  { label: "Resources",    href: ROUTES.student_diy.resources, icon: "BookOpen" },
],
```

**Key observation:** href values in nav entries reference ROUTES constants (e.g., `ROUTES.student.resources`), not bare strings — this is why adding ROUTES keys first is prerequisite to the nav entries. The nav Deals entries must use `href: ROUTES.student.deals` and `href: ROUTES.student_diy.deals`.

### Pattern 3: VALIDATION object extension

**What:** `VALIDATION` is a plain object with `as const`. Existing keys use camelCase with `{ min, max }` structure for numeric fields.

**Existing examples:**
```typescript
// Source: src/lib/config.ts lines 322-333 [VERIFIED: codebase]
export const VALIDATION = {
  name: { min: 2, max: 100 },
  outreachCount: { min: 0, max: 500 },
  starRating: { min: 1, max: 5 },
  // ...
} as const;
```

**Decisions from CONTEXT.md scope `VALIDATION.deals`:** revenueMax and profitMax at `9999999999.99`. `revenueMin`/`profitMin` are Claude's discretion — the established pattern (`outreachCount: { min: 0, max: 500 }`) includes min values, so including them is consistent.

**Key naming:** The existing codebase uses camelCase keys (e.g., `reportWins`, `outreachCount`, `starRating`). The deals sub-object should therefore use `revenueMax`, `profitMax`, `revenueMin`, `profitMin`.

### Pattern 4: Route handler refactor

**What:** Both `src/app/api/deals/route.ts` and `src/app/api/deals/[id]/route.ts` have hardcoded `.max(9999999999.99)` in their Zod schemas. These must be replaced with `VALIDATION.deals.revenueMax` and `VALIDATION.deals.profitMax`.

**Current hardcoded locations (confirmed by code inspection):**

`src/app/api/deals/route.ts` lines 13-16:
```typescript
// Source: [VERIFIED: codebase]
const postDealSchema = z.object({
  revenue: z.number().min(0).max(9999999999.99),
  profit: z.number().min(0).max(9999999999.99),
});
```

`src/app/api/deals/[id]/route.ts` lines 25-32:
```typescript
// Source: [VERIFIED: codebase]
const patchDealSchema = z
  .object({
    revenue: z.number().min(0).max(9999999999.99).optional(),
    profit: z.number().min(0).max(9999999999.99).optional(),
  })
```

**Established import pattern** (from `src/app/api/reports/route.ts` line 6):
```typescript
import { VALIDATION } from "@/lib/config";
```

After adding the import to both files, replace the hardcoded literals with `VALIDATION.deals.revenueMax` / `VALIDATION.deals.profitMax` (and `VALIDATION.deals.revenueMin` / `VALIDATION.deals.profitMin` for the `.min(0)` calls, if min values are added to the deals validation object).

### Pattern 5: Default export aggregate

**What:** Line 338-357 of config.ts assembles a default export object. Current entries: `app`, `auth`, `roles`, `routes`, `roleRedirects`, `workTracker`, `kpiTargets`, `roadmap`, `dailyReport`, `coach`, `owner`, `ai`, `invites`, `theme`, `navigation`, `validation`.

**Assessment:** `VALIDATION` and `ROUTES` are already included (`routes: ROUTES`, `validation: VALIDATION`). No separate `deals` key needs to be added — the expanded sub-keys are automatically part of these existing entries. This is within Claude's discretion per CONTEXT.md; the answer is no change needed.

### Anti-Patterns to Avoid

- **Hardcoding route strings in nav entries:** Nav `href` must reference `ROUTES.student.deals`, not the bare string `"/student/deals"`. This ensures a single source of truth — if the route changes, the nav updates automatically.
- **Adding `separator: false` explicitly:** The `NavItem` type has `separator?` (optional). Omitting it is the correct pattern for no separator (D-06). Do not set it to `false`.
- **Modifying proxy.ts:** ROLE_ROUTE_ACCESS uses prefix matching; `/student/deals` is already covered by `["/student"]`. Confirmed at proxy.ts lines 12-17.
- **Modifying types.ts:** Deal type (`Row`, `Insert`, `Update`) was added in Phase 38. Confirmed at types.ts lines 662-699.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validation boundary values | Per-file hardcoded literals | `VALIDATION.deals.revenueMax` from config.ts | Single source of truth — one change propagates to all routes |
| Route strings | Bare string literals in nav | `ROUTES.student.deals` constant | Config-as-truth principle (CLAUDE.md rule #1) |

**Key insight:** This entire phase is about establishing ROUTES/VALIDATION as the single source of truth so that subsequent phases (41, 42) never need to repeat the decision about what the deals route path or revenue limit is.

---

## Common Pitfalls

### Pitfall 1: Nav href uses bare string instead of ROUTES constant

**What goes wrong:** Phase 41 or later changes a route path, but the nav item still points to the old path because it was hardcoded.
**Why it happens:** Forgetting that the convention is `href: ROUTES.student.deals`, not `href: "/student/deals"`.
**How to avoid:** Check every other nav entry — all terminal nav entries reference ROUTES constants (e.g., `ROUTES.student.resources`, `ROUTES.coach.resources`). Follow this exactly.
**Warning signs:** TypeScript won't catch this (bare string is a valid `string`). Verify by grep-checking that no nav entry uses a bare `/student/deals` string.

### Pitfall 2: VALIDATION.deals added but route handlers not updated

**What goes wrong:** Config change ships but route handlers still use hardcoded `9999999999.99` literals. The validation works correctly at runtime but config is not the source of truth — silent inconsistency.
**Why it happens:** The two files are easy to forget; they have no TypeScript dependency on VALIDATION yet.
**How to avoid:** The refactor of both deal route handlers is explicitly in scope (D-09). Both files must have `import { VALIDATION } from "@/lib/config"` added and all four hardcoded `.max(9999999999.99)` replaced.

### Pitfall 3: `as const` breakage from structural changes

**What goes wrong:** If the ROUTES or VALIDATION object is accidentally changed from `as const` to a mutable structure, downstream type inference breaks (properties become `string` instead of literal string types).
**Why it happens:** Editor auto-insertion sometimes strips type annotations.
**How to avoid:** The entire config.ts ends with `export default config` at line 357, and both named exports use `as const`. Verify after edits that `as const` remains on both `ROUTES` (line 101) and `VALIDATION` (line 333).

### Pitfall 4: Comment on line 7 of config.ts says "no deals"

**What goes wrong:** The header comment on line 5-7 of config.ts says "V1 ONLY — no leaderboard, tiers, player cards, streaks, focus mode, **deals**..." — this is now outdated.
**Why it happens:** It was written before v1.5 planning.
**How to avoid:** Update the header comment to remove "deals" from the exclusion list, or update it to reflect v1.5 additions. Small detail but leaving it creates confusion for future readers.

### Pitfall 5: Wrong insertion position in student nav

**What goes wrong:** Deals is inserted at the wrong index — e.g., after Chat instead of before it.
**Why it happens:** Off-by-one or misreading the target index.
**How to avoid:** D-03 is explicit: after Daily Report, before Chat. The current array has Daily Report at index 4 and Chat at index 5. Insert Deals between them — making Deals index 5 and Chat index 6.

---

## Code Examples

### ROUTES addition

```typescript
// Source: src/lib/config.ts — to be added [VERIFIED: codebase pattern]
student: {
  dashboard: "/student",
  workTracker: "/student/work",
  roadmap: "/student/roadmap",
  askAI: "/student/ask",
  report: "/student/report",
  deals: "/student/deals",       // ADD — Phase 40 D-01
  chat: "/student/chat",
  resources: "/student/resources",
},
student_diy: {
  dashboard: "/student_diy",
  workTracker: "/student_diy/work",
  roadmap: "/student_diy/roadmap",
  deals: "/student_diy/deals",   // ADD — Phase 40 D-01
  resources: "/student_diy/resources",
},
```

### NAVIGATION insertion — student (after Daily Report, before Chat)

```typescript
// Source: src/lib/config.ts — to be inserted at index 5 [VERIFIED: codebase pattern]
{ label: "Daily Report",  href: "/student/report",       icon: "FileText" },
{ label: "Deals",         href: ROUTES.student.deals,    icon: "DollarSign" },  // ADD — D-03/D-05
{ label: "Chat",          href: "/student/chat",         icon: "MessageSquare", badge: "unread_messages" },
```

### NAVIGATION insertion — student_diy (after Roadmap, before Resources)

```typescript
// Source: src/lib/config.ts — to be inserted at index 3 [VERIFIED: codebase pattern]
{ label: "Roadmap",      href: "/student_diy/roadmap",       icon: "Map" },
{ label: "Deals",        href: ROUTES.student_diy.deals,     icon: "DollarSign" }, // ADD — D-04/D-05
{ label: "Resources",    href: ROUTES.student_diy.resources, icon: "BookOpen" },
```

### VALIDATION.deals addition

```typescript
// Source: src/lib/config.ts — to be appended to VALIDATION object [VERIFIED: codebase pattern]
export const VALIDATION = {
  name: { min: 2, max: 100 },
  // ... existing keys ...
  starRating: { min: 1, max: 5 },
  deals: {                          // ADD — Phase 40 D-07
    revenueMin: 0,
    revenueMax: 9999999999.99,
    profitMin: 0,
    profitMax: 9999999999.99,
  },
} as const;
```

### Route handler refactor — POST /api/deals

```typescript
// Source: src/app/api/deals/route.ts — BEFORE (lines 13-16) [VERIFIED: codebase]
import { VALIDATION } from "@/lib/config";  // ADD this import

const postDealSchema = z.object({
  revenue: z.number().min(VALIDATION.deals.revenueMin).max(VALIDATION.deals.revenueMax),
  profit: z.number().min(VALIDATION.deals.profitMin).max(VALIDATION.deals.profitMax),
});
```

### Route handler refactor — PATCH /api/deals/[id]

```typescript
// Source: src/app/api/deals/[id]/route.ts — BEFORE (lines 25-32) [VERIFIED: codebase]
import { VALIDATION } from "@/lib/config";  // ADD this import

const patchDealSchema = z
  .object({
    revenue: z.number().min(VALIDATION.deals.revenueMin).max(VALIDATION.deals.revenueMax).optional(),
    profit: z.number().min(VALIDATION.deals.profitMin).max(VALIDATION.deals.profitMax).optional(),
  })
  .refine(
    (data) => data.revenue !== undefined || data.profit !== undefined,
    { message: "At least one field (revenue or profit) must be provided" }
  );
```

---

## Runtime State Inventory

Not applicable — this is a pure code/config change with no rename, migration, or stored data changes.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is pure TypeScript code editing with `npx tsc --noEmit` as the only tool required).

`npx tsc --noEmit` confirmed available and currently passes with zero errors. [VERIFIED: codebase — ran during research]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed — no jest.config, vitest.config, or test scripts in package.json |
| Config file | None |
| Quick run command | `npx tsc --noEmit` (TypeScript compile is the validation gate for this phase) |
| Full suite command | `npx tsc --noEmit && npm run lint` |

**Note:** `nyquist_validation` is enabled in .planning/config.json, but this project has no automated test framework. The TypeScript compiler (`npx tsc --noEmit`) is the project's primary code-level validation tool and is listed as a success criterion in the phase description. `npm run lint` (ESLint) is the secondary check.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEAL-06 | `ROUTES.student.deals` and `ROUTES.student_diy.deals` exist and are importable | compile | `npx tsc --noEmit` | N/A — compiler validates |
| DEAL-06 | Both student/student_diy NAVIGATION arrays include Deals entry | compile | `npx tsc --noEmit` | N/A — compiler validates |
| DEAL-06 | `VALIDATION.deals.revenueMax` and `profitMax` exist and are used by route handlers | compile | `npx tsc --noEmit` | N/A — compiler validates |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && npm run lint`
- **Phase gate:** Both commands pass before `/gsd-verify-work`

### Wave 0 Gaps

None — no test files required. TypeScript compiler and ESLint are the validation tools; both are already available.

---

## Security Domain

This phase makes no security-relevant changes:
- No authentication or session logic
- No data access or database queries
- No input handling
- Config constants and nav entries are compiled static values

ASVS V5 (Input Validation) is adjacent but not triggered: VALIDATION.deals defines the boundary values that are already enforced by the Zod schemas in Phase 39. No new validation logic is introduced here.

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to this phase:

| Directive | Relevance to Phase 40 |
|-----------|----------------------|
| Config is truth — import from `src/lib/config.ts`, never hardcode roles/nav/roadmap | Direct — this phase IS the config update; route handlers must import VALIDATION, not hardcode |
| `import { z } from "zod"` — never `"zod/v4"` | Applies to route handler files being edited |
| `ima-* tokens only` — all colors use design tokens | Not applicable (no UI code) |
| Admin client only in server code | Not applicable (no new server code) |
| Never swallow errors | Not applicable (no new error handling) |
| Check response.ok | Not applicable (no new fetch calls) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified against the live codebase. No assumed claims.**

---

## Open Questions

None. All decisions are locked in CONTEXT.md and verified against the codebase.

---

## Sources

### Primary (HIGH confidence)

- `src/lib/config.ts` [VERIFIED: codebase] — ROUTES (lines 52-101), NAVIGATION (lines 281-317), VALIDATION (lines 322-333), default export (lines 338-357)
- `src/proxy.ts` [VERIFIED: codebase] — ROLE_ROUTE_ACCESS prefix matching (lines 12-17); confirmed no changes needed
- `src/lib/types.ts` [VERIFIED: codebase] — Deal type Row/Insert/Update exists (lines 662-699); confirmed no changes needed
- `src/app/api/deals/route.ts` [VERIFIED: codebase] — hardcoded `9999999999.99` at lines 14-15
- `src/app/api/deals/[id]/route.ts` [VERIFIED: codebase] — hardcoded `9999999999.99` at lines 27-28
- `src/app/api/reports/route.ts` [VERIFIED: codebase] — established `import { VALIDATION } from "@/lib/config"` pattern (line 6)
- `npx tsc --noEmit` [VERIFIED: ran during research] — currently passes with zero errors

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure TypeScript editing, no new libraries
- Architecture: HIGH — all patterns verified directly from live codebase
- Pitfalls: HIGH — derived from inspecting actual code structures and CONTEXT.md decisions

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable — no external dependencies)
