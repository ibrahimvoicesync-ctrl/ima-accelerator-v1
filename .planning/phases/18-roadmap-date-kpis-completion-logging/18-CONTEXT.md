# Phase 18: Roadmap Date KPIs & Completion Logging - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Students, coaches, and owners can see whether each roadmap step is on schedule and when completed steps were finished. Delivers ROAD-02 through ROAD-05: status chips (on-track/due-soon/overdue) on deadline steps, completed_at date display on all completed steps, visible on student roadmap view AND coach/owner student detail roadmap tabs.

</domain>

<decisions>
## Implementation Decisions

### No-deadline steps (Steps 8-15)
- **D-01:** Steps with `target_days: null` (Stage 2: Influencer Outreach, Stage 3: Brand Outreach) show NO deadline chip at all. Only the existing active/locked/completed status displays. These steps are achievement-based, not time-based.
- **D-02:** Completed no-deadline steps still display `completed_at` date — all completed steps show "Completed [date]" regardless of whether they had a deadline. Useful for velocity tracking.

### Deadline calculation edge cases
- **D-03:** Completed steps that were past deadline show "Completed [date] (X days late)" — factual count of days past deadline. Gives coaches pattern visibility without punitive styling.
- **D-04:** `target_days: 0` steps (Steps 1-3) show overdue honestly if not completed on join day. These are quick setup tasks — the red chip motivates immediate action. No grace period.
- **D-05:** Overdue state only applies to non-completed steps for chip color purposes (on-track green, due-soon amber, overdue red). Once completed, the chip is always green "Completed" — the "(X days late)" suffix is the only late indicator.

### Claude's Discretion
- Status chip visual design — how to upgrade from current red "Due [date]" text in RoadmapStep.tsx to proper colored Badge chips (on-track green, due-soon amber within 2 days, overdue red). Existing `Badge` component with `variant` prop is available.
- Coach/owner roadmap upgrade — RoadmapTab.tsx currently shows no deadline info. Claude decides whether to reuse RoadmapStep component, extend RoadmapTab inline, or create a shared sub-component. Key constraint: coach/owner view is read-only (no "Mark Complete" button).
- Deadline calculation utility — whether to add functions to `kpi.ts`, create a new `roadmap-utils.ts`, or compute inline. Must use `getTodayUTC()` for all date math.
- Progress bar denominator — RoadmapTab currently hardcodes `/10 steps`; should be updated to `/15 steps` to match the expanded ROADMAP_STEPS.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — ROAD-02 (status chips), ROAD-03 (completed_at display), ROAD-04 (student visibility), ROAD-05 (coach/owner visibility)

### Prior Phase Context
- `.planning/phases/13-schema-config-foundation/13-CONTEXT.md` — Phase 13 decisions on target_days in config, getTodayUTC() utility, placeholder values
- `.planning/phases/16-coach-owner-kpi-visibility/16-CONTEXT.md` — Phase 16 decisions on 15-step roadmap structure, 3 stages, stage names, RAG color pattern

### Roadmap Config
- `src/lib/config.ts` — `ROADMAP_STEPS` array with `target_days`, `stage`, `stageName` per step; `ROADMAP_CONFIG.deadlineHour`

### Existing Roadmap Components
- `src/components/student/RoadmapStep.tsx` — Student roadmap step component with basic deadline display (red "Due [date]" text, "Completed [date]" badge). This is the primary file to upgrade with status chips.
- `src/components/student/RoadmapClient.tsx` — Student roadmap page client component that renders RoadmapStep list
- `src/components/coach/RoadmapTab.tsx` — Coach/owner roadmap tab (simple list, NO deadline info, hardcoded /10 steps). Needs deadline + completed_at additions.

### Utilities
- `src/lib/utils.ts` — `getTodayUTC()` for UTC date math (MUST be used for all deadline calculations)
- `src/lib/kpi.ts` — RAG color functions (`ragToColorClass`, `ragToBgClass`) — pattern reference for status chip coloring

### Critical Implementation Notes
- `.planning/STATE.md` §Accumulated Context — getTodayUTC() formula, target_days placeholder values pending Abu Lahya confirmation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` component with `variant` prop (success, default, etc.) — use for status chips
- `getTodayUTC()` in `src/lib/utils.ts` — UTC date utility for deadline math
- `ragToColorClass` / `ragToBgClass` in `kpi.ts` — established RAG color pattern (can inform chip color approach)
- `RoadmapStep.tsx` already computes `deadlineDate` from `joinedAt + target_days` — extend this logic for status determination
- `Calendar` icon from lucide-react already imported in RoadmapStep

### Established Patterns
- `ROADMAP_STEPS` config is the single source of truth for step metadata including `target_days`
- Server components for reads, client components only for interactivity
- `createAdminClient()` for server-side queries
- ima-* design tokens for all colors (ima-success for green, ima-warning for amber, ima-danger for red)

### Integration Points
- Student roadmap page: `src/app/(dashboard)/student/roadmap/page.tsx` — server page that fetches roadmap_progress and passes to RoadmapClient
- Coach student detail: `src/app/(dashboard)/coach/students/[studentId]/page.tsx` — fetches roadmap data, passes to StudentDetailClient which renders RoadmapTab
- Owner student detail: `src/app/(dashboard)/owner/students/[studentId]/page.tsx` — same pattern as coach
- Both coach/owner pages already have `joined_at` available from the student query

</code_context>

<specifics>
## Specific Ideas

- "(X days late)" suffix on completed-but-overdue steps is factual, not punitive — coaches see patterns without it feeling like a warning
- Day-zero steps (target_days: 0) are deliberately shown as overdue immediately — these are quick setup tasks that should be done on join day

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-roadmap-date-kpis-completion-logging*
*Context gathered: 2026-03-28*
