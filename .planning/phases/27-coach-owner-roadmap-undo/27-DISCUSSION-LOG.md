# Phase 27: Coach/Owner Roadmap Undo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 27-coach-owner-roadmap-undo
**Areas discussed:** Cascade warning UX

---

## Cascade Warning UX

| Option | Description | Selected |
|--------|-------------|----------|
| Warn about cascade | If step N+1 is active, dialog includes "Step Y will also be re-locked" | ✓ |
| Simple text only | Always use UNDO-03 text regardless of cascade | |

**User's choice:** Warn about cascade — dialog should say: "Are you sure you want to reset Step X back to active? Step Y (currently active) will also be re-locked."
**Notes:** User specified the exact dialog text pattern for cascade scenarios.

---

## Claude's Discretion

- **Undo button placement:** User confirmed inline icon button, left to Claude's discretion for exact styling
- **Post-undo feedback:** User confirmed toast notification + re-render, standard pattern
- **Error handling:** User confirmed toast error + modal closes, standard pattern

## Deferred Ideas

None — discussion stayed within phase scope
