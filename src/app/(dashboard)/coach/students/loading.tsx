import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4">
      {/* Heading */}
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-52 mt-2" />

      {/* Student card grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
