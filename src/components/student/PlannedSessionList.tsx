"use client";

import { Check, Play, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanJson } from "@/lib/schemas/daily-plan";

interface PlannedSessionListProps {
  plan: PlanJson;
  completedCount: number;
  activeSession: boolean; // true if a session is currently in_progress
  pausedSession: boolean; // true if a session is currently paused
  isLoading: boolean;
  onStartSession: (sessionIndex: number) => void;
}

export function PlannedSessionList({
  plan,
  completedCount,
  activeSession,
  pausedSession,
  isLoading,
  onStartSession,
}: PlannedSessionListProps) {
  return (
    <div className="rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6 mb-8">
      {/* Editorial progress header */}
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text">
          Today&apos;s plan
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-ima-text-muted tabular-nums">
          {`${completedCount} / ${plan.sessions.length} sessions`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {plan.sessions.map((session, index) => {
          const isCompleted = index < completedCount;
          const isCurrent = index === completedCount;
          const isUpcoming = index > completedCount;
          const canStart = isCurrent && !activeSession && !pausedSession;

          return (
            <div
              key={index}
              className={cn(
                "rounded-xl border bg-ima-surface px-4 py-3.5 flex items-center gap-4 motion-safe:transition-shadow",
                isCompleted && "border-ima-success/25",
                isCurrent && "border-ima-primary/40 shadow-card-hover",
                isUpcoming && "border-ima-border opacity-60"
              )}
            >
              {/* Win token — solid filled circle (Stitch motif) */}
              <div
                className={cn(
                  "flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full",
                  isCompleted && "bg-ima-success",
                  isCurrent && "bg-ima-primary",
                  isUpcoming && "bg-ima-surface-light border border-ima-border"
                )}
                aria-hidden="true"
              >
                {isCompleted && <Check className="h-5 w-5 text-white" strokeWidth={3} aria-hidden="true" />}
                {isCurrent && <Play className="h-4 w-4 text-white" strokeWidth={2.75} fill="currentColor" aria-hidden="true" />}
                {isUpcoming && <Circle className="h-4 w-4 text-ima-text-muted" strokeWidth={2} aria-hidden="true" />}
              </div>

              {/* Editorial label + duration */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ima-text-muted leading-none">
                  {`Session ${String(index + 1).padStart(2, "0")}`}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ima-text tabular-nums leading-tight">
                  {`${session.session_minutes} min`}
                </p>
                <p className="mt-0.5 text-xs text-ima-text-secondary tabular-nums leading-tight">
                  {session.break_type === "none"
                    ? "No break"
                    : `${session.break_minutes}m ${session.break_type === "short" ? "short break" : "long break"}`}
                </p>
              </div>

              {/* Start button — primary committed CTA on the current row */}
              {canStart && (
                <button
                  onClick={() => onStartSession(index)}
                  disabled={isLoading}
                  className="flex-shrink-0 bg-ima-primary text-white rounded-xl px-5 min-h-[48px] text-sm font-semibold tracking-tight hover:bg-ima-primary-hover hover:shadow-card-hover disabled:opacity-50 motion-safe:transition-all duration-200 ease-out"
                  aria-label={`Start session ${index + 1}`}
                >
                  Start
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
