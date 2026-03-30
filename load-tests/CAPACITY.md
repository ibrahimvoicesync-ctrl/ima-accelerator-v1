# IMA Accelerator V1 - Capacity Report

**Date:** [YYYY-MM-DD]
**Phase:** 24 - Infrastructure & Validation
**Staging project:** [Supabase project ref]
**Compute tier:** [Micro/Small/Medium/Large — must match production per D-01]

## Test Environment

| Property | Value |
|----------|-------|
| Staging Supabase URL | [url] |
| Compute tier | [tier] |
| max_connections | [from pg_settings] |
| Region | [region] |
| k6 version | v1.7.0 |
| Test runner location | [local machine / cloud] |

## Seed Data

| Table | Row Count |
|-------|-----------|
| users (students) | ~5,000 |
| users (coaches) | 10 |
| users (owner) | 1 |
| daily_reports | ~450,000 |
| work_sessions | ~150,000-450,000 |
| roadmap_progress | ~50,000 |

## Scenario Results

### Scenario 1: Owner Dashboard Read Mix

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| P50 latency | [ms] | — | — |
| P95 latency | [ms] | < 1000ms (D-11) | [ ] |
| P99 latency | [ms] | — | — |
| Error rate | [%] | < 1% | [ ] |
| Peak VUs | [N] | — | — |
| Duration | [min] | — | — |

### Scenario 2: Student Write Spike (11 PM Simulation)

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| P50 latency | [ms] | — | — |
| P95 latency | [ms] | < 1000ms (D-11) | [ ] |
| P99 latency | [ms] | — | — |
| Error rate | [%] | < 1% | [ ] |
| Peak VUs | [N] | — | — |
| Duration | [min] | — | — |
| 429 responses | [count] | — | — |

### Scenario 3: Combined (Read + Write)

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| P50 latency | [ms] | — | — |
| P95 latency | [ms] | < 1000ms (D-11) | [ ] |
| P99 latency | [ms] | — | — |
| Error rate | [%] | < 1% | [ ] |
| Peak VUs | [N] | — | — |
| Duration | [min] | — | — |

## Connection Usage (D-12)

Captured from Supabase dashboard during peak write spike scenario (D-16).

| Metric | Value | Threshold | Pass? |
|--------|-------|-----------|-------|
| Total connections at peak | [N] | — | — |
| Active connections at peak | [N] | — | — |
| max_connections | [N] | — | — |
| Usage % at peak | [%] | < 70% (D-12) | [ ] |

SQL query used (run during spike):

```sql
SELECT count(*) AS total_connections,
       count(*) FILTER (WHERE state = 'active') AS active,
       count(*) FILTER (WHERE state = 'idle') AS idle,
       (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
       round(count(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 1) AS pct_used
FROM pg_stat_activity WHERE datname = current_database();
```

## Rate Limiter Verification (D-17)

Queried from rate_limit_log after test completion.

| Endpoint | Total Calls | Unique Users | 429 Count |
|----------|-------------|--------------|-----------|
| /api/reports | [N] | [N] | [N] |
| /api/work-sessions | [N] | [N] | [N] |

SQL query used:

```sql
SELECT endpoint, count(*) AS total_calls, count(DISTINCT user_id) AS unique_users
FROM rate_limit_log WHERE called_at > now() - interval '30 minutes'
GROUP BY endpoint ORDER BY total_calls DESC;
```

## pg_stat_statements — Top 10 Slowest Queries

Captured after load test completion.

| Query (truncated) | Calls | Mean (ms) | P95 approx (ms) | Total (ms) |
|-------------------|-------|-----------|-----------------|------------|
| [query] | [N] | [N] | [N] | [N] |

SQL query used to capture:

```sql
SELECT
  LEFT(query, 120)                                                       AS query,
  calls,
  round((mean_exec_time)::numeric, 1)                                    AS mean_ms,
  round((mean_exec_time * 1.5)::numeric, 1)                             AS p95_approx_ms,
  round((total_exec_time)::numeric, 0)                                   AS total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Reset pg_stat_statements before running load tests (requires superuser):

```sql
SELECT pg_stat_statements_reset();
```

## Redis/Upstash Evaluation (D-13)

| Condition | Result | Met? |
|-----------|--------|------|
| unstable_cache miss rate > 30% | [%] | [ ] |
| P95 exceeds 1s | [ms] | [ ] |
| **Both conditions met (Redis required)?** | — | [ ] |

Per D-13: Redis/Upstash adoption requires BOTH conditions. If only one is met, Redis is not adopted.

To measure unstable_cache miss rate: add temporary logging in `src/app/(dashboard)/owner/` server components to count cache hits vs. misses via tags, or check Supabase query logs for repeated identical queries during the read-mix scenario.

## Compute Sizing Decision (D-12, INFRA-03)

**Current tier:** [tier]
**Recommendation:** [STAY / UPGRADE to {tier}]
**Rationale:** [Based on connection usage %, P95 latency, error rates]

This decision will be written to `.planning/PROJECT.md` Key Decisions table.

---

## Notes

- Staging project must use the same compute tier and region as production (D-01)
- Do not tear down the staging project after testing — keep for v1.3+ regression (D-03)
- Connection monitoring is manual capture from Supabase dashboard during peak spike (D-16)
- k6 binary location on Windows: `C:\Program Files\k6\k6.exe`
- Run k6 as: `"/c/Program Files/k6/k6.exe" run load-tests/scenarios/<file>.js`
