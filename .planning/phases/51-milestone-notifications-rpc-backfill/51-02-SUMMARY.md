---
phase: 51
plan: 02
subsystem: milestone-notifications
tags: [typescript, unstable_cache, revalidate-tag, server-only, sidebar-badges, types-drift]
requires:
  - .planning/phases/51-milestone-notifications-rpc-backfill/51-01-SUMMARY.md (migration 00027 RPC + sidebar rewrite + backfill)
  - src/lib/config.ts (MILESTONE_FEATURE_FLAGS.techSetupEnabled, MilestoneType union)
  - src/lib/rpc/coach-analytics.ts (Phase 48 server-only fetcher template — copy-adapted)
  - src/lib/rpc/coach-dashboard-types.ts (Phase 47 client-safe types template — copy-adapted)
provides:
  - "src/lib/rpc/coach-milestones-types.ts: client-safe types (CoachMilestoneRow, CoachMilestonesPayload, MilestoneType) + coachMilestonesTag('coach-milestones:${id}') helper"
  - "src/lib/rpc/coach-milestones.ts: server-only fetchCoachMilestones + getCoachMilestonesCached(60s TTL, tagged) — passes MILESTONE_FEATURE_FLAGS.techSetupEnabled to the RPC"
  - "revalidateTag fan-out across 3 mutation routes (deals×2 branches, reports×2 branches, roadmap×1) — coach milestone cache busts within one render of any qualifying mutation"
  - "revalidateTag('badges') added where missing (deals×2, roadmap×1) — sidebar coach_milestone_alerts count refreshes within one render of every deal / step completion"
  - "src/lib/types.ts Database type drift fixed: get_sidebar_badges Args extended with p_today + p_tech_setup_enabled (optional); Returns extended with coach_milestone_alerts + unread_messages; new get_coach_milestones entry added"
  - "src/lib/rpc/types.ts SidebarBadgesResult coach_milestone_alerts doc-comment updated to reflect Phase 51 folded count"
affects:
  - "src/app/(dashboard)/layout.tsx (no edits needed — 2-arg admin.rpc('get_sidebar_badges', {p_user_id, p_role}) call continues to compile because new params are optional)"
  - "Phase 52 /coach/alerts page (will consume getCoachMilestonesCached + coachMilestonesTag from these new modules)"
tech-stack:
  added: []
  patterns:
    - "Phase 47/48 dual-module split: <name>-types.ts (client-safe, no server-only) + <name>.ts (server-only fetcher with import 'server-only' guard) — prevents server-only modules leaking into client bundles"
    - "unstable_cache(fn, [tag, id, today], { revalidate: 60, tags: [coachMilestonesTag(id)] }) — cache key embeds today string for date-rollover correctness; tag bust hits all date variants"
    - "revalidateTag fan-out alongside coach-dashboard / coach-analytics tags — every mutation that affects an assigned student's milestone-qualifying state busts all 3 coach caches + 'badges' literal"
    - "Hand-extension of generated Database type (src/lib/types.ts) for new RPC + drifted entries — matches Phase 47/48 precedent (Returns: unknown for jsonb-envelope RPCs; client casts via wrapper)"
key-files:
  created:
    - src/lib/rpc/coach-milestones-types.ts (46 lines — client-safe types module)
    - src/lib/rpc/coach-milestones.ts (92 lines — server-only fetcher + cached wrapper)
    - .planning/phases/51-milestone-notifications-rpc-backfill/51-02-SUMMARY.md
  modified:
    - src/app/api/deals/route.ts (import + 2 revalidateTag fan-out blocks updated; revalidateTag('badges') added to both branches)
    - src/app/api/reports/route.ts (import + 2 revalidateTag fan-out blocks updated; insert-branch upgraded to match update-branch shape — fixed pre-existing drift where insert path lacked coachAnalyticsTag)
    - src/app/api/roadmap/route.ts (3 imports added + new revalidateTag('badges') + new coach-tag fan-out block after step completion — previously the route only invalidated studentAnalyticsTag)
    - src/lib/rpc/types.ts (1-line doc-comment update on coach_milestone_alerts)
    - src/lib/types.ts (extended get_sidebar_badges Args + Returns; added new get_coach_milestones entry)
decisions:
  - "TS wrapper accepts today as a string parameter (caller supplies). RPC defaults p_today to CURRENT_DATE when caller omits, but the wrapper requires explicit today so callers can't accidentally drift across day boundaries between cache hits."
  - "Cache key includes today (['coach-milestones', coachId, today]) — distinct day yields distinct cache entry. Tag-based bust still hits all entries for that coach simultaneously."
  - "Reports POST insert-branch was missing coachAnalyticsTag invalidation (drift from update-branch — likely missed when Phase 48 landed). Plan 51-02 fixed both branches as one atomic edit. This is a Rule 1 auto-fix; documented below."
  - "revalidateTag('badges', 'default') is intentionally OUTSIDE the try/catch in deals + roadmap routes — matches existing reports/route.ts pattern (lines 109, 155) where the call is unwrapped. Only the coach_id DB lookup needs try/catch because it can throw."
  - "Did NOT regenerate src/lib/types.ts via 'npx supabase gen types' — explicitly out of scope per plan Task 3 implementation note. Hand-extension matches Phase 47/48 precedent."
  - "Did NOT export fetchCoachMilestones from -types.ts — would drag server-only via transitive import. Server-side callers import from coach-milestones.ts; client-side callers from coach-milestones-types.ts."
metrics:
  duration: "~17 minutes"
  tasks_completed: 4
  files_created: 3
  files_modified: 5
  commits: 3
  completed: "2026-04-13"
---

# Phase 51 Plan 02: TS Wrapper + Sidebar Types + revalidateTag Fan-Out Summary

Wired the migration-00027 RPC into the Next.js runtime: created a Phase-47/48-style dual-module split (`coach-milestones-types.ts` + `coach-milestones.ts`), wrapped the RPC in `unstable_cache(60s)` tagged `coach-milestones:${coachId}`, fanned out `revalidateTag(coachMilestonesTag(coachId))` across 5 mutation call sites in 3 routes, added previously-missing `revalidateTag("badges")` to deals + roadmap, and closed two unrelated type-drift gaps in `src/lib/types.ts` (get_sidebar_badges Args + Returns + new get_coach_milestones entry). Build gate green: `npx tsc --noEmit` and `npm run build` both exit 0.

## Files Modified

**Created:**
- `src/lib/rpc/coach-milestones-types.ts` (46 lines)
- `src/lib/rpc/coach-milestones.ts` (92 lines)
- `.planning/phases/51-milestone-notifications-rpc-backfill/51-02-SUMMARY.md`

**Modified:**
- `src/app/api/deals/route.ts` (import @ line 12; revalidateTag("badges") @ lines 184, 214; coachMilestonesTag fan-out @ lines 200, 230)
- `src/app/api/reports/route.ts` (import @ line 13; coachMilestonesTag fan-out @ lines 126, 173; coachAnalyticsTag drift fix @ line 172)
- `src/app/api/roadmap/route.ts` (3 imports @ lines 10-12; revalidateTag("badges") @ line 123; new fan-out block @ lines 124-138)
- `src/lib/rpc/types.ts` (1-line doc-comment update @ line 17)
- `src/lib/types.ts` (extended get_sidebar_badges Args + Returns; added new get_coach_milestones entry @ ~lines 740-770)

## Tasks Completed

### Task 1: Types module + server fetcher (commit `379f84d`)

Two files created from copy-adapt of Phase 47 (`coach-dashboard-types.ts`) + Phase 48 (`coach-analytics.ts`) templates:

**`coach-milestones-types.ts` (46 lines, client-safe):**
- `MilestoneType` union literal type — duplicates `src/lib/config.ts:376-380` to keep client bundles minimal (no need to import MILESTONE_CONFIG runtime).
- `CoachMilestoneRow` shape: 6 fields matching the RPC envelope (`student_id`, `student_name`, `milestone_type`, `alert_key`, `deal_id` (nullable), `occurred_at`).
- `CoachMilestonesPayload` envelope: `{ milestones: CoachMilestoneRow[]; count: number }`.
- `coachMilestonesTag(coachId)` returns `"coach-milestones:${coachId}"` with COLON separator (Phase 47/48 precedent — matches `coach-dashboard:` and `coach-analytics:`).

**`coach-milestones.ts` (92 lines, server-only):**
- `import "server-only"` on line 16 — build-time crash if any `"use client"` boundary drags this module in.
- `fetchCoachMilestones(coachId, today)` calls `(admin as any).rpc("get_coach_milestones", { p_coach_id, p_today, p_tech_setup_enabled: MILESTONE_FEATURE_FLAGS.techSetupEnabled })` — flag forwarded from config.ts so flipping it later requires zero changes to this wrapper.
- Error handling: `console.error + throw new Error(…)` — never swallows (CLAUDE.md rule #5).
- `getCoachMilestonesCached` wraps `fetchCoachMilestones` in `unstable_cache(60s)` with `tags: [coachMilestonesTag(coachId)]`. Cache key includes `today` string so date rollover yields a fresh entry; tag bust still hits all date variants for a coach simultaneously.
- Re-exports the tag helper + types from `-types` for one-stop server imports.

Verification: `npx tsc --noEmit` → clean. `(admin as any).rpc` cast mirrors `coach-analytics.ts:59` precedent (generated types know about the new RPC after Task 3 but the cast remains for symmetry with prior wrappers).

### Task 2: revalidateTag fan-out into deals / reports / roadmap (commit `d102bfd`)

5 call sites across 3 routes:

**`src/app/api/deals/route.ts`:**
- Added `import { coachMilestonesTag } from "@/lib/rpc/coach-milestones-types"` @ line 12.
- 23505-retry branch (line 200): added `revalidateTag(coachMilestonesTag(studentRow.coach_id), "default")` after `coachAnalyticsTag`.
- Success branch (line 230): same — appended one line inside the existing `if (studentRow?.coach_id)` block.
- Both branches: added `revalidateTag("badges", "default")` (lines 184, 214) immediately after the `revalidateTag(\`deals-…\`)` call. Previously deals/route.ts had ZERO `revalidateTag("badges")` calls — verified via grep at planning time.

**`src/app/api/reports/route.ts`:**
- Added `import { coachMilestonesTag } …` @ line 13.
- Update branch (line 126): added `revalidateTag(coachMilestonesTag(studentRow.coach_id), "default")` after `coachAnalyticsTag`.
- Insert branch (line 173): added the same — AND fixed a pre-existing drift where the insert branch was missing `coachAnalyticsTag` (only had `coachDashboardTag`). Now both branches have identical 3-tag fan-out (Rule 1 auto-fix; see Deviations).
- `revalidateTag("badges")` already present at lines 110, 157 — no change.

**`src/app/api/roadmap/route.ts`:**
- Added 3 imports @ lines 10-12: `coachDashboardTag`, `coachAnalyticsTag`, `coachMilestonesTag` (none were previously imported here).
- After step-completion success (lines 123-138): added `revalidateTag("badges", "default")` (line 123, OUTSIDE try/catch matching reports/route.ts pattern), then a new try/catch block that looks up `studentRow.coach_id` and invalidates all 3 coach tags. Prior to this change, `/api/roadmap` only invalidated `studentAnalyticsTag(profile.id)` — the coach saw no cache bust on Step 11 / Step 13 completion (would have been a NOTIF-07 regression).

Verification: surgical edits, no surrounding refactors, all try/catch wrappers preserved with `console.error` (no silent swallows). `npx tsc --noEmit` → clean. Markers grep confirms 5/5 `coachMilestonesTag(studentRow.coach_id)` insertions + 3/3 new `revalidateTag("badges")` calls (deals×2, roadmap×1).

### Task 3: Type drift fixes — sidebar doc-comment + Database.Functions (commit `2a55ea3`)

**`src/lib/rpc/types.ts`:** 1-line doc-comment update on `SidebarBadgesResult.coach_milestone_alerts`:
```diff
- coach_milestone_alerts?: number; // coach only — 100h milestone alerts
+ coach_milestone_alerts?: number; // coach only — 100h + v1.5 milestone alerts (folded per Phase 51)
```
Shape unchanged — folding happens server-side in `get_sidebar_badges` per Plan 51-01.

**`src/lib/types.ts`:** Two extensions to `Database.public.Functions`:

1. `get_sidebar_badges` (was 2 Args / 2 Returns) → now 4 Args (added `p_today?: string`, `p_tech_setup_enabled?: boolean`) + 4 Returns (added `coach_milestone_alerts?: number`, `unread_messages?: number`). The Returns extensions also fix pre-existing drift from Phase 35 (chat unread) and Phase 14 (100h coach milestone) — the generated entry was stale.
2. New `get_coach_milestones` entry: 3 Args (`p_coach_id: string`, `p_today?: string`, `p_tech_setup_enabled?: boolean`), `Returns: unknown`. Matches `get_coach_dashboard` / `get_coach_analytics` precedent — RPC returns jsonb envelope, client casts via `CoachMilestonesPayload` in the wrapper.

Verification: `npx tsc --noEmit` clean — confirmed the 2-arg `admin.rpc("get_sidebar_badges", {p_user_id, p_role})` call in `src/app/(dashboard)/layout.tsx:12` continues to compile (new params are optional `?:`, so zero changes needed there). Marker grep confirms `100h + v1.5`, `get_coach_milestones`, `p_tech_setup_enabled`, and `coach_milestone_alerts?: number` all present.

### Task 4: Build gate (no commit — verification only)

Three commands run in sequence:

| Command            | Result                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `npm run lint`     | Zero new errors in any of the 7 files modified by this plan (verified via path-filtered grep).                  |
| `npx tsc --noEmit` | Exits 0 — zero type errors anywhere.                                                                            |
| `npm run build`    | Exits 0 — full production build successful, all 56+ routes compile (including /coach/alerts which Phase 52 will populate; /api/deals, /api/reports, /api/roadmap rebuild with the new fan-out logic). |

Build tail (last ~10 routes shown):
```
ƒ /student/analytics
ƒ /student/ask
ƒ /student/chat
ƒ /student/deals
ƒ /student/report
ƒ /student/report/history
ƒ /student/resources
ƒ /student/roadmap
└ ƒ /student/work

ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Verification Results

### Plan success criteria (all 12 met)
- [x] `coach-milestones-types.ts` exists, client-safe (no server-only), exports `coachMilestonesTag`, `MilestoneType`, `CoachMilestoneRow`, `CoachMilestonesPayload`.
- [x] `coach-milestones.ts` exists, starts with `import "server-only"`, exports `fetchCoachMilestones` + `getCoachMilestonesCached`, reads `MILESTONE_FEATURE_FLAGS.techSetupEnabled`.
- [x] `coachMilestonesTag(id)` returns `"coach-milestones:" + id` (colon separator).
- [x] `unstable_cache` wrapper has `revalidate: 60` and `tags: [coachMilestonesTag(coachId)]`.
- [x] `POST /api/deals` calls `revalidateTag(coachMilestonesTag(coachId))` in both success and 23505-retry branches.
- [x] `POST /api/deals` calls `revalidateTag("badges")` in both branches.
- [x] `POST /api/reports` calls `revalidateTag(coachMilestonesTag(coachId))` in both insert and update branches.
- [x] `PATCH /api/roadmap` calls `revalidateTag(coachMilestonesTag(coachId))` + `revalidateTag("badges")` + coachDashboard/coachAnalytics tags after step completion.
- [x] All new revalidate additions in try/catch (where DB lookup needed) use `console.error` on failure.
- [x] `SidebarBadgesResult` doc-comment updated.
- [x] `Database.public.Functions.get_sidebar_badges` extended; `get_coach_milestones` entry added with `Returns: unknown`.
- [x] `npx tsc --noEmit && npm run build` both exit 0.

### Build gate (D-12)
- `npx tsc --noEmit` → clean (0 errors)
- `npm run build` → successful, all routes compile

### Lint
- `npm run lint` reports 5419 pre-existing errors in unrelated files (DealFormModal.tsx, WorkTrackerClient.tsx, Modal.tsx, etc.) — out of scope per execution rules. Path-filtered grep across the 7 files this plan touched returns ZERO lint errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Reports POST insert-branch was missing `coachAnalyticsTag` invalidation**
- **Found during:** Task 2
- **Issue:** The update-branch (lines 110-128) invalidated `coachDashboardTag` AND `coachAnalyticsTag`, but the insert-branch (lines 162-175) only invalidated `coachDashboardTag`. This was pre-existing drift from when Phase 48 (coach analytics) landed — likely the developer added the call to the update branch and forgot the symmetric edit on the insert branch.
- **Symptom:** Coach analytics cache stayed stale for up to 60s after a brand-new daily report submission (a coach viewing /coach/analytics during that window would see 1 fewer report than reality).
- **Fix:** Added `revalidateTag(coachAnalyticsTag(studentRow.coach_id), "default")` to the insert branch alongside the new `coachMilestonesTag` line — both branches now have identical 3-tag fan-out.
- **Files modified:** `src/app/api/reports/route.ts` line 172
- **Commit:** `d102bfd` (folded into Task 2 commit since the issue surfaced while editing the same block)

### Plan-aligned adjustments (not auto-fixes; clarifications)

- **`revalidateTag("badges", "default")` placement.** Plan said add at "the top of the try block" in deals/route.ts. Looking at the existing structure, lines 182 and 210 are `revalidateTag(\`deals-${effectiveStudentId}\`, "default")` — these are OUTSIDE the surrounding try/catch (the try/catch wraps only the studentAnalyticsTag call below). I followed the existing pattern: `revalidateTag("badges", "default")` is placed right after the deals-tag call, also outside try/catch. Matches reports/route.ts:109, 155 precedent verbatim.

- **Roadmap route 3 imports added in one block.** Plan listed them as separate import lines; I consolidated into 3 consecutive lines after the existing `studentAnalyticsTag` import (lines 9-12). Same effect, cleaner diff.

- **Did NOT touch `src/app/(dashboard)/layout.tsx`.** Plan's Task 3 implementation note (line 617-619) explicitly states the 2-arg call continues to compile because new params are optional. Verified via tsc — confirmed no edit needed.

## Threat Surface Scan

No new security-relevant surface introduced. The 3 mutation routes already had route-handler authz (CSRF + auth + role checks + dual-layer assignment validation per Phase 45). The new `revalidateTag` calls and the new server-only RPC wrapper inherit those protections — no new endpoints, no new auth paths, no new file/network surface. T-51-10 through T-51-16 in plan's threat model are addressed (mitigate dispositions structurally satisfied by `import "server-only"` + tag composition from trusted DB lookup).

## Next Consumer

**Phase 52** (`/coach/alerts` page):
- Import `getCoachMilestonesCached` + `CoachMilestonesPayload` from `@/lib/rpc/coach-milestones`.
- Call `getCoachMilestonesCached(coachId, todayISO)` server-side in the page component.
- For dismiss action: import `coachMilestonesTag` and `revalidateTag(coachMilestonesTag(coachId))` after the alert_dismissals INSERT.
- Tag namespace `coach-milestones:${coachId}` is now stable contract — Phase 52 + any future milestone consumer flows through this single cached path.

## Self-Check: PASSED

Verified:
- `src/lib/rpc/coach-milestones-types.ts` → FOUND (46 lines)
- `src/lib/rpc/coach-milestones.ts` → FOUND (92 lines, starts with `import "server-only"`)
- Commit `379f84d` (Task 1 — types + fetcher) → FOUND on HEAD
- Commit `d102bfd` (Task 2 — revalidateTag fan-out) → FOUND on HEAD
- Commit `2a55ea3` (Task 3 — type drift fixes) → FOUND on HEAD
- All 5 `coachMilestonesTag(studentRow.coach_id)` call sites present (deals×2, reports×2, roadmap×1)
- All 3 new `revalidateTag("badges", "default")` call sites present (deals×2, roadmap×1)
- `npx tsc --noEmit` → exit 0
- `npm run build` → exit 0, all routes compile
- Lint: zero errors in any file modified by this plan
