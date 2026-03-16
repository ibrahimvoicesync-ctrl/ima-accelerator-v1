"use client";

import { useState, useCallback } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  max?: number;
  disabled?: boolean;
}

export function StarRating({ value, onChange, max = 5, disabled = false }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Math.min(value + 1, max));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Math.max(value - 1, 1));
      }
    },
    [disabled, value, max, onChange]
  );

  return (
    <div
      id="star-rating-group"
      role="radiogroup"
      aria-labelledby="star-rating-label"
      className="flex gap-1"
      onKeyDown={handleKeyDown}
    >
      {Array.from({ length: max }, (_, i) => {
        const starNumber = i + 1;
        const isFilled = starNumber <= (hovered || value);
        const isHoverPreview = hovered > 0 && starNumber <= hovered && starNumber > value;

        return (
          <button
            key={starNumber}
            type="button"
            role="radio"
            aria-checked={starNumber === value}
            aria-label={`${starNumber} star${starNumber !== 1 ? "s" : ""}`}
            tabIndex={starNumber === value || (value === 0 && starNumber === 1) ? 0 : -1}
            disabled={disabled}
            className={cn(
              "p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ima-primary rounded",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && onChange(starNumber)}
            onMouseEnter={() => !disabled && setHovered(starNumber)}
            onMouseLeave={() => !disabled && setHovered(0)}
          >
            <Star
              aria-hidden="true"
              className={cn(
                "h-8 w-8 motion-safe:transition-colors",
                isFilled && !isHoverPreview && "fill-ima-warning text-ima-warning",
                isHoverPreview && "fill-ima-warning/60 text-ima-warning/60",
                !isFilled && "text-ima-text-muted"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
