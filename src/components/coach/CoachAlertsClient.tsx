"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  MILESTONE_META,
  type CoachAlertFeedItem,
  type CoachAlertFeedType,
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

// Warm-palette mapping per milestone type. Icon tint + background replace the
// ima-* defaults in MILESTONE_META so alerts sit coherently on #FAFAF7.
const TYPE_TINT: Record<
  CoachAlertFeedType,
  { iconBg: string; iconColor: string; rail: string; badgeBg: string; badgeBorder: string; badgeText: string }
> = {
  "100h_milestone": {
    iconBg: "bg-[#E2F5E9]",
    iconColor: "text-[#16A34A]",
    rail: "border-l-[#16A34A]",
    badgeBg: "bg-[#E2F5E9]",
    badgeBorder: "border-[#BFE4CD]",
    badgeText: "text-[#16A34A]",
  },
  "closed_deal": {
    iconBg: "bg-[#E2F5E9]",
    iconColor: "text-[#16A34A]",
    rail: "border-l-[#16A34A]",
    badgeBg: "bg-[#E2F5E9]",
    badgeBorder: "border-[#BFE4CD]",
    badgeText: "text-[#16A34A]",
  },
  "5_influencers": {
    iconBg: "bg-[#E8EEFF]",
    iconColor: "text-[#4A6CF7]",
    rail: "border-l-[#4A6CF7]",
    badgeBg: "bg-[#E8EEFF]",
    badgeBorder: "border-[#C9D5FF]",
    badgeText: "text-[#4A6CF7]",
  },
  "brand_response": {
    iconBg: "bg-[#E8EEFF]",
    iconColor: "text-[#4A6CF7]",
    rail: "border-l-[#4A6CF7]",
    badgeBg: "bg-[#E8EEFF]",
    badgeBorder: "border-[#C9D5FF]",
    badgeText: "text-[#4A6CF7]",
  },
  "tech_setup": {
    iconBg: "bg-[#E8EEFF]",
    iconColor: "text-[#4A6CF7]",
    rail: "border-l-[#4A6CF7]",
    badgeBg: "bg-[#E8EEFF]",
    badgeBorder: "border-[#C9D5FF]",
    badgeText: "text-[#4A6CF7]",
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
      if (group.rows.some((r) => inflightKeys.has(r.alert_key))) return;
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
    [dismissedKeys, inflightKeys, addInflight, removeInflight],
  );

  return (
    <div
      className="space-y-6 motion-safe:animate-fadeIn"
      style={{ animationDelay: "50ms" }}
    >
      {/* Summary + filter bar */}
      <div className="bg-white border border-[#EDE9E0] rounded-[14px] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className="flex items-center gap-4 text-[11px] font-semibold tracking-[0.14em] text-[#8A8474] uppercase"
          style={{ fontFamily: "var(--font-mono-bold)" }}
        >
          <span>
            <span className="text-[14px] font-bold text-[#1A1A17] tabular-nums mr-[6px]">
              {activeCount}
            </span>
            Active
          </span>
          <span aria-hidden="true" className="text-[#EDE9E0]">
            |
          </span>
          <span>
            <span className="text-[14px] font-bold text-[#1A1A17] tabular-nums mr-[6px]">
              {dismissedCount}
            </span>
            Dismissed
          </span>
        </div>

        <div className="flex gap-[6px] flex-wrap sm:ml-auto" role="tablist">
          {FILTER_TABS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={[
                  "min-h-[44px] px-4 text-[13px] font-semibold rounded-[10px] motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2",
                  active
                    ? "bg-[#4A6CF7] text-white"
                    : "bg-white border border-[#EDE9E0] text-[#1A1A17] hover:border-[#D8D2C4]",
                ].join(" ")}
              >
                {key === "active" && activeCount > 0
                  ? `Active (${activeCount})`
                  : label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grouped feed */}
      {visibleGroups.length === 0 ? (
        <div className="bg-white border border-[#EDE9E0] rounded-[14px] p-6">
          <EmptyState
            variant="compact"
            icon={<Bell className="h-5 w-5" aria-hidden="true" />}
            title={EMPTY_COPY[filter].title}
            description={EMPTY_COPY[filter].description}
          />
        </div>
      ) : (
        <div className="space-y-7">
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
                className="space-y-[10px]"
              >
                {/* Group header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <h2
                    id={`group-${group.student_id}`}
                    className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
                    style={{ fontFamily: "var(--font-mono-bold)" }}
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
                  const tint = TYPE_TINT[row.milestone_type];
                  const isDismissed = dismissedKeys.has(row.alert_key);
                  const isInflight = inflightKeys.has(row.alert_key);
                  return (
                    <article
                      key={row.alert_key}
                      aria-label={`milestone alert: ${row.student_name} — ${meta.label}`}
                      className={[
                        "bg-white border rounded-[14px] p-5 motion-safe:transition-colors",
                        isDismissed
                          ? "border-[#EDE9E0] opacity-70"
                          : `border-[#EDE9E0] border-l-[3px] ${tint.rail}`,
                      ].join(" ")}
                    >
                      <div className="flex gap-4">
                        <div
                          className={`shrink-0 w-10 h-10 rounded-[8px] flex items-center justify-center ${tint.iconBg} ${tint.iconColor}`}
                        >
                          <meta.Icon className="w-5 h-5" aria-hidden="true" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <h3 className="text-[14px] font-semibold text-[#1A1A17] truncate leading-tight">
                                {row.student_name}
                              </h3>
                              <span
                                className={`inline-flex items-center px-2 py-[2px] rounded-full border text-[10px] font-semibold uppercase tracking-[0.08em] ${tint.badgeBg} ${tint.badgeBorder} ${tint.badgeText}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            {!isDismissed && (
                              <div
                                className={`w-2 h-2 rounded-full ${tint.iconColor.replace("text-", "bg-")} shrink-0 mt-1`}
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          <p className="text-[13px] text-[#7A7466] mb-4 leading-[1.5]">
                            {row.message ?? (
                              <time dateTime={row.occurred_at}>
                                {new Date(row.occurred_at).toLocaleString()}
                              </time>
                            )}
                          </p>

                          <div className="flex gap-3 flex-wrap items-center">
                            <Link
                              href={`/coach/students/${row.student_id}`}
                              aria-label={`View ${row.student_name}`}
                              className="text-[12px] font-semibold text-[#4A6CF7] hover:text-[#3852D8] min-h-[44px] inline-flex items-center focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2 rounded px-1"
                            >
                              View Student →
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
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
