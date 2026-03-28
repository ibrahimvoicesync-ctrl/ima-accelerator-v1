# Phase 18: Roadmap Date KPIs & Completion Logging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 18-roadmap-date-kpis-completion-logging
**Areas discussed:** No-deadline steps, Deadline calc edge cases

---

## No-deadline steps

### Q1: What should display for steps with no deadline (Steps 8-15)?

| Option | Description | Selected |
|--------|-------------|----------|
| No chip at all | Steps without target_days show only active/locked/completed status. Clean and honest. | ✓ |
| Neutral 'Open-ended' chip | Gray chip saying 'No deadline' or 'Open-ended' on every step. More consistent but noisy. | |
| Milestone-only chip | Neutral 'Milestone' badge for Stage 2-3 to distinguish from deadline-driven Stage 1. | |

**User's choice:** No chip at all (Recommended)
**Notes:** None

### Q2: For completed no-deadline steps, should completed_at still display?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, always show date | All completed steps show 'Completed [date]' regardless of deadline. Consistent and useful for velocity. | ✓ |
| Only for deadline steps | completed_at only on Stage 1 steps. Stage 2-3 just show 'Completed' badge. | |

**User's choice:** Yes, always show date (Recommended)
**Notes:** None

---

## Deadline calc edge cases

### Q3: Should completed steps that were overdue show that they were late?

| Option | Description | Selected |
|--------|-------------|----------|
| Just 'Completed [date]' | Green 'Completed' with date, no shaming. Overdue only matters while active. | |
| Show 'Completed (late)' | Amber/red indicator for late completions. Coaches see timing struggles. | |
| Completed + days late count | 'Completed [date] (X days late)' — factual without being punitive. | ✓ |

**User's choice:** Completed + days late count
**Notes:** User re-asked this question after initially selecting "Just Completed [date]". Changed to factual days-late count for coach pattern visibility.

### Q4: Steps 1-3 have target_days: 0 (due on join day). How to handle day-zero?

| Option | Description | Selected |
|--------|-------------|----------|
| Show overdue honestly | target_days: 0 means do it on day 1. Red chip motivates action. | ✓ |
| Grace period (1 day buffer) | Add 1 day before overdue. Prevents red chips on first login. | |
| Show 'Due Today' instead | Amber 'Due Today' on join day, overdue the next day. Softer onboarding. | |

**User's choice:** Show overdue honestly (Recommended)
**Notes:** None

---

## Claude's Discretion

- Status chip visual design (not discussed — user deferred to Claude)
- Coach/owner roadmap parity (not discussed — user deferred to Claude)
- Deadline calculation utility location
- RoadmapTab progress bar denominator fix (10 → 15)

## Deferred Ideas

None — discussion stayed within phase scope
