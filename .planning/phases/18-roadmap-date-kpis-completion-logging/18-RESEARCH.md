# Phase 18: Roadmap Date KPIs & Completion Logging - Research

**Researched:** 2026-03-28
**Domain:** UI enhancement — status chip logic, deadline date math, component extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Steps with `target_days: null` (Stage 2: Influencer Outreach, Stage 3: Brand Outreach) show NO deadline chip at all. Only the existing active/locked/completed status displays.
- **D-02:** Completed no-deadline steps still display `completed_at` date — all completed steps show "Completed [date]" regardless of whether they had a deadline.
- **D-03:** Completed steps that were past deadline show "Completed [date] (X days late)" — factual count of days past deadline.
- **D-04:** `target_days: 0` steps (Steps 1-3) show overdue honestly if not completed on join day. No grace period.
- **D-05:** Overdue state only applies to non-completed steps for chip color purposes. Once completed, the chip is always green "Completed" — the "(X days late)" suffix is the only late indicator.

### Claude's Discretion

- Status chip visual design — how to upgrade from current red "Due [date]" text in RoadmapStep.tsx to proper colored Badge chips (on-track green, due-soon amber within 2 days, overdue red). Existing `Badge` component with `variant` prop is available.
- Coach/owner roadmap upgrade — RoadmapTab.tsx currently shows no deadline info. Claude decides whether to reuse RoadmapStep component, extend RoadmapTab inline, or create a shared sub-component. Key constraint: coach/owner view is read-only (no "Mark Complete" button).
- Deadline calculation utility — whether to add functions to `kpi.ts`, create a new `roadmap-utils.ts`, or compute inline. Must use `getTodayUTC()` for all date math.
- Progress bar denominator — RoadmapTab currently hardcodes `/10 steps`; should be updated to `/15 steps` to match the expanded ROADMAP_STEPS.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROAD-02 | Status chips on each step: on track (green), due soon (amber, within 2 days), overdue (red), completed (with date) | Badge component has `success`, `warning`, `error` variants. Chip logic implemented via `getDeadlineStatus()` utility. |
| ROAD-03 | Completed steps display their `completed_at` date | `roadmap_progress.completed_at` is already stored and typed as `string \| null`. RoadmapStep already partially renders it. |
| ROAD-04 | Deadline status visible on student roadmap view | `RoadmapStep.tsx` is the target file. Replaces the current inline `<p>` deadline text with Badge chips. |
| ROAD-05 | Deadline status visible on coach and owner student detail roadmap views | `RoadmapTab.tsx` receives `roadmap` but currently only has `step_number` and `status`. Server pages need to include `completed_at` and pass `joinedAt` down. |
</phase_requirements>

---

## Summary

Phase 18 is a pure UI/logic enhancement with no schema changes and no new API routes. The database already stores `completed_at` on `roadmap_progress` rows. All the deadline math can be computed client-side from `joined_at + target_days`. No new npm dependencies are needed — the existing `Badge` component covers all four chip variants (success/warning/error/default).

The work splits into two tracks: (1) upgrading `RoadmapStep.tsx` with a `getDeadlineStatus()` utility and replacing the current primitive red-text deadline display with colored Badge chips, and (2) upgrading `RoadmapTab.tsx` (used by both coach and owner) to accept `completed_at` and `joinedAt`, then display the same status chips read-only. The progress bar denominator fix (`/10` → `/15`) is a trivial one-liner bundled with the RoadmapTab work.

**Primary recommendation:** Create `src/lib/roadmap-utils.ts` with `getDeadlineStatus()` and `formatDeadlineChip()` helpers. Upgrade `RoadmapStep.tsx` to consume them. Upgrade `RoadmapTab.tsx` to accept enriched roadmap rows (adding `completed_at` to the type and adding `joinedAt` prop), then render the same chips inline without extracting a shared component (the read-only rendering is simple enough to inline, and it avoids a circular component dependency between coach/ and student/ directories).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2.3 | Component rendering | Project stack |
| TypeScript strict | ^5 | Type safety for deadline logic | Project requirement |
| Tailwind CSS 4 | ^4 | ima-* token styling on chips | Project stack |
| class-variance-authority | ^0.7.1 | Badge variant system | Already powers Badge component |
| lucide-react | ^0.576.0 | Calendar icon already imported in RoadmapStep | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Date arithmetic — already installed | Available for date formatting if needed, but plain JS Date math is sufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JS Date math | date-fns `differenceInDays` | date-fns cleaner API but adds import; plain math is 3 lines and already established in `daysInProgram()` in kpi.ts |
| Inline deadline logic in RoadmapStep | New `roadmap-utils.ts` | Utility is shareable with RoadmapTab — worth extracting |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/lib/
├── roadmap-utils.ts     # NEW: getDeadlineStatus(), daysUntilDeadline(), formatCompletedAt()
├── kpi.ts               # Existing — pattern reference, do NOT add roadmap logic here
└── utils.ts             # getTodayUTC() lives here — import from here

src/components/student/
└── RoadmapStep.tsx      # MODIFY: replace inline <p> deadline text with Badge chips

src/components/coach/
└── RoadmapTab.tsx       # MODIFY: add completed_at + joinedAt props, render chips, fix /10 → /15
```

### Pattern 1: Deadline Status Utility

**What:** A pure function that takes `{ target_days, joinedAt, status, completedAt }` and returns a typed status with display text.

**When to use:** Called from both RoadmapStep (student) and RoadmapTab (coach/owner).

**Example:**
```typescript
// src/lib/roadmap-utils.ts
import { getTodayUTC } from "@/lib/utils";

export type DeadlineStatus =
  | { kind: "none" }                          // target_days is null
  | { kind: "completed"; completedAt: string; daysLate: number | null }
  | { kind: "on-track"; deadlineLabel: string }
  | { kind: "due-soon"; deadlineLabel: string; daysLeft: number }
  | { kind: "overdue"; daysOverdue: number };

export function getDeadlineStatus(
  target_days: number | null,
  joinedAt: string,
  status: "locked" | "active" | "completed",
  completedAt: string | null
): DeadlineStatus {
  // Completed: always show completedAt, optionally days-late suffix
  if (status === "completed") {
    if (!completedAt) return { kind: "completed", completedAt: joinedAt, daysLate: null };
    if (target_days === null) return { kind: "completed", completedAt, daysLate: null };

    // Compute days late using UTC math
    const deadline = new Date(joinedAt);
    deadline.setUTCDate(deadline.getUTCDate() + target_days);
    const completedDate = new Date(completedAt);
    const daysLate = Math.floor(
      (completedDate.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { kind: "completed", completedAt, daysLate: daysLate > 0 ? daysLate : null };
  }

  // No deadline on this step
  if (target_days === null) return { kind: "none" };

  // Compute deadline and days remaining using getTodayUTC()
  const deadline = new Date(joinedAt);
  deadline.setUTCDate(deadline.getUTCDate() + target_days);
  const today = getTodayUTC(); // "YYYY-MM-DD"
  const todayDate = new Date(today + "T00:00:00Z");
  const diffMs = deadline.getTime() - todayDate.getTime();
  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const deadlineLabel = deadline.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (daysLeft < 0) return { kind: "overdue", daysOverdue: Math.abs(daysLeft) };
  if (daysLeft <= 2) return { kind: "due-soon", deadlineLabel, daysLeft };
  return { kind: "on-track", deadlineLabel };
}
```

### Pattern 2: RoadmapStep Badge Chip Rendering

**What:** Replace the current `<p className="text-xs mt-1 flex items-center gap-1">Due [date]</p>` with Badge chips driven by `getDeadlineStatus()`.

**Current code to replace (RoadmapStep.tsx lines 85-93):**
```typescript
// CURRENT (remove this):
{deadlineDate && status !== "completed" && (
  <p className={cn(
    "text-xs mt-1 flex items-center gap-1",
    deadlineDate < new Date() ? "text-ima-danger font-medium" : "text-ima-text-muted"
  )}>
    <Calendar className="h-3 w-3" aria-hidden="true" />
    Due {deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
  </p>
)}
```

**New pattern (replace with):**
```typescript
// In RoadmapStep.tsx — compute at top of component:
import { getDeadlineStatus } from "@/lib/roadmap-utils";

const deadlineStatus = getDeadlineStatus(
  step.target_days,
  joinedAt,
  status,
  progress?.completed_at ?? null
);

// In JSX, replace the deadline <p> block and the completed Badge:
{/* Completed chip — now includes daysLate suffix */}
{deadlineStatus.kind === "completed" && (
  <Badge variant="success" size="sm">
    <Check className="h-3 w-3 mr-1" aria-hidden="true" />
    Completed{" "}
    {new Date(deadlineStatus.completedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })}
    {deadlineStatus.daysLate !== null && (
      <span className="ml-1 opacity-75">({deadlineStatus.daysLate}d late)</span>
    )}
  </Badge>
)}

{/* Deadline status chips for non-completed steps */}
{deadlineStatus.kind === "on-track" && (
  <Badge variant="success" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    On Track — {deadlineStatus.deadlineLabel}
  </Badge>
)}
{deadlineStatus.kind === "due-soon" && (
  <Badge variant="warning" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    Due Soon — {deadlineStatus.deadlineLabel}
  </Badge>
)}
{deadlineStatus.kind === "overdue" && (
  <Badge variant="error" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    Overdue — {deadlineStatus.daysOverdue}d
  </Badge>
)}
```

**Note:** The `status === "completed"` check in the JSX div at line 95 (`{status === "completed" && <Badge variant="success">...`) must be REMOVED and replaced by the `deadlineStatus.kind === "completed"` block above. The deadlineDate variable and its declaration block can also be removed.

### Pattern 3: RoadmapTab Upgrade

**What:** Extend the `RoadmapProgressRow` type to include `completed_at`, add `joinedAt` prop, render chips inline.

**Key data flow changes required:**

1. **`RoadmapTab.tsx` prop interface** — add `completed_at: string | null` to `RoadmapProgressRow` and add `joinedAt: string` prop to `RoadmapTabProps`.

2. **Server pages** — both coach and owner student detail pages currently query:
   ```typescript
   admin.from("roadmap_progress").select("step_number, status").eq("student_id", student.id)
   ```
   Must become:
   ```typescript
   admin.from("roadmap_progress").select("step_number, status, completed_at").eq("student_id", student.id)
   ```

3. **Client components** — `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` both type `roadmap` as `{ step_number: number; status: ... }[]`. The `completed_at` field must be added.

4. **Progress bar denominator fix** (simple):
   ```typescript
   // Change:
   const progressPct = Math.round((completedCount / 10) * 100);
   // To:
   const progressPct = Math.round((completedCount / ROADMAP_STEPS.length) * 100);

   // Change aria/display:
   // "{completedCount}/10 steps" → `${completedCount}/${ROADMAP_STEPS.length} steps`
   // aria-valuemax={10} → aria-valuemax={ROADMAP_STEPS.length}
   ```

### Anti-Patterns to Avoid

- **Using `new Date()` directly for deadline comparison** — always use `getTodayUTC()` for date math to avoid local-timezone off-by-one errors (e.g., student in UTC+8 would see wrong status after midnight UTC if using local time).
- **Adding deadline logic to `kpi.ts`** — kpi.ts handles outreach/hours RAG; roadmap deadline logic is a different domain. Keep them separated.
- **Reusing `RoadmapStep` in `RoadmapTab`** — RoadmapStep is a "use client" component that takes an `onComplete` callback. Coach/owner views are read-only. Reusing RoadmapStep would force a dummy no-op callback prop and renders the full interactive layout unnecessarily. Inline chip rendering in RoadmapTab is cleaner.
- **Computing deadlines server-side** — these are presentation-layer date comparisons. "Today" is always the user's render time. Computing UTC "today" client-side is correct for this use case. No server round-trip needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status chip colors | Custom CSS classes | `Badge` component with `variant="success\|warning\|error"` | Already implements ima-* tokens, CVA variants, and correct padding |
| Date difference calculation | Custom MS math | Pattern from `daysInProgram()` in kpi.ts | Established UTC-safe pattern in this codebase; replicate the approach |

**Key insight:** Everything needed already exists. This phase is pure composition of existing pieces.

---

## Common Pitfalls

### Pitfall 1: Timezone Off-By-One in Deadline Comparison
**What goes wrong:** Using `new Date()` for "today" (local time) vs. using `getTodayUTC()` (UTC string). Student in UTC+8 who joins on Jan 1 UTC might show as "Jan 2" in their local time, skewing deadline calculations.
**Why it happens:** `RoadmapStep.tsx` currently uses `new Date()` inline in the deadline comparison (line 88: `deadlineDate < new Date()`). This mixes a UTC-constructed deadline date with a local-time "now".
**How to avoid:** In `getDeadlineStatus()`, always construct today as `new Date(getTodayUTC() + "T00:00:00Z")` for comparison. Construct the deadline as `new Date(joinedAt); setUTCDate(...)`.
**Warning signs:** Off-by-one day discrepancies in deadline chip state near midnight.

### Pitfall 2: Forgetting to Update Both Client Components' Roadmap Type
**What goes wrong:** `StudentDetailClient.tsx` and `OwnerStudentDetailClient.tsx` both define the `roadmap` prop type inline. Adding `completed_at` to only one causes a TypeScript error in the other.
**Why it happens:** The type is duplicated, not shared via a named interface.
**How to avoid:** Update the `roadmap` prop type in BOTH files when adding `completed_at`. Also update both server-side page queries to `select("step_number, status, completed_at")`.
**Warning signs:** TypeScript error on `roadmap.completed_at` in one but not the other.

### Pitfall 3: target_days: 0 Edge Case in Deadline Math
**What goes wrong:** When `target_days = 0`, the deadline equals `joinedAt` exactly. On the join day, `daysLeft = 0` which is `<= 2`, triggering "Due Soon" instead of "On Track". On any subsequent day, it correctly shows "Overdue".
**Why it happens:** D-04 explicitly says these steps should show overdue if not completed on join day. The `<= 2` threshold means day-zero steps show "Due Soon" on the join day itself (not "On Track"), which is acceptable and intentional.
**How to avoid:** No special casing needed — the threshold logic naturally handles it. But verify the UX is intentional: day-zero steps will never show "On Track" green (they always start as amber on day 0, red on day 1+).
**Warning signs:** Expecting "On Track" for step 1 on join day — that's not the design per D-04.

### Pitfall 4: RoadmapTab Progress Bar Still Hardcodes 10
**What goes wrong:** After adding deadline chips, the progress bar at the top of RoadmapTab still says "X/10 steps" because that's a separate block (line 29: `Math.round((completedCount / 10) * 100)`).
**Why it happens:** It's a quick search-and-replace miss — easy to overlook.
**How to avoid:** Import `ROADMAP_STEPS` and use `ROADMAP_STEPS.length` for the denominator. Also update the aria labels.
**Warning signs:** A student with all 15 steps completing shows "15/10 steps" or 150%.

### Pitfall 5: completed_at Rendering with UTC Timezone
**What goes wrong:** `new Date(completedAt).toLocaleDateString(...)` may show the wrong day when `completedAt` is an ISO string like `"2026-03-28T23:00:00Z"` — in UTC+1 this is "Mar 29".
**Why it happens:** `toLocaleDateString` uses the browser's local timezone by default.
**How to avoid:** Always pass `timeZone: "UTC"` to `toLocaleDateString` options when formatting dates sourced from the database. Example: `new Date(completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })`.
**Warning signs:** Dates appearing one day off in non-UTC timezones.

---

## Code Examples

### Complete `getDeadlineStatus()` Utility

```typescript
// Source: derived from kpi.ts daysInProgram() pattern + project conventions
// File: src/lib/roadmap-utils.ts
import { getTodayUTC } from "@/lib/utils";

export type DeadlineStatus =
  | { kind: "none" }
  | { kind: "completed"; completedAt: string; daysLate: number | null }
  | { kind: "on-track"; deadlineLabel: string }
  | { kind: "due-soon"; deadlineLabel: string; daysLeft: number }
  | { kind: "overdue"; daysOverdue: number };

export function getDeadlineStatus(
  target_days: number | null,
  joinedAt: string,
  status: "locked" | "active" | "completed",
  completedAt: string | null
): DeadlineStatus {
  if (status === "completed") {
    if (!completedAt) return { kind: "completed", completedAt: joinedAt, daysLate: null };
    if (target_days === null) return { kind: "completed", completedAt, daysLate: null };

    const deadline = new Date(joinedAt + "T00:00:00Z");
    deadline.setUTCDate(deadline.getUTCDate() + target_days);
    const completed = new Date(completedAt);
    completed.setUTCHours(0, 0, 0, 0);
    const daysLate = Math.floor(
      (completed.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { kind: "completed", completedAt, daysLate: daysLate > 0 ? daysLate : null };
  }

  if (target_days === null) return { kind: "none" };

  const deadline = new Date(joinedAt + "T00:00:00Z");
  deadline.setUTCDate(deadline.getUTCDate() + target_days);
  const today = new Date(getTodayUTC() + "T00:00:00Z");
  const diffMs = deadline.getTime() - today.getTime();
  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const deadlineLabel = deadline.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (daysLeft < 0) return { kind: "overdue", daysOverdue: Math.abs(daysLeft) };
  if (daysLeft <= 2) return { kind: "due-soon", deadlineLabel, daysLeft };
  return { kind: "on-track", deadlineLabel };
}
```

### RoadmapTab Extended Type

```typescript
// In RoadmapTab.tsx — updated prop types
type RoadmapProgressRow = {
  step_number: number;
  status: "locked" | "active" | "completed";
  completed_at: string | null;   // ADD THIS
};

interface RoadmapTabProps {
  roadmap: RoadmapProgressRow[];
  joinedAt: string;              // ADD THIS
}
```

### Server Query Update (both coach and owner pages)

```typescript
// Before:
admin.from("roadmap_progress").select("step_number, status").eq("student_id", student.id)

// After:
admin.from("roadmap_progress").select("step_number, status, completed_at").eq("student_id", student.id)
```

### Badge Chip Rendering in RoadmapTab (read-only)

```typescript
// Inside RoadmapTab's ROADMAP_STEPS.map():
import { getDeadlineStatus } from "@/lib/roadmap-utils";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui";

// Lookup the row:
const row = roadmap.find(r => r.step_number === step.step);
const status = row?.status ?? "locked";
const completedAt = row?.completed_at ?? null;
const ds = getDeadlineStatus(step.target_days, joinedAt, status, completedAt);

// Render:
{ds.kind === "completed" && (
  <Badge variant="success" size="sm">
    Completed {new Date(ds.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
    {ds.daysLate !== null && <span className="ml-1 opacity-75">({ds.daysLate}d late)</span>}
  </Badge>
)}
{ds.kind === "on-track" && (
  <Badge variant="success" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    On Track — {ds.deadlineLabel}
  </Badge>
)}
{ds.kind === "due-soon" && (
  <Badge variant="warning" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    Due Soon — {ds.deadlineLabel}
  </Badge>
)}
{ds.kind === "overdue" && (
  <Badge variant="error" size="sm">
    <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
    Overdue — {ds.daysOverdue}d
  </Badge>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `<p>` with inline color class for deadline | Badge chip with semantic variant | Phase 18 | Consistent visual language with rest of app; color tokens respected |
| Hardcoded `/10 steps` denominator | `ROADMAP_STEPS.length` (15) | Phase 18 | Accurate progress math after Phase 16 expanded roadmap to 15 steps |

**Deprecated/outdated in this phase:**
- `deadlineDate < new Date()` inline comparison in RoadmapStep.tsx: replaced by `getDeadlineStatus()` utility.
- The `deadlineDate` computed variable in RoadmapStep.tsx: removed entirely.
- The `{status === "completed" && <Badge variant="success">...}` block in RoadmapStep.tsx: replaced by `deadlineStatus.kind === "completed"` block that includes the daysLate suffix.

---

## Open Questions

1. **`joinedAt` format consistency**
   - What we know: `joinedAt` is an ISO timestamp string like `"2026-01-15T12:00:00Z"` or `"2026-01-15"` (Date-only from some paths).
   - What's unclear: The student roadmap page derives `joinedAt` from `userResult.data?.joined_at ?? new Date().toISOString()`. The coach/owner pages pass `student.joined_at` which comes from the `users` table `joined_at` column (typed as `string` in types.ts). The DB column could be timestamptz or date.
   - Recommendation: In `getDeadlineStatus()`, always append `"T00:00:00Z"` when constructing `new Date(joinedAt + ...)` if joinedAt is date-only, and handle both formats by normalizing: `const joinedDate = new Date(joinedAt.includes("T") ? joinedAt : joinedAt + "T00:00:00Z")`. This makes the utility safe regardless of format.

2. **`target_days` placeholder values**
   - What we know: STATE.md explicitly notes "target_days values are placeholders pending Abu Lahya confirmation". Current config has 0, 0, 0, 1, 3, 4, 4 for steps 1-7.
   - What's unclear: Whether these will change before Phase 18 ships.
   - Recommendation: Proceed with current placeholder values. The status chip logic is correct regardless of the actual values. Note this in the plan as a pending confirmation item.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is pure UI/logic changes (no external tools, services, CLIs, or databases beyond existing Supabase). No new dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test directory found |
| Config file | None — no test infrastructure exists in this project |
| Quick run command | `npx tsc --noEmit` (type-check as proxy for correctness) |
| Full suite command | `npm run build` (full Next.js build including type checking) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROAD-02 | Status chips render correct variant per deadline state | manual-only | `npm run build` (type check) | N/A — no test runner |
| ROAD-03 | `completed_at` date shown on all completed steps | manual-only | `npm run build` | N/A |
| ROAD-04 | Student roadmap view shows chips | manual-only | `npm run build` | N/A |
| ROAD-05 | Coach/owner roadmap tab shows chips | manual-only | `npm run build` | N/A |

**Note on manual-only:** This project has no test runner infrastructure (no jest, vitest, or pytest found). All behavioral verification is manual UAT against the running dev server. Type safety via `npx tsc --noEmit` is the only automated correctness check.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green + manual UAT against all three roles (student, coach, owner) before `/gsd:verify-work`

### Wave 0 Gaps
None — no test infrastructure needs to be created; this project uses manual UAT throughout.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/components/student/RoadmapStep.tsx` — current deadline display code
- Direct code inspection: `src/components/coach/RoadmapTab.tsx` — current progress bar and roadmap list
- Direct code inspection: `src/lib/kpi.ts` — `daysInProgram()` UTC pattern to replicate
- Direct code inspection: `src/lib/utils.ts` — `getTodayUTC()` definition
- Direct code inspection: `src/components/ui/Badge.tsx` — available variants (success/warning/error/default/outline/info)
- Direct code inspection: `src/lib/config.ts` — `ROADMAP_STEPS` with `target_days` per step
- Direct code inspection: `src/lib/types.ts` — `roadmap_progress.Row` confirms `completed_at: string | null`
- Direct code inspection: `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — confirms `joined_at` available
- Direct code inspection: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — confirms same pattern
- Direct code inspection: `.planning/phases/18-roadmap-date-kpis-completion-logging/18-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- STATE.md §Accumulated Context — confirms `getTodayUTC()` is the project standard for UTC date math, confirmed in Phase 15 and 17 notes.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries verified by code inspection
- Architecture: HIGH — all component files read, data flows traced end-to-end
- Pitfalls: HIGH — derived from reading existing code patterns and established project decisions
- Utility design: HIGH — modeled on existing `daysInProgram()` in kpi.ts; discriminated union type is idiomatic TypeScript

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (stable — no fast-moving dependencies; all changes are pure code)
