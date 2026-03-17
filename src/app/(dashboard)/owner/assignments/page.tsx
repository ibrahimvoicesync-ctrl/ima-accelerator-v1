import { ArrowLeftRight } from "lucide-react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerAssignmentsClient } from "@/components/owner/OwnerAssignmentsClient";
import { Card, CardContent } from "@/components/ui/Card";

export default async function OwnerAssignmentsPage() {
  await requireRole("owner");

  const admin = createAdminClient();

  const [studentsResult, coachesResult] = await Promise.all([
    admin
      .from("users")
      .select("id, name, email, status, coach_id")
      .eq("role", "student")
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
    console.error("[/owner/assignments] Failed to load students:", studentsResult.error);
  }
  if (coachesResult.error) {
    console.error("[/owner/assignments] Failed to load coaches:", coachesResult.error);
  }

  const students = studentsResult.data ?? [];
  const coaches = coachesResult.data ?? [];

  // Build coach → student count mapping from students data
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

  const totalStudents = students.length;
  const assignedStudents = students.filter((s) => s.coach_id !== null).length;
  const unassignedStudents = totalStudents - assignedStudents;

  return (
    <div className="space-y-6 px-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Assignments</h1>
        </div>
        <p className="text-sm text-ima-text-secondary">
          Manage coach-student assignments across the platform.
        </p>
      </div>

      {/* Stat Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-ima-text">{totalStudents}</p>
            <p className="text-xs text-ima-text-secondary mt-0.5">Total Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-ima-text">{assignedStudents}</p>
            <p className="text-xs text-ima-text-secondary mt-0.5">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-ima-text">{unassignedStudents}</p>
            <p className="text-xs text-ima-text-secondary mt-0.5">Unassigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Assignments Manager */}
      <OwnerAssignmentsClient students={students} coaches={coachOptions} />
    </div>
  );
}
