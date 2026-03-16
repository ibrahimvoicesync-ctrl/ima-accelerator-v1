# Stack Research

**Domain:** Coaching / student performance management platform
**Researched:** 2026-03-16
**Confidence:** HIGH — all versions verified against reference-old/package.json (working codebase), official changelogs, and npm

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | Stable LTS release (Oct 2025). App Router + Server Components is the current model. Turbopack is now the default bundler (no flag needed). Breaking: uses `proxy.ts` not `middleware.ts`. Node.js 20.9+ required. |
| React | 19.2.3 | UI rendering | Ships with Next.js 16. React 19.2 adds View Transitions and useEffectEvent. No separate version decision needed — install via `next@latest`. |
| TypeScript | ^5 (5.9.x) | Type safety | Next.js 16 requires TS 5.1+. Latest stable is 5.9.x. Strict mode is required per PROJECT.md constraints. |
| Supabase (hosted) | — | Postgres + Auth + RLS + Realtime | Managed Postgres with built-in Auth, RLS, and Row Security. Zero infrastructure ops. Google OAuth is first-class. |
| Tailwind CSS | ^4 (4.2.1) | Utility-first CSS | v4 stable since Jan 2025. CSS-first config via `@theme` directive — no `tailwind.config.js` needed. `@tailwindcss/postcss` replaces the old PostCSS plugin. Design tokens defined as CSS custom properties accessible at runtime. |

### Supabase Client Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @supabase/supabase-js | ^2.99.1 | Core Supabase client | Standard JS client for all Supabase services. Use for admin client (service role) in server-only contexts. |
| @supabase/ssr | ^0.9.0 | Cookie-based auth for SSR | Replaces deprecated `@supabase/auth-helpers-nextjs`. Exports `createServerClient` (for Server Components, API routes, proxy.ts) and `createBrowserClient` (for Client Components). Required for correct session management in App Router. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Schema validation | All API route inputs via `safeParse`. All form schemas. Import as `import { z } from "zod"` — never `"zod/v4"` (breaks tree-shaking). |
| react-hook-form | ^7.71.2 | Form state management | All multi-field forms (daily reports, invite creation). Uncontrolled inputs, zero re-renders. |
| @hookform/resolvers | ^5.2.2 | Connects Zod schemas to RHF | Use `zodResolver` for type-safe form validation. v5+ supports Zod v4. |
| class-variance-authority | ^0.7.1 | CVA variant system | All UI primitive components (Button, Badge, Input). Defines variant/size/intent props with TypeScript safety. |
| tailwind-merge | ^3.5.0 | Merge conflicting Tailwind classes | Use in `cn()` utility alongside `clsx`. Prevents class conflicts when composing components. |
| clsx | ^2.1.1 | Conditional class builder | Used inside `cn()`. Handles conditional/array/object class logic before `tailwind-merge` deduplication. |
| lucide-react | ^0.577.0 | Icon set | Consistent icon library. Tree-shakable. Import individual icons, not the full set. |
| date-fns | ^4.1.0 | Date formatting and arithmetic | Format session timestamps, calculate inactivity windows (3-day, 7-day, 14-day thresholds), display relative times. |
| recharts | ^3.7.0 | Data visualization | Owner analytics dashboard (report rates, activity charts). React-native charting. Only used in owner role. |
| server-only | ^0.0.1 | Import guard | Add to any file containing service role key or admin-only logic. Throws build error if accidentally imported in client components. |
| motion | ^12.35.2 | Animation | Used in reference-old for UI transitions. Keep with `motion-safe:animate-*` classes for accessibility compliance per PROJECT.md hard rules. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| supabase (CLI) | ^2.76.x | Local Supabase stack | Runs local Postgres + Auth + Studio via Docker. Use for `supabase db diff` to generate migrations, `supabase start` for local dev. |
| @tailwindcss/postcss | ^4 | PostCSS integration for Tailwind v4 | Replaces `postcss-import` + old Tailwind PostCSS plugin. Single package for v4. |
| eslint | ^9 | Linting | Next.js 16 removed `next lint` command. ESLint runs directly. Uses flat config format (`eslint.config.mjs`). |
| eslint-config-next | 16.1.6 | Next.js ESLint rules | Pin to same version as Next.js to avoid rule drift. |
| @types/node | ^20 | Node.js type definitions | Match Node.js 20 (minimum for Next.js 16). |
| @types/react | ^19 | React type definitions | Match React 19. |
| @types/react-dom | ^19 | React DOM types | Match React 19. |

## Installation

```bash
# Core
npm install next@16.1.6 react@19.2.3 react-dom@19.2.3

# Supabase
npm install @supabase/supabase-js@^2.99.1 @supabase/ssr@^0.9.0

# Forms and validation
npm install zod@^4.3.6 react-hook-form@^7.71.2 @hookform/resolvers@^5.2.2

# UI utilities
npm install class-variance-authority@^0.7.1 tailwind-merge@^3.5.0 clsx@^2.1.1

# Icons, dates, charts
npm install lucide-react@^0.577.0 date-fns@^4.1.0 recharts@^3.7.0

# Runtime guards and animation
npm install server-only@^0.0.1 motion@^12.35.2

# Dev dependencies
npm install -D tailwindcss@^4 @tailwindcss/postcss@^4 typescript@^5 eslint@^9 eslint-config-next@16.1.6 @types/node@^20 @types/react@^19 @types/react-dom@^19 supabase@^2.76.16
```

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Next.js 16.1.6 | Next.js 15.x | 15 is previous major. 16 is LTS with Turbopack stable, React Compiler stable, async APIs finalized. Reference codebase already uses 16.1.6 — no reason to regress. |
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated. Bug fixes and features are only going into @supabase/ssr going forward. |
| Tailwind v4 | Tailwind v3 | v3 is EOL. v4 is stable since Jan 2025 with better performance and CSS-native design tokens. Reference codebase already uses v4. |
| Zod v4 | Zod v3 | v4 is 14x faster for string parsing, 7x for arrays. Reference codebase uses v4. Note: import from `"zod"` not `"zod/v4"` per PROJECT.md hard rules. |
| recharts | chart.js / victory | recharts is React-native and tree-shakable. Only needed for owner analytics — scope is narrow enough that bundle size is not a concern. |
| motion | framer-motion | `motion` is the rebranded framer-motion v12. Same API, lighter package name. Reference codebase uses it. |
| ESLint flat config | .eslintrc | Next.js 16 removed legacy config support. Flat config is required. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `middleware.ts` | Removed in Next.js 16. Using it will cause a build error or silent failure. The file is now `proxy.ts` with export `proxy` (not `middleware`). | `src/proxy.ts` with `export function proxy(request: Request)` |
| `@supabase/auth-helpers-nextjs` | Officially deprecated. No new features or bug fixes. Will eventually be removed from npm. | `@supabase/ssr` with `createServerClient` / `createBrowserClient` |
| `supabase.auth.getSession()` in Server Components | Returns potentially stale session from cookies without re-validating with Supabase Auth server. Can be spoofed. | `supabase.auth.getUser()` — validates token against server on every call. |
| `tailwind.config.js` | Tailwind v4 uses CSS-first config. A `tailwind.config.js` is ignored in v4 (CSS `@theme` block is the source of truth). Confusing and error-prone to have both. | `@theme` directive in `globals.css` |
| `import { z } from "zod/v4"` | The `/v4` subpath breaks tree-shaking and causes module resolution errors in some environments (documented issue). | `import { z } from "zod"` — Zod v4 is the default export in 4.x. |
| Service role key in client components | Bypasses RLS entirely. If exposed to browser, any user gets full database access. | Keep in server-only files with `import 'server-only'` guard. Never use `NEXT_PUBLIC_` prefix for service role key. |
| `serverRuntimeConfig` / `publicRuntimeConfig` | Removed in Next.js 16. | `process.env` directly in Server Components, `NEXT_PUBLIC_` prefix for browser-safe values. |
| `next lint` command | Removed in Next.js 16. Calling it will error. | Run `eslint` directly. Update `package.json` scripts from `"lint": "next lint"` to `"lint": "eslint"`. |
| `experimental.ppr: true` | PPR in Next.js 15 canary style is removed in Next.js 16. Replaced by `cacheComponents` flag. | Not needed for V1 scope — skip caching configuration entirely for initial build. |

## Stack Patterns for This Project

**Auth guard pattern (App Router, Next.js 16):**
- Route protection lives in `src/proxy.ts` (not middleware)
- `proxy.ts` reads cookies via `createServerClient`, calls `getUser()`, redirects unauthenticated users
- Individual pages do a secondary check via admin client for role-based access

**Server Component data access:**
- Use `createServerClient` from `@supabase/ssr` for authenticated user-scoped reads
- Use `createAdminClient` (service role via `createClient` from `@supabase/supabase-js`) for cross-user queries (coach seeing student data, owner seeing all data)
- All admin client files must have `import 'server-only'` at the top

**Form pattern:**
- `react-hook-form` + `zodResolver` for client-side forms
- Server Action or API route receives data, validates again with `zod.safeParse()` (never trust client-side validation alone)
- Zod schema is the single source of truth — shared between form and API

**Design token pattern (Tailwind v4):**
- All tokens defined in `globals.css` under `@theme` as `--ima-*` custom properties
- Never use hardcoded hex values or `text-gray-*` — always `text-ima-*`
- All `animate-*` classes wrapped in `motion-safe:animate-*` for accessibility

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| next@16.1.6 | react@19.2.3, react-dom@19.2.3 | Must match. Install together. |
| @supabase/ssr@^0.9.0 | @supabase/supabase-js@^2.x | ssr package is a thin wrapper over supabase-js. Both needed. |
| @hookform/resolvers@^5.2.2 | zod@^4.x | v5+ of resolvers added Zod v4 support. Do not use resolvers@4.x with zod@4.x — they are incompatible. |
| tailwindcss@^4 | @tailwindcss/postcss@^4 | Must use `@tailwindcss/postcss` as PostCSS plugin. Old `tailwindcss/nesting` and standalone CLI usage changed in v4. |
| eslint-config-next@16.1.6 | next@16.1.6, eslint@^9 | Pin `eslint-config-next` to same major.minor as Next.js. |
| typescript@^5 | next@16.1.6 | Next.js 16 minimum is TypeScript 5.1. Any 5.x release works. |

## Sources

- `reference-old/package.json` — Exact working versions from previous production codebase (HIGH confidence — already in use)
- `reference-old/CLAUDE.md` — Architecture rules and critical patterns extracted from working codebase
- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16) — Release date (Oct 21, 2025), Turbopack default, proxy.ts rename
- [Next.js 16.1 Blog Post](https://nextjs.org/blog/next-16-1) — Version 16.1.6 confirmed, Turbopack FS caching stable, Dec 2025
- [Next.js v16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) — Breaking changes: async APIs, middleware→proxy rename, Node.js 20.9+ requirement
- [Supabase SSR Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — createServerClient/createBrowserClient pattern, getUser() vs getSession()
- [@supabase/ssr npm](https://www.npmjs.com/package/@supabase/ssr) — v0.9.0 confirmed current stable (498k weekly downloads)
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) — v2.99.1 confirmed current stable
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, @theme directive, v4.0 released Jan 22, 2025
- [tailwindcss npm](https://www.npmjs.com/package/tailwindcss) — v4.2.1 confirmed current stable
- [Zod v4 Release Notes](https://zod.dev/v4) — v4.0.0 released Jul 10, 2025; v4.3.6 current stable
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) — v7.71.2 confirmed current stable
- [@hookform/resolvers issue #12829](https://github.com/react-hook-form/react-hook-form/issues/12829) — Zod v4 support added in resolvers v5.0.0+
- [TypeScript npm](https://www.npmjs.com/package/typescript) — v5.9.x is latest stable; Next.js 16 minimum is 5.1
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) — v0.577.0 confirmed current stable

---
*Stack research for: coaching/student performance management platform (IMA Accelerator V1)*
*Researched: 2026-03-16*
