import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER, ROADMAP_STEPS, KPI_TARGETS } from "@/lib/config";
import { getGreeting, getToday, cn, formatHoursMinutes } from "@/lib/utils";
import {
  lifetimeOutreachRag,
  dailyOutreachRag,
  dailyHoursRag,
  ragToColorClass,
  ragToBgClass,
  daysInProgram as computeDaysInProgram,
} from "@/lib/kpi";
import Link from "next/link";
import { CheckCircle, Handshake, DollarSign, TrendingUp } from "lucide-react";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];

function getNextAction(
  completedCount: number,
  totalMinutesWorked: number,
  activeSession: WorkSession | undefined,
  pausedSession: WorkSession | undefined,
): { label: string; href: string } {
  if (activeSession) return { label: "Continue Session", href: "/student/work" };
  if (pausedSession) return { label: "Resume Session", href: "/student/work" };
  if (totalMinutesWorked < WORK_TRACKER.dailyGoalHours * 60) {
    return { label: `Start Session ${completedCount + 1}`, href: "/student/work" };
  }
  return { label: "Submit Report", href: "/student/report" };
}

export default async function StudentDashboard() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = getToday();

  const [
    { data: sessions, error: sessionsError },
    { data: roadmapRows, error: roadmapError },
    reportResult,
    lifetimeResult,
    userResult,
    { data: deals, error: dealsError },
  ] = await Promise.all([
    admin.from("work_sessions").select("*").eq("student_id", user.id).eq("date", today).order("cycle_number", { ascending: true }),
    admin.from("roadmap_progress").select("step_number, status").eq("student_id", user.id).order("step_number", { ascending: true }),
    admin.from("daily_reports").select("submitted_at, brands_contacted, influencers_contacted").eq("student_id", user.id).eq("date", today).maybeSingle(),
    admin.from("daily_reports").select("brands_contacted, influencers_contacted").eq("student_id", user.id),
    admin.from("users").select("joined_at").eq("id", user.id).single(),
    admin.from("deals").select("revenue, profit").eq("student_id", user.id),
  ]);

  if (sessionsError) {
    console.error("[student dashboard] Failed to load sessions:", sessionsError);
  }
  if (roadmapError) {
    console.error("[student dashboard] Failed to load roadmap:", roadmapError);
  }
  if (reportResult.error) {
    console.error("[student dashboard] Failed to load report:", reportResult.error);
  }
  if (lifetimeResult.error) {
    console.error("[student dashboard] Failed to load lifetime KPIs:", lifetimeResult.error);
  }
  if (userResult.error) {
    console.error("[student dashboard] Failed to load user joined_at:", userResult.error);
  }
  if (dealsError) {
    console.error("[student dashboard] Failed to load deals:", dealsError);
  }

  const todayReport = reportResult.data;

  const dealsData = deals ?? [];
  const dealsClosed = dealsData.length;
  const totalRevenue = dealsData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalProfit = dealsData.reduce((sum, d) => sum + Number(d.profit), 0);

  const todaySessions = (sessions ?? []) as WorkSession[];

  const completedCount = todaySessions.filter(s => s.status === "completed").length;
  const totalMinutesWorked = todaySessions
    .filter(s => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const activeSession = todaySessions.find(s => s.status === "in_progress");
  const pausedSession = todaySessions.find(s => s.status === "paused");
  const dailyGoalMinutes = WORK_TRACKER.dailyGoalHours * 60;
  const progressPercent = Math.min(100, Math.round((totalMinutesWorked / dailyGoalMinutes) * 100));
  const firstName = user.name.split(" ")[0];

  const nextAction = getNextAction(completedCount, totalMinutesWorked, activeSession, pausedSession);

  // KPI values for breakdown cards
  const allReports = lifetimeResult.data ?? [];
  const lifetimeOutreach = allReports.reduce(
    (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
    0,
  );
  const days = computeDaysInProgram(userResult.data?.joined_at ?? new Date().toISOString());
  const dailyOutreachTotal = (todayReport?.brands_contacted ?? 0) + (todayReport?.influencers_contacted ?? 0);

  const lifetimeRag = lifetimeOutreachRag(lifetimeOutreach, days);
  const dailyOutRag = dailyOutreachRag(dailyOutreachTotal, days);
  const hoursRag = dailyHoursRag(totalMinutesWorked, days);

  const roadmapCompleted = (roadmapRows ?? []).filter(r => r.status === "completed").length;
  const activeRoadmapStep = (roadmapRows ?? []).find(r => r.status === "active");
  const allRoadmapDone = roadmapCompleted === ROADMAP_STEPS.length && roadmapRows != null && roadmapRows.length > 0;
  const roadmapPercent = roadmapRows && roadmapRows.length > 0 ? Math.round((roadmapCompleted / ROADMAP_STEPS.length) * 100) : 0;

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
            {formatHoursMinutes(totalMinutesWorked)} / {WORK_TRACKER.dailyGoalHours}h
          </span>
        </div>
        <p className="text-sm text-ima-text-secondary mt-1">
          {completedCount} session{completedCount !== 1 ? "s" : ""} completed
        </p>
        <div
          className="bg-ima-bg rounded-full h-3 mt-4 overflow-hidden"
          role="progressbar"
          aria-valuenow={totalMinutesWorked}
          aria-valuemin={0}
          aria-valuemax={dailyGoalMinutes}
          aria-label={`Daily hours progress: ${formatHoursMinutes(totalMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours}h`}
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

      {/* KPI Outreach Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {/* Lifetime Outreach */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", ragToBgClass(lifetimeRag))} aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Lifetime Outreach</h3>
          </div>
          <p className={cn("text-2xl font-bold mt-2", ragToColorClass(lifetimeRag))}>
            {lifetimeOutreach.toLocaleString()}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">
            Target: {KPI_TARGETS.lifetimeOutreach.toLocaleString()}
          </p>
          <div
            className="bg-ima-bg rounded-full h-2 mt-3 overflow-hidden"
            role="progressbar"
            aria-valuenow={lifetimeOutreach}
            aria-valuemin={0}
            aria-valuemax={KPI_TARGETS.lifetimeOutreach}
            aria-label={`Lifetime outreach: ${lifetimeOutreach} of ${KPI_TARGETS.lifetimeOutreach}`}
          >
            <div
              className={cn("h-full rounded-full motion-safe:transition-all duration-500", ragToBgClass(lifetimeRag))}
              style={{ width: `${Math.min(100, Math.round((lifetimeOutreach / KPI_TARGETS.lifetimeOutreach) * 100))}%` }}
            />
          </div>
        </div>

        {/* Daily Outreach */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", ragToBgClass(dailyOutRag))} aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Daily Outreach</h3>
          </div>
          <p className={cn("text-2xl font-bold mt-2", ragToColorClass(dailyOutRag))}>
            {dailyOutreachTotal}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">
            Target: {KPI_TARGETS.dailyOutreach}/day
          </p>
          <div
            className="bg-ima-bg rounded-full h-2 mt-3 overflow-hidden"
            role="progressbar"
            aria-valuenow={dailyOutreachTotal}
            aria-valuemin={0}
            aria-valuemax={KPI_TARGETS.dailyOutreach}
            aria-label={`Daily outreach: ${dailyOutreachTotal} of ${KPI_TARGETS.dailyOutreach}`}
          >
            <div
              className={cn("h-full rounded-full motion-safe:transition-all duration-500", ragToBgClass(dailyOutRag))}
              style={{ width: `${Math.min(100, Math.round((dailyOutreachTotal / KPI_TARGETS.dailyOutreach) * 100))}%` }}
            />
          </div>
        </div>

        {/* Daily Hours */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", ragToBgClass(hoursRag))} aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Hours Worked</h3>
          </div>
          <p className={cn("text-2xl font-bold mt-2", ragToColorClass(hoursRag))}>
            {formatHoursMinutes(totalMinutesWorked)}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">
            Target: {WORK_TRACKER.dailyGoalHours}h/day
          </p>
          <div
            className="bg-ima-bg rounded-full h-2 mt-3 overflow-hidden"
            role="progressbar"
            aria-valuenow={totalMinutesWorked}
            aria-valuemin={0}
            aria-valuemax={WORK_TRACKER.dailyGoalHours * 60}
            aria-label={`Hours worked: ${formatHoursMinutes(totalMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours}h`}
          >
            <div
              className={cn("h-full rounded-full motion-safe:transition-all duration-500", ragToBgClass(hoursRag))}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deals Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {/* Deals Closed */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Handshake className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Deals Closed</h3>
          </div>
          <p className="text-2xl font-bold mt-2 text-ima-primary">{dealsClosed}</p>
          <p className="text-xs text-ima-text-muted mt-1">all time</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Total Revenue</h3>
          </div>
          <p className="text-2xl font-bold mt-2 text-ima-primary">
            {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">from {dealsClosed} deal{dealsClosed !== 1 ? "s" : ""}</p>
        </div>

        {/* Total Profit */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ima-text-muted shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-medium text-ima-text-secondary">Total Profit</h3>
          </div>
          <p className="text-2xl font-bold mt-2 text-ima-primary">
            {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">all time</p>
        </div>
      </div>

      {/* Placeholder Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {/* Roadmap Progress Card */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-ima-text">Roadmap</h3>
            <span className="text-lg font-bold text-ima-primary">
              {roadmapCompleted}/{ROADMAP_STEPS.length}
            </span>
          </div>
          {roadmapRows && roadmapRows.length > 0 ? (
            <>
              <p className="text-sm text-ima-text-secondary mt-1">
                {allRoadmapDone
                  ? "All steps completed!"
                  : activeRoadmapStep
                    ? `Current: Step ${activeRoadmapStep.step_number}`
                    : "Start your journey"}
              </p>
              <div
                className="bg-ima-bg rounded-full h-2 mt-3 overflow-hidden"
                role="progressbar"
                aria-valuenow={roadmapCompleted}
                aria-valuemin={0}
                aria-valuemax={ROADMAP_STEPS.length}
                aria-label="Roadmap progress"
              >
                <div
                  className="bg-ima-success h-full rounded-full motion-safe:transition-all duration-500"
                  style={{ width: `${roadmapPercent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-ima-text-secondary mt-1">
              Track your {ROADMAP_STEPS.length}-step program journey
            </p>
          )}
          <Link
            href="/student/roadmap"
            className={cn(
              "mt-3 inline-flex items-center justify-center w-full rounded-lg min-h-[44px] px-6 font-medium motion-safe:transition-colors text-sm",
              allRoadmapDone
                ? "bg-ima-success text-white hover:bg-ima-success/90"
                : "bg-ima-surface-light text-ima-primary hover:bg-ima-surface-accent"
            )}
          >
            {allRoadmapDone
              ? "Roadmap Complete!"
              : activeRoadmapStep
                ? `Continue Step ${activeRoadmapStep.step_number}`
                : "View Roadmap"}
          </Link>
        </div>

        {/* Daily Report */}
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-ima-text">Daily Report</h3>
            {todayReport?.submitted_at ? (
              <span className="flex items-center gap-1 text-xs font-medium text-ima-success">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Submitted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-ima-warning">
                <span className="h-2 w-2 rounded-full bg-ima-warning" aria-hidden="true" />
                Pending
              </span>
            )}
          </div>
          <p className="text-sm text-ima-text-secondary mt-1">
            {todayReport?.submitted_at
              ? "Your report is in. You can still update it."
              : "Submit your daily progress report"}
          </p>
          <p className="text-xs text-ima-text-muted mt-1">Due by 11 PM</p>
          <Link
            href="/student/report"
            className="mt-3 inline-flex items-center justify-center w-full bg-ima-surface-light text-ima-primary rounded-lg min-h-[44px] px-6 font-medium text-sm hover:bg-ima-surface-accent motion-safe:transition-colors"
          >
            {todayReport?.submitted_at ? "Update Report" : "Submit Report"}
          </Link>
        </div>
      </div>
    </div>
  );
}
