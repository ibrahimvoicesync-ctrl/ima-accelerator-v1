# Architecture Patterns

**Project:** IMA Accelerator v1.1 — Incremental Feature Integration
**Domain:** Student performance & coaching platform (Next.js App Router + Supabase)
**Researched:** 2026-03-27
**Confidence:** HIGH — all findings derived from direct codebase inspection of v1.0 source files

---

## Recommended Architecture

v1.1 adds no new structural layers. Every new feature uses the same pattern that already works in v1.0: async server component reads data and passes typed props to a small "use client" component for interactivity.

```
Server Component (page.tsx)
  └── reads DB with createAdminClient()
  └── computes derived values (at-risk, KPI aggregates, roadmap deadlines)
  └── passes typed props down to client islands

"use client" Component
  └── owns UI state only (active tab, modal open, selected duration, break timer)
  └── calls API routes for mutations via fetch()
  └── calls router.refresh() after mutations to re-run server component
```

The v1.1 changes are entirely additive at the structural level. No new route groups, no new layout layers, no new auth patterns.

---

## System Diagram (unchanged from v1.0, with v1.1 additions noted)

```
Browser
  └── "use client" islands:
      WorkTrackerClient (modified: duration selector, break timer)
      CalendarTab (new)
      ReportForm (modified: 5 new KPI fields)
      RoadmapClient (modified: passes joinedAt)
      RoadmapStep (modified: deadline status + completed_at)
      StudentDetailTabs (modified: work/reports → calendar)
      ProgressBanner (new, but server-rendered, no client state)
      StudentKPIBar (new, server-rendered, no client state)

Next.js Server
  └── proxy.ts (unchanged — route guard)
  └── (dashboard)/layout.tsx (modified: adds ProgressBanner for students)
  └── student/work/page.tsx (minor: passes flexible session context)
  └── student/roadmap/page.tsx (modified: passes joinedAt)
  └── coach/students/[studentId]/page.tsx (modified: aggregate query, no-limit fetch)
  └── owner/students/[studentId]/page.tsx (modified: aggregate query, no-limit fetch)
  └── api/work-sessions/route.ts (modified: session_minutes, auto cycle_number)
  └── api/work-sessions/[id]/route.ts (modified: duration from DB column)
  └── api/reports/route.ts (modified: 5 new KPI columns)
  └── src/lib/kpi.ts (new: shared pure computation functions)

Supabase
  └── work_sessions (modified: +session_minutes column, fixed constraints)
  └── daily_reports (modified: +5 outreach KPI columns)
  └── roadmap_progress (unchanged: completed_at already exists)
  └── users, invites, magic_links (unchanged)
```

---

## Feature-by-Feature Integration Analysis

### 1. Flexible Work Sessions

**Schema changes required.**

The `work_sessions` table has two constraints that must change:

- `cycle_number CHECK (cycle_number BETWEEN 1 AND 4)` — raise upper bound to allow unlimited cycles (e.g., `BETWEEN 1 AND 20`). The current cap prevents adding more sessions when a student wants to do a 5th cycle.
- `status CHECK (status IN ('in_progress', 'completed', 'abandoned'))` — add `'paused'`. The PATCH route already handles `paused` as a valid status in its state machine but the DDL check constraint does not include it. This is a latent bug in v1.0 that the migration fixes.
- Add `session_minutes INTEGER NOT NULL DEFAULT 45` column. Records the user-chosen duration per session at creation time. This decouples duration from config and allows past sessions to display accurate duration.

**Migration 00006:**

```sql
ALTER TABLE public.work_sessions
  DROP CONSTRAINT work_sessions_cycle_number_check,
  ADD CONSTRAINT work_sessions_cycle_number_check CHECK (cycle_number BETWEEN 1 AND 20),
  DROP CONSTRAINT work_sessions_status_check,
  ADD CONSTRAINT work_sessions_status_check
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'paused')),
  ADD COLUMN session_minutes INTEGER NOT NULL DEFAULT 45;
```

**API route: `POST /api/work-sessions`**

Changes:
- Remove `cycle_number` from client input — server computes it as `(max existing cycle_number for this student+date) + 1`. Prevents gaps and removes the constraint that client must track cycle numbers.
- Remove `max(WORK_TRACKER.cyclesPerDay)` constraint from postSchema.
- Accept `session_minutes: z.number().int().min(30).max(90)` in POST body. Store in the new column.

**API route: `PATCH /api/work-sessions/[id]`**

Changes:
- Change `duration_minutes` max from 60 to 90 in patchSchema.
- When completing a session, use `session.session_minutes` (read from the DB row) as the fallback value for `duration_minutes`, not `WORK_TRACKER.sessionMinutes`. This ensures a 60-min session records 60 min, not 45.

**WorkTrackerClient.tsx changes:**

- Add `useState<number>(45)` for `selectedMinutes`.
- Render duration selector (3 radio/button group: 30 / 45 / 60 min) in the idle state, above the Start button.
- Pass `session_minutes: selectedMinutes` in the POST body.
- Remove `WORK_TRACKER.cyclesPerDay` cycle cap: `allComplete` condition should be removed or user-defined. The "complete" state was based on `completedCount >= 4`. With no cap, consider replacing with a "Daily goal reached" message after 4 cycles but allowing more.
- Replace the fixed 4-slot grid (`Array.from({ length: WORK_TRACKER.cyclesPerDay })`) with a dynamic grid based on actual sessions plus one pending slot.
- Pass `activeSession.session_minutes * 60` to `<WorkTimer totalSeconds={...}>` instead of `WORK_TRACKER.sessionMinutes * 60`.

**WorkTimer.tsx changes:**

- `totalSeconds` prop already dynamic — no change to the component itself.
- ARIA label `of ${WORK_TRACKER.cyclesPerDay}` (currently "Cycle X of 4") — remove the "of 4" part since cycle count is now open-ended. Change to just `Cycle ${cycleNumber}`.

**Break timer — lives entirely in client state:**

After a session completes, WorkTrackerClient shows a break countdown. No server involvement.

```typescript
// In WorkTrackerClient after successful handleComplete():
setBreakSecondsRemaining(WORK_TRACKER.breakMinutes * 60);
// useEffect ticks it down, disables Start button during countdown
// When breakSecondsRemaining reaches 0, re-enable Start
```

Breaks are not persisted. If the user refreshes during a break, it resets — acceptable behavior.

**config.ts changes:**

```typescript
export const WORK_TRACKER = {
  sessionDurationOptions: [30, 45, 60] as const,  // new
  defaultSessionMinutes: 45,                        // replaces sessionMinutes
  breakMinutes: 15,                                 // unchanged
  dailyGoalCycles: 4,                              // renamed from cyclesPerDay, now informational only
  dailyGoalHours: 4,
  abandonGraceSeconds: 300,
} as const;
```

---

### 2. Progress Banner (Sticky Outreach KPI Bar)

**Where the banner goes:**

The dashboard layout (`(dashboard)/layout.tsx`) renders:

```tsx
<main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
  <ToastProvider>
    <div className="p-4 md:p-8">{children}</div>
  </ToastProvider>
</main>
```

The sticky banner goes **between `<ToastProvider>` and the padded `<div>`**, so it spans the full content-area width while sticky behavior pins it at the top of the scrollable area:

```tsx
<main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
  <ToastProvider>
    {profile.role === "student" && (
      <ProgressBanner
        lifetimeOutreach={lifetimeOutreach}
        todayOutreach={todayOutreach}
      />
    )}
    <div className="p-4 md:p-8">{children}</div>
  </ToastProvider>
</main>
```

The banner uses `sticky top-0 z-10` so it pins below the mobile top bar when the user scrolls.

**Aggregate query strategy:**

Use Supabase PostgREST aggregate syntax in the server component. Two queries, both run in the layout's `Promise.all`:

```typescript
// Only runs when profile.role === "student"
const [lifetimeResult, todayResult] = await Promise.all([
  admin
    .from("daily_reports")
    .select("outreach_count.sum()")
    .eq("student_id", profile.id)
    .not("submitted_at", "is", null)
    .single(),
  admin
    .from("daily_reports")
    .select("outreach_count.sum()")
    .eq("student_id", profile.id)
    .eq("date", todayStr)
    .not("submitted_at", "is", null)
    .single(),
]);
const lifetimeOutreach = (lifetimeResult.data as { sum: number } | null)?.sum ?? 0;
const todayOutreach = (todayResult.data as { sum: number } | null)?.sum ?? 0;
```

PostgREST aggregate functions (`sum()`, `count()`, `avg()`) are available in recent Supabase versions. This returns one integer per query — no row fetching overhead.

**ProgressBanner component:** New `src/components/student/ProgressBanner.tsx`. Server component (no "use client" needed — pure display). Renders:
- Lifetime progress bar: `lifetimeOutreach / KPI_TARGETS.lifetimeOutreach` with `role="progressbar"` ARIA
- Today's count vs `KPI_TARGETS.dailyOutreach` target
- Sticky, full content-area width, light background with blue accent
- Text: "X / 2,500 lifetime" and "X / 50 today"

**KPI config:** Add to `config.ts`:

```typescript
export const KPI_TARGETS = {
  lifetimeOutreach: 2500,
  dailyOutreach: 50,
} as const;
```

**When banner data refreshes:** The student submits a report → `router.refresh()` in ReportForm → layout re-runs → banner queries re-execute → new counts display. No client-side polling needed.

---

### 3. KPI Visibility on Coach/Owner Pages

**The duplication problem:**

The at-risk computation logic is identically implemented in both:
- `coach/students/[studentId]/page.tsx` (lines 71-102)
- `owner/students/[studentId]/page.tsx` (lines 105-137)

v1.1 is the right time to extract this into a shared utility.

**New file: `src/lib/kpi.ts`**

Pure functions, server-only imports (but not marked `server-only` since the functions themselves are pure — they just operate on already-fetched data):

```typescript
// Compute at-risk status from pre-fetched session and report arrays
export function computeAtRisk(
  sessions: { date: string }[],
  reports: { date: string; star_rating: number | null }[],
  config: { atRiskInactiveDays: number; atRiskRatingThreshold: number; reportInboxDays: number }
): { isAtRisk: boolean; reasons: string[] }

// Compute lifetime outreach from pre-fetched aggregate (already a number)
// or from a full reports array
export function computeLifetimeOutreach(
  reports: { outreach_count: number }[]
): number

// Compute roadmap deadline status per step
export function computeRoadmapDeadlineStatus(
  stepTargetDays: number,
  joinedAt: string,
  status: "locked" | "active" | "completed"
): "on-track" | "due-soon" | "overdue" | "done" | null
```

Both coach and owner detail pages import from `lib/kpi.ts`. No duplication.

**New component: `StudentKPIBar`**

New `src/components/shared/StudentKPIBar.tsx`. Server-renderable (no "use client"). Accepts pre-computed KPI values as props and renders a compact informational row under the student header in coach/owner views:

```typescript
interface StudentKPIBarProps {
  lifetimeOutreach: number;      // from aggregate query
  roadmapStep: number;           // current active step number
  roadmapTotalSteps: number;     // 10
  joinedAt: string;
}
```

**Data changes on coach/owner detail pages:**

Both pages currently query `daily_reports` with `.limit(20)` — sufficient for display but not for lifetime aggregate. Add a parallel aggregate query:

```typescript
const [sessionsResult, roadmapResult, reportsResult, lifetimeOutreachResult, ...] =
  await Promise.all([
    admin.from("work_sessions").select(...)...,
    admin.from("roadmap_progress").select("step_number, status, completed_at")...,  // add completed_at
    admin.from("daily_reports").select(...)...,
    admin.from("daily_reports")
      .select("outreach_count.sum()")
      .eq("student_id", student.id)
      .not("submitted_at", "is", null)
      .single(),
    ...
  ]);
```

No new API routes needed. KPIs are server-computed and passed as props.

---

### 4. Calendar View

**What replaces what:**

The 3 tabs (`work` | `roadmap` | `reports`) on coach/owner student detail pages become 2 tabs (`calendar` | `roadmap`). `WorkSessionsTab.tsx` and `ReportsTab.tsx` are deleted. `CalendarTab.tsx` is new.

**StudentDetailTabs.tsx changes:**

```typescript
// Before
export type TabKey = "work" | "roadmap" | "reports";
const tabs = [
  { key: "work", label: "Work Sessions" },
  { key: "roadmap", label: "Roadmap" },
  { key: "reports", label: "Reports" },
];

// After
export type TabKey = "calendar" | "roadmap";
const tabs = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
];
```

Default tab in `StudentDetailClient` and `OwnerStudentDetailClient` changes from `"work"` to `"calendar"`.

**Components deleted:**
- `src/components/coach/WorkSessionsTab.tsx`
- `src/components/coach/ReportsTab.tsx`

Verify: `ReportsTab` is only used in `StudentDetailClient` and `OwnerStudentDetailClient` — confirmed by inspection. `WorkSessionsTab` same. Both safe to delete.

**New component: `CalendarTab.tsx`**

`src/components/coach/CalendarTab.tsx` — "use client". Internal structure:

```
CalendarTab
  ├── state: currentMonth (Date), selectedDay (string | null)
  ├── MonthGrid — 7-column CSS grid
  │     └── DayCell[] — each shows colored indicators
  └── DayDetailPanel — rendered below grid when selectedDay !== null
        ├── sessions for that day (sorted by cycle_number)
        └── report for that day (outreach count, rating, hours, wins, improvements)
```

Month navigation (prev/next) uses `currentMonth` state only — no additional fetches.

**Data query changes on coach/owner detail pages:**

Remove row limits for the calendar to work correctly across the full student history:

```typescript
// Work sessions: remove .limit(120)
admin.from("work_sessions")
  .select("id, date, cycle_number, status, duration_minutes, session_minutes")  // add session_minutes
  .eq("student_id", student.id)
  .order("date", { ascending: false })  // no .limit()

// Daily reports: remove .limit(20)
admin.from("daily_reports")
  .select("id, date, hours_worked, star_rating, outreach_count, wins, improvements, reviewed_by,
           emails_sent, responses_received, influencers_signed, brand_pitches_sent, brand_deals_closed")
  .eq("student_id", student.id)
  .order("date", { ascending: false })  // no .limit()
```

A student's full history is small: ~365 session rows/year maximum (more with flexible sessions, but still < 1,500/year), ~365 report rows/year. Fetching without limit and filtering client-side for month navigation is correct at this scale.

**CalendarTab data flow:**

```
Initial load: all sessions + all reports passed as props
currentMonth state: default = today's month

Month navigation:
  setCurrentMonth(prev) / setCurrentMonth(next)
  daysInMonth derived from currentMonth
  sessionsByDate = sessions.filter(s => s.date starts with currentMonth YYYY-MM)
  reportsByDate = reports.filter(r => r.date starts with currentMonth YYYY-MM)
  Re-renders grid — zero network requests

Day cell click:
  setSelectedDay(dateStr)
  DayDetailPanel renders below grid with sessions + report for that date
```

---

### 5. Roadmap Date KPIs

**config.ts change:**

Add `target_days` to each `ROADMAP_STEPS` entry. These values represent "how many days after joining should this step be complete":

```typescript
export const ROADMAP_STEPS = [
  { step: 1, title: "Join the Course",          ..., target_days: 0  },
  { step: 2, title: "Plan Your Work",           ..., target_days: 3  },
  { step: 3, title: "Pick Your Niche",          ..., target_days: 7  },
  { step: 4, title: "Build Your Website",       ..., target_days: 21 },
  { step: 5, title: "Send Your First Email",    ..., target_days: 28 },
  { step: 6, title: "Get Your First Response",  ..., target_days: 35 },
  { step: 7, title: "Close Your First Influencer", ..., target_days: 60 },
  { step: 8, title: "Close 5 Influencers",     ..., target_days: 90 },
  { step: 9, title: "Brand Outreach",           ..., target_days: 120 },
  { step: 10, title: "Close Your First Brand Deal", ..., target_days: 180 },
] as const;
```

Note: specific values above are placeholders — need confirmation from Abu Lahya before shipping. The architecture accommodates any values.

**RoadmapStep.tsx changes:**

Currently receives `step: { step_number, title, description }` and `progress: RoadmapProgress | null`. Add `joinedAt: string` and `targetDays: number` props (both from parent).

Deadline status computation (use `computeRoadmapDeadlineStatus` from `lib/kpi.ts`):
- `completed` → show `completed_at` formatted as "Completed Mar 15, 2026"
- `locked` → no deadline indicator shown
- `active` + deadline in future (>3 days) → green "On Track" badge
- `active` + deadline within 3 days → yellow "Due Soon" badge
- `active` + past deadline → red "Overdue" badge

**RoadmapClient.tsx changes:**

Currently receives `progress: RoadmapProgress[]`. Add `joinedAt: string` prop. Pass it and the matching `target_days` from `ROADMAP_STEPS` config to each `<RoadmapStep>`.

**RoadmapPage (student) changes:**

The server component already has `user.joined_at` via `requireRole`. Pass it to `<RoadmapClient joinedAt={user.joined_at} progress={progress} />`.

**RoadmapTab (coach/owner) changes:**

Currently typed as `roadmap: { step_number, status }[]`. Expand type to include `completed_at: string | null`. The server query already selects `*` but the TypeScript type on the detail pages explicitly lists columns — add `completed_at` to the select string.

Pass `joined_at: student.joined_at` through StudentDetailClient props to RoadmapTab, which passes `joinedAt` and per-step `target_days` to step rendering.

**Completed_at display:**

`roadmap_progress.completed_at` already exists in the schema (timestamptz) and is populated when steps are completed. The `/api/roadmap` PATCH route sets `completed_at: new Date().toISOString()` on step completion. No schema change needed — just surface it in the UI.

---

### 6. New daily_reports Columns

**New columns (5 granular outreach KPIs):**

```sql
-- Migration 00007_add_outreach_kpi_columns.sql
ALTER TABLE public.daily_reports
  ADD COLUMN emails_sent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN responses_received INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN influencers_signed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN brand_pitches_sent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN brand_deals_closed INTEGER NOT NULL DEFAULT 0;
```

All `NOT NULL DEFAULT 0`. Existing rows instantly valid. No backfill needed. Existing queries continue to work — Postgres returns new columns as 0 even on `SELECT *` queries that were already working.

**RLS trigger change:**

The `restrict_coach_report_update()` trigger lists columns explicitly to prevent coaches from modifying student report content. The 5 new columns must be added to the freeze list:

```sql
CREATE OR REPLACE FUNCTION public.restrict_coach_report_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (select get_user_role()) = 'coach' THEN
    NEW.student_id           := OLD.student_id;
    NEW.date                 := OLD.date;
    NEW.hours_worked         := OLD.hours_worked;
    NEW.star_rating          := OLD.star_rating;
    NEW.outreach_count       := OLD.outreach_count;
    NEW.wins                 := OLD.wins;
    NEW.improvements         := OLD.improvements;
    NEW.submitted_at         := OLD.submitted_at;
    NEW.created_at           := OLD.created_at;
    -- New v1.1 columns (coaches cannot modify):
    NEW.emails_sent          := OLD.emails_sent;
    NEW.responses_received   := OLD.responses_received;
    NEW.influencers_signed   := OLD.influencers_signed;
    NEW.brand_pitches_sent   := OLD.brand_pitches_sent;
    NEW.brand_deals_closed   := OLD.brand_deals_closed;
  END IF;
  RETURN NEW;
END;
$$;
```

**API route: `POST /api/reports/route.ts`**

Add 5 new optional fields to `postSchema`:

```typescript
const postSchema = z.object({
  date: ...,
  hours_worked: ...,
  star_rating: ...,
  outreach_count: ...,
  wins: ...,
  improvements: ...,
  // New v1.1 fields:
  emails_sent: z.number().int().min(0).max(VALIDATION.outreachKpi.max).default(0),
  responses_received: z.number().int().min(0).max(VALIDATION.outreachKpi.max).default(0),
  influencers_signed: z.number().int().min(0).max(VALIDATION.outreachKpi.max).default(0),
  brand_pitches_sent: z.number().int().min(0).max(VALIDATION.outreachKpi.max).default(0),
  brand_deals_closed: z.number().int().min(0).max(VALIDATION.outreachKpi.max).default(0),
});
```

Add `outreachKpi: { max: 500 }` to the `VALIDATION` object in `config.ts`.

Include all 5 fields in the insert/update payload.

**ReportForm.tsx changes:**

Add "Outreach KPIs" section with 5 new number inputs. All optional (default 0). Group them visually below the existing `outreach_count` field. Each input needs `aria-label` and `min-h-[44px]` per hard rules.

---

## Component Inventory

### New Components

| Component | Path | Type | Purpose |
|-----------|------|------|---------|
| `ProgressBanner` | `src/components/student/ProgressBanner.tsx` | Server | Sticky lifetime + daily outreach KPI bar (student layout only) |
| `StudentKPIBar` | `src/components/shared/StudentKPIBar.tsx` | Server | Read-only KPI summary on coach/owner student detail pages |
| `CalendarTab` | `src/components/coach/CalendarTab.tsx` | use client | Month grid + day detail panel, replaces WorkSessionsTab + ReportsTab |

### Modified Components

| Component | Path | Change Summary |
|-----------|------|---------------|
| `WorkTrackerClient` | `src/components/student/WorkTrackerClient.tsx` | Duration selector, break timer, no cycle cap, dynamic cycle grid |
| `WorkTimer` | `src/components/student/WorkTimer.tsx` | Remove `of ${cyclesPerDay}` from ARIA label |
| `ReportForm` | `src/components/student/ReportForm.tsx` | 5 new outreach KPI integer inputs |
| `RoadmapClient` | `src/components/student/RoadmapClient.tsx` | Accept + pass `joinedAt` prop |
| `RoadmapStep` | `src/components/student/RoadmapStep.tsx` | Show deadline status badge + completed_at timestamp |
| `StudentDetailTabs` | `src/components/coach/StudentDetailTabs.tsx` | Replace work/reports tabs with calendar tab |
| `StudentDetailClient` | `src/components/coach/StudentDetailClient.tsx` | Replace WorkSessionsTab/ReportsTab with CalendarTab, add joined_at to roadmap pass-through |
| `OwnerStudentDetailClient` | `src/components/owner/OwnerStudentDetailClient.tsx` | Same tab changes, add KPIBar |
| `RoadmapTab` | `src/components/coach/RoadmapTab.tsx` | Accept completed_at + joined_at for deadline display |

### Deleted Components

| Component | Path | Reason |
|-----------|------|--------|
| `WorkSessionsTab` | `src/components/coach/WorkSessionsTab.tsx` | Replaced by CalendarTab |
| `ReportsTab` | `src/components/coach/ReportsTab.tsx` | Replaced by CalendarTab |

### New Library Files

| File | Purpose |
|------|---------|
| `src/lib/kpi.ts` | Shared pure functions: computeAtRisk, computeLifetimeOutreach, computeRoadmapDeadlineStatus |

---

## Data Flow Changes

### Flexible Sessions

```
Idle state: student sees duration selector (30/45/60 min)
  → useState selectedMinutes (default 45)

Start button:
  POST /api/work-sessions { date, session_minutes: selectedMinutes }
  Server: SELECT MAX(cycle_number) WHERE student_id+date → next_cycle = max + 1
  Server: INSERT { student_id, date, cycle_number: next_cycle, session_minutes, started_at, status: 'in_progress' }
  Client: router.refresh() → page re-renders with new session

Session completes:
  PATCH /api/work-sessions/[id] { status: 'completed' }
  Server: reads session.session_minutes → sets duration_minutes = session_minutes
  Client: setBreakSecondsRemaining(WORK_TRACKER.breakMinutes * 60)
  Client: useEffect ticks break countdown (client-only, no API)
  Break ends: re-enable Start button, show next cycle duration selector
```

### Progress Banner

```
Every student page load:
  Dashboard layout server component:
    profile.role === 'student' ? run two aggregate queries in Promise.all
    SELECT SUM(outreach_count) WHERE student_id = X → lifetimeOutreach
    SELECT SUM(outreach_count) WHERE student_id = X AND date = today → todayOutreach
    Render <ProgressBanner lifetimeOutreach todayOutreach />

Student submits/updates report:
  ReportForm → POST /api/reports
  router.refresh() → layout re-runs → banner queries re-execute → fresh counts
```

### Calendar

```
Coach/Owner student detail page load:
  Server queries (no limit):
    all sessions (includes session_minutes)
    all reports (includes new KPI columns)
  Pass as sessions[] and reports[] to StudentDetailClient / OwnerStudentDetailClient
  Client renders <CalendarTab sessions={sessions} reports={reports} />

CalendarTab internal:
  useState: currentMonth = today's month, selectedDay = null
  Month navigation: prev/next buttons → setCurrentMonth → re-derive filtered data
  Day click: setSelectedDay(dateStr) → DayDetailPanel slides in below grid
  All interactions are pure client state — zero network requests after initial load
```

### KPI on Coach/Owner Pages

```
Coach/Owner student detail page:
  Promise.all includes new aggregate query:
    SELECT SUM(outreach_count) WHERE student_id = X AND submitted_at IS NOT NULL
  roadmap query adds completed_at to select
  lib/kpi.computeAtRisk(sessions, reports, COACH_CONFIG) replaces inline computation
  StudentKPIBar rendered in student header area with pre-computed values
```

---

## Migration Files

| File | Purpose | Risk |
|------|---------|------|
| `supabase/migrations/00006_flexible_sessions.sql` | Add session_minutes column, raise cycle_number check, fix status check | Low — additive with DEFAULT, constraint relaxation only |
| `supabase/migrations/00007_add_outreach_kpi_columns.sql` | Add 5 integer columns to daily_reports + update restrict_coach_report_update trigger | Low — additive with DEFAULT 0, trigger update is a DROP/CREATE replace |

Both migrations are additive. Existing queries continue to work. Existing rows remain valid.

---

## Suggested Build Order

Dependencies flow top-to-bottom. Build in this order to avoid blocked work:

**Phase 1 — Schema and Config (no UI dependencies, everything else needs these)**
1. Migration 00006: flexible sessions
2. Migration 00007: outreach KPI columns + trigger update
3. `config.ts`: add `sessionDurationOptions`, `defaultSessionMinutes`, `KPI_TARGETS`, `target_days` on `ROADMAP_STEPS`
4. `VALIDATION` in config.ts: add `outreachKpi.max`

**Phase 2 — API Routes (depend on Phase 1 schema)**
5. `POST /api/work-sessions`: accept `session_minutes`, auto-compute `cycle_number`
6. `PATCH /api/work-sessions/[id]`: use `session.session_minutes` for duration
7. `POST /api/reports`: accept + store 5 new KPI fields

**Phase 3 — Shared Library (depends on nothing, used by Phases 4-6)**
8. `src/lib/kpi.ts`: computeAtRisk, computeLifetimeOutreach, computeRoadmapDeadlineStatus

**Phase 4 — Student-facing features (depend on Phase 1-3)**
9. `WorkTrackerClient`: duration selector, break timer, dynamic cycle grid (depends on Phase 2 API)
10. `ReportForm`: 5 new KPI fields (depends on Phase 2 API)
11. `RoadmapStep`: deadline status badge + completed_at (depends on Phase 1 config)
12. `RoadmapClient`: accept + pass `joinedAt` (depends on Phase 11)
13. `student/roadmap/page.tsx`: pass `user.joined_at` to RoadmapClient

**Phase 5 — Progress Banner (depends on Phase 1 config, Phase 3 lib)**
14. `ProgressBanner` component (depends on Phase 1 KPI_TARGETS)
15. `(dashboard)/layout.tsx`: add aggregate queries + ProgressBanner for student role

**Phase 6 — Coach/Owner KPI visibility (depends on Phase 3, 4)**
16. `StudentKPIBar` component
17. `coach/students/[studentId]/page.tsx`: add aggregate query, update roadmap select, use lib/kpi.ts
18. `owner/students/[studentId]/page.tsx`: same
19. `RoadmapTab`: accept + pass `completed_at`, `joined_at` for deadline display

**Phase 7 — Calendar (depends on Phase 6 — query changes in Phase 6 remove limits)**
20. `StudentDetailTabs`: replace work/reports tabs with calendar
21. `CalendarTab`: MonthGrid + DayDetailPanel
22. `StudentDetailClient` + `OwnerStudentDetailClient`: replace WorkSessionsTab/ReportsTab with CalendarTab
23. Delete `WorkSessionsTab.tsx`, `ReportsTab.tsx`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Persisting Break Timer to Server
**What:** Adding a `break_started_at` column to `work_sessions` or a separate `break_sessions` table.
**Why bad:** Breaks are a UI concern, not data. Adds DB writes and schema complexity for a countdown that resets on page refresh anyway.
**Instead:** Client `useState` + `useEffect` countdown. Break ends when `breakSecondsRemaining <= 0`.

### Anti-Pattern 2: Client-Side Aggregate Computation for Banner
**What:** Fetching all `daily_reports` rows to the ProgressBanner client component and summing `outreach_count` in JavaScript.
**Why bad:** Transfers potentially hundreds of rows for a single number. Violates server-first pattern.
**Instead:** PostgREST `outreach_count.sum()` aggregate in the server component. One integer back per query.

### Anti-Pattern 3: Per-Month API Calls in Calendar
**What:** Fetching sessions and reports from the server each time the user clicks prev/next month in CalendarTab.
**Why bad:** Latency on every month flip, requires loading state, complex error handling. A student's full history is small.
**Instead:** Fetch all sessions and all reports (no limit) on initial page load. Filter by month entirely client-side. Zero network requests during calendar navigation.

### Anti-Pattern 4: Keeping At-Risk Logic Duplicated
**What:** Continuing to copy-paste the at-risk computation between coach and owner detail pages.
**Why bad:** Two sources of truth. Already diverged slightly in v1.0 (same logic but copied). Will diverge further.
**Instead:** Extract to `src/lib/kpi.ts` and import in both pages. v1.1 is the right time to fix this.

### Anti-Pattern 5: Hardcoding KPI Targets in Components
**What:** Writing `2500` or `50` inside ProgressBanner or StudentKPIBar components.
**Why bad:** Targets will change. Not discoverable without reading the component file.
**Instead:** `KPI_TARGETS` in `config.ts`. Same pattern as `WORK_TRACKER`, `DAILY_REPORT`, `COACH_CONFIG`.

### Anti-Pattern 6: Adding cycle_number to POST body with client-computed values
**What:** Client computes next cycle number and sends it in POST body (current v1.0 pattern, inherits from pre-flexible-sessions design).
**Why bad:** Race condition if two sessions start simultaneously; client must track session count; constrains flexibility.
**Instead:** Server computes `MAX(cycle_number) + 1` for the student+date. Client sends only `date` and `session_minutes`.

---

## Scalability Considerations

All v1.1 changes remain appropriate for v1 scale (< 1,000 students).

| Concern | Approach | Notes |
|---------|----------|-------|
| Aggregate queries in layout | PostgREST SUM — single round-trip | Fine for all V1 users |
| Calendar data (no limit) | Fetch all, filter client-side | ~500 sessions/year max per student — trivial |
| Break timer | Client-only state | No server cost |
| 5 new daily_reports columns | NOT NULL DEFAULT 0 | Zero migration cost |
| Roadmap deadline computation | Pure function on small array | No DB involvement |

---

## Sources

All findings derived from direct codebase inspection of v1.0 source (HIGH confidence).

| File Inspected | Finding |
|----------------|---------|
| `src/app/(dashboard)/layout.tsx` | Banner insertion point, profile.role available for conditional rendering |
| `src/app/(dashboard)/student/work/page.tsx` | Server component pattern for work tracker |
| `src/components/student/WorkTrackerClient.tsx` | Cycle cap logic, cyclesPerDay grid, handleStart POST body |
| `src/components/student/WorkTimer.tsx` | totalSeconds prop already dynamic |
| `src/app/api/work-sessions/route.ts` | POST schema cycle_number constraint, cyclesPerDay max |
| `src/app/api/work-sessions/[id]/route.ts` | PATCH schema duration_minutes max(60), WORK_TRACKER.sessionMinutes fallback |
| `src/components/coach/StudentDetailClient.tsx` | Tab architecture, TabKey type |
| `src/components/coach/StudentDetailTabs.tsx` | TabKey = "work" | "roadmap" | "reports" — to be changed |
| `src/components/coach/WorkSessionsTab.tsx` | Component to be deleted |
| `src/components/coach/ReportsTab.tsx` | Component to be deleted |
| `src/components/owner/OwnerStudentDetailClient.tsx` | Duplicated at-risk logic confirmed |
| `src/app/(dashboard)/coach/students/[studentId]/page.tsx` | At-risk computation, .limit(120)/.limit(20), select columns |
| `src/app/(dashboard)/owner/students/[studentId]/page.tsx` | Same pattern, confirmed duplication |
| `src/app/(dashboard)/student/roadmap/page.tsx` | completed_at already populated, user.joined_at available |
| `src/components/student/RoadmapClient.tsx` | Step iteration, needs joinedAt prop |
| `supabase/migrations/00001_create_tables.sql` | Full schema: cycle_number constraint, status constraint, completed_at exists, restrict_coach_report_update trigger |
| `src/lib/config.ts` | WORK_TRACKER, ROADMAP_STEPS (no target_days), VALIDATION constants |
| `src/app/api/reports/route.ts` | POST schema, insert/update payload structure |
