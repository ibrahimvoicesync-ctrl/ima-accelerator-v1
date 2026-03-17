import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { CoachReportsClient } from "@/components/coach/CoachReportsClient";
import { FileText, Clock, CheckCircle, Timer } from "lucide-react";

export default async function CoachReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewed?: string; student_id?: string }>;
}) {
  const user = await requireRole("coach");
  const admin = createAdminClient();
  const today = getToday();

  // Derive date range using the established pattern (avoids impure Date.now())
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  // Fetch assigned active students
  const { data: students, error: studentsError } = await admin
    .from("users")
    .select("id, name")
    .eq("role", "student")
    .eq("coach_id", user.id)
    .eq("status", "active");

  if (studentsError) {
    console.error("[coach/reports] Failed to load students:", studentsError);
  }

  const studentList = students ?? [];
  const studentIds = studentList.map((s) => s.id);

  // Early return if no students assigned
  if (studentIds.length === 0) {
    return (
      <div className="px-4">
        <h1 className="text-2xl font-bold text-ima-text">Reports</h1>
        <p className="mt-1 text-ima-text-secondary">
          Review student reports from the last 7 days
        </p>
        <div className="mt-6">
          <Card>
            <CardContent className="p-8 text-center">
              <FileText
                className="h-10 w-10 text-ima-text-secondary mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ima-text">
                No students assigned yet
              </p>
              <p className="text-xs text-ima-text-secondary mt-1">
                Reports will appear here once students are assigned to you.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fetch reports for assigned students in last 7 days
  const { data: reports, error: reportsError } = await admin
    .from("daily_reports")
    .select(
      "id, student_id, date, hours_worked, star_rating, outreach_count, wins, improvements, submitted_at, reviewed_by, reviewed_at"
    )
    .in("student_id", studentIds)
    .gte("date", sevenDaysAgo)
    .not("submitted_at", "is", null)
    .order("date", { ascending: false });

  if (reportsError) {
    console.error("[coach/reports] Failed to load reports:", reportsError);
  }

  const allReports = reports ?? [];

  // Compute stat values server-side
  const totalReports = allReports.length;
  const pendingCount = allReports.filter((r) => r.reviewed_by === null).length;
  const reviewedCount = allReports.filter((r) => r.reviewed_by !== null).length;
  const avgHours =
    allReports.length > 0
      ? allReports.reduce((sum, r) => sum + (r.hours_worked ?? 0), 0) /
        allReports.length
      : 0;

  // Read search params
  const sp = await searchParams;

  // Apply filters based on searchParams
  let filteredReports = allReports;
  if (sp.reviewed === "false") {
    filteredReports = allReports.filter((r) => r.reviewed_by === null);
  } else if (sp.reviewed === "true") {
    filteredReports = allReports.filter((r) => r.reviewed_by !== null);
  }
  if (sp.student_id) {
    filteredReports = filteredReports.filter(
      (r) => r.student_id === sp.student_id
    );
  }

  // Build student name map
  const studentMap: Record<string, string> = {};
  for (const s of studentList) {
    studentMap[s.id] = s.name;
  }

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Reports</h1>
      <p className="mt-1 text-ima-text-secondary">
        Review student reports from the last 7 days
      </p>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Total Reports */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{totalReports}</p>
              <p className="text-xs text-ima-text-secondary">Total Reports</p>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-warning/10 flex items-center justify-center shrink-0">
              <Clock
                className="h-5 w-5 text-ima-warning"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">{pendingCount}</p>
              <p className="text-xs text-ima-text-secondary">Pending</p>
            </div>
          </CardContent>
        </Card>

        {/* Reviewed */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-success/10 flex items-center justify-center shrink-0">
              <CheckCircle
                className="h-5 w-5 text-ima-success"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {reviewedCount}
              </p>
              <p className="text-xs text-ima-text-secondary">Reviewed</p>
            </div>
          </CardContent>
        </Card>

        {/* Avg Hours */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-info/10 flex items-center justify-center shrink-0">
              <Timer
                className="h-5 w-5 text-ima-info"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {avgHours.toFixed(1)}
              </p>
              <p className="text-xs text-ima-text-secondary">Avg Hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report inbox client component */}
      <CoachReportsClient
        key={`${sp.reviewed ?? "all"}-${sp.student_id ?? ""}`}
        reports={filteredReports}
        students={studentList}
        studentMap={studentMap}
        currentFilter={sp.reviewed ?? "all"}
        currentStudentId={sp.student_id ?? ""}
      />
    </div>
  );
}
