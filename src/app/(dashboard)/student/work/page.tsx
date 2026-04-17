import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkTrackerClient } from "@/components/student/WorkTrackerClient";
import { ROUTES } from "@/lib/config";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];
type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];

export default async function WorkPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions, error } = await admin
    .from("work_sessions")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .order("cycle_number", { ascending: true });

  if (error) {
    console.error("[work page] Failed to load sessions:", error);
  }

  const { data: plan, error: planError } = await admin
    .from("daily_plans")
    .select("*")
    .eq("student_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (planError) {
    console.error("[work page] Failed to load daily plan:", planError);
  }

  return (
    <div className="max-w-3xl mx-auto px-4">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-2">
          Work Tracker
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text">
          Today&apos;s focus
        </h1>
      </div>
      <WorkTrackerClient
        initialSessions={(sessions ?? []) as WorkSession[]}
        initialPlan={(plan ?? null) as DailyPlan | null}
        dailyReportHref={ROUTES.student.report}
      />
    </div>
  );
}
