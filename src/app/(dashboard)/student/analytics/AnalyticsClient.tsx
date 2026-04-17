"use client";

/**
 * Phase 46: Student Analytics client component.
 *
 * Renders 6 KPI cards, outreach + hours trend charts (Recharts),
 * roadmap deadline status list, and paginated deal history table.
 * Driven by a single payload from public.get_student_analytics (RPC).
 *
 * Keyboard-accessible charts (role="img" + tabIndex + <details> fallback)
 * per ANALYTICS-09. Every animate-* is motion-safe:. Every interactive
 * element is min-h-[44px]. No hardcoded hex outside the chartColors const,
 * which mirrors tailwind ima-* tokens for Recharts stroke/fill props.
 */

import { useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  DollarSign,
  Flame,
  Handshake,
  Mail,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { ROADMAP_STEPS, WORK_TRACKER } from "@/lib/config";
import {
  getDeadlineStatus,
  type DeadlineStatus,
} from "@/lib/roadmap-utils";
import { cn } from "@/lib/utils";
import {
  STUDENT_ANALYTICS_PAGE_SIZE,
  STUDENT_ANALYTICS_RANGES,
  type DealRow,
  type StudentAnalyticsPayload,
  type StudentAnalyticsRange,
} from "@/lib/rpc/student-analytics-types";
import { DealAttributionChip } from "@/components/shared/DealAttributionChip";
import type { LoggedByUser, ViewerRole } from "@/lib/deals-attribution";

// Chart color constants mirror tailwind.config.ts ima-* tokens.
// Recharts requires literal hex values for stroke/fill props, so a single
// constant object keeps the mapping explicit and auditable.
const chartColors = {
  primary: "#2563EB", // ima-primary
  accent: "#3B82F6", // ima-accent
  border: "#E2E8F0", // ima-border
  textSecondary: "#64748B", // ima-text-secondary
  warning: "#F59E0B", // ima-warning
} as const;

const RANGE_LABELS: Record<StudentAnalyticsRange, string> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  all: "All",
};

const RANGE_ARIA_LABELS: Record<StudentAnalyticsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

interface AnalyticsClientProps {
  initialData: StudentAnalyticsPayload;
  studentId: string;
  joinedAt: string;
  initialRange: StudentAnalyticsRange;
  initialPage: number;
  basePath: "/student/analytics" | "/student_diy/analytics";
  viewerId: string;
  viewerRole: ViewerRole;
  userMap: Record<string, LoggedByUser>;
}

export function AnalyticsClient({
  initialData,
  joinedAt,
  initialRange,
  initialPage,
  basePath,
  viewerId,
  viewerRole,
  userMap,
}: AnalyticsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const data = initialData;
  const range = initialRange;
  const page = initialPage;

  const navigate = useCallback(
    (nextRange: StudentAnalyticsRange, nextPage: number) => {
      const params = new URLSearchParams();
      params.set("range", nextRange);
      params.set("page", String(nextPage));
      startTransition(() => {
        router.push(`${basePath}?${params.toString()}`, { scroll: false });
      });
    },
    [basePath, router],
  );

  const onRangeChange = useCallback(
    (r: StudentAnalyticsRange) => {
      if (r === range) return;
      navigate(r, 1);
    },
    [navigate, range],
  );

  const totalPages = useMemo(
    () =>
      Math.max(1, Math.ceil(data.total_deal_count / STUDENT_ANALYTICS_PAGE_SIZE)),
    [data.total_deal_count],
  );

  const outreachSummary = useMemo(() => {
    const brands = data.outreach_trend.reduce((s, b) => s + b.brands, 0);
    const influencers = data.outreach_trend.reduce(
      (s, b) => s + b.influencers,
      0,
    );
    return { brands, influencers };
  }, [data.outreach_trend]);

  const hoursSummary = useMemo(
    () =>
      data.hours_trend.reduce(
        (s, b) => s + (typeof b.hours === "number" ? b.hours : Number(b.hours)),
        0,
      ),
    [data.hours_trend],
  );

  const hoursBucketLabel =
    range === "7d" || range === "30d" ? "day" : "week";

  return (
    <div
      className={cn(
        "space-y-8",
        isPending && "opacity-75 motion-safe:transition-opacity",
      )}
      aria-busy={isPending || undefined}
    >
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-ima-text">Analytics</h1>
        <p className="text-sm text-ima-text-secondary mt-1">
          Your performance at a glance
        </p>
      </header>

      {/* KPI Strip */}
      <section
        aria-label="Lifetime totals"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 motion-safe:animate-fadeIn"
      >
        <KpiCard
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          label="Total Hours"
          value={formatHours(data.totals.total_hours ?? 0)}
          suffix={
            data.streak > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-ima-warning font-semibold mt-2">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {data.streak}-day streak
              </span>
            ) : null
          }
        />
        <KpiCard
          icon={<Mail className="h-5 w-5" aria-hidden="true" />}
          label="Total Brand Outreach"
          value={(data.totals.total_brand_outreach ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          label="Total Influencer Outreach"
          value={(data.totals.total_influencer_outreach ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={<Handshake className="h-5 w-5" aria-hidden="true" />}
          label="Total Deals"
          value={(data.totals.total_deals ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
          label="Total Revenue"
          value={formatMoney(data.totals.total_revenue ?? 0)}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
          label="Total Profit"
          value={formatMoney(data.totals.total_profit ?? 0)}
        />
      </section>

      {/* Trend charts */}
      <section
        aria-label="Trend charts"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 motion-safe:animate-slideUp"
      >
        {/* Outreach */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Outreach Trend</CardTitle>
            <RangeSelector range={range} onChange={onRangeChange} />
          </CardHeader>
          <CardContent>
            {data.outreach_trend.length === 0 ? (
              <EmptyState
                variant="compact"
                title="No activity in this range"
                description="Try a longer time range, or check back after your next session."
              />
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`Weekly outreach for the selected range. Brands sent: ${outreachSummary.brands}. Influencers sent: ${outreachSummary.influencers}.`}
                  tabIndex={0}
                  className="focus-visible:outline-2 focus-visible:outline-ima-primary rounded"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.outreach_trend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.border}
                      />
                      <XAxis
                        dataKey="week_start"
                        stroke={chartColors.textSecondary}
                        fontSize={12}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        stroke={chartColors.textSecondary}
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${chartColors.border}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(label) => formatDateTick(String(label))}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12 }}
                        iconType="circle"
                      />
                      <Line
                        type="monotone"
                        dataKey="brands"
                        name="Brands"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="influencers"
                        name="Influencers"
                        stroke={chartColors.accent}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-2">
                  <summary className="min-h-[44px] inline-flex items-center text-sm text-ima-primary cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-ima-primary rounded">
                    View data table
                  </summary>
                  <table className="w-full text-xs mt-2 border border-ima-border rounded-lg">
                    <caption className="sr-only">
                      Outreach per week (brands and influencers).
                    </caption>
                    <thead className="bg-ima-surface-light">
                      <tr>
                        <th scope="col" className="text-left p-2">
                          Week of
                        </th>
                        <th scope="col" className="text-right p-2">
                          Brands
                        </th>
                        <th scope="col" className="text-right p-2">
                          Influencers
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.outreach_trend.map((b) => (
                        <tr key={b.week_start} className="border-t border-ima-border">
                          <td className="p-2">{formatDateTick(b.week_start)}</td>
                          <td className="p-2 text-right">{b.brands}</td>
                          <td className="p-2 text-right">{b.influencers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        {/* Hours */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Hours Worked</CardTitle>
            <RangeSelector range={range} onChange={onRangeChange} />
          </CardHeader>
          <CardContent>
            {data.hours_trend.length === 0 ? (
              <EmptyState
                variant="compact"
                title="No activity in this range"
                description="Try a longer time range, or check back after your next session."
              />
            ) : (
              <>
                <div
                  role="img"
                  aria-label={`Hours worked per ${hoursBucketLabel} for the selected range. Total: ${hoursSummary.toFixed(1)} hours.`}
                  tabIndex={0}
                  className="focus-visible:outline-2 focus-visible:outline-ima-primary rounded"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.hours_trend}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.border}
                      />
                      <XAxis
                        dataKey="bucket"
                        stroke={chartColors.textSecondary}
                        fontSize={12}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        stroke={chartColors.textSecondary}
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${chartColors.border}`,
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(label) => formatDateTick(String(label))}
                      />
                      {hoursBucketLabel === "day" && (
                        <ReferenceLine
                          y={WORK_TRACKER.dailyGoalHours}
                          stroke={chartColors.warning}
                          strokeDasharray="4 4"
                          label={{
                            value: "Daily goal",
                            fill: chartColors.warning,
                            fontSize: 11,
                            position: "insideTopRight",
                          }}
                        />
                      )}
                      <Bar
                        dataKey="hours"
                        name="Hours"
                        fill={chartColors.primary}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-2">
                  <summary className="min-h-[44px] inline-flex items-center text-sm text-ima-primary cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-ima-primary rounded">
                    View data table
                  </summary>
                  <table className="w-full text-xs mt-2 border border-ima-border rounded-lg">
                    <caption className="sr-only">
                      Hours worked per {hoursBucketLabel}.
                    </caption>
                    <thead className="bg-ima-surface-light">
                      <tr>
                        <th scope="col" className="text-left p-2">
                          {hoursBucketLabel === "day" ? "Date" : "Week of"}
                        </th>
                        <th scope="col" className="text-right p-2">
                          Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hours_trend.map((b) => (
                        <tr key={b.bucket} className="border-t border-ima-border">
                          <td className="p-2">{formatDateTick(b.bucket)}</td>
                          <td className="p-2 text-right">
                            {Number(b.hours).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Roadmap Progress */}
      <section className="motion-safe:animate-fadeIn" aria-label="Roadmap progress">
        <Card>
          <CardHeader>
            <CardTitle>Roadmap Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-ima-border">
              {ROADMAP_STEPS.map((step) => {
                const row = data.roadmap_progress.find(
                  (r) => r.step_number === step.step,
                );
                const statusValue = (row?.status ?? "locked") as
                  | "locked"
                  | "active"
                  | "completed";
                const deadline = getDeadlineStatus(
                  step.target_days,
                  joinedAt,
                  statusValue,
                  row?.completed_at ?? null,
                );
                return (
                  <li
                    key={step.step}
                    className="flex items-start gap-3 py-3 min-h-[44px]"
                  >
                    <span className="text-xs font-semibold text-ima-text-secondary w-8 flex-shrink-0 pt-1">
                      {step.step}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ima-text">
                        {step.title}
                      </p>
                      <p className="text-xs text-ima-text-secondary mt-0.5">
                        {step.stageName}
                      </p>
                    </div>
                    <RoadmapStatusBadge deadline={deadline} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Deal History */}
      <section className="motion-safe:animate-fadeIn" aria-label="Deal history">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Deal History</CardTitle>
            <p className="text-sm text-ima-text-secondary">
              {data.deal_summary.count} deals · {formatMoney(data.deal_summary.revenue)} revenue ·{" "}
              {formatMoney(data.deal_summary.profit)} profit
            </p>
          </CardHeader>
          <CardContent>
            {data.deals.length === 0 ? (
              <EmptyState
                title="No deals logged yet"
                description="Once you close your first deal, it will show up here. Keep your outreach consistent."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">
                      Paginated deal history with revenue, profit, margin, and
                      attribution.
                    </caption>
                    <thead className="bg-ima-surface-light">
                      <tr>
                        <th scope="col" className="text-left p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          Deal #
                        </th>
                        <th scope="col" className="text-right p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          Revenue
                        </th>
                        <th scope="col" className="text-right p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          Profit
                        </th>
                        <th scope="col" className="text-right p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          Margin
                        </th>
                        <th scope="col" className="text-left p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          Logged
                        </th>
                        <th scope="col" className="text-left p-3 font-medium text-xs uppercase tracking-wide text-ima-text-secondary">
                          By
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deals.map((d) => (
                        <DealTableRow
                          key={d.id}
                          deal={d}
                          viewerId={viewerId}
                          viewerRole={viewerRole}
                          userMap={userMap}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  page={page}
                  totalPages={totalPages}
                  basePath={basePath}
                  searchParams={{ range }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: React.ReactNode;
}

function KpiCard({ icon, label, value, suffix }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <div className="flex items-center gap-2 text-ima-text-secondary">
          {icon}
          <span className="text-xs uppercase tracking-wide font-medium">
            {label}
          </span>
        </div>
        <p className="text-3xl font-bold text-ima-text leading-tight mt-2">
          {value}
        </p>
        {suffix}
      </CardContent>
    </Card>
  );
}

interface RangeSelectorProps {
  range: StudentAnalyticsRange;
  onChange: (r: StudentAnalyticsRange) => void;
}

function RangeSelector({ range, onChange }: RangeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Select time range"
      className="flex flex-wrap gap-2"
    >
      {STUDENT_ANALYTICS_RANGES.map((r) => {
        const active = r === range;
        return (
          <Button
            key={r}
            type="button"
            variant={active ? "primary" : "secondary"}
            size="sm"
            aria-pressed={active}
            aria-label={RANGE_ARIA_LABELS[r]}
            className="min-h-[44px] min-w-[60px]"
            onClick={() => onChange(r)}
          >
            {RANGE_LABELS[r]}
          </Button>
        );
      })}
    </div>
  );
}

function RoadmapStatusBadge({ deadline }: { deadline: DeadlineStatus }) {
  switch (deadline.kind) {
    case "completed":
      return (
        <Badge variant="success">
          <span className="sr-only">Status: </span>
          Completed
          {deadline.daysLate !== null ? ` (${deadline.daysLate}d late)` : ""}
        </Badge>
      );
    case "on-track":
      return (
        <Badge variant="success">
          <span className="sr-only">Status: </span>
          On track · {deadline.deadlineLabel}
        </Badge>
      );
    case "due-soon":
      return (
        <Badge variant="warning">
          <span className="sr-only">Status: </span>
          Due soon · {deadline.deadlineLabel}
        </Badge>
      );
    case "overdue":
      return (
        <Badge variant="error">
          <span className="sr-only">Status: </span>
          Overdue · {deadline.daysOverdue}d
        </Badge>
      );
    case "none":
    default:
      return (
        <Badge variant="default">
          <span className="sr-only">Status: </span>
          No deadline
        </Badge>
      );
  }
}

function DealTableRow({
  deal,
  viewerId,
  viewerRole,
  userMap,
}: {
  deal: DealRow;
  viewerId: string;
  viewerRole: ViewerRole;
  userMap: Record<string, LoggedByUser>;
}) {
  return (
    <tr className="border-t border-ima-border hover:bg-ima-surface-light motion-safe:transition-colors">
      <td className="p-3 font-medium text-ima-text">#{deal.deal_number}</td>
      <td className="p-3 text-right font-mono">{formatMoney(deal.revenue)}</td>
      <td className="p-3 text-right font-mono">{formatMoney(deal.profit)}</td>
      <td className="p-3 text-right text-ima-text-secondary">{deal.margin}%</td>
      <td className="p-3 text-ima-text-secondary">{formatDate(deal.created_at)}</td>
      <td className="p-3">
        <DealAttributionChip
          deal={{ logged_by: deal.logged_by }}
          viewerRole={viewerRole}
          viewerId={viewerId}
          userMap={userMap}
        />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "0";
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })} hrs`;
}

function formatMoney(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  try {
    const date = iso.includes("T") ? iso.split("T")[0] : iso;
    const [y, m, d] = date.split("-");
    return `${m}/${d}/${y.slice(2)}`;
  } catch {
    return iso;
  }
}

function formatDateTick(value: string): string {
  if (!value) return "";
  const date = value.includes("T") ? value.split("T")[0] : value;
  const parts = date.split("-");
  if (parts.length !== 3) return value;
  const [, m, d] = parts;
  return `${m}/${d}`;
}
