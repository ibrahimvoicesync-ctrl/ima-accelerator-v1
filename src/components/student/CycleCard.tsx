"use client";

import { Check, Play, Pause, X, Circle } from "lucide-react";

interface CycleCardProps {
  cycleNumber: number;
  status: "completed" | "in_progress" | "paused" | "abandoned" | "pending";
  timeInfo: string;
  sessionMinutes?: number;
  onResume?: () => void;
}

export function CycleCard({ cycleNumber, status, timeInfo, sessionMinutes, onResume }: CycleCardProps) {
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const isPaused = status === "paused";

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 flex items-center gap-4 motion-safe:transition-shadow hover:shadow-card-hover ${
        isCompleted
          ? "border-ima-success/25 bg-ima-surface"
          : isInProgress
          ? "border-ima-primary/30 bg-ima-surface"
          : "border-ima-border bg-ima-surface"
      }`}
    >
      {/* Win token — solid filled circle as the "stack of wins" signature (Stitch motif) */}
      <div
        className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${
          isCompleted
            ? "bg-ima-success"
            : isInProgress
            ? "bg-ima-primary"
            : "bg-ima-surface-light border border-ima-border"
        }`}
        aria-hidden="true"
      >
        {isCompleted && <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden="true" />}
        {isInProgress && <Play className="h-4 w-4 text-white" strokeWidth={2.75} fill="currentColor" aria-hidden="true" />}
        {isPaused && <Pause className="h-4 w-4 text-ima-text-secondary" strokeWidth={2.5} aria-hidden="true" />}
        {status === "abandoned" && <X className="h-4 w-4 text-ima-text-muted" strokeWidth={2.5} aria-hidden="true" />}
        {status === "pending" && <Circle className="h-4 w-4 text-ima-text-muted" strokeWidth={2} aria-hidden="true" />}
      </div>

      {/* Editorial label + duration — eyebrow builds rhythm, title stays Stitch-simple */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ima-text-muted leading-none">
          {`Session ${String(cycleNumber).padStart(2, "0")}`}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-ima-text tabular-nums leading-tight">
          {sessionMinutes ? `${sessionMinutes} min` : "\u2014"}
        </p>
        {!isCompleted && (
          <p className="mt-0.5 text-xs text-ima-text-secondary tabular-nums leading-tight">{timeInfo}</p>
        )}
      </div>

      {/* Resume action — only when paused */}
      {isPaused && onResume && (
        <button
          onClick={onResume}
          className="flex-shrink-0 min-h-[44px] px-3 text-xs uppercase tracking-[0.16em] font-semibold text-ima-primary hover:bg-ima-surface-accent rounded-lg motion-safe:transition-colors"
          aria-label={`Resume session ${cycleNumber}`}
        >
          Resume
        </button>
      )}
    </div>
  );
}
