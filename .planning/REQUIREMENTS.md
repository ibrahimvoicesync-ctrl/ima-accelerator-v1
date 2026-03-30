# Requirements: IMA Accelerator

**Defined:** 2026-03-29
**Core Value:** Students can track their daily work, follow the 10-step roadmap, and submit daily reports that coaches review — the core accountability loop.

## v1.2 Requirements

Requirements for milestone v1.2 (Performance, Scale & Security for 5,000 Students). Each maps to roadmap phases.

### Database & Monitoring

- [x] **DB-01**: Composite indexes exist on daily_reports(student_id, date), work_sessions(student_id, date, status), roadmap_progress(student_id) — verified with EXPLAIN ANALYZE
- [x] **DB-02**: createAdminClient() is a module-level singleton reused across requests within the same process
- [ ] **DB-03**: All RLS policies use (SELECT auth.uid()) instead of auth.uid() for initplan optimization
- [ ] **DB-04**: pg_stat_statements enabled, slow queries >200ms logged, baseline metrics recorded before and after index changes

### Query Optimization

- [x] **QUERY-01**: Dashboard layout owner path consolidated to ≤2 DB round trips via Postgres RPC functions (down from 8)
- [x] **QUERY-02**: Student detail pages (coach/owner views) consolidated via Postgres RPC (down from 9-11 parallel queries)
- [x] **QUERY-03**: React cache() wrappers on server component data fetches deduplicate within RSC render tree
- [ ] **QUERY-04**: Dashboard badge count computations use unstable_cache with 60s TTL (revalidate=N broken on auth routes due to cookies())
- [x] **QUERY-05**: Owner student list page is server-side paginated with Supabase .range() and total count
- [x] **QUERY-06**: Owner coach list page is server-side paginated with Supabase .range() and total count

### Write Path

- [ ] **WRITE-01**: pg_cron nightly aggregation job pre-computes KPI summaries into a summary table after the 11 PM submission window (UTC-aware scheduling, advisory lock protected, idempotent upsert)
- [ ] **WRITE-02**: Student daily report submission uses optimistic UI via React 19 useOptimistic for instant feedback
- [ ] **WRITE-03**: Write path audit documents report/session API call counts and confirms no unnecessary round trips

### Security & Protection

- [ ] **SEC-01**: DB-backed rate limiting on mutation API routes enforces 30 requests/minute per user via Supabase table (in-memory breaks in serverless)
- [ ] **SEC-02**: Every API route's auth check and role verification is documented and verified correct
- [ ] **SEC-03**: All mutation route handlers verify Origin header for CSRF protection
- [ ] **SEC-04**: Cross-student data isolation verified — no student can access another student's data via param manipulation

### Infrastructure & Validation

- [ ] **INFRA-01**: k6 load test simulates 5k students with dashboard read mix and 11 PM write spike
- [ ] **INFRA-02**: Connection usage, query times, and capacity headroom are documented
- [ ] **INFRA-03**: Supabase compute add-on is right-sized based on load test data

## v1.1 Requirements (Completed)

All 29 requirements completed. See .planning/milestones/ for archived details.

### Work Sessions — 9/9 complete
### Outreach KPIs — 7/7 complete
### Coach/Owner Visibility — 4/4 complete
### Calendar — 4/4 complete
### Roadmap — 5/5 complete

## Future Requirements

Deferred to v1.3+. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: Days-to-target projection on KPI banner ("At current pace, you'll hit 2,500 in ~47 days")
- **ENH-02**: Roadmap completion velocity label ("Steps 1-5 in 12 days, target: 21 days")
- **ENH-03**: Session volume intensity shading on calendar cells (GitHub-style heat map)
- **ENH-04**: Joined-date marker on calendar
- **ENH-05**: Break duration proportional to session length (30 min → 10 min break, 60 min → 20 min)
- **ENH-06**: Session count badge replacing cycle count display
- **ENH-07**: Redis/Upstash cache layer (evaluate only if Phase 24 load testing proves Next.js cache insufficient)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Supavisor/connection pooler setup | PostgREST has built-in connection pooler |
| Redis/Upstash cache | Evaluate only if Phase 24 load testing proves insufficient |
| In-memory rate limiting (lru-cache) | Silently broken in serverless — each container has isolated state |
| export const revalidate on auth routes | cookies() makes routes dynamic; ISR cannot apply — use unstable_cache |
| Switching API routes from admin to user client | Risk of breaking ownership-check patterns; defense-in-depth approach is correct |
| Free-form duration input (text field) | v1.1 out of scope carry-over |
| Per-student custom KPI targets | Program-wide targets; per-cohort targets are V2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 19 | Complete |
| DB-02 | Phase 19 | Complete |
| DB-03 | Phase 19 | Pending |
| DB-04 | Phase 19 | Pending |
| QUERY-01 | Phase 20 | Complete |
| QUERY-02 | Phase 20 | Complete |
| QUERY-03 | Phase 20 | Complete |
| QUERY-04 | Phase 20 | Pending |
| QUERY-05 | Phase 20 | Complete |
| QUERY-06 | Phase 20 | Complete |
| WRITE-01 | Phase 21 | Pending |
| WRITE-02 | Phase 21 | Pending |
| WRITE-03 | Phase 21 | Pending |
| SEC-01 | Phase 22 | Pending |
| SEC-02 | Phase 23 | Pending |
| SEC-03 | Phase 23 | Pending |
| SEC-04 | Phase 23 | Pending |
| INFRA-01 | Phase 24 | Pending |
| INFRA-02 | Phase 24 | Pending |
| INFRA-03 | Phase 24 | Pending |

**Coverage:**
- v1.2 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — traceability populated after roadmap creation*
