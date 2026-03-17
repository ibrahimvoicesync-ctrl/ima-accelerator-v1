import { SkeletonCard } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 space-y-5 max-w-2xl mx-auto">
      {/* Back link */}
      <Skeleton className="h-4 w-28" />

      {/* Heading */}
      <Skeleton className="h-8 w-48" />

      {/* Report card list */}
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
