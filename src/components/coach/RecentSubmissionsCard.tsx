import Link from "next/link";
import { Star, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CoachRecentReport } from "@/lib/rpc/coach-dashboard-types";

type Props = {
  reports: CoachRecentReport[];
  /** Server-derived "now" in ms — caller passes a stable value to avoid hydration drift. */
  nowMs: number;
};

function formatRelative(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = nowMs - t;
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function RecentSubmissionsCard({ reports, nowMs }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ima-text">Recent Submissions</h2>
            <p className="text-xs text-ima-text-secondary">
              3 most recent reports from your students
            </p>
          </div>
          <Link
            href="/coach/reports"
            className="text-sm text-ima-primary hover:underline min-h-[44px] inline-flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2 rounded-md px-2"
          >
            See all reports
          </Link>
        </div>

        {reports.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            title="No submissions yet"
            description="Reports from your students will appear here as soon as they log their day."
          />
        ) : (
          <ul className="space-y-1">
            {reports.map((r) => {
              const rating = r.star_rating ?? 0;
              const rel = formatRelative(r.submitted_at, nowMs);
              return (
                <li key={r.id}>
                  <Link
                    href={`/coach/reports#${r.id}`}
                    aria-label={`${r.student_name} submitted a report, rated ${rating} of 5 stars, ${rel}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-ima-surface-light motion-safe:transition-colors min-h-[44px] focus-visible:outline-2 focus-visible:outline-ima-primary focus-visible:outline-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ima-text truncate">
                        {r.student_name}
                      </p>
                      <p className="text-xs text-ima-text-secondary">{rel}</p>
                    </div>
                    <div
                      className="flex items-center gap-0.5 shrink-0"
                      aria-hidden="true"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={
                            n <= rating
                              ? "h-4 w-4 text-ima-warning fill-ima-warning"
                              : "h-4 w-4 text-ima-border"
                          }
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
