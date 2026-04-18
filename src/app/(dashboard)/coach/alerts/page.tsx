import { JetBrains_Mono } from "next/font/google";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getTodayUTC } from "@/lib/utils";
import { getCoachMilestonesCached } from "@/lib/rpc/coach-milestones";
import {
  milestoneRowToFeedItem,
  type CoachAlertFeedItem,
} from "@/components/coach/alerts-types";
import { CoachAlertsClient } from "@/components/coach/CoachAlertsClient";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-bold",
});

export default async function CoachAlertsPage() {
  const user = await requireRole("coach");
  const today = getTodayUTC();
  const admin = createAdminClient();

  const [studentsResult, dismissalsResult, milestonesPayload] = await Promise.all([
    admin
      .from("users")
      .select("id, name, joined_at")
      .eq("role", "student")
      .eq("coach_id", user.id)
      .eq("status", "active"),
    admin
      .from("alert_dismissals")
      .select("alert_key")
      .eq("owner_id", user.id),
    getCoachMilestonesCached(user.id, today),
  ]);

  if (studentsResult.error) {
    console.error("[coach alerts] students fetch error:", studentsResult.error);
  }
  if (dismissalsResult.error) {
    console.error("[coach alerts] dismissals fetch error:", dismissalsResult.error);
  }

  const students = studentsResult.data ?? [];
  const dismissedKeys = new Set(
    (dismissalsResult.data ?? []).map((d) => d.alert_key),
  );

  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const milestoneCutoff = new Date(
    nowMs - COACH_CONFIG.milestoneDaysWindow * 86400000,
  )
    .toISOString()
    .split("T")[0];

  const qualifyingStudents = students.filter(
    (s) => s.joined_at >= milestoneCutoff,
  );

  const legacyItems: CoachAlertFeedItem[] = [];
  if (qualifyingStudents.length > 0) {
    const qualifyingIds = qualifyingStudents.map((s) => s.id);
    const { data: sessionData, error: sessionError } = await admin
      .from("work_sessions")
      .select("student_id, session_minutes, completed_at")
      .in("student_id", qualifyingIds)
      .eq("status", "completed");

    if (sessionError) {
      console.error("[coach alerts] sessions fetch error:", sessionError);
    }

    const minutesByStudent = new Map<string, number>();
    const latestCompletionByStudent = new Map<string, string>();
    for (const row of sessionData ?? []) {
      const prev = minutesByStudent.get(row.student_id) ?? 0;
      minutesByStudent.set(row.student_id, prev + (row.session_minutes ?? 0));
      const prevAt = latestCompletionByStudent.get(row.student_id);
      if (!prevAt || (row.completed_at && row.completed_at > prevAt)) {
        latestCompletionByStudent.set(row.student_id, row.completed_at ?? prevAt ?? "");
      }
    }

    for (const student of qualifyingStudents) {
      const totalMinutes = minutesByStudent.get(student.id) ?? 0;
      if (totalMinutes < COACH_CONFIG.milestoneMinutesThreshold) continue;
      const key = `100h_milestone:${student.id}`;
      if (dismissedKeys.has(key)) continue;
      const daysSinceJoin = Math.floor(
        (nowMs - new Date(student.joined_at).getTime()) / 86400000,
      );
      legacyItems.push({
        alert_key: key,
        student_id: student.id,
        student_name: student.name,
        milestone_type: "100h_milestone",
        occurred_at:
          latestCompletionByStudent.get(student.id) ??
          new Date(student.joined_at).toISOString(),
        message: `${student.name} has reached 100+ hours in ${daysSinceJoin} days! Check them out and ask for a testimonial.`,
        deal_id: null,
      });
    }
  }

  const rpcItems: CoachAlertFeedItem[] = milestonesPayload.milestones.map(
    milestoneRowToFeedItem,
  );

  const feed: CoachAlertFeedItem[] = [...legacyItems, ...rpcItems];
  feed.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return (
    <div
      className={`${jetbrainsMono.variable} -mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]`}
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20 space-y-8">
        <header className="motion-safe:animate-fadeIn">
          <p
            className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Alerts
          </p>
          <h1 className="mt-3 text-[32px] md:text-[36px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em]">
            Milestone Alerts
          </h1>
          <p className="mt-2 text-[15px] text-[#7A7466] leading-[1.5]">
            Your students&apos; milestone achievements — review and dismiss when actioned.
          </p>
        </header>

        <CoachAlertsClient initialFeed={feed} />
      </div>
    </div>
  );
}
