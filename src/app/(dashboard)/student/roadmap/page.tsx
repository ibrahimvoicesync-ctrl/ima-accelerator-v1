import { PartyPopper, Map, CheckCircle } from "lucide-react";
import { RoadmapClient } from "@/components/student/RoadmapClient";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROADMAP_STEPS } from "@/lib/config";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

export default async function RoadmapPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  // Fetch roadmap progress
  const { data: progressData, error } = await admin
    .from("roadmap_progress")
    .select("*")
    .eq("student_id", user.id)
    .order("step_number", { ascending: true });

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
      await admin
        .from("roadmap_progress")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("student_id", user.id)
        .eq("step_number", autoStep.step);

      // Unlock the next step if it exists and is still locked
      const nextRow = progress.find((p) => p.step_number === autoStep.step + 1);
      if (nextRow && nextRow.status === "locked") {
        await admin
          .from("roadmap_progress")
          .update({ status: "active" })
          .eq("student_id", user.id)
          .eq("step_number", autoStep.step + 1);
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

  return (
    <div className="px-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ima-text">Your Roadmap</h1>
        <p className="mt-1 text-ima-text-secondary">{`${ROADMAP_STEPS.length} steps from beginner to closing your first brand deal`}</p>
      </div>

      {/* Progress overview card */}
      <div
        className="bg-ima-surface border border-ima-border rounded-xl p-5 motion-safe:animate-slideUp"
        style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-ima-success/10 shrink-0">
            <Map className="h-7 w-7 text-ima-success" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ima-text">{completedCount} of {ROADMAP_STEPS.length} steps completed</p>
              <span className="text-sm font-bold text-ima-warning">{percent}%</span>
            </div>
            <div
              className="h-3 bg-ima-border rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={ROADMAP_STEPS.length}
              aria-label={`${completedCount} of ${ROADMAP_STEPS.length} steps completed`}
            >
              <div
                className="h-full bg-ima-success rounded-full motion-safe:transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex gap-3 text-xs text-ima-text-secondary">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-ima-success" aria-hidden="true" />
                {completedCount} done
              </span>
              <span>{ROADMAP_STEPS.length - completedCount} remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* All-complete celebration */}
      {allComplete && (
        <div className="bg-ima-surface border border-ima-border border-l-4 border-l-ima-success rounded-xl p-5 motion-safe:animate-scaleIn">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-ima-warning/10 shrink-0">
              <PartyPopper className="h-6 w-6 text-ima-warning" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ima-text">Congratulations!</h2>
              <p className="text-sm text-ima-text-secondary">You&apos;ve completed the entire roadmap!</p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline + Confirm Modal (client component) */}
      <RoadmapClient progress={progress} />
    </div>
  );
}
