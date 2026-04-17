/**
 * Phase 52: Shared types for the /coach/alerts UI surface.
 *
 * Safe to import from BOTH server components (page.tsx) and client components
 * (CoachAlertsClient.tsx) — contains no server-only deps and no React runtime.
 *
 * The RPC payload (CoachMilestoneRow) covers four milestone types:
 * "tech_setup" | "5_influencers" | "brand_response" | "closed_deal".
 * The legacy 100h coach alert (quick task 260401-cwd, NOTIF-08) is NOT
 * produced by the RPC — it is computed directly in page.tsx. To show both
 * feeds in one grouped UI, Plan 02 merges the legacy shape into CoachAlertFeedItem.
 */

import type { CoachMilestoneRow } from "@/lib/rpc/coach-milestones-types";
import type { LucideIcon } from "lucide-react";
import { Trophy, Users, Mail, DollarSign, CheckCircle } from "lucide-react";

/**
 * Union of every alert type shown on /coach/alerts. Extends the RPC's
 * MilestoneType with the legacy "100h_milestone" surfaced by the existing
 * 45-day qualification query in page.tsx.
 */
export type CoachAlertFeedType =
  | "100h_milestone"
  | "tech_setup"
  | "5_influencers"
  | "brand_response"
  | "closed_deal";

/**
 * Shape consumed by CoachAlertsClient. Intentionally flat so the client
 * component does not need to know whether a row came from the RPC or the
 * legacy 100h query.
 *
 * - `alert_key` — unique per row; used as React key AND as POST body for
 *   /api/alerts/dismiss.
 * - `student_id` — used for routing to /coach/students/{id} and for group key.
 * - `student_name` — display only.
 * - `milestone_type` — drives MILESTONE_META lookup (icon, label, badge variant).
 * - `occurred_at` — ISO timestamptz (UTC); drives sort within and across groups.
 * - `message` — optional free-text subtitle (used by 100h_milestone for the
 *   "X hours in Y days" phrasing). RPC-sourced rows can leave this null.
 * - `deal_id` — only populated for `closed_deal`; null otherwise.
 */
export interface CoachAlertFeedItem {
  alert_key: string;
  student_id: string;
  student_name: string;
  milestone_type: CoachAlertFeedType;
  occurred_at: string;
  message: string | null;
  deal_id: string | null;
}

/**
 * Adapter — converts a CoachMilestoneRow (from the RPC) into the flat
 * CoachAlertFeedItem shape. Consumed by page.tsx when merging feeds.
 */
export function milestoneRowToFeedItem(row: CoachMilestoneRow): CoachAlertFeedItem {
  return {
    alert_key: row.alert_key,
    student_id: row.student_id,
    student_name: row.student_name,
    milestone_type: row.milestone_type,
    occurred_at: row.occurred_at,
    message: null,
    deal_id: row.deal_id,
  };
}

/**
 * Visual metadata per milestone type. Mirrors 52-UI-SPEC.md
 * "Milestone Type Labels and Icons" contract exactly.
 *
 * - `label`    — badge text.
 * - `Icon`     — lucide-react component (rendered with aria-hidden="true").
 * - `iconTint` — Tailwind text class for the icon.
 * - `iconBg`   — Tailwind bg class for the 40x40 icon container (tinted /10).
 * - `badgeVariant` — maps to Badge component variant prop.
 */
export const MILESTONE_META: Record<
  CoachAlertFeedType,
  {
    label: string;
    Icon: LucideIcon;
    iconTint: string;
    iconBg: string;
    badgeVariant: "success" | "info";
  }
> = {
  "100h_milestone": {
    label: "100h Milestone",
    Icon: Trophy,
    iconTint: "text-ima-success",
    iconBg: "bg-ima-success/10",
    badgeVariant: "success",
  },
  "5_influencers": {
    label: "5 Influencers Closed",
    Icon: Users,
    iconTint: "text-ima-primary",
    iconBg: "bg-ima-primary/10",
    badgeVariant: "info",
  },
  "brand_response": {
    label: "Brand Response",
    Icon: Mail,
    iconTint: "text-ima-primary",
    iconBg: "bg-ima-primary/10",
    badgeVariant: "info",
  },
  "closed_deal": {
    label: "Deal Closed",
    Icon: DollarSign,
    iconTint: "text-ima-success",
    iconBg: "bg-ima-success/10",
    badgeVariant: "success",
  },
  // Phase 62 (v1.8 F5): Label renamed "Setup Complete" → "Set Up Your Agency"
  // to match ROADMAP_STEPS[3].title. Internal type key `tech_setup` is PRESERVED
  // across CoachAlertFeedType, dismissal-key prefix `milestone_tech_setup:%`,
  // config keys (techSetupStep, techSetupEnabled), and the RPC's CTE name —
  // renaming the key would invalidate in-flight dismissals.
  "tech_setup": {
    label: "Set Up Your Agency",
    Icon: CheckCircle,
    iconTint: "text-ima-primary",
    iconBg: "bg-ima-primary/10",
    badgeVariant: "info",
  },
};
