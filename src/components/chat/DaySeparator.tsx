"use client";

import { formatDaySeparator } from "@/lib/chat-utils";

interface DaySeparatorProps {
  date: string; // ISO date string like "2026-04-03"
}

export function DaySeparator({ date }: DaySeparatorProps) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="bg-ima-surface-light text-ima-text-light text-xs font-medium px-3 py-1 rounded-full">
        {formatDaySeparator(new Date(date))}
      </span>
    </div>
  );
}
