"use client";

import { Check, Lock, Calendar } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types";

type RoadmapProgress = Database["public"]["Tables"]["roadmap_progress"]["Row"];

interface RoadmapStepProps {
  step: {
    step_number: number;
    title: string;
    description: string;
    target_days: number | null;
  };
  progress: RoadmapProgress | null;
  isLast: boolean;
  joinedAt: string;
  onComplete: (stepNumber: number) => void;
}

export function RoadmapStep({ step, progress, isLast, joinedAt, onComplete }: RoadmapStepProps) {
  const status = progress?.status ?? "locked";

  // Compute deadline date from joined_at + target_days
  const deadlineDate = step.target_days !== null
    ? (() => {
        const d = new Date(joinedAt);
        d.setDate(d.getDate() + step.target_days);
        return d;
      })()
    : null;

  return (
    <div className="flex gap-3">
      {/* Left: indicator + line */}
      <div className="flex flex-col items-center">
        {/* Circle */}
        <div
          aria-hidden="true"
          className={cn(
            "flex items-center justify-center w-11 h-11 rounded-full shrink-0 motion-safe:transition-all",
            status === "completed" && "bg-ima-success text-white shadow-sm",
            status === "active" && "bg-ima-primary text-white ring-4 ring-ima-primary/20 motion-safe:animate-pulse shadow-md",
            status === "locked" && "border-2 border-ima-border text-ima-text-muted bg-ima-surface-light"
          )}
        >
          {status === "completed" && <Check className="h-5 w-5" aria-hidden="true" />}
          {status === "active" && (
            <span className="text-sm font-bold">{step.step_number}</span>
          )}
          {status === "locked" && <Lock className="h-4 w-4" aria-hidden="true" />}
        </div>
        {/* Connecting line */}
        {!isLast && (
          <div
            className={cn(
              "w-0.5 flex-1 min-h-10",
              status === "completed" ? "bg-ima-success" : "bg-ima-border"
            )}
          />
        )}
      </div>

      {/* Right: content */}
      <div className="pb-6 flex-1">
        <h3
          className={cn(
            "text-base font-semibold",
            status === "locked" ? "text-ima-text-muted" : "text-ima-text"
          )}
        >
          {step.title}
        </h3>
        <p
          className={cn(
            "text-sm mt-1 leading-relaxed",
            status === "locked" ? "text-ima-text-muted" : "text-ima-text-secondary"
          )}
        >
          {step.description}
        </p>

        {deadlineDate && status !== "completed" && (
          <p className={cn(
            "text-xs mt-1 flex items-center gap-1",
            deadlineDate < new Date() ? "text-ima-danger font-medium" : "text-ima-text-muted"
          )}>
            <Calendar className="h-3 w-3" aria-hidden="true" />
            Due {deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}

        <div className="mt-2">
          {status === "completed" && (
            <Badge variant="success">
              Completed{progress?.completed_at && (
                <span className="ml-1">
                  {new Date(progress.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </Badge>
          )}
          {status === "active" && (
            <Button
              variant="primary"
              size="md"
              onClick={() => onComplete(step.step_number)}
            >
              Mark Complete
            </Button>
          )}
          {status === "locked" && (
            <Badge variant="default">
              <Lock className="h-3 w-3 mr-1" aria-hidden="true" />
              Locked
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
