import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import {
  BarChart3,
  Star,
  Clock,
  MessageSquare,
  Users,
  AlertTriangle,
  UserX,
  UserPlus,
} from "lucide-react";

export default async function CoachAnalyticsPage() {
  const user = await requireRole("coach");
  const admin = createAdminClient();

  const today = getToday();
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  // Fetch all students assigned to this coach
  const studentsResult = await admin
    .from("users")
    .select("id, name, status, joined_at")
    .eq("role", "student")
    .eq("coach_id", user.id);

  if (studentsResult.error) {
    console.error(
      "[coach analytics] Failed to load students:",
      studentsResult.error
    );
  }

  const allStudents = studentsResult.data ?? [];

  // Empty state — no students assigned
  if (allStudents.length === 0) {
    return (
      <div className="px-4">
        <h1 className="text-2xl font-bold text-ima-text">Analytics</h1>
        <p className="mt-1 text-ima-text-secondary">
          Cohort performance over the last 7 days
        </p>
        <div className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3
                className="h-10 w-10 text-ima-text-secondary mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ima-text">
                No students assigned
              </p>
              <p className="text-xs text-ima-text-secondary mt-1">
                Analytics will appear once students join your cohort.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const studentIds = allStudents.map((s) => s.id);
  const activeStudentIds = allStudents
    .filter((s) => s.status === "active")
    .map((s) => s.id);

  // Parallel fetch reports (last 7 days, submitted only) and all sessions
  const [reportsResult, sessionsResult] = await Promise.all([
    admin
      .from("daily_reports")
      .select(
        "student_id, date, hours_worked, star_rating, outreach_count, submitted_at, reviewed_by"
      )
      .in("student_id", studentIds)
      .gte("date", sevenDaysAgo)
      .not("submitted_at", "is", null),
    admin
      .from("work_sessions")
      .select("student_id, date")
      .in("student_id", studentIds)
      .order("date", { ascending: false }),
  ]);

  if (reportsResult.error) {
    console.error(
      "[coach analytics] Failed to load reports:",
      reportsResult.error
    );
  }
  if (sessionsResult.error) {
    console.error(
      "[coach analytics] Failed to load sessions:",
      sessionsResult.error
    );
  }

  const reports = reportsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];

  // -------------------------------------------------------------------------
  // Compute aggregate metrics
  // -------------------------------------------------------------------------

  // Report submission rate: reports submitted / (active students * 7 days) * 100
  const submissionRate =
    activeStudentIds.length > 0
      ? Math.round(
          (reports.length /
            (activeStudentIds.length * COACH_CONFIG.reportInboxDays)) *
            100
        )
      : 0;

  // Avg star rating
  const ratingsWithValue = reports.filter((r) => r.star_rating !== null);
  const avgStarRating =
    ratingsWithValue.length > 0
      ? (
          ratingsWithValue.reduce((sum, r) => sum + (r.star_rating ?? 0), 0) /
          ratingsWithValue.length
        ).toFixed(1)
      : "0.0";

  // Avg hours per day
  const avgHoursPerDay =
    reports.length > 0
      ? (
          reports.reduce((sum, r) => sum + Number(r.hours_worked), 0) /
          reports.length
        ).toFixed(1)
      : "0.0";

  // Avg outreach count
  const avgOutreach =
    reports.length > 0
      ? (
          reports.reduce((sum, r) => sum + r.outreach_count, 0) / reports.length
        ).toFixed(1)
      : "0.0";

  // -------------------------------------------------------------------------
  // Student breakdown categories
  // -------------------------------------------------------------------------

  // Build last-active-date map from sessions + reports
  const lastActiveMap = new Map<string, string>();
  for (const s of sessions) {
    if (
      !lastActiveMap.has(s.student_id) ||
      s.date > (lastActiveMap.get(s.student_id) ?? "")
    ) {
      lastActiveMap.set(s.student_id, s.date);
    }
  }
  for (const r of reports) {
    if (
      !lastActiveMap.has(r.student_id) ||
      r.date > (lastActiveMap.get(r.student_id) ?? "")
    ) {
      lastActiveMap.set(r.student_id, r.date);
    }
  }

  // Build recent ratings map for at-risk detection
  const recentRatings = new Map<string, number[]>();
  for (const r of reports) {
    if (r.star_rating !== null) {
      const arr = recentRatings.get(r.student_id) ?? [];
      arr.push(r.star_rating);
      recentRatings.set(r.student_id, arr);
    }
  }

  // Categorize each student
  let activeCount = 0;
  let atRiskCount = 0;
  let inactiveCount = 0;
  let newCount = 0;

  for (const student of allStudents) {
    const lastActive = lastActiveMap.get(student.id);
    const joinedDaysAgo = Math.floor(
      (nowMs - new Date(student.joined_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const hasActivity = lastActive !== undefined;

    // New: no activity AND joined < 3 days ago
    if (!hasActivity && joinedDaysAgo < COACH_CONFIG.atRiskInactiveDays) {
      newCount++;
      continue;
    }

    // Check at-risk conditions
    let isAtRisk = false;

    if (lastActive) {
      const daysInactive = Math.floor(
        (nowMs - new Date(lastActive + "T00:00:00Z").getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysInactive >= COACH_CONFIG.atRiskInactiveDays) isAtRisk = true;
    } else if (joinedDaysAgo >= COACH_CONFIG.atRiskInactiveDays) {
      isAtRisk = true;
    }

    const ratings = recentRatings.get(student.id);
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      if (avg < COACH_CONFIG.atRiskRatingThreshold) isAtRisk = true;
    }

    // Inactive: no report in 7+ days AND not new
    if (!hasActivity && joinedDaysAgo >= COACH_CONFIG.reportInboxDays) {
      inactiveCount++;
    } else if (isAtRisk) {
      atRiskCount++;
    } else {
      activeCount++;
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Analytics</h1>
      <p className="mt-1 text-ima-text-secondary">
        Cohort performance over the last 7 days
      </p>

      {/* 4 Metric stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Report Submission Rate */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <BarChart3
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {submissionRate}%
              </p>
              <p className="text-xs text-ima-text-secondary">
                Report Submission Rate
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Star Rating */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-warning/10 flex items-center justify-center shrink-0">
              <Star
                className="h-5 w-5 text-ima-warning"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {avgStarRating}
              </p>
              <p className="text-xs text-ima-text-secondary">Avg Star Rating</p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Hours / Day */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-info/10 flex items-center justify-center shrink-0">
              <Clock
                className="h-5 w-5 text-ima-info"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {avgHoursPerDay}h
              </p>
              <p className="text-xs text-ima-text-secondary">Avg Hours / Day</p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Outreach Count */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-success/10 flex items-center justify-center shrink-0">
              <MessageSquare
                className="h-5 w-5 text-ima-success"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{avgOutreach}</p>
              <p className="text-xs text-ima-text-secondary">
                Avg Outreach Count
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student breakdown card */}
      <div className="mt-6">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-base font-semibold text-ima-text mb-4">
              Student Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Active */}
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-ima-surface-light">
                <Users
                  className="h-5 w-5 text-ima-success"
                  aria-hidden="true"
                />
                <p className="text-2xl font-bold text-ima-success">
                  {activeCount}
                </p>
                <p className="text-xs text-ima-text-secondary">Active</p>
              </div>

              {/* At-Risk */}
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-ima-surface-light">
                <AlertTriangle
                  className="h-5 w-5 text-ima-error"
                  aria-hidden="true"
                />
                <p
                  className={
                    atRiskCount > 0
                      ? "text-2xl font-bold text-ima-error"
                      : "text-2xl font-bold text-ima-text"
                  }
                >
                  {atRiskCount}
                </p>
                <p className="text-xs text-ima-text-secondary">At-Risk</p>
              </div>

              {/* Inactive */}
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-ima-surface-light">
                <UserX
                  className="h-5 w-5 text-ima-warning"
                  aria-hidden="true"
                />
                <p
                  className={
                    inactiveCount > 0
                      ? "text-2xl font-bold text-ima-warning"
                      : "text-2xl font-bold text-ima-text"
                  }
                >
                  {inactiveCount}
                </p>
                <p className="text-xs text-ima-text-secondary">Inactive</p>
              </div>

              {/* New */}
              <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-ima-surface-light">
                <UserPlus
                  className="h-5 w-5 text-ima-info"
                  aria-hidden="true"
                />
                <p className="text-2xl font-bold text-ima-info">{newCount}</p>
                <p className="text-xs text-ima-text-secondary">New</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
