import { KpiItem } from "@/components/student/ProgressBanner";
import { KPI_TARGETS, WORK_TRACKER, ROADMAP_STEPS } from "@/lib/config";
import {
  lifetimeOutreachRag,
  dailyOutreachRag,
  dailyHoursRag,
  daysInProgram as computeDaysInProgram,
} from "@/lib/kpi";
import { formatHoursMinutes } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";

interface StudentKpiSummaryProps {
  lifetimeOutreach: number;
  dailyOutreach: number;
  dailyMinutesWorked: number;
  joinedAt: string;
  currentStepNumber: number | null; // null if no active step
}

function getStepDisplay(stepNumber: number | null): string {
  if (stepNumber === null) return "No active step";
  const step = ROADMAP_STEPS.find((s) => s.step === stepNumber);
  if (!step) return `Step ${stepNumber}`;
  return `Stage ${step.stage}: ${step.stageName} \u2014 ${step.title}`;
}

export function StudentKpiSummary({
  lifetimeOutreach,
  dailyOutreach,
  dailyMinutesWorked,
  joinedAt,
  currentStepNumber,
}: StudentKpiSummaryProps) {
  const days = computeDaysInProgram(joinedAt);

  const lifetimeRag = lifetimeOutreachRag(lifetimeOutreach, days);
  const dailyRag = dailyOutreachRag(dailyOutreach, days);
  const hoursRag = dailyHoursRag(dailyMinutesWorked, days);

  const stepDisplay = getStepDisplay(currentStepNumber);

  return (
    <Card>
      <CardContent className="py-4">
        <div role="region" aria-label="Student KPI summary">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {/* Lifetime Outreach — RAG colored per D-03 */}
            <KpiItem
              label="Lifetime Outreach"
              value={`${lifetimeOutreach.toLocaleString()} / ${KPI_TARGETS.lifetimeOutreach.toLocaleString()}`}
              ragStatus={lifetimeRag}
              ariaLabel={`Lifetime outreach: ${lifetimeOutreach} of ${KPI_TARGETS.lifetimeOutreach}`}
            />

            {/* Daily Outreach — RAG colored per D-03 */}
            <KpiItem
              label="Daily Outreach"
              value={`${dailyOutreach} / ${KPI_TARGETS.dailyOutreach}`}
              ragStatus={dailyRag}
              ariaLabel={`Daily outreach: ${dailyOutreach} of ${KPI_TARGETS.dailyOutreach}`}
            />

            {/* Hours Worked — RAG colored per D-03 */}
            <KpiItem
              label="Hours Worked"
              value={`${formatHoursMinutes(dailyMinutesWorked)} / ${WORK_TRACKER.dailyGoalHours}h`}
              ragStatus={hoursRag}
              ariaLabel={`Hours worked today: ${formatHoursMinutes(dailyMinutesWorked)} of ${WORK_TRACKER.dailyGoalHours} hours`}
            />

            {/* Current Step — no RAG, stage+step display per D-05 */}
            <KpiItem
              label="Current Step"
              value={stepDisplay}
              ariaLabel={`Current roadmap step: ${stepDisplay}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
