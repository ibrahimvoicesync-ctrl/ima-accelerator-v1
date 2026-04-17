/**
 * Phase 64: SegmentedControl primitive — Weekly / Monthly / Yearly / All Time
 * toggles for every owner analytics leaderboard card.
 *
 * Accessibility: radiogroup + radio pattern with arrow-key navigation and
 * roving tabindex (active segment gets tabIndex=0, others -1). Every segment
 * meets Hard Rule 2 (min-h-[44px]). motion-safe transitions only. ima-* tokens
 * only (text-white only on colored ima-primary bg — allowed per CLAUDE.md).
 */

"use client";

import { useCallback, useRef, type KeyboardEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const segmentVariants = cva(
  "inline-flex items-center justify-center px-3 text-xs font-medium min-h-[44px] rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary focus-visible:ring-offset-1",
  {
    variants: {
      active: {
        true: "bg-ima-primary text-white",
        false:
          "bg-transparent text-ima-text-secondary hover:bg-ima-surface-light hover:text-ima-text",
      },
    },
    defaultVariants: { active: false },
  },
);

export type SegmentedControlOption<T extends string = string> = {
  value: T;
  label: string;
};

export interface SegmentedControlProps<T extends string = string>
  extends VariantProps<typeof segmentVariants> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + options.length) % options.length;
      const nextOpt = options[nextIndex]!;
      onChange(nextOpt.value);
      // Move focus to the new active segment so keyboard nav feels native.
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="radio"]',
      );
      buttons?.[nextIndex]?.focus();
    },
    [options, onChange],
  );

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 p-1 rounded-lg border border-ima-border bg-ima-surface",
        className,
      )}
    >
      {options.map((opt, idx) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(segmentVariants({ active: isActive }))}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
