import { unstable_cache } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchStudentAnalytics,
  studentAnalyticsTag,
  STUDENT_ANALYTICS_RANGES,
  type StudentAnalyticsRange,
} from "@/lib/rpc/student-analytics";
import { AnalyticsClient } from "@/app/(dashboard)/student/analytics/AnalyticsClient";
import type { LoggedByUser } from "@/lib/deals-attribution";

const RangeSchema = z.enum(STUDENT_ANALYTICS_RANGES).catch("30d");
const PageSchema = z.coerce.number().int().min(1).catch(1);

type SearchParams = {
  range?: string;
  page?: string;
};

export default async function StudentDiyAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("student_diy");
  const admin = createAdminClient();

  const resolved = await searchParams;
  const range: StudentAnalyticsRange = RangeSchema.parse(resolved.range ?? "30d");
  const page: number = PageSchema.parse(resolved.page ?? "1");

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("joined_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[student_diy-analytics] Failed to load profile:", profileError);
    throw new Error("Failed to load profile");
  }

  const joinedAt = profile?.joined_at ?? new Date().toISOString();

  const fetchCached = unstable_cache(
    async (studentId: string, r: StudentAnalyticsRange, p: number) =>
      fetchStudentAnalytics(studentId, r, p),
    ["student-analytics-v2"],
    {
      revalidate: 60,
      tags: [studentAnalyticsTag(user.id)],
    },
  );

  const data = await fetchCached(user.id, range, page);

  // Phase 49: build userMap for logged_by ids in the current deal page.
  const loggedByIds = Array.from(
    new Set(
      data.deals
        .map((d) => d.logged_by)
        .filter((id): id is string => typeof id === "string")
    )
  );
  const { data: loggedByUsers } =
    loggedByIds.length > 0
      ? await admin
          .from("users")
          .select("id, name, role")
          .in("id", loggedByIds)
      : { data: [] as { id: string; name: string; role: string }[] };
  const userMap: Record<string, LoggedByUser> = {};
  for (const u of loggedByUsers ?? []) {
    userMap[u.id] = {
      id: u.id,
      name: u.name,
      role: u.role as LoggedByUser["role"],
    };
  }

  return (
    <div className="px-4 md:px-6 py-8 md:py-12 max-w-7xl mx-auto">
      <AnalyticsClient
        initialData={data}
        studentId={user.id}
        joinedAt={joinedAt}
        initialRange={range}
        initialPage={page}
        basePath="/student_diy/analytics"
        viewerId={user.id}
        viewerRole="student_diy"
        userMap={userMap}
      />
    </div>
  );
}
