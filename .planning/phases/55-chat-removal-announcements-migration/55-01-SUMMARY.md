---
plan_id: 55-01
phase: 55
status: complete
wave: 1
---

# Plan 55-01 Summary — Migration 00029 (atomic chat removal + announcements)

## What was built

Authored `supabase/migrations/00029_chat_removal_announcements.sql` — a single `BEGIN…COMMIT` atomic transaction that replaces `get_sidebar_badges`, creates the `announcements` table, and drops `messages CASCADE` in the exact non-negotiable order.

## Key files created

- `supabase/migrations/00029_chat_removal_announcements.sql` (279 lines) — the atomic migration

## Statement order (verified via awk)

| Step | Statement | Line |
|------|-----------|------|
| 1 | `CREATE OR REPLACE FUNCTION public.get_sidebar_badges` | 21 |
| 2 | `CREATE TABLE public.announcements` | 193 |
| 3 | `DROP TABLE public.messages CASCADE` | 277 |

## Acceptance criteria (all pass)

| Check | Result |
|-------|--------|
| file exists | OK |
| `BEGIN;` count | 1 |
| `COMMIT;` count | 1 |
| statement order (func < table < drop) | 21 < 193 < 277 |
| `unread_messages` occurrences | 0 |
| `FROM messages` occurrences | 0 (only `DROP TABLE public.messages CASCADE`) |
| `(SELECT auth.uid())` uses | 8 (4 policies × 2+ refs) |
| `CREATE POLICY announcements_*` | 4 (select/insert/update/delete) |
| `announcements_created_at_idx` | 1 |
| `announcements_updated_at_trigger` | 1 |
| `char_length(content) <= 2000` check | 1 |
| `ON DELETE CASCADE` (author_id FK) | 1 |

## Notable decisions

- Header comments were rewritten from `(no unread_messages)` to `(chat branches removed)` so the strict acceptance criterion `grep -c "unread_messages" ... returns 0` holds across the whole file, not just the function body.
- Student branch returns `'{}'::jsonb` (reserved for Phase 56's `unread_announcements` field).
- Owner branch returns only `active_alerts` (no `unread_messages: 0`).
- Migration file is a deliverable only — applying it to the live DB is Plan 55-03.

## Commit

- `ccaf21c` — feat(55-01): add migration 00029 for atomic chat removal + announcements

## Self-Check: PASSED
