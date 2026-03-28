import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProgressBanner } from "@/components/student/ProgressBanner";
import { getTodayUTC } from "@/lib/utils";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getTodayUTC();

  // Three parallel queries for banner data
  const [lifetimeResult, todayReportResult, userResult] = await Promise.all([
    // Lifetime totals — PostgREST aggregate (never JS reduce per STATE.md)
    admin
      .from("daily_reports")
      .select("outreach_brands.sum(), outreach_influencers.sum()")
      .eq("student_id", user.id)
      .single(),

    // Today's report — for daily KPIs
    admin
      .from("daily_reports")
      .select("outreach_brands, outreach_influencers, brands_contacted, influencers_contacted, calls_joined")
      .eq("student_id", user.id)
      .eq("date", today)
      .maybeSingle(),

    // User joined_at — for pace-based RAG calculation
    admin
      .from("users")
      .select("joined_at")
      .eq("id", user.id)
      .single(),
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

  // Type assertion for aggregate result (PostgREST returns column names for aggregates)
  const lifetime = lifetimeResult.data as { outreach_brands: number | null; outreach_influencers: number | null } | null;
  const todayReport = todayReportResult.data;
  const userRow = userResult.data;

  // Compute today's total minutes from work_sessions for hours KPI
  const { data: todaySessions, error: sessionsError } = await admin
    .from("work_sessions")
    .select("duration_minutes, status")
    .eq("student_id", user.id)
    .eq("date", today);

  if (sessionsError) {
    console.error("[student layout] Failed to load sessions:", sessionsError);
  }

  const dailyMinutesWorked = (todaySessions ?? [])
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <>
      <ProgressBanner
        lifetimeOutreach={(lifetime?.outreach_brands ?? 0) + (lifetime?.outreach_influencers ?? 0)}
        dailyOutreach={(todayReport?.outreach_brands ?? 0) + (todayReport?.outreach_influencers ?? 0)}
        dailyMinutesWorked={dailyMinutesWorked}
        callsJoined={todayReport?.calls_joined ?? 0}
        brandsContacted={todayReport?.brands_contacted ?? 0}
        influencersContacted={todayReport?.influencers_contacted ?? 0}
        joinedAt={userRow?.joined_at ?? new Date().toISOString()}
      />
      {children}
    </>
  );
}
