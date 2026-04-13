"use client";

/**
 * Phase 49: Coach + Owner student-detail Deals tab.
 *
 * Accepts `viewerRole` so a single component powers both the coach student
 * detail page and the owner student detail page. Reuses the shared
 * DealFormModal (src/components/student/DealFormModal.tsx) verbatim — zero
 * UI duplication. Add Deal POSTs to /api/deals with explicit student_id; the
 * Phase 45 route handler enforces dual-layer authorization (assignment check
 * + RLS WITH CHECK) so a coach cannot log for an unassigned student.
 */

import {
  useCallback,
  useOptimistic,
  useRef,
  useState,
  startTransition,
} from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { DealFormModal } from "@/components/student/DealFormModal";
import { DealAttributionChip } from "@/components/shared/DealAttributionChip";
import type { LoggedByUser } from "@/lib/deals-attribution";
import type { Database } from "@/lib/types";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

type OptimisticAction = { type: "add"; deal: Deal };

function dealsReducer(state: Deal[], action: OptimisticAction): Deal[] {
  switch (action.type) {
    case "add":
      return [action.deal, ...state];
  }
}

interface DealsTabProps {
  deals: Deal[];
  studentId: string;
  studentName: string;
  viewerRole: "coach" | "owner";
  viewerId: string;
  userMap: Record<string, LoggedByUser>;
}

function formatCurrency(value: string | number): string {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMargin(revenue: string | number, profit: string | number): string {
  const rev = Number(revenue);
  const prof = Number(profit);
  if (rev === 0) return "\u2014";
  return `${((prof / rev) * 100).toFixed(1)}%`;
}

export function DealsTab({
  deals,
  studentId,
  studentName,
  viewerRole,
  viewerId,
  userMap,
}: DealsTabProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [optimisticDeals, dispatchOptimistic] = useOptimistic(deals, dealsReducer);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalRevenue = optimisticDeals.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalProfit = optimisticDeals.reduce((sum, d) => sum + Number(d.profit), 0);

  const openAddModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleAdd = useCallback(
    async (payload: { revenue: number; profit: number }) => {
      setSubmitting(true);

      const tempDeal: Deal = {
        id: String(-Date.now()),
        student_id: studentId,
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

      try {
        const res = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, student_id: studentId }),
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
    [optimisticDeals.length, dispatchOptimistic, studentId, viewerId],
  );

  return (
    <div
      role="tabpanel"
      id="tabpanel-deals"
      aria-labelledby="tab-deals"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ima-text">Deals</h2>
        <Button
          variant="primary"
          onClick={openAddModal}
          disabled={submitting}
          className="min-h-[44px]"
          aria-label={`Add deal for ${studentName}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Deal
        </Button>
      </div>

      {optimisticDeals.length === 0 ? (
        <EmptyState
          variant="compact"
          icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
          title="No deals yet"
          description="This student hasn't recorded any deals yet. Use Add Deal to log one on their behalf."
        />
      ) : (
        <div className="bg-ima-surface border border-ima-border rounded-xl overflow-hidden">
          {/* Column headers — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-ima-surface-light border-b border-ima-border text-xs font-medium text-ima-text-secondary uppercase tracking-wider">
            <span className="w-24">Deal</span>
            <span className="flex-1">Revenue</span>
            <span className="flex-1">Profit</span>
            <span className="w-20">Margin</span>
            <span className="w-28">Logged By</span>
            <span className="w-28 text-right">Date</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-ima-border">
            {optimisticDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 px-4 min-h-[44px]"
              >
                <span className="text-sm font-medium text-ima-text w-24 shrink-0">
                  Deal #{deal.deal_number}
                </span>
                <span className="text-sm text-ima-text flex-1">
                  {formatCurrency(deal.revenue)}
                </span>
                <span className="text-sm text-ima-text-secondary flex-1">
                  {formatCurrency(deal.profit)}
                </span>
                <span className="text-sm text-ima-text-secondary w-20 shrink-0">
                  {formatMargin(deal.revenue, deal.profit)}
                </span>
                <span className="w-28 shrink-0">
                  <DealAttributionChip
                    deal={deal}
                    viewerRole={viewerRole}
                    viewerId={viewerId}
                    userMap={userMap}
                  />
                </span>
                <span className="text-xs text-ima-text-muted w-28 sm:text-right shrink-0">
                  {new Date(deal.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>

          {/* Summary row */}
          <div className="flex items-center gap-4 px-4 py-3 bg-ima-surface-light border-t border-ima-border text-sm font-medium">
            <span className="w-24 text-ima-text">Total</span>
            <span className="flex-1 text-ima-text">{formatCurrency(totalRevenue)}</span>
            <span className="flex-1 text-ima-text-secondary">{formatCurrency(totalProfit)}</span>
            <span className="w-20 text-ima-text-secondary">
              {formatMargin(totalRevenue, totalProfit)}
            </span>
            <span className="w-28"></span>
            <span className="w-28"></span>
          </div>
        </div>
      )}

      <DealFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        deal={null}
        onSubmit={handleAdd}
        loading={submitting}
      />
    </div>
  );
}
