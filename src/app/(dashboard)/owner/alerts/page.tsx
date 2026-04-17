import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerAlertsClient, type AlertItem } from "@/components/owner/OwnerAlertsClient";
import { Bell } from "lucide-react";

export default async function OwnerAlertsPage() {
  const user = await requireRole("owner");
  const admin = createAdminClient();

  // Phase 65 (F4): The feed lists exactly one `deal_closed` alert per deal
  // closed in the trailing 30-day window. All 4 legacy alert types
  // (student_inactive / student_dropoff / unreviewed_reports /
  // coach_underperforming) are silently pruned — no tombstone, no legacy
  // counters, no deprecated copy.
  const now = new Date();
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString();

  // --- Parallel data fetches ---
  const [dealsResult, dismissalsResult] = await Promise.all([
    admin
      .from("deals")
      .select("id, student_id, revenue, created_at, users!deals_student_id_fkey ( id, name )")
      .gte("created_at", thirtyDaysAgoIso)
      .order("created_at", { ascending: false }),
    admin
      .from("alert_dismissals")
      .select("alert_key")
      .eq("owner_id", user.id),
  ]);

  if (dealsResult.error) console.error("[owner alerts] deals fetch error:", dealsResult.error);
  if (dismissalsResult.error) console.error("[owner alerts] dismissals fetch error:", dismissalsResult.error);

  const deals = dealsResult.data ?? [];
  const dismissedKeys = new Set((dismissalsResult.data ?? []).map((d) => d.alert_key));

  // --- Map deals → AlertItem[] ---
  const alerts: AlertItem[] = deals.map((d) => {
    // The embedded FK join `users!deals_student_id_fkey` returns a single row,
    // but PostgREST may surface it as either an object or a 1-element array
    // depending on the client version. Normalize both.
    const rawUser = (d as { users?: { id: string; name: string } | { id: string; name: string }[] | null }).users;
    const studentRow = Array.isArray(rawUser) ? rawUser[0] : rawUser;
    const studentName = studentRow?.name ?? "Unknown student";
    const key = `deal_closed:${d.id}`;
    const revenueFormatted = Number(d.revenue).toLocaleString("en-US", { maximumFractionDigits: 0 });
    return {
      key,
      type: "deal_closed",
      severity: "info",
      title: studentName,
      message: `Closed a $${revenueFormatted} deal`,
      subjectId: d.student_id,
      subjectName: studentName,
      triggeredAt: d.created_at,
      dismissed: dismissedKeys.has(key),
    };
  });

  // Sort: active first (dismissed last), then by triggeredAt DESC
  alerts.sort((a, b) => {
    if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
    return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
  });

  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;

  return (
    <div className="space-y-6 px-4">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Bell className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-ima-text">Alerts</h1>
          {activeAlertCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-ima-success/10 text-ima-success">
              {activeAlertCount} active
            </span>
          )}
        </div>
        <p className="text-sm text-ima-text-secondary">
          Monitor closed deals across all students.
        </p>
      </div>

      <OwnerAlertsClient initialAlerts={alerts} />
    </div>
  );
}
