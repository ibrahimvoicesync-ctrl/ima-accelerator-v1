"use client";

import { useState } from "react";
import { StudentHeader } from "./StudentHeader";
import { StudentDetailTabs, type TabKey } from "./StudentDetailTabs";
import { WorkSessionsTab } from "./WorkSessionsTab";
import { RoadmapTab } from "./RoadmapTab";
import { ReportsTab } from "./ReportsTab";

interface StudentDetailClientProps {
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

export function StudentDetailClient({
  student,
  isAtRisk,
  atRiskReasons,
  sessions,
  roadmap,
  reports,
  initialTab,
  studentId,
}: StudentDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(
    (initialTab as TabKey) || "work"
  );

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `/coach/students/${studentId}?tab=${tab}`);
  }

  return (
    <div className="px-4 space-y-6">
      <StudentHeader
        student={student}
        isAtRisk={isAtRisk}
        atRiskReasons={atRiskReasons}
      />

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
