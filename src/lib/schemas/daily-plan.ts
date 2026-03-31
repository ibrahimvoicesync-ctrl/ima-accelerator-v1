import { z } from "zod";
import { WORK_TRACKER } from "@/lib/config";

/**
 * Zod schema for a single session entry within a daily plan.
 * session_minutes must be one of the config-defined options (30, 45, 60).
 * break_type is "short", "long", or "none" (last session has no break).
 * break_minutes is validated against config presets per break_type.
 */
export const sessionEntrySchema = z.object({
  session_minutes: z.number().int().refine(
    (v) => (WORK_TRACKER.sessionDurationOptions as readonly number[]).includes(v),
    { message: "session_minutes must be 30, 45, or 60" }
  ),
  break_type: z.enum(["short", "long", "none"]),
  break_minutes: z.number().int().min(0),
});

/**
 * Zod schema for the full plan_json object stored in daily_plans.plan_json.
 * Per D-07: version: 1 is required for schema evolution safety.
 * total_work_minutes is the sum of all session_minutes (max 240 = 4 hours).
 * sessions array must have at least 1 entry.
 */
export const planJsonSchema = z.object({
  version: z.literal(1),
  total_work_minutes: z.number().int().min(1).max(WORK_TRACKER.dailyGoalHours * 60),
  sessions: z.array(sessionEntrySchema).min(1),
});

/** TypeScript type inferred from planJsonSchema */
export type PlanJson = z.infer<typeof planJsonSchema>;
