import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { CoachAlertsClient, type CoachAlertItem } from "@/components/coach/CoachAlertsClient";
import { Trophy } from "lucide-react";

export default async function CoachAlertsPage() {
  const user = await requireRole("coach");
  const admin = createAdminClient();
  const today = getToday();
  const nowMs = new Date(today + "T23:59:59Z").getTime();

  // Parallel fetch: coach's active students + coach's dismissed keys
  const [studentsResult, dismissalsResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, joined_at")
      .eq("role", "student")
      .eq("coach_id", user.id)
      .eq("status", "active"),
    admin
      .from("alert_dismissals")
      .select("alert_key")
      .eq("owner_id", user.id), // uses owner_id column with coach's ID
  ]);

  if (studentsResult.error) {
    console.error("[coach alerts] students fetch error:", studentsResult.error);
  }
  if (dismissalsResult.error) {
    console.error("[coach alerts] dismissals fetch error:", dismissalsResult.error);
  }

  const students = studentsResult.data ?? [];
  const dismissedKeys = new Set(
    (dismissalsResult.data ?? []).map((d) => d.alert_key)
  );

  // Compute 45-day cutoff: students who joined within the window
  const milestoneCutoff = new Date(
    nowMs - COACH_CONFIG.milestoneDaysWindow * 86400000
  )
    .toISOString()
    .split("T")[0];

  const qualifyingStudents = students.filter(
    (s) => s.joined_at >= milestoneCutoff
  );

  const alerts: CoachAlertItem[] = [];

  if (qualifyingStudents.length > 0) {
    const qualifyingIds = qualifyingStudents.map((s) => s.id);

    // Fetch completed session minutes for qualifying students
    const { data: sessionData, error: sessionError } = await admin
      .from("work_sessions")
      .select("student_id, session_minutes")
      .in("student_id", qualifyingIds)
      .eq("status", "completed");

    if (sessionError) {
      console.error("[coach alerts] sessions fetch error:", sessionError);
    }

    // Sum session_minutes per student
    const minutesByStudent = new Map<string, number>();
    for (const row of sessionData ?? []) {
      const prev = minutesByStudent.get(row.student_id) ?? 0;
      minutesByStudent.set(row.student_id, prev + (row.session_minutes ?? 0));
    }

    // Build alerts for students who hit the 100h threshold
    for (const student of qualifyingStudents) {
      const totalMinutes = minutesByStudent.get(student.id) ?? 0;
      if (totalMinutes >= COACH_CONFIG.milestoneMinutesThreshold) {
        const key = `100h_milestone:${student.id}`;
        const daysSinceJoin = Math.floor(
          (nowMs - new Date(student.joined_at).getTime()) / 86400000
        );
        alerts.push({
          key,
          type: "100h_milestone",
          severity: "success",
          title: student.name,
          message: `${student.name} has reached 100+ hours in ${daysSinceJoin} days! Check them out and ask for a testimonial.`,
          link: `/coach/students/${student.id}`,
          dismissed: dismissedKeys.has(key),
        });
      }
    }
  }

  // Sort: undismissed first, then by student name
  alerts.sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;

  return (
    <div className="space-y-6 px-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="h-6 w-6 text-ima-success" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Milestone Alerts</h1>
          {activeAlertCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ima-success/10 text-ima-success">
              {activeAlertCount} active
            </span>
          )}
        </div>
        <p className="text-sm text-ima-text-secondary">
          Students who&apos;ve reached 100+ hours within{" "}
          {COACH_CONFIG.milestoneDaysWindow} days of joining.
        </p>
      </div>

      <CoachAlertsClient initialAlerts={alerts} />
    </div>
  );
}
