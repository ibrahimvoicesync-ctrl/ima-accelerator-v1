import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { ROLES, COACH_CONFIG, OWNER_CONFIG, type Role } from "@/lib/config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Admin client bypasses RLS — needed because RLS policies use
  // get_user_role() which can fail during profile resolution
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, role, name")
    .eq("auth_id", user.id)
    .single();

  if (error || !profile) {
    if (error) console.error("[dashboard layout] Failed to load profile:", error);
    redirect("/no-access");
  }

  const validRoles = Object.values(ROLES) as string[];
  if (!validRoles.includes(profile.role)) {
    redirect("/no-access");
  }

  // Compute sidebar badge counts for coach role
  let badgeCounts: Record<string, number> = {};
  if (profile.role === "coach") {
    const studentsResult = await admin
      .from("users")
      .select("id")
      .eq("role", "student")
      .eq("coach_id", profile.id)
      .eq("status", "active");

    const studentIds = (studentsResult.data ?? []).map((s) => s.id);

    if (studentIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const nowMs = new Date(today + "T23:59:59Z").getTime();
      const sevenDaysAgo = new Date(
        nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      const { count } = await admin
        .from("daily_reports")
        .select("*", { count: "exact", head: true })
        .in("student_id", studentIds)
        .gte("date", sevenDaysAgo)
        .is("reviewed_by", null)
        .not("submitted_at", "is", null);

      badgeCounts = { unreviewed_reports: count ?? 0 };
    }
  } else if (profile.role === "owner") {
    const thresholds = OWNER_CONFIG.alertThresholds;
    const todayStr = new Date().toISOString().split("T")[0];
    const nowMs = new Date(todayStr + "T23:59:59Z").getTime();
    const inactiveCutoff = new Date(nowMs - thresholds.studentInactiveDays * 86400000)
      .toISOString().split("T")[0];
    const dropoffCutoff = new Date(nowMs - thresholds.studentDropoffDays * 86400000)
      .toISOString().split("T")[0];
    const coachWindowCutoff = new Date(nowMs - thresholds.coachUnderperformingWindowDays * 86400000)
      .toISOString().split("T")[0];

    // Get all active students
    const { data: allStudents } = await admin
      .from("users").select("id").eq("role", "student").eq("status", "active");
    const studentIds = (allStudents ?? []).map((s) => s.id);

    let alertCount = 0;

    if (studentIds.length > 0) {
      // Recent sessions and reports (within dropoff window — covers both inactive and dropoff)
      const [recentSessionsRes, recentReportsRes] = await Promise.all([
        admin.from("work_sessions").select("student_id, date")
          .in("student_id", studentIds).gte("date", dropoffCutoff),
        admin.from("daily_reports").select("student_id, date")
          .in("student_id", studentIds).gte("date", dropoffCutoff)
          .not("submitted_at", "is", null),
      ]);

      // Build per-student last-active date
      const lastActive: Record<string, string> = {};
      for (const s of recentSessionsRes.data ?? []) {
        if (!lastActive[s.student_id] || s.date > lastActive[s.student_id]) {
          lastActive[s.student_id] = s.date;
        }
      }
      for (const r of recentReportsRes.data ?? []) {
        if (!lastActive[r.student_id] || r.date > lastActive[r.student_id]) {
          lastActive[r.student_id] = r.date;
        }
      }

      // Count inactive (3-6 days) and dropoff (7+ days) — exclusive ranges
      for (const sid of studentIds) {
        const last = lastActive[sid];
        if (!last || last < dropoffCutoff) {
          alertCount++; // dropoff
        } else if (last < inactiveCutoff) {
          alertCount++; // inactive
        }
      }

      // Unreviewed reports — count as 1 summary alert if any exist
      const { count: unreviewedCount } = await admin
        .from("daily_reports")
        .select("*", { count: "exact", head: true })
        .in("student_id", studentIds)
        .is("reviewed_by", null)
        .not("submitted_at", "is", null);
      if ((unreviewedCount ?? 0) > 0) alertCount++;
    }

    // Coach underperformance
    const { data: coaches } = await admin
      .from("users").select("id").eq("role", "coach").eq("status", "active");
    if ((coaches ?? []).length > 0) {
      const coachIds = (coaches ?? []).map((c) => c.id);
      const { data: coachStudents } = await admin
        .from("users").select("id, coach_id").eq("role", "student").in("coach_id", coachIds);
      const coachStudentIds = (coachStudents ?? []).map((s) => s.id);
      if (coachStudentIds.length > 0) {
        const { data: windowReports } = await admin
          .from("daily_reports").select("student_id, star_rating")
          .in("student_id", coachStudentIds).gte("date", coachWindowCutoff)
          .not("submitted_at", "is", null).not("star_rating", "is", null);

        const studentToCoach: Record<string, string> = {};
        for (const s of coachStudents ?? []) {
          if (s.coach_id) studentToCoach[s.id] = s.coach_id;
        }
        const coachRatings: Record<string, number[]> = {};
        for (const r of windowReports ?? []) {
          const cId = studentToCoach[r.student_id];
          if (cId && r.star_rating !== null) {
            if (!coachRatings[cId]) coachRatings[cId] = [];
            coachRatings[cId].push(r.star_rating);
          }
        }
        for (const cId of coachIds) {
          const ratings = coachRatings[cId];
          if (ratings && ratings.length > 0) {
            const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
            if (avg < thresholds.coachUnderperformingRating) alertCount++;
          }
        }
      }
    }

    // Subtract dismissed alerts (approximation — acceptable for badge)
    const { count: dismissedCount } = await admin
      .from("alert_dismissals")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", profile.id);

    const activeAlertCount = Math.max(0, alertCount - (dismissedCount ?? 0));
    badgeCounts = { active_alerts: activeAlertCount };
  }

  return (
    <div className="min-h-screen bg-ima-bg">
      <Sidebar role={profile.role as Role} userName={profile.name} badgeCounts={badgeCounts} />
      <main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
        <ToastProvider>
          <div className="p-4 md:p-8">{children}</div>
        </ToastProvider>
      </main>
    </div>
  );
}
