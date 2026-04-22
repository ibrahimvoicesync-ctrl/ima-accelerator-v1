import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressBanner } from "@/components/student/ProgressBanner";
import { getTodayUTC } from "@/lib/utils";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getTodayUTC();

  // Four parallel queries for banner data
  const [lifetimeResult, todayReportResult, userResult, step7Result] = await Promise.all([
    // Lifetime outreach — fetch all report totals and sum in JS
    admin
      .from("daily_reports")
      .select("brands_contacted, influencers_contacted")
      .eq("student_id", user.id),

    // Today's report — for daily KPIs
    admin
      .from("daily_reports")
      .select("brands_contacted, influencers_contacted, calls_joined")
      .eq("student_id", user.id)
      .eq("date", today)
      .maybeSingle(),

    // User joined_at — for pace-based RAG calculation
    admin
      .from("users")
      .select("joined_at")
      .eq("id", user.id)
      .single(),

    // Step 7 completion — RAG colors activate only after outreach prep is done
    admin
      .from("roadmap_progress")
      .select("status")
      .eq("student_id", user.id)
      .eq("step_number", 7)
      .maybeSingle(),
  ]);

  if (lifetimeResult.error) {
    console.error("[student layout] Failed to load lifetime KPIs:", lifetimeResult.error);
  }
  if (todayReportResult.error) {
    console.error("[student layout] Failed to load today's report:", todayReportResult.error);
  }
  if (userResult.error) {
    console.error("[student layout] Failed to load user:", userResult.error);
  }

  const allReports = lifetimeResult.data ?? [];
  const lifetimeOutreach = allReports.reduce(
    (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
    0,
  );
  const todayReport = todayReportResult.data;
  const userRow = userResult.data;

  // Lifetime + today's minutes — single query (status='completed' filtered server-side)
  const { data: allSessions, error: sessionsError } = await admin
    .from("work_sessions")
    .select("duration_minutes, date")
    .eq("student_id", user.id)
    .eq("status", "completed");

  if (sessionsError) {
    console.error("[student layout] Failed to load sessions:", sessionsError);
  }

  const sessions = allSessions ?? [];
  const dailyMinutesWorked = sessions
    .filter((s) => s.date === today)
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const lifetimeMinutesWorked = sessions.reduce(
    (sum, s) => sum + s.duration_minutes,
    0,
  );

  return (
    <>
      <ProgressBanner
        lifetimeOutreach={lifetimeOutreach}
        lifetimeMinutesWorked={lifetimeMinutesWorked}
        dailyOutreach={(todayReport?.brands_contacted ?? 0) + (todayReport?.influencers_contacted ?? 0)}
        dailyMinutesWorked={dailyMinutesWorked}
        callsJoined={todayReport?.calls_joined ?? 0}
        brandsContacted={todayReport?.brands_contacted ?? 0}
        influencersContacted={todayReport?.influencers_contacted ?? 0}
        joinedAt={userRow?.joined_at ?? new Date().toISOString()}
        outreachStarted={step7Result.data?.status === "completed"}
      />
      {children}
    </>
  );
}
