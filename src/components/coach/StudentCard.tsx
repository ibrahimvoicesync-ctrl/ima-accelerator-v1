import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ROADMAP_STEPS } from "@/lib/config";

interface StudentCardProps {
  student: {
    id: string;
    name: string;
    isNew: boolean;
    isAtRisk: boolean;
    atRiskReasons: string[];
    lastActiveLabel: string;      // "Mar 14", "Never", or "New"
    todayReportSubmitted: boolean;
    currentRoadmapStep: number;   // highest completed or active step number (1-10)
  };
  basePath?: string;
}

export function StudentCard({ student, basePath = "/coach/students" }: StudentCardProps) {
  const initials = student.name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link href={`${basePath}/${student.id}`} aria-label={student.name} className="block min-h-[44px]">
      <Card
        interactive
        className={cn(student.isAtRisk && "ring-2 ring-ima-error/30")}
      >
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ima-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                {initials}
              </div>
              <p className="text-sm font-semibold text-ima-text">{student.name}</p>
            </div>
            {student.isNew ? (
              <Badge variant="info" size="sm">New</Badge>
            ) : student.isAtRisk ? (
              <Badge variant="error" size="sm">At Risk</Badge>
            ) : null}
          </div>

          {/* Info rows */}
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center justify-between text-xs text-ima-text-secondary">
              <span>Last active</span>
              <span className="font-medium text-ima-text">{student.lastActiveLabel}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-ima-text-secondary">
              <span>Today&apos;s report</span>
              {student.todayReportSubmitted ? (
                <span className="flex items-center gap-1 font-medium text-ima-success">
                  <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Submitted
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-ima-warning">
                  <span className="h-2 w-2 rounded-full bg-ima-warning" aria-hidden="true" />
                  Pending
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-ima-text-secondary">
              <span>Roadmap</span>
              <span className="font-medium text-ima-text">Step {student.currentRoadmapStep}/{ROADMAP_STEPS.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
