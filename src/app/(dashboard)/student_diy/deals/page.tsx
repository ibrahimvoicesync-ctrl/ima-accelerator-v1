import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DealsClient } from "@/components/student/DealsClient";
import type { Database } from "@/lib/types";
import type { LoggedByUser } from "@/lib/deals-attribution";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

export default async function StudentDiyDealsPage() {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();

  const { data: deals, error } = await admin
    .from("deals")
    .select("*")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[student_diy deals page] Failed to load deals:", error);
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
    <div className="px-4 py-2 max-w-7xl mx-auto">
      {/* Editorial-restrained header — stitch-blend treatment */}
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted mb-3">
          Deals
        </p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-ima-text leading-[0.95]">
          Brand deals.
        </h1>
        <p className="mt-3 text-sm md:text-base text-ima-text-secondary max-w-2xl">
          Track revenue and profit from every deal you close.
        </p>
      </header>
      <DealsClient
        initialDeals={(deals ?? []) as Deal[]}
        viewerId={user.id}
        viewerRole="student_diy"
        userMap={userMap}
      />
    </div>
  );
}
