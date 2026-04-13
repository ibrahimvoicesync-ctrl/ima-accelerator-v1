/**
 * Phase 48: 5-card KPI grid for /coach/analytics.
 *
 * Stateless presentational component. All values are pre-formatted strings
 * (currency / decimal / count) — formatting is server-side in the page
 * component to avoid hydration drift. Each card mirrors the geometry of the
 * Phase 47 coach dashboard KPI cards exactly (icon box w-10 h-10 rounded-lg
 * with bg-{tint}/10 + text-{tint}, value text-2xl font-bold tabular-nums).
 */

import {
  Trophy,
  DollarSign,
  TrendingUp,
  Mail,
  Send,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import type { CoachAnalyticsStats } from "@/lib/rpc/coach-analytics-types";

type KpiTint = "primary" | "success" | "info" | "warning" | "accent";

type KpiCardData = {
  label: string;
  value: string;
  subLabel: string | null;
  icon: LucideIcon;
  tint: KpiTint;
  ariaLabel: string;
};

// Tailwind cannot tree-shake dynamic class concatenation, so each tint maps
// to a fully-resolved class string. Centralized here so a single rg can audit.
const TINT_CLASSES: Record<KpiTint, { bg: string; text: string }> = {
  primary: { bg: "bg-ima-primary/10", text: "text-ima-primary" },
  success: { bg: "bg-ima-success/10", text: "text-ima-success" },
  info: { bg: "bg-ima-info/10", text: "text-ima-info" },
  warning: { bg: "bg-ima-warning/10", text: "text-ima-warning" },
  accent: { bg: "bg-ima-accent/10", text: "text-ima-accent" },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("en-US");

function formatTopStudent(name: string | null, count: number, suffix: string) {
  return `${integerFormatter.format(count)} ${suffix}`;
}

function buildCards(stats: CoachAnalyticsStats): KpiCardData[] {
  const highestName = stats.highest_deals.student_name ?? "No data yet";
  const highestCount = stats.highest_deals.count;
  const mostName = stats.most_emails.student_name ?? "No data yet";
  const mostCount = stats.most_emails.count;

  return [
    {
      label: "Highest Deals",
      value: formatTopStudent(stats.highest_deals.student_name, highestCount, "deals"),
      subLabel: highestName,
      icon: Trophy,
      tint: "primary",
      ariaLabel: stats.highest_deals.student_name
        ? `Highest deals: ${highestCount} by ${stats.highest_deals.student_name}`
        : `Highest deals: 0`,
    },
    {
      label: "Total Revenue",
      value: currencyFormatter.format(Number(stats.total_revenue) || 0),
      subLabel: null,
      icon: DollarSign,
      tint: "success",
      ariaLabel: `Total revenue: ${currencyFormatter.format(Number(stats.total_revenue) || 0)}`,
    },
    {
      label: "Avg Roadmap Step",
      value: Number(stats.avg_roadmap_step ?? 0).toFixed(1),
      subLabel: null,
      icon: TrendingUp,
      tint: "info",
      ariaLabel: `Average roadmap step: ${Number(stats.avg_roadmap_step ?? 0).toFixed(1)}`,
    },
    {
      label: "Avg Email Count",
      value: integerFormatter.format(Math.round(Number(stats.avg_email_count) || 0)),
      subLabel: "per student",
      icon: Mail,
      tint: "warning",
      ariaLabel: `Average email count: ${integerFormatter.format(Math.round(Number(stats.avg_email_count) || 0))} per student`,
    },
    {
      label: "Most Emails Sent",
      value: formatTopStudent(stats.most_emails.student_name, mostCount, "emails"),
      subLabel: mostName,
      icon: Send,
      tint: "accent",
      ariaLabel: stats.most_emails.student_name
        ? `Most emails sent: ${mostCount} by ${stats.most_emails.student_name}`
        : `Most emails sent: 0`,
    },
  ];
}

export function KPIGrid({ stats }: { stats: CoachAnalyticsStats }) {
  const cards = buildCards(stats);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const tint = TINT_CLASSES[card.tint];
        return (
          <Card key={card.label} aria-label={card.ariaLabel}>
            <CardContent className="p-4 flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-lg ${tint.bg} flex items-center justify-center shrink-0`}
              >
                <Icon className={`h-5 w-5 ${tint.text}`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-ima-text tabular-nums">
                  {card.value}
                </p>
                {card.subLabel ? (
                  <p className="text-base font-semibold text-ima-text truncate">
                    {card.subLabel}
                  </p>
                ) : null}
                <p className="text-xs text-ima-text-secondary">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
