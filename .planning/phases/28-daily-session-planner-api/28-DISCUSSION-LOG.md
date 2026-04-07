# Phase 28: Daily Session Planner API - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 28-daily-session-planner-api
**Areas discussed:** Cap enforcement logic

---

## Gray Areas Presented

| Area | Selected |
|------|----------|
| plan_json schema shape | Skipped — Claude's discretion |
| Cap enforcement logic | ✓ |
| API response design | Skipped — Claude's discretion |

---

## Cap Enforcement Logic

### Q1: Which areas do you want to discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| plan_json schema shape | Data contract: fields per session, top-level shape | |
| Cap enforcement logic | How POST /api/work-sessions detects plan completion, when cap applies vs bypassed | ✓ |
| API response design | Status codes, payloads, error shapes | |

**User's choice:** Cap enforcement logic only. User provided the full enforcement model upfront:
- No plan today → must create plan before any session
- Plan exists + sessions remaining → enforce cap
- Plan exists + all sessions done → unlimited ad-hoc sessions
- The plan is a one-time daily planning step for the first 4h of work

**Notes:** User explicitly said "Skip 1 und 3 — GSD kann das Schema und die Response-Shapes selbst designen" (Claude can design the schema and response shapes).

### Q2: Should the API enforce sequential session order?

| Option | Description | Selected |
|--------|-------------|----------|
| Cap only (Recommended) | API checks total minutes vs plan total. Client handles ordering. | ✓ |
| Enforce order server-side | API tracks session index, rejects skipped sessions. | |

**User's choice:** Cap only (Recommended)
**Notes:** Keeps API simple; Phase 29 client handles session sequencing in the UI.

### Q3: No plan → block: always require plan, or feature flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Always require plan (Recommended) | Once deployed, every student needs a daily plan. | |
| Require plan only if feature flag | Config toggle for gradual rollout. | |

**User's choice:** Other — clarified that the plan is required only for the first 4h of work each day. Not a feature flag, not always required before every session. It's a one-time daily planning step.

---

## Claude's Discretion

- plan_json Zod schema shape (user explicitly deferred)
- API response design: status codes, payloads, error shapes (user explicitly deferred)
- Detection strategy for "plan complete" (count completed sessions vs plan entries)

## Deferred Ideas

None — discussion stayed within phase scope
