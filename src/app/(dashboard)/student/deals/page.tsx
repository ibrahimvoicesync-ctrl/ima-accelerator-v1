import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DealsClient } from "@/components/student/DealsClient";
import type { Database } from "@/lib/types";
import type { LoggedByUser } from "@/lib/deals-attribution";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

export default async function StudentDealsPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const { data: deals, error } = await admin
    .from("deals")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[student deals page] Failed to load deals:", error);
  }

  // Phase 49: resolve logged_by id -> { name, role } for the attribution chip.
  const loggedByIds = Array.from(
    new Set(
      (deals ?? [])
        .map((d) => d.logged_by)
        .filter((id): id is string => typeof id === "string")
    )
  );
  const { data: loggedByUsers } =
    loggedByIds.length > 0
      ? await admin
          .from("users")
          .select("id, name, role")
          .in("id", loggedByIds)
      : { data: [] as { id: string; name: string; role: string }[] };
  const userMap: Record<string, LoggedByUser> = {};
  for (const u of loggedByUsers ?? []) {
    userMap[u.id] = {
      id: u.id,
      name: u.name,
      role: u.role as LoggedByUser["role"],
    };
  }

  return (
    <div className="px-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ima-text">My Deals</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Track your brand deal revenue and profit
        </p>
      </div>
      <DealsClient
        initialDeals={(deals ?? []) as Deal[]}
        viewerId={user.id}
        viewerRole="student"
        userMap={userMap}
      />
    </div>
  );
}
