# Stack Research — v1.8 Analytics Expansion, Notification Pruning & DIY Parity

**Domain:** Subsequent milestone on existing Next.js 16 + Supabase app
**Researched:** 2026-04-16
**Confidence:** HIGH

## Executive Verdict

**No new runtime dependencies are required for v1.8.**

Every feature block in the v1.8 brief is buildable with what is already in `package.json`. The three specific stack questions asked in the brief all resolve against existing primitives:

1. Window-selector accessibility (`<fieldset><legend>` / `role="radiogroup"`) — these are **native HTML/ARIA patterns**, not library features. Recharts is not involved; the selector sits *above* the leaderboard cards (which are not charts — they are plain `<ul>` lists). The project already uses `role="radiogroup"` in `StarRating.tsx` and `role="tablist"` in `ResourcesClient.tsx`, `CoachAlertsClient.tsx`, `StudentDetailTabs.tsx` — proven precedents to copy.
2. Segmented-control / toggle-group primitive — **does not exist** in `src/components/ui/`. One must be added, but as a small local component (~40-50 LOC, zero deps), not a library. See "New Internal Component" below.
3. Supabase CLI / migration tooling — **no change needed**. The breaking RPC change in Feature 1 is a normal `CREATE OR REPLACE FUNCTION` in migration `00033` (NOT `00032` — see migration-number flag below). The existing `supabase` CLI v2.78.1 in devDependencies handles it. Coordinated cache-key bump + consumer update in the same migration/deploy avoids the breaking-change blast radius.

## Recommended Stack

### Core Technologies (UNCHANGED from v1.7)

| Technology | Version | Purpose | Why Keep |
|------------|---------|---------|----------|
| next | 16.1.6 | App Router, proxy.ts, server components, `unstable_cache`, `revalidateTag` | All v1.8 features reuse Phase 54's `unstable_cache` + `ownerAnalyticsTag()` pattern |
| react / react-dom | 19.2.3 | Server Components, client `useState` for selector | No change in rendering model for v1.8 |
| typescript | ^5 (strict) | Type safety | Breaking RPC change enforced at compile time once `src/lib/rpc/student-analytics-types.ts` is updated |
| @supabase/ssr | ^0.9.0 | Server-side Supabase client | Used by `getSessionUser()` + admin client helpers |
| @supabase/supabase-js | ^2.99.2 | Postgres + RLS + RPC calls | RPC `get_student_analytics`, `get_owner_analytics` invoked via this client |
| tailwindcss + @tailwindcss/postcss | ^4 | Utility-first styling with ima-\* tokens | Segmented-control styled inline with tokens — no variant plugin required |
| class-variance-authority | ^0.7.1 | CVA variant primitives | Optional for the new segmented control; project convention is CVA for ≥2 variant axes |
| clsx + tailwind-merge | ^2.1.1 / ^3.5.0 | Conditional class names via `cn()` helper | Already used by every UI primitive |
| zod | ^4.3.6 | API input validation (safeParse) | No new endpoints in v1.8 need this; existing `/api/alerts/dismiss` + deal mutation routes already covered |
| lucide-react | ^0.576.0 | Icons (BarChart3, Bell, TrendingUp, etc.) | Covers coach-leaderboard / alert-feed icon needs |
| recharts | ^3.8.1 | Existing student + coach analytics charts | **Not used** by v1.8 leaderboards (which are plain `<ul>` lists in `LeaderboardCard.tsx`). Kept for prior phases only. |
| date-fns | ^4.1.0 | Date math (already imported for calendar/skip tracker) | Window boundary math is server-side (Postgres `CURRENT_DATE - INTERVAL '7 days'`); zero client use expected |
| motion | ^12.37.0 | Micro-animations | Optional for selector state transitions; not required |
| react-hook-form | ^7.71.2 | Form state | Not used in v1.8 (no new forms) |
| react-day-picker | ^9.14.0 | Calendar | Touched by F6 (DIY calendar hours-only rendering), no version bump |
| server-only | ^0.0.1 | Poisons client imports of server-only modules | Critical: new/extended `owner-analytics.ts` wrapper stays behind this |

### Development Tools (UNCHANGED)

| Tool | Version | Notes for v1.8 |
|------|---------|---------------|
| supabase (CLI) | ^2.78.1 | Handles migration for the breaking RPC. CLI v2.90.0 is available upstream but **do not upgrade mid-milestone** — no bug-fix or feature v1.8 needs. Defer upgrade to a dedicated chore. |
| eslint + eslint-config-next | ^9 / 16.1.6 | Enforces Hard Rules baseline |
| typescript | ^5 | Strict mode regenerates `jsonb` response shapes at consumer edit time |

## Installation

```bash
# NO INSTALL REQUIRED FOR v1.8.
# Stock verification only:
npm ci
npm run lint && npx tsc --noEmit && npm run build
```

## Specific Questions Answered

### Q1: Does recharts support `<fieldset><legend>` or `role="radiogroup"` for window selectors?

**Question is based on a false premise.** The v1.8 window selector is not a recharts feature — it is a standalone set of four buttons (Weekly / Monthly / Yearly / All Time) rendered *adjacent to* each `LeaderboardCard`. Leaderboards in `src/components/analytics/LeaderboardCard.tsx` are plain `<ul>` lists (verified lines 77-109), not charts. Recharts is not on this code path.

`<fieldset><legend>` and `role="radiogroup"` are native HTML and WAI-ARIA 1.2 primitives supported by every browser and every screen reader. They work anywhere.

**Both patterns are already live in this codebase:**

| Pattern | File | Line | Use |
|---------|------|------|-----|
| `role="radiogroup"` + `role="radio"` + `aria-checked` | `src/components/student/StarRating.tsx` | 32-50 | Star rating input, arrow-key navigation, `min-h-[44px] min-w-[44px]` |
| `<fieldset>` | `src/components/student/ReportForm.tsx` | 119 | Grouped form inputs |
| `role="tablist"` + `role="tab"` + `aria-selected` | `src/components/resources/ResourcesClient.tsx` L157-173, `src/components/coach/CoachAlertsClient.tsx` L242-262, `src/components/coach/StudentDetailTabs.tsx` L19-45 | 3 existing tab UIs |

**Recommendation for F3 window selector:** Follow the `role="radiogroup"` + `role="radio"` + `aria-checked` precedent from `StarRating.tsx`. It is the correct ARIA pattern for "choose exactly one of N" controls where the change does not navigate away (`tablist` implies a visible tab **panel swap**; `radiogroup` implies a single-value selection — 4-way Weekly/Monthly/Yearly/All Time is semantically a single-value radio pick). This maps cleanly to the keyboard UX users expect on radio groups (ArrowLeft/ArrowRight/Home/End).

Alternative acceptable pattern: `<fieldset><legend className="sr-only">Time window</legend>...</fieldset>`, which satisfies the brief verbatim. Either passes WAI-ARIA 1.2; `role="radiogroup"` is preferred for internal consistency with `StarRating.tsx`.

**Confidence: HIGH** — verified against existing project code (exact line numbers above) and [WAI-ARIA Authoring Practices for Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).

### Q2: Does any existing UI primitive provide a segmented-control / toggle-group?

**No.** Current `src/components/ui/` exports (from `index.ts`, lines 1-10):

```
Button, buttonVariants, Badge, Modal, Spinner, ToastProvider, useToast,
Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
Input, Textarea, Skeleton, SkeletonCard, EmptyState
```

Plus `PaginationControls.tsx` (not re-exported from index) — a single-purpose pagination component, not a general segmented control.

Grep confirms three bespoke tab-strip implementations (`ResourcesClient.tsx`, `CoachAlertsClient.tsx`, `StudentDetailTabs.tsx`) — each hand-rolled with `role="tablist"` and inline Tailwind. None are reusable; none were promoted to `src/components/ui/`. Pattern consistency in this repo: UI primitives are hand-rolled with CVA+Tailwind and `ima-*` tokens, never pulled from Radix/Headless UI/shadcn.

**Recommendation:** Add a **new internal primitive** — NOT a library. Six independent selectors rendered on the same owner analytics page is a clear case for a shared component.

```
src/components/ui/SegmentedControl.tsx   (~50 LOC)
```

API sketch (design-only — implementation belongs in phase planning):

```tsx
type WindowKey = "7d" | "30d" | "365d" | "all";

interface SegmentedControlProps<T extends string> {
  name: string;                          // unique group id (used for aria-labelledby)
  label: string;                         // sr-only legend text
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}
```

Internally uses `role="radiogroup"` + `role="radio"` + `aria-checked`, mirrors `StarRating.tsx`'s keyboard handling (ArrowLeft/Right + Home/End), enforces `min-h-[44px]` on every button, styles active state with `bg-ima-primary text-white` and inactive with `bg-ima-surface border-ima-border text-ima-text` (same tokens as `CoachAlertsClient.tsx` filter tabs L251-254). Promote to `ui/index.ts` so all 6 leaderboards render it identically.

**Do NOT pull a library** for this. Options that *could* be added and are being rejected:

| Library | Size | Why rejected |
|---------|------|-------------|
| `@radix-ui/react-radio-group` | ~12 KB gz | Unnecessary — same native behavior buildable in <50 LOC. Would be the first Radix primitive in the project; creates style-system drift (Radix expects unstyled-then-compose pattern; we use CVA+Tailwind inline). |
| `@radix-ui/react-toggle-group` | ~9 KB gz | Same objection — library-scale answer to a component-scale problem. |
| `react-aria` / `react-aria-components` | Large | Adobe's accessibility toolkit — overkill for a 4-button selector. |
| `shadcn/ui` segmented control | copy-paste (zero runtime) | Viable but introduces Radix under the hood; adopt only as part of a broader shadcn migration, not ad hoc. |

**Decision:** Build locally. 4-way radio group with Tailwind + ima-\* tokens. Zero new deps. Matches project convention (StarRating, PaginationControls, every tab-strip are all similarly hand-rolled with CVA-or-cn patterns).

**Confidence: HIGH** — verified by listing `src/components/ui/` directory, reading `index.ts`, and grepping the repo for `ToggleGroup`/`Segment`/`role="radiogroup"` (zero matches for the former two; one match in `StarRating.tsx` for the latter).

### Q3: Any Supabase CLI / migration tooling changes for the breaking RPC change in Feature 1?

**No tooling changes required.**

The breaking change in F1 replaces `public.get_student_analytics(uuid, text, int, int) RETURNS jsonb`. Current signature shipped in migration `00023_get_student_analytics.sql` (confirmed lines 29-33). Old jsonb keys: `total_emails`, `total_influencers` (lines 98-109). New keys per brief: `total_brand_outreach = SUM(brands_contacted)`, `total_influencer_outreach = SUM(influencers_contacted)`. Signature (arg types + return type) is unchanged — only the jsonb shape changes — so:

- **No `DROP FUNCTION` required.** `CREATE OR REPLACE FUNCTION` with identical signature is legal and preserves grants (`GRANT EXECUTE ... TO authenticated, service_role` at line 261-262).
- **No CLI/SDK upgrade needed.** `supabase@^2.78.1` in devDependencies already handles `db push` / `migration new` / `db reset`.
- **No `types.ts` regen tooling change.** The project's `types.ts` is hand-crafted per CLAUDE.md's known-pending list; RPC return jsonb typing lives in `src/lib/rpc/student-analytics-types.ts` (existing), which gets edited in the same phase.

**What DOES need coordination in the same phase (captured in PITFALLS.md, not here):**

1. **Cache key bump.** The `unstable_cache` tag/key for `/student/analytics` must change (e.g., `student-analytics-v2:<id>`) so stale Next.js caches do not feed old-shape jsonb into new-shape consumers, which would throw at render time. The brief already flags this explicitly as a per-milestone constraint.
2. **Consumer update in same commit.** `AnalyticsClient.tsx` + `student-analytics-types.ts` + `/student_diy/analytics/page.tsx` + any admin-tooling consumers must move in lock-step with the migration. Migration-and-code-in-separate-PRs is the #1 way breaking RPCs take down SSR.
3. **MIGRATION NUMBER FLAG (IMPORTANT).** Disk shows `supabase/migrations/00032_drop_get_sidebar_badges_legacy_4arg.sql` already exists on `master` (from v1.7 hotfix commit `0583d09`). MEMORY.md recorded "next migration 00032" at v1.7 close, but the hotfix consumed it. **v1.8 migrations must start at `00033`.** The PROJECT.md line `Migration numbering: 00032 (continues after v1.7's 00031)` is stale — roadmap/phase planning should correct to **`00033`** before the first v1.8 commit.
4. **Atomicity.** Use a single migration file — not `ALTER FUNCTION` across multiple statements — so the RPC either has the new shape or the old shape at any moment. `CREATE OR REPLACE FUNCTION` is a single atomic DDL at statement level.

**Confidence: HIGH** for "no tooling change." **HIGH** for "migration numbering flag" — verified by `ls supabase/migrations/` listing `00032_drop_get_sidebar_badges_legacy_4arg.sql` alongside `00031_referral_links.sql`.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@radix-ui/react-radio-group` | First Radix primitive = style-system drift; 12 KB for a 50-LOC component | Hand-rolled `SegmentedControl` with `role="radiogroup"` |
| `@radix-ui/react-toggle-group` | Same objection | Hand-rolled `SegmentedControl` |
| `react-aria-components` | Overkill for a 4-button selector | Native ARIA primitives |
| Any new chart library | v1.8 has zero new charts; leaderboards are lists | Existing recharts@^3.8.1 (untouched) |
| URL-backed window state (router.push / searchParams) | Brief explicitly says "pure client state, no re-fetch" | `useState<WindowKey>("all")` per card |
| `ALTER FUNCTION` for RPC replacement | Not the idiomatic tool for changing return-shape semantics; multi-statement non-atomic | `CREATE OR REPLACE FUNCTION` in single migration |
| Upgrading supabase CLI to 2.90.0 mid-milestone | Introduces unrelated risk | Stay on 2.78.1; upgrade in a dedicated chore post-v1.8 |
| Client-side trailing-window math | Server-side Postgres `CURRENT_DATE - INTERVAL '7 days'` is cheaper and cacheable | Postgres RPC computes all 24 slots in one call (per F3 brief) |
| Migration `00032` as v1.8's first migration | Already exists on disk | Start at `00033` |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled `SegmentedControl` (zero deps) | Radix `ToggleGroup` | Only if the project commits to a broader Radix/shadcn migration — do not start ad hoc |
| `role="radiogroup"` | `role="tablist"` | If the window selector swapped **visible panels** (e.g., separate layout per window). It doesn't — it swaps one metric number — so `radiogroup` is semantically correct |
| `CREATE OR REPLACE FUNCTION` | `DROP FUNCTION ...; CREATE FUNCTION ...` | Only if arg types change. v1.8 F1 keeps arg types; replace-in-place is simpler |
| `unstable_cache` tag bump (e.g., `student-analytics-v2:<id>`) | Wipe Next.js cache at deploy | Tag bump is targeted; cache wipe is blunt. Tag bump wins |
| Keep recharts@^3.8.1 untouched | Upgrade to latest | v1.8 adds no new charts — no upgrade signal |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| recharts@^3.8.1 | react@19.2.3 | Still valid (same stack as v1.5 D-11 decision). `"overrides": { "react-is": "19.2.3" }` is NOT currently in package.json — verified by reading package.json. No sign of `react-is` warnings in v1.5-1.7 builds per commit history; leave alone unless build surfaces one |
| @supabase/supabase-js@^2.99.2 | @supabase/ssr@^0.9.0 | Unchanged; RPC calls go through admin client |
| next@16.1.6 | proxy.ts | `unstable_cache` + `revalidateTag` supported; cache invalidation wiring in Phase 54 extends cleanly to F2/F3 |
| supabase CLI 2.78.1 | Postgres 17 (per supabase/config.toml `major_version = 17`) | Migration `00033` for v1.8 F1 runs locally and in cloud |
| typescript@^5 strict | jsonb response changes | Breaking RPC change caught at compile time via `src/lib/rpc/student-analytics-types.ts` edit |

## Integration Points

| v1.8 Feature | Existing code path reused | What NEW touches |
|--------------|---------------------------|------------------|
| F1 Student Analytics relabel + re-split | `get_student_analytics` RPC (00023), `AnalyticsClient.tsx`, `student-analytics-types.ts`, unstable_cache wrapper | Migration **00033**, rename jsonb keys, **cache-key bump** |
| F2 Coach performance leaderboards | `LeaderboardCard.tsx` (Phase 54), `get_owner_analytics` RPC (00028), `ownerAnalyticsTag()` | Extend RPC jsonb to include 3 coach leaderboards; no UI primitive change — `LeaderboardCard` already takes arbitrary `rank/name/metric_display` rows (verified lines 19-24, 48-114), just swap `hrefPrefix` or pass a coach-scoped prefix / leave unlinked |
| F3 Per-leaderboard window selector | `LeaderboardCard.tsx`, `get_owner_analytics` RPC, existing Next.js `unstable_cache` (60s) | **NEW** `SegmentedControl` primitive in `src/components/ui/`, RPC pre-computes 24 slots in one jsonb, client-side `useState` per card |
| F4 Owner alerts prune to `deal_closed` | `alert_dismissals` table, `/api/alerts/dismiss`, `OwnerAlertsClient.tsx` | SQL logic change only — remove 4 alert types, emit 1-per-deal. Reuse dismiss route verbatim |
| F5 Coach alerts `tech_setup` activation | `MILESTONE_CONFIG`, `MILESTONE_META`, `MILESTONE_FEATURE_FLAGS` in `src/lib/config.ts` | Config constants only. Internal key `tech_setup` preserved → zero RPC/dismissal-key churn |
| F6 DIY owner detail page | `/owner/students/[studentId]`, `OwnerStudentDetailClient.tsx`, calendar component, student list page | `.in("role", ["student","student_diy"])` query change, conditional Reports tab hide, calendar `renderMode` prop if needed, "DIY" badge on list |

## Stack Patterns by Variant

**If selector is a window filter (F3):**
- Use `role="radiogroup"` + `role="radio"` + `aria-checked` per-button
- Because the UI commits to a single value and arrow-key navigation is the standard expectation

**If selector swapped view layouts (hypothetical future "Daily / Weekly / Monthly chart mode"):**
- Use `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls`
- Because visible panel swap is the `tablist` trigger

**If F3 later grows beyond 4 options or needs URL persistence:**
- Revisit — switch to searchParams-backed state
- Not a v1.8 concern per brief ("independent client-side toggles ... no re-fetch")

## Sources

- Own repo — `package.json`, `src/components/ui/` listing, `supabase/migrations/` listing (HIGH confidence — direct file reads)
- `src/components/student/StarRating.tsx` lines 32-50 — confirmed `role="radiogroup"` precedent (HIGH)
- `src/components/resources/ResourcesClient.tsx` L157-173, `src/components/coach/CoachAlertsClient.tsx` L242-262, `src/components/coach/StudentDetailTabs.tsx` L19-45 — confirmed `role="tablist"` precedent (HIGH)
- `src/components/analytics/LeaderboardCard.tsx` L19-114 — confirmed leaderboards are `<ul>` lists, not charts (HIGH)
- `src/app/(dashboard)/owner/analytics/page.tsx` L30-127 — confirmed Phase 54 server-component pattern + 3-slot leaderboard layout (HIGH)
- `supabase/migrations/00023_get_student_analytics.sql` — confirmed current RPC shape, signature, grants (HIGH)
- `supabase/migrations/` directory listing — confirmed `00032_drop_get_sidebar_badges_legacy_4arg.sql` already exists; next migration is `00033` (HIGH)
- `supabase/config.toml` L36 — confirmed `major_version = 17` (HIGH)
- `.planning/PROJECT.md` — v1.5 D-11 recharts decision, v1.8 active scope, migration numbering note (HIGH)
- CLAUDE.md Hard Rules — drove `min-h-[44px]`, `motion-safe:`, `ima-*` token, `zod` import constraints (HIGH)
- [W3C WAI-ARIA Authoring Practices — Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) — referenced for ARIA semantics (HIGH, training-data; pattern is stable since ARIA 1.0)
- Supabase CLI `supabase --version` — confirmed 2.78.1 installed, 2.90.0 available upstream (HIGH)

---
*Stack research for: IMA Accelerator V1 — v1.8 Analytics Expansion milestone*
*Researched: 2026-04-16*
*Overall verdict: No new runtime dependencies. One new internal UI primitive (`SegmentedControl`). Migration number conflict flagged — v1.8 first migration is `00033`, not `00032`.*
