# Phase 27: Coach/Owner Roadmap Undo - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Coaches and owners can revert any completed roadmap step to active via a new PATCH `/api/roadmap/undo` endpoint, with a confirmation dialog, sequential-progression enforcement (N+1 cascade re-lock), and a permanent audit trail in `roadmap_undo_log`. This covers the API route, the UI undo button on `RoadmapTab`, and the confirmation modal.

Requirements: UNDO-01, UNDO-02, UNDO-03, UNDO-04

</domain>

<decisions>
## Implementation Decisions

### Cascade Warning UX
- **D-01:** When undoing step N and step N+1 is currently active (not yet completed), the confirmation dialog MUST include a cascade warning: "Are you sure you want to reset Step X back to active? Step Y (currently active) will also be re-locked."
- **D-02:** When step N+1 is NOT active (i.e., it's locked or doesn't exist), use the simple text from UNDO-03: "Are you sure you want to reset Step X back to active?"
- **D-03:** The API response should indicate whether a cascade re-lock happened so the client can display the correct confirmation dialog text before the action and the correct toast after.

### Undo Button Placement
- **D-04:** Inline icon button on completed steps in the coach/owner RoadmapTab. Standard placement — no hover-only visibility.

### Post-Undo Feedback
- **D-05:** Toast notification on success ("Step X reset to active" or "Step X reset to active, Step Y re-locked") plus optimistic or fetched re-render of the roadmap. Standard pattern.

### Error Handling
- **D-06:** Toast error on failure (network error, already undone, etc.). Modal closes on error. Standard pattern.

### Claude's Discretion
- Undo icon choice (e.g., RotateCcw from lucide-react, or similar)
- Exact undo button size/color within ima-* design tokens
- Whether to pre-check N+1 status client-side for the dialog text or fetch it from the API
- Loading state while undo request is in-flight (disable button, spinner, etc.)
- Whether the API returns the updated roadmap rows or the client refetches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Coach/Owner Undo — UNDO-01 through UNDO-04 acceptance criteria

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 27 — Full success criteria (5 items) including authorization, cascade, and audit log

### Database Schema
- `supabase/migrations/00013_daily_plans_undo_log.sql` — roadmap_undo_log table definition, indexes, and RLS policies (created in Phase 26)
- `supabase/migrations/00001_create_tables.sql` — roadmap_progress table schema, RLS policies, get_user_id()/get_user_role() helper functions

### Existing Roadmap Code
- `src/components/coach/RoadmapTab.tsx` — Coach/owner shared roadmap view component where undo button will be added
- `src/app/api/roadmap/route.ts` — Existing PATCH endpoint for student step completion (reference for auth/validation chain pattern)
- `src/components/student/RoadmapClient.tsx` — Student roadmap with existing Modal-based confirmation pattern (reference implementation)

### UI Components
- `src/components/ui/Modal.tsx` — Reusable modal with focus trap, ESC close, portal rendering
- `src/components/ui/Button.tsx` — CVA-based button component
- `src/components/ui/Toast.tsx` — Toast notification component

### Research Context
- `.planning/STATE.md` §Accumulated Context — v1.3 research decisions (cascade re-lock in same request)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Modal` component (`src/components/ui/Modal.tsx`) — fully accessible with focus trap, portal, ESC close. Used in student `RoadmapClient.tsx` for step completion confirmation — same pattern reusable for undo confirmation
- `Button` component with variant props (primary, ghost, etc.)
- `Toast` component for success/error feedback
- `Badge` component for status display
- `verifyOrigin()`, `checkRateLimit()`, `createAdminClient()` — standard API route chain

### Established Patterns
- API routes follow CSRF → auth → role → rate-limit → Zod → admin client chain (see `/api/roadmap/route.ts`)
- Modal confirmation pattern: state variable for target item → Modal open/close → async action → update local state (see `RoadmapClient.tsx` lines 28-79)
- RoadmapTab receives `roadmap` array and `joinedAt` — will need `studentId` prop added for undo API calls
- Coach/owner detail pages pass props through `StudentDetailTabs` → tab components

### Integration Points
- `RoadmapTab.tsx` needs: undo button on completed steps, studentId prop, Modal for confirmation, fetch call to undo API
- New route: `src/app/api/roadmap/undo/route.ts` — PATCH handler
- Coach detail page (`StudentDetailClient.tsx`) and owner detail page (`OwnerStudentDetailClient.tsx`) must pass studentId to RoadmapTab
- `roadmap_undo_log` table ready for INSERT from the API route

</code_context>

<specifics>
## Specific Ideas

- Cascade dialog text pattern: "Are you sure you want to reset Step X back to active? Step Y (currently active) will also be re-locked." — use step numbers AND titles for clarity
- Follow the exact same Modal + Button pattern from student `RoadmapClient.tsx` for visual consistency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-coach-owner-roadmap-undo*
*Context gathered: 2026-03-31*
