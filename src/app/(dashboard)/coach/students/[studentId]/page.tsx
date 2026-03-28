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
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireRole("coach");
  const { studentId } = await params;
  const { tab } = await searchParams;

  const admin = createAdminClient();
  const today = getTodayUTC();

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
  const [sessionsResult, roadmapResult, reportsResult, lifetimeReportsResult, todayReportResult, todaySessionsResult] = await Promise.all([
    admin
      .from("work_sessions")
      .select("id, date, cycle_number, status, duration_minutes")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(120),
    admin
      .from("roadmap_progress")
      .select("step_number, status")
      .eq("student_id", student.id)
      .order("step_number"),
    admin
      .from("daily_reports")
      .select("id, date, hours_worked, star_rating, outreach_count, wins, improvements, reviewed_by")
      .eq("student_id", student.id)
      .order("date", { ascending: false })
      .limit(20),
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

  const sessions = sessionsResult.data ?? [];
  const roadmap = roadmapResult.data ?? [];
  const reports = reportsResult.data ?? [];

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

  // Compute at-risk status
  const latestSessionDate = sessions.length > 0 ? sessions[0].date : null;
  const latestReportDate = reports.length > 0 ? reports[0].date : null;
  const lastActiveDateStr =
    [latestSessionDate, latestReportDate].filter(Boolean).sort().at(-1) ?? null;

  // eslint-disable-next-line react-hooks/purity -- async server component, not a hook
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

  const sevenDaysAgo = new Date(nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const recentRatings = reports
    .filter((r) => r.date >= sevenDaysAgo && r.star_rating !== null)
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
      sessions={sessions}
      roadmap={roadmap}
      reports={reports}
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
