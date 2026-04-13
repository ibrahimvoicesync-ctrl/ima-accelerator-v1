"use client";

/**
 * Phase 48: Export CSV button.
 *
 * Triggers a browser download via window.location.href against
 * /api/coach/analytics/export.csv. The route handler is auth-gated to
 * coach role and returns the file with Content-Disposition: attachment.
 *
 * A 1500ms cooldown prevents double-click double-downloads. Cleared on unmount
 * to avoid setState-on-unmounted warnings.
 */

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { CoachAnalyticsSort } from "@/lib/rpc/coach-analytics-types";

type Props = {
  sort: CoachAnalyticsSort;
  search: string;
};

export function ExportCsvButton({ sort, search }: Props) {
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick() {
    if (busy) return;
    setBusy(true);

    const params = new URLSearchParams({ sort });
    if (search) params.set("search", search);
    const href = `/api/coach/analytics/export.csv?${params.toString()}`;

    // window.location.href triggers the browser to follow the URL — the route
    // returns Content-Disposition: attachment so the file downloads instead
    // of navigating. This is simpler than fetch+blob+anchor for a small CSV.
    window.location.href = href;

    timeoutRef.current = setTimeout(() => {
      setBusy(false);
    }, 1500);
  }

  return (
    <Button
      variant="outline"
      size="md"
      onClick={handleClick}
      disabled={busy}
      aria-label="Export student list as CSV"
    >
      {busy ? (
        <>
          <Spinner size="sm" className="mr-2" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" aria-hidden="true" />
          Export CSV
        </>
      )}
    </Button>
  );
}
