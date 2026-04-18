"use client";

import { useState } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { formatHoursMinutes } from "@/lib/utils";
import { CommentForm } from "@/components/shared/CommentForm";

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

type CalendarComment = {
  comment: string;
};

type CalendarTabProps = {
  sessions: CalendarSessionRow[];
  reports: CalendarReportRow[];
  comments: Record<string, CalendarComment>;
  currentMonth: string;
  studentId: string;
  viewerRole: "coach" | "owner";
  studentRole?: "student" | "student_diy";
};

const statusPill: Record<
  string,
  { bg: string; border: string; fg: string; label: string }
> = {
  in_progress: {
    bg: "bg-[#E8EEFF]",
    border: "border-[#C9D5FF]",
    fg: "text-[#4A6CF7]",
    label: "In Progress",
  },
  completed: {
    bg: "bg-[#E2F5E9]",
    border: "border-[#BBE5CA]",
    fg: "text-[#16A34A]",
    label: "Completed",
  },
  paused: {
    bg: "bg-[#FDF3E0]",
    border: "border-[#F0DFB3]",
    fg: "text-[#9A6B1F]",
    label: "Paused",
  },
  abandoned: {
    bg: "bg-[#FDEAEA]",
    border: "border-[#F5C6C6]",
    fg: "text-[#DC2626]",
    label: "Abandoned",
  },
};

function dateStrLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function CalendarTab({
  sessions,
  reports,
  comments,
  currentMonth,
  studentId,
  viewerRole,
  studentRole = "student",
}: CalendarTabProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [displaySessions, setDisplaySessions] = useState<CalendarSessionRow[]>(sessions);
  const [displayReports, setDisplayReports] = useState<CalendarReportRow[]>(reports);
  const [displayComments, setDisplayComments] =
    useState<Record<string, CalendarComment>>(comments);
  const [displayMonth, setDisplayMonth] = useState<string>(currentMonth);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);
  const isDiy = studentRole === "student_diy";

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
    const hasReport = !isDiy && reportByDate.has(dateStr);
    if (hasSessions && hasReport) return "full";
    if (hasSessions || hasReport) return "partial";
    return "none";
  }

  function ActivityDayButton(props: DayButtonProps) {
    const { day, modifiers, ...buttonProps } = props;
    const dateStr = dateStrLocal(day.date);
    const activity = getActivity(dateStr);
    const selected = selectedDate === dateStr;
    return (
      <button
        {...buttonProps}
        className={[
          "flex flex-col items-center justify-center gap-[3px] w-full min-h-[44px] rounded-[10px] text-[13px] tabular-nums font-medium motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2",
          selected
            ? "bg-[#E8EEFF] text-[#4A6CF7] font-semibold"
            : "text-[#1A1A17] hover:bg-[#F4F1EA]",
          modifiers?.today && !selected ? "font-bold text-[#4A6CF7]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span>{day.date.getDate()}</span>
        {activity === "full" && (
          <span
            className="w-[6px] h-[6px] rounded-full bg-[#4A6CF7]"
            aria-hidden="true"
          />
        )}
        {activity === "partial" && (
          <span
            className="w-[6px] h-[6px] rounded-full bg-[#D97706]"
            aria-hidden="true"
          />
        )}
        {activity === "none" && (
          <span
            className="w-[6px] h-[6px] rounded-full opacity-0"
            aria-hidden="true"
          />
        )}
      </button>
    );
  }

  async function handleMonthChange(newMonth: Date) {
    setSelectedDate(null);
    const mm = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, "0")}`;
    setDisplayMonth(mm);

    const basePath =
      viewerRole === "coach"
        ? `/coach/students/${studentId}`
        : `/owner/students/${studentId}`;
    window.history.replaceState(null, "", `${basePath}?tab=calendar&month=${mm}`);

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
      setDisplayComments(data.comments ?? {});
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

  const selectedSessions = selectedDate ? sessionsByDate.get(selectedDate) ?? [] : [];
  const selectedReport = selectedDate ? reportByDate.get(selectedDate) ?? null : null;

  const selectedDateObj = selectedDate
    ? (() => {
        const [y, m, d] = selectedDate.split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : undefined;

  const monthSessionCount = displaySessions.length;
  const monthReportCount = isDiy ? 0 : displayReports.length;

  return (
    <div
      role="tabpanel"
      id="tabpanel-calendar"
      aria-labelledby="tab-calendar"
      className="space-y-6"
    >
      {/* Calendar card */}
      <section
        aria-label="Monthly activity calendar"
        className={[
          "bg-white border border-[#EDE9E0] rounded-[14px] p-5 md:p-6 motion-safe:transition-opacity",
          isLoadingMonth ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              Activity Calendar
            </p>
            <p className="mt-2 text-[13px] text-[#7A7466]">
              Daily sessions{!isDiy ? " and reports" : ""} by month.
            </p>
          </div>
          <div
            className="flex items-center gap-4 text-[11px] tracking-[0.08em] uppercase text-[#8A8474]"
            style={{ fontFamily: "var(--font-mono-bold)" }}
            aria-label="Calendar legend"
          >
            <span className="inline-flex items-center gap-[6px]">
              <span
                className="w-[8px] h-[8px] rounded-full bg-[#4A6CF7]"
                aria-hidden="true"
              />
              Full
            </span>
            <span className="inline-flex items-center gap-[6px]">
              <span
                className="w-[8px] h-[8px] rounded-full bg-[#D97706]"
                aria-hidden="true"
              />
              Partial
            </span>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1"
          aria-label="Month totals"
        >
          <span
            className="text-[11px] tracking-[0.14em] uppercase text-[#8A8474]"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            <span className="text-[17px] font-bold text-[#1A1A17] tabular-nums not-italic normal-case tracking-normal mr-[4px]">
              {monthSessionCount}
            </span>
            Sessions
          </span>
          {!isDiy && (
            <span
              className="text-[11px] tracking-[0.14em] uppercase text-[#8A8474]"
              style={{ fontFamily: "var(--font-mono-bold)" }}
            >
              <span className="text-[17px] font-bold text-[#1A1A17] tabular-nums not-italic normal-case tracking-normal mr-[4px]">
                {monthReportCount}
              </span>
              Reports
            </span>
          )}
        </div>

        <div className="mt-5">
          <DayPicker
            month={monthDate}
            onMonthChange={handleMonthChange}
            showOutsideDays={false}
            classNames={{
              root: "w-full",
              months: "w-full",
              month: "w-full",
              month_caption:
                "flex items-center justify-center py-2 text-[15px] font-bold tabular-nums tracking-tight text-[#1A1A17]",
              nav: "flex items-center justify-between mb-1",
              button_previous:
                "flex items-center justify-center w-11 h-11 rounded-[10px] text-[#5A5648] hover:bg-[#F4F1EA] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2",
              button_next:
                "flex items-center justify-center w-11 h-11 rounded-[10px] text-[#5A5648] hover:bg-[#F4F1EA] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2",
              month_grid: "w-full border-collapse mt-2",
              weekdays: "",
              weekday:
                "text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8A8474] text-center py-2",
              week: "",
              day: "text-center p-[2px]",
              today: "",
              outside: "text-[#B8B2A1] opacity-50",
              selected: "",
            }}
            modifiers={{ selected: selectedDateObj }}
            components={{ DayButton: ActivityDayButton }}
            onDayClick={handleDayClick}
          />
        </div>
      </section>

      {/* Day detail */}
      {selectedDate && (
        <section aria-label={`Details for ${formatLongDate(selectedDate)}`}>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
                style={{ fontFamily: "var(--font-mono-bold)" }}
              >
                Day Detail
              </p>
              <p className="mt-2 text-[20px] md:text-[22px] font-bold leading-tight text-[#1A1A17] tracking-[-0.01em]">
                {formatLongDate(selectedDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-[12px] font-semibold text-[#4A6CF7] hover:text-[#3852D8] min-h-[44px] px-1 focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2 rounded-md"
            >
              Clear
            </button>
          </div>

          <div className={isDiy ? "mt-4 grid gap-[14px]" : "mt-4 grid md:grid-cols-2 gap-[14px]"}>
            {/* Work Sessions card */}
            <div className="bg-white border border-[#EDE9E0] rounded-[14px] p-5">
              <p
                className="text-[10px] font-semibold tracking-[0.18em] text-[#8A8474] uppercase"
                style={{ fontFamily: "var(--font-mono-bold)" }}
              >
                Work Sessions
              </p>

              {selectedSessions.length === 0 ? (
                <p className="mt-3 text-[13px] text-[#8A8474] italic">No sessions this day.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#F3EFE4]" role="list">
                  {[...selectedSessions]
                    .sort((a, b) => a.cycle_number - b.cycle_number)
                    .map((s) => {
                      const pill = statusPill[s.status];
                      return (
                        <li
                          key={s.id}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <span
                            className="text-[11px] tracking-[0.14em] uppercase text-[#8A8474]"
                            style={{ fontFamily: "var(--font-mono-bold)" }}
                          >
                            <span className="text-[14px] font-bold tabular-nums text-[#1A1A17] normal-case tracking-normal mr-[4px]">
                              {String(s.cycle_number).padStart(2, "0")}
                            </span>
                            Cycle
                          </span>
                          <div className="flex items-center gap-[10px]">
                            {pill && (
                              <span
                                className={[
                                  "inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em]",
                                  pill.bg,
                                  pill.border,
                                  pill.fg,
                                ].join(" ")}
                              >
                                {pill.label}
                              </span>
                            )}
                            {s.status === "completed" && (
                              <span
                                className="text-[12px] font-semibold text-[#1A1A17] tabular-nums"
                                style={{ fontFamily: "var(--font-mono-bold)" }}
                              >
                                {formatHoursMinutes(s.duration_minutes)}
                              </span>
                            )}
                            {(s.status === "paused" || s.status === "abandoned") && (
                              <span
                                className="text-[11px] tracking-[0.08em] uppercase text-[#8A8474]"
                                style={{ fontFamily: "var(--font-mono-bold)" }}
                              >
                                <span className="text-[12px] tabular-nums text-[#1A1A17] normal-case tracking-normal mr-[3px]">
                                  {s.session_minutes}m
                                </span>
                                Planned
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>

            {/* Daily Report card — suppressed for DIY */}
            {!isDiy && (
              <div className="bg-white border border-[#EDE9E0] rounded-[14px] p-5">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="text-[10px] font-semibold tracking-[0.18em] text-[#8A8474] uppercase"
                    style={{ fontFamily: "var(--font-mono-bold)" }}
                  >
                    Daily Report
                  </p>
                  {selectedReport && (
                    <span
                      className={[
                        "inline-flex items-center px-2 py-[3px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em]",
                        selectedReport.reviewed_by
                          ? "bg-[#E2F5E9] border-[#BBE5CA] text-[#16A34A]"
                          : "bg-[#FDF3E0] border-[#F0DFB3] text-[#9A6B1F]",
                      ].join(" ")}
                    >
                      {selectedReport.reviewed_by ? "Reviewed" : "Pending"}
                    </span>
                  )}
                </div>

                {selectedReport === null ? (
                  <p className="mt-3 text-[13px] text-[#8A8474] italic">No report submitted.</p>
                ) : (
                  <div className="mt-4">
                    <div className="grid grid-cols-2 gap-[14px]">
                      {[
                        {
                          label: "Hours",
                          value: `${selectedReport.hours_worked}h`,
                        },
                        {
                          label: "Brands",
                          value: String(selectedReport.brands_contacted),
                        },
                        {
                          label: "Influencers",
                          value: String(selectedReport.influencers_contacted),
                        },
                        {
                          label: "Calls",
                          value: String(selectedReport.calls_joined),
                        },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className="rounded-[10px] border border-[#EDE9E0] bg-[#FAFAF7] px-3 py-[10px]"
                        >
                          <p className="text-[20px] font-bold leading-none tabular-nums text-[#1A1A17]">
                            {m.value}
                          </p>
                          <p
                            className="mt-[6px] text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8A8474]"
                            style={{ fontFamily: "var(--font-mono-bold)" }}
                          >
                            {m.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {selectedReport.wins && (
                      <div className="mt-4">
                        <p
                          className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8A8474]"
                          style={{ fontFamily: "var(--font-mono-bold)" }}
                        >
                          Wins
                        </p>
                        <p className="mt-[6px] text-[13.5px] text-[#1A1A17] leading-[1.55]">
                          {selectedReport.wins}
                        </p>
                      </div>
                    )}

                    {selectedReport.improvements && (
                      <div className="mt-4">
                        <p
                          className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8A8474]"
                          style={{ fontFamily: "var(--font-mono-bold)" }}
                        >
                          Improvements
                        </p>
                        <p className="mt-[6px] text-[13.5px] text-[#1A1A17] leading-[1.55]">
                          {selectedReport.improvements}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 pt-4 border-t border-[#F3EFE4]">
                      <CommentForm
                        reportId={selectedReport.id}
                        initialComment={displayComments[selectedReport.id]?.comment ?? null}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
