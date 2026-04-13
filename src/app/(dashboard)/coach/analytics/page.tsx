/**
 * Phase 48: Full Coach Analytics Page (server component).
 *
 * Single batch RPC `get_coach_analytics` (migration 00025) wrapped in
 * unstable_cache(60s) drives 5 KPIs, 3 top-5 leaderboards, a 12-week deals
 * trend chart, an Active/Inactive header chip, and a paginated/searchable/
 * sortable student list with CSV export.
 *
 * Per CLAUDE.md hard rules: ima-* tokens only (no hex except chartColors in
 * the chart component), motion-safe: on every animation, min-h-[44px] on every
 * interactive element, admin client only on the server, never swallow errors.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getTodayUTC } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import {
  getCoachAnalyticsCached,
  COACH_ANALYTICS_PAGE_SIZE,
} from "@/lib/rpc/coach-analytics";
import { parseCoachAnalyticsSearchParams } from "@/lib/schemas/coach-analytics-params";
import { CoachAnalyticsClient } from "@/components/coach/analytics/CoachAnalyticsClient";

// Align the route-level revalidation with the RPC cache TTL.
export const revalidate = 60;

export default async function CoachAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole("coach");

  const raw = await searchParams;
  const parsed = parseCoachAnalyticsSearchParams(raw);
  if (!parsed.ok) {
    redirect("/coach/analytics");
  }

  const today = getTodayUTC();

  const payload = await getCoachAnalyticsCached(user.id, {
    page: parsed.value.page,
    pageSize: COACH_ANALYTICS_PAGE_SIZE,
    sort: parsed.value.sort,
    search: parsed.value.search,
    windowDays: 7,
    today,
    leaderboardLimit: 5,
  });

  // Detect zero-assigned-students state. The RPC returns total=0 with empty
  // arrays AND zero active+inactive only when no students exist for the coach.
  // (A search yielding zero results still has active+inactive > 0 if any
  // students are assigned.)
  const hasNoAssignedStudents =
    !parsed.value.search &&
    payload.pagination.total === 0 &&
    payload.active_inactive.active === 0 &&
    payload.active_inactive.inactive === 0;

  if (hasNoAssignedStudents) {
    return (
      <div className="px-4 py-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-ima-text">Coach Analytics</h1>
        <p className="mt-1 text-sm text-ima-text-secondary">
          Aggregate stats across your assigned students.
        </p>
        <div className="mt-6">
          <Card>
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
              title="No students assigned"
              description="Analytics will appear once students join your cohort."
              action={
                <Link
                  href="/coach/invites"
                  className={buttonVariants({ variant: "primary" })}
                >
                  Invite Students
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="coach-analytics-h1"
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      <CoachAnalyticsClient
        payload={payload}
        initialParams={parsed.value}
      />
    </section>
  );
}
