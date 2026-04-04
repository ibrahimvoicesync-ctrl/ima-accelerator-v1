import { isToday, isYesterday, format, formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval for chat messages — 5 seconds (D-07 v1.4) */
export const MESSAGE_POLL_INTERVAL = 5000;

/** Number of messages loaded per page for cursor-based pagination (CHAT-08) */
export const MESSAGE_PAGE_SIZE = 30;

/** Maximum characters allowed in a single message (CHAT-12) */
export const MAX_MESSAGE_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A message row joined with the sender's display name */
export type MessageWithSender = {
  id: string;
  coach_id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string | null;
  is_broadcast: boolean;
  content: string;
  read_at: string | null;
  created_at: string;
};

/** A group of messages sharing the same calendar date */
export type MessageGroup = {
  date: string; // "yyyy-MM-dd" key
  messages: MessageWithSender[];
};

/** A run of consecutive messages from the same sender within 2 minutes */
export type ConsecutiveGroup = {
  senderId: string;
  messages: MessageWithSender[];
  isCollapsed: boolean;
};

// ---------------------------------------------------------------------------
// Timestamp formatters
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable day separator label for a given date.
 *
 * - "Today" — if the date is today
 * - "Yesterday" — if the date was yesterday
 * - "Mon, Mar 31" — formatted date for anything older (D-08)
 */
export function formatDaySeparator(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d");
}

/**
 * Returns a 12-hour clock time string for a given date.
 * Example: "2:30 PM"
 */
export function formatMessageTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Returns a relative time string (e.g. "2 minutes ago", "just now") for
 * display in conversation list previews.
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

// ---------------------------------------------------------------------------
// Message grouping
// ---------------------------------------------------------------------------

/**
 * Groups an array of messages by calendar date, sorted ascending by date.
 *
 * @param messages - Messages array (any order)
 * @returns Array of MessageGroup objects sorted by date ascending
 */
export function groupMessagesByDay(messages: MessageWithSender[]): MessageGroup[] {
  const map = new Map<string, MessageWithSender[]>();

  for (const msg of messages) {
    const key = format(new Date(msg.created_at), "yyyy-MM-dd");
    const existing = map.get(key);
    if (existing) {
      existing.push(msg);
    } else {
      map.set(key, [msg]);
    }
  }

  // Sort date keys ascending and return groups
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, msgs]) => ({ date, messages: msgs }));
}

/**
 * Returns true if a timestamp label should be shown above the current message.
 *
 * A new time block starts when:
 * - There is no previous message in the group, OR
 * - The gap between current and previous message is ≥ 5 minutes (D-09)
 */
export function shouldShowTimestamp(
  current: MessageWithSender,
  previous: MessageWithSender | null
): boolean {
  if (!previous) return true;
  const gapMs =
    new Date(current.created_at).getTime() -
    new Date(previous.created_at).getTime();
  return gapMs >= 5 * 60 * 1000;
}

/**
 * Returns true if the current message is consecutive with the previous one.
 *
 * Consecutive means:
 * - Same sender_id, AND
 * - Gap between messages is < 2 minutes (D-10)
 *
 * Used to collapse avatar/name repeats in the thread view.
 */
export function isConsecutive(
  current: MessageWithSender,
  previous: MessageWithSender | null
): boolean {
  if (!previous) return false;
  if (current.sender_id !== previous.sender_id) return false;
  const gapMs =
    new Date(current.created_at).getTime() -
    new Date(previous.created_at).getTime();
  return gapMs < 2 * 60 * 1000;
}
