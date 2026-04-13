/**
 * Phase 48: Coach Analytics RPC wrapper + cache layer (server-only).
 *
 * Calls public.get_coach_analytics (migration 00025) via the admin client and
 * wraps the result in next/cache unstable_cache (60s TTL, tagged for targeted
 * invalidation by mutation route handlers).
 *
 * IMPORTANT: imports createAdminClient + next/cache — server-only. Client
 * components must import types from "@/lib/rpc/coach-analytics-types" instead,
 * never from this file. The `import "server-only"` line at the top will crash
 * the build loudly if a client component drags this module into its bundle.
 */

import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coachAnalyticsTag,
  type CoachAnalyticsPayload,
  type CoachAnalyticsRpcParams,
} from "@/lib/rpc/coach-analytics-types";

// Re-export so server-side callers grab everything from one path.
export {
  coachAnalyticsTag,
  COACH_ANALYTICS_PAGE_SIZE,
  COACH_ANALYTICS_SORT_KEYS,
} from "@/lib/rpc/coach-analytics-types";
export type {
  CoachAnalyticsSort,
  CoachAnalyticsStats,
  CoachTopStudent,
  CoachLeaderboardHoursRow,
  CoachLeaderboardEmailsRow,
  CoachLeaderboardDealsRow,
  CoachLeaderboards,
  CoachDealsTrendBucket,
  CoachActiveInactive,
  CoachStudentRow,
  CoachAnalyticsPagination,
  CoachAnalyticsPayload,
  CoachAnalyticsRpcParams,
} from "@/lib/rpc/coach-analytics-types";

/**
 * Direct (uncached) RPC call. Use this from the CSV export route where the
 * caller wants the freshest data and a higher page_size (full export dump).
 *
 * NEVER swallows errors — logs and rethrows so callers surface the failure
 * to the Next.js error boundary or HTTP 500 (per CLAUDE.md rule #5).
 */
export async function fetchCoachAnalytics(
  coachId: string,
  params: CoachAnalyticsRpcParams,
): Promise<CoachAnalyticsPayload> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_coach_analytics", {
    p_coach_id: coachId,
    p_window_days: params.windowDays,
    p_today: params.today,
    p_leaderboard_limit: params.leaderboardLimit,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_sort: params.sort,
    p_search: params.search.length > 0 ? params.search : null,
  });

  if (error) {
    console.error("[coach-analytics] RPC failed:", error);
    throw new Error(`Failed to load coach analytics: ${error.message ?? "unknown"} (code=${error.code ?? "?"})`);
  }
  if (!data) {
    console.error("[coach-analytics] RPC returned no data for", coachId);
    throw new Error("Failed to load coach analytics: RPC returned no data");
  }

  return data as unknown as CoachAnalyticsPayload;
}

/**
 * Cached variant — wrapped in unstable_cache(60s) and tagged with
 * coach-analytics:${coachId}. Mutation route handlers in /api/deals,
 * /api/reports, and /api/work-sessions call revalidateTag with the same tag
 * to bust the cache when the underlying data changes.
 *
 * Cache key embeds the params object so distinct page/sort/search combinations
 * each get their own cache entry — invalidating the tag busts ALL of them at
 * once, which is exactly what we want when an underlying mutation lands.
 */
export async function getCoachAnalyticsCached(
  coachId: string,
  params: CoachAnalyticsRpcParams,
): Promise<CoachAnalyticsPayload> {
  const cached = unstable_cache(
    async (id: string, p: CoachAnalyticsRpcParams) => fetchCoachAnalytics(id, p),
    ["coach-analytics", coachId, JSON.stringify(params)],
    {
      revalidate: 60,
      tags: [coachAnalyticsTag(coachId)],
    },
  );
  return cached(coachId, params);
}
