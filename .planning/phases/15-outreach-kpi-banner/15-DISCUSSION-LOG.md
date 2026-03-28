# Phase 15: Outreach KPI Banner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 15-outreach-kpi-banner
**Areas discussed:** RAG threshold logic

---

## RAG Threshold Logic

### Q1: How should 'on target' be calculated for lifetime outreach (X/2,500)?

| Option | Description | Selected |
|--------|-------------|----------|
| Pace-based (Recommended) | Expected = days_in_program x 50/day. Green if actual >= expected, amber >= 80%, red < 80%. | ✓ |
| Raw progress only | Just show X/2,500 as counter with no RAG on lifetime. RAG only on daily metrics. | |
| Fixed milestones | Hardcoded thresholds (green >= 1,500, amber >= 1,000, red < 1,000). Doesn't account for time in program. | |

**User's choice:** Pace-based (Recommended)
**Notes:** Naturally connects daily target (50/day) to lifetime target (2,500 over ~50 days). Formula: actual / (days_in_program x 50).

---

### Q2: Should RAG apply to ALL banner KPIs or only outreach totals?

| Option | Description | Selected |
|--------|-------------|----------|
| Outreach totals only | RAG on lifetime outreach (X/2,500) and daily outreach (X/50). Other KPIs show raw numbers. | |
| Outreach + hours | RAG on lifetime/daily outreach AND daily hours (X/4h). Calls, brands, influencers show raw numbers. | ✓ |
| All KPIs with targets | RAG on every KPI with a defined target. Would need targets for calls, brands, influencers too. | |

**User's choice:** Outreach + hours
**Notes:** Three KPIs get RAG treatment: lifetime outreach, daily outreach, daily hours. Other counters remain uncolored.

---

### Q3: For daily hours RAG, should thresholds follow the same pattern (green >= 100%, amber >= 80%, red < 80%)?

| Option | Description | Selected |
|--------|-------------|----------|
| Same pattern (Recommended) | Green >= 4h, amber >= 3h 12m (80%), red < 3h 12m. Consistent with outreach RAG rules. | ✓ |
| Softer thresholds | Green >= 3h, amber >= 2h, red < 2h. More forgiving for students learning habits. | |
| You decide | Claude picks reasonable thresholds based on the 4h daily goal. | |

**User's choice:** Same pattern (Recommended)
**Notes:** Uniform 100%/80% thresholds across all RAG indicators for consistency.

---

### Q4: How should day-zero be handled (student joined today, 0 expected outreach)?

| Option | Description | Selected |
|--------|-------------|----------|
| Green on day zero | Default to green if expected is 0. Student hasn't fallen behind yet. | |
| Neutral/no color on day zero | Show raw number with no RAG color until student has 1 full day. | ✓ |
| Count from day 1 | Use max(1, days_in_program) so there's always a 50-outreach expectation from start. | |

**User's choice:** Neutral/no color on day zero
**Notes:** RAG kicks in after 1 full day in program. Clean edge case handling.

---

## Claude's Discretion

- Report form layout (5 numeric fields organization)
- Banner layout and stickiness behavior
- Homepage KPI cards integration with existing dashboard
- Legacy outreach_count column handling

## Deferred Ideas

None — discussion stayed within phase scope.
