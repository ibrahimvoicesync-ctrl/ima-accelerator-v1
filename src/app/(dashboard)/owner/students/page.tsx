import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerStudentSearchClient } from "@/components/owner/OwnerStudentSearchClient";

export default async function OwnerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  await requireRole("owner");
  const { search } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("users")
    .select("id, name, email, status, joined_at, coach_id")
    .eq("role", "student")
    .order("name");

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data: students, error } = await query;

  if (error) {
    console.error("[owner students] Failed to load students:", error);
  }

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Students</h1>
      <p className="mt-1 text-ima-text-secondary">
        {(students ?? []).length} student{(students ?? []).length !== 1 ? "s" : ""} on the platform
      </p>
      <div className="mt-6">
        <OwnerStudentSearchClient
          students={students ?? []}
          initialSearch={search ?? ""}
        />
      </div>
    </div>
  );
}
