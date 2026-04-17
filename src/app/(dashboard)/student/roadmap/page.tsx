import { PartyPopper, Route, CheckCircle } from "lucide-react";
import { RoadmapClient } from "@/components/student/RoadmapClient";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

export default async function RoadmapPage() {
  const user = await requireRole("student");
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
    console.error("[roadmap] Failed to fetch progress:", error);
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
        console.error("[roadmap] Failed to add missing roadmap steps:", upsertError);
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
        console.error(`[roadmap] Failed to auto-complete step ${autoStep.step}:`, completeErr);
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
          console.error(`[roadmap] Failed to unlock step ${autoStep.step + 1}:`, unlockErr);
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
    <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-10">
      {/* Editorial header */}
      <section className="space-y-3">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-ima-text leading-none">
          Your Roadmap
        </h1>
        <p className="text-base md:text-lg text-ima-text-secondary">
          {ROADMAP_STEPS.length} steps from beginner to closing your first brand deal
        </p>
      </section>

      {/* Hero row: overall progress (3/5) + current step or completion status (2/5) */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Overall progress — houses the single hero metric */}
        <div
          className="lg:col-span-3 bg-ima-surface border border-ima-border rounded-2xl p-6 md:p-8 flex flex-col justify-between motion-safe:transition-shadow hover:shadow-sm motion-safe:animate-slideUp"
          style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        >
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-ima-text">Overall Progress</h2>
                <p
                  className={cn(
                    "text-xs uppercase tracking-widest font-medium mt-1",
                    allComplete ? "text-ima-success" : "text-ima-primary"
                  )}
                >
                  {completedCount} of {ROADMAP_STEPS.length} steps complete
                </p>
              </div>
              <Route className="h-7 w-7 text-ima-text-muted shrink-0" aria-hidden="true" />
            </div>

            <div className="flex items-end gap-3 mb-4">
              <span
                className={cn(
                  "text-6xl md:text-7xl font-semibold tabular-nums tracking-tight leading-none",
                  allComplete ? "text-ima-success" : "text-ima-primary"
                )}
              >
                {percent}%
              </span>
              {remaining > 0 && (
                <span className="text-sm text-ima-text-muted tabular-nums pb-2">
                  {remaining} remaining
                </span>
              )}
            </div>

            <div
              className="w-full bg-ima-surface-light rounded-full h-2 mb-8 overflow-hidden"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={ROADMAP_STEPS.length}
              aria-label={`${completedCount} of ${ROADMAP_STEPS.length} steps completed`}
            >
              <div
                className={cn(
                  "h-full rounded-full motion-safe:transition-[width] duration-500 ease-out",
                  allComplete ? "bg-ima-success" : "bg-ima-primary"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {stageSummary.map(({ stage, name, done, total }) => {
                const stageDone = done === total;
                const stageStarted = done > 0;
                return (
                  <div
                    key={stage}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
                      stageDone
                        ? "border-ima-success/40 bg-ima-success/10 text-ima-success"
                        : stageStarted
                          ? "border-ima-primary/20 bg-ima-surface-accent text-ima-primary"
                          : "border-ima-border bg-ima-surface-light text-ima-text-secondary"
                    )}
                  >
                    {stageDone && <CheckCircle className="h-3 w-3" aria-hidden="true" />}
                    <span className="uppercase tracking-widest">{name}</span>
                    <span className="tabular-nums opacity-70">{done}/{total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side panel — current step OR completion state */}
        <div
          className="lg:col-span-2 bg-ima-surface border border-ima-border rounded-2xl p-6 md:p-8 flex flex-col justify-between motion-safe:transition-shadow hover:shadow-sm motion-safe:animate-slideUp"
          style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
        >
          {allComplete ? (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-ima-text">Status</h2>
                  <p className="text-xs uppercase tracking-widest font-medium text-ima-success mt-1">
                    Roadmap complete
                  </p>
                </div>
                <PartyPopper className="h-7 w-7 text-ima-success shrink-0" aria-hidden="true" />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-ima-text mb-2 leading-snug">
                Congratulations, {firstName}.
              </p>
              <p className="text-sm text-ima-text-secondary">
                You&apos;ve completed all {ROADMAP_STEPS.length} steps. Keep building on the roster you&apos;ve earned.
              </p>
            </div>
          ) : activeStepConfig ? (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-ima-text">Current Step</h2>
                  <p className="text-xs uppercase tracking-widest font-medium text-ima-text-muted mt-1">
                    {activeStepConfig.stageName}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-ima-primary">
                  {activeStepConfig.step} / {ROADMAP_STEPS.length}
                </span>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-ima-text mb-2 leading-snug">
                {activeStepConfig.title}
              </h3>
              <p className="text-sm text-ima-text-secondary line-clamp-3">
                {activeStepConfig.description}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-ima-text">Status</h2>
                  <p className="text-xs uppercase tracking-widest font-medium text-ima-text-muted mt-1">
                    Ready to begin
                  </p>
                </div>
              </div>
              <p className="text-sm text-ima-text-secondary">
                Your roadmap is set up. Start with step 1 below when you&apos;re ready.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Timeline + Confirm Modal (client component) */}
      <RoadmapClient progress={progress} joinedAt={joinedAt} />
    </div>
  );
}
