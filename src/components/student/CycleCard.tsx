"use client";

import { Check, Play, Pause, X, Circle } from "lucide-react";

interface CycleCardProps {
  cycleNumber: number;
  status: "completed" | "in_progress" | "paused" | "abandoned" | "pending";
  timeInfo: string;
  onResume?: () => void;
}

export function CycleCard({ cycleNumber, status, timeInfo, onResume }: CycleCardProps) {
  return (
    <div className="rounded-xl border border-ima-border bg-ima-surface p-4 flex items-center gap-3">
      {/* Status icon */}
      <div aria-hidden="true">
        {status === "completed" && <Check className="h-5 w-5 text-ima-success" aria-hidden="true" />}
        {status === "in_progress" && <Play className="h-5 w-5 text-ima-primary" aria-hidden="true" />}
        {status === "paused" && <Pause className="h-5 w-5 text-ima-warning" aria-hidden="true" />}
        {status === "abandoned" && <X className="h-5 w-5 text-ima-error" aria-hidden="true" />}
        {status === "pending" && <Circle className="h-5 w-5 text-ima-text-muted" aria-hidden="true" />}
      </div>

      {/* Text area */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ima-text">Cycle {cycleNumber}</p>
        <p className="text-sm text-ima-text-secondary">{timeInfo}</p>
      </div>

      {/* Resume button for paused state */}
      {status === "paused" && onResume && (
        <button
          onClick={onResume}
          className="min-h-[44px] min-w-[44px] px-3 py-2 text-sm font-medium text-ima-primary hover:bg-ima-bg rounded-lg"
          aria-label={`Resume cycle ${cycleNumber}`}
        >
          Resume
        </button>
      )}
    </div>
  );
}
