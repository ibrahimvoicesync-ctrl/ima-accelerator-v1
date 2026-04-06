# Phase 35: Chat System - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Polling-based WhatsApp-style chat system. Coaches and students exchange 1:1 messages; coaches can broadcast to all assigned students. Messages appear within 5 seconds via polling. Sidebar unread badges for coach and student roles. Student_DIY excluded entirely.

</domain>

<decisions>
## Implementation Decisions

### Chat Layout
- **D-01:** Two-panel split on desktop — conversation list (left, ~300px) + active thread (right, fills remaining width). Both panels visible simultaneously on desktop.
- **D-02:** Coach messages right-aligned with ima-primary background and white text. Student messages left-aligned with ima-surface-light background and ima-text color.
- **D-03:** Composer bar pinned to bottom of thread panel.

### Mobile Navigation
- **D-04:** Single-page toggle, NOT separate routes. One route `/coach/chat` with state-driven view switching (`showThread: boolean`). Back button sets `showThread = false`. Avoids extra route files and keeps polling state in one component.
- **D-05:** Student chat is also a single route `/student/chat` — single thread view only (no conversation list needed since students only talk to their coach).

### Broadcast UX
- **D-06:** "Broadcast" item pinned at top of conversation list with megaphone icon. Clicking it opens a thread view with a textarea and "Send to all students" button.
- **D-07:** Broadcast messages appear in student chat as full-width system-style cards (ima-surface-accent background, megaphone icon, no bubble alignment). Not a separate tab — it's just another conversation in the list.

### Timestamps & Grouping
- **D-08:** Day separators displayed as centered labels ("Today", "Yesterday", "Mon, Mar 31").
- **D-09:** Within a day, show timestamp on the first message of each time block (5+ minute gap between messages triggers a new time block).
- **D-10:** Consecutive messages from the same sender within 2 minutes — collapse: no avatar/name repeat, tighter spacing, timestamp only on last message in the group.

### Carried Forward (locked in prior phases)
- **D-07 (v1.4):** Polling at 5s interval, NOT Supabase Realtime (avoids 500 connection limit on Pro plan)
- **D-08 (v1.4):** Coach↔individual student 1:1 + coach→all broadcast (two chat modes)
- **D-09 (v1.4):** Students CAN reply to coaches (two-way async)
- **D-01 (Phase 30):** Single `messages` table with `is_broadcast` boolean flag. `recipient_id` is NULL for broadcast messages. `coach_id` serves as conversation anchor.
- **D-02 (Phase 30):** Per-message `read_at` timestamptz column for unread tracking. Unread count = `COUNT(*) WHERE recipient_id = :user_id AND read_at IS NULL`.
- **D-05 (v1.4):** Student_DIY has NO chat access

### Claude's Discretion
- Polling hook implementation details (useInterval with useRef pattern — pitfall already documented)
- Cursor-based pagination implementation for older messages (CHAT-08)
- Auto-scroll behavior implementation (CHAT-09)
- Mark-as-read API design (batch vs per-conversation)
- Conversation list sorting strategy (most recent first)
- Empty state content and copy

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `supabase/migrations/00015_v1_4_schema.sql` — Messages table definition (columns, constraints, indexes, RLS policies)
- `supabase/migrations/00001_create_tables.sql` — `get_user_id()` and `get_user_role()` helpers used in RLS policies

### Requirements
- `.planning/REQUIREMENTS.md` §Chat System — CHAT-01 through CHAT-13 (all 13 requirements for this phase)

### TypeScript Types
- `src/lib/types.ts` — MessageRow/MessageInsert/MessageUpdate types, Role union

### Navigation & Layout
- `src/lib/config.ts` — NAVIGATION map (add chat nav items for coach + student roles with badge key)
- `src/components/layout/Sidebar.tsx` — Badge rendering pattern (`badgeCounts` prop, `item.badge` key)

### Existing Patterns
- `src/components/student/WorkTimer.tsx` — `setInterval`/`useRef` pattern for polling reference
- `src/app/api/reports/[id]/comment/route.ts` — Recent API route pattern (auth + role check + Zod + admin client)
- `src/components/shared/CoachFeedbackCard.tsx` — Recent shared component pattern

### Rate Limiting
- `src/lib/rate-limit.ts` — `checkRateLimit()` helper (DO NOT call on GET polling endpoint)

### Phase Success Criteria
- `.planning/ROADMAP.md` §Phase 35 — 7 success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` component (`src/components/ui/Card.tsx`) — container for conversation items and broadcast cards
- `Badge` component (`src/components/ui/Badge.tsx`) — unread count display
- `Button` component (`src/components/ui/Button.tsx`) — send button, back button
- `Textarea` component (`src/components/ui/Textarea.tsx`) — message composer base
- `EmptyState` component (`src/components/ui/EmptyState.tsx`) — no conversations yet state
- `Spinner` / `Skeleton` — loading states for conversation list and message history
- `Sidebar` already supports `badgeCounts` prop with badge key rendering

### Established Patterns
- Config-driven navigation: `NAVIGATION` map in config.ts defines nav items per role with optional `badge` key
- Badge counts: Sidebar receives `badgeCounts` record, renders count when `item.badge` matches a key
- Server components for reads, client components for interactivity (polling is client-side)
- Admin client for all `.from()` queries in API routes
- `useRef` for stable callback references (toast, router) — prevents re-render loops

### Integration Points
- Add `{ label: "Chat", href: "/coach/chat", icon: "MessageSquare", badge: "unread_messages" }` to coach navigation
- Add `{ label: "Chat", href: "/student/chat", icon: "MessageSquare", badge: "unread_messages" }` to student navigation
- Student_DIY navigation unchanged (no chat item)
- New page files: `src/app/(dashboard)/coach/chat/page.tsx`, `src/app/(dashboard)/student/chat/page.tsx`
- New API routes: GET `/api/messages` (polling), POST `/api/messages` (send), PATCH `/api/messages/read` (mark read)
- Badge count endpoint or RPC for unread message count (feeds into Sidebar `badgeCounts`)

</code_context>

<specifics>
## Specific Ideas

- WhatsApp-style visual reference: right-aligned sender bubbles with colored background, left-aligned recipient bubbles with neutral background
- Broadcast = system-style full-width card, NOT a bubble — visually distinct from 1:1 messages
- Day separators styled as centered labels ("Today", "Yesterday", formatted date)
- Message grouping: consecutive same-sender messages within 2 minutes collapse (no repeated avatar/name, tighter spacing)
- Time block rule: 5+ minute gap triggers new timestamp display
- Conversation list shows last message preview text, relative timestamp, and unread dot indicator

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-chat-system*
*Context gathered: 2026-04-03*
