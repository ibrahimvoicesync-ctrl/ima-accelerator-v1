"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { StarRating } from "./StarRating";
import { DAILY_REPORT, VALIDATION } from "@/lib/config";
import { formatHours } from "@/lib/utils";
import type { Database } from "@/lib/types";

type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];

interface ReportFormData {
  star_rating: number;
  brands_contacted: number;
  influencers_contacted: number;
  calls_joined: number;
  wins?: string;
  improvements?: string;
}

interface ReportFormProps {
  date: string;
  existingReport: DailyReport | null;
  autoMinutes: number;
  onSuccess?: () => void;
}

export function ReportForm({ date, existingReport, autoMinutes, onSuccess }: ReportFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [starRating, setStarRating] = useState(existingReport?.star_rating ?? 0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReportFormData>({
    defaultValues: {
      star_rating: existingReport?.star_rating ?? 0,
      brands_contacted: existingReport?.brands_contacted ?? 0,
      influencers_contacted: existingReport?.influencers_contacted ?? 0,
      calls_joined: existingReport?.calls_joined ?? 0,
      wins: existingReport?.wins ?? "",
      improvements: existingReport?.improvements ?? "",
    },
  });

  const winsValue = watch("wins") ?? "";
  const improvementsValue = watch("improvements") ?? "";

  const onSubmit = async (data: ReportFormData) => {
    if (starRating < 1) {
      toast({ type: "error", title: "Please rate your day" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          hours_worked: Math.round((autoMinutes / 60) * 100) / 100,
          star_rating: starRating,
          brands_contacted: data.brands_contacted,
          influencers_contacted: data.influencers_contacted,
          calls_joined: data.calls_joined,
          wins: data.wins || undefined,
          improvements: data.improvements || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ type: "error", title: err.error || "Failed to submit report" });
        return;
      }

      await res.json();
      toast({ type: "success", title: existingReport ? "Report updated!" : "Report submitted!" });
      onSuccess?.();
    } catch {
      toast({ type: "error", title: "Failed to submit report" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle>{existingReport ? "Update Report" : "Submit Report"}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Hours worked (read-only) */}
          <div>
            <p className="text-sm font-medium text-ima-text-secondary">
              Hours Worked Today
            </p>
            <p className="mt-1 text-2xl font-bold text-ima-text">
              {formatHours(autoMinutes)}
            </p>
          </div>

          {/* Star rating */}
          <div>
            <p id="star-rating-label" className="text-sm font-medium text-ima-text-secondary mb-2">
              {DAILY_REPORT.fields.starRating.label}
            </p>
            <StarRating value={starRating} onChange={setStarRating} />
          </div>

          {/* Outreach fields */}
          <fieldset>
            <legend className="text-sm font-medium text-ima-text-secondary mb-2">
              Outreach Today
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={DAILY_REPORT.fields.brandsContacted.label}
                type="number"
                min={VALIDATION.brandsContacted.min}
                max={VALIDATION.brandsContacted.max}
                error={errors.brands_contacted?.message}
                {...register("brands_contacted", { valueAsNumber: true })}
              />
              <Input
                label={DAILY_REPORT.fields.influencersContacted.label}
                type="number"
                min={VALIDATION.influencersContacted.min}
                max={VALIDATION.influencersContacted.max}
                error={errors.influencers_contacted?.message}
                {...register("influencers_contacted", { valueAsNumber: true })}
              />
            </div>
            <div className="mt-3">
              <Input
                label={DAILY_REPORT.fields.callsJoined.label}
                type="number"
                min={VALIDATION.callsJoined.min}
                max={VALIDATION.callsJoined.max}
                error={errors.calls_joined?.message}
                {...register("calls_joined", { valueAsNumber: true })}
              />
            </div>
          </fieldset>

          {/* Wins */}
          <div>
            <Textarea
              label={DAILY_REPORT.fields.wins.label}
              maxLength={VALIDATION.reportWins.max}
              error={errors.wins?.message}
              {...register("wins")}
            />
            <p className="text-xs text-ima-text-muted mt-1 text-right">
              {winsValue.length}/{VALIDATION.reportWins.max}
            </p>
          </div>

          {/* Improvements */}
          <div>
            <Textarea
              label={DAILY_REPORT.fields.improvements.label}
              maxLength={VALIDATION.reportImprovements.max}
              error={errors.improvements?.message}
              {...register("improvements")}
            />
            <p className="text-xs text-ima-text-muted mt-1 text-right">
              {improvementsValue.length}/{VALIDATION.reportImprovements.max}
            </p>
          </div>

          <Button type="submit" size="md" loading={submitting} className="w-full">
            {existingReport ? "Update Report" : "Submit Report"}
          </Button>

          {existingReport?.submitted_at && (
            <p className="text-xs text-ima-text-muted text-center">
              Last submitted at{" "}
              {new Date(existingReport.submitted_at).toLocaleTimeString()}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
