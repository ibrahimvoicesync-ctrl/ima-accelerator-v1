import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { notFound } from "next/navigation";
import { StudentDetailClient } from "@/components/coach/StudentDetailClient";
import { getTodayUTC } from "@/lib/utils";
import type { StudentDetailResult } from "@/lib/rpc/types";

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole("coach");
  const { studentId } = await params;
  const { tab } = await searchParams;

  const admin = createAdminClient();
  const today = getTodayUTC();

  // Server always renders current month for SSR; client navigates months via /api/calendar
  const monthStr = today.slice(0, 7);
  const firstDay = `${monthStr}-01`;
  const lastDayDate = new Date(firstDay + "T00:00:00Z");
  lastDayDate.setUTCMonth(lastDayDate.getUTCMonth() + 1, 0);
  const lastDay = lastDayDate.toISOString().split("T")[0];

  // Fetch student with defense-in-depth: coach can only see their own students
  const { data: student, error: studentError } = await admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id")
    .eq("id", studentId)
    .eq("coach_id", user.id)
    .single();

  if (studentError) {
    console.error("[student detail] Failed to load student:", studentError);
  }
  if (!student) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: detailData, error: detailError } = await (admin as any).rpc("get_student_detail", {
    p_student_id: student.id,
    p_month_start: firstDay,
    p_month_end: lastDay,
    p_include_coach_mgmt: false,
  });

  if (detailError) {
    console.error("[student detail] RPC failed:", detailError);
  }

  const detail = (detailData as unknown as StudentDetailResult) ?? {
    sessions: [], roadmap: [], reports: [],
    lifetime_outreach: 0, today_outreach: 0, today_minutes_worked: 0,
    latest_session_date: null, latest_report_date: null, recent_ratings: [],
  };

  const calendarSessions = detail.sessions;
  const roadmap = detail.roadmap as Array<{
    step_number: number;
    status: "locked" | "active" | "completed";
    completed_at: string | null;
  }>;
  const calendarReports = detail.reports;

  // Fetch initial comments for CalendarTab
  const calendarReportIds = calendarReports.map((r: { id: string }) => r.id);
  const { data: calendarCommentsData } = calendarReportIds.length > 0
    ? await admin
        .from("report_comments")
        .select("report_id, comment")
        .in("report_id", calendarReportIds)
    : { data: [] };

  const calendarComments: Record<string, { comment: string }> = {};
  for (const c of calendarCommentsData ?? []) {
    calendarComments[c.report_id] = { comment: c.comment };
  }

  // KPI values — already computed by RPC
  const lifetimeOutreach = detail.lifetime_outreach;
  const dailyOutreach = detail.today_outreach;
  const dailyMinutesWorked = detail.today_minutes_worked;

  // Current roadmap step
  const activeStep = roadmap.find((r) => r.status === "active");
  const currentStepNumber = activeStep?.step_number ?? null;

  // At-risk computation using RPC-provided latest dates and recent ratings
  const latestSessionDate = detail.latest_session_date;
  const latestReportDate = detail.latest_report_date;
  const lastActiveDateStr =
    [latestSessionDate, latestReportDate].filter(Boolean).sort().at(-1) ?? null;

  const nowMs = Date.now();
  const reasons: string[] = [];

  if (lastActiveDateStr) {
    const daysInactive = Math.floor(
      (nowMs - new Date(lastActiveDateStr + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysInactive >= COACH_CONFIG.atRiskInactiveDays) {
      reasons.push(`Inactive ${daysInactive}d`);
    }
  }

  const recentRatings = detail.recent_ratings;
  if (recentRatings.length > 0) {
    const avg = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
    if (avg < COACH_CONFIG.atRiskRatingThreshold) {
      reasons.push(`Avg rating ${avg.toFixed(1)}`);
    }
  }

  const isAtRisk = reasons.length > 0;

  // 100h milestone check — total completed session minutes
  const { data: milestoneData } = await admin
    .from("work_sessions")
    .select("session_minutes")
    .eq("student_id", student.id)
    .eq("status", "completed");

  // Fetch student deals for DealsTab
  const { data: dealsData, error: dealsError } = await admin
    .from("deals")
    .select("id, student_id, deal_number, revenue, profit, created_at, updated_at")
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  if (dealsError) {
    console.error("[student detail] Failed to load deals:", dealsError);
  }

  const deals = dealsData ?? [];

  const totalMinutes = (milestoneData ?? []).reduce(
    (sum, r) => sum + (r.session_minutes ?? 0),
    0
  );
  const endOfTodayMs = new Date(today + "T23:59:59Z").getTime();
  const daysSinceJoin = Math.floor(
    (endOfTodayMs - new Date(student.joined_at).getTime()) / 86400000
  );
  const hasMilestone =
    totalMinutes >= COACH_CONFIG.milestoneMinutesThreshold &&
    daysSinceJoin <= COACH_CONFIG.milestoneDaysWindow;

  return (
    <StudentDetailClient
      student={{
        name: student.name,
        email: student.email,
        joined_at: student.joined_at,
        status: student.status,
      }}
      isAtRisk={isAtRisk}
      atRiskReasons={reasons}
      calendarSessions={calendarSessions}
      calendarReports={calendarReports}
      calendarComments={calendarComments}
      currentMonth={monthStr}
      roadmap={roadmap}
      initialTab={typeof tab === "string" ? tab : undefined}
      studentId={student.id}
      kpiData={{
        lifetimeOutreach,
        dailyOutreach,
        dailyMinutesWorked,
        joinedAt: student.joined_at,
        currentStepNumber,
      }}
      milestone={hasMilestone ? { totalHours: Math.floor(totalMinutes / 60), days: daysSinceJoin } : null}
      deals={deals}
    />
  );
}
