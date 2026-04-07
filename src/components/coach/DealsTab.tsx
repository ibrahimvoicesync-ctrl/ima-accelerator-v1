import type { Database } from "@/lib/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { DollarSign } from "lucide-react";

type Deal = Database["public"]["Tables"]["deals"]["Row"];

interface DealsTabProps {
  deals: Deal[];
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

export function DealsTab({ deals }: DealsTabProps) {
  const totalRevenue = deals.reduce((sum, d) => sum + Number(d.revenue), 0);
  const totalProfit = deals.reduce((sum, d) => sum + Number(d.profit), 0);

  return (
    <div role="tabpanel" id="tabpanel-deals" aria-labelledby="tab-deals" className="space-y-4">
      {deals.length === 0 ? (
        <EmptyState
          variant="compact"
          icon={<DollarSign className="h-6 w-6" aria-hidden="true" />}
          title="No deals yet"
          description="This student hasn't recorded any deals yet"
        />
      ) : (
        <div className="bg-ima-surface border border-ima-border rounded-xl overflow-hidden">
          {/* Column headers — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 bg-ima-surface-light border-b border-ima-border text-xs font-medium text-ima-text-secondary uppercase tracking-wider">
            <span className="w-24">Deal</span>
            <span className="flex-1">Revenue</span>
            <span className="flex-1">Profit</span>
            <span className="w-20">Margin</span>
            <span className="w-28 text-right">Date</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-ima-border">
            {deals.map((deal) => (
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
            <span className="w-20 text-ima-text-secondary">{formatMargin(totalRevenue, totalProfit)}</span>
            <span className="w-28"></span>
          </div>
        </div>
      )}
    </div>
  );
}
