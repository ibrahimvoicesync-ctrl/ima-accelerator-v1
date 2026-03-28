import { getTodayUTC } from "@/lib/utils";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Discriminated union representing the deadline status of a roadmap step.
 *
 * - "none"      — step has target_days: null (no deadline)
 * - "completed" — step is completed; includes date and optional days-late count
 * - "on-track"  — deadline is more than 2 days away
 * - "due-soon"  — deadline is within 2 days (inclusive, includes today)
 * - "overdue"   — deadline has passed and step is not yet completed
 */
export type DeadlineStatus =
  | { kind: "none" }
  | { kind: "completed"; completedAt: string; daysLate: number | null }
  | { kind: "on-track"; deadlineLabel: string }
  | { kind: "due-soon"; deadlineLabel: string; daysLeft: number }
  | { kind: "overdue"; daysOverdue: number };

/**
 * Computes the deadline status for a roadmap step.
 *
 * @param target_days  Number of days from joined_at to deadline, or null for no deadline.
 * @param joinedAt     Student's joined_at timestamp (ISO or YYYY-MM-DD).
 * @param status       Current step status: "locked" | "active" | "completed".
 * @param completedAt  ISO timestamp when step was completed, or null.
 */
export function getDeadlineStatus(
  target_days: number | null,
  joinedAt: string,
  status: "locked" | "active" | "completed",
  completedAt: string | null
): DeadlineStatus {
  // Normalize joinedAt to YYYY-MM-DD regardless of format
  const normalizedJoinedAt = joinedAt.includes("T") ? joinedAt.split("T")[0] : joinedAt;

  // --- Completed branch ---
  if (status === "completed") {
    if (!completedAt) {
      // No completedAt available — show date as joinedAt, no late suffix
      return { kind: "completed", completedAt: normalizedJoinedAt, daysLate: null };
    }

    if (target_days === null) {
      // No deadline — show completed date but no late suffix (D-02)
      const normalizedCompletedAt = completedAt.includes("T") ? completedAt.split("T")[0] : completedAt;
      return { kind: "completed", completedAt: normalizedCompletedAt, daysLate: null };
    }

    // Compute deadline and completedDate in UTC
    const deadlineDate = new Date(normalizedJoinedAt + "T00:00:00Z");
    deadlineDate.setUTCDate(deadlineDate.getUTCDate() + target_days);

    const normalizedCompletedAt = completedAt.includes("T") ? completedAt.split("T")[0] : completedAt;
    const completedDate = new Date(normalizedCompletedAt + "T00:00:00Z");

    const daysLateRaw = Math.floor((completedDate.getTime() - deadlineDate.getTime()) / MS_PER_DAY);
    const daysLate = daysLateRaw > 0 ? daysLateRaw : null;

    return { kind: "completed", completedAt: normalizedCompletedAt, daysLate };
  }

  // --- No-deadline branch ---
  if (target_days === null) {
    return { kind: "none" };
  }

  // --- Active/locked deadline branch ---
  const deadlineDate = new Date(normalizedJoinedAt + "T00:00:00Z");
  deadlineDate.setUTCDate(deadlineDate.getUTCDate() + target_days);

  // Use getTodayUTC() — never new Date() — to avoid timezone pitfalls
  const today = new Date(getTodayUTC() + "T00:00:00Z");

  const daysLeft = Math.floor((deadlineDate.getTime() - today.getTime()) / MS_PER_DAY);

  const deadlineLabel = deadlineDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  if (daysLeft < 0) {
    return { kind: "overdue", daysOverdue: Math.abs(daysLeft) };
  }

  if (daysLeft <= 2) {
    // D-04: target_days: 0 steps show "Due Soon" on join day (daysLeft === 0), "Overdue" after
    return { kind: "due-soon", deadlineLabel, daysLeft };
  }

  return { kind: "on-track", deadlineLabel };
}
