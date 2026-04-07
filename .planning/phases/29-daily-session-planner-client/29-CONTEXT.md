# Phase 29: Daily Session Planner Client - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Students see a pre-session planner on their first visit each day, build a session plan (up to 4h work time), then execute planned sessions sequentially via WorkTracker. After completing all planned sessions, a motivational card appears with Arabic/English text. Ad-hoc sessions become available after plan completion with no cap.

</domain>

<decisions>
## Implementation Decisions

### Plan execution UX
- **D-01:** Each planned session does NOT auto-start. Student clicks to start each session — same as today's flow. The planner pre-fills duration and break settings so the student doesn't pick them each time.
- **D-02:** Show a list of planned sessions: completed ones get a checkmark, current one is highlighted with a "Start Session N" button, upcoming ones are greyed out.
- **D-03:** Skip the setup phase (duration/break picker) for planned sessions. The planned session list already shows duration/break info — clicking "Start Session N" goes straight to the working state.
- **D-04:** Reuse existing idle/working/break state machine — no new "planning" state needed. The planner is a pre-step that feeds config into the existing WorkTracker flow.

### Break auto-assignment (from requirements)
- **D-05:** Breaks auto-assign without student input during planning: odd-numbered sessions (1st, 3rd, 5th) get a short break choice, even sessions (2nd, 4th, 6th) get a long break choice, last session has no break. Student picks break duration within the assigned type.

### Motivational card (from requirements)
- **D-06:** After all planned sessions complete, a motivational card appears showing Arabic "اللهم بارك" (large, centered, dir="rtl" lang="ar") and English "You have done the bare minimum! Continue with your next work session". Card shows once per day.
- **D-07:** Card has "Start Next Session" (opens ad-hoc picker) and "Dismiss" (returns to work tracker idle).

### Claude's Discretion
- Planner UI layout and styling (session-building interface, add session flow, running total display, confirm button behavior)
- Motivational card visual design (modal vs inline, animation)
- Ad-hoc session picker presentation after plan completion (simplified setup phase, how to indicate cap is lifted)
- State persistence across page refreshes (useEffect guard for plan-mode)
- Loading states and error handling during plan creation/session execution
- Planned session list component design (cards, list items, spacing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### API Layer (Phase 28 — built)
- `src/app/api/daily-plans/route.ts` — POST (create plan, idempotent on conflict) and GET (fetch today's plan) endpoints
- `src/lib/schemas/daily-plan.ts` — planJsonSchema Zod schema: `{ version: 1, total_work_minutes, sessions: [{ session_minutes, break_type, break_minutes }] }`
- `src/app/api/work-sessions/route.ts` — POST handler with plan-aware cap enforcement (blocks without plan, enforces cap while unfulfilled, lifts after completion)

### Existing Client Components
- `src/components/student/WorkTrackerClient.tsx` — Main WorkTracker component (~610 lines), state machine (idle/setup/working/break), mutation handlers, session list rendering. THIS IS THE PRIMARY FILE TO MODIFY.
- `src/components/student/WorkTimer.tsx` — Active session timer component
- `src/components/student/CycleCard.tsx` — Session history card component
- `src/app/(dashboard)/student/work/page.tsx` — Server component that fetches today's sessions, passes to WorkTrackerClient. Must also fetch today's plan.

### Config & Types
- `src/lib/config.ts` §WORK_TRACKER — sessionDurationOptions [30, 45, 60], breakOptions (short: [5, 10], long: [15, 20, 25, 30]), dailyGoalHours: 4
- `src/lib/types.ts` lines 418-448 — daily_plans TypeScript types (Row, Insert, Update)
- `src/lib/utils.ts` — getTodayUTC(), formatHoursMinutes(), getToday()

### UI Primitives
- `src/components/ui/Card.tsx` — Card component for planner session cards
- `src/components/ui/Modal.tsx` — Modal for motivational card (if modal approach chosen)
- `src/components/ui/Button.tsx` — Button component

### Database Schema
- `supabase/migrations/00013_daily_plans_undo_log.sql` — daily_plans table: UNIQUE(student_id, date), plan_json JSONB

### Requirements
- `.planning/REQUIREMENTS.md` §Session Planner — PLAN-01 through PLAN-06, PLAN-10
- `.planning/REQUIREMENTS.md` §Post-Plan Completion — COMP-01 through COMP-04

### Prior Phase Context
- `.planning/phases/28-daily-session-planner-api/28-CONTEXT.md` — API decisions: cap enforcement logic (D-01 through D-05), idempotent plan creation (D-06), plan_json contract (D-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkTrackerClient.tsx` state machine (idle/setup/working/break): Plan execution reuses these states — planner is a pre-step, not a new state
- `CycleCard.tsx`: Can be used or adapted for the planned session list items
- `WorkTimer.tsx`: Unchanged — used during planned session execution
- `WORK_TRACKER.breakOptions`: Config-driven break presets, reused in planner break selection
- `WORK_TRACKER.sessionDurationOptions`: [30, 45, 60] for planner session duration picker
- `formatHoursMinutes()`: For displaying running work-time total in planner
- `planJsonSchema` + `PlanJson` type: Zod validation and TypeScript type for plan data

### Established Patterns
- `useRef(useRouter())` and `useRef(useToast())` for stable callback refs
- `fetch()` + `response.ok` check + toast error display for mutations
- `router.refresh()` after mutations for server-side revalidation
- CVA-based UI primitives with ima-* design tokens
- 44px min touch targets, motion-safe: prefix on all animations

### Integration Points
- `page.tsx` server component: Must fetch today's plan via admin client and pass as prop to WorkTrackerClient
- `WorkTrackerClient`: Must accept `initialPlan` prop, render planner when no plan exists, render planned session list during execution
- `POST /api/daily-plans`: Called when student confirms plan in planner UI
- `GET /api/daily-plans`: Not needed if plan is fetched server-side in page.tsx
- `POST /api/work-sessions`: Already handles plan-aware cap — client just sends session_minutes as usual

</code_context>

<specifics>
## Specific Ideas

- Planned session list shows: checkmark for completed, highlighted current with start button, greyed out upcoming — like a task checklist
- Planner is a one-time daily step: build plan, confirm, then execute sessions through normal WorkTracker flow
- "The planner just pre-fills the duration and break settings so the student doesn't have to pick them each time"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-daily-session-planner-client*
*Context gathered: 2026-03-31*
