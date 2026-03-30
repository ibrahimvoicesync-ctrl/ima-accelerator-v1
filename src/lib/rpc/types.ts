/**
 * Hand-typed RPC response shapes for Phase 20 consolidation functions.
 * These match the JSONB return shapes from 00010_query_consolidation.sql.
 * Replace with generated types when `npx supabase gen types` runs against local instance.
 */

export type OwnerDashboardStats = {
  total_students: number;
  total_coaches: number;
  active_today_count: number;
  reports_today: number;
};

export type SidebarBadgesResult = {
  active_alerts?: number;       // owner only
  unreviewed_reports?: number;  // coach only
};

export type StudentDetailResult = {
  sessions: Array<{
    id: string;
    date: string;
    cycle_number: number;
    status: string;
    duration_minutes: number;
    session_minutes: number;
  }>;
  roadmap: Array<{
    step_number: number;
    status: string;
    completed_at: string | null;
  }>;
  reports: Array<{
    id: string;
    date: string;
    hours_worked: number;
    star_rating: number | null;
    brands_contacted: number;
    influencers_contacted: number;
    calls_joined: number;
    wins: string | null;
    improvements: string | null;
    reviewed_by: string | null;
  }>;
  lifetime_outreach: number;
  today_outreach: number;
  today_minutes_worked: number;
  latest_session_date: string | null;
  latest_report_date: string | null;
  recent_ratings: number[];
  // Owner-only fields (null/missing when p_include_coach_mgmt = false)
  coaches?: Array<{ id: string; name: string }>;
  student_counts?: Record<string, number>;
};
