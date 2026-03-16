"use client";

import { Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type WorkSessionRow = {
  id: string;
  date: string;
  cycle_number: number;
  status: string;
  duration_minutes: number;
};

interface WorkSessionsTabProps {
  sessions: WorkSessionRow[];
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const statusVariant: Record<string, "info" | "success" | "warning" | "error"> = {
  in_progress: "info",
  completed: "success",
  paused: "warning",
  abandoned: "error",
};

export function WorkSessionsTab({ sessions }: WorkSessionsTabProps) {
  if (sessions.length === 0) {
    return (
      <div role="tabpanel" id="tabpanel-work" aria-labelledby="tab-work" className="py-8 text-center">
        <Timer className="h-8 w-8 text-ima-text-muted mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-ima-text">No work sessions</p>
        <p className="text-xs text-ima-text-secondary mt-1">No work sessions recorded in the last 30 days.</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, WorkSessionRow[]>();
  for (const session of sessions) {
    const existing = grouped.get(session.date) ?? [];
    existing.push(session);
    grouped.set(session.date, existing);
  }

  return (
    <div role="tabpanel" id="tabpanel-work" aria-labelledby="tab-work" className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dateSessions]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-ima-text-secondary mb-2">
            {formatDateHeader(date)}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {dateSessions
              .sort((a, b) => a.cycle_number - b.cycle_number)
              .map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium text-ima-text">
                      Cycle {session.cycle_number}
                    </p>
                    <Badge
                      variant={statusVariant[session.status] ?? "default"}
                      size="sm"
                      className="mt-1"
                    >
                      {session.status.replace("_", " ")}
                    </Badge>
                    {session.status === "completed" && (
                      <p className="text-xs text-ima-text-secondary mt-1">
                        {session.duration_minutes}m
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
