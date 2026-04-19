import Link from "next/link";

interface CoachCardProps {
  coach: {
    id: string;
    name: string;
    email: string;
    studentCount: number;
    avgRating: number | null;
  };
}

export function CoachCard({ coach }: CoachCardProps) {
  const initials = coach.name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={`/owner/coaches/${coach.id}`}
      aria-label={coach.name}
      className="block rounded-[14px] border border-[#EDE9E0] bg-white p-5 min-h-[128px] motion-safe:transition-[transform,border-color] hover:-translate-y-[1px] hover:border-[#D8D2C4] focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2"
    >
      {/* Top row: avatar + name/email */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#F1EEE6] border border-[#EDE9E0] flex items-center justify-center text-[12px] font-semibold text-[#5A5648] shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#1A1A17] truncate leading-tight">
            {coach.name}
          </p>
          <p className="mt-[3px] text-[12px] text-[#7A7466] truncate">
            {coach.email}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#EDE9E0] mt-4" aria-hidden="true" />

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p
            className="text-[10px] font-semibold tracking-[0.14em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Students
          </p>
          <p className="mt-[6px] text-[16px] font-semibold text-[#1A1A17] tabular-nums slashed-zero tracking-[-0.005em]">
            {coach.studentCount}
          </p>
        </div>
        <div>
          <p
            className="text-[10px] font-semibold tracking-[0.14em] text-[#8A8474] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            Avg Rating (7d)
          </p>
          <p className="mt-[6px] text-[16px] font-semibold text-[#1A1A17] tabular-nums slashed-zero tracking-[-0.005em]">
            {coach.avgRating !== null ? coach.avgRating.toFixed(1) : "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
