# Phase 30: Database Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 30-database-migration
**Areas discussed:** Messages table design, Read tracking, Migration scope, RLS granularity

---

## Messages Table Design

| Option | Description | Selected |
|--------|-------------|----------|
| Single table with is_broadcast flag | Same messages table for 1:1 and broadcast, recipient_id NULL for broadcasts, coach_id as room anchor | ✓ |
| Separate broadcast_messages table | Dedicated table for broadcast messages with different schema | |

**User's choice:** Single table with is_broadcast flag (already locked as D-08 in milestone spec)
**Notes:** recipient_id NULL for broadcast messages. coach_id serves as room/conversation anchor.

---

## Read Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Per-message read_at column | read_at timestamptz on messages table, NULL = unread | ✓ |
| Separate read_receipts table | Normalized tracking in dedicated table | |
| Per-conversation last_read_at | Timestamp per user-conversation pair | |

**User's choice:** Per-message read_at column
**Notes:** Unread badge = COUNT WHERE recipient_id = user AND read_at IS NULL. Simple, no join needed.

---

## Migration Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single 00015 migration | All 4 tables + role constraint changes in one file | ✓ |
| Multiple migrations | Separate files per table or concern | |

**User's choice:** Single migration 00015 — fewer migrations = less risk
**Notes:** Does NOT include max_uses for magic_links (that stays in Phase 37's scope).

---

## RLS Policy Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Defense-in-depth (safety net) | RLS as backup; real control in proxy + API + admin client | ✓ |
| Primary enforcement via RLS | Full role-based restrictions at DB level | |

**User's choice:** Defense-in-depth only
**Notes:** student_diy restrictions enforced at app layer (proxy guard + nav config). RLS policies are a safety net, not the primary guard.

---

## Claude's Discretion

- Column types, sizes, and index strategy for all 4 new tables (derived from downstream requirements)
- RLS policy naming conventions
- Foreign key CASCADE/RESTRICT choices

## Deferred Ideas

None — all decisions were pre-locked in milestone spec.
