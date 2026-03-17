"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  UserX,
  UserMinus,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface AlertItem {
  key: string;
  type: "student_inactive" | "student_dropoff" | "unreviewed_reports" | "coach_underperforming";
  severity: "warning" | "critical";
  title: string;
  message: string;
  subjectId: string | null;
  subjectName: string;
  triggeredAt: string;
  dismissed: boolean;
}

type FilterTab = "all" | "active" | "dismissed";

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "dismissed", label: "Dismissed" },
];

const EMPTY_MESSAGES: Record<FilterTab, string> = {
  all: "No alerts. Your platform is healthy!",
  active: "No active alerts. Everything looks good!",
  dismissed: "No dismissed alerts yet.",
};

const TYPE_CONFIG: Record<string, { bg: string; text: string; Icon: LucideIcon; label: string }> = {
  student_inactive: { bg: "bg-ima-warning/10", text: "text-ima-warning", Icon: UserX, label: "Inactive" },
  student_dropoff: { bg: "bg-ima-error/10", text: "text-ima-error", Icon: UserMinus, label: "Drop-off" },
  unreviewed_reports: { bg: "bg-ima-info/10", text: "text-ima-info", Icon: FileText, label: "Reports" },
  coach_underperforming: { bg: "bg-ima-warning/10", text: "text-ima-warning", Icon: AlertTriangle, label: "Coach Alert" },
};

interface OwnerAlertsClientProps {
  initialAlerts: AlertItem[];
}

export function OwnerAlertsClient({ initialAlerts }: OwnerAlertsClientProps) {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [dismissingKey, setDismissingKey] = useState<string | null>(null);

  const activeCount = alerts.filter((a) => !a.dismissed).length;
  const dismissedCount = alerts.filter((a) => a.dismissed).length;

  const filteredAlerts = filter === "all"
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
        toastRef.current({ type: "error", title: (json as { error?: string }).error ?? "Failed to dismiss alert" });
        return;
      }
      toastRef.current({ type: "success", title: "Alert dismissed" });
      routerRef.current.refresh();
    } catch (err) {
      console.error("[OwnerAlertsClient] dismiss error:", err);
      // Revert optimistic update
      setAlerts((prev) =>
        prev.map((a) => (a.key === alertKey ? { ...a, dismissed: false } : a))
      );
      toastRef.current({ type: "error", title: "Something went wrong" });
    } finally {
      setDismissingKey(null);
    }
  }, []);

  function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function getDetailHref(alert: AlertItem): string | null {
    if (alert.type === "coach_underperforming" && alert.subjectId) {
      return `/owner/coaches/${alert.subjectId}`;
    }
    if ((alert.type === "student_inactive" || alert.type === "student_dropoff") && alert.subjectId) {
      return `/owner/students/${alert.subjectId}`;
    }
    // unreviewed_reports is a summary — no single detail page
    return null;
  }

  return (
    <>
      {/* Summary stats */}
      <div className="flex items-center gap-4 text-sm text-ima-text-secondary">
        <span>{activeCount} active</span>
        <span aria-hidden="true" className="text-ima-border">|</span>
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
          icon={<Bell className="h-6 w-6" />}
          title={EMPTY_MESSAGES[filter]}
          description={filter === "all" ? "No alerts have been triggered. Keep up the great work!" : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const config = TYPE_CONFIG[alert.type] ?? TYPE_CONFIG.student_inactive;
            const { Icon } = config;
            const detailHref = getDetailHref(alert);

            return (
              <Card
                key={alert.key}
                variant={!alert.dismissed ? "bordered-left" : "default"}
                className={cn(
                  !alert.dismissed && "border-l-ima-error"
                )}
              >
                <CardContent className="p-5">
                  <div
                    role="alert"
                    aria-label={`${alert.severity} alert: ${alert.title}`}
                    className="flex gap-4"
                  >
                    {/* Severity icon */}
                    <div
                      className={cn(
                        "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                        config.bg, config.text
                      )}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-semibold text-ima-text truncate">{alert.title}</h3>
                          <Badge
                            variant={alert.severity === "critical" ? "error" : "warning"}
                            size="sm"
                          >
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-ima-text-secondary whitespace-nowrap">
                            {getTimeAgo(alert.triggeredAt)}
                          </span>
                          {!alert.dismissed && (
                            <div className="w-2 h-2 rounded-full bg-ima-error shrink-0" aria-hidden="true" />
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-ima-text-secondary mb-3">{alert.message}</p>

                      <div className="flex gap-3">
                        {detailHref && (
                          <Link
                            href={detailHref}
                            className="text-xs text-ima-primary font-medium hover:underline min-h-[44px] inline-flex items-center"
                          >
                            View Details
                          </Link>
                        )}
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
            );
          })}
        </div>
      )}
    </>
  );
}
