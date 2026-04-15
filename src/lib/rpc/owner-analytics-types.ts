/**
 * Phase 54: Owner Analytics — pure types + tag helper.
 *
 * Safe to import from client components — no server-only deps. The server-side
 * fetcher + cache wrapper lives in ./owner-analytics.ts and imports the admin
 * client + next/cache.
 *
 * Source of truth is the public.get_owner_analytics RPC envelope (migration
 * 00028). Keep this file in lockstep with that SQL — every key here matches a
 * jsonb_build_object key there.
 *
 * Cache tag is GLOBAL (`owner-analytics`) — there is a single owner, so no
 * per-user suffix (unlike coachAnalyticsTag which is per-coach-id). Mutation
 * route handlers call revalidateTag(OWNER_ANALYTICS_TAG, "default") on every
 * deal or work-session mutation that changes lifetime totals.
 */

// ---------------------------------------------------------------------------
// Leaderboard rows — one shape per metric type. Every row shares {rank,
// student_id, student_name, metric_display}; the metric value type differs.
// ---------------------------------------------------------------------------
export type OwnerLeaderboardHoursRow = {
  rank: number;
  student_id: string;
  student_name: string;
  minutes: number;
  metric_display: string; // e.g. "147.5 h"
};

export type OwnerLeaderboardProfitRow = {
  rank: number;
  student_id: string;
  student_name: string;
  // Postgres NUMERIC serializes as string via supabase-js — keep as string.
  // The server-formatted metric_display is what we render; never re-parse.
  profit: string;
  metric_display: string; // e.g. "$12,450"
};

export type OwnerLeaderboardDealsRow = {
  rank: number;
  student_id: string;
  student_name: string;
  deals: number;
  metric_display: string; // e.g. "23"
};

// ---------------------------------------------------------------------------
// Leaderboards envelope (3 ranked top-3 lists).
// ---------------------------------------------------------------------------
export type OwnerLeaderboards = {
  hours_alltime: OwnerLeaderboardHoursRow[]; // 0-3 rows
  profit_alltime: OwnerLeaderboardProfitRow[]; // 0-3 rows
  deals_alltime: OwnerLeaderboardDealsRow[]; // 0-3 rows
};

// ---------------------------------------------------------------------------
// Top-level RPC payload — every key matches the SQL jsonb_build_object.
// ---------------------------------------------------------------------------
export type OwnerAnalyticsPayload = {
  leaderboards: OwnerLeaderboards;
};

// ---------------------------------------------------------------------------
// Cache tag — GLOBAL (not per-user). See file header for rationale.
// ---------------------------------------------------------------------------
export const OWNER_ANALYTICS_TAG = "owner-analytics" as const;

/**
 * revalidateTag key for the owner's cached analytics RPC result.
 *
 * Every mutation on deals / work_sessions that changes lifetime totals MUST
 * call revalidateTag(ownerAnalyticsTag(), "default") — Plan 04 wires this into
 * the four mutation routes: POST /api/deals, PATCH /api/deals/[id],
 * DELETE /api/deals/[id], and PATCH /api/work-sessions/[id] (on completion).
 *
 * Takes no argument (global tag). The function signature mirrors the per-user
 * helpers (`coachAnalyticsTag(coachId)`) so callers have a consistent "call a
 * function to get the tag string" pattern, which makes grep sweeps easier.
 */
export function ownerAnalyticsTag(): string {
  return OWNER_ANALYTICS_TAG;
}
