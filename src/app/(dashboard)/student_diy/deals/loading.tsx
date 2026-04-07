import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 space-y-5">
      {/* Page heading */}
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      {/* Add deal button area */}
      <div className="flex justify-end">
        <Skeleton className="h-11 w-28 rounded-lg" />
      </div>
      {/* Table container */}
      <div className="bg-ima-surface border border-ima-border rounded-xl overflow-hidden">
        {/* Table header skeleton */}
        <div className="hidden sm:flex gap-4 px-4 py-2 border-b border-ima-border">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
        {/* 5 row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-ima-border last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
