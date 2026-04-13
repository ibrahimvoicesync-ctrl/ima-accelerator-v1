/**
 * Phase 47: Coach Dashboard — pure types + tag helper.
 *
 * Safe to import from client components — no server-only deps. The server-side
 * fetcher lives in ./coach-dashboard.ts and imports the admin client.
 */

export type CoachDashboardStats = {
  deals_closed: number;
  revenue: number; // numeric USD; NOT cents
  avg_roadmap_step: number; // server-rounded to 1 decimal place
  emails_sent: number;
};

export type CoachRecentReport = {
  id: string;
  student_id: string;
  student_name: string;
  date: string; // YYYY-MM-DD
  star_rating: number | null;
  submitted_at: string; // ISO timestamp (UTC)
};

export type CoachTopHoursRow = {
  student_id: string;
  student_name: string;
  minutes: number;
};

export type CoachDashboardPayload = {
  stats: CoachDashboardStats;
  recent_reports: CoachRecentReport[];
  top_hours_week: CoachTopHoursRow[];
};

/**
 * revalidateTag key for the coach's cached dashboard batch RPC result.
 * Every mutation on an assigned student's deals / reports / work_sessions
 * MUST call revalidateTag(coachDashboardTag(coachId)) — see API route handlers.
 */
export function coachDashboardTag(coachId: string): string {
  return `coach-dashboard:${coachId}`;
}
