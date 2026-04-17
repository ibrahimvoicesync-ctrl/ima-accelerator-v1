/**
 * Phase 64: Owner Analytics page (server component).
 *
 * Fetches the full 24-slot payload (migration 00035 `get_owner_analytics`)
 * once via `getOwnerAnalyticsCached` and hands it to `<OwnerAnalyticsClient>`.
 * The client component owns six independent Weekly / Monthly / Yearly /
 * All Time window toggles and swaps pre-computed slices on toggle — no
 * client re-fetch.
 *
 * Cache: unstable_cache(60s, key=["owner-analytics-v2"], tag=ownerAnalyticsTag())
 * invalidated from /api/deals, /api/deals/[id], /api/work-sessions/[id], and
 * (new in Phase 64) /api/reports.
 *
 * Per CLAUDE.md Hard Rules: ima-* tokens only, admin client on the server only
 * (via getOwnerAnalyticsCached → owner-analytics.ts which imports "server-only"),
 * never swallow errors (error.tsx handles RPC failures).
 */

import { requireRole } from "@/lib/session";
import { getOwnerAnalyticsCached } from "@/lib/rpc/owner-analytics";
import { OwnerAnalyticsClient } from "./OwnerAnalyticsClient";

// Align route-level revalidation with the RPC cache TTL.
export const revalidate = 60;

export default async function OwnerAnalyticsPage() {
  await requireRole("owner");

  const payload = await getOwnerAnalyticsCached();

  return (
    <section
      aria-labelledby="owner-analytics-h1"
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      <h1 id="owner-analytics-h1" className="text-2xl font-bold text-ima-text">
        Owner Analytics
      </h1>
      <p className="mt-1 text-sm text-ima-text-secondary">
        Leaderboards across students and coaches — toggle each card
        independently.
      </p>

      <OwnerAnalyticsClient payload={payload} />
    </section>
  );
}
