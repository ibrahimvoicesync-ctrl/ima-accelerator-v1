# Phase 21: Write Path & Pre-Aggregation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 21-write-path-pre-aggregation
**Areas discussed:** Summary table scope, Aggregation strategy

---

## Summary Table Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (outreach totals only) | Just total_brands_contacted, total_influencers_contacted | |
| Comprehensive (all KPIs) | All repeatedly-queried aggregates: outreach, hours, calls, reports, streak, last active | ✓ |

**User's choice:** Comprehensive — include total_brands_contacted, total_influencers_contacted, total_hours_worked, total_calls_joined, total_reports, last_active_date, current_streak. "Put everything in that coaches/owners query repeatedly. If you're building the table, make it comprehensive so the dashboard RPCs from Phase 20 can read from it instead of computing live. Don't do it twice."

**Notes:** User explicitly wants dashboard RPCs updated to read from summary table in the same phase.

---

## Dashboard Switchover

| Option | Description | Selected |
|--------|-------------|----------|
| Switch now | Update Phase 20 RPCs to read from summary table | ✓ |
| Foundation only | Build table for future use, don't update RPCs yet | |

**User's choice:** Switch now — "dashboard switchover is an obvious yes (why build a summary table and not use it)". Skipped discussion, treated as self-evident.

---

## Optimistic UI Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Standard (toast + rollback) | Show success banner optimistically, toast on confirm, rollback on error | ✓ |
| Rich confirmation card | Replace form with confirmation card showing submitted data | |

**User's choice:** Standard — "optimistic UI behavior is standard (show success toast, rollback on error)". Skipped discussion.

**Notes:** Claude flagged useOptimistic + fetch approach (option B: keep fetch, add useOptimistic + startTransition) vs Server Action conversion (option A). User accepted Claude's lean toward option B implicitly.

---

## Aggregation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full recompute | Recompute all 5k students nightly | |
| Incremental | Only recompute students with new data since last run | ✓ |

**User's choice:** Incremental — "Add a last_report_date or updated_at column to the summary table. The pg_cron job only recomputes students where daily_reports.date >= summary.last_report_date. At 5k students, full recompute is wasteful when only ~200 submitted reports that day. Keeps the job fast and the advisory lock short."

**Notes:** Claude added bootstrap detection (full compute on first run when no summary rows exist) — user accepted implicitly.

---

## Claude's Discretion

- Exact column types and constraints on student_kpi_summaries
- Streak computation approach (window function vs loop)
- Migration file organization
- useOptimistic + startTransition wiring details
- Write path audit document format

## Deferred Ideas

None — discussion stayed within phase scope
