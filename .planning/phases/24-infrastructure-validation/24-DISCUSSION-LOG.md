# Phase 24: Infrastructure & Validation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 24-infrastructure-validation
**Areas discussed:** Test environment, Pass/fail thresholds

---

## Test Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Production Supabase (test data) | Run against real project with test data | |
| Separate staging project | Same compute tier and region as production | ✓ |
| Local Supabase | supabase start for local testing | |

**User's choice:** Separate staging Supabase project, same compute tier as production
**Notes:** Testing against production risks polluting real data and hitting real rate limits. Local won't give realistic latency numbers. A staging project with the same region and compute tier gives real PostgREST behavior without risk.

---

## Seed Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| SQL seed script | Direct SQL with realistic distributions | ✓ |
| Node.js seeder | Programmatic seeding via Supabase client | |

**User's choice:** SQL seed script (user deferred details to Claude)
**Notes:** 80% of reports clustered in the 9-11 PM window to simulate real submission patterns. User stated "GSD can generate this."

---

## Load Test Scenarios

**User's choice:** Deferred to requirements (already defined)
**Notes:** Dashboard reads + 11 PM write spike + mixed traffic. User stated "the scenarios are already defined in the requirements."

---

## Pass/Fail Thresholds

| Option | Description | Selected |
|--------|-------------|----------|
| P95 < 500ms | Strict latency target | |
| P95 < 1s | Standard latency target | ✓ |
| P95 < 2s | Relaxed latency target | |

**User's choice:** P95 under 1s for all endpoints
**Notes:** Connection usage above 70% of max_connections during spike triggers compute upgrade. Redis go/no-go requires BOTH conditions: unstable_cache miss rate > 30% under load AND P95 exceeds 1s. Document these numbers in the capacity report so they're not subjective later.

---

## Additional Suggestions (Claude-initiated)

| Suggestion | Description | Selected |
|-----------|-------------|----------|
| 1 JWT per student | 5k JWTs so each VU gets own rate limit bucket | ✓ |
| Dashboard monitoring | Manual Supabase dashboard capture for connection counts | ✓ |
| Keep staging project | Retain for v1.3+ regression testing | ✓ |

**User's choice:** All three accepted
**Notes:** None — user selected all suggestions without modification.

---

## Claude's Discretion

- k6 script structure, VU ramp profiles, stages, duration
- Exact seed script SQL implementation
- Capacity document format and layout
- k6 cloud vs local execution
- pg_stat_statements query design
- Migration file naming

## Deferred Ideas

None — discussion stayed within phase scope.
