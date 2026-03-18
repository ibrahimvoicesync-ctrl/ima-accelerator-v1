# Phase 3: Student Work Tracker - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Students can run and track their daily 45-minute work cycles (max 4 per day) with a countdown timer. The timer survives navigation and browser refresh by restoring from `started_at`. Cycles can be started, paused, resumed, completed, and abandoned (with a 5-minute grace period confirmation). Today's cycle count is visible on the student dashboard. This phase does NOT include: streaks, extra cycles beyond 4, focus mode, leaderboard, or player cards (all V2).

</domain>

<decisions>
## Implementation Decisions

### Timer display
- Hero timer layout: large centered circular progress ring with MM:SS countdown in the center when a cycle is active
- SVG ring depletes as time passes, big digits in the center
- Timer is the star of the page during an active cycle
- Prominent Pause and Complete buttons below the timer
- Shows "Cycle N of 4" label beneath the ring
- Auto-complete when timer reaches 0:00 — cycle is marked completed automatically with a success toast, no extra click needed

### Idle state (no active cycle)
- Prominent "Start Cycle N" button at the top of the page
- Shows "N of 4 cycles done" subtitle
- Today's cycle slots displayed below in a 2-column card grid

### Cycle progress display
- Today's 4 cycles shown as cards in a 2x2 grid (desktop), stacking to 1-column on mobile
- Each card shows: cycle number, status icon, and time info
  - Completed: checkmark + "45 min"
  - Active: play icon + "MM:SS left"
  - Paused: pause icon + "MM:SS left"
  - Pending: dot + "Pending"
  - Abandoned: X icon + "Abandoned"
- No extra info (start time, etc.) — keep it scannable

### Pause/Resume UX
- Resume button appears in BOTH the main action area (prominent) AND as a smaller button on the paused cycle card
- Two paths to the same action for discoverability

### All-complete state
- Green-accented celebration card: "All 4 cycles complete!" with total hours worked
- Nudge to submit daily report: "Great work! Don't forget to submit your daily report."
- CTA button: "Submit Daily Report" linking to /student/report
- No option to start extra cycles (V1 caps at 4)

### Student dashboard integration
- Personalized greeting: "Good morning/afternoon/evening, [FirstName]!"
- Work progress card showing: "N/4 cycles" + "X.Xh worked" + linear progress bar + adaptive CTA
- Adaptive CTA changes based on state:
  - Idle: "Start Cycle N" (links to /student/work)
  - Active: "Continue Cycle" (links to /student/work)
  - Paused: "Resume Cycle" (links to /student/work)
  - All 4 done: "Submit Report" (links to /student/report)
- Placeholder cards for Roadmap and Daily Report sections (Phase 4-5 will fill these)

### Claude's Discretion
- Timer ring size, colors, and animation details (use ima-* tokens)
- Exact cycle card styling and hover states
- Loading skeleton design for the work tracker page
- Abandon confirmation UX (modal vs inline — user skipped this area)
- Browser tab title updates during active timer
- Toast messages for cycle actions
- Stale session auto-abandon logic and timing
- Pause schema migration approach (adding paused_at column and paused status)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Work tracker requirements
- `.planning/REQUIREMENTS.md` — WORK-01 through WORK-06 define the 6 acceptance criteria
- `.planning/ROADMAP.md` — Phase 3 success criteria (timer persistence, pause/resume, max 4 cycles, abandon grace period)
- `.planning/PROJECT.md` — Work tracker rules (45-min sessions, 15-min breaks, 4 cycles/day, 5-min grace period)

### Configuration
- `src/lib/config.ts` — WORK_TRACKER config (sessionMinutes: 45, breakMinutes: 15, cyclesPerDay: 4, abandonGraceSeconds: 300)
- `src/lib/config.ts` — ROUTES.student.workTracker ("/student/work"), NAVIGATION for student role

### Reference implementation
- `reference-old/src/components/student/WorkTrackerClient.tsx` — Full work tracker client component (strip V2 features: focus mode, streaks, extra cycles, tiers)
- `reference-old/src/app/(dashboard)/student/page.tsx` — Student dashboard with work session queries and progress display (strip V2: leaderboard, player cards, deals)

### Database schema
- `supabase/migrations/00001_create_tables.sql` — work_sessions table (NOTE: missing paused_at column and "paused" status — migration needed)
- `src/lib/types.ts` — WorkSession TypeScript types (will need update for pause fields)

### Auth & session
- `src/lib/session.ts` — getSessionUser() helper for server components
- `src/lib/supabase/admin.ts` — createAdminClient() for server-side queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reference-old/src/components/student/WorkTrackerClient.tsx` — Complete implementation with progress ring, cycle cards, start/complete/pause/resume/abandon flows. Strip focus mode, streaks, extra cycles, tier references.
- `reference-old/src/app/(dashboard)/student/page.tsx` — Dashboard with DailyGoalRing, session queries, adaptive next-action CTA. Strip leaderboard, player cards, deals queries.
- `src/lib/config.ts` — WORK_TRACKER config already defined with all needed constants
- `src/lib/types.ts` — work_sessions Row/Insert/Update types already generated (need paused_at addition)

### Established Patterns
- Server components for reads, "use client" only for interactivity (timer countdown is client-side)
- Admin client for all server queries, user ID filtering for defense-in-depth
- API routes at `/api/` with Zod validation, auth + role check before validation
- Error passing and toast notifications for user feedback
- motion-safe: prefix on all animations, 44px touch targets, ARIA labels

### Integration Points
- `src/app/(dashboard)/student/page.tsx` — Existing placeholder dashboard, needs rewrite with work session data
- `src/app/(dashboard)/student/work/page.tsx` — New page needed (server component)
- `src/app/api/work-sessions/` — New API routes needed (start, complete, pause, abandon)
- Student nav already configured: "Work Tracker" -> "/student/work" with Timer icon

</code_context>

<specifics>
## Specific Ideas

- Timer uses circular SVG ring (like reference-old DailyProgressRing pattern) — visual and satisfying as it depletes
- Auto-complete at 0:00 is important — students shouldn't need to remember to click "Complete" after 45 minutes
- Dashboard CTA should feel contextual and smart — "Continue Cycle" when mid-session, "Start Cycle 3" when idle, "Submit Report" when all done
- Celebration card when all 4 cycles complete should nudge toward the daily report — creates the accountability loop

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-student-work-tracker*
*Context gathered: 2026-03-16*
