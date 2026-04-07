# Phase 14: Flexible Work Sessions - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Students can choose their session duration (30/45/60 min), take timed breaks between cycles, and run unlimited sessions per day. The existing work tracker page transforms from a fixed 4-cycle model to an open-ended session-based model with duration selection and break countdowns.

</domain>

<decisions>
## Implementation Decisions

### Session History Display
- **D-01:** Replace the fixed 4-slot CycleCard grid with a growing list that only shows sessions that actually exist (completed, active, paused). No empty "pending" slots.
- **D-02:** Each session card shows the duration the student chose (e.g. "Session 3 - 45 min") alongside the status. Useful since durations now vary.
- **D-03:** List order is newest-first — active/latest session at top, completed sessions stack below. Student sees current state without scrolling.
- **D-04:** Show latest 4 session cards by default; collapse older ones behind a "Show N more" link for students doing 6+ sessions.

### Daily Progress Indicator
- **D-05:** Replace "X of 4 cycles done" with an hours-based progress bar: "1h 30m / 4h" with a visual bar. Adapts naturally to any number of sessions.
- **D-06:** Also display session count below the bar (e.g. "3 sessions completed").
- **D-07:** When the student hits 4 hours, the progress bar fills to 100% and stays there. No celebration banner, no special message. Student can keep starting more sessions — the bar speaks for itself.
- **D-08:** Progress bar uses a single color (ima-primary / blue). No RAG color coding — that comes with the KPI banner in Phase 15.

### Claude's Discretion
- Pre-session setup UI — how the duration picker (30/45/60) and break type/duration selection appear before starting a session. Claude may design the selection step based on existing UI patterns (buttons, toggles, etc.)
- Break countdown UI — how the break timer displays between cycles, skip-early interaction, and first-cycle-skips-break logic. Claude may design based on existing WorkTimer patterns
- Terminology — whether to call them "sessions" or "cycles" in the UI (currently "cycles"; may rename for clarity)
- CycleCard component evolution — whether to rename/refactor the existing component or create a new one

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — WORK-01 through WORK-08 (all map to this phase)

### Prior Phase Context
- `.planning/phases/13-schema-config-foundation/13-CONTEXT.md` — Phase 13 decisions on DB migration, config structure, and `cycle_number` unbounding

### Database Schema
- `supabase/migrations/00001_create_tables.sql` — work_sessions table schema, constraints, RLS policies
- `supabase/migrations/00003_add_pause_support.sql` — paused status and paused_at column

### Config
- `src/lib/config.ts` — `WORK_TRACKER` with `sessionDurationOptions`, `defaultSessionMinutes`, `cyclesPerDay` (to be migrated away), `breakMinutes`, `dailyGoalHours`

### Existing Work Tracker Code
- `src/components/student/WorkTrackerClient.tsx` — Main client component with all mutation handlers; 6 references to `cyclesPerDay` that must be migrated
- `src/components/student/WorkTimer.tsx` — Circular SVG timer; already accepts `totalSeconds` prop (adapts to any duration)
- `src/components/student/CycleCard.tsx` — Session card component; needs evolution for duration display
- `src/app/api/work-sessions/route.ts` — POST endpoint; validates `cycle_number.max(cyclesPerDay)` — must remove cap
- `src/app/api/work-sessions/[id]/route.ts` — PATCH endpoint; completes with `duration_minutes ?? sessionMinutes` — must accept variable durations

### Critical Implementation Notes
- `.planning/STATE.md` §Accumulated Context — `cyclesPerDay` audit is gating (6 consumers), break timer is client-state only, Phase 14 migrates consumers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkTimer` component already accepts `totalSeconds` prop — adapts to 30/45/60 min durations without changes to the timer ring logic
- `CycleCard` component can be extended with a duration prop
- `formatHours()` and `formatPausedRemaining()` utilities in `src/lib/utils.ts`
- `WORK_TRACKER.sessionDurationOptions` and `defaultSessionMinutes` already in config from Phase 13

### Established Patterns
- Client component with `useState` + `fetch` for mutations (WorkTrackerClient pattern)
- `router.refresh()` after every mutation for server data sync
- `useRef` for stable callback references (onComplete, router)
- `started_at` shifted forward on resume — timer math stays simple (Date.now() - started_at)
- Abandon deletes the row to free the cycle slot

### Integration Points
- `POST /api/work-sessions` needs `session_minutes` in request body and must remove `cycle_number` max cap
- `PATCH /api/work-sessions/[id]` needs to use the session's stored `session_minutes` for completion
- `WorkTrackerClient` is the only component that orchestrates the work tracker flow — all changes are localized here
- 6 consumers of `WORK_TRACKER.cyclesPerDay` across the codebase must be audited and migrated (coach analytics, owner stats, sidebar, etc.)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for duration selection and break countdown UIs.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-flexible-work-sessions*
*Context gathered: 2026-03-27*
