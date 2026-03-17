import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGreeting, getToday } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { GraduationCap, Shield, Users, FileText } from "lucide-react";
import Link from "next/link";

export default async function OwnerDashboard() {
  const user = await requireRole("owner");
  const admin = createAdminClient();
  const today = getToday();
  const firstName = user.name.split(" ")[0];

  const [
    { count: totalStudents, error: studentsError },
    { count: totalCoaches, error: coachesError },
    { data: activeSessions, error: activeError },
    { count: reportsToday, error: reportsError },
  ] = await Promise.all([
    admin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "student")
      .eq("status", "active"),
    admin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "coach")
      .eq("status", "active"),
    admin
      .from("work_sessions")
      .select("student_id")
      .eq("date", today),
    admin
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .not("submitted_at", "is", null),
  ]);

  if (studentsError) {
    console.error("[owner dashboard] Failed to load total students:", studentsError);
  }
  if (coachesError) {
    console.error("[owner dashboard] Failed to load total coaches:", coachesError);
  }
  if (activeError) {
    console.error("[owner dashboard] Failed to load active sessions:", activeError);
  }
  if (reportsError) {
    console.error("[owner dashboard] Failed to load reports today:", reportsError);
  }

  const activeTodayCount = new Set(activeSessions?.map((r) => r.student_id) ?? []).size;

  return (
    <div className="px-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-ima-text">
        {getGreeting()}, {firstName}!
      </h1>
      <p className="mt-1 text-ima-text-secondary">Platform overview</p>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Total Students — clickable */}
        <Link href="/owner/students" className="min-h-[44px] block">
          <Card interactive>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap
                  className="h-5 w-5 text-ima-primary"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-ima-text">
                  {totalStudents ?? 0}
                </p>
                <p className="text-xs text-ima-text-secondary">Total Students</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Total Coaches — clickable */}
        <Link href="/owner/coaches" className="min-h-[44px] block">
          <Card interactive>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
                <Shield
                  className="h-5 w-5 text-ima-primary"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-ima-text">
                  {totalCoaches ?? 0}
                </p>
                <p className="text-xs text-ima-text-secondary">Total Coaches</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Active Today — display only */}
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
                {activeTodayCount}
              </p>
              <p className="text-xs text-ima-text-secondary">Active Today</p>
            </div>
          </CardContent>
        </Card>

        {/* Reports Today — display only */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {reportsToday ?? 0}
              </p>
              <p className="text-xs text-ima-text-secondary">Reports Today</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
