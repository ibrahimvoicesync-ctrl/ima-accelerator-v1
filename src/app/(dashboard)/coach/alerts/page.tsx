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
import { Bell } from "lucide-react";

/**
 * Phase 52: Coach Alerts Page — server shell.
 *
 * Merges two feeds:
 *   1. Legacy 100h milestone (NOTIF-08, quick task 260401-cwd) — direct Supabase
 *      query. Preserved because `get_coach_milestones` RPC does NOT emit
 *      100h_milestone rows (see 52-RESEARCH Open Question #1, Pitfall 5).
 *   2. Phase 51 milestone RPC (NOTIF-02..04) — cached via getCoachMilestonesCached.
 *
 * Merge output is CoachAlertFeedItem[] — flat, client-safe, ready to group by
 * student_id in the client component. Server does NOT group; grouping + filter
 * logic is the client's responsibility so filter tab toggles don't round-trip.
 *
 * IMPORTANT: getTodayUTC() not getToday() — matches Phase 48/51 precedent so the
 * RPC cache key is stable across server timezone drift.
 */
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

  // Legacy 100h feed — preserves NOTIF-08 behavior from pre-Phase 52 page.tsx.
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

  // RPC feed — already undismissed (RPC filters alert_dismissals internally).
  const rpcItems: CoachAlertFeedItem[] = milestonesPayload.milestones.map(
    milestoneRowToFeedItem,
  );

  const feed: CoachAlertFeedItem[] = [...legacyItems, ...rpcItems];
  feed.sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  const activeCount = feed.length;

  return (
    <div className="space-y-6 px-4">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Bell className="h-6 w-6 text-ima-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-ima-text">Milestone Alerts</h1>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-ima-success/10 text-ima-success">
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-sm text-ima-text-secondary">
          Your students&apos; milestone achievements — review and dismiss when actioned.
        </p>
      </div>

      <CoachAlertsClient initialFeed={feed} />
    </div>
  );
}
