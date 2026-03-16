# Architecture Research

**Domain:** Multi-role coaching/accelerator platform (Next.js App Router + Supabase)
**Researched:** 2026-03-16
**Confidence:** HIGH — derived directly from reference codebase (`reference-old/`) and verified against Next.js/Supabase patterns

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Login Page   │  │ Register Page│  │ "use client" islands │   │
│  │ (OAuth btn)  │  │ (invite gate)│  │ (WorkTimer, forms,   │   │
│  └──────┬───────┘  └──────┬───────┘  │  modals, WorkTracker)│   │
│         │ Google OAuth     │          └──────────────────────┘   │
└─────────┼──────────────────┼──────────────────────────────────────┘
          │                  │
┌─────────┼──────────────────┼──────────────────────────────────────┐
│         │   Next.js Server  │                                      │
│  ┌──────▼──────────────────▼──────────────────────────────────┐  │
│  │                    proxy.ts (route guard)                    │  │
│  │  - Reads auth cookie via createServerClient (anon key)      │  │
│  │  - Looks up role via createAdminClient (service role)       │  │
│  │  - Redirects: unauthenticated → /login                      │  │
│  │  - Redirects: wrong role → role's default dashboard         │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │         App Router Layout Tree                                │  │
│  │                                                               │  │
│  │  app/                                                         │  │
│  │  ├── (auth)/         → layout (no sidebar)                   │  │
│  │  │   ├── login/                                               │  │
│  │  │   ├── register/[code]                                      │  │
│  │  │   └── no-access/                                           │  │
│  │  │                                                            │  │
│  │  └── (dashboard)/    → layout (sidebar + auth check)         │  │
│  │      ├── owner/      → owner route subtree                   │  │
│  │      ├── coach/      → coach route subtree                   │  │
│  │      └── student/    → student route subtree                 │  │
│  │                                                               │  │
│  │  api/                                                         │  │
│  │  ├── auth/callback/  → OAuth exchange + profile creation     │  │
│  │  ├── work-sessions/  → POST (start), /[id] PATCH (complete)  │  │
│  │  ├── reports/        → POST (submit), /[id] PATCH (review)   │  │
│  │  ├── roadmap/        → PATCH /[id] (mark step complete)      │  │
│  │  └── invites/        → POST (create), DELETE /[id]           │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
          │                                │
┌─────────▼────────────────────────────────▼─────────────────────────┐
│                         Supabase                                      │
│                                                                       │
│  ┌───────────────┐    ┌─────────────────────────────────────────┐   │
│  │  Auth Service │    │            PostgreSQL                    │   │
│  │  (Google OAuth│    │                                          │   │
│  │   sessions,   │    │  users  invites  magic_links             │   │
│  │   JWT tokens) │    │  work_sessions   roadmap_progress        │   │
│  └───────────────┘    │  daily_reports                           │   │
│                        │                                          │   │
│                        │  RLS policies on all tables              │   │
│                        │  + server-side user ID filter            │   │
│                        └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `proxy.ts` | Route protection and role-based redirects | Next.js middleware-equivalent; runs on every non-static request; uses admin client to bypass RLS for role lookups |
| `(auth)` route group | Public-facing auth pages | No sidebar layout; Google OAuth trigger; invite/magic link registration gates |
| `api/auth/callback` | OAuth exchange, profile creation, roadmap seeding | Route handler; admin client throughout; handles invite codes + magic links atomically |
| `(dashboard)` layout | Shared shell for all authenticated pages | Server component; calls `getSessionUser()`; renders `<Sidebar>` with role-appropriate nav |
| `getSessionUser()` | Per-request user resolution | `server-only` helper; exchanges auth cookie for full profile via admin client; redirects if missing/wrong role; fires last_active_at update as side effect |
| `createAdminClient()` | Service-role DB access | `server-only`; bypasses RLS; used in every server page and API route for queries |
| Role page subtrees (`/owner`, `/coach`, `/student`) | Domain-specific dashboards | Async server components; data fetched inline with `Promise.all()`; client islands passed as props |
| API route handlers (`/api/*`) | Mutation endpoints | Auth + role check first, Zod validation second, admin client query third; mutations only (no GET handlers) |
| `"use client"` islands | Interactive UI | Work timer, report form, roadmap step toggle, invite management UI; receive initial data as props from server pages |
| `src/lib/config.ts` | Single source of truth | All roles, routes, roadmap steps, work tracker config, validation rules; imported by both server and client code |
| `src/lib/types.ts` | TypeScript row types | Mirrors database schema exactly; used throughout |
| `src/components/ui/` | CVA-based primitives | Button, Card, Badge, Input, Skeleton, EmptyState, Modal, Toast; no business logic |
| `src/components/[role]/` | Role-specific feature components | Mix of server-renderable display components and "use client" interactive islands |

---

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx           # No sidebar, full-screen layout
│   │   ├── login/page.tsx       # Google OAuth button (use client)
│   │   ├── register/
│   │   │   └── [code]/page.tsx  # Invite code registration (use client)
│   │   └── no-access/page.tsx   # Access denied page (server)
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Auth check + sidebar (server)
│   │   ├── owner/
│   │   │   ├── page.tsx                    # Platform stats dashboard (server)
│   │   │   ├── students/
│   │   │   │   ├── page.tsx                # Student list, search, filter (server)
│   │   │   │   └── [id]/page.tsx           # Student detail (server)
│   │   │   ├── coaches/
│   │   │   │   ├── page.tsx                # Coach list (server)
│   │   │   │   └── [id]/page.tsx           # Coach detail (server)
│   │   │   ├── invites/page.tsx            # Invite management (server + client island)
│   │   │   ├── assignments/page.tsx        # Coach-student assignments (server + client island)
│   │   │   └── alerts/page.tsx             # Alert list (server)
│   │   │
│   │   ├── coach/
│   │   │   ├── page.tsx                    # Coach dashboard (server)
│   │   │   ├── students/
│   │   │   │   ├── page.tsx                # Assigned students list (server)
│   │   │   │   └── [id]/page.tsx           # Student detail tabs (server + client island)
│   │   │   ├── reports/page.tsx            # Report inbox (server + client island)
│   │   │   ├── invites/page.tsx            # Invite students (server + client island)
│   │   │   └── analytics/page.tsx          # Performance stats (server)
│   │   │
│   │   └── student/
│   │       ├── page.tsx                    # Student dashboard (server)
│   │       ├── work/page.tsx               # Work tracker (server shell + client island)
│   │       ├── roadmap/page.tsx            # Roadmap steps (server shell + client island)
│   │       ├── report/page.tsx             # Daily report form (server shell + client island)
│   │       └── ask/page.tsx                # Ask Abu Lahya iframe (server shell + client island)
│   │
│   ├── api/
│   │   ├── auth/callback/route.ts          # OAuth exchange + profile creation
│   │   ├── work-sessions/
│   │   │   ├── route.ts                    # POST: start session
│   │   │   └── [id]/route.ts               # PATCH: complete/abandon
│   │   ├── reports/
│   │   │   ├── route.ts                    # POST: submit report
│   │   │   └── [id]/route.ts               # PATCH: mark reviewed
│   │   ├── roadmap/
│   │   │   └── [id]/route.ts               # PATCH: mark step complete
│   │   └── invites/
│   │       ├── route.ts                    # POST: create invite
│   │       └── [id]/route.ts               # DELETE: cancel invite
│   │
│   ├── globals.css
│   ├── layout.tsx                          # Root layout (Inter font, metadata)
│   ├── page.tsx                            # Redirect → /login
│   └── not-found.tsx
│
├── components/
│   ├── ui/                    # CVA primitives (Button, Card, Badge, Input, etc.)
│   ├── layout/
│   │   └── Sidebar.tsx        # Role-aware navigation (use client)
│   ├── shared/
│   │   └── StatCard.tsx       # Reused across all three dashboards
│   ├── student/               # Student-specific components
│   │   ├── WorkTrackerClient.tsx
│   │   ├── RoadmapClient.tsx
│   │   ├── ReportForm.tsx
│   │   └── AskIframe.tsx
│   ├── coach/                 # Coach-specific components
│   │   ├── CoachReportsClient.tsx
│   │   ├── CoachStudentsList.tsx
│   │   └── CoachInvitesClient.tsx
│   └── owner/                 # Owner-specific components
│       ├── AssignmentsClient.tsx
│       ├── InvitesClient.tsx
│       ├── AlertsClient.tsx
│       └── OwnerStudentsList.tsx
│
├── lib/
│   ├── config.ts              # Single source of truth for all config
│   ├── types.ts               # TypeScript row types mirroring DB schema
│   ├── utils.ts               # getToday(), formatHours(), cn(), etc.
│   ├── auth/
│   │   └── session.ts         # getSessionUser() — server-only
│   └── supabase/
│       ├── admin.ts           # createAdminClient() — server-only, service role
│       ├── server.ts          # createClient() — server SSR client with cookies
│       └── client.ts          # createClient() — browser client for OAuth trigger
│
├── proxy.ts                   # Route guard (not middleware.ts)
└── types/                     # Global TypeScript declarations
```

### Structure Rationale

- **`(auth)` vs `(dashboard)` route groups:** Route groups share layout without affecting URLs. Auth pages get a full-screen layout; dashboard pages get the sidebar shell. Both groups perform auth checks, but at different levels.
- **`proxy.ts` not `middleware.ts`:** Next.js 16 changed the way middleware runs; the proxy pattern (imported and called from `middleware.ts` OR used as a named export) avoids the edge runtime limitations for Supabase cookie access.
- **Server pages with client islands:** Pages are async server components that fetch all data server-side, then pass it to small `"use client"` components as props. This means zero loading waterfalls for initial page load.
- **API routes for mutations only:** No GET route handlers exist. All reads happen in server components. This keeps the data access pattern consistent and avoids duplicating fetch logic.
- **`components/[role]/` grouping:** Feature components grouped by role, not by type. Makes it easy to scope changes to a single role's feature without hunting across the codebase.
- **`lib/config.ts` as truth:** All roles, routes, nav items, roadmap steps, thresholds, and validation rules live here. Server and client code both import from it. Prevents magic strings scattered across files.

---

## Architectural Patterns

### Pattern 1: Server-First Data Fetch with Client Island

**What:** The page is an async server component that fetches all required data (often with `Promise.all()`) then renders a "use client" island, passing the fetched data as `initialData` props.

**When to use:** Any page with interactive UI that also needs server-fetched initial state. The work tracker, report form, roadmap, and invite management all use this.

**Trade-offs:** Eliminates client-side loading spinners for initial data. The trade-off is that mutations from client components must go through API routes and then re-fetch or optimistically update local state.

**Example:**
```typescript
// Server page
export default async function WorkTrackerPage() {
  const user = await getSessionUser("student");
  const admin = createAdminClient();
  const { data } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", getToday())
    .order("cycle_number");

  return <WorkTrackerClient initialSessions={data ?? []} />;
}

// Client island
"use client";
export function WorkTrackerClient({ initialSessions }: { initialSessions: WorkSession[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  // ... timer logic, optimistic updates via fetch() to API routes
}
```

### Pattern 2: Defense-in-Depth Auth (Proxy + Server + API)

**What:** Three layers of auth enforcement:
1. `proxy.ts` — checks role on every navigation, redirects wrong-role requests
2. `getSessionUser(requiredRole)` — per-request guard in server pages/layouts; redirects if unauthenticated or wrong role
3. API route handlers — explicit auth + role check before every mutation

**When to use:** Always. Never rely on a single layer.

**Trade-offs:** Some redundancy in auth checks. The benefit is that a bug in any one layer does not expose data. The RLS policies on the database are the final backstop.

**Example:**
```typescript
// API route: auth check → role check → Zod validation → query
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users").select("id, role").eq("auth_id", authUser.id).single();

  if (!profile || profile.role !== "student")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Now validate input and run the mutation
}
```

### Pattern 3: Admin Client for All Server Queries

**What:** `createAdminClient()` (service role key) is used for every DB query in server pages and API routes. The anon-key server client is used only to verify the auth session (`supabase.auth.getUser()`).

**When to use:** All data reads and writes in server-side code. Never in client components.

**Trade-offs:** Bypasses RLS entirely on the server side. This is intentional — RLS policies use `get_user_role()` which calls `auth.uid()`, and this can return null when sessions aren't fully established (post-registration). The application layer enforces the same rules explicitly, with user ID filters added to every query as a second guard.

**Example:**
```typescript
// Always filter by user ID even though admin client bypasses RLS
const { data } = await admin
  .from("work_sessions")
  .select("*")
  .eq("student_id", user.id)   // explicit filter — never rely on RLS alone
  .eq("date", today);
```

### Pattern 4: Parallel Data Fetching in Server Pages

**What:** All data for a dashboard page is fetched in a single `Promise.all()` call. Each query is independent and runs concurrently.

**When to use:** Any dashboard page with multiple data sources. Student dashboard, coach dashboard, owner dashboard all use this.

**Trade-offs:** Requires structuring queries so they don't depend on each other. Sequential dependencies (e.g., "get students, then get their sessions") must be handled inside the `Promise.all()` using conditional promises.

**Example:**
```typescript
const [sessionsResult, roadmapResult, reportResult] = await Promise.all([
  admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today),
  admin.from("roadmap_progress").select("*").eq("student_id", user.id),
  admin.from("daily_reports").select("*").eq("student_id", user.id).eq("date", today).maybeSingle(),
]);
```

### Pattern 5: URL SearchParams for Filters and Pagination

**What:** Search queries, filter values, and page numbers live in URL search params (not component state). Server components read `searchParams` prop directly.

**When to use:** Any list page with filtering, search, or pagination — owner student list, coach report inbox, owner coach list.

**Trade-offs:** Filter state is shareable via URL and works without JavaScript. The trade-off is that every filter change triggers a server-side navigation (full page re-render on the server, not a client-side state update).

**Example:**
```typescript
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string }
}) {
  const q = searchParams.q ?? "";
  const status = searchParams.status ?? "active";
  const page = parseInt(searchParams.page ?? "1");
  // build query from these values
}
```

---

## Data Flow

### Auth and Session Flow

```
User clicks "Sign in with Google"
    ↓
Browser → Supabase Auth → Google OAuth → Supabase callback
    ↓
GET /api/auth/callback?code=...&invite_code=...
    ↓
createClient().auth.exchangeCodeForSession(code)
    ↓
Check: does user have a profile? (admin client, by auth_id)
    ├── YES: update last_active_at → redirect to role dashboard
    └── NO: check invite code / magic link
          ├── valid invite: mark used, create profile, seed roadmap → redirect
          └── no invite: redirect /no-access
```

### Server Page Read Flow

```
Browser navigates to /student/work
    ↓
proxy.ts: verify auth cookie → verify role → allow
    ↓
(dashboard)/layout.tsx: getSessionUser() → render Sidebar
    ↓
student/work/page.tsx: getSessionUser("student") + admin queries
    ↓
Props passed to <WorkTrackerClient initialSessions={...} />
    ↓
HTML streamed to browser — no client-side data fetching needed
```

### Mutation Flow (Client Island → API Route)

```
Student clicks "Start Cycle" in WorkTrackerClient
    ↓
fetch("POST /api/work-sessions", { body: { date, cycle_number } })
    ↓
API route:
  1. createClient().auth.getUser() — verify session
  2. admin.from("users").select("role") — verify role = "student"
  3. zod.safeParse(body) — validate input
  4. admin.from("work_sessions").insert(...) — write to DB
  5. return { data: newSession }
    ↓
Client receives response → optimistic state update → re-renders timer
```

### Key Data Flows (V1 Scope)

1. **Student daily loop:** Student starts work cycles (POST /api/work-sessions) → completes cycles (PATCH /api/work-sessions/[id]) → submits daily report with auto-filled hours (POST /api/reports) → coach sees report in inbox → coach marks reviewed (PATCH /api/reports/[id])

2. **Invite + registration:** Owner or coach creates invite (POST /api/invites) → invite code emailed to recipient → recipient visits /register/[code] → clicks Google → /api/auth/callback validates code + creates profile + seeds roadmap → redirected to role dashboard

3. **Owner alert computation:** Computed on server at render time by querying `users.last_active_at`, `work_sessions` recency, and `daily_reports` review status — no separate alert storage in V1. Alerts are derived data.

4. **Roadmap progression:** Student manually marks step complete (PATCH /api/roadmap/[id]) → server updates `roadmap_progress` row to `completed`, unlocks next step by updating next row to `active`

5. **Coach analytics:** Coach analytics page fetches assigned students, their work sessions, and daily reports for a date range, computes aggregates server-side, renders as static HTML — no chart client library needed for V1

---

## Component Boundaries

### What Talks to What

| From | To | How | Notes |
|------|----|-----|-------|
| `proxy.ts` | Supabase | `createAdminClient()` direct call | Role lookup on every protected navigation |
| Server pages | Supabase | `createAdminClient()` direct call | Reads only; no mutations |
| Server pages | Client islands | React props (`initialData`) | One-way; server data → client props |
| Client islands | API routes | `fetch()` POST/PATCH | All mutations go through API routes |
| API routes | Supabase | `createAdminClient()` | Writes and reads post-mutation |
| `(dashboard)` layout | Server pages | React children | Layout wraps page; both are server components |
| `Sidebar` component | `lib/config.ts` | Static import | Nav items from config, no dynamic data |

### Clear Separation Rules

- **Admin client never crosses to client components.** The `"server-only"` import guard enforces this at build time.
- **Client components never query Supabase directly.** They fetch through `/api/*` routes.
- **Server pages never import `"use client"` modules directly.** They accept them as children or render them as leaf nodes.
- **Config is shared.** `lib/config.ts` has no server-only imports and is safe to import in both server and client code.

---

## Build Order (Phase Dependencies)

The architecture has natural dependency layers. Building out of order creates blocking work.

### Layer 1: Foundation (build first — everything depends on this)
1. **Supabase schema** — 6 tables, RLS policies, helper functions (`get_user_id`, `get_user_role`, `handle_updated_at`)
2. **`lib/config.ts`** — roles, routes, roadmap steps, all config constants
3. **`lib/types.ts`** — TypeScript row types
4. **`lib/supabase/`** — admin, server, and client factory functions
5. **`lib/auth/session.ts`** — `getSessionUser()` helper
6. **`proxy.ts`** — route guard

### Layer 2: Auth and Shell (build second — needed to access any page)
7. **`api/auth/callback`** — OAuth exchange + profile creation + roadmap seeding
8. **`(auth)` pages** — login, register/[code], no-access
9. **`(dashboard)` layout** — sidebar shell with role-aware navigation
10. **`components/ui/`** — CVA primitives (used on every page)

### Layer 3: Student Features (build third — primary user, most complex client islands)
11. **Student dashboard** — parallel data fetch, stat cards, progress ring
12. **Work tracker** — most complex client island (timer, cycle state, API mutations)
13. **Roadmap** — step list with completion toggle
14. **Daily report** — form with auto-filled hours from work sessions
15. **Ask Abu Lahya** — iframe embed (simple after iframe URL is available)

### Layer 4: Coach Features (build fourth — reads student data that exists from Layer 3)
16. **Coach dashboard** — at-risk detection, report inbox preview
17. **Coach student list** — search, filter, activity indicators
18. **Coach student detail** — tabs showing student's sessions, reports, roadmap
19. **Coach reports inbox** — review and mark as reviewed
20. **Coach analytics** — computed from existing session/report data
21. **Coach invites** — create + manage invite codes

### Layer 5: Owner Features (build last — aggregates across all users)
22. **Owner dashboard** — platform-wide stats
23. **Owner student list + detail** — cross-coach visibility
24. **Owner coach list + detail** — with assigned student counts
25. **Owner invites** — coach and student invite creation
26. **Owner assignments** — reassign students to coaches
27. **Owner alerts** — derived queries on inactivity/review status

---

## Anti-Patterns

### Anti-Pattern 1: useEffect Data Fetching

**What people do:** Create a client component with `useEffect(() => { fetch('/api/data') }, [])` to load initial data.

**Why it's wrong:** Creates a loading waterfall — the page renders blank, then fetches, then renders again. Breaks the server-first architecture and adds unnecessary complexity.

**Do this instead:** Fetch data in the async server page component and pass it as props to client islands. The page arrives with data already populated.

### Anti-Pattern 2: Using Anon Client for Server Queries

**What people do:** Import `createClient()` from `lib/supabase/server.ts` and use it for data queries in server pages.

**Why it's wrong:** The anon client's RLS policies call `get_user_role()` which resolves via `auth.uid()`. This can return null immediately after registration when the session is not fully established. It also means every query is constrained by RLS policy correctness — a single policy bug exposes data.

**Do this instead:** Use `createAdminClient()` for all server-side data queries. Add explicit `.eq("student_id", user.id)` or `.eq("coach_id", user.id)` filters to every query. RLS remains as a backstop, not the primary guard.

### Anti-Pattern 3: Importing Admin Client in Client Components

**What people do:** Import `createAdminClient()` in a `"use client"` component to make direct Supabase queries.

**Why it's wrong:** The service role key would be exposed in the browser bundle, giving any user admin access to the entire database.

**Do this instead:** Client components always go through `/api/*` route handlers. The route handler holds the admin client on the server side.

### Anti-Pattern 4: Client State for Filters and Pagination

**What people do:** Use `useState` to track search query, filters, and page number in a client component, then fetch data when state changes.

**Why it's wrong:** Filter state is lost on navigation, can't be shared via URL, and requires the page to do an additional client-side fetch after render.

**Do this instead:** Put filters in URL search params. Server pages read `searchParams` props. Navigation to a new filter URL triggers a server render with the right data from the start.

### Anti-Pattern 5: Single-Layer Auth (Proxy Only)

**What people do:** Trust that `proxy.ts` will block all unauthorized requests and skip auth checks in server pages and API routes.

**Why it's wrong:** The proxy can be bypassed by direct API calls, Next.js cache serving stale data, or bugs in the proxy's route matching regex.

**Do this instead:** Check auth at every layer. `proxy.ts` for navigation, `getSessionUser()` in every page that needs user data, and explicit auth + role check at the top of every API route handler.

### Anti-Pattern 6: Hardcoding Roles, Routes, and Config Values

**What people do:** Hardcode `"student"`, `"/student/work"`, or `45` (session minutes) inline in component code.

**Why it's wrong:** Leads to inconsistencies, makes changes require hunting through multiple files, and breaks the principle of a single source of truth.

**Do this instead:** Import from `lib/config.ts`. All role names, route paths, navigation items, thresholds, and config values live there.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` server client for session; `@supabase/supabase-js` admin client for queries | Google OAuth credentials configured in Supabase Dashboard, not in `.env.local` |
| Google OAuth | Via Supabase Auth provider; no direct Google API calls | Redirect URL: `/api/auth/callback` |
| Abu Lahya AI chatbot | `<iframe src={AI_CONFIG.iframeUrl}>` in student `/ask` page | URL is a placeholder in V1; swap in `lib/config.ts` when available |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Server pages ↔ Client islands | Props (`initialData`) | One-directional; server provides initial state, client manages subsequent state |
| Client islands ↔ API routes | `fetch()` POST/PATCH requests | Client never calls Supabase directly |
| Proxy ↔ App pages | Next.js request pipeline | Proxy runs before any page renders; redirects happen before React rendering |
| Config ↔ All modules | Static ES module import | Config is the only module imported by both server and client code |
| `getSessionUser()` ↔ Server pages | Function call (server-only) | Called in every server page that needs user identity |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (V1 target) | Current architecture is correct — monolith Next.js + Supabase free tier handles this easily |
| 500-5,000 users | Add Supabase connection pooling (pgBouncer); review parallel `Promise.all()` query counts per page; add `next/cache` tags for platform-wide stats |
| 5,000-50,000 users | Consider moving heavy analytics queries to DB-level views or materialized views; evaluate Supabase compute tier; owner alert computation may need a cron job rather than per-render derivation |

### Scaling Priorities

1. **First bottleneck:** Owner dashboard platform stats queries — they scan the entire users + work_sessions + daily_reports tables. Fix with `unstable_cache()` with a short TTL or a dedicated DB view.
2. **Second bottleneck:** Coach dashboard "at-risk detection" loads all assigned students then computes in JavaScript. Fix by moving the threshold logic to a DB query with a WHERE clause.

---

## Sources

- `reference-old/src/proxy.ts` — direct inspection of route guard pattern (HIGH confidence)
- `reference-old/src/lib/auth/session.ts` — direct inspection of session resolution pattern (HIGH confidence)
- `reference-old/src/lib/supabase/admin.ts` — direct inspection of admin client pattern (HIGH confidence)
- `reference-old/src/app/(dashboard)/layout.tsx` — direct inspection of dashboard shell (HIGH confidence)
- `reference-old/src/app/api/auth/callback/route.ts` — direct inspection of OAuth callback + profile creation (HIGH confidence)
- `reference-old/src/app/api/work-sessions/route.ts` — direct inspection of mutation API pattern (HIGH confidence)
- `reference-old/src/app/(dashboard)/student/page.tsx` — direct inspection of parallel data fetch pattern (HIGH confidence)
- `reference-old/src/app/(dashboard)/coach/page.tsx` — direct inspection of coach data fetch and at-risk logic (HIGH confidence)
- `reference-old/src/lib/config.ts` — direct inspection of config-as-truth pattern (HIGH confidence)
- Next.js App Router server components documentation — corroborates server-first pattern (HIGH confidence)
- Supabase SSR documentation — corroborates `@supabase/ssr` cookie-based session pattern (HIGH confidence)

---

*Architecture research for: IMA Accelerator V1 — multi-role coaching platform*
*Researched: 2026-03-16*
