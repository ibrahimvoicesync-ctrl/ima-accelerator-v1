# Phase 16: Coach/Owner KPI Visibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 16-coach-owner-kpi-visibility
**Areas discussed:** Data freshness, Roadmap step context

---

## Data freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time (Recommended) | Same as student view — hours from work_sessions sum, outreach from daily_reports. Coach sees live progress even before the student submits today's report. Consistent with what the student sees in their ProgressBanner. | ✓ |
| Report-submitted only | KPIs only reflect data from submitted daily_reports. Simpler queries, but coach can't see today's work until the student submits. Hours would come from the report's hours_worked field, not live session sums. | |
| Hybrid | Hours real-time from work_sessions (visible effort), but outreach only from submitted reports (student self-reports these). Matches data origin: hours are system-tracked, outreach is self-reported. | |

**User's choice:** Real-time (Recommended)
**Notes:** None — straightforward selection.

---

## Roadmap step context

| Option | Description | Selected |
|--------|-------------|----------|
| Step number + name | Simple: "Step 5: Outreach DMs" — just identifies where the student is. Minimal, clean. | |
| Step + progress fraction | "Step 5 of 10: Outreach DMs" — adds context of how far through the roadmap they are overall. | |
| Step + progress bar | Step name plus a small visual progress indicator. More visual but takes more space. | |

**User provided actual roadmap data (15 steps, 3 stages) before answering.** Question was re-presented with stage-aware options:

| Option | Description | Selected |
|--------|-------------|----------|
| Stage + step name | "Stage 2: Influencer Outreach — Step 9: Get First Reply" — shows both where in the journey and the specific step. | ✓ |
| Step fraction + name | "Step 9 of 15: Get First Reply" — simple progress indicator. No stage label. | |
| Stage + step + fraction | "Stage 2 — Step 9 of 15: Get First Reply" — full context. Most informative but longest. | |

**User's choice:** Stage + step name
**Notes:** User shared full 15-step roadmap with 3 stages, day-based deadlines for early steps, and unlock_urls.

---

## Claude's Discretion

- KPI card placement on student detail pages (user did not select this area)
- Component approach — reuse ProgressBanner or create new component (user did not select this area)

## Deferred Ideas

None — discussion stayed within phase scope.
