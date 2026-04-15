/**
 * Phase 54: Owner homepage analytics teaser (server component, per D-03).
 *
 * Renders a single "Analytics" card with three compact top-1 rows (hours,
 * profit, deals) and a "View full analytics →" link to /owner/analytics.
 *
 * Shares the getOwnerAnalyticsCached() call with the full /owner/analytics
 * page. Both surfaces use the identical cache key ["owner-analytics"], so
 * within the 60s TTL only ONE Postgres RPC fires regardless of how many
 * surfaces render the data.
 *
 * Empty state: when no leaderboard has a #1 entry, render a reassuring compact
 * EmptyState inside the same card instead of three empty rows.
 */

import Link from "next/link";
import { Clock, DollarSign, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOwnerAnalyticsCached } from "@/lib/rpc/owner-analytics";

export async function OwnerAnalyticsTeaser() {
  const payload = await getOwnerAnalyticsCached();

  // Only show the #1 entry per leaderboard — the teaser is deliberately compact.
  const topHours = payload.leaderboards.hours_alltime[0];
  const topProfit = payload.leaderboards.profit_alltime[0];
  const topDeals = payload.leaderboards.deals_alltime[0];

  const hasAnyTop = Boolean(topHours || topProfit || topDeals);

  return (
    <Card aria-labelledby="owner-analytics-teaser-h2">
      <CardContent className="p-4">
        <div className="mb-3">
          <h2
            id="owner-analytics-teaser-h2"
            className="text-base font-semibold text-ima-text"
          >
            Analytics
          </h2>
          <p className="text-xs text-ima-text-secondary mt-1">
            Top performer in each category (lifetime)
          </p>
        </div>

        {!hasAnyTop ? (
          <EmptyState
            variant="compact"
            title="No activity yet"
            description="Top performers will appear once students start logging hours and deals."
          />
        ) : (
          <ul className="space-y-1">
            <TeaserRow
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label="Hours"
              row={topHours}
            />
            <TeaserRow
              icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
              label="Profit"
              row={topProfit}
            />
            <TeaserRow
              icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
              label="Deals"
              row={topDeals}
            />
          </ul>
        )}

        <div className="mt-4 pt-3 border-t border-ima-border">
          <Link
            href="/owner/analytics"
            className="inline-flex items-center gap-1 text-sm font-medium text-ima-primary hover:underline min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 rounded"
            aria-label="View full owner analytics"
          >
            View full analytics
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

type TeaserRowInput = {
  student_id: string;
  student_name: string;
  metric_display: string;
};

function TeaserRow({
  icon,
  label,
  row,
}: {
  icon: React.ReactNode;
  label: string;
  row: TeaserRowInput | undefined;
}) {
  if (!row) {
    return (
      <li>
        <div className="flex items-center gap-3 p-2 text-sm text-ima-text-muted">
          <span className="text-ima-text-muted shrink-0" aria-hidden="true">
            {icon}
          </span>
          <span className="flex-1">{label}</span>
          <span className="text-xs italic shrink-0">No data yet</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={`/owner/students/${row.student_id}`}
        aria-label={`${label}: #1 ${row.student_name} — ${row.metric_display}`}
        className="flex items-center gap-3 p-2 rounded-md motion-safe:transition-colors hover:bg-ima-surface-light min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2"
      >
        <span className="text-ima-primary shrink-0" aria-hidden="true">
          {icon}
        </span>
        <span className="text-xs font-semibold text-ima-text-secondary shrink-0 w-12">
          {label}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-ima-primary text-white text-[10px] font-semibold tabular-nums shrink-0">
          #1
        </span>
        <span className="flex-1 text-sm font-medium text-ima-text truncate">
          {row.student_name}
        </span>
        <span className="text-sm font-semibold text-ima-text tabular-nums shrink-0">
          {row.metric_display}
        </span>
      </Link>
    </li>
  );
}
