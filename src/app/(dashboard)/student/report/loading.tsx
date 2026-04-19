export default function Loading() {
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-4 md:-mb-8 min-h-screen bg-[#FAFAF7]">
      <div className="mx-auto max-w-3xl px-6 md:px-14 pt-10 md:pt-14 pb-20">
        {/* Kicker row */}
        <div className="motion-safe:animate-pulse flex items-center gap-3">
          <div className="h-[11px] w-24 rounded bg-[#EDE9E0]" />
          <span className="h-px flex-1 bg-[#EDE9E0]" />
          <div className="h-3 w-20 rounded bg-[#EDE9E0]" />
        </div>

        {/* Hero date */}
        <div className="mt-4 h-[48px] md:h-[60px] w-[320px] max-w-full rounded bg-[#EDE9E0] motion-safe:animate-pulse" />
        <div className="mt-4 h-4 w-56 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />

        {/* Form card */}
        <div className="mt-10 rounded-[14px] border border-[#EDE9E0] bg-white divide-y divide-[#EDE9E0] motion-safe:animate-pulse">
          <div className="p-5 md:p-6 space-y-4">
            <div className="h-3 w-32 rounded bg-[#F1EEE6]" />
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 w-11 rounded bg-[#F1EEE6]" />
                ))}
              </div>
              <div className="h-4 w-20 rounded bg-[#F1EEE6]" />
            </div>
          </div>
          <div className="p-5 md:p-6 space-y-3">
            <div className="h-3 w-28 rounded bg-[#F1EEE6]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-11 rounded bg-[#F1EEE6]" />
              <div className="h-11 rounded bg-[#F1EEE6]" />
            </div>
            <div className="h-11 rounded bg-[#F1EEE6]" />
          </div>
          <div className="p-5 md:p-6 space-y-4">
            <div className="h-3 w-24 rounded bg-[#F1EEE6]" />
            <div className="h-24 w-full rounded bg-[#F1EEE6]" />
            <div className="h-24 w-full rounded bg-[#F1EEE6]" />
          </div>
          <div className="p-5 md:p-6">
            <div className="h-14 w-full rounded-[10px] bg-[#F1EEE6]" />
          </div>
        </div>

        {/* Footer link */}
        <div className="mt-10 h-4 w-36 rounded bg-[#EDE9E0] motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
