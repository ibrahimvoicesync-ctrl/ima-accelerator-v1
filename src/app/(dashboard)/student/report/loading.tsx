import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-12">
      {/* Hero header */}
      <div className="mb-10">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-9 w-72" />
      </div>

      {/* Hero metric */}
      <div className="mb-12">
        <div className="flex items-baseline justify-between mb-3 gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-16 md:h-20 w-56 mb-5" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-48 mt-3" />
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-ima-border bg-ima-bg/60 divide-y divide-ima-border">
        <div className="p-5 md:p-6 space-y-4">
          <Skeleton className="h-3 w-32" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-11 rounded" />
              ))}
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="p-5 md:p-6 space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <Skeleton className="h-11" />
        </div>
        <div className="p-5 md:p-6 space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="p-5 md:p-6">
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>

      {/* Footer link */}
      <Skeleton className="h-4 w-36 mt-10" />
    </div>
  );
}
