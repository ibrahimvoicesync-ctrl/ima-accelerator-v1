# Phase 13: Schema & Config Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 13-schema-config-foundation
**Areas discussed:** Cycle constraint

---

## Gray Areas Presented (Selection Step)

| Area | Description | Selected |
|------|-------------|----------|
| Migration organization | One combined v1.1 migration file vs. separate files per table | |
| Existing data backfill | How to handle session_minutes for past sessions and outreach columns for past reports | |
| Roadmap target_days | Placeholder values for 10 roadmap steps until Abu Lahya confirms | |
| Cycle constraint | UNIQUE index on (student_id, date, cycle_number) with unlimited cycles | ✓ |

---

## Cycle Constraint

| Option | Description | Selected |
|--------|-------------|----------|
| Sequence counter (Recommended) | Drop CHECK(1-4), keep cycle_number + UNIQUE index. Becomes 1,2,3,4,5... per day. Minimal migration, existing queries still work. | ✓ |
| Drop column entirely | Remove cycle_number, rely on started_at ordering. Cleaner schema but breaks existing queries and UNIQUE index. More migration + code changes. | |
| You decide | Let Claude pick the best approach based on codebase impact and simplicity. | |

**User's choice:** Sequence counter (Recommended)
**Notes:** None — straightforward selection.

---

## Claude's Discretion

- Migration file organization (single vs. separate)
- Backfill strategy for existing data
- Config structure for new exports
- Roadmap target_days placeholder values

## Deferred Ideas

None — discussion stayed within phase scope.
