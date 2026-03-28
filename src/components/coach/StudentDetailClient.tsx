"use client";

import { useState } from "react";
import { StudentHeader } from "./StudentHeader";
import { StudentDetailTabs, type TabKey } from "./StudentDetailTabs";
import { WorkSessionsTab } from "./WorkSessionsTab";
import { RoadmapTab } from "./RoadmapTab";
import { ReportsTab } from "./ReportsTab";
import { StudentKpiSummary } from "@/components/student/StudentKpiSummary";

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
  kpiData: {
    lifetimeOutreach: number;
    dailyOutreach: number;
    dailyMinutesWorked: number;
    joinedAt: string;
    currentStepNumber: number | null;
  };
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
  kpiData,
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

      <StudentKpiSummary
        lifetimeOutreach={kpiData.lifetimeOutreach}
        dailyOutreach={kpiData.dailyOutreach}
        dailyMinutesWorked={kpiData.dailyMinutesWorked}
        joinedAt={kpiData.joinedAt}
        currentStepNumber={kpiData.currentStepNumber}
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
