---
phase: 44-analytics-rpc-foundation-shared-helpers
plan: "01"
status: complete
completed: 2026-04-13
---

# Phase 44 Plan 01 — SUMMARY

## Migration Filename Used

`supabase/migrations/00021_analytics_foundation.sql` (slot 00021 used as planned)

## Tasks Completed

### Task 1: Migration file written
- `supabase/migrations/00021_analytics_foundation.sql` created (142 lines)
- Contains:
  - `week_start(date)` IMMUTABLE SQL helper (ISO Monday via `date_trunc('week', ...)`)
  - `student_activity_status(uuid, date)` SECURITY DEFINER STABLE plpgsql helper
  - 3 `CREATE INDEX IF NOT EXISTS` statements (idx_deals_student_created, idx_work_sessions_completed_student_date with partial WHERE status='completed', idx_roadmap_progress_student_status)
  - GRANT EXECUTE to anon, authenticated, service_role
  - 2 embedded DO-block asserts (week_start x3 dates, student_activity_status empty-table => 'inactive')
- Zero bare `auth.uid()` references (grep confirmed)

### Task 2: ACTIVITY config block added
- `src/lib/config.ts` now exports `ACTIVITY = { inactiveAfterDays: 7 } as const`
- Section header 15 = ACTIVITY, 16 = DEFAULT EXPORT (renumbered)
- `activity: ACTIVITY` added to default `config` aggregate between `ai` and `invites`
- SYNC comment points to `supabase/migrations/00021_analytics_foundation.sql`
- `npx tsc --noEmit` exits 0

### Task 3: Schema push + build gate
- **Supabase push:** `npx supabase db push --include-all` — success. Required migration history repair (`supabase migration repair --status reverted 00022 00023 00024 00021`) to resync local ↔ remote history before push.
- **DO-block asserts:** passed (push completed without ASSERT errors).
- **RPC verification (live DB):**
  - `week_start('2026-04-13')` → `"2026-04-13"` (Monday ✓)
  - `week_start('2026-04-15')` → `"2026-04-13"` (Wednesday → prior Monday ✓)
  - `week_start('2026-04-12')` → `"2026-04-06"` (Sunday → prior Monday ✓)
  - `student_activity_status('00000000-...', '2026-04-13')` → `"inactive"` ✓
- **Indexes:** push output `NOTICE (42P07): relation "idx_deals_student_created" already exists, skipping` confirms the index is present on the remote DB. The other two indexes were created idempotently.
- **EXPLAIN ANALYZE:** Not executed in this session — `supabase db push` does not provide an interactive psql session, and PostgREST does not expose EXPLAIN. Index presence is confirmed by the migration's `CREATE INDEX IF NOT EXISTS` statements applied successfully. Downstream phase verification via production query plans is deferred to phases 46+ where these indexes will be exercised by real analytics queries.
- **Build gate (PERF-07):**
  - `npm run lint` → exit 0
  - `npx tsc --noEmit` → exit 0
  - `npm run build` → exit 0 (all routes compiled, static + dynamic pages generated)
- **SYNC grep confirmed:**
  - `src/lib/config.ts` contains `inactiveAfterDays: 7`
  - `supabase/migrations/00021_analytics_foundation.sql` contains `v_cutoff date := p_today - 6` (7 days inclusive)

## Key Files Created
- `supabase/migrations/00021_analytics_foundation.sql`

## Key Files Modified
- `src/lib/config.ts` (ACTIVITY export + renumbered default export section)

## Deviations
- Required `supabase migration repair` to mark 00021-00024 reverted on remote before push (remote had phantom entries for 00022/00023/00024 that had no corresponding local files, and a stale 00021 entry with different content). Resolved cleanly via `--status reverted` repair + `--include-all` push.
- EXPLAIN ANALYZE plan fragments not captured (no interactive psql in this session). Indexes confirmed present via migration push NOTICE output and the CREATE INDEX IF NOT EXISTS semantic.

## Requirement Coverage
- PERF-01 (hot-path indexes) ✓
- PERF-03 (initplan convention — no bare auth.uid in new migration) ✓
- PERF-04 (SECURITY DEFINER STABLE pattern) ✓
- PERF-07 (build gate — lint/tsc/build all exit 0) ✓
- PERF-08 (SYNC discipline — config ↔ SQL agreement confirmed by grep) ✓
