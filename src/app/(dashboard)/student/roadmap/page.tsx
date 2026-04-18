import { CheckCircle, PartyPopper } from "lucide-react";
import { JetBrains_Mono } from "next/font/google";
import { RoadmapClient } from "@/components/student/RoadmapClient";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono-bold)" };

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

export default async function RoadmapPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const [progressResult, userResult] = await Promise.all([
    admin
      .from("roadmap_progress")
      .select("*")
      .eq("student_id", user.id)
      .order("step_number", { ascending: true }),
    admin
      .from("users")
      .select("joined_at")
      .eq("id", user.id)
      .single(),
  ]);

  const { data: progressData, error } = progressResult;
  const joinedAt = userResult.data?.joined_at ?? new Date().toISOString();

  if (error) {
    console.error("[roadmap] Failed to fetch progress:", error);
  }

  let progress: RoadmapProgress[] = progressData ?? [];

  if (!error && progress.length < ROADMAP_STEPS.length) {
    const existingSteps = new Set(progress.map((p) => p.step_number));
    const missingSteps = ROADMAP_STEPS.filter((s) => !existingSteps.has(s.step));

    if (missingSteps.length > 0) {
      const rows = missingSteps.map((step) => ({
        student_id: user.id,
        step_number: step.step,
        step_name: step.title,
        status: "locked" as const,
        completed_at: null,
      }));

      const { error: upsertError } = await admin
        .from("roadmap_progress")
        .upsert(rows, { onConflict: "student_id,step_number", ignoreDuplicates: true });

      if (upsertError) {
        console.error("[roadmap] Failed to add missing roadmap steps:", upsertError);
      }

      const { data: newProgress } = await admin
        .from("roadmap_progress")
        .select("*")
        .eq("student_id", user.id)
        .order("step_number", { ascending: true });

      progress = newProgress ?? [];
    }
  }

  const autoSteps = ROADMAP_STEPS.filter(
    (s): s is (typeof ROADMAP_STEPS)[number] & { autoComplete: true } =>
      "autoComplete" in s && s.autoComplete === true
  );
  for (const autoStep of autoSteps) {
    const row = progress.find((p) => p.step_number === autoStep.step);
    if (row && (row.status === "locked" || row.status === "active")) {
      const { error: completeErr } = await admin
        .from("roadmap_progress")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("student_id", user.id)
        .eq("step_number", autoStep.step);

      if (completeErr) {
        console.error(`[roadmap] Failed to auto-complete step ${autoStep.step}:`, completeErr);
      }

      const nextRow = progress.find((p) => p.step_number === autoStep.step + 1);
      if (nextRow && nextRow.status === "locked") {
        const { error: unlockErr } = await admin
          .from("roadmap_progress")
          .update({ status: "active" })
          .eq("student_id", user.id)
          .eq("step_number", autoStep.step + 1);

        if (unlockErr) {
          console.error(`[roadmap] Failed to unlock step ${autoStep.step + 1}:`, unlockErr);
        }
      }

      const { data: updatedProgress } = await admin
        .from("roadmap_progress")
        .select("*")
        .eq("student_id", user.id)
        .order("step_number", { ascending: true });

      progress = updatedProgress ?? [];
    }
  }

  const completedCount = progress.filter((p) => p.status === "completed").length;
  const allComplete = completedCount === ROADMAP_STEPS.length;
  const percent = Math.round((completedCount / ROADMAP_STEPS.length) * 100);
  const remaining = ROADMAP_STEPS.length - completedCount;
  const firstName = user.name.split(" ")[0];

  const activeRow = progress.find((p) => p.status === "active");
  const activeStepConfig = activeRow
    ? ROADMAP_STEPS.find((s) => s.step === activeRow.step_number)
    : undefined;

  const stageSummary = Array.from(
    ROADMAP_STEPS.reduce((map, s) => {
      const entry = map.get(s.stage) ?? { name: s.stageName, total: 0, done: 0 };
      entry.total += 1;
      const row = progress.find((p) => p.step_number === s.step);
      if (row?.status === "completed") entry.done += 1;
      map.set(s.stage, entry);
      return map;
    }, new Map<number, { name: string; total: number; done: number }>()).entries()
  ).map(([stage, info]) => ({ stage, ...info }));

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
            Roadmap
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-ima-text tracking-[-0.02em]">
            Your Roadmap
          </h1>
          <p className="mt-2 text-[15px] text-ima-text-secondary leading-[1.5]">
            {ROADMAP_STEPS.length} steps from beginner to closing your first brand deal.
          </p>
        </header>

        {/* Hero row — progress (3) + current step (2) */}
        <section
          aria-label="Roadmap progress"
          className="mt-9 grid grid-cols-1 lg:grid-cols-5 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          {/* Overall progress — hero metric */}
          <div className="lg:col-span-3 bg-ima-surface border border-ima-border rounded-[14px] p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-[11px] font-semibold tracking-[0.22em] text-ima-text-muted uppercase"
                style={MONO}
              >
                Overall Progress
              </p>
              {allComplete ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full bg-ima-success/10 border border-ima-success/30 text-[10px] font-semibold uppercase tracking-[0.08em] text-ima-success">
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />
                  Roadmap Complete
                </span>
              ) : (
                <span
                  className="text-[10px] font-semibold tracking-[0.14em] text-ima-text-muted uppercase tabular-nums"
                  style={MONO}
                >
                  {remaining} Remaining
                </span>
              )}
            </div>

            <div className="mt-5 flex items-end gap-3">
              <span
                className={cn(
                  "text-[44px] md:text-[52px] font-bold tabular-nums tracking-[-0.02em] leading-none",
                  allComplete ? "text-ima-success" : "text-ima-primary",
                )}
              >
                {percent}
                <span className="text-[26px] md:text-[30px] text-ima-text-muted font-semibold">%</span>
              </span>
              <span className="pb-[6px] text-[13px] text-ima-text-muted tabular-nums">
                {completedCount} / {ROADMAP_STEPS.length} steps
              </span>
            </div>

            <div
              className="mt-5 h-[6px] rounded-full bg-ima-surface-light overflow-hidden"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={ROADMAP_STEPS.length}
              aria-label={`${completedCount} of ${ROADMAP_STEPS.length} steps completed`}
            >
              <div
                className={cn(
                  "h-full rounded-full motion-safe:transition-[width] duration-700 ease-out",
                  allComplete ? "bg-ima-success" : "bg-ima-primary",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {stageSummary.map(({ stage, name, done, total }) => {
                const stageDone = done === total;
                const stageStarted = done > 0;
                return (
                  <div
                    key={stage}
                    className={cn(
                      "inline-flex items-center gap-2 pl-2.5 pr-3 py-1 rounded-full text-[10px] font-semibold border",
                      stageDone
                        ? "bg-ima-success/10 text-ima-success border-ima-success/30"
                        : stageStarted
                          ? "bg-ima-primary/10 text-ima-primary border-ima-primary/30"
                          : "bg-ima-surface-light text-ima-text-muted border-ima-border",
                    )}
                    style={MONO}
                  >
                    {stageDone ? (
                      <CheckCircle className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <span
                        className={cn(
                          "h-[6px] w-[6px] rounded-full",
                          stageStarted ? "bg-ima-primary" : "bg-ima-text-muted/50",
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <span className="uppercase tracking-[0.16em]">{name}</span>
                    <span className="tabular-nums opacity-80">
                      {done}/{total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side — current step / completion */}
          <aside className="lg:col-span-2 bg-ima-surface border border-ima-border rounded-[14px] p-6 md:p-8 flex flex-col">
            {allComplete ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-[11px] font-semibold tracking-[0.22em] text-ima-success uppercase"
                    style={MONO}
                  >
                    Status
                  </p>
                  <PartyPopper className="h-[18px] w-[18px] text-ima-success" aria-hidden="true" />
                </div>
                <p className="mt-5 text-[22px] md:text-[24px] font-bold tracking-[-0.01em] text-ima-text leading-tight">
                  Congratulations, {firstName}.
                </p>
                <p className="mt-3 text-[14px] text-ima-text-secondary leading-relaxed">
                  You&apos;ve completed all {ROADMAP_STEPS.length} steps. Keep building on the roster you&apos;ve earned.
                </p>
              </>
            ) : activeStepConfig ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-[11px] font-semibold tracking-[0.22em] text-ima-primary uppercase"
                    style={MONO}
                  >
                    Current Step
                  </p>
                  <span
                    className="text-[11px] font-semibold tabular-nums text-ima-text-muted"
                    style={MONO}
                  >
                    {String(activeStepConfig.step).padStart(2, "0")} / {String(ROADMAP_STEPS.length).padStart(2, "0")}
                  </span>
                </div>
                <p
                  className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ima-text-muted"
                  style={MONO}
                >
                  {activeStepConfig.stageName}
                </p>
                <h2 className="mt-2 text-[22px] md:text-[24px] font-bold tracking-[-0.01em] text-ima-text leading-tight">
                  {activeStepConfig.title}
                </h2>
                <p className="mt-3 text-[14px] text-ima-text-secondary line-clamp-3 leading-relaxed">
                  {activeStepConfig.description}
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-[11px] font-semibold tracking-[0.22em] text-ima-primary uppercase"
                  style={MONO}
                >
                  Status
                </p>
                <p className="mt-5 text-[22px] md:text-[24px] font-bold tracking-[-0.01em] text-ima-text leading-tight">
                  Ready to begin.
                </p>
                <p className="mt-3 text-[14px] text-ima-text-secondary leading-relaxed">
                  Your roadmap is set up. Start with step 1 below when you&apos;re ready.
                </p>
              </>
            )}
          </aside>
        </section>

        {/* Timeline (shared client) */}
        <section
          aria-label="Roadmap timeline"
          className="mt-10 motion-safe:animate-fadeIn"
          style={{ animationDelay: "150ms" }}
        >
          <RoadmapClient progress={progress} joinedAt={joinedAt} />
        </section>
      </div>
    </div>
  );
}
