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
    <div className="flex flex-col gap-3 mb-6">
      {/* Progress indicator */}
      <p className="text-sm text-ima-text-secondary mb-3">
        {completedCount} of {plan.sessions.length} sessions completed
      </p>

      {plan.sessions.map((session, index) => {
        const isCompleted = index < completedCount;
        const isCurrent = index === completedCount;
        const isUpcoming = index > completedCount;

        return (
          <div
            key={index}
            className={cn(
              "rounded-xl border bg-ima-surface p-4 flex items-center gap-3",
              isCompleted && "border-ima-border opacity-60",
              isCurrent && "border-ima-primary shadow-sm",
              isUpcoming && "border-ima-border opacity-40"
            )}
          >
            {/* Status icon */}
            <div aria-hidden="true" className="flex-shrink-0">
              {isCompleted && (
                <Check className="h-5 w-5 text-ima-success" aria-hidden="true" />
              )}
              {isCurrent && (
                <Play className="h-5 w-5 text-ima-primary" aria-hidden="true" />
              )}
              {isUpcoming && (
                <Circle className="h-5 w-5 text-ima-text-muted" aria-hidden="true" />
              )}
            </div>

            {/* Session info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ima-text">
                Session {index + 1} &mdash; {session.session_minutes} min
              </p>
              <p className="text-sm text-ima-text-secondary">
                {session.break_type === "none"
                  ? "No break"
                  : `${session.break_minutes}m ${session.break_type === "short" ? "Short Break" : "Long Break"}`}
              </p>
            </div>

            {/* Start button — only on current session when no active/paused session */}
            {isCurrent && !activeSession && !pausedSession && (
              <button
                onClick={() => onStartSession(index)}
                disabled={isLoading}
                className="bg-ima-primary text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
                aria-label={`Start session ${index + 1}`}
              >
                Start
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
