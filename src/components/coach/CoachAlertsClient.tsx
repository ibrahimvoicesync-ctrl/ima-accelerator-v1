"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

export interface CoachAlertItem {
  key: string;
  type: "100h_milestone";
  severity: "success";
  title: string;
  message: string;
  link: string;
  dismissed: boolean;
}

type FilterTab = "all" | "active" | "dismissed";

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "dismissed", label: "Dismissed" },
];

const EMPTY_MESSAGES: Record<FilterTab, string> = {
  all: "No milestone alerts yet. When students hit 100+ hours within 45 days, they'll appear here!",
  active: "No active milestone alerts. Keep coaching!",
  dismissed: "No dismissed alerts.",
};

interface CoachAlertsClientProps {
  initialAlerts: CoachAlertItem[];
}

export function CoachAlertsClient({ initialAlerts }: CoachAlertsClientProps) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [alerts, setAlerts] = useState<CoachAlertItem[]>(initialAlerts);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  const activeCount = alerts.filter((a) => !a.dismissed).length;
  const dismissedCount = alerts.filter((a) => a.dismissed).length;

  const filteredAlerts =
    filter === "all"
      ? alerts
      : filter === "active"
        ? alerts.filter((a) => !a.dismissed)
        : alerts.filter((a) => a.dismissed);

  function handleFilterChange(newFilter: FilterTab) {
    setFilter(newFilter);
  }

  const handleDismiss = useCallback(async (alertKey: string) => {
    setDismissingKey(alertKey);
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.key === alertKey ? { ...a, dismissed: true } : a))
    );
    try {
      const res = await fetch("/api/alerts/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_key: alertKey }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        // Revert optimistic update
        setAlerts((prev) =>
          prev.map((a) => (a.key === alertKey ? { ...a, dismissed: false } : a))
        );
        toastRef.current({
          type: "error",
          title:
            (json as { error?: string }).error ?? "Failed to dismiss alert",
        });
        return;
      }
      toastRef.current({ type: "success", title: "Alert dismissed" });
      routerRef.current.refresh();
    } catch (err) {
      console.error("[CoachAlertsClient] dismiss error:", err);
      // Revert optimistic update
      setAlerts((prev) =>
        prev.map((a) => (a.key === alertKey ? { ...a, dismissed: false } : a))
      );
      toastRef.current({ type: "error", title: "Something went wrong" });
    } finally {
      setDismissingKey(null);
    }
  }, []);

  return (
    <>
      {/* Summary stats */}
      <div className="flex items-center gap-4 text-sm text-ima-text-secondary">
        <span>{activeCount} active</span>
        <span aria-hidden="true" className="text-ima-border">
          |
        </span>
        <span>{dismissedCount} dismissed</span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] motion-safe:transition-colors",
              filter === key
                ? "bg-ima-primary text-white"
                : "bg-ima-surface border border-ima-border text-ima-text hover:bg-ima-surface-light"
            )}
          >
            {label}
            {key === "active" && activeCount > 0 && (
              <span className="ml-1.5 text-xs opacity-80">({activeCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Alert Cards */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" aria-hidden="true" />}
          title={EMPTY_MESSAGES[filter]}
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.key}
              variant={!alert.dismissed ? "bordered-left" : "default"}
              className={cn(!alert.dismissed && "border-l-ima-success")}
            >
              <CardContent className="p-5">
                <div
                  role="alert"
                  aria-label={`milestone alert: ${alert.title}`}
                  className="flex gap-4"
                >
                  {/* Icon */}
                  <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-ima-success/10 text-ima-success">
                    <Trophy className="w-5 h-5" aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-ima-text truncate">
                          {alert.title}
                        </h3>
                        <Badge variant="success" size="sm">
                          100h Milestone
                        </Badge>
                      </div>
                      {!alert.dismissed && (
                        <div
                          className="w-2 h-2 rounded-full bg-ima-success shrink-0 mt-1"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <p className="text-sm text-ima-text-secondary mb-3">
                      {alert.message}
                    </p>

                    <div className="flex gap-3">
                      <Link
                        href={alert.link}
                        className="text-xs text-ima-primary font-medium hover:underline min-h-[44px] inline-flex items-center"
                      >
                        View Student
                      </Link>
                      {!alert.dismissed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={dismissingKey === alert.key}
                          onClick={() => handleDismiss(alert.key)}
                          className="text-xs"
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
