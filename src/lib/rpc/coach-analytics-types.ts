/**
 * Phase 48: Coach Analytics — pure types + tag helper.
 *
 * Safe to import from client components — no server-only deps. The server-side
 * fetcher + cache wrapper lives in ./coach-analytics.ts and imports the admin
 * client + next/cache.
 *
 * Source of truth is the public.get_coach_analytics RPC envelope (migration
 * 00025). Keep this file in lockstep with that SQL — every key here matches a
 * jsonb_build_object key there.
 */

// ---------------------------------------------------------------------------
// Pagination contract — fixed at 25 rows/page per Phase 44 D-04.
// ---------------------------------------------------------------------------
export const COACH_ANALYTICS_PAGE_SIZE = 25 as const;

// ---------------------------------------------------------------------------
// Sortable columns — string-literal union for type-safe URL params.
// ---------------------------------------------------------------------------
export const COACH_ANALYTICS_SORT_KEYS = [
  "name_asc",
  "name_desc",
  "hours_asc",
  "hours_desc",
  "emails_asc",
  "emails_desc",
  "deals_asc",
  "deals_desc",
  "step_asc",
  "step_desc",
  "lastActive_asc",
  "lastActive_desc",
] as const;

export type CoachAnalyticsSort = (typeof COACH_ANALYTICS_SORT_KEYS)[number];

// ---------------------------------------------------------------------------
// KPI block (5 stats).
// ---------------------------------------------------------------------------
export type CoachTopStudent = {
  student_id: string | null;
  student_name: string | null;
  count: number;
};

export type CoachAnalyticsStats = {
  highest_deals: CoachTopStudent;
  total_revenue: number; // numeric USD; NOT cents
  avg_roadmap_step: number; // server-rounded to 1dp
  avg_email_count: number; // server-rounded to 0dp
  most_emails: CoachTopStudent;
};

// ---------------------------------------------------------------------------
// Leaderboards (3 ranked top-N lists).
// ---------------------------------------------------------------------------
export type CoachLeaderboardHoursRow = {
  rank: number;
  student_id: string;
  student_name: string;
  minutes: number;
};

export type CoachLeaderboardEmailsRow = {
  rank: number;
  student_id: string;
  student_name: string;
  emails: number;
};

export type CoachLeaderboardDealsRow = {
  rank: number;
  student_id: string;
  student_name: string;
  deals: number;
};

export type CoachLeaderboards = {
  hours_week: CoachLeaderboardHoursRow[];
  emails_week: CoachLeaderboardEmailsRow[];
  deals_alltime: CoachLeaderboardDealsRow[];
};

// ---------------------------------------------------------------------------
// 12-week deals trend.
// ---------------------------------------------------------------------------
export type CoachDealsTrendBucket = {
  week_start: string; // YYYY-MM-DD (ISO Monday)
  deals: number;
};

// ---------------------------------------------------------------------------
// Active vs inactive header chip.
// ---------------------------------------------------------------------------
export type CoachActiveInactive = {
  active: number;
  inactive: number;
};

// ---------------------------------------------------------------------------
// Per-student paginated row.
// ---------------------------------------------------------------------------
export type CoachStudentRow = {
  student_id: string;
  name: string;
  hours_this_week_minutes: number;
  emails_this_week: number;
  deals_alltime: number;
  roadmap_step: number;
  last_active_date: string | null; // YYYY-MM-DD or null if never active
  activity_status: "active" | "inactive";
};

// ---------------------------------------------------------------------------
// Pagination envelope.
// ---------------------------------------------------------------------------
export type CoachAnalyticsPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

// ---------------------------------------------------------------------------
// Top-level RPC payload — every key matches the SQL jsonb_build_object.
// ---------------------------------------------------------------------------
export type CoachAnalyticsPayload = {
  stats: CoachAnalyticsStats;
  leaderboards: CoachLeaderboards;
  deals_trend: CoachDealsTrendBucket[]; // always length 12
  active_inactive: CoachActiveInactive;
  students: CoachStudentRow[];
  pagination: CoachAnalyticsPagination;
};

// ---------------------------------------------------------------------------
// Inputs to fetchCoachAnalytics + getCoachAnalyticsCached.
// ---------------------------------------------------------------------------
export type CoachAnalyticsRpcParams = {
  page: number;
  pageSize: number;
  sort: CoachAnalyticsSort;
  search: string;
  windowDays: number;
  today: string; // YYYY-MM-DD (use getTodayUTC())
  leaderboardLimit: number;
};

/**
 * revalidateTag key for the coach's cached analytics batch RPC result.
 *
 * Every mutation on an assigned student's deals / reports / work_sessions
 * MUST call revalidateTag(coachAnalyticsTag(coachId)) — alongside the
 * Phase 47 coachDashboardTag and Phase 46 studentAnalyticsTag.
 */
export function coachAnalyticsTag(coachId: string): string {
  return `coach-analytics:${coachId}`;
}
