"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { WorkTimer } from "@/components/student/WorkTimer";
import { CycleCard } from "@/components/student/CycleCard";
import { WORK_TRACKER, ROUTES } from "@/lib/config";
import { getToday, formatPausedRemaining, formatHoursMinutes } from "@/lib/utils";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];

type TrackerPhase =
  | { kind: "idle" }
  | { kind: "setup" }
  | { kind: "working" }
  | { kind: "break"; secondsRemaining: number };

interface WorkTrackerClientProps {
  initialSessions: WorkSession[];
  initialPlan: DailyPlan | null;
}

export function WorkTrackerClient({ initialSessions, initialPlan: _initialPlan }: WorkTrackerClientProps) {
  const routerRef = useRef(useRouter());
  const router = routerRef.current;
  const toastRef = useRef(useToast());

  const [sessions, setSessions] = useState<WorkSession[]>(initialSessions);
  const [isLoading, setIsLoading] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

  // State machine phase
  const [phase, setPhase] = useState<TrackerPhase>({ kind: "idle" });
  const [selectedMinutes, setSelectedMinutes] = useState<number>(WORK_TRACKER.defaultSessionMinutes);
  const [breakType, setBreakType] = useState<"short" | "long">("short");
  const [breakMinutes, setBreakMinutes] = useState<number>(WORK_TRACKER.breakOptions.short.presets[0]);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // Keep sessions in sync when server re-renders with fresh initialSessions
  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Stale session auto-abandon on mount
  useEffect(() => {
    const today = getToday();
    const staleSessions = initialSessions.filter(
      (s) =>
        (s.status === "in_progress" || s.status === "paused") &&
        s.date < today
    );

    if (staleSessions.length === 0) return;

    const abandonStale = async () => {
      const results = await Promise.all(
        staleSessions.map((s) =>
          fetch(`/api/work-sessions/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "abandoned" }),
          })
        )
      );
      const allOk = results.every((r) => r.ok);
      if (!allOk) {
        console.error("[WorkTrackerClient] Some stale sessions failed to abandon");
      }
      router.refresh();
    };

    abandonStale().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived values
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const activeSession = sessions.find((s) => s.status === "in_progress");
  const pausedSession = sessions.find((s) => s.status === "paused");
  const nextCycleNumber = completedCount + 1;
  const totalMinutesWorked = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);
  const dailyGoalMinutes = WORK_TRACKER.dailyGoalHours * 60;
  const progressPercent = Math.min(100, Math.round((totalMinutesWorked / dailyGoalMinutes) * 100));

  // Phase initialization — sync phase with session state
  useEffect(() => {
    if (activeSession) {
      setPhase({ kind: "working" });
    } else if (pausedSession) {
      setPhase({ kind: "working" }); // paused is still "working" phase
    } else if (phase.kind === "working") {
      // Session just ended — handled by handleComplete
    } else if (phase.kind !== "setup" && phase.kind !== "break") {
      setPhase({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, pausedSession]);

  // Break countdown — client state only, never touches DB
  useEffect(() => {
    if (phase.kind !== "break") return;
    if (phase.secondsRemaining <= 0) {
      setPhase({ kind: "idle" });
      return;
    }
    const id = setInterval(() => {
      setPhase((prev) => {
        if (prev.kind !== "break") return prev;
        const next = prev.secondsRemaining - 1;
        if (next <= 0) return { kind: "idle" };
        return { kind: "break", secondsRemaining: next };
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, phase.kind === "break" ? phase.secondsRemaining : 0]);

  // --- Mutation handlers ---

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: getToday(),
          cycle_number: nextCycleNumber,
          session_minutes: selectedMinutes,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch((parseErr) => { console.error("[WorkTrackerClient] Failed to parse error response:", parseErr); return { error: null }; });
        console.error("[WorkTrackerClient] Failed to start session:", err);
        toastRef.current.toast({ type: "error", title: err.error || "Failed to start session" });
        return;
      }
      const newSession = await response.json();
      setSessions((prev) => [...prev, newSession]);
      setPhase({ kind: "working" });
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleStart error:", err);
      toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [nextCycleNumber, selectedMinutes, router]);

  const handleComplete = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!response.ok) {
        const err = await response.json().catch((parseErr) => { console.error("[WorkTrackerClient] Failed to parse error response:", parseErr); return { error: null }; });
        // Silently ignore race condition with auto-complete
        if (typeof err.error === "string" && err.error.includes("Cannot transition")) {
          router.refresh();
          return;
        }
        console.error("[WorkTrackerClient] Failed to complete session:", err);
        toastRef.current.toast({ type: "error", title: err.error || "Failed to complete session" });
        return;
      }
      // After completion: trigger break with the selected break duration
      setPhase({ kind: "break", secondsRemaining: breakMinutes * 60 });
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleComplete error:", err);
      toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [completedCount, breakMinutes, router]);

  const handlePause = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      if (!response.ok) {
        const err = await response.json().catch((parseErr) => { console.error("[WorkTrackerClient] Failed to parse error response:", parseErr); return { error: null }; });
        console.error("[WorkTrackerClient] Failed to pause session:", err);
        toastRef.current.toast({ type: "error", title: err.error || "Failed to pause session" });
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handlePause error:", err);
      toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleResume = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!response.ok) {
        const err = await response.json().catch((parseErr) => { console.error("[WorkTrackerClient] Failed to parse error response:", parseErr); return { error: null }; });
        console.error("[WorkTrackerClient] Failed to resume session:", err);
        toastRef.current.toast({ type: "error", title: err.error || "Failed to resume session" });
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleResume error:", err);
      toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleAbandon = useCallback(async (sessionId: string) => {
    // Look up target session by ID — safe for both active and paused states
    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    // Grace period check
    const elapsed = Date.now() - new Date(target.started_at).getTime();
    if (elapsed > WORK_TRACKER.abandonGraceSeconds * 1000 && !showAbandonConfirm) {
      setShowAbandonConfirm(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "abandoned" }),
      });
      if (!response.ok) {
        const err = await response.json().catch((parseErr) => { console.error("[WorkTrackerClient] Failed to parse error response:", parseErr); return { error: null }; });
        console.error("[WorkTrackerClient] Failed to abandon session:", err);
        toastRef.current.toast({ type: "error", title: err.error || "Failed to abandon session" });
        return;
      }
      setShowAbandonConfirm(false);
      setPhase({ kind: "idle" });
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleAbandon error:", err);
      toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, [sessions, showAbandonConfirm, router]);

  function handleSkipBreak() {
    setPhase({ kind: "idle" });
  }

  // --- Render ---

  return (
    <div>
      {/* Hours progress bar — per D-05, D-06, D-07, D-08 */}
      <div className="mb-6">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm font-medium text-ima-text">
            {formatHoursMinutes(totalMinutesWorked)} / {WORK_TRACKER.dailyGoalHours}h
          </span>
          <span className="text-xs text-ima-text-secondary">
            {completedCount} session{completedCount !== 1 ? "s" : ""} completed
          </span>
        </div>
        <div
          className="bg-ima-bg rounded-full h-3 overflow-hidden"
          role="progressbar"
          aria-valuenow={totalMinutesWorked}
          aria-valuemin={0}
          aria-valuemax={dailyGoalMinutes}
          aria-label={`Daily hours progress: ${formatHoursMinutes(totalMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours}h`}
        >
          <div
            className="bg-ima-primary h-full rounded-full motion-safe:transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Break countdown — per WORK-04, WORK-05 */}
      {phase.kind === "break" && (
        <div className="flex flex-col items-center gap-4 mb-6 text-center">
          <p className="text-sm text-ima-text-secondary">Break Time</p>
          <p
            className="text-4xl font-mono font-bold text-ima-text"
            role="timer"
            aria-label={`Break: ${Math.floor(phase.secondsRemaining / 60)} minutes ${phase.secondsRemaining % 60} seconds remaining`}
          >
            {String(Math.floor(phase.secondsRemaining / 60)).padStart(2, "0")}:
            {String(phase.secondsRemaining % 60).padStart(2, "0")}
          </p>
          <p className="text-sm text-ima-text-secondary">
            Next session will be Session {nextCycleNumber}
          </p>
          <button
            onClick={handleSkipBreak}
            className="bg-ima-primary text-white rounded-lg px-6 min-h-[44px] font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
          >
            Skip Break
          </button>
        </div>
      )}

      {/* Setup phase — duration picker and break selection — per WORK-01, WORK-02, WORK-03 */}
      {phase.kind === "setup" && (
        <div className="flex flex-col items-center gap-6 mb-6">
          {/* Duration picker — per WORK-01 */}
          <div className="text-center">
            <p className="text-sm font-medium text-ima-text mb-3">Session Duration</p>
            <div className="flex gap-2 justify-center">
              {WORK_TRACKER.sessionDurationOptions.map((min) => (
                <button
                  key={min}
                  onClick={() => setSelectedMinutes(min)}
                  className={`min-h-[44px] min-w-[44px] px-4 rounded-lg font-medium motion-safe:transition-colors ${
                    selectedMinutes === min
                      ? "bg-ima-primary text-white"
                      : "bg-ima-surface border border-ima-border text-ima-text hover:bg-ima-bg"
                  }`}
                  aria-pressed={selectedMinutes === min}
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          {/* Break selection — available for all sessions */}
          {(
            <div className="text-center">
              <p className="text-sm font-medium text-ima-text mb-3">Break Before Next Session</p>
              {/* Break type toggle */}
              <div className="flex gap-2 justify-center mb-3">
                {(Object.keys(WORK_TRACKER.breakOptions) as Array<"short" | "long">).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setBreakType(type);
                      setBreakMinutes(WORK_TRACKER.breakOptions[type].presets[0]);
                    }}
                    className={`min-h-[44px] px-4 rounded-lg font-medium motion-safe:transition-colors ${
                      breakType === type
                        ? "bg-ima-primary text-white"
                        : "bg-ima-surface border border-ima-border text-ima-text hover:bg-ima-bg"
                    }`}
                    aria-pressed={breakType === type}
                  >
                    {WORK_TRACKER.breakOptions[type].label}
                  </button>
                ))}
              </div>
              {/* Break duration presets */}
              <div className="flex gap-2 justify-center">
                {WORK_TRACKER.breakOptions[breakType].presets.map((min) => (
                  <button
                    key={min}
                    onClick={() => setBreakMinutes(min)}
                    className={`min-h-[44px] min-w-[44px] px-3 rounded-lg text-sm font-medium motion-safe:transition-colors ${
                      breakMinutes === min
                        ? "bg-ima-primary/15 text-ima-primary border border-ima-primary"
                        : "bg-ima-surface border border-ima-border text-ima-text-secondary hover:bg-ima-bg"
                    }`}
                    aria-pressed={breakMinutes === min}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="bg-ima-primary text-white rounded-xl px-8 min-h-[56px] text-lg font-semibold hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
          >
            {isLoading ? "Starting..." : `Start Session ${nextCycleNumber}`}
          </button>
        </div>
      )}

      {/* Active timer */}
      {activeSession && (
        <div className="flex flex-col items-center gap-4 mb-6">
          <WorkTimer
            sessionId={activeSession.id}
            startedAt={activeSession.started_at}
            cycleNumber={activeSession.cycle_number}
            totalSeconds={(activeSession.session_minutes ?? WORK_TRACKER.defaultSessionMinutes) * 60}
            onComplete={() => handleComplete(activeSession.id)}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => handlePause(activeSession.id)}
              disabled={isLoading}
              className="bg-ima-warning/15 text-ima-warning hover:bg-ima-warning/25 rounded-lg px-6 min-h-[44px] font-medium disabled:opacity-50 motion-safe:transition-colors"
            >
              Pause
            </button>
            <button
              onClick={() => handleComplete(activeSession.id)}
              disabled={isLoading}
              className="bg-ima-success text-white hover:bg-ima-success/90 rounded-lg px-6 min-h-[44px] font-medium disabled:opacity-50 motion-safe:transition-colors"
            >
              Complete
            </button>
            <button
              onClick={() => handleAbandon(activeSession.id)}
              disabled={isLoading}
              className="text-ima-error hover:bg-ima-error/10 rounded-lg px-4 min-h-[44px] text-sm motion-safe:transition-colors"
            >
              Abandon
            </button>
          </div>

          {/* Inline abandon confirmation */}
          {showAbandonConfirm && (
            <div className="bg-ima-error/10 rounded-lg p-3 text-sm text-ima-error w-full max-w-sm text-center">
              <p>Are you sure? You have significant progress on this cycle.</p>
              <div className="flex justify-center gap-3 mt-2">
                <button
                  onClick={() => handleAbandon(activeSession.id)}
                  className="bg-ima-error text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-error/90 motion-safe:transition-colors"
                >
                  Confirm Abandon
                </button>
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="bg-ima-surface border border-ima-border text-ima-text rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-bg motion-safe:transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paused state */}
      {pausedSession && !activeSession && (
        <div className="flex flex-col items-center gap-4 mb-6 text-center">
          <p className="text-ima-text-secondary text-sm">
            Session {pausedSession.cycle_number} paused &mdash; {pausedSession.session_minutes} min
          </p>
          <p className="text-3xl font-mono font-bold text-ima-text">
            {formatPausedRemaining(
              pausedSession.started_at,
              pausedSession.paused_at!,
              pausedSession.session_minutes ?? WORK_TRACKER.defaultSessionMinutes
            )}{" "}
            remaining
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleResume(pausedSession.id)}
              disabled={isLoading}
              className="bg-ima-primary text-white rounded-lg px-6 min-h-[44px] font-medium hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
            >
              Resume Session {pausedSession.cycle_number}
            </button>
            <button
              onClick={() => handleAbandon(pausedSession.id)}
              disabled={isLoading}
              className="text-ima-error hover:bg-ima-error/10 rounded-lg px-4 min-h-[44px] text-sm motion-safe:transition-colors"
            >
              Abandon
            </button>
          </div>

          {/* Inline abandon confirmation for paused state */}
          {showAbandonConfirm && (
            <div className="bg-ima-error/10 rounded-lg p-3 text-sm text-ima-error w-full max-w-sm">
              <p>Are you sure? You have significant progress on this cycle.</p>
              <div className="flex justify-center gap-3 mt-2">
                <button
                  onClick={() => handleAbandon(pausedSession.id)}
                  className="bg-ima-error text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-error/90 motion-safe:transition-colors"
                >
                  Confirm Abandon
                </button>
                <button
                  onClick={() => setShowAbandonConfirm(false)}
                  className="bg-ima-surface border border-ima-border text-ima-text rounded-lg px-4 min-h-[44px] font-medium hover:bg-ima-bg motion-safe:transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle: no active or paused session */}
      {phase.kind === "idle" && !activeSession && !pausedSession && (
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <p className="text-lg font-semibold text-ima-text">
            Ready for Session {nextCycleNumber}
          </p>
          <button
            onClick={() => setPhase({ kind: "setup" })}
            disabled={isLoading}
            className="bg-ima-primary text-white rounded-xl px-8 min-h-[56px] text-lg font-semibold hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
          >
            Set Up Session
          </button>
        </div>
      )}

      {/* Daily report link — shown when at least one session complete */}
      {completedCount > 0 && !activeSession && !pausedSession && phase.kind !== "break" && (
        <div className="text-center mb-4">
          <Link
            href={ROUTES.student.report}
            className="inline-flex items-center justify-center text-sm text-ima-primary hover:text-ima-primary-hover min-h-[44px] motion-safe:transition-colors"
          >
            Submit Daily Report
          </Link>
        </div>
      )}

      {/* Session history — dynamic list, newest first (D-01, D-03) */}
      {(() => {
        const visibleSessions = [...sessions]
          .filter((s) => s.status !== "abandoned")
          .sort((a, b) => b.cycle_number - a.cycle_number);
        const DEFAULT_VISIBLE = 4;
        const displayed = showAllSessions ? visibleSessions : visibleSessions.slice(0, DEFAULT_VISIBLE);
        const hiddenCount = visibleSessions.length - DEFAULT_VISIBLE;

        if (visibleSessions.length === 0) return null;

        return (
          <div className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayed.map((session) => {
                let timeInfo: string;
                let onResume: (() => void) | undefined;

                if (session.status === "completed") {
                  timeInfo = `${session.session_minutes ?? WORK_TRACKER.defaultSessionMinutes} min`;
                } else if (session.status === "in_progress") {
                  timeInfo = "In progress";
                } else if (session.status === "paused") {
                  timeInfo = `${formatPausedRemaining(
                    session.started_at,
                    session.paused_at!,
                    session.session_minutes ?? WORK_TRACKER.defaultSessionMinutes
                  )} left`;
                  onResume = () => handleResume(session.id);
                } else {
                  timeInfo = "Abandoned";
                }

                return (
                  <CycleCard
                    key={session.id}
                    cycleNumber={session.cycle_number}
                    status={session.status}
                    timeInfo={timeInfo}
                    sessionMinutes={session.session_minutes ?? WORK_TRACKER.defaultSessionMinutes}
                    onResume={onResume}
                  />
                );
              })}
            </div>
            {/* Show more link (D-04) */}
            {hiddenCount > 0 && !showAllSessions && (
              <button
                onClick={() => setShowAllSessions(true)}
                className="mt-3 text-sm text-ima-primary hover:text-ima-primary-hover min-h-[44px] motion-safe:transition-colors"
              >
                Show {hiddenCount} more session{hiddenCount !== 1 ? "s" : ""}
              </button>
            )}
            {showAllSessions && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllSessions(false)}
                className="mt-3 text-sm text-ima-primary hover:text-ima-primary-hover min-h-[44px] motion-safe:transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
