import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { COACH_CONFIG } from "@/lib/config";
import { getToday } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonVariants } from "@/components/ui";
import { Users } from "lucide-react";
import Link from "next/link";
import { CoachCard } from "@/components/owner/CoachCard";
import { PaginationControls } from "@/components/ui/PaginationControls";

const PAGE_SIZE = 25;

export default async function OwnerCoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireRole("owner");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const admin = createAdminClient();
  const today = getToday();
  const nowMs = new Date(today + "T23:59:59Z").getTime();
  const sevenDaysAgo = new Date(
    nowMs - COACH_CONFIG.reportInboxDays * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  // Paginated coaches query
  const { data: coaches, count, error: coachesError } = await admin
    .from("users")
    .select("id, name, email, status, joined_at", { count: "estimated" })
    .eq("role", "coach")
    .order("name")
    .range(from, to);

  if (coachesError) {
    console.error("[owner coaches] Failed to load coaches:", coachesError);
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const coachList = coaches ?? [];

  // Only fetch enrichment data if we have coaches on this page
  let enrichedCoaches: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    joined_at: string;
    studentCount: number;
    avgRating: number | null;
  }> = [];

  if (coachList.length > 0) {
    const coachIds = coachList.map((c) => c.id);

    const [studentsResult, reportsResult] = await Promise.all([
      admin
        .from("users")
        .select("id, coach_id")
        .eq("role", "student")
        .eq("status", "active")
        .in("coach_id", coachIds),
      admin
        .from("daily_reports")
        .select("student_id, star_rating")
        .gte("date", sevenDaysAgo)
        .not("star_rating", "is", null),
    ]);

    if (studentsResult.error) {
      console.error("[owner coaches] Failed to load students:", studentsResult.error);
    }
    if (reportsResult.error) {
      console.error("[owner coaches] Failed to load reports:", reportsResult.error);
    }

    // Build lookup maps
    const studentsByCoach = new Map<string, number>();
    const studentCoachMap = new Map<string, string>();

    for (const student of studentsResult.data ?? []) {
      if (student.coach_id) {
        studentsByCoach.set(
          student.coach_id,
          (studentsByCoach.get(student.coach_id) ?? 0) + 1
        );
        studentCoachMap.set(student.id, student.coach_id);
      }
    }

    const coachRatings = new Map<string, number[]>();
    for (const report of reportsResult.data ?? []) {
      const coachId = studentCoachMap.get(report.student_id);
      if (coachId && report.star_rating !== null) {
        const arr = coachRatings.get(coachId) ?? [];
        arr.push(report.star_rating);
        coachRatings.set(coachId, arr);
      }
    }

    enrichedCoaches = coachList.map((coach) => ({
      ...coach,
      studentCount: studentsByCoach.get(coach.id) ?? 0,
      avgRating: (() => {
        const ratings = coachRatings.get(coach.id);
        if (!ratings || ratings.length === 0) return null;
        return ratings.reduce((a, b) => a + b, 0) / ratings.length;
      })(),
    }));
  }

  return (
    <div className="px-4">
      <h1 className="text-2xl font-bold text-ima-text">Coaches</h1>
      <p className="mt-1 text-ima-text-secondary">
        ~{count ?? 0} coach{(count ?? 0) !== 1 ? "es" : ""} on the platform
      </p>

      {enrichedCoaches.length === 0 ? (
        <div className="mt-6">
          <Card>
            <EmptyState
              icon={<Users className="h-6 w-6" aria-hidden="true" />}
              title="No coaches yet"
              description="Coaches will appear here once invited and registered."
              action={
                <Link href="/owner/invites" className={buttonVariants({ variant: "primary" })}>
                  Invite Coaches
                </Link>
              }
            />
          </Card>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {enrichedCoaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            basePath="/owner/coaches"
          />
        </>
      )}
    </div>
  );
}
