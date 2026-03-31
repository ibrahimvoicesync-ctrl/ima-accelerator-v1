"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Circle, Route, Calendar, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROADMAP_STEPS } from "@/lib/config";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getDeadlineStatus } from "@/lib/roadmap-utils";

type RoadmapProgressRow = { step_number: number; status: "locked" | "active" | "completed"; completed_at: string | null };

interface RoadmapTabProps {
  roadmap: RoadmapProgressRow[];
  joinedAt: string;
  studentId: string;
}

export function RoadmapTab({ roadmap, joinedAt, studentId }: RoadmapTabProps) {
  const routerRef = useRef(useRouter());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

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
        toastRef.current({ type: "error", title: (err as { error?: string }).error ?? "Failed to undo step" });
      } else {
        const json = await res.json();
        const cascade = json?.data?.cascade === true;
        const stepTitle = ROADMAP_STEPS.find(s => s.step === confirmStep)?.title ?? `Step ${confirmStep}`;
        const nextTitle = ROADMAP_STEPS.find(s => s.step === confirmStep + 1)?.title;
        toastRef.current({
          type: "success",
          title: cascade && nextTitle
            ? `Step ${confirmStep} reset to active, Step ${confirmStep + 1} re-locked`
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
        <EmptyState
          variant="compact"
          icon={<Route className="h-5 w-5" />}
          title="No roadmap progress yet"
          description="This student hasn't started their roadmap."
        />
      </div>
    );
  }

  const completedCount = roadmap.filter((r) => r.status === "completed").length;
  const progressPct = Math.round((completedCount / ROADMAP_STEPS.length) * 100);

  // Build lookup for full row (status + completed_at)
  const rowMap = new Map(roadmap.map((r) => [r.step_number, r]));

  const stages = [...new Map(
    ROADMAP_STEPS.map(s => [s.stage, s.stageName])
  ).entries()].map(([stage, stageName]) => ({ stage, stageName }));

  return (
    <div role="tabpanel" id="tabpanel-roadmap" aria-labelledby="tab-roadmap" className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-ima-text-secondary">Overall Progress</span>
          <span className="text-sm font-medium text-ima-text">{completedCount}/{ROADMAP_STEPS.length} steps</span>
        </div>
        <div
          className="h-3 bg-ima-surface rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={ROADMAP_STEPS.length}
          aria-label={`Roadmap progress: ${completedCount} of ${ROADMAP_STEPS.length} steps completed`}
        >
          <div
            className="h-full bg-ima-primary rounded-full motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {stages.map(({ stage, stageName }) => {
          const stageSteps = ROADMAP_STEPS.filter(s => s.stage === stage);
          return (
            <div key={stage} className="space-y-3">
              {/* Stage header */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-ima-text-muted">
                  {stageName}
                </span>
                <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
              </div>
              {/* Stage steps */}
              {stageSteps.map((step) => {
                const row = rowMap.get(step.step);
                const status = row?.status ?? "locked";
                const completedAt = row?.completed_at ?? null;
                const ds = getDeadlineStatus(step.target_days, joinedAt, status, completedAt);

                return (
                  <div key={step.step} className="flex items-start gap-3">
                    {/* Icon */}
                    {status === "completed" ? (
                      <CheckCircle2 className="h-6 w-6 text-ima-success shrink-0 mt-0.5" aria-hidden="true" />
                    ) : status === "active" ? (
                      <Circle className="h-6 w-6 text-ima-primary shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Lock className="h-6 w-6 text-ima-text-muted shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          status === "completed" && "text-ima-success",
                          status === "active" && "text-ima-text",
                          status === "locked" && "text-ima-text-muted"
                        )}
                      >
                        Step {step.step}: {step.title}
                      </p>
                      <p className="text-xs text-ima-text-secondary">{step.description}</p>

                      {/* Deadline status chips — same logic as student RoadmapStep */}
                      <div className="mt-1">
                        {ds.kind === "completed" && (
                          <Badge variant="success" size="sm">
                            Completed {new Date(ds.completedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                            {ds.daysLate !== null && (
                              <span className="ml-1 opacity-75">({ds.daysLate}d late)</span>
                            )}
                          </Badge>
                        )}
                        {ds.kind === "on-track" && (
                          <Badge variant="success" size="sm">
                            <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                            On Track — {ds.deadlineLabel}
                          </Badge>
                        )}
                        {ds.kind === "due-soon" && (
                          <Badge variant="warning" size="sm">
                            <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                            Due Soon — {ds.deadlineLabel}
                          </Badge>
                        )}
                        {ds.kind === "overdue" && (
                          <Badge variant="error" size="sm">
                            <Calendar className="h-3 w-3 mr-1" aria-hidden="true" />
                            Overdue — {ds.daysOverdue}d
                          </Badge>
                        )}
                      </div>

                      {/* Undo button — coach/owner only, completed steps only */}
                      {status === "completed" && (
                        <button
                          onClick={() => setConfirmStep(step.step)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-ima-text-secondary hover:text-ima-primary motion-safe:transition-colors min-h-[44px] min-w-[44px]"
                          aria-label={`Undo Step ${step.step}: ${step.title}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Undo confirmation modal */}
      {(() => {
        const nextStepRow = confirmStep !== null
          ? roadmap.find(r => r.step_number === confirmStep + 1)
          : null;
        const nextStepIsActive = nextStepRow?.status === "active";
        const stepConfig = confirmStep !== null
          ? ROADMAP_STEPS.find(s => s.step === confirmStep)
          : null;
        const nextStepConfig = confirmStep !== null
          ? ROADMAP_STEPS.find(s => s.step === confirmStep + 1)
          : null;

        const dialogDescription = nextStepIsActive && nextStepConfig
          ? `Are you sure you want to reset Step ${confirmStep}: "${stepConfig?.title}" back to active? Step ${(confirmStep ?? 0) + 1}: "${nextStepConfig.title}" (currently active) will also be re-locked.`
          : `Are you sure you want to reset Step ${confirmStep}: "${stepConfig?.title}" back to active?`;

        return (
          <Modal
            open={confirmStep !== null}
            onClose={() => { if (!undoing) setConfirmStep(null); }}
            title="Undo Step?"
            description={dialogDescription}
          >
            <div className="flex gap-3 mt-4">
              <Button
                variant="danger"
                loading={undoing}
                onClick={handleUndo}
              >
                Reset to Active
              </Button>
              <Button variant="ghost" onClick={() => setConfirmStep(null)} disabled={undoing}>
                Cancel
              </Button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
