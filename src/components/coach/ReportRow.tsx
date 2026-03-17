import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CheckCircle } from "lucide-react";
import type { ReportItem } from "@/components/coach/CoachReportsClient";

type Props = {
  report: ReportItem;
  studentName: string;
  onToggleReview: (reportId: string, currentlyReviewed: boolean) => void;
  isReviewing: boolean;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function StarDisplay({ rating }: { rating: number | null }) {
  const filled = rating ?? 0;
  const stars = Array.from({ length: 5 }, (_, i) => i < filled);
  const label = rating ? `${rating} out of 5 stars` : "No rating";

  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex gap-0.5"
    >
      {stars.map((isFilled, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={isFilled ? "text-ima-warning" : "text-ima-text-muted"}
        >
          {isFilled ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

export function ReportRow({
  report,
  studentName,
  onToggleReview,
  isReviewing,
}: Props) {
  const isReviewed = report.reviewed_by !== null;

  return (
    <Card>
      <details>
        <summary className="list-none cursor-pointer">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3 min-h-[44px]">
              {/* Student name + date */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ima-text truncate">
                  {studentName}
                </p>
                <p className="text-xs text-ima-text-secondary">
                  {formatDate(report.date)}
                </p>
              </div>

              {/* Stars */}
              <StarDisplay rating={report.star_rating} />

              {/* Hours + Outreach */}
              <div className="flex items-center gap-3 text-xs text-ima-text-secondary">
                <span>
                  <span className="font-medium text-ima-text">
                    {typeof report.hours_worked === "number"
                      ? report.hours_worked.toFixed(1)
                      : "0.0"}
                  </span>
                  h
                </span>
                <span>
                  <span className="font-medium text-ima-text">
                    {report.outreach_count}
                  </span>{" "}
                  outreach
                </span>
              </div>

              {/* Review status + toggle */}
              <div className="flex items-center gap-2 shrink-0">
                {isReviewed ? (
                  <>
                    <Badge variant="success" size="sm">
                      <CheckCircle
                        className="h-3 w-3 mr-1"
                        aria-hidden="true"
                      />
                      Reviewed
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isReviewing}
                      onClick={(e) => {
                        e.preventDefault();
                        onToggleReview(report.id, true);
                      }}
                      aria-label="Un-review this report"
                    >
                      Un-review
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isReviewing}
                    loading={isReviewing}
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleReview(report.id, false);
                    }}
                    aria-label="Mark this report as reviewed"
                  >
                    Mark Reviewed
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </summary>

        {/* Expanded details */}
        <CardContent className="px-4 pb-4 pt-0 border-t border-ima-border">
          {report.wins || report.improvements ? (
            <div className="space-y-3 pt-3">
              {report.wins && (
                <div>
                  <p className="text-xs font-semibold text-ima-text-secondary uppercase tracking-wide mb-1">
                    Wins
                  </p>
                  <p className="text-sm text-ima-text">{report.wins}</p>
                </div>
              )}
              {report.improvements && (
                <div>
                  <p className="text-xs font-semibold text-ima-text-secondary uppercase tracking-wide mb-1">
                    Improvements
                  </p>
                  <p className="text-sm text-ima-text">{report.improvements}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="pt-3 text-sm text-ima-text-secondary italic">
              No details provided
            </p>
          )}
        </CardContent>
      </details>
    </Card>
  );
}
