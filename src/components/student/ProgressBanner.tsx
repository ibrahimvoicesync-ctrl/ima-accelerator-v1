import { cn, formatHoursMinutes } from "@/lib/utils";
import { KPI_TARGETS, WORK_TRACKER } from "@/lib/config";
import {
  lifetimeOutreachRag,
  dailyOutreachRag,
  dailyHoursRag,
  ragToColorClass,
  ragToBgClass,
  daysInProgram as computeDaysInProgram,
  type RagStatus,
} from "@/lib/kpi";

interface ProgressBannerProps {
  lifetimeOutreach: number;
  dailyOutreach: number;
  dailyMinutesWorked: number;
  callsJoined: number;
  brandsContacted: number;
  influencersContacted: number;
  joinedAt: string;
  outreachStarted: boolean;
}

export function KpiItem({
  label,
  value,
  ragStatus,
  ariaLabel,
}: {
  label: string;
  value: string;
  ragStatus?: RagStatus;
  ariaLabel: string;
}) {
  const colorClass = ragStatus ? ragToColorClass(ragStatus) : "text-ima-text-secondary";
  const dotClass = ragStatus ? ragToBgClass(ragStatus) : undefined;

  return (
    <div className="flex items-center gap-1.5" aria-label={ariaLabel}>
      {dotClass && (
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass)} aria-hidden="true" />
      )}
      <span className="text-ima-text-muted">{label}:</span>
      <span className={cn("font-semibold", colorClass)}>{value}</span>
    </div>
  );
}

export function ProgressBanner({
  lifetimeOutreach,
  dailyOutreach,
  dailyMinutesWorked,
  callsJoined,
  brandsContacted,
  influencersContacted,
  joinedAt,
  outreachStarted,
}: ProgressBannerProps) {
  // RAG colors activate only after step 7 (outreach prep) is completed
  const days = outreachStarted ? computeDaysInProgram(joinedAt) : 0;

  const lifetimeRag = lifetimeOutreachRag(lifetimeOutreach, days);
  const dailyRag = dailyOutreachRag(dailyOutreach, days);
  const hoursRag = dailyHoursRag(dailyMinutesWorked, days);

  return (
    <div
      className="sticky top-0 z-10 bg-ima-surface border-b border-ima-border px-4 py-3"
      role="region"
      aria-label="KPI summary"
    >
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {/* Lifetime Outreach — RAG colored per D-01 */}
        <KpiItem
          label="Lifetime Outreach"
          value={`${lifetimeOutreach.toLocaleString()} / ${KPI_TARGETS.lifetimeOutreach.toLocaleString()}`}
          ragStatus={lifetimeRag}
          ariaLabel={`Lifetime outreach: ${lifetimeOutreach} of ${KPI_TARGETS.lifetimeOutreach}`}
        />

        {/* Daily Outreach — RAG colored per D-02 */}
        <KpiItem
          label="Daily Outreach"
          value={`${dailyOutreach} / ${KPI_TARGETS.dailyOutreach}`}
          ragStatus={dailyRag}
          ariaLabel={`Daily outreach: ${dailyOutreach} of ${KPI_TARGETS.dailyOutreach}`}
        />

        {/* Daily Hours — RAG colored per D-03 */}
        <KpiItem
          label="Hours Worked"
          value={`${formatHoursMinutes(dailyMinutesWorked)} / ${WORK_TRACKER.dailyGoalHours}h`}
          ragStatus={hoursRag}
          ariaLabel={`Hours worked today: ${formatHoursMinutes(dailyMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours} hours`}
        />

        {/* Calls Joined — no RAG per D-06 */}
        <KpiItem
          label="Calls Joined"
          value={String(callsJoined)}
          ariaLabel={`Calls joined today: ${callsJoined}`}
        />

        {/* Brands Outreach — no RAG per D-06 */}
        <KpiItem
          label="Brands Outreach"
          value={String(brandsContacted)}
          ariaLabel={`Brands outreach today: ${brandsContacted}`}
        />

        {/* Influencers Outreach — no RAG per D-06 */}
        <KpiItem
          label="Influencers Outreach"
          value={String(influencersContacted)}
          ariaLabel={`Influencers outreach today: ${influencersContacted}`}
        />
      </div>
    </div>
  );
}
