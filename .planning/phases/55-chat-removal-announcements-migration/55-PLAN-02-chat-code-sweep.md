---
plan_id: 55-02
phase: 55
title: "Delete all chat code and scrub unread_messages references from app"
wave: 1
depends_on: []
autonomous: true
requirements:
  - CHAT-REM-01
  - CHAT-REM-02
  - CHAT-REM-03
  - CHAT-REM-06
  - CHAT-REM-07
files_modified:
  - src/app/(dashboard)/coach/chat/page.tsx  # DELETE
  - src/app/(dashboard)/student/chat/page.tsx  # DELETE
  - src/app/api/messages/route.ts  # DELETE
  - src/app/api/messages/read/route.ts  # DELETE
  - src/lib/chat-utils.ts  # DELETE
  - src/components/chat/BroadcastCard.tsx  # DELETE
  - src/components/chat/ChatComposer.tsx  # DELETE
  - src/components/chat/ConversationList.tsx  # DELETE
  - src/components/chat/DaySeparator.tsx  # DELETE
  - src/components/chat/MessageBubble.tsx  # DELETE
  - src/components/chat/MessageThread.tsx  # DELETE
  - src/lib/rpc/types.ts  # EDIT — drop unread_messages from SidebarBadgesResult
  - src/app/(dashboard)/layout.tsx  # EDIT — remove unread_messages badge mapping
  - src/lib/config.ts  # EDIT — remove Chat nav entries from coach + student
must_haves:
  - All chat source files (routes, API, utils, components) are gone from disk
  - No remaining source file in src/ matches /unread_messages/
  - src/lib/config.ts NAVIGATION has no Chat entry for coach or student
  - MessageSquare import in Sidebar.tsx / student-ask / DiscordEmbed / CoachFeedbackCard is preserved (still used)
---

# Plan 55-02 — Full chat code deletion sweep (D-55-03)

## Context

D-55-03 mandates a full sweep: no half-measures, no orphaned imports. Phase 53 postmortem established that partial deletions create build failures. This plan deletes every chat surface in one shot and scrubs the `unread_messages` references in the three shared files (`rpc/types.ts`, `layout.tsx`, `config.ts`).

The `messages` table type block in `src/lib/types.ts` is NOT touched here — it comes out automatically when Plan 55-03 regenerates the file from Supabase types after the migration is applied. Touching it here would create a merge conflict with the regen step.

Proxy.ts already has no `/coach/chat` or `/student/chat` guards (verified during planning) — no edit needed.

## Tasks

<task id="55-02-T1" type="execute">
  <title>Delete chat route pages</title>
  <read_first>
    - src/app/(dashboard)/coach/chat/page.tsx (confirm it's the chat page before deleting)
    - src/app/(dashboard)/student/chat/page.tsx
  </read_first>
  <action>
    Delete these files and their parent directories (directories are chat-exclusive):
    - `src/app/(dashboard)/coach/chat/page.tsx`
    - `src/app/(dashboard)/coach/chat/` (directory)
    - `src/app/(dashboard)/student/chat/page.tsx`
    - `src/app/(dashboard)/student/chat/` (directory)

    Bash equivalents (from repo root):
    ```
    rm -rf 'src/app/(dashboard)/coach/chat'
    rm -rf 'src/app/(dashboard)/student/chat'
    ```
  </action>
  <acceptance_criteria>
    - `test ! -e 'src/app/(dashboard)/coach/chat'` exits 0
    - `test ! -e 'src/app/(dashboard)/student/chat'` exits 0
  </acceptance_criteria>
</task>

<task id="55-02-T2" type="execute">
  <title>Delete messages API routes</title>
  <read_first>
    - src/app/api/messages/route.ts
    - src/app/api/messages/read/route.ts
  </read_first>
  <action>
    Delete the entire `src/app/api/messages/` directory (contains `route.ts` and `read/route.ts`, both chat-exclusive):
    ```
    rm -rf 'src/app/api/messages'
    ```
  </action>
  <acceptance_criteria>
    - `test ! -e 'src/app/api/messages'` exits 0
  </acceptance_criteria>
</task>

<task id="55-02-T3" type="execute">
  <title>Delete chat utility module</title>
  <read_first>
    - src/lib/chat-utils.ts
  </read_first>
  <action>
    Delete `src/lib/chat-utils.ts`:
    ```
    rm -f 'src/lib/chat-utils.ts'
    ```
  </action>
  <acceptance_criteria>
    - `test ! -e 'src/lib/chat-utils.ts'` exits 0
  </acceptance_criteria>
</task>

<task id="55-02-T4" type="execute">
  <title>Delete entire src/components/chat/ directory</title>
  <read_first>
    - src/components/chat/BroadcastCard.tsx
    - src/components/chat/ChatComposer.tsx
    - src/components/chat/ConversationList.tsx
    - src/components/chat/DaySeparator.tsx
    - src/components/chat/MessageBubble.tsx
    - src/components/chat/MessageThread.tsx
  </read_first>
  <action>
    Delete the entire chat components directory (all 6 files are chat-exclusive):
    ```
    rm -rf 'src/components/chat'
    ```
  </action>
  <acceptance_criteria>
    - `test ! -e 'src/components/chat'` exits 0
  </acceptance_criteria>
</task>

<task id="55-02-T5" type="execute">
  <title>Remove unread_messages field from SidebarBadgesResult</title>
  <read_first>
    - src/lib/rpc/types.ts (full file — it's ~60 lines)
  </read_first>
  <action>
    Edit `src/lib/rpc/types.ts`. Replace the `SidebarBadgesResult` type block with this exact version (delete the `unread_messages` line entirely, keep all other fields):

    ```ts
    export type SidebarBadgesResult = {
      active_alerts?: number;          // owner only
      unreviewed_reports?: number;     // coach only
      coach_milestone_alerts?: number; // coach only — 100h + v1.5 milestone alerts (folded per Phase 51)
    };
    ```

    Specifically: delete the line `unread_messages?: number;        // coach + student — chat unread count (Phase 35)` (was line 18).
  </action>
  <acceptance_criteria>
    - `grep -c "unread_messages" src/lib/rpc/types.ts` returns 0
    - `grep -c "SidebarBadgesResult" src/lib/rpc/types.ts` returns 1 (the type definition still exists)
    - `grep -c "active_alerts" src/lib/rpc/types.ts` returns 1 (other fields preserved)
    - `grep -c "unreviewed_reports" src/lib/rpc/types.ts` returns 1
    - `grep -c "coach_milestone_alerts" src/lib/rpc/types.ts` returns 1
  </acceptance_criteria>
</task>

<task id="55-02-T6" type="execute">
  <title>Remove unread_messages badge mapping from dashboard layout</title>
  <read_first>
    - src/app/(dashboard)/layout.tsx (full file — it's ~62 lines)
  </read_first>
  <action>
    Edit `src/app/(dashboard)/layout.tsx`. Delete lines 47–49 (the unread_messages badge mapping block):

    Old (to delete):
    ```ts
      if (badges.unread_messages !== undefined && badges.unread_messages > 0) {
        badgeCounts.unread_messages = badges.unread_messages;
      }
    ```

    New: those 3 lines are removed entirely. The remaining three badge-mapping `if` blocks (`active_alerts`, `unreviewed_reports`, `coach_milestone_alerts`) are preserved unchanged.
  </action>
  <acceptance_criteria>
    - `grep -c "unread_messages" 'src/app/(dashboard)/layout.tsx'` returns 0
    - `grep -c "active_alerts" 'src/app/(dashboard)/layout.tsx'` returns >= 1 (other badges preserved)
    - `grep -c "unreviewed_reports" 'src/app/(dashboard)/layout.tsx'` returns >= 1
    - `grep -c "coach_milestone_alerts" 'src/app/(dashboard)/layout.tsx'` returns >= 1
  </acceptance_criteria>
</task>

<task id="55-02-T7" type="execute">
  <title>Remove Chat nav entries from coach and student NAVIGATION in config.ts</title>
  <read_first>
    - src/lib/config.ts (lines 280–325 — the NAVIGATION block)
  </read_first>
  <action>
    Edit `src/lib/config.ts`. Delete exactly these two lines from the `NAVIGATION` object:

    Line 303 (coach nav, current content):
    ```
        { label: "Chat",            href: "/coach/chat",         icon: "MessageSquare", badge: "unread_messages",        separator: true },
    ```

    Line 314 (student nav, current content):
    ```
        { label: "Chat",          href: "/student/chat",    icon: "MessageSquare",  badge: "unread_messages" },
    ```

    **Preservation rule:** Do NOT touch line 310 `{ label: "Ask Abu Lahya", href: "/student/ask", icon: "MessageSquare" }` — this uses `MessageSquare` for a different feature and must remain.

    **Separator handling:** The coach "Chat" entry had `separator: true`. That separator visually grouped the nav. After deletion, check the preceding entry (line 302 — the coach "Alerts" entry). If preserving visual grouping matters, you MAY add `separator: true` to the coach "Alerts" entry; otherwise leave it. This is cosmetic-only and not enforced by acceptance criteria.
  </action>
  <acceptance_criteria>
    - `grep -c '"/coach/chat"' src/lib/config.ts` returns 0
    - `grep -c '"/student/chat"' src/lib/config.ts` returns 0
    - `grep -c 'label: "Chat"' src/lib/config.ts` returns 0
    - `grep -c 'badge: "unread_messages"' src/lib/config.ts` returns 0
    - `grep -c '"/student/ask"' src/lib/config.ts` returns 1 (Ask Abu Lahya preserved — uses MessageSquare icon)
    - `grep -c 'NAVIGATION' src/lib/config.ts` returns >= 1 (structure preserved)
  </acceptance_criteria>
</task>

<task id="55-02-T8" type="execute">
  <title>Full-repo scan: confirm no orphaned chat references remain</title>
  <read_first>
    - src/lib/rpc/types.ts (post-T5 state)
    - src/app/(dashboard)/layout.tsx (post-T6 state)
    - src/lib/config.ts (post-T7 state)
  </read_first>
  <action>
    Run these scans and ensure each returns the expected count. **Do not edit src/lib/types.ts in this task** — its `messages` block is handled by Plan 55-03 (types regen).

    Required scan results:
    - `grep -rn "unread_messages" src/` MUST return only matches inside `src/lib/types.ts` (the generated `messages` table block will still contain `read_at` but not `unread_messages`; actual `unread_messages` should be zero everywhere). If any match appears outside `src/lib/types.ts`, fix it.
    - `grep -rn "from \"@/lib/chat-utils\"" src/` MUST return 0 matches (all importers were in deleted files).
    - `grep -rn "from \"@/components/chat" src/` MUST return 0 matches.
    - `grep -rn "/coach/chat\|/student/chat" src/` MUST return 0 matches.
    - `grep -rn "SidebarBadgesResult" src/` MUST return matches only in `src/lib/rpc/types.ts` (definition) and `src/app/(dashboard)/layout.tsx` (consumer) — no chat files.

    If any scan reveals an unexpected reference, delete/edit that file with concrete justification logged inline to console (explain why and what was fixed). Do NOT touch `src/lib/types.ts` (auto-regen target).
  </action>
  <acceptance_criteria>
    - `grep -rn "from \"@/lib/chat-utils\"" src/` exits with 0 matches
    - `grep -rn "from \"@/components/chat" src/` exits with 0 matches
    - `grep -rn "\"/coach/chat\"" src/` exits with 0 matches
    - `grep -rn "\"/student/chat\"" src/` exits with 0 matches
    - `grep -rn "unread_messages" src/ --exclude=types.ts` exits with 0 matches (or only types.ts references — all of which Plan 55-03 will remove via regen)
    - `find src/app/\\(dashboard\\)/coach/chat src/app/\\(dashboard\\)/student/chat src/app/api/messages src/lib/chat-utils.ts src/components/chat -maxdepth 0 2>/dev/null | wc -l` returns 0
  </acceptance_criteria>
</task>

## Verification

- All six "chat surface" locations (2 route dirs, 1 API dir, 1 utils file, 1 components dir, 3 shared file edits) are complete.
- `npm run build` is NOT run in this plan — it's expected to FAIL until Plan 55-03 regenerates `src/lib/types.ts` (the `messages` type block still exists and TypeScript will flag mismatches only after the DB push). Build verification is in Plan 55-04.
- The `MessageSquare` lucide import is preserved in Sidebar.tsx, DiscordEmbed.tsx, CoachFeedbackCard.tsx, and student/ask/page.tsx (these are non-chat uses).
