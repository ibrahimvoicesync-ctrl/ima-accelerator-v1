# Phase 8: Owner Stats & People Management - Research

**Researched:** 2026-03-17
**Domain:** Next.js App Router server components, Supabase admin queries, owner-scoped aggregate stats, people list/detail pages
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard stats page:**
- Greeting + subtitle ("Platform overview") + 4 stat cards only — clean and minimal
- 4 stat cards in a single row on desktop (grid-cols-4), 2x2 grid on mobile (grid-cols-2)
- Stats: Total Students, Total Coaches, Active Today, Reports Submitted Today (matching OWNER_CONFIG.statCards)
- "Active Today" = students who started at least one work session today
- Each stat card is clickable — links to its corresponding list page (Students → /owner/students, Coaches → /owner/coaches)
- "Active Today" and "Reports Today" are display-only (no link destination)
- No additional content below stat cards — sidebar handles navigation

**Student list page:**
- Must be searchable (OWNER-02 requirement)
- Students clickable to /owner/students/[studentId]
- Layout, search/filter behavior, and card vs table presentation: Claude's Discretion

**Student detail page:**
- Reuse or adapt the coach's student detail page pattern (tabs for roadmap, sessions, reports)
- Owner can see any student, not just those assigned to a specific coach
- Must show sessions, reports, and roadmap progress (OWNER-03)

**Coach list page:**
- Card grid layout, 2-column on desktop, 1-column on mobile
- Each coach card shows: initials avatar, coach name, assigned student count, avg student rating (last 7 days)
- Coach cards clickable — link to /owner/coaches/[coachId]

**Coach detail page:**
- Header: back link, initials avatar, coach name, email
- 4 stat cards: Student Count, Avg Student Rating (7-day), Report Review Rate (%), At-Risk Count
- Assigned Students section below stat cards — reuses the same StudentCard component from the coach dashboard
- StudentCard links to /owner/students/[studentId] (not /coach/students/[studentId])

**Avg student rating:**
- Computed from the last 7 days of reports, matching COACH_CONFIG.reportInboxDays = 7
- Consistent with coach analytics window

### Claude's Discretion
- Student list layout (table vs cards), search UX, filter options
- Student detail page layout — may reuse coach's student detail with different auth/routing
- Stat card icons, styling, hover states (follow Phase 6 coach stat card pattern)
- Empty states for all pages
- Loading skeleton designs
- Sort order of coach and student lists
- "Report Review Rate" computation details on coach detail page

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OWNER-01 | Owner sees platform-wide stats dashboard | Admin queries for total students, total coaches, active today (work_sessions.date = today), reports_submitted_today (daily_reports.date = today AND submitted_at IS NOT NULL) |
| OWNER-02 | Owner can view/search all students | Admin query on users WHERE role='student', client-controlled search input with URL param pattern from reference OwnerStudentsList |
| OWNER-03 | Owner can view individual student detail | Reuse StudentDetailClient with owner auth — remove coach_id filter, any student visible via role check |
| OWNER-04 | Owner can view all coaches with stats | Admin query on users WHERE role='coach', per-coach computed stats: student count (users.coach_id join), avg rating last 7d (daily_reports) |
| OWNER-05 | Owner can view individual coach detail (assigned students, performance) | Admin fetch coach + assigned students, compute 4 stat cards, reuse StudentCard with /owner prefix |
</phase_requirements>

---

## Summary

Phase 8 implements the owner's read-only view of the entire platform. The owner dashboard replaces a placeholder with a stats page showing 4 aggregate metrics; the students section adds a searchable list and detail page; the coaches section adds a card-grid list and a coach detail page. All data is read via the admin Supabase client, bypassing RLS, with `requireRole("owner")` as the auth layer.

The primary challenge is not new technology — everything needed already exists in the codebase. It is correct query design for aggregate stats, reusing the established coach dashboard patterns (stat cards, StudentCard, StudentDetailClient), and parameterizing the StudentCard href to point at `/owner/students/[id]` instead of `/coach/students/[id]`. The reference-old/ directory contains a full prior implementation; the V1 version strips V2 features (deals, revenue, last_active_at, tier, streak_count, calls) and uses the simpler V1 query and component pattern.

**Primary recommendation:** Build each page as a server component for data fetching with thin client components only for interactive elements (search input, tab switching). All queries use `createAdminClient()`. Reuse `StudentDetailClient` for the owner student detail page by wrapping it in a new server component that performs owner auth (no coach_id filter). Parameterize `StudentCard` with a configurable `basePath` prop for the link prefix.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 (App Router) | Page routing, server components, searchParams | Already in use; proxy.ts pattern required |
| React | 19 | UI rendering | Already in use |
| TypeScript | strict | Type safety | Project-wide strict mode |
| Supabase JS | current | DB queries via admin client | Established pattern |
| Tailwind CSS 4 | ima-* tokens | Styling | Project-wide token system |
| Lucide React | current | Icons (GraduationCap, Shield, Users, FileText) | Matches OWNER_CONFIG.statCards icon names |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CVA (class-variance-authority) | current | Variant-based styling | Already used in all UI primitives |
| clsx / tailwind-merge | current | Class merging via cn() | Already in src/lib/utils.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server component data fetching | SWR / React Query | Server components are already the pattern; no client hydration overhead for read-only pages |
| URL param search (router.push) | Local state only | URL params allow shareable/bookmarkable searches, consistent with reference-old pattern |

**Installation:** No new packages required — all dependencies already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/app/(dashboard)/owner/
├── page.tsx                           # REPLACE placeholder: stats dashboard
├── students/
│   ├── page.tsx                       # NEW: student list with search
│   └── [studentId]/
│       └── page.tsx                   # NEW: student detail (owner auth)
└── coaches/
    ├── page.tsx                       # NEW: coach list card grid
    └── [coachId]/
        └── page.tsx                   # NEW: coach detail

src/components/owner/
├── OwnerStudentSearchClient.tsx       # "use client" — search input + list
├── CoachCard.tsx                      # "use client" — coach card component
└── CoachDetailClient.tsx              # "use client" — tab state (if needed)
```

### Pattern 1: Server Component with Client Search Island

The student list page is a server component that reads `searchParams` and passes results to a client component that owns the search input + URL push. This avoids full-page client hydration while keeping the search interactive.

**Server page reads searchParams and fetches:**
```typescript
// src/app/(dashboard)/owner/students/page.tsx
export default async function OwnerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const user = await requireRole("owner");
  const { search } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id")
    .eq("role", "student")
    .order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students } = await query;
  // ...
}
```

**Client island owns input + router.push:**
```typescript
// src/components/owner/OwnerStudentSearchClient.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

export function OwnerStudentSearchClient({ students, initialSearch }: Props) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const [search, setSearch] = useState(initialSearch);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      routerRef.current.push(`/owner/students?${params.toString()}`);
    }, 300);
  }
  // ...renders Input + student cards/list
}
```

### Pattern 2: Admin Aggregate Stats (Owner Dashboard)

Four stat cards require four counts from different tables. Use `Promise.all` for parallelism. All queries use `{ count: "exact", head: true }` where only the count is needed.

```typescript
// Source: established pattern from coach/page.tsx + reference-old
const today = getToday();

const [
  { count: totalStudents },
  { count: totalCoaches },
  { count: activeTodayCount },
  { count: reportsTodayCount },
] = await Promise.all([
  admin.from("users").select("*", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
  admin.from("users").select("*", { count: "exact", head: true }).eq("role", "coach").eq("status", "active"),
  // "Active Today" = had at least 1 work session with date = today
  admin.from("work_sessions").select("student_id", { count: "exact", head: true }).eq("date", today),
  // "Reports Today" = submitted_at IS NOT NULL on date = today
  admin.from("daily_reports").select("*", { count: "exact", head: true }).eq("date", today).not("submitted_at", "is", null),
]);
```

Note: `count: "exact", head: true` returns only the count without fetching rows — efficient for aggregate stats.

### Pattern 3: Coach List with Per-Coach Stats

The coach list requires per-coach student count and avg 7-day rating. These are computed in TypeScript from joined data (not SQL aggregates) — consistent with how coach dashboard enrichment works.

```typescript
// Fetch all coaches + their students + recent reports in parallel
const [coachesResult, studentsResult, reportsResult] = await Promise.all([
  admin.from("users").select("id, name, email, status, joined_at").eq("role", "coach").order("name"),
  admin.from("users").select("id, name, coach_id, status").eq("role", "student").eq("status", "active"),
  admin.from("daily_reports")
    .select("student_id, star_rating, date")
    .gte("date", sevenDaysAgo)
    .not("star_rating", "is", null),
]);

// Build lookup maps in TypeScript
const studentsByCoach = new Map<string, number>();
for (const s of studentsResult.data ?? []) {
  if (s.coach_id) {
    studentsByCoach.set(s.coach_id, (studentsByCoach.get(s.coach_id) ?? 0) + 1);
  }
}

// Build studentId -> coachId for rating lookup
const studentCoachMap = new Map((studentsResult.data ?? []).map(s => [s.id, s.coach_id]));
const coachRatings = new Map<string, number[]>();
for (const r of reportsResult.data ?? []) {
  const coachId = studentCoachMap.get(r.student_id);
  if (coachId && r.star_rating !== null) {
    const arr = coachRatings.get(coachId) ?? [];
    arr.push(r.star_rating);
    coachRatings.set(coachId, arr);
  }
}

// Enrich coaches
const enrichedCoaches = (coachesResult.data ?? []).map(coach => ({
  ...coach,
  studentCount: studentsByCoach.get(coach.id) ?? 0,
  avgRating: (() => {
    const ratings = coachRatings.get(coach.id);
    if (!ratings || ratings.length === 0) return null;
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  })(),
}));
```

### Pattern 4: Owner Student Detail — Reuse StudentDetailClient

The owner student detail page is structurally identical to the coach student detail page, with two differences:
1. Auth: `requireRole("owner")` instead of `requireRole("coach")`
2. Query: no `.eq("coach_id", user.id)` filter — owner sees any student
3. Back link: `/owner/students` not `/coach/students`

The `StudentDetailClient` component already exists and takes generic props. The owner student detail server page can pass data directly to `StudentDetailClient` (same props interface) but the `handleTabChange` inside `StudentDetailClient` calls `window.history.replaceState` with a `/coach/students/...` path — this must be fixed by adding a `basePath` prop or creating a thin `OwnerStudentDetailClient` wrapper.

**Recommended approach:** Create `src/components/owner/OwnerStudentDetailClient.tsx` that mirrors `StudentDetailClient` but uses `/owner/students/${studentId}` in the history.replaceState call. This avoids coupling the coach component to the owner route.

### Pattern 5: Coach Detail — 4 Stat Cards + StudentCard Reuse

Coach detail stat cards use the same inline stat card pattern from coach dashboard (Phase 6). Do NOT import from reference-old's StatCard (it has V2 color variants and props not in V1).

```typescript
// Compute 4 stats for coach detail page
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

// student_count: from users WHERE coach_id = coachId AND role = 'student'
// avg_rating_7d: avg star_rating from daily_reports WHERE student_id IN (studentIds) AND date >= sevenDaysAgo
// report_review_rate: reviewed_by IS NOT NULL / total submitted, last 7 days
// at_risk_count: students with 0 sessions in last 3 days OR avg rating < 2 in last 7 days
```

**StudentCard basePath:** The existing StudentCard hardcodes `/coach/students/${student.id}`. For coach detail page (owner view), students must link to `/owner/students/${student.id}`. Add a `basePath` prop:

```typescript
// Modified StudentCard signature
interface StudentCardProps {
  student: { ... };
  basePath?: string; // defaults to "/coach/students"
}

export function StudentCard({ student, basePath = "/coach/students" }: StudentCardProps) {
  return (
    <Link href={`${basePath}/${student.id}`} aria-label={student.name}>
```

This is backward-compatible — all existing uses of StudentCard continue to work without passing basePath.

### Anti-Patterns to Avoid

- **Fetching all columns when count is enough:** Use `{ count: "exact", head: true }` for aggregate stat cards — do not fetch row data just to count.
- **Using RLS client for owner queries:** Owner pages always use `createAdminClient()`. Using the standard `createClient()` would apply RLS and return only the logged-in user's rows.
- **Filtering owner queries by user.id:** Owner sees ALL data. Never add `.eq("coach_id", user.id)` or `.eq("student_id", user.id)` to owner queries. The only ID used is the coachId route param on coach detail.
- **No `last_active_at` column:** V1 schema removed `last_active_at` from users table. At-risk detection must use work_sessions and daily_reports queries, not a user profile field.
- **No `streak_count` column:** Also removed from V1. Do not reference it.
- **No `deals`, `notifications`, `call_schedule` tables:** V1 has only 6 tables. Reference-old queries for these tables must be stripped.
- **Reusing reference-old StatCard:** V1 Tailwind config has only 17 ima-* tokens. Reference-old's StatCard uses `accentColor` variants that map to V2 tokens (ima-brand-gold, ima-tier-special, ima-warm-100) not present in V1. Build stat cards inline like Phase 6 coach dashboard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth + role guard | Custom session check | `requireRole("owner")` from src/lib/session.ts | Already handles redirect on role mismatch |
| Admin DB client | Direct Supabase call | `createAdminClient()` from src/lib/supabase/admin.ts | Bypasses RLS correctly; admin key never in client bundle |
| Today's date string | `new Date().toISOString()...` inline | `getToday()` from src/lib/utils.ts | Consistent date format YYYY-MM-DD |
| Greeting text | Custom logic | `getGreeting()` from src/lib/utils.ts | Already implemented |
| Class merging | Manual string concat | `cn()` from src/lib/utils.ts | Handles conditional + Tailwind merge |
| Tab UI state | Custom tab component | Reuse `StudentDetailTabs` + `StudentDetailClient` pattern | Already built and tested in Phase 6 |
| Card primitive | Custom div | `Card`, `CardContent` from src/components/ui/Card.tsx | CVA-based, ima-* token integrated |
| Search input | Custom input | `Input` from src/components/ui/Input.tsx | Handles label/error/aria automatically |
| Student card (in coach detail) | New component | `StudentCard` from src/components/coach/StudentCard.tsx | Reuse with basePath prop |

**Key insight:** Phase 8 is primarily assembly and adaptation of existing patterns, not new infrastructure. The hardest part is getting the SQL queries right for aggregate stats and not accidentally importing V2 columns or tables.

---

## Common Pitfalls

### Pitfall 1: V2 Column References
**What goes wrong:** TypeScript errors like `Property 'last_active_at' does not exist on type...` or `Property 'streak_count' does not exist`.
**Why it happens:** Reference-old uses V2 schema with `last_active_at`, `streak_count`, `niche` on users. V1 migration has `niche` but not `last_active_at` or `streak_count`.
**How to avoid:** Always consult `supabase/migrations/00001_create_tables.sql` for the authoritative V1 column list before writing any `.select()` query.
**Warning signs:** TypeScript error on supabase query result type; `undefined` values at runtime.

V1 users columns: `id, auth_id, email, name, role, coach_id, niche, status, joined_at, created_at, updated_at`

### Pitfall 2: Active Today Count — Distinct vs Total
**What goes wrong:** `count: "exact"` on work_sessions WHERE date = today counts rows (sessions), not distinct students. A student with 4 sessions counts as 4.
**Why it happens:** The stat card wants "students active today", not "sessions today".
**How to avoid:** Either (a) select `student_id` without head:true and count distinct in TypeScript, or (b) use a set approach:
```typescript
const { data: todaySessionRows } = await admin
  .from("work_sessions")
  .select("student_id")
  .eq("date", today);
const activeTodayCount = new Set(todaySessionRows?.map(r => r.student_id) ?? []).size;
```
**Warning signs:** Active Today count is higher than Total Students count.

### Pitfall 3: StudentCard href Points to /coach Route
**What goes wrong:** Clicking a student in the coach detail page (owner view) navigates to `/coach/students/[id]` — a 403 or redirect back to owner dashboard.
**Why it happens:** StudentCard hardcodes `/coach/students/${student.id}`.
**How to avoid:** Add `basePath` prop to StudentCard before using it on owner pages. Default to `/coach/students` so all existing uses remain unchanged.
**Warning signs:** Owner navigating to coach detail page and clicking a student gets redirected.

### Pitfall 4: Supabase Count Query with head:true Returns null
**What goes wrong:** `count` is `null` instead of `0` when there are zero matching rows.
**Why it happens:** Supabase returns `null` (not `0`) when count is zero with `head: true`.
**How to avoid:** Always use `?? 0`: `totalStudents = (count ?? 0)`.
**Warning signs:** NaN in stat card display or TypeScript narrowing issues.

### Pitfall 5: searchParams Must Be Awaited in Next.js 16
**What goes wrong:** TypeScript error: `Property 'search' does not exist on type 'Promise<...>'`.
**Why it happens:** In Next.js 15+/App Router, `searchParams` is a Promise and must be awaited before accessing properties.
**How to avoid:** Always `const { search } = await searchParams` before using values. Pattern already used in Phase 7 and reference-old:
```typescript
export default async function Page({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
```
**Warning signs:** TypeScript error or undefined searchParam values at runtime.

### Pitfall 6: Report Review Rate Computation
**What goes wrong:** Division by zero when no reports exist for a coach's students.
**Why it happens:** Rate = reviewed / submitted; if submitted = 0, result is NaN.
**How to avoid:**
```typescript
const reviewRate = submittedCount > 0 ? Math.round((reviewedCount / submittedCount) * 100) : 0;
```

### Pitfall 7: At-Risk Detection on Owner Pages — No last_active_at
**What goes wrong:** At-risk check copies reference-old `computeAtRisk(student.last_active_at, ...)` — this field doesn't exist in V1.
**Why it happens:** V1 dropped `last_active_at` from users table.
**How to avoid:** Use the same pattern as coach dashboard (Phase 6) — derive last active from most recent work_session.date or daily_report.date, NOT from a user column.

---

## Code Examples

Verified patterns from V1 source:

### Owner Dashboard: requireRole + Admin Client
```typescript
// Source: src/lib/session.ts + established V1 pattern
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGreeting, getToday } from "@/lib/utils";
import { OWNER_CONFIG } from "@/lib/config";

export default async function OwnerDashboard() {
  const user = await requireRole("owner");
  const admin = createAdminClient();
  const today = getToday();
  const firstName = user.name.split(" ")[0];
  // ...
}
```

### Aggregate Stat Query (Efficient)
```typescript
// Source: Supabase count pattern, verified against V1 schema
const [
  { count: totalStudents },
  { count: totalCoaches },
] = await Promise.all([
  admin.from("users").select("*", { count: "exact", head: true }).eq("role", "student").eq("status", "active"),
  admin.from("users").select("*", { count: "exact", head: true }).eq("role", "coach").eq("status", "active"),
]);
// Always use ?? 0 when consuming count
const studentCount = totalStudents ?? 0;
```

### Active Today (Distinct Students)
```typescript
// Source: V1 work_sessions schema — student_id + date columns
const today = getToday();
const { data: todaySessions } = await admin
  .from("work_sessions")
  .select("student_id")
  .eq("date", today);
const activeTodayCount = new Set(todaySessions?.map(r => r.student_id) ?? []).size;
```

### Stat Card (Inline Pattern from Phase 6)
```typescript
// Source: src/app/(dashboard)/coach/page.tsx — inline stat card pattern
import { Card, CardContent } from "@/components/ui/Card";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

// Clickable stat card
<Link href="/owner/students" className="min-h-[44px] block">
  <Card interactive>
    <CardContent className="p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
        <GraduationCap className="h-5 w-5 text-ima-primary" aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold text-ima-text">{studentCount}</p>
        <p className="text-xs text-ima-text-secondary">Total Students</p>
      </div>
    </CardContent>
  </Card>
</Link>

// Non-clickable stat card (Active Today, Reports Today)
<Card>
  <CardContent className="p-4 flex items-center gap-4">
    {/* same structure, no Link wrapper */}
  </CardContent>
</Card>
```

### StudentCard with basePath Prop (Modified)
```typescript
// Source: src/components/coach/StudentCard.tsx — add basePath prop
interface StudentCardProps {
  student: {
    id: string;
    name: string;
    isNew: boolean;
    isAtRisk: boolean;
    atRiskReasons: string[];
    lastActiveLabel: string;
    todayReportSubmitted: boolean;
    currentRoadmapStep: number;
  };
  basePath?: string; // NEW: defaults to "/coach/students"
}

export function StudentCard({ student, basePath = "/coach/students" }: StudentCardProps) {
  return (
    <Link href={`${basePath}/${student.id}`} aria-label={student.name}>
```

### Owner Student Detail — Auth Difference
```typescript
// Source: adapted from src/app/(dashboard)/coach/students/[studentId]/page.tsx
// KEY DIFFERENCE: no .eq("coach_id", user.id) filter
const { data: student } = await admin
  .from("users")
  .select("id, name, email, status, joined_at, coach_id, niche")
  .eq("id", studentId)
  .eq("role", "student")  // verify role, but no coach_id restriction
  .single();

if (!student) notFound();
```

### Coach Detail: Compute Report Review Rate
```typescript
// Source: derived from V1 daily_reports schema
const sevenDaysAgo = new Date(Date.now() - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000)
  .toISOString().split("T")[0];

const [submittedResult, reviewedResult] = await Promise.all([
  admin.from("daily_reports")
    .select("*", { count: "exact", head: true })
    .in("student_id", studentIds)
    .gte("date", sevenDaysAgo)
    .not("submitted_at", "is", null),
  admin.from("daily_reports")
    .select("*", { count: "exact", head: true })
    .in("student_id", studentIds)
    .gte("date", sevenDaysAgo)
    .not("reviewed_by", "is", null),
]);

const submitted = submittedResult.count ?? 0;
const reviewed = reviewedResult.count ?? 0;
const reviewRate = submitted > 0 ? Math.round((reviewed / submitted) * 100) : 0;
```

### Empty StudentIds Guard (Prevent IN([]) Query)
```typescript
// Source: coach/page.tsx established pattern
const studentIds = (studentsResult.data ?? []).map(s => s.id);

const reportsResult = studentIds.length > 0
  ? await admin.from("daily_reports").select("student_id, star_rating, date").in("student_id", studentIds)
  : { data: null, error: null };
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `computeAtRisk(student.last_active_at, ...)` | Derive from work_sessions + daily_reports dates | V1 rebuild (Phase 6) | No last_active_at column; compute from activity tables |
| V2 StatCard component with accentColor prop | Inline stat card markup | V1 rebuild | V1 has only 17 ima-* tokens; no warm/brand/tier variants |
| RPC functions for platform stats | Direct admin queries with Promise.all | V1 scope decision | V1 has no Postgres RPC functions; keep simple |
| Pagination on student/coach lists | Simple full list (no pagination required) | V1 scope | Platform has small user counts; pagination is V2 |
| `getSessionUser("owner")` (reference-old) | `requireRole("owner")` (V1) | V1 rebuild | V1 session.ts uses requireRole; import path is different |

**Deprecated/outdated in reference-old (DO NOT PORT):**
- `getSessionUser`: replaced by `requireRole` in V1
- `computeAtRisk(student.last_active_at, ...)`: `last_active_at` column does not exist in V1
- `getCachedPlatformStats()`, `getCoachPerformanceSummary()` RPCs: no RPCs in V1
- Deals, influencers, call_schedule, notifications table queries: not in V1 schema
- `StatCard` shared component: uses V2 token variants not in V1
- `EmptyState` component: not in V1 src/components/ui/ — build inline empty states
- Pagination component: not needed for V1 scale
- `streak_count`, `last_active_at`, `niche` (on coach) from reference-old users queries

---

## Open Questions

1. **`notFound()` vs redirect on invalid studentId/coachId**
   - What we know: Coach student detail uses `notFound()` for missing students; reference-old uses an inline EmptyState for invalid UUIDs.
   - What's unclear: V1 does not have an EmptyState component in src/components/ui/ — only inline empty state markup is used.
   - Recommendation: Use `notFound()` for missing/invalid IDs (Next.js handles 404 page). Optionally add a UUID regex guard before the DB query to avoid unnecessary DB round-trips.

2. **Student list card vs table layout (Claude's Discretion)**
   - What we know: Reference-old uses a table view with toggle. Decision is left to Claude.
   - Recommendation: Use a simple card grid (2-col desktop, 1-col mobile) matching the coach dashboard student grid. Simpler to implement, consistent visual language. Search input at the top of the client component.

3. **Coach detail page client vs server component**
   - What we know: All data fetching is read-only. The only interactive element is the tab (if any) or just a static layout.
   - Recommendation: Pure server component for coach detail — no tabs needed. Header + 4 stat cards + assigned students grid is static. If needed, a thin client wrapper only for any future interactive elements.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no jest.config.*, vitest.config.*, or pytest.ini found) |
| Config file | none — Wave 0 gap |
| Quick run command | `npm run build && npx tsc --noEmit` (type + build check) |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OWNER-01 | Owner dashboard renders 4 stat cards with correct counts | smoke | `npm run build` (build confirms no TS errors in queries) | ❌ Wave 0 |
| OWNER-02 | Search filters student list by name/email | manual | Navigate to /owner/students, type in search box | N/A (manual) |
| OWNER-03 | Owner can view any student's detail page | smoke | `npx tsc --noEmit` (type-checks server component fetches) | ❌ Wave 0 |
| OWNER-04 | Coach list shows student count + avg rating | smoke | `npm run build` | ❌ Wave 0 |
| OWNER-05 | Coach detail shows 4 stats + assigned students | smoke | `npm run build` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` with 0 errors before `/gsd:verify-work`

### Wave 0 Gaps
- No unit test framework configured — project uses type checking and manual QA
- [ ] No automated test files exist — this phase follows the project pattern of type + lint + build as the verification gate

*(The project has no test infrastructure; all phases to date have used `npm run build` + `npx tsc --noEmit` + manual UAT as the quality gate.)*

---

## Sources

### Primary (HIGH confidence)
- `src/lib/config.ts` — OWNER_CONFIG.statCards, COACH_CONFIG, ROUTES.owner, NAVIGATION.owner
- `supabase/migrations/00001_create_tables.sql` — V1 schema: exact column names, RLS policies for owner
- `src/app/(dashboard)/coach/page.tsx` — Established stat card inline pattern, enrichment pattern, Promise.all, empty guard
- `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — StudentDetailClient call pattern
- `src/components/coach/StudentCard.tsx` — Existing component to extend with basePath
- `src/components/coach/StudentDetailClient.tsx` — Props interface to reuse/adapt

### Secondary (MEDIUM confidence)
- `reference-old/src/app/(dashboard)/owner/page.tsx` — Prior owner dashboard logic (V2 features stripped)
- `reference-old/src/app/(dashboard)/owner/students/page.tsx` — URL param search pattern, ilike query
- `reference-old/src/app/(dashboard)/owner/coaches/page.tsx` — Coach list structure
- `reference-old/src/components/owner/CoachCard.tsx` — Coach card visual pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns directly verified against existing Phase 6/7 code
- Pitfalls: HIGH — verified against actual V1 schema and existing component interfaces

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable — no new dependencies, schema is frozen for V1)
