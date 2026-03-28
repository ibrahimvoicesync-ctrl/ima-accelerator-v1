"use client";

import { useState } from "react";
import { StudentHeader } from "./StudentHeader";
import { StudentDetailTabs, type TabKey } from "./StudentDetailTabs";
import { CalendarTab } from "./CalendarTab";
import { RoadmapTab } from "./RoadmapTab";
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
  calendarSessions: {
    id: string;
    date: string;
    cycle_number: number;
    status: string;
    duration_minutes: number;
    session_minutes: number;
  }[];
  calendarReports: {
    id: string;
    date: string;
    hours_worked: number;
    star_rating: number | null;
    brands_contacted: number;
    influencers_contacted: number;
    calls_joined: number;
    wins: string | null;
    improvements: string | null;
    reviewed_by: string | null;
  }[];
  currentMonth: string;
  roadmap: {
    step_number: number;
    status: "locked" | "active" | "completed";
    completed_at: string | null;
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
  calendarSessions,
  calendarReports,
  currentMonth,
  roadmap,
  initialTab,
  studentId,
  kpiData,
}: StudentDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(
    (initialTab === "roadmap" ? "roadmap" : "calendar") as TabKey
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

      {activeTab === "calendar" && (
        <CalendarTab
          sessions={calendarSessions}
          reports={calendarReports}
          currentMonth={currentMonth}
          studentId={studentId}
          role="coach"
        />
      )}
      {activeTab === "roadmap" && <RoadmapTab roadmap={roadmap} joinedAt={student.joined_at} />}
    </div>
  );
}
