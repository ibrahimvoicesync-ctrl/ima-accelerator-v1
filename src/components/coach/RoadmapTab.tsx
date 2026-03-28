"use client";

import { CheckCircle2, Lock, Circle, Route, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROADMAP_STEPS } from "@/lib/config";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getDeadlineStatus } from "@/lib/roadmap-utils";

type RoadmapProgressRow = { step_number: number; status: "locked" | "active" | "completed"; completed_at: string | null };

interface RoadmapTabProps {
  roadmap: RoadmapProgressRow[];
  joinedAt: string;
}

export function RoadmapTab({ roadmap, joinedAt }: RoadmapTabProps) {
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
      <div className="space-y-4">
        {ROADMAP_STEPS.map((step) => {
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
