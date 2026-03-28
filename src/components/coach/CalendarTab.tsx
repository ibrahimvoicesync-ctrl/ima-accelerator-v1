"use client";

import { useState } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatHoursMinutes } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

type CalendarSessionRow = {
  id: string;
  date: string;
  cycle_number: number;
  status: string;
  duration_minutes: number;
  session_minutes: number;
};

type CalendarReportRow = {
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
};

type DayActivity = "full" | "partial" | "none";

type CalendarTabProps = {
  sessions: CalendarSessionRow[];
  reports: CalendarReportRow[];
  currentMonth: string; // "YYYY-MM"
  studentId: string;
  role: "coach" | "owner";
};

const statusVariant: Record<string, "info" | "success" | "warning" | "error"> = {
  in_progress: "info",
  completed: "success",
  paused: "warning",
  abandoned: "error",
};

/** Local-time date string from a Date object */
function dateStrLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarTab({ sessions, reports, currentMonth, studentId, role }: CalendarTabProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displaySessions, setDisplaySessions] = useState<CalendarSessionRow[]>(sessions);
  const [displayReports, setDisplayReports] = useState<CalendarReportRow[]>(reports);
  const [displayMonth, setDisplayMonth] = useState<string>(currentMonth);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  // Build lookup maps from display state (simple loop, <31 days of data)
  const sessionsByDate = new Map<string, CalendarSessionRow[]>();
  for (const s of displaySessions) {
    const list = sessionsByDate.get(s.date) ?? [];
    list.push(s);
    sessionsByDate.set(s.date, list);
  }
  const reportByDate = new Map<string, CalendarReportRow>();
  for (const r of displayReports) reportByDate.set(r.date, r);

  function getActivity(dateStr: string): DayActivity {
    const hasSessions = (sessionsByDate.get(dateStr)?.length ?? 0) > 0;
    const hasReport = reportByDate.has(dateStr);
    if (hasSessions && hasReport) return "full";
    if (hasSessions || hasReport) return "partial";
    return "none";
  }

  /** Custom DayButton with closure over getActivity */
  function ActivityDayButton(props: DayButtonProps) {
    const { day, modifiers, ...buttonProps } = props;
    const dateStr = dateStrLocal(day.date);
    const activity = getActivity(dateStr);
    return (
      <button
        {...buttonProps}
        className="flex flex-col items-center justify-center gap-0.5 w-full min-h-[44px] rounded-lg text-sm text-ima-text hover:bg-ima-surface-light focus:outline-none focus:ring-2 focus:ring-ima-primary"
      >
        <span>{day.date.getDate()}</span>
        {activity === "full" && (
          <span className="w-1.5 h-1.5 rounded-full bg-ima-success" aria-hidden="true" />
        )}
        {activity === "partial" && (
          <span className="w-1.5 h-1.5 rounded-full bg-ima-warning" aria-hidden="true" />
        )}
      </button>
    );
  }

  async function handleMonthChange(newMonth: Date) {
    setSelectedDate(null);
    const mm = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, "0")}`;
    setDisplayMonth(mm);

    // Update URL without navigation
    const basePath = role === "coach"
      ? `/coach/students/${studentId}`
      : `/owner/students/${studentId}`;
    window.history.replaceState(null, "", `${basePath}?tab=calendar&month=${mm}`);

    // Fetch new month data
    setIsLoadingMonth(true);
    try {
      const res = await fetch(`/api/calendar?studentId=${studentId}&month=${mm}`);
      if (!res.ok) {
        console.error("[CalendarTab] Failed to fetch calendar data:", res.status);
        return;
      }
      const data = await res.json();
      setDisplaySessions(data.sessions);
      setDisplayReports(data.reports);
    } catch (err) {
      console.error("[CalendarTab] Error fetching calendar data:", err);
    } finally {
      setIsLoadingMonth(false);
    }
  }

  function handleDayClick(date: Date) {
    const dateStr = dateStrLocal(date);
    setSelectedDate(selectedDate === dateStr ? null : dateStr);
  }

  const [yy, mm2] = displayMonth.split("-").map(Number);
  const monthDate = new Date(yy, mm2 - 1, 1);

  const selectedSessions = selectedDate ? (sessionsByDate.get(selectedDate) ?? []) : [];
  const selectedReport = selectedDate ? reportByDate.get(selectedDate) ?? null : null;

  const selectedDateObj = selectedDate
    ? (() => { const [y, m, d] = selectedDate.split("-").map(Number); return new Date(y, m - 1, d); })()
    : undefined;

  return (
    <div role="tabpanel" id="tabpanel-calendar" aria-labelledby="tab-calendar" className="space-y-4">
      <div className={isLoadingMonth ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <DayPicker
          month={monthDate}
          onMonthChange={handleMonthChange}
          showOutsideDays={false}
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full",
            month_caption: "flex items-center justify-center py-2 text-sm font-semibold text-ima-text",
            nav: "flex items-center justify-between mb-2",
            button_previous: "flex items-center justify-center w-11 h-11 rounded-lg text-ima-text-secondary hover:bg-ima-surface-light focus:outline-none focus:ring-2 focus:ring-ima-primary",
            button_next: "flex items-center justify-center w-11 h-11 rounded-lg text-ima-text-secondary hover:bg-ima-surface-light focus:outline-none focus:ring-2 focus:ring-ima-primary",
            month_grid: "w-full border-collapse",
            weekdays: "",
            weekday: "text-xs font-medium text-ima-text-secondary text-center py-2",
            week: "",
            day: "text-center p-0.5",
            today: "font-bold",
            outside: "text-ima-text-muted opacity-50",
            selected: "bg-ima-primary/10 rounded-lg",
          }}
          modifiers={{ selected: selectedDateObj }}
          components={{ DayButton: ActivityDayButton }}
          onDayClick={handleDayClick}
        />
      </div>

      {selectedDate && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Work Sessions card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-ima-text">Work Sessions</h3>
              {selectedSessions.length === 0 ? (
                <div className="flex items-center gap-2 py-2">
                  <CalendarDays className="h-4 w-4 text-ima-text-muted" aria-hidden="true" />
                  <p className="text-sm text-ima-text-secondary">No sessions this day.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...selectedSessions]
                    .sort((a, b) => a.cycle_number - b.cycle_number)
                    .map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ima-text">Cycle {s.cycle_number}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant[s.status] ?? "default"} size="sm">
                            {s.status.replace("_", " ")}
                          </Badge>
                          {s.status === "completed" && (
                            <span className="text-xs text-ima-text-secondary">
                              {formatHoursMinutes(s.duration_minutes)}
                            </span>
                          )}
                          {(s.status === "paused" || s.status === "abandoned") && (
                            <span className="text-xs text-ima-text-secondary">
                              planned: {s.session_minutes}m
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Report card */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-ima-text">Daily Report</h3>
              {selectedReport === null ? (
                <p className="text-sm text-ima-text-secondary">No report submitted.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ima-text-secondary">Review status</span>
                    <Badge
                      variant={selectedReport.reviewed_by ? "success" : "warning"}
                      size="sm"
                    >
                      {selectedReport.reviewed_by ? "Reviewed" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ima-text-secondary">Hours:</span>
                    <span className="text-ima-text">{selectedReport.hours_worked}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ima-text-secondary">Brands contacted:</span>
                    <span className="text-ima-text">{selectedReport.brands_contacted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ima-text-secondary">Influencers contacted:</span>
                    <span className="text-ima-text">{selectedReport.influencers_contacted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ima-text-secondary">Calls joined:</span>
                    <span className="text-ima-text">{selectedReport.calls_joined}</span>
                  </div>
                  {selectedReport.wins && (
                    <div className="pt-1">
                      <p className="text-xs text-ima-text-secondary">Wins</p>
                      <p className="text-sm text-ima-text">{selectedReport.wins}</p>
                    </div>
                  )}
                  {selectedReport.improvements && (
                    <div className="pt-1">
                      <p className="text-xs text-ima-text-secondary">Improvements</p>
                      <p className="text-sm text-ima-text">{selectedReport.improvements}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
