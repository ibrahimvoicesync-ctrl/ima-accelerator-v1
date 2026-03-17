"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StudentDetailTabs, type TabKey } from "@/components/coach/StudentDetailTabs";
import { WorkSessionsTab } from "@/components/coach/WorkSessionsTab";
import { RoadmapTab } from "@/components/coach/RoadmapTab";
import { ReportsTab } from "@/components/coach/ReportsTab";

interface OwnerStudentDetailClientProps {
  student: {
    name: string;
    email: string;
    joined_at: string;
    status: string;
  };
  isAtRisk: boolean;
  atRiskReasons: string[];
  sessions: {
    id: string;
    date: string;
    cycle_number: number;
    status: string;
    duration_minutes: number;
  }[];
  roadmap: {
    step_number: number;
    status: "locked" | "active" | "completed";
  }[];
  reports: {
    id: string;
    date: string;
    hours_worked: number;
    star_rating: number | null;
    outreach_count: number;
    wins: string | null;
    improvements: string | null;
    reviewed_by: string | null;
  }[];
  initialTab?: string;
  studentId: string;
}

export function OwnerStudentDetailClient({
  student,
  isAtRisk,
  atRiskReasons,
  sessions,
  roadmap,
  reports,
  initialTab,
  studentId,
}: OwnerStudentDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(
    (initialTab as TabKey) || "work"
  );

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/owner/students/${studentId}?tab=${tab}`);
  }

  const initial = student.name.charAt(0).toUpperCase();
  const joinDate = new Date(student.joined_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="px-4 space-y-6">
      {/* Inline owner student header — uses /owner/students back link */}
      <div className="flex flex-col gap-4">
        {/* Back button */}
        <Link href="/owner/students">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Back to Students
          </Button>
        </Link>

        {/* Student info */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-ima-primary flex items-center justify-center text-xl font-bold text-white shrink-0">
            {initial}
          </div>

          {/* Name and join date */}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-ima-text">{student.name}</h1>
            <p className="text-sm text-ima-text-secondary">
              Joined {joinDate}
            </p>
            {student.status === "suspended" && (
              <Badge variant="warning" size="sm" className="mt-1">Suspended</Badge>
            )}
          </div>

          {/* At-risk badge */}
          {isAtRisk && (
            <div className="flex flex-col items-start sm:items-end gap-1">
              <Badge variant="error">At Risk</Badge>
              <p className="text-sm text-ima-text-secondary">
                {atRiskReasons.join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>

      <StudentDetailTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {activeTab === "work" && <WorkSessionsTab sessions={sessions} />}
      {activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} />}
      {activeTab === "reports" && <ReportsTab reports={reports} />}
    </div>
  );
}
