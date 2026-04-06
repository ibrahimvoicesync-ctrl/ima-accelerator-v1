---
status: awaiting_human_verify
trigger: "Production Supabase database is missing all v1.4 migrations. Local DB works because npx supabase db reset applied them, but remote never got the migrations pushed."
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Only 00019 was missing. 00015-00018 had already been pushed. 00019 is now applied.
test: supabase db push --dry-run shows "Remote database is up to date"
expecting: All 19 migrations synced
next_action: Request human verification of production features

## Symptoms

expected: Production database should have 4 new tables (report_comments, messages, resources, glossary_terms), student_diy role constraint, RPC functions (get_weekly_skip_counts, get_sidebar_badges), and all new RLS policies
actual: Production still has old v1.3 schema — all v1.4 features fail
errors: All v1.4 features broken in production
reproduction: Open production app, try any v1.4 feature (chat, resources, etc.)
started: Since v1.4 was developed — migrations were never pushed to remote

## Migrations to Apply

- 00015_v1_4_schema.sql: 4 new tables (report_comments, messages, resources, glossary_terms), role CHECK constraint expansions, RLS policies, triggers
- 00016_skip_tracker.sql: get_weekly_skip_counts RPC function
- 00017_chat_badges.sql: Updated get_sidebar_badges RPC with unread_messages
- 00018_resources_pin.sql: is_pinned column on resources table
- 00019_magic_links_default.sql: Default max_uses = 10 on magic_links

## Eliminated

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: Supabase CLI login and project link
  found: CLI logged in, project ima-accelerator (uzfzoxfakxmsbttelhnr) is linked
  implication: CLI is ready to push

- timestamp: 2026-04-04T00:02:00Z
  checked: supabase db push --dry-run
  found: Only 00019_magic_links_default.sql shows as pending. 00015-00018 are NOT listed.
  implication: 00015-00018 are already in the remote migration history table. Either they were applied successfully, or the initial report is incorrect about all v1.4 features being broken.

- timestamp: 2026-04-04T00:03:00Z
  checked: supabase db push (actual push of 00019)
  found: 00019_magic_links_default.sql applied successfully (ALTER COLUMN max_uses SET DEFAULT 10)
  implication: The only missing migration is now applied

- timestamp: 2026-04-04T00:04:00Z
  checked: supabase inspect db table-stats --linked
  found: All 4 v1.4 tables exist on remote: report_comments (0 rows), messages (2 rows), resources (1 row), glossary_terms (4 rows). These tables have real data.
  implication: Migrations 00015 (tables), 00018 (is_pinned) were applied and are actively in use

- timestamp: 2026-04-04T00:05:00Z
  checked: supabase migration list --linked
  found: All 19 migrations (00001-00019) show as synced between Local and Remote
  implication: Full migration parity achieved

- timestamp: 2026-04-04T00:06:00Z
  checked: supabase db push --dry-run (final)
  found: "Remote database is up to date"
  implication: No pending migrations remain

## Resolution

root_cause: Only migration 00019_magic_links_default.sql was missing from production. Migrations 00015-00018 (v1.4 tables, RPC functions, RLS policies, is_pinned column) had already been pushed previously. The initial report overstated the scope — production was only missing the max_uses default on magic_links.
fix: Ran `npx supabase db push` which applied 00019_magic_links_default.sql (ALTER TABLE magic_links ALTER COLUMN max_uses SET DEFAULT 10)
verification: (1) supabase db push --dry-run returns "Remote database is up to date", (2) supabase migration list --linked shows all 19 migrations synced, (3) supabase inspect db table-stats confirms all v1.4 tables exist with real data
files_changed: []
