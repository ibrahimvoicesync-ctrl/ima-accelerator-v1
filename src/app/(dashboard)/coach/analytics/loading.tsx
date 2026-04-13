/**
 * Phase 48: /coach/analytics loading skeleton.
 *
 * Mirrors the eventual layout: header + 5 KPI cards + 3 leaderboard cards
 * + chart card + 7-col x 25-row table. Single role="status" wrapper at the
 * top with one aria-label; nested skeletons are aria-hidden.
 */

import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading coach analytics"
      className="px-4 py-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" aria-hidden="true" />
          <Skeleton className="h-4 w-72 mt-2" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-40 rounded-full" aria-hidden="true" />
          <Skeleton className="h-11 w-32 rounded-lg" aria-hidden="true" />
        </div>
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" aria-hidden="true" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-20" aria-hidden="true" />
              <Skeleton className="h-3 w-24" aria-hidden="true" />
            </div>
          </div>
        ))}
      </div>

      {/* 3 leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-ima-surface border border-ima-border rounded-xl p-4"
          >
            <Skeleton className="h-5 w-36" aria-hidden="true" />
            <Skeleton className="h-3 w-40 mt-2" aria-hidden="true" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-11 w-full" aria-hidden="true" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chart card */}
      <div className="mt-6 bg-ima-surface border border-ima-border rounded-xl p-4">
        <Skeleton className="h-5 w-56" aria-hidden="true" />
        <Skeleton className="h-3 w-64 mt-2" aria-hidden="true" />
        <Skeleton className="h-72 w-full mt-4 rounded-lg" aria-hidden="true" />
      </div>

      {/* Student list */}
      <div className="mt-6 bg-ima-surface border border-ima-border rounded-xl">
        <div className="p-4 border-b border-ima-border flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-32" aria-hidden="true" />
          <Skeleton className="h-11 w-72" aria-hidden="true" />
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 25 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" aria-hidden="true" />
          ))}
        </div>
      </div>
    </div>
  );
}
