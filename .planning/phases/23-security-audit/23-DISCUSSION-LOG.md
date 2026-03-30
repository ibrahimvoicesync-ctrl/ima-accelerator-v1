# Phase 23: Security Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 23-security-audit
**Areas discussed:** Report-then-fix workflow, Audit depth

---

## Report-then-Fix Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Two-pass (report then fixes) | Audit report first with no code changes, fixes applied after human sign-off | ✓ |
| Combined (report + fixes together) | Produce report and apply fixes in one pass | |

**User's choice:** Two-pass approach — audit report first, fixes after explicit approval.
**Notes:** "If you combine them, you're approving changes you haven't seen yet, which defeats the human-review flag." Maps to two separate plans with HALT gate between them.

---

## Audit Depth

| Option | Description | Selected |
|--------|-------------|----------|
| API routes only (12 routes) | Per success criteria, audit only route handlers | |
| API routes + proxy + RLS | Three-layer defense-in-depth audit | ✓ |
| Full stack (including server components) | All layers including RSC data fetches | |

**User's choice:** All 12 API routes + proxy route guard + RLS policies — three-layer audit.
**Notes:** "Server components are less critical since they run server-side only, but RLS policies are your last line of defense if an API route auth check is ever bypassed. The audit doc should cover all three layers: route handlers -> proxy guard -> RLS. That's the whole defense-in-depth chain."

---

## Skipped Areas

### CSRF Implementation
**Reason:** "CSRF Origin matching is standard implementation" — deferred to Claude's discretion.

### Cross-Student Isolation Edge Cases
**Reason:** "Cross-student isolation edge cases are exactly what the audit should discover, not pre-define."

---

## Claude's Suggestions (Accepted)

1. **Severity classification** — Each finding gets Critical / High / Medium / Info severity for prioritized review.
2. **Two-plan structure** — Plan 1 = audit report (read-only), Plan 2 = remediation. HALT gate between them.
3. **DB-03 fold-in** — Verify RLS initplan optimization as part of the RLS audit layer, closing the orphaned DB-03 requirement.

## Deferred Ideas

None — discussion stayed within phase scope.
