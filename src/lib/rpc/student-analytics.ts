/**
 * Phase 46: Student Analytics RPC wrapper (server-only).
 *
 * Server-side fetcher for public.get_student_analytics (SQL migration 00023).
 * Used by /student/analytics and /student_diy/analytics server components.
 *
 * Cache layer is handled by the caller via Next.js unstable_cache with the
 * `studentAnalyticsTag(studentId)` tag (ANALYTICS-08).
 *
 * IMPORTANT: This module imports the admin Supabase client (server-only).
 * Client components must import types/constants from
 * `@/lib/rpc/student-analytics-types` instead, never from this file.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  STUDENT_ANALYTICS_PAGE_SIZE,
  type StudentAnalyticsPayload,
  type StudentAnalyticsRange,
} from "@/lib/rpc/student-analytics-types";

// Re-export types + constants so existing server-side imports keep working.
// Client components should import from "@/lib/rpc/student-analytics-types" directly.
export {
  STUDENT_ANALYTICS_PAGE_SIZE,
  STUDENT_ANALYTICS_RANGES,
  studentAnalyticsTag,
} from "@/lib/rpc/student-analytics-types";
export type {
  StudentAnalyticsRange,
  StudentAnalyticsTotals,
  OutreachBucket,
  HoursBucket,
  LoggerRole,
  DealRow,
  DealSummary,
  RoadmapProgressRow,
  StudentAnalyticsPayload,
} from "@/lib/rpc/student-analytics-types";

/**
 * Calls the SQL RPC `public.get_student_analytics` via the admin client.
 * NEVER swallows errors — logs and rethrows so callers surface the failure
 * to the Next.js error boundary (per CLAUDE.md rule #5).
 */
export async function fetchStudentAnalytics(
  studentId: string,
  range: StudentAnalyticsRange,
  page: number,
): Promise<StudentAnalyticsPayload> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_student_analytics", {
    p_student_id: studentId,
    p_range: range,
    p_page: page,
    p_page_size: STUDENT_ANALYTICS_PAGE_SIZE,
  });

  if (error) {
    console.error("[student-analytics] RPC failed:", error);
    throw new Error("Failed to load student analytics");
  }

  if (!data) {
    console.error("[student-analytics] RPC returned no data for", studentId);
    throw new Error("Failed to load student analytics");
  }

  // The RPC returns jsonb — supabase-js surfaces it as an unknown object.
  return data as unknown as StudentAnalyticsPayload;
}
