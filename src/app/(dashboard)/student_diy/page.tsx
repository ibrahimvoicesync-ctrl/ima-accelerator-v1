import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_TRACKER, ROADMAP_STEPS } from "@/lib/config";
import { getToday, cn, formatHoursMinutes } from "@/lib/utils";
import Link from "next/link";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import type { Database } from "@/lib/types";
import { ReferralCard } from "@/components/student/ReferralCard";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono-bold)" };

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
    return {
      label: `Begin session ${String(completedCount + 1).padStart(2, "0")}`,
      href: "/student_diy/work",
    };
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

  if (sessionsError) console.error("[student_diy dashboard] Failed to load sessions:", sessionsError);
  if (roadmapError) console.error("[student_diy dashboard] Failed to load roadmap:", roadmapError);
  if (dealsError) console.error("[student_diy dashboard] Failed to load deals:", dealsError);

  const dealsData = deals ?? [];
  const dealsClosed = dealsData.length;
  const totalRevenue = dealsData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalProfit = dealsData.reduce((sum, d) => sum + Number(d.profit), 0);

  const todaySessions = (sessions ?? []) as WorkSession[];
  const completedCount = todaySessions.filter((s) => s.status === "completed").length;
  const totalMinutesWorked = todaySessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const activeSession = todaySessions.find((s) => s.status === "in_progress");
  const pausedSession = todaySessions.find((s) => s.status === "paused");
  const dailyGoalMinutes = WORK_TRACKER.dailyGoalHours * 60;
  const rawPercent =
    dailyGoalMinutes > 0 ? Math.round((totalMinutesWorked / dailyGoalMinutes) * 100) : 0;
  const progressBarWidth = Math.min(100, rawPercent);
  const goalMet = rawPercent >= 100;
  const firstName = user.name.split(" ")[0];

  const nextAction = getNextAction(
    completedCount,
    totalMinutesWorked,
    activeSession,
    pausedSession,
  );

  const roadmapCompleted = (roadmapRows ?? []).filter((r) => r.status === "completed").length;
  const activeRoadmapStep = (roadmapRows ?? []).find((r) => r.status === "active");
  const allRoadmapDone =
    roadmapCompleted === ROADMAP_STEPS.length &&
    roadmapRows != null &&
    roadmapRows.length > 0;
  const roadmapPercent =
    roadmapRows && roadmapRows.length > 0
      ? Math.round((roadmapCompleted / ROADMAP_STEPS.length) * 100)
      : 0;

  const currencyFormat = (value: number) =>
    `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-ima-bg`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Masthead — amplified scale for student_diy */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
            style={MONO}
          >
            Today
          </p>
          <h1 className="mt-3 text-4xl md:text-6xl font-bold leading-[1.0] text-ima-text tracking-[-0.02em]">
            Assalamu3leikum, {firstName}.
          </h1>
          <p className="mt-3 text-[15px] md:text-base text-ima-text-secondary leading-[1.5] max-w-2xl">
            Here&apos;s your progress for today.
          </p>
        </header>

        {/* Hero — monumental hours metric, stitch-blend "stack of wins", CTA */}
        <section
          aria-labelledby="hours-today-label"
          className="mt-10 bg-ima-surface border border-ima-border rounded-[14px] p-6 md:p-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p
              id="hours-today-label"
              className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
              style={MONO}
            >
              Hours Today
            </p>
            {goalMet ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-ima-success/10 border border-ima-success/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-ima-success">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Daily Goal Reached
              </span>
            ) : (
              <span
                className="text-[10px] font-semibold tracking-[0.14em] text-ima-text-muted uppercase tabular-nums"
                style={MONO}
              >
                {completedCount} Session{completedCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="mt-6 flex items-end gap-4 flex-wrap">
            <span
              className={cn(
                "text-7xl md:text-8xl font-bold tabular-nums tracking-[-0.02em] leading-[0.95]",
                goalMet ? "text-ima-success" : "text-ima-primary",
              )}
            >
              {formatHoursMinutes(totalMinutesWorked)}
            </span>
            <span className="text-xl md:text-2xl font-medium text-ima-text-muted tabular-nums mb-2">
              / {WORK_TRACKER.dailyGoalHours}h
            </span>
          </div>

          <div
            className="mt-6 h-[8px] rounded-full bg-ima-surface-light overflow-hidden"
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

          {/* Stitch-blend stack of wins — filled circles echo CycleCard */}
          {completedCount > 0 && (
            <div className="mt-6 flex items-center gap-3">
              <span
                className="text-[10px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
                style={MONO}
              >
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
            className="group mt-6 inline-flex items-center justify-center gap-2 w-full md:w-auto rounded-[10px] bg-ima-primary text-white text-[14px] font-semibold min-h-[48px] px-6 hover:bg-ima-primary-hover focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 motion-safe:transition-colors"
          >
            {nextAction.label}
            <ArrowRight
              className="h-4 w-4 motion-safe:transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </section>

        {/* Support KPIs */}
        <section
          aria-label="Supporting metrics"
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
              style={MONO}
            >
              Progress
            </h2>
            <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-[14px]">
            <Link
              href="/student_diy/roadmap"
              aria-label={`Roadmap: ${roadmapPercent}% complete`}
              className="group block bg-ima-surface border border-ima-border rounded-[14px] p-6 hover:border-ima-primary/40 focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 motion-safe:transition-colors"
            >
              <p
                className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Roadmap
              </p>
              <p
                className={cn(
                  "mt-4 text-[28px] md:text-[32px] font-bold tabular-nums tracking-[-0.01em] leading-none",
                  allRoadmapDone ? "text-ima-success" : "text-ima-text",
                )}
              >
                {roadmapPercent}
                <span className="text-xl md:text-2xl text-ima-text-muted font-semibold">%</span>
              </p>
              <p className="mt-[10px] text-[12px] text-ima-text-muted tabular-nums">
                {allRoadmapDone
                  ? `${ROADMAP_STEPS.length} / ${ROADMAP_STEPS.length} complete`
                  : activeRoadmapStep
                    ? `Step ${activeRoadmapStep.step_number} active`
                    : `${roadmapCompleted} / ${ROADMAP_STEPS.length} steps`}
              </p>
            </Link>

            <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6">
              <p
                className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Deals Closed
              </p>
              <p className="mt-4 text-[28px] md:text-[32px] font-bold tabular-nums tracking-[-0.01em] text-ima-text leading-none">
                {dealsClosed}
              </p>
              <p className="mt-[10px] text-[12px] text-ima-text-muted">All time</p>
            </div>

            <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6">
              <p
                className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Revenue
              </p>
              <p className="mt-4 text-[28px] md:text-[32px] font-bold tabular-nums tracking-[-0.01em] text-ima-text leading-none">
                {currencyFormat(totalRevenue)}
              </p>
              <p className="mt-[10px] text-[12px] text-ima-text-muted">All time</p>
            </div>

            <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6">
              <p
                className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Profit
              </p>
              <p className="mt-4 text-[28px] md:text-[32px] font-bold tabular-nums tracking-[-0.01em] text-ima-text leading-none">
                {currencyFormat(totalProfit)}
              </p>
              <p className="mt-[10px] text-[12px] text-ima-text-muted">Net</p>
            </div>
          </div>
        </section>

        {/* Referral (shared) */}
        <div
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "200ms" }}
        >
          <ReferralCard />
        </div>
      </div>
    </div>
  );
}
