import {
  formatDealLoggedBy,
  type LoggedByUser,
  type ViewerRole,
  type AttributionVariant,
} from "@/lib/deals-attribution";

interface DealAttributionChipProps {
  deal: { logged_by: string | null };
  viewerRole: ViewerRole;
  viewerId: string;
  userMap: Record<string, LoggedByUser>;
}

const VARIANT_CLASSES: Record<AttributionVariant, string> = {
  self: "bg-[#E8EEFF] text-[#4A6CF7]",
  coach: "bg-[#F5F2E9] text-[#7A7466]",
  owner: "bg-[#F5F2E9] text-[#7A7466]",
  unknown: "bg-[#F5F2E9] text-[#8A8474]",
};

export function DealAttributionChip({
  deal,
  viewerRole,
  viewerId,
  userMap,
}: DealAttributionChipProps) {
  const result = formatDealLoggedBy(deal, viewerRole, viewerId, userMap);
  return (
    <span
      role="status"
      aria-label={result.ariaLabel}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${VARIANT_CLASSES[result.variant]}`}
    >
      {result.label}
    </span>
  );
}
