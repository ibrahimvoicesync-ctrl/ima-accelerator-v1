import { Suspense } from "react";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGreeting } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { GraduationCap, Shield, Users, FileText } from "lucide-react";
import Link from "next/link";
import type { OwnerDashboardStats } from "@/lib/rpc/types";
import { OwnerAnalyticsTeaser } from "@/components/owner/analytics/OwnerAnalyticsTeaser";

export default async function OwnerDashboard() {
  const user = await requireRole("owner");
  const admin = createAdminClient();
  const firstName = user.name.split(" ")[0];

  const { data, error } = await admin.rpc("get_owner_dashboard_stats");
  if (error) {
    console.error("[owner dashboard] RPC failed:", error);
  }
  const stats = (data as OwnerDashboardStats) ?? {
    total_students: 0,
    total_coaches: 0,
    active_today_count: 0,
    reports_today: 0,
  };

  return (
    <div className="px-4">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-ima-text">
        {getGreeting()}, {firstName}!
      </h1>
      <p className="mt-1 text-ima-text-secondary">Platform overview</p>

      {/* Phase 54: Analytics teaser (streams in independently of stats grid) */}
      <div className="mt-6">
        <Suspense fallback={<OwnerAnalyticsTeaserSkeleton />}>
          <OwnerAnalyticsTeaser />
        </Suspense>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* Total Students — clickable */}
        <Link href="/owner/students" className="min-h-[44px] block">
          <Card interactive>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
                <GraduationCap
                  className="h-5 w-5 text-ima-primary"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-ima-text">
                  {stats.total_students}
                </p>
                <p className="text-xs text-ima-text-secondary">Total Students</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Total Coaches — clickable */}
        <Link href="/owner/coaches" className="min-h-[44px] block">
          <Card interactive>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
                <Shield
                  className="h-5 w-5 text-ima-primary"
                  aria-hidden="true"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-ima-text">
                  {stats.total_coaches}
                </p>
                <p className="text-xs text-ima-text-secondary">Total Coaches</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Active Today — display only */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <Users
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {stats.active_today_count}
              </p>
              <p className="text-xs text-ima-text-secondary">Active Today</p>
            </div>
          </CardContent>
        </Card>

        {/* Reports Today — display only */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-ima-primary/10 flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-ima-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-ima-text">
                {stats.reports_today}
              </p>
              <p className="text-xs text-ima-text-secondary">Reports Today</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OwnerAnalyticsTeaserSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="rounded-lg border border-ima-border bg-ima-surface p-4"
    >
      <div className="h-5 w-24 rounded bg-ima-surface-light motion-safe:animate-pulse" />
      <div className="mt-1 h-3 w-56 rounded bg-ima-surface-light motion-safe:animate-pulse" />
      <div className="mt-3 space-y-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-11 rounded bg-ima-surface-light motion-safe:animate-pulse"
          />
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-ima-border">
        <div className="h-5 w-32 rounded bg-ima-surface-light motion-safe:animate-pulse" />
      </div>
      <span className="sr-only">Loading analytics teaser…</span>
    </div>
  );
}
