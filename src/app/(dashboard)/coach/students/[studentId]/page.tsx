import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { notFound } from "next/navigation";
import { StudentDetailClient } from "@/components/coach/StudentDetailClient";
import { getTodayUTC } from "@/lib/utils";

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const user = await requireRole("coach");
  const { studentId } = await params;
  const { tab, month } = await searchParams;

  const admin = createAdminClient();
  const today = getTodayUTC();

  // Month-scoped calendar data: validate ?month=YYYY-MM or default to current month
  const monthStr = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const firstDay = `${monthStr}-01`;
  const lastDayDate = new Date(firstDay + "T00:00:00Z");
  lastDayDate.setUTCMonth(lastDayDate.getUTCMonth() + 1, 0);
  const lastDay = lastDayDate.toISOString().split("T")[0];

  // sevenDaysAgo needed for at-risk recent ratings query (must be before Promise.all)
  // eslint-disable-next-line react-hooks/purity -- async server component, not a hook
  const nowMs = Date.now();
  const sevenDaysAgo = new Date(nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

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

  // Parallel fetch enrichment data
  const [
    sessionsResult,
    roadmapResult,
    reportsResult,
    lifetimeReportsResult,
    todayReportResult,
    todaySessionsResult,
    latestSessionResult,
    latestReportResult,
    recentRatingsResult,
  ] = await Promise.all([
    // Month-scoped calendar sessions
    admin
      .from("work_sessions")
      .select("id, date, cycle_number, status, duration_minutes, session_minutes")
      .eq("student_id", student.id)
      .gte("date", firstDay)
      .lte("date", lastDay)
      .order("date")
      .order("cycle_number"),
    admin
      .from("roadmap_progress")
      .select("step_number, status")
      .eq("student_id", student.id)
      .order("step_number"),
    // Month-scoped calendar reports with granular KPI fields
    admin
      .from("daily_reports")
      .select("id, date, hours_worked, star_rating, brands_contacted, influencers_contacted, calls_joined, wins, improvements, reviewed_by")
      .eq("student_id", student.id)
      .gte("date", firstDay)
      .lte("date", lastDay)
      .order("date"),
    // KPI: Lifetime outreach — all reports
    admin
      .from("daily_reports")
      .select("brands_contacted, influencers_contacted")
      .eq("student_id", student.id),
    // KPI: Today's report — daily outreach
    admin
      .from("daily_reports")
      .select("brands_contacted, influencers_contacted")
      .eq("student_id", student.id)
      .eq("date", today)
      .maybeSingle(),
    // KPI: Today's sessions — hours worked
    admin
      .from("work_sessions")
      .select("duration_minutes, status")
      .eq("student_id", student.id)
      .eq("date", today),
    // At-risk: latest session date
    admin
      .from("work_sessions")
      .select("date")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(1),
    // At-risk: latest report date
    admin
      .from("daily_reports")
      .select("date")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(1),
    // At-risk: recent reports for star rating computation (last 7 days)
    admin
      .from("daily_reports")
      .select("date, star_rating")
      .eq("student_id", student.id)
      .gte("date", sevenDaysAgo)
      .not("star_rating", "is", null),
  ]);

  if (sessionsResult.error) {
    console.error("[student detail] Failed to load sessions:", sessionsResult.error);
  }
  if (roadmapResult.error) {
    console.error("[student detail] Failed to load roadmap:", roadmapResult.error);
  }
  if (reportsResult.error) {
    console.error("[student detail] Failed to load reports:", reportsResult.error);
  }
  if (lifetimeReportsResult.error) {
    console.error("[student detail] Failed to load lifetime reports:", lifetimeReportsResult.error);
  }
  if (todayReportResult.error) {
    console.error("[student detail] Failed to load today's report:", todayReportResult.error);
  }
  if (todaySessionsResult.error) {
    console.error("[student detail] Failed to load today's sessions:", todaySessionsResult.error);
  }
  if (latestSessionResult.error) {
    console.error("[student detail] Failed to load latest session:", latestSessionResult.error);
  }
  if (latestReportResult.error) {
    console.error("[student detail] Failed to load latest report:", latestReportResult.error);
  }

  const calendarSessions = sessionsResult.data ?? [];
  const roadmap = roadmapResult.data ?? [];
  const calendarReports = reportsResult.data ?? [];

  // Compute KPI values for StudentKpiSummary
  const allLifetimeReports = lifetimeReportsResult.data ?? [];
  const lifetimeOutreach = allLifetimeReports.reduce(
    (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
    0,
  );
  const todayReport = todayReportResult.data;
  const dailyOutreach = (todayReport?.brands_contacted ?? 0) + (todayReport?.influencers_contacted ?? 0);
  const dailyMinutesWorked = (todaySessionsResult.data ?? [])
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  // Current roadmap step — derived from already-fetched roadmap data
  const activeStep = roadmap.find((r) => r.status === "active");
  const currentStepNumber = activeStep?.step_number ?? null;

  // Compute at-risk status using dedicated latest-date queries
  const latestSessionDate = latestSessionResult.data?.[0]?.date ?? null;
  const latestReportDate = latestReportResult.data?.[0]?.date ?? null;
  const lastActiveDateStr =
    [latestSessionDate, latestReportDate].filter(Boolean).sort().at(-1) ?? null;

  const reasons: string[] = [];

  if (lastActiveDateStr) {
    const daysInactive = Math.floor(
      (nowMs - new Date(lastActiveDateStr + "T00:00:00Z").getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysInactive >= COACH_CONFIG.atRiskInactiveDays) {
      reasons.push(`Inactive ${daysInactive}d`);
    }
  }

  const recentRatings = (recentRatingsResult.data ?? [])
    .map((r) => r.star_rating!);
  if (recentRatings.length > 0) {
    const avg = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
    if (avg < COACH_CONFIG.atRiskRatingThreshold) {
      reasons.push(`Avg rating ${avg.toFixed(1)}`);
    }
  }

  const isAtRisk = reasons.length > 0;

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
    />
  );
}
