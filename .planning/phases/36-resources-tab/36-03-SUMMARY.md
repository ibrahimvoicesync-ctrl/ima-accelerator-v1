---
phase: 36-resources-tab
plan: 03
subsystem: ui
tags: [react, nextjs, tailwind, supabase, resources, glossary, discord]

# Dependency graph
requires:
  - phase: 36-01
    provides: CSP header for Discord iframe, next.config.ts frame-src rule
  - phase: 36-02
    provides: /api/resources and /api/glossary route handlers with CRUD operations

provides:
  - Complete Resources Tab UI: 6 components + 3 page files
  - ResourcesClient: tabbed interface (links/community/glossary) with CSS hidden pattern
  - ResourceLinkCard: card with title, URL, comment, pin icon, poster, timestamp, delete
  - AddResourceModal: form to add resource links (POST /api/resources)
  - DiscordEmbed: iframe (600px) or "not configured" fallback
  - GlossaryList: alphabetical grouping by first letter, case-insensitive search
  - AddGlossaryModal: add/edit mode, 409 duplicate error handling
  - owner/resources, coach/resources, student/resources page routes

affects: [37-invite-max-uses]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS hidden/block pattern for tab content to prevent Discord iframe remount
    - toastRef stable ref pattern for toast stability in useCallback
    - canManage derived from role prop (owner|coach vs student) for read-only enforcement

key-files:
  created:
    - src/components/resources/ResourcesClient.tsx
    - src/components/resources/ResourceLinkCard.tsx
    - src/components/resources/AddResourceModal.tsx
    - src/components/resources/DiscordEmbed.tsx
    - src/components/resources/GlossaryList.tsx
    - src/components/resources/AddGlossaryModal.tsx
    - src/app/(dashboard)/owner/resources/page.tsx
    - src/app/(dashboard)/coach/resources/page.tsx
    - src/app/(dashboard)/student/resources/page.tsx
  modified: []

key-decisions:
  - "CSS hidden/block pattern (not conditional rendering) used for tab switching to avoid Discord iframe remount"
  - "canManage derived from role prop at render time — owner and coach get CRUD, student gets read-only"
  - "No student_diy/resources page created — per D-11/RES-02, student_diy excluded from Resources tab"

patterns-established:
  - "CSS hidden/block pattern: use className={activeTab === X ? 'block' : 'hidden'} for tabs containing iframes"
  - "toastRef pattern: const toastRef = useRef(toast); toastRef.current = toast; for stable callbacks"
  - "GlossaryList uses dl/dt/dd semantic HTML for accessibility"

requirements-completed: [RES-03, RES-04, RES-05, RES-06, RES-07, RES-08]

# Metrics
duration: 25min
completed: 2026-04-04
---

# Phase 36 Plan 03: Resources Tab UI Summary

**Tabbed Resources UI (Links, Community, Glossary) with role-based CRUD for owner/coach and read-only for students, Discord iframe using CSS hidden pattern to prevent remount**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-04T06:00:00Z
- **Completed:** 2026-04-04T06:25:00Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 9

## Accomplishments
- Built complete Resources Tab with three tabs: Links, Community (Discord), Glossary
- Owner and coach can add/delete resource links and manage glossary terms; students are read-only
- Discord embed uses CSS hidden pattern so iframe is never unmounted when switching tabs
- Glossary supports alphabetical grouping by first letter, case-insensitive search filtering, and duplicate-term 409 error handling
- All 9 files pass TypeScript strict, ESLint, and `npm run build` (exit 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all resource components and page files** - `f52ae7c` (feat)

## Files Created/Modified
- `src/components/resources/ResourcesClient.tsx` - Main client with tab state, data fetching, delete confirm modal
- `src/components/resources/ResourceLinkCard.tsx` - Card with title, URL (new tab), comment, pin icon, poster/timestamp, delete
- `src/components/resources/AddResourceModal.tsx` - Modal form to add resource links with pin checkbox
- `src/components/resources/DiscordEmbed.tsx` - iframe (600px) or warm-card fallback when env vars missing
- `src/components/resources/GlossaryList.tsx` - Alphabetical grouped terms with search input and edit/delete
- `src/components/resources/AddGlossaryModal.tsx` - Add/edit mode modal with 409 duplicate handling
- `src/app/(dashboard)/owner/resources/page.tsx` - Server page with requireRole("owner")
- `src/app/(dashboard)/coach/resources/page.tsx` - Server page with requireRole("coach")
- `src/app/(dashboard)/student/resources/page.tsx` - Server page with requireRole("student")

## Decisions Made
- CSS hidden/block tab pattern chosen over conditional rendering to preserve Discord iframe DOM node across tab switches (per D-10/Pitfall 5)
- `canManage = role === "owner" || role === "coach"` derived inline — single source of truth in ResourcesClient
- No student_diy resources page created — D-11 and RES-02 explicitly exclude student_diy from Resources tab

## Deviations from Plan

**1. [Rule 1 - Bug] Removed unused Search icon import from GlossaryList**
- **Found during:** Task 1 (lint check)
- **Issue:** Search icon imported but not used directly (Input component handles its own display)
- **Fix:** Removed Search from lucide-react import
- **Files modified:** src/components/resources/GlossaryList.tsx
- **Verification:** ESLint passes with no warnings
- **Committed in:** f52ae7c (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — unused import)
**Impact on plan:** Minimal. Lint warning resolved; no functional change.

## Issues Encountered
None beyond the unused import lint warning, which was auto-fixed.

## Known Stubs
None — all components are fully wired to /api/resources and /api/glossary endpoints built in Plan 02. DiscordEmbed shows a "not configured" fallback (by design) until NEXT_PUBLIC_DISCORD_GUILD_ID and NEXT_PUBLIC_DISCORD_CHANNEL_ID are set in Vercel env — this is intentional per D-10 and documented in STATE.md Pending Todos.

## User Setup Required
None beyond what was already documented — Discord env vars (NEXT_PUBLIC_DISCORD_GUILD_ID, NEXT_PUBLIC_DISCORD_CHANNEL_ID) must be set in Vercel for the iframe to show.

## Next Phase Readiness
- Resources Tab UI is complete and ready for human verification (Task 2 checkpoint)
- After UAT approval, phase 36 is complete and phase 37 (invite max_uses) can proceed
- No blockers

## Self-Check: PASSED

All 9 created files confirmed present on disk. Commit f52ae7c confirmed in git log.

---
*Phase: 36-resources-tab*
*Completed: 2026-04-04*
