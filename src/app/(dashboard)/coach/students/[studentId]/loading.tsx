export default function Loading() {
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-14 pt-10 md:pt-14 pb-20 space-y-8">
        {/* Back link */}
        <div className="h-4 w-24 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />

        {/* Header */}
        <div>
          <div className="h-[14px] w-28 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />
          <div className="mt-3 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#EDE9E0] motion-safe:animate-pulse shrink-0" />
            <div className="space-y-2">
              <div className="h-8 w-48 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />
              <div className="h-3 w-56 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[14px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[96px] bg-white border border-[#EDE9E0] rounded-[12px] motion-safe:animate-pulse"
            />
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#EDE9E0]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-11 w-24 bg-[#F1EEE6] rounded-t-md motion-safe:animate-pulse"
            />
          ))}
        </div>

        {/* Tab content */}
        <div className="space-y-[14px]">
          <div className="h-[220px] bg-white border border-[#EDE9E0] rounded-[14px] motion-safe:animate-pulse" />
          <div className="h-[220px] bg-white border border-[#EDE9E0] rounded-[14px] motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}
