import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OWNER_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { OwnerAlertsClient, type AlertItem } from "@/components/owner/OwnerAlertsClient";
import { Bell } from "lucide-react";

export default async function OwnerAlertsPage() {
  const user = await requireRole("owner");
  const admin = createAdminClient();
  const today = getToday();
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const thresholds = OWNER_CONFIG.alertThresholds;

  // Compute cutoff dates
  const inactiveCutoff = new Date(nowMs - thresholds.studentInactiveDays * 86400000)
    .toISOString().split("T")[0];
  const dropoffCutoff = new Date(nowMs - thresholds.studentDropoffDays * 86400000)
    .toISOString().split("T")[0];
  const coachWindowCutoff = new Date(nowMs - thresholds.coachUnderperformingWindowDays * 86400000)
    .toISOString().split("T")[0];

  // ISO week number for alert key (student_dropoff keyed weekly)
  function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  const isoMonth = today.slice(0, 7); // "YYYY-MM" for coach_underperform key
  const isoWeek = getISOWeek(today);

  // --- Parallel data fetches ---
  const [studentsResult, coachesResult, dismissalsResult] = await Promise.all([
    admin.from("users").select("id, name, coach_id, joined_at").eq("role", "student").eq("status", "active"),
    admin.from("users").select("id, name").eq("role", "coach").eq("status", "active"),
    admin.from("alert_dismissals").select("alert_key").eq("owner_id", user.id),
  ]);

  const students = studentsResult.data ?? [];
  const coaches = coachesResult.data ?? [];
  const dismissedKeys = new Set((dismissalsResult.data ?? []).map((d) => d.alert_key));

  if (studentsResult.error) console.error("[owner alerts] students fetch error:", studentsResult.error);
  if (coachesResult.error) console.error("[owner alerts] coaches fetch error:", coachesResult.error);
  if (dismissalsResult.error) console.error("[owner alerts] dismissals fetch error:", dismissalsResult.error);

  const studentIds = students.map((s) => s.id);
  const alerts: AlertItem[] = [];

  // --- Student activity alerts ---
  if (studentIds.length > 0) {
    const [sessionsResult, reportsResult] = await Promise.all([
      admin.from("work_sessions").select("student_id, date")
        .in("student_id", studentIds).gte("date", dropoffCutoff),
      admin.from("daily_reports").select("student_id, date")
        .in("student_id", studentIds).gte("date", dropoffCutoff)
        .not("submitted_at", "is", null),
    ]);

    if (sessionsResult.error) console.error("[owner alerts] sessions fetch error:", sessionsResult.error);
    if (reportsResult.error) console.error("[owner alerts] reports fetch error:", reportsResult.error);

    // Build per-student last-active date
    const lastActive: Record<string, string> = {};
    for (const s of sessionsResult.data ?? []) {
      if (!lastActive[s.student_id] || s.date > lastActive[s.student_id]) {
        lastActive[s.student_id] = s.date;
      }
    }
    for (const r of reportsResult.data ?? []) {
      if (!lastActive[r.student_id] || r.date > lastActive[r.student_id]) {
        lastActive[r.student_id] = r.date;
      }
    }

    // Classify students — EXCLUSIVE: dropoff (7+) OR inactive (3-6), never both
    for (const student of students) {
      const last = lastActive[student.id];

      // Grace period: skip alerts for students whose account is younger than the threshold
      const accountAgeMs = nowMs - new Date(student.joined_at).getTime();
      const accountAgeDays = accountAgeMs / 86400000;

      if (!last || last < dropoffCutoff) {
        // Dropoff: 7+ days or never active — BUT skip if account < 7 days old
        if (accountAgeDays < thresholds.studentDropoffDays) continue;
        const key = `student_dropoff:${student.id}:${isoWeek}`;
        const daysInactive = last
          ? Math.floor((nowMs - new Date(last + "T00:00:00Z").getTime()) / 86400000)
          : 999;
        alerts.push({
          key,
          type: "student_dropoff",
          severity: "critical",
          title: student.name,
          message: last
            ? `No activity for ${daysInactive} days. Last active: ${last}.`
            : "Has never logged any activity.",
          subjectId: student.id,
          subjectName: student.name,
          triggeredAt: new Date(nowMs).toISOString(),
          dismissed: dismissedKeys.has(key),
        });
      } else if (last < inactiveCutoff) {
        // Inactive: 3-6 days — BUT skip if account < 3 days old
        if (accountAgeDays < thresholds.studentInactiveDays) continue;
        const key = `student_inactive:${student.id}:${today}`;
        const daysInactive = Math.floor((nowMs - new Date(last + "T00:00:00Z").getTime()) / 86400000);
        alerts.push({
          key,
          type: "student_inactive",
          severity: "warning",
          title: student.name,
          message: `No activity for ${daysInactive} days. Last active: ${last}.`,
          subjectId: student.id,
          subjectName: student.name,
          triggeredAt: new Date(nowMs).toISOString(),
          dismissed: dismissedKeys.has(key),
        });
      }
    }

    // --- Unreviewed reports (summary alert — one alert, not per-report) ---
    const { count: unreviewedCount } = await admin
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .in("student_id", studentIds)
      .is("reviewed_by", null)
      .not("submitted_at", "is", null);

    if ((unreviewedCount ?? 0) > 0) {
      const key = `unreviewed_reports:${today}`;
      alerts.push({
        key,
        type: "unreviewed_reports",
        severity: "warning",
        title: "Unreviewed Reports",
        message: `${unreviewedCount} report${unreviewedCount !== 1 ? "s" : ""} pending coach review.`,
        subjectId: null,
        subjectName: "Platform",
        triggeredAt: new Date(nowMs).toISOString(),
        dismissed: dismissedKeys.has(key),
      });
    }
  }

  // --- Coach underperformance alerts ---
  if (coaches.length > 0) {
    const coachIds = coaches.map((c) => c.id);
    const { data: coachStudents } = await admin
      .from("users").select("id, coach_id").eq("role", "student").in("coach_id", coachIds);

    const coachStudentIds = (coachStudents ?? []).map((s) => s.id);

    if (coachStudentIds.length > 0) {
      const { data: windowReports } = await admin
        .from("daily_reports").select("student_id, star_rating")
        .in("student_id", coachStudentIds).gte("date", coachWindowCutoff)
        .not("submitted_at", "is", null).not("star_rating", "is", null);

      // Map student to coach
      const studentToCoach: Record<string, string> = {};
      for (const s of coachStudents ?? []) {
        if (s.coach_id) studentToCoach[s.id] = s.coach_id;
      }

      // Aggregate ratings per coach
      const coachRatings: Record<string, number[]> = {};
      for (const r of windowReports ?? []) {
        const cId = studentToCoach[r.student_id];
        if (cId && r.star_rating !== null) {
          if (!coachRatings[cId]) coachRatings[cId] = [];
          coachRatings[cId].push(r.star_rating);
        }
      }

      // Generate alerts for underperforming coaches
      const coachNameMap: Record<string, string> = {};
      for (const c of coaches) coachNameMap[c.id] = c.name;

      for (const cId of coachIds) {
        const ratings = coachRatings[cId];
        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          if (avg < thresholds.coachUnderperformingRating) {
            const key = `coach_underperform:${cId}:${isoMonth}`;
            alerts.push({
              key,
              type: "coach_underperforming",
              severity: "warning",
              title: coachNameMap[cId] ?? "Unknown Coach",
              message: `Average student rating ${avg.toFixed(1)}/5 over the last ${thresholds.coachUnderperformingWindowDays} days (threshold: ${thresholds.coachUnderperformingRating}).`,
              subjectId: cId,
              subjectName: coachNameMap[cId] ?? "Unknown Coach",
              triggeredAt: new Date(nowMs).toISOString(),
              dismissed: dismissedKeys.has(key),
            });
          }
        }
      }
    }
  }

  // Sort: active first, then by severity (critical > warning)
  const severityOrder: Record<string, number> = { critical: 0, warning: 1 };
  alerts.sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    const sA = severityOrder[a.severity] ?? 1;
    const sB = severityOrder[b.severity] ?? 1;
    return sA - sB;
  });

  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;

  return (
    <div className="space-y-6 px-4">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Bell className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Alerts</h1>
          {activeAlertCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ima-error/10 text-ima-error">
              {activeAlertCount} active
            </span>
          )}
        </div>
        <p className="text-sm text-ima-text-secondary">
          Monitor at-risk students, unreviewed reports, and coach performance.
        </p>
      </div>

      <OwnerAlertsClient initialAlerts={alerts} />
    </div>
  );
}
