---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, supabase, eslint]

# Dependency graph
requires: []
provides:
  - Next.js 16.1.6 App Router project compiling with TypeScript strict
  - Tailwind v4 configured via @config directive with 17 ima-* color tokens (no tier/brand/warm)
  - cn() utility in src/lib/utils.ts using clsx + tailwind-merge
  - Inter font loaded via next/font/google in root layout
  - All V1 production and dev dependencies installed at correct versions
  - CLAUDE.md with proxy.ts rule, motion-safe rule, 44px touch targets, all hard rules
affects: [all phases — every plan depends on this foundation]

# Tech tracking
tech-stack:
  added:
    - next@16.1.6
    - react@19.2.3
    - "@supabase/ssr@^0.9.0"
    - "@supabase/supabase-js@^2.98.0"
    - server-only@^0.0.1
    - class-variance-authority@^0.7.1
    - clsx@^2.1.1
    - tailwind-merge@^3.5.0
    - lucide-react@^0.576.0
    - motion@^12.35.2
    - zod@^4.3.6
    - date-fns@^4.1.0
    - supabase@^2.76.16 (dev)
    - "@tailwindcss/postcss@^4" (dev)
    - tailwindcss@^4 (dev)
  patterns:
    - Tailwind v4 @config directive pattern (globals.css points to tailwind.config.ts)
    - cn() utility for conditional class merging (clsx + twMerge)
    - ima-* color token namespace (all UI colors prefixed ima-)
    - reference-old/ excluded from tsconfig to prevent type errors from legacy code

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - eslint.config.mjs
    - tailwind.config.ts
    - src/app/globals.css
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/lib/utils.ts
    - .env.local.example
    - .gitignore
    - CLAUDE.md
  modified: []

key-decisions:
  - "scaffolded in temp dir then copied files: create-next-app refuses non-empty dirs, so scaffold was done in /tmp/ima-scaffold then files copied over"
  - "excluded reference-old/ from tsconfig: the old codebase in reference-old/ was picked up by TypeScript glob includes and caused type errors; added to tsconfig exclude array"
  - "V1 only has 17 ima-* tokens: reference-old had tier-*, brand-*, warm-* tokens that are cut features in V1; tailwind.config.ts only contains the core ima-* palette"

patterns-established:
  - "Tailwind v4 @config directive: globals.css uses @import tailwindcss + @config ../../tailwind.config.ts — NOT @tailwind base/components/utilities"
  - "cn() utility: all conditional class merging uses cn() from src/lib/utils.ts"
  - "ima-* tokens only: never use hardcoded hex or Tailwind default colors (gray, blue, etc.) in UI"
  - "motion-safe: prefix: every animate-* class must use motion-safe:animate-*"
  - "44px touch targets: every interactive element needs min-h-[44px]"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 01 Plan 01: Project Scaffold Summary

**Next.js 16.1.6 App Router with TypeScript strict, Tailwind v4 @config directive, 17 ima-* tokens, Inter font, cn() utility, and all V1 dependencies installed**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T14:53:36Z
- **Completed:** 2026-03-16T14:59:44Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Next.js 16.1.6 project scaffolded with TypeScript strict mode, path aliases, and all V1 production/dev dependencies
- Tailwind v4 configured with @config directive pattern pointing globals.css to tailwind.config.ts; 17 ima-* color tokens (V1 only)
- Root layout with Inter font, ima-bg background, ima-text foreground; cn() utility in src/lib/utils.ts; CLAUDE.md with all hard rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js 16 project and install all V1 dependencies** - `e324d99` (feat)
2. **Task 2: Configure Tailwind v4 with ima-* tokens, Inter font, globals.css, utils.ts, root layout, and CLAUDE.md** - `09ac7b6` (feat)

## Files Created/Modified
- `package.json` - ima-accelerator project with all V1 deps at correct versions, next@16.1.6
- `tsconfig.json` - TypeScript strict, @/* path alias, reference-old/ excluded
- `next.config.ts` - Default Next.js 16 config
- `postcss.config.mjs` - @tailwindcss/postcss plugin (Tailwind v4 style)
- `eslint.config.mjs` - ESLint with next/core-web-vitals config
- `tailwind.config.ts` - V1-only ima-* tokens (17 colors), card-hover shadow, 3 animations
- `src/app/globals.css` - Tailwind v4 @import + @config directive only, nothing else
- `src/app/layout.tsx` - Inter font, IMA Accelerator metadata, bg-ima-bg text-ima-text body
- `src/app/page.tsx` - Minimal placeholder with text-ima-primary heading
- `src/lib/utils.ts` - cn() utility using clsx + tailwind-merge
- `.env.local.example` - Required env vars without secrets
- `.gitignore` - .env.local, .next/, node_modules/ excluded; reference-old/ and .planning/ NOT excluded
- `CLAUDE.md` - Project instructions: proxy.ts rule, motion-safe rule, 44px touch targets, all 8 hard rules

## Decisions Made
- Scaffolded in /tmp/ima-scaffold then copied files — create-next-app refuses to run in non-empty directories
- Added `reference-old` to tsconfig.json exclude array — the legacy codebase files caused TypeScript type errors during build (missing module imports)
- V1 tailwind.config.ts contains only 17 ima-* tokens — tier-*, brand-*, warm-* tokens from reference-old are cut features not in V1 scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded reference-old/ from tsconfig.json**
- **Found during:** Task 1 (npm run build verification)
- **Issue:** TypeScript was including reference-old/**/*.tsx files in compilation and failing on missing @/lib/supabase/client imports (old codebase dependencies)
- **Fix:** Added `"reference-old"` to the `exclude` array in tsconfig.json
- **Files modified:** tsconfig.json
- **Verification:** npm run build passes with no TypeScript errors
- **Committed in:** e324d99 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — reference-old/ must be excluded from TypeScript compilation to allow clean V1 builds.

## Issues Encountered
- create-next-app rejected the project root (non-empty directory). Resolved by scaffolding to /tmp/ima-scaffold and copying files manually. The .planning/, reference-old/, supabase/, and .env.local files were preserved.

## User Setup Required
None - no external service configuration required. .env.local already exists with Supabase credentials.

## Next Phase Readiness
- Foundation is complete; all subsequent plans can import from @/* with TypeScript strict
- Tailwind v4 with ima-* tokens is ready for UI component development (Plan 01-02 and 01-03)
- cn() utility is available for conditional class merging in all components
- Supabase client setup (Plan 01-02) can proceed immediately

---
*Phase: 01-foundation*
*Completed: 2026-03-16*

## Self-Check: PASSED

All files verified present. All commit hashes verified in git history.
- FOUND: package.json, tsconfig.json, tailwind.config.ts, src/app/globals.css, src/lib/utils.ts, src/app/layout.tsx, src/app/page.tsx, CLAUDE.md, .env.local.example, .gitignore
- FOUND: e324d99 (Task 1 commit)
- FOUND: 09ac7b6 (Task 2 commit)
