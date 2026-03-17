import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { notFound } from "next/navigation";
import { OwnerStudentDetailClient } from "@/components/owner/OwnerStudentDetailClient";

export default async function OwnerStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("owner");
  const { studentId } = await params;
  const { tab } = await searchParams;

  const admin = createAdminClient();

  // Owner sees any student — no coach_id filter
  const { data: student, error: studentError } = await admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id")
    .eq("id", studentId)
    .eq("role", "student")
    .single();

  if (studentError) {
    console.error("[owner student detail] Failed to load student:", studentError);
  }
  if (!student) {
    notFound();
  }

  // Parallel fetch enrichment data
  const [sessionsResult, roadmapResult, reportsResult] = await Promise.all([
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
  ]);

  if (sessionsResult.error) {
    console.error("[owner student detail] Failed to load sessions:", sessionsResult.error);
  }
  if (roadmapResult.error) {
    console.error("[owner student detail] Failed to load roadmap:", roadmapResult.error);
  }
  if (reportsResult.error) {
    console.error("[owner student detail] Failed to load reports:", reportsResult.error);
  }

  const sessions = sessionsResult.data ?? [];
  const roadmap = roadmapResult.data ?? [];
  const reports = reportsResult.data ?? [];

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
    <OwnerStudentDetailClient
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
    />
  );
}
