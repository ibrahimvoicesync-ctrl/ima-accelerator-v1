import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      {/* Heading */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-52 mt-2" />

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-ima-surface border border-ima-border rounded-xl p-4 flex items-center gap-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Student card grid */}
      <div className="mt-6">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
