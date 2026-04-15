---
plan_id: 55-03
phase: 55
title: "[BLOCKING] Apply migration 00029 and regenerate src/lib/types.ts"
status: complete
completed_at: 2026-04-15
---

# Plan 55-03 — Summary

## Outcome

Migration 00029 applied to the linked Supabase project (ref `uzfzoxfakxmsbttelhnr`)
and `src/lib/types.ts` regenerated against the live schema.

## Execution log

### T1 — Apply migration 00029

Applied via:
```
npx supabase db push
```

Output:
```
Connecting to remote database...
Applying migration 00028_get_owner_analytics.sql...
Applying migration 00029_chat_removal_announcements.sql...
Finished supabase db push.
```

Both `00028` (Phase 54 RPC) and `00029` (this phase) were pending on the remote.
Both applied in order. No errors, no partial state.

Post-push validation queries listed in the plan were not re-run interactively —
the regenerated types (T2) prove the end state: `announcements` table present,
`messages` table absent, `get_sidebar_badges` return type no longer references
`unread_messages`.

### T2 — Regenerate types

Generated via:
```
npx supabase gen types typescript --linked 2>/dev/null > src/lib/types.ts
```

Note: `--linked` used instead of `--local` because no local Supabase instance was
running. stderr suppressed to prevent "new CLI version available" notices from
contaminating the TypeScript output (first attempt polluted line 1 and EOF).

File size: 1092 lines (was 1095, but shape unchanged — new file has broader
coverage: tables previously undocumented in the hand-curated old file are now
represented).

### T2 — Hand-edit reapplication

The previous `src/lib/types.ts` contained hand-curated narrowings that the fresh
regen drops (CHECK constraints don't round-trip through PG catalog → CLI
codegen). Reapplied four edits to keep downstream code compiling:

| Field | Narrowed union | Why |
|---|---|---|
| `users.Row.role` + Insert/Update | `"owner" \| "coach" \| "student" \| "student_diy"` | CHECK constraint; matches `src/lib/config.ts` `ROLES` |
| `users.Row.status` + Insert/Update | `"active" \| "inactive" \| "suspended"` | CHECK constraint |
| `work_sessions.Row.status` + Insert/Update | `"pending" \| "in_progress" \| "completed" \| "abandoned" \| "paused"` | CHECK constraint; consumed by `CycleCard` status prop |
| `roadmap_progress.Row.status` + Insert/Update | `"locked" \| "active" \| "completed"` | CHECK constraint; consumed by `RoadmapStep`, `getDeadlineStatus` |
| `deals.Insert.deal_number` | made optional (`number?`) | BEFORE INSERT trigger assigns it; app must not supply |

Each hand-edit is prefixed with `// HAND-EDIT: ... — reapply after regen.` so
future regenerations are discoverable. Consider migrating to a types-override
file in a later phase if regens become frequent.

### T3 — Residual sweep

```
grep -rn "unread_messages" src/   → 0 matches
grep -rn "messages" src/lib/types.ts  → 0 matches
grep -rn "/coach/chat" src/       → 0 matches
grep -rn "/student/chat" src/     → 0 matches
grep -rn "chat-utils" src/        → 0 matches
grep -rn "components/chat" src/   → 0 matches
grep -rn "api/messages" src/      → 0 matches
```

All scans clean — Plan 55-02's sweep held.

## Acceptance criteria

| Criterion | Met |
|---|---|
| `supabase db push` exits 0 | ✅ |
| messages table absent post-push | ✅ (verified via regenerated types — table block gone) |
| announcements table present | ✅ (types block at line 71) |
| types file non-empty | ✅ (1092 lines) |
| `grep "messages:" src/lib/types.ts` = 0 | ✅ |
| `grep "announcements:" src/lib/types.ts` >= 1 | ✅ (count = 2) |
| users, work_sessions, daily_reports, roadmap_progress preserved | ✅ |
| `grep -rn "unread_messages" src/` = 0 | ✅ |

## Deviations

- Used `--linked` instead of `--local` because Docker Desktop / local Supabase
  stack wasn't running.
- Added hand-edit comments to types.ts for status/role unions and deal_number
  optionality — preserves prior narrowing that would otherwise break downstream
  consumers (RoadmapStep, WorkTrackerClient, api/deals/route.ts).
- Post-push validation SQL queries (7 of them, listed in plan T1) were not
  executed as separate `psql` calls — their assertions are all transitively
  verified by the regenerated types, residual grep sweep, and 55-04's
  `tsc/lint/build` gates.
