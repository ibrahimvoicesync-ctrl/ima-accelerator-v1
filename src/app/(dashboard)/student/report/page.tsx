import { Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { ReportFormWrapper } from "@/components/student/ReportFormWrapper";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getToday, formatHours } from "@/lib/utils";
import Link from "next/link";

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DailyReportPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getToday();

  // Parallel fetch report + sessions
  const [reportResult, sessionsResult] = await Promise.all([
    admin
      .from("daily_reports")
      .select("*")
      .eq("student_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    admin
      .from("work_sessions")
      .select("duration_minutes, status")
      .eq("student_id", user.id)
      .eq("date", today)
      .eq("status", "completed"),
  ]);

  // Log any query errors
  if (reportResult.error) console.error("[report] report:", reportResult.error);
  if (sessionsResult.error) console.error("[report] sessions:", sessionsResult.error);

  const report = reportResult.data;
  const autoMinutes = (sessionsResult.data ?? []).reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0
  );

  return (
    <div className="px-4 space-y-5 max-w-2xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-ima-text">Daily Report</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Reflect on your day and track your progress
        </p>
      </div>

      {/* Date + Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Date card */}
        <Card variant="warm" className="sm:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-ima-primary/10 shrink-0">
                <Calendar
                  className="h-6 w-6 text-ima-primary"
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ima-text-secondary uppercase tracking-wide">
                  Today
                </p>
                <p className="text-base font-semibold text-ima-text mt-0.5">
                  {formatDateDisplay(today)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hours card */}
        <div
          className="rounded-xl p-4 bg-ima-surface border border-ima-border shadow-sm"
          role="status"
          aria-label={`Hours tracked: ${formatHours(autoMinutes)}`}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-ima-warning/10 mb-2">
            <Clock
              className="w-4 h-4 text-ima-warning"
              aria-hidden="true"
            />
          </div>
          <div className="text-2xl font-bold text-ima-text">
            {formatHours(autoMinutes)}
          </div>
          <div className="text-xs text-ima-text-secondary uppercase tracking-wide">
            Hours Tracked
          </div>
        </div>
      </div>

      {/* Report form -- banners managed by ReportFormWrapper via useOptimistic */}
      <ReportFormWrapper
        date={today}
        existingReport={report ?? null}
        autoMinutes={autoMinutes}
      />

      {/* Link to history */}
      <Link
        href="/student/report/history"
        className="text-sm text-ima-primary hover:underline min-h-[44px] inline-flex items-center"
      >
        View Past Reports
      </Link>
    </div>
  );
}
