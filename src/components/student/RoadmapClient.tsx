"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ExternalLink } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { RoadmapStep } from "@/components/student/RoadmapStep";
import { ROADMAP_STEPS } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

interface RoadmapClientProps {
  progress: RoadmapProgress[];
  joinedAt: string;
}

export function RoadmapClient({ progress, joinedAt }: RoadmapClientProps) {
  const routerRef = useRef(useRouter());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [confirmStep, setConfirmStep] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [unlockModal, setUnlockModal] = useState<{ title: string; url: string } | null>(null);

  const handleComplete = useCallback(async () => {
    if (confirmStep === null) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/roadmap", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_number: confirmStep }),
      });

      if (res.ok) {
        const stepTitle = ROADMAP_STEPS.find(
          (s) => s.step === confirmStep
        )?.title;
        const currentStep = ROADMAP_STEPS.find(
          (s) => s.step === confirmStep
        );
        const nextStep = ROADMAP_STEPS.find(
          (s) => s.step === confirmStep + 1
        );

        // Check if the completed step has an unlock_url
        if (currentStep?.unlock_url) {
          setUnlockModal({ title: currentStep.title, url: currentStep.unlock_url });
        } else {
          toastRef.current({
            type: "success",
            title: `"${stepTitle}" complete!${nextStep ? ` Next: ${nextStep.title}` : ""}`,
          });
        }
        routerRef.current.refresh();
      } else {
        const err = await res.json();
        toastRef.current({
          type: "error",
          title: err.error || "Failed to complete step",
        });
      }
    } catch {
      toastRef.current({
        type: "error",
        title: "Failed to complete step",
      });
    } finally {
      setCompleting(false);
      setConfirmStep(null);
    }
  }, [confirmStep]);

  const stages = [...new Map(
    ROADMAP_STEPS.map(s => [s.stage, s.stageName])
  ).entries()].map(([stage, stageName]) => ({ stage, stageName }));

  return (
    <>
      {/* Timeline */}
      <div
        className="motion-safe:animate-slideUp"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      >
        {stages.map(({ stage, stageName }, stageIdx) => {
          const stageSteps = ROADMAP_STEPS.filter(s => s.stage === stage);
          return (
            <div key={stage}>
              {/* Stage header */}
              <div className={cn(
                "flex items-center gap-3 pb-2",
                stageIdx > 0 && "pt-8"
              )}>
                <span className="text-xs font-semibold uppercase tracking-wider text-ima-text-muted">
                  {stageName}
                </span>
                <div className="flex-1 h-px bg-ima-border" aria-hidden="true" />
              </div>
              {/* Stage steps */}
              {stageSteps.map((step, i) => {
                const stepProgress = progress.find((p) => p.step_number === step.step) ?? null;
                return (
                  <RoadmapStep
                    key={step.step}
                    step={{
                      step_number: step.step,
                      title: step.title,
                      description: step.description,
                      target_days: step.target_days,
                      unlock_url: step.unlock_url,
                    }}
                    progress={stepProgress}
                    isLast={i === stageSteps.length - 1}
                    joinedAt={joinedAt}
                    onComplete={(stepNumber) => setConfirmStep(stepNumber)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Confirmation modal */}
      <Modal
        open={confirmStep !== null}
        onClose={() => setConfirmStep(null)}
        title="Mark Step Complete?"
        description={`Mark "${ROADMAP_STEPS.find((s) => s.step === confirmStep)?.title}" as complete? This cannot be undone.`}
      >
        <div className="flex gap-3 mt-4">
          <Button
            variant="primary"
            loading={completing}
            onClick={handleComplete}
          >
            Confirm
          </Button>
          <Button variant="ghost" onClick={() => setConfirmStep(null)}>
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Unlock video modal */}
      <Modal
        open={unlockModal !== null}
        onClose={() => setUnlockModal(null)}
        title="You've Unlocked a Secret Video!"
      >
        <div className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-ima-warning/10">
            <Sparkles className="h-8 w-8 text-ima-warning" aria-hidden="true" />
          </div>
          <p className="text-sm text-ima-text-secondary">
            You just unlocked <span className="font-semibold text-ima-text">{unlockModal?.title}</span>. Watch this video before you start.
          </p>
          <a
            href={unlockModal?.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-lg bg-ima-primary text-white font-semibold hover:bg-ima-primary-hover motion-safe:transition-colors"
          >
            Watch Video
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <Button variant="ghost" onClick={() => setUnlockModal(null)}>
            Watch Later
          </Button>
        </div>
      </Modal>
    </>
  );
}
