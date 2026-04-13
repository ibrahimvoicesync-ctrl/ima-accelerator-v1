/**
 * Phase 51: Coach Milestones RPC wrapper + cache layer (server-only).
 *
 * Calls public.get_coach_milestones (migration 00027) via the admin client and
 * wraps the result in next/cache unstable_cache (60s TTL, tagged for targeted
 * invalidation by mutation route handlers).
 *
 * IMPORTANT: imports createAdminClient + next/cache — server-only. Client
 * components must import types from "@/lib/rpc/coach-milestones-types" instead,
 * never from this file. The `import "server-only"` line at the top will crash
 * the build loudly if a client component drags this module into its bundle.
 */

import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { MILESTONE_FEATURE_FLAGS } from "@/lib/config";
import {
  coachMilestonesTag,
  type CoachMilestonesPayload,
} from "@/lib/rpc/coach-milestones-types";

// Re-export so server-side callers grab everything from one path.
export { coachMilestonesTag } from "@/lib/rpc/coach-milestones-types";
export type {
  MilestoneType,
  CoachMilestoneRow,
  CoachMilestonesPayload,
} from "@/lib/rpc/coach-milestones-types";

/**
 * Direct (uncached) RPC call. Use this from paths where the caller wants the
 * freshest data (e.g., post-dismiss refresh in /coach/alerts — Phase 52).
 *
 * NEVER swallows errors — logs and rethrows per CLAUDE.md rule #5.
 *
 * Tech-setup flag: read from MILESTONE_FEATURE_FLAGS.techSetupEnabled. Flipping
 * that constant in src/lib/config.ts alone activates the tech-setup branch in
 * the RPC — no migration needed (until D-06 resolves, at which point a new
 * migration MUST backfill historical tech-setup completions per RESEARCH
 * Pitfall 6).
 */
export async function fetchCoachMilestones(
  coachId: string,
  today:   string,
): Promise<CoachMilestonesPayload> {
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc("get_coach_milestones", {
    p_coach_id:           coachId,
    p_today:              today,
    p_tech_setup_enabled: MILESTONE_FEATURE_FLAGS.techSetupEnabled,
  });

  if (error) {
    console.error("[coach-milestones] RPC failed:", error);
    throw new Error(
      `Failed to load coach milestones: ${error.message ?? "unknown"} (code=${error.code ?? "?"})`,
    );
  }
  if (!data) {
    console.error("[coach-milestones] RPC returned no data for", coachId);
    throw new Error("Failed to load coach milestones: RPC returned no data");
  }

  return data as unknown as CoachMilestonesPayload;
}

/**
 * Cached variant — wrapped in unstable_cache(60s) and tagged with
 * coach-milestones:${coachId}. Mutation route handlers in /api/deals,
 * /api/reports, /api/roadmap call revalidateTag with the same tag to bust
 * the cache when an underlying qualifying event lands.
 *
 * Cache key embeds the today string so a date rollover automatically yields a
 * fresh entry — invalidating the tag busts ALL date variants at once.
 */
export async function getCoachMilestonesCached(
  coachId: string,
  today:   string,
): Promise<CoachMilestonesPayload> {
  const cached = unstable_cache(
    async (id: string, t: string) => fetchCoachMilestones(id, t),
    ["coach-milestones", coachId, today],
    {
      revalidate: 60,
      tags: [coachMilestonesTag(coachId)],
    },
  );
  return cached(coachId, today);
}
