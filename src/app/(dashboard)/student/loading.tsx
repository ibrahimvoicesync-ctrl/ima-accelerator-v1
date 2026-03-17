import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      {/* Heading */}
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-48 mt-2" />

      {/* Work Progress Card */}
      <div className="bg-ima-surface border border-ima-border rounded-xl p-6 mt-6 space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-7 w-12" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-11 w-full" />
      </div>

      {/* 2-col placeholder cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="bg-ima-surface border border-ima-border rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
