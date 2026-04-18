"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, RotateCcw, Route } from "lucide-react";
import { ROADMAP_STEPS } from "@/lib/config";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getDeadlineStatus } from "@/lib/roadmap-utils";

type RoadmapProgressRow = {
  step_number: number;
  status: "locked" | "active" | "completed";
  completed_at: string | null;
};

interface RoadmapTabProps {
  roadmap: RoadmapProgressRow[];
  joinedAt: string;
  studentId: string;
}

export function RoadmapTab({ roadmap, joinedAt, studentId }: RoadmapTabProps) {
  const routerRef = useRef(useRouter());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [confirmStep, setConfirmStep] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);

  const handleUndo = useCallback(async () => {
    if (confirmStep === null) return;
    setUndoing(true);
    try {
      const res = await fetch("/api/roadmap/undo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, step_number: confirmStep }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toastRef.current({
          type: "error",
          title: (err as { error?: string }).error ?? "Failed to undo step",
        });
      } else {
        const json = await res.json();
        const cascade = json?.data?.cascade === true;
        const cascadeCount = json?.data?.cascadeCount ?? 0;
        const stepTitle =
          ROADMAP_STEPS.find((s) => s.step === confirmStep)?.title ?? `Step ${confirmStep}`;
        toastRef.current({
          type: "success",
          title: cascade
            ? `Step ${confirmStep} reset to active, ${cascadeCount} subsequent step${cascadeCount > 1 ? "s" : ""} re-locked`
            : `Step ${confirmStep}: "${stepTitle}" reset to active`,
        });
        routerRef.current.refresh();
      }
    } catch {
      toastRef.current({ type: "error", title: "Failed to undo step" });
    } finally {
      setUndoing(false);
      setConfirmStep(null);
    }
  }, [confirmStep, studentId]);

  if (roadmap.length === 0) {
    return (
      <div role="tabpanel" id="tabpanel-roadmap" aria-labelledby="tab-roadmap">
        <div className="bg-white border border-[#EDE9E0] rounded-[14px] p-6">
          <EmptyState
            variant="compact"
            icon={<Route className="h-5 w-5" />}
            title="No roadmap progress yet"
            description="This student hasn't started their roadmap."
          />
        </div>
      </div>
    );
  }

  const completedCount = roadmap.filter((r) => r.status === "completed").length;
  const totalSteps = ROADMAP_STEPS.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  const rowMap = new Map(roadmap.map((r) => [r.step_number, r]));

  const stages = [
    ...new Map(ROADMAP_STEPS.map((s) => [s.stage, s.stageName])).entries(),
  ].map(([stage, stageName]) => ({ stage, stageName }));

  const activeStep = roadmap.find((r) => r.status === "active")?.step_number ?? null;

  return (
    <div
      role="tabpanel"
      id="tabpanel-roadmap"
      aria-labelledby="tab-roadmap"
      className="space-y-6"
    >
      {/* Progress hero card */}
      <section
        aria-label="Roadmap progress"
        className="bg-white border border-[#EDE9E0] rounded-[14px] p-5 md:p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              Roadmap Progress
            </p>
            <p className="mt-3 flex items-baseline gap-2 leading-none">
              <span className="text-[44px] md:text-[52px] font-bold tabular-nums tracking-[-0.02em] text-[#4A6CF7]">
                {completedCount}
              </span>
              <span
                className="text-[18px] md:text-[20px] font-semibold tabular-nums text-[#8A8474]"
                style={{ fontFamily: "var(--font-mono-bold)" }}
              >
                / {totalSteps}
              </span>
            </p>
            <p
              className="mt-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-[#8A8474]"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              Steps Completed
            </p>
          </div>
          <div className="sm:text-right shrink-0">
            <p
              className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8A8474]"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              Active Step
            </p>
            <p className="mt-2 text-[15px] font-semibold text-[#1A1A17] tabular-nums">
              {activeStep !== null ? `Step ${String(activeStep).padStart(2, "0")}` : "—"}
            </p>
            <p className="mt-[2px] text-[12px] text-[#7A7466] max-w-[260px] sm:ml-auto truncate">
              {activeStep !== null
                ? ROADMAP_STEPS.find((s) => s.step === activeStep)?.title
                : "All caught up"}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div
            className="h-[6px] bg-[#F1EEE6] rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalSteps}
            aria-label={`Roadmap progress: ${completedCount} of ${totalSteps} steps completed`}
          >
            <div
              className="h-full bg-[#4A6CF7] motion-safe:transition-all motion-safe:duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span
              className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#8A8474]"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              Overall
            </span>
            <span
              className="text-[11px] font-semibold tabular-nums text-[#1A1A17]"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              {progressPct}%
            </span>
          </div>
        </div>
      </section>

      {/* Stages */}
      <div className="space-y-8">
        {stages.map(({ stage, stageName }, idx) => {
          const stageSteps = ROADMAP_STEPS.filter((s) => s.stage === stage);
          const stageCompleted = stageSteps.filter(
            (s) => rowMap.get(s.step)?.status === "completed",
          ).length;

          return (
            <section key={stage} aria-label={`Stage ${stage}: ${stageName}`}>
              {/* Stage header */}
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#8A8474] tabular-nums"
                  style={{ fontFamily: "var(--font-mono-bold)" }}
                >
                  Stage {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#1A1A17]"
                  style={{ fontFamily: "var(--font-mono-bold)" }}
                >
                  {stageName}
                </span>
                <div className="flex-1 h-px bg-[#EDE9E0]" aria-hidden="true" />
                <span
                  className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#8A8474] tabular-nums"
                  style={{ fontFamily: "var(--font-mono-bold)" }}
                >
                  {stageCompleted}/{stageSteps.length}
                </span>
              </div>

              {/* Steps */}
              <ul className="mt-4 space-y-[10px]" role="list">
                {stageSteps.map((step) => {
                  const row = rowMap.get(step.step);
                  const status = row?.status ?? "locked";
                  const completedAt = row?.completed_at ?? null;
                  const ds = getDeadlineStatus(
                    step.target_days,
                    joinedAt,
                    status,
                    completedAt,
                  );

                  const isActive = status === "active";
                  const isCompleted = status === "completed";

                  return (
                    <li
                      key={step.step}
                      className={[
                        "bg-white border rounded-[14px] p-4 md:p-5 flex items-start gap-4 motion-safe:transition-colors",
                        isActive
                          ? "border-[#EDE9E0] ring-1 ring-[#4A6CF7]/40"
                          : "border-[#EDE9E0]",
                      ].join(" ")}
                    >
                      {/* Marker */}
                      <div className="shrink-0 mt-[2px]">
                        {isCompleted ? (
                          <span
                            className="w-9 h-9 rounded-full bg-[#4A6CF7] flex items-center justify-center"
                            aria-label="Completed"
                          >
                            <Check
                              className="h-[18px] w-[18px] text-white"
                              aria-hidden="true"
                              strokeWidth={3}
                            />
                          </span>
                        ) : isActive ? (
                          <span
                            className="w-9 h-9 rounded-full border-[2px] border-[#4A6CF7] bg-white flex items-center justify-center"
                            aria-label="In progress"
                          >
                            <span
                              className="w-[10px] h-[10px] rounded-full bg-[#4A6CF7]"
                              aria-hidden="true"
                            />
                          </span>
                        ) : (
                          <span
                            className="w-9 h-9 rounded-full bg-[#F1EEE6] border border-[#EDE9E0] flex items-center justify-center"
                            aria-label="Locked"
                          >
                            <Lock
                              className="h-[14px] w-[14px] text-[#8A8474]"
                              aria-hidden="true"
                            />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span
                            className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8A8474] tabular-nums"
                            style={{ fontFamily: "var(--font-mono-bold)" }}
                          >
                            Step {String(step.step).padStart(2, "0")}
                          </span>
                          <p
                            className={[
                              "text-[15px] font-bold leading-tight tracking-[-0.01em]",
                              isCompleted
                                ? "text-[#1A1A17]"
                                : isActive
                                  ? "text-[#1A1A17]"
                                  : "text-[#8A8474]",
                            ].join(" ")}
                          >
                            {step.title}
                          </p>
                        </div>
                        <p className="mt-[6px] text-[13px] text-[#7A7466] leading-[1.5]">
                          {step.description}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {ds.kind === "completed" && (
                            <span className="inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#E2F5E9] border-[#BBE5CA] text-[#16A34A]">
                              Completed{" "}
                              {new Date(ds.completedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              })}
                              {ds.daysLate !== null && (
                                <span className="ml-1 opacity-80">({ds.daysLate}d late)</span>
                              )}
                            </span>
                          )}
                          {ds.kind === "on-track" && (
                            <span className="inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#E2F5E9] border-[#BBE5CA] text-[#16A34A]">
                              On Track — {ds.deadlineLabel}
                            </span>
                          )}
                          {ds.kind === "due-soon" && (
                            <span className="inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#FDF3E0] border-[#F0DFB3] text-[#9A6B1F]">
                              Due Soon — {ds.deadlineLabel}
                            </span>
                          )}
                          {ds.kind === "overdue" && (
                            <span className="inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] bg-[#FDEAEA] border-[#F5C6C6] text-[#DC2626]">
                              Overdue — {ds.daysOverdue}d
                            </span>
                          )}

                          {isCompleted && (
                            <button
                              onClick={() => setConfirmStep(step.step)}
                              className="inline-flex items-center gap-[4px] text-[11px] font-semibold tracking-[0.08em] uppercase text-[#7A7466] hover:text-[#4A6CF7] motion-safe:transition-colors min-h-[44px] px-2 focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2 rounded-md ml-auto"
                              style={{ fontFamily: "var(--font-mono-bold)" }}
                              aria-label={`Undo Step ${step.step}: ${step.title}`}
                            >
                              <RotateCcw className="h-[13px] w-[13px]" aria-hidden="true" />
                              Undo
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Undo confirmation modal */}
      {(() => {
        const stepConfig =
          confirmStep !== null
            ? ROADMAP_STEPS.find((s) => s.step === confirmStep)
            : null;
        const laterSteps =
          confirmStep !== null
            ? roadmap.filter(
                (r) =>
                  r.step_number > confirmStep &&
                  (r.status === "active" || r.status === "completed"),
              )
            : [];

        const dialogDescription =
          laterSteps.length > 0
            ? `Are you sure you want to reset Step ${confirmStep}: "${stepConfig?.title}" back to active? ${laterSteps.length} subsequent step${laterSteps.length > 1 ? "s" : ""} will also be re-locked.`
            : `Are you sure you want to reset Step ${confirmStep}: "${stepConfig?.title}" back to active?`;

        return (
          <Modal
            open={confirmStep !== null}
            onClose={() => {
              if (!undoing) setConfirmStep(null);
            }}
            title="Undo Step?"
            description={dialogDescription}
          >
            <div className="flex gap-3 mt-4">
              <Button variant="danger" loading={undoing} onClick={handleUndo}>
                Reset to Active
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmStep(null)}
                disabled={undoing}
              >
                Cancel
              </Button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
