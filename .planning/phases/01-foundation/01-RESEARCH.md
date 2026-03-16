# Phase 1: Foundation - Research

**Researched:** 2026-03-16
**Domain:** Next.js 16 App Router, Supabase local dev, Tailwind v4, TypeScript strict, role-based routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Dashboard layout shell
- Collapsible sidebar: full sidebar with icons + labels on desktop, collapses to icon-only or hamburger drawer on mobile
- Sidebar bottom shows user name + role badge (Owner/Coach/Student) + sign-out button
- Page content area has a clean page title header on the left (no breadcrumbs)
- Sidebar always starts expanded on page load (no localStorage persistence of collapse state)
- Mobile sidebar: overlay with dark backdrop, tap backdrop to close (not push content)

#### V1 navigation items
- **Owner (6 items with separator):** Dashboard, Coaches, Students | Invites, Assignments, Alerts
  - Visual separator between viewing pages (Dashboard/Coaches/Students) and action pages (Invites/Assignments/Alerts)
- **Coach (5 items with separator):** Dashboard, My Students, Reports | Invite Students, Analytics
  - Visual separator between daily work (Dashboard/My Students/Reports) and admin (Invite Students/Analytics)
  - Badge on Reports nav item showing unreviewed report count
- **Student (5 items):** Dashboard, Work Tracker, Roadmap, Ask Abu Lahya, Daily Report
  - Ask Abu Lahya positioned above Daily Report (4th position, not last)
  - No separators needed for student nav

#### Config simplification
- Write a minimal fresh config.ts with only V1 sections (~300 lines, no V2 stubs)
- V1 sections: app meta, roles, routes, work tracker, roadmap steps, daily report, coach config, owner config, invite config, AI config, theme, navigation, validation
- No SCHEMA object in config — schema lives in SQL migrations only; TypeScript types generated via `supabase gen types typescript`
- No granular PERMISSIONS arrays — roles are sufficient for V1; route guards + RLS handle access
- Keep `niche` column on users table (useful context for coaches, can be set during registration or by coach/owner)
- No V2 sections: no tiers, leaderboard, player cards, streaks, focus mode, deals, notifications, analytics config, email templates

#### Local dev seed data
- Full realistic seed: 1 owner, 2 coaches, 5 students with coach assignments
- Include varied data: some active/inactive students, various roadmap progress levels, sample work sessions, sample daily reports (some reviewed, some not)
- Owner email: `ibrahim@inityx.org` — seeded with null auth_id, linked after first Google OAuth login
- Seed user rows only (no auth users) — auth_id linked via OAuth callback on first login

### Claude's Discretion
- Exact sidebar width and collapse breakpoint
- Animation/transition style for sidebar collapse
- Specific Lucide icons for each nav item
- Tailwind v4 configuration approach (CSS-first config vs tailwind.config.ts)
- ESLint rule configuration details
- Path alias structure (@/ vs ~/src/)
- RLS policy naming and structure (can reference old migration patterns)
- Exact seed data values (student names, dates, progress levels)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 1 builds a clean Next.js 16 project with Supabase local dev, migrates the 6-table V1 schema with RLS, configures Tailwind v4 with ima-* tokens, and wires up the role-based routing infrastructure via proxy.ts. The reference-old/ codebase provides a **complete working implementation** of every component needed — the primary task is adaptation (strip V2 tables/sections, update navigation to V1 items) rather than invention.

The stack is already fully defined and working: Next.js 16.1.6, React 19, TypeScript strict, Supabase (@supabase/ssr 0.9.0, @supabase/supabase-js 2.98.0), Tailwind 4, CVA, Lucide, motion/react. The reference-old/ package.json is the exact dependency list to copy. The reference migration SQL handles all 9 old tables — V1 needs only the 6 V1 tables extracted with V2 tables dropped. Seed data must create rows without auth_id (linked post-OAuth), with the owner row having email ibrahim@inityx.org.

The most important architectural fact for this phase: **proxy.ts not middleware.ts** is a Next.js 16 requirement. The reference implementation shows the exact pattern. The admin client (service-role) is used in proxy.ts to bypass RLS for role lookups — this is not a shortcut, it is required because get_user_role() can fail when the session is not fully established.

**Primary recommendation:** Adapt reference-old/ code directly. The scaffold (plan 01-01), Supabase layer (plan 01-02), and config+proxy (plan 01-03) map cleanly to existing reference files. Strip V2 content, add V1 navigation items, and run `supabase gen types typescript` to produce the types file.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | App Router framework | Locked — project requirement |
| react / react-dom | 19.2.3 | UI runtime | Ships with Next.js 16 |
| typescript | ^5 | Type safety | Strict mode required |
| tailwindcss | ^4 | Utility CSS | Locked — V4 CSS-first approach |
| @supabase/ssr | ^0.9.0 | Cookie-based server auth | Required for Next.js App Router |
| @supabase/supabase-js | ^2.98.0 | Supabase client | Direct service-role access |
| server-only | ^0.0.1 | Guard admin client imports | Prevents client-bundle leaks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | CVA component variants | All UI primitives (Button, Badge, etc.) |
| clsx | ^2.1.1 | Conditional class merging | Used in cn() utility |
| tailwind-merge | ^3.5.0 | Tailwind class deduplication | Part of cn() utility |
| lucide-react | ^0.576.0 | Icons | Sidebar nav icons, all UI icons |
| motion | ^12.35.2 | Animations | Sidebar transitions, active indicators |
| zod | ^4.3.6 | Schema validation | API route inputs — import from "zod" not "zod/v4" |

### Dev Dependencies
| Library | Version | Purpose |
|---------|---------|---------|
| @tailwindcss/postcss | ^4 | PostCSS plugin for Tailwind v4 |
| eslint | ^9 | Linting |
| eslint-config-next | 16.1.6 | Next.js ESLint rules |
| supabase (CLI) | ^2.76.16 | Local dev, migrations, type gen |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| proxy.ts | middleware.ts | Next.js 16 breaking change — middleware.ts is NOT supported, proxy.ts is required |
| Tailwind v4 CSS-first | tailwind.config.ts | Both work in v4; reference-old uses tailwind.config.ts + @config directive in CSS |
| supabase gen types | Manual types file | Generated types guarantee sync with schema; manual diverges |

**Installation (new project):**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
npm install @supabase/ssr @supabase/supabase-js server-only class-variance-authority clsx tailwind-merge lucide-react motion zod
npm install -D supabase @tailwindcss/postcss
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── (auth)/          # login, register, no-access — no sidebar
│   │   ├── login/
│   │   ├── register/
│   │   └── no-access/
│   ├── (dashboard)/     # owner, coach, student — shares Sidebar layout
│   │   ├── layout.tsx   # auth guard + Sidebar render
│   │   ├── owner/
│   │   ├── coach/
│   │   └── student/
│   ├── api/             # route handlers (mutations only)
│   │   └── auth/callback/
│   ├── globals.css
│   └── layout.tsx       # Root layout (Inter font, ToastProvider)
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx  # "use client" — collapsible nav
│   └── ui/              # CVA primitives: Button, Card, Badge, Input, etc.
├── lib/
│   ├── config.ts        # Single source of truth (~300 lines, V1 only)
│   ├── utils.ts         # cn(), getToday(), getDaysAgo(), etc.
│   ├── types.ts         # Hand-written OR generated from supabase gen types
│   └── supabase/
│       ├── client.ts    # Browser client (createBrowserClient)
│       ├── server.ts    # SSR client (createServerClient + cookies())
│       └── admin.ts     # Service-role client (server-only import guard)
└── proxy.ts             # Route guard — NOT middleware.ts
supabase/
├── config.toml          # Already initialized (project_id: ima-accelerator-v1)
├── migrations/
│   └── 00001_create_tables.sql   # 6 V1 tables + RLS + helper functions
└── seed.sql             # Realistic seed: 1 owner, 2 coaches, 5 students
```

### Pattern 1: Three Supabase Client Tiers
**What:** Three separate Supabase client factories with different roles and contexts.
**When to use:** Always — each has a specific purpose and must not be substituted.

```typescript
// src/lib/supabase/admin.ts — service-role, server-only
// Source: reference-old/src/lib/supabase/admin.ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts — SSR client with cookies, for server components/pages
// Source: reference-old/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component — can't set cookies */ }
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/client.ts — browser client for "use client" components
// Source: reference-old/src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Pattern 2: proxy.ts Route Guard
**What:** A named export `proxy()` called from the root middleware.ts-equivalent. Uses the anon client to check session and the admin client to check role (bypasses RLS).
**When to use:** This IS the auth layer. Every protected route depends on it.

```typescript
// src/proxy.ts — simplified V1 version (strip /student/leaderboard from ROLE_ROUTE_ACCESS)
// Source: reference-old/src/proxy.ts
const DEFAULT_ROUTES: Record<string, string> = {
  owner: "/owner",
  coach: "/coach",
  student: "/student",
};

const ROLE_ROUTE_ACCESS: Record<string, string[]> = {
  owner: ["/owner"],
  coach: ["/coach"],
  student: ["/student"],
};

export async function proxy(request: NextRequest) {
  // 1. Refresh session via anon SSR client
  // 2. Public routes (/login, /register, /no-access): if user logged in, redirect to role dashboard
  // 3. Protected routes: if no user, redirect to /login
  // 4. Role check via admin client (bypasses RLS): if no profile, redirect to /no-access
  // 5. Route access check: if role doesn't have access to this prefix, redirect to role dashboard
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)" ],
};
```

**Critical:** The admin client is used for role lookups in proxy.ts because `get_user_role()` (SECURITY DEFINER function) can return null right after OAuth registration before the session is fully established. Using the service-role client sidesteps this race condition.

### Pattern 3: Dashboard Layout Shell
**What:** Server component layout that fetches user profile and renders Sidebar + main content area.
**When to use:** The `(dashboard)/layout.tsx` wraps all owner/coach/student pages.

```typescript
// src/app/(dashboard)/layout.tsx
// Source: reference-old/src/app/(dashboard)/layout.tsx
export default async function DashboardLayout({ children }) {
  const supabase = await createClient();         // SSR client — checks session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();             // Admin client — bypasses RLS
  const { data: profile } = await admin
    .from("users")
    .select("role, name")
    .eq("auth_id", user.id)
    .single();

  if (!profile) redirect("/no-access");

  return (
    <div className="min-h-screen bg-ima-bg">
      <Sidebar role={profile.role as Role} userName={profile.name} />
      <main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
```

### Pattern 4: V1 Navigation Structure with Separators
**What:** NAVIGATION constant in config.ts encodes role-specific nav items with separator metadata.
**When to use:** Sidebar reads this to render role-specific nav links + separators.

The V1 NAVIGATION type must be extended from the reference to support separators:

```typescript
// config.ts — V1 navigation with separator support
export type NavItem = {
  label: string;
  href: string;
  icon: string;
  separator?: boolean;    // render divider BEFORE this item
  badge?: string;         // key for dynamic badge count (e.g. "unreviewed_reports")
};

export const NAVIGATION: Record<Role, NavItem[]> = {
  owner: [
    { label: "Dashboard",   href: "/owner",              icon: "LayoutDashboard" },
    { label: "Coaches",     href: "/owner/coaches",       icon: "Shield" },
    { label: "Students",    href: "/owner/students",      icon: "Users" },
    { label: "Invites",     href: "/owner/invites",       icon: "UserPlus",      separator: true },
    { label: "Assignments", href: "/owner/assignments",   icon: "ArrowLeftRight" },
    { label: "Alerts",      href: "/owner/alerts",        icon: "Bell" },
  ],
  coach: [
    { label: "Dashboard",       href: "/coach",           icon: "LayoutDashboard" },
    { label: "My Students",     href: "/coach/students",  icon: "Users" },
    { label: "Reports",         href: "/coach/reports",   icon: "FileText",      badge: "unreviewed_reports" },
    { label: "Invite Students", href: "/coach/invites",   icon: "UserPlus",      separator: true },
    { label: "Analytics",       href: "/coach/analytics", icon: "BarChart3" },
  ],
  student: [
    { label: "Dashboard",    href: "/student",        icon: "LayoutDashboard" },
    { label: "Work Tracker", href: "/student/work",   icon: "Timer" },
    { label: "Roadmap",      href: "/student/roadmap",icon: "Map" },
    { label: "Ask Abu Lahya",href: "/student/ask",    icon: "MessageSquare" },
    { label: "Daily Report", href: "/student/report", icon: "FileText" },
  ],
};
```

### Pattern 5: Tailwind v4 with ima-* Tokens
**What:** Tailwind v4 supports two config modes. Reference-old uses tailwind.config.ts + `@config` directive.
**When to use:** Matches reference-old approach; preserves all ima-* color token names.

```css
/* src/app/globals.css */
@import "tailwindcss";
@config "../../tailwind.config.ts";
```

The tailwind.config.ts keeps only V1 ima-* tokens (strip tier-*, brand-*, warm-* for V1). Required tokens: `ima-primary`, `ima-primary-hover`, `ima-secondary`, `ima-accent`, `ima-success`, `ima-warning`, `ima-error`, `ima-info`, `ima-bg`, `ima-surface`, `ima-surface-light`, `ima-surface-accent`, `ima-border`, `ima-text`, `ima-text-secondary`, `ima-text-muted`, `ima-overlay`.

### Anti-Patterns to Avoid
- **Never use middleware.ts:** Next.js 16 requires `proxy.ts` — the reference uses it, follow it exactly.
- **Never query role from JWT user_metadata:** Roles live in the `users` table only. user_metadata is user-editable.
- **Never import createAdminClient in client components:** The `import "server-only"` guard prevents this, but never attempt it.
- **Never skip the `server-only` guard on admin.ts:** Service-role key must never reach the browser bundle.
- **Never use hardcoded hex/gray values:** Use `text-ima-text-secondary`, not `text-gray-500` or `text-[#64748B]`.
- **Never swallow errors in catch blocks:** Always `console.error` or toast.
- **Never write `import { z } from "zod/v4"`:** The correct import is `import { z } from "zod"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based auth in SSR | Custom session management | @supabase/ssr createServerClient | Handles Next.js App Router cookie lifecycle correctly |
| Service-role protection | Module-level checks | `import "server-only"` | Webpack/bundler enforces at build time, not runtime |
| Class merging with Tailwind | String concatenation | cn() = clsx + tailwind-merge | Deduplicates conflicting Tailwind classes |
| Component variants | Inline ternaries | class-variance-authority (CVA) | Type-safe variant APIs, proven pattern in reference-old |
| Sidebar animation | CSS transitions | motion/react AnimatePresence | Already integrated in reference; handles reduced-motion |
| Focus trap in mobile sidebar | Custom useEffect | Pattern from reference Sidebar.tsx | Handles all edge cases: Escape key, Tab cycle, focus lock |
| SQL helper functions | Per-query JOINs | get_user_id(), get_user_role() SECURITY DEFINER | RLS policies rely on these; re-use from old migration |

**Key insight:** Every infrastructure problem in this phase has an existing working solution in reference-old/. The job is extraction and simplification, not new engineering.

---

## Common Pitfalls

### Pitfall 1: proxy.ts matcher includes /api/ routes
**What goes wrong:** API routes get intercepted by the proxy, triggering auth checks on server-to-server calls.
**Why it happens:** The matcher pattern is written too broadly.
**How to avoid:** The reference matcher explicitly excludes `/api/`: `"/((?!_next/static|_next/image|favicon.ico|api/).*)"`. Copy this exactly.
**Warning signs:** API routes returning 302 redirects to /login.

### Pitfall 2: RLS blocks role lookup in proxy.ts
**What goes wrong:** The proxy queries `users` table with the anon key, but RLS `get_user_role()` returns null right after OAuth login (session not fully established). User gets redirected to /no-access.
**Why it happens:** `get_user_role()` reads from users table via auth.uid() — if the JWT hasn't fully propagated, the function returns null and RLS blocks the query.
**How to avoid:** proxy.ts uses `createClient` (from @supabase/supabase-js, NOT @supabase/ssr) with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS entirely for the profile lookup. This is the exact pattern in reference-old/src/proxy.ts.
**Warning signs:** Infinite redirect loop for new users after OAuth callback.

### Pitfall 3: `supabase gen types typescript` output path
**What goes wrong:** Types generated but not found at `@/lib/types`.
**Why it happens:** Default output goes to stdout; must redirect to file.
**How to avoid:** Run `npx supabase gen types typescript --local > src/lib/types.ts`. The generated file exports a `Database` type that admin.ts and server.ts import.
**Warning signs:** TypeScript errors on `createClient<Database>()` calls.

### Pitfall 4: Seed data with auth_id — breaks OAuth linking
**What goes wrong:** Seeded user rows have `auth_id` set; when user logs in via Google OAuth, the auth callback can't find a matching row to link because auth_id is already taken by a different UUID.
**Why it happens:** Seed creates users with fabricated auth_ids, but real OAuth creates different UUIDs.
**How to avoid:** Seed all user rows with `auth_id = NULL`. The OAuth callback links the real auth.uid() to the users row by email. The owner email `ibrahim@inityx.org` must be seeded with `auth_id = NULL`.
**Warning signs:** "duplicate key value violates unique constraint users_auth_id_key" after OAuth login.

### Pitfall 5: V2 tables in migration break V1 TypeScript types
**What goes wrong:** Including deals, influencers, notifications, call_schedule, leaderboard_snapshots tables in the migration means `supabase gen types typescript` generates types for them. Code that imports from `@/lib/types` gets a bloated Database type and accidental V2 references slip in.
**Why it happens:** Copy-pasting the full old migration.
**How to avoid:** Write a new migration with ONLY the 6 V1 tables. Reference the old migration for the SQL patterns (helper functions, RLS policy structure) but do not copy V2 tables.
**Warning signs:** Generated types.ts contains DealRow, InfluencerRow, etc.

### Pitfall 6: `motion-safe:` omission on animations
**What goes wrong:** Users with reduced-motion preferences (accessibility) see animations they explicitly opted out of.
**Why it happens:** Forgetting to prefix `animate-*` classes with `motion-safe:`.
**How to avoid:** Reference CLAUDE.md Hard Rule #1: every `animate-*` class MUST use `motion-safe:animate-*`. The reference Sidebar.tsx uses `motion-safe:transition-transform` for CSS transitions and `useReducedMotion()` for Framer/motion animations.
**Warning signs:** ESLint or review catches bare `animate-*` without `motion-safe:`.

### Pitfall 7: Touch targets below 44px
**What goes wrong:** Sidebar links, sign-out button, mobile menu toggle don't meet accessibility minimum.
**Why it happens:** Default Tailwind spacing doesn't guarantee 44px.
**How to avoid:** Reference CLAUDE.md Hard Rule #2: every interactive element needs `min-h-[44px]`. Reference Sidebar uses `min-h-[44px]` on all links and buttons.
**Warning signs:** Review catches interactive elements without `min-h-[44px]`.

### Pitfall 8: Tailwind v4 `@config` directive location
**What goes wrong:** tailwind.config.ts tokens don't apply because the CSS file doesn't reference it.
**Why it happens:** Tailwind v4 CSS-first approach still needs the `@config` directive if you're using a .ts config file.
**How to avoid:** `globals.css` must have `@import "tailwindcss";` followed by `@config "../../tailwind.config.ts";`. See reference-old/src/app/globals.css.
**Warning signs:** All `ima-*` color classes are unrecognized; build warnings about unknown tokens.

---

## Code Examples

Verified patterns from reference-old/ source:

### V1 Migration — Helper Functions (from reference migration)
```sql
-- supabase/migrations/00001_create_tables.sql
-- These three functions are required by RLS policies

CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.users WHERE auth_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE auth_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
```

### V1 Migration — Users Table (from reference, strip streak_count + last_active_at per CONTEXT.md)
```sql
-- The V1 users table drops streak_count and last_active_at (V2 only)
-- Keep: id, auth_id, email, name, role, coach_id, niche, status, joined_at, created_at, updated_at
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  role varchar(20) NOT NULL CHECK (role IN ('owner', 'coach', 'student')),
  coach_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  niche varchar(255),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### V1 Seed Pattern (auth_id = NULL)
```sql
-- supabase/seed.sql
-- Insert users with NULL auth_id — linked post-OAuth by email match
INSERT INTO public.users (id, auth_id, email, name, role, coach_id, niche, status, joined_at) VALUES
  -- Owner (auth_id NULL — will link on first Google OAuth)
  ('00000000-0000-0000-0000-000000000001', NULL, 'ibrahim@inityx.org', 'Ibrahim', 'owner', NULL, NULL, 'active', NOW() - INTERVAL '90 days'),
  -- Coaches
  ('00000000-0000-0000-0000-000000000002', NULL, 'coach1@ima.test', 'Sarah Ahmed', 'coach', NULL, NULL, 'active', NOW() - INTERVAL '60 days'),
  ('00000000-0000-0000-0000-000000000003', NULL, 'coach2@ima.test', 'Omar Hassan', 'coach', NULL, NULL, 'active', NOW() - INTERVAL '60 days'),
  -- Students (coach_id assigned)
  ('00000000-0000-0000-0000-000000000004', NULL, 'student1@ima.test', 'Amira Malik', 'student', '00000000-0000-0000-0000-000000000002', 'fitness', 'active', NOW() - INTERVAL '30 days'),
  ...
```

### cn() utility (from reference)
```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### restrict_self_update_users trigger (from reference migration — CRITICAL for security)
```sql
-- Prevents non-owners from escalating their own role, changing coach_id, or changing auth_id
CREATE OR REPLACE FUNCTION public.restrict_self_update_users()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_user_role() != 'owner' THEN
    NEW.role      := OLD.role;
    NEW.coach_id  := OLD.coach_id;
    NEW.auth_id   := OLD.auth_id;
    NEW.email     := OLD.email;
    NEW.joined_at := OLD.joined_at;
  END IF;
  RETURN NEW;
END;
$$;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| middleware.ts for auth | proxy.ts exported function | Next.js 16 | Direct import by root layout/page — NOT automatic Next.js middleware |
| Tailwind v3 tailwind.config.js | Tailwind v4 with @import + optional @config | Tailwind v4 (2024) | CSS-first config; @config directive needed if using .ts config |
| @supabase/auth-helpers-nextjs | @supabase/ssr | ~2023 | Cookie handling rewritten for App Router |
| Manual types.ts | supabase gen types typescript | Supabase CLI v2 | Auto-generated from live schema; always in sync |
| zod v3 import | zod v4 import (same package, new major) | 2024/25 | Import still `from "zod"` not `from "zod/v4"` — this is the correct form |

**Deprecated/outdated in this project:**
- `@supabase/auth-helpers-nextjs`: replaced by `@supabase/ssr` — reference-old already uses the new package
- middleware.ts pattern: proxy.ts is the established pattern for this codebase

---

## Open Questions

1. **supabase gen types vs. hand-written types.ts**
   - What we know: reference-old has hand-written types.ts; V1 schema is smaller and stable
   - What's unclear: whether to run `supabase gen types typescript` or hand-write for the 6 V1 tables
   - Recommendation: Run `supabase gen types typescript --local > src/lib/types.ts` after migration runs; delete V2 types manually if they appear. Hand-writing is acceptable given the small schema but gen types is lower-maintenance.

2. **Coach Reports badge (unreviewed count)**
   - What we know: CONTEXT.md locked the badge on Reports nav; Sidebar is a client component
   - What's unclear: How to pass the unreviewed count to the Sidebar without prop drilling through layout.tsx
   - Recommendation: Pass badge counts from dashboard layout server component as props to Sidebar. Layout already queries the admin client — add a query for unreviewed report count filtered by coach_id.

3. **Next.js version — is 16.1.6 correct?**
   - What we know: reference-old/package.json shows `"next": "16.1.6"` and `eslint-config-next: 16.1.6`
   - What's unclear: whether `create-next-app@latest` would install a different version
   - Recommendation: Pin `next@16.1.6` explicitly in package.json rather than relying on @latest to match the reference version.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test infrastructure in project |
| Config file | None — Wave 0 must create |
| Quick run command | `npx tsc --noEmit && npm run lint` |
| Full suite command | `npx tsc --noEmit && npm run lint && npm run build` |

**Note:** Phase 1 is pure infrastructure with no business logic, no edge cases, and no user-facing behavior beyond routing and schema correctness. The success criteria are verified by running the app (`npm run dev`), inspecting Supabase Studio for schema, and testing proxy.ts redirects manually. Formal test framework setup is deferred to Phase 2 when feature code appears.

### Phase Requirements → Test Map
| Success Criterion | Behavior | Test Type | Automated Command |
|-------------------|----------|-----------|-------------------|
| SC-1: `npm run dev` starts | App compiles and loads | build | `npm run build` |
| SC-2: Database schema + RLS | 6 tables with correct policies | smoke | `npx supabase db reset && npx supabase status` |
| SC-3: proxy.ts redirects | Unauthenticated → /login; wrong-role → /no-access | manual | Manual browser test |
| SC-4: createAdminClient() server-only | Compilation fails if imported in client | build | `npx tsc --noEmit` |
| SC-5: lib/config.ts no runtime errors | Config exports correctly | build | `npx tsc --noEmit` |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npm run lint`
- **Per wave merge:** `npm run build`
- **Phase gate:** `npm run build` green + manual proxy.ts redirect tests pass

### Wave 0 Gaps
- [ ] No test framework needed for Phase 1 — all validation is TypeScript compilation + build + manual browser testing
- [ ] `npm run build` will be the gate check — must pass before `/gsd:verify-work`

---

## Sources

### Primary (HIGH confidence)
- `reference-old/src/proxy.ts` — complete proxy.ts implementation; direct adaptation
- `reference-old/src/lib/supabase/` — all 3 client patterns; direct adaptation
- `reference-old/src/lib/config.ts` — full config structure with all V1 sections visible
- `reference-old/supabase/migrations/00001_create_tables.sql` — complete schema + RLS + helper functions + triggers
- `reference-old/src/components/layout/Sidebar.tsx` — complete sidebar implementation with accessibility, focus trap, mobile overlay, sign-out
- `reference-old/src/app/(dashboard)/layout.tsx` — dashboard layout shell with auth guard
- `reference-old/tailwind.config.ts` — full ima-* color token set
- `reference-old/src/app/globals.css` — Tailwind v4 import pattern
- `reference-old/package.json` — exact dependency versions
- `reference-old/CLAUDE.md` — hard rules that apply to all phases

### Secondary (MEDIUM confidence)
- `supabase/config.toml` — already initialized; project_id confirmed as `ima-accelerator-v1`; auth site_url = http://127.0.0.1:3000 (matches SC-1 requirement for localhost:3000)
- `.env.local` — Supabase credentials already present (URL + anon key + service role key)

### Tertiary (LOW confidence)
- None — all findings backed by direct source code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — exact versions from reference-old/package.json
- Architecture: HIGH — complete working implementations in reference-old/
- Pitfalls: HIGH — derived from actual code in reference implementation + documented decisions
- SQL schema: HIGH — direct from reference migration, V1 tables clearly identified
- Seed data structure: HIGH — pattern clear; exact values left to Claude's discretion per CONTEXT.md

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack — all libraries in use, no fast-moving APIs)
