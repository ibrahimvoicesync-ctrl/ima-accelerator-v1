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
import { AnalyticsClient } from "./AnalyticsClient";

const RangeSchema = z.enum(STUDENT_ANALYTICS_RANGES).catch("30d");
const PageSchema = z.coerce.number().int().min(1).catch(1);

type SearchParams = {
  range?: string;
  page?: string;
};

export default async function StudentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireRole("student");
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
    console.error("[student-analytics] Failed to load profile:", profileError);
    throw new Error("Failed to load profile");
  }

  const joinedAt = profile?.joined_at ?? new Date().toISOString();

  const fetchCached = unstable_cache(
    async (studentId: string, r: StudentAnalyticsRange, p: number) =>
      fetchStudentAnalytics(studentId, r, p),
    ["student-analytics"],
    {
      revalidate: 60,
      tags: [studentAnalyticsTag(user.id)],
    },
  );

  const data = await fetchCached(user.id, range, page);

  return (
    <div className="px-4 md:px-6 py-8 md:py-12 max-w-7xl mx-auto">
      <AnalyticsClient
        initialData={data}
        studentId={user.id}
        joinedAt={joinedAt}
        initialRange={range}
        initialPage={page}
        basePath="/student/analytics"
      />
    </div>
  );
}
