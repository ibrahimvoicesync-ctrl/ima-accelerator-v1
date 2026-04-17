"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Check,
  Clock,
  DollarSign,
  Flame,
  Handshake,
  Mail,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
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

// Recharts requires literal hex values for stroke/fill props. Mirrors ima-* tokens.
const chartColors = {
  primary: "#2563EB", // ima-primary
  border: "#E2E8F0", // ima-border
  textMuted: "#94A3B8", // ima-text-muted
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
  /** Student DIY hides outreach metrics (KPIs + trend chart). Default true for the mentored student view. */
  showOutreach?: boolean;
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
  showOutreach = true,
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

  const roadmapSummary = useMemo(() => {
    const completed = data.roadmap_progress.filter(
      (r) => r.status === "completed",
    ).length;
    const total = ROADMAP_STEPS.length;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [data.roadmap_progress]);

  return (
    <div
      className={cn(
        "space-y-12",
        isPending && "opacity-75 motion-safe:transition-opacity",
      )}
      aria-busy={isPending || undefined}
    >
      {/* Hero — monumental lifetime hours. Single focal point per view. */}
      <header className="motion-safe:animate-fadeIn">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h1 className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
            Analytics &middot; Lifetime
          </h1>
          {data.streak > 0 ? (
            <span className="inline-flex items-center gap-1.5 bg-ima-primary/10 text-ima-primary rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums">
              <Flame className="h-3 w-3" aria-hidden="true" />
              {data.streak}-day streak
            </span>
          ) : null}
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-6xl md:text-7xl font-semibold tabular-nums tracking-tight leading-[0.95] text-ima-primary">
            {formatHoursCompact(data.totals.total_hours ?? 0)}
          </span>
          <span className="text-xl md:text-2xl font-medium text-ima-text-muted tabular-nums mb-1.5">
            hrs worked
          </span>
        </div>
      </header>

      {/* KPI Strip — lifetime totals. First (hours) is the single blue signal. */}
      <section
        aria-label="Lifetime totals"
        className={cn(
          "grid grid-cols-2 gap-3 motion-safe:animate-fadeIn",
          showOutreach
            ? "sm:grid-cols-3 lg:grid-cols-6"
            : "sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        <KpiCard
          emphasis
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          label="Total Hours"
          value={formatHours(data.totals.total_hours ?? 0)}
        />
        {showOutreach ? (
          <>
            <KpiCard
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              label="Brand Outreach"
              value={(data.totals.total_brand_outreach ?? 0).toLocaleString()}
            />
            <KpiCard
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              label="Influencer Outreach"
              value={(
                data.totals.total_influencer_outreach ?? 0
              ).toLocaleString()}
            />
          </>
        ) : null}
        <KpiCard
          icon={<Handshake className="h-4 w-4" aria-hidden="true" />}
          label="Total Deals"
          value={(data.totals.total_deals ?? 0).toLocaleString()}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
          label="Total Revenue"
          value={formatMoney(data.totals.total_revenue ?? 0)}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          label="Total Profit"
          value={formatMoney(data.totals.total_profit ?? 0)}
        />
      </section>

      {/* Trend charts — monochrome blue. Single range selector controls both. */}
      <section
        aria-label="Trend charts"
        className="motion-safe:animate-slideUp"
      >
        <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
          <h2 className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text">
            Trend
          </h2>
          <RangeSelector range={range} onChange={onRangeChange} />
        </div>
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            showOutreach && "lg:grid-cols-2",
          )}
        >
          {/* Outreach */}
          {showOutreach ? (
          <div className="rounded-2xl border border-ima-border bg-ima-surface p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
                Outreach
              </p>
              <p className="text-xs text-ima-text-secondary tabular-nums">
                {outreachSummary.brands + outreachSummary.influencers} sent
              </p>
            </div>
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
                  aria-label={`Outreach for the selected range. Brands sent: ${outreachSummary.brands}. Influencers sent: ${outreachSummary.influencers}.`}
                  tabIndex={0}
                  className="focus-visible:outline-2 focus-visible:outline-ima-primary rounded"
                >
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={data.outreach_trend}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="outreachBrandsFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={chartColors.primary}
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="100%"
                            stopColor={chartColors.primary}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.border}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="week_start"
                        stroke={chartColors.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        stroke={chartColors.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${chartColors.border}`,
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow:
                            "0 8px 25px -5px rgba(15, 23, 42, 0.08)",
                        }}
                        labelFormatter={(label) =>
                          formatDateTick(String(label))
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="brands"
                        name="Brands"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        fill="url(#outreachBrandsFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="influencers"
                        name="Influencers"
                        stroke={chartColors.primary}
                        strokeOpacity={0.4}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 text-[11px] uppercase tracking-[0.18em] font-medium text-ima-text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full bg-ima-primary"
                      aria-hidden="true"
                    />
                    Brands &middot; {outreachSummary.brands}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full bg-ima-primary/40"
                      aria-hidden="true"
                    />
                    Influencers &middot; {outreachSummary.influencers}
                  </span>
                </div>
                <details className="mt-3">
                  <summary className="min-h-[44px] inline-flex items-center text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary cursor-pointer hover:text-ima-primary-hover focus-visible:outline-2 focus-visible:outline-ima-primary rounded">
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
                        <tr
                          key={b.week_start}
                          className="border-t border-ima-border"
                        >
                          <td className="p-2">{formatDateTick(b.week_start)}</td>
                          <td className="p-2 text-right tabular-nums">
                            {b.brands}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {b.influencers}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </div>
          ) : null}

          {/* Hours */}
          <div className="rounded-2xl border border-ima-border bg-ima-surface p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-ima-text-muted">
                Hours worked
              </p>
              <p className="text-xs text-ima-text-secondary tabular-nums">
                {hoursSummary.toFixed(1)} hrs
              </p>
            </div>
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
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={data.hours_trend}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartColors.border}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="bucket"
                        stroke={chartColors.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatDateTick}
                      />
                      <YAxis
                        stroke={chartColors.textMuted}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(37, 99, 235, 0.05)" }}
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: `1px solid ${chartColors.border}`,
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow:
                            "0 8px 25px -5px rgba(15, 23, 42, 0.08)",
                        }}
                        labelFormatter={(label) =>
                          formatDateTick(String(label))
                        }
                      />
                      {hoursBucketLabel === "day" && (
                        <ReferenceLine
                          y={WORK_TRACKER.dailyGoalHours}
                          stroke={chartColors.textMuted}
                          strokeDasharray="4 4"
                          label={{
                            value: "Daily goal",
                            fill: chartColors.textMuted,
                            fontSize: 10,
                            position: "insideTopRight",
                          }}
                        />
                      )}
                      <Bar
                        dataKey="hours"
                        name="Hours"
                        fill={chartColors.primary}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] font-medium text-ima-text-muted">
                  Per {hoursBucketLabel} &middot; {hoursSummary.toFixed(1)} hrs total
                </p>
                <details className="mt-3">
                  <summary className="min-h-[44px] inline-flex items-center text-xs uppercase tracking-[0.18em] font-semibold text-ima-primary cursor-pointer hover:text-ima-primary-hover focus-visible:outline-2 focus-visible:outline-ima-primary rounded">
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
                        <tr
                          key={b.bucket}
                          className="border-t border-ima-border"
                        >
                          <td className="p-2">{formatDateTick(b.bucket)}</td>
                          <td className="p-2 text-right tabular-nums">
                            {Number(b.hours).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Roadmap Progress — progress bar + filled-circle "stack of wins" checklist. */}
      <section
        className="motion-safe:animate-fadeIn"
        aria-label="Roadmap progress"
      >
        <div className="rounded-2xl border border-ima-border bg-ima-surface p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-3 mb-5 flex-wrap">
            <h2 className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text">
              Roadmap progress
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-ima-text-muted tabular-nums">
              {roadmapSummary.completed}/{roadmapSummary.total} steps &middot;{" "}
              {roadmapSummary.percent}%
            </p>
          </div>
          <div
            className="bg-ima-surface-light rounded-full h-2.5 overflow-hidden mb-6"
            role="progressbar"
            aria-valuenow={roadmapSummary.completed}
            aria-valuemin={0}
            aria-valuemax={roadmapSummary.total}
            aria-label={`Roadmap progress: ${roadmapSummary.completed} of ${roadmapSummary.total} steps completed`}
          >
            <div
              className="h-full rounded-full bg-ima-primary motion-safe:transition-[width] duration-700 ease-out"
              style={{ width: `${roadmapSummary.percent}%` }}
            />
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
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
                  className="flex items-start gap-3 py-1.5 min-h-[44px]"
                >
                  <StepMedallion
                    step={step.step}
                    status={statusValue}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium leading-tight",
                        statusValue === "locked"
                          ? "text-ima-text-muted"
                          : "text-ima-text",
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ima-text-muted mt-1">
                      {step.stageName}
                    </p>
                  </div>
                  <RoadmapStatusTag deadline={deadline} />
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Deal History — stitch-blend table: hero summary, filled-circle rank motif, tabular-nums columns. */}
      <section
        className="motion-safe:animate-fadeIn"
        aria-label="Deal history"
      >
        <div className="rounded-2xl border border-ima-border bg-ima-surface p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="text-xs uppercase tracking-[0.22em] font-semibold text-ima-text">
                Deal history
              </h2>
              <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-ima-text-muted mt-1 tabular-nums">
                {data.deal_summary.count} closed &middot; {data.deals.length} on
                this page
              </p>
            </div>
            <div className="flex items-end gap-6">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-ima-text-muted">
                  Revenue
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-ima-text mt-0.5">
                  {formatMoney(data.deal_summary.revenue)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-ima-text-muted">
                  Profit
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-ima-primary mt-0.5">
                  {formatMoney(data.deal_summary.profit)}
                </p>
              </div>
            </div>
          </div>

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
                  <thead>
                    <tr className="border-b border-ima-border">
                      <th
                        scope="col"
                        className="text-left py-3 pr-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted"
                      >
                        Deal
                      </th>
                      <th
                        scope="col"
                        className="text-right py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted"
                      >
                        Revenue
                      </th>
                      <th
                        scope="col"
                        className="text-right py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted"
                      >
                        Profit
                      </th>
                      <th
                        scope="col"
                        className="text-right py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted"
                      >
                        Margin
                      </th>
                      <th
                        scope="col"
                        className="text-left py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted hidden sm:table-cell"
                      >
                        Logged
                      </th>
                      <th
                        scope="col"
                        className="text-left py-3 pl-3 font-semibold text-[10px] uppercase tracking-[0.18em] text-ima-text-muted"
                      >
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
        </div>
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
  /** If true, paints the value in ima-primary and lifts the card with a soft tint. Use on the single hero KPI per view. */
  emphasis?: boolean;
}

function KpiCard({ icon, label, value, emphasis }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 md:p-5 flex flex-col gap-2",
        emphasis
          ? "border-ima-primary/25 bg-ima-surface-accent"
          : "border-ima-border bg-ima-surface",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          emphasis ? "text-ima-primary" : "text-ima-text-muted",
        )}
      >
        {icon}
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-semibold tabular-nums tracking-tight leading-tight",
          emphasis
            ? "text-3xl md:text-4xl text-ima-primary"
            : "text-2xl md:text-3xl text-ima-text",
        )}
      >
        {value}
      </p>
    </div>
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
      className="inline-flex items-center gap-1 rounded-xl border border-ima-border bg-ima-surface p-1"
    >
      {STUDENT_ANALYTICS_RANGES.map((r) => {
        const active = r === range;
        return (
          <Button
            key={r}
            type="button"
            variant="secondary"
            size="sm"
            aria-pressed={active}
            aria-label={RANGE_ARIA_LABELS[r]}
            className={cn(
              "min-h-[44px] min-w-[48px] rounded-lg border-0 text-xs font-semibold tracking-wide",
              active
                ? "bg-ima-primary text-white hover:bg-ima-primary-hover"
                : "bg-transparent text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-text",
            )}
            onClick={() => onChange(r)}
          >
            {RANGE_LABELS[r]}
          </Button>
        );
      })}
    </div>
  );
}

function StepMedallion({
  step,
  status,
}: {
  step: number;
  status: "locked" | "active" | "completed";
}) {
  if (status === "completed") {
    return (
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ima-primary text-white mt-0.5"
        aria-hidden="true"
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ima-surface-accent text-ima-primary text-[11px] font-semibold tabular-nums border border-ima-primary mt-0.5"
        aria-hidden="true"
      >
        {step}
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-ima-border text-ima-text-muted text-[11px] font-semibold tabular-nums mt-0.5"
      aria-hidden="true"
    >
      {step}
    </span>
  );
}

function RoadmapStatusTag({ deadline }: { deadline: DeadlineStatus }) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold tabular-nums whitespace-nowrap";
  switch (deadline.kind) {
    case "completed":
      return (
        <span className={cn(base, "bg-ima-primary/10 text-ima-primary")}>
          <span className="sr-only">Status: </span>
          Done
          {deadline.daysLate !== null ? ` · ${deadline.daysLate}d late` : ""}
        </span>
      );
    case "on-track":
      return (
        <span className={cn(base, "bg-ima-success/10 text-ima-success")}>
          <span className="sr-only">Status: </span>
          On track
        </span>
      );
    case "due-soon":
      return (
        <span className={cn(base, "bg-ima-warning/10 text-ima-warning")}>
          <span className="sr-only">Status: </span>
          Due soon
        </span>
      );
    case "overdue":
      return (
        <span className={cn(base, "bg-ima-error/10 text-ima-error")}>
          <span className="sr-only">Status: </span>
          {deadline.daysOverdue}d late
        </span>
      );
    case "none":
    default:
      return (
        <span
          className={cn(
            base,
            "bg-ima-surface-light text-ima-text-muted border border-ima-border",
          )}
        >
          <span className="sr-only">Status: </span>
          Pending
        </span>
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
    <tr className="border-b border-ima-border last:border-b-0 hover:bg-ima-surface-light motion-safe:transition-colors">
      <td className="py-3 pr-3">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ima-primary text-white text-xs font-semibold tabular-nums"
          aria-label={`Deal ${deal.deal_number}`}
        >
          {deal.deal_number}
        </span>
      </td>
      <td className="py-3 px-3 text-right tabular-nums font-medium text-ima-text">
        {formatMoney(deal.revenue)}
      </td>
      <td className="py-3 px-3 text-right tabular-nums font-semibold text-ima-primary">
        {formatMoney(deal.profit)}
      </td>
      <td className="py-3 px-3 text-right tabular-nums text-ima-text-secondary">
        {deal.margin}%
      </td>
      <td className="py-3 px-3 text-ima-text-secondary tabular-nums hidden sm:table-cell">
        {formatDate(deal.created_at)}
      </td>
      <td className="py-3 pl-3">
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

function formatHoursCompact(hours: number): string {
  if (!Number.isFinite(hours)) return "0";
  const rounded = Math.round(hours * 10) / 10;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

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
