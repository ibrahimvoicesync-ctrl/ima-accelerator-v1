"use client";

import { ChevronDown } from "lucide-react";
import type { MouseEvent } from "react";

export function ReferralNudge() {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("referral");
    if (!target) return;
    e.preventDefault();
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
    target.focus({ preventScroll: true });
  };

  return (
    <a
      href="#referral"
      onClick={handleClick}
      aria-label="Earn $500 for every friend who joins. Scroll to the Refer a Friend section."
      className="group flex items-center justify-between gap-4 w-full rounded-[12px] border border-[#EDE9E0] bg-white px-4 md:px-5 py-3 min-h-[44px] hover:border-[#D8D2C4] motion-safe:transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A6CF7] focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center rounded-full bg-[#E8EEFF] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-[#4A6CF7] shrink-0">
          Partner Program
        </span>
        <p className="text-sm text-[#7A7466] truncate">
          Earn{" "}
          <span className="font-semibold tabular-nums text-[#4A6CF7]">$500</span>{" "}
          <span className="hidden sm:inline">for every friend who joins IMA.</span>
          <span className="sm:hidden">per referral.</span>
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.22em] font-semibold text-[#4A6CF7] shrink-0">
        <span className="hidden sm:inline">Scroll to refer</span>
        <span className="sm:hidden">Scroll</span>
        <ChevronDown
          className="h-4 w-4 motion-safe:transition-transform duration-200 ease-out group-hover:translate-y-0.5 group-focus-visible:translate-y-0.5"
          aria-hidden="true"
        />
      </span>
    </a>
  );
}
