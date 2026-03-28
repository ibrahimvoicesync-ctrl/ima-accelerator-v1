# Phase 16: Coach/Owner KPI Visibility - Research

**Researched:** 2026-03-28
**Domain:** Next.js App Router server components, Supabase admin queries, React component reuse (KPI/RAG display)
**Confidence:** HIGH

## Summary

Phase 16 is a read-only visibility layer. Coaches and owners need to see each student's KPI progress (lifetime outreach, daily outreach, hours worked, RAG status) and their current roadmap step on the student detail pages. All KPI logic already exists in `src/lib/kpi.ts` from Phase 15 — this phase is about wiring that logic into the two coach/owner server pages and rendering a new `StudentKpiSummary` component.

The main work is: (1) extending the `Promise.all` in both server pages to include KPI aggregation queries, (2) passing computed KPI data through the existing client component props interface, and (3) building a new read-only `StudentKpiSummary` component using the `KpiItem` pattern from `ProgressBanner`. A config change is also required: `ROADMAP_STEPS` in `config.ts` currently has 10 steps but the actual program has 15 steps across 3 named stages — the config must be updated with the full 15-step structure and stage names before the roadmap-step display (D-05, D-06) will work correctly.

The data query pattern is already proven by the student sub-layout: fetch all reports for lifetime outreach (summed in JS from `brands_contacted + influencers_contacted`), fetch today's report for daily outreach, and sum completed `work_sessions.duration_minutes` for today's hours. Both coach and owner server pages use `createAdminClient()` so no auth changes are needed — just add KPI queries to the existing `Promise.all` with a `student_id` filter.

**Primary recommendation:** Build one new `StudentKpiSummary` component in `src/components/shared/` (or `src/components/student/`) that accepts computed KPI scalars and `joined_at`, renders the 3 RAG-coded KPI items plus the roadmap step string, and is placed below the student header in both detail pages. Reuse `KpiItem` from ProgressBanner directly or extract it to a shared location. Compute all KPI values server-side in the page file and pass as props.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Real-time data — same approach as the student's ProgressBanner. Hours come from work_sessions sum (not the report's hours_worked field), outreach from daily_reports aggregation. Coach/owner sees live progress even before the student submits today's report.

**D-02:** Query strategy mirrors student view: lifetime outreach via Postgres SUM over daily_reports, daily outreach from today's report, daily hours from today's work_sessions. Use `createAdminClient()` with student_id filter.

**D-03:** Same RAG thresholds and colors as student view (carried from Phase 15 D-01 through D-06). Reuse `kpi.ts` functions directly — no separate logic for coach/owner.

**D-04:** Day-zero neutral state applies here too (Phase 15 D-04).

**D-05:** KPI card shows current roadmap step in "Stage + step name" format: e.g., "Stage 2: Influencer Outreach — Step 9: Get First Reply". No fraction or progress bar.

**D-06:** The actual roadmap is 15 steps across 3 stages:
- Stage 1 (Setup & Preparation): Steps 1-7, day-based deadlines (day 0-4)
- Stage 2 (Influencer Outreach): Steps 8-11, no deadlines
- Stage 3 (Brand Outreach): Steps 12-15, no deadlines
Stage names and step-to-stage mapping must be in config.ts for the display to work.

### Claude's Discretion

- KPI card placement — where the summary appears on coach/owner student detail pages (above tabs, in header area, etc.). Should be always-visible without needing to switch tabs.
- Component approach — whether to reuse `ProgressBanner` directly, create a compact variant, or build a new `StudentKpiSummary` component. The student's ProgressBanner is sticky full-width with 6 KPI items; coach/owner context may warrant a different layout.
- Query integration — how to add KPI data fetching to the existing `Promise.all` in both server pages without duplicating logic.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Coach student detail page shows read-only KPI summary (lifetime outreach/2,500, daily/50, hours, RAG status) | Coach server page at `src/app/(dashboard)/coach/students/[studentId]/page.tsx` already has `Promise.all` structure; add 3 KPI queries, compute values, pass to `StudentDetailClient` as new props |
| VIS-02 | Owner student detail page shows same read-only KPI summary | Owner server page at `src/app/(dashboard)/owner/students/[studentId]/page.tsx` has identical structure; same query extension approach |
| VIS-03 | KPI card includes current roadmap step for context | Both pages already fetch `roadmap_progress`; derive active step from existing `roadmap` data; requires `ROADMAP_STEPS` config update to 15 steps with stage names for D-05/D-06 display |
| VIS-04 | Coach and owner see same RAG status colors as the student | Reuse `ragToColorClass`, `ragToBgClass`, `lifetimeOutreachRag`, `dailyOutreachRag`, `dailyHoursRag` from `src/lib/kpi.ts` — identical functions, identical output |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 | Server component data fetching | Project standard; all pages are async server components |
| Supabase Admin Client | @supabase/supabase-js ^2.99.2 | KPI queries with student_id filter | Pattern established in Phases 13-15; admin client required for cross-user reads |
| TypeScript strict | ^5 | Props interface for KPI data | Project enforces strict mode |
| Tailwind CSS 4 with ima-* tokens | ^4 | Component styling | All styling uses ima-* design tokens exclusively |
| CVA (class-variance-authority) | ^0.7.1 | Component variants if needed | Used in ui/ primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/kpi.ts` | internal | RAG calculations | All RAG status computation must go through these functions |
| `src/lib/utils.ts` (`formatHoursMinutes`) | internal | Hours display formatting | Use for hours worked display |
| `src/components/ui/Card.tsx` | internal | KPI card wrapper | Card + CardContent pattern for the summary card |
| `src/components/student/ProgressBanner.tsx` (`KpiItem`) | internal | KPI item subcomponent pattern | Either reuse directly or replicate pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `StudentKpiSummary` component | Reuse `ProgressBanner` directly | ProgressBanner is sticky + full-width + 6 items — wrong layout for the coach/owner context which needs a card, not a banner |
| JS reduce for lifetime outreach | PostgREST aggregate | Both patterns exist in project; student layout uses JS reduce (`brands_contacted + influencers_contacted` for all rows) — acceptable at student scale; use same approach for consistency |

**Installation:** No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. New files:

```
src/
├── components/
│   └── student/
│       └── StudentKpiSummary.tsx   # New read-only KPI card (server-renderable pure component)
├── app/(dashboard)/
│   ├── coach/students/[studentId]/
│   │   └── page.tsx                # Add KPI queries to Promise.all
│   └── owner/students/[studentId]/
│       └── page.tsx                # Add KPI queries to Promise.all
├── components/
│   ├── coach/
│   │   └── StudentDetailClient.tsx # Add kpiSummary prop to interface
│   └── owner/
│       └── OwnerStudentDetailClient.tsx  # Add kpiSummary prop to interface
└── lib/
    └── config.ts                   # Update ROADMAP_STEPS to 15 steps with stage names
```

### Pattern 1: KPI Data Fetching in Server Page

**What:** Extend the existing `Promise.all` in both server pages with 3 additional queries for lifetime outreach, today's report, and today's work sessions. Compute RAG values server-side. Pass a typed `kpiData` prop to the client component.

**When to use:** Matches established project pattern — server components own all data fetching, client components own interaction state.

**Example (coach page extension):**
```typescript
// In coach/students/[studentId]/page.tsx
// Add to existing Promise.all:
const [sessionsResult, roadmapResult, reportsResult, lifetimeReportsResult, todayReportResult, todaySessionsResult] = await Promise.all([
  // ... existing queries ...
  admin
    .from("daily_reports")
    .select("brands_contacted, influencers_contacted")
    .eq("student_id", student.id),
  admin
    .from("daily_reports")
    .select("brands_contacted, influencers_contacted")
    .eq("student_id", student.id)
    .eq("date", getTodayUTC())
    .maybeSingle(),
  admin
    .from("work_sessions")
    .select("duration_minutes, status")
    .eq("student_id", student.id)
    .eq("date", getTodayUTC()),
]);

// Compute KPI values server-side
const allReports = lifetimeReportsResult.data ?? [];
const lifetimeOutreach = allReports.reduce(
  (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
  0,
);
const todayReport = todayReportResult.data;
const dailyOutreach = (todayReport?.brands_contacted ?? 0) + (todayReport?.influencers_contacted ?? 0);
const dailyMinutesWorked = (todaySessionsResult.data ?? [])
  .filter((s) => s.status === "completed")
  .reduce((sum, s) => sum + s.duration_minutes, 0);
```

### Pattern 2: StudentKpiSummary Component

**What:** A pure presentational component that accepts computed KPI scalars and renders a Card with 3 RAG-coded KPI rows plus the current roadmap step. No fetching, no state.

**When to use:** Placed between StudentHeader and StudentDetailTabs in both coach and owner client components — always visible regardless of active tab.

**Props interface:**
```typescript
interface StudentKpiSummaryProps {
  lifetimeOutreach: number;
  dailyOutreach: number;
  dailyMinutesWorked: number;
  joinedAt: string;
  currentStepNumber: number | null;  // null if no active step
}
```

**Roadmap step display (D-05, D-06):**
```typescript
// Derive stage from step number using updated config
function getStepDisplay(stepNumber: number | null): string {
  if (stepNumber === null) return "No active step";
  const step = ROADMAP_STEPS.find(s => s.step === stepNumber);
  if (!step) return `Step ${stepNumber}`;
  return `${step.stageName}: ${step.title}`;
  // e.g., "Stage 2: Influencer Outreach — Step 9: Get First Reply"
}
```

### Pattern 3: ROADMAP_STEPS Config Update

**What:** `config.ts` currently has 10 steps. D-06 requires 15 steps across 3 named stages. The config must be updated before the stage+step display string can be rendered.

**When to use:** Required before implementing VIS-03. Both client and server code will derive stage names from config.

**New shape for each step:**
```typescript
{
  step: number;           // 1-15
  stage: number;          // 1, 2, or 3
  stageName: string;      // "Setup & Preparation" | "Influencer Outreach" | "Brand Outreach"
  title: string;          // Step name
  description: string;
  target_days: number | null;  // null for stages 2-3 (no deadlines per D-06)
  autoComplete?: boolean;
}
```

**Stage mapping:**
- Stage 1 "Setup & Preparation": Steps 1-7
- Stage 2 "Influencer Outreach": Steps 8-11
- Stage 3 "Brand Outreach": Steps 12-15

### Pattern 4: Current Step Derivation

**What:** Both server pages already fetch `roadmap_progress` (step_number, status). The active step is the row with `status === "active"`. If no active row, check for the last completed step or show "Not started".

**Example:**
```typescript
// roadmap is already fetched in both pages
const activeStep = roadmap.find(r => r.status === "active");
const currentStepNumber = activeStep?.step_number ?? null;
```

This means NO additional DB query is needed for the roadmap step — it comes from data already fetched.

### Anti-Patterns to Avoid

- **Separate KPI query function:** Don't build a `fetchStudentKpi(studentId)` helper that runs its own Supabase queries. Keep fetches inline in the server page's `Promise.all` to preserve parallelism.
- **Client-side KPI computation:** Don't pass raw report arrays to the client component and compute RAG there. Compute server-side and pass scalars only — keeps client components lean.
- **Reusing ProgressBanner directly:** ProgressBanner is sticky (`sticky top-0 z-10`), full-width, and has 6 items. Coach/owner context needs a card layout that stays in document flow. Build `StudentKpiSummary` instead.
- **Hardcoding stage names:** Stage names must come from `ROADMAP_STEPS` in config.ts (Config is truth — Rule #1 in CLAUDE.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RAG status calculation | Custom threshold logic | `lifetimeOutreachRag`, `dailyOutreachRag`, `dailyHoursRag` from `kpi.ts` | Thresholds are locked decisions (D-01 to D-03 from Phase 15); diverging creates inconsistency |
| RAG color CSS classes | Hardcoded color strings | `ragToColorClass`, `ragToBgClass` from `kpi.ts` | Ensures coach/owner sees identical colors to student (VIS-04) |
| Hours formatting | Custom `toFixed` or manual string concat | `formatHoursMinutes()` from `src/lib/utils.ts` | Already handles edge cases (0 minutes, sub-hour) |
| Day-zero detection | Custom date math | `daysInProgram()` from `kpi.ts` | Handles UTC normalization; neutral state for day-zero (D-04) |
| KPI item layout | Custom div/span structure | `KpiItem` subcomponent from ProgressBanner (or replicate pattern) | Established RAG dot + label + value pattern |

**Key insight:** This phase assembles existing pieces — kpi.ts, ProgressBanner's KpiItem pattern, existing server page queries, and existing props interfaces. The only new code is the `StudentKpiSummary` component and the config extension.

## Common Pitfalls

### Pitfall 1: Forgetting to update `ROADMAP_STEPS` config before VIS-03

**What goes wrong:** The KPI summary renders "Step 8" instead of "Stage 2: Influencer Outreach — Step 8: ..." because the current config only has 10 steps with no stage fields.
**Why it happens:** Config update (D-06) is a prerequisite to the display string, but it's easy to implement the component first and leave the config for later.
**How to avoid:** Update `ROADMAP_STEPS` in `config.ts` as the very first task (Wave 0 / Plan 1).
**Warning signs:** Step numbers 8-15 either missing or showing "Step N" without stage name in rendered output.

### Pitfall 2: Type mismatch on daily_reports select

**What goes wrong:** TypeScript error because the server page currently selects `outreach_count` in the reports query, but KPI queries need `brands_contacted` and `influencers_contacted`.
**Why it happens:** The existing `reportsResult` query uses a different field set than the new KPI queries. They must be separate queries.
**How to avoid:** Add TWO new queries to `Promise.all` — one for lifetime (all reports, `brands_contacted, influencers_contacted`) and one for today's report — rather than modifying the existing reports query which serves the ReportsTab.
**Warning signs:** TypeScript complaining about missing fields or `undefined` on `brands_contacted`.

### Pitfall 3: Passing raw arrays to client components

**What goes wrong:** Client component re-derives KPI values in a `useMemo`, causing hydration mismatch if server and client compute differently, and bloating the client bundle with `kpi.ts` imports.
**Why it happens:** Temptation to pass `allReports: Report[]` and `todaySessions: Session[]` and compute in the client.
**How to avoid:** Always compute `lifetimeOutreach`, `dailyOutreach`, and `dailyMinutesWorked` as plain numbers in the server page. Pass only scalars to client components.
**Warning signs:** `kpi.ts` imported in a client component; `"use client"` in a file that imports from `kpi.ts`.

### Pitfall 4: Date mismatch for today's queries

**What goes wrong:** Today's outreach or hours return 0 because the date comparison uses local time while the DB stores UTC dates.
**Why it happens:** Using `new Date().toISOString().split("T")[0]` (UTC) vs `getToday()` which uses local time. The student layout already uses `getTodayUTC()` — use that.
**How to avoid:** Use `getTodayUTC()` from `src/lib/utils.ts` for all `.eq("date", today)` queries. Verify `getTodayUTC()` exists — the student layout imports it.
**Warning signs:** KPI shows 0 for daily values when the student has clearly logged sessions/reports today.

### Pitfall 5: Missing error logging for new KPI queries

**What goes wrong:** KPI queries silently fail; coach sees 0/0/0 with no indication of the error.
**Why it happens:** Adding new queries to `Promise.all` without adding the corresponding `if (result.error) console.error(...)` block.
**How to avoid:** For each new query result added to `Promise.all`, add the error check. This is a Hard Rule in CLAUDE.md: "Never swallow errors".
**Warning signs:** KPI showing zeros but no console.error output when a DB query fails.

### Pitfall 6: Props interface not updated in both client components

**What goes wrong:** TypeScript build fails because `StudentDetailClientProps` and `OwnerStudentDetailClientProps` don't have the new `kpiSummary` (or equivalent) props.
**Why it happens:** Server page passes props that the client component doesn't declare.
**How to avoid:** Update both `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` props interfaces before or simultaneously with the server page changes. Type-check with `npx tsc --noEmit`.
**Warning signs:** TS2339 or TS2554 errors on the client component props.

## Code Examples

### KpiItem pattern from ProgressBanner (verified from source)

```typescript
// From src/components/student/ProgressBanner.tsx
function KpiItem({
  label,
  value,
  ragStatus,
  ariaLabel,
}: {
  label: string;
  value: string;
  ragStatus?: RagStatus;
  ariaLabel: string;
}) {
  const colorClass = ragStatus ? ragToColorClass(ragStatus) : "text-ima-text-secondary";
  const dotClass = ragStatus ? ragToBgClass(ragStatus) : undefined;

  return (
    <div className="flex items-center gap-1.5" aria-label={ariaLabel}>
      {dotClass && (
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden="true" />
      )}
      <span className="text-ima-text-muted">{label}:</span>
      <span className={cn("font-semibold", colorClass)}>{value}</span>
    </div>
  );
}
```

### Server-side KPI computation (mirroring student layout pattern)

```typescript
// From src/app/(dashboard)/student/layout.tsx — the proven pattern
const allReports = lifetimeResult.data ?? [];
const lifetimeOutreach = allReports.reduce(
  (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
  0,
);
const dailyMinutesWorked = (todaySessions ?? [])
  .filter((s) => s.status === "completed")
  .reduce((sum, s) => sum + s.duration_minutes, 0);
```

### Current roadmap step derivation (from existing fetched data)

```typescript
// roadmap is already fetched in both coach and owner pages
const activeStep = roadmap.find(r => r.status === "active");
const currentStepNumber = activeStep?.step_number ?? null;
// No extra DB query needed
```

### Card wrapper for KPI summary

```typescript
// Using existing Card component (src/components/ui/Card.tsx)
import { Card, CardContent } from "@/components/ui/Card";

// StudentKpiSummary structure
<Card>
  <CardContent className="py-4">
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <KpiItem ... />
      <KpiItem ... />
      <KpiItem ... />
      {/* Roadmap step — no RAG dot */}
      <KpiItem label="Current Step" value={stepDisplay} ariaLabel={`Current roadmap step: ${stepDisplay}`} />
    </div>
  </CardContent>
</Card>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `outreach_count` single field | `brands_contacted + influencers_contacted` for total outreach | Phase 15 | Both pages still fetch `outreach_count` in their report queries — KPI queries must use the new granular fields |
| 10-step ROADMAP_STEPS | 15 steps, 3 stages | Correct roadmap is 15 steps (per D-06) | Current config is wrong; must be updated in this phase |

**Deprecated/outdated:**
- `outreach_count` in reports query: Still in both server page `reportsResult` selects for backward compat. The new KPI queries must use `brands_contacted + influencers_contacted` instead. Do not use `outreach_count` for KPI computation.

## Open Questions

1. **Step titles for steps 8-15**
   - What we know: Stage names are "Setup & Preparation" (1-7), "Influencer Outreach" (8-11), "Brand Outreach" (12-15); the CONTEXT.md D-06 does not provide individual step titles for steps 8-15
   - What's unclear: What are the exact step titles for steps 8-15?
   - Recommendation: Planner should use placeholder step titles for steps 8-15 in the config update (e.g., "Get First Reply", "Close First Influencer", "Build to 5 Influencers" for stage 2; stage 3 TBD) — these are display strings only, can be updated anytime without a migration

2. **`KpiItem` sharing strategy**
   - What we know: `KpiItem` is a private function inside `ProgressBanner.tsx` (not exported)
   - What's unclear: Should `KpiItem` be exported from ProgressBanner.tsx, moved to a shared file, or duplicated in `StudentKpiSummary.tsx`?
   - Recommendation: Export `KpiItem` from `ProgressBanner.tsx` and import it in `StudentKpiSummary.tsx` — avoids duplication without adding a new file

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase adds server component queries and a new React component using already-installed libraries)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework installed |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

No automated unit/integration test framework (jest, vitest, playwright) is present in `package.json`. The project's validation strategy is build + type-check + lint + manual UAT.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | Coach page renders KPI summary card | build smoke | `npm run build` | N/A — build test |
| VIS-01 | KPI values display lifetime outreach/2500, daily/50, hours | manual-only | — | N/A |
| VIS-02 | Owner page renders identical KPI summary | build smoke | `npm run build` | N/A — build test |
| VIS-03 | KPI card shows current roadmap step in stage+step format | manual-only | — | N/A |
| VIS-04 | RAG colors match student view (visual parity) | manual-only | — | N/A |

**Manual-only justification:** RAG color parity and data accuracy require visual inspection against a live Supabase instance with real student data. TypeScript strict mode and `npm run build` will catch type errors and missing props; `npx tsc --noEmit` catches type errors without emitting JS.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full build green + manual UAT checklist before `/gsd:verify-work`

### Wave 0 Gaps

None — no test infrastructure exists or is needed. The validation strategy for this project is build + lint + manual UAT consistently across all phases.

## Sources

### Primary (HIGH confidence)
- `src/lib/kpi.ts` — verified: RAG functions, `ragToColorClass`, `ragToBgClass`, `daysInProgram` — all directly reusable
- `src/components/student/ProgressBanner.tsx` — verified: `KpiItem` pattern, props interface
- `src/app/(dashboard)/student/layout.tsx` — verified: KPI query pattern (`brands_contacted + influencers_contacted` reduce, `getTodayUTC()`, work_sessions sum)
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — verified: existing `Promise.all`, props passed to `StudentDetailClient`
- `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — verified: existing `Promise.all`, props passed to `OwnerStudentDetailClient`
- `src/components/coach/StudentDetailClient.tsx` — verified: current props interface, tab structure
- `src/components/owner/OwnerStudentDetailClient.tsx` — verified: current props interface, inline header
- `src/lib/config.ts` — verified: `ROADMAP_STEPS` (currently 10 steps, no stage names — needs update), `KPI_TARGETS`, `WORK_TRACKER.dailyGoalHours`
- `.planning/phases/16-coach-owner-kpi-visibility/16-CONTEXT.md` — verified: all locked decisions D-01 through D-06

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated context — confirms JS reduce is acceptable for lifetime outreach at student scale; `getTodayUTC()` is the correct function for date comparisons

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — patterns are directly verified from existing Phase 15 code in the same repo
- Pitfalls: HIGH — all pitfalls derived from reading actual code, not speculation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable stack; no external dependencies)
