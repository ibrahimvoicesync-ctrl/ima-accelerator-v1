import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 max-w-3xl mx-auto">
      {/* Heading */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-56 mt-2" />

      {/* Hero metric + progress bar */}
      <div className="mt-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-20 w-72 mt-3" />
        <Skeleton className="h-2.5 w-full rounded-full mt-6" />
      </div>

      {/* Session list — single column, 4 rows (matches live layout) */}
      <div className="flex flex-col gap-3 mt-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
