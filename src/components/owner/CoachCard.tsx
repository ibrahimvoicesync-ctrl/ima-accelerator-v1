import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

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
      className="min-h-[44px] block"
    >
      <Card interactive>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ima-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ima-text truncate">
              {coach.name}
            </p>
            <p className="text-xs text-ima-text-secondary truncate">
              {coach.email}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-ima-text">
              {coach.studentCount}
            </p>
            <p className="text-xs text-ima-text-secondary">students</p>
          </div>
          <div className="text-right shrink-0 ml-2">
            <p className="text-sm font-semibold text-ima-text">
              {coach.avgRating !== null ? coach.avgRating.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-ima-text-secondary">avg rating</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
