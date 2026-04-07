# Architecture Research

**Domain:** Student performance & coaching platform — v1.4 integration architecture
**Researched:** 2026-04-03
**Confidence:** HIGH (derived from direct codebase inspection + first-principles analysis)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER (React 19)                               │
│  ┌───────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │ Server Pages  │  │  "use client"       │  │  Polling client  │    │
│  │ (reads only)  │  │  WorkTrackerClient  │  │  ChatClient      │    │
│  │ async/await   │  │  (state machine)    │  │  (5s interval)   │    │
│  └──────┬────────┘  └────────┬───────────┘  └────────┬─────────┘    │
├─────────┼───────────────────┼────────────────────────┼──────────────┤
│                      Next.js 16 App Router                           │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  proxy.ts route guard (CSRF, auth, role, redirect)          │      │
│  └────────────────────────────────────────────────────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐      │
│  │ (auth)/      │  │ (dashboard)/ │  │ api/                   │      │
│  │ login        │  │ owner/       │  │ reports/ work-sessions/ │      │
│  │ register     │  │ coach/       │  │ roadmap/ assignments/   │      │
│  │ no-access    │  │ student/     │  │ messages/ resources/    │      │
│  └──────────────┘  │ student_diy/ │  │ glossary/              │      │
│                    └──────────────┘  └────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────┤
│                      Supabase (Postgres + RLS)                        │
│  users  invites  magic_links  work_sessions  roadmap_progress         │
│  daily_reports  alert_dismissals  student_kpi_summaries               │
│  rate_limit_log  daily_plans  roadmap_undo_log                        │
│  [NEW] report_comments  messages  resources  glossary_terms           │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| proxy.ts | Route guard — auth check + role-based redirect | Server-side, runs before every non-API page request |
| (dashboard)/layout.tsx | Sidebar + badge fetch + ToastProvider | Server component, unstable_cache for badges |
| Sidebar.tsx | Navigation + unread badges + sign-out | "use client" — needs pathname + auth.signOut() |
| API routes | Mutations only — CSRF → Auth → Role → RateLimit → Zod → Ownership → Logic | Server-side, admin client for all DB queries |
| Server pages | All reads — parallel data fetching, pass to client components | async Server Components with createAdminClient() |
| Client components | Interactive UI — form state, optimistic updates, polling | Minimal "use client" islands |
| src/lib/config.ts | Single source of truth — roles, nav, routes, constants | Imported everywhere, never duplicated |

---

## Recommended Project Structure (v1.4 additions)

```
src/
├── app/
│   ├── (auth)/                         # Unchanged
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # MODIFIED: add unread_messages badge
│   │   ├── owner/
│   │   │   ├── students/               # MODIFIED: add skip_days_this_week column
│   │   │   ├── assignments/            # UNCHANGED (owner already has this)
│   │   │   └── invites/                # MODIFIED: show max_uses/use_count on magic links
│   │   ├── coach/
│   │   │   ├── students/               # MODIFIED: add skip_days_this_week column
│   │   │   ├── reports/                # MODIFIED: add comment inline in ReportRow
│   │   │   ├── assignments/            # NEW: duplicate of owner/assignments (coach-scoped)
│   │   │   └── chat/                   # NEW: polling chat UI
│   │   ├── student/
│   │   │   ├── chat/                   # NEW: 1:1 + broadcast chat UI
│   │   │   └── resources/              # NEW: URL links + Discord + glossary tabs
│   │   └── student_diy/                # NEW: 4th role dashboard (clone of student, reduced)
│   │       ├── layout.tsx              # NEW: same dashboard layout, student_diy nav
│   │       ├── page.tsx                # NEW: dashboard (work sessions + roadmap summary)
│   │       ├── work/                   # NEW: work tracker (identical to student/work)
│   │       └── roadmap/                # NEW: roadmap view (identical to student/roadmap)
│   └── api/
│       ├── reports/[id]/comment/       # NEW: POST/DELETE coach comment on report
│       ├── messages/                   # NEW: GET (poll) + POST (send)
│       ├── resources/                  # NEW: GET (list) + POST (create)
│       ├── resources/[id]/             # NEW: PATCH + DELETE
│       ├── glossary/                   # NEW: GET (list) + POST (create)
│       ├── glossary/[id]/              # NEW: PATCH + DELETE
│       └── assignments/                # NEW: PATCH (coach can now reassign students)
├── components/
│   ├── coach/
│   │   ├── CoachAssignmentsClient.tsx  # NEW: clone of OwnerAssignmentsClient, coach-scoped
│   │   └── ReportRow.tsx               # MODIFIED: add inline comment field
│   ├── student/
│   │   └── ChatClient.tsx              # NEW: polling chat — student view
│   ├── shared/
│   │   ├── ChatClient.tsx              # NEW: or role-prop variant — shared chat component
│   │   ├── ResourcesTab.tsx            # NEW: URL links list + add form
│   │   ├── DiscordEmbed.tsx            # NEW: WidgetBot iframe wrapper
│   │   └── GlossaryTab.tsx             # NEW: searchable glossary list + CRUD
│   └── layout/
│       └── Sidebar.tsx                 # MODIFIED: add unread_messages badge support
└── lib/
    └── config.ts                       # MODIFIED: add student_diy role, routes, nav, invite rules
```

---

## Architectural Patterns

### Pattern 1: Server Component for Reads, Client Island for Interactivity

**What:** Every page is an async Server Component that fetches data and passes it to a thin "use client" child component only when interaction is needed.

**When to use:** All page-level data loading. Applies to new resources, glossary, skip tracker, and report comments pages.

**Trade-offs:** Requires a clean data/interaction boundary. Avoids client-side data fetching waterfalls. Next.js cache() deduplicates repeated calls within the same render tree.

**Example (new resources page):**
```typescript
// src/app/(dashboard)/student/resources/page.tsx — server component
export default async function ResourcesPage() {
  await requireRole(["owner", "coach", "student"]);
  const admin = createAdminClient();
  const [resources, glossary] = await Promise.all([
    admin.from("resources").select("*").order("created_at", { ascending: false }),
    admin.from("glossary_terms").select("*").order("term"),
  ]);
  return <ResourcesClient resources={resources.data ?? []} glossary={glossary.data ?? []} />;
}
```

### Pattern 2: API Route Pipeline (CSRF → Auth → Role → RateLimit → Zod → Ownership → Logic)

**What:** Every mutation API route follows the exact same middleware chain in the same order.

**When to use:** All 7 new API routes must follow this pattern. No exceptions.

**Trade-offs:** Verbose but maximally safe. The order matters: CSRF is cheapest (no DB), auth is next, role gates before expensive DB work.

**Example (new comment endpoint skeleton):**
```typescript
// src/app/api/reports/[id]/comment/route.ts
export async function POST(request: NextRequest, { params }) {
  const csrfError = verifyOrigin(request);    // 1. CSRF
  if (csrfError) return csrfError;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); // 2. Auth

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile || profile.role !== "coach") return NextResponse.json({ error: "Forbidden" }, { status: 403 }); // 3. Role

  const { allowed } = await checkRateLimit(profile.id, "/api/reports/comment"); // 4. Rate limit
  // ... 5. Zod, 6. Ownership, 7. Logic
}
```

### Pattern 3: Cursor-Based Polling for Chat

**What:** Chat messages use a `cursor` (last received message ID or timestamp) to fetch only new messages since the last poll. Client polls every 5 seconds via setInterval.

**When to use:** The messages table with polling architecture. This is the only place in the codebase that uses client-side polling.

**Trade-offs:** Simple, no WebSockets, no Supabase Realtime subscription (avoids 500 connection limit). Adds 5s latency maximum. Acceptable for async coaching chat. setInterval must be cleared in useEffect cleanup to prevent memory leaks.

**Example:**
```typescript
// Polling hook — inside ChatClient.tsx
useEffect(() => {
  const poll = async () => {
    const res = await fetch(`/api/messages?channel_id=${channelId}&after=${cursor}`);
    if (!res.ok) return;
    const { data } = await res.json();
    if (data.length > 0) {
      setMessages(prev => [...prev, ...data]);
      setCursor(data[data.length - 1].id);  // advance cursor
    }
  };
  const interval = setInterval(poll, 5000);
  return () => clearInterval(interval);  // cleanup on unmount
}, [channelId, cursor]);
```

### Pattern 4: Config-Driven Role Expansion

**What:** The `student_diy` role is added to config.ts exactly like existing roles — ROLES constant, ROLE_HIERARCHY, ROUTES, NAVIGATION, ROLE_REDIRECTS, INVITE_CONFIG.

**When to use:** Any role-related feature. proxy.ts and session.ts derive behavior from config constants, not hardcoded strings.

**Trade-offs:** One edit to config.ts propagates everywhere. The `Role` type must be updated in config, types.ts, and the DB migration simultaneously to avoid TypeScript errors.

**Required config.ts changes:**
```typescript
export const ROLES = {
  OWNER: "owner",
  COACH: "coach",
  STUDENT: "student",
  STUDENT_DIY: "student_diy",        // NEW
} as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  coach: 2,
  student: 1,
  student_diy: 1,                    // NEW — same level as student
};

// ROUTES.student_diy — only dashboard, work, roadmap
// NAVIGATION.student_diy — 3 items (no Ask AI, no Daily Report, no Resources, no Chat)
// ROLE_REDIRECTS.student_diy — "/student_diy"
// INVITE_CONFIG.inviteRules — owner can invite student_diy, coach can invite student_diy
```

### Pattern 5: Shared Components via Role Prop

**What:** For features that are nearly identical across roles (assignments, chat), use a shared component with a `role` or `scope` prop rather than duplicating code into role-specific component folders.

**When to use:** CoachAssignmentsClient can be a role-scoped view of the same OwnerAssignmentsClient pattern. Chat UI is identical for coach and student views (just filtering differs server-side).

**Trade-offs:** Reduces duplication but requires careful prop typing. Prefer this over copy-paste when >80% of the component logic is shared.

---

## Data Flow

### Chat Polling Flow

```
[ChatClient mounts]
    ↓
[GET /api/messages?channel_id=X&after=null] ← initial load (last 50 messages)
    ↓
[setInterval 5s] → [GET /api/messages?channel_id=X&after=<last_id>]
    ↓
[append new messages to local state]
    ↓
[POST /api/messages] ← user sends message
    ↓
[optimistic append to local state, cursor advances]
```

### Sidebar Badge Flow (modified for unread messages)

```
[Dashboard layout.tsx renders]
    ↓
[unstable_cache(getSidebarBadges, ['sidebar-badges'], { revalidate: 60 })]
    ↓
[get_sidebar_badges RPC] ← MODIFIED: add unread_messages_count to result
    ↓
[badgeCounts passed to <Sidebar>]
    ↓
[NAVIGATION config badge key 'unread_messages' matched to count]
```

**Note:** The 60-second revalidation means badge counts can lag by up to 1 minute. This is acceptable for unread message counts (not time-critical). If chat badge needs to be real-time, the ChatClient can manually call `revalidateTag("badges")` after reading messages — but this requires a server action, not a fetch call, to trigger cache invalidation from the client.

### Report Comment Flow

```
[Coach views report in ReportRow]
    ↓
[comment_text textarea inline in ReportRow]
    ↓
[POST /api/reports/[id]/comment] → { text: string }
    ↓
[INSERT into report_comments (report_id, coach_id, text)]
    ↓
[optimistic update: show comment inline in ReportRow]
    ↓
[student views /student/report history]
    ↓
[server component fetches daily_reports JOIN report_comments]
    ↓
[comment shown read-only below report fields]
```

### skip_days_this_week Computation Flow

```
[Coach/Owner student list page loads]
    ↓
[server component fetches work_sessions WHERE date >= ISO week Monday]
    ↓
[compute: days in Mon-Sun week with no completed sessions = skipped days]
    ↓  (or better: add to get_student_detail RPC or new RPC)
[pass skip_count to student list row component]
```

---

## Integration Points: New vs Modified

### Components: NEW

| Component | Location | Purpose |
|-----------|----------|---------|
| `ChatClient.tsx` | `src/components/shared/` | Polling chat UI, works for coach and student views |
| `ResourcesTab.tsx` | `src/components/shared/` | URL link list with add/delete (owner/coach) |
| `DiscordEmbed.tsx` | `src/components/shared/` | WidgetBot iframe wrapper with CSP note |
| `GlossaryTab.tsx` | `src/components/shared/` | Searchable glossary, CRUD for owner/coach |
| `CoachAssignmentsClient.tsx` | `src/components/coach/` | Assignment UI for coach role (mirrors owner pattern) |
| `StudentDIYDashboard.tsx` | `src/components/student_diy/` | DIY-specific dashboard widgets |

### Components: MODIFIED

| Component | File | Change |
|-----------|------|--------|
| `Sidebar.tsx` | `src/components/layout/Sidebar.tsx` | Add `unread_messages` badge key + new icon (MessageSquare already imported) |
| `ReportRow.tsx` | `src/components/coach/ReportRow.tsx` | Add inline comment textarea + submit button |
| `NAVIGATION` | `src/lib/config.ts` | Add `student_diy` nav array, add Chat + Resources to student/coach/owner navs |
| `ROLES` / `Role` type | `src/lib/config.ts` | Add `student_diy` to enum + hierarchy |
| `INVITE_CONFIG` | `src/lib/config.ts` | Add `student_diy` to inviteRules for owner and coach |
| `ROUTES` | `src/lib/config.ts` | Add `student_diy` routes, chat routes, resources routes |

### API Routes: NEW

| Route | Method | Actor | Purpose |
|-------|--------|-------|---------|
| `/api/reports/[id]/comment` | POST | coach | Add/replace single comment on a report |
| `/api/reports/[id]/comment` | DELETE | coach | Remove comment |
| `/api/messages` | GET | coach, student | Poll messages (cursor-based, filter by channel) |
| `/api/messages` | POST | coach, student | Send message |
| `/api/resources` | GET | owner, coach, student | List resources |
| `/api/resources` | POST | owner, coach | Create resource (URL link) |
| `/api/resources/[id]` | PATCH | owner, coach | Update resource |
| `/api/resources/[id]` | DELETE | owner, coach | Delete resource |
| `/api/glossary` | GET | owner, coach, student | List glossary terms |
| `/api/glossary` | POST | owner, coach | Create term |
| `/api/glossary/[id]` | PATCH | owner, coach | Update term |
| `/api/glossary/[id]` | DELETE | owner, coach | Delete term |
| `/api/assignments` | PATCH | owner, coach | Reassign student to coach |

### API Routes: MODIFIED

| Route | Change |
|-------|--------|
| `/api/invites` | Accept `student_diy` as valid role for invite creation |
| `/api/auth/callback` | Accept `student_diy` role during registration |

### Database: NEW TABLES

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `report_comments` | `id, report_id, coach_id, text, created_at, updated_at` | UNIQUE on `report_id` — one comment per report, coach-only write |
| `messages` | `id, channel_id, sender_id, text, created_at` | `channel_id` = concat of sorted user IDs for 1:1; broadcast uses special channel ID |
| `resources` | `id, title, url, description, created_by, created_at` | Visible to owner/coach/student, NOT student_diy |
| `glossary_terms` | `id, term, definition, created_by, updated_at` | UNIQUE on `term`, managed by owner/coach |

### Database: MODIFIED TABLES/TYPES

| Table/Type | Change |
|-----------|--------|
| `users.role` | Add `student_diy` to CHECK constraint or enum |
| `magic_links.role` | Add `student_diy` to CHECK constraint |
| `invites.role` | Add `student_diy` to CHECK constraint |
| `roadmap_undo_log.actor_role` | Unchanged (only coach/owner undo roadmap steps) |
| `get_sidebar_badges` RPC | Add `unread_messages` return field |

### Proxy: MODIFIED

```typescript
// proxy.ts — add student_diy to both maps
const DEFAULT_ROUTES: Record<string, string> = {
  owner: "/owner",
  coach: "/coach",
  student: "/student",
  student_diy: "/student_diy",        // NEW
};

const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
  owner: ["/owner"],
  coach: ["/coach"],
  student: ["/student"],
  student_diy: ["/student_diy"],      // NEW
};
```

### Session: MODIFIED

```typescript
// session.ts — role check for student_diy route group works via requireRole()
// No code change needed IF Role type from config.ts is updated
// requireRole(["student"]) will correctly EXCLUDE student_diy
// requireRole(["student", "student_diy"]) for shared features
```

---

## Build Order (Phase Dependency Graph)

```
Phase A: DB Migration + Config Foundation
  ├── Add student_diy to role CHECK constraints (users, invites, magic_links)
  ├── Create report_comments, messages, resources, glossary_terms tables
  ├── Update config.ts (ROLES, ROUTES, NAVIGATION, INVITE_CONFIG)
  └── Update types.ts + proxy.ts
        ↓
Phase B: student_diy Route Group (unblocked after proxy + config)
  ├── src/app/(dashboard)/student_diy/ layout + page + work + roadmap
  └── Reuse student components (WorkTrackerClient, RoadmapClient) — no duplication
        ↓
Phase C: Skip Tracker (unblocked after schema — reads work_sessions, no new tables)
  ├── Computation logic in coach/owner student list server component
  └── SkipBadge component in student row
        ↓
Phase D: Coach Assignments (unblocked after config — adds /coach/assignments route)
  ├── GET /api/assignments endpoint (or reuse /api/assignments PATCH for reassign)
  ├── CoachAssignmentsClient (mirrors OwnerAssignmentsClient pattern)
  └── /coach/assignments page

Phase E: Report Comments (unblocked after report_comments table from Phase A)
  ├── POST/DELETE /api/reports/[id]/comment
  ├── Modify ReportRow to show inline comment
  └── Modify student report history to show coach comment read-only

Phase F: Chat System (unblocked after messages table from Phase A)
  ├── GET/POST /api/messages
  ├── ChatClient polling component
  ├── /coach/chat + /student/chat pages
  └── Sidebar unread badge (get_sidebar_badges RPC update)

Phase G: Resources Tab (unblocked after resources + glossary tables from Phase A)
  ├── GET/POST/PATCH/DELETE /api/resources
  ├── GET/POST/PATCH/DELETE /api/glossary
  ├── ResourcesTab, DiscordEmbed, GlossaryTab components
  └── /student/resources + /coach/resources + /owner/resources pages

Phase H: Invite max_uses UI (unblocked after schema already has max_uses)
  └── Modify CoachInvitesClient + OwnerInvitesClient to show use_count/max_uses
      and default max_uses to 10 in invite creation forms
```

**Critical constraint:** Phase A (DB + config) must ship first. Phases B–H can proceed in any order after Phase A, but F and G are the most complex (new tables + polling + multi-component) so should not be parallelized.

---

## Anti-Patterns

### Anti-Pattern 1: New Route Group Without Config Update

**What people do:** Create `src/app/(dashboard)/student_diy/` but forget to update `ROLES`, `NAVIGATION`, `ROLE_REDIRECTS`, and `INVITE_CONFIG` in config.ts.

**Why it's wrong:** proxy.ts and Sidebar.tsx derive all behavior from config. An unmapped role will hit the fallback redirect `"/"` in proxy.ts and have no nav items.

**Do this instead:** Update config.ts first. Import the updated `Role` type everywhere before creating the route group. Let TypeScript errors guide what else needs updating.

### Anti-Pattern 2: useEffect for Initial Chat Load

**What people do:** Put the initial message fetch inside a useEffect, creating an empty state flash.

**Why it's wrong:** The page is a Server Component. Fetch the last 50 messages server-side on page load; pass as `initialMessages` prop to the client ChatClient. Only the polling loop goes in useEffect.

**Do this instead:**
```typescript
// Server component passes initial data
<ChatClient initialMessages={initialMessages} channelId={channel.id} />
// Client component starts polling from last message ID
```

### Anti-Pattern 3: Skipping CSRF on New Mutation Routes

**What people do:** Add `/api/messages` POST or `/api/glossary` POST without the `verifyOrigin()` call at the top.

**Why it's wrong:** All mutation routes require CSRF protection. The security audit in v1.2 explicitly established this as a hard rule. Missing it on new routes is a regression.

**Do this instead:** Copy the exact pipeline from an existing route (e.g., `reports/route.ts`). The first line of every POST/PATCH/DELETE handler is `verifyOrigin()`.

### Anti-Pattern 4: Duplicating Student Work Tracker for student_diy

**What people do:** Copy `src/app/(dashboard)/student/work/` files into `student_diy/work/` and rename things.

**Why it's wrong:** Any future changes to the work tracker must be made twice. WorkTrackerClient and RoadmapClient don't know about routes — they work from props.

**Do this instead:** Create `student_diy/work/page.tsx` as a thin wrapper that imports the same server-side data fetching pattern and passes to the same `WorkTrackerClient` component. The only difference is the `requireRole("student_diy")` guard.

### Anti-Pattern 5: Polling Without Cursor (Fetching All Messages Every 5s)

**What people do:** `GET /api/messages?channel_id=X` returns all messages every poll.

**Why it's wrong:** With 1:1 chats and broadcast, a busy channel could have thousands of messages. Fetching all every 5s is O(n) DB work per poll per user.

**Do this instead:** Accept an `after` query param (message ID or timestamp). Return only messages `WHERE id > $after` (if using sequential IDs) or `WHERE created_at > $after`. The client tracks the cursor client-side.

### Anti-Pattern 6: student_diy in report_comments / chat / resources

**What people do:** Forget that student_diy has a reduced feature set and allow them to access chat, report, or resources routes.

**Why it's wrong:** Decision D-05 explicitly excludes these features for student_diy. Allowing access is a product requirement violation, not just a code smell.

**Do this instead:** Every API route and page for chat/reports/resources does `requireRole(["owner", "coach", "student"])` — student_diy is intentionally excluded from this array.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (100-500 students) | Polling at 5s is fine. DB-backed rate limiting covers abuse. |
| 1k-5k students | Chat polling creates N requests every 5s (N = active users). If 1k students all have chat open, that's 200 req/s hitting /api/messages. Rate limit the GET endpoint at 30 req/min (matches existing pattern). |
| Supabase Pro limit | 500 concurrent Realtime connections avoided by using polling. 60 max_connections on Pro Small — watch if chat + glossary + resources add significant read load alongside existing RPC calls. |

### Scaling Priorities

1. **First bottleneck:** Chat polling volume. If >500 active chat users, consider increasing poll interval to 10s or batching channel polls.
2. **Second bottleneck:** `get_sidebar_badges` RPC called on every page layout render (60s cache). Adding `unread_messages` to this RPC is a safe extension since it's already cached.

---

## Integration Points Summary Table

| Feature | New Files | Modified Files | New DB | Modified DB |
|---------|-----------|----------------|--------|-------------|
| student_diy role | `(dashboard)/student_diy/**` | `config.ts`, `proxy.ts`, `types.ts` | — | `users.role`, `invites.role`, `magic_links.role` |
| Skip tracker | `SkipBadge.tsx` | coach/owner student list pages | — | — (reads work_sessions) |
| Coach assignments | `(dashboard)/coach/assignments/page.tsx`, `CoachAssignmentsClient.tsx` | — | — | — (PATCH users.coach_id already exists) |
| Report comments | `api/reports/[id]/comment/route.ts` | `ReportRow.tsx`, student report history | `report_comments` | — |
| Chat | `api/messages/**`, `ChatClient.tsx`, chat pages | `Sidebar.tsx`, `get_sidebar_badges` RPC | `messages` | — |
| Resources | `api/resources/**`, `ResourcesTab.tsx`, `DiscordEmbed.tsx` | — | `resources` | — |
| Glossary | `api/glossary/**`, `GlossaryTab.tsx` | — | `glossary_terms` | — |
| Invite max_uses | — | `CoachInvitesClient.tsx`, invite creation UI | — | `magic_links.max_uses` default |

---

## Sources

- Direct codebase inspection: `src/proxy.ts`, `src/lib/config.ts`, `src/lib/session.ts`, `src/lib/csrf.ts`, `src/lib/rate-limit.ts`, `src/lib/supabase/admin.ts`
- Existing route patterns: `src/app/api/reports/route.ts`, `src/app/api/reports/[id]/review/route.ts`
- Dashboard layout: `src/app/(dashboard)/layout.tsx`, `src/components/layout/Sidebar.tsx`
- Schema: `src/lib/types.ts`, `supabase/migrations/00013_daily_plans_undo_log.sql`
- Project decisions: `.planning/PROJECT.md` (D-01 through D-14)
- RPC types: `src/lib/rpc/types.ts`

---
*Architecture research for: IMA Accelerator v1.4 — Roles, Chat & Resources*
*Researched: 2026-04-03*
