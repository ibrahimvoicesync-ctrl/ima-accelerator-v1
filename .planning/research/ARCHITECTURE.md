# Architecture Research

**Domain:** Student performance & coaching platform — v1.3 feature additions
**Researched:** 2026-03-31
**Confidence:** HIGH (derived from direct codebase inspection)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER (React 19)                               │
│  ┌───────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │ Server Pages  │  │  "use client"       │  │  "use client"    │    │
│  │ (reads only)  │  │  WorkTrackerClient  │  │  RoadmapClient   │    │
│  │ async/await   │  │  (state machine)    │  │  (confirm modal) │    │
│  └──────┬────────┘  └────────┬───────────┘  └────────┬─────────┘    │
│         │                   │  fetch()                │ fetch()      │
├─────────┴───────────────────┴─────────────────────────┴─────────────┤
│                     NEXT.JS 16 APP ROUTER                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ src/proxy.ts  — Route guard (not middleware.ts)                │  │
│  │   • requireRole() used in server pages                         │  │
│  │   • Redirects by role on wrong path                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ API Routes  src/app/api/                                       │  │
│  │   CSRF → Auth → Role → RateLimit → Body → Zod → DB            │  │
│  │   Always: verifyOrigin() + createAdminClient() queries         │  │
│  └────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                     SUPABASE                                         │
│  ┌──────────┐  ┌─────────────────┐  ┌─────────────────────────┐     │
│  │  Auth    │  │  Postgres + RLS │  │  RPCs (SECURITY DEFINER)│     │
│  │  Google  │  │  9+ tables      │  │  get_student_detail     │     │
│  │  OAuth   │  │  admin client   │  │  get_owner_dashboard    │     │
│  │          │  │  for all writes │  │  get_sidebar_badges     │     │
│  └──────────┘  └─────────────────┘  └─────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ pg_cron (Supabase Pro)                                         │  │
│  │   • 2 AM UTC: refresh_student_kpi_summaries (advisory lock)   │  │
│  │   • 3:30 AM UTC: cleanup rate_limit_log (2h window)           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Existing State |
|-----------|----------------|----------------|
| `WorkTrackerClient` | State machine: idle→setup→working→break. Owns session lifecycle via fetch to `/api/work-sessions`. | Existing — needs plan-awareness |
| `RoadmapClient` | Step completion flow: confirm modal → PATCH → unlock URL modal. Read from config. | Existing — no changes needed for undo |
| `coach/RoadmapTab` | Read-only roadmap progress display with deadline chips. | Existing — add undo button |
| `src/lib/config.ts` | Single source of truth for ROADMAP_STEPS, WORK_TRACKER, navigation. | Existing — needs DAILY_PLAN config additions |
| API Route handlers | Pattern: CSRF → Auth → Role → RateLimit → Zod → admin client. | Existing pattern — new routes follow exactly |

---

## Recommended Project Structure for v1.3 Additions

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── student/
│   │       └── work/
│   │           └── page.tsx          # MODIFIED: fetch today's plan + sessions
│   └── api/
│       ├── daily-plans/
│       │   └── route.ts              # NEW: POST (create plan), GET (today's plan)
│       └── roadmap/
│           ├── route.ts              # EXISTING: student step complete (PATCH)
│           └── undo/
│               └── route.ts          # NEW: PATCH (coach/owner step undo)
├── components/
│   ├── student/
│   │   ├── WorkTrackerClient.tsx     # MODIFIED: plan-mode awareness + cap enforcement
│   │   ├── DailyPlannerClient.tsx    # NEW: plan setup wizard (session count, durations)
│   │   ├── PlanCompletionCard.tsx    # NEW: motivational card + ad-hoc session picker
│   │   └── RoadmapClient.tsx         # UNCHANGED (undo is coach/owner only)
│   └── coach/
│       └── RoadmapTab.tsx            # MODIFIED: add undo button per completed step
└── lib/
    └── config.ts                     # MODIFIED: DAILY_PLAN config block + ROADMAP_STEPS updates
```

### Structure Rationale

- **`api/daily-plans/`:** New top-level route directory matching existing convention (work-sessions, roadmap, reports). GET returns today's plan for the student (or null). POST creates a new plan.
- **`api/roadmap/undo/`:** Sub-path under `/api/roadmap` scoped to the undo action. Separate route file prevents bloating the existing route.ts and signals clearly it is a new operation with different role requirements (coach + owner, not student).
- **`DailyPlannerClient.tsx`:** Isolated "use client" component for the plan setup wizard. Keeps WorkTrackerClient focused on session execution; planner owns the plan creation step.
- **`PlanCompletionCard.tsx`:** Shown after plan is complete (all planned sessions done). Owns the post-plan motivational content and ad-hoc session trigger. Separate component makes it independently swappable.

---

## Architectural Patterns

### Pattern 1: API Route Mutation Chain

Every mutation route in the codebase follows this exact order:

```
verifyOrigin()          → 403 if CSRF mismatch
supabase.auth.getUser() → 401 if no session
admin.from("users")     → 404 if profile missing
role check              → 403 if wrong role
checkRateLimit()        → 429 if over limit
request.json()          → 400 if invalid JSON
zod.safeParse()         → 400 if schema fails
ownership assertion     → 404 if not their data
DB mutation             → 500 if DB error
return response         → 200/201
```

All new API routes (`POST /api/daily-plans`, `PATCH /api/roadmap/undo`) must follow this identical chain. The undo route role-check must allow both `coach` and `owner` (not just one).

### Pattern 2: Server Page + Thin Client

Every dashboard page is a server component that fetches all data on the server, then passes typed props to a single "use client" component for interactivity:

```typescript
// Server page (page.tsx) — existing pattern
export default async function WorkPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  // Parallel fetch: sessions AND today's plan
  const [sessions, planResult] = await Promise.all([
    admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today),
    admin.from("daily_plans").select("*").eq("student_id", user.id).eq("date", today).maybeSingle(),
  ]);
  return <WorkTrackerClient initialSessions={sessions ?? []} initialPlan={planResult.data ?? null} />;
}
```

The `work/page.tsx` adds one parallel query for today's `daily_plans` row alongside the existing sessions fetch.

**Why:** Avoids client-side data loading on mount. The plan state at page load is always fresh from the server.

### Pattern 3: plan_json Column Design

The `daily_plans` table uses a `plan_json` JSONB column to store the planned session sequence. This allows flexible structure without additional join tables:

```typescript
type PlanSession = {
  type: "work" | "break";
  minutes: number;
};

type PlanJson = {
  sessions: PlanSession[];    // ordered list: work, break, work, break, ...
  total_work_minutes: number; // pre-computed, enforced <= 240 (4h cap)
};
```

**Why JSONB over normalized rows:** The plan is immutable after creation (individual planned sessions are never edited). It is only read as a whole to drive WorkTrackerClient. JSONB avoids a `plan_sessions` join table and a second query. Matches the pattern used in `get_student_detail` RPC which also returns JSONB aggregates.

**Constraint enforcement:** The `total_work_minutes <= 240` (4h cap) is enforced at the API layer via Zod validation before insert — not as a DB check constraint. This matches the existing pattern where business rules live in route handlers.

### Pattern 4: State Machine Extension for Plan-Mode

WorkTrackerClient already uses a discriminated union phase state:

```typescript
type TrackerPhase =
  | { kind: "idle" }
  | { kind: "setup" }
  | { kind: "working" }
  | { kind: "break"; secondsRemaining: number };
```

When a plan exists, the `idle` → `setup` transition is replaced by plan-driven flow. No new phase variants are needed — instead a `planMode: boolean` derived from `initialPlan !== null` gates which UI renders in the `idle` state:

- No plan → existing "Set Up Session" button → manual setup unchanged
- Plan exists, not complete → "Start Planned Session N (Xm)" button → skips setup, uses plan's predetermined duration
- Plan complete → `PlanCompletionCard` renders instead of idle prompt

**Why no new phase variants:** Avoids rewriting the break countdown and working-state logic. Plan-mode affects only the idle→start transition and the post-completion UI.

### Pattern 5: Undo Logging Table

The coach roadmap undo requires an audit trail. A new `roadmap_undo_log` table follows the `rate_limit_log` precedent (append-only, admin client only, no JWT RLS policies, separate from the main business table):

```sql
CREATE TABLE public.roadmap_undo_log (
  id          bigserial PRIMARY KEY,
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  undone_by   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  undone_at   timestamptz NOT NULL DEFAULT now()
);
-- RLS enabled, no policies — admin client (service_role) only
```

This keeps `roadmap_progress` clean and separates the audit concern.

---

## Data Flow

### Daily Plan Creation Flow

```
Student opens /student/work (no plan today)
    ↓
Server page: parallel fetch sessions + daily_plans WHERE date = today
    ↓ plan is null
WorkTrackerClient renders in "no-plan" state → shows DailyPlannerClient
    ↓ student picks session count (1-4) and duration per session
    ↓ DailyPlannerClient auto-generates alternating breaks
    ↓ pre-computes total_work_minutes; enforces <= 240 client-side
POST /api/daily-plans { date, plan_json }
    ↓ CSRF → Auth → Role(student) → RateLimit → Zod (validates total_work_minutes) → INSERT daily_plans
    ↓ 201 { id, date, plan_json, status: "active" }
router.refresh() → server page re-fetches → WorkTrackerClient receives plan
    ↓ renders plan-mode idle: "Start Planned Session 1 (45 min)"
```

### Plan Session Execution Flow

```
Student clicks "Start Planned Session N"
    ↓
WorkTrackerClient derives session_minutes from plan_json.sessions[workIndex].minutes
    → calls existing handleStart() with that duration (no new fetch pattern needed)
    → POST /api/work-sessions { date, cycle_number, session_minutes }
Session completes (manual or timer)
    ↓ PATCH /api/work-sessions/[id] { status: "completed" }
    ↓ WorkTrackerClient checks: completedCount == plan work session count?
    → No: show plan-specified break duration, then next planned session
    → Yes: render PlanCompletionCard
```

### Coach Roadmap Undo Flow

```
Coach views student detail → RoadmapTab
    ↓ completed step row shows UndoStepButton (new component)
    ↓ coach clicks undo → confirmation modal
    ↓ coach confirms
PATCH /api/roadmap/undo { student_id, step_number }
    ↓ CSRF → Auth → Role(coach|owner) → RateLimit → Zod
    ↓ ownership: if coach, verify student.coach_id === profile.id
    ↓ DB transaction:
        UPDATE roadmap_progress SET status='active', completed_at=null WHERE step=N
        UPDATE roadmap_progress SET status='locked' WHERE step=N+1 (if not completed)
        INSERT roadmap_undo_log (student_id, step_number, undone_by, undone_at)
    ↓ 200 { undone: step row }
RoadmapTab: router.refresh() re-fetches coach student detail page
```

### Post-Plan Completion Flow

```
WorkTrackerClient: completedCount === plan work session count
    ↓ renders PlanCompletionCard instead of idle prompt
PlanCompletionCard:
    - Arabic + English motivational message
    - "Add Ad-Hoc Session" button
    ↓ student clicks "Add Ad-Hoc Session"
    ↓ WorkTrackerClient re-enters setup phase (standard duration picker, no plan cap)
    ↓ POST /api/work-sessions (same as existing, no plan_id needed)
    ↓ session tracked normally — ad-hoc sessions are uncapped
```

---

## New vs Modified: Explicit Inventory

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/app/api/daily-plans/route.ts` | API Route | POST create plan, GET today's plan |
| `src/app/api/roadmap/undo/route.ts` | API Route | PATCH undo step (coach/owner only) |
| `src/components/student/DailyPlannerClient.tsx` | Client Component | Plan setup wizard UI |
| `src/components/student/PlanCompletionCard.tsx` | Client Component | Post-plan motivational card + ad-hoc picker |
| `supabase/migrations/00013_v1_3_schema.sql` | Migration | daily_plans + roadmap_undo_log tables + RLS |

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `src/app/(dashboard)/student/work/page.tsx` | Add parallel fetch for today's `daily_plans` row | Server page passes plan to WorkTrackerClient |
| `src/components/student/WorkTrackerClient.tsx` | Accept `initialPlan` prop, plan-mode logic in idle state, plan-driven session start | Plan-driven session execution |
| `src/components/coach/RoadmapTab.tsx` | Embed UndoStepButton per completed step | Coach undo capability |
| `src/lib/config.ts` | Add `DAILY_PLAN` config block (4h cap constant, default break minutes) | Config-as-truth pattern |
| `src/lib/config.ts` | Update ROADMAP_STEPS (text appends, unlock_url move step 6→5, step 6/7 rewrites, step 8 target_days: 14) | Roadmap text updates per requirements |

### Unchanged Files

| File | Rationale |
|------|-----------|
| `src/app/api/roadmap/route.ts` | Student step completion is unchanged — undo is a new separate route |
| `src/components/student/RoadmapClient.tsx` | Students cannot undo their own steps — no changes needed |
| `src/lib/rate-limit.ts` | New routes call existing `checkRateLimit()` unchanged |
| `src/lib/csrf.ts` | New routes call existing `verifyOrigin()` unchanged |
| All coach analytics, calendar, KPI summary components | Out of scope for v1.3 |

---

## Database Schema Additions

### daily_plans table

```sql
CREATE TABLE public.daily_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  plan_json   jsonb NOT NULL,
  status      varchar(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX idx_daily_plans_student_date ON public.daily_plans(student_id, date DESC);

-- RLS: student sees own plans; coach sees assigned students; owner sees all
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
```

**plan_json shape (example: 3 work sessions):**

```json
{
  "sessions": [
    { "type": "work",  "minutes": 45 },
    { "type": "break", "minutes": 10 },
    { "type": "work",  "minutes": 45 },
    { "type": "break", "minutes": 10 },
    { "type": "work",  "minutes": 45 }
  ],
  "total_work_minutes": 135
}
```

Break auto-generation rule (enforced in DailyPlannerClient before submit, mirrored in API Zod schema):
- After each work block except the last: insert a short break (default 10 min)
- No break appended after the final work block
- Breaks excluded from the 240-min cap calculation

### roadmap_undo_log table

```sql
CREATE TABLE public.roadmap_undo_log (
  id          bigserial PRIMARY KEY,
  student_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  undone_by   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  undone_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_undo_log_student ON public.roadmap_undo_log(student_id, undone_at DESC);

-- Admin client only — no JWT RLS policies (matches rate_limit_log pattern)
ALTER TABLE public.roadmap_undo_log ENABLE ROW LEVEL SECURITY;
```

---

## Integration Points

### WorkTrackerClient ↔ DailyPlannerClient

WorkTrackerClient renders DailyPlannerClient inline when the student has no plan yet and no active/paused session. DailyPlannerClient signals completion via `onPlanCreated(plan)` callback prop, triggering `router.refresh()` to re-render with the new plan. No route navigation required.

```
WorkTrackerClient state decision:
  initialPlan === null AND no active/paused session → render DailyPlannerClient inline
  initialPlan !== null AND plan not complete        → render plan-mode session buttons
  initialPlan !== null AND plan complete            → render PlanCompletionCard
  activeSession exists                              → render WorkTimer (unchanged)
```

### WorkTrackerClient ↔ PlanCompletionCard

After all planned work sessions complete:
- Derivation: `completedCount` (from `sessions` state) equals `plan_json.sessions.filter(s => s.type === 'work').length`
- WorkTrackerClient renders PlanCompletionCard in place of the idle prompt
- PlanCompletionCard's "Add Ad-Hoc Session" calls back into WorkTrackerClient to re-enter standard setup phase (`setPhase({ kind: "setup" })`) with cap enforcement bypassed

### coach/RoadmapTab ↔ PATCH /api/roadmap/undo

RoadmapTab is currently a display-only "use client" component. Adding undo adds mutations. To minimise diff, extract per-step undo into a new `UndoStepButton` client component embedded per completed step row. RoadmapTab renders it alongside the existing step display — no architectural change to RoadmapTab itself.

### /api/roadmap/undo ↔ Ownership Check

The undo route must verify the coach owns the student before mutating. This mirrors the ownership check pattern established in Phase 23 (reports/[id]/review fix):

```typescript
if (profile.role === "coach") {
  const { data: studentRow } = await admin
    .from("users")
    .select("coach_id")
    .eq("id", body.student_id)
    .single();
  if (!studentRow || studentRow.coach_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
// owner: no ownership check — can undo any student's step
```

---

## Build Order

Build order is determined by dependency chains: schema → config → API → components → page integration.

### Phase A: Config + Schema Foundation (no deps, safe to deploy standalone)

1. **ROADMAP_STEPS updates in `config.ts`** — Text edits, unlock_url move, target_days change. Zero risk. Deploy first because coach/student UI uses config directly.
2. **Stage headers in `RoadmapClient.tsx` + `RoadmapTab.tsx`** — Config-driven grouping by `step.stage`. Depends only on config step A1.
3. **Migration `00013_v1_3_schema.sql`** — Creates `daily_plans` + `roadmap_undo_log` tables with RLS. No application code needed yet.

### Phase B: Coach Roadmap Undo (self-contained, no dependency on Phase C)

4. **`PATCH /api/roadmap/undo` route** — New API file. Requires `roadmap_undo_log` from A3. Follows existing mutation chain.
5. **`UndoStepButton` component + integration into `RoadmapTab`** — Depends on B4 API. Confirm modal → fetch → router.refresh().

### Phase C: Daily Session Planner (build in sequence)

6. **`DAILY_PLAN` config block in `config.ts`** — `maxWorkMinutes: 240`, `defaultBreakMinutes: 10`. Zero deps.
7. **`DailyPlannerClient.tsx`** — Client component, UI only. Calls POST endpoint built next.
8. **`POST /api/daily-plans` route** — Requires schema A3. Zod validates `total_work_minutes <= 240`.
9. **`GET /api/daily-plans` route** — Returns today's plan row or null. Used by server page.
10. **`work/page.tsx` modification** — Add `daily_plans` fetch to existing `Promise.all`. Pass `initialPlan` to WorkTrackerClient.
11. **`WorkTrackerClient.tsx` modification** — Accept `initialPlan` prop. Plan-mode idle state, plan-driven session start.
12. **`PlanCompletionCard.tsx`** — Depends on WorkTrackerClient changes from C11.

### Dependency Graph

```
A1 (config text)
  └─→ A2 (stage headers)

A3 (migration)
  ├─→ B4 (undo API) → B5 (undo button UI)
  └─→ C8 (daily-plans POST API)

C6 (DAILY_PLAN config)
  └─→ C7 (DailyPlannerClient) → needs C8 running

C8 + C9 (POST + GET API)
  └─→ C10 (work page) → C11 (WorkTrackerClient) → C12 (PlanCompletionCard)
```

---

## Scaling Considerations

| Concern | Current (5k students) | v1.3 Impact |
|---------|----------------------|-------------|
| `daily_plans` reads | One row per student per day | Negligible — indexed on `(student_id, date)` |
| `roadmap_undo_log` writes | Rare manual coach action | No measurable load |
| `plan_json` storage | ~500 bytes per row | No concern at any scale |
| Rate limiting | 30 req/min per endpoint | New routes inherit same limit |
| Plan cap enforcement | Client-side + API Zod validation | No additional DB queries |

---

## Anti-Patterns

### Anti-Pattern 1: Fetching Plan Client-Side on Mount

**What people do:** Add a `useEffect` in WorkTrackerClient to `fetch('/api/daily-plans?date=today')` on mount.

**Why it's wrong:** Violates the Server Page + Thin Client pattern. Causes layout shift (blank state while fetching). Server already knows the plan at render time.

**Do this instead:** Server page (`work/page.tsx`) fetches plan in the existing `Promise.all` and passes as `initialPlan` prop.

### Anti-Pattern 2: Adding Undo to the Existing Student PATCH /api/roadmap

**What people do:** Add a `undo: true` flag to the existing student roadmap PATCH route.

**Why it's wrong:** That route enforces `profile.role === "student"` and only advances steps forward. Mixing student-complete and coach-undo in one handler requires complex role branching and risks privilege escalation bugs.

**Do this instead:** New route at `/api/roadmap/undo` with its own role check (`coach | owner`), its own Zod schema (requires `student_id`), and its own ownership assertion.

### Anti-Pattern 3: Storing Plan Execution Index in daily_plans

**What people do:** Add a `current_session_index` column to `daily_plans`, increment it on every session completion.

**Why it's wrong:** Execution position is fully derivable: `plan_position = sessions WHERE date=today AND status=completed COUNT`. Writing to `daily_plans` on every session completion adds unnecessary mutations and a second table to update atomically.

**Do this instead:** Derive plan position from the existing `completedCount` in WorkTrackerClient state. Zero DB changes needed.

### Anti-Pattern 4: Adding plan_id Foreign Key to work_sessions

**What people do:** Add `plan_id uuid REFERENCES daily_plans(id)` on `work_sessions`.

**Why it's wrong:** There is only ever one plan per student per date. The association is already captured by `student_id + date` matching. A foreign key adds migration complexity, a join to every session query, and no functional benefit in V1.

**Do this instead:** Derive plan association from `work_sessions.date = daily_plans.date` for the same `student_id`. The implicit join by date is sufficient.

---

## Sources

- Direct inspection: `src/app/api/roadmap/route.ts` — existing PATCH mutation pattern
- Direct inspection: `src/app/api/work-sessions/route.ts` — POST mutation chain template
- Direct inspection: `src/components/student/WorkTrackerClient.tsx` — phase state machine
- Direct inspection: `src/components/coach/RoadmapTab.tsx` — current read-only display
- Direct inspection: `supabase/migrations/00012_rate_limit_log.sql` — undo_log table precedent
- Direct inspection: `supabase/migrations/00011_write_path.sql` — JSONB/RPC pattern precedent
- Direct inspection: `src/lib/config.ts` — WORK_TRACKER, ROADMAP_STEPS, config-as-truth pattern
- Direct inspection: `.planning/PROJECT.md` — v1.3 active requirements

---
*Architecture research for: IMA Accelerator v1.3 — Daily Planner, Coach Undo, Roadmap Updates*
*Researched: 2026-03-31*
