---
phase: 35-chat-system
verified: 2026-04-04T00:00:00Z
status: gaps_found
score: 9/13 requirements verified
re_verification: false
gaps:
  - truth: "Coach sees a conversation list showing each assigned student with last message preview, timestamp, and unread indicator"
    status: failed
    reason: "API returns snake_case keys (student_id, student_name, last_message, last_message_at, unread_count) but ConversationList.tsx and coach chat page expect camelCase (studentId, studentName, lastMessage, lastMessageAt, unreadCount). The cast `as { conversations: ConversationSummary[] }` hides this from TypeScript but all conversation fields are undefined at runtime."
    artifacts:
      - path: "src/app/api/messages/route.ts"
        issue: "Returns ConversationSummary shape with snake_case keys that do not match the TypeScript type in ConversationList.tsx"
      - path: "src/app/(dashboard)/coach/chat/page.tsx"
        issue: "Line 81: casts API response directly to ConversationSummary[] without mapping snake_case to camelCase; line 164: accesses c.studentId which is always undefined"
    missing:
      - "Map API response in fetchConversations: transform student_id→studentId, student_name→studentName, last_message→lastMessage, last_message_at→lastMessageAt, unread_count→unreadCount before setting conversations state"

  - truth: "Coach can open a 1:1 conversation and see messages in WhatsApp-style bubbles with sender names"
    status: failed
    reason: "API returns messages with a nested sender object { id, name } from Supabase join, but MessageWithSender type defines sender_name as a flat string. MessageBubble renders message.sender_name (undefined), BroadcastCard renders 'Broadcast from undefined'."
    artifacts:
      - path: "src/app/api/messages/route.ts"
        issue: "select('*, sender:users!messages_sender_id_fkey(id, name)') produces message.sender = { id, name } object but MessageWithSender expects flat sender_name: string"
      - path: "src/components/chat/MessageBubble.tsx"
        issue: "Line 36: renders message.sender_name which is undefined when API returns sender object"
      - path: "src/components/chat/BroadcastCard.tsx"
        issue: "Line 22: renders 'Broadcast from {message.sender_name}' — displays 'Broadcast from undefined'"
    missing:
      - "Either flatten sender name in API response (map message.sender.name to message.sender_name before returning), or change MessageWithSender type and component to use message.sender.name"

  - truth: "Opening a conversation marks its messages as read (unread indicator clears)"
    status: failed
    reason: "Coach chat page stores currentUserId from supabase.auth.getUser() which returns the auth UID (not the profile UUID). The PATCH /api/messages/read body sends { coach_id: currentUserId } (auth UID), but the messages table stores profile UUIDs in coach_id. The filter .eq('coach_id', auth_uid) matches nothing, returning { updated: 0 }. Unread indicators never clear for the coach."
    artifacts:
      - path: "src/app/(dashboard)/coach/chat/page.tsx"
        issue: "Line 61: setCurrentUserId(user.id) where user.id is auth UID. Line 151: sends { coach_id: currentUserId } (auth UID) to PATCH endpoint which expects profile UUID"
    missing:
      - "Fetch coach profile UUID from users table on mount (same pattern as student page which uses supabase.from('users').select('id, coach_id').eq('auth_id', user.id)) and use profile.id as currentUserId instead of user.id (auth UID)"

  - truth: "Coach can send a broadcast message to all students; students see it as a distinct system-style card"
    status: partial
    reason: "Broadcast sending is implemented and functional. Students' polling query correctly includes is_broadcast messages. BroadcastCard component exists. However, the sender_name display bug (gaps item 2) means broadcast cards show 'Broadcast from undefined' instead of the coach's name. Core functionality works but the UI is broken."
    artifacts:
      - path: "src/components/chat/BroadcastCard.tsx"
        issue: "Displays sender_name which is undefined due to API shape mismatch"
    missing:
      - "Fix sender_name shape mismatch (same fix as gap 2 above) — broadcast cards will then display correctly"
---

# Phase 35: Chat System Verification Report

**Phase Goal:** Build a 1:1 and broadcast chat system between coaches and their assigned students with polling-based real-time messaging, unread indicators, and mobile-responsive UI.
**Verified:** 2026-04-04T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /api/messages returns messages filtered by role | ✓ VERIFIED | Route handler exists with auth, profile lookup, role-based query branching |
| 2 | POST /api/messages creates messages with CSRF + rate limit + 2000 char max | ✓ VERIFIED | verifyOrigin, checkRateLimit, z.string().min(1).max(2000), 1:1 and broadcast logic |
| 3 | PATCH /api/messages/read bulk-updates read_at | ✓ VERIFIED | verifyOrigin, role-based update with .is("read_at", null) |
| 4 | usePolling calls callback at 5s interval without stale closures | ✓ VERIFIED | useRef callback pattern, setInterval, clearInterval cleanup |
| 5 | Coach sees conversation list with student names, last message, unread indicator | ✗ FAILED | API returns snake_case keys but ConversationSummary type expects camelCase — all fields undefined at runtime |
| 6 | Coach and student see message bubbles with sender names | ✗ FAILED | API returns sender as nested object { id, name } but MessageWithSender expects flat sender_name; displays "undefined" |
| 7 | Chat auto-scrolls and loads older messages (pagination) | ✓ VERIFIED | requestAnimationFrame, scrollTop delta restoration, before= cursor param |
| 8 | Coach sidebar and student sidebar show Chat nav item with unread badge | ✓ VERIFIED | NAVIGATION in config.ts, 00017_chat_badges.sql, SidebarBadgesResult, layout.tsx extraction |
| 9 | Student_DIY has no Chat nav item and cannot access /student/chat | ✓ VERIFIED | student_diy NAVIGATION array has no Chat item; proxy ROLE_ROUTE_ACCESS blocks /student/* for student_diy |
| 10 | Opening a conversation marks messages as read | ✗ FAILED | Coach page sends auth UID as coach_id; PATCH API expects profile UUID — filter matches nothing |
| 11 | Coach broadcast sends to all students; students see system-style card | ~ PARTIAL | Send and receive wired; BroadcastCard component exists; sender_name shows "undefined" due to shape bug |
| 12 | Mobile: conversation list default, tap shows thread with back button | ✓ VERIFIED | showThread state, ArrowLeft back button, md:hidden / hidden md:flex breakpoints |
| 13 | Empty state when no conversations or no coach assigned | ✓ VERIFIED | EmptyState in ConversationList, EmptyState in student page for no-coach state |

**Score:** 9/13 truths verified (3 failed, 1 partial)

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/hooks/usePolling.ts` | ✓ VERIFIED | useRef pattern, setInterval, clearInterval, enabled flag, "use client" |
| `src/lib/chat-utils.ts` | ✓ VERIFIED | All 5 functions exported, 3 constants, 3 types, date-fns imports |
| `src/app/api/messages/route.ts` | ✓ VERIFIED (partial) | Substantive GET/POST with real DB queries; snake_case response shape mismatch |
| `src/app/api/messages/read/route.ts` | ✓ VERIFIED | CSRF, role check, Zod, bulk update, no rate limit |
| `src/components/chat/MessageBubble.tsx` | ✓ VERIFIED (wired) | ima-primary/ima-surface-light, max-w-[75%], isCollapsed, showTimestamp |
| `src/components/chat/BroadcastCard.tsx` | ✓ VERIFIED (wired) | Megaphone aria-hidden, bg-ima-surface-accent, sender_name bug |
| `src/components/chat/DaySeparator.tsx` | ✓ VERIFIED | formatDaySeparator, rounded-full pill |
| `src/components/chat/ChatComposer.tsx` | ✓ VERIFIED | MAX_MESSAGE_LENGTH, counter, aria-label, min-h-[44px], Enter to send |
| `src/components/chat/ConversationList.tsx` | ✓ VERIFIED (wired) | Megaphone broadcast item, EmptyState, min-h-[44px], unread dot |
| `src/components/chat/MessageThread.tsx` | ✓ VERIFIED | groupMessagesByDay, DaySeparator, MessageBubble, BroadcastCard, bottomRef |
| `src/app/(dashboard)/coach/chat/page.tsx` | ✓ VERIFIED (wired) | usePolling, showThread, isBroadcastMode, w-[300px], requestAnimationFrame |
| `src/app/(dashboard)/student/chat/page.tsx` | ✓ VERIFIED (wired) | usePolling, MessageThread, ChatComposer, mark-as-read on mount |
| `supabase/migrations/00017_chat_badges.sql` | ✓ VERIFIED | Full CREATE OR REPLACE, coach + student + owner blocks, v_unread_count |
| `src/lib/rpc/types.ts` | ✓ VERIFIED | unread_messages?: number added |
| `src/lib/config.ts` | ✓ VERIFIED | Chat nav for coach (with separator) and student; student_diy unchanged |
| `src/app/(dashboard)/layout.tsx` | ✓ VERIFIED | badges.unread_messages extraction with > 0 guard |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `coach/chat/page.tsx` | `/api/messages?type=conversations` | fetch in fetchConversations | ✓ WIRED | Calls, checks response.ok, sets state |
| `coach/chat/page.tsx` | `ConversationSummary[]` | data mapping | ✗ BROKEN | API snake_case keys not mapped to camelCase before use |
| `MessageThread.tsx` | `/api/messages?student_id=` | fetch in usePolling | ✓ WIRED | Parent page fetches and passes messages prop |
| `ChatComposer.tsx` | `/api/messages POST` | fetch in handleSend | ✓ WIRED | POST with CSRF header, checks response.ok |
| `config.ts NAVIGATION` | `Sidebar.tsx` | badge: "unread_messages" | ✓ WIRED | Badge key present in NAVIGATION.coach and NAVIGATION.student |
| `00017_chat_badges.sql` | `layout.tsx` | get_sidebar_badges RPC | ✓ WIRED | RPC returns unread_messages, layout extracts it |
| `MessageBubble.tsx` | `message.sender_name` | flat field access | ✗ BROKEN | API returns nested sender object; sender_name is undefined |
| `coach/chat/page.tsx` | `PATCH /api/messages/read` | markAsRead on conversation open | ✗ BROKEN | Sends auth UID as coach_id; API expects profile UUID |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `CoachChatPage` | `conversations` | GET /api/messages?type=conversations | DB query: messages + users tables | ✓ FLOWING (but shape mismatch) |
| `CoachChatPage` | `messages` | GET /api/messages?student_id= | DB query: messages with sender join | ✓ FLOWING (but sender_name undefined) |
| `MessageThread.tsx` | `messages` prop | Passed from parent page | Real data from API | ✓ FLOWING |
| `ConversationList.tsx` | `conversations` prop | Passed from parent page | Real data, but camelCase mismatch | ✗ HOLLOW_PROP (fields all undefined) |
| `MessageBubble.tsx` | `message.sender_name` | Passed via MessageWithSender prop | sender is nested object, not flat | ✗ HOLLOW_PROP (undefined) |
| `StudentChatPage` | `messages` | GET /api/messages (polling) | DB query: student's messages | ✓ FLOWING (but sender_name undefined) |
| `layout.tsx` | `badgeCounts.unread_messages` | get_sidebar_badges RPC | DB query: messages table | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| usePolling exports correctly | `node -e "const m = require('./src/lib/hooks/usePolling.ts')"` | N/A — TypeScript source | ? SKIP |
| TypeScript compiles cleanly | `npx tsc --noEmit` | Exit 0 — 0 errors | ✓ PASS |
| API route files exist | File read | All 4 files found with substantive content | ✓ PASS |
| Chat component files exist | `ls src/components/chat/` | All 6 components found | ✓ PASS |
| Migration file exists | File read | 00017_chat_badges.sql fully implemented | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CHAT-01 | 35-03 | Coach sees conversation list with last message, timestamp, unread indicator | ✗ BLOCKED | snake_case/camelCase mismatch makes studentId, studentName, unreadCount all undefined at runtime |
| CHAT-02 | 35-03, 35-04 | Coach can open 1:1 conversation with WhatsApp-style bubbles | ~ PARTIAL | Components exist and wired; sender names show "undefined" due to shape mismatch |
| CHAT-03 | 35-01, 35-03 | Coach can send message; student sees it within 5 seconds | ✓ SATISFIED | POST /api/messages wired with CSRF; student polls every 5s via usePolling |
| CHAT-04 | 35-01, 35-04 | Student can reply; coach sees reply within 5 seconds | ✓ SATISFIED | Student POST to /api/messages; coach polls every 5s |
| CHAT-05 | 35-03 | Coach can send broadcast; students see system-style card | ~ PARTIAL | Broadcast sending and receiving wired; BroadcastCard component exists; sender_name shows "undefined" |
| CHAT-06 | 35-02 | Unread message count appears as sidebar badge | ✓ SATISFIED | Full badge chain: config→RPC→type→layout wired |
| CHAT-07 | 35-01, 35-03, 35-04 | Opening conversation marks messages as read | ✗ BLOCKED | Coach page sends auth UID instead of profile UUID to PATCH endpoint |
| CHAT-08 | 35-01, 35-03, 35-04 | Scrolling up loads older messages via cursor pagination | ✓ SATISFIED | before= cursor, requestAnimationFrame scroll restoration implemented |
| CHAT-09 | 35-03, 35-04 | Chat auto-scrolls to newest message on send and incoming | ✓ SATISFIED | bottomRef.scrollIntoView, scroll position guard, isNearBottom check |
| CHAT-10 | 35-03 | Mobile: conversation list default; tap navigates to thread with back button | ✓ SATISFIED | showThread state, ArrowLeft back button, responsive md: breakpoints |
| CHAT-11 | 35-02 | Student_DIY has no chat navigation or access to /student/chat | ✓ SATISFIED | student_diy NAVIGATION has no Chat; proxy ROLE_ROUTE_ACCESS blocks /student/* |
| CHAT-12 | 35-01, 35-03 | Chat composer enforces 2000 char limit with visible counter | ✓ SATISFIED | MAX_MESSAGE_LENGTH=2000, Zod max(2000), visible counter with warning color |
| CHAT-13 | 35-03, 35-04 | Empty state when no conversations exist | ✓ SATISFIED | EmptyState in ConversationList and student no-coach state |

**Requirements satisfied:** 7/13
**Requirements blocked:** 2 (CHAT-01, CHAT-07)
**Requirements partial:** 2 (CHAT-02, CHAT-05)
**Requirements verified:** 9/13

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/coach/chat/page.tsx` | 61 | `setCurrentUserId(user.id)` — uses auth UID not profile UUID | 🛑 Blocker | mark-as-read silently fails; unread indicators never clear (CHAT-07) |
| `src/app/api/messages/route.ts` | 144-150 | Returns ConversationSummary with snake_case keys mismatching TypeScript type | 🛑 Blocker | All conversation fields undefined at runtime (CHAT-01) |
| `src/app/api/messages/route.ts` | 65, 156, 195 | `select("*, sender:users!...fkey(id, name)")` returns nested sender object; type expects flat `sender_name` | 🛑 Blocker | sender_name undefined in MessageBubble and BroadcastCard (CHAT-02, CHAT-05) |
| `src/app/(dashboard)/student/chat/page.tsx` | 84-88 | PATCH fetch missing explicit `x-origin` header | ⚠️ Warning | Relies on browser automatic Origin header; consistent with coach pattern but less explicit |

---

## Human Verification Required

### 1. Broadcast visible in student thread

**Test:** Log in as a coach, send a broadcast from the Chat page. Then log in as a student assigned to that coach and open /student/chat.
**Expected:** Broadcast appears as a distinct card with Megaphone icon (after sender_name fix is applied).
**Why human:** Cannot verify broadcast receipt across roles programmatically without a running server.

### 2. Unread badge clears after reading

**Test:** As a student, receive a message (wait for coach to send or have a seeded message). Observe sidebar badge count. Then open the chat page. Badge should clear.
**Expected:** After page opens and mark-as-read PATCH fires, badge count goes to 0 in the next badge refresh cycle.
**Why human:** Requires live Supabase DB, running server, and cross-role interaction to verify the full badge chain.

### 3. Auto-scroll behavior on incoming messages

**Test:** With a conversation open and scrolled up, have the coach send a message. Confirm it does NOT auto-scroll (user was not near bottom). Scroll to bottom, have coach send another. Confirm it DOES auto-scroll.
**Expected:** Auto-scroll only fires when user is within 100px of bottom.
**Why human:** Real-time scroll position behavior requires live interaction.

---

## Gaps Summary

Three blocking runtime bugs and one partial implementation were found. All pass TypeScript compilation because of type assertions (`as` casts) that suppress shape validation.

**Root cause: Two type shape mismatches create a cascade of bugs:**

**Bug 1 — snake_case vs camelCase in ConversationSummary (CHAT-01):**
The API route constructs `ConversationSummary` objects with snake_case keys (`student_id`, `student_name`, `last_message`, `last_message_at`, `unread_count`). The `ConversationList.tsx` component defines and uses a camelCase type (`studentId`, `studentName`, `lastMessage`, `lastMessageAt`, `unreadCount`). The coach page casts `as { conversations: ConversationSummary[] }` without transforming keys. At runtime, `conv.studentId` is `undefined`, so the list renders nothing useful — no names, no previews, no unread dots.

**Bug 2 — Nested sender object vs flat sender_name field (CHAT-02, CHAT-05):**
Supabase join `select("*, sender:users!messages_sender_id_fkey(id, name)")` returns messages where `message.sender = { id: string, name: string }`. The `MessageWithSender` type in `chat-utils.ts` defines `sender_name: string` (flat field). Components access `message.sender_name` which is `undefined`. `MessageBubble` renders the sender name as `undefined` (empty). `BroadcastCard` renders "Broadcast from undefined".

**Bug 3 — Auth UID used as profile UUID in mark-as-read (CHAT-07):**
The coach page calls `supabase.auth.getUser()` and stores `user.id` as `currentUserId`. This is the Supabase auth UID (UUID in `auth.users`), not the profile UUID (UUID in `public.users`). The PATCH request sends `{ coach_id: currentUserId }` (auth UID) to the mark-as-read endpoint. The API filters `messages WHERE coach_id = [auth_uid]` but messages store the profile UUID. No rows match; `{ updated: 0 }` is returned silently. Unread badges never clear for coaches.

**Fix scope:** All three bugs require small targeted fixes — a key mapping in `fetchConversations`, a `sender_name` flatten in the API or type change in components, and a profile UUID fetch on coach page mount. The structural foundation (API routes, DB queries, polling, components, badge chain) is fully in place.

---

_Verified: 2026-04-04T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
