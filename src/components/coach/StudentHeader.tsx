import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface StudentHeaderProps {
  student: {
    name: string;
    email: string;
    joined_at: string;
    status: string;
  };
  isAtRisk: boolean;
  atRiskReasons: string[];
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function StudentHeader({ student, isAtRisk, atRiskReasons }: StudentHeaderProps) {
  const joinDate = new Date(student.joined_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5 motion-safe:animate-fadeIn">
      {/* Back link */}
      <Link
        href="/coach/students"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#4A6CF7] hover:text-[#3852D8] min-h-[44px] w-fit focus-visible:outline-2 focus-visible:outline-[#4A6CF7] focus-visible:outline-offset-2 rounded-md px-1"
      >
        <ChevronLeft className="h-[14px] w-[14px]" aria-hidden="true" />
        All students
      </Link>

      {/* Eyebrow */}
      <div>
        <p
          className="text-[11px] font-semibold tracking-[0.22em] text-[#8A8474] uppercase"
          style={{ fontFamily: "var(--font-mono-bold)" }}
        >
          Student Profile
        </p>

        {/* Identity row */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-[#F1EEE6] border border-[#EDE9E0] flex items-center justify-center text-[18px] font-semibold text-[#5A5648] shrink-0">
              {initials(student.name)}
            </div>
            <div className="min-w-0">
              <h1 className="text-[28px] md:text-[32px] font-bold leading-[1.1] text-[#1A1A17] tracking-[-0.02em] truncate">
                {student.name}
              </h1>
              <p className="mt-1 text-[13px] text-[#7A7466] truncate">{student.email}</p>
              <p
                className="mt-1 text-[10px] font-medium text-[#8A8474] tracking-[0.14em] uppercase"
                style={{ fontFamily: "var(--font-mono-bold)" }}
              >
                Joined {joinDate}
              </p>
            </div>
          </div>

          {/* Status + risk pills */}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {student.status === "suspended" && (
              <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-[#FDF3E0] border border-[#F0DFB3] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9A6B1F]">
                Suspended
              </span>
            )}
            {isAtRisk && (
              <span className="inline-flex items-center px-2 py-[3px] rounded-full bg-[#FDEAEA] border border-[#F5C6C6] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#DC2626]">
                At Risk
              </span>
            )}
          </div>
        </div>

        {/* Risk reason line */}
        {isAtRisk && atRiskReasons.length > 0 && (
          <p
            className="mt-4 text-[10px] font-medium text-[#9A6B1F] tracking-[0.14em] uppercase"
            style={{ fontFamily: "var(--font-mono-bold)" }}
          >
            {atRiskReasons.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
