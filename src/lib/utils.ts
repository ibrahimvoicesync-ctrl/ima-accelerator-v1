import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns today's date as YYYY-MM-DD in local time */
export function getToday(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns today's date as YYYY-MM-DD in UTC */
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

/** Validates a date string matches YYYY-MM-DD format and is a real date */
export function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date + "T00:00:00Z").getTime());
}

/** Format remaining time for a paused session as "MM:SS" */
export function formatPausedRemaining(
  startedAt: string,
  pausedAt: string,
  sessionMinutes: number
): string {
  const totalMs = sessionMinutes * 60 * 1000;
  const elapsedMs = new Date(pausedAt).getTime() - new Date(startedAt).getTime();
  if (Number.isNaN(elapsedMs)) return "--:--";
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** Format total minutes as hours string: 90 -> "1.5h", 45 -> "0.8h", 0 -> "0h" */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

/** Time-of-day greeting */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}
