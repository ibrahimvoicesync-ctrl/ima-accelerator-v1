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
      className={`rounded-2xl border px-4 py-4 md:px-5 md:py-4 flex items-center gap-4 min-h-[88px] motion-safe:transition-shadow hover:shadow-card-hover ${
        isCompleted
          ? "border-ima-success/25 bg-ima-surface"
          : isInProgress
          ? "border-ima-primary/30 bg-ima-surface"
          : "border-ima-border bg-ima-surface"
      }`}
    >
      {/* Win token — solid filled circle as the "stack of wins" signature (Stitch motif) */}
      <div
        className={`flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full ${
          isCompleted
            ? "bg-ima-success"
            : isInProgress
            ? "bg-ima-primary"
            : "bg-ima-surface-light border border-ima-border"
        }`}
        aria-hidden="true"
      >
        {isCompleted && <Check className="h-6 w-6 text-white" strokeWidth={3} aria-hidden="true" />}
        {isInProgress && <Play className="h-5 w-5 text-white" strokeWidth={2.75} fill="currentColor" aria-hidden="true" />}
        {isPaused && <Pause className="h-5 w-5 text-ima-text-secondary" strokeWidth={2.5} aria-hidden="true" />}
        {status === "abandoned" && <X className="h-5 w-5 text-ima-text-muted" strokeWidth={2.5} aria-hidden="true" />}
        {status === "pending" && <Circle className="h-5 w-5 text-ima-text-muted" strokeWidth={2} aria-hidden="true" />}
      </div>

      {/* Editorial label + duration — eyebrow builds rhythm, title stays Stitch-simple */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted leading-none">
          {`Session ${String(cycleNumber).padStart(2, "0")}`}
        </p>
        <p className="mt-2 text-lg font-semibold text-ima-text tabular-nums leading-tight">
          {sessionMinutes ? `${sessionMinutes} min` : "\u2014"}
        </p>
        {!isCompleted && (
          <p className="mt-1 text-sm text-ima-text-secondary tabular-nums leading-tight">{timeInfo}</p>
        )}
      </div>

      {/* Resume action — only when paused */}
      {isPaused && onResume && (
        <button
          onClick={onResume}
          className="flex-shrink-0 min-h-[48px] px-4 text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary hover:bg-ima-surface-accent rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-2 motion-safe:transition-colors"
          aria-label={`Resume session ${cycleNumber}`}
        >
          Resume
        </button>
      )}
    </div>
  );
}
