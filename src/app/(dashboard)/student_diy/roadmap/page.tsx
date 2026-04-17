import { CheckCircle } from "lucide-react";
import { RoadmapClient } from "@/components/student/RoadmapClient";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

export default async function StudentDiyRoadmapPage() {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();

  // Fetch roadmap progress and user joined_at in parallel
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
    console.error("[student_diy roadmap] Failed to fetch progress:", error);
  }

  let progress: RoadmapProgress[] = progressData ?? [];

  // Lazy seeding: if fewer rows than expected, add only the missing steps (additive, never destructive)
  // Skip if initial fetch failed
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
        console.error("[student_diy roadmap] Failed to add missing roadmap steps:", upsertError);
      }

      // Re-fetch after adding missing steps
      const { data: newProgress } = await admin
        .from("roadmap_progress")
        .select("*")
        .eq("student_id", user.id)
        .order("step_number", { ascending: true });

      progress = newProgress ?? [];
    }
  }

  // Auto-complete steps marked autoComplete in config (e.g., step 1 "Join the Course")
  // and ensure the next step is active so the student can progress
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
        console.error(`[student_diy roadmap] Failed to auto-complete step ${autoStep.step}:`, completeErr);
      }

      // Unlock the next step if it exists and is still locked
      const nextRow = progress.find((p) => p.step_number === autoStep.step + 1);
      if (nextRow && nextRow.status === "locked") {
        const { error: unlockErr } = await admin
          .from("roadmap_progress")
          .update({ status: "active" })
          .eq("student_id", user.id)
          .eq("step_number", autoStep.step + 1);

        if (unlockErr) {
          console.error(`[student_diy roadmap] Failed to unlock step ${autoStep.step + 1}:`, unlockErr);
        }
      }

      // Re-fetch to reflect changes
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
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      {/* Editorial-restrained header */}
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
          Roadmap
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ima-text leading-[0.95]">
          Your roadmap.
        </h1>
        <p className="mt-3 text-sm md:text-base text-ima-text-secondary max-w-2xl">
          {ROADMAP_STEPS.length} steps from beginner to closing your first brand deal.
        </p>
      </header>

      {/* Hero row — overall progress (monumental) + current step (supporting). */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 mb-10">
        {/* Overall progress — this is the hero metric, single focal point */}
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <span className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
              Overall progress
            </span>
            {allComplete ? (
              <span className="inline-flex items-center gap-1.5 bg-ima-success/10 text-ima-success rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-ima-success" aria-hidden="true" />
                Roadmap complete
              </span>
            ) : (
              <span className="text-xs uppercase tracking-[0.18em] font-medium text-ima-text-muted tabular-nums">
                {remaining} remaining
              </span>
            )}
          </div>

          <div className="flex items-end gap-3 mb-6">
            <span
              className={cn(
                "text-7xl md:text-8xl font-semibold tabular-nums tracking-tight leading-[0.95]",
                allComplete ? "text-ima-success" : "text-ima-primary",
              )}
            >
              {percent}
              <span className="text-3xl md:text-4xl text-ima-text-muted">%</span>
            </span>
            <span className="text-sm text-ima-text-muted tabular-nums mb-2">
              {completedCount} / {ROADMAP_STEPS.length} steps
            </span>
          </div>

          <div
            className="bg-ima-surface-light rounded-full h-2.5 overflow-hidden mb-6"
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

          {/* Stage ledger — restrained pills, monochrome, tabular */}
          <div className="flex flex-wrap gap-1.5">
            {stageSummary.map(({ stage, name, done, total }) => {
              const stageDone = done === total;
              const stageStarted = done > 0;
              return (
                <div
                  key={stage}
                  className={cn(
                    "inline-flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-[10px] font-semibold border",
                    stageDone
                      ? "bg-ima-success/10 text-ima-success border-ima-success/20"
                      : stageStarted
                        ? "bg-ima-surface-accent text-ima-primary border-ima-primary/20"
                        : "bg-ima-bg/60 text-ima-text-muted border-ima-border",
                  )}
                >
                  {stageDone ? (
                    <CheckCircle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        stageStarted ? "bg-ima-primary" : "bg-ima-text-muted/50",
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <span className="uppercase tracking-[0.18em]">{name}</span>
                  <span className="tabular-nums opacity-80">{done}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel — current step / completion / ready state. Bordered surface, no pastel. */}
        <aside className="lg:col-span-2 rounded-2xl border border-ima-border bg-ima-bg/60 p-6 md:p-7">
          {allComplete ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-success mb-4">
                Status
              </p>
              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text leading-tight mb-3">
                Congratulations, {firstName}.
              </p>
              <p className="text-sm text-ima-text-secondary leading-relaxed">
                You&apos;ve completed all {ROADMAP_STEPS.length} steps. Keep building on the roster you&apos;ve earned.
              </p>
            </div>
          ) : activeStepConfig ? (
            <div>
              <div className="flex items-baseline justify-between mb-4 gap-3">
                <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-primary">
                  Current step
                </p>
                <span className="text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums text-ima-text-muted">
                  {String(activeStepConfig.step).padStart(2, "0")} / {String(ROADMAP_STEPS.length).padStart(2, "0")}
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-ima-text-muted mb-2">
                {activeStepConfig.stageName}
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text leading-tight mb-3">
                {activeStepConfig.title}
              </h2>
              <p className="text-sm text-ima-text-secondary line-clamp-3 leading-relaxed">
                {activeStepConfig.description}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-ima-primary mb-4">
                Status
              </p>
              <p className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text leading-tight mb-3">
                Ready to begin.
              </p>
              <p className="text-sm text-ima-text-secondary leading-relaxed">
                Your roadmap is set up. Start with step 1 below when you&apos;re ready.
              </p>
            </div>
          )}
        </aside>
      </section>

      {/* Timeline + Confirm Modal (client component) — editorial-restrained internally, shared with student */}
      <RoadmapClient progress={progress} joinedAt={joinedAt} />
    </div>
  );
}
