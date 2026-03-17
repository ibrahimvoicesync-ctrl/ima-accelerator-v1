import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { ROLES, COACH_CONFIG, type Role } from "@/lib/config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Admin client bypasses RLS — needed because RLS policies use
  // get_user_role() which can fail during profile resolution
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, role, name")
    .eq("auth_id", user.id)
    .single();

  if (error || !profile) {
    if (error) console.error("[dashboard layout] Failed to load profile:", error);
    redirect("/no-access");
  }

  const validRoles = Object.values(ROLES) as string[];
  if (!validRoles.includes(profile.role)) {
    redirect("/no-access");
  }

  // Compute sidebar badge counts for coach role
  let badgeCounts: Record<string, number> = {};
  if (profile.role === "coach") {
    const studentsResult = await admin
      .from("users")
      .select("id")
      .eq("role", "student")
      .eq("coach_id", profile.id)
      .eq("status", "active");

    const studentIds = (studentsResult.data ?? []).map((s) => s.id);

    if (studentIds.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const nowMs = new Date(today + "T23:59:59Z").getTime();
      const sevenDaysAgo = new Date(
        nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split("T")[0];

      const { count } = await admin
        .from("daily_reports")
        .select("*", { count: "exact", head: true })
        .in("student_id", studentIds)
        .gte("date", sevenDaysAgo)
        .is("reviewed_by", null)
        .not("submitted_at", "is", null);

      badgeCounts = { unreviewed_reports: count ?? 0 };
    }
  }

  return (
    <div className="min-h-screen bg-ima-bg">
      <Sidebar role={profile.role as Role} userName={profile.name} badgeCounts={badgeCounts} />
      <main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
        <ToastProvider>
          <div className="p-4 md:p-8">{children}</div>
        </ToastProvider>
      </main>
    </div>
  );
}
