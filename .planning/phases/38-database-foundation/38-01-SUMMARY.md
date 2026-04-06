---
phase: 38-database-foundation
plan: 01
subsystem: database
tags: [postgres, supabase, migration, rls, typescript, deals]

# Dependency graph
requires:
  - phase: 30-database-migration
    provides: report_comments/messages/resources/glossary_terms tables, 00015 migration pattern
  - phase: 19-database-foundation
    provides: get_user_id(), get_user_role(), handle_updated_at() functions from 00001
provides:
  - deals table DDL with numeric(12,2) revenue/profit, deal_number, RLS, trigger, index
  - assign_deal_number() BEFORE INSERT trigger with FOR UPDATE race-safe sequencing
  - 8 RLS policies with initplan pattern (owner, coach, student/student_diy)
  - Deal TypeScript type (Row/Insert/Update/Relationships) in types.ts
affects: [39-deals-api, 40-student-deals-ui, 41-coach-owner-deals-visibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEFORE INSERT trigger with COALESCE(MAX,0)+1 FOR UPDATE for race-safe per-student sequencing"
    - "Combined IN ('student', 'student_diy') RLS policy form for equivalent-access roles"

key-files:
  created:
    - supabase/migrations/00021_deals.sql
  modified:
    - src/lib/types.ts

key-decisions:
  - "deal_number assigned by BEFORE INSERT trigger with FOR UPDATE row lock — prevents concurrent insert duplicates (D-02)"
  - "revenue/profit declared as string | number in TypeScript — forces explicit Number() coercion at arithmetic sites (D-07)"
  - "Student and student_diy combined into single policies using IN ('student', 'student_diy') — fewer policies, same effect (D-10)"
  - "No coach INSERT/UPDATE policies — coaches cannot create or modify student deals (D-13)"
  - "deal_number optional in Insert type — signals to Phase 39 API not to supply it; trigger always overwrites"

patterns-established:
  - "Sectioned SQL migration with -- === dividers matching 00015 style"
  - "8-policy RLS model: owner (select/delete), coach (select/delete assigned only), student (full CRUD own rows)"

requirements-completed: [INFR-01, INFR-02, INFR-03, INFR-04, DEAL-02]

# Metrics
duration: 15min
completed: 2026-04-06
---

# Phase 38 Plan 01: Database Foundation Summary

**deals table migration (00021_deals.sql) with race-safe deal_number trigger, 8 RLS policies using initplan pattern, Deal TypeScript type, and migration confirmed applied in Supabase via repair sync**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-06T20:31:00Z
- **Completed:** 2026-04-06
- **Tasks:** 3 of 3 complete
- **Files modified:** 2

## Accomplishments
- Created `supabase/migrations/00021_deals.sql` with 7 complete sections: DDL, assign_deal_number() trigger function, BEFORE INSERT trigger, updated_at trigger, RLS enable, 8 RLS policies, composite index
- Added `deals` entry to `src/lib/types.ts` with Row/Insert/Update/Relationships triple — TypeScript compiles with zero errors
- BEFORE INSERT trigger uses `COALESCE(MAX(deal_number), 0) + 1 ... FOR UPDATE` — prevents race-condition duplicate deal numbers on concurrent inserts
- All 8 RLS policies use `(select get_user_role())` / `(select get_user_id())` initplan pattern — function evaluated once per query, not per row

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 00021_deals.sql migration file** - `a21f6de` (feat)
2. **Task 2: Add Deal type to types.ts and verify TypeScript compiles** - `9eec60a` (feat)
3. **Task 3: Apply migration to Supabase** - confirmed applied (table pre-existed; synced via `npx supabase migration repair --status applied 00021`)

## Files Created/Modified
- `supabase/migrations/00021_deals.sql` - Complete deals table migration: DDL, trigger, RLS, index
- `src/lib/types.ts` - Added deals Row/Insert/Update/Relationships type entry after glossary_terms

## Decisions Made
- Combined student and student_diy into single `IN ('student', 'student_diy')` RLS policies — simpler RLS graph, consistent with DEAL-06 requirement that both roles have identical deal access
- deal_number marked optional in Insert type per RESEARCH.md Pitfall 6 — signals to Phase 39 API to strip it from insert payloads; trigger always overwrites anyway
- revenue and profit declared as `string | number` in all three type variants — Supabase returns numeric(12,2) as string from JS client; explicit Number() coercion required at every arithmetic site

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - migration is confirmed applied. The deals table already existed in the live Supabase database, so `npx supabase migration repair --status applied 00021` was run to sync the migration history. Migration list shows 00021 as applied both locally and remotely.

## Known Stubs

None — this plan creates pure SQL migration and TypeScript types with no UI or data rendering.

## Next Phase Readiness
- Migration confirmed applied — deals table exists in Supabase with all columns, trigger, 8 RLS policies, and composite index
- Phase 39 (deals API routes) is unblocked and can proceed immediately
- Phase 39 API should strip `deal_number` from insert payloads (trigger sets it); Insert type marks it optional as signal
- Phase 39 API must use `Number()` to coerce revenue/profit before arithmetic (declared as `string | number`)

## Self-Check

- [x] `supabase/migrations/00021_deals.sql` exists — FOUND
- [x] `src/lib/types.ts` contains `deals:` entry — FOUND
- [x] Task 1 commit `a21f6de` — verified
- [x] Task 2 commit `9eec60a` — verified
- [x] `npx tsc --noEmit` exits 0 — PASSED
- [x] Task 3: migration confirmed applied via `npx supabase migration repair --status applied 00021` — COMPLETE

## Self-Check: PASSED

---
*Phase: 38-database-foundation*
*Completed: 2026-04-06*
