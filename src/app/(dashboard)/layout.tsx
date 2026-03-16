import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import { ROLES, type Role } from "@/lib/config";

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
    .select("role, name")
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

  return (
    <div className="min-h-screen bg-ima-bg">
      <Sidebar role={profile.role as Role} userName={profile.name} />
      <main id="main-content" className="min-h-screen pt-16 md:pt-0 md:ml-60">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
