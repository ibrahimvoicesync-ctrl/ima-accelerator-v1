import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER } from "@/lib/config";
import { getGreeting, formatHours, getToday } from "@/lib/utils";
import Link from "next/link";
import { Map, FileText } from "lucide-react";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];

function getNextAction(
  completedCount: number,
  activeSession: WorkSession | undefined,
  pausedSession: WorkSession | undefined,
): { label: string; href: string } {
  if (activeSession) return { label: "Continue Cycle", href: "/student/work" };
  if (pausedSession) return { label: "Resume Cycle", href: "/student/work" };
  if (completedCount < WORK_TRACKER.cyclesPerDay) {
    return { label: `Start Cycle ${completedCount + 1}`, href: "/student/work" };
  }
  return { label: "Submit Report", href: "/student/report" };
}

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getToday();

  const { data: sessions, error } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("[student dashboard] Failed to load sessions:", error);
  }

  const todaySessions = (sessions ?? []) as WorkSession[];

  const completedCount = todaySessions.filter(s => s.status === "completed").length;
  const totalMinutesWorked = todaySessions
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const activeSession = todaySessions.find(s => s.status === "in_progress");
  const pausedSession = todaySessions.find(s => s.status === "paused");
  const progressPercent = Math.round((completedCount / WORK_TRACKER.cyclesPerDay) * 100);
  const firstName = user.name.split(" ")[0];

  const nextAction = getNextAction(completedCount, activeSession, pausedSession);

  return (
    <div className="px-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-ima-text">
        {getGreeting()}, {firstName}!
      </h1>
      <p className="mt-1 text-ima-text-secondary">Here&apos;s your progress for today</p>

      {/* Work Progress Card */}
      <div className="bg-ima-surface border border-ima-border rounded-xl p-6 mt-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-ima-text">Today&apos;s Work</h2>
          <span className="text-2xl font-bold text-ima-primary">
            {completedCount}/{WORK_TRACKER.cyclesPerDay}
          </span>
        </div>
        <p className="text-sm text-ima-text-secondary mt-1">
          {formatHours(totalMinutesWorked)} worked today
        </p>
        <div
          className="bg-ima-bg rounded-full h-3 mt-4 overflow-hidden"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={WORK_TRACKER.cyclesPerDay}
          aria-label="Daily cycle progress"
        >
          <div
            className="bg-ima-primary h-full rounded-full motion-safe:transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <Link
          href={nextAction.href}
          className="mt-4 inline-flex items-center justify-center w-full bg-ima-primary text-white rounded-lg min-h-[44px] px-6 font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
        >
          {nextAction.label}
        </Link>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Roadmap */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6">
          <Map className="h-8 w-8 text-ima-text-muted mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-ima-text">Roadmap</h3>
          <p className="text-sm text-ima-text-secondary mt-1">
            Track your 10-step program journey
          </p>
          <Link
            href="/student/roadmap"
            className="mt-3 inline-flex items-center text-sm font-medium text-ima-primary hover:underline min-h-[44px]"
          >
            View Roadmap
          </Link>
        </div>

        {/* Daily Report */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6">
          <FileText className="h-8 w-8 text-ima-text-muted mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-ima-text">Daily Report</h3>
          <p className="text-sm text-ima-text-secondary mt-1">
            Submit your daily progress report
          </p>
          <Link
            href="/student/report"
            className="mt-3 inline-flex items-center text-sm font-medium text-ima-primary hover:underline min-h-[44px]"
          >
            Submit Report
          </Link>
        </div>
      </div>
    </div>
  );
}
