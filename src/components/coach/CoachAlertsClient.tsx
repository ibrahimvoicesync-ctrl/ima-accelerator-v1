"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  MILESTONE_META,
  type CoachAlertFeedItem,
} from "@/components/coach/alerts-types";

type FilterTab = "all" | "active" | "dismissed";

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "dismissed", label: "Dismissed" },
];

const EMPTY_COPY: Record<FilterTab, { title: string; description: string }> = {
  all: {
    title: "No alerts yet",
    description: "When your students hit milestones, they'll appear here.",
  },
  active: {
    title: "All caught up!",
    description: "No active milestone alerts. Keep coaching!",
  },
  dismissed: {
    title: "No dismissed alerts",
    description: "Alerts you dismiss will be archived here for reference.",
  },
};

interface CoachAlertsClientProps {
  initialFeed: CoachAlertFeedItem[];
}

interface StudentGroup {
  student_id: string;
  student_name: string;
  rows: CoachAlertFeedItem[];
  maxOccurredAt: number;
}

export function CoachAlertsClient({ initialFeed }: CoachAlertsClientProps) {
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

  // Session-scoped dismissed keys (optimistic). After a successful dismiss +
  // router.refresh(), the server fetches fresh data that already excludes
  // these keys — this set is harmless stale state on remount.
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterTab>("active");
  const [inflightKeys, setInflightKeys] = useState<Set<string>>(new Set());

  const addInflight = useCallback((keys: string[]) => {
    setInflightKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  }, []);

  const removeInflight = useCallback((keys: string[]) => {
    setInflightKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
  }, []);

  const activeCount = useMemo(
    () => initialFeed.filter((r) => !dismissedKeys.has(r.alert_key)).length,
    [initialFeed, dismissedKeys],
  );
  const dismissedCount = useMemo(
    () => initialFeed.filter((r) => dismissedKeys.has(r.alert_key)).length,
    [initialFeed, dismissedKeys],
  );

  // Filter then group. Groups sorted by most-recent occurred_at descending.
  // Rows within a group sorted by occurred_at descending.
  const visibleGroups: StudentGroup[] = useMemo(() => {
    const filtered = initialFeed.filter((r) => {
      if (filter === "all") return true;
      if (filter === "active") return !dismissedKeys.has(r.alert_key);
      return dismissedKeys.has(r.alert_key);
    });

    const byStudent = new Map<string, StudentGroup>();
    for (const row of filtered) {
      const existing = byStudent.get(row.student_id);
      const ts = new Date(row.occurred_at).getTime();
      if (!existing) {
        byStudent.set(row.student_id, {
          student_id: row.student_id,
          student_name: row.student_name,
          rows: [row],
          maxOccurredAt: ts,
        });
      } else {
        existing.rows.push(row);
        if (ts > existing.maxOccurredAt) existing.maxOccurredAt = ts;
      }
    }

    const groups = Array.from(byStudent.values());
    groups.sort((a, b) => b.maxOccurredAt - a.maxOccurredAt);
    for (const g of groups) {
      g.rows.sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() -
          new Date(a.occurred_at).getTime(),
      );
    }
    return groups;
  }, [initialFeed, dismissedKeys, filter]);

  async function postDismiss(alertKey: string): Promise<boolean> {
    try {
      const res = await fetch("/api/alerts/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_key: alertKey }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        console.error(
          "[CoachAlertsClient] dismiss failed:",
          (json as { error?: string }).error ?? res.statusText,
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error("[CoachAlertsClient] dismiss error:", err);
      return false;
    }
  }

  const handleDismiss = useCallback(
    async (alertKey: string) => {
      if (inflightKeys.has(alertKey)) return;
      addInflight([alertKey]);
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        next.add(alertKey);
        return next;
      });
      const ok = await postDismiss(alertKey);
      if (!ok) {
        setDismissedKeys((prev) => {
          const next = new Set(prev);
          next.delete(alertKey);
          return next;
        });
        toastRef.current({
          type: "error",
          title: "Failed to dismiss alert — please try again",
        });
      } else {
        toastRef.current({ type: "success", title: "Alert dismissed" });
        routerRef.current.refresh();
      }
      removeInflight([alertKey]);
    },
    [inflightKeys, addInflight, removeInflight],
  );

  const handleBulkDismiss = useCallback(
    async (group: StudentGroup) => {
      const keys = group.rows
        .filter((r) => !dismissedKeys.has(r.alert_key))
        .map((r) => r.alert_key);
      if (keys.length === 0) return;
      addInflight(keys);
      setDismissedKeys((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.add(k));
        return next;
      });
      const results = await Promise.allSettled(keys.map((k) => postDismiss(k)));
      const failedKeys: string[] = [];
      results.forEach((r, idx) => {
        if (r.status !== "fulfilled" || r.value !== true) {
          failedKeys.push(keys[idx]);
        }
      });
      if (failedKeys.length > 0) {
        setDismissedKeys((prev) => {
          const next = new Set(prev);
          failedKeys.forEach((k) => next.delete(k));
          return next;
        });
        toastRef.current({
          type: "error",
          title: "Some alerts could not be dismissed — please try again",
        });
      } else {
        toastRef.current({ type: "success", title: "Alerts dismissed" });
      }
      removeInflight(keys);
      if (failedKeys.length < keys.length) {
        routerRef.current.refresh();
      }
    },
    [dismissedKeys, addInflight, removeInflight],
  );

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
      <div className="flex gap-2 flex-wrap" role="tablist">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-1",
              filter === key
                ? "bg-ima-primary text-white"
                : "bg-ima-surface border border-ima-border text-ima-text hover:bg-ima-surface-light",
            )}
          >
            {key === "active" && activeCount > 0
              ? `Active (${activeCount})`
              : label}
          </button>
        ))}
      </div>

      {/* Grouped feed */}
      {visibleGroups.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" aria-hidden="true" />}
          title={EMPTY_COPY[filter].title}
          description={EMPTY_COPY[filter].description}
        />
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => {
            const undismissedInGroup = group.rows.filter(
              (r) => !dismissedKeys.has(r.alert_key),
            );
            const showBulk =
              (filter === "all" || filter === "active") &&
              undismissedInGroup.length > 0;
            const anyInflight = group.rows.some((r) =>
              inflightKeys.has(r.alert_key),
            );
            return (
              <section
                key={group.student_id}
                aria-labelledby={`group-${group.student_id}`}
                className="space-y-3"
              >
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <h2
                    id={`group-${group.student_id}`}
                    className="text-sm font-semibold text-ima-text"
                  >
                    {group.student_name}
                  </h2>
                  {showBulk && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={anyInflight}
                      onClick={() => handleBulkDismiss(group)}
                      className="text-xs"
                    >
                      Dismiss All
                    </Button>
                  )}
                </div>

                {/* Alert rows */}
                {group.rows.map((row) => {
                  const meta = MILESTONE_META[row.milestone_type];
                  const isDismissed = dismissedKeys.has(row.alert_key);
                  const isInflight = inflightKeys.has(row.alert_key);
                  return (
                    <Card
                      key={row.alert_key}
                      variant={isDismissed ? "default" : "bordered-left"}
                      className={cn(!isDismissed && "border-l-ima-success")}
                    >
                      <CardContent className="p-4">
                        <div
                          role="alert"
                          aria-label={`milestone alert: ${row.student_name} — ${meta.label}`}
                          className="flex gap-4"
                        >
                          {/* Icon */}
                          <div
                            className={cn(
                              "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                              meta.iconBg,
                              meta.iconTint,
                            )}
                          >
                            <meta.Icon className="w-5 h-5" aria-hidden="true" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <h3 className="text-sm font-semibold text-ima-text truncate">
                                  {row.student_name}
                                </h3>
                                <Badge variant={meta.badgeVariant} size="sm">
                                  {meta.label}
                                </Badge>
                              </div>
                              {!isDismissed && (
                                <div
                                  className="w-2 h-2 rounded-full bg-ima-success shrink-0 mt-1"
                                  aria-hidden="true"
                                />
                              )}
                            </div>

                            {row.message && (
                              <p className="text-sm text-ima-text-secondary mb-3">
                                {row.message}
                              </p>
                            )}
                            {!row.message && (
                              <p className="text-sm text-ima-text-secondary mb-3">
                                <time dateTime={row.occurred_at}>
                                  {new Date(row.occurred_at).toLocaleString()}
                                </time>
                              </p>
                            )}

                            <div className="flex gap-3 flex-wrap">
                              <Link
                                href={`/coach/students/${row.student_id}`}
                                aria-label={`View ${row.student_name}`}
                                className="text-xs text-ima-primary font-semibold hover:underline min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-1 rounded px-1"
                              >
                                View Student
                              </Link>
                              {!isDismissed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  loading={isInflight}
                                  onClick={() => handleDismiss(row.alert_key)}
                                  className="text-xs"
                                >
                                  Dismiss Alert
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
