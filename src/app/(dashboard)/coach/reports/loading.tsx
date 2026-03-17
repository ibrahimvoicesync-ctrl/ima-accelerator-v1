import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      {/* Heading */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-56 mt-2" />

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-2 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-lg" />
        ))}
      </div>

      {/* Report row list */}
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 flex-1" />
            <Skeleton className="h-11 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
