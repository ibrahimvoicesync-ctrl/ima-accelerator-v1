import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkTrackerClient } from "@/components/student/WorkTrackerClient";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];

export default async function StudentDiyWorkPage() {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions, error } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("[student_diy work page] Failed to load sessions:", error);
  }

  const { data: plan, error: planError } = await admin
    .from("daily_plans")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (planError) {
    console.error("[student_diy work page] Failed to load daily plan:", planError);
  }

  return (
    <div className="max-w-3xl mx-auto px-4">
      {/* Editorial-restrained header — lets WorkTrackerClient's hours-today metric own the focal point */}
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
          Work Tracker
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ima-text leading-[0.95]">
          Today&apos;s focus.
        </h1>
        <p className="mt-3 text-sm md:text-base text-ima-text-secondary max-w-2xl">
          Plan it, run it, log it.
        </p>
      </header>
      <WorkTrackerClient
        initialSessions={(sessions ?? []) as WorkSession[]}
        initialPlan={(plan ?? null) as DailyPlan | null}
      />
    </div>
  );
}
