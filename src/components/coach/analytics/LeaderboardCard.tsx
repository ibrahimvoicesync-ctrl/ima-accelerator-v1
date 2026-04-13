/**
 * Phase 48: Single leaderboard card. Instanced 3x for hours/emails/deals.
 *
 * Reuses the avatar circle + rank-1 badge geometry from Phase 47. Empty state
 * via the existing EmptyState primitive. Each row links to the student detail
 * page with min-h-[44px] and a focus-visible ring.
 */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export type LeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  metric_display: string;
};

type LeaderboardCardProps = {
  heading: string;
  subheading: string;
  rows: LeaderboardRow[];
  emptyHeading: string;
  emptyBody: string;
  // Used to give the heading + aria-labelledby a stable unique id.
  headingId: string;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function LeaderboardCard({
  heading,
  subheading,
  rows,
  emptyHeading,
  emptyBody,
  headingId,
}: LeaderboardCardProps) {
  return (
    <Card aria-labelledby={headingId}>
      <CardContent className="p-4">
        <div className="mb-4">
          <h2
            id={headingId}
            className="text-base font-semibold text-ima-text"
          >
            {heading}
          </h2>
          <p className="text-xs text-ima-text-secondary mt-1">{subheading}</p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            variant="compact"
            title={emptyHeading}
            description={emptyBody}
          />
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.student_id}>
                <Link
                  href={`/coach/students/${row.student_id}`}
                  aria-label={`View ${row.student_name} — ${row.metric_display}`}
                  className="flex items-center gap-3 p-3 rounded-lg motion-safe:transition-colors hover:bg-ima-surface-light min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2"
                >
                  {row.rank === 1 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-ima-primary text-white text-xs font-semibold tabular-nums shrink-0">
                      #1
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-ima-text-muted tabular-nums w-6 text-center shrink-0">
                      #{row.rank}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-ima-primary flex items-center justify-center text-xs font-semibold text-white shrink-0"
                  >
                    {getInitials(row.student_name)}
                  </span>
                  <span className="flex-1 text-sm font-medium text-ima-text truncate">
                    {row.student_name}
                  </span>
                  <span className="text-sm font-semibold text-ima-text tabular-nums shrink-0">
                    {row.metric_display}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
