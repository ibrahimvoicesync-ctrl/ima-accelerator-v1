/**
 * Phase 47: Coach Dashboard RPC wrapper (server-only).
 *
 * Calls public.get_coach_dashboard (migration 00024) via the admin client.
 * Used by /coach server component, wrapped in unstable_cache.
 *
 * IMPORTANT: imports createAdminClient — server-only. Client components must
 * import types from "@/lib/rpc/coach-dashboard-types" instead, never from this file.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { CoachDashboardPayload } from "@/lib/rpc/coach-dashboard-types";

// Re-export so existing server-side imports can grab everything from one path.
// Client components must import from "@/lib/rpc/coach-dashboard-types" directly.
export { coachDashboardTag } from "@/lib/rpc/coach-dashboard-types";
export type {
  CoachDashboardStats,
  CoachRecentReport,
  CoachTopHoursRow,
  CoachDashboardPayload,
} from "@/lib/rpc/coach-dashboard-types";

/**
 * Runs public.get_coach_dashboard for the given coach.
 * Pass `today` as a YYYY-MM-DD string (use getTodayUTC() at the call site).
 * Passing p_week_start = null lets the RPC compute date_trunc('week', today).
 *
 * NEVER swallows errors — logs and rethrows so callers surface the failure
 * to the Next.js error boundary (per CLAUDE.md rule #5).
 */
export async function fetchCoachDashboard(
  coachId: string,
  today: string,
): Promise<CoachDashboardPayload> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_coach_dashboard", {
    p_coach_id: coachId,
    p_week_start: null,
    p_today: today,
  });

  if (error) {
    console.error("[coach-dashboard] RPC failed:", error);
    throw new Error("Failed to load coach dashboard");
  }
  if (!data) {
    console.error("[coach-dashboard] RPC returned no data for", coachId);
    throw new Error("Failed to load coach dashboard");
  }

  return data as unknown as CoachDashboardPayload;
}
