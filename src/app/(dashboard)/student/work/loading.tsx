import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 max-w-2xl mx-auto">
      {/* Heading */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-56 mt-2" />

      {/* Timer card */}
      <div className="bg-ima-surface border border-ima-border rounded-xl p-6 mt-6 flex flex-col items-center space-y-4">
        <Skeleton className="h-48 w-48 rounded-full" />
        <Skeleton className="h-11 w-48" />
      </div>

      {/* Cycle cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
