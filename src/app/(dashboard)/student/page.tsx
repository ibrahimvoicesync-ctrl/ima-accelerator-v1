import { JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Mail,
  Map as MapIcon,
  Megaphone,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { KPI_TARGETS, ROADMAP_STEPS, WORK_TRACKER } from "@/lib/config";
import { cn, formatHoursMinutes, getToday } from "@/lib/utils";
import {
  dailyHoursRag,
  dailyOutreachRag,
  daysInProgram as computeDaysInProgram,
  lifetimeOutreachRag,
  ragToBgClass,
  ragToColorClass,
  type RagStatus,
} from "@/lib/kpi";
import { ReferralCard } from "@/components/student/ReferralCard";
import { ReferralNudge } from "@/components/student/ReferralNudge";
import type { Database } from "@/lib/types";

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
  reportSubmitted: boolean,
): { label: string; href: string } {
  if (activeSession) return { label: "Continue session", href: "/student/work" };
  if (pausedSession) return { label: "Resume session", href: "/student/work" };
  if (totalMinutesWorked < WORK_TRACKER.dailyGoalHours * 60) {
    return {
      label: `Begin session ${String(completedCount + 1).padStart(2, "0")}`,
      href: "/student/work",
    };
  }
  return {
    label: reportSubmitted ? "Update daily report" : "Submit daily report",
    href: "/student/report",
  };
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
    admin
      .from("daily_reports")
      .select("submitted_at, brands_contacted, influencers_contacted")
      .eq("student_id", user.id)
      .eq("date", today)
      .maybeSingle(),
    admin
      .from("daily_reports")
      .select("brands_contacted, influencers_contacted")
      .eq("student_id", user.id),
    admin.from("users").select("joined_at").eq("id", user.id).single(),
    admin.from("deals").select("revenue, profit").eq("student_id", user.id),
  ]);

  if (sessionsError) console.error("[student dashboard] Failed to load sessions:", sessionsError);
  if (roadmapError) console.error("[student dashboard] Failed to load roadmap:", roadmapError);
  if (reportResult.error) console.error("[student dashboard] Failed to load report:", reportResult.error);
  if (lifetimeResult.error) console.error("[student dashboard] Failed to load lifetime KPIs:", lifetimeResult.error);
  if (userResult.error) console.error("[student dashboard] Failed to load user joined_at:", userResult.error);
  if (dealsError) console.error("[student dashboard] Failed to load deals:", dealsError);

  const todayReport = reportResult.data;
  const reportSubmitted = Boolean(todayReport?.submitted_at);

  const dealsData = deals ?? [];
  const dealsClosed = dealsData.length;
  const totalRevenue = dealsData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalProfit = dealsData.reduce((sum, d) => sum + Number(d.profit), 0);
  const hasDeals = dealsClosed > 0;

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
    reportSubmitted,
  );

  const allReports = lifetimeResult.data ?? [];
  const lifetimeOutreach = allReports.reduce(
    (sum, r) => sum + (r.brands_contacted ?? 0) + (r.influencers_contacted ?? 0),
    0,
  );
  const days = computeDaysInProgram(userResult.data?.joined_at ?? new Date().toISOString());
  const dailyOutreachTotal =
    (todayReport?.brands_contacted ?? 0) + (todayReport?.influencers_contacted ?? 0);

  const lifetimeRag = lifetimeOutreachRag(lifetimeOutreach, days);
  const dailyOutRag = dailyOutreachRag(dailyOutreachTotal, days);
  const hoursRag = dailyHoursRag(totalMinutesWorked, days);

  const lifetimePercent = Math.min(
    100,
    Math.round((lifetimeOutreach / KPI_TARGETS.lifetimeOutreach) * 100),
  );
  const dailyOutreachPercent = Math.min(
    100,
    Math.round((dailyOutreachTotal / KPI_TARGETS.dailyOutreach) * 100),
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-ima-bg`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Masthead */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
            style={MONO}
          >
            Dashboard
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-ima-text tracking-[-0.02em]">
            Assalamu3leikum, {firstName}.
          </h1>
          <p className="mt-2 text-[15px] text-ima-text-secondary leading-[1.5]">
            Here&apos;s how today is tracking.
          </p>
        </header>

        {/* Referral nudge (shared) */}
        <div
          className="mt-9 motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          <ReferralNudge />
        </div>

        {/* Hero — Today's Work */}
        <section
          aria-labelledby="todays-work-label"
          className="motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <p
                id="todays-work-label"
                className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Today&apos;s Work
              </p>
              {goalMet ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-ima-success/10 border border-ima-success/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-ima-success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Goal Reached
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

            <div className="mt-5 flex items-end gap-2">
              <span
                className={cn(
                  "text-[44px] md:text-[52px] font-bold tabular-nums tracking-[-0.02em] leading-none",
                  goalMet ? "text-ima-success" : "text-ima-primary",
                )}
              >
                {formatHoursMinutes(totalMinutesWorked)}
              </span>
              <span className="pb-[6px] text-[15px] font-medium text-ima-text-muted tabular-nums">
                / {WORK_TRACKER.dailyGoalHours}h
              </span>
            </div>

            <div
              className="mt-5 h-[6px] rounded-full bg-ima-surface-light overflow-hidden"
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
          </div>

          <Link
            href={nextAction.href}
            className="group mt-[14px] inline-flex items-center justify-center gap-2 w-full rounded-[10px] bg-ima-primary text-white text-[14px] font-semibold min-h-[48px] px-4 hover:bg-ima-primary-hover focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 motion-safe:transition-colors"
          >
            {nextAction.label}
            <ArrowRight
              className="h-4 w-4 motion-safe:transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </section>

        {/* KPI tracking */}
        <section
          aria-label="KPI tracking"
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
              style={MONO}
            >
              KPI Tracking
            </h2>
            <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
            <KpiCard
              icon={Megaphone}
              iconBg="bg-ima-primary/10"
              iconColor="text-ima-primary"
              label="Lifetime Outreach"
              value={lifetimeOutreach.toLocaleString()}
              target={`Target ${KPI_TARGETS.lifetimeOutreach.toLocaleString()}`}
              percent={lifetimePercent}
              rag={lifetimeRag}
            />
            <KpiCard
              icon={Mail}
              iconBg="bg-ima-warning/10"
              iconColor="text-ima-warning"
              label="Daily Outreach"
              value={String(dailyOutreachTotal)}
              target={`Target ${KPI_TARGETS.dailyOutreach}/day`}
              percent={dailyOutreachPercent}
              rag={dailyOutRag}
            />
            <KpiCard
              icon={Clock}
              iconBg="bg-ima-surface-light"
              iconColor="text-ima-text-secondary"
              label="Hours Today"
              value={formatHoursMinutes(totalMinutesWorked)}
              target={`Target ${WORK_TRACKER.dailyGoalHours}h/day`}
              percent={progressBarWidth}
              rag={hoursRag}
            />
          </div>
        </section>

        {/* Deals */}
        <section
          aria-label="Deals summary"
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
              style={MONO}
            >
              Deals
            </h2>
            <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
            <StatCard
              icon={Briefcase}
              iconBg="bg-ima-warning/10"
              iconColor="text-ima-warning"
              label="Deals Closed"
              value={String(dealsClosed)}
              valueColor="text-ima-warning"
              caption={hasDeals ? "All time" : "None yet"}
            />
            <StatCard
              icon={DollarSign}
              iconBg="bg-ima-primary/10"
              iconColor="text-ima-primary"
              label="Total Revenue"
              value={currencyFormat(totalRevenue)}
              valueColor="text-ima-primary"
              caption={`From ${dealsClosed} deal${dealsClosed !== 1 ? "s" : ""}`}
            />
            <StatCard
              icon={TrendingUp}
              iconBg="bg-ima-success/10"
              iconColor="text-ima-success"
              label="Total Profit"
              value={currencyFormat(totalProfit)}
              valueColor="text-ima-success"
              caption={hasDeals ? "All time" : "None yet"}
            />
          </div>
        </section>

        {/* Roadmap + Daily Report */}
        <section
          aria-label="Roadmap and daily report"
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "250ms" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {/* Roadmap */}
            <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[8px] bg-ima-primary/10 flex items-center justify-center shrink-0">
                    <MapIcon className="h-[18px] w-[18px] text-ima-primary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ima-text leading-tight">
                      Roadmap
                    </p>
                    <p className="mt-[3px] text-[12px] text-ima-text-muted">
                      {allRoadmapDone
                        ? "All steps completed"
                        : activeRoadmapStep
                          ? `Currently on step ${activeRoadmapStep.step_number}`
                          : "Start your journey"}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[12px] font-semibold tabular-nums text-ima-text shrink-0"
                  style={MONO}
                >
                  {roadmapCompleted}/{ROADMAP_STEPS.length}
                </span>
              </div>

              <div
                className="mt-5 h-[6px] rounded-full bg-ima-surface-light overflow-hidden"
                role="progressbar"
                aria-valuenow={roadmapCompleted}
                aria-valuemin={0}
                aria-valuemax={ROADMAP_STEPS.length}
                aria-label={`Roadmap progress: ${roadmapCompleted} of ${ROADMAP_STEPS.length}`}
              >
                <div
                  className={cn(
                    "h-full rounded-full motion-safe:transition-[width] duration-700 ease-out",
                    allRoadmapDone ? "bg-ima-success" : "bg-ima-primary",
                  )}
                  style={{ width: `${roadmapPercent}%` }}
                />
              </div>

              <Link
                href="/student/roadmap"
                aria-label={
                  allRoadmapDone
                    ? "View roadmap"
                    : activeRoadmapStep
                      ? `Continue step ${activeRoadmapStep.step_number}`
                      : "View roadmap"
                }
                className="group mt-auto pt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ima-primary hover:text-ima-primary-hover min-h-[44px] focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 rounded-md"
              >
                {allRoadmapDone
                  ? "View roadmap"
                  : activeRoadmapStep
                    ? `Continue step ${activeRoadmapStep.step_number}`
                    : "View roadmap"}
                <ArrowRight
                  className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>

            {/* Daily Report */}
            <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-[8px] bg-ima-surface-light flex items-center justify-center shrink-0">
                    <FileText className="h-[18px] w-[18px] text-ima-text-secondary" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ima-text leading-tight">
                      Daily Report
                    </p>
                    <p className="mt-[3px] text-[12px] text-ima-text-muted">
                      {reportSubmitted
                        ? "Submitted — you can still update it."
                        : "Close today's loop before 11 PM."}
                    </p>
                  </div>
                </div>
                {reportSubmitted ? (
                  <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-ima-success/10 border border-ima-success/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-ima-success shrink-0">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Submitted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-ima-warning/10 border border-ima-warning/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-ima-warning shrink-0">
                    <span
                      className="inline-block h-[6px] w-[6px] rounded-full bg-ima-warning"
                      aria-hidden="true"
                    />
                    Pending
                  </span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span
                  className="text-[10px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
                  style={MONO}
                >
                  Due
                </span>
                <span className="text-[13px] font-semibold tabular-nums text-ima-text">
                  11:00 PM
                </span>
              </div>

              <Link
                href="/student/report"
                aria-label={reportSubmitted ? "Update report" : "Submit report"}
                className="group mt-auto pt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ima-primary hover:text-ima-primary-hover min-h-[44px] focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 rounded-md"
              >
                {reportSubmitted ? "Update report" : "Submit report"}
                <ArrowRight
                  className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* Referral (shared) */}
        <div
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "300ms" }}
        >
          <ReferralCard />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  target,
  percent,
  rag,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  target: string;
  percent: number;
  rag: RagStatus;
}) {
  return (
    <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0",
              iconBg,
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", iconColor)} aria-hidden="true" />
          </div>
          <p
            className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
            style={MONO}
          >
            {label}
          </p>
        </div>
        <span
          className={cn("inline-block h-[8px] w-[8px] rounded-full shrink-0", ragToBgClass(rag))}
          aria-hidden="true"
        />
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "text-[28px] md:text-[32px] font-bold tabular-nums leading-none",
            ragToColorClass(rag),
          )}
        >
          {value}
        </p>
        <p
          className="text-[11px] font-semibold tabular-nums text-ima-text-muted"
          style={MONO}
        >
          {percent}%
        </p>
      </div>

      <p className="mt-[10px] text-[12px] text-ima-text-muted">{target}</p>

      <div
        className="mt-4 h-[4px] rounded-full bg-ima-surface-light overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}%`}
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] duration-700 ease-out",
            ragToBgClass(rag),
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  valueColor,
  caption,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
  caption: string;
}) {
  return (
    <div className="bg-ima-surface border border-ima-border rounded-[14px] p-6">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0",
            iconBg,
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", iconColor)} aria-hidden="true" />
        </div>
        <p
          className="text-[11px] font-semibold tracking-[0.18em] text-ima-text-muted uppercase"
          style={MONO}
        >
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-5 text-[28px] md:text-[32px] font-bold tabular-nums leading-none",
          valueColor,
        )}
      >
        {value}
      </p>
      <p className="mt-[10px] text-[12px] text-ima-text-muted">{caption}</p>
    </div>
  );
}
