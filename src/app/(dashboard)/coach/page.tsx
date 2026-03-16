import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getGreeting, getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StudentCard } from "@/components/coach/StudentCard";
import { Users, AlertTriangle, FileText, ArrowRight } from "lucide-react";
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

export default async function CoachDashboard() {
  // Step 1 — Auth + fetch assigned students
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
    console.error("[coach dashboard] Failed to load students:", studentsError);
  }

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);

  // Step 2 — If no students, skip enrichment. Otherwise parallel fetch.
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
    console.error("[coach dashboard] Failed to load sessions:", sessionsResult.error);
  }
  if (reportsResult.error) {
    console.error("[coach dashboard] Failed to load reports:", reportsResult.error);
  }
  if (roadmapResult.error) {
    console.error("[coach dashboard] Failed to load roadmap:", roadmapResult.error);
  }

  // Step 3 — Build lookup maps
  const latestSessionMap = new Map<string, string>();
  for (const s of sessionsResult.data ?? []) {
    if (!latestSessionMap.has(s.student_id)) {
      latestSessionMap.set(s.student_id, s.date); // sorted desc, first = latest
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
  // Derive nowMs from the server-generated today string to avoid impure Date.now()
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  let pendingReviewCount = 0;
  for (const r of reportsResult.data ?? []) {
    if (r.date >= sevenDaysAgo && r.star_rating !== null) {
      const arr = recentRatings.get(r.student_id) ?? [];
      arr.push(r.star_rating);
      recentRatings.set(r.student_id, arr);
    }
    if (r.date >= sevenDaysAgo && r.reviewed_by === null) {
      pendingReviewCount++;
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

  // Step 4 — Compute enriched student objects with at-risk detection

  const enrichedStudents: EnrichedStudent[] = studentList.map((student) => {
    const latestSession = latestSessionMap.get(student.id) ?? null;
    const latestReport = latestReportMap.get(student.id) ?? null;
    const lastActiveDateStr =
      [latestSession, latestReport].filter(Boolean).sort().at(-1) ?? null;
    const hasActivity = latestSession !== null || latestReport !== null;
    const joinedDaysAgo = Math.floor(
      (nowMs - new Date(student.joined_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // "New" badge: zero activity AND joined < 3 days ago
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

    // Inactive check
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

    // Rating check
    const ratings = recentRatings.get(student.id);
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (avg < COACH_CONFIG.atRiskRatingThreshold) {
        reasons.push(`Avg rating ${avg.toFixed(1)}`);
      }
    }

    // Last active label
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

  // Sort: at-risk first, then alphabetical by name
  enrichedStudents.sort((a, b) => {
    if (a.isAtRisk && !b.isAtRisk) return -1;
    if (!a.isAtRisk && b.isAtRisk) return 1;
    return a.name.localeCompare(b.name);
  });

  const atRiskStudents = enrichedStudents.filter((s) => s.isAtRisk);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="px-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-ima-text">
        {getGreeting()}, {firstName}!
      </h1>
      <p className="mt-1 text-ima-text-secondary">
        Here&apos;s how your students are doing
      </p>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {/* Total Students */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <Users
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {studentList.length}
              </p>
              <p className="text-xs text-ima-text-secondary">Total Students</p>
            </div>
          </CardContent>
        </Card>

        {/* At-Risk */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle
                className="h-5 w-5 text-ima-warning"
                aria-hidden="true"
              />
            </div>
            <div>
              <p
                className={
                  atRiskStudents.length > 0
                    ? "text-2xl font-bold text-ima-error"
                    : "text-2xl font-bold text-ima-text"
                }
              >
                {atRiskStudents.length}
              </p>
              <p className="text-xs text-ima-text-secondary">At-Risk</p>
            </div>
          </CardContent>
        </Card>

        {/* Reports Pending */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-info/10 flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-ima-info"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {pendingReviewCount}
              </p>
              <p className="text-xs text-ima-text-secondary">
                Reports Pending Review
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* At-risk banner */}
      {atRiskStudents.length > 0 && (
        <section role="alert" className="mt-6">
          <Card variant="warm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-ima-warning/10 shrink-0">
                  <AlertTriangle
                    className="h-5 w-5 text-ima-warning"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ima-text">
                    {atRiskStudents.length} Student
                    {atRiskStudents.length !== 1 ? "s" : ""} Needing Attention
                  </h2>
                  <p className="text-xs text-ima-text-secondary">
                    Review and reach out before they fall behind
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {atRiskStudents.map((student) => (
                  <Link
                    key={student.id}
                    href={`/coach/students/${student.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-ima-surface border border-ima-border hover:shadow-md motion-safe:transition-shadow min-h-[44px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {student.name
                          .split(" ")
                          .map((n) => n[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ima-text truncate">
                          {student.name}
                        </p>
                        <p className="text-xs text-ima-text-secondary truncate">
                          {student.atRiskReasons.join(", ")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="error" size="sm">
                      {student.atRiskReasons.join(", ")}
                    </Badge>
                    <ArrowRight
                      className="h-4 w-4 text-ima-text-secondary shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Student card grid */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-ima-text mb-4">
          My Students
        </h2>
        {enrichedStudents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users
                className="h-10 w-10 text-ima-text-secondary mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ima-text">
                No students assigned yet
              </p>
              <p className="text-xs text-ima-text-secondary mt-1">
                Students will appear here once assigned to you.
              </p>
            </CardContent>
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
