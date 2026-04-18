"use client";

import { Check, Play, Pause, X, Circle } from "lucide-react";

interface CycleCardProps {
  cycleNumber: number;
  status: "completed" | "in_progress" | "paused" | "abandoned" | "pending";
  timeInfo: string;
  sessionMinutes?: number;
  onResume?: () => void;
}

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono-bold)" };

export function CycleCard({ cycleNumber, status, timeInfo, sessionMinutes, onResume }: CycleCardProps) {
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";
  const isPaused = status === "paused";

  // Editorial icon tile — matches dashboard's w-9 h-9 rounded-[8px] tinted badge
  const iconTile = isCompleted
    ? { bg: "bg-[#E2F5E9]", color: "text-[#16A34A]" }
    : isInProgress
    ? { bg: "bg-[#E8EEFF]", color: "text-[#4A6CF7]" }
    : isPaused
    ? { bg: "bg-[#FDF3E0]", color: "text-[#D97706]" }
    : { bg: "bg-[#F1EEE6]", color: "text-[#8A8474]" };

  return (
    <div className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px] motion-safe:transition-[transform,border-color] hover:-translate-y-[1px] hover:border-[#D8D2C4]">
      <div
        className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${iconTile.bg}`}
        aria-hidden="true"
      >
        {isCompleted && <Check className={`h-[18px] w-[18px] ${iconTile.color}`} strokeWidth={2.5} aria-hidden="true" />}
        {isInProgress && <Play className={`h-[16px] w-[16px] ${iconTile.color}`} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />}
        {isPaused && <Pause className={`h-[16px] w-[16px] ${iconTile.color}`} strokeWidth={2.5} aria-hidden="true" />}
        {status === "abandoned" && <X className={`h-[16px] w-[16px] ${iconTile.color}`} strokeWidth={2.5} aria-hidden="true" />}
        {status === "pending" && <Circle className={`h-[16px] w-[16px] ${iconTile.color}`} strokeWidth={2} aria-hidden="true" />}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] font-semibold tracking-[0.18em] text-[#8A8474] uppercase leading-none"
          style={MONO}
        >
          {`Session ${String(cycleNumber).padStart(2, "0")}`}
        </p>
        <p className="mt-[6px] text-[15px] font-semibold text-[#1A1A17] tabular-nums leading-tight">
          {sessionMinutes ? `${sessionMinutes} min` : "\u2014"}
        </p>
        {!isCompleted && (
          <p className="mt-[2px] text-[12px] text-[#8A8474] tabular-nums leading-tight">{timeInfo}</p>
        )}
      </div>

      {isPaused && onResume && (
        <button
          onClick={onResume}
          className="shrink-0 min-h-[44px] px-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#4A6CF7] hover:bg-[#E8EEFF] rounded-[8px] focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2 motion-safe:transition-colors"
          style={MONO}
          aria-label={`Resume session ${cycleNumber}`}
        >
          Resume
        </button>
      )}
    </div>
  );
}
