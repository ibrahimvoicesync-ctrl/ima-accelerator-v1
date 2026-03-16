# IMA Accelerator V1

Student performance & coaching platform for Abu Lahya's halal influencer marketing mentorship.

## Stack

- Next.js 16 (App Router, proxy.ts NOT middleware.ts)
- React 19, TypeScript strict
- Supabase (auth + Postgres + RLS)
- Tailwind CSS 4 with ima-* design tokens
- Google OAuth only, invite-only registration

## Commands

```
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no emit)
```

## Architecture

```
src/app/(auth)/       # Login, register, no-access — no sidebar
src/app/(dashboard)/  # Owner, coach, student views — shares Sidebar layout
src/app/api/          # Route handlers (mutations only)
src/components/ui/    # CVA-based primitives
src/components/       # Feature components
src/lib/config.ts     # Single source of truth (roles, nav, roadmap)
src/lib/supabase/     # Client, server, admin clients
src/proxy.ts          # Route guard — NOT middleware.ts
```

## Database

6 tables: users, invites, magic_links, work_sessions, roadmap_progress, daily_reports. All have RLS. Roles: owner > coach > student.

## Critical Rules

1. **Config is truth** — import from src/lib/config.ts, never hardcode roles/nav/roadmap
2. **Admin client only in server code** — never import in client components
3. **Proxy not middleware** — Next.js 16 uses src/proxy.ts
4. **Google OAuth only** — no password flows exist
5. **Light theme with blue accents** — all UI uses ima-* tokens

## Hard Rules (enforce during EVERY build)

1. **motion-safe:** — every `animate-*` class MUST use `motion-safe:animate-*`
2. **44px touch targets** — every interactive element needs `min-h-[44px]`
3. **Accessible labels** — every input needs `aria-label` or `<label>` with `htmlFor`+`id`
4. **Admin client in API routes** — every `.from()` query in route handlers uses the admin client
5. **Never swallow errors** — every `catch` block must toast or `console.error`, never empty
6. **Check response.ok** — every `fetch()` must check `response.ok` before parsing JSON
7. **Zod import** — `import { z } from "zod"`, never `"zod/v4"`
8. **ima-* tokens only** — all colors use ima-* design tokens, never hardcoded hex/gray

## Code Quality

- ima-* color tokens everywhere (text-white only on colored backgrounds like buttons/avatars)
- 44px min touch targets (h-11, min-h-[44px] min-w-[44px])
- ARIA on dynamic content (role="progressbar", role="timer", role="alert")
- aria-hidden="true" on decorative icons
- Zod safeParse on all API inputs, try-catch on request.json()
- Auth + role check before validation on every API route
- Filter by user ID in queries, never rely on RLS alone
- px-4 on all page wrappers for mobile
- Stable useCallback deps — use refs for toast/router
