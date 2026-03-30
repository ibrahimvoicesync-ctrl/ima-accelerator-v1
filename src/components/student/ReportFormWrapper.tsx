"use client";

import { useOptimistic, startTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { ReportForm } from "./ReportForm";
import type { Database } from "@/lib/types";

type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];

interface ReportFormWrapperProps {
  date: string;
  existingReport: DailyReport | null;
  autoMinutes: number;
}

export function ReportFormWrapper({
  date,
  existingReport,
  autoMinutes,
}: ReportFormWrapperProps) {
  const router = useRouter();
  const [optimisticReport, addOptimistic] = useOptimistic(
    existingReport,
    (_current: DailyReport | null, optimisticValue: DailyReport) => optimisticValue
  );

  const handleSuccess = (submittedReport: DailyReport) => {
    startTransition(() => {
      addOptimistic(submittedReport);
    });
    router.refresh();
  };

  return (
    <>
      {/* Optimistic submitted banner -- appears immediately on success per D-10 */}
      {optimisticReport?.submitted_at && (
        <Card variant="bordered-left" className="border-l-ima-success">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-ima-success/10 shrink-0">
              <CheckCircle
                className="h-5 w-5 text-ima-success"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ima-text">
                Report submitted for today
              </p>
              <p className="text-xs text-ima-text-secondary mt-0.5">
                You can update it below if needed
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not-yet-submitted hint -- only when no optimistic or server report */}
      {!optimisticReport?.submitted_at && (
        <Card variant="bordered-left" className="border-l-ima-warning">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-ima-warning/10 shrink-0">
              <FileText
                className="h-5 w-5 text-ima-warning"
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-ima-text">
                Report not yet submitted
              </p>
              <p className="text-xs text-ima-text-secondary mt-0.5">
                Fill out the form below to submit your daily report
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <ReportForm
        date={date}
        existingReport={existingReport}
        autoMinutes={autoMinutes}
        onSuccess={handleSuccess}
      />
    </>
  );
}
