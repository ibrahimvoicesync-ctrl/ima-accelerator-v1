---
phase: 44
name: Analytics RPC Foundation & Shared Helpers
status: complete
kind: inline-research
gathered: 2026-04-13
---

# Phase 44 Research — Analytics RPC Foundation & Shared Helpers

## Research summary

Backend-only foundation. No new libraries, no new frameworks. Everything is Postgres SQL + a tiny slice of `src/lib/config.ts`. Risk is low; correctness of SQL semantics (ISO week start, "no activity in last 7 days") is the main concern.

## Domain

### 1. ISO Week Start (Monday)

Postgres has `date_trunc('week', d)` which returns a timestamp at Monday 00:00 for the ISO week containing `d` (PG uses ISO 8601 — weeks start Monday). Confirmed in existing migration `00016_skip_tracker.sql` line 25:

```sql
v_week_start date := date_trunc('week', p_today)::date;
```

**Conclusion:** Implement `public.week_start(p_today date) RETURNS date` as `date_trunc('week', p_today)::date`. IMMUTABLE, LANGUAGE sql, SECURITY DEFINER not needed (pure function). Test cases:

- Monday input → same Monday
- Sunday input → previous Monday (Sunday belongs to prior ISO week)
- Mid-week input → the Monday of that week

### 2. Student Activity Status

Per D-14: inactive = no completed work session AND no submitted report in the last 7 days (inclusive window `[p_today - 6, p_today]` = last 7 days including today).

Signals already in the DB:

- `work_sessions.status = 'completed'` indicates a finished session
- `daily_reports.submitted_at IS NOT NULL` indicates a submitted report

Exact window definition locked: a student is `active` if either exists for date >= `p_today - 6`. Otherwise `inactive`.

Implement as `public.student_activity_status(p_student_id uuid, p_today date) RETURNS text` returning `'active' | 'inactive'`. Use short-circuit `EXISTS OR EXISTS`.

STABLE (depends on table data, no side effects). `SECURITY DEFINER` + `SET search_path = public` for safety when called from RLS-limited contexts.

### 3. ACTIVITY Config Block

Add to `src/lib/config.ts`:

```ts
// ---------------------------------------------------------------------------
// 16. ACTIVITY (SYNC: mirrors public.student_activity_status SQL helper —
//     see supabase/migrations/00022_analytics_foundation.sql)
// ---------------------------------------------------------------------------
export const ACTIVITY = {
  inactiveAfterDays: 7, // SYNC: student_activity_status threshold
} as const;
```

Expose via the default `config` aggregate.

### 4. Indexes

Three indexes, all `IF NOT EXISTS` for idempotency:

- `idx_deals_student_created ON public.deals(student_id, created_at DESC)` — covers per-student deal history paginated by created_at (ANALYTICS-05, COACH-ANALYTICS).
- `idx_work_sessions_completed_student_date ON public.work_sessions(student_id, date) WHERE status = 'completed'` — partial index; hot path for "hours-worked" aggregates and activity checks.
- `idx_roadmap_progress_student_status ON public.roadmap_progress(student_id, status)` — supports "current active step" lookups and aggregate step-by-status counts.

Use `EXPLAIN (ANALYZE, BUFFERS)` on representative queries to prove index scans (not seq scans). Representative queries documented in the plan's verify block.

### 5. `(SELECT auth.uid())` Initplan Pattern

Per D-03 / PERF-03 / v1.2 Phase 19 convention: every `auth.uid()` reference inside a RLS `USING`/`WITH CHECK` (or any hot-path query in a definer function) MUST be wrapped `(SELECT auth.uid())`. Phase 44 introduces no new RLS policies (deals RLS is Phase 45 territory), but the migration file MUST NOT introduce any bare `auth.uid()` anywhere. The helper functions take `p_student_id` explicitly; they do NOT call `auth.uid()` at all.

Verification grep:

```
grep -nE "auth\.uid\(\)" supabase/migrations/00022_*.sql | grep -v "SELECT auth.uid()"
```

Expect zero matches.

### 6. SECURITY DEFINER + STABLE Pattern (PERF-04)

Per D-01 / PERF-04: analytics aggregation runs inside `SECURITY DEFINER STABLE` Postgres functions. Phase 44 establishes the *pattern* (helpers are STABLE + SECURITY DEFINER + `SET search_path = public`), which all downstream phases' feature RPCs will follow.

### 7. Tests

Unit-test `week_start()` against Sunday/Monday/mid-week inputs — run as `DO $$ ... ASSERT ... $$;` blocks inside the migration or a separate `_test` migration. Keep them inside the same migration to guarantee execution on `supabase db push`.

## Architectural decisions

- **D-A:** `week_start` is IMMUTABLE and `LANGUAGE sql` (planner-inlineable, cheapest).
- **D-B:** `student_activity_status` is STABLE (reads tables), `LANGUAGE plpgsql` (short-circuit EXISTS), `SECURITY DEFINER`, `SET search_path = public`.
- **D-C:** Indexes are additive-only; no drops. All use `IF NOT EXISTS`.
- **D-D:** Migration file numbered `00022_analytics_foundation.sql` (next sequential after 00020/00021 overlap — verify next free number at plan time).
- **D-E:** Tests embedded as `DO $$ ... $$;` ASSERT blocks inside the migration (fails `db push` if semantics wrong).
- **D-F:** ACTIVITY constant lives in `src/lib/config.ts` section 16 (new section) with SYNC comment pointing at the SQL helper file.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Migration numbering collision with pending files (00022 already used in a worktree) | Plan Task 1 greps `supabase/migrations/*` for existing 00022 before creation; falls back to next free number |
| `date_trunc('week', ...)` timezone surprise | All date columns are `date` (timezone-less). p_today is `date`. No TZ ambiguity |
| Partial index `WHERE status='completed'` rejected by planner on existing data | Postgres accepts partial indexes unconditionally; `IF NOT EXISTS` prevents duplicate creation |
| EXPLAIN ANALYZE on empty tables shows seq scan | Executor runs EXPLAIN only on tables with seed data; if empty, documents "N/A — no rows" and proves shape instead |
| Config drift between SQL threshold (7) and ACTIVITY.inactiveAfterDays | SYNC comment in both files; verification grep in PLAN checks both match `7` literal |

## Validation Architecture

**Inputs under test:**
- `week_start(date)` — 3 canonical dates (Sunday, Monday, Wednesday)
- `student_activity_status(uuid, date)` — existence and non-existence of work_sessions/daily_reports in the window

**Verification commands (in PLAN `<verify>` blocks):**
- `supabase db push` succeeds (with embedded DO asserts passing)
- `grep -c "(SELECT auth.uid())"` on migration: >= 0; `grep -cE "(?<!SELECT )auth\.uid\(\)"` on migration: 0
- `grep -n "idx_deals_student_created" supabase/migrations/00022_*.sql` matches
- `grep -n "idx_work_sessions_completed_student_date" supabase/migrations/00022_*.sql` matches
- `grep -n "idx_roadmap_progress_student_status" supabase/migrations/00022_*.sql` matches
- `grep -n "inactiveAfterDays: 7" src/lib/config.ts` matches
- `grep -nE "export const ACTIVITY" src/lib/config.ts` matches
- `npm run lint && npx tsc --noEmit && npm run build` exits 0

## RESEARCH COMPLETE
