/**
 * Phase 54: Owner Analytics page (server component).
 *
 * Single batch RPC `get_owner_analytics` (migration 00028) wrapped in
 * unstable_cache(60s, tag=owner-analytics) drives three lifetime top-3
 * leaderboards: hours worked, profit earned, deals closed.
 *
 * Each row links to /owner/students/[studentId] per OA-06. Cache invalidation
 * is wired in Plan 04 across the four mutation routes.
 *
 * Per CLAUDE.md Hard Rules: ima-* tokens only, 44px touch targets, aria labels
 * on interactive elements (inherited from LeaderboardCard), admin client on the
 * server only (via getOwnerAnalyticsCached → owner-analytics.ts which imports
 * "server-only"), never swallow errors (error.tsx handles RPC failures).
 */

import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LeaderboardCard,
  type LeaderboardRow,
} from "@/components/analytics/LeaderboardCard";
import { getOwnerAnalyticsCached } from "@/lib/rpc/owner-analytics";

// Align route-level revalidation with the RPC cache TTL.
export const revalidate = 60;

export default async function OwnerAnalyticsPage() {
  await requireRole("owner");

  const payload = await getOwnerAnalyticsCached();

  const hoursRows: LeaderboardRow[] = payload.leaderboards.hours_alltime.map(
    (r) => ({
      rank: r.rank,
      student_id: r.student_id,
      student_name: r.student_name,
      metric_display: r.metric_display,
    }),
  );

  const profitRows: LeaderboardRow[] = payload.leaderboards.profit_alltime.map(
    (r) => ({
      rank: r.rank,
      student_id: r.student_id,
      student_name: r.student_name,
      metric_display: r.metric_display,
    }),
  );

  const dealsRows: LeaderboardRow[] = payload.leaderboards.deals_alltime.map(
    (r) => ({
      rank: r.rank,
      student_id: r.student_id,
      student_name: r.student_name,
      metric_display: r.metric_display,
    }),
  );

  // Zero-data fallback — every leaderboard is empty. Render a single reassuring
  // EmptyState on the page body instead of three empty cards.
  const hasAnyData =
    hoursRows.length + profitRows.length + dealsRows.length > 0;

  return (
    <section
      aria-labelledby="owner-analytics-h1"
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      <h1
        id="owner-analytics-h1"
        className="text-2xl font-bold text-ima-text"
      >
        Owner Analytics
      </h1>
      <p className="mt-1 text-sm text-ima-text-secondary">
        Lifetime leaderboards across all students.
      </p>

      {!hasAnyData ? (
        <div className="mt-6">
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
                title="No activity yet"
                description="Leaderboards will appear once students log hours, close deals, or earn profit."
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <LeaderboardCard
            headingId="owner-lb-hours"
            heading="Top 3 Students by Hours Worked"
            subheading="Lifetime total — completed work sessions"
            rows={hoursRows}
            emptyHeading="No hours logged yet"
            emptyBody="Students appear here once they complete a work session."
            hrefPrefix="/owner/students/"
          />
          <LeaderboardCard
            headingId="owner-lb-profit"
            heading="Top 3 Students by Profit Earned"
            subheading="Lifetime total — all closed deals"
            rows={profitRows}
            emptyHeading="No profit recorded yet"
            emptyBody="Students appear here once they log a deal with profit."
            hrefPrefix="/owner/students/"
          />
          <LeaderboardCard
            headingId="owner-lb-deals"
            heading="Top 3 Students by Deals Closed"
            subheading="Lifetime count — all closed deals"
            rows={dealsRows}
            emptyHeading="No deals closed yet"
            emptyBody="Students appear here once they log a deal."
            hrefPrefix="/owner/students/"
          />
        </div>
      )}
    </section>
  );
}
