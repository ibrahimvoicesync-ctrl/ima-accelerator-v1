import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { StudentCard } from "@/components/coach/StudentCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import { Users } from "lucide-react";
import Link from "next/link";

type EnrichedStudent = {
  id: string;
  name: string;
  isNew: boolean;
  isAtRisk: boolean;
  atRiskReasons: string[];
  lastActiveLabel: string;
  todayReportSubmitted: boolean;
  currentRoadmapStep: number;
};

export default async function CoachStudentsPage() {
  const user = await requireRole("coach");
  const admin = createAdminClient();
  const today = getToday();

  const { data: students, error: studentsError } = await admin
    .from("users")
    .select("id, name, email, status, joined_at")
    .eq("role", "student")
    .eq("coach_id", user.id)
    .eq("status", "active");

  if (studentsError) {
    console.error("[coach students] Failed to load students:", studentsError);
  }

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);

  const [sessionsResult, reportsResult, roadmapResult] =
    studentIds.length > 0
      ? await Promise.all([
          admin
            .from("work_sessions")
            .select("student_id, date")
            .in("student_id", studentIds)
            .order("date", { ascending: false }),
          admin
            .from("daily_reports")
            .select("student_id, date, star_rating, reviewed_by")
            .in("student_id", studentIds),
          admin
            .from("roadmap_progress")
            .select("student_id, step_number, status")
            .in("student_id", studentIds),
        ])
      : ([
          { data: null, error: null },
          { data: null, error: null },
          { data: null, error: null },
        ] as const);

  if (sessionsResult.error) {
    console.error("[coach students] Failed to load sessions:", sessionsResult.error);
  }
  if (reportsResult.error) {
    console.error("[coach students] Failed to load reports:", reportsResult.error);
  }
  if (roadmapResult.error) {
    console.error("[coach students] Failed to load roadmap:", roadmapResult.error);
  }

  // Build lookup maps
  const latestSessionMap = new Map<string, string>();
  for (const s of sessionsResult.data ?? []) {
    if (!latestSessionMap.has(s.student_id)) {
      latestSessionMap.set(s.student_id, s.date);
    }
  }

  const latestReportMap = new Map<string, string>();
  const todayReportMap = new Map<string, boolean>();
  for (const r of reportsResult.data ?? []) {
    if (!latestReportMap.has(r.student_id) || r.date > (latestReportMap.get(r.student_id) ?? "")) {
      latestReportMap.set(r.student_id, r.date);
    }
    if (r.date === today) {
      todayReportMap.set(r.student_id, true);
    }
  }

  const recentRatings = new Map<string, number[]>();
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  for (const r of reportsResult.data ?? []) {
    if (r.date >= sevenDaysAgo && r.star_rating !== null) {
      const arr = recentRatings.get(r.student_id) ?? [];
      arr.push(r.star_rating);
      recentRatings.set(r.student_id, arr);
    }
  }

  const roadmapStepMap = new Map<string, number>();
  for (const r of roadmapResult.data ?? []) {
    const current = roadmapStepMap.get(r.student_id) ?? 0;
    if (
      (r.status === "completed" || r.status === "active") &&
      r.step_number > current
    ) {
      roadmapStepMap.set(r.student_id, r.step_number);
    }
  }

  // Enrich students
  const enrichedStudents: EnrichedStudent[] = studentList.map((student) => {
    const latestSession = latestSessionMap.get(student.id) ?? null;
    const latestReport = latestReportMap.get(student.id) ?? null;
    const lastActiveDateStr =
      [latestSession, latestReport].filter(Boolean).sort().at(-1) ?? null;
    const hasActivity = latestSession !== null || latestReport !== null;
    const joinedDaysAgo = Math.floor(
      (nowMs - new Date(student.joined_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (!hasActivity && joinedDaysAgo < COACH_CONFIG.atRiskInactiveDays) {
      return {
        id: student.id,
        name: student.name,
        isNew: true,
        isAtRisk: false,
        atRiskReasons: [],
        lastActiveLabel: "New",
        todayReportSubmitted: todayReportMap.has(student.id),
        currentRoadmapStep: roadmapStepMap.get(student.id) ?? 1,
      };
    }

    const reasons: string[] = [];

    if (lastActiveDateStr) {
      const daysInactive = Math.floor(
        (nowMs - new Date(lastActiveDateStr + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysInactive >= COACH_CONFIG.atRiskInactiveDays) {
        reasons.push(`Inactive ${daysInactive}d`);
      }
    } else if (joinedDaysAgo >= COACH_CONFIG.atRiskInactiveDays) {
      reasons.push(`Inactive ${joinedDaysAgo}d`);
    }

    const ratings = recentRatings.get(student.id);
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (avg < COACH_CONFIG.atRiskRatingThreshold) {
        reasons.push(`Avg rating ${avg.toFixed(1)}`);
      }
    }

    let lastActiveLabel = "Never";
    if (lastActiveDateStr) {
      lastActiveLabel = new Date(
        lastActiveDateStr + "T00:00:00Z"
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    }

    return {
      id: student.id,
      name: student.name,
      isNew: false,
      isAtRisk: reasons.length > 0,
      atRiskReasons: reasons,
      lastActiveLabel,
      todayReportSubmitted: todayReportMap.has(student.id),
      currentRoadmapStep: roadmapStepMap.get(student.id) ?? 1,
    };
  });

  // Sort: at-risk first, then alphabetical
  enrichedStudents.sort((a, b) => {
    if (a.isAtRisk && !b.isAtRisk) return -1;
    if (!a.isAtRisk && b.isAtRisk) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">My Students</h1>
      <p className="mt-1 text-ima-text-secondary">
        {studentList.length} student{studentList.length !== 1 ? "s" : ""} assigned to you
      </p>

      <div className="mt-6">
        {enrichedStudents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No students assigned yet"
              description="Students will appear here once the owner assigns them to you."
              action={
                <Link href="/coach/invites" className={buttonVariants({ variant: "primary" })}>
                  Invite Students
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrichedStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
