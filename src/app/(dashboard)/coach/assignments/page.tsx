import { ArrowLeftRight } from "lucide-react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoachAssignmentsClient } from "@/components/coach/CoachAssignmentsClient";

export default async function CoachAssignmentsPage() {
  await requireRole("coach");

  const admin = createAdminClient();

  const [studentsResult, coachesResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, status, coach_id")
      .eq("role", "student")          // D-02: student only, NOT student_diy
      .eq("status", "active")
      .order("name"),
    admin
      .from("users")
      .select("id, name")
      .eq("role", "coach")
      .eq("status", "active")
      .order("name"),
  ]);

  if (studentsResult.error) {
    console.error("[/coach/assignments] Failed to load students:", studentsResult.error);
  }
  if (coachesResult.error) {
    console.error("[/coach/assignments] Failed to load coaches:", coachesResult.error);
  }

  const students = studentsResult.data ?? [];
  const coaches = coachesResult.data ?? [];

  // Build coach -> student count mapping from students data
  const coachStudentCounts: Record<string, number> = {};
  for (const student of students) {
    if (student.coach_id) {
      coachStudentCounts[student.coach_id] = (coachStudentCounts[student.coach_id] ?? 0) + 1;
    }
  }

  const coachOptions = coaches.map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: coachStudentCounts[c.id] ?? 0,
  }));

  return (
    <div className="space-y-6 px-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Assignments</h1>
        </div>
        <p className="text-sm text-ima-text-secondary">
          Assign and reassign students across coaches.
        </p>
      </div>
      <CoachAssignmentsClient students={students} coaches={coachOptions} />
    </div>
  );
}
