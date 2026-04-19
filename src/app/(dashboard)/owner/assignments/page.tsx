import { JetBrains_Mono } from "next/font/google";
import { Users, UserCheck, UserX } from "lucide-react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerAssignmentsClient } from "@/components/owner/OwnerAssignmentsClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

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

  const statCards = [
    {
      label: "Total Students",
      value: String(totalStudents),
      icon: Users,
      iconBg: "bg-[#E8EEFF]",
      iconColor: "text-[#4A6CF7]",
    },
    {
      label: "Assigned",
      value: String(assignedStudents),
      icon: UserCheck,
      iconBg: "bg-[#E2F5E9]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: "Unassigned",
      value: String(unassignedStudents),
      icon: UserX,
      iconBg: "bg-[#FDF3E0]",
      iconColor: "text-[#D97706]",
    },
  ];

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Masthead */}
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Assignments
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-semibold leading-[1.05] text-[#1A1A17] tracking-[-0.02em]">
            Match students to coaches
          </h1>
          <p className="mt-2 max-w-[58ch] text-[15px] text-[#7A7466] leading-[1.55]">
            Manage coach-student assignments across the platform.
          </p>
        </header>

        {/* Stats row */}
        <section
          aria-label="Assignment totals"
          className="mt-9 grid grid-cols-1 sm:grid-cols-3 gap-[14px] motion-safe:animate-fadeIn"
          style={{ animationDelay: "50ms" }}
        >
          {statCards.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 bg-white border border-[#EDE9E0] rounded-[12px] px-[18px] py-[16px] min-h-[72px]"
            >
              <div
                className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${s.iconBg}`}
              >
                <s.icon
                  className={`h-[18px] w-[18px] ${s.iconColor}`}
                  aria-hidden="true"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[24px] font-semibold leading-none tabular-nums slashed-zero tracking-[-0.01em] text-[#1A1A17]">
                  {s.value}
                </p>
                <p
                  className="mt-[6px] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8474]"
                  style={{ fontFamily: "var(--font-mono-bold)" }}
                >
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Assignment manager */}
        <div
          className="mt-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <OwnerAssignmentsClient students={students} coaches={coachOptions} />
        </div>
      </div>
    </div>
  );
}
