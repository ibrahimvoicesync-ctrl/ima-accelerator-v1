"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Users } from "lucide-react";

interface Student {
  id: string;
  name: string;
  email: string;
  status: string;
  joined_at: string;
  coach_id: string | null;
}

interface OwnerStudentSearchClientProps {
  students: Student[];
  initialSearch: string;
}

export function OwnerStudentSearchClient({
  students,
  initialSearch,
}: OwnerStudentSearchClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const routerRef = useRef(useRouter());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(value: string) {
    setSearch(value);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      if (value) {
        routerRef.current.push(`/owner/students?search=${encodeURIComponent(value)}`);
      } else {
        routerRef.current.push("/owner/students");
      }
    }, 300);
  }

  return (
    <div>
      <Input
        label="Search students"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        aria-label="Search students by name or email"
      />

      {students.length === 0 ? (
        <div className="mt-4">
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-10 w-10 text-ima-text-secondary mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-ima-text">No students found</p>
              <p className="text-xs text-ima-text-secondary mt-1">
                {search ? "Try a different search term" : "No students have joined the platform yet"}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {students.map((s) => {
            const initials = s.name
              .split(" ")
              .map((n) => n[0] ?? "")
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <Link key={s.id} href={`/owner/students/${s.id}`} className="min-h-[44px] block">
                <Card interactive>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ima-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ima-text truncate">{s.name}</p>
                      <p className="text-xs text-ima-text-secondary truncate">{s.email}</p>
                    </div>
                    <Badge
                      variant={
                        s.status === "active"
                          ? "success"
                          : s.status === "suspended"
                          ? "warning"
                          : "default"
                      }
                      size="sm"
                    >
                      {s.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
