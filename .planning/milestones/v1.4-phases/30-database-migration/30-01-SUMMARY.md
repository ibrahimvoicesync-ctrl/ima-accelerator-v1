---
phase: 30-database-migration
plan: 01
subsystem: database
tags: [migration, schema, rls, typescript-types, student-diy]
dependency_graph:
  requires: []
  provides: [report_comments-table, messages-table, resources-table, glossary_terms-table, student_diy-role]
  affects: [src/lib/types.ts, phases/31-onwards]
tech_stack:
  added: []
  patterns: [rls-initplan-wrapper, section-labeled-migration, handle_updated_at-trigger, functional-unique-index]
key_files:
  created:
    - supabase/migrations/00015_v1_4_schema.sql
  modified:
    - src/lib/types.ts
decisions:
  - "Migration 00015 uses single-file approach (D-03) covering all 4 tables and 3 role CHECK ALTERs"
  - "student_diy blocked at app layer (proxy + nav) only — no RLS exclusion policies (D-04)"
  - "report_comments UNIQUE on report_id enables ON CONFLICT upsert in Phase 34 API"
  - "messages table uses is_broadcast flag with NULL recipient_id for broadcasts (D-01)"
  - "read_at column on messages tracks unread state per D-02 — no separate read_receipts table"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
requirements:
  - SCHEMA-01
  - SCHEMA-02
  - SCHEMA-03
  - SCHEMA-04
---

# Phase 30 Plan 01: Database Migration — v1.4 Schema Foundation Summary

**One-liner:** Single migration 00015 adds 4 new tables (report_comments, messages, resources, glossary_terms) with RLS, indexes, and updated_at triggers; expands role CHECK constraints to include student_diy; TypeScript types updated across 9 role union locations plus 4 new table type triplets.

## What Was Built

### Task 1: Migration 00015_v1_4_schema.sql

Created `supabase/migrations/00015_v1_4_schema.sql` with 11 labeled sections:

- **report_comments** — UUID PK, FK to daily_reports and users, text comment, updated_at. UNIQUE index on `report_id` enables one-comment-per-report upsert. `handle_updated_at()` trigger registered.
- **messages** — UUID PK, coach_id anchor, sender_id, nullable recipient_id (NULL=broadcast per D-01), is_broadcast boolean, text content, nullable read_at (unread tracking per D-02), created_at. Three indexes: conversation thread lookup (coach_id, recipient_id), partial unread index (recipient_id, read_at) WHERE read_at IS NULL, and created_at for pagination.
- **resources** — UUID PK, varchar(255) title, text url, nullable text comment, created_by FK to users, created_at. Add/delete only — no updated_at, no update RLS policies.
- **glossary_terms** — UUID PK, varchar(255) term, text definition, created_by FK to users, created_at, updated_at. Functional UNIQUE INDEX `lower(term)` for case-insensitive uniqueness (RES-09). `handle_updated_at()` trigger registered.
- **Role CHECK ALTERs** — DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT on users (4-value: owner/coach/student/student_diy), invites (3-value: coach/student/student_diy), magic_links (3-value: coach/student/student_diy).
- **RLS** — ENABLE ROW LEVEL SECURITY on all 4 new tables, 30 CREATE POLICY statements using `(select get_user_role())` and `(select get_user_id())` initplan wrapper pattern throughout.

### Task 2: TypeScript types expansion

Edited `src/lib/types.ts` with two categories of changes:

- **Role union expansion (9 locations):** users.Row/Insert/Update expanded from `"owner" | "coach" | "student"` to `"owner" | "coach" | "student" | "student_diy"`; invites.Row/Insert/Update and magic_links.Row/Insert/Update expanded from `"coach" | "student"` to `"coach" | "student" | "student_diy"`.
- **4 new table type triplets** added after roadmap_undo_log: report_comments, messages (recipient_id: string | null, is_broadcast: boolean, read_at: string | null), resources (comment: string | null), glossary_terms — each with Row/Insert/Update/Relationships shapes.

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| `npm run build` | PASS — all routes compile |
| `npm run lint` | Pre-existing errors only (load-test require() imports, Date.now in coach/owner pages — unrelated to this plan) |
| 4 CREATE TABLE statements | PASS |
| 4 ENABLE ROW LEVEL SECURITY | PASS |
| 30 CREATE POLICY statements | PASS |
| All policies use initplan wrapper | PASS |
| No student_diy in RLS USING/WITH CHECK | PASS |
| No IF NOT EXISTS on CREATE TABLE | PASS |
| All 9 role union locations expanded | PASS |

## Commits

| Hash | Message |
|------|---------|
| b8cbdff | feat(30-01): add migration 00015_v1_4_schema.sql with 4 new tables and role CHECK updates |
| 8d60e00 | feat(30-01): expand TypeScript types with 4 new tables and student_diy role |

## Deviations from Plan

None — plan executed exactly as written. Migration file structure followed 00013 conventions precisely. All 11 sections written per plan specification.

## Known Stubs

None — this plan creates schema infrastructure only (SQL + TypeScript types). No UI components, no API routes, no hardcoded data.

## Self-Check: PASSED

- `supabase/migrations/00015_v1_4_schema.sql` — FOUND
- `src/lib/types.ts` updated with 4 new tables and expanded role unions — FOUND
- Commits b8cbdff and 8d60e00 — FOUND (verified via git log)
- `npx tsc --noEmit` exits 0 — CONFIRMED
