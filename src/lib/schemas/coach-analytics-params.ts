/**
 * Phase 48: Zod schema for /coach/analytics URL search params.
 *
 * Validates the four URL params that drive the page (page, pageSize, sort,
 * search) before they touch the RPC. Defense in depth: even if a tampered URL
 * lands at the page, the page either coerces to a valid value or redirects to
 * the clean URL (page.tsx handles the redirect).
 *
 * Page size is locked to literal 25 per Phase 44 D-04 — exposing a different
 * page size via URL tampering is rejected (the schema returns ok:false and the
 * page redirects).
 *
 * Per CLAUDE.md hard rule #7: import { z } from "zod" — never "zod/v4".
 */

import { z } from "zod";
import {
  COACH_ANALYTICS_PAGE_SIZE,
  COACH_ANALYTICS_SORT_KEYS,
  type CoachAnalyticsSort,
} from "@/lib/rpc/coach-analytics-types";

export const coachAnalyticsSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.literal(COACH_ANALYTICS_PAGE_SIZE))
    .default(COACH_ANALYTICS_PAGE_SIZE),
  sort: z
    .enum(COACH_ANALYTICS_SORT_KEYS as unknown as [CoachAnalyticsSort, ...CoachAnalyticsSort[]])
    .default("name_asc"),
  search: z.string().trim().max(100).default(""),
});

export type CoachAnalyticsSearchParams = z.infer<
  typeof coachAnalyticsSearchParamsSchema
>;

/**
 * Safe parser for searchParams. Coerces array values to their first entry
 * (Next.js always passes string | string[] | undefined). Never throws — returns
 * a discriminated union so callers branch on .ok.
 */
export function parseCoachAnalyticsSearchParams(
  raw: Record<string, string | string[] | undefined> | undefined,
): { ok: true; value: CoachAnalyticsSearchParams } | { ok: false } {
  const flat: Record<string, string> = {};
  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined) continue;
      flat[k] = Array.isArray(v) ? (v[0] ?? "") : v;
    }
  }

  const result = coachAnalyticsSearchParamsSchema.safeParse(flat);
  if (!result.success) {
    return { ok: false };
  }
  return { ok: true, value: result.data };
}
