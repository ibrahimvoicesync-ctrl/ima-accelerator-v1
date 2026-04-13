/**
 * Phase 46: Student Analytics — pure types + constants.
 *
 * This module is safe to import from client components. It contains NO
 * server-only dependencies (no admin client, no server-only marker).
 * The server-side fetcher lives in ./student-analytics.ts.
 */

export const STUDENT_ANALYTICS_PAGE_SIZE = 25;

export type StudentAnalyticsRange = "7d" | "30d" | "90d" | "all";

export const STUDENT_ANALYTICS_RANGES: readonly StudentAnalyticsRange[] = [
  "7d",
  "30d",
  "90d",
  "all",
] as const;

export type StudentAnalyticsTotals = {
  total_hours: number;
  total_emails: number;
  total_influencers: number;
  total_deals: number;
  total_revenue: number;
  total_profit: number;
};

export type OutreachBucket = {
  week_start: string; // YYYY-MM-DD
  brands: number;
  influencers: number;
};

export type HoursBucket = {
  bucket: string; // YYYY-MM-DD (ISO date or ISO week-start)
  hours: number;
};

export type LoggerRole = "student" | "student_diy" | "coach" | "owner" | null;

export type DealRow = {
  id: string;
  deal_number: number;
  revenue: number;
  profit: number;
  margin: number;
  created_at: string;
  logged_by: string;
  logger_role: LoggerRole;
  is_self: boolean;
};

export type DealSummary = {
  count: number;
  revenue: number;
  profit: number;
};

export type RoadmapProgressRow = {
  step_number: number;
  status: "locked" | "active" | "completed";
  completed_at: string | null;
};

export type StudentAnalyticsPayload = {
  totals: StudentAnalyticsTotals;
  streak: number;
  outreach_trend: OutreachBucket[];
  hours_trend: HoursBucket[];
  deals: DealRow[];
  deal_summary: DealSummary;
  roadmap_progress: RoadmapProgressRow[];
  range: StudentAnalyticsRange;
  page: number;
  page_size: number;
  total_deal_count: number;
};

/**
 * Returns the revalidateTag key for a given student's cached analytics.
 * Every mutation that touches the student's deals / reports / work_sessions /
 * roadmap_progress MUST call revalidateTag(studentAnalyticsTag(studentId)).
 *
 * Pure string helper — safe to import from any runtime (client, server, edge).
 */
export function studentAnalyticsTag(studentId: string): string {
  return `student-analytics:${studentId}`;
}
