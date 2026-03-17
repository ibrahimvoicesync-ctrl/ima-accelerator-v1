import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="px-4 space-y-5">
      {/* Heading */}
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Iframe placeholder */}
      <Skeleton className="h-[600px] w-full rounded-xl" />
    </div>
  );
}
