# Phase 35: Chat System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 35-chat-system
**Areas discussed:** Chat layout, Mobile navigation, Broadcast UX, Timestamps & grouping

---

## Chat Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two-panel split | Conversation list (left, ~300px) + active thread (right) | ✓ |
| Full-page thread | Conversation list as separate view, thread takes full width | |
| Sidebar panel | Slide-out panel for thread over conversation list | |

**User's choice:** Two-panel split on desktop — conversation list (left, ~300px) + active thread (right, fills remaining). Coach messages right-aligned (ima-primary bg, white text), student messages left-aligned (ima-surface-light bg, ima-text). Composer bar pinned to bottom of thread panel. On desktop both panels visible simultaneously.

**Notes:** User provided all decisions upfront in a single comprehensive response.

---

## Mobile Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page toggle | State-driven view switching (showThread boolean) within one route | ✓ |
| Separate routes | /coach/chat for list, /coach/chat/[id] for thread | |

**User's choice:** Single-page toggle, NOT separate routes. One route `/coach/chat` with state-driven view switching (`showThread: boolean`). Back button sets `showThread = false`. Same for `/student/chat` — single route, single thread view (no conversation list needed since students only talk to their coach).

**Notes:** User explicitly chose single-page to avoid extra route files and keep polling state in one component.

---

## Broadcast UX

| Option | Description | Selected |
|--------|-------------|----------|
| Top of conversation list | "Broadcast" item pinned at top with megaphone icon, opens in thread panel | ✓ |
| Floating action button | FAB for compose, separate from conversation list | |
| Separate tab | Dedicated broadcast tab alongside conversations | |

**User's choice:** "Broadcast" item pinned at top of conversation list with megaphone icon. Clicking it opens a thread view with textarea and "Send to all students" button. Broadcast messages appear in student chat as full-width system-style cards (ima-surface-accent bg, megaphone icon, no bubble alignment). Not a separate tab — just another conversation in the list.

**Notes:** Broadcast is visually integrated into the conversation list but messages render distinctly (system cards, not bubbles).

---

## Timestamps & Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Day separators + time blocks | Centered day labels, timestamps on 5-min gap blocks, 2-min sender grouping | ✓ |
| Per-message timestamps | Every message shows its own timestamp | |
| Minimal timestamps | Only day separators, no inline timestamps | |

**User's choice:** Day separators ("Today", "Yesterday", "Mon, Mar 31"). Within a day, show timestamp on first message of each time block (5+ min gap). Consecutive messages from same sender within 2 minutes — collapse: no avatar/name repeat, tighter spacing, timestamp only on last message in the group.

**Notes:** Detailed grouping rules provided for both time blocks and sender collapse.

---

## Claude's Discretion

- Polling hook implementation (useInterval + useRef pattern)
- Cursor-based pagination for older messages
- Auto-scroll behavior
- Mark-as-read API design
- Conversation list sorting
- Empty state content

## Deferred Ideas

None — discussion stayed within phase scope
