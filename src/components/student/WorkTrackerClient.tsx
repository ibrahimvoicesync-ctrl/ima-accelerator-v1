"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WorkTimer } from "@/components/student/WorkTimer";
import { CycleCard } from "@/components/student/CycleCard";
import { WORK_TRACKER, ROUTES } from "@/lib/config";
import { getToday, formatPausedRemaining, formatHours } from "@/lib/utils";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];

interface WorkTrackerClientProps {
  initialSessions: WorkSession[];
}

export function WorkTrackerClient({ initialSessions }: WorkTrackerClientProps) {
  const routerRef = useRef(useRouter());
  const router = routerRef.current;

  const [sessions, setSessions] = useState<WorkSession[]>(initialSessions);
  const [isLoading, setIsLoading] = useState(false);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);

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
      await Promise.all(
        staleSessions.map((s) =>
          fetch(`/api/work-sessions/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "abandoned" }),
          })
        )
      );
      router.refresh();
    };

    abandonStale().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived values
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const activeSession = sessions.find((s) => s.status === "in_progress");
  const pausedSession = sessions.find((s) => s.status === "paused");
  const allComplete = completedCount >= WORK_TRACKER.cyclesPerDay;
  const nextCycleNumber = Math.min(completedCount + 1, WORK_TRACKER.cyclesPerDay);
  const totalMinutesWorked = sessions
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  // --- Mutation handlers ---

  async function handleStart() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: getToday(), cycle_number: nextCycleNumber }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("[WorkTrackerClient] Failed to start session:", err);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleStart error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleComplete(sessionId: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          duration_minutes: WORK_TRACKER.sessionMinutes,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // Silently ignore race condition with auto-complete
        if (typeof err.error === "string" && err.error.includes("Cannot transition")) {
          router.refresh();
          return;
        }
        console.error("[WorkTrackerClient] Failed to complete session:", err);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleComplete error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePause(sessionId: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("[WorkTrackerClient] Failed to pause session:", err);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handlePause error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResume(sessionId: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/work-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error("[WorkTrackerClient] Failed to resume session:", err);
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleResume error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAbandon(sessionId: string) {
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
        const err = await response.json().catch(() => ({}));
        console.error("[WorkTrackerClient] Failed to abandon session:", err);
        return;
      }
      setShowAbandonConfirm(false);
      router.refresh();
    } catch (err) {
      console.error("[WorkTrackerClient] handleAbandon error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // --- Render ---

  return (
    <div>
      {/* All-complete celebration */}
      {allComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center mb-6">
          <h2 className="text-xl font-bold text-green-800">All 4 cycles complete!</h2>
          <p className="text-green-700 mt-1">
            You worked {formatHours(totalMinutesWorked)} today. Outstanding effort!
          </p>
          <p className="text-sm text-green-600 mt-2">
            Great work! Don&apos;t forget to submit your daily report.
          </p>
          <Link
            href={ROUTES.student.report}
            className="inline-flex items-center justify-center mt-4 bg-ima-primary text-white rounded-lg px-6 min-h-[44px] font-medium hover:bg-ima-primary-hover motion-safe:transition-colors"
          >
            Submit Daily Report
          </Link>
        </div>
      )}

      {/* Active timer */}
      {activeSession && (
        <div className="flex flex-col items-center gap-4 mb-6">
          <WorkTimer
            sessionId={activeSession.id}
            startedAt={activeSession.started_at}
            cycleNumber={activeSession.cycle_number}
            totalSeconds={WORK_TRACKER.sessionMinutes * 60}
            onComplete={() => handleComplete(activeSession.id)}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => handlePause(activeSession.id)}
              disabled={isLoading}
              className="bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg px-6 min-h-[44px] font-medium disabled:opacity-50 motion-safe:transition-colors"
            >
              Pause
            </button>
            <button
              onClick={() => handleComplete(activeSession.id)}
              disabled={isLoading}
              className="bg-green-600 text-white hover:bg-green-700 rounded-lg px-6 min-h-[44px] font-medium disabled:opacity-50 motion-safe:transition-colors"
            >
              Complete
            </button>
            <button
              onClick={() => handleAbandon(activeSession.id)}
              disabled={isLoading}
              className="text-red-600 hover:bg-red-50 rounded-lg px-4 min-h-[44px] text-sm motion-safe:transition-colors"
            >
              Abandon
            </button>
          </div>

          {/* Inline abandon confirmation */}
          {showAbandonConfirm && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 w-full max-w-sm text-center">
              <p>Are you sure? You have significant progress on this cycle.</p>
              <div className="flex justify-center gap-3 mt-2">
                <button
                  onClick={() => handleAbandon(activeSession.id)}
                  className="bg-red-600 text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-red-700 motion-safe:transition-colors"
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
            Cycle {pausedSession.cycle_number} paused
          </p>
          <p className="text-3xl font-mono font-bold text-ima-text">
            {formatPausedRemaining(
              pausedSession.started_at,
              pausedSession.paused_at!,
              WORK_TRACKER.sessionMinutes
            )}{" "}
            remaining
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleResume(pausedSession.id)}
              disabled={isLoading}
              className="bg-ima-primary text-white rounded-lg px-6 min-h-[44px] font-medium hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
            >
              Resume Cycle {pausedSession.cycle_number}
            </button>
            <button
              onClick={() => handleAbandon(pausedSession.id)}
              disabled={isLoading}
              className="text-red-600 hover:bg-red-50 rounded-lg px-4 min-h-[44px] text-sm motion-safe:transition-colors"
            >
              Abandon
            </button>
          </div>

          {/* Inline abandon confirmation for paused state */}
          {showAbandonConfirm && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700 w-full max-w-sm">
              <p>Are you sure? You have significant progress on this cycle.</p>
              <div className="flex justify-center gap-3 mt-2">
                <button
                  onClick={() => handleAbandon(pausedSession.id)}
                  className="bg-red-600 text-white rounded-lg px-4 min-h-[44px] font-medium hover:bg-red-700 motion-safe:transition-colors"
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
      {!activeSession && !pausedSession && !allComplete && (
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          <p className="text-lg font-semibold text-ima-text">
            Start Cycle {nextCycleNumber}
          </p>
          <p className="text-sm text-ima-text-secondary">
            {completedCount} of {WORK_TRACKER.cyclesPerDay} cycles done
          </p>
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="bg-ima-primary text-white rounded-xl px-8 min-h-[56px] text-lg font-semibold hover:bg-ima-primary-hover disabled:opacity-50 motion-safe:transition-colors"
          >
            {isLoading ? "Starting…" : `Start Cycle ${nextCycleNumber}`}
          </button>
        </div>
      )}

      {/* Cycle progress grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {Array.from({ length: WORK_TRACKER.cyclesPerDay }, (_, i) => i + 1).map(
          (cycleNum) => {
            const session = sessions.find((s) => s.cycle_number === cycleNum);

            if (!session) {
              return (
                <CycleCard
                  key={cycleNum}
                  cycleNumber={cycleNum}
                  status="pending"
                  timeInfo="Pending"
                />
              );
            }

            let timeInfo: string;
            let onResume: (() => void) | undefined;

            if (session.status === "completed") {
              timeInfo = `${WORK_TRACKER.sessionMinutes} min`;
            } else if (session.status === "in_progress") {
              // Compute remaining from started_at
              const elapsed = Math.floor(
                (Date.now() - new Date(session.started_at).getTime()) / 1000
              );
              const remainingSecs = Math.max(
                0,
                WORK_TRACKER.sessionMinutes * 60 - elapsed
              );
              const mins = Math.floor(remainingSecs / 60);
              const secs = remainingSecs % 60;
              timeInfo = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} left`;
            } else if (session.status === "paused") {
              timeInfo = `${formatPausedRemaining(
                session.started_at,
                session.paused_at!,
                WORK_TRACKER.sessionMinutes
              )} left`;
              onResume = () => handleResume(session.id);
            } else {
              // abandoned
              timeInfo = "Abandoned";
            }

            return (
              <CycleCard
                key={session.id}
                cycleNumber={cycleNum}
                status={session.status}
                timeInfo={timeInfo}
                onResume={onResume}
              />
            );
          }
        )}
      </div>
    </div>
  );
}
