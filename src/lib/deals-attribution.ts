/**
 * Shared deal attribution helper + types.
 *
 * Phase 49: single source of truth for resolving who logged a deal.
 * Consumed by DealAttributionChip (src/components/shared/DealAttributionChip.tsx)
 * and by every surface that renders a deals list — student own list,
 * coach/owner student-detail Deals tab, student analytics deal history.
 *
 * Pure — no React, no fetch, no side effects beyond a single console.warn on
 * missing user lookup (per CLAUDE.md "never swallow errors").
 */

export type ViewerRole = "student" | "student_diy" | "coach" | "owner";

export interface LoggedByUser {
  id: string;
  name: string;
  role: "student" | "student_diy" | "coach" | "owner";
}

export type AttributionVariant = "self" | "coach" | "owner" | "unknown";

export interface AttributionResult {
  label: string;
  variant: AttributionVariant;
  ariaLabel: string;
}

interface DealLike {
  logged_by: string | null;
}

function firstName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return name ?? "";
  const [first] = trimmed.split(/\s+/);
  return first || trimmed;
}

export function formatDealLoggedBy(
  deal: DealLike,
  viewerRole: ViewerRole,
  viewerId: string,
  userMap: Record<string, LoggedByUser>,
): AttributionResult {
  // Defensive: logged_by may be null if the FK ON DELETE SET NULL fired.
  if (!deal.logged_by) {
    return {
      label: "Unknown",
      variant: "unknown",
      ariaLabel: "Logged by unknown user",
    };
  }

  if (deal.logged_by === viewerId) {
    return {
      label: "You",
      variant: "self",
      ariaLabel: "Logged by you",
    };
  }

  const user = userMap[deal.logged_by];
  if (!user) {
    // Never swallow — surface the lookup miss so callers can audit the fetch.
    // viewerRole is included for context; it does not change the result.
    console.warn(
      "[deals-attribution] missing user for logged_by",
      deal.logged_by,
      "viewerRole:",
      viewerRole,
    );
    return {
      label: "Unknown",
      variant: "unknown",
      ariaLabel: "Logged by unknown user",
    };
  }

  if (user.role === "coach") {
    return {
      label: firstName(user.name),
      variant: "coach",
      ariaLabel: `Logged by ${user.name}`,
    };
  }

  if (user.role === "owner") {
    return {
      label: `Owner: ${firstName(user.name)}`,
      variant: "owner",
      ariaLabel: `Logged by ${user.name}`,
    };
  }

  // student / student_diy logging someone else's deal shouldn't happen post-Phase 45
  // (RLS + route handler block it). Render defensively rather than crash.
  return {
    label: firstName(user.name),
    variant: "unknown",
    ariaLabel: `Logged by ${user.name}`,
  };
}
