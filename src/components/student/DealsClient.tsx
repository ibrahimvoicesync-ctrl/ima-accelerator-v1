"use client";

import {
  useOptimistic,
  startTransition,
  useState,
  useRef,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { DealFormModal } from "./DealFormModal";
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

export function DealsClient({ initialDeals }: { initialDeals: Deal[] }) {
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

  const handleAdd = useCallback(
    async (payload: { revenue: number; profit: number }) => {
      setSubmitting(true);

      const tempDeal: Deal = {
        id: String(-Date.now()),
        student_id: "",
        deal_number: optimisticDeals.length + 1,
        revenue: payload.revenue,
        profit: payload.profit,
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
    [optimisticDeals.length, dispatchOptimistic]
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ima-text">My Deals</h2>
        <Button variant="primary" onClick={openAddModal}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Deal
        </Button>
      </div>

      {/* Empty state */}
      {optimisticDeals.length === 0 && (
        <EmptyState
          icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
          title="No deals yet"
          description="Add your first deal to start tracking revenue and profit"
          action={
            <Button onClick={openAddModal}>Add your first deal</Button>
          }
        />
      )}

      {/* Deal list */}
      {optimisticDeals.length > 0 && (
        <div className="bg-ima-surface border border-ima-border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-ima-surface-light border-b border-ima-border text-xs font-medium text-ima-text-secondary uppercase tracking-wider">
            <span className="w-24">Deal</span>
            <span className="flex-1">Revenue</span>
            <span className="flex-1">Profit</span>
            <span className="w-28 text-right">Date</span>
            <span className="w-32 text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-ima-border">
            {optimisticDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-4 min-h-[44px]"
              >
                {/* Deal number */}
                <span className="text-sm font-medium text-ima-text w-24 shrink-0">
                  Deal #{deal.deal_number}
                </span>

                {/* Revenue */}
                <span className="text-sm text-ima-text flex-1">
                  {formatCurrency(deal.revenue)}
                </span>

                {/* Profit */}
                <span className="text-sm text-ima-text-secondary flex-1">
                  {formatCurrency(deal.profit)}
                </span>

                {/* Date */}
                <span className="text-xs text-ima-text-muted w-28 sm:text-right shrink-0">
                  {new Date(deal.created_at).toLocaleDateString()}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 w-32 justify-end shrink-0">
                  {confirmDeleteId === deal.id ? (
                    <>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(deal.id)}
                        loading={deletingId === deal.id}
                        aria-label="Confirm delete deal"
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
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingDeal(deal);
                          setModalOpen(true);
                        }}
                        aria-label={`Edit deal #${deal.deal_number}`}
                        disabled={submitting || deletingId === deal.id}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDeleteId(deal.id)}
                        aria-label={`Delete deal #${deal.deal_number}`}
                        disabled={submitting || deletingId === deal.id}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
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
          editingDeal
            ? (data) => handleEdit(editingDeal, data)
            : handleAdd
        }
        loading={submitting}
      />
    </div>
  );
}
