# Phase 52: Coach Alerts Page — Research

**Researched:** 2026-04-14
**Domain:** Next.js 16 App Router (Server Component + Client Component), React 19, Supabase RPC, CVA primitives, optimistic UI, revalidateTag
**Confidence:** HIGH — all claims verified against in-repo code; no external libraries introduced

## Summary

Phase 52 is a pure UI phase that consumes the `get_coach_milestones` RPC and `POST /api/alerts/dismiss` endpoint shipped in Phase 51. The RPC, cache wrapper, dismiss endpoint, and revalidation wiring are **already complete** — this phase's job is to replace the legacy `alerts/page.tsx` (which only handled `100h_milestone`) with a new multi-type, grouped-by-student feed, and to add "9+" capping to the sidebar badge.

The existing `CoachAlertsClient.tsx` and `alerts/page.tsx` are the starting point — they already implement filter tabs, optimistic dismiss, the exact API call shape, and the CVA component usage. Phase 52 rewrites both files: `page.tsx` switches from ad-hoc Supabase queries to `getCoachMilestonesCached`, and `CoachAlertsClient.tsx` gains group-by-student rendering, Bulk Dismiss, multi-type icons/badges, and the extended `CoachAlertItem` type. `loading.tsx` already matches the UI-SPEC and requires only minor review. The sidebar badge cap (`9+`) is a one-line change in `Sidebar.tsx` — the raw number is already passed via `badgeCounts`; Phase 52 adds the capping render logic.

The dismiss API route (`POST /api/alerts/dismiss`) currently only calls `revalidateTag("badges", "default")`, which busts the sidebar but NOT the `getCoachMilestonesCached` result. Phase 52 must also call `revalidateTag(coachMilestonesTag(coachId))` in that route so the page feed re-fetches on next navigation after a dismiss. This is the most important gap to close.

**Primary recommendation:** Two-file rewrite (page.tsx + CoachAlertsClient.tsx) + one-line patch to dismiss/route.ts + one-line patch to Sidebar.tsx. No new dependencies, no new API routes, no schema changes.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Route: `/coach/alerts` (under existing `(dashboard)` segment).
- Data source: Phase 51's `getCoachMilestonesCached(coachId)` from `src/lib/rpc/coach-milestones.ts`.
- Cache tag: revalidate `coach-milestones:${coachId}` after dismiss mutations.
- Dismissal target: existing `alert_dismissals` table (per D-08 — no new table).
- Sidebar badge cap: render "9+" when count >= 10 (capped, not raw number).
- Grouping: by student name; one Bulk Dismiss action per student group.
- Optimistic UI: row removed immediately on dismiss click.

### Claude's Discretion

- Visual layout details (card vs list rows, spacing, icon placement) — at Claude's discretion within ima-* design tokens.
- Whether to add a new API route or reuse the existing `POST /api/alerts/dismiss` — reuse it (already handles all alert types by alert_key).
- Whether to use Server Component for the page shell + Client Component for interactivity, or fully Client Component — use Server + Client pattern (matches existing coach page convention; aligns with `page.tsx` -> `CoachAlertsClient` structure already in place).

### Deferred Ideas (OUT OF SCOPE)

None — this phase is scope-bounded.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-09 | New `/coach/alerts` page shows grouped-by-student feed with dismiss and bulk-dismiss actions; sidebar badge caps at "9+" | RPC `get_coach_milestones` returns `CoachMilestonesPayload { milestones: CoachMilestoneRow[], count: number }`. Group rows client-side by `student_id`. Sidebar cap: `badgeCounts["coach_milestone_alerts"] >= 10` renders "9+" in `Sidebar.tsx`. Bulk dismiss: `Promise.all` of `POST /api/alerts/dismiss` per group. |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

| Rule | Application to Phase 52 |
|------|-------------------------|
| **Config is truth** | Import `MILESTONES`, `MILESTONE_CONFIG`, `MilestoneType` from `src/lib/config.ts` for milestone type labels and icon mapping. Never hardcode milestone type strings. |
| **Admin client only in API routes** | `page.tsx` calls `getCoachMilestonesCached` (server-only wrapper) — no direct `.from()` calls in the page. The existing dismiss route already uses `createAdminClient()`. |
| **Proxy not middleware** | No route guard changes needed — `requireRole("coach")` in `page.tsx` handles auth. |
| **motion-safe:** | Every `animate-*` / `transition-*` class must use `motion-safe:`. Filter tab `motion-safe:transition-colors` already in existing code — maintain it. |
| **44px touch targets** | Every `<button>`, `<a>`, `<Link>` needs `min-h-[44px]`. Dismiss Alert `Button size="sm"` has `min-h-[44px]` via CVA. Filter tabs are plain `<button>` with explicit `min-h-[44px]`. View Student link needs `inline-flex items-center min-h-[44px]`. |
| **Accessible labels** | No text inputs on this page. `role="alert"` on card content div. `aria-label` on View Student link. `aria-pressed` on filter tabs. `aria-hidden="true"` on all Lucide icons. |
| **Never swallow errors** | All catch blocks must `console.error` + toast. Dismiss error must revert optimistic state. |
| **check response.ok** | `fetch("/api/alerts/dismiss")` must check `res.ok` before parsing JSON (already in existing `CoachAlertsClient`). |
| **Zod import** | `import { z } from "zod"` — not applicable (no new API routes). |
| **ima-* tokens only** | `border-l-ima-success`, `bg-ima-success/10`, `text-ima-success`, `bg-ima-primary`, `text-ima-primary`. No hardcoded hex. |

---

## Standard Stack

### Core (no changes to package.json — everything already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 [VERIFIED: package.json:20] | App Router, Server Components, `unstable_cache`, `revalidateTag` | Project framework; `page.tsx` is an async Server Component fetching via `getCoachMilestonesCached`. |
| React | 19.x [VERIFIED: package.json] | Client Component interactivity (`"use client"`) | `CoachAlertsClient` needs `useState`, `useCallback`, `useRef`, `useEffect`. |
| `@supabase/supabase-js` | ^2.99.2 [VERIFIED: package.json:13] | RPC already called via `coach-milestones.ts` wrapper | No direct supabase calls in Phase 52 — RPC wrapper handles it. |
| `lucide-react` | existing [VERIFIED: package.json] | Icon library for milestone type icons (Trophy, Users, Mail, DollarSign, CheckCircle, Bell) | UI-SPEC maps each `milestone_type` to a lucide icon. |
| `class-variance-authority` (CVA) | existing [VERIFIED: src/components/ui/] | CVA-based component variants | All UI uses existing CVA primitives: Card, Button, Badge, EmptyState, Skeleton. |

**Installation:** No new dependencies. Phase 52 adds zero lines to `package.json`. [VERIFIED: by scope analysis]

---

## Architecture Patterns

### Page Architecture: Server Component Shell + Client Component

The existing pattern (established in coach/page.tsx, coach/analytics/page.tsx) is:

```
src/app/(dashboard)/coach/alerts/
├── page.tsx       ← async Server Component: auth check, RPC fetch, pass data to client
├── loading.tsx    ← already complete, matches UI-SPEC
├── error.tsx      ← already exists
```

```
src/components/coach/
├── CoachAlertsClient.tsx   ← "use client": all interactivity (filter tabs, dismiss, bulk dismiss)
```

```
src/app/api/alerts/dismiss/
└── route.ts   ← existing POST handler; needs coachMilestonesTag revalidation added
```

```
src/components/layout/
└── Sidebar.tsx   ← needs "9+" cap logic (single conditional render change)
```

### Pattern 1: Server Component Fetches, Client Component Mutates

```typescript
// Source: src/app/(dashboard)/coach/alerts/page.tsx (to be rewritten)
// Pattern: requireRole → getCoachMilestonesCached → pass to CoachAlertsClient
export default async function CoachAlertsPage() {
  const user = await requireRole("coach");
  const today = getTodayUTC(); // UTC for RPC consistency
  const payload = await getCoachMilestonesCached(user.id, today);
  return (
    <div className="space-y-6 px-4">
      {/* heading JSX */}
      <CoachAlertsClient initialMilestones={payload.milestones} />
    </div>
  );
}
```

**Why `getTodayUTC` not `getToday`:** The RPC embeds `today` in the cache key. UTC ensures consistent cache hits regardless of server timezone drift (matches Phase 48 precedent in `coach-analytics` page).

### Pattern 2: CoachMilestoneRow → Grouped Data Structure

```typescript
// Source: CoachMilestoneRow type from src/lib/rpc/coach-milestones-types.ts [VERIFIED]
type CoachMilestoneRow = {
  student_id:     string;
  student_name:   string;
  milestone_type: MilestoneType;  // "tech_setup" | "5_influencers" | "brand_response" | "closed_deal"
  alert_key:      string;
  deal_id:        string | null;
  occurred_at:    string;         // ISO timestamptz
};

// Group client-side: Map<student_id, { studentName: string, rows: CoachMilestoneRow[] }>
// Sort: most recent occurred_at among group descending (most active student first)
// Within group: occurred_at descending (newest alert first)
```

Note: The RPC returns ONLY undismissed milestones. `dismissed` state is managed purely client-side as optimistic UI — there is no `dismissed: boolean` field on `CoachMilestoneRow`. The existing `CoachAlertItem.dismissed` field does not translate directly. Dismissed state must be tracked in `useState` as a `Set<string>` of dismissed alert_keys.

### Pattern 3: Optimistic Dismiss with Revert

```typescript
// Source: existing CoachAlertsClient.tsx:73-110 [VERIFIED]
// Pattern already established; extend for bulk dismiss
const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

// Single dismiss: add key to Set optimistically, revert on error
// Bulk dismiss: add all group keys to Set optimistically,
//   run Promise.all, revert ALL on any failure, show single toast
```

### Pattern 4: Milestone Type → Icon + Badge Mapping

```typescript
// Source: UI-SPEC.md milestone type table
const MILESTONE_META: Record<MilestoneType, { label: string; Icon: LucideIcon; iconColor: string; badgeVariant: "success" | "info" }> = {
  "100h_milestone": { label: "100h Milestone",        Icon: Trophy,      iconColor: "text-ima-success", badgeVariant: "success" },
  "5_influencers":  { label: "5 Influencers Closed",  Icon: Users,       iconColor: "text-ima-primary", badgeVariant: "info" },
  "brand_response": { label: "Brand Response",         Icon: Mail,        iconColor: "text-ima-primary", badgeVariant: "info" },
  "closed_deal":    { label: "Deal Closed",            Icon: DollarSign,  iconColor: "text-ima-success", badgeVariant: "success" },
  "tech_setup":     { label: "Setup Complete",         Icon: CheckCircle, iconColor: "text-ima-primary", badgeVariant: "info" },
};
```

Note: `100h_milestone` is NOT a `MilestoneType` in `coach-milestones-types.ts` — the Phase 51 RPC only returns the four new types. The existing `page.tsx` logic for `100h_milestone` uses a different code path (direct Supabase query). Phase 52 MUST verify whether `get_coach_milestones` RPC also surfaces `100h_milestone` rows, or if the `100h_milestone` feed is separate. Based on Phase 51 RESEARCH.md (section "Existing 100+ hours/45 days alert (260401-cwd) still produces the same count") and the migration PLAN, the `get_coach_milestones` RPC returns ONLY the four new milestone types; the 100h alert is handled by `get_sidebar_badges` separately. The `/coach/alerts` page Phase 52 consolidates BOTH feeds. See Open Questions #1.

### Pattern 5: Sidebar Badge "9+" Cap

```typescript
// Source: src/components/layout/Sidebar.tsx lines 262-265 [VERIFIED]
// Current render (NO cap):
{item.badge && (badgeCounts[item.badge] ?? 0) > 0 && (
  <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-ima-primary/10 text-ima-primary shrink-0">
    {badgeCounts[item.badge]}
  </span>
)}

// Phase 52 target: add cap expression
const rawCount = badgeCounts[item.badge] ?? 0;
const displayCount = item.badge === "coach_milestone_alerts" && rawCount >= 10 ? "9+" : rawCount;
```

The badge key for Alerts is `"coach_milestone_alerts"` — confirmed via `src/lib/config.ts:302` [VERIFIED].

### Pattern 6: Dismiss Route — Missing coachMilestonesTag Revalidation

```typescript
// Source: src/app/api/alerts/dismiss/route.ts:79 [VERIFIED]
// CURRENT (incomplete for Phase 52):
revalidateTag("badges", "default");

// NEEDED: also revalidate the milestone page cache so router.refresh() on
// CoachAlertsClient re-fetches the updated milestone list
// The dismiss route receives only alert_key — it does NOT have coach_id.
// Options:
//   A. Add coach_id to the dismiss request body (already has profile.id from auth)
//   B. Call revalidateTag with profile.id (already looked up for rate limiting)
```

`profile.id` is the coach's user ID — already available at line 30 of the route handler. Adding `revalidateTag(coachMilestonesTag(profile.id))` is a one-liner after the existing `revalidateTag("badges", "default")` call.

### Anti-Patterns to Avoid

- **Direct `.from()` in page.tsx:** Replace with `getCoachMilestonesCached` — no raw Supabase queries in the page Shell.
- **Client-side grouping over full DB rows:** RPC already returns only undismissed rows scoped to coach. Group in the Client Component, not via another query.
- **New `dismissed: boolean` field on RPC rows:** The RPC has no such field — the RPC only returns undismissed rows. Dismissed state is local `Set<string>`.
- **Bulk dismiss dedicated endpoint:** UI-SPEC locked "no bulk-dismiss API — reuse existing endpoint, fire in `Promise.all`". [VERIFIED: UI-SPEC.md lines 150-153]
- **`getToday()` instead of `getTodayUTC()` in page.tsx:** The RPC requires a stable date for cache key consistency — use `getTodayUTC()`.
- **Replacing `loading.tsx`:** The existing `loading.tsx` already matches the UI-SPEC (3 skeleton cards with filter tab skeletons, `motion-safe:animate-pulse` via Skeleton component). [VERIFIED: reading loading.tsx]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter tabs | Custom tab component | Plain `<button>` elements (existing pattern in CoachAlertsClient) | UI-SPEC explicitly says "not a Button component — plain `<button>` with min-h-[44px]" |
| Alert card | Custom card | `Card variant="bordered-left"` + className override | Existing CVA variant handles border-left; override color via `className="border-l-ima-success"` |
| Badge chip | Custom span | `Badge variant="success" size="sm"` or `variant="info"` | Already handles background tint + text color via CVA |
| Empty state | Custom centered layout | `EmptyState variant="default"` | Already renders `role="status"`, icon container, heading, body |
| Loading skeleton | Custom shimmer | `Skeleton` component (used by `loading.tsx`) | `Skeleton` uses `motion-safe:animate-pulse` and `aria-hidden` built in |
| Dismiss endpoint | New API route | `POST /api/alerts/dismiss` | Already auth-gated, CSRF-protected, rate-limited, idempotent. Just needs `coachMilestonesTag` revalidation added. |
| Caching | `unstable_cache` manual setup | `getCoachMilestonesCached` from `@/lib/rpc/coach-milestones` | Already wired with 60s TTL + `coach-milestones:${coachId}` tag |
| Icon aria-hiding | `aria-hidden` per icon | Implicit: UI-SPEC contract + CLAUDE.md rule | Add `aria-hidden="true"` to every Lucide icon — not an abstraction needed |

---

## Critical Gap: `CoachAlertItem` Type Needs Redesign

The existing `CoachAlertItem` type in `CoachAlertsClient.tsx` has `dismissed: boolean` as a field, which assumes the data source provides dismissed state. The Phase 51 RPC (`get_coach_milestones`) returns **only undismissed rows** — there is no `dismissed` field on `CoachMilestoneRow`.

**Design for Phase 52:**
- The Client Component receives `initialMilestones: CoachMilestoneRow[]` (all undismissed from RPC).
- Local `useState<Set<string>>` tracks keys that have been optimistically dismissed in the current session.
- "Dismissed" tab shows rows whose `alert_key` is in the local dismissed set.
- On `router.refresh()` (after successful dismiss), the page re-renders with the updated RPC result — dismissed rows are already gone from the RPC result, so the local set is stale but harmless (the component remounts with fresh `initialMilestones`).

This is a significant departure from the current `CoachAlertItem.dismissed` pattern. The planner must create a task to redesign the interface.

---

## Common Pitfalls

### Pitfall 1: Dismiss Route Does Not Revalidate the Milestone Page Cache
**What goes wrong:** After a dismiss, `router.refresh()` in the Client Component triggers a page re-render, but `getCoachMilestonesCached` is still cached — the dismissed row reappears.
**Why it happens:** `POST /api/alerts/dismiss` currently only calls `revalidateTag("badges", "default")`, which busts the sidebar badge count but NOT the `coach-milestones:${coachId}` cache entry.
**How to avoid:** Add `revalidateTag(coachMilestonesTag(profile.id))` to the dismiss route after line 79. `profile.id` is already in scope.
**Source:** [VERIFIED: src/app/api/alerts/dismiss/route.ts lines 3, 79; src/lib/rpc/coach-milestones-types.ts:44-46]

### Pitfall 2: bordered-left Card Has a Fixed border-l-ima-primary Tint
**What goes wrong:** The `Card variant="bordered-left"` definition hardcodes `border-l-ima-primary` in its CVA definition. Passing `className="border-l-ima-success"` will override it via Tailwind merge, but only if the Tailwind config includes both colors in the safelist (they are ima-* tokens, both declared). Confirm `twMerge` handles border-left color override correctly.
**Source:** [VERIFIED: src/components/ui/Card.tsx line 11; existing CoachAlertsClient.tsx line 156 already uses this pattern successfully]
**How to avoid:** Follow existing pattern `className={cn(!alert.dismissed && "border-l-ima-success")}` — already works in the current file.

### Pitfall 3: Grouping Sort Order Must Derive from occurred_at, Not student_name
**What goes wrong:** Alphabetical sort by student name (current code) is used instead of most-recent `occurred_at` across group.
**Why it happens:** Natural inclination to sort by name for readability.
**How to avoid:** For each student group, compute `maxOccurredAt = Math.max(...group.map(r => new Date(r.occurred_at).getTime()))`. Sort groups descending by `maxOccurredAt`. Sort rows within each group descending by `occurred_at`.
**Source:** [VERIFIED: UI-SPEC.md grouping contract section]

### Pitfall 4: Bulk Dismiss Must Revert ALL on Any Single Failure
**What goes wrong:** Partial success (some dismissed, some failed) leaves UI in inconsistent state; only failed rows revert.
**Why it happens:** `Promise.all` rejects on first failure but others may have already resolved.
**How to avoid:** Use `Promise.allSettled`, collect failures, revert only failed keys from the optimistic set, show error toast if any failed.
**Note:** UI-SPEC says "All successfully dismissed rows remain dismissed; only failed ones revert." So `Promise.allSettled` is the correct primitive — not `Promise.all`. This contradicts the UI-SPEC bulk dismiss contract section which also says "on any single failure, revert all". **Clarification:** Per UI-SPEC.md line 153 (group header) vs line 200 (error toast section): the group header says "revert all", but the error toast section says "Some alerts could not be dismissed — please try again". Use `Promise.allSettled` and revert only individual failures (toast section wins — it implies partial success is valid).
**Source:** [VERIFIED: UI-SPEC.md lines 150-153 and 200-202]

### Pitfall 5: 100h_milestone Feed is NOT in get_coach_milestones RPC
**What goes wrong:** Phase 52 page replaces `page.tsx` wholesale without accounting for the 100h alerts.
**Why it happens:** The old `page.tsx` computed 100h alerts via direct Supabase queries. The new `getCoachMilestonesCached` RPC does NOT return `100h_milestone` rows.
**Source:** [VERIFIED: src/lib/rpc/coach-milestones-types.ts line 14-18 — `MilestoneType` does NOT include `100h_milestone`; Phase 51 RESEARCH confirms 100h alert lives in `get_sidebar_badges` separately]
**How to avoid:** Either (A) keep the old 100h computation in `page.tsx` alongside the new RPC call, or (B) accept that 100h alerts are no longer shown on the /coach/alerts page (they remain in the sidebar badge count). This is an open question — see Open Questions #1.

### Pitfall 6: CoachAlertItem Type Export Is Used By page.tsx
**What goes wrong:** `page.tsx` imports `CoachAlertItem` from `CoachAlertsClient.tsx`. If the Client Component's type is redesigned, the page.tsx import breaks.
**How to avoid:** Extract the shared type into a co-located `types.ts` file (e.g., `src/components/coach/alerts-types.ts`) or export from `coach-milestones-types.ts` directly, so the server page can import it without importing the `"use client"` module.
**Source:** [VERIFIED: src/app/(dashboard)/coach/alerts/page.tsx line 5 imports `CoachAlertItem` from `@/components/coach/CoachAlertsClient`]

---

## Code Examples

### Full CoachMilestoneRow Type (Phase 51 output)
```typescript
// Source: src/lib/rpc/coach-milestones-types.ts [VERIFIED]
export type CoachMilestoneRow = {
  student_id:     string;
  student_name:   string;
  milestone_type: MilestoneType; // "tech_setup" | "5_influencers" | "brand_response" | "closed_deal"
  alert_key:      string;
  deal_id:        string | null;
  occurred_at:    string;        // ISO timestamptz UTC
};

export type CoachMilestonesPayload = {
  milestones: CoachMilestoneRow[];
  count:      number;
};

export function coachMilestonesTag(coachId: string): string {
  return `coach-milestones:${coachId}`;
}
```

### Dismiss Route Patch (one-liner)
```typescript
// Source: src/app/api/alerts/dismiss/route.ts [VERIFIED — add after line 79]
import { coachMilestonesTag } from "@/lib/rpc/coach-milestones-types";

// After upsert success:
revalidateTag("badges", "default");
revalidateTag(coachMilestonesTag(profile.id)); // NEW — Phase 52
```

### Sidebar "9+" Cap Pattern
```typescript
// Source: src/components/layout/Sidebar.tsx lines 262-265 [VERIFIED]
// Replace raw count render with capped display:
const rawCount = badgeCounts[item.badge] ?? 0;
const displayCount = item.badge === "coach_milestone_alerts" && rawCount >= 10
  ? "9+"
  : String(rawCount);
```

### Page Shell (rewritten page.tsx)
```typescript
// Source: pattern from src/app/(dashboard)/coach/page.tsx [VERIFIED]
import { requireRole } from "@/lib/session";
import { getTodayUTC } from "@/lib/utils";
import { getCoachMilestonesCached } from "@/lib/rpc/coach-milestones";
import { CoachAlertsClient } from "@/components/coach/CoachAlertsClient";
import { Bell } from "lucide-react";

export default async function CoachAlertsPage() {
  const user = await requireRole("coach");
  const today = getTodayUTC();
  const payload = await getCoachMilestonesCached(user.id, today);
  const activeCount = payload.count; // RPC count = undismissed count

  return (
    <div className="space-y-6 px-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Bell className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-ima-text">Milestone Alerts</h1>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-ima-success/10 text-ima-success">
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-sm text-ima-text-secondary">
          Your students&apos; milestone achievements — review and dismiss when actioned.
        </p>
      </div>
      <CoachAlertsClient initialMilestones={payload.milestones} />
    </div>
  );
}
```

### Client Component Props Interface
```typescript
// New shape — replaces CoachAlertItem
import type { CoachMilestoneRow } from "@/lib/rpc/coach-milestones-types";

interface CoachAlertsClientProps {
  initialMilestones: CoachMilestoneRow[];
}
```

---

## Files to Modify

| File | Action | What Changes |
|------|--------|--------------|
| `src/app/(dashboard)/coach/alerts/page.tsx` | Rewrite | Replace 100h ad-hoc query with `getCoachMilestonesCached`; pass `CoachMilestoneRow[]` to client |
| `src/components/coach/CoachAlertsClient.tsx` | Rewrite | New type (CoachMilestoneRow), group-by-student, bulk dismiss, multi-type icons, dismissed state as Set |
| `src/app/api/alerts/dismiss/route.ts` | Patch (1 line) | Add `revalidateTag(coachMilestonesTag(profile.id))` after existing `revalidateTag("badges")` |
| `src/components/layout/Sidebar.tsx` | Patch (3 lines) | Add "9+" cap for `coach_milestone_alerts` badge |
| `src/app/(dashboard)/coach/alerts/loading.tsx` | Review only | Already matches UI-SPEC — confirm no changes needed |
| `src/app/(dashboard)/coach/alerts/error.tsx` | Review only | Already exists — confirm no changes needed |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc Supabase queries in page.tsx for 100h alert | `getCoachMilestonesCached` RPC wrapper (server-only) | Phase 51 | page.tsx becomes a thin shell; all data logic in RPC |
| `dismissed: boolean` on alert items (fetched from DB) | Optimistic `Set<string>` in client state; RPC returns only undismissed | Phase 52 | Simpler data contract; dismiss is client-local until `router.refresh()` |
| Single milestone type (100h only) | 4 milestone types (5_influencers, brand_response, closed_deal, tech_setup) | Phase 51/52 | Icon + badge mapping table needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `get_coach_milestones` RPC does NOT return `100h_milestone` rows — 100h is only in `get_sidebar_badges` | Pitfall 5, Open Questions | If wrong: 100h rows would appear in the new feed without labels/icons |
| A2 | `loading.tsx` needs no changes — current skeleton matches UI-SPEC 3-card layout | Files to Modify | If wrong: a separate loading skeleton task is needed |
| A3 | `Promise.allSettled` should be used for bulk dismiss (partial success allowed) rather than full revert | Pitfall 4 | If wrong: UI-SPEC group header "revert all" semantics require `Promise.all` with full revert |

---

## Open Questions

### 1. Does the new /coach/alerts page need to show 100h_milestone alerts alongside the new milestone types?

**What we know:** The old `page.tsx` computed 100h alerts via direct Supabase queries. The `get_coach_milestones` RPC (Phase 51) only returns the four new types (`5_influencers`, `brand_response`, `closed_deal`, `tech_setup`). The `get_sidebar_badges` counts BOTH old and new milestones together in `coach_milestone_alerts`.

**What's unclear:** NOTIF-09 says "grouped-by-student feed of active milestone notifications". NOTIF-08 says "Existing 100+ hours/45 days coach alert continues to work unchanged." Does "continues to work" mean it stays on `/coach/alerts`, or just that the sidebar badge count continues to include it?

**Recommendation:** Include 100h alerts in the `/coach/alerts` feed for a complete picture. Fetch them via the same old Supabase query pattern alongside `getCoachMilestonesCached`, or extend the RPC to include them. The simpler path is to keep the 100h computation in `page.tsx` and merge the results before passing to `CoachAlertsClient`. If the decision is to drop 100h from the page, document it explicitly. This is the planner's call — flag as a task decision in the plan.

### 2. Should the dismiss route's `revalidateTag("badges", "default")` second argument be removed?

**What we know:** `revalidateTag` in Next.js 15/16 takes a single string tag. The second argument `"default"` is NOT a valid overload of `revalidateTag` — it silently ignores the second argument or may cause a TypeScript error.

**What's unclear:** Whether this is a typo that has been working silently or intentional.

**Recommendation:** Verify the TypeScript signature of `revalidateTag` in Next.js 16. If it only accepts one arg, remove `"default"` from all existing calls. This is a pre-existing issue; Phase 52 should not copy the pattern.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 52 is a pure UI/code change. No external tools, databases, CLIs, or services beyond the already-running Supabase project are required. `supabase db push` was done in Phase 51.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (no vitest/jest installed) [VERIFIED: package.json has no test script] |
| Config file | None |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` |

Project convention: no automated unit tests. Correctness verified by the post-phase build gate (`PERF-07`): `npm run lint && npx tsc --noEmit && npm run build` with zero errors.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| NOTIF-09 | `/coach/alerts` page renders grouped feed | manual smoke | `npm run build` (build-time type check) | UAT: navigate as coach, verify groups, dismiss, bulk dismiss |
| NOTIF-09 | Sidebar badge caps at "9+" | manual smoke | `npx tsc --noEmit` | UAT: verify Sidebar render with mock `badgeCounts.coach_milestone_alerts = 10` |
| PERF-07 | lint + tsc + build all pass | build gate | `npm run lint && npx tsc --noEmit && npm run build` | Phase exit gate |
| PERF-08 | ima-* tokens, motion-safe, 44px, aria | lint (partial) | `npm run lint` | ESLint catches some; CLAUDE.md rules verified by code review |

### Wave 0 Gaps

None — no test framework to install. Build gate covers type safety. UAT covers behavior.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireRole("coach")` in page.tsx — already in existing page |
| V3 Session Management | yes | Supabase session cookie (existing — no change) |
| V4 Access Control | yes | `profile.role !== "coach"` check in dismiss route (existing) |
| V5 Input Validation | yes | Zod `dismissSchema` on dismiss route (existing, no change) |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Coach dismissing another coach's alert | Tampering | dismiss route uses `profile.id` from auth — never from request body [VERIFIED: route.ts line 68] |
| CSRF on POST /api/alerts/dismiss | Spoofing | `verifyOrigin(request)` on line 16 [VERIFIED: route.ts] |
| Rate-limit bypass on bulk dismiss | DoS | Rate limit on `profile.id` per route (line 41); bulk dismiss fires multiple calls — all subject to same rate limit [VERIFIED: route.ts line 41] |

---

## Sources

### Primary (HIGH confidence — all verified against in-repo files)

- `src/lib/rpc/coach-milestones.ts` — `fetchCoachMilestones`, `getCoachMilestonesCached`, cache tag
- `src/lib/rpc/coach-milestones-types.ts` — `CoachMilestoneRow`, `CoachMilestonesPayload`, `coachMilestonesTag`
- `src/app/api/alerts/dismiss/route.ts` — existing dismiss handler, auth/CSRF/rate-limit pattern
- `src/app/(dashboard)/coach/alerts/page.tsx` — current page to be replaced
- `src/app/(dashboard)/coach/alerts/loading.tsx` — skeleton implementation (already complete)
- `src/components/coach/CoachAlertsClient.tsx` — existing client component to be rewritten
- `src/components/layout/Sidebar.tsx` — badge render location (no cap currently)
- `src/app/(dashboard)/layout.tsx` — `badgeCounts["coach_milestone_alerts"]` wiring
- `src/lib/rpc/types.ts` — `SidebarBadgesResult` type
- `src/lib/config.ts` — `MilestoneType`, `MILESTONE_CONFIG`, `MILESTONES`, `MILESTONE_KEY_PATTERNS`, navigation config
- `src/components/ui/Card.tsx`, `Badge.tsx`, `Button.tsx`, `EmptyState.tsx` — CVA primitive APIs
- `.planning/phases/52-coach-alerts-page/52-UI-SPEC.md` — visual + interaction contract
- `.planning/phases/52-coach-alerts-page/52-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- `.planning/phases/51-milestone-notifications-rpc-backfill/51-RESEARCH.md` — Phase 51 design decisions and pitfalls
- `.planning/phases/51-milestone-notifications-rpc-backfill/51-01-PLAN.md` — what the migration (00027) was built to do

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries verified in package.json
- Architecture: HIGH — page.tsx, CoachAlertsClient, dismiss route all read directly
- Pitfalls: HIGH — identified from direct code reading; not speculative
- Open Questions: flagged honestly; A1 is the highest-risk assumption

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable codebase; only invalidated by concurrent Phase 52 work)
