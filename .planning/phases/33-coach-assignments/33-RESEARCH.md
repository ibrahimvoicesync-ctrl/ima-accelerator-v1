# Phase 33: Coach Assignments - Research

**Researched:** 2026-04-03
**Domain:** Next.js App Router server/client component pattern, Supabase admin client, optimistic UI, role-based route guarding
**Confidence:** HIGH

## Summary

Phase 33 adds a `/coach/assignments` page that gives coaches the same assignment power as the owner, using the exact same API endpoint (`/api/assignments`) with an expanded role guard. The code already exists and is well-structured — this is a focused adaptation task, not a greenfield build.

The owner assignments page (`src/app/(dashboard)/owner/assignments/page.tsx`) and its client component (`OwnerAssignmentsClient.tsx`) are the primary templates. The coach version will be a simplified adaptation: same data queries (all `role='student'` students + all active coaches), same optimistic UI pattern, same API fetch — but without the coach capacity cards, stats counters, or "Invite Students" empty state link.

The API route (`/api/assignments/route.ts`) requires a one-line role guard change: `profile.role !== 'owner'` becomes `profile.role !== 'owner' && profile.role !== 'coach'`. All validation, CSRF, rate limiting, and DB update logic remains identical. Navigation registration in `src/lib/config.ts` (both `NAVIGATION.coach` and `ROUTES.coach`) is the only config change required.

**Primary recommendation:** Create `CoachAssignmentsClient.tsx` as a stripped-down fork of `OwnerAssignmentsClient.tsx` (remove capacity cards, remove stats row), create `src/app/(dashboard)/coach/assignments/page.tsx` following the owner page server component pattern, expand the API role guard, and register the nav entry. Four files touched, no new dependencies.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Coaches see ALL students — unassigned, their own, AND other coaches' students. Full visibility, same as owner. Required for reassignment across coaches (ASSIGN-03).
- **D-02:** student_diy users are hidden entirely from the assignment list. Filter with `WHERE role = 'student'`. They cannot be assigned, so showing them as disabled is confusing.
- **D-03:** Simplified version of owner page — no coach capacity cards or stats counters. Just a searchable student list with a coach dropdown selector per student. Same functional power, lighter UI.
- **D-04:** Reuse the existing `/api/assignments` route — expand the role check from owner-only to owner+coach. No separate endpoint needed.

### Claude's Discretion

- Search/filter UX details (debounce timing, placeholder text)
- Exact layout and spacing of the student list
- Loading skeleton design
- Empty state messaging

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASSIGN-01 | Coach can view all students (not just their own) on a /coach/assignments page | Server component page fetches all `role='student'` users via admin client (same query as owner page minus `eq("coach_id", user.id)` filter) |
| ASSIGN-02 | Coach can assign an unassigned student to any active coach | Reuse `handleAssign` + PATCH `/api/assignments?studentId=X` with `{ coach_id: coachId }` — API expanded to allow coach role |
| ASSIGN-03 | Coach can reassign a student from one coach to another | Same PATCH call — API verifies target coach is active; client shows optimistic reassignment; router.refresh() syncs server state |
| ASSIGN-04 | Coach can unassign a student (set coach_id to null) | Same PATCH call with `{ coach_id: null }` — already supported by Zod schema (`z.string().guid().nullable()`) |
| ASSIGN-05 | API returns 403 for student and student_diy roles attempting assignment changes | One-line fix in route.ts: change `profile.role !== 'owner'` to `profile.role !== 'owner' && profile.role !== 'coach'`; non-matching roles still hit 403 |
| ASSIGN-06 | Owner assignments page continues to work unchanged | No changes to owner page or its client component — only the API role guard expands, owner still passes the check |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router server components + API routes | Project standard |
| React | 19.2.3 | Client component hooks (useState, useCallback, useRef) | Project standard |
| TypeScript | ^5 | Strict mode throughout | Project standard |
| Supabase JS | ^2.99.2 | Admin client for DB queries in server components + API | Project standard |
| Zod | ^4.3.6 | `import { z } from "zod"` — API input validation | Hard rule |
| lucide-react | ^0.576.0 | ArrowLeftRight icon (matches owner page) | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CVA-based primitives | in-repo | Card, Input, EmptyState, Toast | All UI components |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `/api/assignments` | New `/api/coach/assignments` | No reason to duplicate — role expansion is simpler and D-04 locked this |

**Installation:** No new npm packages required. Zero new dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(dashboard)/coach/assignments/
│   └── page.tsx                          # NEW — server component (auth, data fetch)
├── components/coach/
│   └── CoachAssignmentsClient.tsx        # NEW — client component (search, dropdown, optimistic)
├── lib/config.ts                         # EDIT — add assignments to NAVIGATION.coach + ROUTES.coach
└── app/api/assignments/route.ts          # EDIT — expand role guard to include 'coach'
```

### Pattern 1: Server Component Page with Admin Client Data Fetch

**What:** Server component calls `requireRole("coach")`, fetches all students and all active coaches via admin client in parallel, passes data as props to client component.

**When to use:** Every dashboard page in this project.

**Example (from `src/app/(dashboard)/owner/assignments/page.tsx`):**
```typescript
// Source: src/app/(dashboard)/owner/assignments/page.tsx
export default async function CoachAssignmentsPage() {
  const user = await requireRole("coach");  // returns SessionUser with user.id
  const admin = createAdminClient();

  const [studentsResult, coachesResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, status, coach_id")
      .eq("role", "student")          // D-02: student only, not student_diy
      .eq("status", "active")
      .order("name"),
    admin
      .from("users")
      .select("id, name")
      .eq("role", "coach")
      .eq("status", "active")
      .order("name"),
  ]);

  // ... pass to <CoachAssignmentsClient students={...} coaches={...} />
}
```

Key difference from owner page: the coach page does NOT filter by `coach_id`. D-01 requires all students are visible. The `user` object from `requireRole("coach")` is still needed to identify "current coach" so the page can show which students belong to the viewer — but the query itself returns ALL students.

### Pattern 2: Optimistic UI with Local State Override + Revert on Error

**What:** `localAssignments` Record stores overrides keyed by studentId. `getEffectiveCoachId(student)` checks local override first, then falls back to server data. On API failure, override is reverted. On success, `router.refresh()` syncs the server state.

**When to use:** Any mutation that should feel instant to the user.

**Example (from `src/components/owner/OwnerAssignmentsClient.tsx`):**
```typescript
// Source: src/components/owner/OwnerAssignmentsClient.tsx
const [localAssignments, setLocalAssignments] = useState<Record<string, string | null>>({});
const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

const handleAssign = useCallback(
  async (studentId: string, newCoachId: string | null, prevCoachId: string | null) => {
    setSavingRows((prev) => ({ ...prev, [studentId]: true }));
    setLocalAssignments((prev) => ({ ...prev, [studentId]: newCoachId })); // optimistic

    try {
      const res = await fetch(`/api/assignments?studentId=${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id: newCoachId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to update assignment" });
        setLocalAssignments((prev) => ({ ...prev, [studentId]: prevCoachId })); // revert
        return;
      }

      toastRef.current({ type: "success", title: newCoachId ? "Student assigned to coach" : "Student unassigned" });
      routerRef.current.refresh();
    } catch (err) {
      console.error("[CoachAssignmentsClient] assignment error:", err);
      toastRef.current({ type: "error", title: "Something went wrong" });
      setLocalAssignments((prev) => ({ ...prev, [studentId]: prevCoachId })); // revert
    } finally {
      setSavingRows((prev) => ({ ...prev, [studentId]: false }));
    }
  },
  []
);
```

### Pattern 3: Stable Ref Pattern for Toast and Router in useCallback

**What:** `useRef(router)` and `useRef(toast)` prevent deps churn in `useCallback` — the callback deps array stays `[]` while refs always point to the latest values.

**Example:**
```typescript
const routerRef = useRef(router);
const toastRef = useRef(toast);
routerRef.current = router;
toastRef.current = toast;
```

This is established project convention (see OwnerAssignmentsClient.tsx, also CLAUDE.md "Stable useCallback deps").

### Pattern 4: API Role Guard Expansion

**What:** The existing PATCH handler in `/api/assignments/route.ts` line 35 currently reads:
```typescript
if (profile.role !== "owner") {
```

The one-line fix:
```typescript
if (profile.role !== "owner" && profile.role !== "coach") {
```

No other logic changes. Students and student_diy still receive 403. Owner continues to pass. Coach now passes.

### Pattern 5: Config Registration (NAVIGATION + ROUTES)

**What:** Every new page requires two additions to `src/lib/config.ts`:

1. Add to `ROUTES.coach`:
```typescript
assignments: "/coach/assignments",
```

2. Add to `NAVIGATION.coach` array (insert between Analytics and Alerts, or after Alerts — Claude's discretion on exact position):
```typescript
{ label: "Assignments", href: "/coach/assignments", icon: "ArrowLeftRight", separator: true },
```

The separator groups it visually with Invite Students and Analytics (the admin-power tools).

### Pattern 6: Proxy Route Guard

**What:** The proxy already grants coach role access to all `/coach/*` routes via:
```typescript
ROLE_ROUTE_ACCESS: { coach: ["/coach"] }
```

No proxy changes are needed. `/coach/assignments` matches the `/coach` prefix automatically.

### Anti-Patterns to Avoid

- **Filtering students by coach_id in the page query:** D-01 requires ALL students to be visible. Do not add `.eq("coach_id", user.id)` to the student query (unlike the coach dashboard and students page which correctly scope to assigned students).
- **Creating a new API endpoint:** D-04 locked reuse of `/api/assignments`. No `/api/coach/assignments` route.
- **Removing CSRF or rate limit:** Both `verifyOrigin()` and `checkRateLimit()` must stay in the API route — they're project-wide hard rules.
- **Importing admin client in client components:** `createAdminClient()` only in server components and API routes.
- **Hardcoded hex colors or gray classes:** All colors use ima-* tokens.
- **Missing 44px touch target on select/dropdown:** The select element needs `min-h-[44px]` (already in owner client, copy faithfully).
- **Missing motion-safe prefix on animations:** Any `transition-*` or `animate-*` must use `motion-safe:` prefix.
- **student_diy in the assignment list:** The server page query uses `.eq("role", "student")` exclusively — D-02.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic state management | Custom mutation tracker | Established `localAssignments` + `savingRows` pattern from OwnerAssignmentsClient | Already battle-tested in this codebase |
| Role authorization | Custom middleware | `requireRole("coach")` from `src/lib/session.ts` | Single source of truth, handles redirect |
| Input validation | Manual type checks | Zod `assignSchema` already defined in route.ts | Hard rule — safeParse on all API inputs |
| CSRF protection | Custom origin check | `verifyOrigin(request)` from `src/lib/csrf.ts` | Already in route, must not be removed |
| Rate limiting | Custom counter | `checkRateLimit(profile.id, "/api/assignments")` | Already in route, must not be removed |
| Search/filter | External library | Inline `.filter()` on client-side student array | Simple string match, no library needed |
| DB mutation via student client | Direct `.update()` with anon client | Admin client in API route | Hard rule — `.from()` in route handlers uses admin client |

**Key insight:** Every complex problem in this phase is already solved. The implementation is a structural adaptation of existing code, not a design exercise.

---

## Common Pitfalls

### Pitfall 1: Filtering students by coach_id (breaks ASSIGN-01, ASSIGN-03)
**What goes wrong:** The coach page accidentally scopes students to `.eq("coach_id", user.id)` (copied from the dashboard/students pages), showing only assigned students instead of all students.
**Why it happens:** The coach dashboard and `/coach/students` pages both filter by `coach_id`. It's the natural copy-paste pattern for a coach page.
**How to avoid:** The query must match the owner page exactly — no `coach_id` filter. D-01 is the override.
**Warning signs:** Coach can't see unassigned students or other coaches' students at all.

### Pitfall 2: Not displaying which coach currently owns each student
**What goes wrong:** The dropdown defaults to "Unassigned" for ALL students because the initial `coach_id` isn't passed or rendered correctly.
**Why it happens:** Passing `students` without `coach_id` in the select, or forgetting to include `coach_id` in the server-side `.select()` call.
**How to avoid:** Server select must include `coach_id`: `.select("id, name, email, status, coach_id")`. Client `getEffectiveCoachId()` uses `localAssignments.hasOwnProperty(student.id) ? localAssignments[student.id] : student.coach_id`.

### Pitfall 3: student_diy users appearing in the list (breaks D-02)
**What goes wrong:** Assignment page shows student_diy users, which are confusing since they can't be assigned.
**Why it happens:** Query uses `.in("role", ["student", "student_diy"])` or omits role filter entirely.
**How to avoid:** Use `.eq("role", "student")` exclusively in the server query.

### Pitfall 4: API role guard only checks for "coach", not both "owner" and "coach"
**What goes wrong:** Owner can no longer make assignments after the guard change.
**Why it happens:** Replacing `profile.role !== "owner"` with `profile.role !== "coach"` instead of expanding it.
**How to avoid:** The final guard must be `profile.role !== "owner" && profile.role !== "coach"`. ASSIGN-06 explicitly requires the owner path to remain working.

### Pitfall 5: Missing `response.ok` check in client fetch
**What goes wrong:** A 4xx or 5xx response from the API is silently treated as success; optimistic update is not reverted; student appears assigned when they're not.
**Why it happens:** Forgetting to check `if (!res.ok)` before parsing JSON or showing success toast.
**How to avoid:** Follow the established pattern — check `!res.ok`, toast the error, revert `localAssignments`. Hard rule: every `fetch()` must check `response.ok`.

### Pitfall 6: Nav item missing from config (route exists but coach can't navigate there)
**What goes wrong:** Coach navigates directly to `/coach/assignments` by URL but has no sidebar link.
**Why it happens:** Page created but `NAVIGATION.coach` not updated.
**How to avoid:** Both `ROUTES.coach.assignments` and `NAVIGATION.coach` must be updated in `src/lib/config.ts`. Config-is-truth rule.

---

## Code Examples

### Server Page — Data Fetch Pattern
```typescript
// Based on: src/app/(dashboard)/owner/assignments/page.tsx
// Coach adaptation: same queries, no coach_id filter, no stat cards
export default async function CoachAssignmentsPage() {
  await requireRole("coach");
  const admin = createAdminClient();

  const [studentsResult, coachesResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, status, coach_id")
      .eq("role", "student")   // role='student' only, D-02
      .eq("status", "active")
      .order("name"),
    admin
      .from("users")
      .select("id, name")
      .eq("role", "coach")
      .eq("status", "active")
      .order("name"),
  ]);

  if (studentsResult.error) {
    console.error("[/coach/assignments] Failed to load students:", studentsResult.error);
  }
  if (coachesResult.error) {
    console.error("[/coach/assignments] Failed to load coaches:", coachesResult.error);
  }

  const students = studentsResult.data ?? [];
  const coaches = coachesResult.data ?? [];

  // Build coach → student count mapping
  const coachStudentCounts: Record<string, number> = {};
  for (const student of students) {
    if (student.coach_id) {
      coachStudentCounts[student.coach_id] = (coachStudentCounts[student.coach_id] ?? 0) + 1;
    }
  }

  const coachOptions = coaches.map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: coachStudentCounts[c.id] ?? 0,
  }));

  return (
    <div className="space-y-6 px-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Assignments</h1>
        </div>
        <p className="text-sm text-ima-text-secondary">
          Assign and reassign students across coaches.
        </p>
      </div>
      <CoachAssignmentsClient students={students} coaches={coachOptions} />
    </div>
  );
}
```

### API Role Guard — Exact Change
```typescript
// Before (src/app/api/assignments/route.ts line ~35):
if (profile.role !== "owner") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// After:
if (profile.role !== "owner" && profile.role !== "coach") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Config — ROUTES and NAVIGATION Additions
```typescript
// src/lib/config.ts — ROUTES.coach
coach: {
  dashboard: "/coach",
  students: "/coach/students",
  studentDetail: "/coach/students/[studentId]",
  invites: "/coach/invites",
  reports: "/coach/reports",
  analytics: "/coach/analytics",
  alerts: "/coach/alerts",
  assignments: "/coach/assignments",   // ADD
},

// NAVIGATION.coach — add Assignments entry
coach: [
  { label: "Dashboard",       href: "/coach",              icon: "LayoutDashboard" },
  { label: "My Students",     href: "/coach/students",     icon: "Users" },
  { label: "Reports",         href: "/coach/reports",      icon: "FileText", badge: "unreviewed_reports" },
  { label: "Invite Students", href: "/coach/invites",      icon: "UserPlus",      separator: true },
  { label: "Assignments",     href: "/coach/assignments",  icon: "ArrowLeftRight" },  // ADD
  { label: "Analytics",       href: "/coach/analytics",    icon: "BarChart3" },
  { label: "Alerts",          href: "/coach/alerts",       icon: "Bell", badge: "coach_milestone_alerts" },
],
```

### CoachAssignmentsClient — Interface and Props
```typescript
// src/components/coach/CoachAssignmentsClient.tsx
// Stripped version of OwnerAssignmentsClient — remove capacity cards, keep everything else

interface Student {
  id: string;
  name: string;
  email: string;
  status: string;
  coach_id: string | null;
}

interface Coach {
  id: string;
  name: string;
  studentCount: number;
}

interface CoachAssignmentsClientProps {
  students: Student[];
  coaches: Coach[];
}
```

---

## Environment Availability

Step 2.6: SKIPPED — This phase is purely code/config changes with no external dependencies. All tools (Next.js, Supabase, TypeScript) are already available in the project. No CLI utilities, databases, or external services need to be probed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework installed (no jest/vitest/playwright in package.json) |
| Config file | None |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run build` |

No automated test framework exists in this project. All validation is manual UAT + build/lint/typecheck gates.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| ASSIGN-01 | Coach sees all students on /coach/assignments | manual | `npx tsc --noEmit` (type safety) | Browser UAT required |
| ASSIGN-02 | Coach can assign unassigned student to any coach | manual | `npx tsc --noEmit` | Browser UAT required |
| ASSIGN-03 | Coach can reassign between coaches | manual | `npx tsc --noEmit` | Browser UAT required |
| ASSIGN-04 | Coach can unassign (set coach_id to null) | manual | `npx tsc --noEmit` | Browser UAT required |
| ASSIGN-05 | Student/student_diy gets 403 from API | manual-only | — | curl/Postman to verify role guard |
| ASSIGN-06 | Owner page unchanged | manual | `npm run build` | No regressions |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build green + manual UAT of all 6 requirements before `/gsd:verify-work`

### Wave 0 Gaps

None — no test infrastructure to create. This project uses build/lint/type-check as automated gates and manual UAT for behavioral verification.

---

## Project Constraints (from CLAUDE.md)

All directives from CLAUDE.md apply to this phase:

| Directive | Applies To |
|-----------|-----------|
| `motion-safe:animate-*` required on all `animate-*` classes | CoachAssignmentsClient transitions |
| `min-h-[44px]` on every interactive element | Select dropdown, filter tab buttons |
| `aria-label` or `<label>` with `htmlFor`+`id` on every input | Search input, coach select per row |
| Admin client only in API routes and server components | `createAdminClient()` in page.tsx and route.ts only |
| Never empty `catch` blocks | `handleAssign` catch must `console.error` + toast |
| Every `fetch()` checks `response.ok` | `handleAssign` must check `!res.ok` before parsing |
| `import { z } from "zod"` — not `"zod/v4"` | assignSchema already uses this |
| `ima-*` tokens only — no hardcoded hex/gray | All Tailwind classes in new components |
| `src/proxy.ts` not `middleware.ts` | No changes to proxy needed |
| Config-is-truth — import from `src/lib/config.ts` | NAVIGATION + ROUTES must be updated |
| Filter by user ID in queries, never rely on RLS alone | API already does this (verifies student exists before update) |
| `px-4` on all page wrappers for mobile | Page wrapper div must include `px-4` |

---

## Sources

### Primary (HIGH confidence)

- `src/app/(dashboard)/owner/assignments/page.tsx` — Direct template for server component structure, data query pattern
- `src/components/owner/OwnerAssignmentsClient.tsx` — Direct template for client component, optimistic UI, search, dropdowns
- `src/app/api/assignments/route.ts` — API route being modified; role guard location confirmed (line 35)
- `src/lib/config.ts` — NAVIGATION and ROUTES maps; NavItem type; COACH_CONFIG.maxStudentsPerCoach
- `src/proxy.ts` — ROLE_ROUTE_ACCESS confirms `/coach` prefix covers all coach subroutes — no proxy changes needed
- `src/lib/session.ts` — `requireRole()` signature and `SessionUser` type confirmed
- `CLAUDE.md` — All hard rules verified against existing code

### Secondary (MEDIUM confidence)

- `src/app/(dashboard)/coach/page.tsx` — Confirms coach pattern for `requireRole("coach")`, admin client usage
- `src/app/(dashboard)/coach/students/page.tsx` — Confirms why D-01 matters (this page correctly filters by coach_id; assignments page must NOT)
- `supabase/migrations/00001_create_tables.sql` — `users` table schema confirms `coach_id uuid REFERENCES public.users(id) ON DELETE SET NULL`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture patterns: HIGH — patterns verified directly in source files
- Pitfalls: HIGH — derived from direct code inspection of the templates being adapted
- API change: HIGH — exact line confirmed in route.ts

**Research date:** 2026-04-03
**Valid until:** 60 days (no external libraries involved; all patterns are internal)
