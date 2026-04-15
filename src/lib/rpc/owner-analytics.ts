/**
 * Phase 54: Owner Analytics RPC wrapper + cache layer (server-only).
 *
 * Calls public.get_owner_analytics (migration 00028) via the admin client and
 * wraps the result in next/cache unstable_cache (60s TTL, tag `owner-analytics`
 * — global, not per-user). Mutation route handlers in /api/deals and
 * /api/work-sessions call revalidateTag(OWNER_ANALYTICS_TAG, "default") to bust
 * the cache when the underlying lifetime totals change.
 *
 * IMPORTANT: imports createAdminClient + next/cache — server-only. Client
 * components must import types from "@/lib/rpc/owner-analytics-types" instead,
 * never from this file. The `import "server-only"` line at the top will crash
 * the build loudly if a client component drags this module into its bundle.
 *
 * The RPC takes NO parameters. The owner is a single user with platform-wide
 * scope — no p_owner_id, no window, no pagination. Everything is top-3 lifetime.
 */

import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OWNER_ANALYTICS_TAG,
  ownerAnalyticsTag,
  type OwnerAnalyticsPayload,
} from "@/lib/rpc/owner-analytics-types";

// Re-export so server-side callers grab everything from one path.
export {
  OWNER_ANALYTICS_TAG,
  ownerAnalyticsTag,
} from "@/lib/rpc/owner-analytics-types";
export type {
  OwnerLeaderboardHoursRow,
  OwnerLeaderboardProfitRow,
  OwnerLeaderboardDealsRow,
  OwnerLeaderboards,
  OwnerAnalyticsPayload,
} from "@/lib/rpc/owner-analytics-types";

/**
 * Direct (uncached) RPC call. Use this only when the caller explicitly needs
 * the freshest data (none currently — both the /owner/analytics page and the
 * owner-homepage teaser share `getOwnerAnalyticsCached`). Exported for future
 * "force-fresh" surfaces and parity with coach-analytics.ts.
 *
 * NEVER swallows errors — logs and rethrows so callers surface the failure to
 * the Next.js error boundary or HTTP 500 (per CLAUDE.md Hard Rule #5).
 */
export async function fetchOwnerAnalytics(): Promise<OwnerAnalyticsPayload> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_owner_analytics");

  if (error) {
    console.error("[owner-analytics] RPC failed:", error);
    throw new Error(
      `Failed to load owner analytics: ${error.message ?? "unknown"} (code=${error.code ?? "?"})`,
    );
  }
  if (!data) {
    console.error("[owner-analytics] RPC returned no data");
    throw new Error("Failed to load owner analytics: RPC returned no data");
  }

  return data as unknown as OwnerAnalyticsPayload;
}

/**
 * Cached variant — wrapped in unstable_cache(60s) and tagged with
 * OWNER_ANALYTICS_TAG ("owner-analytics"). Plan 04 wires the four mutation
 * routes (POST /api/deals, PATCH /api/deals/[id], DELETE /api/deals/[id],
 * PATCH /api/work-sessions/[id] on completion) to call
 * revalidateTag(OWNER_ANALYTICS_TAG, "default") so leaderboards never go stale.
 *
 * Cache key is `["owner-analytics"]` — single key because the RPC takes no
 * params. All pages / surfaces share the single cache entry.
 */
export async function getOwnerAnalyticsCached(): Promise<OwnerAnalyticsPayload> {
  const cached = unstable_cache(
    async () => fetchOwnerAnalytics(),
    ["owner-analytics"],
    {
      revalidate: 60,
      tags: [ownerAnalyticsTag()],
    },
  );
  return cached();
}
