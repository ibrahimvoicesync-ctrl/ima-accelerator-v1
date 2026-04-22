import { KPI_TARGETS, WORK_TRACKER } from "@/lib/config";

export type RagStatus = "green" | "amber" | "red" | "neutral";

/** Returns RAG status for a given ratio (actual/target). Per D-04, returns "neutral" for day-zero (daysInProgram < 1). */
export function getRagStatus(ratio: number, daysInProgram: number): RagStatus {
  if (daysInProgram < 1) return "neutral";
  if (ratio >= 1.0) return "green";
  if (ratio >= 0.8) return "amber";
  return "red";
}

/** Lifetime outreach RAG: ratio of actual against the lifetime target (2500). Green at 100%, amber at 80%, red below. */
export function lifetimeOutreachRag(actual: number, daysInProgram: number): RagStatus {
  if (daysInProgram < 1) return "neutral";
  return getRagStatus(actual / KPI_TARGETS.lifetimeOutreach, daysInProgram);
}

/** Per D-02: Daily outreach RAG: green >= 50, amber >= 40, red < 40 */
export function dailyOutreachRag(actual: number, daysInProgram: number): RagStatus {
  return getRagStatus(actual / KPI_TARGETS.dailyOutreach, daysInProgram);
}

/** Per D-03: Daily hours RAG: green >= 4h, amber >= 3h12m, red < 3h12m */
export function dailyHoursRag(minutesWorked: number, daysInProgram: number): RagStatus {
  const goalMinutes = WORK_TRACKER.dailyGoalHours * 60;
  return getRagStatus(minutesWorked / goalMinutes, daysInProgram);
}

/** Lifetime hours RAG: ratio of actual minutes against KPI_TARGETS.lifetimeHours * 60. */
export function lifetimeHoursRag(minutesWorked: number, daysInProgram: number): RagStatus {
  const goalMinutes = KPI_TARGETS.lifetimeHours * 60;
  return getRagStatus(minutesWorked / goalMinutes, daysInProgram);
}

/** Maps RagStatus to text color class using ima-* tokens */
export function ragToColorClass(status: RagStatus): string {
  switch (status) {
    case "green":  return "text-ima-success";
    case "amber":  return "text-ima-warning";
    case "red":    return "text-ima-error";
    default:       return "text-ima-text-secondary";
  }
}

/** Maps RagStatus to background class for indicator dots/bars */
export function ragToBgClass(status: RagStatus): string {
  switch (status) {
    case "green":  return "bg-ima-success";
    case "amber":  return "bg-ima-warning";
    case "red":    return "bg-ima-error";
    default:       return "bg-ima-text-muted";
  }
}

/** Computes full days since joined_at (UTC). Returns 0 on the join day itself. */
export function daysInProgram(joinedAt: string): number {
  const joined = new Date(joinedAt);
  joined.setUTCHours(0, 0, 0, 0);
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24));
}
