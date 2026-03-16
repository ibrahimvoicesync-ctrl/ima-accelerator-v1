import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkTrackerClient } from "@/components/student/WorkTrackerClient";
import type { Database } from "@/lib/types";

type WorkSession = Database["public"]["Tables"]["work_sessions"]["Row"];

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

  return (
    <div className="max-w-2xl mx-auto px-4">
      <h1 className="text-2xl font-bold text-ima-text mb-1">Work Tracker</h1>
      <p className="text-sm text-ima-text-secondary mb-6">
        Track your daily 45-minute work cycles
      </p>
      <WorkTrackerClient initialSessions={(sessions ?? []) as WorkSession[]} />
    </div>
  );
}
