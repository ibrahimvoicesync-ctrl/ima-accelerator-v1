# Stack Research

**Domain:** Coaching / student performance management platform
**Researched:** 2026-03-27 (v1.1 update — new features only)
**Confidence:** HIGH — versions verified against npm, official changelogs, and official docs

---

## v1.1 Additions (New Feature Stack)

The validated v1.0 stack remains unchanged. This section documents what is **added** for flexible work sessions, KPI progress tracking, calendar view, and roadmap deadline features.

### New Library: react-day-picker

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-day-picker | ^9.14.0 | Month-grid calendar view | Actively maintained (v9.14.0 released 2026-02-26). Confirmed React 19 compatibility (fixed in 9.4.3). Relies on date-fns already in the project — no new peer dependency. WCAG 2.1 AA compliant out of the box. 24 swappable component slots via `components` prop including `DayButton` for custom day rendering (dot indicators for sessions/reports). Minimal CSS footprint — works with Tailwind. |

react-day-picker is the **only new dependency** needed for v1.1. Everything else is built from the existing stack.

### No New Libraries Needed For

| Feature | Approach | Why No New Library |
|---------|----------|-------------------|
| Circular progress (KPI rings) | SVG `<circle>` with `strokeDasharray` / `strokeDashoffset` + `motion.circle` for animation | `motion` is already installed at ^12.37.0. SVG path animation via `pathLength` is first-class in motion v12. No extra library. |
| Linear progress bars | `<div>` with Tailwind width utility + `motion.div` for animated fill | Already have motion + Tailwind. Native HTML progress or a simple div is sufficient. |
| Break countdown timer | `setInterval` in `useEffect` + state — same pattern as existing work session timer | The existing timer component already uses this pattern. No timer library needed. |
| Date arithmetic (deadlines, offsets) | `date-fns` functions already installed at ^4.1.0 | `differenceInDays`, `addDays`, `addWeeks`, `isBefore`, `isAfter`, `isSameDay`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `format` — all present in date-fns v4. |
| Supabase schema changes | SQL migrations with `ALTER TABLE … ADD COLUMN` | Standard Postgres DDL, no library needed. See migration patterns below. |

---

## Existing Stack (v1.0 — unchanged)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | Stable LTS release (Oct 2025). App Router + Server Components. Turbopack default bundler. Breaking: uses `proxy.ts` not `middleware.ts`. Node.js 20.9+ required. |
| React | 19.2.3 | UI rendering | Ships with Next.js 16. React 19.2 adds View Transitions and useEffectEvent. |
| TypeScript | ^5 (5.9.x) | Type safety | Next.js 16 requires TS 5.1+. Strict mode required. |
| Supabase (hosted) | — | Postgres + Auth + RLS | Managed Postgres with built-in Auth, RLS. Google OAuth first-class. |
| Tailwind CSS | ^4 (4.2.1) | Utility-first CSS | v4 stable since Jan 2025. CSS-first config via `@theme` directive. |

### Supabase Client Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @supabase/supabase-js | ^2.99.2 | Core Supabase client | Admin client (service role) in server-only contexts. |
| @supabase/ssr | ^0.9.0 | Cookie-based auth for SSR | `createServerClient` / `createBrowserClient` for App Router. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation | All API route inputs via `safeParse`. Import as `import { z } from "zod"` — never `"zod/v4"`. |
| react-hook-form | ^7.71.2 | Form state management | All multi-field forms. |
| class-variance-authority | ^0.7.1 | CVA variant system | All UI primitive components. |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes | Used in `cn()` utility. |
| clsx | ^2.1.1 | Conditional class builder | Used inside `cn()`. |
| lucide-react | ^0.576.0 | Icon set | Tree-shakable icon library. |
| date-fns | ^4.1.0 | Date formatting and arithmetic | Calendar grid, deadline computation, session timestamps. |
| recharts | ^3.7.0 | Data visualization | Owner analytics dashboard only. |
| server-only | ^0.0.1 | Import guard | Files with service role key. |
| motion | ^12.37.0 | Animation | UI transitions, circular progress rings, timer animations. |

---

## Installation

```bash
# v1.1 addition only
npm install react-day-picker@^9.14.0
```

No other new dependencies required. All other v1.1 features (progress bars, countdown timer, date arithmetic, schema migrations) use the existing stack.

---

## Implementation Patterns for v1.1 Features

### 1. Calendar Month Grid

Use react-day-picker in read-only (non-interactive) display mode. No `selected` or `onSelect` props — just `month`, `onMonthChange`, and `components.DayButton` for custom day rendering.

```tsx
import { DayPicker } from "react-day-picker"

<DayPicker
  mode="default"
  month={currentMonth}
  onMonthChange={setCurrentMonth}
  components={{
    DayButton: CustomDayButton,  // adds dot indicators for sessions/reports
  }}
/>
```

The `CustomDayButton` component receives `props.day.date` — use `isSameDay` from date-fns to match against fetched session/report dates and render dot indicators.

Style overrides via `classNames` prop — map react-day-picker class names to ima-* Tailwind token classes (never hardcoded hex). The library ships with zero default CSS so Tailwind integration is clean.

### 2. Circular Progress Ring (KPI)

Build as a small Server-Component-safe primitive using SVG. No additional library.

```tsx
// Circumference formula: 2 * Math.PI * r
// strokeDashoffset = circumference * (1 - percentage / 100)
<svg viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-ima-border" strokeWidth="3" />
  <motion.circle
    cx="18" cy="18" r="15.9" fill="none"
    className="stroke-ima-primary"
    strokeWidth="3"
    strokeDasharray="100"
    animate={{ strokeDashoffset: 100 - percentage }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    strokeLinecap="round"
    transform="rotate(-90 18 18)"
  />
</svg>
```

The `motion` package's `motion.circle` provides the animated fill. Wrap in `motion-safe:` for accessibility per CLAUDE.md hard rules.

### 3. Break Countdown Timer

The existing work session timer pattern already uses `setInterval` + `useEffect`. Reuse the same pattern for inter-cycle break countdowns. No additional library.

```tsx
useEffect(() => {
  if (!breakActive) return
  const id = setInterval(() => {
    setSecondsLeft(s => {
      if (s <= 1) { clearInterval(id); onBreakComplete(); return 0 }
      return s - 1
    })
  }, 1000)
  return () => clearInterval(id)
}, [breakActive])
```

### 4. Date Deadline Computation

All deadline math uses date-fns functions already in the project:

```typescript
import { addDays, addWeeks, differenceInDays, isBefore, isAfter } from "date-fns"

// Compute target deadline for roadmap step relative to joined_at
const targetDate = addDays(joinedAt, stepOffsetDays)

// Determine status
const daysRemaining = differenceInDays(targetDate, today)
const status =
  daysRemaining < 0 ? "overdue" :
  daysRemaining <= 3 ? "due-soon" :
  "on-track"
```

### 5. Supabase Migration — ALTER TABLE ADD COLUMN

**Postgres 11+ behavior:** Adding a column with a constant (immutable) default does NOT rewrite the table — it is a metadata-only operation completing in ~1ms. Volatile defaults (e.g., `clock_timestamp()`) still require a full table rewrite.

Safe pattern for v1.1 schema additions:

```sql
-- Safe: constant default, no table rewrite (Postgres 11+)
ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer NOT NULL DEFAULT 45;

-- Safe: nullable, no default needed, no table rewrite
ALTER TABLE public.work_sessions
  ADD COLUMN IF NOT EXISTS break_duration_minutes integer;

-- Safe: constant string default
ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS outreach_emails integer NOT NULL DEFAULT 0;
```

Avoid `clock_timestamp()` or `gen_random_uuid()` as defaults in `ADD COLUMN` — these are volatile and will trigger a full table rewrite.

Use `IF NOT EXISTS` in every `ADD COLUMN` so the migration is idempotent and safe to re-run.

**Migration file naming** — Supabase CLI requires `YYYYMMDDHHmmss_description.sql` format:

```
supabase/migrations/20260327120000_v1_1_schema_updates.sql
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| react-day-picker v9 | Build custom month grid from scratch | Custom grid is ~100 lines of date-fns logic plus keyboard navigation, accessibility, and internationalization. react-day-picker handles all of this with a tiny API surface. No new peer dependencies since date-fns is already installed. |
| react-day-picker v9 | FullCalendar / react-big-calendar | Both are heavyweight (FullCalendar ~150KB+ gzip, react-big-calendar requires moment.js or date-fns adapter). Over-engineered for a simple month-grid-with-dots view. |
| SVG circular progress | react-circular-progressbar | Additional dependency for functionality achievable in 15 lines of SVG + motion. Not worth the dependency cost. |
| SVG circular progress | daisyUI radial-progress | Project uses Tailwind v4 + ima-* tokens, not daisyUI. Mixing component frameworks creates token conflicts. |
| setInterval countdown | react-countdown / use-countdown | Additional dependency for a ~10-line `useEffect`. The existing timer component already uses this pattern — no new library is justified. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| FullCalendar / react-big-calendar | 150KB+ bundles, designed for event scheduling not simple read-only month grids | react-day-picker v9 with custom DayButton |
| react-circular-progressbar | Adds a dependency for functionality native to SVG + motion (already installed) | SVG `<circle>` with `strokeDashoffset` + `motion.circle` |
| date-fns-tz / @date-fns/tz | v1.1 features operate in local/server time only, no cross-timezone deadline displays needed | date-fns v4 base (already installed) |
| moment.js | Mutable, 72KB minified, deprecated in most modern projects | date-fns v4 (already installed, tree-shakable) |
| Any state management library (zustand, jotai) | Sticky progress banner and KPI state are local component state — no cross-component global state needed | React `useState` + `useReducer` in Server/Client Component boundaries |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| react-day-picker@^9.14.0 | react@19.2.3, date-fns@^4.1.0 | Confirmed React 19 compatible (fixed in 9.4.3). Uses date-fns as peer dependency — already installed. |
| motion@^12.37.0 | react@19.2.3, next@16.1.6 | motion v12 is rebranded framer-motion. SVG `motion.circle` + `pathLength` fully supported. |
| date-fns@^4.1.0 | TypeScript@^5 | v4 is 100% TypeScript with handcrafted types. `eachDayOfInterval`, `startOfMonth`, `endOfMonth`, `getDay`, `isSameDay`, `differenceInDays`, `addDays` all available. |

---

## Stack Patterns for This Project (v1.0 + v1.1)

**Auth guard pattern (App Router, Next.js 16):**
- Route protection lives in `src/proxy.ts` (not middleware)
- `proxy.ts` reads cookies via `createServerClient`, calls `getUser()`, redirects unauthenticated users
- Individual pages do a secondary check via admin client for role-based access

**Server Component data access:**
- Use `createServerClient` from `@supabase/ssr` for authenticated user-scoped reads
- Use `createAdminClient` (service role) for cross-user queries (coach seeing student data, owner seeing all)
- All admin client files must have `import 'server-only'` at the top

**Form pattern:**
- `react-hook-form` + `zodResolver` for client-side forms
- API route validates again with `zod.safeParse()` — never trust client-side validation alone

**Design token pattern (Tailwind v4):**
- All tokens defined in `globals.css` under `@theme` as `--ima-*` custom properties
- Never use hardcoded hex values or `text-gray-*` — always `text-ima-*`
- This applies to react-day-picker's `classNames` prop — override with ima-* classes

**Calendar integration pattern:**
- Fetch session/report dates as Server Component (async page), pass down as serialized date arrays
- react-day-picker is a Client Component (needs `"use client"` for month navigation state)
- Custom `DayButton` uses `isSameDay` from date-fns to match pre-fetched date arrays — no client-side Supabase calls

**Motion/animation rules:**
- Every `animate-*` class MUST use `motion-safe:animate-*` wrapper (CLAUDE.md hard rule)
- SVG circular progress animation via `motion.circle` — include `motion-safe:` on the wrapper div if using Tailwind animate classes alongside

---

## Sources

- [react-day-picker changelog](https://daypicker.dev/changelog) — v9.14.0 confirmed latest (2026-02-26), React 19 compat fixed in 9.4.3 (HIGH confidence)
- [react-day-picker custom components guide](https://daypicker.dev/guides/custom-components) — DayButton slot confirmed, 24 component slots available (HIGH confidence)
- [react-day-picker custom modifiers guide](https://daypicker.dev/guides/custom-modifiers) — `modifiers` + `modifiersClassNames` props confirmed (HIGH confidence)
- [PostgreSQL docs: ALTER TABLE](https://www.postgresql.org/docs/current/ddl-alter.html) — Constant DEFAULT = no table rewrite (Postgres 11+); volatile DEFAULT = full rewrite (HIGH confidence)
- [motion SVG animation docs](https://motion.dev/docs/react-svg-animation) — `motion.circle`, `pathLength`, `strokeDashoffset` animation supported in motion v12 (HIGH confidence)
- [date-fns npm](https://www.npmjs.com/package/date-fns) — v4.1.0 current stable, 100% TypeScript (HIGH confidence)
- WebSearch: react-day-picker React 19 compatibility — multiple sources confirm 9.4.3+ fixes (MEDIUM confidence, corroborated by changelog)
- WebSearch: circular progress SVG React pattern — multiple community implementations confirm SVG + strokeDashoffset approach without library (MEDIUM confidence)

---
*Stack research for: IMA Accelerator v1.1 — calendar, KPI progress, and deadline features*
*Researched: 2026-03-27*
