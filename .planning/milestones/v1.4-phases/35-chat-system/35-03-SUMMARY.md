---
phase: 35-chat-system
plan: "03"
subsystem: chat-ui
tags: [chat, ui, components, polling, pagination, broadcast, mobile, responsive]

dependency_graph:
  requires: [35-01, 35-02]
  provides:
    - MessageBubble component (WhatsApp-style aligned bubbles)
    - BroadcastCard component (full-width announcement card)
    - DaySeparator component (centered date pill label)
    - ChatComposer component (pinned-bottom textarea with 2000 char counter)
    - ConversationList component (left panel with broadcast + student items)
    - MessageThread component (scrollable history with pagination)
    - CoachChatPage (two-panel split, polling, mobile toggle)
  affects: [35-04]

tech_stack:
  added: []
  patterns:
    - "usePolling (useRef stale-closure safe) for both conversations and thread polling"
    - "requestAnimationFrame for scroll position restoration after prepend and auto-scroll"
    - "toastRef pattern for stable useCallback deps (consistent with codebase conventions)"
    - "Negative margin wrapper (-m-4 md:-m-8) to fill parent layout padding for full-height chat"

key_files:
  created:
    - src/components/chat/MessageBubble.tsx
    - src/components/chat/BroadcastCard.tsx
    - src/components/chat/DaySeparator.tsx
    - src/components/chat/ChatComposer.tsx
    - src/components/chat/ConversationList.tsx
    - src/components/chat/MessageThread.tsx
    - src/app/(dashboard)/coach/chat/page.tsx

key_decisions:
  - "Mobile layout uses showThread boolean (D-04): list is default, tapping conversation shows thread + back button"
  - "scrollToBottom uses bottomRef.current?.scrollIntoView (smooth) — deferred via requestAnimationFrame to ensure DOM is updated"
  - "loadOlderMessages records scrollHeight before prepend and restores scrollTop delta after requestAnimationFrame"
  - "fetchMessages uses setMessages functional update to compare prev.length vs incoming.length — avoids stale closure"
  - "CoachChatPage is fully client-side (use client) because it drives polling state — no server component wrapper needed"
  - "currentUserId fetched via supabase.auth.getUser() on mount (client SDK) since page is use client"

metrics:
  duration: 35min
  completed_date: "2026-04-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Phase 35 Plan 03: Chat UI Components + Coach Page Summary

**WhatsApp-style message bubbles, broadcast card, day separator, composer, conversation list, message thread, and the coach chat page assembling them into a polling two-panel split layout with mobile toggle and scroll-preserving pagination**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-04-04T04:25:00Z
- **Tasks:** 2/2
- **Files modified:** 7 created

## Accomplishments

### Task 1: Chat UI Primitive Components

**MessageBubble.tsx** — "use client" component with `isOwnMessage`, `isCollapsed`, `showTimestamp` props:
- Own messages: `bg-ima-primary text-white rounded-2xl rounded-br-sm` right-aligned
- Other messages: `bg-ima-surface-light text-ima-text rounded-2xl rounded-bl-sm` left-aligned
- `max-w-[75%]` bubble container, `whitespace-pre-wrap break-words` content
- Collapsed mode reduces top margin (`mt-0.5`) and hides sender name

**BroadcastCard.tsx** — Full-width `bg-ima-surface-accent` card with `Megaphone` icon (`aria-hidden="true"`), sender name in `text-ima-primary`, conditional timestamp

**DaySeparator.tsx** — `formatDaySeparator(new Date(date))` in `rounded-full` pill, centered with flex

**ChatComposer.tsx** — Controlled textarea with:
- Auto-grow up to 150px via `e.target.style.height` calculation
- `MAX_MESSAGE_LENGTH` (2000) enforced with character counter
- Counter turns `text-ima-error` at 1800+ chars (90% threshold)
- Enter without Shift submits, Shift+Enter inserts newline
- `aria-label="Message"` (Hard Rule 3)
- Send button: `min-h-[44px] min-w-[44px]` touch target (Hard Rule 2)
- `isBroadcast` prop changes placeholder and aria-label

### Task 2: ConversationList, MessageThread, CoachChatPage

**ConversationList.tsx** — Left panel with:
- Broadcast item pinned at top with `Megaphone` icon, `aria-label="Send broadcast message"`, `bg-ima-surface-accent` when selected
- Student conversation items: avatar initials, name, truncated last message preview, relative timestamp, unread dot (`bg-ima-primary`)
- `EmptyState` (CHAT-13) when `conversations.length === 0`
- All items: `min-h-[44px]` touch targets, `hover:bg-ima-surface-light`

**MessageThread.tsx** — Scrollable container with:
- Groups messages by day via `groupMessagesByDay()` → renders `DaySeparator` per group
- Per-message: `shouldShowTimestamp` and `isConsecutive` computed against previous message
- `is_broadcast` → `BroadcastCard`, else → `MessageBubble`
- Bottom sentinel `<div ref={bottomRef} />` for auto-scroll
- Scroll listener: `scrollTop < 100` triggers `onLoadMore()`
- "Load older messages" button at top when `hasMore`

**CoachChatPage** — Full client-side orchestration:
- `createClient().auth.getUser()` on mount for `currentUserId`
- Dual `usePolling` calls: conversation list always polls; thread polls when `selectedStudentId !== null`
- `requestAnimationFrame` for auto-scroll and scroll position restoration
- `loadOlderMessages`: records `prevScrollHeight`, prepends older messages, restores `scrollTop` delta
- Desktop: `w-[300px]` left panel + `flex-1` right panel (Hard Rule D-01)
- Mobile: `showThread` boolean toggles between `ConversationList` and thread (D-04)
- Mobile thread header: back button (`ArrowLeft`, `min-h-[44px]`) with student/broadcast name
- Mark-as-read: PATCH `/api/messages/read` on conversation open

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Chat UI primitive components | 5972589 | src/components/chat/{MessageBubble,BroadcastCard,DaySeparator,ChatComposer}.tsx |
| 2 | ConversationList, MessageThread, CoachChatPage | 9602816 | src/components/chat/{ConversationList,MessageThread}.tsx + src/app/(dashboard)/coach/chat/page.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merged master into worktree before building**
- **Found during:** Task 1 setup
- **Issue:** Worktree `worktree-agent-ac96d561` was missing Plan 01 and Plan 02 outputs (usePolling.ts, chat-utils.ts, API routes, config updates). Both plans were committed to master but not merged into this branch.
- **Fix:** `git merge master --no-edit` brought in all Plan 01/02 files
- **Files modified:** None — only a merge commit
- **Commit:** Merge commit during setup

No other deviations — plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit`: PASS (0 errors) — both tasks
- `npx eslint` on all 7 new files: PASS (0 errors/warnings)
- `npm run lint`: 10 pre-existing issues in unrelated files — out of scope (not caused by this plan)

## Known Stubs

None — all components wire to real API routes from Plan 01. Coach chat page fetches from `/api/messages` (GET/POST/PATCH) created in 35-01.

## Self-Check: PASSED

- [x] src/components/chat/MessageBubble.tsx contains `"use client"` and `bg-ima-primary` and `bg-ima-surface-light` and `max-w-[75%]` — FOUND
- [x] src/components/chat/MessageBubble.tsx contains `isOwnMessage` and `isCollapsed` and `showTimestamp` — FOUND
- [x] src/components/chat/BroadcastCard.tsx contains `"use client"` and `Megaphone` and `bg-ima-surface-accent` and `aria-hidden` — FOUND
- [x] src/components/chat/DaySeparator.tsx contains `formatDaySeparator` and `rounded-full` — FOUND
- [x] src/components/chat/ChatComposer.tsx contains `MAX_MESSAGE_LENGTH` and `value.length` and `onSend` and `aria-label` — FOUND
- [x] src/components/chat/ChatComposer.tsx contains `min-h-[44px]` — FOUND
- [x] src/components/chat/ChatComposer.tsx contains `Send` — FOUND
- [x] src/components/chat/ConversationList.tsx contains `export` and `ConversationList` and `Megaphone` and `unreadCount` and `min-h-[44px]` — FOUND
- [x] src/components/chat/ConversationList.tsx contains `EmptyState` — FOUND
- [x] src/components/chat/MessageThread.tsx contains `MessageThread` and `DaySeparator` and `MessageBubble` and `BroadcastCard` — FOUND
- [x] src/components/chat/MessageThread.tsx contains `shouldShowTimestamp` and `isConsecutive` and `groupMessagesByDay` — FOUND
- [x] src/components/chat/MessageThread.tsx contains `bottomRef` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `"use client"` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `usePolling` and `MESSAGE_POLL_INTERVAL` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `showThread` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `isBroadcastMode` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `api/messages` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `api/messages/read` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `requestAnimationFrame` — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `res.ok` (fetch response check, Hard Rule 6) — FOUND
- [x] src/app/(dashboard)/coach/chat/page.tsx contains `w-[300px]` — FOUND
- [x] Commit 5972589 exists — FOUND
- [x] Commit 9602816 exists — FOUND
- [x] npx tsc --noEmit exits 0 — PASSED
