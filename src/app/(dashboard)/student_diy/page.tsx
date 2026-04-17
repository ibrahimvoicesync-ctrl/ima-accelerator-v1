import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER, ROADMAP_STEPS } from "@/lib/config";
import { getToday, cn, formatHoursMinutes } from "@/lib/utils";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import type { Database } from "@/lib/types";
import { ReferralCard } from "@/components/student/ReferralCard";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];

function getNextAction(
  completedCount: number,
  totalMinutesWorked: number,
  activeSession: WorkSession | undefined,
  pausedSession: WorkSession | undefined,
): { label: string; href: string } {
  if (activeSession) return { label: "Continue session", href: "/student_diy/work" };
  if (pausedSession) return { label: "Resume session", href: "/student_diy/work" };
  if (totalMinutesWorked < WORK_TRACKER.dailyGoalHours * 60) {
    return { label: `Begin session ${String(completedCount + 1).padStart(2, "0")}`, href: "/student_diy/work" };
  }
  return { label: "Open Work Tracker", href: "/student_diy/work" };
}

export default async function StudentDiyDashboard() {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();
  const today = getToday();

  const [
    { data: sessions, error: sessionsError },
    { data: roadmapRows, error: roadmapError },
    { data: deals, error: dealsError },
  ] = await Promise.all([
    admin
      .from("work_sessions")
      .select("*")
      .eq("student_id", user.id)
      .eq("date", today)
      .order("cycle_number", { ascending: true }),
    admin
      .from("roadmap_progress")
      .select("step_number, status")
      .eq("student_id", user.id)
      .order("step_number", { ascending: true }),
    admin.from("deals").select("revenue, profit").eq("student_id", user.id),
  ]);

  if (sessionsError) {
    console.error("[student_diy dashboard] Failed to load sessions:", sessionsError);
  }
  if (roadmapError) {
    console.error("[student_diy dashboard] Failed to load roadmap:", roadmapError);
  }
  if (dealsError) {
    console.error("[student_diy dashboard] Failed to load deals:", dealsError);
  }

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
  const rawPercent = dailyGoalMinutes > 0 ? Math.round((totalMinutesWorked / dailyGoalMinutes) * 100) : 0;
  const progressBarWidth = Math.min(100, rawPercent);
  const goalMet = rawPercent >= 100;
  const firstName = user.name.split(" ")[0];

  const nextAction = getNextAction(completedCount, totalMinutesWorked, activeSession, pausedSession);

  const roadmapCompleted = (roadmapRows ?? []).filter(r => r.status === "completed").length;
  const activeRoadmapStep = (roadmapRows ?? []).find(r => r.status === "active");
  const allRoadmapDone =
    roadmapCompleted === ROADMAP_STEPS.length &&
    roadmapRows != null &&
    roadmapRows.length > 0;
  const roadmapPercent =
    roadmapRows && roadmapRows.length > 0
      ? Math.round((roadmapCompleted / ROADMAP_STEPS.length) * 100)
      : 0;

  const currencyFormat = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      {/* Editorial greeting — neutral eyebrow, big title, no competing signal */}
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
          Today
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ima-text leading-[0.95]">
          Assalamu3leikum, {firstName}.
        </h1>
        <p className="mt-3 text-sm md:text-base text-ima-text-secondary max-w-2xl">
          Here&apos;s your progress for today.
        </p>
      </header>

      {/* Hero metric — Hours today. Single focal point per view, stitch-blend scale. */}
      <section className="mb-14">
        <div className="flex items-baseline justify-between mb-3 gap-3">
          <span className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
            Hours today
          </span>
          {goalMet ? (
            <span className="inline-flex items-center gap-1.5 bg-ima-success/10 text-ima-success rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-ima-success" aria-hidden="true" />
              Daily goal reached
            </span>
          ) : (
            <span className="text-xs uppercase tracking-[0.18em] font-medium text-ima-text-muted tabular-nums">
              {completedCount} session{completedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-end gap-4 mb-6">
          <span
            className={cn(
              "text-7xl md:text-8xl font-semibold tabular-nums tracking-tight leading-[0.95]",
              goalMet ? "text-ima-success" : "text-ima-primary",
            )}
          >
            {formatHoursMinutes(totalMinutesWorked)}
          </span>
          <span className="text-xl md:text-2xl font-medium text-ima-text-muted tabular-nums mb-1.5">
            / {WORK_TRACKER.dailyGoalHours}h
          </span>
        </div>

        <div
          className="bg-ima-surface-light rounded-full h-2.5 overflow-hidden mb-6"
          role="progressbar"
          aria-valuenow={totalMinutesWorked}
          aria-valuemin={0}
          aria-valuemax={dailyGoalMinutes}
          aria-label={`Daily hours progress: ${formatHoursMinutes(totalMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours}h`}
        >
          <div
            className={cn(
              "h-full rounded-full motion-safe:transition-[width] duration-700 ease-out",
              goalMet ? "bg-ima-success" : "bg-ima-primary",
            )}
            style={{ width: `${progressBarWidth}%` }}
          />
        </div>

        {/* Stitch-blend "stack of wins" — filled circles echo CycleCard in the Work Tracker */}
        {completedCount > 0 && (
          <div className="flex items-center gap-3 mb-7">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
              Wins
            </span>
            <ul
              className="flex items-center gap-1.5 flex-wrap"
              aria-label={`${completedCount} session${completedCount !== 1 ? "s" : ""} completed today`}
            >
              {Array.from({ length: completedCount }).map((_, i) => (
                <li
                  key={i}
                  className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                    goalMet ? "bg-ima-success" : "bg-ima-primary",
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={nextAction.href}
          className="inline-flex items-center justify-center gap-2 bg-ima-primary text-white rounded-xl min-h-[52px] px-6 text-sm font-semibold tracking-tight hover:bg-ima-primary-hover hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-2 motion-safe:transition-all duration-200 ease-out"
        >
          {nextAction.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Support row — tabular KPI strip, all restrained neutrals. Roadmap is clickable. */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12">
        <Link
          href="/student_diy/roadmap"
          className="group block rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6 hover:border-ima-primary/45 hover:bg-ima-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
            Roadmap
          </p>
          <p
            className={cn(
              "text-3xl md:text-4xl font-semibold tabular-nums tracking-tight leading-none",
              allRoadmapDone ? "text-ima-success" : "text-ima-text",
            )}
          >
            {roadmapPercent}
            <span className="text-xl md:text-2xl text-ima-text-muted">%</span>
          </p>
          <p className="mt-2 text-xs text-ima-text-secondary tabular-nums">
            {allRoadmapDone
              ? `${ROADMAP_STEPS.length} / ${ROADMAP_STEPS.length} complete`
              : activeRoadmapStep
                ? `Step ${activeRoadmapStep.step_number} active`
                : `${roadmapCompleted} / ${ROADMAP_STEPS.length} steps`}
          </p>
        </Link>

        <div className="rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
            Deals closed
          </p>
          <p className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight text-ima-text leading-none">
            {dealsClosed}
          </p>
          <p className="mt-2 text-xs text-ima-text-muted tabular-nums">All time</p>
        </div>

        <div className="rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
            Revenue
          </p>
          <p className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight text-ima-text leading-none">
            {currencyFormat(totalRevenue)}
          </p>
          <p className="mt-2 text-xs text-ima-text-muted tabular-nums">All time</p>
        </div>

        <div className="rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
            Profit
          </p>
          <p className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight text-ima-text leading-none">
            {currencyFormat(totalProfit)}
          </p>
          <p className="mt-2 text-xs text-ima-text-muted tabular-nums">Net</p>
        </div>
      </section>

      <ReferralCard />
    </div>
  );
}
