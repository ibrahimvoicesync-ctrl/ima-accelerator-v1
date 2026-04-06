# Phase 35: Chat System - Research

**Researched:** 2026-04-03
**Domain:** Polling-based WhatsApp-style messaging UI, Next.js App Router API routes, Supabase Postgres queries, sidebar badge integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chat Layout**
- D-01: Two-panel split on desktop — conversation list (left, ~300px) + active thread (right, fills remaining width). Both panels visible simultaneously on desktop.
- D-02: Coach messages right-aligned with ima-primary background and white text. Student messages left-aligned with ima-surface-light background and ima-text color.
- D-03: Composer bar pinned to bottom of thread panel.

**Mobile Navigation**
- D-04: Single-page toggle, NOT separate routes. One route `/coach/chat` with state-driven view switching (`showThread: boolean`). Back button sets `showThread = false`.
- D-05: Student chat is also a single route `/student/chat` — single thread view only (no conversation list needed).

**Broadcast UX**
- D-06: "Broadcast" item pinned at top of conversation list with megaphone icon. Clicking it opens a thread view with a textarea and "Send to all students" button.
- D-07: Broadcast messages appear in student chat as full-width system-style cards (ima-surface-accent background, megaphone icon, no bubble alignment).

**Timestamps & Grouping**
- D-08: Day separators displayed as centered labels ("Today", "Yesterday", "Mon, Mar 31").
- D-09: Within a day, show timestamp on the first message of each time block (5+ minute gap triggers new block).
- D-10: Consecutive messages from the same sender within 2 minutes — collapse (no avatar/name repeat, tighter spacing, timestamp only on last message).

**Carried Forward (locked in prior phases)**
- D-07 (v1.4): Polling at 5s interval, NOT Supabase Realtime (avoids 500 connection limit on Pro plan)
- D-08 (v1.4): Coach↔individual student 1:1 + coach→all broadcast (two chat modes)
- D-09 (v1.4): Students CAN reply to coaches (two-way async)
- D-01 (Phase 30): Single `messages` table with `is_broadcast` boolean flag. `recipient_id` is NULL for broadcast messages. `coach_id` serves as conversation anchor.
- D-02 (Phase 30): Per-message `read_at` timestamptz column for unread tracking. Unread count = `COUNT(*) WHERE recipient_id = :user_id AND read_at IS NULL`.
- D-05 (v1.4): Student_DIY has NO chat access

### Claude's Discretion

- Polling hook implementation details (useInterval with useRef pattern — pitfall already documented)
- Cursor-based pagination implementation for older messages (CHAT-08)
- Auto-scroll behavior implementation (CHAT-09)
- Mark-as-read API design (batch vs per-conversation)
- Conversation list sorting strategy (most recent first)
- Empty state content and copy

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Coach sees conversation list with all assigned students, showing last message preview, timestamp, unread indicator | GET /api/messages with coach_id filter; conversation list query pattern documented below |
| CHAT-02 | Coach can open a 1:1 conversation and see message history in WhatsApp-style bubbles | Thread view component with is_broadcast=false filter; bubble alignment via sender_id === profile.id |
| CHAT-03 | Coach sends message that appears in student's conversation within 5 seconds (right-aligned); student sees it left-aligned | POST /api/messages; 5s polling on GET /api/messages; no rate limit on GET |
| CHAT-04 | Student can reply to their coach; coach sees reply within 5 seconds | POST /api/messages for student role; same polling pattern |
| CHAT-05 | Coach can send broadcast to all assigned students; students see it as distinct system-style card with megaphone icon | POST /api/messages with is_broadcast=true, recipient_id=null; student read query includes broadcast filter |
| CHAT-06 | Unread message count appears as sidebar badge for coach and student roles | Extend get_sidebar_badges RPC or add unread_messages key to badgeCounts via new migration; layout.tsx already handles dynamic badge keys |
| CHAT-07 | Opening a conversation marks its messages as read (unread indicator clears) | PATCH /api/messages/read with coach_id + student_id; bulk UPDATE WHERE read_at IS NULL |
| CHAT-08 | Scrolling up loads older messages via cursor-based pagination | `created_at < :cursor` with ORDER BY created_at DESC LIMIT N; scroll event handler with IntersectionObserver or onScroll |
| CHAT-09 | Chat auto-scrolls to newest message on send and on new incoming messages | useRef on scroll container; scrollIntoView on message list bottom ref; track previous messages.length |
| CHAT-10 | Mobile layout: conversation list is default view; tapping a conversation navigates to thread with back button | `showThread` state in page component; conditional render; back button resets state |
| CHAT-11 | Student_DIY does NOT have chat navigation or access to /student/chat | student_diy not in NAVIGATION config; proxy ROLE_ROUTE_ACCESS restricts /student to student role only |
| CHAT-12 | Chat composer enforces 2000 character limit with visible counter | maxLength attribute on textarea; controlled input with character counter display |
| CHAT-13 | Empty state displays when no conversations exist yet | EmptyState component already available |
</phase_requirements>

---

## Summary

Phase 35 builds a polling-based WhatsApp-style chat system on top of a `messages` table already provisioned by Phase 30 (migration 00015). The schema is complete, RLS policies are in place, and TypeScript types are defined in `src/lib/types.ts`. The implementation is entirely application-layer: new page files, new API routes, and extensions to the navigation config and sidebar badge system.

The primary technical challenges are: (1) the polling hook that must use `useRef` for stable callback references to prevent stale closures and memory leaks, (2) cursor-based pagination that must not disrupt scroll position when prepending older messages, (3) the sidebar unread badge which requires either a Postgres RPC extension or a new standalone RPC, and (4) the mark-as-read API that must fire on conversation open without calling `checkRateLimit()`.

No new npm dependencies are required — `date-fns` (v4.1.0, already installed) covers all relative/absolute timestamp formatting. `lucide-react` (v0.576.0) covers the megaphone icon (`Megaphone`) and other UI icons. The existing `Textarea`, `Button`, `Card`, `EmptyState`, `Spinner`, and `Skeleton` UI components are directly reusable.

**Primary recommendation:** Implement in four sequential concerns: (1) API routes, (2) navigation config + proxy + badge RPC, (3) coach chat page, (4) student chat page. Complete the DB migration for badge extension before touching layout.tsx.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App Router pages, API routes | Project stack |
| React | 19.2.3 | Client components, hooks | Project stack |
| TypeScript | strict | Type safety | Project stack |
| Supabase JS | installed | Admin client for DB queries | Project stack |
| date-fns | ^4.1.0 | Relative timestamps, date formatting | Already installed, covers formatRelative, format, isToday, isYesterday |
| lucide-react | ^0.576.0 | Megaphone, MessageSquare, Send icons | Already installed |
| zod | ^4.3.6 | API input validation | Project stack — import from "zod" NOT "zod/v4" |

### No New Dependencies

Confirmed: zero new npm packages needed. All required functionality exists in the current dependency set.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── coach/
│   │   │   └── chat/
│   │   │       └── page.tsx          # CoachChatPage (client component, polling, split panel)
│   │   └── student/
│   │       └── chat/
│   │           └── page.tsx          # StudentChatPage (client component, polling, thread only)
│   └── api/
│       └── messages/
│           ├── route.ts              # GET (list/poll), POST (send)
│           └── read/
│               └── route.ts         # PATCH (mark as read)
├── components/
│   └── chat/
│       ├── ConversationList.tsx     # Left panel: list of conversations with unread dot
│       ├── MessageThread.tsx        # Right panel: scrollable message history
│       ├── MessageBubble.tsx        # Individual message bubble (1:1 vs broadcast)
│       ├── BroadcastCard.tsx        # Full-width broadcast system card
│       ├── ChatComposer.tsx         # Pinned bottom textarea + send button + char counter
│       └── DaySeparator.tsx         # "Today" / "Yesterday" / date label
└── lib/
    └── hooks/
        └── usePolling.ts            # useRef + setInterval polling hook
supabase/
└── migrations/
    └── 00017_chat_badges.sql        # Extend get_sidebar_badges RPC for unread_messages
```

### Pattern 1: Polling Hook with useRef

The `WorkTimer.tsx` component demonstrates the canonical pattern: use `useRef` for stable callback references, `useEffect` for the interval, and return a cleanup function. The chat polling hook follows the same approach.

**What:** A `usePolling` hook that calls a fetch function on a fixed interval without recreating the interval on every render.
**When to use:** Any client component that needs server-driven data updates without Supabase Realtime.

```typescript
// Source: Derived from src/components/student/WorkTimer.tsx pattern
// usePolling.ts
import { useEffect, useRef, useCallback } from "react";

export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled = true
) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    // Call immediately on mount, then every intervalMs
    void callbackRef.current();
    const id = setInterval(() => void callbackRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
```

**Critical:** The callback ref pattern prevents stale closures. Without it, the interval closure captures the initial `messages` state and never updates.

### Pattern 2: API Route Order

Every mutation route follows this exact order (from `src/app/api/reports/[id]/comment/route.ts` and CLAUDE.md):

```
CSRF → Auth → Role check → Rate limit (mutations only) → Body parse → Zod validate → Ownership check → DB operation
```

GET routes omit CSRF and rate limit (confirmed pattern in `/api/calendar/route.ts` and `/api/daily-plans/route.ts`).

### Pattern 3: Conversation List Query

To build the conversation list for a coach, we need one row per student with the last message and unread count. The most efficient approach with the current schema (no DISTINCT ON available in Supabase JS builder without RPC):

```sql
-- Per-student conversation summary for coach view
-- Option A: Single RPC (preferred for efficiency)
-- Option B: JS-side aggregation after fetching latest N messages per student

-- Recommended: fetch all messages for coach_id ordered by created_at DESC,
-- then group by student in JS to compute last message + unread count.
-- For coaches with ≤50 students and typical message volumes, this is fine.
-- The partial index idx_messages_recipient_read already optimizes unread queries.
```

For the conversation list, the recommended JS-side approach:
1. `GET /api/messages?type=conversations` — returns one summary row per student (last message + unread count) using a Supabase `.rpc()` call or JS aggregation
2. Sort by `last_message_at DESC` to show most recent conversations first

Alternatively, a simpler first pass: fetch all messages with `coach_id = :id ORDER BY created_at DESC LIMIT 200` and aggregate in JS. Given the scale (50 students max, ~5s polling), this is acceptable.

### Pattern 4: Cursor-Based Pagination Without Scroll Jump

```typescript
// Load older messages by cursor
// CRITICAL: prepend new messages WITHOUT resetting scroll position
// 1. Record scrollHeight BEFORE prepending
// 2. Prepend messages to state
// 3. In useEffect after state update: scrollContainer.scrollTop += (newScrollHeight - prevScrollHeight)

const loadOlderMessages = useCallback(async () => {
  if (!oldestCursor || isLoadingMore) return;
  const prevScrollHeight = scrollContainerRef.current?.scrollHeight ?? 0;
  
  const older = await fetchMessages({ before: oldestCursor, limit: 20 });
  setMessages(prev => [...older, ...prev]);
  setOldestCursor(older[0]?.created_at ?? null);
  
  // Restore scroll position after DOM update
  requestAnimationFrame(() => {
    if (scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop += newScrollHeight - prevScrollHeight;
    }
  });
}, [oldestCursor, isLoadingMore]);
```

**Trigger:** Detect scroll to top with `onScroll` handler — when `scrollTop < 100`, call `loadOlderMessages`.

### Pattern 5: Auto-Scroll to Newest Message

```typescript
// Use a bottom sentinel ref
const bottomRef = useRef<HTMLDivElement>(null);

// Scroll on initial load AND on new messages from polling
const prevMessageCountRef = useRef(0);
useEffect(() => {
  const isNewMessage = messages.length > prevMessageCountRef.current;
  prevMessageCountRef.current = messages.length;
  
  if (isNewMessage || isInitialLoad) {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }
}, [messages.length]);

// In JSX: <div ref={bottomRef} /> at the end of message list
```

**Guard:** Only auto-scroll if user is near the bottom OR if the new message was sent by the current user. If user has scrolled up to read history, do NOT interrupt.

### Pattern 6: Mark-as-Read on Conversation Open

```typescript
// PATCH /api/messages/read — called when conversation opens
// No CSRF (it is a PATCH which is a mutation, so CSRF IS required)
// No rate limit (but CSRF is still needed for mutations)
// Bulk UPDATE: WHERE coach_id = :coach_id AND recipient_id = :viewer_id AND read_at IS NULL
```

Note: PATCH is a mutation — it DOES need CSRF protection. It does NOT need `checkRateLimit()` because it fires at most once per conversation open, not at user-defined frequency.

### Anti-Patterns to Avoid

- **Calling checkRateLimit() on GET /api/messages:** GET polling runs every 5 seconds — rate limiting would block legitimate traffic within 30 seconds. Confirmed from STATE.md pitfall and CLAUDE.md.
- **Calling checkRateLimit() on PATCH /api/messages/read:** Mark-as-read fires on conversation open. Not a rate-limit candidate. It still DOES need CSRF.
- **useState for polling callback:** Causes the interval to restart on every render. Use useRef pattern from WorkTimer.tsx.
- **Separate routes for mobile/desktop chat views:** Locked against by D-04. Use `showThread` state on single route.
- **Hardcoding role strings:** Import from `src/lib/config.ts` ROLES constant.
- **Missing CSRF on POST /api/messages and PATCH /api/messages/read:** Both are mutations and must call `verifyOrigin(request)`.
- **Auto-scrolling when user has scrolled up:** Interrupt UX bug. Guard with a "user is near bottom" check before auto-scrolling on poll.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Relative timestamps ("2 min ago") | Custom time diff functions | `date-fns` `formatDistanceToNow`, `isToday`, `isYesterday` | Already installed, handles edge cases, i18n-ready |
| Megaphone icon | SVG inline | `lucide-react` `Megaphone` | Already in ICON_MAP-compatible format |
| Character counter | Custom string length tracking | `value.length` with `maxLength` constraint | Textarea already supports this natively |
| Message input validation | Custom length check | Zod `z.string().min(1).max(2000)` | Consistent with all other API validation |
| Scroll-to-bottom | Custom scroll logic | `ref.scrollIntoView()` | Native, no library needed |
| Conversation grouping | Complex state | JS `reduce()` to group messages by student | Simple aggregation, no library needed |

**Key insight:** The entire UI layer is achievable with existing primitives. The complexity in this phase is in state management and timing — not in building new UI infrastructure.

---

## Common Pitfalls

### Pitfall 1: Stale Closure in Polling Interval
**What goes wrong:** `setInterval(() => fetchMessages(), 5000)` captures the initial `messages` state. New messages arrive but the handler compares against the stale initial array, causing duplicates or missed updates.
**Why it happens:** JavaScript closures capture variables at creation time. `setInterval` does not re-capture on re-render.
**How to avoid:** Use `useRef` to hold the callback, update the ref on every render, and call `callbackRef.current()` inside the interval. See `WorkTimer.tsx` and the `usePolling` hook pattern above.
**Warning signs:** Messages duplicate on screen; new messages stop appearing after a few polls; `messages.length` inside the callback is always 0.

### Pitfall 2: Rate-Limiting the Polling GET Endpoint
**What goes wrong:** Adding `checkRateLimit()` to `GET /api/messages` causes coaches/students to hit the 30 req/min cap within 6 minutes (5s * 12 polls/min = 72 req/min), resulting in 429 errors for all users.
**Why it happens:** Rate limiter was designed for mutations. GET polling is read-only and high-frequency.
**How to avoid:** Never call `checkRateLimit()` on GET endpoints. Confirmed in STATE.md and CLAUDE.md pitfall.
**Warning signs:** 429 errors in browser console after ~5 minutes of chat page open.

### Pitfall 3: Scroll Position Jump on Pagination Prepend
**What goes wrong:** `setMessages([...olderMessages, ...currentMessages])` causes the scroll container to jump to the top because the DOM re-renders with new content above the viewport.
**Why it happens:** Browser scrollTop is an absolute pixel value. Adding content above the viewport changes the scroll position visually even though scrollTop doesn't change.
**How to avoid:** Record `scrollHeight` before state update, then after the DOM re-renders set `scrollTop += (newScrollHeight - prevScrollHeight)` using `requestAnimationFrame`.
**Warning signs:** User scrolls up to see older messages; list jumps to top; user loses their reading position.

### Pitfall 4: Auto-Scroll Interrupting Manual Scroll
**What goes wrong:** Polling fires, new message arrives, `scrollIntoView()` is called, user who was scrolling up to read history is snapped to bottom.
**Why it happens:** Unconditional auto-scroll on every new message.
**How to avoid:** Track whether user is "near bottom" (scrollTop + clientHeight >= scrollHeight - 100px). Only auto-scroll if near bottom OR if the new message was sent by the current user.
**Warning signs:** Users report losing their place when trying to scroll up.

### Pitfall 5: Missing CSRF on Mutation Routes
**What goes wrong:** POST /api/messages or PATCH /api/messages/read omit `verifyOrigin()`, creating a CSRF vulnerability.
**Why it happens:** Developer assumes GET endpoints don't need CSRF — correct — but forgets that PATCH/POST always do.
**How to avoid:** Follow the canonical API route order: CSRF → Auth → Role → Rate limit → Body → Zod → Logic. First line of every mutation handler must be `const csrfError = verifyOrigin(request); if (csrfError) return csrfError;`.
**Warning signs:** TypeScript passes but code review flags missing CSRF check.

### Pitfall 6: Missing `unread_messages` Key in Badge System
**What goes wrong:** Adding `badge: "unread_messages"` to NAVIGATION without extending `get_sidebar_badges` RPC and `SidebarBadgesResult` type means the badge key is always undefined — badge never renders.
**Why it happens:** Badge system requires three aligned changes: (1) NAVIGATION config, (2) Postgres RPC, (3) TypeScript type, (4) layout.tsx badge extraction. Missing any one link breaks the chain.
**How to avoid:** Plan the badge extension as a discrete task. The RPC must be in a new migration (00017). The `SidebarBadgesResult` type in `src/lib/rpc/types.ts` must add `unread_messages?: number`. Layout.tsx must extract `badges.unread_messages` and push to `badgeCounts`.
**Warning signs:** Badge renders for `active_alerts` and `unreviewed_reports` but never for `unread_messages`.

### Pitfall 7: Student_DIY Accessing /student/chat
**What goes wrong:** `student_diy` role tries to access `/student/chat` which is inside `(dashboard)/student/` folder — proxy allows `/student_diy` paths only.
**Why it happens:** The proxy `ROLE_ROUTE_ACCESS` already blocks student_diy from `/student/*` paths. This is already correct behavior from Phase 31 — no new proxy change needed.
**How to avoid:** Do NOT add `/student_diy` to NAVIGATION for chat. Do NOT add a chat route under `/student_diy/`. The proxy already enforces this. Just omit chat from `student_diy` NAVIGATION array.
**Warning signs:** Student_diy user sees a chat link in sidebar (means NAVIGATION was accidentally modified).

---

## Code Examples

Verified patterns from official sources and existing codebase:

### GET /api/messages — Polling Endpoint (no CSRF, no rate limit)

```typescript
// Source: Derived from src/app/api/calendar/route.ts and src/app/api/daily-plans/route.ts GET pattern
export async function GET(request: NextRequest) {
  // Auth only — no CSRF, no rate limit for GET
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role, coach_id")
    .eq("auth_id", authUser.id)
    .single();

  if (!profile || !["coach", "student"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ... query messages filtered by coach_id + optional student_id param
}
```

### POST /api/messages — Send Message

```typescript
// Source: Derived from src/app/api/reports/[id]/comment/route.ts
const messageSchema = z.object({
  content: z.string().min(1).max(2000),
  recipient_id: z.string().uuid().nullable(),  // null for broadcast
  is_broadcast: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;
  // Auth → Role → Rate limit → Parse → Zod → DB insert
}
```

### PATCH /api/messages/read — Mark as Read

```typescript
// Source: Derived from existing mutation patterns
const readSchema = z.object({
  coach_id: z.string().uuid(),
  // For student: marks messages from coach as read
  // For coach: marks messages from student (recipient_id = coach) as read
});

export async function PATCH(request: NextRequest) {
  const csrfError = verifyOrigin(request);
  if (csrfError) return csrfError;
  // Auth → Role → (no rate limit) → Parse → Zod → bulk UPDATE read_at = now()
  // WHERE coach_id = :coach_id AND recipient_id = :current_user_id AND read_at IS NULL
}
```

### Conversation List Aggregation (JS-side)

```typescript
// Group messages by student, compute last message + unread count
type ConversationSummary = {
  studentId: string;
  studentName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

function buildConversationList(
  messages: MessageRow[],
  students: { id: string; name: string }[]
): ConversationSummary[] {
  const grouped = new Map<string, MessageRow[]>();
  for (const msg of messages) {
    // 1:1 messages: key by the non-coach participant
    const studentId = msg.sender_id !== coachId ? msg.sender_id : msg.recipient_id;
    if (!studentId) continue;
    const arr = grouped.get(studentId) ?? [];
    arr.push(msg);
    grouped.set(studentId, arr);
  }
  return students
    .map((s) => {
      const msgs = grouped.get(s.id) ?? [];
      const last = msgs[0]; // already ordered DESC
      const unread = msgs.filter(m => m.recipient_id === coachId && !m.read_at).length;
      return { studentId: s.id, studentName: s.name, lastMessage: last?.content ?? "", lastMessageAt: last?.created_at ?? "", unreadCount: unread };
    })
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}
```

### Timestamp Formatting with date-fns v4

```typescript
// Source: date-fns v4 API (installed version)
import { isToday, isYesterday, format, formatDistanceToNow } from "date-fns";

function formatDaySeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d"); // "Mon, Mar 31"
}

function formatRelativeTimestamp(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true }); // "2 minutes ago"
}
```

### Unread Badge RPC Extension (migration 00017)

```sql
-- Extend get_sidebar_badges to include unread_messages for coach and student roles
CREATE OR REPLACE FUNCTION public.get_sidebar_badges(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ... existing variables ...
  v_unread_count integer := 0;
BEGIN
  IF p_role = 'coach' THEN
    -- existing unreviewed_reports logic ...
    -- Add unread count: messages sent TO coach (recipient_id = coach) in their conversations
    SELECT count(*) INTO v_unread_count
    FROM messages
    WHERE coach_id = p_user_id
      AND recipient_id = p_user_id
      AND read_at IS NULL;
    RETURN jsonb_build_object(
      'unreviewed_reports', v_unreviewed_count,
      'unread_messages', v_unread_count
    );
  END IF;

  IF p_role = 'student' THEN
    -- Student: messages sent to them (recipient_id = student) by their coach, unread
    -- Also include unread broadcasts from their coach
    SELECT count(*) INTO v_unread_count
    FROM messages m
    JOIN users u ON u.id = p_user_id
    WHERE m.coach_id = u.coach_id
      AND (
        (m.recipient_id = p_user_id AND m.read_at IS NULL)
        OR (m.is_broadcast = true AND m.read_at IS NULL
            AND NOT EXISTS (
              -- If broadcast read tracking is per-message, use the global read_at
              -- For MVP: track broadcast read via a separate mechanism or use NULL check
              SELECT 1 FROM messages WHERE id = m.id AND read_at IS NOT NULL
            ))
      );
    RETURN jsonb_build_object('unread_messages', v_unread_count);
  END IF;

  -- owner and other roles: existing behavior, add unread_messages: 0
  -- ... existing owner logic ...
END;
$$;
```

**Important note on broadcast read tracking:** The current schema has `read_at` as a single column on `messages`. For 1:1 messages, `read_at` means "the recipient read this." For broadcasts sent to multiple students, `read_at` semantically means "some student read it" — but which student? This is a schema limitation. For MVP: track broadcast reads using the same `read_at` field but understand it's the first student to read it who "marks" it globally. The unread badge for broadcasts is best-effort in v1. The planner should include a note about this limitation.

### Navigation Config Addition

```typescript
// Source: src/lib/config.ts NAVIGATION map — add to coach and student arrays
// Coach nav (add after Analytics):
{ label: "Chat", href: "/coach/chat", icon: "Chat", badge: "unread_messages", separator: true }
// OR use an existing icon — "MessageSquare" already registered in Sidebar ICON_MAP

// Student nav (add after Daily Report):
{ label: "Chat", href: "/student/chat", icon: "MessageSquare", badge: "unread_messages" }

// student_diy nav: NO CHANGE — CHAT-11 requires exclusion
```

**Note:** `MessageSquare` is already in the Sidebar `ICON_MAP`. No new icon registration needed. The new icon "Megaphone" for broadcast is used only inside the chat components, not in the sidebar, so it does NOT need to be added to the Sidebar `ICON_MAP`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Realtime for chat | 5s polling (D-07) | Phase 30 decision | No connection limit concern; simpler; 5s latency acceptable |
| Per-message read routes | Bulk PATCH mark-as-read | Phase 35 decision | Fewer API calls; opens conversation = batch update |
| Separate mobile/desktop routes | Single route with showThread state (D-04) | Phase 35 decision | Less file duplication; polling state survives panel toggle |

**Not applicable to this phase:**
- Supabase Realtime: explicitly out of scope (CHAT-V2-04)
- Message editing/deletion: explicitly out of scope (CHAT-V2-01)
- File/image uploads: explicitly out of scope (CHAT-V2-02)

---

## Open Questions

1. **Broadcast read_at semantics**
   - What we know: `read_at` is a single column on `messages`. For 1:1 DMs, it tracks when the recipient read it. For broadcasts, all students receive the same message row — but there's only one `read_at` field.
   - What's unclear: How to track per-student read status for broadcasts without a join table.
   - Recommendation: For v1, use `read_at` on broadcast messages to mean "at least one student has read it" — this is an approximation. The unread badge for broadcasts will clear after the first student opens the broadcast. This is acceptable per v1 scope. Document limitation in code comment. A proper solution (broadcast_reads junction table) is v2.

2. **Conversation query strategy for coach: RPC vs JS aggregation**
   - What we know: A coach has ≤50 students (COACH_CONFIG.maxStudentsPerCoach). Messages volume per coach is manageable. The existing `idx_messages_coach_recipient` index makes coach_id queries fast.
   - What's unclear: Whether JS-side aggregation (fetch all coach messages, group by student) is fast enough at scale.
   - Recommendation: Start with JS-side aggregation — fetch last 200 messages for the coach, group by student in JS. Add a Postgres RPC only if performance is problematic (highly unlikely at this user scale).

3. **Student broadcast unread badge: RLS complexity**
   - What we know: The student RLS SELECT policy includes broadcasts where `coach_id = (SELECT coach_id FROM users WHERE id = get_user_id())`. The admin client in the RPC bypasses RLS.
   - What's unclear: Whether the RPC's student unread count query (which must JOIN users to get coach_id) is correctly scoped.
   - Recommendation: Test the RPC query in the Supabase SQL editor with a test student user ID before committing the migration.

---

## Environment Availability

Step 2.6: SKIPPED (no external tools or services required beyond the existing Supabase + Next.js stack, which is confirmed operational from prior phases).

---

## Validation Architecture

Nyquist validation is enabled (config.json has `nyquist_validation: true`).

### Test Framework

No test framework is configured in this project. `src/` contains zero test files. No `jest.config.*`, `vitest.config.*`, or `pytest.ini` detected. There is no `test` script in `package.json` devDependencies beyond ESLint.

This project uses UAT (manual user acceptance testing) as the validation gate, consistent with all prior phases.

| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | None |
| Quick run command | `npm run lint && npx tsc --noEmit` |
| Full suite command | `npm run lint && npx tsc --noEmit && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| CHAT-01 | Coach conversation list shows students, last message, timestamp, unread dot | manual-UAT | — | UI state |
| CHAT-02 | WhatsApp-style bubbles render correctly | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | TypeScript catches prop errors |
| CHAT-03 | Message appears within 5s (polling) | manual-UAT | — | Timing-dependent |
| CHAT-04 | Student reply visible to coach within 5s | manual-UAT | — | Timing-dependent |
| CHAT-05 | Broadcast card renders with megaphone icon | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | UI rendering |
| CHAT-06 | Sidebar badge shows unread count | manual-UAT | — | Requires RPC + layout integration |
| CHAT-07 | Opening conversation clears unread indicator | manual-UAT | — | API integration |
| CHAT-08 | Scrolling up loads older messages, no scroll jump | manual-UAT | — | Scroll behavior |
| CHAT-09 | Auto-scroll on send/new message | manual-UAT | — | Scroll behavior |
| CHAT-10 | Mobile: list → thread → back button works | manual-UAT | — | State machine |
| CHAT-11 | Student_DIY has no chat nav or access | lint + proxy | `npx tsc --noEmit` + manual login as student_diy | Config + proxy |
| CHAT-12 | Composer enforces 2000 char limit with counter | manual-UAT + lint | `npm run lint && npx tsc --noEmit` | UI constraint |
| CHAT-13 | Empty state renders when no conversations | manual-UAT | — | UI state |

### Sampling Rate
- **Per task commit:** `npm run lint && npx tsc --noEmit`
- **Per wave merge:** `npm run lint && npx tsc --noEmit && npm run build`
- **Phase gate:** Build green + UAT checklist before `/gsd:verify-work`

### Wave 0 Gaps
None — no test framework to install. Validation is lint + type check + build + manual UAT, consistent with all prior phases.

---

## Project Constraints (from CLAUDE.md)

All directives below MUST be enforced during every task in this phase:

1. **motion-safe:** — every `animate-*` class MUST use `motion-safe:animate-*`
2. **44px touch targets** — every interactive element needs `min-h-[44px]`; chat send button, back button, conversation list items all must meet this requirement
3. **Accessible labels** — every input needs `aria-label` or `<label>` with `htmlFor`+`id`; the chat composer textarea must have an accessible label
4. **Admin client in API routes** — every `.from()` query in route handlers uses the admin client (`createAdminClient()`)
5. **Never swallow errors** — every `catch` block must toast or `console.error`
6. **Check response.ok** — every `fetch()` in client components must check `response.ok` before parsing JSON
7. **Zod import** — `import { z } from "zod"`, never `"zod/v4"`
8. **ima-* tokens only** — coach bubble background: `bg-ima-primary text-white`; student bubble: `bg-ima-surface-light text-ima-text`; broadcast card: `bg-ima-surface-accent`; NO hardcoded hex colors
9. **Config is truth** — import roles, nav from `src/lib/config.ts`; add chat routes to ROUTES object
10. **Admin client only in server code** — never import `createAdminClient` in client components
11. **Proxy not middleware** — chat routes (`/coach/chat`, `/student/chat`) are protected by `src/proxy.ts` `ROLE_ROUTE_ACCESS` — add both prefixes
12. **Google OAuth only** — no auth flow changes needed

**Additional chat-specific constraints:**
- `GET /api/messages` polling endpoint MUST NOT call `checkRateLimit()`
- `POST /api/messages` and `PATCH /api/messages/read` MUST call `verifyOrigin(request)` first
- `MessageSquare` icon is already in Sidebar `ICON_MAP` — use it for chat nav item
- `Megaphone` from lucide-react is used inside chat components only — no ICON_MAP update needed
- `date-fns` v4 API: use named imports `import { isToday, isYesterday, format, formatDistanceToNow } from "date-fns"`

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/reports/[id]/comment/route.ts` — canonical mutation API route pattern
- `src/app/api/calendar/route.ts` — canonical GET route (no CSRF, no rate limit)
- `src/app/api/daily-plans/route.ts` — GET + POST pattern, confirms GET skips rate limit
- `src/components/student/WorkTimer.tsx` — useRef polling pattern
- `src/components/layout/Sidebar.tsx` — badgeCounts prop, ICON_MAP, badge rendering
- `src/app/(dashboard)/layout.tsx` — getSidebarBadges RPC call, badge extraction pattern
- `src/lib/rpc/types.ts` — SidebarBadgesResult type to extend
- `supabase/migrations/00015_v1_4_schema.sql` — complete messages table schema + RLS
- `src/lib/types.ts` — MessageRow/Insert/Update types confirmed
- `src/lib/config.ts` — NAVIGATION map, NavItem type, ROLES
- `src/proxy.ts` — ROLE_ROUTE_ACCESS (must add /coach/chat, /student/chat paths)
- `.planning/phases/35-chat-system/35-CONTEXT.md` — all locked decisions
- `.planning/REQUIREMENTS.md` — all 13 CHAT requirements

### Secondary (MEDIUM confidence)
- date-fns v4 API: `isToday`, `isYesterday`, `format`, `formatDistanceToNow` are stable v4 exports (verified against installed version ^4.1.0)
- lucide-react `Megaphone` icon: confirmed available in lucide-react v0.576.0

### Tertiary (LOW confidence)
- Broadcast read_at per-student tracking limitation: architectural assessment, not official doc

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and verified
- Architecture: HIGH — patterns derived directly from existing codebase files
- API routes: HIGH — based on multiple existing route files
- Polling hook: HIGH — directly adapted from WorkTimer.tsx
- Badge RPC extension: MEDIUM — RPC SQL is sound but broadcast read_at semantics have an acknowledged limitation
- Pitfalls: HIGH — sourced from STATE.md accumulated pitfalls and direct code analysis

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable stack, internal codebase)
