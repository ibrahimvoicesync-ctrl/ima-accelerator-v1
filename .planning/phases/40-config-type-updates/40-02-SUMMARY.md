---
phase: 40-config-type-updates
plan: 02
subsystem: types
tags: [type-definition, gap-closure, deals]
dependency_graph:
  requires: ["40-01"]
  provides: ["deals-type-definition"]
  affects: ["src/app/api/deals/route.ts", "src/app/api/deals/[id]/route.ts"]
tech_stack:
  added: []
  patterns: ["string | number for PostgreSQL numeric via PostgREST"]
key_files:
  modified: ["src/lib/types.ts"]
decisions: []
metrics:
  duration: "84s"
  completed: "2026-04-07T08:10:22Z"
  tasks: 1
  files: 1
---

# Phase 40 Plan 02: Restore Deals Type Definition Summary

Restored deals table Row/Insert/Update/Relationships to Database.public.Tables in types.ts, fixing 6 TypeScript errors in deals route handlers where .from("deals") resolved to never.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restore deals table type definition in Database interface | 385796f | src/lib/types.ts |

## What Changed

### src/lib/types.ts
- Added `deals` table definition inside `Database["public"]["Tables"]` after `glossary_terms`
- Row type: id, student_id, deal_number (number), revenue (string | number), profit (string | number), created_at, updated_at
- Insert type: student_id required, deal_number optional (trigger-assigned), revenue/profit required
- Update type: all fields optional
- Relationships: single foreign key `deals_student_id_fkey` referencing `users.id`

## Verification

1. `npx tsc --noEmit` exits 0 with zero errors -- PASSED
2. `grep -c "deals: {" src/lib/types.ts` returns 1 -- PASSED
3. All 6 TypeScript errors in deals route handlers resolved:
   - src/app/api/deals/route.ts: `.from("deals").insert()` and `.from("deals").select()` resolve correctly
   - src/app/api/deals/[id]/route.ts: `.from("deals").update()`, `.from("deals").select()`, `.from("deals").delete()`, and `.student_id` property access all resolve correctly

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/lib/types.ts
- FOUND: commit 385796f
- FOUND: 40-02-SUMMARY.md
