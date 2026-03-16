"use client";

import { FileText, Clock, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type DailyReportRow = {
  id: string;
  date: string;
  hours_worked: number;
  star_rating: number | null;
  outreach_count: number;
  wins: string | null;
  improvements: string | null;
  reviewed_by: string | null;
};

interface ReportsTabProps {
  reports: DailyReportRow[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function StarDisplay({ rating }: { rating: number | null }) {
  const stars = rating ?? 0;
  return (
    <span role="img" aria-label={`Rating: ${stars} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= stars ? "text-ima-warning" : "text-ima-text-muted"}>★</span>
      ))}
    </span>
  );
}

export function ReportsTab({ reports }: ReportsTabProps) {
  if (reports.length === 0) {
    return (
      <div role="tabpanel" id="tabpanel-reports" aria-labelledby="tab-reports" className="py-8 text-center">
        <FileText className="h-8 w-8 text-ima-text-muted mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-ima-text">No reports submitted yet</p>
      </div>
    );
  }

  return (
    <div role="tabpanel" id="tabpanel-reports" aria-labelledby="tab-reports" className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="p-4 flex flex-col gap-3">
            {/* Date + review status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ima-text">{formatDate(report.date)}</span>
              {report.reviewed_by ? (
                <Badge variant="success" size="sm">Reviewed</Badge>
              ) : (
                <Badge variant="warning" size="sm">Pending</Badge>
              )}
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm text-ima-text-secondary">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {report.hours_worked}h
              </span>
              <StarDisplay rating={report.star_rating} />
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {report.outreach_count}
              </span>
            </div>

            {/* Wins/Improvements */}
            {report.wins && (
              <div>
                <p className="text-xs text-ima-text-muted">Wins</p>
                <p className="text-sm text-ima-text">{report.wins}</p>
              </div>
            )}
            {report.improvements && (
              <div>
                <p className="text-xs text-ima-text-muted">Improvements</p>
                <p className="text-sm text-ima-text">{report.improvements}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
