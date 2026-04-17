"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { WorkTimer } from "@/components/student/WorkTimer";
import { CycleCard } from "@/components/student/CycleCard";
import { PlannerUI } from "@/components/student/PlannerUI";
import { PlannedSessionList } from "@/components/student/PlannedSessionList";
import { MotivationalCard } from "@/components/student/MotivationalCard";
import { planJsonSchema } from "@/lib/schemas/daily-plan";
import type { PlanJson } from "@/lib/schemas/daily-plan";
import { WORK_TRACKER } from "@/lib/config";

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
  dailyReportHref?: string;
}

export function WorkTrackerClient({ initialSessions, initialPlan, dailyReportHref }: WorkTrackerClientProps) {
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

  // Track motivational card display — once per day via localStorage (COMP-04)
  const [hasSeenCard, setHasSeenCard] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`ima-motivational-seen-${getToday()}`) === "1";
  });

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

  // Parse plan_json through Zod — never trust raw JSONB (Pitfall 2)
  const parsedPlan: PlanJson | null = (() => {
    if (!initialPlan) return null;
    const result = planJsonSchema.safeParse(initialPlan.plan_json);
    if (!result.success) {
      console.error("[WorkTrackerClient] Invalid plan_json:", result.error);
      return null;
    }
    return result.data;
  })();

  // Derive mode from server data — never useState (survives refresh correctly)
  const planFulfilled =
    parsedPlan !== null && completedCount >= parsedPlan.sessions.length;
  const mode: "planning" | "executing" | "adhoc" =
    parsedPlan === null ? "planning" : !planFulfilled ? "executing" : "adhoc";

  // Phase initialization — sync phase with session state
  useEffect(() => {
    if (activeSession) {
      setPhase({ kind: "working" });
    } else if (pausedSession) {
      setPhase({ kind: "working" }); // paused is still "working" phase
    } else if (phase.kind === "working") {
      // Session just ended — handled by handleComplete
    } else if (phase.kind !== "setup" && phase.kind !== "break" && mode !== "planning" && mode !== "executing") {
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

  const handleStartWithConfig = useCallback(
    async (
      sessionMinutes: number,
      sessionBreakType: "short" | "long" | "none",
      sessionBreakMinutes: number
    ) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/work-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: getToday(),
            cycle_number: nextCycleNumber,
            session_minutes: sessionMinutes,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch((parseErr) => {
            console.error("[WorkTrackerClient] Failed to parse error response:", parseErr);
            return { error: null };
          });
          console.error("[WorkTrackerClient] Failed to start planned session:", err);
          toastRef.current.toast({ type: "error", title: err.error || "Failed to start session" });
          return;
        }
        const newSession = await response.json();
        setSessions((prev) => [...prev, newSession]);
        // Store break config for when this session completes
        setBreakType(sessionBreakType === "none" ? "short" : sessionBreakType);
        setBreakMinutes(sessionBreakType === "none" ? 0 : sessionBreakMinutes);
        setPhase({ kind: "working" });
        router.refresh();
      } catch (err) {
        console.error("[WorkTrackerClient] handleStartWithConfig error:", err);
        toastRef.current.toast({ type: "error", title: "Something went wrong. Please try again." });
      } finally {
        setIsLoading(false);
      }
    },
    [nextCycleNumber, router]
  );

  const handleStartPlanned = useCallback(
    (planIndex: number) => {
      if (!parsedPlan) return;
      const slot = parsedPlan.sessions[planIndex];
      if (!slot) return;
      handleStartWithConfig(slot.session_minutes, slot.break_type, slot.break_minutes);
    },
    [parsedPlan, handleStartWithConfig]
  );

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

  function markCardSeen() {
    localStorage.setItem(`ima-motivational-seen-${getToday()}`, "1");
    setHasSeenCard(true);
  }

  const handleStartNextSession = useCallback(() => {
    markCardSeen();
    // Reset break state to defaults for ad-hoc mode (Pitfall 5)
    setBreakType("short");
    setBreakMinutes(WORK_TRACKER.breakOptions.short.presets[0]);
    setSelectedMinutes(WORK_TRACKER.defaultSessionMinutes);
    setPhase({ kind: "setup" });
  }, []);

  const handleDismissCard = useCallback(() => {
    markCardSeen();
    // Reset break state to defaults for ad-hoc mode (Pitfall 5)
    setBreakType("short");
    setBreakMinutes(WORK_TRACKER.breakOptions.short.presets[0]);
    setSelectedMinutes(WORK_TRACKER.defaultSessionMinutes);
  }, []);

  // --- Render ---

  return (
    <div>
      {/* Hero — daily hours vs goal. Single focal point per view; compressed when a session is active. */}
      <div className="mb-10">
        <div className="flex items-baseline justify-between mb-3 gap-3">
          <span className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
            Hours today
          </span>
          {progressPercent >= 100 ? (
            <span className="inline-flex items-center gap-1.5 bg-ima-success/10 text-ima-success rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-ima-success" aria-hidden="true" />
              Daily goal reached
            </span>
          ) : (
            <span className="text-xs uppercase tracking-[0.18em] font-medium text-ima-text-muted tabular-nums">
              {completedCount} session{completedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!activeSession && !pausedSession && phase.kind !== "break" ? (
          <div className="flex items-end gap-4 mb-6">
            <span
              className={`text-7xl md:text-8xl font-semibold tabular-nums tracking-tight leading-[0.95] ${
                progressPercent >= 100 ? "text-ima-success" : "text-ima-primary"
              }`}
            >
              {formatHoursMinutes(totalMinutesWorked)}
            </span>
            <span className="text-xl md:text-2xl font-medium text-ima-text-muted tabular-nums mb-1.5">
              / {WORK_TRACKER.dailyGoalHours}h
            </span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-ima-text">
              {formatHoursMinutes(totalMinutesWorked)}
            </span>
            <span className="text-sm text-ima-text-muted tabular-nums">
              / {WORK_TRACKER.dailyGoalHours}h
            </span>
          </div>
        )}

        <div
          className="bg-ima-surface-light rounded-full h-2.5 overflow-hidden"
          role="progressbar"
          aria-valuenow={totalMinutesWorked}
          aria-valuemin={0}
          aria-valuemax={dailyGoalMinutes}
          aria-label={`Daily hours progress: ${formatHoursMinutes(totalMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours}h`}
        >
          <div
            className={`h-full rounded-full motion-safe:transition-[width] duration-700 ease-out ${
              progressPercent >= 100 ? "bg-ima-success" : "bg-ima-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Break countdown — per WORK-04, WORK-05 */}
      {phase.kind === "break" && (
        <div className="flex flex-col items-center gap-5 mb-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-text-muted">
            Break
          </p>
          <p
            className="text-6xl md:text-7xl font-semibold tabular-nums tracking-tight text-ima-text leading-none"
            role="timer"
            aria-label={`Break: ${Math.floor(phase.secondsRemaining / 60)} minutes ${phase.secondsRemaining % 60} seconds remaining`}
          >
            {String(Math.floor(phase.secondsRemaining / 60)).padStart(2, "0")}:
            {String(phase.secondsRemaining % 60).padStart(2, "0")}
          </p>
          <p className="text-xs text-ima-text-secondary tabular-nums">
            {`Next up \u00B7 Session ${String(nextCycleNumber).padStart(2, "0")}`}
          </p>
          <button
            onClick={handleSkipBreak}
            className="bg-ima-surface border border-ima-border text-ima-text rounded-xl px-6 min-h-[48px] text-sm font-medium hover:bg-ima-surface-light motion-safe:transition-colors"
          >
            Skip break
          </button>
        </div>
      )}

      {/* Setup phase — duration picker and break selection — per WORK-01, WORK-02, WORK-03 */}
      {phase.kind === "setup" && (
        <div className="flex flex-col items-center gap-7 mb-8">
          {/* Duration picker — per WORK-01 */}
          <div className="text-center w-full">
            <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-text-muted mb-3">
              Session duration
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {WORK_TRACKER.sessionDurationOptions.map((min) => (
                <button
                  key={min}
                  onClick={() => setSelectedMinutes(min)}
                  className={`min-h-[44px] min-w-[60px] px-4 rounded-lg font-semibold tabular-nums motion-safe:transition-colors ${
                    selectedMinutes === min
                      ? "bg-ima-primary text-white"
                      : "bg-ima-surface border border-ima-border text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-text"
                  }`}
                  aria-pressed={selectedMinutes === min}
                >
                  {min}<span className="text-xs font-medium ml-0.5">m</span>
                </button>
              ))}
            </div>
          </div>

          {/* Break selection — available for all sessions */}
          {(
            <div className="text-center w-full">
              <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-text-muted mb-3">
                Break before next session
              </p>
              {/* Break type toggle */}
              <div className="flex gap-2 justify-center mb-3">
                {(Object.keys(WORK_TRACKER.breakOptions) as Array<"short" | "long">).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setBreakType(type);
                      setBreakMinutes(WORK_TRACKER.breakOptions[type].presets[0]);
                    }}
                    className={`min-h-[44px] px-4 rounded-lg text-sm font-medium motion-safe:transition-colors ${
                      breakType === type
                        ? "bg-ima-text text-white"
                        : "bg-ima-surface border border-ima-border text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-text"
                    }`}
                    aria-pressed={breakType === type}
                  >
                    {WORK_TRACKER.breakOptions[type].label}
                  </button>
                ))}
              </div>
              {/* Break duration presets */}
              <div className="flex gap-2 justify-center flex-wrap">
                {WORK_TRACKER.breakOptions[breakType].presets.map((min) => (
                  <button
                    key={min}
                    onClick={() => setBreakMinutes(min)}
                    className={`min-h-[44px] min-w-[52px] px-3 rounded-lg text-sm font-semibold tabular-nums motion-safe:transition-colors ${
                      breakMinutes === min
                        ? "bg-ima-surface-accent text-ima-primary border border-ima-primary"
                        : "bg-ima-surface border border-ima-border text-ima-text-muted hover:bg-ima-surface-light hover:text-ima-text"
                    }`}
                    aria-pressed={breakMinutes === min}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start button — full-width CTA; committed ima-primary, shadow on hover only */}
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full max-w-md bg-ima-primary text-white rounded-xl px-8 min-h-[60px] text-base font-semibold tracking-tight hover:bg-ima-primary-hover hover:shadow-card-hover disabled:opacity-50 motion-safe:transition-all duration-200 ease-out"
          >
            {isLoading ? "Starting\u2026" : `Begin session ${String(nextCycleNumber).padStart(2, "0")}`}
          </button>
        </div>
      )}

      {/* Active timer — this becomes the single focal point; the day's total demotes to summary */}
      {activeSession && (
        <div className="flex flex-col items-center gap-6 mb-8">
          {/* Recording signal — motion-safe so reduced-motion users see a static dot */}
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-primary">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-ima-primary opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ima-primary" />
            </span>
            In progress
          </div>

          <WorkTimer
            sessionId={activeSession.id}
            startedAt={activeSession.started_at}
            cycleNumber={activeSession.cycle_number}
            totalSeconds={(activeSession.session_minutes ?? WORK_TRACKER.defaultSessionMinutes) * 60}
            onComplete={() => handleComplete(activeSession.id)}
          />

          {/* Action buttons — Complete is the committed action, Pause/Abandon stay restrained */}
          <div className="flex items-center gap-3 flex-wrap justify-center w-full max-w-md">
            <button
              onClick={() => handleComplete(activeSession.id)}
              disabled={isLoading}
              className="flex-1 basis-48 bg-ima-success text-white rounded-xl px-6 min-h-[56px] text-base font-semibold hover:bg-ima-success/90 hover:shadow-card-hover disabled:opacity-50 motion-safe:transition-all duration-200 ease-out"
            >
              Complete session
            </button>
            <button
              onClick={() => handlePause(activeSession.id)}
              disabled={isLoading}
              className="flex-1 basis-32 bg-ima-surface border border-ima-border text-ima-text rounded-xl px-6 min-h-[56px] font-medium hover:bg-ima-surface-light disabled:opacity-50 motion-safe:transition-colors"
            >
              Pause
            </button>
            <button
              onClick={() => handleAbandon(activeSession.id)}
              disabled={isLoading}
              className="text-ima-text-muted hover:text-ima-error hover:bg-ima-error/5 rounded-lg px-4 min-h-[44px] text-xs uppercase tracking-[0.16em] font-semibold motion-safe:transition-colors"
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
        <div className="flex flex-col items-center gap-5 mb-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-text-muted">
              {`Session ${String(pausedSession.cycle_number).padStart(2, "0")} \u00B7 Paused`}
            </p>
            <p className="text-5xl md:text-6xl font-semibold tabular-nums tracking-tight text-ima-text leading-none">
              {formatPausedRemaining(
                pausedSession.started_at,
                pausedSession.paused_at!,
                pausedSession.session_minutes ?? WORK_TRACKER.defaultSessionMinutes
              )}
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] font-medium text-ima-text-muted mt-1">
              Remaining
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center w-full max-w-md">
            <button
              onClick={() => handleResume(pausedSession.id)}
              disabled={isLoading}
              className="flex-1 basis-52 bg-ima-primary text-white rounded-xl px-6 min-h-[56px] text-base font-semibold hover:bg-ima-primary-hover hover:shadow-card-hover disabled:opacity-50 motion-safe:transition-all duration-200 ease-out"
            >
              Resume session
            </button>
            <button
              onClick={() => handleAbandon(pausedSession.id)}
              disabled={isLoading}
              className="text-ima-text-muted hover:text-ima-error hover:bg-ima-error/5 rounded-lg px-4 min-h-[44px] text-xs uppercase tracking-[0.16em] font-semibold motion-safe:transition-colors"
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

      {/* Planning mode: no plan exists yet — show PlannerUI (PLAN-01) */}
      {mode === "planning" && !activeSession && !pausedSession && phase.kind !== "break" && (
        <PlannerUI onPlanConfirmed={() => {}} />
      )}

      {/* Executing mode: plan exists, not yet fulfilled — show PlannedSessionList (D-02, PLAN-10) */}
      {mode === "executing" && !activeSession && !pausedSession && phase.kind !== "break" && phase.kind !== "working" && (
        <PlannedSessionList
          plan={parsedPlan!}
          completedCount={completedCount}
          activeSession={!!activeSession}
          pausedSession={!!pausedSession}
          isLoading={isLoading}
          onStartSession={handleStartPlanned}
        />
      )}

      {/* Motivational card — plan fulfilled, card not yet seen today (COMP-01, COMP-04) */}
      {mode === "adhoc" && !hasSeenCard && !activeSession && !pausedSession && phase.kind !== "break" && phase.kind !== "setup" && (
        <MotivationalCard
          onStartNextSession={handleStartNextSession}
          onDismiss={handleDismissCard}
        />
      )}

      {/* Ad-hoc mode: plan fulfilled, card already seen — show normal idle/setup (COMP-03) */}
      {mode === "adhoc" && hasSeenCard && phase.kind === "idle" && !activeSession && !pausedSession && (
        <div className="rounded-2xl border border-ima-border bg-ima-bg/60 p-6 md:p-8 mb-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-ima-success">
              Plan complete
            </p>
            <p className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text">
              {`Ready for session ${String(nextCycleNumber).padStart(2, "0")}`}
            </p>
            <p className="text-sm text-ima-text-secondary mb-3">
              Extra session &mdash; no daily cap
            </p>
            <button
              onClick={() => setPhase({ kind: "setup" })}
              disabled={isLoading}
              className="w-full max-w-md bg-ima-primary text-white rounded-xl px-8 min-h-[60px] text-base font-semibold tracking-tight hover:bg-ima-primary-hover hover:shadow-card-hover disabled:opacity-50 motion-safe:transition-all duration-200 ease-out"
            >
              Set up session
            </button>
          </div>
        </div>
      )}

      {/* Daily report link — only where a report route exists (student, not student_diy) */}
      {dailyReportHref && completedCount > 0 && !activeSession && !pausedSession && phase.kind !== "break" && (
        <div className="text-center mb-4">
          <Link
            href={dailyReportHref}
            className="inline-flex items-center justify-center text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary hover:text-ima-primary-hover min-h-[44px] px-3 motion-safe:transition-colors"
          >
            Submit daily report
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

        const completedOnly = visibleSessions.filter((s) => s.status === "completed").length;
        return (
          <div className="mt-10 rounded-2xl border border-ima-border bg-ima-bg/60 p-5 md:p-6">
            <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text">
                  Today&apos;s sessions
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-ima-text-muted tabular-nums">
                  {`${visibleSessions.length} logged`}
                </p>
              </div>
              {completedOnly > 0 && (
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ima-success tabular-nums">
                  {`${completedOnly} win${completedOnly !== 1 ? "s" : ""}`}
                </p>
              )}
            </div>
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
                className="mt-4 text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary hover:text-ima-primary-hover min-h-[44px] motion-safe:transition-colors"
              >
                {`Show ${hiddenCount} more session${hiddenCount !== 1 ? "s" : ""}`}
              </button>
            )}
            {showAllSessions && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllSessions(false)}
                className="mt-4 text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary hover:text-ima-primary-hover min-h-[44px] motion-safe:transition-colors"
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
