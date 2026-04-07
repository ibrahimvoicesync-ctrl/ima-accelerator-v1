import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { DealsClient } from "@/components/student/DealsClient";
import type { Database } from "@/lib/types";

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

  return (
    <div className="px-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ima-text">My Deals</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Track your brand deal revenue and profit
        </p>
      </div>
      <DealsClient initialDeals={(deals ?? []) as Deal[]} />
    </div>
  );
}
