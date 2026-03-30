# Phase 24: Infrastructure & Validation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The platform is validated under realistic 5,000-student load, connection and query capacity headroom is documented, and compute sizing is confirmed or adjusted. This is the final phase of v1.2 — all optimizations (indexes, RPC consolidation, caching, pg_cron aggregation, rate limiting, security hardening) are already in place.

</domain>

<decisions>
## Implementation Decisions

### Test Environment
- **D-01:** Separate staging Supabase project, same compute tier and region as production. Do NOT run against production — risks data pollution and hitting real rate limits.
- **D-02:** Local Supabase is excluded — won't give realistic latency numbers or PostgREST connection pooling behavior.
- **D-03:** Keep the staging project after Phase 24 for future v1.3+ regression testing. Do not tear down.

### Auth & Rate Limit Strategy
- **D-04:** Generate one JWT per seeded student (5,000 tokens total) using the service_role key. Each k6 VU gets a unique user's token so it has its own rate limit bucket per endpoint. This avoids the rate limiter (30 req/min/user) becoming the bottleneck instead of the DB.
- **D-05:** Bypass Supabase Auth login flow entirely — pre-generated static JWTs avoid Pitfall 14 (Auth rate limits on test accounts). Test the API layer, not the Auth layer.

### Seed Data
- **D-06:** SQL seed script generates 5,000 students with ~90 days of reports (~500k rows in daily_reports, proportional rows in work_sessions and roadmap_progress).
- **D-07:** Realistic distribution — 80% of daily report timestamps clustered in the 9-11 PM UTC window to simulate the real submission spike pattern.
- **D-08:** Seed script also creates coach and owner users for dashboard read scenarios.

### Load Test Scenarios
- **D-09:** Scenarios per requirements: owner dashboard read mix (RPC calls, paginated lists, badge counts), student 11 PM write spike (report submission + work session start/complete), and mixed traffic combining both.
- **D-10:** k6 v1.7.0 standalone CLI (not npm package) — confirmed in v1.2 research as the tool Supabase uses internally.

### Pass/Fail Thresholds
- **D-11:** P95 latency must be under 1 second for all endpoints during load test.
- **D-12:** Connection usage above 70% of max_connections during spike triggers a compute tier upgrade decision.
- **D-13:** Redis/Upstash go/no-go requires BOTH conditions met: unstable_cache miss rate > 30% under load AND P95 exceeds 1s. If only one condition is met, Redis is not adopted.
- **D-14:** All threshold numbers are documented in the capacity report so decisions are objective, not subjective.

### Monitoring
- **D-15:** k6 natively captures P50/P95/P99 latencies and throughput metrics.
- **D-16:** Connection counts and pool usage captured from Supabase dashboard during test runs (manual capture, not automated polling).
- **D-17:** Rate limiter trigger counts verified by querying rate_limit_log table after test completion.

### Claude's Discretion
- k6 script structure and VU ramp profiles (stages, duration, concurrency)
- Exact seed script implementation details (SQL functions, batch sizes, random data generation)
- Capacity document format and layout
- Whether to use k6 cloud or local execution
- pg_stat_statements queries to capture before/during/after metrics
- Migration file naming for any staging-specific setup

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Load Testing Strategy
- `.planning/research/SUMMARY.md` — Phase 24 rationale, k6 usage, JWT strategy, seed data sizing, PostgREST pool notes
- `.planning/research/PITFALLS.md` — Pitfall 14 (Auth rate limits during load testing), Pitfall 8 (PostgREST pool exhaustion), Pitfall 3 (rate limiter cross-container verification)
- `.planning/research/ARCHITECTURE.md` — Rate limiting architecture pattern, Redis evaluation criteria

### Infrastructure Context
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-03 requirements
- `.planning/PROJECT.md` — Key Decisions table (compute sizing decision goes here), Out of Scope (Redis/Upstash evaluation criteria)

### Prior Phase Outputs
- `.planning/phases/19-database-foundation/19-CONTEXT.md` — Indexes, singleton admin client, monitoring baseline
- `.planning/phases/22-spike-protection-rate-limiting/22-CONTEXT.md` — Rate limiting implementation details (30 req/min/user/endpoint)
- `src/lib/rate-limit.ts` — checkRateLimit() implementation
- `src/lib/supabase/admin.ts` — Singleton admin client
- `supabase/migrations/00012_rate_limit_log.sql` — Rate limit table schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/rate-limit.ts`: checkRateLimit() — load tests interact with this; verify it works correctly under concurrent VU load
- `src/lib/supabase/admin.ts`: Singleton admin client — JWT generation for k6 can use the same service_role key pattern
- `supabase/config.toml`: Local Supabase config — reference for staging project setup

### Established Patterns
- All 10 mutation routes use checkRateLimit() with consistent pattern (auth → rate limit → validate → execute)
- RPC functions: get_owner_dashboard_stats, get_sidebar_badges, get_student_detail — these are the read path targets
- Server-side pagination with .range() on owner student/coach list pages
- unstable_cache with 60s TTL on badge counts

### Integration Points
- 12 API routes as load test targets (10 mutation + calendar GET + auth callback)
- Dashboard pages use RPC functions — read path load tests hit these RPCs
- pg_cron nightly job (student_kpi_summaries) — verify it runs correctly with 500k rows
- rate_limit_log table — verify cleanup pg_cron job handles volume from load testing

</code_context>

<specifics>
## Specific Ideas

- Rate limiter must be tested across concurrent VUs to verify DB-backed approach works across serverless containers (not just in isolation)
- 80% of report timestamps in 9-11 PM window is the key realism factor — this is what makes the write spike test meaningful
- Capacity document should be version-controlled in the phase directory (not just a dashboard screenshot)
- The compute sizing decision (stay/upgrade + rationale) must be written into PROJECT.md Key Decisions table per success criteria

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-infrastructure-validation*
*Context gathered: 2026-03-30*
