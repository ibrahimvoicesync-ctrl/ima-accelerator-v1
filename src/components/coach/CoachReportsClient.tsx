"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { ReportRow } from "@/components/coach/ReportRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText } from "lucide-react";

export type ReportItem = {
  id: string;
  student_id: string;
  date: string;
  hours_worked: number;
  star_rating: number | null;
  outreach_count: number;
  wins: string | null;
  improvements: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type StudentItem = { id: string; name: string };

type Props = {
  reports: ReportItem[];
  students: StudentItem[];
  studentMap: Record<string, string>;
  currentFilter: string;
  currentStudentId: string;
};

export function CoachReportsClient({
  reports,
  students,
  studentMap,
  currentFilter,
  currentStudentId,
}: Props) {
  const routerRef = useRef(useRouter());
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [localReports, setLocalReports] = useState(reports);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  function buildUrl(params: {
    reviewed?: string | undefined;
    student_id?: string | undefined;
  }) {
    const sp = new URLSearchParams();
    if (params.reviewed !== undefined && params.reviewed !== "all") {
      sp.set("reviewed", params.reviewed);
    }
    if (params.student_id) {
      sp.set("student_id", params.student_id);
    }
    const qs = sp.toString();
    return `/coach/reports${qs ? `?${qs}` : ""}`;
  }

  function handleFilterTab(filter: "all" | "false" | "true") {
    routerRef.current.push(
      buildUrl({
        reviewed: filter === "all" ? undefined : filter,
        student_id: currentStudentId || undefined,
      })
    );
  }

  function handleStudentFilter(studentId: string) {
    routerRef.current.push(
      buildUrl({
        reviewed:
          currentFilter === "all" ? undefined : currentFilter,
        student_id: studentId || undefined,
      })
    );
  }

  async function handleToggleReview(
    reportId: string,
    currentlyReviewed: boolean
  ) {
    setReviewingId(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: !currentlyReviewed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toastRef.current({
          type: "error",
          title: (json as { error?: string }).error ?? "Failed to update",
        });
        return;
      }
      setLocalReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? {
                ...r,
                reviewed_by: currentlyReviewed ? null : "me",
                reviewed_at: currentlyReviewed ? null : new Date().toISOString(),
              }
            : r
        )
      );
      toastRef.current({
        type: "success",
        title: currentlyReviewed ? "Review removed" : "Marked as reviewed",
      });
    } catch {
      toastRef.current({ type: "error", title: "Network error" });
    } finally {
      setReviewingId(null);
    }
  }

  const tabs = [
    { label: "Unreviewed", value: "false" as const },
    { label: "Reviewed", value: "true" as const },
    { label: "All", value: "all" as const },
  ];

  return (
    <div className="mt-6">
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Tab buttons */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => {
            const isActive = currentFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleFilterTab(tab.value)}
                className={`min-h-[44px] px-4 text-sm font-medium rounded-lg motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary ${
                  isActive
                    ? "bg-ima-primary text-white"
                    : "bg-ima-surface-light text-ima-text-secondary hover:text-ima-text"
                }`}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Student dropdown */}
        <select
          aria-label="Filter by student"
          value={currentStudentId}
          onChange={(e) => handleStudentFilter(e.target.value)}
          className="min-h-[44px] px-3 text-sm rounded-lg border border-ima-border bg-ima-surface text-ima-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary"
        >
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Report list */}
      {localReports.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No reports found"
            description="Reports matching your filters will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {localReports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              studentName={studentMap[report.student_id] ?? "Unknown Student"}
              onToggleReview={handleToggleReview}
              isReviewing={reviewingId === report.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
