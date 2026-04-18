import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerAlertsClient, type AlertItem } from "@/components/owner/OwnerAlertsClient";
import { Bell, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

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

  const totalCount = alerts.length;
  const activeCount = alerts.filter((a) => !a.dismissed).length;
  const dismissedCount = alerts.filter((a) => a.dismissed).length;
  const totalRevenue = deals.reduce((sum, d) => sum + Number(d.revenue), 0);
  const revenueLabel = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(totalRevenue);

  const statCards = [
    {
      label: "Revenue (30d)",
      value: revenueLabel,
      icon: DollarSign,
      iconBg: "bg-[#E2F5E9]",
      iconColor: "text-[#16A34A]",
    },
    {
      label: "Deals Closed",
      value: String(totalCount),
      icon: TrendingUp,
      iconBg: "bg-[#E8EEFF]",
      iconColor: "text-[#4A6CF7]",
    },
    {
      label: "Active",
      value: String(activeCount),
      icon: Bell,
      iconBg: "bg-[#FDF3E0]",
      iconColor: "text-[#D97706]",
    },
    {
      label: "Dismissed",
      value: String(dismissedCount),
      icon: CheckCircle2,
      iconBg: "bg-[#F1EEE6]",
      iconColor: "text-[#7A7466]",
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
            Alerts
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Deal closures this month
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Monitor closed deals from the last 30 days.
          </p>
        </header>

        {/* Stats row — 4 cards */}
        <section
          aria-label="Alert totals"
          className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] motion-safe:animate-fadeIn"
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
                <p className="text-[24px] font-bold leading-none tabular-nums text-[#1A1A17]">
                  {s.value}
                </p>
                <p className="mt-[6px] text-[12px] text-[#8A8474]">{s.label}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Filter + feed */}
        <div
          className="mt-8 motion-safe:animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <OwnerAlertsClient initialAlerts={alerts} />
        </div>
      </div>
    </div>
  );
}
