import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ROLE_REDIRECTS, type Role } from "@/lib/config";

export type SessionUser = {
  authId: string;
  id: string;
  email: string;
  name: string;
  role: Role;
  coachId: string | null;
};

/**
 * Gets the authenticated user with their platform profile.
 * Redirects to /login if not authenticated, /no-access if no profile.
 * Use in server components that require auth.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("users")
    .select("id, email, name, role, coach_id")
    .eq("auth_id", user.id)
    .single();

  if (error) {
    console.error("[session] Failed to load profile:", error);
  }

  if (!profile) redirect("/no-access");

  return {
    authId: user.id,
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role as Role,
    coachId: profile.coach_id,
  };
}

/**
 * Like getSessionUser but also enforces role access.
 * Redirects to the user's role dashboard if their role is not in the allowed list.
 */
export async function requireRole(
  allowed: Role | Role[]
): Promise<SessionUser> {
  const user = await getSessionUser();
  const roles = Array.isArray(allowed) ? allowed : [allowed];

  if (!roles.includes(user.role)) {
    redirect(ROLE_REDIRECTS[user.role]);
  }

  return user;
}
