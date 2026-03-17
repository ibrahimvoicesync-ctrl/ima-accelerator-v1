"use client";

import { CheckCircle2, Lock, Circle, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROADMAP_STEPS } from "@/lib/config";
import { EmptyState } from "@/components/ui/EmptyState";

type RoadmapProgressRow = { step_number: number; status: "locked" | "active" | "completed" };

interface RoadmapTabProps {
  roadmap: RoadmapProgressRow[];
}

export function RoadmapTab({ roadmap }: RoadmapTabProps) {
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
  const progressPct = Math.round((completedCount / 10) * 100);

  // Build lookup for status
  const statusMap = new Map(roadmap.map((r) => [r.step_number, r.status]));

  return (
    <div role="tabpanel" id="tabpanel-roadmap" aria-labelledby="tab-roadmap" className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-ima-text-secondary">Overall Progress</span>
          <span className="text-sm font-medium text-ima-text">{completedCount}/10 steps</span>
        </div>
        <div
          className="h-3 bg-ima-surface rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-label={`Roadmap progress: ${completedCount} of 10 steps completed`}
        >
          <div
            className="h-full bg-ima-primary rounded-full motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {ROADMAP_STEPS.map((step) => {
          const status = statusMap.get(step.step) ?? "locked";
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
              <div>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
