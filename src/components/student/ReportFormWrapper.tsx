"use client";

import { useRouter } from "next/navigation";
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

  return (
    <ReportForm
      date={date}
      existingReport={existingReport}
      autoMinutes={autoMinutes}
      onSuccess={() => router.refresh()}
    />
  );
}
