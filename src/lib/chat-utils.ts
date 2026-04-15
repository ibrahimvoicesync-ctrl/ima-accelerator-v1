/**
 * Minimal client-safe time helpers for UI surfaces (originally used by
 * the Phase 54 chat feature; Phase 55 removed chat but Phase 56
 * announcements components reuse `formatRelativeTime` for timestamps).
 *
 * Keep this file free of server-only imports so both client and server
 * components can import it.
 */

/**
 * Format a Date as a short relative string ("now", "2 minutes ago",
 * "3 hours ago", "Yesterday", "3 days ago", then the absolute date).
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (Number.isNaN(diffSec)) return "";
  if (diffSec < 0) return "just now"; // clock skew guard
  if (diffSec < 45) return "just now";
  if (diffSec < 90) return "1 minute ago";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 45) return `${diffMin} minutes ago`;
  if (diffMin < 90) return "1 hour ago";

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hours ago`;
  if (diffHr < 48) return "Yesterday";

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} days ago`;

  // Older than a week — show the absolute date.
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
