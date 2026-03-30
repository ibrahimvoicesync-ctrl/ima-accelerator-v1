import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * DB-backed rate limiter for API mutation routes.
 *
 * Counts recent requests for the given user + endpoint pair within the
 * rolling window. If the count is below the limit, inserts a log row and
 * returns allowed: true. Otherwise returns allowed: false with no insert.
 *
 * Errors propagate naturally — the calling route handler's try-catch will
 * catch DB errors and return 500. This "fail open on error" approach is
 * intentional: better to let a legitimate user through on a transient DB
 * error than to silently block them.
 *
 * @param userId       - Authenticated user ID (uuid string)
 * @param endpoint     - Route path string, e.g. "/api/reports"
 * @param maxRequests  - Max allowed calls per window (default: 30)
 * @param windowMinutes - Rolling window length in minutes (default: 1)
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests = 30,
  windowMinutes = 1
): Promise<RateLimitResult> {
  const admin = createAdminClient();
  const windowStart = new Date(
    Date.now() - windowMinutes * 60 * 1000
  ).toISOString();

  const { count } = await admin
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("called_at", windowStart);

  const callCount = count ?? 0;

  if (callCount >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: windowMinutes * 60,
    };
  }

  await admin.from("rate_limit_log").insert({ user_id: userId, endpoint });

  return {
    allowed: true,
    remaining: maxRequests - callCount - 1,
    retryAfterSeconds: 0,
  };
}
