# Phase 22: Spike Protection & Rate Limiting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 22-spike-protection-rate-limiting
**Areas discussed:** Route coverage, Limit granularity, 429 error UX

---

## Route Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Student-facing only | Rate limit only work sessions, reports, and roadmap routes (per success criteria) | |
| All mutation routes | Rate limit all POST/PATCH/DELETE routes including admin (invites, magic-links, assignments, alert dismiss) | ✓ |

**User's choice:** All mutation routes (provided as note during area selection)
**Notes:** "An admin invite route getting hammered is just as bad. The cost of adding it everywhere is near zero since it's one checkRateLimit() call."

---

## Limit Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| 30 per endpoint per user | Each route gets its own 30/min budget per user. endpoint column in rate_limit_log tracks separately. | ✓ |
| 30 total per user | Single global counter across all endpoints. Simpler but one hot endpoint eats the budget. | |

**User's choice:** 30 per endpoint per user
**Notes:** "A student legitimately submits a report, starts a work session, and updates their roadmap in the same minute — that's 3 endpoints. A global 30 would be fine, but per-endpoint is cleaner and avoids one hot endpoint (like work session start/pause/resume) eating the budget for everything else."

---

## 429 Error UX

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with retry timing | Standard toast: "Too many requests, try again in X seconds" | ✓ |
| Full inline error state | Dedicated error component in the UI | |
| Browser error only | No special handling, just 429 status | |

**User's choice:** Toast with retry timing (provided as note during area selection)
**Notes:** "Toast with 'Too many requests, try again in X seconds' is standard."

---

## Claude's Discretion

- Table schema details (column types, constraints, index design)
- pg_cron cleanup schedule and retention window
- checkRateLimit() function signature and return type
- Migration file naming
- Atomic INSERT + COUNT implementation approach
- Retry-After header calculation

## Deferred Ideas

None — discussion stayed within phase scope.
