"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { RoadmapStep } from "@/components/student/RoadmapStep";
import { ROADMAP_STEPS } from "@/lib/config";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

interface RoadmapClientProps {
  progress: RoadmapProgress[];
}

export function RoadmapClient({ progress }: RoadmapClientProps) {
  const routerRef = useRef(useRouter());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [confirmStep, setConfirmStep] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);

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
        const nextTitle = ROADMAP_STEPS.find(
          (s) => s.step === confirmStep + 1
        )?.title;
        toastRef.current({
          type: "success",
          title: `"${stepTitle}" complete!${nextTitle ? ` Next: ${nextTitle}` : ""}`,
        });
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

  return (
    <>
      {/* Timeline */}
      <div
        className="motion-safe:animate-slideUp"
        style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
      >
        {ROADMAP_STEPS.map((step, i) => {
          const stepProgress =
            progress.find((p) => p.step_number === step.step) ?? null;
          return (
            <RoadmapStep
              key={step.step}
              step={{
                step_number: step.step,
                title: step.title,
                description: step.description,
              }}
              progress={stepProgress}
              isLast={i === ROADMAP_STEPS.length - 1}
              onComplete={(stepNumber) => setConfirmStep(stepNumber)}
            />
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
    </>
  );
}
