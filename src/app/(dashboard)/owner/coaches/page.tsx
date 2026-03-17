import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Shield } from "lucide-react";
import { CoachCard } from "@/components/owner/CoachCard";

export default async function OwnerCoachesPage() {
  await requireRole("owner");
  const admin = createAdminClient();

  const today = getToday();
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const [coachesResult, studentsResult, reportsResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, status, joined_at")
      .eq("role", "coach")
      .order("name"),
    admin
      .from("users")
      .select("id, name, coach_id, status")
      .eq("role", "student")
      .eq("status", "active"),
    admin
      .from("daily_reports")
      .select("student_id, star_rating, date")
      .gte("date", sevenDaysAgo)
      .not("star_rating", "is", null),
  ]);

  if (coachesResult.error) {
    console.error("[owner coaches] Failed to load coaches:", coachesResult.error);
  }
  if (studentsResult.error) {
    console.error("[owner coaches] Failed to load students:", studentsResult.error);
  }
  if (reportsResult.error) {
    console.error("[owner coaches] Failed to load reports:", reportsResult.error);
  }

  // Build lookup maps
  const studentsByCoach = new Map<string, number>();
  const studentCoachMap = new Map<string, string>();

  for (const student of studentsResult.data ?? []) {
    if (student.coach_id) {
      studentsByCoach.set(
        student.coach_id,
        (studentsByCoach.get(student.coach_id) ?? 0) + 1
      );
      studentCoachMap.set(student.id, student.coach_id);
    }
  }

  const coachRatings = new Map<string, number[]>();
  for (const report of reportsResult.data ?? []) {
    const coachId = studentCoachMap.get(report.student_id);
    if (coachId && report.star_rating !== null) {
      const arr = coachRatings.get(coachId) ?? [];
      arr.push(report.star_rating);
      coachRatings.set(coachId, arr);
    }
  }

  const enrichedCoaches = (coachesResult.data ?? []).map((coach) => ({
    ...coach,
    studentCount: studentsByCoach.get(coach.id) ?? 0,
    avgRating: (() => {
      const ratings = coachRatings.get(coach.id);
      if (!ratings || ratings.length === 0) return null;
      return ratings.reduce((a, b) => a + b, 0) / ratings.length;
    })(),
  }));

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Coaches</h1>
      <p className="mt-1 text-ima-text-secondary">
        {enrichedCoaches.length} coach{enrichedCoaches.length !== 1 ? "es" : ""}{" "}
        on the platform
      </p>

      {enrichedCoaches.length === 0 ? (
        <div className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <Shield
                className="h-10 w-10 text-ima-text-secondary mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ima-text">No coaches yet</p>
              <p className="text-xs text-ima-text-secondary mt-1">
                Coaches will appear here once they join the platform.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {enrichedCoaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      )}
    </div>
  );
}
