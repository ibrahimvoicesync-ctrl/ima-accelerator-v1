# Phase 15: Outreach KPI Banner - Research

**Researched:** 2026-03-28
**Domain:** React form expansion, Supabase aggregate queries, sticky UI banner, RAG color logic
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Lifetime outreach RAG uses pace-based logic: `ratio = actual / (days_in_program × 50)`. Green >= 100%, amber >= 80%, red < 80%.
- **D-02:** Daily outreach RAG: green >= 50, amber >= 40 (80%), red < 40.
- **D-03:** Daily hours RAG: green >= 4h (100%), amber >= 3h 12m (80%), red < 3h 12m. Based on `WORK_TRACKER.dailyGoalHours`.
- **D-04:** Day-zero handling: if days_in_program < 1, suppress RAG color (neutral state). Use `max(1, days_in_program)` — if days < 1, suppress.
- **D-05:** RAG applies to: lifetime outreach (X/2,500), daily outreach (X/50), and daily hours worked (X/4h). Three KPIs get RAG.
- **D-06:** Calls joined, brands contacted, influencers contacted display as raw numbers — no RAG (no targets defined).

### Claude's Discretion
- Report form layout — grouping, field order, labels, helper text for 5 numeric outreach fields. Reuse existing react-hook-form + Input component pattern.
- Banner layout and stickiness — where ProgressBanner renders (layout-level vs per-page), scroll behavior (CSS sticky vs fixed), mobile responsiveness. Should fit dashboard layout pattern.
- Homepage KPI cards — how KPI breakdown cards integrate with the 3 existing dashboard cards. May add new cards, rearrange, or augment existing.
- Whether to keep legacy `outreach_count` column populated (as sum of brands + influencers) for backward compatibility or deprecate it.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KPI-01 | daily_reports stores granular outreach: outreach_brands, outreach_influencers, brands_contacted, influencers_contacted, calls_joined | DB columns already added by Phase 13 migration (00006_v1_1_schema.sql); types.ts needs update |
| KPI-02 | Total outreach = outreach_brands + outreach_influencers, computed at query time | PostgREST aggregate via `.select("outreach_brands.sum(), outreach_influencers.sum()")` or inline SQL expression; never JS reduce |
| KPI-03 | Daily report form collects 5 granular fields (replaces single outreach_count) | Extend ReportForm.tsx with react-hook-form; add 5 Input fields; update POST /api/reports Zod schema |
| KPI-04 | Sticky ProgressBanner on every student page shows 6 KPI values | New ProgressBanner component; student sub-layout or per-page inclusion; CSS sticky positioning |
| KPI-05 | RAG color coding on lifetime outreach, daily outreach, daily hours | Pure utility function `getRagColor(actual, target, ratio?)` using ima-* color tokens |
| KPI-06 | Student homepage shows KPI breakdown cards with RAG color coding | Augment student/page.tsx with KPI data fetch; add KPI card(s) below existing 3 cards |
</phase_requirements>

---

## Summary

Phase 15 is primarily a UI and data-plumbing phase. The database columns for all 5 granular outreach fields were already added in Phase 13 (migration 00006). The trigger `restrict_coach_report_update` was also already updated in that migration to protect all 5 new columns. No new migration is required for this phase — the schema work is done.

The work breaks into four areas: (1) expand the daily report API route and form to accept/store all 5 fields; (2) compute lifetime outreach totals using Postgres SUM aggregates (never JS reduce); (3) build the `ProgressBanner` component with RAG logic; and (4) add KPI cards to the student homepage.

The most critical architectural constraint is banner placement. Because ProgressBanner must appear on every student page, it belongs in a student-specific sub-layout (`src/app/(dashboard)/student/layout.tsx`) so it renders once and all student pages inherit it. The student dashboard already has a `page.tsx` but no `layout.tsx`, so this file needs to be created. The banner is a server component that fetches KPI data fresh on each page load.

**Primary recommendation:** Create `src/app/(dashboard)/student/layout.tsx` as a server component that fetches lifetime KPI data and renders ProgressBanner above `{children}`. This is the clean separation — banner data lives in layout, per-page data lives in each page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.71.2 (installed) | Form state for 5 new report fields | Already used in ReportForm.tsx; zero additional dependency |
| zod | ^4.3.6 (installed) | API input validation for 5 new fields | Already used in /api/reports/route.ts; import from `"zod"` not `"zod/v4"` |
| @supabase/supabase-js | ^2.99.2 (installed) | PostgREST aggregate queries for SUM | Already project standard; handles aggregate selects |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.576.0 (installed) | Icons for banner KPI items | Trend arrows, check marks if needed |
| class-variance-authority | ^0.7.1 (installed) | RAG color variant logic | If building a typed KPI indicator component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `position: sticky` | `position: fixed` | Sticky flows with document; fixed requires padding compensation on every page. Sticky is simpler. |
| Student sub-layout for banner | Per-page banner inclusion | Sub-layout is one location vs 4 pages (dashboard, work, roadmap, report). Sub-layout wins. |
| PostgREST SUM aggregate | Fetch all rows + JS reduce | JS reduce fetches unbounded rows. PostgREST SUM is a single DB-computed scalar. Always use DB aggregate. |

**Installation:** No new packages required. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/
├── app/(dashboard)/student/
│   ├── layout.tsx          # NEW — student sub-layout with ProgressBanner
│   ├── page.tsx            # MODIFY — add KPI cards
│   └── report/
│       └── page.tsx        # No change (ProgressBanner comes from layout)
├── components/student/
│   ├── ProgressBanner.tsx  # NEW — sticky KPI banner component
│   └── ReportForm.tsx      # MODIFY — add 5 outreach fields
├── app/api/reports/
│   └── route.ts            # MODIFY — add 5 fields to Zod schema + insert/update
└── lib/
    ├── kpi.ts              # NEW — RAG logic utility (getRagColor, computePace)
    └── types.ts            # MODIFY — add 5 columns to daily_reports Row/Insert/Update
```

### Pattern 1: Student Sub-Layout for ProgressBanner

**What:** Create `src/app/(dashboard)/student/layout.tsx` as an async server component. It fetches lifetime KPI aggregates and today's report data, then renders `<ProgressBanner>` above `{children}`.

**When to use:** Any feature that must appear on every page within a route group. Avoids per-page repetition.

**Example:**
```typescript
// src/app/(dashboard)/student/layout.tsx
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressBanner } from "@/components/student/ProgressBanner";
import { getTodayUTC } from "@/lib/utils";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getTodayUTC();

  // Lifetime totals — single aggregate query
  const { data: lifetime } = await admin
    .from("daily_reports")
    .select("outreach_brands.sum(), outreach_influencers.sum()")
    .eq("student_id", user.id)
    .single();

  // Today's report — for daily KPIs
  const { data: todayReport } = await admin
    .from("daily_reports")
    .select("outreach_brands, outreach_influencers, brands_contacted, influencers_contacted, calls_joined, hours_worked")
    .eq("student_id", user.id)
    .eq("date", today)
    .maybeSingle();

  // User joined_at — for pace calculation
  const { data: userRow } = await admin
    .from("users")
    .select("joined_at")
    .eq("id", user.id)
    .single();

  return (
    <>
      <ProgressBanner
        lifetimeOutreach={(lifetime?.outreach_brands ?? 0) + (lifetime?.outreach_influencers ?? 0)}
        dailyOutreach={(todayReport?.outreach_brands ?? 0) + (todayReport?.outreach_influencers ?? 0)}
        dailyMinutesWorked={Math.round((todayReport?.hours_worked ?? 0) * 60)}
        callsJoined={todayReport?.calls_joined ?? 0}
        brandsContacted={todayReport?.brands_contacted ?? 0}
        influencersContacted={todayReport?.influencers_contacted ?? 0}
        joinedAt={userRow?.joined_at ?? new Date().toISOString()}
      />
      {children}
    </>
  );
}
```

**Important:** `getTodayUTC()` must be used for all date logic in server components, per STATE.md accumulated context.

### Pattern 2: PostgREST Aggregate for Lifetime Outreach

**What:** Use PostgREST column aggregate syntax to compute SUM at DB level.

**When to use:** Any lifetime/total metric across many rows. Never fetch all rows and sum in JavaScript.

```typescript
// Correct — single DB-computed aggregate
const { data } = await admin
  .from("daily_reports")
  .select("outreach_brands.sum(), outreach_influencers.sum()")
  .eq("student_id", userId)
  .single();

// The result shape is: { outreach_brands: number | null, outreach_influencers: number | null }
// Use ?? 0 to guard against null (no reports yet)
const lifetimeTotal = (data?.outreach_brands ?? 0) + (data?.outreach_influencers ?? 0);
```

**Note on PostgREST aggregate syntax:** `.select("column.sum()")` is the PostgREST v12+ aggregate syntax supported by `@supabase/supabase-js` v2. This produces a `SELECT SUM(outreach_brands) FROM daily_reports WHERE student_id = ...` under the hood. The returned column name remains the original column name.

### Pattern 3: RAG Color Utility

**What:** Pure TypeScript function mapping actual/target ratios to ima-* color token class names.

**When to use:** Every KPI indicator. Lives in `src/lib/kpi.ts`, imported by ProgressBanner and homepage KPI cards.

```typescript
// src/lib/kpi.ts
import { KPI_TARGETS, WORK_TRACKER } from "@/lib/config";

export type RagStatus = "green" | "amber" | "red" | "neutral";

/**
 * Returns RAG status for a given ratio (actual/target).
 * Returns "neutral" for day-zero (daysInProgram < 1).
 */
export function getRagStatus(ratio: number, daysInProgram: number): RagStatus {
  if (daysInProgram < 1) return "neutral";
  if (ratio >= 1.0) return "green";
  if (ratio >= 0.8) return "amber";
  return "red";
}

/** RAG for lifetime outreach: pace-based ratio */
export function lifetimeOutreachRag(actual: number, daysInProgram: number): RagStatus {
  const target = Math.max(1, daysInProgram) * KPI_TARGETS.dailyOutreach;
  return getRagStatus(actual / target, daysInProgram);
}

/** RAG for daily outreach */
export function dailyOutreachRag(actual: number, daysInProgram: number): RagStatus {
  return getRagStatus(actual / KPI_TARGETS.dailyOutreach, daysInProgram);
}

/** RAG for daily hours worked (passed as minutes) */
export function dailyHoursRag(minutesWorked: number, daysInProgram: number): RagStatus {
  const goalMinutes = WORK_TRACKER.dailyGoalHours * 60;
  return getRagStatus(minutesWorked / goalMinutes, daysInProgram);
}

/** Maps RagStatus to Tailwind ima-* token class */
export function ragToColorClass(status: RagStatus): string {
  switch (status) {
    case "green":  return "text-ima-success";
    case "amber":  return "text-ima-warning";
    case "red":    return "text-ima-error";
    default:       return "text-ima-text-secondary";
  }
}

/** Maps RagStatus to background class for indicator dot */
export function ragToBgClass(status: RagStatus): string {
  switch (status) {
    case "green":  return "bg-ima-success";
    case "amber":  return "bg-ima-warning";
    case "red":    return "bg-ima-error";
    default:       return "bg-ima-text-muted";
  }
}

/** Days in program from joined_at date (UTC) */
export function daysInProgram(joinedAt: string): number {
  const joined = new Date(joinedAt).getTime();
  const now = new Date().getTime();
  return Math.floor((now - joined) / (1000 * 60 * 60 * 24));
}
```

### Pattern 4: Expanded ReportForm (5 Outreach Fields)

**What:** Add 5 numeric fields to the existing react-hook-form in ReportForm.tsx, replacing single `outreach_count`.

**Key changes:**
- `ReportFormData` type: replace `outreach_count: number` with 5 typed fields
- `defaultValues`: populate from `existingReport` using 5 new columns
- POST body: send 5 new fields instead of `outreach_count`
- Keep `outreach_count` in the POST body as `outreach_brands + outreach_influencers` for backward compatibility (Claude's discretion choice — keeps legacy column consistent)

```typescript
// New form data type
interface ReportFormData {
  star_rating: number;
  outreach_brands: number;
  outreach_influencers: number;
  brands_contacted: number;
  influencers_contacted: number;
  calls_joined: number;
  wins?: string;
  improvements?: string;
}
```

**Field grouping recommendation:** Group the 5 outreach fields under a single `<fieldset>` with a legend "Outreach Today". Within it, use a 2-column grid for pairs (`outreach_brands` / `outreach_influencers`, `brands_contacted` / `influencers_contacted`) and `calls_joined` full-width. Each field reuses `<Input type="number" min={0} max={...} label="..." />`.

### Pattern 5: ProgressBanner Component

**What:** Client-or-server component. Since data is fetched in the parent layout (server component), ProgressBanner itself can be a pure presentational component with no internal data fetching.

**Stickiness:** Use CSS `sticky top-0 z-10` inside `<main>`. The dashboard layout renders `<main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">`. ProgressBanner inside this `<main>` with `sticky top-0` sticks to the top of the scrollable viewport while keeping sidebar unaffected.

**Layout recommendation:** Horizontal scrollable row on mobile (`overflow-x-auto`), wrapping grid on desktop (`flex flex-wrap`). Each KPI item: label + value + RAG color dot.

```typescript
// src/components/student/ProgressBanner.tsx — presentational server component
import { cn } from "@/lib/utils";
import { formatHoursMinutes } from "@/lib/utils";
import { KPI_TARGETS, WORK_TRACKER } from "@/lib/config";
import {
  lifetimeOutreachRag,
  dailyOutreachRag,
  dailyHoursRag,
  ragToColorClass,
  ragToBgClass,
  daysInProgram,
} from "@/lib/kpi";

// Props passed from student layout
interface ProgressBannerProps {
  lifetimeOutreach: number;
  dailyOutreach: number;
  dailyMinutesWorked: number;
  callsJoined: number;
  brandsContacted: number;
  influencersContacted: number;
  joinedAt: string;
}
```

**ARIA:** Banner should have `role="region" aria-label="KPI summary"`. Each KPI value with RAG uses `aria-label` describing the value and status.

### Anti-Patterns to Avoid

- **JS reduce for lifetime totals:** Never `reports.reduce((sum, r) => sum + r.outreach_brands, 0)`. Use PostgREST `.sum()` aggregate.
- **Hardcoding RAG thresholds inline:** Never put `>= 0.8` magic numbers in components. All thresholds come from `KPI_TARGETS` and `WORK_TRACKER` in config via the `kpi.ts` utility.
- **Fixed positioning for banner:** `position: fixed` requires padding compensation on every page. `sticky top-0` inside the scrollable main is cleaner.
- **Skipping day-zero neutral state:** Without the `daysInProgram < 1` guard, a student who just joined sees red KPIs immediately. D-04 requires neutral until 1 full day.
- **Importing admin client in ProgressBanner:** ProgressBanner is a presentational component; all data comes from props via the server layout. Never import admin client in any component that isn't a page/layout/route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lifetime outreach SUM | Fetch all rows + JS `.reduce()` | PostgREST `.sum()` aggregate | Row count grows unbounded; single DB query is constant time |
| RAG threshold logic | Per-component if/else | `src/lib/kpi.ts` utility | Ensures homepage cards and banner use identical thresholds |
| Days in program calculation | Ad-hoc date math | `daysInProgram()` in `kpi.ts` | One place to update; eliminates timezone bugs |
| Number input validation | Custom regex | Zod `z.number().int().min().max()` with `VALIDATION` bounds from config | Already established pattern; handles coercion |

**Key insight:** All data aggregation belongs in the DB layer. All threshold logic belongs in `kpi.ts`. Components are dumb display — they receive computed values and render.

## Common Pitfalls

### Pitfall 1: types.ts Not Updated for New Columns

**What goes wrong:** TypeScript infers `outreach_brands` does not exist on `DailyReport` Row type, causing compile errors throughout the app.

**Why it happens:** `src/lib/types.ts` is a hand-maintained type file. Phase 13 added the columns to the DB but types.ts was not regenerated (Supabase local isn't running in this project).

**How to avoid:** Update `types.ts` manually — add `outreach_brands: number`, `outreach_influencers: number`, `brands_contacted: number`, `influencers_contacted: number`, `calls_joined: number` to `daily_reports.Row`, `Insert`, and `Update` shapes. This is Wave 0 work.

**Warning signs:** `Property 'outreach_brands' does not exist on type` TypeScript errors.

### Pitfall 2: PostgREST Aggregate Returns null for Empty Result

**What goes wrong:** A student with zero reports gets `null` from `.sum()` aggregate, and `null + null` evaluates to `NaN` in JavaScript.

**Why it happens:** PostgreSQL SUM of zero rows returns NULL, and PostgREST passes this through.

**How to avoid:** Always guard with `?? 0`: `(data?.outreach_brands ?? 0) + (data?.outreach_influencers ?? 0)`.

### Pitfall 3: Banner Causes Layout Shift on Mobile

**What goes wrong:** Adding `sticky top-0` to ProgressBanner inside `<main>` with `pt-16` (mobile top padding for the fixed sidebar hamburger) causes double-offset visual issues.

**Why it happens:** On mobile, the dashboard layout renders `<main className="pt-16">` to clear the fixed top Sidebar. Adding a sticky banner inside that element sticks to the first scroll position.

**How to avoid:** Wrap ProgressBanner in `<div className="sticky top-0 z-10 bg-ima-bg">` — this sticks to the top of the viewport scroll within the main element. On mobile, since `pt-16` is on `<main>`, the sticky will appear just below the nav. Test on 375px viewport.

### Pitfall 4: outreach_count Legacy Column Divergence

**What goes wrong:** Old reports have `outreach_count` set, new reports have it at 0 (default). Code reading `outreach_count` for old compatibility shows stale data.

**Why it happens:** Phase 13 added the 5 granular columns but did not deprecate `outreach_count`. The API route still writes only to `outreach_count`.

**How to avoid:** After updating the API route, also write `outreach_count = outreach_brands + outreach_influencers` in both INSERT and UPDATE paths. This keeps the legacy column consistent for Phase 16 (coach view) which may still read it.

### Pitfall 5: Student Sub-Layout Conflicts with Dashboard Layout

**What goes wrong:** Adding `src/app/(dashboard)/student/layout.tsx` adds a new data-fetching layer. If it also calls `requireRole`, it duplicates the auth check already in the dashboard layout.

**Why it happens:** Both layouts are in the same route group and both would fetch the user profile.

**How to avoid:** The student layout calls `requireRole("student")` for its own data fetching. This is acceptable — Next.js 16 server component rendering deduplicates identical `fetch` calls within the same render tree via React's built-in request deduplication. The Supabase admin client calls are not cached by React, so the student layout should make a single combined query for all banner data.

### Pitfall 6: RAG on Day-Zero Shows Red Immediately

**What goes wrong:** A student who just joined has 0 outreach / (0 days × 50) = 0/0 = NaN or they're divided by 0.

**Why it happens:** `daysInProgram()` returns 0 on the first day.

**How to avoid:** Per D-04, if `daysInProgram < 1`, return `"neutral"` from `getRagStatus` before any division. In `lifetimeOutreachRag`, use `Math.max(1, daysInProgram)` only for the denominator computation, but still check `daysInProgram < 1` for neutral first.

### Pitfall 7: zod ^4 Import Syntax

**What goes wrong:** Using `import { z } from "zod/v4"` causes runtime module resolution failure.

**Why it happens:** CLAUDE.md hard rule and installed zod 4.3.6 exports from the root package path.

**How to avoid:** Always `import { z } from "zod"`. The installed package.json exports make the root import work correctly for v4.

## Code Examples

Verified patterns from existing codebase:

### Existing admin client pattern (from /api/reports/route.ts)
```typescript
// Auth check → role check → validate → admin query
const supabase = await createClient();
const { data: { user: authUser } } = await supabase.auth.getUser();
if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const admin = createAdminClient();
const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", authUser.id).single();
if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
if (profile.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
```

### Existing Zod schema extension pattern
```typescript
// Current schema to extend:
const postSchema = z.object({
  date: z.string().refine(isValidDateString, "Invalid date format (YYYY-MM-DD)"),
  hours_worked: z.number().min(0).max(24),
  star_rating: z.number().int().min(VALIDATION.starRating.min).max(VALIDATION.starRating.max),
  outreach_count: z.number().int().min(VALIDATION.outreachCount.min).max(VALIDATION.outreachCount.max),
  wins: z.string().max(VALIDATION.reportWins.max).optional(),
  improvements: z.string().max(VALIDATION.reportImprovements.max).optional(),
});

// Phase 15 extended schema (replace outreach_count with 5 fields):
const postSchema = z.object({
  date: z.string().refine(isValidDateString, "Invalid date format (YYYY-MM-DD)"),
  hours_worked: z.number().min(0).max(24),
  star_rating: z.number().int().min(VALIDATION.starRating.min).max(VALIDATION.starRating.max),
  outreach_brands: z.number().int().min(VALIDATION.outreachBrands.min).max(VALIDATION.outreachBrands.max),
  outreach_influencers: z.number().int().min(VALIDATION.outreachInfluencers.min).max(VALIDATION.outreachInfluencers.max),
  brands_contacted: z.number().int().min(VALIDATION.brandsContacted.min).max(VALIDATION.brandsContacted.max),
  influencers_contacted: z.number().int().min(VALIDATION.influencersContacted.min).max(VALIDATION.influencersContacted.max),
  calls_joined: z.number().int().min(VALIDATION.callsJoined.min).max(VALIDATION.callsJoined.max),
  wins: z.string().max(VALIDATION.reportWins.max).optional(),
  improvements: z.string().max(VALIDATION.reportImprovements.max).optional(),
});
```

### Existing progress bar pattern (from student/page.tsx)
```tsx
// Reuse this pattern for RAG-colored bars in KPI cards
<div
  className="bg-ima-bg rounded-full h-3 mt-4 overflow-hidden"
  role="progressbar"
  aria-valuenow={actual}
  aria-valuemin={0}
  aria-valuemax={target}
  aria-label={`KPI: ${actual} of ${target}`}
>
  <div
    className={cn("h-full rounded-full motion-safe:transition-all duration-500", ragToBgClass(status))}
    style={{ width: `${Math.min(100, progressPercent)}%` }}
  />
</div>
```

### DAILY_REPORT config update required
```typescript
// config.ts — DAILY_REPORT.fields must be updated
fields: {
  starRating: { label: "Rate your day", required: true },
  // Replace single outreachCount with 5 granular fields:
  outreachBrands: { label: "Outreach to brands", required: true },
  outreachInfluencers: { label: "Outreach to influencers", required: true },
  brandsContacted: { label: "Brands contacted", required: true },
  influencersContacted: { label: "Influencers contacted", required: true },
  callsJoined: { label: "Calls joined", required: true },
  wins: { label: "What went well today?", required: false, maxLength: 500 },
  improvements: { label: "What could you improve tomorrow?", required: false, maxLength: 500 },
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `outreach_count` field | 5 granular outreach fields | Phase 13 DB prep, Phase 15 UI | Form expands from 1 to 5 outreach inputs |
| No KPI visibility on student pages | Sticky ProgressBanner on all student pages | Phase 15 | Students see live progress on every page |
| No RAG coding anywhere | RAG on 3 KPIs (lifetime outreach, daily outreach, hours) | Phase 15 | First use of color-coded status indicators |

**Schema already migrated:**
- 5 KPI columns (`outreach_brands`, `outreach_influencers`, `brands_contacted`, `influencers_contacted`, `calls_joined`) exist in `daily_reports` with `NOT NULL DEFAULT 0`.
- `restrict_coach_report_update` trigger already protects all 5 columns.
- No new migration needed for Phase 15.

## Open Questions

1. **PostgREST aggregate query result shape**
   - What we know: PostgREST v12 supports `.select("column.sum()")` syntax returning the original column name
   - What's unclear: Whether `@supabase/supabase-js` v2 TypeScript types correctly type the aggregated result or whether a cast is needed
   - Recommendation: Add explicit type assertion `as { outreach_brands: number | null; outreach_influencers: number | null }` on the aggregate result to satisfy TypeScript. Test with a single query in Wave 0.

2. **outreach_count backward compatibility**
   - What we know: D-06 from CONTEXT.md leaves it to Claude's discretion. Phase 16 (coach views) likely reads report data and may reference `outreach_count`.
   - What's unclear: Whether Phase 16 will use `outreach_count` or compute its own total from granular columns.
   - Recommendation: Keep `outreach_count` populated as `outreach_brands + outreach_influencers` in the API route for now. This is one additional line in INSERT/UPDATE. Phase 16 can deprecate it then.

3. **ReportFormWrapper pattern**
   - What we know: `ReportFormWrapper` exists at `src/components/student/ReportFormWrapper.tsx` and is used by the report page to load the existing report server-side and pass it down.
   - What's unclear: Full contents of ReportFormWrapper not read during research.
   - Recommendation: Read ReportFormWrapper before implementing. The form prop interface `DailyReport` type will need to include the 5 new columns once `types.ts` is updated.

## Environment Availability

Step 2.6: Skipped — Phase 15 is purely code changes with no external dependencies beyond the project's existing stack. No new tools, services, databases, or CLI utilities are required. All dependencies are already installed.

## Validation Architecture

nyquist_validation is enabled (`.planning/config.json`).

### Test Framework

No test framework is installed in this project. `package.json` has no `test` script, no `jest`, `vitest`, or `playwright` devDependencies, and no test directories exist.

| Property | Value |
|----------|-------|
| Framework | None installed |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| KPI-01 | 5 columns exist in DB and API accepts them | smoke | `npm run build` | Type errors surface during build if types.ts missing new columns |
| KPI-02 | Lifetime outreach = SUM(outreach_brands + outreach_influencers) | manual | Open /student in browser, verify banner lifetime count | PostgREST aggregate correctness verified by browser inspection |
| KPI-03 | Form submits 5 fields, POST /api/reports stores all 5 | smoke + manual | `npx tsc --noEmit` (type check) + manual form submit | TypeScript catches mismatched field names at build time |
| KPI-04 | Banner appears on all 4 student pages | manual | Visit /student, /student/work, /student/roadmap, /student/report | Sub-layout pattern ensures coverage automatically |
| KPI-05 | RAG color coding logic correct | unit (no framework) | `npx tsc --noEmit` on kpi.ts | Pure function — logic verifiable by code review; manual for visual |
| KPI-06 | KPI cards on homepage with correct RAG | manual | Open /student in browser | Visual verification of card colors |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** `npm run build && npx tsc --noEmit && npm run lint` all pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/types.ts` — add 5 new columns to `daily_reports.Row`, `Insert`, `Update` (required before any other code compiles)
- [ ] `src/lib/kpi.ts` — create RAG utility file (required before ProgressBanner and KPI cards)

*(No test framework install needed — this project uses TypeScript build verification as its primary automated gate)*

## Project Constraints (from CLAUDE.md)

All directives enforced during this phase:

| Directive | Impact on Phase 15 |
|-----------|-------------------|
| `motion-safe:` prefix on all `animate-*` | Any animated progress bars in banner use `motion-safe:transition-all` |
| 44px touch targets | All interactive elements in form use `min-h-[44px]`; banner is display-only |
| Accessible labels | All 5 new Input fields need `label` prop; banner needs `role="region" aria-label` |
| Admin client in API routes only | ProgressBanner data fetched in student layout (server component) is fine; never import admin in client components |
| Never swallow errors | All `catch` blocks in ReportForm toast or `console.error`; layout errors `console.error` and degrade gracefully |
| Check response.ok | `fetch("/api/reports")` in ReportForm already checks `res.ok`; maintain this |
| `import { z } from "zod"` | API route uses this correctly already; maintain for new schema fields |
| ima-* tokens only | RAG colors: `text-ima-success`, `text-ima-warning`, `text-ima-error`; banner background `bg-ima-bg` or `bg-ima-surface` |
| `px-4` on page wrappers | Banner is not a page wrapper; this directive applies to page `<div>` containers |
| Stable useCallback deps | ReportForm uses `toast` from hook; maintain ref pattern if needed |
| Config is truth | KPI_TARGETS and VALIDATION bounds come from config; never hardcode 2500, 50, 0.8 |
| Admin client only in server code | Student layout and report page are server components — correct placement |
| Proxy not middleware | No routing changes; not applicable |
| Google OAuth only | Not applicable |
| Light theme with blue accents | Banner background should use `bg-ima-surface` with `border-b border-ima-border` |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all findings based on reading actual source files
- `src/lib/config.ts` — KPI_TARGETS, VALIDATION, WORK_TRACKER, DAILY_REPORT confirmed
- `supabase/migrations/00006_v1_1_schema.sql` — confirmed 5 columns added and trigger updated
- `src/lib/types.ts` — confirmed types.ts lacks the 5 new columns (needs manual update)
- `src/components/student/ReportForm.tsx` — confirmed single outreach_count field exists
- `src/app/api/reports/route.ts` — confirmed Zod schema uses outreach_count only
- `src/app/(dashboard)/student/page.tsx` — confirmed no student sub-layout exists yet
- `src/app/(dashboard)/layout.tsx` — confirmed layout has role data and wraps all dashboard pages
- `package.json` — confirmed installed versions: react-hook-form 7.71.2, zod 4.3.6, next 16.1.6

### Secondary (MEDIUM confidence)
- PostgREST `.select("column.sum()")` aggregate syntax — documented in Supabase docs; consistent with `@supabase/supabase-js` v2 aggregate support
- CSS `sticky top-0` behavior in Next.js App Router layout — standard CSS behavior; well-established pattern

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; versions confirmed from package.json
- Architecture: HIGH — based on direct reading of existing codebase patterns
- Pitfalls: HIGH — derived from reading actual code that will be changed and STATE.md accumulated notes
- DB schema: HIGH — migration 00006 confirms exact column names and types
- PostgREST aggregate: MEDIUM — documented capability, not verified by running query against live DB

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack; only risk is PostgREST aggregate type shape which is LOW risk)
