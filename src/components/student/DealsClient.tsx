"use client";

import {
  useOptimistic,
  startTransition,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ComponentType,
  type SVGProps,
} from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CircleDollarSign,
  DollarSign,
  Pencil,
  Plus,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { DealFormModal } from "./DealFormModal";
import { DealAttributionChip } from "@/components/shared/DealAttributionChip";
import type { LoggedByUser, ViewerRole } from "@/lib/deals-attribution";
import type { Database } from "@/lib/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

type OptimisticAction =
  | { type: "add"; deal: Deal }
  | { type: "edit"; deal: Deal }
  | { type: "delete"; id: string };

function dealsReducer(state: Deal[], action: OptimisticAction): Deal[] {
  switch (action.type) {
    case "add":
      return [action.deal, ...state];
    case "edit":
      return state.map((d) => (d.id === action.deal.id ? action.deal : d));
    case "delete":
      return state.filter((d) => d.id !== action.id);
  }
}

function formatCurrency(value: string | number): string {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompact(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DealsClientProps {
  initialDeals: Deal[];
  viewerId: string;
  viewerRole: ViewerRole;
  userMap: Record<string, LoggedByUser>;
}

export function DealsClient({
  initialDeals,
  viewerId,
  viewerRole,
  userMap,
}: DealsClientProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [optimisticDeals, dispatchOptimistic] = useOptimistic(
    initialDeals,
    dealsReducer
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totals = useMemo(() => {
    let revenue = 0;
    let profit = 0;
    for (const d of optimisticDeals) {
      revenue += Number(d.revenue);
      profit += Number(d.profit);
    }
    return { count: optimisticDeals.length, revenue, profit };
  }, [optimisticDeals]);

  const handleAdd = useCallback(
    async (payload: { revenue: number; profit: number }) => {
      setSubmitting(true);

      const tempDeal: Deal = {
        id: String(-Date.now()),
        student_id: "",
        deal_number: optimisticDeals.length + 1,
        revenue: payload.revenue,
        profit: payload.profit,
        logged_by: viewerId,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      startTransition(() => {
        dispatchOptimistic({ type: "add", deal: tempDeal });
      });

      setModalOpen(false);
      setEditingDeal(null);

      try {
        const res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: null }));
          toastRef.current({
            type: "error",
            title: (err as { error?: string }).error || "Failed to add deal",
          });
          routerRef.current.refresh();
        } else {
          toastRef.current({ type: "success", title: "Deal added" });
          routerRef.current.refresh();
        }
      } catch (err) {
        console.error("Failed to add deal:", err);
        toastRef.current({ type: "error", title: "Failed to add deal" });
        routerRef.current.refresh();
      } finally {
        setSubmitting(false);
      }
    },
    [optimisticDeals.length, dispatchOptimistic, viewerId]
  );

  const handleEdit = useCallback(
    async (deal: Deal, payload: { revenue: number; profit: number }) => {
      setSubmitting(true);

      const updatedDeal: Deal = {
        ...deal,
        revenue: payload.revenue,
        profit: payload.profit,
        updated_at: new Date().toISOString(),
      };

      startTransition(() => {
        dispatchOptimistic({ type: "edit", deal: updatedDeal });
      });

      setModalOpen(false);
      setEditingDeal(null);

      try {
        const res = await fetch(`/api/deals/${deal.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: null }));
          toastRef.current({
            type: "error",
            title: (err as { error?: string }).error || "Failed to update deal",
          });
          routerRef.current.refresh();
        } else {
          toastRef.current({ type: "success", title: "Deal updated" });
          routerRef.current.refresh();
        }
      } catch (err) {
        console.error("Failed to update deal:", err);
        toastRef.current({ type: "error", title: "Failed to update deal" });
        routerRef.current.refresh();
      } finally {
        setSubmitting(false);
      }
    },
    [dispatchOptimistic]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setConfirmDeleteId(null);

      startTransition(() => {
        dispatchOptimistic({ type: "delete", id });
      });

      try {
        const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: null }));
          toastRef.current({
            type: "error",
            title: (err as { error?: string }).error || "Failed to delete deal",
          });
          routerRef.current.refresh();
        } else {
          toastRef.current({ type: "success", title: "Deal deleted" });
          routerRef.current.refresh();
        }
      } catch (err) {
        console.error("Failed to delete deal:", err);
        toastRef.current({ type: "error", title: "Failed to delete deal" });
        routerRef.current.refresh();
      } finally {
        setDeletingId(null);
      }
    },
    [dispatchOptimistic]
  );

  const openAddModal = useCallback(() => {
    setEditingDeal(null);
    setModalOpen(true);
  }, []);

  const hasDeals = optimisticDeals.length > 0;

  return (
    <div className="space-y-8">
      {/* Header: title + inline metrics + add button */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4 min-w-0">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ima-text">
              My Deals
            </h1>
            <p className="text-sm text-ima-text-secondary mt-2">
              Track your brand deal revenue and profit
            </p>
          </div>

          {hasDeals && (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Deals summary"
            >
              <MetricPill
                icon={Briefcase}
                label={totals.count === 1 ? "deal logged" : "deals logged"}
                value={String(totals.count)}
                tone="primary"
              />
              <MetricPill
                icon={TrendingUp}
                label="revenue"
                value={formatCompact(totals.revenue)}
                tone="primary"
              />
              <MetricPill
                icon={CircleDollarSign}
                label="profit"
                value={formatCompact(totals.profit)}
                tone="success"
              />
            </div>
          )}
        </div>

        <Button
          variant="primary"
          onClick={openAddModal}
          className="rounded-lg shadow-sm shadow-ima-primary/20 shrink-0 self-start motion-safe:transition-all hover:shadow-md hover:shadow-ima-primary/30"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Deal
        </Button>
      </div>

      {/* Empty state */}
      {!hasDeals && (
        <EmptyState
          icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
          title="No deals yet"
          description="Log your first closed deal to start tracking revenue and profit."
          action={<Button onClick={openAddModal}>Add your first deal</Button>}
        />
      )}

      {/* Deal list */}
      {hasDeals && (
        <div>
          {/* Desktop table */}
          <div className="hidden md:block">
            <div
              role="table"
              aria-label="Deals"
              className="w-full overflow-hidden rounded-2xl border border-ima-border bg-ima-surface shadow-sm"
            >
              {/* Column headers */}
              <div
                role="row"
                className="grid grid-cols-[140px_1fr_1fr_160px_140px_96px] items-center gap-4 px-6 py-3 bg-ima-surface-light border-b border-ima-border text-[11px] font-semibold uppercase tracking-[0.14em] text-ima-text-muted"
              >
                <span role="columnheader">Deal</span>
                <span role="columnheader">Revenue</span>
                <span role="columnheader">Profit</span>
                <span role="columnheader">Logged By</span>
                <span role="columnheader">Date</span>
                <span role="columnheader" className="text-right">
                  <span className="sr-only">Actions</span>
                </span>
              </div>

              {/* Rows */}
              <div>
                {optimisticDeals.map((deal) => {
                  const isConfirming = confirmDeleteId === deal.id;
                  const isDeleting = deletingId === deal.id;
                  const isBusy = submitting || isDeleting;

                  return (
                    <div
                      key={deal.id}
                      role="row"
                      className="group grid grid-cols-[140px_1fr_1fr_160px_140px_96px] items-center gap-4 px-6 h-16 border-b border-ima-surface-light last:border-b-0 motion-safe:transition-colors hover:bg-ima-surface-accent/60 focus-within:bg-ima-surface-accent/60"
                    >
                      <div
                        role="cell"
                        className="flex items-center gap-2.5 min-w-0"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full bg-ima-success shrink-0 ring-4 ring-ima-success/15"
                        />
                        <span className="text-sm font-semibold text-ima-primary tabular-nums truncate">
                          Deal #{deal.deal_number}
                        </span>
                      </div>

                      <span
                        role="cell"
                        className="text-sm font-medium text-ima-text tabular-nums"
                      >
                        {formatCurrency(deal.revenue)}
                      </span>

                      <span
                        role="cell"
                        className="text-sm font-semibold text-ima-success tabular-nums"
                      >
                        {formatCurrency(deal.profit)}
                      </span>

                      <span role="cell">
                        <DealAttributionChip
                          deal={deal}
                          viewerRole={viewerRole}
                          viewerId={viewerId}
                          userMap={userMap}
                        />
                      </span>

                      <span
                        role="cell"
                        className="flex items-center gap-2 text-xs text-ima-text-muted tabular-nums"
                      >
                        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {formatDate(deal.created_at)}
                      </span>

                      <div
                        role="cell"
                        className="flex items-center justify-end gap-1"
                      >
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(deal.id)}
                              loading={isDeleting}
                              aria-label={`Confirm delete deal #${deal.deal_number}`}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(null)}
                              aria-label="Cancel delete"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 motion-safe:transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDeal(deal);
                                setModalOpen(true);
                              }}
                              aria-label={`Edit deal #${deal.deal_number}`}
                              disabled={isBusy}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ima-text-muted motion-safe:transition-colors hover:text-ima-primary hover:bg-ima-surface-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ima-bg disabled:opacity-50 disabled:pointer-events-none"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(deal.id)}
                              aria-label={`Delete deal #${deal.deal_number}`}
                              disabled={isBusy}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ima-text-muted motion-safe:transition-colors hover:text-ima-error hover:bg-ima-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-error focus-visible:ring-offset-2 focus-visible:ring-offset-ima-bg disabled:opacity-50 disabled:pointer-events-none"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile card list */}
          <ul className="md:hidden space-y-3">
            {optimisticDeals.map((deal) => {
              const isConfirming = confirmDeleteId === deal.id;
              const isDeleting = deletingId === deal.id;
              const isBusy = submitting || isDeleting;

              return (
                <li
                  key={deal.id}
                  className="rounded-2xl border border-ima-border bg-ima-surface shadow-sm overflow-hidden"
                >
                  <div className="px-4 py-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full bg-ima-success shrink-0 ring-4 ring-ima-success/15"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ima-primary tabular-nums truncate">
                            Deal #{deal.deal_number}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-ima-text-muted tabular-nums mt-1">
                            <Calendar
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                            {formatDate(deal.created_at)}
                          </p>
                        </div>
                      </div>
                      <DealAttributionChip
                        deal={deal}
                        viewerRole={viewerRole}
                        viewerId={viewerId}
                        userMap={userMap}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-ima-surface-accent px-3 py-2.5 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ima-primary/70">
                          Revenue
                        </p>
                        <p className="text-sm font-semibold text-ima-primary tabular-nums">
                          {formatCurrency(deal.revenue)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-ima-success/10 px-3 py-2.5 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ima-success/80">
                          Profit
                        </p>
                        <p className="text-sm font-semibold text-ima-success tabular-nums">
                          {formatCurrency(deal.profit)}
                        </p>
                      </div>
                    </div>

                    {isConfirming ? (
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(deal.id)}
                          loading={isDeleting}
                          aria-label={`Confirm delete deal #${deal.deal_number}`}
                          className="flex-1"
                        >
                          Confirm delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancel delete"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingDeal(deal);
                            setModalOpen(true);
                          }}
                          aria-label={`Edit deal #${deal.deal_number}`}
                          disabled={isBusy}
                          className="flex-1"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(deal.id)}
                          aria-label={`Delete deal #${deal.deal_number}`}
                          disabled={isBusy}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Deal form modal */}
      <DealFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDeal(null);
        }}
        deal={editingDeal}
        onSubmit={
          editingDeal ? (data) => handleEdit(editingDeal, data) : handleAdd
        }
        loading={submitting}
      />
    </div>
  );
}

interface MetricPillProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
  tone: "primary" | "success";
}

const TONE_CLASSES: Record<
  MetricPillProps["tone"],
  { wrap: string; icon: string; value: string; label: string }
> = {
  primary: {
    wrap: "bg-ima-surface-accent border-ima-primary/15",
    icon: "text-ima-primary",
    value: "text-ima-primary",
    label: "text-ima-primary/70",
  },
  success: {
    wrap: "bg-ima-success/10 border-ima-success/20",
    icon: "text-ima-success",
    value: "text-ima-success",
    label: "text-ima-success/80",
  },
};

function MetricPill({ icon: Icon, label, value, tone }: MetricPillProps) {
  const t = TONE_CLASSES[tone];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border pl-2.5 pr-3.5 py-1.5 ${t.wrap}`}
      role="group"
      aria-label={`${value} ${label}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-ima-surface ${t.icon}`}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          aria-hidden="true"
          className={`text-sm font-semibold tabular-nums tracking-tight ${t.value}`}
        >
          {value}
        </span>
        <span
          aria-hidden="true"
          className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${t.label}`}
        >
          {label}
        </span>
      </span>
    </div>
  );
}
