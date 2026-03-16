import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

export function StudentHeader({ student, isAtRisk, atRiskReasons }: StudentHeaderProps) {
  const initial = student.name.charAt(0).toUpperCase();
  const joinDate = new Date(student.joined_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Back button */}
      <Link href="/coach">
        <Button variant="ghost" size="sm">
          <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Student info */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-ima-primary flex items-center justify-center text-xl font-bold text-white shrink-0">
          {initial}
        </div>

        {/* Name and join date */}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ima-text">{student.name}</h1>
          <p className="text-sm text-ima-text-secondary">
            Joined {joinDate}
          </p>
          {student.status === "suspended" && (
            <Badge variant="warning" size="sm" className="mt-1">Suspended</Badge>
          )}
        </div>

        {/* At-risk badge */}
        {isAtRisk && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <Badge variant="error">At Risk</Badge>
            <p className="text-sm text-ima-text-secondary">
              {atRiskReasons.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
