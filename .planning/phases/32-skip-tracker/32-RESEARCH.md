# Phase 32: Skip Tracker - Research

**Researched:** 2026-04-03
**Domain:** Postgres RPC date math, React Server Component enrichment, Badge UI integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All 7 days Mon-Sun count (ISO week), not just weekdays. A skip = zero completed work sessions AND no submitted daily report for that date.
- **D-02:** Today counts as skipped ONLY if it's past the report deadline hour (`DAILY_REPORT.deadlineHour`, currently 23 / 11 PM UTC). Before that hour, today is excluded from the count. Past days in the current ISO week always count.
- **D-03:** Skip count resets to 0 on Monday (new ISO week).
- **D-04:** Show "X skipped" as a `ima-warning`-colored Badge in the top-right of StudentCard, alongside/replacing the existing New/At Risk badge. Only show when X > 0. Zero skips = no badge shown.
- **D-05:** Add a "Skipped" column to the owner's student table. Same skip count logic. Highlight in `ima-warning` color when > 0.
- **D-06:** Student_DIY users do NOT show skip counts. No coach, no reports, no accountability tracking. Skip tracker only applies to `role = 'student'`.

### Claude's Discretion

- RPC function name and exact SQL implementation (likely `get_weekly_skip_counts` or similar batch function)
- Whether to use a single batch RPC call for all students or per-student calls (batch preferred for N+1 avoidance)
- Badge positioning when both "At Risk" and "X skipped" apply to the same student
- Exact column styling in owner student table

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIP-01 | Coach sees "X skipped" badge on each student card showing days with zero completed work sessions AND zero submitted reports in the current Mon-Sun ISO week | RPC batch function returns per-student skip counts; StudentCard renders Badge conditionally |
| SKIP-02 | Skip count only includes past days and today, not future days in the week | RPC uses `p_today` + `p_current_hour` parameters; days after today excluded; today excluded if hour < deadlineHour |
| SKIP-03 | Skip count resets to 0 on Monday (new ISO week) | RPC computes week_start via `date_trunc('week', p_today)` — ISO week naturally resets on Monday |
| SKIP-04 | Owner student views also display the skip count badge | Owner students list page and student detail page receive skip counts from same RPC call |
| SKIP-05 | Skip count is computed via a Postgres RPC function using UTC-safe date math | New migration 00016_skip_tracker.sql; RPC accepts p_today DATE and p_current_hour INT; never uses CURRENT_DATE |

</phase_requirements>

## Summary

Phase 32 adds a skip-day counter to the coach dashboard and owner student views. A "skip" is any day in the current Mon-Sun ISO week — up to and including today (subject to the 23:00 UTC deadline cutoff) — where the student had zero completed work sessions AND zero submitted daily reports. The count resets to zero on Monday when a new ISO week begins.

The core deliverable is a new Postgres RPC function (migration 00016) that accepts a `p_today DATE` and `p_current_hour INTEGER`, computes the ISO week boundary with `date_trunc('week', p_today)`, generates the candidate day series, filters out future days and today-before-deadline, then counts days with no matching session or report. The function returns per-student skip counts for a list of student IDs, so a single RPC call can serve the entire coach dashboard or owner student list without N+1 queries.

On the UI side, `StudentCard` receives a new `skippedDays` prop and renders a `<Badge variant="warning" size="sm">` only when the value is greater than zero. The owner students list page (which currently uses a flat table, not `StudentCard`) adds a "Skipped" column with the same conditional warning styling. The owner student detail page shows the same count. Student_DIY users are excluded entirely — the RPC is only called for `role = 'student'` users.

**Primary recommendation:** Write a single `get_weekly_skip_counts(p_student_ids uuid[], p_today date, p_current_hour int)` RPC that returns a JSONB map of student_id → skip_count. Integrate it as an additional parallel fetch in the coach dashboard enrichment pipeline and in the owner students page.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (Supabase) | Project-managed | RPC function with date_trunc, generate_series | date_trunc('week', date) in Postgres returns the Monday of the ISO week — exactly the reset boundary required by D-03 |
| @supabase/supabase-js | ^2.99.2 (installed) | .rpc() call from admin client | Established pattern in this project |
| class-variance-authority | ^0.7.1 (installed) | Badge CVA variants | Badge.tsx already uses this; `variant="warning"` is already defined |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 (installed) | Optional JS-side date utilities | Available but not needed — all date math lives in the RPC |
| zod | ^4.3.6 (installed) | Validate RPC response shape | Use for safeParse of RPC output if needed |

**No new npm dependencies required.** All stack needs are met by installed packages and the existing Postgres instance.

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
└── 00016_skip_tracker.sql    # New RPC function

src/components/coach/
└── StudentCard.tsx            # Add skippedDays prop + conditional Badge

src/app/(dashboard)/coach/
└── page.tsx                   # Add RPC call to parallel fetch block

src/app/(dashboard)/owner/students/
└── page.tsx                   # Add RPC call + Skipped column
└── [studentId]/page.tsx       # Add skip count display (single-student call)
```

### Pattern 1: Batch RPC returning JSONB map

The established RPC pattern in this project (see `get_sidebar_badges`, `get_student_detail`) returns JSONB from a `SECURITY DEFINER` function called via the admin client. For a batch skip count, return a JSONB object keyed by student_id:

```sql
-- Source: supabase/migrations/00016_skip_tracker.sql (to be created)
CREATE OR REPLACE FUNCTION public.get_weekly_skip_counts(
  p_student_ids  uuid[],
  p_today        date,
  p_current_hour integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start   date := date_trunc('week', p_today)::date;
  -- ISO week: date_trunc('week', ...) returns the Monday
  -- Candidate days: week_start through p_today
  -- If p_current_hour < 23, today is not yet countable as a skip
  v_count_through date;
  v_result       jsonb := '{}'::jsonb;
  v_sid          uuid;
  v_skip_count   integer;
BEGIN
  -- Determine the last day to count
  -- D-02: today is only countable after deadlineHour (23)
  IF p_current_hour >= 23 THEN
    v_count_through := p_today;
  ELSE
    v_count_through := p_today - interval '1 day';
  END IF;

  -- Edge: if Monday and before deadline, no days to count yet
  IF v_count_through < v_week_start THEN
    -- Return zero for all students
    FOREACH v_sid IN ARRAY p_student_ids LOOP
      v_result := v_result || jsonb_build_object(v_sid::text, 0);
    END LOOP;
    RETURN v_result;
  END IF;

  FOREACH v_sid IN ARRAY p_student_ids LOOP
    SELECT count(*) INTO v_skip_count
    FROM generate_series(v_week_start, v_count_through, interval '1 day') AS d(day_date)
    WHERE NOT EXISTS (
      SELECT 1 FROM work_sessions ws
      WHERE ws.student_id = v_sid
        AND ws.date = d.day_date::date
        AND ws.status = 'completed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM daily_reports dr
      WHERE dr.student_id = v_sid
        AND dr.date = d.day_date::date
        AND dr.submitted_at IS NOT NULL
    );

    v_result := v_result || jsonb_build_object(v_sid::text, v_skip_count);
  END LOOP;

  RETURN v_result;
END;
$$;
```

**Important:** This is a reference pattern. The exact SQL body is at the planner's discretion per CONTEXT.md. The critical correctness invariants are:
1. Use `date_trunc('week', p_today)` — not `p_today - EXTRACT(DOW...)` — because `date_trunc('week', ...)` reliably returns Monday in Postgres.
2. Never use `CURRENT_DATE` or `now()` inside the function body. All date context must come from parameters.
3. A skip requires BOTH zero completed sessions AND zero submitted reports (submitted_at IS NOT NULL check).

### Pattern 2: Coach Dashboard Parallel Fetch Extension

The coach `page.tsx` currently runs 3 parallel fetches after collecting `studentIds`. The skip count RPC becomes a 4th parallel fetch in the same `Promise.all`:

```typescript
// Source: src/app/(dashboard)/coach/page.tsx (existing pattern, extended)
const [sessionsResult, reportsResult, roadmapResult, skipResult] =
  studentIds.length > 0
    ? await Promise.all([
        // ...existing 3 fetches...
        (admin as any).rpc("get_weekly_skip_counts", {
          p_student_ids: studentIds,
          p_today: getTodayUTC(),
          p_current_hour: new Date().getUTCHours(),
        }),
      ])
    : ([
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ] as const);
```

The result is a JSONB map (`{ [studentId: string]: number }`). Build a lookup:

```typescript
const skipCountMap = new Map<string, number>();
for (const [id, count] of Object.entries((skipResult?.data ?? {}) as Record<string, number>)) {
  if (count > 0) skipCountMap.set(id, count);
}
```

Pass to `StudentCard` via a new `skippedDays` prop on the enriched student object.

### Pattern 3: StudentCard Badge Coexistence

The current top-row logic is:

```tsx
{student.isNew ? (
  <Badge variant="info" size="sm">New</Badge>
) : student.isAtRisk ? (
  <Badge variant="error" size="sm">At Risk</Badge>
) : null}
```

With skip tracking, the badge slot expands to show the skip count independently of New/At Risk. The preferred layout (Claude's discretion per CONTEXT.md) is to keep one badge slot but allow both signals when relevant. The simplest approach: skip badge takes priority over New/At Risk when > 0, or render both stacked in a `flex-col gap-1` wrapper. The exact positioning is at the planner's discretion.

A clean approach: render skip badge first (always, if > 0), then conditionally render the risk badge below it:

```tsx
// Source: pattern to be implemented in src/components/coach/StudentCard.tsx
<div className="flex flex-col items-end gap-1">
  {(student.skippedDays ?? 0) > 0 && (
    <Badge variant="warning" size="sm">{student.skippedDays} skipped</Badge>
  )}
  {student.isNew ? (
    <Badge variant="info" size="sm">New</Badge>
  ) : student.isAtRisk ? (
    <Badge variant="error" size="sm">At Risk</Badge>
  ) : null}
</div>
```

### Pattern 4: Owner Students List — Skipped Column

The owner `students/page.tsx` currently renders student cards in a 2-column grid, not a table. The decision D-05 says "add a Skipped column to the owner's student table" — but the actual UI is a card grid. The most consistent approach is to add a skip badge alongside the existing status badge in each card, mirroring the StudentCard pattern. The RPC call follows the same structure: collect all student IDs from the page, call `get_weekly_skip_counts`, build a map, inject into card rendering.

For the owner student detail page (`[studentId]/page.tsx`), call the same RPC with a single-element array `[student.id]` and pass the result to `OwnerStudentDetailClient`.

### Anti-Patterns to Avoid

- **Using CURRENT_DATE inside RPC:** The project convention (stated in CONTEXT.md and established by existing RPCs that use `CURRENT_DATE`) is actually the opposite — but the skip RPC is an explicit exception. The success criteria for SKIP-05 states the RPC must accept `p_today` and never rely on `CURRENT_DATE` internally. This is because the today-vs-deadline-hour check requires UTC hour awareness that must come from the application layer.
- **Per-student RPC calls:** Calling `get_weekly_skip_counts` once per student card causes N+1 round-trips. Use the batch form with `p_student_ids uuid[]`.
- **Counting future days in the week:** The RPC `generate_series` upper bound must be `v_count_through`, not `week_start + interval '6 days'`.
- **Showing skip badge for student_diy:** The coach dashboard query already filters `.eq("role", "student")`. The owner students page also filters by `role = 'student'`. No additional guard needed in the badge render, but the RPC itself should only ever receive `role = 'student'` IDs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ISO week start (Monday) | Custom DOW arithmetic | `date_trunc('week', date)::date` in Postgres | date_trunc('week') always returns Monday; manual DOW subtraction has off-by-one risk at week boundaries |
| Generate candidate day series | Loop with date addition | `generate_series(start, end, interval '1 day')` | Built-in Postgres set-returning function, handles all edge cases |
| Badge component | New custom element | Existing `Badge` component with `variant="warning"` | Already correct colors, sizing, CVA structure |

**Key insight:** The skip count is pure set arithmetic — days in range minus days with activity. Postgres `generate_series` + `NOT EXISTS` subqueries express this directly without procedural loops per day.

## Common Pitfalls

### Pitfall 1: CURRENT_DATE inside the RPC
**What goes wrong:** If the RPC uses `CURRENT_DATE` internally, it cannot be tested with synthetic dates and may drift from the application's UTC day if the Postgres server timezone differs from UTC.
**Why it happens:** Convenience — `CURRENT_DATE` is always available in plpgsql.
**How to avoid:** Declare all date inputs as parameters. The application passes `getTodayUTC()` as `p_today` and `new Date().getUTCHours()` as `p_current_hour`. The success criterion for SKIP-05 explicitly prohibits CURRENT_DATE in the function body.
**Warning signs:** Any `v_today := CURRENT_DATE` declaration in the function.

### Pitfall 2: Counting today before deadline
**What goes wrong:** A student submits a report at 10 PM UTC. Before midnight, the coach sees "1 skipped" for today even though the student hasn't had a chance to submit yet (deadline is 11 PM / 23:00 UTC).
**Why it happens:** Including today in the candidate day range regardless of hour.
**How to avoid:** `v_count_through = p_today - 1 day` when `p_current_hour < 23`. Only when `p_current_hour >= 23` is today included in the count.
**Warning signs:** `generate_series(v_week_start, p_today, ...)` without the hour guard.

### Pitfall 3: Treating the JSONB result as typed without safeParse
**What goes wrong:** `skipResult.data` is typed as `any` from the RPC call. Accessing `skipResult.data[studentId]` without a guard crashes or returns `undefined` for students without any skip data.
**Why it happens:** RPC results in this project are cast with `as any` or `as unknown as T`.
**How to avoid:** Default to 0 with `(skipResult?.data?.[studentId] as number | undefined) ?? 0`. Build the lookup map defensively.

### Pitfall 4: work_sessions filter missing status = 'completed'
**What goes wrong:** An abandoned or active session (status = 'active', 'paused', 'abandoned') incorrectly counts as "work done" for that day, masking a real skip.
**Why it happens:** The WHERE clause omits `AND ws.status = 'completed'`.
**How to avoid:** The NOT EXISTS subquery for work_sessions must include `AND ws.status = 'completed'`. Verified against the existing `get_student_detail` function which uses the same filter for `today_minutes_worked`.

### Pitfall 5: daily_reports filter missing submitted_at IS NOT NULL
**What goes wrong:** A draft or started-but-not-submitted report incorrectly counts as "activity" for that day.
**Why it happens:** The WHERE clause checks only `dr.date = ...` without the submitted status check.
**How to avoid:** The NOT EXISTS subquery for daily_reports must include `AND dr.submitted_at IS NOT NULL`. Verified against `get_sidebar_badges` which uses the same guard.

### Pitfall 6: N+1 on owner students list (pagination context)
**What goes wrong:** The owner students page fetches PAGE_SIZE=25 students. Calling the skip RPC per student = 25 round-trips per page load.
**Why it happens:** Copying per-student RPC call pattern from detail page to list page.
**How to avoid:** Collect all student IDs from the page query result, then make a single batch RPC call with the full array.

## Code Examples

Verified patterns from existing project source:

### Existing parallel fetch pattern (coach dashboard)
```typescript
// Source: src/app/(dashboard)/coach/page.tsx lines 46-66
const [sessionsResult, reportsResult, roadmapResult] =
  studentIds.length > 0
    ? await Promise.all([
        admin.from("work_sessions").select(...).in("student_id", studentIds),
        admin.from("daily_reports").select(...).in("student_id", studentIds),
        admin.from("roadmap_progress").select(...).in("student_id", studentIds),
      ])
    : ([
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ] as const);
```

### Existing RPC call pattern (owner student detail)
```typescript
// Source: src/app/(dashboard)/owner/students/[studentId]/page.tsx lines 46-51
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: detailData, error: detailError } = await (admin as any).rpc("get_student_detail", {
  p_student_id: student.id,
  p_month_start: firstDay,
  p_month_end: lastDay,
  p_include_coach_mgmt: true,
});
```

### Existing Badge variants (Badge.tsx)
```tsx
// Source: src/components/ui/Badge.tsx — variant="warning" is already defined
<Badge variant="warning" size="sm">3 skipped</Badge>
// Renders: bg-ima-warning/10 text-ima-warning, px-2 py-0.5 text-xs
```

### getTodayUTC() — required for p_today parameter
```typescript
// Source: src/lib/utils.ts line 18-20
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}
// p_today value: getTodayUTC()
// p_current_hour value: new Date().getUTCHours()
```

### date_trunc('week', date) behavior in Postgres
```sql
-- date_trunc('week', '2026-04-03'::date) → '2026-03-30' (Monday of that week)
-- date_trunc('week', '2026-04-06'::date) → '2026-04-06' (already Monday)
-- date_trunc('week', '2026-04-05'::date) → '2026-03-30' (Sunday → prior Monday)
-- Confidence: HIGH — standard Postgres behavior, ISO 8601 week starts on Monday
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CURRENT_DATE in RPCs (get_owner_dashboard_stats, get_student_detail) | p_today parameter passed from app | Phase 32 (this phase) for skip RPC only | Existing RPCs still use CURRENT_DATE; skip RPC is a deliberate exception because of the hour-based today gate |

**Note on existing RPCs:** `get_owner_dashboard_stats` and `get_student_detail` both use `v_today := CURRENT_DATE`. This is acceptable for those functions because they do not need sub-day granularity. The skip RPC is different — it needs UTC hour awareness that only the application can supply. Do not "fix" the existing RPCs; only the new skip RPC uses the parameter approach.

## Open Questions

1. **Badge coexistence when student is both New and skipping**
   - What we know: D-04 says show skip badge in the New/At Risk slot; both signals can apply simultaneously to a student (e.g., joined 2 days ago but already skipped yesterday)
   - What's unclear: Whether the New badge should be suppressed when skip > 0, or both shown stacked
   - Recommendation: Render both in a stacked `flex-col` wrapper — omit neither; the stacked two-badge design is clean and carries more information than suppressing either signal

2. **Owner student detail page — where to display skip count**
   - What we know: CONTEXT.md D-05 mentions the owner student table; success criteria #4 says "owner student list and student detail views display the same skip count badge"
   - What's unclear: Exact placement in `OwnerStudentDetailClient` (which has tabs for calendar, roadmap, KPIs)
   - Recommendation: Add skip count as a small stat near the top of the detail page (beside the isAtRisk indicators), not inside a tab — it's a current-week metric, not historical

3. **p_student_ids empty array edge case**
   - What we know: Coach with no assigned students means `studentIds = []`; coach dashboard already skips all fetches in this case
   - What's unclear: Whether Postgres handles `uuid[] = '{}'` gracefully in `FOREACH ... IN ARRAY`
   - Recommendation: Guard at the application layer — if `studentIds.length === 0`, skip the RPC call and return an empty map (same guard already used for all other fetches)

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — Postgres, Supabase client, and all UI components are already installed and in use)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no jest/vitest/playwright config found |
| Config file | None — no jest.config.*, vitest.config.*, playwright.config.* present |
| Quick run command | `npm run build` (type-check + build gate) |
| Full suite command | `npx tsc --noEmit && npm run lint && npm run build` |

**Note:** This project has no automated test suite. The `load-tests/` directory contains k6 load scenarios, not unit tests. Validation is manual UAT + build/type check gates.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIP-01 | Coach StudentCard shows "X skipped" badge | manual-only | `npm run build` (type check) | N/A — no unit test infra |
| SKIP-02 | Today excluded before 23:00 UTC; future days excluded | manual-only | `npm run build` | N/A |
| SKIP-03 | Count resets to 0 on Monday | manual-only | `npm run build` | N/A |
| SKIP-04 | Owner students list + detail show same skip count | manual-only | `npm run build` | N/A |
| SKIP-05 | RPC uses p_today parameter, never CURRENT_DATE | code review | `npm run build` | N/A |

**Justification for manual-only:** No automated test framework is present. All phase validation occurs through `npm run build`, `npx tsc --noEmit`, `npm run lint`, and the UAT checklist in the verification phase.

### Sampling Rate
- **Per task commit:** `npm run build` (Next.js build catches type errors and missing imports)
- **Per wave merge:** `npx tsc --noEmit && npm run lint && npm run build`
- **Phase gate:** All three pass before `/gsd:verify-work`

### Wave 0 Gaps
None — no test infrastructure is needed; existing build pipeline is the validation gate for this project.

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/components/coach/StudentCard.tsx` — current interface, Badge rendering, top-row layout
- Direct source read: `src/app/(dashboard)/coach/page.tsx` — enrichment pipeline, parallel fetch pattern
- Direct source read: `src/app/(dashboard)/owner/students/page.tsx` — pagination, card rendering, Badge usage
- Direct source read: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — RPC call pattern, admin client usage
- Direct source read: `supabase/migrations/00010_query_consolidation.sql` — SECURITY DEFINER pattern, JSONB return, existing date math
- Direct source read: `src/lib/config.ts` — `DAILY_REPORT.deadlineHour = 23`, `ROLES` constants
- Direct source read: `src/lib/utils.ts` — `getTodayUTC()` signature and implementation
- Direct source read: `src/components/ui/Badge.tsx` — CVA variants including `warning`
- Postgres documentation (training data, HIGH confidence): `date_trunc('week', date)` returns Monday per ISO 8601
- Postgres documentation (training data, HIGH confidence): `generate_series(start, end, interval '1 day')` is stable set-returning function

### Secondary (MEDIUM confidence)
- `supabase/migrations/00011_write_path.sql` — FOREACH ... IN ARRAY pattern, confirmed available in plpgsql
- `package.json` — confirms date-fns, zod, all dependencies installed; no test framework present

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and verified against package.json
- Architecture: HIGH — RPC pattern, badge pattern, parallel fetch pattern all directly confirmed from existing source code
- Pitfalls: HIGH — derived from reading existing RPCs and understanding the decision constraints in CONTEXT.md; CURRENT_DATE pitfall explicitly stated in STATE.md accumulated context
- SQL correctness: HIGH — date_trunc('week') Monday behavior is standard Postgres, generate_series is established; FOREACH over uuid[] confirmed from 00011 migration

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain — no external API dependencies)
