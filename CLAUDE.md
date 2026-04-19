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

## Design Context

### Users
Students (young Muslim entrepreneurs under Abu Lahya's mentorship), coaches, and owners. Daily use, often mobile, between outreach and study blocks. Students glance to see how the day is tracking and what's next. Coaches spot at-risk students fast. Owners take a platform-health snapshot.

### Brand Personality
**Disciplined. Trustworthy. Understated.** Evoke calm confidence, focus, and earned progress — NOT urgency, NOT gamified hype. The app sits between Ibadat and Dunya; it must feel respectful and grounded.

### Aesthetic Direction
**Editorial-restrained.** Minimalist with confident typography. Blue as signal, white as canvas. Light mode only this milestone.

- **Reference feel:** Linear (sidebar restraint), Stripe Dashboard (KPI hierarchy, editorial labels, tabular numbers), Arc Browser (quiet chrome), Vercel Dashboard (spacing discipline).
- **Anti-references:** generic Tailwind SaaS templates, gamified productivity apps, bootcamp purple-gradient marketing sites, "AI coding assistant" landing pages.
- **Colors:** ONLY `ima-*` tokens from `tailwind.config.ts`. No new hex. Avoid cyan/teal/purple/magenta/neon and ALL gradients (including blue-to-blue) across every surface. No gradient text anywhere. The `ima-pastel-*` / `ima-magenta` / `ima-teal` / `ima-violet` tokens still exist in the config but are no longer applied to any shipped page — treat them as deprecated.
- **Typography policy:** do NOT add a new font family. Personality comes from weight/tracking/size discipline, not display fonts.

### Surface Scope (one lane)
The app ships a **single editorial-restrained lane** across every role — `owner`, `coach`, `student`, `student_diy`, `(auth)`, and marketing. Blue is the only signal color. No pastel backgrounds, no `ima-magenta` / `ima-teal` / `ima-violet` accents, no `ima-pastel-*` surfaces.

- `student_diy/*` is 1:1 with `student/*` — same 32/36 masthead, same 44/52 hero metric, same card proportions, same spacing rhythm. The prior "amplified scale" treatment (4xl/6xl titles, 7xl/8xl hero metrics, filled-circle "stack of wins" stitch-blend motif) is retired. When a page exists in both lanes, mirror the `student/*` version exactly and only change the role guard, the `basePath`/`href` prefixes, and the data the page is allowed to load (e.g. `student_diy` has no `daily_reports` or outreach, so the outreach KPI strip on the dashboard is omitted rather than faked).
- Shared components (e.g. `RoadmapClient`, `WorkTrackerClient`, `DealsClient`, `ResourcesClient`, `AnnouncementsPage`, `AnalyticsClient`) stay editorial-restrained internally — no per-role overrides.
- The analytics table at `student_diy/analytics` continues to render identically to `student/analytics`.

### Type Scale (app UI)
- Hero metric: `text-6xl md:text-7xl font-semibold tabular-nums tracking-tight text-ima-primary` (exactly once per view)
- Section headers / labels: `text-sm font-semibold uppercase tracking-widest text-ima-text` or `text-xs uppercase tracking-[0.2em] font-medium text-ima-text-muted`
- KPI values: `text-3xl font-semibold tabular-nums tracking-tight` (first asymmetric card gets `text-4xl`)
- Body: `text-sm text-ima-text-secondary`
- Metadata: `text-xs text-ima-text-muted`

### Design Principles
1. **ONE focal point per view** — the hero metric is unmistakably the hero. No competing heroes.
2. **Typography over ornament** — hierarchy from size/weight/tracking, not effects.
3. **Blue is signal** — `ima-primary` marks what *matters*, not what looks nice. Reserve it for active nav, the single hero metric, primary CTAs, and focus rings.
4. **Motion is allowed** — decorative motion, parallax, scroll-driven reveals, spring physics, and expressive easing (including bounce) are all fair game. Keep `motion-safe:` wrappers on every `animate-*` class so users with reduced-motion preferences still get a calm experience. Still aim for motion that *serves* the content rather than distracting from it.
5. **Every border earns its place** — if it doesn't serve hierarchy, remove it. Shadows only on hover, never at rest.

### Brand Asset
The IMA Accelerator logo is a custom mark — a stylized **handshake icon** + **"IMA ACCELERATOR"** wordmark, uppercase, bold, wide tracking. It is **NOT a graduation cap**. Any prior `GraduationCap` reference is obsolete and must not return.

The source PNG is deep navy, but the mark ships in the app **rendered in `ima-primary` (#2563EB)**. We achieve this with CSS `mask-image` so the color always comes from the live token, never from the asset.

- **Asset:** `/public/ima-logo.png` (horizontal lockup: icon + wordmark, navy + alpha).
- **Render color:** `bg-ima-primary` behind a `mask-image: url(/ima-logo.png)`. Do NOT `<Image>` the PNG directly for app chrome — that locks in navy and loses token-level theming.
- **Render pattern:**
  ```tsx
  <span
    role="img"
    aria-label="IMA Accelerator"
    className="block bg-ima-primary"
    style={{
      width: 192, height: 40,
      WebkitMaskImage: "url(/ima-logo.png)", maskImage: "url(/ima-logo.png)",
      WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskPosition: "left center", maskPosition: "left center",
    }}
  />
  ```
- **Sizes:** Sidebar lockup ~40px tall. Login card ~50px. Root/landing ~60px. Width scales with mask aspect.
- **Sidebar:** wrap the mask span in a `Link` to `/${role}` so clicking returns home.
- **No `ACCELERATOR` subtitle treatment** — the wordmark already contains it.
- **The mark must never be:** placed on a blue or dark background (loses contrast), separated from the wordmark in the sidebar, stretched, rotated, or cropped. Tinting TO `ima-primary` is the required treatment — tinting to any other hue is not allowed.
- **Proxy matcher must exempt static image extensions** (`png|jpg|jpeg|gif|webp|svg|ico`) so `/ima-logo.png` is served publicly — otherwise the auth guard redirects the mask URL to `/login` and the logo renders blank.
- **Favicon:** out of scope this pass — leave as-is.

### Skill Overrides
When running `/impeccable`, `/bolder`, or any design skill: (a) keep the existing font stack — no new fonts; (b) do NOT migrate tokens to OKLCH — `ima-*` is the fixed palette; (c) do NOT reintroduce the deprecated pastel/magenta/teal/violet tokens — student_diy now shares the editorial-restrained lane; (d) respect the `absolute_bans` (no >1px border-left/right stripes, no gradient text, no multi-stop gradients, no glassmorphism); (e) bolder output comes from *committing to `ima-primary` as the single dominant signal color* and from weight/tracking/tabular-nums discipline — never from new hues, surface tints, reintroduced 7xl/8xl monumental metrics, or the retired filled-circle "stitch" motif; (f) never substitute the brand mark with an icon-font glyph (no `GraduationCap`, no Lucide placeholder) — always use `/ima-logo.png`.
