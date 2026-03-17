import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 space-y-5 max-w-2xl mx-auto">
      {/* Heading */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Date + stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-20 rounded-xl sm:col-span-2" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Status banner */}
      <Skeleton className="h-16 rounded-xl" />

      {/* Form card */}
      <div className="bg-ima-surface border border-ima-border rounded-xl p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full mt-2" />
      </div>

      {/* History link */}
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
