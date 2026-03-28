# Phase 17: Calendar View - Research

**Researched:** 2026-03-28
**Domain:** React calendar UI, month-scoped Supabase queries, tab restructuring, inline day detail panel
**Confidence:** HIGH

## Summary

Phase 17 replaces the Work Sessions and Reports tabs on coach/owner student detail pages with a single Calendar tab. The calendar renders a month grid where each day cell carries a color indicator (green = work sessions + report both present, amber = one of the two, empty = neither). Clicking a day opens an inline detail panel showing that day's sessions and report side by side.

The entire implementation is pure UI/data-fetching work — no database migrations, no new API routes (all data fetching is server-side reads via `createAdminClient()`). The key library is `react-day-picker@9.14.0`, already decided in STATE.md and compatible with React 19 and `date-fns@^4.1.0` (already installed). Month navigation uses `?month=YYYY-MM` search params, meaning the server page re-renders on month change — this is the established pattern from STATE.md.

Both `StudentDetailClient` and `OwnerStudentDetailClient` currently receive `sessions` and `reports` as props from their server pages. Phase 17 replaces those props with month-scoped calendar data. The tab union type `TabKey = "work" | "roadmap" | "reports"` becomes `"calendar" | "roadmap"`. The shared `StudentDetailTabs` component is updated accordingly.

**Primary recommendation:** Build a custom `CalendarTab` client component that wraps `react-day-picker@9.14.0` with a custom `DayButton` component for dot indicators, inline day-detail state, and month navigation via router + search params. Server pages fetch month-scoped sessions and reports using `?month=YYYY-MM` bounds.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — user skipped discussion. All implementation areas are Claude's discretion.

### Claude's Discretion
All implementation areas deferred to Claude:
- **Day detail panel** — How clicking a day cell displays session + report data (inline expand, side panel, modal). Desktop vs mobile layout for side-by-side vs stacked content.
- **Activity indicators** — Visual style for green (work + report), amber (partial), empty day indicators (dots, background fills, borders). Month grid cell sizing and density.
- **Tab restructuring** — How Calendar tab replaces Work Sessions + Reports tabs. Tab naming, default tab state, URL param behavior (`?tab=calendar` replacing `?tab=work` and `?tab=reports`).
- **Empty/edge states** — What shows for months before student joined, future dates, months with zero activity. Navigation limits (how far back/forward).
- **Calendar grid implementation** — Using `react-day-picker@^9.14.0` (already decided in STATE.md) or custom grid. Styling to match ima-* design tokens.
- **Data fetching strategy** — Month-scoped queries using `?month=YYYY-MM` search params (already decided in STATE.md). Server-side fetch vs client-side day detail loading.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | Month grid calendar on coach and owner student detail pages with day indicators (green = work + report, amber = partial, empty = nothing) | `react-day-picker@9.14.0` custom `DayButton` component renders dots per day; indicator logic derived from month-scoped data maps |
| CAL-02 | Clicking a day opens inline panel showing that day's work sessions and report side by side | React `useState` for `selectedDate`; inline conditional render below calendar grid using existing `Card`/`CardContent`/`Badge` primitives |
| CAL-03 | Month navigation (prev/next) with current month as default; no stale/truncated data | `DayPicker` `month` + `onMonthChange` props; `router.push` updates `?month=YYYY-MM`; server page re-fetches scoped data on navigation |
| CAL-04 | Calendar tab replaces Work Sessions and Reports tabs; Roadmap stays as separate tab | `TabKey` union updated to `"calendar" \| "roadmap"`; `StudentDetailTabs` tabs array updated; both client components updated |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-day-picker | 9.14.0 | Month grid calendar rendering | Pre-decided in STATE.md; React 19 compat fixed in v9.4.3; latest v9 |
| date-fns | 4.1.0 | Date math (month bounds, day-of-month, formatting) | Already installed; react-day-picker v9 peer dep; well-typed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.576.0 (installed) | Icons (ChevronLeft/Right for nav, CalendarDays for empty state) | Already in project; use for calendar empty state icon |
| next/navigation useRouter | (Next.js 16) | Month navigation via URL search params | Used for `?month=YYYY-MM` push; consistent with tab URL pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-day-picker | Custom CSS grid | Custom grid avoids library but DayPicker handles week alignment, outside days, ARIA keyboard nav, and locale — rebuild cost not worth it |
| Server re-render on month change | Client-side fetch on month change | Server re-render keeps data fetching in server components (admin client pattern); avoids client-side admin leaks; consistent with project architecture |

**Installation:**
```bash
npm install react-day-picker@^9.14.0
```

**Version verification:** `react-day-picker@9.14.0` confirmed as latest v9 on npm registry (2026-03-28). `date-fns@4.1.0` already installed — react-day-picker v9 dep `^4.1.0` satisfied.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/coach/
│   ├── StudentDetailTabs.tsx       # EDIT: TabKey "work"|"roadmap"|"reports" -> "calendar"|"roadmap"
│   ├── StudentDetailClient.tsx     # EDIT: remove sessions/reports props; add calendarData prop
│   ├── CalendarTab.tsx             # NEW: DayPicker wrapper + day detail panel (client component)
│   ├── WorkSessionsTab.tsx         # DELETE (or keep for reference — not rendered)
│   └── ReportsTab.tsx              # DELETE (or keep for reference — not rendered)
├── components/owner/
│   └── OwnerStudentDetailClient.tsx # EDIT: same as StudentDetailClient
├── app/(dashboard)/coach/students/[studentId]/page.tsx  # EDIT: month-scoped queries
└── app/(dashboard)/owner/students/[studentId]/page.tsx  # EDIT: month-scoped queries
```

### Pattern 1: Month-Scoped Server Fetch

**What:** Server page reads `?month=YYYY-MM` search param, computes first/last day of month, queries `work_sessions` and `daily_reports` within those bounds using `.gte`/`.lte` on the `date` column.

**When to use:** On every page render (including month navigation — router.push triggers server re-render).

**Example:**
```typescript
// In server page
const { month } = await searchParams;
const monthStr = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : getTodayUTC().slice(0, 7);
const firstDay = `${monthStr}-01`;
const lastDay = new Date(new Date(firstDay + "T00:00:00Z").setUTCMonth(new Date(firstDay + "T00:00:00Z").getUTCMonth() + 1, 0)).toISOString().split("T")[0];

// Parallel fetch
const [sessionsResult, reportsResult] = await Promise.all([
  admin.from("work_sessions")
    .select("id, date, cycle_number, status, duration_minutes")
    .eq("student_id", student.id)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date"),
  admin.from("daily_reports")
    .select("id, date, hours_worked, star_rating, outreach_count, brands_contacted, influencers_contacted, calls_joined, wins, improvements, reviewed_by")
    .eq("student_id", student.id)
    .gte("date", firstDay)
    .lte("date", lastDay)
    .order("date"),
]);
```

### Pattern 2: CalendarTab Client Component

**What:** Client component receives pre-fetched month sessions and reports as props. Builds lookup maps keyed by `YYYY-MM-DD`. Renders `DayPicker` with a custom `DayButton` that reads from the maps to show indicators. Tracks `selectedDate` in state to show inline day detail.

**When to use:** The Calendar tab content — a single `CalendarTab` used in both coach and owner client components.

**Example:**
```typescript
// Source: Official DayPicker v9 docs + project patterns
"use client";

import { useState } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { useRouter } from "next/navigation";

type DayActivity = "full" | "partial" | "none";

type CalendarTabProps = {
  sessions: SessionRow[];
  reports: ReportRow[];
  currentMonth: string;   // "YYYY-MM"
  studentId: string;
  role: "coach" | "owner";
};

export function CalendarTab({ sessions, reports, currentMonth, studentId, role }: CalendarTabProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build lookup maps
  const sessionsByDate = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const list = sessionsByDate.get(s.date) ?? [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }
  const reportByDate = new Map<string, ReportRow>();
  for (const r of reports) reportByDate.set(r.date, r);

  function getActivity(dateStr: string): DayActivity {
    const hasSessions = (sessionsByDate.get(dateStr)?.length ?? 0) > 0;
    const hasReport = reportByDate.has(dateStr);
    if (hasSessions && hasReport) return "full";
    if (hasSessions || hasReport) return "partial";
    return "none";
  }

  // Custom DayButton renders date number + activity dot
  function ActivityDayButton(props: DayButtonProps) {
    const { day, modifiers, ...buttonProps } = props;
    const dateStr = day.date.toISOString().split("T")[0];
    const activity = getActivity(dateStr);
    return (
      <button {...buttonProps} className={`${buttonProps.className ?? ""} flex flex-col items-center gap-0.5`}>
        <span>{day.date.getDate()}</span>
        {activity === "full" && (
          <span className="w-1.5 h-1.5 rounded-full bg-ima-success" aria-hidden="true" />
        )}
        {activity === "partial" && (
          <span className="w-1.5 h-1.5 rounded-full bg-ima-warning" aria-hidden="true" />
        )}
        {activity === "none" && (
          <span className="w-1.5 h-1.5 rounded-full bg-transparent" aria-hidden="true" />
        )}
      </button>
    );
  }

  function handleMonthChange(newMonth: Date) {
    const mm = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, "0")}`;
    const base = role === "coach" ? `/coach/students/${studentId}` : `/owner/students/${studentId}`;
    router.push(`${base}?tab=calendar&month=${mm}`);
  }

  const monthDate = new Date(`${currentMonth}-01T00:00:00Z`);

  return (
    <div role="tabpanel" id="tabpanel-calendar" aria-labelledby="tab-calendar" className="space-y-4">
      <DayPicker
        month={monthDate}
        onMonthChange={handleMonthChange}
        components={{ DayButton: ActivityDayButton }}
        showOutsideDays={false}
        onDayClick={(date) => {
          const dateStr = date.toISOString().split("T")[0];
          setSelectedDate(selectedDate === dateStr ? null : dateStr);
        }}
      />
      {selectedDate && <DayDetailPanel date={selectedDate} sessions={sessionsByDate.get(selectedDate) ?? []} report={reportByDate.get(selectedDate) ?? null} />}
    </div>
  );
}
```

### Pattern 3: Inline Day Detail Panel

**What:** Below the calendar grid, show sessions and report for the selected day. On desktop (`md:` breakpoint): side-by-side columns. On mobile: stacked. Uses existing `Card`, `CardContent`, `Badge` primitives and `formatHoursMinutes` from `utils.ts`.

**When to use:** When `selectedDate` is non-null after clicking a day cell.

**Example:**
```typescript
function DayDetailPanel({ date, sessions, report }: {
  date: string;
  sessions: SessionRow[];
  report: ReportRow | null;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4 motion-safe:animate-slideUp">
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-ima-text mb-3">Work Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-ima-text-secondary">No sessions this day.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm text-ima-text">Cycle {s.cycle_number}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[s.status] ?? "default"} size="sm">
                      {s.status.replace("_", " ")}
                    </Badge>
                    {s.status === "completed" && (
                      <span className="text-xs text-ima-text-secondary">{formatHoursMinutes(s.duration_minutes)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-ima-text mb-3">Daily Report</h3>
          {!report ? (
            <p className="text-sm text-ima-text-secondary">No report submitted.</p>
          ) : (
            <div className="space-y-2 text-sm text-ima-text-secondary">
              <div>Hours: <span className="text-ima-text">{report.hours_worked}h</span></div>
              <div>Brands contacted: <span className="text-ima-text">{report.brands_contacted}</span></div>
              <div>Influencers contacted: <span className="text-ima-text">{report.influencers_contacted}</span></div>
              <div>Calls joined: <span className="text-ima-text">{report.calls_joined}</span></div>
              {report.wins && <div>Wins: <span className="text-ima-text">{report.wins}</span></div>}
              {report.improvements && <div>Improvements: <span className="text-ima-text">{report.improvements}</span></div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Pattern 4: Tab Key Update + URL Param Behavior

**What:** `TabKey` type drops `"work"` and `"reports"`, adds `"calendar"`. Default tab changes from `"work"` to `"calendar"`. URL param `?tab=calendar` replaces `?tab=work`/`?tab=reports`. Month navigation pushes `?tab=calendar&month=YYYY-MM`.

**Example:**
```typescript
// StudentDetailTabs.tsx
export type TabKey = "calendar" | "roadmap";

const tabs: { key: TabKey; label: string }[] = [
  { key: "calendar", label: "Calendar" },
  { key: "roadmap", label: "Roadmap" },
];
```

```typescript
// In client component state init
const [activeTab, setActiveTab] = useState<TabKey>(
  (initialTab === "roadmap" ? "roadmap" : "calendar") as TabKey
);
```

### Anti-Patterns to Avoid
- **Fetching all sessions without month bounds:** The server pages currently fetch `sessions.limit(120)` and `reports.limit(20)`. For calendar, queries MUST use `.gte("date", firstDay).lte("date", lastDay)` — never a row limit + client-side filter. This is explicitly documented in STATE.md as a Critical Implementation Note.
- **Client-side month data loading:** Month navigation must trigger server re-render via `router.push`, not a client-side fetch. This keeps admin client access in server code only.
- **DayPicker CSS import in App Router:** `react-day-picker/style.css` cannot be imported in a `"use client"` component in App Router without adding it to `globals.css` or a layout. Use `classNames` prop or custom `DayButton` overrides instead of relying on the default stylesheet if it causes import issues.
- **`router.push` during tab change:** Tab change for `"calendar"` vs `"roadmap"` should use `window.history.replaceState` (matching existing tab pattern). Only month navigation uses `router.push` (which triggers server re-render for data refresh).
- **selectedDate surviving month change:** Reset `selectedDate` to `null` when `onMonthChange` fires — stale detail panel for a date in the previous month is confusing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month grid with week alignment | Custom CSS grid with `new Date()` math | `react-day-picker@9.14.0` | Week alignment across months, leap years, Jan/Dec edges, outside days, keyboard nav, and screen reader ARIA are all handled |
| UTC-safe date formatting | `toLocaleDateString()` with timezone assumptions | `date-fns` format with explicit UTC parsing: `new Date(dateStr + "T00:00:00Z")` | Project already uses `+ "T00:00:00Z"` suffix throughout for UTC consistency |
| Month bounds calculation | Rolling manual last-day-of-month logic | `date-fns` `startOfMonth` / `endOfMonth` or a one-liner with `setUTCMonth(m+1, 0)` | Edge cases: Feb 28/29, 30-day months |
| Day click ARIA announcements | `aria-live` region per click | `DayPicker` `footer` prop with `aria-live="polite"` | Built-in live region support in react-day-picker |

**Key insight:** react-day-picker v9's `components` prop makes custom day cells with dots trivial — `DayButton` receives the date and full modifiers map, so no external state wiring is needed for per-day rendering.

---

## Common Pitfalls

### Pitfall 1: DayPicker Default Stylesheet Conflicts
**What goes wrong:** `react-day-picker/style.css` applies its own fonts, colors, and spacing that conflict with ima-* tokens and Tailwind 4.
**Why it happens:** The default stylesheet is opinionated and expects to own calendar styling.
**How to avoid:** Do NOT import `react-day-picker/style.css`. Instead, override all visuals via the `classNames` prop (maps to Tailwind classes) or via the custom `DayButton` component. The `classNames` prop accepts all internal element names as keys.
**Warning signs:** Calendar grid shows gray backgrounds, wrong font sizes, or non-ima-* colors.

### Pitfall 2: UTC Date Mismatch in Day Indicators
**What goes wrong:** `day.date` in `DayButton` is a JavaScript `Date` object. Calling `.toISOString().split("T")[0]` returns a UTC date, but `day.date.getFullYear()/getMonth()/getDate()` returns local time. If the user is in UTC+5, a session on `2026-03-15` may render on `2026-03-14` in the indicator lookup.
**Why it happens:** `react-day-picker` creates `Date` objects from the month's calendar math; their UTC vs local interpretation depends on how they were constructed.
**How to avoid:** In `DayButton`, derive `dateStr` using UTC methods: `${day.date.getUTCFullYear()}-${String(day.date.getUTCMonth()+1).padStart(2,"0")}-${String(day.date.getUTCDate()).padStart(2,"0")}`. This matches the `YYYY-MM-DD` format stored in the database.
**Warning signs:** Indicators appear one day off; today's date shows wrong dot color.

### Pitfall 3: Month Param Not Validated on Server
**What goes wrong:** Server page reads `?month=YYYY-MM` from `searchParams` without validation — a malformed value (`?month=foo`) causes a bad date query or error.
**Why it happens:** `searchParams` is always a string from URL input.
**How to avoid:** Validate with `/^\d{4}-\d{2}$/.test(month)` before using it. Fall back to `getTodayUTC().slice(0, 7)` for the current month.
**Warning signs:** Supabase query errors in the server log; blank calendar with no data.

### Pitfall 4: `router.push` vs `replaceState` for Tab vs Month
**What goes wrong:** Using `router.push` for tab changes causes browser history pollution (users get a history entry per tab click). Using `window.history.replaceState` for month changes means the server component never re-renders and stale data is shown.
**Why it happens:** Two different navigation patterns required for two different purposes.
**How to avoid:** Tab changes (`"calendar"` ↔ `"roadmap"`) use `window.history.replaceState` — no server re-render needed. Month changes use `router.push` — triggers server re-render and fresh data fetch.
**Warning signs:** Back button broken after tab switching; or month change shows previous month's data.

### Pitfall 5: `selectedDate` From Previous Month
**What goes wrong:** User clicks March 15 in the panel, opens detail. They navigate to April. The detail panel still shows March 15 content — mismatched with the displayed April calendar.
**Why it happens:** `selectedDate` state persists across month navigation.
**How to avoid:** Call `setSelectedDate(null)` inside `onMonthChange` before pushing the new route.
**Warning signs:** Detail panel shows content that doesn't match any visible day cell.

### Pitfall 6: Prop Interface Mismatch After Removing sessions/reports
**What goes wrong:** Server pages still pass `sessions` and `reports` props to client components after those props are removed; TypeScript catches this but only at compile time.
**Why it happens:** Both `StudentDetailClient` and `OwnerStudentDetailClient` currently accept and use `sessions`/`reports` props. Removing them requires updates to both the component interface AND the server page call sites.
**How to avoid:** Update client component prop interface, then fix server pages in the same task. Run `npx tsc --noEmit` to verify.
**Warning signs:** TypeScript errors on `sessions` / `reports` prop names in server pages after client component update.

### Pitfall 7: `outreach_count` vs Granular KPI Columns in Day Detail
**What goes wrong:** `ReportsTab` currently uses `outreach_count` (the legacy aggregate). For the calendar day detail panel, show the granular columns (`brands_contacted`, `influencers_contacted`, `calls_joined`) from Phase 15 — these are what coaches actually want to see.
**Why it happens:** `ReportsTab` was written before Phase 15 expanded the schema.
**How to avoid:** Day detail panel report query selects `brands_contacted, influencers_contacted, calls_joined` (already in the recommended query above). Do not reuse `ReportsTab`'s field set.
**Warning signs:** Day detail shows a single `outreach_count` field instead of the three granular KPI fields.

---

## Code Examples

Verified patterns from official sources and project codebase:

### UTC-safe Day Date String in DayButton
```typescript
// Derives YYYY-MM-DD from DayPicker's Date object without local time offset
function dateStrFromDayPickerDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
```

### Month Bounds Calculation
```typescript
// Server page — compute first/last day for month-scoped query
function getMonthBounds(monthStr: string): { firstDay: string; lastDay: string } {
  const firstDay = `${monthStr}-01`;
  const d = new Date(firstDay + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1, 0); // last day of month
  const lastDay = d.toISOString().split("T")[0];
  return { firstDay, lastDay };
}
// e.g. getMonthBounds("2026-03") -> { firstDay: "2026-03-01", lastDay: "2026-03-31" }
```

### DayPicker Without Default Stylesheet (classNames approach)
```typescript
// Source: react-day-picker v9 official docs + project tailwind tokens
<DayPicker
  month={monthDate}
  onMonthChange={handleMonthChange}
  showOutsideDays={false}
  classNames={{
    root: "w-full",
    month_grid: "w-full border-collapse",
    weekday: "text-xs font-medium text-ima-text-secondary text-center py-1",
    day: "text-center",
    today: "font-bold text-ima-primary",
    outside: "text-ima-text-muted",
    nav: "flex items-center justify-between mb-2",
  }}
  components={{ DayButton: ActivityDayButton }}
/>
```

### Tab URL Sync (replaceState for tab, push for month)
```typescript
// Tab change — replaceState (no server re-render)
function handleTabChange(tab: TabKey) {
  setActiveTab(tab);
  window.history.replaceState(null, "", `/${role}/students/${studentId}?tab=${tab}`);
}

// Month change — router.push (triggers server re-render + fresh data)
function handleMonthChange(newMonth: Date) {
  setSelectedDate(null); // clear detail panel
  const mm = `${newMonth.getUTCFullYear()}-${String(newMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const basePath = role === "coach" ? `/coach/students/${studentId}` : `/owner/students/${studentId}`;
  router.push(`${basePath}?tab=calendar&month=${mm}`);
}
```

### Existing StatusVariant Map (from WorkSessionsTab — reuse in CalendarTab)
```typescript
// Reuse exactly; already maps to ima-* Badge variants
const statusVariant: Record<string, "info" | "success" | "warning" | "error"> = {
  in_progress: "info",
  completed: "success",
  paused: "warning",
  abandoned: "error",
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-day-picker` v8 with deprecated `useDayRender` hook | v9 with `components.DayButton` prop for custom day cells | v9.0.0 (2024) | `useDayRender` removed in v9; must use `DayButton` component override |
| `react-day-picker` incompatible with React 19 | v9.4.3+ fixes React 19 peer dep | v9.4.3 | STATE.md records this as the reason for `@^9.14.0` |
| Separate Work Sessions + Reports tabs | Single Calendar tab | Phase 17 | `TabKey` narrows from 3 values to 2 |

**Deprecated/outdated:**
- `useDayRender` hook: removed in v9. Custom day cells use `components={{ DayButton: MyButton }}` instead.
- `react-day-picker/dist/style.css` (v7/v8 path): v9 stylesheet at `react-day-picker/style.css` — but recommended to skip it entirely and use `classNames` prop for full Tailwind control.

---

## Environment Availability

Step 2.6: SKIPPED (no external services, CLI tools, or databases beyond the already-running Supabase instance are needed — this is a UI + data-read-only phase. `react-day-picker` needs to be installed via npm, covered in Standard Stack).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config.*, vitest.config.*, pytest.ini, or test/ directory found) |
| Config file | None |
| Quick run command | `npm run build && npx tsc --noEmit` |
| Full suite command | `npm run build && npx tsc --noEmit && npm run lint` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | Month grid shows green/amber/empty day indicators | manual-only (visual) | `npm run build` — no render errors | N/A |
| CAL-02 | Click day opens inline panel with sessions + report | manual-only (interaction) | `npm run build` — TypeScript types verify prop shapes | N/A |
| CAL-03 | Prev/next month navigation changes data | manual-only (nav flow) | `npx tsc --noEmit` — month param type check | N/A |
| CAL-04 | Calendar tab replaces Work Sessions + Reports tabs | manual + type check | `npx tsc --noEmit` — TabKey type verifies union | N/A |

> CAL-01 through CAL-04 are all UI/interaction requirements. No test framework exists in the project. Verification is build integrity (`npx tsc --noEmit && npm run build`) plus manual smoke testing.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check)
- **Per wave merge:** `npm run build && npm run lint`
- **Phase gate:** Full build + lint green, plus manual smoke test of calendar rendering and month navigation before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework; verification is type check + build + manual review.

---

## Open Questions

1. **react-day-picker CSS isolation with Tailwind 4**
   - What we know: `react-day-picker/style.css` uses CSS custom properties that may conflict with Tailwind 4's cascade. The recommended approach is to skip the stylesheet entirely and use `classNames` prop.
   - What's unclear: Whether DayPicker's internal button/table structure needs any baseline reset CSS to render correctly without the default stylesheet.
   - Recommendation: Skip `style.css` import entirely. Apply all visuals through `classNames` prop and custom `DayButton`. If grid layout breaks, add minimal CSS directly in `globals.css` scoped to `.rdp` (the DayPicker root class).

2. **Sessions without `session_minutes` in day detail**
   - What we know: `work_sessions` has `duration_minutes` (actual elapsed) and `session_minutes` (chosen duration). The day detail panel shows sessions for completed work.
   - What's unclear: Whether the day detail should show `session_minutes` (planned) or `duration_minutes` (actual), or both.
   - Recommendation: Show `duration_minutes` via `formatHoursMinutes()` for completed sessions (consistent with WorkSessionsTab). Show `session_minutes` as "planned" only for abandoned/paused sessions where `duration_minutes` is 0.

---

## Sources

### Primary (HIGH confidence)
- react-day-picker npm registry — version 9.14.0 confirmed as latest v9; `date-fns@^4.1.0` peer dep verified
- https://daypicker.dev/api/interfaces/PropsBase — `month`, `onMonthChange`, `onDayClick`, `components`, `classNames`, `modifiers` prop docs
- https://daypicker.dev/guides/custom-components — `DayButton` component override pattern with `DayButtonProps`
- https://daypicker.dev/guides/custom-modifiers — `modifiers` + `modifiersClassNames` pattern
- Project source: `src/components/coach/StudentDetailTabs.tsx` — current `TabKey` union and tab array
- Project source: `src/components/coach/WorkSessionsTab.tsx` — `statusVariant` map, date formatting patterns
- Project source: `src/components/coach/ReportsTab.tsx` — existing report field set
- Project source: `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — current Promise.all fetch pattern
- Project source: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — owner parallel fetch pattern
- Project source: `tailwind.config.ts` — all ima-* design tokens confirmed

### Secondary (MEDIUM confidence)
- npm view react-day-picker@9.14.0 — dependencies `{ date-fns: "^4.1.0" }` confirmed; already satisfied by installed `date-fns@4.1.0`

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — react-day-picker version confirmed on npm; pre-decided in STATE.md; date-fns dep compatibility verified
- Architecture: HIGH — all patterns derived directly from existing project source files
- Pitfalls: HIGH (UTC mismatch, stylesheet conflict, router.push vs replaceState) — verified against project code and DayPicker v9 docs

**Research date:** 2026-03-28
**Valid until:** 2026-06-28 (react-day-picker v9 is stable; only risk is a v9.15+ API change)
