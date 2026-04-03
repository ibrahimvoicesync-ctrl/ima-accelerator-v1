import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatHours } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import { Star, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/lib/types";
import { CoachFeedbackCard } from "@/components/shared/CoachFeedbackCard";

type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];

type ReportWithComment = DailyReport & {
  report_comments: Array<{
    id: string;
    comment: string;
    updated_at: string;
    coach: { name: string } | null;
  }> | null;
};

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ReportHistoryPage() {
  const user = await requireRole("student");
  const admin = createAdminClient();

  const { data: reports, error } = await admin
    .from("daily_reports")
    .select(`
      *,
      report_comments (
        id,
        comment,
        updated_at,
        coach:users!report_comments_coach_id_fkey ( name )
      )
    `)
    .eq("student_id", user.id)
    .order("date", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[report history] Failed to load reports:", error);
  }

  const reportList = (reports ?? []) as ReportWithComment[];

  return (
    <div className="px-4 space-y-5 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/student/report"
        className="text-sm text-ima-primary hover:underline min-h-[44px] inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Report
      </Link>

      {/* Header */}
      <h1 className="text-2xl font-bold text-ima-text">Past Reports</h1>

      {/* Empty state */}
      {reportList.length === 0 && (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No reports submitted yet"
            description="Start tracking your progress by submitting your first daily report."
            action={
              <Link href="/student/report" className={buttonVariants({ variant: "primary" })}>
                Submit Your First Report
              </Link>
            }
          />
        </Card>
      )}

      {/* Report list */}
      {reportList.map((report) => {
        const feedbackComment = report.report_comments?.[0] ?? null;
        return (
          <div key={report.id} className="space-y-2">
            <Card>
              <CardContent className="p-5 space-y-2">
                {/* Date row */}
                <p className="text-sm font-semibold text-ima-text">
                  {formatDateDisplay(report.date)}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-sm text-ima-text-secondary">
                  <span>{formatHours(report.hours_worked * 60)}</span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: report.star_rating ?? 0 }, (_, i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-ima-warning text-ima-warning"
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                  <span>{report.outreach_count} outreach</span>
                </div>

                {/* Wins */}
                {report.wins && (
                  <p className="text-sm text-ima-text">
                    <span className="font-medium text-ima-text-secondary">Wins: </span>
                    {report.wins}
                  </p>
                )}

                {/* Improvements */}
                {report.improvements && (
                  <p className="text-sm text-ima-text">
                    <span className="font-medium text-ima-text-secondary">Improvements: </span>
                    {report.improvements}
                  </p>
                )}
              </CardContent>
            </Card>
            {feedbackComment && feedbackComment.comment && (
              <CoachFeedbackCard
                comment={feedbackComment.comment}
                coachName={feedbackComment.coach?.name ?? "Coach"}
                updatedAt={feedbackComment.updated_at}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
