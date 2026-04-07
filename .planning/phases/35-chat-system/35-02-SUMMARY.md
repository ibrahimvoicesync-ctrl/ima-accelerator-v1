---
phase: 35-chat-system
plan: "02"
subsystem: navigation-badges
tags: [chat, navigation, sidebar, rpc, postgresql, typescript]
dependency_graph:
  requires: []
  provides: [chat-nav-items, unread-badge-chain, badge-rpc-extension]
  affects: [src/lib/config.ts, supabase/migrations/00017_chat_badges.sql, src/lib/rpc/types.ts, src/app/(dashboard)/layout.tsx]
tech_stack:
  added: []
  patterns: [badge-key-chain, create-or-replace-rpc, badge-extraction-guard]
key_files:
  created:
    - supabase/migrations/00017_chat_badges.sql
  modified:
    - src/lib/config.ts
    - src/lib/rpc/types.ts
    - src/app/(dashboard)/layout.tsx
decisions:
  - "student_diy role not present in this codebase — NAVIGATION has only owner/coach/student; constraint satisfied automatically"
  - "Broadcast read_at is best-effort in v1 (single column = first reader marks all); documented per RESEARCH open question #1"
  - "Owner RETURN includes unread_messages: 0 for type contract consistency"
metrics:
  duration_seconds: 160
  completed_date: "2026-04-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 35 Plan 02: Chat Navigation + Sidebar Badge Wiring Summary

**One-liner:** Chat nav items (coach + student) + Postgres RPC extension for unread_messages badge count wired through the four-link config→RPC→type→layout chain.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add chat navigation items to config.ts and ROUTES | e8f319c | src/lib/config.ts |
| 2 | Create badge migration + update RPC types + wire layout badge extraction | 9b95c5c | supabase/migrations/00017_chat_badges.sql, src/lib/rpc/types.ts, src/app/(dashboard)/layout.tsx |

## What Was Built

### Task 1: Navigation Config Updates (src/lib/config.ts)

Added `chat` routes to ROUTES:
- `ROUTES.coach.chat = "/coach/chat"`
- `ROUTES.student.chat = "/student/chat"`

Added Chat nav items to NAVIGATION:
- **coach array** (last item, separator=true): `{ label: "Chat", href: "/coach/chat", icon: "MessageSquare", badge: "unread_messages", separator: true }`
- **student array** (last item): `{ label: "Chat", href: "/student/chat", icon: "MessageSquare", badge: "unread_messages" }`
- owner and student_diy (not present in this codebase) arrays unchanged (CHAT-11)

### Task 2: Badge Chain (00017, types, layout)

**Migration 00017_chat_badges.sql** — Full CREATE OR REPLACE of `get_sidebar_badges` function:
- New DECLARE variable: `v_unread_count integer := 0`
- **Coach block** extension: COUNT from messages WHERE coach_id=p_user_id AND recipient_id=p_user_id AND read_at IS NULL; added `unread_messages` to RETURN jsonb_build_object
- **Student block** (new): COUNT DMs to student + all broadcasts from their assigned coach where read_at IS NULL; returns `jsonb_build_object('unread_messages', v_unread_count)`
- **Owner block**: unchanged logic + `unread_messages: 0` added to RETURN for type contract consistency

**src/lib/rpc/types.ts** — Added `unread_messages?: number` to SidebarBadgesResult type

**src/app/(dashboard)/layout.tsx** — Added extraction guard:
```typescript
if (badges.unread_messages !== undefined && badges.unread_messages > 0) {
  badgeCounts.unread_messages = badges.unread_messages;
}
```

## Deviations from Plan

### Discovery: student_diy Role Not Present

**Found during:** Task 1
**Issue:** The plan context showed NAVIGATION with a `student_diy` array. The actual codebase has only owner/coach/student roles in the NAVIGATION Record type (Role = "owner" | "coach" | "student"). No student_diy key exists.
**Fix:** Proceeded normally — the constraint "do NOT modify student_diy array" is trivially satisfied since the array doesn't exist.
**Files modified:** None
**Classification:** Observation, not a deviation — plan executed exactly as intended.

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors) — after both tasks
- `npx eslint src/lib/config.ts src/lib/rpc/types.ts src/app/(dashboard)/layout.tsx`: PASS (0 errors/warnings)
- `npm run lint` (full project): 5 pre-existing errors in load-tests/gen-tokens.js and two existing page files — out of scope, not caused by this plan

## Badge Chain Completeness (Pitfall 6 Addressed)

The four-link chain is complete:
1. **config.ts** → NAVIGATION has `badge: "unread_messages"` for coach and student
2. **00017_chat_badges.sql** → RPC returns `unread_messages` count for coach and student
3. **rpc/types.ts** → SidebarBadgesResult includes `unread_messages?: number`
4. **layout.tsx** → `badgeCounts.unread_messages` extracted and passed to Sidebar

## Known Stubs

None — all badge data flows from the actual messages table via Postgres RPC.

## Self-Check: PASSED

- [x] src/lib/config.ts contains `chat: "/coach/chat"` — FOUND
- [x] src/lib/config.ts contains `chat: "/student/chat"` — FOUND
- [x] supabase/migrations/00017_chat_badges.sql exists — FOUND
- [x] supabase/migrations/00017_chat_badges.sql contains `v_unread_count integer := 0` — FOUND
- [x] supabase/migrations/00017_chat_badges.sql contains `unread_messages` — FOUND
- [x] supabase/migrations/00017_chat_badges.sql contains `p_role = 'student'` — FOUND
- [x] supabase/migrations/00017_chat_badges.sql contains `is_broadcast = true AND m.read_at IS NULL` — FOUND
- [x] src/lib/rpc/types.ts contains `unread_messages?: number` — FOUND
- [x] src/app/(dashboard)/layout.tsx contains `badges.unread_messages` — FOUND
- [x] src/app/(dashboard)/layout.tsx contains `badgeCounts.unread_messages` — FOUND
- [x] Commit e8f319c exists — FOUND
- [x] Commit 9b95c5c exists — FOUND
