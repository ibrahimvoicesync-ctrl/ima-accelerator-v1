---
phase: 37-invite-link-max-uses
plan: 02
subsystem: ui
tags: [react, invite, magic-links, max-uses, badge, coach, owner]

# Dependency graph
requires:
  - phase: 37-01
    provides: POST /api/magic-links accepts max_uses (1-10000, default 10)
provides:
  - CoachInvitesClient: maxUses state + number input + "X / Y used" display
  - OwnerInvitesClient: maxUses state + number input + "X / Y used" display
affects:
  - /coach/invites (UI displays max uses input and usage counts)
  - /owner/invites (UI displays max uses input and usage counts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getUsageDisplay() helper: returns { text, exhausted } tuple from MagicLinkItem — avoids inline logic in JSX"
    - "IIFE pattern in JSX: (() => { const { text, exhausted } = ...; return <p>...</p>; })()"
    - "maxUses reset after success toast — controlled input always returns to default 10 post-creation"

key-files:
  created: []
  modified:
    - src/components/coach/CoachInvitesClient.tsx
    - src/components/owner/OwnerInvitesClient.tsx

key-decisions:
  - "getUsageDisplay helper defined inside component (not module-level) to access MagicLinkItem type cleanly"
  - "IIFE in JSX used to destructure getUsageDisplay result — avoids new variable declarations at map level"
  - "setMaxUses(10) placed after success toast but before catch, inside the try block — resets only on actual success"

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 37 Plan 02: Invite Link Max Uses — UI Inputs and Usage Display Summary

**MaxUses number input (default 10, range 1-10000) added to both invite pages; magic link cards now show "X / Y used" with ima-error Exhausted badge for capped links**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-04T09:22:28Z
- **Completed:** 2026-04-04T09:26:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `const [maxUses, setMaxUses] = useState<number>(10)` to both CoachInvitesClient and OwnerInvitesClient
- Updated `handleCreateMagicLink` in both components: `max_uses: maxUses` in POST body, `maxUses` added to `useCallback` dep array, `setMaxUses(10)` after success toast
- Replaced the standalone Generate button with a flex container holding the Max uses Input (w-32, clamped 1-10000, NaN fallback to 10) and the Generate Invite Link button side by side
- Added `getUsageDisplay(link)` helper returning `{ text: "X / Y used", exhausted: boolean }` — infinity symbol for null max_uses, exhausted flag when use_count >= max_uses
- Replaced the old fragmented use_count display (`{use_count} use{...}`) with the new IIFE-rendered `<p>` that applies `text-ima-error` when exhausted and renders `<Badge variant="error" size="sm">Exhausted</Badge>`
- Owner card retains `<span className="capitalize">{link.role}</span>` display; Coach card does not (per plan spec)

## Task Commits

1. **Task 1: Add maxUses state, number input, and POST body update to both client components** - `74ed203` (feat)
2. **Task 2: Update magic link usage display format and add Exhausted badge** - `c36e0c8` (feat)

## Files Created/Modified

- `src/components/coach/CoachInvitesClient.tsx` — maxUses state, Max uses Input, max_uses in POST body, getUsageDisplay helper, new usage display with exhausted badge
- `src/components/owner/OwnerInvitesClient.tsx` — same as coach, plus preserves role display in magic link card

## Decisions Made

- `getUsageDisplay` helper defined inside the component (not exported module-level) because it depends on `MagicLinkItem` type which is also local to the file.
- IIFE pattern (`(() => { ... })()`) used inside `{localMagicLinks.map(...)}` to destructure `getUsageDisplay` result inline without adding extra nesting to the map body.
- `setMaxUses(10)` reset is placed in the try block immediately after the success toast — guarantees it only runs on confirmed successful creation, not on network error or 4xx response.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all data is wired from real MagicLinkItem values returned by the API.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/coach/CoachInvitesClient.tsx
- FOUND: src/components/owner/OwnerInvitesClient.tsx

Commits exist:
- FOUND: 74ed203 (Task 1)
- FOUND: c36e0c8 (Task 2)

Build: PASSED (next build exits 0, 51 routes, no TypeScript errors)
Lint: PASSED (eslint exits 0, no warnings)

---
*Phase: 37-invite-link-max-uses*
*Completed: 2026-04-04*
