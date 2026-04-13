/**
 * Phase 51: Coach Milestones RPC — pure types + tag helper.
 *
 * Safe to import from client components — no server-only deps. The server-side
 * fetcher lives in ./coach-milestones.ts and imports the admin client.
 *
 * Envelope shape matches supabase/migrations/00027_get_coach_milestones_and_backfill.sql
 * public.get_coach_milestones(uuid, date, boolean) RETURNS jsonb.
 */

// SYNC: src/lib/config.ts MilestoneType. Duplicated here so client components
// consuming the RPC envelope don't have to import from config.ts (keeps the
// client bundle minimal — MILESTONE_CONFIG et al. are server-side constants).
export type MilestoneType =
  | "tech_setup"
  | "5_influencers"
  | "brand_response"
  | "closed_deal";

export type CoachMilestoneRow = {
  student_id:     string;
  student_name:   string;
  milestone_type: MilestoneType;
  alert_key:      string;
  deal_id:        string | null;  // null for one-shot types; uuid for closed_deal
  occurred_at:    string;         // ISO timestamptz (UTC)
};

export type CoachMilestonesPayload = {
  milestones: CoachMilestoneRow[];
  count:      number;
};

/**
 * revalidateTag key for the coach's cached milestone batch RPC result.
 *
 * Every mutation on an assigned student's deals / reports / roadmap_progress
 * MUST call revalidateTag(coachMilestonesTag(coachId)) — alongside the
 * Phase 47 coachDashboardTag and Phase 48 coachAnalyticsTag.
 *
 * Colon separator matches Phase 47/48 precedent (coach-dashboard:${id},
 * coach-analytics:${id}).
 */
export function coachMilestonesTag(coachId: string): string {
  return `coach-milestones:${coachId}`;
}
