# Phase 6: Coach Dashboard & Student Views - Research

**Researched:** 2026-03-16
**Domain:** Next.js App Router server components, Supabase multi-table queries, at-risk computation, role-gated coach views
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard layout**
- Personalized greeting: "Good morning/afternoon/evening, [FirstName]!" + subtitle "Here's how your students are doing"
- 3 stat cards across top: Total Students, At-Risk count, Reports Pending Review (count of unreviewed reports from assigned students)
- At-risk banner below stat cards (only if flagged students exist): warning-styled card listing each at-risk student with reason and link to detail page
- Full student list below as 2-column card grid (1-col mobile), showing ALL assigned students — not a preview
- /coach/students page shows the same full list (or redirects to dashboard) — dashboard IS the primary student view
- Student cards clickable — link to /coach/students/[studentId] detail page

**Student card content**
- Initials avatar (first letters of name)
- Student name
- "Last active" computed from data (see at-risk detection)
- Today's report status: green checkmark "Submitted" or amber "Pending"
- Current roadmap step: "Step N/10"
- At-risk badge (red) when flagged

**At-risk detection**
- No last_active_at column in V1 — compute "last active" as MAX(latest work_session.date, latest daily_report.date)
- Inactive threshold: 3 days with no activity (from COACH_CONFIG.atRiskInactiveDays)
- Rating threshold: average star_rating < 2 from reports in the last 7 days (from COACH_CONFIG.atRiskRatingThreshold, window matches COACH_CONFIG.reportInboxDays)
- New students (zero work sessions AND zero reports) get a "New" badge instead of "At Risk" — only flag as at-risk after 3 days since joined_at
- At-risk reasons shown in banner: "Inactive Xd" and/or "Avg rating X.X"
- Double visibility: dedicated at-risk banner at top + "At Risk" badge on individual student card

### Claude's Discretion
- Student detail page layout (tabs vs scrollable sections, history depth)
- Exact stat card styling and icons
- Student card hover/interaction states
- Empty state when coach has no assigned students
- Loading skeleton designs
- Sort order of student list (at-risk first, alphabetical, or by activity)
- How to handle /coach/students page (redirect to /coach or duplicate the list)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Phase 7 covers: report review/mark-as-reviewed, coach invites, coach analytics. No items deferred from this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COACH-01 | Coach sees dashboard with assigned students overview | Multi-table query pattern + stat computation confirmed in DB schema; admin client bypasses RLS for reliable server-side reads |
| COACH-02 | Coach can view list of assigned students | users table has coach_id FK; RLS policy coach_select_users already filters by coach_id; admin client with explicit WHERE coach_id = user.id provides defense-in-depth |
| COACH-03 | Coach can view individual student detail (reports, sessions, roadmap) | Three separate tables (work_sessions, daily_reports, roadmap_progress) all have coach RLS policies scoped to assigned students; parallel Promise.all fetch pattern confirmed |
</phase_requirements>

---

## Summary

Phase 6 is a pure read-only display phase. No API route mutations are required — all data flows through server component parallel fetches using the admin Supabase client. The entire page tree sits in `src/app/(dashboard)/coach/`, which is already guarded by `requireRole("coach")`.

The V1 database schema has no `last_active_at` column on the users table (confirmed removed from V1 migration). Last-active computation must be derived at query time from `MAX(work_sessions.date, daily_reports.date)` for each student. This is a key difference from the reference-old implementation that must be respected throughout.

The reference-old codebase provides directly portable component patterns for RoadmapTab, WorkSessionsTab, ReportsTab, StudentHeader, and StudentDetailTabs. Strip V2 fields (deals, calls, niche, streak_count) and add V1 fields (today's report status, roadmap step label). The student dashboard (`src/app/(dashboard)/student/page.tsx`) is the direct template for page layout: greeting + stat cards + content sections, all in a single server component with parallel data fetches.

**Primary recommendation:** Build two server components (coach dashboard page and student detail page server wrapper) with a single "use client" tab-switcher for the detail page. Use admin client everywhere, filter by `coach_id = user.id` in every query for defense-in-depth.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 (project-locked) | App Router server components, dynamic routes | Project stack; `src/proxy.ts` route guard already in place |
| React | 19 (project-locked) | UI rendering | Project stack |
| TypeScript strict | project-locked | Type safety | Project stack |
| Supabase JS | project-locked | DB queries via admin client | All phases use `createAdminClient()` for server reads |
| Tailwind CSS 4 + ima-* tokens | project-locked | Styling | All V1 pages use ima-* token system |
| lucide-react | project-locked | Icons (Users, AlertTriangle, CheckCircle, etc.) | Used across all existing pages |

### Supporting (already installed, no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | project-locked | Badge/Card variant composition | Any new component using CVA pattern |
| clsx + tailwind-merge | project-locked | `cn()` utility | Conditional class merging |
| zod | project-locked | `import { z } from "zod"` — no API routes this phase, not needed directly | Only if adding mutations later |

### No New Dependencies
Phase 6 requires zero new npm packages. All UI primitives (Card, Badge, Button, Skeleton, Spinner, Toast) are already in `src/components/ui/`. All lib utilities (getGreeting, formatHours, getToday) are in `src/lib/utils.ts`.

**Installation:**
```bash
# No new packages to install
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dashboard)/coach/
│   ├── page.tsx                      # Coach dashboard (REPLACE placeholder)
│   └── students/
│       ├── page.tsx                  # Redirects to /coach (or duplicates list)
│       └── [studentId]/
│           └── page.tsx              # Student detail server component
├── components/coach/
│   ├── StudentCard.tsx               # NEW — student card for grid
│   ├── StudentDetailClient.tsx       # NEW — tabs + detail client component
│   ├── StudentHeader.tsx             # NEW — detail page header
│   ├── StudentDetailTabs.tsx         # NEW — "use client" tab switcher
│   ├── RoadmapTab.tsx                # NEW — roadmap step list
│   ├── WorkSessionsTab.tsx           # NEW — sessions grouped by date
│   └── ReportsTab.tsx                # NEW — reports read-only list (no review action in Phase 6)
```

### Pattern 1: Server Component with Parallel Data Fetch (Coach Dashboard)
**What:** Single async server component that runs all queries in Promise.all, then renders pure JSX
**When to use:** Any dashboard page with multiple independent data reads; zero client interactivity needed

```typescript
// Source: src/app/(dashboard)/student/page.tsx (established project pattern)
export default async function CoachDashboard() {
  const user = await requireRole("coach");
  const admin = createAdminClient();
  const today = getToday();

  // Fetch assigned students first (need their IDs for subsequent queries)
  const { data: students } = await admin
    .from("users")
    .select("id, name, email, status, joined_at")
    .eq("role", "student")
    .eq("coach_id", user.id)   // defense-in-depth: explicit filter, not just RLS
    .eq("status", "active");

  const studentIds = (students ?? []).map(s => s.id);

  // Then parallel-fetch all enrichment data
  const [sessionsResult, reportsResult, roadmapResult] = await Promise.all([
    // latest work_session per student for last-active computation
    admin.from("work_sessions")
      .select("student_id, date")
      .in("student_id", studentIds)
      .order("date", { ascending: false }),
    // today's reports for "Submitted/Pending" status
    admin.from("daily_reports")
      .select("student_id, date, submitted_at, star_rating, reviewed_by")
      .in("student_id", studentIds),
    // current roadmap step per student
    admin.from("roadmap_progress")
      .select("student_id, step_number, status")
      .in("student_id", studentIds),
  ]);
  // ... compute at-risk, enrich student objects, render
}
```

### Pattern 2: At-Risk Computation (Pure TypeScript, Server-Side)
**What:** Derive last_active, is_new, is_at_risk, and reasons in plain TS after fetching raw data
**When to use:** Anytime there is no `last_active_at` column; prevents stale data from computed columns

```typescript
// Source: derived from CONTEXT.md at-risk spec + reference-old pattern adapted for V1
const today = getToday();
const nowMs = Date.now();

function computeAtRisk(
  student: { id: string; joined_at: string },
  latestSessionDate: string | null,
  latestReportDate: string | null,
  avgRatingLast7: number | null,
): { isNew: boolean; isAtRisk: boolean; reasons: string[]; lastActiveLabel: string } {
  const reasons: string[] = [];

  // "Last active" = max of latest session or report date
  const lastActiveDateStr = [latestSessionDate, latestReportDate]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  // "New" badge: zero activity AND joined < 3 days ago
  const hasActivity = latestSessionDate !== null || latestReportDate !== null;
  const joinedDaysAgo = Math.floor(
    (nowMs - new Date(student.joined_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (!hasActivity && joinedDaysAgo < COACH_CONFIG.atRiskInactiveDays) {
    return { isNew: true, isAtRisk: false, reasons: [], lastActiveLabel: "New" };
  }

  // Inactive check
  if (lastActiveDateStr) {
    const daysInactive = Math.floor(
      (nowMs - new Date(lastActiveDateStr + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysInactive >= COACH_CONFIG.atRiskInactiveDays) {
      reasons.push(`Inactive ${daysInactive}d`);
    }
  } else if (joinedDaysAgo >= COACH_CONFIG.atRiskInactiveDays) {
    reasons.push(`Inactive ${joinedDaysAgo}d`);
  }

  // Rating check
  if (avgRatingLast7 !== null && avgRatingLast7 < COACH_CONFIG.atRiskRatingThreshold) {
    reasons.push(`Avg rating ${avgRatingLast7.toFixed(1)}`);
  }

  const lastActiveLabel = lastActiveDateStr
    ? new Date(lastActiveDateStr + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short", day: "numeric", timeZone: "UTC",
      })
    : "Never";

  return { isNew: false, isAtRisk: reasons.length > 0, reasons, lastActiveLabel };
}
```

### Pattern 3: Student Detail Page — Server Wrapper + Client Tab Shell
**What:** Server page fetches all student data in parallel; passes props to a "use client" component that handles tab switching via `window.history.replaceState` (no router navigation)
**When to use:** Detail pages with tabs where tab state is UI-only, not URL-required for sharing

```typescript
// Source: reference-old/src/components/coach/CoachStudentDetailClient.tsx (adapted)
// Server page:
export default async function StudentDetailPage({ params }: { params: { studentId: string } }) {
  const user = await requireRole("coach");
  const admin = createAdminClient();

  // Verify student belongs to this coach (defense-in-depth)
  const { data: student } = await admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id")
    .eq("id", params.studentId)
    .eq("coach_id", user.id)   // CRITICAL: prevents cross-coach data access
    .single();

  if (!student) notFound();  // or redirect

  const [sessionsResult, roadmapResult, reportsResult] = await Promise.all([
    admin.from("work_sessions")
      .select("*")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(30),   // last 30 days of sessions
    admin.from("roadmap_progress")
      .select("*")
      .eq("student_id", student.id)
      .order("step_number"),
    admin.from("daily_reports")
      .select("*")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(20),   // last 20 reports
  ]);

  return <StudentDetailClient student={student} sessions={...} roadmap={...} reports={...} />;
}
```

### Pattern 4: Tabs V1 (3 tabs: Work Sessions / Roadmap / Reports)
**What:** Strip V2 tabs (Deals, Calls) from reference-old; keep Work Sessions, Roadmap, Reports only
**When to use:** Student detail page

```typescript
// V1 tab keys — adapted from reference-old/src/components/coach/StudentDetailTabs.tsx
type TabKey = "work" | "roadmap" | "reports";

const tabs: { key: TabKey; label: string }[] = [
  { key: "work",    label: "Work Sessions" },
  { key: "roadmap", label: "Roadmap" },
  { key: "reports", label: "Reports" },
];
```

### Recommended File Layout for Student Card (V1)

The V1 StudentCard is a simplified read-only server-renderable component (no useState needed — it's passed enriched data). It can be a pure function, not "use client", since there's no interactivity beyond the Link wrapper.

```typescript
// src/components/coach/StudentCard.tsx
// Pure server component: no "use client" needed
interface StudentCardProps {
  student: {
    id: string;
    name: string;
    isNew: boolean;
    isAtRisk: boolean;
    atRiskReasons: string[];
    lastActiveLabel: string;        // Computed: "Mar 14" or "Never" or "New"
    todayReportSubmitted: boolean;
    currentRoadmapStep: number;     // Current active/latest completed step number
  };
}
```

### Anti-Patterns to Avoid

- **Using RLS alone for coach isolation:** Always add `.eq("coach_id", user.id)` even though RLS policy `coach_select_users` already enforces it. Defense-in-depth.
- **Fetching last_active_at from users table:** This column does not exist in V1. Always compute from work_sessions + daily_reports.
- **Using "use client" on the dashboard page:** The dashboard has no interactivity. Keep it as a pure server component. Only the student detail page needs a client wrapper for tab switching.
- **Using ima-warm-* or ima-brand-gold tokens:** These are NOT in V1 tailwind.config.ts. Use ima-warning for at-risk yellow, ima-surface-light for warm backgrounds.
- **Using `ima-surface-warm`:** Not in V1 token set. Use `ima-surface-light` instead (confirmed by Phase 05 decision).
- **Using slideUp animation without motion-safe:** Always prefix: `motion-safe:animate-slideUp`.
- **Empty catch blocks:** Every catch must `console.error(...)` or `toast(...)`.
- **Importing admin client in StudentCard or client components:** Admin client is server-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth + role guard | Custom auth check | `requireRole("coach")` from `src/lib/session.ts` | Already handles redirect-on-mismatch |
| Supabase admin queries | Direct supabase client | `createAdminClient()` from `src/lib/supabase/admin` | Bypasses RLS for reliable server reads |
| Today's date | `new Date().toISOString()...` inline | `getToday()` from `src/lib/utils.ts` | Consistent format, UTC-safe |
| Time-of-day greeting | Custom string switch | `getGreeting()` from `src/lib/utils.ts` | Already implemented, used by student dashboard |
| Hours formatting | Custom division | `formatHours(minutes)` from `src/lib/utils.ts` | Consistent "0.0h" format |
| Card variants | Custom div styling | `Card` / `CardContent` from `src/components/ui/` | Consistent shadow-sm, rounded-xl, border |
| Badge variants | Custom span styling | `Badge` from `src/components/ui/` — use `variant="error"` for at-risk, `variant="success"` for submitted, `variant="warning"` for pending | CVA composition with correct tokens |
| Loading states | Custom spinner div | `Skeleton` / `SkeletonCard` from `src/components/ui/` | Uses `motion-safe:animate-pulse` + ima-border fill |
| CN conditional classes | Manual string concat | `cn()` from `src/lib/utils.ts` | clsx + tailwind-merge |
| Roadmap step list | Custom timeline | Port `RoadmapTab` from reference-old verbatim (minus V2 fields) | Already handles locked/active/completed states with correct icons |
| Work sessions grouped by date | Custom grouping component | Port `WorkSessionsTab` from reference-old verbatim | Groups by date, handles empty state |

**Key insight:** This phase's main complexity is in data aggregation (at-risk computation, building per-student summaries from multiple tables), not in UI components. All the components exist in reference-old and need only V2-stripping, not rebuilding.

---

## Common Pitfalls

### Pitfall 1: Querying students without the coach_id filter
**What goes wrong:** Coach sees other coaches' students (data leakage). RLS on users table does enforce `coach_id = get_user_id()`, but admin client bypasses RLS entirely.
**Why it happens:** `createAdminClient()` uses the service role key which ignores all RLS policies. Correct for server code, but means every admin query MUST include an explicit user filter.
**How to avoid:** Always add `.eq("coach_id", user.id)` when fetching students. Always add `.eq("student_id", ...IN(ownStudentIds))` when fetching sessions/reports.
**Warning signs:** If a coach can see more students than assigned, this filter is missing.

### Pitfall 2: Computing last_active from users.last_active_at
**What goes wrong:** TypeScript error — the column doesn't exist in V1 types.ts. Reference-old code used `student.last_active_at` but V1 schema removed it.
**Why it happens:** Reference-old dashboard has `SELECT "id, name, email, status, streak_count, last_active_at"` — both `streak_count` and `last_active_at` are absent from V1.
**How to avoid:** Derive last_active from MAX of `work_sessions.date` and `daily_reports.date`. The at-risk computation helper must accept `latestSessionDate` and `latestReportDate` as params, not read from the user row.
**Warning signs:** TypeScript strict mode will catch this at compile time if types.ts is accurate.

### Pitfall 3: Per-student N+1 queries
**What goes wrong:** Fetching sessions, reports, and roadmap in a loop per student → 50 students = 150 queries.
**Why it happens:** Naively iterating students and fetching related data inside the loop.
**How to avoid:** Always use `.in("student_id", studentIds)` to batch-fetch all data for all students in a single query. Then build in-memory Maps for O(1) lookup per student.
**Warning signs:** Query count in Supabase dashboard spikes proportional to student count.

### Pitfall 4: Blocking stat card data on student list render
**What goes wrong:** Sequential awaits instead of parallel; page takes 3x longer to load.
**Why it happens:** Forgetting to wrap independent queries in `Promise.all([...])`.
**How to avoid:** Use `Promise.all` for all queries that don't depend on each other. Only the initial student fetch (to get IDs) blocks subsequent queries.
**Warning signs:** Page load time is additive; 3 queries × 100ms = 300ms instead of ~120ms.

### Pitfall 5: Importing V2 tokens in V1 code
**What goes wrong:** Class `bg-ima-warm-50` or `text-ima-brand-gold` silently renders with no background (token not in V1 config).
**Why it happens:** Copy-pasting from reference-old without checking V1 token list. Reference-old has `ima-warm-*`, `ima-brand-*`, `ima-tier-*` tokens; V1 does not.
**How to avoid:** Check `tailwind.config.ts` — V1 has exactly 17 tokens: primary, primary-hover, secondary, accent, success, warning, error, info, bg, surface, surface-light, surface-accent, border, text, text-secondary, text-muted, overlay. No warm, no brand-gold, no tier tokens.
**Warning signs:** Background color missing or text invisible on hover states.

### Pitfall 6: Student detail page missing notFound() on cross-coach access
**What goes wrong:** A URL like `/coach/students/other-coach-student-id` returns a 500 or empty page without explanation.
**Why it happens:** Not checking that the fetched student's `coach_id` matches the logged-in coach.
**How to avoid:** Add `.eq("coach_id", user.id)` to the student detail fetch. If `.single()` returns null, call `notFound()` from `next/navigation`. This also prevents URL enumeration.
**Warning signs:** Manual URL manipulation can access students of other coaches.

### Pitfall 7: Using "use client" on the dashboard page for non-interactive stat display
**What goes wrong:** Adds hydration overhead, prevents server-side data fetching pattern.
**Why it happens:** Thinking stat cards need client-side state. They don't — data is computed at render time.
**How to avoid:** Keep `src/app/(dashboard)/coach/page.tsx` as a pure async server component. Only the student detail client wrapper needs "use client" for tab state.

---

## Code Examples

Verified patterns from existing V1 code:

### Parallel fetch pattern (from student/page.tsx)
```typescript
// Source: src/app/(dashboard)/student/page.tsx lines 29-37
const [
  { data: sessions, error: sessionsError },
  { data: roadmapRows, error: roadmapError },
  reportResult,
] = await Promise.all([
  admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today),
  admin.from("roadmap_progress").select("step_number, status").eq("student_id", user.id),
  admin.from("daily_reports").select("submitted_at").eq("student_id", user.id).eq("date", today).maybeSingle(),
]);

if (sessionsError) {
  console.error("[student dashboard] Failed to load sessions:", sessionsError);
}
```

### Greeting + stat display pattern (from student/page.tsx)
```typescript
// Source: src/app/(dashboard)/student/page.tsx lines 70-76
return (
  <div className="px-4">
    <h1 className="text-2xl font-bold text-ima-text">
      {getGreeting()}, {firstName}!
    </h1>
    <p className="mt-1 text-ima-text-secondary">Here&apos;s how your students are doing</p>
    {/* stat cards, banner, grid */}
  </div>
);
```

### At-risk banner pattern (from reference-old, adapted for V1 tokens)
```typescript
// Source: reference-old/src/app/(dashboard)/coach/page.tsx lines 340-403
// Note: reference-old uses ima-warm-50 which is NOT in V1 — replace with ima-surface-light
{atRiskStudents.length > 0 && (
  <section role="alert">
    <Card variant="warm">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ima-warning/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-ima-warning" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-ima-text">
              {atRiskStudents.length} Student{atRiskStudents.length !== 1 ? "s" : ""} Needing Attention
            </h2>
          </div>
        </div>
        <div className="space-y-2">
          {atRiskStudents.map(student => (
            <Link
              key={student.id}
              href={`/coach/students/${student.id}`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ima-surface border border-ima-border hover:shadow-card-hover motion-safe:transition-shadow motion-safe:duration-200 min-h-[44px]"
            >
              {/* initials avatar + name + reason */}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
)}
```

### Initials avatar pattern (consistent across reference-old components)
```typescript
// Source: reference-old/src/app/(dashboard)/coach/page.tsx lines 377-382
const initials = student.name
  .split(" ")
  .map((n: string) => n[0] ?? "")
  .join("")
  .slice(0, 2)
  .toUpperCase();

// Render:
<div className="w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0">
  {initials}
</div>
```

### V1 Card variants available
```typescript
// Source: src/components/ui/Card.tsx lines 5-20
// Variants: "default" | "warm" | "accent" | "bordered-left"
// "warm" = bg-ima-surface-light (use for at-risk banner)
// "accent" = bg-ima-surface-accent (use for highlighted sections)
// "bordered-left" = left blue border (use for important info cards)
<Card variant="warm">...</Card>
```

### RLS-safe student detail fetch
```typescript
// Defense-in-depth pattern — admin client bypasses RLS so explicit coach_id filter is mandatory
const { data: student } = await admin
  .from("users")
  .select("id, name, email, status, joined_at, coach_id, niche")
  .eq("id", params.studentId)
  .eq("coach_id", user.id)   // REQUIRED: prevents cross-coach access
  .single();

if (!student) {
  notFound();  // from "next/navigation"
}
```

### Batch per-student data query with in-memory grouping
```typescript
// Fetch all student sessions in one query, group in memory
const { data: allSessions } = await admin
  .from("work_sessions")
  .select("student_id, date")
  .in("student_id", studentIds)
  .order("date", { ascending: false });

// Build latest-session-date map
const latestSessionMap = new Map<string, string>();
for (const s of allSessions ?? []) {
  if (!latestSessionMap.has(s.student_id)) {
    latestSessionMap.set(s.student_id, s.date);  // already sorted desc, first = latest
  }
}
```

---

## State of the Art

| Old Approach (reference-old) | V1 Approach | Reason |
|------------------------------|-------------|--------|
| `student.last_active_at` from users table | Compute from `MAX(work_sessions.date, daily_reports.date)` | V1 schema removed `last_active_at` column |
| `student.streak_count` field | Not displayed in V1 | V1 schema removed `streak_count` column |
| 5 detail tabs: work/roadmap/reports/deals/calls | 3 detail tabs: work/roadmap/reports | Deals and calls are V2 features |
| StatCard with DollarSign/revenue | 3 stat cards: students/at-risk/reports pending | V1 has no revenue tracking |
| `getSessionUser("coach")` from reference-old | `requireRole("coach")` from V1 `src/lib/session.ts` | V1 session API is `requireRole` not `getSessionUser` |
| `ima-warm-50`, `ima-brand-gold` tokens | `ima-surface-light`, `ima-warning` tokens | V1 has 17 tokens only, no warm/brand variants |
| `FEATURES.playerCards` feature flag | Not applicable — no player cards in V1 | V2 feature, excluded |
| CoachStudentsList with search | No search — max 50 students fits on one page | CONTEXT.md: full list without search; pagination unnecessary |
| Using `deals`, `call_schedule` tables | Not queried — V2 tables | V1 has 6 tables only |

**Deprecated/outdated patterns to strip from reference-old:**
- `streak_count`: Remove — column doesn't exist in V1
- `last_active_at` on users: Remove — column doesn't exist in V1
- `deals`, `call_schedule` queries: Remove — tables don't exist in V1
- `StudentProgressGrid` component: Remove — shows deals/cash/streak; build simpler V1 variant
- `DealsTab`, `CallsTab`: Remove — not in V1
- `FEATURES.playerCards` check: Remove
- `formatCurrency`: Not used in V1

---

## Open Questions

1. **`/coach/students` page behavior**
   - What we know: CONTEXT.md says "shows the same full list (or redirects to dashboard) — dashboard IS the primary student view"
   - What's unclear: Whether to redirect or render a duplicate. Both are valid.
   - Recommendation: Simple redirect to `/coach` (one-line file). Avoids duplicate data-fetch logic and keeps nav working correctly. Planner can decide.

2. **Sort order of student card grid**
   - What we know: CONTEXT.md marks this as Claude's Discretion
   - What's unclear: At-risk first, then alphabetical? Or purely alphabetical?
   - Recommendation: At-risk students first (they need attention), then alphabetical by name. This matches the at-risk banner's urgency signal.

3. **Student detail history depth**
   - What we know: CONTEXT.md marks history depth as Claude's Discretion
   - What's unclear: How many sessions/reports to load
   - Recommendation: 30 days of sessions (capped at ~120 records), 20 most recent reports. These are display-only reads so slightly generous limits are fine.

4. **Student detail tabs: URL param or no?**
   - What we know: reference-old uses `?tab=work` query param via `window.history.replaceState`
   - What's unclear: Whether to preserve tab state in URL for shareability
   - Recommendation: Use the same `window.history.replaceState` pattern from reference-old. No router.push — no page reload. Cheap and effective.

---

## Validation Architecture

nyquist_validation is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no jest, vitest, playwright, or pytest in devDependencies |
| Config file | None — see Wave 0 gaps |
| Quick run command | `npm run build && npx tsc --noEmit` (build validation only) |
| Full suite command | `npm run build && npm run lint && npx tsc --noEmit` |

**Note:** This project has no automated test framework installed. All validation is via TypeScript type checking, ESLint, and build success. The project's existing "testing" pattern (confirmed across Phases 2-5) is build-time + manual browser UAT.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COACH-01 | Coach dashboard loads with assigned students | smoke (build) | `npm run build` | ❌ Wave 0 |
| COACH-01 | 3 stat cards display (total, at-risk, pending) | visual/manual | Manual browser check | N/A |
| COACH-01 | At-risk banner appears when students are at-risk | visual/manual | Manual browser check | N/A |
| COACH-02 | `/coach/students` responds (redirect or list) | smoke (build) | `npm run build` | ❌ Wave 0 |
| COACH-02 | Student cards show correct data | visual/manual | Manual browser check | N/A |
| COACH-03 | Student detail page loads for valid student | smoke (build) | `npm run build` | ❌ Wave 0 |
| COACH-03 | Coach cannot access another coach's student | security/manual | Manual: navigate to cross-coach URL | N/A |
| COACH-03 | 3 tabs (Work/Roadmap/Reports) render correctly | visual/manual | Manual browser check | N/A |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build && npm run lint && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No new test files required — this project uses manual UAT pattern (consistent with Phases 2-5)
- [ ] Build infrastructure is sufficient: `npx tsc --noEmit` catches type errors; `npm run build` catches rendering errors

*(No automated test framework to install — project uses build-time type checking + manual UAT)*

---

## Sources

### Primary (HIGH confidence)
- `src/app/(dashboard)/student/page.tsx` — Server component pattern, parallel fetch, greeting layout
- `src/lib/config.ts` — COACH_CONFIG thresholds, ROUTES.coach, NAVIGATION.coach, ROADMAP_STEPS
- `supabase/migrations/00001_create_tables.sql` — Schema (confirmed no last_active_at, no streak_count), RLS policies for coach reads
- `src/lib/session.ts` — requireRole("coach"), SessionUser shape
- `src/components/ui/` — Card/Badge/Button/Skeleton variants and class names
- `tailwind.config.ts` — Complete V1 token list (17 tokens)
- `.planning/phases/06-coach-dashboard-student-views/06-CONTEXT.md` — Locked decisions + at-risk spec

### Secondary (MEDIUM confidence)
- `reference-old/src/app/(dashboard)/coach/page.tsx` — Reference dashboard pattern; stripped of V2 fields
- `reference-old/src/components/coach/` — RoadmapTab, WorkSessionsTab, ReportsTab, StudentHeader, StudentDetailTabs patterns

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages confirmed in package.json and existing source files
- Architecture: HIGH — Patterns verified from existing V1 server components and reference-old implementations
- Database schema: HIGH — Confirmed from 00001_create_tables.sql; V1/V2 column differences verified
- At-risk logic: HIGH — Spec is explicit in CONTEXT.md; no ambiguity
- Pitfalls: HIGH — Based on V1 schema diff from reference-old and established project decisions in STATE.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack, no moving dependencies)
